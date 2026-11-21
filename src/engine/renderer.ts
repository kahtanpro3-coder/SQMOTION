import {
  Layer,
  ProjectSettings,
  ShaderEffect,
  ParticleConfig,
  TextConfig,
  VectorShapeConfig,
  OrbitSettings,
  CameraViewMode,
  EvaluatedSceneState,
  EvaluatedCameraState,
  PreviewQuality,
} from '../types';
import {
  evaluateLayerTransform,
  getLayerWorldMatrix,
  getActiveCameraTransform,
  evaluateSceneGraph,
  evaluateActiveCamera,
  computeInfinitePerspective,
} from './interpolator';
import {
  renderNodeVideoMesh3D,
  renderNodeVideoFloorFX,
  renderReal3DPerspectivePlane,
  rotatePoint3D,
  project3DToScreen,
  projectLocalCorner3D,
  unprojectScreenToLayerLocal,
} from './mesh3dRenderer';
import { renderModel3DToCanvas, setModel3DHydrationNotifier } from './model3dLoader';
import { WebGL3DCompositor, WebGL3DLayerInput } from './webgl3dCompositor';
import {
  computeEffectTransforms,
  applyCanvasEffects,
  isTimeAnimatedEffect,
  isBoundsExpandingEffect,
  isCanvasVisualEffect,
  isOverlayProceduralEffect,
} from './effectsProcessor';
import { getActiveThemePalette } from '../utils/appSettings';
import {
  getDescendantLayerIds,
  isEffectivelyLocked,
  isEffectivelyVisible,
} from './groupUtils';

interface VideoPlaybackState {
  isStartingPlay: boolean;
  lastSeekTime: number;
  autoplayMutedFallback: boolean;
  decodedSerial: number;
}

export class EngineRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;
  private scratchCanvas: HTMLCanvasElement;
  private scratchCtx: CanvasRenderingContext2D;
  private effectScratchCanvas: HTMLCanvasElement;
  private hitTestCanvas: HTMLCanvasElement;
  private hitTestCtx: CanvasRenderingContext2D;
  private groupCanvasPool: HTMLCanvasElement[] = [];
  private tightBoundsCache: Map<string, { minX: number; minY: number; maxX: number; maxY: number }> = new Map();
  private webglCompositor: WebGL3DCompositor | null = null;
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private videoCache: Map<string, HTMLVideoElement> = new Map();
  private videoStates: WeakMap<HTMLVideoElement, VideoPlaybackState> = new WeakMap();
  private isCurrentlyPlaying: boolean = false;
  private isCurrentlyInteracting: boolean = false;
  private exportSafeMode: boolean = false;
  private tempExportBlobUrls: string[] = [];
  public onNeedsRender?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2d context');
    this.ctx = context;

    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;

    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d')!;

    this.scratchCanvas = document.createElement('canvas');
    this.scratchCtx = this.scratchCanvas.getContext('2d')!;

    this.effectScratchCanvas = document.createElement('canvas');

    this.hitTestCanvas = document.createElement('canvas');
    this.hitTestCtx = this.hitTestCanvas.getContext('2d', { willReadFrequently: true })!;

    this.webglCompositor = new WebGL3DCompositor();
    setModel3DHydrationNotifier(() => {
      if (this.onNeedsRender) this.onNeedsRender();
    });
  }

  public async preloadAssets(layers: Layer[], forExport: boolean = false): Promise<void> {
    this.exportSafeMode = forExport;
    const promises: Promise<any>[] = [];

    // Preload font readiness
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      promises.push(
        Promise.race([
          document.fonts.ready.catch(() => {}),
          new Promise<void>((res) => setTimeout(res, 1500)),
        ])
      );
    }

    // Preload Images & Videos
    for (const l of layers) {
      if (l.type === 'image' && l.mediaUrl) {
        const url = l.mediaUrl;
        if (!this.imageCache.has(url)) {
          promises.push(
            new Promise<void>((resolve) => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
              };
              const timeoutId = setTimeout(finish, 4500);

              const img = new Image();
              if (url.startsWith('http://') || url.startsWith('https://')) {
                img.crossOrigin = 'anonymous';
              }
              img.onload = () => {
                clearTimeout(timeoutId);
                this.imageCache.set(url, img);
                finish();
              };
              img.onerror = async () => {
                if (forExport) {
                  // For export, avoid untainted->tainted fallback; attempt CORS fetch into blob URL first
                  try {
                    const resp = await fetch(url, { mode: 'cors' });
                    if (resp.ok) {
                      const blob = await resp.blob();
                      const objUrl = URL.createObjectURL(blob);
                      this.tempExportBlobUrls.push(objUrl);
                      const corsImg = new Image();
                      corsImg.onload = () => {
                        clearTimeout(timeoutId);
                        this.imageCache.set(url, corsImg);
                        finish();
                      };
                      corsImg.onerror = () => {
                        clearTimeout(timeoutId);
                        finish();
                      };
                      corsImg.src = objUrl;
                      return;
                    }
                  } catch {
                    // CORS blocked cleanly: leave uncached so export never taints the canvas
                  }
                  clearTimeout(timeoutId);
                  finish();
                  return;
                }

                const fallbackImg = new Image();
                fallbackImg.onload = () => {
                  clearTimeout(timeoutId);
                  this.imageCache.set(url, fallbackImg);
                  finish();
                };
                fallbackImg.onerror = () => {
                  clearTimeout(timeoutId);
                  finish();
                };
                fallbackImg.src = url;
              };
              img.src = url;
            })
          );
        }
      }

      if (l.type === 'video' && l.mediaUrl) {
        const url = l.mediaUrl;
        const cacheKey = `${l.id}::${url}`;
        if (!this.videoCache.has(cacheKey)) {
          promises.push(
            new Promise<void>((resolve) => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
              };
              const timeoutId = setTimeout(finish, 5000);

              const video = document.createElement('video');
              video.muted = true;
              video.playsInline = true;
              video.preload = 'auto';
              if (url.startsWith('http://') || url.startsWith('https://')) {
                video.crossOrigin = 'anonymous';
              }
              video.onloadeddata = () => {
                clearTimeout(timeoutId);
                this.videoCache.set(cacheKey, video);
                finish();
              };
              video.onerror = () => {
                clearTimeout(timeoutId);
                finish();
              };
              video.src = url;
              video.load();
            })
          );
        }
      }
    }

    await Promise.all(promises);
  }

  public dispose(): void {
    this.isCurrentlyPlaying = false;
    if (this.webglCompositor) {
      this.webglCompositor.dispose();
      this.webglCompositor = null;
    }
    this.videoCache.forEach((video) => {
      try {
        video.pause();
        video.onloadedmetadata = null;
        video.onloadeddata = null;
        video.onseeked = null;
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
      this.videoStates.delete(video);
    });
    this.videoCache.clear();
    for (const objUrl of this.tempExportBlobUrls) {
      try {
        URL.revokeObjectURL(objUrl);
      } catch {
        // ignore
      }
    }
    this.tempExportBlobUrls = [];
  }

  public resize(width: number, height: number, sceneWidth: number = width, sceneHeight: number = height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (this.offscreenCanvas.width !== sceneWidth || this.offscreenCanvas.height !== sceneHeight) {
      this.offscreenCanvas.width = sceneWidth;
      this.offscreenCanvas.height = sceneHeight;
    }
    if (this.maskCanvas.width !== sceneWidth || this.maskCanvas.height !== sceneHeight) {
      this.maskCanvas.width = sceneWidth;
      this.maskCanvas.height = sceneHeight;
    }
    if (this.scratchCanvas.width !== sceneWidth || this.scratchCanvas.height !== sceneHeight) {
      this.scratchCanvas.width = sceneWidth;
      this.scratchCanvas.height = sceneHeight;
    }
  }

  public render(
    settings: ProjectSettings,
    layers: Layer[],
    currentFrame: number,
    selectedLayerId: string | null = null,
    showGuides: boolean = true,
    isPlaying: boolean = false,
    cameraViewMode: CameraViewMode = 'first_person',
    orbitSettings: OrbitSettings = { pitch: -25, yaw: 35, distance: 0.85, panX: 0, panY: 0 },
    showDebugOverlay: boolean = false,
    previewQuality: PreviewQuality = 'auto',
    isInteracting: boolean = false
  ) {
    const effectiveQuality = previewQuality || settings.previewQuality || 'auto';
    let qualityScale = 1.0;
    if (effectiveQuality === 'low') {
      qualityScale = 0.25;
    } else if (effectiveQuality === 'medium') {
      qualityScale = 0.5;
    } else if (effectiveQuality === 'full') {
      qualityScale = 1.0;
    } else if (effectiveQuality === 'auto') {
      qualityScale = isPlaying || isInteracting ? 0.5 : 1.0;
    }

    const sceneW = Math.max(1, settings.width);
    const sceneH = Math.max(1, settings.height);
    const minScale = Math.max(160 / sceneW, 90 / sceneH);
    const clampedScale = Math.min(1.0, Math.max(qualityScale, minScale));
    const targetW = Math.max(1, Math.round(sceneW * clampedScale));
    const targetH = Math.max(1, Math.round(sceneH * clampedScale));
    this.resize(targetW, targetH, sceneW, sceneH);

    const scaleX = targetW / sceneW;
    const scaleY = targetH / sceneH;

    this.ctx.save();
    if (scaleX !== 1.0 || scaleY !== 1.0) {
      this.ctx.scale(scaleX, scaleY);
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'medium';
    }

    this.isCurrentlyPlaying = isPlaying;
    this.isCurrentlyInteracting = isInteracting;

    // Evaluate single authoritative scene state
    const scene = evaluateSceneGraph(layers, currentFrame, settings.fps, settings);

    // Clear main canvas (supports true transparent background as well as black/solid colors)
    this.ctx.clearRect(0, 0, settings.width, settings.height);
    const bg = settings.backgroundColor;
    const isTransparentBg =
      bg === 'transparent' ||
      bg === '#00000000' ||
      bg === 'rgba(0,0,0,0)' ||
      /^#[0-9a-f]{6}00$/i.test(bg || '');
    if (!isTransparentBg) {
      this.ctx.fillStyle = bg || '#000000';
      this.ctx.fillRect(0, 0, settings.width, settings.height);
    }

    const layerMap = new Map<string, Layer>();
    for (const l of layers) layerMap.set(l.id, l);

    // Filter visible layers active at currentFrame (respecting ancestor group visibility & timing)
    const visibleLayers = layers.filter((l) => isEffectivelyVisible(l, layerMap, currentFrame));

    // Clean up deleted layer videos and pause cached videos that are inactive or when paused
    const allLayerVideoKeys = new Set(
      layers.filter((l) => l.type === 'video' && l.mediaUrl).map((l) => `${l.id}::${l.mediaUrl!}`)
    );
    const activeVideoKeys = new Set(
      visibleLayers.filter((l) => l.type === 'video' && l.mediaUrl).map((l) => `${l.id}::${l.mediaUrl!}`)
    );
    this.videoCache.forEach((video, key) => {
      if (!allLayerVideoKeys.has(key)) {
        try {
          video.pause();
          video.onloadedmetadata = null;
          video.onloadeddata = null;
          video.onseeked = null;
          video.removeAttribute('src');
          video.load();
        } catch (e) {}
        this.videoCache.delete(key);
        this.videoStates.delete(video);
        return;
      }
      if (!activeVideoKeys.has(key) || !isPlaying) {
        if (!video.paused) {
          try {
            video.pause();
          } catch (e) {}
        }
        const st = this.videoStates.get(video);
        if (st) {
          st.isStartingPlay = false;
          if (!isPlaying) st.autoplayMutedFallback = false;
        }
      }
    });

    // Always sync visible video playback/seek state BEFORE WebGL texture cache decisions
    // so pressing Play/Pause or scrubbing never gets skipped by a cached texture signature.
    for (const layer of visibleLayers) {
      if (layer.type === 'video' && layer.mediaUrl) {
        this.syncVideoPlayback(layer, currentFrame, settings, isPlaying);
      }
    }

    const cameraTransform = {
      active: scene.camera.active,
      x: scene.camera.position.x,
      y: scene.camera.position.y,
      z: scene.camera.position.z,
      rotX: scene.camera.rotation.x,
      rotY: scene.camera.rotation.y,
      rotZ: scene.camera.rotation.z,
      zoom: scene.camera.zoom,
    };

    if (cameraViewMode === 'third_person') {
      // 3D Orbit / Third-Person Studio View
      this.renderThirdPersonScene(
        settings,
        layers,
        visibleLayers,
        currentFrame,
        selectedLayerId,
        showGuides,
        isPlaying,
        orbitSettings,
        cameraTransform
      );
      if (showDebugOverlay) {
        this.renderDebugHUD(this.ctx, settings, currentFrame, scene, selectedLayerId);
      }
      this.ctx.restore();
      return;
    }

    // 1st Person (Through Camera Lens / Standard Active View)
    // Real 3D Depth Sorting: layers with higher Z come forward and penetrate in front of layers with lower Z
    const getLayer3DDepth = (l: Layer): number => {
      const evalState = scene.layers.get(l.id);
      const wZ = evalState?.worldPosition.z ?? (evaluateLayerTransform(l, currentFrame, settings.fps).position.z || 0);

      // If camera is active and in 3D mode, sort by distance to camera view plane
      if (scene.camera.active && scene.camera.type === '3d') {
        const dx = (evalState?.worldPosition.x ?? 0) - scene.camera.position.x;
        const dy = (evalState?.worldPosition.y ?? 0) - scene.camera.position.y;
        let dz = (scene.camera.fov || 1000) - (wZ - scene.camera.position.z);

        if (scene.camera.rotation.y !== 0) {
          const radY = (-scene.camera.rotation.y * Math.PI) / 180;
          dz = -dx * Math.sin(radY) + dz * Math.cos(radY);
        }
        if (scene.camera.rotation.x !== 0) {
          const radX = (-scene.camera.rotation.x * Math.PI) / 180;
          dz = dy * Math.sin(radX) + dz * Math.cos(radX);
        }
        // Smaller dz is closer to camera (drawn on top / later in painter's algorithm)
        return -dz;
      }

      // Default: higher worldZ is closer to viewer (drawn on top / later in painter's algorithm)
      return wZ;
    };

    // Sort visible layers: farthest (lowest Z) first, closest (highest Z) last (on top)
    // If Z values are identical (e.g. both Z = 0), preserve original layer stack order
    const sortedVisibleLayers = [...visibleLayers].sort((a, b) => {
      const depthA = getLayer3DDepth(a);
      const depthB = getLayer3DDepth(b);
      const diff = depthA - depthB;
      if (Math.abs(diff) > 0.05) {
        return diff;
      }
      return layers.indexOf(a) - layers.indexOf(b);
    });

    // Prune deleted/inactive textures in WebGL 3D compositor
    const activeLayerIds = new Set(visibleLayers.map((l) => l.id));
    this.webglCompositor?.pruneUnusedLayers(activeLayerIds);

    const useWebGL3D = Boolean(this.webglCompositor && this.webglCompositor.isSupported());

    const isWebGL3DEligible = (layer: Layer): boolean => {
      if (!useWebGL3D) return false;
      if (
        layer.type === 'null' ||
        layer.type === 'camera' ||
        layer.type === 'audio' ||
        layer.type === 'adjustment' ||
        layer.type === 'group'
      ) {
        return false;
      }
      if (layer.type === 'model3d') return false;
      if (layer.mesh3dConfig && layer.mesh3dConfig.enabled) {
        if (layer.mesh3dConfig.type !== 'plane' || (layer.mesh3dConfig.depth ?? 0) > 1) {
          return false;
        }
      }
      if (layer.mask && layer.mask.maskLayerId) return false;
      if (layer.fixedIn3D === true || layer.is3D === false) return false;
      if (layer.blendMode && layer.blendMode !== 'normal' && (layer.blendMode as string) !== 'source-over') {
        return false;
      }
      if (layer.effects?.some((e) => e.enabled && (e.type === 'flip3d' || e.type === 'box3d' || e.type === 'extrude3d'))) {
        return false;
      }
      return true;
    };

    const flushWebGLBatch = (batch: Layer[]) => {
      if (!this.webglCompositor || batch.length === 0) return;

      const batchStarInfos: Array<{
        layer: Layer;
        starEffects: ShaderEffect[];
        worldX: number;
        worldY: number;
        worldZ: number;
        worldRotX: number;
        worldRotY: number;
        worldRotZ: number;
        worldScaleX: number;
        worldScaleY: number;
        worldScaleZ: number;
        opacity: number;
        layerViewDist: number;
      }> = [];

      const inputs: WebGL3DLayerInput[] = [];

      for (const layer of batch) {
        const evalState = scene.layers.get(layer.id);
        const transform = evalState?.localTransform || evaluateLayerTransform(layer, currentFrame, settings.fps);
        const fx = computeEffectTransforms(layer, currentFrame, settings);

        const worldX = (evalState?.worldPosition.x ?? transform.position.x ?? settings.width / 2) + fx.extraX;
        const worldY = (evalState?.worldPosition.y ?? transform.position.y ?? settings.height / 2) + fx.extraY;
        const worldZ = (evalState?.worldPosition.z ?? transform.position.z ?? 0) + fx.extraZ;

        const worldScaleX = Math.max(1e-7, (evalState?.worldScale.x ?? (transform.scale.x || 100) / 100) * fx.extraScaleX);
        const worldScaleY = Math.max(1e-7, (evalState?.worldScale.y ?? (transform.scale.y || 100) / 100) * fx.extraScaleY);
        const worldScaleZ = (evalState?.worldScale.z ?? (transform.scale.z || 100) / 100) * fx.extraScaleZ;

        const worldRotX = (evalState?.worldRotation.x ?? transform.rotation.x ?? 0) + fx.extraRotX;
        const worldRotY = (evalState?.worldRotation.y ?? transform.rotation.y ?? 0) + fx.extraRotY;
        const worldRotZ = (evalState?.worldRotation.z ?? transform.rotation.z ?? 0) + fx.extraRotZ;

        const opacity = (evalState?.worldOpacity ?? (transform.opacity ?? 100) / 100) * fx.effectOpacity;
        const anchorX = Number.isFinite(transform.anchorPoint?.x) ? transform.anchorPoint.x : 0;
        const anchorY = Number.isFinite(transform.anchorPoint?.y) ? transform.anchorPoint.y : 0;

        const starEffects = (layer.effects || []).filter(
          (e) => e.enabled && (e.type === 'motionStars' || e.type === 'starfield' || e.type === 'spaceLines')
        );
        if (starEffects.length > 0) {
          const cam = scene.camera;
          const is3DCam = cam.active && cam.type === '3d';
          const camFov = is3DCam ? (cam.fov || 1000) : 1000;
          const camX = cam.active ? cam.position.x : settings.width / 2;
          const camY = cam.active ? cam.position.y : settings.height / 2;
          const camZ = is3DCam ? cam.position.z : 0;
          let cdx = worldX - camX;
          let cdy = worldY - camY;
          let cdz = camFov - (worldZ - camZ);
          if (is3DCam && cam.rotation.y !== 0) {
            const radY = (-cam.rotation.y * Math.PI) / 180;
            const cosY = Math.cos(radY);
            const sinY = Math.sin(radY);
            const nx = cdx * cosY + cdz * sinY;
            const nz = -cdx * sinY + cdz * cosY;
            cdx = nx;
            cdz = nz;
          }
          if (is3DCam && cam.rotation.x !== 0) {
            const radX = (-cam.rotation.x * Math.PI) / 180;
            const cosX = Math.cos(radX);
            const sinX = Math.sin(radX);
            const nz = cdy * sinX + cdz * cosX;
            cdz = nz;
          }

          batchStarInfos.push({
            layer,
            starEffects,
            worldX,
            worldY,
            worldZ,
            worldRotX,
            worldRotY,
            worldRotZ,
            worldScaleX,
            worldScaleY,
            worldScaleZ,
            opacity,
            layerViewDist: cdz,
          });
        }

        const texMetrics = this.measureLayerTextureSize(layer, settings);
        const hasTimeEffects = Boolean(
          layer.effects?.some((e) => e.enabled && isTimeAnimatedEffect(e.type))
        );
        const hasVisualFx = Boolean(
          layer.effects?.some((e) => e.enabled && isCanvasVisualEffect(e.type, layer.type === 'text'))
        );

        const isDynamic =
          layer.type === 'video' ||
          layer.type === 'particle' ||
          Boolean(layer.textConfig?.animator?.enabled) ||
          hasTimeEffects ||
          texMetrics.pendingLoad;

        let texScale = 1;
        if (layer.type === 'video') {
          const maxDim = Math.max(texMetrics.width, texMetrics.height);
          const capDim = isPlaying || isInteracting || qualityScale < 1 ? 840 : 1080;
          if (maxDim > capDim) {
            texScale = capDim / maxDim;
          }
        }

        let dynamicKey: string | undefined;
        if (layer.type === 'video' && layer.mediaUrl) {
          const cacheKey = `${layer.id}::${layer.mediaUrl}`;
          const vid = this.videoCache.get(cacheKey);
          const vidSt = vid ? this.videoStates.get(vid) : undefined;
          const timeFxKey = hasTimeEffects ? `:tf${currentFrame}` : '';
          dynamicKey = vid
            ? `${vidSt?.decodedSerial ?? 0}:${Math.round(vid.currentTime * 1000)}:${vid.readyState}:${vid.videoWidth}x${vid.videoHeight}:${isPlaying ? 1 : 0}:${vid.paused ? 1 : 0}${timeFxKey}`
            : 'loading';
        } else if (layer.type === 'particle' || hasTimeEffects || layer.textConfig?.animator?.enabled) {
          dynamicKey = `f:${currentFrame}`;
        } else if (texMetrics.pendingLoad) {
          dynamicKey = 'pending';
        }

        const effectsSig = this.buildEffectsSig(layer.effects);
        const sig = `${layer.type}|${texMetrics.width}x${texMetrics.height}|${texMetrics.extraSig}|${effectsSig}`;

        inputs.push({
          layer,
          stackIndex: layers.indexOf(layer),
          worldX,
          worldY,
          worldZ,
          scaleX: worldScaleX,
          scaleY: worldScaleY,
          scaleZ: worldScaleZ,
          rotationX: worldRotX,
          rotationY: worldRotY,
          rotationZ: worldRotZ,
          opacity,
          anchorX,
          anchorY,
          contentWidth: texMetrics.width,
          contentHeight: texMetrics.height,
          textureScale: texScale,
          isDynamic,
          dynamicKey,
          contentSignature: sig,
          drawContent: (_targetCanvas, targetCtx, cw, ch) => {
            targetCtx.save();
            targetCtx.translate(cw / 2, ch / 2);
            if (texScale !== 1) {
              targetCtx.scale(texScale, texScale);
            }
            this.renderLayerContent(targetCtx, layer, currentFrame, settings, isPlaying);
            targetCtx.restore();

            if (hasVisualFx) {
              applyCanvasEffects(
                targetCtx,
                layer.effects!,
                cw,
                ch,
                currentFrame,
                settings.fps,
                { isTextLayer: layer.type === 'text', scratchCanvas: this.effectScratchCanvas, layerZ: worldZ }
              );
            }
          },
        });
      }

      // Draw behind-stars/lines for batch layers
      for (const s of batchStarInfos) {
        if (s.opacity <= 0.001) continue;
        for (const eff of s.starEffects) {
          this.ctx.save();
          this.ctx.globalAlpha = s.opacity;
          this.renderSpaceEffect3D(
            this.ctx,
            s.layer,
            eff,
            currentFrame,
            settings,
            'behind',
            s.worldX,
            s.worldY,
            s.worldZ,
            s.worldRotX,
            s.worldRotY,
            s.worldRotZ,
            s.worldScaleX,
            s.worldScaleY,
            s.worldScaleZ,
            scene.camera,
            layers,
            s.layerViewDist
          );
          this.ctx.restore();
        }
      }

      const webglCanvas = this.webglCompositor.renderBatch(
        inputs,
        settings,
        scene.camera,
        targetW,
        targetH
      );
      if (webglCanvas) {
        this.ctx.drawImage(webglCanvas, 0, 0, settings.width, settings.height);
      }

      // Draw front-stars/lines for batch layers
      for (const s of batchStarInfos) {
        if (s.opacity <= 0.001) continue;
        for (const eff of s.starEffects) {
          this.ctx.save();
          this.ctx.globalAlpha = s.opacity;
          this.renderSpaceEffect3D(
            this.ctx,
            s.layer,
            eff,
            currentFrame,
            settings,
            'front',
            s.worldX,
            s.worldY,
            s.worldZ,
            s.worldRotX,
            s.worldRotY,
            s.worldRotZ,
            s.worldScaleX,
            s.worldScaleY,
            s.worldScaleZ,
            scene.camera,
            layers,
            s.layerViewDist
          );
          this.ctx.restore();
        }
      }
    };

    const needsGroupCompositing = (g: Layer): boolean => {
      if (g.type !== 'group') return false;
      if (g.groupConfig?.composite || g.groupConfig?.clipToBounds) return true;
      if (g.mask?.maskLayerId) return true;
      if (g.blendMode && g.blendMode !== 'normal' && (g.blendMode as string) !== 'source-over') return true;
      if (g.effects?.some((e) => e.enabled)) return true;
      return false;
    };

    const compositedDescendantIds = new Set<string>();
    for (const l of sortedVisibleLayers) {
      if (needsGroupCompositing(l)) {
        for (const dId of getDescendantLayerIds(l.id, layers)) {
          compositedDescendantIds.add(dId);
        }
      }
    }

    let currentWebGLBatch: Layer[] = [];

    for (let i = 0; i < sortedVisibleLayers.length; i++) {
      const layer = sortedVisibleLayers[i];

      // Descendants of composited groups are rendered inside their parent group buffer
      if (compositedDescendantIds.has(layer.id)) {
        continue;
      }

      if (layer.type === 'group') {
        if (!needsGroupCompositing(layer)) {
          // Pass-through group: children render directly in sortedVisibleLayers & inherit transforms via evaluateSceneGraph
          continue;
        }
        if (currentWebGLBatch.length > 0) {
          flushWebGLBatch(currentWebGLBatch);
          currentWebGLBatch = [];
        }
        this.renderCompositedGroup(
          this.ctx,
          layer,
          layers,
          sortedVisibleLayers,
          settings,
          currentFrame,
          isPlaying,
          cameraTransform,
          0
        );
        continue;
      }

      // Adjustment layers composite all active effects over the rendered layers underneath them
      if (layer.type === 'adjustment') {
        if (currentWebGLBatch.length > 0) {
          flushWebGLBatch(currentWebGLBatch);
          currentWebGLBatch = [];
        }
        this.renderAdjustmentOrEffectOnlyLayer(layer, layers, settings, currentFrame, cameraTransform, scene);
        continue;
      }

      // Null / Camera / Audio nodes are normally invisible, UNLESS they have enabled effects attached
      if (layer.type === 'null' || layer.type === 'camera' || layer.type === 'audio') {
        const hasAnyEnabledFx = Boolean(layer.effects?.some((e) => e.enabled));
        if (!hasAnyEnabledFx) continue;
        if (currentWebGLBatch.length > 0) {
          flushWebGLBatch(currentWebGLBatch);
          currentWebGLBatch = [];
        }
        this.renderAdjustmentOrEffectOnlyLayer(layer, layers, settings, currentFrame, cameraTransform, scene);
        continue;
      }

      // Pure 3D Starfield / SpaceLines layers (particle layer with 0 cartoon particles + motionStars/starfield/spaceLines)
      // render directly in full depth-sorted 3D space without allocating empty WebGL quad textures
      const isPureStarfieldLayer =
        layer.type === 'particle' &&
        (layer.particleConfig?.count ?? 40) <= 0 &&
        Boolean(
          layer.effects?.some(
            (e) => e.enabled && (e.type === 'motionStars' || e.type === 'starfield' || e.type === 'spaceLines')
          )
        );
      if (isPureStarfieldLayer) {
        if (currentWebGLBatch.length > 0) {
          flushWebGLBatch(currentWebGLBatch);
          currentWebGLBatch = [];
        }
        this.renderAdjustmentOrEffectOnlyLayer(layer, layers, settings, currentFrame, cameraTransform, scene);
        continue;
      }

      if (isWebGL3DEligible(layer)) {
        currentWebGLBatch.push(layer);
        continue;
      }

      if (currentWebGLBatch.length > 0) {
        flushWebGLBatch(currentWebGLBatch);
        currentWebGLBatch = [];
      }

      // Handle Masking
      if (layer.mask && layer.mask.maskLayerId) {
        const maskLayer = sortedVisibleLayers.find((m) => m.id === layer.mask!.maskLayerId);
        if (maskLayer) {
          this.renderLayerWithMask(layer, maskLayer, layers, settings, currentFrame, isPlaying, cameraTransform, scene);
          continue;
        }
      }

      this.renderSingleLayer(this.ctx, layer, layers, settings, currentFrame, isPlaying, cameraTransform, scene);
    }

    if (currentWebGLBatch.length > 0) {
      flushWebGLBatch(currentWebGLBatch);
      currentWebGLBatch = [];
    }

    // Render interactive transform overlay / gizmo if a layer is selected and guides are enabled
    if (selectedLayerId && showGuides) {
      const selected = layers.find((l) => l.id === selectedLayerId);
      if (selected && selected.visible) {
        this.renderTransformHandles(settings, selected, layers, currentFrame, cameraTransform);
      }
    }

    // Render Debug Overlay HUD when toggled
    if (showDebugOverlay) {
      this.renderDebugHUD(this.ctx, settings, currentFrame, scene, selectedLayerId);
    }

    this.ctx.restore();
  }

  /**
   * 3D Point to 2D Screen projection given orbit parameters
   */
  private project3D(
    x: number,
    y: number,
    z: number,
    settings: ProjectSettings,
    orbit: OrbitSettings
  ): { x: number; y: number; scale: number; depth: number } {
    const cx = settings.width / 2;
    const cy = settings.height / 2;

    const dx = x - cx;
    const dy = y - cy;
    const dz = z;

    // Yaw rotation around Y axis
    const radYaw = (orbit.yaw * Math.PI) / 180;
    const cosY = Math.cos(radYaw);
    const sinY = Math.sin(radYaw);
    const rx = dx * cosY + dz * sinY;
    const rz1 = -dx * sinY + dz * cosY;

    // Pitch rotation around X axis
    const radPitch = (orbit.pitch * Math.PI) / 180;
    const cosP = Math.cos(radPitch);
    const sinP = Math.sin(radPitch);
    const ry = dy * cosP - rz1 * sinP;
    const rz = dy * sinP + rz1 * cosP;

    const fov = 1500;
    const distZ = fov + rz + 600;
    const perspective = computeInfinitePerspective(fov, distZ, 200);
    const scale = perspective * (orbit.distance || 0.85);

    return {
      x: cx + rx * scale + (orbit.panX || 0),
      y: cy + ry * scale + (orbit.panY || 0),
      scale,
      depth: rz,
    };
  }

  /**
   * Render complete 3D scene from an external third-person orbit perspective
   */
  private renderThirdPersonScene(
    settings: ProjectSettings,
    allLayers: Layer[],
    visibleLayers: Layer[],
    currentFrame: number,
    selectedLayerId: string | null,
    showGuides: boolean,
    isPlaying: boolean,
    orbit: OrbitSettings,
    cameraTransform: { active: boolean; x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number; zoom: number }
  ) {
    const cx = settings.width / 2;
    const cy = settings.height / 2;

    // 1. Draw 3D Ground Grid (Floor Plane)
    this.render3DGroundGrid(this.ctx, settings, orbit);

    // 2. Draw 3D World Center Crosshair / Screen Frame Boundary in 3D
    this.render3DWorldBounds(this.ctx, settings, orbit);

    // 3. Collect 3D layers and sort by depth for painter's algorithm
    const sortedRenderables: Array<{
      type: 'layer' | 'camera_gizmo';
      depth: number;
      layer?: Layer;
    }> = [];

    // Find camera layers
    const cameraLayers = allLayers.filter((l) => l.type === 'camera' && l.visible);
    cameraLayers.forEach((camLayer) => {
      const transform = evaluateLayerTransform(camLayer, currentFrame, settings.fps);
      const camP = this.project3D(transform.position.x, transform.position.y, transform.position.z, settings, orbit);
      sortedRenderables.push({
        type: 'camera_gizmo',
        depth: camP.depth,
        layer: camLayer,
      });
    });

    // Other visible layers
    visibleLayers.forEach((layer) => {
      if (layer.type === 'camera') return;
      const worldMat = getLayerWorldMatrix(layer, allLayers, currentFrame, settings.fps, undefined, settings);
      const proj = this.project3D(worldMat.x, worldMat.y, worldMat.z, settings, orbit);
      sortedRenderables.push({
        type: 'layer',
        depth: proj.depth,
        layer,
      });
    });

    // Sort from farthest to closest (depth descending)
    sortedRenderables.sort((a, b) => b.depth - a.depth);

    // Render sorted elements
    sortedRenderables.forEach((item) => {
      if (item.type === 'camera_gizmo' && item.layer) {
        this.render3DCameraFrustum(this.ctx, item.layer, currentFrame, settings, orbit, item.layer.id === selectedLayerId);
      } else if (item.type === 'layer' && item.layer) {
        this.render3DLayerCard(this.ctx, item.layer, allLayers, settings, currentFrame, isPlaying, orbit, item.layer.id === selectedLayerId);
      }
    });

    // 4. Draw 3D Axis Indicator Widget (Top-Right / Bottom-Left)
    this.render3DAxisWidget(this.ctx, settings, orbit);

    // 5. Draw "3D Studio / Third-Person" Status Badge
    this.render3DModeBadge(this.ctx, settings, orbit, cameraTransform);
  }

  /**
   * Draw 3D Ground Grid (Floor Plane)
   */
  private render3DGroundGrid(ctx: CanvasRenderingContext2D, settings: ProjectSettings, orbit: OrbitSettings) {
    const cx = settings.width / 2;
    const cy = settings.height / 2;
    const floorY = cy + settings.height * 0.45;
    const gridSize = 1400;
    const step = 200;

    ctx.save();
    ctx.lineWidth = 1;

    for (let x = -gridSize; x <= gridSize; x += step) {
      const p1 = this.project3D(cx + x, floorY, -gridSize, settings, orbit);
      const p2 = this.project3D(cx + x, floorY, gridSize, settings, orbit);

      ctx.strokeStyle = x === 0 ? 'rgba(0, 230, 118, 0.4)' : 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let z = -gridSize; z <= gridSize; z += step) {
      const p1 = this.project3D(cx - gridSize, floorY, z, settings, orbit);
      const p2 = this.project3D(cx + gridSize, floorY, z, settings, orbit);

      ctx.strokeStyle = z === 0 ? 'rgba(0, 229, 255, 0.4)' : 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw 3D World Canvas Boundaries in space
   */
  private render3DWorldBounds(ctx: CanvasRenderingContext2D, settings: ProjectSettings, orbit: OrbitSettings) {
    const w = settings.width;
    const h = settings.height;

    const pTL = this.project3D(0, 0, 0, settings, orbit);
    const pTR = this.project3D(w, 0, 0, settings, orbit);
    const pBR = this.project3D(w, h, 0, settings, orbit);
    const pBL = this.project3D(0, h, 0, settings, orbit);

    ctx.save();
    // Shaded Screen Plane (Z = 0)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.beginPath();
    ctx.moveTo(pTL.x, pTL.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Screen Center crosshair
    const pCenter = this.project3D(w / 2, h / 2, 0, settings, orbit);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.beginPath();
    ctx.moveTo(pCenter.x - 10, pCenter.y);
    ctx.lineTo(pCenter.x + 10, pCenter.y);
    ctx.moveTo(pCenter.x, pCenter.y - 10);
    ctx.lineTo(pCenter.x, pCenter.y + 10);
    ctx.stroke();

    // Center Origin Tag
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.font = '9px monospace';
    ctx.fillText('Z = 0 (Canvas Plane)', pTL.x + 4, pTL.y - 6);
    ctx.restore();
  }

  /**
   * Render 3D Camera Frustum Cone, Body, and Viewfinder in space
   */
  private render3DCameraFrustum(
    ctx: CanvasRenderingContext2D,
    cameraLayer: Layer,
    currentFrame: number,
    settings: ProjectSettings,
    orbit: OrbitSettings,
    isSelected: boolean
  ) {
    const transform = evaluateLayerTransform(cameraLayer, currentFrame, settings.fps);
    const camX = Number.isFinite(transform.position.x) ? transform.position.x : settings.width / 2;
    const camY = Number.isFinite(transform.position.y) ? transform.position.y : settings.height / 2;
    const camZ = Number.isFinite(transform.position.z) ? transform.position.z : 0;

    const rotX = Number.isFinite(transform.rotation.x) ? transform.rotation.x : 0;
    const rotY = Number.isFinite(transform.rotation.y) ? transform.rotation.y : 0;
    const rotZ = Number.isFinite(transform.rotation.z) ? transform.rotation.z : 0;
    const zoom = Math.max(0.1, (transform.scale.x || 100) / 100);

    const fovDist = 650;
    const halfW = ((settings.width / 2) * (fovDist / 1000)) / zoom;
    const halfH = ((settings.height / 2) * (fovDist / 1000)) / zoom;

    // Helper to rotate local offset vector by camera rotX, rotY, rotZ
    const rotatePointByCam = (lx: number, ly: number, lz: number) => {
      let x = lx;
      let y = ly;
      let z = lz;

      // Pitch (X)
      if (rotX !== 0) {
        const radX = (rotX * Math.PI) / 180;
        const ny = y * Math.cos(radX) - z * Math.sin(radX);
        const nz = y * Math.sin(radX) + z * Math.cos(radX);
        y = ny;
        z = nz;
      }
      // Yaw (Y)
      if (rotY !== 0) {
        const radY = (rotY * Math.PI) / 180;
        const nx = x * Math.cos(radY) + z * Math.sin(radY);
        const nz = -x * Math.sin(radY) + z * Math.cos(radY);
        x = nx;
        z = nz;
      }
      // Roll (Z)
      if (rotZ !== 0) {
        const radZ = (rotZ * Math.PI) / 180;
        const nx = x * Math.cos(radZ) - y * Math.sin(radZ);
        const ny = x * Math.sin(radZ) + y * Math.cos(radZ);
        x = nx;
        y = ny;
      }

      return { x: camX + x, y: camY + y, z: camZ + z };
    };

    // Camera origin in 3D
    const camP = this.project3D(camX, camY, camZ, settings, orbit);

    // Frustum 4 corners at distance with camera rotation applied
    const cTL = rotatePointByCam(-halfW, -halfH, fovDist);
    const cTR = rotatePointByCam(halfW, -halfH, fovDist);
    const cBR = rotatePointByCam(halfW, halfH, fovDist);
    const cBL = rotatePointByCam(-halfW, halfH, fovDist);

    const fTL = this.project3D(cTL.x, cTL.y, cTL.z, settings, orbit);
    const fTR = this.project3D(cTR.x, cTR.y, cTR.z, settings, orbit);
    const fBR = this.project3D(cBR.x, cBR.y, cBR.z, settings, orbit);
    const fBL = this.project3D(cBL.x, cBL.y, cBL.z, settings, orbit);

    ctx.save();

    // 1. Frustum Pyramidal Volume Rays (Cyan dashed lines)
    ctx.strokeStyle = isSelected ? '#00E676' : '#38BDF8';
    ctx.lineWidth = isSelected ? 2 : 1.2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(camP.x, camP.y);
    ctx.lineTo(fTL.x, fTL.y);
    ctx.moveTo(camP.x, camP.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.moveTo(camP.x, camP.y);
    ctx.lineTo(fBR.x, fBR.y);
    ctx.moveTo(camP.x, camP.y);
    ctx.lineTo(fBL.x, fBL.y);
    ctx.stroke();

    // 2. Frustum View Frame Rectangle
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(fBR.x, fBR.y);
    ctx.lineTo(fBL.x, fBL.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Fill frustum view plane with subtle translucent cyan/emerald
    ctx.fillStyle = isSelected ? 'rgba(0, 230, 118, 0.08)' : 'rgba(56, 189, 248, 0.06)';
    ctx.fill();

    // 3. Camera Body Icon & Box in 3D Space
    const bodySize = 28 * camP.scale;
    ctx.fillStyle = isSelected ? '#059669' : '#0369A1';
    ctx.strokeStyle = isSelected ? '#34D399' : '#38BDF8';
    ctx.lineWidth = 2;

    // Body rectangle
    ctx.fillRect(camP.x - bodySize, camP.y - bodySize * 0.6, bodySize * 2, bodySize * 1.2);
    ctx.strokeRect(camP.x - bodySize, camP.y - bodySize * 0.6, bodySize * 2, bodySize * 1.2);

    // Lens cone
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(camP.x + bodySize, camP.y - bodySize * 0.3);
    ctx.lineTo(camP.x + bodySize * 1.6, camP.y - bodySize * 0.5);
    ctx.lineTo(camP.x + bodySize * 1.6, camP.y + bodySize * 0.5);
    ctx.lineTo(camP.x + bodySize, camP.y + bodySize * 0.3);
    ctx.closePath();
    ctx.fill();

    // Camera Reel circles
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(camP.x - bodySize * 0.4, camP.y - bodySize * 0.6, bodySize * 0.35, 0, Math.PI * 2);
    ctx.arc(camP.x + bodySize * 0.3, camP.y - bodySize * 0.6, bodySize * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Camera Name & Position Label
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📹 ${cameraLayer.name}`, camP.x, camP.y - bodySize - 10);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '10px monospace';
    ctx.fillText(`Z: ${Math.round(camZ)}px`, camP.x, camP.y + bodySize + 14);

    ctx.restore();
  }

  /**
   * Render a Layer in 3D Space (anchored and oriented in true 3D world coordinates)
   */
  private render3DLayerCard(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    allLayers: Layer[],
    settings: ProjectSettings,
    currentFrame: number,
    isPlaying: boolean,
    orbit: OrbitSettings,
    isSelected: boolean
  ) {
    const worldMat = getLayerWorldMatrix(layer, allLayers, currentFrame, settings.fps, undefined, settings);
    const transform = evaluateLayerTransform(layer, currentFrame, settings.fps);

    // Apply all procedural motion / 3D / visibility effects
    const fx = computeEffectTransforms(layer, currentFrame, settings);
    if (fx.effectOpacity <= 0) return;

    const effWorldMat = {
      x: (worldMat.x || 0) + fx.extraX,
      y: (worldMat.y || 0) + fx.extraY,
      z: (worldMat.z || 0) + fx.extraZ,
      scaleX: (worldMat.scaleX || 1) * fx.extraScaleX,
      scaleY: (worldMat.scaleY || 1) * fx.extraScaleY,
      scaleZ: (worldMat.scaleZ || 1) * fx.extraScaleZ,
      rotationX: (worldMat.rotationX || 0) + fx.extraRotX,
      rotationY: (worldMat.rotationY || 0) + fx.extraRotY,
      rotationZ: (worldMat.rotationZ || 0) + fx.extraRotZ,
      opacity: (worldMat.opacity ?? 1) * fx.effectOpacity,
      perspectiveOverride: fx.perspectiveOverride,
    };

    const anchorX = Number.isFinite(transform.anchorPoint?.x) ? transform.anchorPoint.x : 0;
    const anchorY = Number.isFinite(transform.anchorPoint?.y) ? transform.anchorPoint.y : 0;

    // Helper: Transforms a local offset point (lx, ly, lz) into 3D world space
    const toWorld3D = (lx: number, ly: number, lz: number = 0) => {
      let x = lx * effWorldMat.scaleX;
      let y = ly * effWorldMat.scaleY;
      let z = lz * effWorldMat.scaleZ;

      // 1. Z-roll
      if (effWorldMat.rotationZ !== 0) {
        const rz = (effWorldMat.rotationZ * Math.PI) / 180;
        const cosZ = Math.cos(rz);
        const sinZ = Math.sin(rz);
        const nx = x * cosZ - y * sinZ;
        const ny = x * sinZ + y * cosZ;
        x = nx;
        y = ny;
      }

      // 2. X-pitch
      if (effWorldMat.rotationX !== 0) {
        const rx = (effWorldMat.rotationX * Math.PI) / 180;
        const cosX = Math.cos(rx);
        const sinX = Math.sin(rx);
        const ny = y * cosX - z * sinX;
        const nz = y * sinX + z * cosX;
        y = ny;
        z = nz;
      }

      // 3. Y-yaw
      if (effWorldMat.rotationY !== 0) {
        const ry = (effWorldMat.rotationY * Math.PI) / 180;
        const cosY = Math.cos(ry);
        const sinY = Math.sin(ry);
        const nx = x * cosY + z * sinY;
        const nz = -x * sinY + z * cosY;
        x = nx;
        z = nz;
      }

      return {
        x: effWorldMat.x + x,
        y: effWorldMat.y + y,
        z: effWorldMat.z + z,
      };
    };

    // Calculate 3D projected center and basis unit vectors
    const pCenterWorld = toWorld3D(0, 0, 0);
    const pRightWorld = toWorld3D(100, 0, 0);
    const pDownWorld = toWorld3D(0, 100, 0);

    const projCenter = this.project3D(pCenterWorld.x, pCenterWorld.y, pCenterWorld.z, settings, orbit);
    const projRight = this.project3D(pRightWorld.x, pRightWorld.y, pRightWorld.z, settings, orbit);
    const projDown = this.project3D(pDownWorld.x, pDownWorld.y, pDownWorld.z, settings, orbit);

    // Layer stabilization in 3D: Fixed mode (completely anchored) vs Billboard mode (faces screen, no twisting)
    const isLayerFixed = layer.fixedIn3D === true || orbit.lockLayersPosition === true;
    const isBillboardFixed = (orbit.fixedLayers !== false && !layer.mesh3dConfig?.enabled) || layer.billboard === true || isLayerFixed;

    let a: number;
    let b: number;
    let c: number;
    let d: number;
    let e = projCenter.x;
    let f = projCenter.y;

    if (isLayerFixed) {
      // 100% Fixed layer: does not move and does not twist with 3D orbit
      const rotZRad = (effWorldMat.rotationZ * Math.PI) / 180;
      const cosZ = Math.cos(rotZRad);
      const sinZ = Math.sin(rotZRad);
      a = effWorldMat.scaleX * cosZ;
      b = effWorldMat.scaleX * sinZ;
      c = -effWorldMat.scaleY * sinZ;
      d = effWorldMat.scaleY * cosZ;
      e = effWorldMat.x;
      f = effWorldMat.y;
    } else if (isBillboardFixed) {
      // Billboard Fixed: position moves with 3D space depth, but layer stays facing viewer (does not twist/warp with orbit)
      const rotZRad = (effWorldMat.rotationZ * Math.PI) / 180;
      const cosZ = Math.cos(rotZRad);
      const sinZ = Math.sin(rotZRad);
      const s = projCenter.scale;
      a = s * effWorldMat.scaleX * cosZ;
      b = s * effWorldMat.scaleX * sinZ;
      c = -s * effWorldMat.scaleY * sinZ;
      d = s * effWorldMat.scaleY * cosZ;
      e = projCenter.x;
      f = projCenter.y;
    } else {
      // True 3D tilted card
      a = (projRight.x - projCenter.x) / 100;
      b = (projRight.y - projCenter.y) / 100;
      c = (projDown.x - projCenter.x) / 100;
      d = (projDown.y - projCenter.y) / 100;
      e = projCenter.x;
      f = projCenter.y;
    }

    const hasVisualEffects = Boolean(
      layer.effects?.some((eff) => eff.enabled && isCanvasVisualEffect(eff.type, layer.type === 'text'))
    );

    ctx.save();
    ctx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || 'source-over';
    ctx.globalAlpha = effWorldMat.opacity;

    if (layer.type === 'model3d') {
      const orbitArg = {
        pitch: isLayerFixed ? 0 : orbit.pitch,
        yaw: isLayerFixed ? 0 : orbit.yaw,
        scale: isLayerFixed ? 1 : projCenter.scale,
        screenX: isLayerFixed ? effWorldMat.x : projCenter.x,
        screenY: isLayerFixed ? effWorldMat.y : projCenter.y,
      };
      if (hasVisualEffects) {
        this.offscreenCtx.save();
        this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.offscreenCtx.clearRect(0, 0, settings.width, settings.height);
        renderModel3DToCanvas(
          this.offscreenCtx,
          layer,
          { ...effWorldMat, opacity: 1 },
          settings,
          currentFrame,
          settings.fps,
          orbitArg
        );
        this.offscreenCtx.restore();
        applyCanvasEffects(
          this.offscreenCtx,
          layer.effects!,
          settings.width,
          settings.height,
          currentFrame,
          settings.fps,
          { scratchCanvas: this.effectScratchCanvas, layerZ: effWorldMat.z }
        );
        ctx.drawImage(this.offscreenCanvas, 0, 0);
        ctx.restore();
      } else {
        ctx.restore();
        renderModel3DToCanvas(ctx, layer, effWorldMat, settings, currentFrame, settings.fps, orbitArg);
      }
    } else if (hasVisualEffects) {
      // Apply 3D perspective affine transform to canvas context
      ctx.transform(a, b, c, d, e, f);
      ctx.translate(-anchorX, -anchorY);

      this.offscreenCtx.save();
      this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.offscreenCtx.clearRect(0, 0, settings.width, settings.height);
      this.offscreenCtx.translate(settings.width / 2, settings.height / 2);
      this.renderLayerContent(this.offscreenCtx, layer, currentFrame, settings, isPlaying);
      this.offscreenCtx.restore();

      applyCanvasEffects(
        this.offscreenCtx,
        layer.effects!,
        settings.width,
        settings.height,
        currentFrame,
        settings.fps,
        { isTextLayer: layer.type === 'text', scratchCanvas: this.effectScratchCanvas, layerZ: effWorldMat.z }
      );

      ctx.drawImage(this.offscreenCanvas, -settings.width / 2, -settings.height / 2);
      ctx.restore();
    } else {
      ctx.transform(a, b, c, d, e, f);
      ctx.translate(-anchorX, -anchorY);
      this.renderLayerContent(ctx, layer, currentFrame, settings, isPlaying);
      ctx.restore();
    }

    // Render 3D Starfield / Space Lines in 3D studio mode
    const starEffects = (layer.effects || []).filter(
      (e) => e.enabled && (e.type === 'motionStars' || e.type === 'starfield' || e.type === 'spaceLines')
    );
    for (const starEffect of starEffects) {
      this.renderSpaceEffect3D(
        ctx,
        layer,
        starEffect,
        currentFrame,
        settings,
        'all',
        effWorldMat.x,
        effWorldMat.y,
        effWorldMat.z,
        effWorldMat.rotationX,
        effWorldMat.rotationY,
        effWorldMat.rotationZ,
        effWorldMat.scaleX,
        effWorldMat.scaleY,
        effWorldMat.scaleZ,
        undefined,
        allLayers,
        undefined,
        orbit
      );
    }

    // Draw 3D bounding wireframe around layer in 3D world space
    let shapeW = 220;
    let shapeH = 220;
    if (layer.type === 'solid') {
      shapeW = settings.width;
      shapeH = settings.height;
    } else if (layer.type === 'model3d') {
      shapeW = 280;
      shapeH = 280;
    } else if (layer.vectorConfig) {
      shapeW = layer.vectorConfig.width || 340;
      shapeH = layer.vectorConfig.height || 340;
    } else if (layer.textConfig) {
      shapeW = Math.max(160, (layer.textConfig.text?.length || 5) * (layer.textConfig.fontSize || 48) * 0.7);
      shapeH = (layer.textConfig.fontSize || 48) * 1.5;
    } else if (layer.particleConfig) {
      shapeW = 320;
      shapeH = 320;
    }

    const halfW = shapeW / 2;
    const halfH = shapeH / 2;

    let pTL: { x: number; y: number };
    let pTR: { x: number; y: number };
    let pBR: { x: number; y: number };
    let pBL: { x: number; y: number };

    if (isBillboardFixed || isLayerFixed) {
      // Align wireframe perfectly with fixed/billboard transform
      pTL = { x: e + (-halfW - anchorX) * a + (-halfH - anchorY) * c, y: f + (-halfW - anchorX) * b + (-halfH - anchorY) * d };
      pTR = { x: e + (halfW - anchorX) * a + (-halfH - anchorY) * c, y: f + (halfW - anchorX) * b + (-halfH - anchorY) * d };
      pBR = { x: e + (halfW - anchorX) * a + (halfH - anchorY) * c, y: f + (halfW - anchorX) * b + (halfH - anchorY) * d };
      pBL = { x: e + (-halfW - anchorX) * a + (halfH - anchorY) * c, y: f + (-halfW - anchorX) * b + (halfH - anchorY) * d };
    } else {
      const cTL_World = toWorld3D(-halfW - anchorX, -halfH - anchorY, 0);
      const cTR_World = toWorld3D(halfW - anchorX, -halfH - anchorY, 0);
      const cBR_World = toWorld3D(halfW - anchorX, halfH - anchorY, 0);
      const cBL_World = toWorld3D(-halfW - anchorX, halfH - anchorY, 0);

      pTL = this.project3D(cTL_World.x, cTL_World.y, cTL_World.z, settings, orbit);
      pTR = this.project3D(cTR_World.x, cTR_World.y, cTR_World.z, settings, orbit);
      pBR = this.project3D(cBR_World.x, cBR_World.y, cBR_World.z, settings, orbit);
      pBL = this.project3D(cBL_World.x, cBL_World.y, cBL_World.z, settings, orbit);
    }

    const themePal = getActiveThemePalette();
    ctx.save();
    ctx.strokeStyle = isSelected ? themePal.bright : 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.setLineDash(isSelected ? [] : [4, 4]);

    ctx.beginPath();
    ctx.moveTo(pTL.x, pTL.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner handle pins & 3D normal vector when selected
    if (isSelected) {
      ctx.fillStyle = themePal.bright;
      const handleSize = Math.max(5, 7 * projCenter.scale);
      [pTL, pTR, pBR, pBL].forEach((p) => {
        ctx.fillRect(p.x - handleSize / 2, p.y - handleSize / 2, handleSize, handleSize);
      });

      // Normal Vector Arrow (pointing along local 3D Z axis)
      const pNormalWorld = toWorld3D(0, 0, -80);
      const projNormal = this.project3D(pNormalWorld.x, pNormalWorld.y, pNormalWorld.z, settings, orbit);
      ctx.strokeStyle = themePal.bright;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(projCenter.x, projCenter.y);
      ctx.lineTo(projNormal.x, projNormal.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(projNormal.x, projNormal.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layer name & Z tag in 3D
    const tagX = (pTL.x + pTR.x) / 2;
    const tagY = (pTL.y + pTR.y) / 2 - 10;
    ctx.fillStyle = isSelected ? themePal.bright : 'rgba(203, 213, 225, 0.85)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${layer.name} (Z: ${Math.round(effWorldMat.z)}px)`, tagX, tagY);
    ctx.restore();
  }

  /**
   * Draw mini 3D XYZ Axis Orientation Gizmo
   */
  private render3DAxisWidget(ctx: CanvasRenderingContext2D, settings: ProjectSettings, orbit: OrbitSettings) {
    const originX = 60;
    const originY = 60;
    const axisLen = 34;

    const radYaw = (orbit.yaw * Math.PI) / 180;
    const radPitch = (orbit.pitch * Math.PI) / 180;

    // X Axis (Red)
    const xVec = {
      x: Math.cos(radYaw) * axisLen,
      y: -Math.sin(radPitch) * Math.sin(radYaw) * axisLen,
    };

    // Y Axis (Green - inverted screen Y)
    const yVec = {
      x: 0,
      y: Math.cos(radPitch) * axisLen,
    };

    // Z Axis (Blue - depth)
    const zVec = {
      x: Math.sin(radYaw) * axisLen,
      y: Math.sin(radPitch) * Math.cos(radYaw) * axisLen,
    };

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(originX, originY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // X Arrow
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + xVec.x, originY + xVec.y);
    ctx.stroke();
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('X', originX + xVec.x * 1.25, originY + xVec.y * 1.25);

    // Y Arrow
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + yVec.x, originY + yVec.y);
    ctx.stroke();
    ctx.fillStyle = '#10B981';
    ctx.fillText('Y', originX + yVec.x * 1.25, originY + yVec.y * 1.25);

    // Z Arrow
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + zVec.x, originY + zVec.y);
    ctx.stroke();
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('Z', originX + zVec.x * 1.25, originY + zVec.y * 1.25);

    ctx.restore();
  }

  /**
   * Draw Top-Center Status Badge for 3D Mode
   */
  private render3DModeBadge(
    ctx: CanvasRenderingContext2D,
    settings: ProjectSettings,
    orbit: OrbitSettings,
    cameraTransform: { active: boolean; x: number; y: number; z: number }
  ) {
    const themePal = getActiveThemePalette();
    ctx.save();
    const cx = settings.width / 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = `rgba(${themePal.primaryRgb}, 0.45)`;
    ctx.lineWidth = 1.5;

    const badgeW = 280;
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, 16, badgeW, badgeH, 13);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = themePal.bright;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🌐 3D STUDIO (المنظور الثالث) • Yaw: ${Math.round(orbit.yaw)}° Pitch: ${Math.round(orbit.pitch)}°`,
      cx,
      33
    );
    ctx.restore();
  }

  private renderSingleLayer(
    targetCtx: CanvasRenderingContext2D,
    layer: Layer,
    allLayers: Layer[],
    settings: ProjectSettings,
    currentFrame: number,
    isPlaying: boolean = false,
    cameraTransform?: { active: boolean; x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number; zoom: number },
    scene?: EvaluatedSceneState
  ) {
    const resolvedScene = scene || evaluateSceneGraph(allLayers, currentFrame, settings.fps, settings);
    const evalState = resolvedScene.layers.get(layer.id);
    const worldMat = getLayerWorldMatrix(layer, allLayers, currentFrame, settings.fps, cameraTransform, settings);
    const transform = evalState?.localTransform || evaluateLayerTransform(layer, currentFrame, settings.fps);

    targetCtx.save();

    // Apply all procedural motion / 3D / visibility effects
    const fx = computeEffectTransforms(layer, currentFrame, settings);
    if (fx.effectOpacity <= 0) {
      targetCtx.restore();
      return;
    }

    const cameraDz = (evalState?.cameraDz ?? worldMat.cameraDz ?? 1000) - fx.extraZ;

    // Set blend mode & opacity
    targetCtx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || 'source-over';
    targetCtx.globalAlpha = worldMat.opacity * fx.effectOpacity;

    // Apply World Matrix transform with infinite 3D perspective & rotation (X pitch, Y yaw, Z roll)
    const finalX = Number.isFinite(worldMat.x + fx.extraX) ? worldMat.x + fx.extraX : 0;
    const finalY = Number.isFinite(worldMat.y + fx.extraY) ? worldMat.y + fx.extraY : 0;
    const finalZ = Number.isFinite(worldMat.z + fx.extraZ) ? worldMat.z + fx.extraZ : 0;
    const finalRotZ = Number.isFinite(worldMat.rotationZ + fx.extraRotZ) ? worldMat.rotationZ + fx.extraRotZ : 0;
    const finalRotX = Number.isFinite(worldMat.rotationX + fx.extraRotX) ? worldMat.rotationX + fx.extraRotX : 0;
    const finalRotY = Number.isFinite(worldMat.rotationY + fx.extraRotY) ? worldMat.rotationY + fx.extraRotY : 0;
    const rawScaleX = Number.isFinite(worldMat.scaleX * fx.extraScaleX) ? worldMat.scaleX * fx.extraScaleX : 1;
    const rawScaleY = Number.isFinite(worldMat.scaleY * fx.extraScaleY) ? worldMat.scaleY * fx.extraScaleY : 1;
    const finalScaleX = Math.max(1e-7, Math.min(1e9, rawScaleX));
    const finalScaleY = Math.max(1e-7, Math.min(1e9, rawScaleY));
    const finalScaleZ = Number.isFinite(worldMat.scaleZ * fx.extraScaleZ) ? worldMat.scaleZ * fx.extraScaleZ : 1;
    const anchorX = Number.isFinite(transform.anchorPoint?.x) ? transform.anchorPoint.x : 0;
    const anchorY = Number.isFinite(transform.anchorPoint?.y) ? transform.anchorPoint.y : 0;

    // True camera-space state (unflattened world transforms + active camera) for 3D models & 3D text
    const worldPosX = (evalState?.worldPosition.x ?? transform.position.x ?? settings.width * 0.5) + fx.extraX;
    const worldPosY = (evalState?.worldPosition.y ?? transform.position.y ?? settings.height * 0.5) + fx.extraY;
    const worldPosZ = (evalState?.worldPosition.z ?? transform.position.z ?? 0) + fx.extraZ;
    const worldScaleX = Math.max(1e-7, (evalState?.worldScale.x ?? (transform.scale.x || 100) / 100) * fx.extraScaleX);
    const worldScaleY = Math.max(1e-7, (evalState?.worldScale.y ?? (transform.scale.y || 100) / 100) * fx.extraScaleY);
    const worldScaleZ = Math.max(1e-7, (evalState?.worldScale.z ?? (transform.scale.z || 100) / 100) * fx.extraScaleZ);
    const worldRotX = (evalState?.worldRotation.x ?? transform.rotation.x ?? 0) + fx.extraRotX;
    const worldRotY = (evalState?.worldRotation.y ?? transform.rotation.y ?? 0) + fx.extraRotY;
    const worldRotZ = (evalState?.worldRotation.z ?? transform.rotation.z ?? 0) + fx.extraRotZ;

    const cameraSpaceArg = {
      worldX: worldPosX,
      worldY: worldPosY,
      worldZ: worldPosZ,
      worldScaleX,
      worldScaleY,
      worldScaleZ,
      worldRotX,
      worldRotY,
      worldRotZ,
      camera: resolvedScene.camera,
    };

    const hasVisualEffects = Boolean(
      layer.effects?.some((e) => e.enabled && isCanvasVisualEffect(e.type, layer.type === 'text'))
    );

    // Use projective 3D plane/mesh pipeline when tilted in 3D (X/Y), is a 3D model, or has 3D extrusion enabled.
    const needs3DMeshPipeline =
      Math.abs(finalRotX) > 0.05 ||
      Math.abs(finalRotY) > 0.05 ||
      layer.type === 'model3d' ||
      Boolean(layer.mesh3dConfig && layer.mesh3dConfig.enabled);

    // Check for 3D Motion-Reactive Starfield / Space Lines effect on this layer
    const starEffects = (layer.effects || []).filter(
      (e) => e.enabled && (e.type === 'motionStars' || e.type === 'starfield' || e.type === 'spaceLines')
    );

    const layerCamViewDist = (() => {
      if (starEffects.length === 0) return 1000;
      const cam = resolvedScene.camera;
      const is3DCam = cam.active && cam.type === '3d';
      const camFov = is3DCam ? (cam.fov || 1000) : 1000;
      const camX = cam.active ? cam.position.x : settings.width / 2;
      const camY = cam.active ? cam.position.y : settings.height / 2;
      const camZ = is3DCam ? cam.position.z : 0;
      let cdx = worldPosX - camX;
      let cdy = worldPosY - camY;
      let cdz = camFov - (worldPosZ - camZ);
      if (is3DCam && cam.rotation.y !== 0) {
        const radY = (-cam.rotation.y * Math.PI) / 180;
        const cosY = Math.cos(radY);
        const sinY = Math.sin(radY);
        const nx = cdx * cosY + cdz * sinY;
        const nz = -cdx * sinY + cdz * cosY;
        cdx = nx;
        cdz = nz;
      }
      if (is3DCam && cam.rotation.x !== 0) {
        const radX = (-cam.rotation.x * Math.PI) / 180;
        const cosX = Math.cos(radX);
        const sinX = Math.sin(radX);
        cdz = cdy * sinX + cdz * cosX;
      }
      return cdz;
    })();

    // Flat 2D layers cleanly disappear once they pierce past camera.near = 6,
    // UNLESS they host a 360° volumetric starfield / space lines which surrounds the camera.
    if (!needs3DMeshPipeline && cameraDz <= 6) {
      for (const starEffect of starEffects) {
        this.renderSpaceEffect3D(
          targetCtx,
          layer,
          starEffect,
          currentFrame,
          settings,
          'all',
          worldPosX,
          worldPosY,
          worldPosZ,
          worldRotX,
          worldRotY,
          worldRotZ,
          worldScaleX,
          worldScaleY,
          worldScaleZ,
          resolvedScene.camera,
          allLayers
        );
      }
      targetCtx.restore();
      return;
    }

    // 1. Render 3D Stars / Space Lines BEHIND layer plane
    for (const starEffect of starEffects) {
      this.renderSpaceEffect3D(
        targetCtx,
        layer,
        starEffect,
        currentFrame,
        settings,
        'behind',
        worldPosX,
        worldPosY,
        worldPosZ,
        worldRotX,
        worldRotY,
        worldRotZ,
        worldScaleX,
        worldScaleY,
        worldScaleZ,
        resolvedScene.camera,
        allLayers,
        layerCamViewDist
      );
    }

    if (needs3DMeshPipeline) {
      const effMat = {
        x: finalX,
        y: finalY,
        z: finalZ,
        scaleX: finalScaleX,
        scaleY: finalScaleY,
        scaleZ: finalScaleZ,
        rotationX: finalRotX,
        rotationY: finalRotY,
        rotationZ: finalRotZ,
        opacity: worldMat.opacity * fx.effectOpacity,
        perspectiveFactor: worldMat.perspectiveFactor,
        perspectiveOverride: fx.perspectiveOverride,
      };

      if (layer.type === 'model3d') {
        if (hasVisualEffects) {
          this.offscreenCtx.save();
          this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
          this.offscreenCtx.clearRect(0, 0, settings.width, settings.height);
          renderModel3DToCanvas(
            this.offscreenCtx,
            layer,
            { ...effMat, opacity: 1 },
            settings,
            currentFrame,
            settings.fps,
            undefined,
            cameraSpaceArg
          );
          this.offscreenCtx.restore();

          applyCanvasEffects(
            this.offscreenCtx,
            layer.effects!,
            settings.width,
            settings.height,
            currentFrame,
            settings.fps,
            { scratchCanvas: this.effectScratchCanvas, layerZ: finalZ }
          );

          targetCtx.drawImage(this.offscreenCanvas, 0, 0);
        } else {
          renderModel3DToCanvas(
            targetCtx,
            layer,
            effMat,
            settings,
            currentFrame,
            settings.fps,
            undefined,
            cameraSpaceArg
          );
        }
      } else {
        const texSize = this.measureLayerTextureSize(layer, settings);
        const contentW = texSize.width;
        const contentH = texSize.height;

        this.scratchCanvas.width = contentW;
        this.scratchCanvas.height = contentH;
        this.scratchCtx.clearRect(0, 0, contentW, contentH);
        this.scratchCtx.save();
        this.scratchCtx.translate(contentW / 2, contentH / 2);
        this.renderLayerContent(this.scratchCtx, layer, currentFrame, settings, isPlaying);
        this.scratchCtx.restore();

        if (hasVisualEffects) {
          applyCanvasEffects(
            this.scratchCtx,
            layer.effects!,
            contentW,
            contentH,
            currentFrame,
            settings.fps,
            { isTextLayer: layer.type === 'text', scratchCanvas: this.effectScratchCanvas, layerZ: finalZ }
          );
        }

        const isReal3DText =
          layer.type === 'text' &&
          layer.mesh3dConfig?.enabled &&
          (layer.mesh3dConfig.type === 'extrusion' || (layer.mesh3dConfig.type as string) === 'text3d');

        if (!isReal3DText) {
          const maxWorldExtent = 0.5 * Math.hypot(
            contentW * worldScaleX,
            contentH * worldScaleY,
            (layer.mesh3dConfig?.depth ?? 40) * worldScaleZ
          );
          if (cameraDz + maxWorldExtent <= 6) {
            targetCtx.restore();
            return;
          }
        }

        if (layer.mesh3dConfig && layer.mesh3dConfig.enabled && layer.mesh3dConfig.type !== 'plane') {
          renderNodeVideoFloorFX(targetCtx, layer, effMat, settings, this.scratchCanvas, contentW, contentH);
          renderNodeVideoMesh3D(
            targetCtx,
            layer,
            effMat,
            anchorX,
            anchorY,
            settings,
            this.scratchCanvas,
            contentW,
            contentH,
            cameraSpaceArg
          );
        } else {
          renderReal3DPerspectivePlane(targetCtx, layer, effMat, anchorX, anchorY, settings, this.scratchCanvas, contentW, contentH);
        }
      }
    } else {
      // Standard Flat 2D Layer
      if (hasVisualEffects) {
        this.offscreenCtx.save();
        this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.offscreenCtx.clearRect(0, 0, settings.width, settings.height);

        this.offscreenCtx.translate(finalX, finalY);
        this.offscreenCtx.rotate((finalRotZ * Math.PI) / 180);
        this.offscreenCtx.scale(finalScaleX, finalScaleY);
        this.offscreenCtx.translate(-anchorX, -anchorY);

        this.renderLayerContent(this.offscreenCtx, layer, currentFrame, settings, isPlaying);
        this.offscreenCtx.restore();

        applyCanvasEffects(
          this.offscreenCtx,
          layer.effects!,
          settings.width,
          settings.height,
          currentFrame,
          settings.fps,
          { isTextLayer: layer.type === 'text', scratchCanvas: this.effectScratchCanvas, layerZ: finalZ }
        );

        targetCtx.drawImage(this.offscreenCanvas, 0, 0);
      } else {
        targetCtx.save();
        targetCtx.translate(finalX, finalY);
        targetCtx.rotate((finalRotZ * Math.PI) / 180);
        targetCtx.scale(finalScaleX, finalScaleY);
        targetCtx.translate(-anchorX, -anchorY);
        this.renderLayerContent(targetCtx, layer, currentFrame, settings, isPlaying);
        targetCtx.restore();
      }
    }

    // 2. Render 3D Stars / Space Lines IN FRONT of layer plane
    for (const starEffect of starEffects) {
      this.renderSpaceEffect3D(
        targetCtx,
        layer,
        starEffect,
        currentFrame,
        settings,
        'front',
        worldPosX,
        worldPosY,
        worldPosZ,
        worldRotX,
        worldRotY,
        worldRotZ,
        worldScaleX,
        worldScaleY,
        worldScaleZ,
        resolvedScene.camera,
        allLayers,
        layerCamViewDist
      );
    }

    targetCtx.restore();
  }

  private renderLayerWithMask(
    layer: Layer,
    maskLayer: Layer,
    allLayers: Layer[],
    settings: ProjectSettings,
    currentFrame: number,
    isPlaying: boolean,
    cameraTransform?: { active: boolean; x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number; zoom: number },
    scene?: EvaluatedSceneState
  ) {
    // 1. Render layer to offscreen
    this.offscreenCtx.clearRect(0, 0, settings.width, settings.height);
    this.renderSingleLayer(this.offscreenCtx, layer, allLayers, settings, currentFrame, isPlaying, cameraTransform, scene);

    // 2. Render mask to maskCanvas
    this.maskCtx.clearRect(0, 0, settings.width, settings.height);
    this.renderSingleLayer(this.maskCtx, maskLayer, allLayers, settings, currentFrame, isPlaying, cameraTransform, scene);

    // 3. Composite mask onto offscreen
    const mode = layer.mask?.mode || 'alpha';
    this.offscreenCtx.save();
    if (mode === 'alpha') {
      this.offscreenCtx.globalCompositeOperation = 'destination-in';
      this.offscreenCtx.drawImage(this.maskCanvas, 0, 0);
    } else if (mode === 'alpha-invert') {
      this.offscreenCtx.globalCompositeOperation = 'destination-out';
      this.offscreenCtx.drawImage(this.maskCanvas, 0, 0);
    }
    this.offscreenCtx.restore();

    // 4. Draw resulting layer to main canvas
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  private acquireGroupCanvas(depth: number, width: number, height: number): HTMLCanvasElement {
    while (this.groupCanvasPool.length <= depth) {
      this.groupCanvasPool.push(document.createElement('canvas'));
    }
    const c = this.groupCanvasPool[depth];
    if (c.width !== width || c.height !== height) {
      c.width = width;
      c.height = height;
    }
    return c;
  }

  private renderCompositedGroup(
    targetCtx: CanvasRenderingContext2D,
    groupLayer: Layer,
    allLayers: Layer[],
    sortedVisibleLayers: Layer[],
    settings: ProjectSettings,
    currentFrame: number,
    isPlaying: boolean,
    cameraTransform: { active: boolean; x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number; zoom: number },
    depth: number
  ) {
    if (depth > 6) return;
    const directDescendants = new Set(getDescendantLayerIds(groupLayer.id, allLayers));
    const groupBuf = this.acquireGroupCanvas(depth * 2, settings.width, settings.height);
    const groupCtx = groupBuf.getContext('2d');
    if (!groupCtx) return;

    groupCtx.clearRect(0, 0, settings.width, settings.height);

    // Evaluate scene excluding this group's opacity so group opacity applies cleanly once on composite blit
    const groupScene = evaluateSceneGraph(allLayers, currentFrame, settings.fps, settings, {
      excludeGroupOpacityIds: new Set([groupLayer.id]),
    });

    // Determine nested sub-groups inside this group that also composite
    const nestedCompositedDescendants = new Set<string>();
    const childNeedsComposite = (g: Layer) =>
      g.type === 'group' &&
      (Boolean(g.groupConfig?.composite) ||
        Boolean(g.groupConfig?.clipToBounds) ||
        Boolean(g.mask?.maskLayerId) ||
        (g.blendMode && g.blendMode !== 'normal' && (g.blendMode as string) !== 'source-over') ||
        Boolean(g.effects?.some((e) => e.enabled)));

    for (const l of sortedVisibleLayers) {
      if (l.id !== groupLayer.id && directDescendants.has(l.id) && childNeedsComposite(l)) {
        for (const subId of getDescendantLayerIds(l.id, allLayers)) {
          nestedCompositedDescendants.add(subId);
        }
      }
    }

    for (const child of sortedVisibleLayers) {
      if (!directDescendants.has(child.id)) continue;
      if (nestedCompositedDescendants.has(child.id)) continue;

      if (child.type === 'group') {
        if (childNeedsComposite(child)) {
          this.renderCompositedGroup(
            groupCtx,
            child,
            allLayers,
            sortedVisibleLayers,
            settings,
            currentFrame,
            isPlaying,
            cameraTransform,
            depth + 1
          );
        }
        continue;
      }

      if (child.type === 'null' || child.type === 'camera' || child.type === 'audio' || child.type === 'adjustment') {
        continue;
      }

      if (child.mask && child.mask.maskLayerId) {
        const maskLayer = sortedVisibleLayers.find((m) => m.id === child.mask!.maskLayerId);
        if (maskLayer) {
          this.offscreenCtx.clearRect(0, 0, settings.width, settings.height);
          this.renderSingleLayer(this.offscreenCtx, child, allLayers, settings, currentFrame, isPlaying, cameraTransform, groupScene);
          this.maskCtx.clearRect(0, 0, settings.width, settings.height);
          this.renderSingleLayer(this.maskCtx, maskLayer, allLayers, settings, currentFrame, isPlaying, cameraTransform, groupScene);
          this.offscreenCtx.save();
          this.offscreenCtx.globalCompositeOperation = child.mask.mode === 'alpha-invert' ? 'destination-out' : 'destination-in';
          this.offscreenCtx.drawImage(this.maskCanvas, 0, 0);
          this.offscreenCtx.restore();
          groupCtx.drawImage(this.offscreenCanvas, 0, 0);
          continue;
        }
      }

      this.renderSingleLayer(groupCtx, child, allLayers, settings, currentFrame, isPlaying, cameraTransform, groupScene);
    }

    // Optional group clipping to group bounds
    const groupEval = groupScene.layers.get(groupLayer.id);
    if (groupLayer.groupConfig?.clipToBounds && groupEval) {
      const bw = groupLayer.groupConfig.boundsWidth || 360;
      const bh = groupLayer.groupConfig.boundsHeight || 360;
      const maskBuf = this.acquireGroupCanvas(depth * 2 + 1, settings.width, settings.height);
      const maskCtx = maskBuf.getContext('2d');
      if (maskCtx) {
        maskCtx.clearRect(0, 0, settings.width, settings.height);
        maskCtx.save();
        maskCtx.translate(groupEval.screenX, groupEval.screenY);
        maskCtx.rotate((groupEval.screenRotationZ * Math.PI) / 180);
        maskCtx.scale(groupEval.screenScaleX, groupEval.screenScaleY);
        maskCtx.fillStyle = '#ffffff';
        maskCtx.fillRect(-bw / 2, -bh / 2, bw, bh);
        maskCtx.restore();

        groupCtx.save();
        groupCtx.globalCompositeOperation = 'destination-in';
        groupCtx.drawImage(maskBuf, 0, 0);
        groupCtx.restore();
      }
    }

    // Apply Group-level visual effects
    if (groupLayer.effects?.some((e) => e.enabled)) {
      applyCanvasEffects(
        groupCtx,
        groupLayer.effects,
        settings.width,
        settings.height,
        currentFrame,
        settings.fps,
        { scratchCanvas: this.effectScratchCanvas, layerZ: groupEval?.worldPosition.z ?? 0 }
      );
    }

    // Apply Group-level Mask
    if (groupLayer.mask?.maskLayerId) {
      const gMaskLayer = sortedVisibleLayers.find((m) => m.id === groupLayer.mask!.maskLayerId);
      if (gMaskLayer) {
        const maskBuf = this.acquireGroupCanvas(depth * 2 + 1, settings.width, settings.height);
        const maskCtx = maskBuf.getContext('2d');
        if (maskCtx) {
          maskCtx.clearRect(0, 0, settings.width, settings.height);
          this.renderSingleLayer(maskCtx, gMaskLayer, allLayers, settings, currentFrame, isPlaying, cameraTransform, groupScene);
          groupCtx.save();
          groupCtx.globalCompositeOperation =
            groupLayer.mask.mode === 'alpha-invert' ? 'destination-out' : 'destination-in';
          groupCtx.drawImage(maskBuf, 0, 0);
          groupCtx.restore();
        }
      }
    }

    // Blit composited group onto targetCtx with group's blendMode and opacity
    const fx = computeEffectTransforms(groupLayer, currentFrame, settings);
    const localOpacity = (groupEval?.localTransform.opacity ?? 100) / 100;
    targetCtx.save();
    targetCtx.globalCompositeOperation = (groupLayer.blendMode as GlobalCompositeOperation) || 'source-over';
    targetCtx.globalAlpha = Math.max(0, Math.min(1, localOpacity * fx.effectOpacity));
    targetCtx.drawImage(groupBuf, 0, 0);
    targetCtx.restore();
  }

  private renderLayerContent(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    currentFrame: number,
    settings: ProjectSettings,
    isPlaying: boolean = false
  ) {
    this.renderLayerRawContent(ctx, layer, currentFrame, settings, isPlaying);
  }

  private renderLayerRawContent(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    currentFrame: number,
    settings: ProjectSettings,
    isPlaying: boolean = false
  ) {
    switch (layer.type) {
      case 'solid':
        ctx.fillStyle = layer.solidColor || '#ffffff';
        ctx.fillRect(-settings.width / 2, -settings.height / 2, settings.width, settings.height);
        break;

      case 'vector':
        if (layer.vectorConfig) {
          this.renderVectorShape(ctx, layer.vectorConfig);
        }
        break;

      case 'text':
        if (layer.textConfig) {
          this.renderText(ctx, layer.textConfig, layer.startFrame, currentFrame, settings.fps, layer.effects);
        }
        break;

      case 'particle':
        if (layer.particleConfig) {
          this.renderParticles(ctx, layer.particleConfig, layer.startFrame, currentFrame, settings.fps);
        }
        break;

      case 'image':
        if (layer.mediaUrl) {
          this.renderImage(ctx, layer.mediaUrl, settings);
        }
        break;

      case 'video':
        if (layer.mediaUrl) {
          this.renderVideo(ctx, layer, currentFrame, settings, isPlaying);
        }
        break;

      case 'null':
        // Null layers are pure transform hierarchy nodes and do not render pixel data
        break;

      case 'camera':
        // Camera layers project the scene and do not render pixel geometry in 1st person
        break;

      case 'adjustment':
        break;

      case 'model3d':
        // Model 3D is rendered via 3D pass directly
        break;
    }
  }

  private renderNullObjectWireframe(ctx: CanvasRenderingContext2D, layer: Layer) {
    const size = 120;
    const half = size / 2;

    ctx.save();
    // Null wireframe box
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(-half, -half, size, size);
    ctx.setLineDash([]);

    // Center crosshair target
    ctx.strokeStyle = '#C084FC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.moveTo(0, -16);
    ctx.lineTo(0, 16);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Corner brackets
    const bLen = 12;
    ctx.strokeStyle = '#E9D5FF';
    ctx.lineWidth = 2;
    // Top Left
    ctx.beginPath();
    ctx.moveTo(-half + bLen, -half);
    ctx.lineTo(-half, -half);
    ctx.lineTo(-half, -half + bLen);
    // Top Right
    ctx.moveTo(half - bLen, -half);
    ctx.lineTo(half, -half);
    ctx.lineTo(half, -half + bLen);
    // Bottom Left
    ctx.moveTo(-half + bLen, half);
    ctx.lineTo(-half, half);
    ctx.lineTo(-half, half - bLen);
    // Bottom Right
    ctx.moveTo(half - bLen, half);
    ctx.lineTo(half, half);
    ctx.lineTo(half, half - bLen);
    ctx.stroke();

    // Label badge
    ctx.fillStyle = '#7E22CE';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🎯 ${layer.name}`, 0, -half - 12);
    ctx.restore();
  }

  private renderCameraHelper(ctx: CanvasRenderingContext2D, layer: Layer) {
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);

    // Viewfinder frame
    ctx.strokeRect(-160, -90, 320, 180);
    ctx.setLineDash([]);

    // Center cross
    ctx.strokeStyle = '#0284C7';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.stroke();

    // 3D Camera badge
    ctx.fillStyle = '#0284C7';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📹 3D CAMERA`, 0, -100);
    ctx.restore();
  }

  private renderVectorShape(ctx: CanvasRenderingContext2D, shape: VectorShapeConfig) {
    ctx.beginPath();
    ctx.fillStyle = shape.fill || 'transparent';
    ctx.strokeStyle = shape.stroke || 'transparent';
    ctx.lineWidth = typeof shape.strokeWidth === 'number' && Number.isFinite(shape.strokeWidth) ? shape.strokeWidth : 0;

    const shapeW = typeof shape.width === 'number' && Number.isFinite(shape.width) && shape.width > 0 ? shape.width : 340;
    const shapeH = typeof shape.height === 'number' && Number.isFinite(shape.height) && shape.height > 0 ? shape.height : 340;

    const halfW = shapeW / 2;
    const halfH = shapeH / 2;

    switch (shape.type) {
      case 'rect': {
        const r = shape.cornerRadius || 0;
        if (r > 0) {
          ctx.roundRect(-halfW, -halfH, shapeW, shapeH, r);
        } else {
          ctx.rect(-halfW, -halfH, shapeW, shapeH);
        }
        break;
      }

      case 'circle': {
        const radius = Math.min(shapeW, shapeH) / 2;
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        break;
      }

      case 'polygon': {
        const sides = shape.sides || 5;
        const radius = Math.min(shapeW, shapeH) / 2;
        for (let i = 0; i < sides; i++) {
          const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }

      case 'star': {
        const points = (shape.sides || 5) * 2;
        const outerR = Math.min(shapeW, shapeH) / 2;
        const innerR = outerR * (shape.innerRadiusRatio || 0.4);
        for (let i = 0; i < points; i++) {
          const angle = (i * Math.PI) / (shape.sides || 5) - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          const x = r * Math.cos(angle);
          const y = r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }

      case 'heart': {
        const topCurveHeight = halfH * 0.7;
        ctx.moveTo(0, halfH);
        ctx.bezierCurveTo(-halfW, 0, -halfW, -topCurveHeight, 0, -halfH * 0.4);
        ctx.bezierCurveTo(halfW, -topCurveHeight, halfW, 0, 0, halfH);
        break;
      }

      case 'triangle': {
        ctx.moveTo(0, -halfH);
        ctx.lineTo(halfW, halfH);
        ctx.lineTo(-halfW, halfH);
        ctx.closePath();
        break;
      }

      case 'plus': {
        const t = shapeW * 0.3;
        ctx.rect(-t / 2, -halfH, t, shapeH);
        ctx.rect(-halfW, -t / 2, shapeW, t);
        break;
      }

      case 'cloud': {
        ctx.arc(-halfW * 0.3, 0, halfW * 0.4, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(0, -halfH * 0.3, halfW * 0.45, Math.PI, Math.PI * 2);
        ctx.arc(halfW * 0.3, 0, halfW * 0.4, Math.PI * 1.5, Math.PI * 0.5);
        ctx.closePath();
        break;
      }

      case 'shield': {
        ctx.moveTo(0, -halfH);
        ctx.lineTo(halfW, -halfH * 0.6);
        ctx.quadraticCurveTo(halfW, halfH * 0.4, 0, halfH);
        ctx.quadraticCurveTo(-halfW, halfH * 0.4, -halfW, -halfH * 0.6);
        ctx.closePath();
        break;
      }

      case 'crescent': {
        ctx.arc(0, 0, halfW, Math.PI * 0.25, Math.PI * 1.75);
        ctx.quadraticCurveTo(halfW * 0.3, 0, halfW * 0.7, -halfH * 0.7);
        break;
      }

      case 'lightning': {
        ctx.moveTo(halfW * 0.1, -halfH);
        ctx.lineTo(-halfW, 0);
        ctx.lineTo(-halfW * 0.1, 0);
        ctx.lineTo(-halfW * 0.3, halfH);
        ctx.lineTo(halfW, -halfH * 0.2);
        ctx.lineTo(halfW * 0.1, -halfH * 0.2);
        ctx.closePath();
        break;
      }

      case 'arrow': {
        const headW = halfW * 0.6;
        ctx.moveTo(-halfW, -halfH * 0.3);
        ctx.lineTo(0, -halfH * 0.3);
        ctx.lineTo(0, -halfH);
        ctx.lineTo(halfW, 0);
        ctx.lineTo(0, halfH);
        ctx.lineTo(0, halfH * 0.3);
        ctx.lineTo(-halfW, halfH * 0.3);
        ctx.closePath();
        break;
      }

      case 'drop': {
        ctx.moveTo(0, -halfH);
        ctx.quadraticCurveTo(halfW, 0, halfW * 0.7, halfH * 0.5);
        ctx.arc(0, halfH * 0.3, halfW * 0.7, 0, Math.PI);
        ctx.quadraticCurveTo(-halfW, 0, 0, -halfH);
        break;
      }

      case 'speech': {
        ctx.roundRect(-halfW, -halfH, shapeW, shapeH * 0.75, 10);
        ctx.moveTo(-halfW * 0.3, halfH * 0.25);
        ctx.lineTo(-halfW * 0.5, halfH);
        ctx.lineTo(-halfW * 0.1, halfH * 0.25);
        break;
      }

      case 'ring': {
        const outerR = Math.min(shapeW, shapeH) / 2;
        const innerR = outerR * 0.6;
        ctx.arc(0, 0, outerR, 0, Math.PI * 2, false);
        ctx.arc(0, 0, innerR, 0, Math.PI * 2, true);
        break;
      }
    }

    if (shape.fill && shape.fill !== 'transparent') ctx.fill();
    if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) ctx.stroke();
  }

  private renderText(
    ctx: CanvasRenderingContext2D,
    textConfig: TextConfig,
    layerStartFrame: number,
    currentFrame: number,
    fps: number,
    effects?: ShaderEffect[]
  ) {
    if (!textConfig || !textConfig.text) return;

    ctx.save();

    const enabledEffects = (effects || []).filter((e) => e.enabled);
    const getEff = (id: string) =>
      enabledEffects.find((e) => e.type === id && Number(e.params?.mix ?? 100) > 0.05);
    const getMix = (eff: ShaderEffect | undefined) =>
      eff ? Math.max(0, Math.min(1, Number(eff.params?.mix ?? 100) / 100)) : 1;

    const fontName = textConfig.fontFamily || 'Cairo';
    const fontSize = textConfig.fontSize || 48;
    ctx.font = `${fontSize}px "${fontName}", "Cairo", "Tajawal", "Amiri", "Alexandria", "Almarai", "Readex Pro", "Changa", "Vazirmatn", sans-serif`;

    // Handle Text Counter effect
    let displayStr = textConfig.text;
    const counterEff = getEff('textCounter');
    if (counterEff) {
      const startVal = Number(counterEff.params.startVal ?? 0);
      const endVal = Number(counterEff.params.endVal ?? 10000);
      const durSec = Math.max(0.1, Number(counterEff.params.duration ?? 2.0));
      const decimals = Math.max(0, Math.min(4, Math.round(Number(counterEff.params.decimals ?? 0))));
      const prefix = String(counterEff.params.prefix ?? '');
      const prog = Math.max(0, Math.min(1, (currentFrame - layerStartFrame) / Math.max(1, fps * durSec)));
      const val = startVal + (endVal - startVal) * prog;
      displayStr = `${prefix}${val.toFixed(decimals)}`;
    }

    // Handle Typewriter effect
    const relFrame = Math.max(0, currentFrame - layerStartFrame);
    const typewriterEff = getEff('typewriter');
    if (typewriterEff) {
      const speed = Math.max(1, Number(typewriterEff.params.speed ?? 12));
      const charsVisible = Math.max(1, Math.floor((relFrame / Math.max(1, fps)) * speed));
      const blink = typewriterEff.params.cursorBlink !== 0 && Math.floor((relFrame / Math.max(1, fps)) * 3) % 2 === 0;
      const cursorChar = charsVisible < displayStr.length && blink ? String(typewriterEff.params.cursorChar ?? '|') : '';
      displayStr = displayStr.slice(0, charsVisible) + cursorChar;
    }

    // Handle Hacker Decrypt effect
    const hackerEff = getEff('textHacker');
    if (hackerEff) {
      const durFrames = Math.max(1, Number(hackerEff.params.duration ?? 1.5) * fps);
      const charset = String(hackerEff.params.characters || '!@#$%^&*01');
      const revealCount = Math.floor(Math.min(1, relFrame / durFrames) * displayStr.length);
      displayStr = displayStr
        .split('')
        .map((ch, idx) => {
          if (idx < revealCount || ch === ' ' || ch === '\n') return ch;
          return charset[(idx * 7 + currentFrame) % charset.length] || '#';
        })
        .join('');
    }

    // Handle Text Glitch glyph corruption
    const glitchTextEff = getEff('textGlitch');
    if (glitchTextEff) {
      const chance = Math.max(0, Math.min(1, Number(glitchTextEff.params.glitchChance ?? 0.15)));
      const sSpeed = Math.max(0.5, Number(glitchTextEff.params.scrambleSpeed ?? 8));
      const tick = Math.floor((currentFrame / Math.max(1, fps)) * sSpeed * 2);
      const glyphs = '#@$%&*!?01/\\<>';
      if (chance > 0.01) {
        displayStr = displayStr
          .split('')
          .map((ch, idx) => {
            if (ch === ' ' || ch === '\n') return ch;
            const hVal = Math.abs(Math.sin((idx + 1) * 19.3 + tick * 7.7));
            if (hVal < chance) {
              return glyphs[Math.floor(hVal * 997) % glyphs.length];
            }
            return ch;
          })
          .join('');
      }
    }

    // Handle Text Gradient fill
    const gradEff = getEff('textGradient');
    if (gradEff) {
      const cA = String(gradEff.params.colorA || '#FFD700');
      const cB = String(gradEff.params.colorB || '#FF8C00');
      const gradAngRad = (Number(gradEff.params.angle ?? 45) * Math.PI) / 180;
      const halfSpan = Math.max(80, displayStr.length * fontSize * 0.3);
      const gx = Math.cos(gradAngRad) * halfSpan;
      const gy = Math.sin(gradAngRad) * halfSpan;
      const grad = ctx.createLinearGradient(-gx, -gy, gx, gy);
      grad.addColorStop(0, cA);
      grad.addColorStop(1, cB);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = textConfig.fill || '#ffffff';
    }

    // Handle Text Glow
    const glowEff = getEff('textGlow');
    if (glowEff) {
      const m = getMix(glowEff);
      const glowInt = Math.max(0.05, Number(glowEff.params.intensity ?? 2.0)) * m;
      ctx.shadowColor = String(glowEff.params.color || '#00E5FF');
      ctx.shadowBlur = Number(glowEff.params.glowRadius ?? 18) * glowInt;
    }

    // Handle Text Tracking
    const trackingEff = getEff('textTracking');
    const trackingExtra = trackingEff ? Number(trackingEff.params.spacing ?? 8) * getMix(trackingEff) : 0;

    ctx.strokeStyle = textConfig.stroke || 'transparent';
    ctx.lineWidth = textConfig.strokeWidth || 0;
    ctx.textBaseline = 'middle';

    const isArabic = /[\u0600-\u06FF]/.test(displayStr);
    ctx.direction = isArabic ? 'rtl' : 'ltr';

    const waveEff = getEff('textWave');
    const cascadeEff = getEff('charTransform');
    const flipWordEff = getEff('textFlipWord');
    const timeSec = currentFrame / Math.max(1, fps);

    const drawStyledText = (txt: string, dx: number, dy: number) => {
      if (glitchTextEff) {
        const gm = getMix(glitchTextEff);
        const glitchAmt = Math.max(0.1, Number(glitchTextEff.params.glitchChance ?? 0.15)) * 18 * gm;
        ctx.save();
        ctx.fillStyle = `rgba(0, 229, 255, ${(0.72 * gm).toFixed(2)})`;
        ctx.fillText(txt, dx - glitchAmt, dy - 1 * gm);
        ctx.fillStyle = `rgba(244, 63, 94, ${(0.72 * gm).toFixed(2)})`;
        ctx.fillText(txt, dx + glitchAmt, dy + 1 * gm);
        ctx.restore();
      }
      if (textConfig.fill && textConfig.fill !== 'transparent') {
        ctx.fillText(txt, dx, dy);
        if (glowEff && Number(glowEff.params.intensity ?? 2) > 1.3) {
          ctx.fillText(txt, dx, dy);
        }
      }
      if (textConfig.strokeWidth > 0 && textConfig.stroke && textConfig.stroke !== 'transparent') {
        ctx.strokeText(txt, dx, dy);
      }
    };

    if (textConfig.animator && textConfig.animator.enabled) {
      const { unit, effect, staggerFrames } = textConfig.animator;
      let parts: string[] = [];
      if (unit === 'character') parts = displayStr.split('');
      else if (unit === 'word') parts = displayStr.split(' ');
      else parts = displayStr.split('\n');

      let totalWidth = 0;
      const partWidths: number[] = [];
      parts.forEach((part) => {
        const separator = unit === 'word' ? ' ' : '';
        const metrics = ctx.measureText(part + separator);
        const w = metrics.width + (textConfig.letterSpacing || 0) + trackingExtra;
        partWidths.push(w);
        totalWidth += w;
      });

      const align = textConfig.align || 'center';
      let startX = -totalWidth / 2;
      if (align === 'right') startX = totalWidth / 2;

      let currentX = startX;
      const delayFramesEff = cascadeEff
        ? Math.max(0.1, Number(cascadeEff.params.delayPerChar ?? 0.05) * fps)
        : (staggerFrames || 2);

      parts.forEach((part, idx) => {
        const partStartFrame = idx * delayFramesEff;
        const progress = Math.max(0, Math.min(1, (relFrame - partStartFrame) / 10));

        ctx.save();
        let alpha = 1;
        let offsetY = 0;
        let scale = 1;
        let rotation = 0;

        if (effect === 'fade-slide') {
          alpha = progress;
          offsetY = (1 - progress) * 20;
        } else if (effect === 'scale-pop') {
          scale = progress < 0.8 ? progress * 1.2 : 1 + (1 - progress) * 0.2;
          alpha = Math.min(1, progress * 2);
        } else if (effect === 'typewriter') {
          alpha = relFrame >= partStartFrame ? 1 : 0;
        } else if (effect === 'rotate-in') {
          rotation = (1 - progress) * 90;
          alpha = progress;
        }

        if (waveEff) {
          const wh = Number(waveEff.params.waveHeight ?? 15);
          const ws = Number(waveEff.params.waveSpeed ?? 3);
          const wl = Math.max(1, Number(waveEff.params.wavelength ?? 4));
          offsetY += Math.sin(timeSec * ws * Math.PI + idx / wl) * wh;
        }
        if (cascadeEff) {
          const jh = Number(cascadeEff.params.jumpHeight ?? 25);
          const delaySec = Math.max(0.01, Number(cascadeEff.params.delayPerChar ?? 0.05));
          const phaseT = Math.max(0, timeSec - idx * delaySec);
          offsetY -= Math.abs(Math.sin(phaseT * 4.5)) * jh;
        }

        ctx.globalAlpha = ctx.globalAlpha * alpha;
        ctx.translate(currentX, offsetY);
        if (scale !== 1) ctx.scale(scale, scale);
        if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        drawStyledText(part, 0, 0);

        currentX += partWidths[idx] || 0;
        ctx.restore();
      });
    } else if (!isArabic && (trackingEff || waveEff || cascadeEff || flipWordEff)) {
      const chars = flipWordEff ? displayStr.split(' ') : displayStr.split('');
      const widths = chars.map((ch) => ctx.measureText(ch + (flipWordEff ? ' ' : '')).width + trackingExtra);
      const totalW = widths.reduce((a, b) => a + b, 0);
      let cursorX = -totalW / 2;
      chars.forEach((ch, idx) => {
        const w = widths[idx];
        let dy = 0;
        let sy = 1;
        if (waveEff) {
          const wh = Number(waveEff.params.waveHeight ?? 15) * getMix(waveEff);
          const ws = Number(waveEff.params.waveSpeed ?? 3);
          const wl = Math.max(1, Number(waveEff.params.wavelength ?? 4));
          dy += Math.sin(timeSec * ws * Math.PI + idx / wl) * wh;
        }
        if (cascadeEff) {
          const jh = Number(cascadeEff.params.jumpHeight ?? 25) * getMix(cascadeEff);
          const delaySec = Math.max(0.01, Number(cascadeEff.params.delayPerChar ?? 0.05));
          const phaseT = Math.max(0, timeSec - idx * delaySec);
          dy -= Math.abs(Math.sin(phaseT * 4.5)) * jh;
        }
        if (flipWordEff) {
          const flipDur = Math.max(0.1, Number(flipWordEff.params.flipDuration ?? 1.2));
          const flipAng = ((Number(flipWordEff.params.flipAngle ?? 90) * getMix(flipWordEff)) * Math.PI) / 180;
          const phase = (timeSec / flipDur) * Math.PI + idx * 0.45;
          sy = Math.cos(Math.sin(phase) * flipAng);
        }
        ctx.save();
        ctx.translate(cursorX + w / 2, dy);
        ctx.scale(1, Math.abs(sy) < 0.08 ? 0.08 : sy);
        ctx.textAlign = 'center';
        drawStyledText(ch, 0, 0);
        ctx.restore();
        cursorX += w;
      });
    } else {
      ctx.textAlign = textConfig.align || 'center';
      ctx.textBaseline = 'middle';

      const lines = displayStr.split('\n');
      const lineGap = trackingEff
        ? (textConfig.lineHeight || 1.2) + (Number(trackingEff.params.lineGap ?? 1.2) - (textConfig.lineHeight || 1.2)) * getMix(trackingEff)
        : (textConfig.lineHeight || 1.2);
      const lineHeight = fontSize * lineGap;
      const startY = -((lines.length - 1) * lineHeight) / 2;

      lines.forEach((line, i) => {
        const dyWave = waveEff
          ? Math.sin(timeSec * Number(waveEff.params.waveSpeed ?? 3) * Math.PI + i) *
            Number(waveEff.params.waveHeight ?? 15) *
            0.4 *
            getMix(waveEff)
          : 0;
        const dyCascade = cascadeEff
          ? -Math.abs(Math.sin(Math.max(0, timeSec - i * Number(cascadeEff.params.delayPerChar ?? 0.05)) * 4.5)) *
            Number(cascadeEff.params.jumpHeight ?? 25) *
            getMix(cascadeEff)
          : 0;
        const y = startY + i * lineHeight + dyWave + dyCascade;
        ctx.save();
        if (flipWordEff) {
          const flipDur = Math.max(0.1, Number(flipWordEff.params.flipDuration ?? 1.2));
          const flipAng = ((Number(flipWordEff.params.flipAngle ?? 90) * getMix(flipWordEff)) * Math.PI) / 180;
          const phase = (timeSec / flipDur) * Math.PI + i * 0.45;
          const sy = Math.cos(Math.sin(phase) * flipAng);
          ctx.translate(0, y);
          ctx.scale(1, Math.abs(sy) < 0.08 ? 0.08 : sy);
          drawStyledText(line, 0, 0);
        } else {
          drawStyledText(line, 0, y);
        }
        ctx.restore();
      });
    }

    ctx.restore();
  }

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    particleConfig: ParticleConfig,
    layerStartFrame: number,
    currentFrame: number,
    fps: number
  ) {
    const elapsed = Math.max(0, currentFrame - layerStartFrame);
    const count = particleConfig.count ?? 40;
    if (count <= 0) return;

    for (let i = 0; i < count; i++) {
      const seed = i * 1337;
      const spawnOffset = (seed % 30);
      const age = (elapsed + spawnOffset) % particleConfig.lifetime;
      const progress = age / particleConfig.lifetime;

      const angle = ((seed % 360) * Math.PI) / 180;
      const speed = particleConfig.speed * (1 + ((seed % 10) / 10));
      
      const px = Math.cos(angle) * speed * age + particleConfig.wind * age;
      const py = Math.sin(angle) * speed * age + particleConfig.gravity * age * 0.5;

      const alpha = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) / 0.8;
      const size = Math.max(1, particleConfig.size * (1 - progress * 0.5));

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = i % 2 === 0 ? particleConfig.color : particleConfig.secondaryColor;
      ctx.translate(px, py);

      if (particleConfig.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      } else if (particleConfig.shape === 'square') {
        ctx.fillRect(-size, -size, size * 2, size * 2);
      } else if (particleConfig.shape === 'spark') {
        ctx.beginPath();
        ctx.moveTo(0, -size * 2);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size * 2);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
      } else if (particleConfig.shape === 'star') {
        // Draw radiant 5-point glowing star
        const spikes = 5;
        const outerRadius = size * 1.6;
        const innerRadius = size * 0.7;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(0, -outerRadius);
        for (let s = 0; s < spikes; s++) {
          const ox = Math.cos(rot) * outerRadius;
          const oy = Math.sin(rot) * outerRadius;
          ctx.lineTo(ox, oy);
          rot += step;

          const ix = Math.cos(rot) * innerRadius;
          const iy = Math.sin(rot) * innerRadius;
          ctx.lineTo(ix, iy);
          rot += step;
        }
        ctx.lineTo(0, -outerRadius);
        ctx.closePath();
        ctx.fill();

        // Center bright core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Render Authentic 360° Volumetric 3D Space Starfield
   * - Anchored/Fixed in 3D world space by default (speed = 0, floatAmount = 0)
   * - True 3D spherical wrap-around lattice around camera eye so panning, zooming,
   *   and 360° Pitch/Yaw/Roll rotation stay locked 1:1 with the scene camera and 3D orbit
   */
  private renderMotionStars3DEffect(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    effect: ShaderEffect,
    currentFrame: number,
    settings: ProjectSettings,
    depthPass: 'behind' | 'front' | 'all',
    worldPosX: number,
    worldPosY: number,
    worldPosZ: number,
    worldRotX: number,
    worldRotY: number,
    worldRotZ: number,
    worldScaleX: number,
    worldScaleY: number,
    worldScaleZ: number,
    cameraState?: EvaluatedCameraState,
    allLayers?: Layer[],
    layerViewDist?: number,
    orbit?: OrbitSettings
  ) {
    if (!effect.enabled) return;
    const incomingLayerAlpha = Math.max(0, Math.min(1, ctx.globalAlpha));
    if (incomingLayerAlpha <= 0.001) return;
    const starMix = effect.params.mix === undefined ? 1 : Math.max(0, Math.min(1, Number(effect.params.mix) / 100));
    if (starMix <= 0.001) return;

    const W = settings.width || 720;
    const H = settings.height || 1280;
    const cx = W / 2;
    const cy = H / 2;
    const fps = Math.max(1, settings.fps || 30);
    const timeSec = currentFrame / fps;

    // Configuration parameters (realistic, anchored space stars by default)
    const count = Math.min(2000, Math.max(5, Math.round(Number(effect.params.count ?? 280))));
    const speed = Number(effect.params.speed ?? 0);
    const floatSpeed = Math.max(0, Number(effect.params.floatSpeed ?? 0));
    const floatAmount = Math.max(0, Number(effect.params.floatAmount ?? 0));
    const reactivity = Math.max(0, Number(effect.params.reactivity ?? 1.0));
    const trailFactor = Math.max(0, Number(effect.params.trailLength ?? 0));
    const baseStarSize = Math.max(0.5, Number(effect.params.starSize ?? 4.0));
    const sizeVariationFactor = Math.max(0, Number(effect.params.sizeVariation ?? 100) / 100);
    const starBrightness = Math.max(0.05, Number(effect.params.brightness ?? 1.0));
    const glowLevel = Math.max(0, Number(effect.params.glow ?? 0));
    const twinkleSpeed = Math.max(0, Number(effect.params.twinkle ?? 0));
    const starRotationRad = (Number(effect.params.starRotation ?? 0) * Math.PI) / 180;
    const spinSpeedRad = (Number(effect.params.spinSpeed ?? 0) * Math.PI) / 180;
    const spreadMult = Math.max(0.2, Number(effect.params.spread ?? 100) / 100);
    const starShape = String(effect.params.starShape || effect.params.shape || 'mixed');
    const starColor = String(effect.params.color || '#FFFFFF');
    const secondaryColor = String(effect.params.secondaryColor || '#F1F5F9');

    // If starfield is attached directly to the Camera layer itself, keep stars anchored to world origin
    // so moving/rotating the camera moves through fixed space instead of sticking to the lens
    const isAttachedToCamera = layer.type === 'camera';
    const effLayerX = isAttachedToCamera ? cx : worldPosX;
    const effLayerY = isAttachedToCamera ? cy : worldPosY;
    const effLayerZ = isAttachedToCamera ? 0 : worldPosZ;
    const effLayerRotX = isAttachedToCamera ? 0 : worldRotX;
    const effLayerRotY = isAttachedToCamera ? 0 : worldRotY;
    const effLayerRotZ = isAttachedToCamera ? 0 : worldRotZ;
    const effLayerScaleX = isAttachedToCamera ? 1 : (Math.abs(worldScaleX) < 0.01 ? 1 : worldScaleX);
    const effLayerScaleY = isAttachedToCamera ? 1 : (Math.abs(worldScaleY) < 0.01 ? 1 : worldScaleY);
    const effLayerScaleZ = isAttachedToCamera ? 1 : (Math.abs(worldScaleZ) < 0.01 ? 1 : worldScaleZ);

    const cam: EvaluatedCameraState = cameraState || {
      active: false,
      type: '3d',
      position: { x: cx, y: cy, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      zoom: 1,
      fov: 1000,
      focalLength: 50,
      focusDistance: 1000,
      parentChain: [],
    };

    const is3DCam = cam.active && cam.type === '3d';
    const fov = is3DCam ? (cam.fov || 1000) : 1000;
    const camZoom = cam.active ? Math.max(0.01, cam.zoom || 1) : 1;

    // Camera eye position in Canvas World Space (+X right, +Y down, +Z toward viewer)
    const camX = cx + ((cam.active ? cam.position.x : cx) - cx) * reactivity;
    const camY = cy + ((cam.active ? cam.position.y : cy) - cy) * reactivity;
    const camZ = (is3DCam ? cam.position.z : 0) * reactivity;
    const camRotX = is3DCam ? cam.rotation.x : 0;
    const camRotY = is3DCam ? cam.rotation.y : 0;
    const camRotZ = cam.active ? cam.rotation.z : 0;

    // Precompute camera rotation trig (matching interpolator.ts & WebGL3DCompositor 1:1)
    const camRadY = (-camRotY * Math.PI) / 180;
    const camCosY = Math.cos(camRadY);
    const camSinY = Math.sin(camRadY);
    const camRadX = (-camRotX * Math.PI) / 180;
    const camCosX = Math.cos(camRadX);
    const camSinX = Math.sin(camRadX);
    const camRadZ = (-camRotZ * Math.PI) / 180;
    const camCosZ = Math.cos(camRadZ);
    const camSinZ = Math.sin(camRadZ);

    // Precompute layer forward & inverse rotation trig (Roll Z -> Pitch X -> Yaw Y)
    const lRadZ = (effLayerRotZ * Math.PI) / 180;
    const lCosZ = Math.cos(lRadZ);
    const lSinZ = Math.sin(lRadZ);
    const lRadX = (effLayerRotX * Math.PI) / 180;
    const lCosX = Math.cos(lRadX);
    const lSinX = Math.sin(lRadX);
    const lRadY = (effLayerRotY * Math.PI) / 180;
    const lCosY = Math.cos(lRadY);
    const lSinY = Math.sin(lRadY);

    const rotateLayerForward = (lx: number, ly: number, lz: number) => {
      let x = lx;
      let y = ly;
      let z = lz;
      if (effLayerRotZ !== 0) {
        const nx = x * lCosZ - y * lSinZ;
        const ny = x * lSinZ + y * lCosZ;
        x = nx;
        y = ny;
      }
      if (effLayerRotX !== 0) {
        const ny = y * lCosX - z * lSinX;
        const nz = y * lSinX + z * lCosX;
        y = ny;
        z = nz;
      }
      if (effLayerRotY !== 0) {
        const nx = x * lCosY + z * lSinY;
        const nz = -x * lSinY + z * lCosY;
        x = nx;
        z = nz;
      }
      return { x, y, z };
    };

    const invTransformLayerPoint = (wx: number, wy: number, wz: number) => {
      let x = wx - effLayerX;
      let y = wy - effLayerY;
      let z = wz - effLayerZ;
      if (effLayerRotY !== 0) {
        const nx = x * lCosY - z * lSinY;
        const nz = x * lSinY + z * lCosY;
        x = nx;
        z = nz;
      }
      if (effLayerRotX !== 0) {
        const ny = y * lCosX + z * lSinX;
        const nz = -y * lSinX + z * lCosX;
        y = ny;
        z = nz;
      }
      if (effLayerRotZ !== 0) {
        const nx = x * lCosZ + y * lSinZ;
        const ny = -x * lSinZ + y * lCosZ;
        x = nx;
        y = ny;
      }
      return {
        x: x / effLayerScaleX,
        y: y / effLayerScaleY,
        z: z / effLayerScaleZ,
      };
    };

    // Eye anchor in world space: camera eye in first-person, stage center in third-person orbit
    const eyeWorldX = orbit ? cx : camX;
    const eyeWorldY = orbit ? cy : camY;
    const eyeWorldZ = orbit ? 0 : camZ + fov;
    const camInLayer = invTransformLayerPoint(eyeWorldX, eyeWorldY, eyeWorldZ);

    // Optional previous-frame state ONLY when user enables warp trails (trailLength > 0)
    let prevCam: EvaluatedCameraState | null = null;
    let prevLayerPos = { x: effLayerX, y: effLayerY, z: effLayerZ };
    let prevLayerRot = { x: effLayerRotX, y: effLayerRotY, z: effLayerRotZ };
    let prevLayerScale = { x: effLayerScaleX, y: effLayerScaleY, z: effLayerScaleZ };
    let prevCamInLayer = camInLayer;
    let pLCosZ = lCosZ;
    let pLSinZ = lSinZ;
    let pLCosX = lCosX;
    let pLSinX = lSinX;
    let pLCosY = lCosY;
    let pLSinY = lSinY;
    if (trailFactor > 0.01 && !orbit) {
      const prevFrame = Math.max(0, currentFrame - 1);
      prevCam = allLayers ? evaluateActiveCamera(allLayers, prevFrame, fps, settings) : cam;
      if (!isAttachedToCamera) {
        const pPrev = evaluateLayerTransform(layer, prevFrame, fps);
        prevLayerPos = {
          x: Number.isFinite(pPrev.position.x) ? pPrev.position.x : effLayerX,
          y: Number.isFinite(pPrev.position.y) ? pPrev.position.y : effLayerY,
          z: Number.isFinite(pPrev.position.z) ? pPrev.position.z : effLayerZ,
        };
        prevLayerRot = {
          x: Number.isFinite(pPrev.rotation.x) ? pPrev.rotation.x : effLayerRotX,
          y: Number.isFinite(pPrev.rotation.y) ? pPrev.rotation.y : effLayerRotY,
          z: Number.isFinite(pPrev.rotation.z) ? pPrev.rotation.z : effLayerRotZ,
        };
        prevLayerScale = {
          x: Number.isFinite(pPrev.scale.x) && Math.abs(pPrev.scale.x) >= 1 ? pPrev.scale.x / 100 : effLayerScaleX,
          y: Number.isFinite(pPrev.scale.y) && Math.abs(pPrev.scale.y) >= 1 ? pPrev.scale.y / 100 : effLayerScaleY,
          z: Number.isFinite(pPrev.scale.z) && Math.abs(pPrev.scale.z) >= 1 ? pPrev.scale.z / 100 : effLayerScaleZ,
        };
        pLCosZ = Math.cos((prevLayerRot.z * Math.PI) / 180);
        pLSinZ = Math.sin((prevLayerRot.z * Math.PI) / 180);
        pLCosX = Math.cos((prevLayerRot.x * Math.PI) / 180);
        pLSinX = Math.sin((prevLayerRot.x * Math.PI) / 180);
        pLCosY = Math.cos((prevLayerRot.y * Math.PI) / 180);
        pLSinY = Math.sin((prevLayerRot.y * Math.PI) / 180);
      }
      const pIs3D = prevCam.active && prevCam.type === '3d';
      const pFov = pIs3D ? (prevCam.fov || 1000) : 1000;
      const pEyeX = cx + ((prevCam.active ? prevCam.position.x : cx) - cx) * reactivity;
      const pEyeY = cy + ((prevCam.active ? prevCam.position.y : cy) - cy) * reactivity;
      const pEyeZ = (pIs3D ? prevCam.position.z : 0) * reactivity + pFov;
      let px = pEyeX - prevLayerPos.x;
      let py = pEyeY - prevLayerPos.y;
      let pz = pEyeZ - prevLayerPos.z;
      if (prevLayerRot.y !== 0) {
        const nx = px * pLCosY - pz * pLSinY;
        const nz = px * pLSinY + pz * pLCosY;
        px = nx;
        pz = nz;
      }
      if (prevLayerRot.x !== 0) {
        const ny = py * pLCosX + pz * pLSinX;
        const nz = -py * pLSinX + pz * pLCosX;
        py = ny;
        pz = nz;
      }
      if (prevLayerRot.z !== 0) {
        const nx = px * pLCosZ + py * pLSinZ;
        const ny = -px * pLSinZ + py * pLCosZ;
        px = nx;
        py = ny;
      }
      prevCamInLayer = {
        x: px / prevLayerScale.x,
        y: py / prevLayerScale.y,
        z: pz / prevLayerScale.z,
      };
    }

    // Seed offset unique to this layer id so multiple star layers don't collide
    let layerSeedOffset = 0;
    for (let c = 0; c < layer.id.length; c++) {
      layerSeedOffset = (layerSeedOffset * 31 + layer.id.charCodeAt(c)) % 9973;
    }

    const getRand = (seed: number): number => {
      const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
      return v - Math.floor(v);
    };

    const wrapSigned = (val: number, span: number): number => {
      const m = ((val % span) + span) % span;
      return m >= span * 0.5 ? m - span : m;
    };

    // Volumetric 3D bounds: inner volume approaches camera lens smoothly; outer volume fills cosmic sky in 360°
    const baseSceneDim = Math.max(W, H, 1280);
    const nearSpan = baseSceneDim * 1.85 * spreadMult;
    const farSpan = nearSpan * 2.55;

    // Because stars fill a 4π steradian 360° sphere around the camera, scale pool count proportionally
    // so both low sparse skies (e.g. 20) and ultra-dense starfields (e.g. 2000) respond vividly
    const poolCount = Math.min(5000, Math.round(count * 3.8));
    const nearPoolLimit = Math.floor(poolCount * 0.65);

    const zDrift = speed !== 0 ? timeSec * speed * 45 : 0;
    const prevZDrift = speed !== 0 ? Math.max(0, timeSec - 1 / fps) * speed * 45 : 0;

    // Frustum culling margin in normalized screen space
    const marginPx = Math.max(220, baseStarSize * 28);

    const projectWorldToScreen = (
      wx: number,
      wy: number,
      wz: number,
      cState: EvaluatedCameraState,
      cX: number,
      cY: number,
      cZ: number,
      cFov: number,
      cZoom: number,
      cCosY: number,
      cSinY: number,
      cCosX: number,
      cSinX: number,
      cCosZ: number,
      cSinZ: number
    ) => {
      if (orbit) {
        const p = this.project3D(wx, wy, wz, settings, orbit);
        // Estimate camera distance in orbit mode for sorting & near-culling
        const orbitDist = 1500 + p.depth + 600;
        if (orbitDist <= 12) return null;
        return { x: p.x, y: p.y, k: p.scale, viewDist: orbitDist };
      }

      const cIs3D = cState.active && cState.type === '3d';
      let dx = wx - cX;
      let dy = wy - cY;
      let dz = cFov - (wz - cZ);

      if (cIs3D && cState.rotation.y !== 0) {
        const nx = dx * cCosY + dz * cSinY;
        const nz = -dx * cSinY + dz * cCosY;
        dx = nx;
        dz = nz;
      }
      if (cIs3D && cState.rotation.x !== 0) {
        const ny = dy * cCosX - dz * cSinX;
        const nz = dy * cSinX + dz * cCosX;
        dy = ny;
        dz = nz;
      }
      if (cState.active && cState.rotation.z !== 0) {
        const nx = dx * cCosZ - dy * cSinZ;
        const ny = dx * cSinZ + dy * cCosZ;
        dx = nx;
        dy = ny;
      }

      if (dz <= 10) return null;
      const k = (cFov / dz) * cZoom;
      return {
        x: cx + dx * k,
        y: cy + dy * k,
        k,
        viewDist: dz,
      };
    };

    interface ProjectedStar {
      x: number;
      y: number;
      prevX?: number;
      prevY?: number;
      radius: number;
      alpha: number;
      color: string;
      viewDist: number;
      angle: number;
      shapeKind: string;
    }

    const starsToDraw: ProjectedStar[] = [];
    const splitDepth = layerViewDist ?? fov;

    for (let i = 0; i < poolCount; i++) {
      const seedBase = i + layerSeedOffset * 1.13;
      const rX = getRand(seedBase * 17.3 + 1.7);
      const rY = getRand(seedBase * 31.7 + 4.9);
      const rZ = getRand(seedBase * 53.1 + 9.3);
      const rS = getRand(seedBase * 79.2 + 13.1);
      const rLum = getRand(seedBase * 61.9 + 7.1);
      const rPhase = getRand(seedBase * 97.4 + 19.5);

      const isFar = i >= nearPoolLimit;
      const span = isFar ? farSpan : nearSpan;
      const maxSphereR = span * 0.49;

      const origX = (rX - 0.5) * span;
      const origY = (rY - 0.5) * span;
      const origZ = (rZ - 0.5) * span;

      let flX = 0;
      let flY = 0;
      let flZ = 0;
      if (floatAmount > 0 && floatSpeed > 0) {
        flX =
          (Math.sin(timeSec * floatSpeed * 1.35 + rPhase * 6.283) +
            Math.cos(timeSec * floatSpeed * 0.72 + rX * 3.141)) *
          (floatAmount * 0.65);
        flY =
          (Math.cos(timeSec * floatSpeed * 1.15 + rPhase * 6.283) +
            Math.sin(timeSec * floatSpeed * 0.85 + rY * 3.141)) *
          (floatAmount * 0.65);
        flZ =
          (Math.sin(timeSec * floatSpeed * 1.6 + rZ * 6.283) +
            Math.cos(timeSec * floatSpeed * 0.95 + rPhase * 3.141)) *
          (floatAmount * 1.2);
      }

      const relX = wrapSigned(origX + flX - camInLayer.x, span);
      const relY = wrapSigned(origY + flY - camInLayer.y, span);
      const relZ = wrapSigned(origZ + flZ + zDrift - camInLayer.z, span);

      const sphereDist = Math.hypot(relX, relY, relZ);
      if (sphereDist > maxSphereR) continue;

      // Soft spherical outer fade so stars never pop at wrap boundaries
      const fadeStart = maxSphereR * 0.82;
      const edgeFade =
        sphereDist <= fadeStart
          ? 1
          : Math.max(0, 1 - (sphereDist - fadeStart) / Math.max(1, maxSphereR - fadeStart));
      if (edgeFade <= 0.01) continue;

      const locX = (camInLayer.x + relX) * effLayerScaleX;
      const locY = (camInLayer.y + relY) * effLayerScaleY;
      const locZ = (camInLayer.z + relZ) * effLayerScaleZ;

      const rotPt = rotateLayerForward(locX, locY, locZ);
      const wx = effLayerX + rotPt.x;
      const wy = effLayerY + rotPt.y;
      const wz = effLayerZ + rotPt.z;

      const proj = projectWorldToScreen(
        wx,
        wy,
        wz,
        cam,
        camX,
        camY,
        camZ,
        fov,
        camZoom,
        camCosY,
        camSinY,
        camCosX,
        camSinX,
        camCosZ,
        camSinZ
      );
      if (!proj) continue;

      // Pass depth filtering (relative to camera space)
      if (depthPass === 'behind' && proj.viewDist < splitDepth) continue;
      if (depthPass === 'front' && proj.viewDist >= splitDepth) continue;

      // Viewport frustum check (include generous margin for close large stars)
      if (
        proj.x < -marginPx ||
        proj.x > W + marginPx ||
        proj.y < -marginPx ||
        proj.y > H + marginPx
      ) {
        continue;
      }

      // Near-lens soft fade so stars grazing right past the camera fade smoothly instead of snapping
      const nearLensFade = proj.viewDist < 42 ? Math.max(0, (proj.viewDist - 10) / 32) : 1;
      if (nearLensFade <= 0.01) continue;

      // Size distribution: many crisp fine stars + scattered larger hero stars scaled by sizeVariation
      const rawDist = 0.38 + Math.pow(rS, 2.35) * 2.15;
      const variedScale = Math.max(0.15, 1 + (rawDist - 1) * sizeVariationFactor);
      const intrinsicRadius = baseStarSize * variedScale;
      const rawScreenRadius = intrinsicRadius * proj.k;
      const maxRadius = Math.max(W, H) * 0.42;
      const drawRadius = Math.min(maxRadius, Math.max(0.7, rawScreenRadius));

      // Optical energy conservation for sub-pixel distant stars
      const subPixelAlpha = rawScreenRadius < 0.7 ? Math.max(0.2, Math.pow(rawScreenRadius / 0.7, 1.25)) : 1;

      const baseBrightness = 0.74 + rLum * 0.26;
      const twinkleFactor =
        twinkleSpeed > 0
          ? 0.58 + 0.42 * Math.sin(timeSec * twinkleSpeed * 6.28318 + rPhase * 6.28318)
          : 1;

      const alpha = Math.max(
        0,
        Math.min(
          1,
          edgeFade *
            nearLensFade *
            subPixelAlpha *
            baseBrightness *
            twinkleFactor *
            starBrightness *
            starMix *
            incomingLayerAlpha
        )
      );
      if (alpha <= 0.015) continue;

      let prevX: number | undefined;
      let prevY: number | undefined;
      if (trailFactor > 0.01 && prevCam && !orbit) {
        const pRelX = wrapSigned(origX + flX - prevCamInLayer.x, span);
        const pRelY = wrapSigned(origY + flY - prevCamInLayer.y, span);
        const pRelZ = wrapSigned(origZ + flZ + prevZDrift - prevCamInLayer.z, span);
        let pLocX = (prevCamInLayer.x + pRelX) * prevLayerScale.x;
        let pLocY = (prevCamInLayer.y + pRelY) * prevLayerScale.y;
        let pLocZ = (prevCamInLayer.z + pRelZ) * prevLayerScale.z;
        if (prevLayerRot.z !== 0) {
          const nx = pLocX * pLCosZ - pLocY * pLSinZ;
          const ny = pLocX * pLSinZ + pLocY * pLCosZ;
          pLocX = nx;
          pLocY = ny;
        }
        if (prevLayerRot.x !== 0) {
          const ny = pLocY * pLCosX - pLocZ * pLSinX;
          const nz = pLocY * pLSinX + pLocZ * pLCosX;
          pLocY = ny;
          pLocZ = nz;
        }
        if (prevLayerRot.y !== 0) {
          const nx = pLocX * pLCosY + pLocZ * pLSinY;
          const nz = -pLocX * pLSinY + pLocZ * pLCosY;
          pLocX = nx;
          pLocZ = nz;
        }
        const pWx = prevLayerPos.x + pLocX;
        const pWy = prevLayerPos.y + pLocY;
        const pWz = prevLayerPos.z + pLocZ;
        const pIs3D = prevCam.active && prevCam.type === '3d';
        const pFov = pIs3D ? (prevCam.fov || 1000) : 1000;
        const pZoom = prevCam.active ? Math.max(0.01, prevCam.zoom || 1) : 1;
        const pCamX = cx + ((prevCam.active ? prevCam.position.x : cx) - cx) * reactivity;
        const pCamY = cy + ((prevCam.active ? prevCam.position.y : cy) - cy) * reactivity;
        const pCamZ = (pIs3D ? prevCam.position.z : 0) * reactivity;
        const pRY = (-prevCam.rotation.y * Math.PI) / 180;
        const pRX = (-prevCam.rotation.x * Math.PI) / 180;
        const pRZ = (-prevCam.rotation.z * Math.PI) / 180;
        const pProj = projectWorldToScreen(
          pWx,
          pWy,
          pWz,
          prevCam,
          pCamX,
          pCamY,
          pCamZ,
          pFov,
          pZoom,
          Math.cos(pRY),
          Math.sin(pRY),
          Math.cos(pRX),
          Math.sin(pRX),
          Math.cos(pRZ),
          Math.sin(pRZ)
        );
        if (pProj) {
          const streakScale = 1 + trailFactor / 18;
          prevX = proj.x + (pProj.x - proj.x) * streakScale;
          prevY = proj.y + (pProj.y - proj.y) * streakScale;
        }
      }

      const isSecondary = rPhase > 0.72;
      const mixedPool = ['star4', 'sparkle', 'diamond', 'star5', 'hexagon', 'crescent', 'circle'] as const;
      const resolvedShape =
        starShape === 'mixed'
          ? mixedPool[Math.floor(rLum * 997 + i) % mixedPool.length]
          : starShape;
      const shapeAngle =
        rPhase * Math.PI * 2 +
        starRotationRad +
        timeSec * spinSpeedRad +
        camRadZ +
        (isAttachedToCamera ? 0 : (effLayerRotZ * Math.PI) / 180);

      starsToDraw.push({
        x: proj.x,
        y: proj.y,
        prevX,
        prevY,
        radius: drawRadius,
        alpha,
        color: isSecondary ? secondaryColor : starColor,
        viewDist: proj.viewDist,
        angle: shapeAngle,
        shapeKind: resolvedShape,
      });
    }

    if (starsToDraw.length === 0) return;

    // Sort strictly back-to-front so foreground star spheres overlap distant stars cleanly
    starsToDraw.sort((a, b) => b.viewDist - a.viewDist);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < starsToDraw.length; i++) {
      const s = starsToDraw[i];

      // Optional warp streak when trailLength > 0
      if (s.prevX !== undefined && s.prevY !== undefined) {
        const dx = s.x - s.prevX;
        const dy = s.y - s.prevY;
        if (dx * dx + dy * dy > 1.2) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = Math.max(0.8, s.radius * 1.25);
          ctx.lineCap = 'round';
          ctx.globalAlpha = s.alpha * 0.65;
          ctx.beginPath();
          ctx.moveTo(s.prevX, s.prevY);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
        }
      }

      // Optional soft atmospheric bloom halo when glow > 0
      if (glowLevel > 0) {
        const glowR = s.radius * (1.8 + glowLevel / 30);
        const grad = ctx.createRadialGradient(s.x, s.y, s.radius * 0.3, s.x, s.y, glowR);
        grad.addColorStop(0, s.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = s.alpha * Math.min(0.6, glowLevel / 90);
        ctx.beginPath();
        ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crisp 3D star geometry in requested shape
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha;
      this.drawSpaceStarShape(ctx, s.x, s.y, s.radius, s.shapeKind, s.angle);
    }

    ctx.restore();
  }

  private drawSpaceStarShape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    shape: string,
    angleRad: number
  ) {
    if (shape === 'circle' || r < 0.9) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angleRad);
    ctx.beginPath();

    if (shape === 'star4') {
      const outer = r * 1.55;
      const inner = r * 0.36;
      for (let p = 0; p < 8; p++) {
        const rad = p % 2 === 0 ? outer : inner;
        const a = (p * Math.PI) / 4;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'star5') {
      const outer = r * 1.45;
      const inner = r * 0.6;
      for (let p = 0; p < 10; p++) {
        const rad = p % 2 === 0 ? outer : inner;
        const a = (p * Math.PI) / 5 - Math.PI / 2;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'sparkle') {
      const rayLen = r * 2.15;
      const rayWidth = Math.max(0.55, r * 0.24);
      // Horizontal tapered diffraction ray
      ctx.moveTo(-rayLen, 0);
      ctx.quadraticCurveTo(0, -rayWidth, rayLen, 0);
      ctx.quadraticCurveTo(0, rayWidth, -rayLen, 0);
      // Vertical tapered diffraction ray
      ctx.moveTo(0, -rayLen);
      ctx.quadraticCurveTo(rayWidth, 0, 0, rayLen);
      ctx.quadraticCurveTo(-rayWidth, 0, 0, -rayLen);
      ctx.fill();
      // Bright central core
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.7, r * 0.52), 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'diamond') {
      const h = r * 1.45;
      const w = r * 0.98;
      ctx.moveTo(0, -h);
      ctx.lineTo(w, 0);
      ctx.lineTo(0, h);
      ctx.lineTo(-w, 0);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'hexagon') {
      const rad = r * 1.2;
      for (let p = 0; p < 6; p++) {
        const a = (p * Math.PI) / 3;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'crescent') {
      const rad = r * 1.3;
      const shiftX = -rad * 0.22;
      ctx.arc(shiftX, 0, rad, -Math.PI / 2, Math.PI / 2, false);
      ctx.bezierCurveTo(
        shiftX + rad * 0.52,
        rad * 0.55,
        shiftX + rad * 0.52,
        -rad * 0.55,
        shiftX,
        -rad
      );
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderSpaceEffect3D(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    effect: ShaderEffect,
    currentFrame: number,
    settings: ProjectSettings,
    depthPass: 'behind' | 'front' | 'all',
    worldPosX: number,
    worldPosY: number,
    worldPosZ: number,
    worldRotX: number,
    worldRotY: number,
    worldRotZ: number,
    worldScaleX: number,
    worldScaleY: number,
    worldScaleZ: number,
    cameraState?: EvaluatedCameraState,
    allLayers?: Layer[],
    layerViewDist?: number,
    orbit?: OrbitSettings
  ) {
    if (effect.type === 'spaceLines') {
      this.renderSpaceLines3DEffect(
        ctx,
        layer,
        effect,
        currentFrame,
        settings,
        depthPass,
        worldPosX,
        worldPosY,
        worldPosZ,
        worldRotX,
        worldRotY,
        worldRotZ,
        worldScaleX,
        worldScaleY,
        worldScaleZ,
        cameraState,
        layerViewDist,
        orbit
      );
      return;
    }

    this.renderMotionStars3DEffect(
      ctx,
      layer,
      effect,
      currentFrame,
      settings,
      depthPass,
      worldPosX,
      worldPosY,
      worldPosZ,
      worldRotX,
      worldRotY,
      worldRotZ,
      worldScaleX,
      worldScaleY,
      worldScaleZ,
      cameraState,
      allLayers,
      layerViewDist,
      orbit
    );
  }

  /**
   * Render Authentic 360° Volumetric 3D Space Lines
   * Same world-anchored 3D projection architecture as Motion Stars, but projecting
   * true 3D line segments with near-plane clipping and perspective scaling.
   */
  private renderSpaceLines3DEffect(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    effect: ShaderEffect,
    currentFrame: number,
    settings: ProjectSettings,
    depthPass: 'behind' | 'front' | 'all',
    worldPosX: number,
    worldPosY: number,
    worldPosZ: number,
    worldRotX: number,
    worldRotY: number,
    worldRotZ: number,
    worldScaleX: number,
    worldScaleY: number,
    worldScaleZ: number,
    cameraState?: EvaluatedCameraState,
    layerViewDist?: number,
    orbit?: OrbitSettings
  ) {
    if (!effect.enabled) return;
    const incomingLayerAlpha = Math.max(0, Math.min(1, ctx.globalAlpha));
    if (incomingLayerAlpha <= 0.001) return;
    const effectMix = effect.params.mix === undefined ? 1 : Math.max(0, Math.min(1, Number(effect.params.mix) / 100));
    if (effectMix <= 0.001) return;

    const W = settings.width || 720;
    const H = settings.height || 1280;
    const cx = W / 2;
    const cy = H / 2;
    const fps = Math.max(1, settings.fps || 30);
    const timeSec = currentFrame / fps;

    const count = Math.min(2000, Math.max(5, Math.round(Number(effect.params.count ?? 220))));
    const speed = Number(effect.params.speed ?? 0);
    const floatSpeed = Math.max(0, Number(effect.params.floatSpeed ?? 0));
    const floatAmount = Math.max(0, Number(effect.params.floatAmount ?? 0));
    const reactivity = Math.max(0, Number(effect.params.reactivity ?? 1.0));
    const baseLineLength = Math.max(4, Number(effect.params.lineLength ?? 90));
    const baseThickness = Math.max(0.25, Number(effect.params.lineThickness ?? 2.5));
    const lengthVariationFactor = Math.max(0, Number(effect.params.lengthVariation ?? 100) / 100);
    const lineBrightness = Math.max(0.05, Number(effect.params.brightness ?? 1.0));
    const glowLevel = Math.max(0, Number(effect.params.glow ?? 20));
    const twinkleSpeed = Math.max(0, Number(effect.params.twinkle ?? 0));
    const lineRotationRad = (Number(effect.params.lineRotation ?? 0) * Math.PI) / 180;
    const spinSpeedRad = (Number(effect.params.spinSpeed ?? 0) * Math.PI) / 180;
    const spreadMult = Math.max(0.2, Number(effect.params.spread ?? 100) / 100);
    const lineStyle = String(effect.params.lineStyle || 'mixed');
    const lineCapStyle = String(effect.params.lineCapStyle || 'glow');
    const primaryColor = String(effect.params.color || '#38BDF8');
    const secondaryColor = String(effect.params.secondaryColor || '#FFFFFF');

    const isAttachedToCamera = layer.type === 'camera';
    const effLayerX = isAttachedToCamera ? cx : worldPosX;
    const effLayerY = isAttachedToCamera ? cy : worldPosY;
    const effLayerZ = isAttachedToCamera ? 0 : worldPosZ;
    const effLayerRotX = isAttachedToCamera ? 0 : worldRotX;
    const effLayerRotY = isAttachedToCamera ? 0 : worldRotY;
    const effLayerRotZ = isAttachedToCamera ? 0 : worldRotZ;
    const effLayerScaleX = isAttachedToCamera ? 1 : (Math.abs(worldScaleX) < 0.01 ? 1 : worldScaleX);
    const effLayerScaleY = isAttachedToCamera ? 1 : (Math.abs(worldScaleY) < 0.01 ? 1 : worldScaleY);
    const effLayerScaleZ = isAttachedToCamera ? 1 : (Math.abs(worldScaleZ) < 0.01 ? 1 : worldScaleZ);

    const cam: EvaluatedCameraState = cameraState || {
      active: false,
      type: '3d',
      position: { x: cx, y: cy, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      zoom: 1,
      fov: 1000,
      focalLength: 50,
      focusDistance: 1000,
      parentChain: [],
    };

    const is3DCam = cam.active && cam.type === '3d';
    const fov = is3DCam ? (cam.fov || 1000) : 1000;
    const camZoom = cam.active ? Math.max(0.01, cam.zoom || 1) : 1;

    const camX = cx + ((cam.active ? cam.position.x : cx) - cx) * reactivity;
    const camY = cy + ((cam.active ? cam.position.y : cy) - cy) * reactivity;
    const camZ = (is3DCam ? cam.position.z : 0) * reactivity;
    const camRotX = is3DCam ? cam.rotation.x : 0;
    const camRotY = is3DCam ? cam.rotation.y : 0;
    const camRotZ = cam.active ? cam.rotation.z : 0;

    const camRadY = (-camRotY * Math.PI) / 180;
    const camCosY = Math.cos(camRadY);
    const camSinY = Math.sin(camRadY);
    const camRadX = (-camRotX * Math.PI) / 180;
    const camCosX = Math.cos(camRadX);
    const camSinX = Math.sin(camRadX);
    const camRadZ = (-camRotZ * Math.PI) / 180;
    const camCosZ = Math.cos(camRadZ);
    const camSinZ = Math.sin(camRadZ);

    const lRadZ = (effLayerRotZ * Math.PI) / 180;
    const lCosZ = Math.cos(lRadZ);
    const lSinZ = Math.sin(lRadZ);
    const lRadX = (effLayerRotX * Math.PI) / 180;
    const lCosX = Math.cos(lRadX);
    const lSinX = Math.sin(lRadX);
    const lRadY = (effLayerRotY * Math.PI) / 180;
    const lCosY = Math.cos(lRadY);
    const lSinY = Math.sin(lRadY);

    const rotateLayerForward = (lx: number, ly: number, lz: number) => {
      let x = lx;
      let y = ly;
      let z = lz;
      if (effLayerRotZ !== 0) {
        const nx = x * lCosZ - y * lSinZ;
        const ny = x * lSinZ + y * lCosZ;
        x = nx;
        y = ny;
      }
      if (effLayerRotX !== 0) {
        const ny = y * lCosX - z * lSinX;
        const nz = y * lSinX + z * lCosX;
        y = ny;
        z = nz;
      }
      if (effLayerRotY !== 0) {
        const nx = x * lCosY + z * lSinY;
        const nz = -x * lSinY + z * lCosY;
        x = nx;
        z = nz;
      }
      return { x, y, z };
    };

    const invTransformLayerPoint = (wx: number, wy: number, wz: number) => {
      let x = wx - effLayerX;
      let y = wy - effLayerY;
      let z = wz - effLayerZ;
      if (effLayerRotY !== 0) {
        const nx = x * lCosY - z * lSinY;
        const nz = x * lSinY + z * lCosY;
        x = nx;
        z = nz;
      }
      if (effLayerRotX !== 0) {
        const ny = y * lCosX + z * lSinX;
        const nz = -y * lSinX + z * lCosX;
        y = ny;
        z = nz;
      }
      if (effLayerRotZ !== 0) {
        const nx = x * lCosZ + y * lSinZ;
        const ny = -x * lSinZ + y * lCosZ;
        x = nx;
        y = ny;
      }
      return {
        x: x / effLayerScaleX,
        y: y / effLayerScaleY,
        z: z / effLayerScaleZ,
      };
    };

    const eyeWorldX = orbit ? cx : camX;
    const eyeWorldY = orbit ? cy : camY;
    const eyeWorldZ = orbit ? 0 : camZ + fov;
    const camInLayer = invTransformLayerPoint(eyeWorldX, eyeWorldY, eyeWorldZ);

    let layerSeedOffset = 17;
    for (let c = 0; c < layer.id.length; c++) {
      layerSeedOffset = (layerSeedOffset * 37 + layer.id.charCodeAt(c)) % 9973;
    }

    const getRand = (seed: number): number => {
      const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
      return v - Math.floor(v);
    };

    const wrapSigned = (val: number, span: number): number => {
      const m = ((val % span) + span) % span;
      return m >= span * 0.5 ? m - span : m;
    };

    const baseSceneDim = Math.max(W, H, 1280);
    const nearSpan = baseSceneDim * 1.85 * spreadMult;
    const farSpan = nearSpan * 2.55;
    const poolCount = Math.min(5000, Math.round(count * 3.8));
    const nearPoolLimit = Math.floor(poolCount * 0.65);

    const zDrift = speed !== 0 ? timeSec * speed * 45 : 0;
    const marginPx = Math.max(320, baseLineLength * 2.5);
    const totalSpinRad = lineRotationRad + timeSec * spinSpeedRad;
    const spinCos = Math.cos(totalSpinRad);
    const spinSin = Math.sin(totalSpinRad);

    const toCamSpace = (wx: number, wy: number, wz: number) => {
      let dx = wx - camX;
      let dy = wy - camY;
      let dz = fov - (wz - camZ);
      if (is3DCam && camRotY !== 0) {
        const nx = dx * camCosY + dz * camSinY;
        const nz = -dx * camSinY + dz * camCosY;
        dx = nx;
        dz = nz;
      }
      if (is3DCam && camRotX !== 0) {
        const ny = dy * camCosX - dz * camSinX;
        const nz = dy * camSinX + dz * camCosX;
        dy = ny;
        dz = nz;
      }
      if (cam.active && camRotZ !== 0) {
        const nx = dx * camCosZ - dy * camSinZ;
        const ny = dx * camSinZ + dy * camCosZ;
        dx = nx;
        dy = ny;
      }
      return { dx, dy, dz };
    };

    interface ProjectedLine {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      lineWidth: number;
      alpha: number;
      color: string;
      viewDist: number;
    }

    const linesToDraw: ProjectedLine[] = [];
    const splitDepth = layerViewDist ?? fov;
    const Z_NEAR = 10.5;

    for (let i = 0; i < poolCount; i++) {
      const seedBase = i + layerSeedOffset * 1.19;
      const rX = getRand(seedBase * 19.1 + 2.3);
      const rY = getRand(seedBase * 37.3 + 5.7);
      const rZ = getRand(seedBase * 59.9 + 11.1);
      const rL = getRand(seedBase * 83.4 + 14.7);
      const rLum = getRand(seedBase * 67.3 + 8.9);
      const rPhase = getRand(seedBase * 101.7 + 21.3);
      const rDirA = getRand(seedBase * 43.9 + 3.1);
      const rDirB = getRand(seedBase * 71.7 + 16.5);

      const isFar = i >= nearPoolLimit;
      const span = isFar ? farSpan : nearSpan;
      const maxSphereR = span * 0.49;

      const origX = (rX - 0.5) * span;
      const origY = (rY - 0.5) * span;
      const origZ = (rZ - 0.5) * span;

      let flX = 0;
      let flY = 0;
      let flZ = 0;
      if (floatAmount > 0 && floatSpeed > 0) {
        flX =
          (Math.sin(timeSec * floatSpeed * 1.35 + rPhase * 6.283) +
            Math.cos(timeSec * floatSpeed * 0.72 + rX * 3.141)) *
          (floatAmount * 0.65);
        flY =
          (Math.cos(timeSec * floatSpeed * 1.15 + rPhase * 6.283) +
            Math.sin(timeSec * floatSpeed * 0.85 + rY * 3.141)) *
          (floatAmount * 0.65);
        flZ =
          (Math.sin(timeSec * floatSpeed * 1.6 + rZ * 6.283) +
            Math.cos(timeSec * floatSpeed * 0.95 + rPhase * 3.141)) *
          (floatAmount * 1.2);
      }

      const relX = wrapSigned(origX + flX - camInLayer.x, span);
      const relY = wrapSigned(origY + flY - camInLayer.y, span);
      const relZ = wrapSigned(origZ + flZ + zDrift - camInLayer.z, span);

      const sphereDist = Math.hypot(relX, relY, relZ);
      if (sphereDist > maxSphereR) continue;

      const fadeStart = maxSphereR * 0.82;
      const edgeFade =
        sphereDist <= fadeStart
          ? 1
          : Math.max(0, 1 - (sphereDist - fadeStart) / Math.max(1, maxSphereR - fadeStart));
      if (edgeFade <= 0.01) continue;

      // Determine local 3D unit direction vector for this line
      let ux = 0;
      let uy = 0;
      let uz = 1;
      const resolvedStyle =
        lineStyle === 'mixed'
          ? i % 3 === 0
            ? 'depth'
            : i % 3 === 1
            ? 'random3d'
            : 'parallel'
          : lineStyle;

      if (resolvedStyle === 'depth') {
        ux = 0;
        uy = 0;
        uz = 1;
      } else if (resolvedStyle === 'radial') {
        const len = Math.max(1e-4, sphereDist);
        ux = relX / len;
        uy = relY / len;
        uz = relZ / len;
      } else if (resolvedStyle === 'parallel') {
        ux = 1;
        uy = 0;
        uz = 0;
      } else if (resolvedStyle === 'cross') {
        const axis = i % 3;
        ux = axis === 0 ? 1 : 0;
        uy = axis === 1 ? 1 : 0;
        uz = axis === 2 ? 1 : 0;
      } else {
        // random3d isotropic unit sphere vector
        const theta = rDirA * Math.PI * 2;
        const zU = rDirB * 2 - 1;
        const rXY = Math.sqrt(Math.max(0, 1 - zU * zU));
        ux = Math.cos(theta) * rXY;
        uy = Math.sin(theta) * rXY;
        uz = zU;
      }

      // Apply user tilt & spin rotation in 3D space (around Z, plus subtle Y sway when depth-only so tilt is visible!)
      if (totalSpinRad !== 0) {
        const rux = ux * spinCos - uy * spinSin;
        const ruy = ux * spinSin + uy * spinCos;
        ux = rux;
        uy = ruy;
        if (resolvedStyle === 'depth') {
          // Slightly tilt depth rays off Z so lineRotation/spinSpeed creates sweeping conical beams
          const tiltZ = uz * Math.cos(totalSpinRad * 0.35);
          const tiltX = uz * Math.sin(totalSpinRad * 0.35);
          ux += tiltX * 0.45;
          uz = tiltZ;
        }
      }

      const rawDist = 0.45 + Math.pow(rL, 1.8) * 1.9;
      const variedScale = Math.max(0.2, 1 + (rawDist - 1) * lengthVariationFactor);
      const halfLen = baseLineLength * variedScale * 0.5;

      const locMidX = (camInLayer.x + relX) * effLayerScaleX;
      const locMidY = (camInLayer.y + relY) * effLayerScaleY;
      const locMidZ = (camInLayer.z + relZ) * effLayerScaleZ;
      const rotMid = rotateLayerForward(locMidX, locMidY, locMidZ);
      const midWx = effLayerX + rotMid.x;
      const midWy = effLayerY + rotMid.y;
      const midWz = effLayerZ + rotMid.z;

      const rotHalf = rotateLayerForward(
        ux * halfLen * effLayerScaleX,
        uy * halfLen * effLayerScaleY,
        uz * halfLen * effLayerScaleZ
      );

      const wx1 = midWx - rotHalf.x;
      const wy1 = midWy - rotHalf.y;
      const wz1 = midWz - rotHalf.z;
      const wx2 = midWx + rotHalf.x;
      const wy2 = midWy + rotHalf.y;
      const wz2 = midWz + rotHalf.z;

      let sx1 = 0;
      let sy1 = 0;
      let sx2 = 0;
      let sy2 = 0;
      let k1 = 1;
      let k2 = 1;
      let avgViewDist = 1000;

      if (orbit) {
        const p1 = this.project3D(wx1, wy1, wz1, settings, orbit);
        const p2 = this.project3D(wx2, wy2, wz2, settings, orbit);
        const d1 = 1500 + p1.depth + 600;
        const d2 = 1500 + p2.depth + 600;
        if (d1 <= 12 || d2 <= 12) continue;
        sx1 = p1.x;
        sy1 = p1.y;
        sx2 = p2.x;
        sy2 = p2.y;
        k1 = p1.scale;
        k2 = p2.scale;
        avgViewDist = (d1 + d2) * 0.5;
      } else {
        const c1 = toCamSpace(wx1, wy1, wz1);
        const c2 = toCamSpace(wx2, wy2, wz2);

        if (c1.dz <= Z_NEAR && c2.dz <= Z_NEAR) continue;

        let x1c = c1.dx;
        let y1c = c1.dy;
        let z1c = c1.dz;
        let x2c = c2.dx;
        let y2c = c2.dy;
        let z2c = c2.dz;

        if (z1c <= Z_NEAR) {
          const t = (Z_NEAR - z1c) / Math.max(1e-4, z2c - z1c);
          x1c = x1c + (x2c - x1c) * t;
          y1c = y1c + (y2c - y1c) * t;
          z1c = Z_NEAR;
        } else if (z2c <= Z_NEAR) {
          const t = (Z_NEAR - z2c) / Math.max(1e-4, z1c - z2c);
          x2c = x2c + (x1c - x2c) * t;
          y2c = y2c + (y1c - y2c) * t;
          z2c = Z_NEAR;
        }

        k1 = (fov / z1c) * camZoom;
        k2 = (fov / z2c) * camZoom;
        sx1 = cx + x1c * k1;
        sy1 = cy + y1c * k1;
        sx2 = cx + x2c * k2;
        sy2 = cy + y2c * k2;
        avgViewDist = (z1c + z2c) * 0.5;
      }

      if (depthPass === 'behind' && avgViewDist < splitDepth) continue;
      if (depthPass === 'front' && avgViewDist >= splitDepth) continue;

      // Bounding-box frustum check
      if (
        Math.max(sx1, sx2) < -marginPx ||
        Math.min(sx1, sx2) > W + marginPx ||
        Math.max(sy1, sy2) < -marginPx ||
        Math.min(sy1, sy2) > H + marginPx
      ) {
        continue;
      }

      const segScreenLen = Math.hypot(sx2 - sx1, sy2 - sy1);
      if (segScreenLen < 0.75) continue;

      const nearLensFade = avgViewDist < 48 ? Math.max(0, (avgViewDist - 10) / 38) : 1;
      if (nearLensFade <= 0.01) continue;

      const avgK = (k1 + k2) * 0.5;
      const lineWidth = Math.max(0.45, Math.min(48, baseThickness * avgK));
      const baseLum = 0.7 + rLum * 0.3;
      const twinkleFactor =
        twinkleSpeed > 0
          ? 0.55 + 0.45 * Math.sin(timeSec * twinkleSpeed * 6.28318 + rPhase * 6.28318)
          : 1;

      const alpha = Math.max(
        0,
        Math.min(
          1,
          edgeFade *
            nearLensFade *
            baseLum *
            twinkleFactor *
            lineBrightness *
            effectMix *
            incomingLayerAlpha
        )
      );
      if (alpha <= 0.015) continue;

      const isSecondary = rPhase > 0.68;
      linesToDraw.push({
        x1: sx1,
        y1: sy1,
        x2: sx2,
        y2: sy2,
        lineWidth,
        alpha,
        color: isSecondary ? secondaryColor : primaryColor,
        viewDist: avgViewDist,
      });
    }

    if (linesToDraw.length === 0) return;

    linesToDraw.sort((a, b) => b.viewDist - a.viewDist);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';

    for (let i = 0; i < linesToDraw.length; i++) {
      const l = linesToDraw[i];

      // Optional atmospheric glow halo
      if (glowLevel > 0) {
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.lineWidth * (1.8 + glowLevel / 28);
        ctx.globalAlpha = l.alpha * Math.min(0.45, glowLevel / 95);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }

      if (lineCapStyle === 'dashed') {
        const dashLen = Math.max(3, Math.hypot(l.x2 - l.x1, l.y2 - l.y1) * 0.16);
        ctx.setLineDash([dashLen, dashLen * 0.7]);
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.lineWidth;
        ctx.globalAlpha = l.alpha;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      } else if (lineCapStyle === 'glow') {
        const grad = ctx.createLinearGradient(l.x1, l.y1, l.x2, l.y2);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.22, l.color);
        grad.addColorStop(0.5, '#FFFFFF');
        grad.addColorStop(0.78, l.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.setLineDash([]);
        ctx.strokeStyle = grad;
        ctx.lineWidth = l.lineWidth;
        ctx.globalAlpha = l.alpha;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.lineWidth;
        ctx.globalAlpha = l.alpha;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderImage(ctx: CanvasRenderingContext2D, url: string, settings: ProjectSettings) {
    if (!url) return;
    let img = this.imageCache.get(url);

    if (!img) {
      img = new Image();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        this.imageCache.set(url, img!);
        if (this.onNeedsRender) this.onNeedsRender();
      };
      img.onerror = () => {
        if (img && img.crossOrigin && !this.exportSafeMode) {
          const retryImg = new Image();
          retryImg.onload = () => {
            this.imageCache.set(url, retryImg);
            if (this.onNeedsRender) this.onNeedsRender();
          };
          retryImg.src = url;
        }
      };
      img.src = url;
      this.imageCache.set(url, img);
    }

    if (img && (img.complete || img.naturalWidth > 0)) {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const maxW = settings.width * 0.8;
        const maxH = settings.height * 0.8;
        const aspect = img.naturalWidth / img.naturalHeight;
        let drawW = img.naturalWidth;
        let drawH = img.naturalHeight;

        if (drawW > maxW || drawH > maxH) {
          if (drawW / maxW > drawH / maxH) {
            drawW = maxW;
            drawH = maxW / aspect;
          } else {
            drawH = maxH;
            drawW = maxH * aspect;
          }
        }

        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        return;
      }
    }

    // Fallback loading box
    const loadAccent = getActiveThemePalette().bright;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-150, -100, 300, 200);
    ctx.strokeStyle = loadAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(-150, -100, 300, 200);
    ctx.fillStyle = loadAccent;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷 Loading Image...', 0, 0);
  }

  private syncVideoPlayback(
    layer: Layer,
    currentFrame: number,
    settings: ProjectSettings,
    isPlaying: boolean = false
  ): HTMLVideoElement | null {
    const url = layer.mediaUrl;
    if (!url) return null;

    const cacheKey = `${layer.id}::${url}`;
    let video = this.videoCache.get(cacheKey);

    if (!video) {
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        video.crossOrigin = 'anonymous';
      }
      const initSt: VideoPlaybackState = {
        isStartingPlay: false,
        lastSeekTime: 0,
        autoplayMutedFallback: false,
        decodedSerial: 0,
      };
      this.videoStates.set(video, initSt);

      const bumpAndNotify = () => {
        initSt.decodedSerial += 1;
        // Trigger out-of-band redraws when paused (scrubbing/initial thumbnail load).
        if (!this.isCurrentlyPlaying && this.onNeedsRender) {
          this.onNeedsRender();
        }
      };
      video.onloadedmetadata = bumpAndNotify;
      video.onloadeddata = () => {
        initSt.decodedSerial += 1;
        if (this.onNeedsRender) {
          this.onNeedsRender();
        }
      };
      video.onseeked = bumpAndNotify;
      const rVfc = (video as unknown as {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }).requestVideoFrameCallback;
      if (typeof rVfc === 'function') {
        const onVideoFrame = () => {
          initSt.decodedSerial += 1;
          if (!video || !this.videoCache.has(cacheKey)) return;
          try {
            (video as unknown as {
              requestVideoFrameCallback: (cb: () => void) => number;
            }).requestVideoFrameCallback(onVideoFrame);
          } catch {}
        };
        try {
          rVfc.call(video, onVideoFrame);
        } catch {}
      }
      video.src = url;
      this.videoCache.set(cacheKey, video);
    }

    let state = this.videoStates.get(video);
    if (!state) {
      state = { isStartingPlay: false, lastSeekTime: 0, autoplayMutedFallback: false, decodedSerial: 0 };
      this.videoStates.set(video, state);
    }

    // Check if layer is active at currentFrame
    const layerDuration = layer.durationFrames ?? (settings.durationFrames || 90);
    const isActiveFrame =
      currentFrame >= layer.startFrame &&
      currentFrame < layer.startFrame + layerDuration;

    const relFrame = Math.max(0, currentFrame - layer.startFrame);
    const fps = settings.fps || 30;
    const targetTime = relFrame / fps;
    const mediaDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity;
    const isPastMediaEnd = mediaDur < Infinity && targetTime >= mediaDur - 0.02;
    const clampedTarget = mediaDur < Infinity
      ? Math.max(0, Math.min(targetTime, Math.max(0, mediaDur - 0.03)))
      : Math.max(0, targetTime);

    const userMuted = layer.audioConfig?.muted ?? false;
    const userVolume = layer.audioConfig?.volume ?? 1;
    const now = performance.now();

    if (isPlaying) {
      if (isActiveFrame && !isPastMediaEnd) {
        // Play native muxed audio directly from the single <video> element
        video.muted = state.autoplayMutedFallback ? true : userMuted;
        video.volume = userMuted ? 0 : Math.max(0, Math.min(1, userVolume));

        if (video.paused) {
          // Never interrupt a pending play() Promise with repeated seeks/play calls
          if (!state.isStartingPlay) {
            const isLoopWrap = clampedTarget < 0.2 && video.currentTime > clampedTarget + 0.4;
            if (
              !video.seeking &&
              video.readyState >= 1 &&
              (isLoopWrap || (Math.abs(video.currentTime - clampedTarget) > 0.15 && now - state.lastSeekTime > 350))
            ) {
              try {
                state.lastSeekTime = now;
                video.currentTime = clampedTarget;
              } catch (e) {}
            }
            state.isStartingPlay = true;
            video
              .play()
              .then(() => {
                if (state) {
                  state.isStartingPlay = false;
                  state.decodedSerial += 1;
                }
                if (this.isCurrentlyPlaying && this.onNeedsRender) {
                  this.onNeedsRender();
                }
              })
              .catch((err) => {
                if (!state) return;
                state.isStartingPlay = false;
                // Fallback if browser blocks unmuted autoplay without direct gesture
                if (err?.name === 'NotAllowedError' && video && !video.muted) {
                  state.autoplayMutedFallback = true;
                  video.muted = true;
                  video
                    .play()
                    .then(() => {
                      if (state) state.decodedSerial += 1;
                      if (this.isCurrentlyPlaying && this.onNeedsRender) {
                        this.onNeedsRender();
                      }
                    })
                    .catch(() => {});
                }
              });
          }
        } else {
          // Already playing smoothly: only resync on loop wrap or major drift (>0.65s) with cooldown
          const drift = Math.abs(video.currentTime - clampedTarget);
          const isLoopWrap = clampedTarget < 0.2 && video.currentTime > clampedTarget + 0.4;
          if (
            !video.seeking &&
            !state.isStartingPlay &&
            (isLoopWrap || (drift > 0.65 && now - state.lastSeekTime > 750))
          ) {
            try {
              state.lastSeekTime = now;
              video.currentTime = clampedTarget;
            } catch (e) {}
          }
        }
      } else {
        video.muted = true;
        state.isStartingPlay = false;
        if (!video.paused) {
          try {
            video.pause();
          } catch (e) {}
        }
      }
    } else {
      // Scrubbing or paused mode
      video.muted = true;
      state.isStartingPlay = false;
      state.autoplayMutedFallback = false;
      if (!video.paused) {
        try {
          video.pause();
        } catch (e) {}
      }
      if (isActiveFrame && !isPastMediaEnd) {
        const drift = Math.abs(video.currentTime - clampedTarget);
        if (drift > 0.06 && !video.seeking && video.readyState >= 1 && now - state.lastSeekTime > 80) {
          try {
            state.lastSeekTime = now;
            video.currentTime = clampedTarget;
          } catch (e) {}
        }
      }
    }

    return video;
  }

  /**
   * Deterministically seek all active video layers to the exact timestamp for offline export.
   */
  public async seekVideosForFrame(
    layers: Layer[],
    currentFrame: number,
    settings: ProjectSettings
  ): Promise<void> {
    const fps = settings.fps || 30;
    const seekPromises: Promise<void>[] = [];

    for (const layer of layers) {
      if (layer.type !== 'video' || !layer.mediaUrl || !layer.visible) continue;
      const layerDuration = layer.durationFrames ?? (settings.durationFrames || 90);
      if (currentFrame < layer.startFrame || currentFrame >= layer.startFrame + layerDuration) {
        continue;
      }

      const video = this.syncVideoPlayback(layer, currentFrame, settings, false);
      if (!video) continue;

      const relFrame = Math.max(0, currentFrame - layer.startFrame);
      const targetTime = relFrame / fps;
      const mediaDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity;
      const clampedTarget =
        mediaDur < Infinity
          ? Math.max(0, Math.min(targetTime, Math.max(0, mediaDur - 0.03)))
          : Math.max(0, targetTime);

      if (video.readyState < 1 || Math.abs(video.currentTime - clampedTarget) > 0.008) {
        seekPromises.push(
          new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              video.removeEventListener('seeked', finish);
              video.removeEventListener('error', finish);
              const st = this.videoStates.get(video);
              if (st) st.decodedSerial += 1;
              resolve();
            };
            const timer = setTimeout(finish, 350);
            const onDone = () => {
              clearTimeout(timer);
              finish();
            };
            video.addEventListener('seeked', onDone, { once: true });
            video.addEventListener('error', onDone, { once: true });
            try {
              video.currentTime = clampedTarget;
            } catch {
              clearTimeout(timer);
              finish();
            }
          })
        );
      }
    }

    if (seekPromises.length > 0) {
      await Promise.all(seekPromises);
    }
  }

  private renderVideo(
    ctx: CanvasRenderingContext2D,
    layer: Layer,
    currentFrame: number,
    settings: ProjectSettings,
    isPlaying: boolean = false
  ) {
    const video = this.syncVideoPlayback(layer, currentFrame, settings, isPlaying);
    if (!video) return;

    // Always draw video if metadata is loaded and video has valid dimensions or ready state
    const hasDimensions = video.videoWidth > 0 && video.videoHeight > 0;
    const isReady = video.readyState >= 2 || hasDimensions;

    if (isReady && hasDimensions) {
      const maxW = settings.width * 0.8;
      const maxH = settings.height * 0.8;
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const aspect = vW / vH;
      let drawW = vW;
      let drawH = vH;

      if (drawW > maxW || drawH > maxH) {
        if (drawW / maxW > drawH / maxH) {
          drawW = maxW;
          drawH = maxW / aspect;
        } else {
          drawH = maxH;
          drawW = maxH * aspect;
        }
      }

      try {
        ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);
      } catch (e) {}
      return;
    }

    // Fallback loading video box
    const loadAccent = getActiveThemePalette().bright;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-150, -100, 300, 200);
    ctx.strokeStyle = loadAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(-150, -100, 300, 200);
    ctx.fillStyle = loadAccent;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎬 Loading Video...', 0, 0);
  }

  private renderAdjustmentOrEffectOnlyLayer(
    layer: Layer,
    allLayers: Layer[],
    settings: ProjectSettings,
    currentFrame: number,
    cameraTransform?: { active: boolean; x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number; zoom: number },
    scene?: EvaluatedSceneState
  ) {
    const activeEffects = (layer.effects || []).filter((e) => e.enabled);
    if (activeEffects.length === 0) return;

    const resolvedScene = scene || evaluateSceneGraph(allLayers, currentFrame, settings.fps, settings);
    const evalState = resolvedScene.layers.get(layer.id);
    const worldMat = getLayerWorldMatrix(layer, allLayers, currentFrame, settings.fps, cameraTransform, settings);
    const transform = evalState?.localTransform || evaluateLayerTransform(layer, currentFrame, settings.fps);
    const fx = computeEffectTransforms(layer, currentFrame, settings);
    if (fx.effectOpacity <= 0) return;

    const worldPosX = (evalState?.worldPosition.x ?? transform.position.x ?? settings.width * 0.5) + fx.extraX;
    const worldPosY = (evalState?.worldPosition.y ?? transform.position.y ?? settings.height * 0.5) + fx.extraY;
    const worldPosZ = (evalState?.worldPosition.z ?? transform.position.z ?? 0) + fx.extraZ;
    const worldRotX = (evalState?.worldRotation.x ?? transform.rotation.x ?? 0) + fx.extraRotX;
    const worldRotY = (evalState?.worldRotation.y ?? transform.rotation.y ?? 0) + fx.extraRotY;
    const worldRotZ = (evalState?.worldRotation.z ?? transform.rotation.z ?? 0) + fx.extraRotZ;
    const worldScaleX = Math.max(1e-7, (evalState?.worldScale.x ?? (transform.scale.x || 100) / 100) * fx.extraScaleX);
    const worldScaleY = Math.max(1e-7, (evalState?.worldScale.y ?? (transform.scale.y || 100) / 100) * fx.extraScaleY);
    const worldScaleZ = Math.max(1e-7, (evalState?.worldScale.z ?? (transform.scale.z || 100) / 100) * fx.extraScaleZ);

    // 1. Render 3D Starfield / Space Lines if present
    const starEffects = activeEffects.filter(
      (e) => e.type === 'motionStars' || e.type === 'starfield' || e.type === 'spaceLines'
    );
    for (const starEffect of starEffects) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, Math.min(1, worldMat.opacity * fx.effectOpacity));
      this.renderSpaceEffect3D(
        this.ctx,
        layer,
        starEffect,
        currentFrame,
        settings,
        'all',
        worldPosX,
        worldPosY,
        worldPosZ,
        worldRotX,
        worldRotY,
        worldRotZ,
        worldScaleX,
        worldScaleY,
        worldScaleZ,
        resolvedScene.camera,
        allLayers
      );
      this.ctx.restore();
    }

    // Determine whether this layer modifies underlying pixels (Adjustment or full effect-only node)
    const visualEffects = activeEffects.filter(
      (e) => e.type !== 'motionStars' && e.type !== 'starfield' && e.type !== 'spaceLines'
    );
    if (visualEffects.length === 0) return;

    const isPureOverlayOnly =
      layer.type !== 'adjustment' && visualEffects.every((e) => isOverlayProceduralEffect(e.type));

    this.offscreenCtx.save();
    this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.offscreenCtx.clearRect(0, 0, settings.width, settings.height);

    if (!isPureOverlayOnly) {
      // Copy accumulated composite rendered underneath into offscreenCtx at logical scene resolution
      this.offscreenCtx.drawImage(
        this.canvas,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
        0,
        0,
        settings.width,
        settings.height
      );
    }
    this.offscreenCtx.restore();

    applyCanvasEffects(
      this.offscreenCtx,
      visualEffects,
      settings.width,
      settings.height,
      currentFrame,
      settings.fps,
      { scratchCanvas: this.effectScratchCanvas, layerZ: worldMat.z + fx.extraZ }
    );

    this.ctx.save();
    this.ctx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || 'source-over';
    this.ctx.globalAlpha = Math.max(0, Math.min(1, worldMat.opacity * fx.effectOpacity));
    if (isPureOverlayOnly) {
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    } else {
      // Draw adjusted composite cleanly
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }
    this.ctx.restore();
  }

  private buildEffectsSig(effects?: ShaderEffect[]): string {
    if (!effects || effects.length === 0) return 'none';
    let sig = '';
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      if (!e.enabled) continue;
      sig += `${e.id}:${e.type}:`;
      const p = e.params;
      if (p) {
        for (const k in p) {
          if (Object.prototype.hasOwnProperty.call(p, k)) {
            const v = p[k];
            sig += `${k}=${typeof v === 'object' && v !== null ? JSON.stringify(v) : v};`;
          }
        }
      }
      sig += '|';
    }
    return sig || 'off';
  }

  private measureBaseLayerSize(
    layer: Layer,
    settings: ProjectSettings
  ): { width: number; height: number; extraSig: string; pendingLoad: boolean } {
    let w = settings.width || 720;
    let h = settings.height || 1280;
    let extraSig = '';
    let pendingLoad = false;

    if (layer.type === 'solid') {
      w = settings.width || 720;
      h = settings.height || 1280;
      extraSig = layer.solidColor || '#ffffff';
    } else if (layer.vectorConfig) {
      const vc = layer.vectorConfig;
      const strokePad = Math.ceil((vc.strokeWidth || 0) * 2 + 12);
      w = (vc.width || 340) + strokePad;
      h = (vc.height || 340) + strokePad;
      const pathSig = vc.pathPoints ? vc.pathPoints.map((p) => `${p.x},${p.y},${p.handleIn?.x ?? 0},${p.handleIn?.y ?? 0},${p.handleOut?.x ?? 0},${p.handleOut?.y ?? 0}`).join(';') : '';
      extraSig = `${vc.type}:${vc.width}x${vc.height}:${vc.fill}:${vc.stroke}:${vc.strokeWidth}:${vc.cornerRadius ?? 0}:${vc.sides ?? 0}:${vc.innerRadiusRatio ?? 0}:${pathSig}`;
    } else if (layer.textConfig) {
      const tc = layer.textConfig;
      const fontSize = tc.fontSize || 48;
      const fontName = tc.fontFamily || 'Cairo';
      this.scratchCtx.save();
      this.scratchCtx.font = `${fontSize}px "${fontName}", "Cairo", "Tajawal", "Amiri", "Alexandria", "Almarai", "Readex Pro", "Changa", "Vazirmatn", sans-serif`;
      const lines = (tc.text || '').split('\n');
      let maxW = 120;
      for (const line of lines) {
        const metrics = this.scratchCtx.measureText(line);
        const lineW = metrics.width + Math.abs(tc.letterSpacing || 0) * line.length;
        if (lineW > maxW) maxW = lineW;
      }
      this.scratchCtx.restore();
      const strokePad = Math.ceil((tc.strokeWidth || 0) * 2 + 48);
      const lineHeight = fontSize * (tc.lineHeight || 1.2);
      w = Math.max(160, Math.ceil(maxW + strokePad));
      h = Math.max(80, Math.ceil(lines.length * lineHeight + strokePad));
      extraSig = `${tc.text}|${fontSize}|${fontName}|${tc.fill}|${tc.stroke}|${tc.strokeWidth}|${tc.letterSpacing}|${tc.lineHeight}|${tc.align}|${tc.animator?.enabled ? 1 : 0}`;
    } else if (layer.particleConfig) {
      const pc = layer.particleConfig;
      w = settings.width || 720;
      h = settings.height || 1280;
      extraSig = `${pc.shape}:${pc.count}:${pc.size}:${pc.color}:${pc.secondaryColor}`;
    } else if (layer.type === 'image' && layer.mediaUrl) {
      const img = this.imageCache.get(layer.mediaUrl);
      if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        const maxW = settings.width * 0.8;
        const maxH = settings.height * 0.8;
        const aspect = img.naturalWidth / img.naturalHeight;
        let drawW = img.naturalWidth;
        let drawH = img.naturalHeight;
        if (drawW > maxW || drawH > maxH) {
          if (drawW / maxW > drawH / maxH) {
            drawW = maxW;
            drawH = maxW / aspect;
          } else {
            drawH = maxH;
            drawW = maxH * aspect;
          }
        }
        w = Math.max(2, Math.ceil(drawW));
        h = Math.max(2, Math.ceil(drawH));
        extraSig = `${layer.mediaUrl}:${img.naturalWidth}x${img.naturalHeight}`;
      } else {
        w = 340;
        h = 240;
        extraSig = `${layer.mediaUrl}:loading`;
        pendingLoad = true;
      }
    } else if (layer.type === 'video' && layer.mediaUrl) {
      const cacheKey = `${layer.id}::${layer.mediaUrl}`;
      const video = this.videoCache.get(cacheKey);
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const maxW = settings.width * 0.8;
        const maxH = settings.height * 0.8;
        const aspect = video.videoWidth / video.videoHeight;
        let drawW = video.videoWidth;
        let drawH = video.videoHeight;
        if (drawW > maxW || drawH > maxH) {
          if (drawW / maxW > drawH / maxH) {
            drawW = maxW;
            drawH = maxW / aspect;
          } else {
            drawH = maxH;
            drawW = maxH * aspect;
          }
        }
        w = Math.max(2, Math.ceil(drawW));
        h = Math.max(2, Math.ceil(drawH));
        extraSig = `${layer.mediaUrl}:${video.videoWidth}x${video.videoHeight}`;
      } else {
        w = 340;
        h = 240;
        extraSig = `${layer.mediaUrl}:loading`;
        pendingLoad = true;
      }
    }

    return { width: w, height: h, extraSig, pendingLoad };
  }

  private measureLayerTextureSize(
    layer: Layer,
    settings: ProjectSettings
  ): { width: number; height: number; extraSig: string; pendingLoad: boolean } {
    const base = this.measureBaseLayerSize(layer, settings);
    let w = base.width;
    let h = base.height;

    // Add symmetric padding when glow, bloom, blur, shadow, or warp effects can bleed outside bounds
    const needsFxPad = Boolean(
      layer.effects?.some((e) => e.enabled && isBoundsExpandingEffect(e.type))
    );
    const totalPad = needsFxPad ? 160 : 0;

    if (totalPad > 0 && layer.type !== 'solid') {
      w += totalPad;
      h += totalPad;
    }

    return { width: w, height: h, extraSig: base.extraSig, pendingLoad: base.pendingLoad };
  }

  /**
   * Computes pixel-tight local bounding box `{ minX, minY, maxX, maxY }` centered at `(0,0)`
   * so transparent margins around PNGs or vector shapes are excluded from the selection box.
   */
  public getLayerTightBounds(
    layer: Layer,
    settings: ProjectSettings,
    currentFrame: number = 0
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    if (layer.type === 'null') {
      return { minX: -60, minY: -60, maxX: 60, maxY: 60 };
    }
    if (layer.type === 'group') {
      const hw = (layer.groupConfig?.boundsWidth || 360) / 2;
      const hh = (layer.groupConfig?.boundsHeight || 360) / 2;
      return { minX: -hw, minY: -hh, maxX: hw, maxY: hh };
    }
    if (layer.type === 'camera') {
      return { minX: -160, minY: -90, maxX: 160, maxY: 90 };
    }
    if (layer.type === 'model3d') {
      return { minX: -140, minY: -140, maxX: 140, maxY: 140 };
    }

    if (layer.textConfig) {
      const tc = layer.textConfig;
      const fontSize = tc.fontSize || 48;
      const fontName = tc.fontFamily || 'Cairo';
      this.scratchCtx.save();
      this.scratchCtx.font = `${fontSize}px "${fontName}", "Cairo", "Tajawal", "Amiri", "Alexandria", "Almarai", "Readex Pro", "Changa", "Vazirmatn", sans-serif`;
      const lines = (tc.text || 'Text').split('\n');
      let maxW = 40;
      for (const line of lines) {
        const metrics = this.scratchCtx.measureText(line);
        const lineW = metrics.width + Math.abs(tc.letterSpacing || 0) * line.length + 16;
        if (lineW > maxW) maxW = lineW;
      }
      this.scratchCtx.restore();
      const boxW = maxW + (tc.strokeWidth || 0);
      const lineH = fontSize * (tc.lineHeight || 1.2);
      const boxH = Math.max(fontSize * 1.2, lines.length * lineH + (tc.strokeWidth || 0));
      return { minX: -boxW / 2, minY: -boxH / 2, maxX: boxW / 2, maxY: boxH / 2 };
    }

    const base = this.measureBaseLayerSize(layer, settings);
    const fullBox = {
      minX: -base.width / 2,
      minY: -base.height / 2,
      maxX: base.width / 2,
      maxY: base.height / 2,
    };

    // Scan alpha of loaded images and vector shapes so transparent outer margins don't inflate selection bounds
    const isScanImage = layer.type === 'image' && Boolean(layer.mediaUrl) && !base.pendingLoad;
    const isScanVector = layer.type === 'vector' && Boolean(layer.vectorConfig);
    if (!isScanImage && !isScanVector) {
      return fullBox;
    }

    const cacheKey = isScanImage
      ? `img|${layer.mediaUrl}|${base.width}x${base.height}`
      : `vec|${base.extraSig}|${base.width}x${base.height}`;
    const cached = this.tightBoundsCache.get(cacheKey);
    if (cached) return cached;

    const maxScan = 256;
    const scale = Math.min(1, maxScan / Math.max(1, base.width, base.height));
    const sw = Math.max(16, Math.ceil(base.width * scale));
    const sh = Math.max(16, Math.ceil(base.height * scale));

    if (this.hitTestCanvas.width !== sw || this.hitTestCanvas.height !== sh) {
      this.hitTestCanvas.width = sw;
      this.hitTestCanvas.height = sh;
    }

    this.hitTestCtx.save();
    this.hitTestCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.hitTestCtx.clearRect(0, 0, sw, sh);
    this.hitTestCtx.translate(sw / 2, sh / 2);
    this.hitTestCtx.scale(scale, scale);
    this.renderLayerRawContent(this.hitTestCtx, layer, currentFrame, settings, false);
    this.hitTestCtx.restore();

    let result = fullBox;
    try {
      const data = this.hitTestCtx.getImageData(0, 0, sw, sh).data;
      let minPxX = sw;
      let maxPxX = -1;
      let minPxY = sh;
      let maxPxY = -1;
      for (let py = 0; py < sh; py++) {
        const rowOff = py * sw * 4;
        for (let px = 0; px < sw; px++) {
          if (data[rowOff + px * 4 + 3] >= 16) {
            if (px < minPxX) minPxX = px;
            if (px > maxPxX) maxPxX = px;
            if (py < minPxY) minPxY = py;
            if (py > maxPxY) maxPxY = py;
          }
        }
      }

      if (maxPxX >= minPxX && maxPxY >= minPxY) {
        const invScale = 1 / scale;
        let minX = (minPxX - sw / 2) * invScale - 2;
        let maxX = (maxPxX + 1 - sw / 2) * invScale + 2;
        let minY = (minPxY - sh / 2) * invScale - 2;
        let maxY = (maxPxY + 1 - sh / 2) * invScale + 2;
        if (maxX - minX < 24) {
          const midX = (minX + maxX) / 2;
          minX = midX - 12;
          maxX = midX + 12;
        }
        if (maxY - minY < 24) {
          const midY = (minY + maxY) / 2;
          minY = midY - 12;
          maxY = midY + 12;
        }
        result = {
          minX: Math.max(fullBox.minX, minX),
          minY: Math.max(fullBox.minY, minY),
          maxX: Math.min(fullBox.maxX, maxX),
          maxY: Math.min(fullBox.maxY, maxY),
        };
      }
    } catch {
      result = fullBox;
    }

    if (this.tightBoundsCache.size > 150) {
      this.tightBoundsCache.clear();
    }
    this.tightBoundsCache.set(cacheKey, result);
    return result;
  }

  /**
   * Pixel-accurate front-to-back hit test at canvas `(screenX, screenY)`.
   * Transparent pixels inside an image's rectangle will NOT select the layer; selection falls through cleanly.
   */
  public hitTestLayerAtPoint(
    layers: Layer[],
    currentFrame: number,
    settings: ProjectSettings,
    screenX: number,
    screenY: number
  ): Layer | null {
    const scene = evaluateSceneGraph(layers, currentFrame, settings.fps, settings);
    const cameraTransform = {
      active: scene.camera.active,
      x: scene.camera.position.x,
      y: scene.camera.position.y,
      z: scene.camera.position.z,
      rotX: scene.camera.rotation.x,
      rotY: scene.camera.rotation.y,
      rotZ: scene.camera.rotation.z,
      zoom: scene.camera.zoom,
    };

    const getLayer3DDepth = (l: Layer): number => {
      const evalState = scene.layers.get(l.id);
      const wZ = evalState?.worldPosition.z ?? (evaluateLayerTransform(l, currentFrame, settings.fps).position.z || 0);
      if (scene.camera.active && scene.camera.type === '3d') {
        const dx = (evalState?.worldPosition.x ?? 0) - scene.camera.position.x;
        const dy = (evalState?.worldPosition.y ?? 0) - scene.camera.position.y;
        let dz = (scene.camera.fov || 1000) - (wZ - scene.camera.position.z);
        if (scene.camera.rotation.y !== 0) {
          const radY = (-scene.camera.rotation.y * Math.PI) / 180;
          dz = -dx * Math.sin(radY) + dz * Math.cos(radY);
        }
        if (scene.camera.rotation.x !== 0) {
          const radX = (-scene.camera.rotation.x * Math.PI) / 180;
          dz = dy * Math.sin(radX) + dz * Math.cos(radX);
        }
        return -dz;
      }
      return wZ;
    };

    const hitLayerMap = new Map<string, Layer>();
    for (const l of layers) hitLayerMap.set(l.id, l);

    // Front-to-back order (exact reverse of painter's algorithm render order)
    const activeLayers = layers
      .filter(
        (l) =>
          l.type !== 'audio' &&
          l.type !== 'adjustment' &&
          l.type !== 'group' &&
          isEffectivelyVisible(l, hitLayerMap, currentFrame) &&
          !isEffectivelyLocked(l, hitLayerMap)
      )
      .sort((a, b) => {
        const diff = getLayer3DDepth(b) - getLayer3DDepth(a);
        if (Math.abs(diff) > 0.05) return diff;
        return layers.indexOf(b) - layers.indexOf(a);
      });

    for (const layer of activeLayers) {
      const evalState = scene.layers.get(layer.id);
      const worldMat = getLayerWorldMatrix(layer, layers, currentFrame, settings.fps, cameraTransform, settings);
      const fx = computeEffectTransforms(layer, currentFrame, settings);
      if (worldMat.opacity * fx.effectOpacity <= 0.005) continue;

      const effWorldMat = {
        ...worldMat,
        x: worldMat.x + fx.extraX,
        y: worldMat.y + fx.extraY,
        z: worldMat.z + fx.extraZ,
        rotationX: worldMat.rotationX + fx.extraRotX,
        rotationY: worldMat.rotationY + fx.extraRotY,
        rotationZ: worldMat.rotationZ + fx.extraRotZ,
        scaleX: Math.max(1e-7, worldMat.scaleX * fx.extraScaleX),
        scaleY: Math.max(1e-7, worldMat.scaleY * fx.extraScaleY),
        scaleZ: worldMat.scaleZ * fx.extraScaleZ,
      };

      const has3D = Math.abs(effWorldMat.rotationX || 0) > 0.05 || Math.abs(effWorldMat.rotationY || 0) > 0.05;
      const cameraDz = (evalState?.cameraDz ?? effWorldMat.cameraDz ?? 1000) - fx.extraZ;
      if (!has3D && layer.type !== 'model3d' && cameraDz <= 6) continue;

      const transform = evalState?.localTransform || evaluateLayerTransform(layer, currentFrame, settings.fps);
      const anchorX = Number.isFinite(transform.anchorPoint?.x) ? transform.anchorPoint.x : 0;
      const anchorY = Number.isFinite(transform.anchorPoint?.y) ? transform.anchorPoint.y : 0;

      const localPt = unprojectScreenToLayerLocal(
        screenX,
        screenY,
        effWorldMat,
        anchorX,
        anchorY,
        settings
      );
      if (!Number.isFinite(localPt.x) || !Number.isFinite(localPt.y)) continue;

      if (layer.type === 'null' || layer.type === 'camera' || layer.type === 'model3d') {
        const bounds = this.getLayerTightBounds(layer, settings, currentFrame);
        const avgScale = Math.max(0.2, (effWorldMat.scaleX + effWorldMat.scaleY) * 0.5);
        const tol = Math.max(8, Math.min(32, 10 / avgScale));
        if (
          localPt.x >= bounds.minX - tol &&
          localPt.x <= bounds.maxX + tol &&
          localPt.y >= bounds.minY - tol &&
          localPt.y <= bounds.maxY + tol
        ) {
          return layer;
        }
        continue;
      }

      const texMetrics = this.measureLayerTextureSize(layer, settings);

      // Fast local-space pre-reject before rasterizing pixel alpha
      const tight = this.getLayerTightBounds(layer, settings, currentFrame);
      const pad = 20;
      if (
        localPt.x < tight.minX - pad ||
        localPt.x > tight.maxX + pad ||
        localPt.y < tight.minY - pad ||
        localPt.y > tight.maxY + pad
      ) {
        continue;
      }

      // Solid layers always fill their full local rectangle
      if (layer.type === 'solid') {
        return layer;
      }

      const renderW = Math.max(32, texMetrics.width);
      const renderH = Math.max(32, texMetrics.height);
      const hitScale = Math.min(1, 384 / Math.max(renderW, renderH));
      const cw = Math.max(16, Math.ceil(renderW * hitScale));
      const ch = Math.max(16, Math.ceil(renderH * hitScale));

      if (this.hitTestCanvas.width !== cw || this.hitTestCanvas.height !== ch) {
        this.hitTestCanvas.width = cw;
        this.hitTestCanvas.height = ch;
      }

      this.hitTestCtx.save();
      this.hitTestCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.hitTestCtx.clearRect(0, 0, cw, ch);
      this.hitTestCtx.translate(cw / 2, ch / 2);
      this.hitTestCtx.scale(hitScale, hitScale);
      this.renderLayerContent(this.hitTestCtx, layer, currentFrame, settings, false);
      this.hitTestCtx.restore();

      const px = Math.round(cw / 2 + localPt.x * hitScale);
      const py = Math.round(ch / 2 + localPt.y * hitScale);
      const avgScale = Math.max(0.15, (effWorldMat.scaleX + effWorldMat.scaleY) * 0.5);
      const sampleRadius = Math.max(2, Math.min(8, Math.ceil((5 / avgScale) * hitScale)));

      const x0 = Math.max(0, px - sampleRadius);
      const y0 = Math.max(0, py - sampleRadius);
      const x1 = Math.min(cw - 1, px + sampleRadius);
      const y1 = Math.min(ch - 1, py + sampleRadius);
      if (x1 < x0 || y1 < y0) continue;

      try {
        const imgData = this.hitTestCtx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
        let hitOpaque = false;
        for (let i = 3; i < imgData.length; i += 4) {
          if (imgData[i] >= 16) {
            hitOpaque = true;
            break;
          }
        }
        if (hitOpaque) {
          return layer;
        }
      } catch {
        // Fallback for CORS-tainted cross-origin images
        const tight = this.getLayerTightBounds(layer, settings, currentFrame);
        if (
          localPt.x >= tight.minX - 6 &&
          localPt.x <= tight.maxX + 6 &&
          localPt.y >= tight.minY - 6 &&
          localPt.y <= tight.maxY + 6
        ) {
          return layer;
        }
      }
    }

    return null;
  }

  private renderTransformHandles(
    settings: ProjectSettings,
    selectedLayer: Layer,
    allLayers: Layer[],
    currentFrame: number,
    cameraTransform?: { active: boolean; x: number; y: number; z: number; rotX: number; rotY: number; rotZ: number; zoom: number }
  ) {
    const worldMat = getLayerWorldMatrix(selectedLayer, allLayers, currentFrame, settings.fps, cameraTransform, settings);
    const transform = evaluateLayerTransform(selectedLayer, currentFrame, settings.fps);

    this.ctx.save();

    const { minX, minY, maxX, maxY } = this.getLayerTightBounds(selectedLayer, settings, currentFrame);
    const halfW = (maxX - minX) / 2;
    const halfH = (maxY - minY) / 2;

    const cameraDz = worldMat.cameraDz ?? 1000;
    const has3D = Math.abs(worldMat.rotationX || 0) > 0.05 || Math.abs(worldMat.rotationY || 0) > 0.05;
    const isModel3D = selectedLayer.type === 'model3d';
    const maxZExtent = isModel3D
      ? 240 * Math.max(Math.abs(worldMat.scaleZ || 1), 0.5)
      : has3D
      ? (halfW + halfH) * 0.5 * Math.max(Math.abs(worldMat.scaleZ || 1), 0.5)
      : 0;

    const themePal = getActiveThemePalette();

    // Cleanly show a non-broken centered indicator when layer has pierced completely behind camera lens
    if (cameraDz + maxZExtent <= 6) {
      const cx = settings.width / 2;
      const cy = settings.height / 2;
      this.ctx.strokeStyle = `rgba(${themePal.brightRgb}, 0.75)`;
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      this.ctx.beginPath();
      this.ctx.roundRect(cx - 56, cy + 26, 112, 22, 6);
      this.ctx.fill();
      this.ctx.fillStyle = themePal.bright;
      this.ctx.font = 'bold 10px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`خلف الكاميرا (Z: ${Math.round(worldMat.z)})`, cx, cy + 40);
      this.ctx.restore();
      return;
    }

    // Parametric Liang-Barsky segment clipper so giant close-up quads clip cleanly along exact edge slope (zero diagonal bending)
    const clipBoundsMargin = Math.max(settings.width, settings.height) * 0.5;
    const clipSegment = (
      a: { x: number; y: number },
      b: { x: number; y: number }
    ): [{ x: number; y: number }, { x: number; y: number }] | null => {
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) {
        return null;
      }
      const xMin = -clipBoundsMargin;
      const xMax = settings.width + clipBoundsMargin;
      const yMin = -clipBoundsMargin;
      const yMax = settings.height + clipBoundsMargin;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      let t0 = 0;
      let t1 = 1;
      const tests = [
        [-dx, a.x - xMin],
        [dx, xMax - a.x],
        [-dy, a.y - yMin],
        [dy, yMax - a.y],
      ];
      for (const [p, q] of tests) {
        if (Math.abs(p) < 1e-8) {
          if (q < 0) return null;
        } else {
          const r = q / p;
          if (p < 0) {
            if (r > t1) return null;
            if (r > t0) t0 = r;
          } else {
            if (r < t0) return null;
            if (r < t1) t1 = r;
          }
        }
      }
      return [
        { x: a.x + t0 * dx, y: a.y + t0 * dy },
        { x: a.x + t1 * dx, y: a.y + t1 * dy },
      ];
    };

    const drawClippedQuad = (corners: Array<{ x: number; y: number }>, strokeColor: string) => {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([6, 4]);
      this.ctx.beginPath();
      let hasAnySegment = false;
      for (let i = 0; i < corners.length; i++) {
        const clipped = clipSegment(corners[i], corners[(i + 1) % corners.length]);
        if (clipped) {
          this.ctx.moveTo(clipped[0].x, clipped[0].y);
          this.ctx.lineTo(clipped[1].x, clipped[1].y);
          hasAnySegment = true;
        }
      }
      if (hasAnySegment) {
        this.ctx.stroke();
      }
      this.ctx.setLineDash([]);
    };

    const isHandleInView = (h: { x: number; y: number }) =>
      Number.isFinite(h.x) &&
      Number.isFinite(h.y) &&
      h.x >= -80 &&
      h.x <= settings.width + 80 &&
      h.y >= -80 &&
      h.y <= settings.height + 80;

    if (has3D) {
      const fov = 1000;
      const vanishX = settings.width / 2;
      const vanishY = settings.height / 2;
      const toScreenP = (lx: number, ly: number) => {
        const sx = (lx - transform.anchorPoint.x) * worldMat.scaleX;
        const sy = (ly - transform.anchorPoint.y) * worldMat.scaleY;
        const rotated = rotatePoint3D({ x: sx, y: sy, z: 0 }, worldMat.rotationX || 0, worldMat.rotationY || 0, worldMat.rotationZ || 0);
        return projectLocalCorner3D(
          worldMat.x,
          worldMat.y,
          worldMat.z,
          worldMat.perspectiveFactor || 1,
          rotated,
          vanishX,
          vanishY,
          fov
        );
      };

      const p0 = toScreenP(minX, minY);
      const p1 = toScreenP(maxX, minY);
      const p2 = toScreenP(maxX, maxY);
      const p3 = toScreenP(minX, maxY);

      drawClippedQuad([p0, p1, p2, p3], themePal.bright);

      const handles = [p0, p1, p2, p3];
      this.ctx.fillStyle = '#ffffff';
      this.ctx.strokeStyle = themePal.primary;
      this.ctx.lineWidth = 2;
      handles.forEach(h => {
        if (!isHandleInView(h)) return;
        this.ctx.beginPath();
        this.ctx.rect(h.x - 5, h.y - 5, 10, 10);
        this.ctx.fill();
        this.ctx.stroke();
      });

      // Fixed screen-space anchor dot
      if (cameraDz > 6 && isHandleInView({ x: worldMat.x, y: worldMat.y })) {
        this.ctx.beginPath();
        this.ctx.arc(worldMat.x, worldMat.y, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ef4444';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      this.ctx.restore();
      return;
    }

    // Project 2D bounding box corners into screen pixels so strokes & handles stay fixed size at any Z zoom
    const rotRad = ((worldMat.rotationZ || 0) * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);
    const toScreen2D = (lx: number, ly: number) => {
      const sx = (lx - transform.anchorPoint.x) * worldMat.scaleX;
      const sy = (ly - transform.anchorPoint.y) * worldMat.scaleY;
      return {
        x: worldMat.x + (sx * cosR - sy * sinR),
        y: worldMat.y + (sx * sinR + sy * cosR),
      };
    };

    const cTL = toScreen2D(minX, minY);
    const cTR = toScreen2D(maxX, minY);
    const cBR = toScreen2D(maxX, maxY);
    const cBL = toScreen2D(minX, maxY);
    const topMid = toScreen2D((minX + maxX) / 2, minY);
    const upX = sinR;
    const upY = -cosR;
    const rotHandle = {
      x: topMid.x + upX * 25,
      y: topMid.y + upY * 25,
    };

    // Bounding border clipped cleanly to viewport bounds (never bends on extreme zoom)
    drawClippedQuad([cTL, cTR, cBR, cBL], themePal.bright);

    // Corner handle points (constant 10x10 screen px)
    const handles = [cTL, cTR, cBR, cBL];
    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = themePal.primary;
    this.ctx.lineWidth = 2;

    handles.forEach(h => {
      if (!isHandleInView(h)) return;
      this.ctx.beginPath();
      this.ctx.rect(h.x - 5, h.y - 5, 10, 10);
      this.ctx.fill();
      this.ctx.stroke();
    });

    // Rotation Handle (top line + circle in screen px)
    if (isHandleInView(topMid) || isHandleInView(rotHandle)) {
      this.ctx.beginPath();
      this.ctx.moveTo(topMid.x, topMid.y);
      this.ctx.lineTo(rotHandle.x, rotHandle.y);
      this.ctx.strokeStyle = themePal.bright;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(rotHandle.x, rotHandle.y, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = themePal.primary;
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.stroke();
    }

    // Anchor Point Handle (constant 6px radius at pivot screen pos)
    if (cameraDz > 6 && isHandleInView({ x: worldMat.x, y: worldMat.y })) {
      this.ctx.beginPath();
      this.ctx.arc(worldMat.x, worldMat.y, 6, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ef4444';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }

    this.ctx.restore();

    // Render parenting hierarchy link line if selected layer has a parent
    if (selectedLayer.parentId) {
      const parent = allLayers.find((l) => l.id === selectedLayer.parentId);
      if (parent) {
        const parentWorldMat = getLayerWorldMatrix(parent, allLayers, currentFrame, settings.fps, cameraTransform, settings);

        this.ctx.save();
        this.ctx.strokeStyle = themePal.bright;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 6]);
        this.ctx.shadowColor = themePal.primary;
        this.ctx.shadowBlur = 8;

        this.ctx.beginPath();
        this.ctx.moveTo(worldMat.x, worldMat.y);
        this.ctx.lineTo(parentWorldMat.x, parentWorldMat.y);
        this.ctx.stroke();

        // Midpoint connection badge
        const midX = (worldMat.x + parentWorldMat.x) / 2;
        const midY = (worldMat.y + parentWorldMat.y) / 2;
        this.ctx.fillStyle = themePal.deep;
        this.ctx.beginPath();
        this.ctx.arc(midX, midY, 11, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = themePal.light;
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([]);
        this.ctx.stroke();

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 9px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🔗', midX, midY);

        this.ctx.restore();
      }
    }
  }

  /**
   * Internal Real-Time Animation & Camera Debug HUD
   */
  private renderDebugHUD(
    ctx: CanvasRenderingContext2D,
    settings: ProjectSettings,
    currentFrame: number,
    scene: EvaluatedSceneState,
    selectedLayerId: string | null
  ) {
    ctx.save();
    const pad = 12;
    const hudW = 280;
    const hudH = 190;
    const hudX = pad;
    const hudY = pad;

    // Background panel
    ctx.fillStyle = 'rgba(10, 15, 29, 0.88)';
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#00E676';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`⚡ ENGINE EVALUATOR HUD [FPS: ${settings.fps}]`, hudX + 10, hudY + 18);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px monospace';
    ctx.fillText(`Frame: ${currentFrame} / ${settings.durationFrames} (${scene.timeSec.toFixed(2)}s)`, hudX + 10, hudY + 34);

    // Camera Section
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`📹 Camera: ${scene.camera.active ? (scene.camera.name || 'Active') : 'Default (Static)'}`, hudX + 10, hudY + 52);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(`   Type: ${scene.camera.type.toUpperCase()} | Zoom: ${scene.camera.zoom.toFixed(2)}x`, hudX + 10, hudY + 66);
    ctx.fillText(`   Pos: (${Math.round(scene.camera.position.x)}, ${Math.round(scene.camera.position.y)}, ${Math.round(scene.camera.position.z)})`, hudX + 10, hudY + 80);
    ctx.fillText(`   Rot: (${Math.round(scene.camera.rotation.x)}°, ${Math.round(scene.camera.rotation.y)}°, ${Math.round(scene.camera.rotation.z)}°)`, hudX + 10, hudY + 94);

    // Selected Layer Section
    const selectedState = selectedLayerId ? scene.layers.get(selectedLayerId) : null;
    ctx.fillStyle = '#C084FC';
    ctx.fillText(`🎯 Target Layer: ${selectedState ? selectedState.layer.name : 'None Selected'}`, hudX + 10, hudY + 114);

    if (selectedState) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(`   Type: ${selectedState.layer.type} | Opacity: ${(selectedState.worldOpacity * 100).toFixed(0)}%`, hudX + 10, hudY + 128);
      ctx.fillText(`   World Pos: (${Math.round(selectedState.worldPosition.x)}, ${Math.round(selectedState.worldPosition.y)}, ${Math.round(selectedState.worldPosition.z)})`, hudX + 10, hudY + 142);
      ctx.fillText(`   Screen Pos: (${Math.round(selectedState.screenX)}, ${Math.round(selectedState.screenY)})`, hudX + 10, hudY + 156);
      ctx.fillText(`   Scale: (${(selectedState.worldScale.x * 100).toFixed(0)}%, ${(selectedState.worldScale.y * 100).toFixed(0)}%) | Rot: ${Math.round(selectedState.worldRotation.z)}°`, hudX + 10, hudY + 170);
      if (selectedState.parentChain.length > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.fillText(`   Parent Chain Depth: ${selectedState.parentChain.length}`, hudX + 10, hudY + 184);
      }
    } else {
      ctx.fillStyle = '#64748B';
      ctx.fillText('   Select any layer to inspect transforms', hudX + 10, hudY + 132);
    }

    ctx.restore();
  }
}
