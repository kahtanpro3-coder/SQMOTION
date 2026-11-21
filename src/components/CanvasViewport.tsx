import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Language, Layer, OrbitSettings, CameraViewMode, PreviewQuality, CollabMember } from '../types';
import { EngineRenderer } from '../engine/renderer';
import { evaluateLayerTransform, getLayerWorldMatrix } from '../engine/interpolator';
import { projectLayerLocalToScreen } from '../engine/mesh3dRenderer';
import { AlightMotionSideToolbar } from './AlightMotionSideToolbar';
import { MODAL_EASE, PANEL_SPRING, PanelRimSheen } from './MotionPrimitives';
import { useAppTheme } from '../utils/appSettings';
import {
  Maximize2,
  Grid,
  Move,
  Plus,
  Minus,
  RotateCcw,
  Sliders,
  Sparkles,
  Camera,
  Eye,
  Globe,
  Compass,
  Box,
  Layers,
  Video,
  Activity,
  ChevronDown,
  Check,
  Zap,
} from 'lucide-react';

interface CanvasViewportProps {
  project: Project;
  lang: Language;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayerTransform: (layerId: string, position: { x: number; y: number; z: number }) => void;
  onUpdateLayer?: (updatedLayer: Layer) => void;
  onChangeAspectRatio: (width: number, height: number) => void;
  onOpenAddModal?: () => void;
  onAddLayer?: (type: Layer['type'], customConfig?: any) => void;
  onChangeCameraViewMode?: (mode: CameraViewMode) => void;
  onUpdateOrbitSettings?: (orbit: OrbitSettings) => void;
  isSideToolsOpen?: boolean;
  onToggleSideTools?: () => void;
  collabMembers?: CollabMember[];
  localMemberId?: string;
}

type DragMode =
  | 'move'
  | 'scale-tl'
  | 'scale-tr'
  | 'scale-br'
  | 'scale-bl'
  | 'scale-edge'
  | 'orbit-3d'
  | 'canvas-pan'
  | null;

const CanvasViewportBase: React.FC<CanvasViewportProps> = ({
  project,
  lang,
  onSelectLayer,
  onUpdateLayerTransform,
  onUpdateLayer,
  onChangeAspectRatio,
  onOpenAddModal,
  onAddLayer,
  onChangeCameraViewMode,
  onUpdateOrbitSettings,
  isSideToolsOpen = false,
  onToggleSideTools,
  collabMembers = [],
  localMemberId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EngineRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme: appTheme } = useAppTheme();

  const [viewportBounds, setViewportBounds] = useState<{ w: number; h: number; winW: number; winH: number }>({
    w: 0,
    h: 0,
    winW: typeof window !== 'undefined' ? window.innerWidth : 1280,
    winH: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      setViewportBounds((prev) =>
        Math.abs(prev.w - rect.width) < 0.5 &&
        Math.abs(prev.h - rect.height) < 0.5 &&
        prev.winW === winW &&
        prev.winH === winH
          ? prev
          : { w: rect.width, h: rect.height, winW, winH }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const [zoom, setZoom] = useState<number>(0.85);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showDebugHUD, setShowDebugHUD] = useState<boolean>(false);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialPos, setInitialPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialScale, setInitialScale] = useState<{ x: number; y: number }>({ x: 100, y: 100 });
  const [initialDist, setInitialDist] = useState<number>(1);
  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragEventRef = useRef<{ type: 'mouse'; x: number; y: number } | { type: 'touch'; touches: { clientX: number; clientY: number }[] } | null>(null);
  const panStartRef = useRef<{ panX: number; panY: number; clientX: number; clientY: number }>({
    panX: 0,
    panY: 0,
    clientX: 0,
    clientY: 0,
  });

  // 3D Camera View Mode: 'first_person' (عدسة الكاميرا) vs 'third_person' (استوديو 3D Orbit)
  const [cameraViewMode, setCameraViewMode] = useState<CameraViewMode>(
    project.cameraViewMode || 'first_person'
  );

  // 3D Orbit parameters for Third-Person Perspective
  const [orbitSettings, setOrbitSettings] = useState<OrbitSettings>(
    project.orbitSettings || {
      pitch: -25,
      yaw: 35,
      distance: 0.85,
      panX: 0,
      panY: 0,
      fixedLayers: true,
      lockLayersPosition: false,
    }
  );

  const [initialOrbitStart, setInitialOrbitStart] = useState<{ pitch: number; yaw: number }>({
    pitch: -25,
    yaw: 35,
  });

  // Sync external project view mode if changed
  useEffect(() => {
    if (project.cameraViewMode && project.cameraViewMode !== cameraViewMode) {
      setCameraViewMode(project.cameraViewMode);
    }
  }, [project.cameraViewMode]);

  // Handler to switch Camera View Mode
  const handleSetViewMode = (mode: CameraViewMode) => {
    setCameraViewMode(mode);
    if (onChangeCameraViewMode) {
      onChangeCameraViewMode(mode);
    }
  };

  const handleUpdateOrbit = (newOrbit: Partial<OrbitSettings>) => {
    const updated: OrbitSettings = { ...orbitSettings, ...newOrbit };
    setOrbitSettings(updated);
    if (onUpdateOrbitSettings) {
      onUpdateOrbitSettings(updated);
    }
  };

  // Find camera layer if any exists in project
  const cameraLayer = project.layers.find((l) => l.type === 'camera' && l.visible);

  // Quick 3D angle presets
  const applyOrbitPreset = (preset: 'iso' | 'front' | 'top' | 'side') => {
    switch (preset) {
      case 'iso':
        handleUpdateOrbit({ pitch: -25, yaw: 35, distance: 0.85 });
        break;
      case 'front':
        handleUpdateOrbit({ pitch: 0, yaw: 0, distance: 0.9 });
        break;
      case 'top':
        handleUpdateOrbit({ pitch: -85, yaw: 0, distance: 0.8 });
        break;
      case 'side':
        handleUpdateOrbit({ pitch: 0, yaw: 90, distance: 0.85 });
        break;
    }
  };

  // Preview Quality state: 'full' (100%), 'medium' (50%), 'low' (25%), 'auto' (adaptive: 50% during playback, 100% paused)
  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(() => {
    try {
      const saved = localStorage.getItem('sqmotion_preview_quality');
      if (saved === 'full' || saved === 'medium' || saved === 'low' || saved === 'auto') {
        return saved as PreviewQuality;
      }
    } catch {}
    return project.settings.previewQuality || 'auto';
  });

  useEffect(() => {
    const syncHandler = (e: Event) => {
      const detail = (e as CustomEvent<PreviewQuality>).detail;
      if (detail) setPreviewQuality(detail);
    };
    window.addEventListener('sqmotion:previewQualityChange', syncHandler);
    return () => window.removeEventListener('sqmotion:previewQualityChange', syncHandler);
  }, []);

  useEffect(() => {
    if (project.settings.previewQuality && project.settings.previewQuality !== previewQuality) {
      setPreviewQuality(project.settings.previewQuality);
    }
  }, [project.settings.previewQuality]);

  const handleSelectQuality = (q: PreviewQuality) => {
    setPreviewQuality(q);
    try {
      localStorage.setItem('sqmotion_preview_quality', q);
    } catch {}
    window.dispatchEvent(new CustomEvent<PreviewQuality>('sqmotion:previewQualityChange', { detail: q }));
  };

  // 1-Click add 3D camera layer if user wants to animate camera
  const handleAdd3DCamera = () => {
    if (onAddLayer) {
      onAddLayer('camera', {
        name: lang === 'ar' ? 'كاميرا 3D سينمائية' : 'Cinematic 3D Camera',
      });
    } else if (onOpenAddModal) {
      onOpenAddModal();
    }
  };

  const isInteracting = Boolean(dragMode || touchPinchDist);

  // Latest render props ref so callbacks like onNeedsRender always use the most current state
  const latestPropsRef = useRef({
    project,
    cameraViewMode,
    orbitSettings,
    showDebugHUD,
    previewQuality,
    isInteracting,
  });
  latestPropsRef.current = {
    project,
    cameraViewMode,
    orbitSettings,
    showDebugHUD,
    previewQuality,
    isInteracting,
  };

  // Initialize renderer
  useEffect(() => {
    if (canvasRef.current) {
      rendererRef.current = new EngineRenderer(canvasRef.current);
      rendererRef.current.onNeedsRender = () => {
        if (rendererRef.current) {
          const {
            project: p,
            cameraViewMode: cvm,
            orbitSettings: os,
            showDebugHUD: sdh,
            previewQuality: pq,
            isInteracting: interacting,
          } = latestPropsRef.current;
          rendererRef.current.render(
            p.settings,
            p.layers,
            p.currentFrame,
            p.selectedLayerId,
            true,
            p.isPlaying,
            cvm,
            os,
            sdh,
            pq,
            interacting
          );
        }
      };
    }
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  // Re-render whenever frame, layers, settings, view mode, orbit, preview quality, or interaction changes
  useEffect(() => {
    if (rendererRef.current && canvasRef.current) {
      rendererRef.current.render(
        project.settings,
        project.layers,
        project.currentFrame,
        project.selectedLayerId,
        true,
        project.isPlaying,
        cameraViewMode,
        orbitSettings,
        showDebugHUD,
        previewQuality,
        isInteracting
      );
    }
  }, [
    project.currentFrame,
    project.layers,
    project.settings,
    project.selectedLayerId,
    project.isPlaying,
    cameraViewMode,
    orbitSettings,
    showDebugHUD,
    previewQuality,
    isInteracting,
    appTheme,
  ]);

  const selectedLayer = project.layers.find((l) => l.id === project.selectedLayerId);
  const activeLayer = selectedLayer || (project.layers.length > 0 ? project.layers[0] : undefined);

  // Get active layer transform and world matrix at current frame
  const activeTransform = activeLayer
    ? evaluateLayerTransform(activeLayer, project.currentFrame, project.settings.fps)
    : null;

  const activeWorldMat = activeLayer
    ? getLayerWorldMatrix(activeLayer, project.layers, project.currentFrame, project.settings.fps, undefined, project.settings)
    : null;

  // Scale update helper (fast structural clone + no-op dedup for smooth 60fps shrinking/scaling)
  const handleScaleChange = (newScaleX: number, newScaleY?: number) => {
    const target = selectedLayer || activeLayer;
    if (!target || !onUpdateLayer) return;
    const sX = Math.max(0.01, Math.round(newScaleX * 10) / 10);
    const sY = Math.max(0.01, Math.round((newScaleY ?? sX) * 10) / 10);
    const prevX = target.transform.scale.value.x || 100;
    const prevY = target.transform.scale.value.y ?? 100;
    const prevZ = target.transform.scale.value.z ?? 100;
    const isUniform = Math.abs(sX - sY) < 0.15;
    const sZ = isUniform
      ? Math.max(0.01, Math.round(prevZ * (sX / Math.max(0.01, prevX)) * 10) / 10)
      : prevZ;

    const existingKfs = target.transform.scale.keyframes;
    const hasKfs = Array.isArray(existingKfs) && existingKfs.length > 0;
    if (
      !hasKfs &&
      Math.abs(sX - prevX) < 0.001 &&
      Math.abs(sY - prevY) < 0.001 &&
      Math.abs(sZ - prevZ) < 0.001
    ) {
      return;
    }

    const relFrame = project.currentFrame - target.startFrame;
    let nextKfs: any[] = [];

    if (hasKfs && existingKfs) {
      nextKfs = existingKfs.map((k: any) => ({ ...k }));
      const kf = nextKfs.find((k: any) => Math.abs(k.frame - relFrame) < 0.5);
      if (kf) {
        if (
          Math.abs((kf.value?.x ?? prevX) - sX) < 0.001 &&
          Math.abs((kf.value?.y ?? prevY) - sY) < 0.001 &&
          Math.abs((kf.value?.z ?? prevZ) - sZ) < 0.001 &&
          Math.abs(sX - prevX) < 0.001 &&
          Math.abs(sY - prevY) < 0.001 &&
          Math.abs(sZ - prevZ) < 0.001
        ) {
          return;
        }
        kf.value = { x: sX, y: sY, z: sZ };
      } else {
        nextKfs.push({
          id: `kf-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          frame: relFrame,
          value: { x: sX, y: sY, z: sZ },
          easing: 'linear',
        });
        nextKfs.sort((a: any, b: any) => a.frame - b.frame);
      }
    }

    const copy: Layer = {
      ...target,
      transform: {
        ...target.transform,
        scale: {
          ...target.transform.scale,
          value: {
            x: sX,
            y: sY,
            z: sZ,
          },
          keyframes: nextKfs,
        },
      },
    };

    onUpdateLayer(copy);
  };

  // Convert client coordinates to project canvas coordinate space
  const getCanvasCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleFactor = project.settings.width / (rect.width || 1);
    return {
      x: (clientX - rect.left) * scaleFactor,
      y: (clientY - rect.top) * scaleFactor,
    };
  };

  // Check if click is on pixel-tight corner handles of the selected layer
  const checkCornerHandleHit = (mouseX: number, mouseY: number): DragMode => {
    if (!selectedLayer || !activeTransform || !activeWorldMat || cameraViewMode === 'third_person') return null;

    const bounds = rendererRef.current?.getLayerTightBounds(
      selectedLayer,
      project.settings,
      project.currentFrame
    ) ?? {
      minX: selectedLayer.type === 'null' ? -60 : selectedLayer.vectorConfig ? -selectedLayer.vectorConfig.width / 2 : -100,
      minY: selectedLayer.type === 'null' ? -60 : selectedLayer.vectorConfig ? -selectedLayer.vectorConfig.height / 2 : -100,
      maxX: selectedLayer.type === 'null' ? 60 : selectedLayer.vectorConfig ? selectedLayer.vectorConfig.width / 2 : 100,
      maxY: selectedLayer.type === 'null' ? 60 : selectedLayer.vectorConfig ? selectedLayer.vectorConfig.height / 2 : 100,
    };

    const handleRadius = Math.max(30, 40 * (project.settings.width / 1000));
    const anchorX = Number.isFinite(activeTransform.anchorPoint?.x) ? activeTransform.anchorPoint.x : 0;
    const anchorY = Number.isFinite(activeTransform.anchorPoint?.y) ? activeTransform.anchorPoint.y : 0;

    const rawCorners = [
      { mode: 'scale-tl' as DragMode, lx: bounds.minX, ly: bounds.minY },
      { mode: 'scale-tr' as DragMode, lx: bounds.maxX, ly: bounds.minY },
      { mode: 'scale-br' as DragMode, lx: bounds.maxX, ly: bounds.maxY },
      { mode: 'scale-bl' as DragMode, lx: bounds.minX, ly: bounds.maxY },
    ];

    for (const c of rawCorners) {
      const sp = projectLayerLocalToScreen(
        c.lx,
        c.ly,
        activeWorldMat,
        anchorX,
        anchorY,
        project.settings
      );
      if (!Number.isFinite(sp.x) || !Number.isFinite(sp.y)) continue;
      const dist = Math.hypot(mouseX - sp.x, mouseY - sp.y);
      if (dist <= handleRadius) {
        return c.mode;
      }
    }

    return null;
  };

  // Mouse Down Event
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;

    // Clicking empty padding around canvas frame exits layer cleanly
    if (e.target === e.currentTarget) {
      if (project.selectedLayerId) {
        onSelectLayer(null);
      }
      setDragMode(null);
      return;
    }

    if (cameraViewMode === 'third_person') {
      // In 3rd person mode, dragging orbits the 3D space
      setDragMode('orbit-3d');
      setDragStart({ x: e.clientX, y: e.clientY });
      setInitialOrbitStart({ pitch: orbitSettings.pitch, yaw: orbitSettings.yaw });
      return;
    }

    const { x: mouseX, y: mouseY } = getCanvasCoords(e.clientX, e.clientY);

    // First check if user clicked a corner resize handle of the currently selected layer
    if (selectedLayer && activeTransform && activeWorldMat) {
      const handleHit = checkCornerHandleHit(mouseX, mouseY);
      if (handleHit) {
        setDragMode(handleHit);
        setDragStart({ x: mouseX, y: mouseY });
        setInitialScale({ x: activeTransform.scale.x, y: activeTransform.scale.y });
        const distFromCenter = Math.hypot(mouseX - activeWorldMat.x, mouseY - activeWorldMat.y);
        setInitialDist(Math.max(10, distFromCenter));
        return;
      }
    }

    // Pixel-accurate hit test (transparent pixels around PNG/vector shapes fall through cleanly)
    const hitLayer =
      rendererRef.current?.hitTestLayerAtPoint(
        project.layers,
        project.currentFrame,
        project.settings,
        mouseX,
        mouseY
      ) || null;

    if (hitLayer) {
      onSelectLayer(hitLayer.id);
      setDragMode('move');
      setDragStart({ x: mouseX, y: mouseY });
      const currentT = evaluateLayerTransform(hitLayer, project.currentFrame, project.settings.fps);
      setInitialPos({ x: currentT.position.x, y: currentT.position.y });
      setInitialScale({ x: currentT.scale.x, y: currentT.scale.y });
    } else {
      // Clicked empty area -> deselect layer (and restore all layers in timeline)
      onSelectLayer(null);
      setDragMode(null);
    }
  };

  // Process pointer move inside rAF for silky 60fps canvas transform
  const processPointerMove = (clientX: number, clientY: number) => {
    if (!dragMode) return;

    if (dragMode === 'orbit-3d') {
      const deltaX = clientX - dragStart.x;
      const deltaY = clientY - dragStart.y;

      const newYaw = ((initialOrbitStart.yaw + deltaX * 0.5) % 360);
      const newPitch = Math.max(-85, Math.min(85, initialOrbitStart.pitch + deltaY * 0.4));

      handleUpdateOrbit({ yaw: newYaw, pitch: newPitch });
      return;
    }

    if (dragMode === 'canvas-pan') {
      const dx = clientX - panStartRef.current.clientX;
      const dy = clientY - panStartRef.current.clientY;
      setPanOffset({
        x: Math.round(panStartRef.current.panX + dx),
        y: Math.round(panStartRef.current.panY + dy),
      });
      return;
    }

    if (!selectedLayer || !canvasRef.current || !activeTransform) return;

    const { x: mouseX, y: mouseY } = getCanvasCoords(clientX, clientY);

    if (dragMode === 'move') {
      let deltaX = mouseX - dragStart.x;
      let deltaY = mouseY - dragStart.y;

      // If layer has a parent, transform delta into parent's coordinate space
      if (selectedLayer.parentId) {
        const parent = project.layers.find((l) => l.id === selectedLayer.parentId);
        if (parent) {
          const pWorld = getLayerWorldMatrix(parent, project.layers, project.currentFrame, project.settings.fps, undefined, project.settings);
          const rad = (-pWorld.rotationZ * Math.PI) / 180;
          const cosR = Math.cos(rad);
          const sinR = Math.sin(rad);
          const rx = deltaX * cosR - deltaY * sinR;
          const ry = deltaX * sinR + deltaY * cosR;
          deltaX = rx / (pWorld.scaleX || 1);
          deltaY = ry / (pWorld.scaleY || 1);
        }
      }

      // Scale delta inversely by Z perspective factor when not parented/fixed so 3D dragging tracks cursor 1:1 at any Z depth
      let dragPf = 1;
      if (!selectedLayer.parentId && !selectedLayer.fixedIn3D && selectedLayer.is3D !== false && activeWorldMat) {
        dragPf = Math.max(1e-5, activeWorldMat.perspectiveFactor || 1);
        deltaX /= dragPf;
        deltaY /= dragPf;
      }

      const quant = dragPf > 5 ? 100000 : 10;
      const newX = Math.round((initialPos.x + deltaX) * quant) / quant;
      const newY = Math.round((initialPos.y + deltaY) * quant) / quant;

      onUpdateLayerTransform(selectedLayer.id, {
        x: newX,
        y: newY,
        z: activeTransform.position.z ?? selectedLayer.transform.position.value.z,
      });
    } else if (dragMode.startsWith('scale-') && activeWorldMat) {
      // Scale based on distance from layer world center
      const currentDist = Math.hypot(mouseX - activeWorldMat.x, mouseY - activeWorldMat.y);
      const ratio = currentDist / initialDist;
      const newScaleX = Math.round(initialScale.x * ratio * 10) / 10;
      const newScaleY = Math.round(initialScale.y * ratio * 10) / 10;
      handleScaleChange(newScaleX, newScaleY);
    }
  };

  const processTouchMove = (touches: { clientX: number; clientY: number }[]) => {
    if (cameraViewMode === 'third_person' && dragMode === 'orbit-3d' && touches.length === 1) {
      const touch = touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      const newYaw = initialOrbitStart.yaw + deltaX * 0.5;
      const newPitch = Math.max(-85, Math.min(85, initialOrbitStart.pitch + deltaY * 0.4));
      handleUpdateOrbit({ yaw: newYaw, pitch: newPitch });
      return;
    }

    if (touches.length === 2 && touchPinchDist && selectedLayer) {
      const t1 = touches[0];
      const t2 = touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = currentDist / touchPinchDist;
      const newScale = Math.round(initialScale.x * ratio * 10) / 10;
      handleScaleChange(newScale, newScale);
      return;
    }

    if (touches.length === 1 && dragMode) {
      processPointerMove(touches[0].clientX, touches[0].clientY);
    }
  };

  const latestMoveHandlersRef = useRef({ processPointerMove, processTouchMove });
  latestMoveHandlersRef.current = { processPointerMove, processTouchMove };

  // Window-level pointer & touch listeners with rAF coalescing during active drag/pinch
  useEffect(() => {
    if (!dragMode && !touchPinchDist) return;

    const scheduleFlush = () => {
      if (dragRafRef.current !== null) return;
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        const evt = pendingDragEventRef.current;
        if (!evt) return;
        if (evt.type === 'mouse') {
          latestMoveHandlersRef.current.processPointerMove(evt.x, evt.y);
        } else {
          latestMoveHandlersRef.current.processTouchMove(evt.touches);
        }
      });
    };

    const onWinMouseMove = (e: MouseEvent) => {
      pendingDragEventRef.current = { type: 'mouse', x: e.clientX, y: e.clientY };
      scheduleFlush();
    };

    const onWinTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 0) return;
      const touches = Array.from(e.touches).map((t) => ({ clientX: t.clientX, clientY: t.clientY }));
      pendingDragEventRef.current = { type: 'touch', touches };
      scheduleFlush();
    };

    const onWinEnd = () => {
      pendingDragEventRef.current = null;
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      setDragMode(null);
      setTouchPinchDist(null);
    };

    window.addEventListener('mousemove', onWinMouseMove);
    window.addEventListener('touchmove', onWinTouchMove, { passive: false });
    window.addEventListener('mouseup', onWinEnd);
    window.addEventListener('touchend', onWinEnd);
    window.addEventListener('touchcancel', onWinEnd);

    return () => {
      window.removeEventListener('mousemove', onWinMouseMove);
      window.removeEventListener('touchmove', onWinTouchMove);
      window.removeEventListener('mouseup', onWinEnd);
      window.removeEventListener('touchend', onWinEnd);
      window.removeEventListener('touchcancel', onWinEnd);
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, [dragMode, touchPinchDist]);

  // Touch Events for Mobile / Tablet gestures (Move, Pinch-to-scale, 3D Orbit)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Tapping empty padding around canvas frame exits layer cleanly
    if (e.target === e.currentTarget && e.touches.length === 1) {
      if (project.selectedLayerId) {
        onSelectLayer(null);
      }
      setDragMode(null);
      return;
    }

    if (cameraViewMode === 'third_person') {
      if (e.touches.length === 1) {
        setDragMode('orbit-3d');
        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
        setInitialOrbitStart({ pitch: orbitSettings.pitch, yaw: orbitSettings.yaw });
      }
      return;
    }

    if (e.touches.length === 2 && selectedLayer && activeTransform) {
      // Pinch gesture
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      setTouchPinchDist(dist);
      setInitialScale({ x: activeTransform.scale.x, y: activeTransform.scale.y });
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x: touchX, y: touchY } = getCanvasCoords(touch.clientX, touch.clientY);

      if (selectedLayer && activeTransform && activeWorldMat) {
        const handleHit = checkCornerHandleHit(touchX, touchY);
        if (handleHit) {
          setDragMode(handleHit);
          setDragStart({ x: touchX, y: touchY });
          setInitialScale({ x: activeTransform.scale.x, y: activeTransform.scale.y });
          const distFromCenter = Math.hypot(touchX - activeWorldMat.x, touchY - activeWorldMat.y);
          setInitialDist(Math.max(10, distFromCenter));
          return;
        }
      }

      // Pixel-accurate hit test (transparent pixels around PNG/vector shapes fall through cleanly)
      const hitLayer =
        rendererRef.current?.hitTestLayerAtPoint(
          project.layers,
          project.currentFrame,
          project.settings,
          touchX,
          touchY
        ) || null;

      if (hitLayer) {
        onSelectLayer(hitLayer.id);
        setDragMode('move');
        setDragStart({ x: touchX, y: touchY });
        const currentT = evaluateLayerTransform(hitLayer, project.currentFrame, project.settings.fps);
        setInitialPos({ x: currentT.position.x, y: currentT.position.y });
        setInitialScale({ x: currentT.scale.x, y: currentT.scale.y });
      } else {
        onSelectLayer(null);
        setDragMode(null);
      }
    }
  };

  // Mouse Wheel zooming/scaling layer if Alt key is held, or canvas zoom when inspecting boundaries / Ctrl+Wheel
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (cameraViewMode === 'third_person') {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      handleUpdateOrbit({ distance: Math.max(0.4, Math.min(2.5, orbitSettings.distance + delta)) });
      return;
    }

    if (e.altKey && selectedLayer && activeTransform) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      handleScaleChange(activeTransform.scale.x + delta);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.14 : -0.14;
      setZoom((prev) => {
        const next = Math.max(0.4, Math.min(4.5, Math.round((prev + delta) * 100) / 100));
        if (next <= 0.95) setPanOffset({ x: 0, y: 0 });
        return next;
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-[#161719] flex flex-col items-center justify-center overflow-hidden select-none touch-none"
      onWheel={handleWheel}
      onMouseDown={(e) => {
        if (e.target === containerRef.current) {
          if (zoom > 1.05) {
            panStartRef.current = {
              panX: panOffset.x,
              panY: panOffset.y,
              clientX: e.clientX,
              clientY: e.clientY,
            };
            setDragMode('canvas-pan');
            return;
          }
          if (project.selectedLayerId) {
            onSelectLayer(null);
            setDragMode(null);
          }
        }
      }}
      onTouchStart={(e) => {
        if (e.target === containerRef.current && e.touches.length === 1) {
          if (zoom > 1.05) {
            panStartRef.current = {
              panX: panOffset.x,
              panY: panOffset.y,
              clientX: e.touches[0].clientX,
              clientY: e.touches[0].clientY,
            };
            setDragMode('canvas-pan');
            return;
          }
          if (project.selectedLayerId) {
            onSelectLayer(null);
            setDragMode(null);
          }
        }
      }}
    >
      {/* Alight Motion Left Side Tools Strip (Triggered by the leftmost button at timeline) */}
      <AlightMotionSideToolbar
        isOpen={isSideToolsOpen}
        onClose={() => onToggleSideTools && onToggleSideTools()}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        zoom={zoom}
        onSetZoom={setZoom}
        cameraViewMode={cameraViewMode}
        onChangeCameraViewMode={handleSetViewMode}
        lang={lang}
        previewQuality={previewQuality}
        onSetPreviewQuality={handleSelectQuality}
      />

      {/* Remote Collaborator Presence Strip (only rendered when other editors are active) */}
      {(() => {
        const remotePeers = collabMembers.filter((m) => m.isOnline && m.id !== localMemberId);
        if (remotePeers.length === 0) return null;
        return (
          <div className="absolute top-2.5 right-3 z-20 flex items-center gap-1.5 pointer-events-none">
            {remotePeers.slice(0, 4).map((peer) => {
              const targetLayer = peer.selectedLayerId
                ? project.layers.find((l) => l.id === peer.selectedLayerId)
                : null;
              return (
                <div
                  key={peer.id}
                  className="px-2 py-0.5 rounded-full bg-[#111319]/90 border border-white/10 shadow-md flex items-center gap-1.5 text-[10px]"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: peer.color }}
                  />
                  <span className="font-semibold text-slate-200 max-w-[80px] truncate">{peer.name}</span>
                  {targetLayer && (
                    <span className="text-slate-400 truncate max-w-[90px] hidden sm:inline">
                      · {targetLayer.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Main Preview Container */}
      <div
        className="relative flex items-center justify-center p-2 sm:p-4 transition-transform duration-75 will-change-transform touch-none"
        style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Optional Grid Background */}
        {showGrid && (
          <div
            className="absolute inset-0 border border-dashed border-white/15 pointer-events-none rounded"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        )}

        {/* Canvas Frame Wrapper — fixed CSS size locked to project aspect ratio & container bounds (never moves or resizes with previewQuality or play state) */}
        {(() => {
          const projW = Math.max(1, project.settings.width || 1920);
          const projH = Math.max(1, project.settings.height || 1080);
          const ratio = projW / projH;
          let frameStyle: React.CSSProperties;

          if (viewportBounds.w > 0 && viewportBounds.h > 0) {
            const pad = viewportBounds.winW >= 640 ? 32 : 16;
            const maxW = Math.max(120, Math.min(viewportBounds.w - pad, viewportBounds.winW * 0.94));
            const maxH = Math.max(100, Math.min(viewportBounds.h - pad, viewportBounds.winH * 0.5));
            let displayW = maxW;
            let displayH = displayW / ratio;
            if (displayH > maxH) {
              displayH = maxH;
              displayW = displayH * ratio;
            }
            frameStyle = {
              width: `${Math.round(displayW)}px`,
              height: `${Math.round(displayH)}px`,
            };
          } else {
            frameStyle = {
              width: 'min(94vw, 800px)',
              maxHeight: '50vh',
              aspectRatio: `${projW} / ${projH}`,
            };
          }

          const projBg = project.settings.backgroundColor;
          const isTransparentProjBg =
            projBg === 'transparent' ||
            projBg === '#00000000' ||
            projBg === 'rgba(0,0,0,0)' ||
            /^#[0-9a-f]{6}00$/i.test(projBg || '');

          const wrapperBgStyle: React.CSSProperties = isTransparentProjBg
            ? {
                backgroundColor: '#1a1c22',
                backgroundImage:
                  'linear-gradient(45deg, #282c36 25%, transparent 25%), linear-gradient(-45deg, #282c36 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #282c36 75%), linear-gradient(-45deg, transparent 75%, #282c36 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }
            : {
                backgroundColor: projBg || '#000000',
              };

          return (
            <div
              className="shadow-[0_12px_36px_rgba(0,0,0,0.65)] overflow-hidden relative shrink-0"
              style={{ ...frameStyle, ...wrapperBgStyle }}
            >
              <canvas
                ref={canvasRef}
                className={`block w-full h-full ${cameraViewMode === 'third_person' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />
            </div>
          );
        })()}
      </div>

      {/* Floating 3D Third-Person Perspective Controls Bar */}
      <AnimatePresence>
        {cameraViewMode === 'third_person' && (
          <motion.div
            key="third-person-hud-bar"
            initial={{ y: 28, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: PANEL_SPRING }}
            exit={{ y: 20, opacity: 0, scale: 0.96, transition: { duration: 0.16, ease: MODAL_EASE } }}
            className="absolute bottom-4 inset-x-4 max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#0C0E14]/95 border border-[rgba(var(--app-accent-rgb),0.35)] rounded-2xl backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.8)] z-30 pointer-events-auto overflow-hidden"
          >
            <PanelRimSheen roundedClass="rounded-2xl" />
            {/* Preset Angle Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[var(--app-accent-bright)] px-1">
              {lang === 'ar' ? 'زاوية 3D:' : '3D Angle:'}
            </span>
            <button
              onClick={() => applyOrbitPreset('iso')}
              className="px-2 py-1 rounded-lg bg-[#161922] hover:bg-[#1F2430] text-slate-200 text-xs font-semibold transition-all border border-white/5"
              title={lang === 'ar' ? 'منظور مائل 3D' : 'Isometric Perspective'}
            >
              {lang === 'ar' ? 'مائل (Iso)' : 'Isometric'}
            </button>
            <button
              onClick={() => applyOrbitPreset('front')}
              className="px-2 py-1 rounded-lg bg-[#161922] hover:bg-[#1F2430] text-slate-200 text-xs font-semibold transition-all border border-white/5"
              title={lang === 'ar' ? 'منظور أمامي' : 'Front View'}
            >
              {lang === 'ar' ? 'أمامي' : 'Front'}
            </button>
            <button
              onClick={() => applyOrbitPreset('top')}
              className="px-2 py-1 rounded-lg bg-[#161922] hover:bg-[#1F2430] text-slate-200 text-xs font-semibold transition-all border border-white/5"
              title={lang === 'ar' ? 'منظور علوي' : 'Top View'}
            >
              {lang === 'ar' ? 'علوي' : 'Top'}
            </button>
            <button
              onClick={() => applyOrbitPreset('side')}
              className="px-2 py-1 rounded-lg bg-[#161922] hover:bg-[#1F2430] text-slate-200 text-xs font-semibold transition-all border border-white/5"
              title={lang === 'ar' ? 'منظور جانبي' : 'Side View'}
            >
              {lang === 'ar' ? 'جانبي' : 'Side'}
            </button>

            {/* Layer Stabilization: Keep layers fixed and prevent them from twisting */}
            <button
              onClick={() => handleUpdateOrbit({ fixedLayers: orbitSettings.fixedLayers === false ? true : false })}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                orbitSettings.fixedLayers !== false
                  ? 'bg-[rgba(var(--app-accent-rgb),0.2)] text-[var(--app-accent-bright)] border-[rgba(var(--app-accent-rgb),0.5)] shadow-[0_0_10px_rgba(var(--app-accent-rgb),0.25)]'
                  : 'bg-[#161922] text-slate-400 border-white/5 hover:text-slate-200'
              }`}
              title={
                lang === 'ar'
                  ? 'ثبات الطبقات: إبقاء الطبقات ثابتة في واجهتها ومنع التفافها وتشوهها مع تحريك 3D'
                  : 'Fixed Layers: Keep layers upright and stable without twisting during 3D movement'
              }
            >
              <span>{orbitSettings.fixedLayers !== false ? '🔒' : '🔓'}</span>
              <span>{lang === 'ar' ? 'ثبات الطبقات (لا تلتف)' : 'Fixed Layers'}</span>
            </button>
          </div>

          {/* Interactive 3D Distance/Zoom & Reset */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">
              Y:{Math.round(orbitSettings.yaw)}° P:{Math.round(orbitSettings.pitch)}°
            </span>

            <button
              onClick={() => handleUpdateOrbit({ distance: Math.max(0.4, orbitSettings.distance - 0.1) })}
              className="p-1 rounded-lg bg-[#161922] hover:bg-[#1F2430] text-slate-300 hover:text-white text-xs border border-white/5"
              title={lang === 'ar' ? 'تقريب 3D' : 'Zoom In'}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateOrbit({ distance: Math.min(2.5, orbitSettings.distance + 0.1) })}
              className="p-1 rounded-lg bg-[#161922] hover:bg-[#1F2430] text-slate-300 hover:text-white text-xs border border-white/5"
              title={lang === 'ar' ? 'إبعاد 3D' : 'Zoom Out'}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateOrbit({ pitch: -25, yaw: 35, distance: 0.85, panX: 0, panY: 0 })}
              className="p-1.5 rounded-lg bg-[#161922] hover:bg-amber-950/60 text-slate-400 hover:text-amber-400 text-xs border border-white/5 transition-colors"
              title={lang === 'ar' ? 'إعادة ضبط زاوية الرؤية' : 'Reset 3D Orbit'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Switch back to 1st Person */}
            <button
              onClick={() => handleSetViewMode('first_person')}
              className="px-2.5 py-1 rounded-lg bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] text-xs font-bold flex items-center gap-1 transition-colors shadow-lg cursor-pointer"
              title={lang === 'ar' ? 'الرجوع للمنظور الأول (عدسة الكاميرا)' : 'Return to First-Person View'}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'العدسة' : 'Lens'}</span>
            </button>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const CanvasViewport = React.memo(CanvasViewportBase);
