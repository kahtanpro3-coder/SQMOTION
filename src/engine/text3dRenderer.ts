import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer, Mesh3DConfig, Mesh3DMaterial, ProjectSettings, EvaluatedCameraState } from '../types';

interface ContourPoint {
  x: number;
  y: number;
}

interface CachedTextGeometryEntry {
  geometry: THREE.ExtrudeGeometry;
  widthPx: number;
  heightPx: number;
  depthPx: number;
}

const GEOMETRY_CACHE_MAX = 32;
const textGeometryCache = new Map<string, CachedTextGeometryEntry>();

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;
let sharedEnvMap: THREE.Texture | null = null;

function getShared3DTextRenderer(width: number, height: number): {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  envMap: THREE.Texture | null;
} | null {
  if (typeof document === 'undefined') return null;

  if (!sharedRenderer || !sharedCanvas) {
    try {
      sharedCanvas = document.createElement('canvas');
      sharedCanvas.width = Math.max(2, width);
      sharedCanvas.height = Math.max(2, height);

      sharedRenderer = new THREE.WebGLRenderer({
        canvas: sharedCanvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
      sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      sharedRenderer.toneMappingExposure = 1.15;
      sharedRenderer.shadowMap.enabled = true;
      sharedRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
      sharedRenderer.setClearColor(0x000000, 0);

      try {
        const pmrem = new THREE.PMREMGenerator(sharedRenderer);
        const envScene = new RoomEnvironment();
        sharedEnvMap = pmrem.fromScene(envScene, 0.04).texture;
        envScene.dispose();
        pmrem.dispose();
      } catch {
        sharedEnvMap = null;
      }
    } catch {
      sharedRenderer = null;
      sharedCanvas = null;
      return null;
    }
  }

  const rw = Math.max(2, Math.round(width));
  const rh = Math.max(2, Math.round(height));
  if (sharedCanvas.width !== rw || sharedCanvas.height !== rh) {
    sharedRenderer.setSize(rw, rh, false);
  }

  return {
    renderer: sharedRenderer,
    canvas: sharedCanvas,
    envMap: sharedEnvMap,
  };
}

/**
 * Signed polygon area (positive => CCW in canvas Y-down coords)
 */
function polygonSignedArea(pts: ContourPoint[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

/**
 * Point-in-polygon test (ray casting)
 */
function isPointInPolygon(pt: ContourPoint, poly: ContourPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function perpDistance(p: ContourPoint, a: ContourPoint, b: ContourPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq);
}

function simplifyClosedPolygon(pts: ContourPoint[], epsilon: number): ContourPoint[] {
  if (pts.length <= 4) return pts;

  const rdp = (arr: ContourPoint[], start: number, end: number, keep: Uint8Array) => {
    let maxDist = 0;
    let index = -1;
    const a = arr[start];
    const b = arr[end];
    for (let i = start + 1; i < end; i++) {
      const d = perpDistance(arr[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilon && index !== -1) {
      keep[index] = 1;
      rdp(arr, start, index, keep);
      rdp(arr, index, end, keep);
    }
  };

  const extended = [...pts, pts[0]];
  const keep = new Uint8Array(extended.length);
  keep[0] = 1;
  keep[extended.length - 1] = 1;
  rdp(extended, 0, extended.length - 1, keep);

  const out: ContourPoint[] = [];
  for (let i = 0; i < extended.length - 1; i++) {
    if (keep[i]) out.push(extended[i]);
  }
  return out.length >= 3 ? out : pts;
}

/**
 * Sub-pixel Marching Squares contour extractor on an RGBA canvas alpha channel.
 * Preserves connected Arabic ligatures, diacritics, and Unicode shapes cleanly.
 */
function extractContoursFromAlpha(
  alphaData: Uint8ClampedArray,
  w: number,
  h: number,
  threshold: number = 115
): ContourPoint[][] {
  const sample = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return alphaData[(y * w + x) * 4 + 3];
  };

  const interp = (aVal: number, bVal: number): number => {
    const diff = bVal - aVal;
    if (Math.abs(diff) < 1e-4) return 0.5;
    return Math.max(0.02, Math.min(0.98, (threshold - aVal) / diff));
  };

  interface Segment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  const segments: Segment[] = [];

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a0 = sample(x, y);
      const a1 = sample(x + 1, y);
      const a2 = sample(x + 1, y + 1);
      const a3 = sample(x, y + 1);

      const b0 = a0 >= threshold ? 8 : 0;
      const b1 = a1 >= threshold ? 4 : 0;
      const b2 = a2 >= threshold ? 2 : 0;
      const b3 = a3 >= threshold ? 1 : 0;
      const idx = b0 | b1 | b2 | b3;

      if (idx === 0 || idx === 15) continue;

      const top: ContourPoint = { x: x + interp(a0, a1), y };
      const right: ContourPoint = { x: x + 1, y: y + interp(a1, a2) };
      const bottom: ContourPoint = { x: x + interp(a3, a2), y: y + 1 };
      const left: ContourPoint = { x, y: y + interp(a0, a3) };

      const pushSeg = (p: ContourPoint, q: ContourPoint) => {
        segments.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });
      };

      switch (idx) {
        case 1:
          pushSeg(left, bottom);
          break;
        case 2:
          pushSeg(bottom, right);
          break;
        case 3:
          pushSeg(left, right);
          break;
        case 4:
          pushSeg(top, right);
          break;
        case 5: {
          const avg = (a0 + a1 + a2 + a3) * 0.25;
          if (avg >= threshold) {
            pushSeg(left, top);
            pushSeg(bottom, right);
          } else {
            pushSeg(left, bottom);
            pushSeg(top, right);
          }
          break;
        }
        case 6:
          pushSeg(top, bottom);
          break;
        case 7:
          pushSeg(left, top);
          break;
        case 8:
          pushSeg(left, top);
          break;
        case 9:
          pushSeg(top, bottom);
          break;
        case 10: {
          const avg = (a0 + a1 + a2 + a3) * 0.25;
          if (avg >= threshold) {
            pushSeg(left, bottom);
            pushSeg(top, right);
          } else {
            pushSeg(left, top);
            pushSeg(bottom, right);
          }
          break;
        }
        case 11:
          pushSeg(top, right);
          break;
        case 12:
          pushSeg(left, right);
          break;
        case 13:
          pushSeg(bottom, right);
          break;
        case 14:
          pushSeg(left, bottom);
          break;
      }
    }
  }

  // Chain segments into closed loops using quantized endpoint buckets
  const keyOf = (x: number, y: number) => `${Math.round(x * 100)}_${Math.round(y * 100)}`;
  const adj = new Map<string, number[]>();

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const k1 = keyOf(s.x1, s.y1);
    const k2 = keyOf(s.x2, s.y2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push(i);
    adj.get(k2)!.push(i);
  }

  const used = new Uint8Array(segments.length);
  const loops: ContourPoint[][] = [];

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;

    const first = segments[i];
    const loop: ContourPoint[] = [
      { x: first.x1, y: first.y1 },
      { x: first.x2, y: first.y2 },
    ];
    const startKey = keyOf(first.x1, first.y1);
    let curKey = keyOf(first.x2, first.y2);
    let guard = 0;

    while (curKey !== startKey && guard < segments.length + 4) {
      guard++;
      const neighbors = adj.get(curKey);
      if (!neighbors) break;

      let nextIdx = -1;
      for (const cand of neighbors) {
        if (!used[cand]) {
          nextIdx = cand;
          break;
        }
      }
      if (nextIdx === -1) break;

      used[nextIdx] = 1;
      const seg = segments[nextIdx];
      const k1 = keyOf(seg.x1, seg.y1);
      if (k1 === curKey) {
        loop.push({ x: seg.x2, y: seg.y2 });
        curKey = keyOf(seg.x2, seg.y2);
      } else {
        loop.push({ x: seg.x1, y: seg.y1 });
        curKey = k1;
      }
    }

    if (loop.length >= 4) {
      // Drop duplicate closing vertex if coincident
      const firstPt = loop[0];
      const lastPt = loop[loop.length - 1];
      if (Math.hypot(firstPt.x - lastPt.x, firstPt.y - lastPt.y) < 0.05) {
        loop.pop();
      }
      if (loop.length >= 3) {
        loops.push(loop);
      }
    }
  }

  return loops;
}

/**
 * Rasterizes the text crisp at high resolution and builds true 3D Three.js ExtrudeGeometry.
 * Supports Arabic RTL shaping, multi-line text, letter spacing, holes, and bevels.
 */
function build3DTextGeometry(layer: Layer, meshConfig: Mesh3DConfig): CachedTextGeometryEntry | null {
  const tc = layer.textConfig;
  if (!tc || !tc.text) return null;

  const fontSize = Math.max(12, tc.fontSize || 54);
  const fontFamily = tc.fontFamily || 'Cairo';
  const letterSpacing = tc.letterSpacing || 0;
  const lineHeightMul = tc.lineHeight || 1.2;
  const align = tc.align || 'center';
  const depth = Math.max(4, meshConfig.depth ?? 45);
  const bevel = Math.max(0, Math.min(18, meshConfig.bevel ?? 5));

  const cacheKey = [
    tc.text,
    fontFamily,
    fontSize,
    letterSpacing,
    lineHeightMul,
    align,
    depth,
    bevel,
  ].join('|');

  const cached = textGeometryCache.get(cacheKey);
  if (cached) {
    textGeometryCache.delete(cacheKey);
    textGeometryCache.set(cacheKey, cached);
    return cached;
  }

  const lines = tc.text.split('\n');
  const rasterScale = Math.max(1.5, Math.min(3.5, 160 / fontSize));
  const scaledFontSize = fontSize * rasterScale;
  const scaledLineHeight = scaledFontSize * lineHeightMul;
  const scaledLetterSpacing = letterSpacing * rasterScale;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  const fontSpec = `900 ${scaledFontSize}px "${fontFamily}", "Cairo", sans-serif`;
  measureCtx.font = fontSpec;
  (measureCtx as any).letterSpacing = `${scaledLetterSpacing}px`;

  let maxLineW = 40;
  for (const line of lines) {
    const m = measureCtx.measureText(line || ' ');
    maxLineW = Math.max(maxLineW, m.width);
  }

  const pad = Math.ceil(scaledFontSize * 0.45 + 18);
  const canvasW = Math.min(1600, Math.max(64, Math.ceil(maxLineW + pad * 2)));
  const canvasH = Math.min(900, Math.max(64, Math.ceil(lines.length * scaledLineHeight + pad * 2)));

  const textCanvas = document.createElement('canvas');
  textCanvas.width = canvasW;
  textCanvas.height = canvasH;
  const tCtx = textCanvas.getContext('2d', { willReadFrequently: true })!;
  tCtx.clearRect(0, 0, canvasW, canvasH);
  tCtx.font = fontSpec;
  (tCtx as any).letterSpacing = `${scaledLetterSpacing}px`;
  tCtx.fillStyle = '#FFFFFF';
  tCtx.textBaseline = 'middle';
  tCtx.textAlign = align;

  const drawX =
    align === 'left'
      ? pad
      : align === 'right'
      ? canvasW - pad
      : canvasW * 0.5;
  const startY = canvasH * 0.5 - ((lines.length - 1) * scaledLineHeight) * 0.5;

  lines.forEach((line, idx) => {
    tCtx.fillText(line, drawX, startY + idx * scaledLineHeight);
  });

  const imgData = tCtx.getImageData(0, 0, canvasW, canvasH);
  const rawLoops = extractContoursFromAlpha(imgData.data, canvasW, canvasH, 112);

  if (rawLoops.length === 0) {
    return null;
  }

  interface RingInfo {
    pts: ContourPoint[]; // in project-pixel Y-up coordinates centered around (0,0)
    absArea: number;
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    parentIdx: number;
    depth: number;
  }

  const halfCW = canvasW * 0.5;
  const halfCH = canvasH * 0.5;
  const invScale = 1 / rasterScale;

  const rings: RingInfo[] = [];
  for (const rawLoop of rawLoops) {
    const simplified = simplifyClosedPolygon(rawLoop, 0.55);
    if (simplified.length < 3) continue;

    // Convert to project pixels with Y flipped up and centered at (0,0)
    const pts: ContourPoint[] = simplified.map((p) => ({
      x: (p.x - halfCW) * invScale,
      y: -(p.y - halfCH) * invScale,
    }));

    const area = Math.abs(polygonSignedArea(pts));
    if (area < 3.5) continue; // ignore microscopic subpixel specks

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    rings.push({ pts, absArea: area, bbox: { minX, minY, maxX, maxY }, parentIdx: -1, depth: 0 });
  }

  if (rings.length === 0) return null;

  // Sort largest area first so enclosing rings always precede enclosed rings
  rings.sort((a, b) => b.absArea - a.absArea);

  for (let i = 0; i < rings.length; i++) {
    const testPt = rings[i].pts[0];
    let depthCount = 0;
    let immediateParent = -1;

    for (let j = i - 1; j >= 0; j--) {
      const outer = rings[j];
      if (
        testPt.x < outer.bbox.minX ||
        testPt.x > outer.bbox.maxX ||
        testPt.y < outer.bbox.minY ||
        testPt.y > outer.bbox.maxY
      ) {
        continue;
      }
      if (isPointInPolygon(testPt, outer.pts)) {
        depthCount++;
        if (immediateParent === -1) {
          immediateParent = j;
        }
      }
    }

    rings[i].depth = depthCount;
    rings[i].parentIdx = immediateParent;
  }

  const shapesMap = new Map<number, THREE.Shape>();

  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (ring.depth % 2 === 0) {
      // Outer solid shape: ensure CCW in Y-up coordinates (positive signed area)
      const ordered = polygonSignedArea(ring.pts) < 0 ? [...ring.pts].reverse() : ring.pts;
      const shape = new THREE.Shape();
      shape.moveTo(ordered[0].x, ordered[0].y);
      for (let k = 1; k < ordered.length; k++) {
        shape.lineTo(ordered[k].x, ordered[k].y);
      }
      shape.closePath();
      shapesMap.set(i, shape);
    } else if (ring.parentIdx !== -1) {
      // Hole inside outer shape: ensure CW in Y-up coordinates (negative signed area)
      const parentShape = shapesMap.get(ring.parentIdx);
      if (parentShape) {
        const ordered = polygonSignedArea(ring.pts) > 0 ? [...ring.pts].reverse() : ring.pts;
        const hole = new THREE.Path();
        hole.moveTo(ordered[0].x, ordered[0].y);
        for (let k = 1; k < ordered.length; k++) {
          hole.lineTo(ordered[k].x, ordered[k].y);
        }
        hole.closePath();
        parentShape.holes.push(hole);
      }
    }
  }

  const shapes = Array.from(shapesMap.values());
  if (shapes.length === 0) return null;

  const bevelThickness = bevel > 0 ? Math.min(depth * 0.42, bevel * 0.85) : 0;
  const bevelSize = bevel > 0 ? Math.min(fontSize * 0.085, bevel * 0.55) : 0;
  const coreDepth = Math.max(2, depth - bevelThickness * 1.4);

  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: coreDepth,
    bevelEnabled: bevel > 0,
    bevelThickness,
    bevelSize,
    bevelOffset: 0,
    bevelSegments: 4,
    curveSegments: 8,
  });

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const sizeVec = new THREE.Vector3();
  const centerVec = new THREE.Vector3();
  bbox.getSize(sizeVec);
  bbox.getCenter(centerVec);

  // Center the 3D text geometry right on (0, 0, 0) for true stationary 3D rotation
  geometry.translate(-centerVec.x, -centerVec.y, -centerVec.z);
  geometry.computeVertexNormals();

  const entry: CachedTextGeometryEntry = {
    geometry,
    widthPx: Math.max(40, sizeVec.x),
    heightPx: Math.max(24, sizeVec.y),
    depthPx: Math.max(4, sizeVec.z),
  };

  if (textGeometryCache.size >= GEOMETRY_CACHE_MAX) {
    const oldestKey = textGeometryCache.keys().next().value;
    if (oldestKey !== undefined) {
      const oldest = textGeometryCache.get(oldestKey);
      oldest?.geometry.dispose();
      textGeometryCache.delete(oldestKey);
    }
  }
  textGeometryCache.set(cacheKey, entry);

  return entry;
}

function create3DTextMaterials(
  layer: Layer,
  meshConfig: Mesh3DConfig,
  hasEnvMap: boolean
): [THREE.Material, THREE.Material] {
  const matType: Mesh3DMaterial = meshConfig.material || 'gold';
  const wireframe = Boolean(meshConfig.wireframe);
  const envIntensity = hasEnvMap ? Math.max(0.4, (meshConfig.specular ?? 1.2) * 0.95) : 0.4;

  if (matType === 'gold') {
    const roughness = meshConfig.roughness ?? 0.16;
    const metalness = meshConfig.metalness ?? 0.92;
    return [
      new THREE.MeshPhysicalMaterial({
        color: '#FDE047',
        metalness,
        roughness,
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
        envMapIntensity: envIntensity * 1.2,
        wireframe,
      }),
      new THREE.MeshStandardMaterial({
        color: meshConfig.sideColor || '#B45309',
        metalness: Math.min(1, metalness + 0.04),
        roughness: Math.min(1, roughness + 0.08),
        envMapIntensity: envIntensity,
        wireframe,
      }),
    ];
  }

  if (matType === 'chrome') {
    const roughness = meshConfig.roughness ?? 0.08;
    const metalness = meshConfig.metalness ?? 0.98;
    return [
      new THREE.MeshPhysicalMaterial({
        color: '#F8FAFC',
        metalness,
        roughness,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: envIntensity * 1.4,
        wireframe,
      }),
      new THREE.MeshStandardMaterial({
        color: meshConfig.sideColor || '#64748B',
        metalness: 0.95,
        roughness: Math.min(1, roughness + 0.14),
        envMapIntensity: envIntensity * 1.15,
        wireframe,
      }),
    ];
  }

  if (matType === 'neon') {
    const roughness = meshConfig.roughness ?? 0.15;
    return [
      new THREE.MeshPhysicalMaterial({
        color: layer.textConfig?.fill || '#E0F2FE',
        emissive: '#00E5FF',
        emissiveIntensity: 0.45,
        metalness: 0.35,
        roughness,
        clearcoat: 0.9,
        envMapIntensity: envIntensity,
        wireframe,
      }),
      new THREE.MeshStandardMaterial({
        color: meshConfig.sideColor || '#0284C7',
        emissive: '#00E5FF',
        emissiveIntensity: 0.95,
        metalness: 0.65,
        roughness: 0.18,
        envMapIntensity: envIntensity,
        wireframe,
      }),
    ];
  }

  if (matType === 'glass') {
    const roughness = meshConfig.roughness ?? 0.05;
    return [
      new THREE.MeshPhysicalMaterial({
        color: '#E0F2FE',
        metalness: 0.08,
        roughness,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        reflectivity: 1.0,
        transparent: true,
        opacity: 0.86,
        envMapIntensity: envIntensity * 1.5,
        wireframe,
      }),
      new THREE.MeshPhysicalMaterial({
        color: meshConfig.sideColor || '#38BDF8',
        metalness: 0.18,
        roughness: 0.1,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.92,
        envMapIntensity: envIntensity * 1.35,
        wireframe,
      }),
    ];
  }

  if (matType === 'dark') {
    const roughness = meshConfig.roughness ?? 0.25;
    const metalness = meshConfig.metalness ?? 0.88;
    return [
      new THREE.MeshPhysicalMaterial({
        color: '#334155',
        metalness,
        roughness,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        envMapIntensity: envIntensity,
        wireframe,
      }),
      new THREE.MeshStandardMaterial({
        color: meshConfig.sideColor || '#0F172A',
        metalness: 0.9,
        roughness: Math.min(1, roughness + 0.12),
        envMapIntensity: envIntensity,
        wireframe,
      }),
    ];
  }

  if (matType === 'white') {
    const roughness = meshConfig.roughness ?? 0.14;
    const metalness = meshConfig.metalness ?? 0.15;
    return [
      new THREE.MeshPhysicalMaterial({
        color: '#FFFFFF',
        metalness,
        roughness,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        envMapIntensity: envIntensity * 0.9,
        wireframe,
      }),
      new THREE.MeshStandardMaterial({
        color: meshConfig.sideColor || '#CBD5E1',
        metalness: 0.25,
        roughness: Math.min(1, roughness + 0.12),
        envMapIntensity: envIntensity * 0.85,
        wireframe,
      }),
    ];
  }

  // Custom / fallback using layer text fill
  const frontHex = layer.textConfig?.fill || '#FFFFFF';
  const sideHex = meshConfig.sideColor || layer.textConfig?.stroke || '#475569';
  return [
    new THREE.MeshPhysicalMaterial({
      color: frontHex,
      metalness: meshConfig.metalness ?? 0.45,
      roughness: meshConfig.roughness ?? 0.22,
      clearcoat: 0.6,
      envMapIntensity: envIntensity,
      wireframe,
    }),
    new THREE.MeshStandardMaterial({
      color: sideHex,
      metalness: Math.min(1, (meshConfig.metalness ?? 0.45) + 0.2),
      roughness: Math.min(1, (meshConfig.roughness ?? 0.22) + 0.12),
      envMapIntensity: envIntensity,
      wireframe,
    }),
  ];
}

/**
 * Renders a layer with genuine Three.js 3D Extruded Mesh geometry, PBR shading,
 * studio directional/IBL lighting, floor shadow, and exact 3D camera projection.
 * Returns true if rendered via Three.js, false if fallback is needed.
 */
export interface Text3DCameraSpace {
  worldX: number;
  worldY: number;
  worldZ: number;
  worldScaleX: number;
  worldScaleY: number;
  worldScaleZ: number;
  worldRotX: number;
  worldRotY: number;
  worldRotZ: number;
  camera: EvaluatedCameraState;
}

export function renderReal3DTextToCanvas(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  effWorldMat: {
    x: number;
    y: number;
    z: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    opacity: number;
  },
  anchorX: number,
  anchorY: number,
  settings: ProjectSettings,
  cameraSpace?: Text3DCameraSpace
): boolean {
  const meshConfig = layer.mesh3dConfig;
  if (!meshConfig || !meshConfig.enabled || layer.type !== 'text') return false;

  const built = build3DTextGeometry(layer, meshConfig);
  if (!built) return false;

  const targetW = settings.width || 720;
  const targetH = settings.height || 1280;
  const maxRenderDim = 1440;
  const downScale = Math.min(1, maxRenderDim / Math.max(targetW, targetH));
  const renderW = Math.max(2, Math.round(targetW * downScale));
  const renderH = Math.max(2, Math.round(targetH * downScale));

  const setup = getShared3DTextRenderer(renderW, renderH);
  if (!setup) return false;

  const { renderer, canvas, envMap } = setup;

  const scene = new THREE.Scene();
  if (envMap) {
    scene.environment = envMap;
  }

  // Lighting
  const ambientIntensity = meshConfig.ambientIntensity ?? 0.55;
  const diffuseIntensity = meshConfig.diffuseIntensity ?? 1.1;
  const specularBoost = meshConfig.specular ?? 1.25;
  const lightAngleRad = THREE.MathUtils.degToRad(meshConfig.lightAngle ?? 45);
  const lightElevRad = THREE.MathUtils.degToRad(meshConfig.lightElevation ?? 35);

  const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity * 1.1);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.55);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, diffuseIntensity * 1.65);
  const lightDist = 900;
  keyLight.position.set(
    effWorldMat.x - targetW * 0.5 + lightDist * Math.cos(lightAngleRad) * Math.cos(lightElevRad),
    -(effWorldMat.y - targetH * 0.5) + lightDist * Math.sin(lightElevRad),
    lightDist * Math.sin(lightAngleRad) * Math.cos(lightElevRad) + 400
  );
  keyLight.castShadow = meshConfig.castFloorShadow !== false;
  keyLight.shadow.mapSize.width = 512;
  keyLight.shadow.mapSize.height = 512;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.55 * specularBoost);
  fillLight.position.set(-600, 200, 400);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xfde68a, 0.45 * specularBoost);
  rimLight.position.set(450, -350, -350);
  scene.add(rimLight);

  // Build Mesh with [frontBack, sideBevel] materials
  const materials = create3DTextMaterials(layer, meshConfig, Boolean(envMap));
  const mesh = new THREE.Mesh(built.geometry, materials);
  mesh.castShadow = meshConfig.castFloorShadow !== false;
  mesh.receiveShadow = true;

  // Apply anchor offset cleanly around pivot
  mesh.position.set(-anchorX, anchorY, 0);

  const pivot = new THREE.Group();
  pivot.add(mesh);

  let shadowGeo: THREE.PlaneGeometry | null = null;
  let shadowMat: THREE.ShadowMaterial | null = null;
  let camera: THREE.PerspectiveCamera;

  if (cameraSpace) {
    const NEAR_CLIP = 4;
    const cx = targetW * 0.5;
    const cy = targetH * 0.5;
    const cam = cameraSpace.camera;
    const use3DCam = cam.active && cam.type === '3d';
    const use2DCam = cam.active && cam.type === '2d';
    const baseFov = use3DCam ? (cam.fov || 1000) : 1000;
    const camZoom = cam.active ? Math.max(0.01, cam.zoom || 1) : 1;
    const effectiveFocal = baseFov * camZoom;

    const camPosX = cam.active ? cam.position.x - cx : 0;
    const camPosY = cam.active ? -(cam.position.y - cy) : 0;
    const camPosZ = use3DCam ? cam.position.z + baseFov : baseFov;

    const camEuler = use3DCam
      ? new THREE.Euler(
          THREE.MathUtils.degToRad(cam.rotation.x),
          THREE.MathUtils.degToRad(-cam.rotation.y),
          THREE.MathUtils.degToRad(-cam.rotation.z),
          'YXZ'
        )
      : use2DCam
      ? new THREE.Euler(0, 0, THREE.MathUtils.degToRad(-cam.rotation.z), 'YXZ')
      : new THREE.Euler(0, 0, 0, 'YXZ');

    const camQuat = new THREE.Quaternion().setFromEuler(camEuler);
    const invCamQuat = camQuat.clone().invert();

    const wx = cameraSpace.worldX - cx;
    const wy = -(cameraSpace.worldY - cy);
    const wz = cameraSpace.worldZ;

    const localPos = new THREE.Vector3(wx - camPosX, wy - camPosY, wz - camPosZ).applyQuaternion(invCamQuat);
    const itemQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(-cameraSpace.worldRotX),
        THREE.MathUtils.degToRad(cameraSpace.worldRotY),
        THREE.MathUtils.degToRad(-cameraSpace.worldRotZ),
        'YXZ'
      )
    );

    const sx = Math.max(1e-4, Math.min(1e5, cameraSpace.worldScaleX));
    const sy = Math.max(1e-4, Math.min(1e5, cameraSpace.worldScaleY));
    const sz = Math.max(1e-4, Math.min(1e5, cameraSpace.worldScaleZ || 1));

    const maxHalfExtent = Math.hypot(
      built.widthPx * 0.5 * sx,
      built.heightPx * 0.5 * sy,
      built.depthPx * 0.5 * sz
    );
    const viewDist = -localPos.z;

    if (viewDist + maxHalfExtent <= NEAR_CLIP) {
      materials[0].dispose();
      materials[1].dispose();
      return true;
    }

    if (viewDist <= maxHalfExtent * 1.45) {
      materials[0].side = THREE.DoubleSide;
      materials[1].side = THREE.DoubleSide;
    }

    pivot.position.copy(localPos);
    pivot.quaternion.copy(invCamQuat).multiply(itemQuat);
    pivot.scale.set(sx, sy, sz);
    scene.add(pivot);

    if (meshConfig.castFloorShadow !== false && viewDist > built.heightPx * sy * 0.72 + 30) {
      const floorOffset = Math.max(built.heightPx * 0.72 * sy, 70 * sy);
      shadowGeo = new THREE.PlaneGeometry(targetW * 2, targetH * 2);
      shadowMat = new THREE.ShadowMaterial({ opacity: 0.34 });
      const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
      shadowPlane.quaternion.copy(invCamQuat).multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
      );
      const shadowLocal = new THREE.Vector3(wx - camPosX, wy - floorOffset - camPosY, wz - camPosZ).applyQuaternion(invCamQuat);
      shadowPlane.position.copy(shadowLocal);
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
    }

    const vFovDeg = THREE.MathUtils.radToDeg(2 * Math.atan((targetH * 0.5) / Math.max(10, effectiveFocal)));
    camera = new THREE.PerspectiveCamera(
      Math.max(0.2, Math.min(172, vFovDeg)),
      targetW / targetH,
      NEAR_CLIP,
      Math.max(120000, Math.abs(viewDist) + maxHalfExtent * 4 + 20000)
    );
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
  } else {
    const posX = effWorldMat.x - targetW * 0.5;
    const posY = -(effWorldMat.y - targetH * 0.5);
    pivot.position.set(posX, posY, 0);

    pivot.rotation.set(
      THREE.MathUtils.degToRad(-effWorldMat.rotationX),
      THREE.MathUtils.degToRad(effWorldMat.rotationY),
      THREE.MathUtils.degToRad(-effWorldMat.rotationZ),
      'YXZ'
    );

    const sx = Math.max(1e-4, Math.min(1e5, effWorldMat.scaleX));
    const sy = Math.max(1e-4, Math.min(1e5, effWorldMat.scaleY));
    const sz = Math.max(1e-4, Math.min(1e5, effWorldMat.scaleZ || 1));
    pivot.scale.set(sx, sy, sz);
    scene.add(pivot);

    // Optional 3D ground shadow receiver directly beneath the 3D text
    if (meshConfig.castFloorShadow !== false) {
      const floorOffset = Math.max(built.heightPx * 0.72 * sy, 70 * sy);
      shadowGeo = new THREE.PlaneGeometry(targetW * 2, targetH * 2);
      shadowMat = new THREE.ShadowMaterial({ opacity: 0.34 });
      const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.set(posX, posY - floorOffset, 0);
      shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
    }

    // Camera scaled dynamically so 1 Three.js unit === 1 project pixel at z=0 and extreme zoom never clips near plane
    const maxHalfExtent = Math.max(
      built.widthPx * 0.5 * sx,
      built.heightPx * 0.5 * sy,
      built.depthPx * 0.5 * sz
    );
    const camDist = Math.max(1000, maxHalfExtent + 450);
    const vFovDeg = THREE.MathUtils.radToDeg(2 * Math.atan(targetH * 0.5 / camDist));

    camera = new THREE.PerspectiveCamera(
      Math.max(0.2, Math.min(165, vFovDeg)),
      targetW / targetH,
      10,
      camDist * 10
    );
    camera.position.set(0, 0, camDist);
    camera.lookAt(0, 0, 0);
  }

  renderer.clear();
  renderer.render(scene, camera);

  // Dispose transient per-frame wrappers (keeping cached geometry & shared renderer intact!)
  materials[0].dispose();
  materials[1].dispose();
  shadowGeo?.dispose();
  shadowMat?.dispose();

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, effWorldMat.opacity));
  ctx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || 'source-over';
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  ctx.restore();

  return true;
}
