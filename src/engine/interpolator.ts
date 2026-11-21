import {
  AnimatableProperty,
  Keyframe,
  EasingType,
  Vector2D,
  Vector3D,
  Layer,
  ProjectSettings,
  EvaluatedTransform,
  EvaluatedCameraState,
  EvaluatedLayerState,
  EvaluatedSceneState,
  BezierHandle,
} from '../types';
import { getEffectiveAncestorChain } from './groupUtils';

/**
 * High-precision Cubic Bezier Root Solver (Newton-Raphson + Bisection Fallback)
 * Solves X(t) = x for t in [0, 1], then evaluates Y(t).
 * Unclamped Y output allows realistic overshoot, anticipation, and custom bouncy curves.
 */
export function cubicBezier(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Clamp control points X between 0 and 1 (time cannot travel backward)
  const cx1 = Math.max(0, Math.min(1, Number.isFinite(x1) ? x1 : 0.25));
  const cy1 = Number.isFinite(y1) ? y1 : 0.1;
  const cx2 = Math.max(0, Math.min(1, Number.isFinite(x2) ? x2 : 0.25));
  const cy2 = Number.isFinite(y2) ? y2 : 1.0;

  // Fast-path: perfect diagonal
  if (cx1 === cy1 && cx2 === cy2) return x;

  const sampleCurveX = (t: number) => {
    // 3*(1-t)^2*t*cx1 + 3*(1-t)*t^2*cx2 + t^3
    const invT = 1 - t;
    return 3 * invT * invT * t * cx1 + 3 * invT * t * t * cx2 + t * t * t;
  };

  const sampleCurveY = (t: number) => {
    const invT = 1 - t;
    return 3 * invT * invT * t * cy1 + 3 * invT * t * t * cy2 + t * t * t;
  };

  const sampleCurveDerivativeX = (t: number) => {
    const invT = 1 - t;
    return 3 * invT * invT * cx1 + 6 * invT * t * (cx2 - cx1) + 3 * t * t * (1 - cx2);
  };

  // 1. Newton-Raphson iteration
  let t = x;
  let success = false;
  for (let i = 0; i < 10; i++) {
    const currentX = sampleCurveX(t);
    const dx = sampleCurveDerivativeX(t);
    if (Math.abs(currentX - x) < 1e-7) {
      success = true;
      break;
    }
    if (Math.abs(dx) < 1e-7) break;
    t -= (currentX - x) / dx;
    if (t < 0 || t > 1) break;
  }

  // 2. Bisection binary search fallback if Newton-Raphson failed or diverged
  if (!success || t < 0 || t > 1 || !Number.isFinite(t)) {
    let lower = 0;
    let upper = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      t = (lower + upper) * 0.5;
      const currentX = sampleCurveX(t);
      if (Math.abs(currentX - x) < 1e-7) break;
      if (currentX < x) {
        lower = t;
      } else {
        upper = t;
      }
    }
  }

  const resultY = sampleCurveY(Math.max(0, Math.min(1, t)));
  return Number.isFinite(resultY) ? resultY : x;
}

/**
 * Evaluates easing progress from [0, 1] given EasingType and optional custom handles.
 */
export function evaluateEasing(
  progress: number,
  easing: EasingType | string,
  handle?: { x1: number; y1: number; x2: number; y2: number }
): number {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  // Custom bezier handle override
  if (
    handle &&
    Number.isFinite(handle.x1) &&
    Number.isFinite(handle.y1) &&
    Number.isFinite(handle.x2) &&
    Number.isFinite(handle.y2)
  ) {
    if (easing === 'bezier' || easing === 'custom') {
      return cubicBezier(p, handle.x1, handle.y1, handle.x2, handle.y2);
    }
  }

  switch (easing) {
    case 'linear':
      return p;

    case 'hold':
    case 'stepped':
      return p >= 1 ? 1 : 0;

    case 'ease-in':
      return cubicBezier(p, 0.42, 0.0, 1.0, 1.0);

    case 'ease-out':
      return cubicBezier(p, 0.0, 0.0, 0.58, 1.0);

    case 'ease-in-out':
      return cubicBezier(p, 0.42, 0.0, 0.58, 1.0);

    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = p;
      if (x < 1 / d1) {
        return n1 * x * x;
      } else if (x < 2 / d1) {
        x -= 1.5 / d1;
        return n1 * x * x + 0.75;
      } else if (x < 2.5 / d1) {
        x -= 2.25 / d1;
        return n1 * x * x + 0.9375;
      } else {
        x -= 2.625 / d1;
        return n1 * x * x + 0.984375;
      }
    }

    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return -Math.pow(2, 10 * p - 10) * Math.sin((p * 10 - 10.75) * c4);
    }

    case 'spring': {
      // Damped harmonic oscillation for natural springy bounce
      return 1 - Math.exp(-6 * p) * Math.cos(8 * Math.PI * p * (1 - p * 0.4));
    }

    case 'bezier':
    case 'custom':
      if (handle) {
        return cubicBezier(p, handle.x1, handle.y1, handle.x2, handle.y2);
      }
      return p;

    default:
      if (handle) {
        return cubicBezier(p, handle.x1, handle.y1, handle.x2, handle.y2);
      }
      return p;
  }
}

/**
 * Shortest path angle interpolation (handles smooth unwrapping, prevents 360 degree flips)
 */
export function interpolateAngle(a: number, b: number, progress: number): number {
  let diff = (b - a) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return a + diff * progress;
}

/**
 * Interpolates values between numbers, Vector2D, or Vector3D.
 */
export function interpolateValue<T>(a: T, b: T, progress: number, isAngle: boolean = false): T {
  if (typeof a === 'number' && typeof b === 'number') {
    if (isAngle) {
      return interpolateAngle(a, b, progress) as unknown as T;
    }
    return (a + (b - a) * progress) as unknown as T;
  }

  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const objA = a as Record<string, any>;
    const objB = b as Record<string, any>;
    const result: Record<string, any> = {};
    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
    for (const key of allKeys) {
      const valA = objA[key] ?? 0;
      const valB = objB[key] ?? valA;
      if (typeof valA === 'number' && typeof valB === 'number') {
        if (isAngle || key === 'rotation' || key === 'rotX' || key === 'rotY' || key === 'rotZ' || key === 'z' && Object.keys(objA).length === 3) {
          result[key] = valA + (valB - valA) * progress;
        } else {
          result[key] = valA + (valB - valA) * progress;
        }
      } else {
        result[key] = progress >= 0.5 ? valB : valA;
      }
    }
    return result as unknown as T;
  }

  // Handle mismatch between number (e.g. rotation scalar) and object (e.g. {z: 45})
  if (typeof a === 'number' && typeof b === 'object' && b !== null) {
    const bZ = (b as any).z ?? (b as any).value ?? 0;
    return (a + (bZ - a) * progress) as unknown as T;
  }
  if (typeof a === 'object' && a !== null && typeof b === 'number') {
    const aZ = (a as any).z ?? (a as any).value ?? 0;
    return (aZ + (b - aZ) * progress) as unknown as T;
  }

  return progress >= 0.5 ? b : a;
}

/**
 * Deterministic pseudo-random noise generator for expressions
 */
function pseudoNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // -1 to 1
}

function evaluateWiggle<T>(baseValue: T, frame: number, fps: number, freq: number, amp: number): T {
  const timeSec = frame / fps;
  const phase = timeSec * freq;
  const baseSeed = Math.floor(phase);
  const frac = phase - baseSeed;

  const noise1 = pseudoNoise(baseSeed);
  const noise2 = pseudoNoise(baseSeed + 1);
  const smoothNoise = noise1 + (noise2 - noise1) * (3 * frac * frac - 2 * frac * frac * frac);
  const offset = smoothNoise * amp;

  if (typeof baseValue === 'number') {
    return (baseValue + offset) as unknown as T;
  }
  if (typeof baseValue === 'object' && baseValue !== null) {
    const obj = { ...(baseValue as Record<string, number>) };
    let i = 1;
    for (const key in obj) {
      if (typeof obj[key] === 'number') {
        const noiseDim = pseudoNoise(baseSeed + i * 100);
        const noiseDim2 = pseudoNoise(baseSeed + 1 + i * 100);
        const smoothDim = noiseDim + (noiseDim2 - noiseDim) * (3 * frac * frac - 2 * frac * frac * frac);
        obj[key] += smoothDim * amp;
        i++;
      }
    }
    return obj as unknown as T;
  }
  return baseValue;
}

/**
 * Evaluates an animatable property at a specific frame/time (Authoritative Single Source of Truth).
 */
export function evaluateProperty<T>(
  prop: AnimatableProperty<T>,
  frame: number,
  fps: number = 30,
  layerStartTime: number = 0
): T {
  if (!prop) return 0 as unknown as T;

  const relFrame = frame - layerStartTime;
  let baseValue = prop.value;

  if (prop.keyframes && prop.keyframes.length > 0) {
    const sorted = [...prop.keyframes].sort((a, b) => a.frame - b.frame);

    if (relFrame <= sorted[0].frame) {
      baseValue = sorted[0].value;
    } else if (relFrame >= sorted[sorted.length - 1].frame) {
      baseValue = sorted[sorted.length - 1].value;
    } else {
      // Find bounding keyframes
      let prev = sorted[0];
      let next = sorted[sorted.length - 1];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (relFrame >= sorted[i].frame && relFrame <= sorted[i + 1].frame) {
          prev = sorted[i];
          next = sorted[i + 1];
          break;
        }
      }

      const duration = next.frame - prev.frame;
      const rawProgress = duration > 0 ? (relFrame - prev.frame) / duration : 1;
      const easedProgress = evaluateEasing(rawProgress, prev.easing, prev.bezierHandle);
      baseValue = interpolateValue(prev.value, next.value, easedProgress);
    }
  }

  // Handle expression override/additive
  if (prop.expression && prop.expression.trim().length > 0) {
    const expr = prop.expression.trim();

    // wiggle(freq, amp)
    const wiggleMatch = expr.match(/^wiggle\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);
    if (wiggleMatch) {
      const freq = parseFloat(wiggleMatch[1]) || 2;
      const amp = parseFloat(wiggleMatch[2]) || 10;
      return evaluateWiggle(baseValue, frame, fps, freq, amp);
    }

    // time multiplier: e.g. "time * 100"
    const timeMatch = expr.match(/^time\s*\*\s*(-?[\d.]+)(?:\s*,\s*(?:time\s*\*\s*)?(-?[\d.]+))?$/i);
    if (timeMatch) {
      const vx = parseFloat(timeMatch[1]) || 0;
      const vy = timeMatch[2] ? parseFloat(timeMatch[2]) || 0 : vx;
      const timeSec = frame / fps;

      if (typeof baseValue === 'number') {
        return (baseValue + timeSec * vx) as unknown as T;
      }
      if (typeof baseValue === 'object' && baseValue !== null) {
        const obj = { ...(baseValue as Record<string, number>) };
        obj.x = (obj.x ?? 0) + timeSec * vx;
        obj.y = (obj.y ?? 0) + timeSec * vy;
        return obj as unknown as T;
      }
    }

    // loop()
    if (expr === 'loop()' && prop.keyframes && prop.keyframes.length >= 2) {
      const sorted = [...prop.keyframes].sort((a, b) => a.frame - b.frame);
      const minF = sorted[0].frame;
      const maxF = sorted[sorted.length - 1].frame;
      const cycleLength = maxF - minF;
      if (cycleLength > 0 && relFrame > minF) {
        const loopedFrame = minF + ((relFrame - minF) % cycleLength);
        return evaluateProperty({ ...prop, expression: undefined }, layerStartTime + loopedFrame, fps, layerStartTime);
      }
    }
  }

  return baseValue;
}

/**
 * Evaluates local transform of a layer at a specific frame.
 */
export function evaluateLayerTransform(layer: Layer, frame: number, fps: number = 30): EvaluatedTransform {
  const pos: any = evaluateProperty(layer.transform.position, frame, fps, layer.startFrame);
  const scl: any = evaluateProperty(layer.transform.scale, frame, fps, layer.startFrame);
  const rot: any = evaluateProperty(layer.transform.rotation, frame, fps, layer.startFrame);
  const opc: any = evaluateProperty(layer.transform.opacity, frame, fps, layer.startFrame);
  const anc: any = evaluateProperty(layer.transform.anchorPoint, frame, fps, layer.startFrame);

  return {
    position: {
      x: typeof pos === 'object' && pos !== null ? (Number.isFinite(pos.x) ? pos.x : 0) : typeof pos === 'number' && Number.isFinite(pos) ? pos : 0,
      y: typeof pos === 'object' && pos !== null ? (Number.isFinite(pos.y) ? pos.y : 0) : 0,
      z: typeof pos === 'object' && pos !== null ? (Number.isFinite(pos.z) ? pos.z : 0) : 0,
    },
    scale: {
      x: typeof scl === 'object' && scl !== null ? (Number.isFinite(scl.x) ? scl.x : 100) : typeof scl === 'number' && Number.isFinite(scl) ? scl : 100,
      y: typeof scl === 'object' && scl !== null ? (Number.isFinite(scl.y) ? scl.y : 100) : typeof scl === 'number' && Number.isFinite(scl) ? scl : 100,
      z: typeof scl === 'object' && scl !== null ? (Number.isFinite(scl.z) ? scl.z : 100) : 100,
    },
    rotation: {
      x: typeof rot === 'object' && rot !== null ? (Number.isFinite(rot.x) ? rot.x : 0) : 0,
      y: typeof rot === 'object' && rot !== null ? (Number.isFinite(rot.y) ? rot.y : 0) : 0,
      z: typeof rot === 'object' && rot !== null ? (Number.isFinite(rot.z) ? rot.z : 0) : typeof rot === 'number' && Number.isFinite(rot) ? rot : 0,
    },
    opacity: typeof opc === 'number' && Number.isFinite(opc) ? Math.max(0, Math.min(100, opc)) : 100,
    anchorPoint: {
      x: typeof anc === 'object' && anc !== null ? (Number.isFinite(anc.x) ? anc.x : 0) : 0,
      y: typeof anc === 'object' && anc !== null ? (Number.isFinite(anc.y) ? anc.y : 0) : 0,
      z: typeof anc === 'object' && anc !== null ? (Number.isFinite(anc.z) ? anc.z : 0) : 0,
    },
  };
}

/**
 * 3x3 Rotation Matrix helpers in Canvas 3D space (+X right, +Y down, +Z toward viewer)
 * using intrinsic YXZ order (Z roll -> X pitch -> Y yaw), matching applyParentTransform3D & WebGL3DCompositor 1:1.
 */
type Mat3 = [number, number, number, number, number, number, number, number, number];

function rotEulerToMat3(rxDeg: number, ryDeg: number, rzDeg: number): Mat3 {
  const rx = (rxDeg * Math.PI) / 180;
  const ry = (ryDeg * Math.PI) / 180;
  const rz = (rzDeg * Math.PI) / 180;

  const cX = Math.cos(rx);
  const sX = Math.sin(rx);
  const cY = Math.cos(ry);
  const sY = Math.sin(ry);
  const cZ = Math.cos(rz);
  const sZ = Math.sin(rz);

  return [
    cY * cZ + sY * sX * sZ,
    -cY * sZ + sY * sX * cZ,
    sY * cX,
    cX * sZ,
    cX * cZ,
    -sX,
    -sY * cZ + cY * sX * sZ,
    sY * sZ + cY * sX * cZ,
    cY * cX,
  ];
}

function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function transposeMat3(m: Mat3): Mat3 {
  return [
    m[0], m[3], m[6],
    m[1], m[4], m[7],
    m[2], m[5], m[8],
  ];
}

function mat3ToRotEuler(m: Mat3): { x: number; y: number; z: number } {
  const sinX = Math.max(-1, Math.min(1, -m[5]));
  const rx = Math.asin(sinX);
  let ry = 0;
  let rz = 0;

  if (Math.abs(sinX) < 0.999999) {
    ry = Math.atan2(m[2], m[8]);
    rz = Math.atan2(m[3], m[4]);
  } else {
    ry = sinX > 0 ? Math.atan2(m[1], m[0]) : Math.atan2(-m[1], m[0]);
    rz = 0;
  }

  const radToDeg = 180 / Math.PI;
  return {
    x: rx * radToDeg,
    y: ry * radToDeg,
    z: rz * radToDeg,
  };
}

/**
 * 3D Transformation Math Helper for Parent Hierarchy Evaluation
 */
function applyParentTransform3D(
  point: { x: number; y: number; z: number },
  parentTransform: EvaluatedTransform,
  cx: number,
  cy: number
): { x: number; y: number; z: number } {
  const pScaleX = (parentTransform.scale.x || 100) / 100;
  const pScaleY = (parentTransform.scale.y || 100) / 100;
  const rawPScaleZ = (parentTransform.scale.z ?? 100) / 100;
  const pScaleZ =
    Math.abs(rawPScaleZ - 1) < 0.0005 && Math.abs(pScaleX - pScaleY) < 0.001 && Math.abs(pScaleX - 1) > 0.0005
      ? pScaleX
      : rawPScaleZ;

  const pAncX = parentTransform.anchorPoint?.x || 0;
  const pAncY = parentTransform.anchorPoint?.y || 0;
  const pAncZ = parentTransform.anchorPoint?.z || 0;

  // 1. Scale relative to parent anchor
  let px = (point.x - pAncX) * pScaleX;
  let py = (point.y - pAncY) * pScaleY;
  let pz = (point.z - pAncZ) * pScaleZ;

  // 2. Rotate around parent anchor point (Z roll, X pitch, Y yaw)
  const rotZ = parentTransform.rotation.z || 0;
  const rotX = parentTransform.rotation.x || 0;
  const rotY = parentTransform.rotation.y || 0;

  if (rotZ !== 0) {
    const rz = (rotZ * Math.PI) / 180;
    const cosZ = Math.cos(rz);
    const sinZ = Math.sin(rz);
    const nx = px * cosZ - py * sinZ;
    const ny = px * sinZ + py * cosZ;
    px = nx;
    py = ny;
  }

  if (rotX !== 0) {
    const rx = (rotX * Math.PI) / 180;
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const ny = py * cosX - pz * sinX;
    const nz = py * sinX + pz * cosX;
    py = ny;
    pz = nz;
  }

  if (rotY !== 0) {
    const ry = (rotY * Math.PI) / 180;
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const nx = px * cosY + pz * sinY;
    const nz = -px * sinY + pz * cosY;
    px = nx;
    pz = nz;
  }

  // 3. Translate by parent position and anchor offset
  const pOffsetX = (parentTransform.position.x ?? cx) - cx;
  const pOffsetY = (parentTransform.position.y ?? cy) - cy;
  const pOffsetZ = parentTransform.position.z ?? 0;

  return {
    x: px + pAncX + pOffsetX,
    y: py + pAncY + pOffsetY,
    z: pz + pAncZ + pOffsetZ,
  };
}

/**
 * Evaluates the Active Camera in the scene at a given frame.
 * If camera is parented to a Null/Rig layer, camera inherits the parent's full world transform.
 */
export function evaluateActiveCamera(
  layers: Layer[],
  frame: number,
  fps: number,
  settings: ProjectSettings
): EvaluatedCameraState {
  const cx = settings.width / 2;
  const cy = settings.height / 2;

  const cameraLayer = layers.find(
    (l) => l.type === 'camera' && l.visible && frame >= l.startFrame && frame < l.startFrame + l.durationFrames
  );

  if (!cameraLayer) {
    return {
      active: false,
      type: '3d',
      position: { x: cx, y: cy, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      zoom: 1.0,
      fov: 1000,
      focalLength: 50,
      focusDistance: 1000,
      parentChain: [],
    };
  }

  const localTransform = evaluateLayerTransform(cameraLayer, frame, fps);

  // Build camera parent chain
  const parentChain: string[] = [];
  const chainLayers: Layer[] = [cameraLayer];
  let curParentId = cameraLayer.parentId;
  const visited = new Set<string>([cameraLayer.id]);

  while (curParentId && !visited.has(curParentId)) {
    visited.add(curParentId);
    const pLayer = layers.find((l) => l.id === curParentId);
    if (!pLayer) break;
    parentChain.push(pLayer.id);
    chainLayers.push(pLayer);
    curParentId = pLayer.parentId;
  }

  // Evaluate camera world coordinates through parent chain
  let camX = (Number.isFinite(localTransform.position.x) ? localTransform.position.x : cx) - cx;
  let camY = (Number.isFinite(localTransform.position.y) ? localTransform.position.y : cy) - cy;
  let camZ = Number.isFinite(localTransform.position.z) ? localTransform.position.z : 0;

  let camRotX = Number.isFinite(localTransform.rotation.x) ? localTransform.rotation.x : 0;
  let camRotY = Number.isFinite(localTransform.rotation.y) ? localTransform.rotation.y : 0;
  let camRotZ = Number.isFinite(localTransform.rotation.z) ? localTransform.rotation.z : 0;
  let camZoom = Math.max(0.05, Math.min(20, (localTransform.scale.x || 100) / 100));

  let camRotMat = rotEulerToMat3(camRotX, camRotY, camRotZ);
  let camRotatedCount = (camRotX !== 0 || camRotY !== 0 || camRotZ !== 0) ? 1 : 0;

  for (let i = 1; i < chainLayers.length; i++) {
    const pLayer = chainLayers[i];
    const pTransform = evaluateLayerTransform(pLayer, frame, fps);
    const transformed = applyParentTransform3D({ x: camX, y: camY, z: camZ }, pTransform, cx, cy);
    camX = transformed.x;
    camY = transformed.y;
    camZ = transformed.z;

    const pRx = pTransform.rotation.x || 0;
    const pRy = pTransform.rotation.y || 0;
    const pRz = pTransform.rotation.z || 0;
    if (pRx !== 0 || pRy !== 0 || pRz !== 0) {
      camRotatedCount++;
      camRotMat = multiplyMat3(rotEulerToMat3(pRx, pRy, pRz), camRotMat);
      if (camRotatedCount === 1) {
        camRotX = pRx;
        camRotY = pRy;
        camRotZ = pRz;
      } else {
        const composed = mat3ToRotEuler(camRotMat);
        camRotX = composed.x;
        camRotY = composed.y;
        camRotZ = composed.z;
      }
    }
    camZoom *= (pTransform.scale.x || 100) / 100;
  }

  const cameraType: '2d' | '3d' = cameraLayer.cameraConfig?.cameraType || '3d';
  const fov = cameraLayer.cameraConfig?.fov || 1000;
  const focalLength = cameraLayer.cameraConfig?.focalLength || 50;
  const focusDistance = cameraLayer.cameraConfig?.focusDistance || 1000;

  return {
    active: true,
    id: cameraLayer.id,
    name: cameraLayer.name,
    type: cameraType,
    position: {
      x: cx + camX,
      y: cy + camY,
      z: camZ,
    },
    rotation: {
      x: camRotX,
      y: camRotY,
      z: camRotZ,
    },
    zoom: Math.max(0.01, camZoom),
    fov,
    focalLength,
    focusDistance,
    parentChain,
  };
}

/**
 * True physical pinhole 3D perspective factor with smooth bounded lens-membrane continuation.
 * - For dz >= minDz (in front of lens): exact pinhole (fov / dz).
 * - For dz < minDz (crossing lens plane & piercing behind camera): stays positive and bounded
 *   without infinite Math.exp(60) blowup or negative upside-down inversion, while cameraDz lets renderers pierce & cull cleanly.
 */
export function computeInfinitePerspective(fov: number, dz: number, minDz: number = 16): number {
  const safeFov = Math.max(100, Number.isFinite(fov) ? fov : 1000);
  if (!Number.isFinite(dz)) return 1.0;
  const effMin = Math.max(8, minDz);
  if (dz >= effMin) {
    return safeFov / dz;
  }
  const base = safeFov / effMin;
  return base * (1 + Math.min(2, Math.max(0, effMin - dz) / (effMin * 4)));
}

/**
 * Inverse of computeInfinitePerspective: recovers effective dz from a perspective factor (without zoom).
 */
export function recoverEffectiveDz(fov: number, perspective: number, minDz: number = 16): number {
  const safeFov = Math.max(100, Number.isFinite(fov) ? fov : 1000);
  const safeP = Math.max(1e-7, Number.isFinite(perspective) ? perspective : 1.0);
  const effMin = Math.max(8, minDz);
  const threshold = safeFov / effMin;
  if (safeP <= threshold) {
    return safeFov / safeP;
  }
  return Math.max(-effMin * 2, effMin - (safeP / threshold - 1) * (effMin * 4));
}

/**
 * Authoritative Single Source of Truth: Evaluates entire Scene Graph at a given frame.
 * Both the interactive Viewport and the Video Exporter MUST call this exact function.
 */
export function evaluateSceneGraph(
  layers: Layer[],
  frame: number,
  fps: number = 30,
  settings: ProjectSettings,
  options?: { excludeGroupOpacityIds?: Set<string> }
): EvaluatedSceneState {
  const cx = settings.width / 2;
  const cy = settings.height / 2;
  const timeSec = frame / fps;

  // 1. Evaluate Camera State
  const camera = evaluateActiveCamera(layers, frame, fps, settings);

  // 2. Evaluate all layer local transforms and world states
  const evaluatedLayerMap = new Map<string, EvaluatedLayerState>();
  const layerList: EvaluatedLayerState[] = [];
  const layerMap = new Map<string, Layer>();
  for (const l of layers) layerMap.set(l.id, l);

  for (const layer of layers) {
    const localTransform = evaluateLayerTransform(layer, frame, fps);

    // Build unified parent hierarchy (parentId rigging + groupId nesting)
    const ancestors = getEffectiveAncestorChain(layer, layerMap);
    const parentChain = ancestors.map((a) => a.id);
    const chainLayers: Layer[] = [layer, ...ancestors];

    // Local position relative to canvas center
    let curX = (Number.isFinite(localTransform.position.x) ? localTransform.position.x : cx) - cx;
    let curY = (Number.isFinite(localTransform.position.y) ? localTransform.position.y : cy) - cy;
    let curZ = Number.isFinite(localTransform.position.z) ? localTransform.position.z : 0;

    let worldScaleX = (Number.isFinite(localTransform.scale.x) ? localTransform.scale.x : 100) / 100;
    let worldScaleY = (Number.isFinite(localTransform.scale.y) ? localTransform.scale.y : 100) / 100;
    let worldScaleZ = (Number.isFinite(localTransform.scale.z) ? localTransform.scale.z : 100) / 100;

    let worldRotX = Number.isFinite(localTransform.rotation.x) ? localTransform.rotation.x : 0;
    let worldRotY = Number.isFinite(localTransform.rotation.y) ? localTransform.rotation.y : 0;
    let worldRotZ = Number.isFinite(localTransform.rotation.z) ? localTransform.rotation.z : 0;
    let worldOpacity = Number.isFinite(localTransform.opacity) ? localTransform.opacity / 100 : 1;

    let worldRotMat = rotEulerToMat3(worldRotX, worldRotY, worldRotZ);
    let rotatedNodeCount = (worldRotX !== 0 || worldRotY !== 0 || worldRotZ !== 0) ? 1 : 0;

    // Apply parent transformation in order (child -> immediate parent -> root)
    for (let i = 1; i < chainLayers.length; i++) {
      const pLayer = chainLayers[i];
      const pTransform = evaluateLayerTransform(pLayer, frame, fps);
      const transformed = applyParentTransform3D({ x: curX, y: curY, z: curZ }, pTransform, cx, cy);
      curX = transformed.x;
      curY = transformed.y;
      curZ = transformed.z;

      const pScaleX = (pTransform.scale.x || 100) / 100;
      const pScaleY = (pTransform.scale.y || 100) / 100;
      const rawPScaleZ = (pTransform.scale.z ?? 100) / 100;
      const pScaleZ =
        Math.abs(rawPScaleZ - 1) < 0.0005 && Math.abs(pScaleX - pScaleY) < 0.001 && Math.abs(pScaleX - 1) > 0.0005
          ? pScaleX
          : rawPScaleZ;

      worldScaleX *= pScaleX;
      worldScaleY *= pScaleY;
      worldScaleZ *= pScaleZ;

      const pRx = pTransform.rotation.x || 0;
      const pRy = pTransform.rotation.y || 0;
      const pRz = pTransform.rotation.z || 0;
      if (pRx !== 0 || pRy !== 0 || pRz !== 0) {
        rotatedNodeCount++;
        worldRotMat = multiplyMat3(rotEulerToMat3(pRx, pRy, pRz), worldRotMat);
        if (rotatedNodeCount === 1) {
          worldRotX = pRx;
          worldRotY = pRy;
          worldRotZ = pRz;
        } else {
          const composed = mat3ToRotEuler(worldRotMat);
          worldRotX = composed.x;
          worldRotY = composed.y;
          worldRotZ = composed.z;
        }
      }

      if (!options?.excludeGroupOpacityIds?.has(pLayer.id)) {
        worldOpacity *= (pTransform.opacity ?? 100) / 100;
      }
    }

    const worldX = cx + curX;
    const worldY = cy + curY;
    const worldZ = curZ;

    // Projected coordinates onto camera view
    let screenX = worldX;
    let screenY = worldY;
    let screenScaleX = worldScaleX;
    let screenScaleY = worldScaleY;
    let screenRotZ = worldRotZ;
    let screenRotX = worldRotX;
    let screenRotY = worldRotY;
    let perspectiveFactor = 1.0;
    let cameraDz = 1000 - worldZ;

    // Check if layer is explicitly designated as fixed 2D HUD
    const isFixedLayer = layer.fixedIn3D === true || layer.is3D === false;
    const isBillboard = layer.billboard === true;

    if (camera.active && layer.type !== 'camera') {
      if (isFixedLayer) {
        // Fixed Layer: remains stationary in 2D space, unaffected by 3D camera moves or rotations
        screenX = worldX;
        screenY = worldY;
        screenScaleX = worldScaleX;
        screenScaleY = worldScaleY;
        screenRotZ = worldRotZ;
        screenRotX = worldRotX;
        screenRotY = worldRotY;
        perspectiveFactor = 1.0;
      } else if (camera.type === '2d') {
        // 2D Camera Isolation: Translate, Rotate Z, and Zoom on 2D plane
        const dx = worldX - camera.position.x;
        const dy = worldY - camera.position.y;
        const camRotZRad = (-camera.rotation.z * Math.PI) / 180;
        const cosZ = Math.cos(camRotZRad);
        const sinZ = Math.sin(camRotZRad);

        const rotX = dx * cosZ - dy * sinZ;
        const rotY = dx * sinZ + dy * cosZ;

        screenX = cx + rotX * camera.zoom;
        screenY = cy + rotY * camera.zoom;
        screenScaleX = worldScaleX * camera.zoom;
        screenScaleY = worldScaleY * camera.zoom;
        screenRotZ = isBillboard ? worldRotZ : worldRotZ - camera.rotation.z;
        perspectiveFactor = camera.zoom;
      } else {
        // 3D Camera: Infinite 3D Projection with Pitch, Yaw, Roll and Unbounded Z Perspective
        const fov = camera.fov || 1000;
        let dx = worldX - camera.position.x;
        let dy = worldY - camera.position.y;
        let dz = fov - (worldZ - camera.position.z);

        // Camera Yaw (Y axis)
        if (camera.rotation.y !== 0) {
          const radY = (-camera.rotation.y * Math.PI) / 180;
          const cosY = Math.cos(radY);
          const sinY = Math.sin(radY);
          const nx = dx * cosY + dz * sinY;
          const nz = -dx * sinY + dz * cosY;
          dx = nx;
          dz = nz;
        }

        // Camera Pitch (X axis)
        if (camera.rotation.x !== 0) {
          const radX = (-camera.rotation.x * Math.PI) / 180;
          const cosX = Math.cos(radX);
          const sinX = Math.sin(radX);
          const ny = dy * cosX - dz * sinX;
          const nz = dy * sinX + dz * cosX;
          dy = ny;
          dz = nz;
        }

        // Camera Roll (Z axis)
        if (camera.rotation.z !== 0) {
          const radZ = (-camera.rotation.z * Math.PI) / 180;
          const cosZ = Math.cos(radZ);
          const sinZ = Math.sin(radZ);
          const nx = dx * cosZ - dy * sinZ;
          const ny = dx * sinZ + dy * cosZ;
          dx = nx;
          dy = ny;
        }

        perspectiveFactor = computeInfinitePerspective(fov, dz, 16) * camera.zoom;
        cameraDz = dz;

        screenX = cx + dx * perspectiveFactor;
        screenY = cy + dy * perspectiveFactor;
        screenScaleX = worldScaleX * perspectiveFactor;
        screenScaleY = worldScaleY * perspectiveFactor;

        if (isBillboard) {
          screenRotZ = worldRotZ;
          screenRotX = worldRotX;
          screenRotY = worldRotY;
        } else if (camera.rotation.x === 0 && camera.rotation.y === 0 && camera.rotation.z === 0) {
          screenRotZ = worldRotZ;
          screenRotX = worldRotX;
          screenRotY = worldRotY;
        } else {
          const camMat = rotEulerToMat3(camera.rotation.x, camera.rotation.y, camera.rotation.z);
          const relEuler = mat3ToRotEuler(multiplyMat3(transposeMat3(camMat), worldRotMat));
          screenRotX = relEuler.x;
          screenRotY = relEuler.y;
          screenRotZ = relEuler.z;
        }
      }
    } else if (layer.type !== 'camera') {
      if (isFixedLayer) {
        screenX = worldX;
        screenY = worldY;
        screenScaleX = worldScaleX;
        screenScaleY = worldScaleY;
        screenRotZ = worldRotZ;
        screenRotX = worldRotX;
        screenRotY = worldRotY;
        perspectiveFactor = 1.0;
        cameraDz = 1000;
      } else {
        // Real 3D Depth Perspective without explicit camera layer (camera lens at Z = +1000)
        const fov = 1000;
        cameraDz = fov - worldZ;
        const zPerspective = computeInfinitePerspective(fov, cameraDz, 16);
        screenX = cx + curX * zPerspective;
        screenY = cy + curY * zPerspective;
        screenScaleX = worldScaleX * zPerspective;
        screenScaleY = worldScaleY * zPerspective;
        perspectiveFactor = zPerspective;
      }
    }

    const isTransformOnly =
      layer.type === 'null' || layer.type === 'camera' || layer.type === 'audio' || layer.type === 'group';

    const evaluatedLayer: EvaluatedLayerState = {
      layer,
      localTransform,
      worldPosition: { x: worldX, y: worldY, z: worldZ },
      worldScale: { x: worldScaleX, y: worldScaleY, z: worldScaleZ },
      worldRotation: { x: worldRotX, y: worldRotY, z: worldRotZ },
      worldOpacity: Math.max(0, Math.min(1, worldOpacity)),
      perspectiveFactor,
      parentChain,
      isTransformOnly,
      screenX: Number.isFinite(screenX) ? screenX : cx,
      screenY: Number.isFinite(screenY) ? screenY : cy,
      screenScaleX: Number.isFinite(screenScaleX) ? Math.max(1e-7, screenScaleX) : 1,
      screenScaleY: Number.isFinite(screenScaleY) ? Math.max(1e-7, screenScaleY) : 1,
      screenRotationZ: Number.isFinite(screenRotZ) ? screenRotZ : 0,
      screenRotationX: Number.isFinite(screenRotX) ? screenRotX : 0,
      screenRotationY: Number.isFinite(screenRotY) ? screenRotY : 0,
      cameraDz,
    };

    evaluatedLayerMap.set(layer.id, evaluatedLayer);
    layerList.push(evaluatedLayer);
  }

  return {
    frame,
    timeSec,
    fps,
    camera,
    layers: evaluatedLayerMap,
    layerList,
  };
}

/**
 * Backward compatibility helper for LayerWorld3DMatrix
 */
export interface LayerWorld3DMatrix {
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
  perspectiveFactor: number;
  cameraDz?: number;
}

export function getLayerWorldMatrix(
  layer: Layer,
  allLayers: Layer[],
  frame: number,
  fps: number = 30,
  cameraOverride?: any,
  settings?: ProjectSettings
): LayerWorld3DMatrix {
  const projSettings: ProjectSettings = settings || {
    name: 'temp',
    width: 720,
    height: 1280,
    fps,
    durationFrames: 90,
    backgroundColor: '#000000',
  };

  const scene = evaluateSceneGraph(allLayers, frame, fps, projSettings);
  const evalLayer = scene.layers.get(layer.id);

  if (!evalLayer) {
    const loc = evaluateLayerTransform(layer, frame, fps);
    return {
      x: loc.position.x,
      y: loc.position.y,
      z: loc.position.z,
      scaleX: loc.scale.x / 100,
      scaleY: loc.scale.y / 100,
      scaleZ: loc.scale.z / 100,
      rotationX: loc.rotation.x,
      rotationY: loc.rotation.y,
      rotationZ: loc.rotation.z,
      opacity: loc.opacity / 100,
      perspectiveFactor: 1.0,
      cameraDz: 1000 - loc.position.z,
    };
  }

  return {
    x: evalLayer.screenX,
    y: evalLayer.screenY,
    z: evalLayer.worldPosition.z,
    scaleX: evalLayer.screenScaleX,
    scaleY: evalLayer.screenScaleY,
    scaleZ: evalLayer.worldScale.z,
    rotationX: evalLayer.screenRotationX,
    rotationY: evalLayer.screenRotationY,
    rotationZ: evalLayer.screenRotationZ,
    opacity: evalLayer.worldOpacity,
    perspectiveFactor: evalLayer.perspectiveFactor,
    cameraDz: evalLayer.cameraDz,
  };
}

export function getActiveCameraTransform(
  layers: Layer[],
  frame: number,
  fps: number,
  settings: ProjectSettings
) {
  const camera = evaluateActiveCamera(layers, frame, fps, settings);
  return {
    active: camera.active,
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    rotX: camera.rotation.x,
    rotY: camera.rotation.y,
    rotZ: camera.rotation.z,
    zoom: camera.zoom,
  };
}

/**
 * Generates the authentic 2D/3D Motion Path evaluated trajectory points for a layer.
 */
export interface MotionPathPoint {
  frame: number;
  x: number;
  y: number;
  z: number;
  isKeyframe: boolean;
  keyframeId?: string;
  easing?: EasingType;
  bezierHandle?: BezierHandle;
}

export function generateMotionPath(
  layer: Layer,
  allLayers: Layer[],
  settings: ProjectSettings,
  fps: number = 30,
  stepFrames: number = 1
): MotionPathPoint[] {
  const points: MotionPathPoint[] = [];
  const startF = layer.startFrame;
  const endF = layer.startFrame + layer.durationFrames;

  const keyframeFrames = new Set<number>();
  const kfMap = new Map<number, Keyframe<any>>();

  if (layer.transform.position.keyframes) {
    for (const kf of layer.transform.position.keyframes) {
      const absF = layer.startFrame + kf.frame;
      keyframeFrames.add(absF);
      kfMap.set(absF, kf);
    }
  }

  for (let f = startF; f <= endF; f += stepFrames) {
    const scene = evaluateSceneGraph(allLayers, f, fps, settings);
    const evalLayer = scene.layers.get(layer.id);
    if (evalLayer) {
      const isKf = keyframeFrames.has(f);
      const kf = isKf ? kfMap.get(f) : undefined;
      points.push({
        frame: f,
        x: evalLayer.worldPosition.x,
        y: evalLayer.worldPosition.y,
        z: evalLayer.worldPosition.z,
        isKeyframe: isKf,
        keyframeId: kf?.id,
        easing: kf?.easing,
        bezierHandle: kf?.bezierHandle,
      });
    }
  }

  return points;
}
