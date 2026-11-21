import * as THREE from 'three';
import {
  EvaluatedCameraState,
  Layer,
  ProjectSettings,
} from '../types';

export interface WebGL3DLayerInput {
  layer: Layer;
  stackIndex: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  opacity: number;
  anchorX: number;
  anchorY: number;
  contentWidth: number;
  contentHeight: number;
  textureScale?: number;
  isDynamic: boolean;
  dynamicKey?: string;
  contentSignature: string;
  drawContent: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

interface CachedLayerNode {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  geometry: THREE.PlaneGeometry;
  baseUvArray: Float32Array;
  lastU0: number;
  lastV0: number;
  lastU1: number;
  lastV1: number;
  mesh: THREE.Mesh;
  pivot: THREE.Group;
  lastWidth: number;
  lastHeight: number;
  lastSignature: string;
  lastDynamicKey: string;
  hasDrawnOnce: boolean;
}

const MAX_Z_BUFFER_DEPTH = 450000;

const _unitZ = new THREE.Vector3(0, 0, 1);
const _unitX = new THREE.Vector3(1, 0, 0);
const _unitY = new THREE.Vector3(0, 1, 0);
const _camQuat = new THREE.Quaternion();
const _invCamQuat = new THREE.Quaternion();
const _itemEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _itemQuat = new THREE.Quaternion();
const _relQuat = new THREE.Quaternion();
const _effRelQuat = new THREE.Quaternion();
const _camPos = new THREE.Vector3();
const _localPos = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _axVec = new THREE.Vector3();
const _ayVec = new THREE.Vector3();

/**
 * Hardware Z-Buffered 3D Scene Compositor powered by Three.js.
 * Renders 3D-transformed layers with true per-pixel Z-buffering so tilted/overlapping
 * layers physically intersect and penetrate each other smoothly without popping, clipping,
 * direction reversal, or extreme-zoom UV distortion.
 */
export class WebGL3DCompositor {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private layerNodes: Map<string, CachedLayerNode> = new Map();
  private supported: boolean = false;
  private isSoftwareGl: boolean = false;
  private currentWidth: number = 0;
  private currentHeight: number = 0;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 6, 500000);
    this.initRenderer();
  }

  private initRenderer(): void {
    if (typeof document === 'undefined') return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;

      const testGl =
        canvas.getContext('webgl2', { alpha: true, depth: true }) ||
        canvas.getContext('webgl', { alpha: true, depth: true });

      if (!testGl) {
        this.supported = false;
        return;
      }

      let rendererString = '';
      try {
        const dbgInfo = testGl.getExtension('WEBGL_debug_renderer_info');
        if (dbgInfo) {
          rendererString = String(testGl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || '');
        } else {
          rendererString = String(testGl.getParameter(testGl.RENDERER) || '');
        }
      } catch {
        rendererString = '';
      }

      this.isSoftwareGl = /swiftshader|llvmpipe|softpipe|microsoft basic render/i.test(rendererString);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !this.isSoftwareGl,
        depth: true,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      renderer.sortObjects = true;

      this.canvas = canvas;
      this.renderer = renderer;
      this.supported = true;
    } catch {
      this.supported = false;
      this.renderer = null;
      this.canvas = null;
    }
  }

  public isSupported(): boolean {
    return this.supported && this.renderer !== null && this.canvas !== null;
  }

  public pruneUnusedLayers(activeLayerIds: Set<string>): void {
    for (const [id, node] of this.layerNodes.entries()) {
      if (!activeLayerIds.has(id)) {
        this.scene.remove(node.pivot);
        node.geometry.dispose();
        node.texture.dispose();
        node.material.dispose();
        this.layerNodes.delete(id);
      }
    }
  }

  private getOrCreateLayerNode(layerId: string): CachedLayerNode {
    const existing = this.layerNodes.get(layerId);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d')!;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      alphaTest: 0.04,
      depthTest: true,
      depthWrite: true,
      toneMapped: false,
    });

    // 8x8 subdivided plane gives distortion-free bilinear perspective interpolation on 3D tilts
    const geometry = new THREE.PlaneGeometry(1, 1, 8, 8);
    const uvAttr = geometry.attributes.uv as THREE.BufferAttribute;
    const baseUvArray = new Float32Array(uvAttr.array as Float32Array);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;

    const pivot = new THREE.Group();
    pivot.add(mesh);

    const node: CachedLayerNode = {
      canvas,
      ctx,
      texture,
      material,
      geometry,
      baseUvArray,
      lastU0: 0,
      lastV0: 0,
      lastU1: 1,
      lastV1: 1,
      mesh,
      pivot,
      lastWidth: 0,
      lastHeight: 0,
      lastSignature: '',
      lastDynamicKey: '',
      hasDrawnOnce: false,
    };

    this.layerNodes.set(layerId, node);
    return node;
  }

  private setNodeUvWindow(node: CachedLayerNode, u0: number, v0: number, u1: number, v1: number): void {
    if (
      Math.abs(node.lastU0 - u0) < 1e-9 &&
      Math.abs(node.lastV0 - v0) < 1e-9 &&
      Math.abs(node.lastU1 - u1) < 1e-9 &&
      Math.abs(node.lastV1 - v1) < 1e-9
    ) {
      return;
    }

    const uvAttr = node.geometry.attributes.uv as THREE.BufferAttribute;
    const arr = uvAttr.array as Float32Array;
    const base = node.baseUvArray;
    const du = u1 - u0;
    const dv = v1 - v0;

    for (let i = 0; i < arr.length; i += 2) {
      arr[i] = u0 + base[i] * du;
      arr[i + 1] = v0 + base[i + 1] * dv;
    }

    uvAttr.needsUpdate = true;
    node.lastU0 = u0;
    node.lastV0 = v0;
    node.lastU1 = u1;
    node.lastV1 = v1;
  }

  /**
   * Renders a batch of 3D layers into an offscreen WebGL canvas using true per-pixel
   * Z-buffering and returns the canvas ready to composite onto the 2D target context.
   */
  public renderBatch(
    items: WebGL3DLayerInput[],
    settings: ProjectSettings,
    cameraState: EvaluatedCameraState,
    pixelWidth: number,
    pixelHeight: number
  ): HTMLCanvasElement | null {
    if (!this.isSupported() || !this.renderer || !this.canvas || items.length === 0) {
      return null;
    }

    const renderW = Math.max(2, Math.round(pixelWidth));
    const renderH = Math.max(2, Math.round(pixelHeight));

    if (this.currentWidth !== renderW || this.currentHeight !== renderH) {
      this.currentWidth = renderW;
      this.currentHeight = renderH;
      this.renderer.setSize(renderW, renderH, false);
    }

    const W = settings.width || 720;
    const H = settings.height || 1280;
    const cx = W / 2;
    const cy = H / 2;

    const use3DCamera = cameraState.active && cameraState.type === '3d';
    const use2DCamera = cameraState.active && cameraState.type === '2d';
    const baseFov = use3DCamera ? (cameraState.fov || 1000) : 1000;
    const camZoom = cameraState.active ? Math.max(0.01, cameraState.zoom || 1) : 1;
    const effectiveFocal = baseFov * camZoom;

    // Vertical FOV matching exact Canvas2D pinhole scale at z = 0: tan(vfov/2) = (H/2) / (fov * zoom)
    const vFovRad = 2 * Math.atan(H / 2 / Math.max(10, effectiveFocal));
    const vFovDeg = THREE.MathUtils.radToDeg(vFovRad);

    // Position and orient camera to match interpolator.ts 1:1
    const camPosX = cameraState.active ? cameraState.position.x - cx : 0;
    const camPosY = cameraState.active ? -(cameraState.position.y - cy) : 0;
    const camPosZ = use3DCamera ? (cameraState.position.z + baseFov) : baseFov;

    this.camera.fov = Math.max(0.1, Math.min(179, vFovDeg));
    this.camera.aspect = W / H;
    this.camera.position.set(camPosX, camPosY, camPosZ);

    if (use3DCamera) {
      this.camera.rotation.set(
        THREE.MathUtils.degToRad(cameraState.rotation.x),
        THREE.MathUtils.degToRad(-cameraState.rotation.y),
        THREE.MathUtils.degToRad(-cameraState.rotation.z),
        'YXZ'
      );
    } else if (use2DCamera) {
      this.camera.rotation.set(
        0,
        0,
        THREE.MathUtils.degToRad(-cameraState.rotation.z),
        'YXZ'
      );
    } else {
      this.camera.rotation.set(0, 0, 0, 'YXZ');
    }

    this.camera.updateMatrixWorld(true);
    _camPos.set(camPosX, camPosY, camPosZ);
    _camQuat.setFromEuler(this.camera.rotation);
    _invCamQuat.copy(_camQuat).invert();

    // Clear scene children without disposing cached geometries/textures
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    let maxDepthDist = 2000;

    const prepared: Array<{
      node: CachedLayerNode;
      viewDist: number;
      isSemiTransparent: boolean;
      stackIndex: number;
    }> = [];

    for (const item of items) {
      const opacity = Math.max(0, Math.min(1, item.opacity));
      if (opacity <= 0.001) continue;

      const node = this.getOrCreateLayerNode(item.layer.id);
      const cw = Math.max(2, Math.ceil(item.contentWidth));
      const ch = Math.max(2, Math.ceil(item.contentHeight));
      const texScale = item.textureScale && item.textureScale > 0 && item.textureScale < 1 ? item.textureScale : 1;
      const texW = Math.max(2, Math.ceil(cw * texScale));
      const texH = Math.max(2, Math.ceil(ch * texScale));

      const sizeChanged = node.lastWidth !== texW || node.lastHeight !== texH;
      const sigChanged = node.lastSignature !== item.contentSignature;

      if (sizeChanged) {
        node.canvas.width = texW;
        node.canvas.height = texH;
        node.lastWidth = texW;
        node.lastHeight = texH;
        if (node.hasDrawnOnce) {
          node.texture.dispose();
          const newTex = new THREE.CanvasTexture(node.canvas);
          newTex.colorSpace = THREE.SRGBColorSpace;
          newTex.minFilter = THREE.LinearFilter;
          newTex.magFilter = THREE.LinearFilter;
          newTex.generateMipmaps = false;
          newTex.wrapS = THREE.ClampToEdgeWrapping;
          newTex.wrapT = THREE.ClampToEdgeWrapping;
          node.texture = newTex;
          node.material.map = newTex;
          node.material.needsUpdate = true;
        }
      }

      const dynamicNeedsRedraw =
        item.isDynamic &&
        (item.dynamicKey === undefined || node.lastDynamicKey !== item.dynamicKey);

      if (dynamicNeedsRedraw || sizeChanged || sigChanged || !node.hasDrawnOnce) {
        node.ctx.clearRect(0, 0, texW, texH);
        item.drawContent(node.canvas, node.ctx, texW, texH);
        node.texture.needsUpdate = true;
        node.lastSignature = item.contentSignature;
        node.lastDynamicKey = item.dynamicKey ?? '';
        node.hasDrawnOnce = true;
      }

      // World transform in Three.js space (+X right, +Y up, +Z toward viewer)
      const tieEpsilon = item.stackIndex * 0.02;
      const wx = item.worldX - cx;
      const wy = -(item.worldY - cy);
      const wz = item.worldZ + tieEpsilon;

      let sx = item.scaleX;
      let sy = item.scaleY;
      const sz = item.scaleZ;

      // Convert layer world position & orientation into camera-local space (-Z is forward view)
      _localPos.set(wx - camPosX, wy - camPosY, wz - camPosZ).applyQuaternion(_invCamQuat);
      const viewDist = -_localPos.z;

      _itemEuler.set(
        THREE.MathUtils.degToRad(-item.rotationX),
        THREE.MathUtils.degToRad(item.rotationY),
        THREE.MathUtils.degToRad(-item.rotationZ),
        'YXZ'
      );
      _itemQuat.setFromEuler(_itemEuler);
      _relQuat.copy(_invCamQuat).multiply(_itemQuat);

      // True camera-space depth placement so layers zoom cleanly right up to and pierce through the camera lens
      let mappedDist = viewDist;
      if (viewDist > MAX_Z_BUFFER_DEPTH) {
        const desiredPersp = baseFov / viewDist;
        const t = (viewDist - MAX_Z_BUFFER_DEPTH) / 500000;
        mappedDist = MAX_Z_BUFFER_DEPTH + 10000 * (1 - Math.exp(-t));
        const pinholePersp = baseFov / mappedDist;
        const scaleComp = desiredPersp / Math.max(1e-9, pinholePersp);

        _localPos.x *= scaleComp;
        _localPos.y *= scaleComp;
        _localPos.z = -mappedDist;
        sx *= scaleComp;
        sy *= scaleComp;
      }

      _axVec.copy(_unitX).applyQuaternion(_relQuat);
      _ayVec.copy(_unitY).applyQuaternion(_relQuat);

      const maxZExtent =
        Math.abs(item.anchorX * sx * _axVec.z) +
        Math.abs(item.anchorY * sy * _ayVec.z) +
        0.5 * cw * Math.abs(sx * _axVec.z) +
        0.5 * ch * Math.abs(sy * _ayVec.z);

      const NEAR_CLIP = 6;
      // Once every corner of the layer has pierced behind camera.near, cull cleanly behind the camera
      if (mappedDist + maxZExtent <= NEAR_CLIP) {
        continue;
      }

      _effRelQuat.copy(_relQuat);

      const isNearlyScreenParallel = Math.abs(_axVec.z) < 0.02 && Math.abs(_ayVec.z) < 0.02;
      const projToCanvas = effectiveFocal / Math.max(NEAR_CLIP, mappedDist);
      const quadW = cw * sx;
      const quadH = ch * sy;
      const screenW = Math.abs(quadW) * projToCanvas;
      const screenH = Math.abs(quadH) * projToCanvas;
      const maxScreenThreshold = Math.max(W, H) * 4;

      if (isNearlyScreenParallel && mappedDist > NEAR_CLIP && Math.max(screenW, screenH) > maxScreenThreshold) {
        // Extreme zoom UV-window cropping in 64-bit JS floats:
        // Keeps WebGL quad vertices within viewport scale while magnifying UVs infinitely
        // with zero float32 shearing, zero triangle discard, and exact Z-buffer ordering.
        const axLen = Math.hypot(_axVec.x, _axVec.y) || 1;
        const ayLen = Math.hypot(_ayVec.x, _ayVec.y) || 1;
        const ux = _axVec.x / axLen;
        const uy = _axVec.y / axLen;
        const vx = _ayVec.x / ayLen;
        const vy = _ayVec.y / ayLen;

        const qx = _localPos.x + (-item.anchorX * sx) * ux + (item.anchorY * sy) * vx;
        const qy = _localPos.y + (-item.anchorX * sx) * uy + (item.anchorY * sy) * vy;

        const visHalf = (Math.hypot(W, H) * 0.75) / Math.max(1e-9, projToCanvas);
        const centerLocalX = -qx * ux - qy * uy;
        const centerLocalY = -qx * vx - qy * vy;

        const absQuadW = Math.abs(quadW);
        const absQuadH = Math.abs(quadH);
        const signX = quadW < 0 ? -1 : 1;
        const signY = quadH < 0 ? -1 : 1;

        const xMin = Math.max(-absQuadW * 0.5, centerLocalX - visHalf);
        const xMax = Math.min(absQuadW * 0.5, centerLocalX + visHalf);
        const yMin = Math.max(-absQuadH * 0.5, centerLocalY - visHalf);
        const yMax = Math.min(absQuadH * 0.5, centerLocalY + visHalf);

        if (xMax <= xMin || yMax <= yMin) {
          // Completely outside viewport frustum
          continue;
        }

        const subCenterX = (xMin + xMax) * 0.5;
        const subCenterY = (yMin + yMax) * 0.5;
        const cropLocalX = qx + ux * subCenterX + vx * subCenterY;
        const cropLocalY = qy + uy * subCenterX + vy * subCenterY;

        let u0 = (xMin + absQuadW * 0.5) / absQuadW;
        let u1 = (xMax + absQuadW * 0.5) / absQuadW;
        let v0 = (yMin + absQuadH * 0.5) / absQuadH;
        let v1 = (yMax + absQuadH * 0.5) / absQuadH;
        if (signX < 0) {
          const tu0 = 1 - u1;
          const tu1 = 1 - u0;
          u0 = tu0;
          u1 = tu1;
        }
        if (signY < 0) {
          const tv0 = 1 - v1;
          const tv1 = 1 - v0;
          v0 = tv0;
          v1 = tv1;
        }

        this.setNodeUvWindow(node, u0, v0, u1, v1);

        _worldPos.set(cropLocalX, cropLocalY, _localPos.z).applyQuaternion(_camQuat).add(_camPos);
        node.pivot.position.copy(_worldPos);
        node.pivot.quaternion.copy(_camQuat).multiply(_effRelQuat);
        node.pivot.scale.set(1, 1, 1);

        node.mesh.position.set(0, 0, 0);
        node.mesh.scale.set(xMax - xMin, yMax - yMin, 1);

        maxDepthDist = Math.max(maxDepthDist, mappedDist + visHalf * 2);
      } else {
        this.setNodeUvWindow(node, 0, 0, 1, 1);

        _worldPos.copy(_localPos).applyQuaternion(_camQuat).add(_camPos);
        node.pivot.position.copy(_worldPos);
        node.pivot.quaternion.copy(_camQuat).multiply(_effRelQuat);
        node.pivot.scale.set(sx, sy, sz);

        // Local offset for Anchor Point (-anchorX, +anchorY because Three.js +Y is up)
        node.mesh.position.set(-item.anchorX, item.anchorY, 0);
        node.mesh.scale.set(cw, ch, 1);

        const layerDiag = Math.hypot(quadW, quadH) * 0.5;
        maxDepthDist = Math.max(maxDepthDist, Math.min(MAX_Z_BUFFER_DEPTH + 12000, Math.max(0, mappedDist)) + Math.min(layerDiag, 250000));
      }

      const isSemiTransparent = opacity < 0.985;
      node.material.opacity = opacity;
      node.material.depthTest = true;
      node.material.depthWrite = !isSemiTransparent;
      node.material.alphaTest = isSemiTransparent ? 0.01 : 0.04;

      this.scene.add(node.pivot);
      prepared.push({
        node,
        viewDist,
        isSemiTransparent,
        stackIndex: item.stackIndex,
      });
    }

    if (prepared.length === 0) return null;

    // Sort back-to-front for clean anti-aliased fringe blending & semi-transparent passes,
    // while opaque pixels use the hardware Z-buffer for exact per-pixel 3D intersection.
    prepared.sort((a, b) => {
      if (a.isSemiTransparent !== b.isSemiTransparent) {
        return a.isSemiTransparent ? 1 : -1;
      }
      const distDiff = b.viewDist - a.viewDist;
      if (Math.abs(distDiff) > 0.05) return distDiff;
      return a.stackIndex - b.stackIndex;
    });

    prepared.forEach((p, idx) => {
      p.node.mesh.renderOrder = idx;
    });

    this.camera.near = 6;
    this.camera.far = Math.max(500000, maxDepthDist * 1.5);
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
    return this.canvas;
  }

  public dispose(): void {
    for (const node of this.layerNodes.values()) {
      this.scene.remove(node.pivot);
      node.geometry.dispose();
      node.texture.dispose();
      node.material.dispose();
    }
    this.layerNodes.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.canvas = null;
    this.supported = false;
  }
}
