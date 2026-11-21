import { Layer, ProjectSettings, ShaderEffect } from '../types';

export interface EffectTransformDelta {
  extraX: number;
  extraY: number;
  extraZ: number;
  extraRotZ: number;
  extraRotX: number;
  extraRotY: number;
  extraScaleX: number;
  extraScaleY: number;
  extraScaleZ: number;
  effectOpacity: number;
  perspectiveOverride?: number;
}

const TRANSFORM_ONLY_EFFECT_TYPES = new Set<string>([
  'oscillate',
  'pulse',
  'blink',
  'shake',
  'flip3d',
  'squeeze',
  'fade',
  'swing',
  'spin360',
  'jitter',
  'bounce',
  'autoPan',
  'zoomLoop',
  'snapPop',
  'strobe',
  'flicker',
  'parallax',
  'orbitCamera',
  'isometric',
  'zFloat',
]);

const TEXT_NATIVE_EFFECT_TYPES = new Set<string>([
  'typewriter',
  'textTracking',
  'charTransform',
  'textWave',
  'textGlitch',
  'textCounter',
  'textGradient',
  'textGlow',
  'textFlipWord',
  'textHacker',
]);

const TIME_ANIMATED_EFFECT_TYPES = new Set<string>([
  'wave',
  'ripple',
  'turbulent',
  'glitch',
  'glitchBlocks',
  'vhs',
  'badTv',
  'electric',
  'fire',
  'dustOrbs',
  'matrixRain',
  'smoke',
  'rain',
  'snow',
  'cyberGrid',
  'fractalNoise',
  'confetti',
  'rays',
  'tunnel',
  'kaleidoscope',
  'motionStars',
  'spaceLines',
  'starfield',
  'strobe',
  'flicker',
  'typewriter',
  'charTransform',
  'textWave',
  'textGlitch',
  'textCounter',
  'textFlipWord',
  'textHacker',
  'filmGrain',
]);

const BOUNDS_EXPANDING_EFFECT_TYPES = new Set<string>([
  'glow',
  'bloom',
  'rays',
  'blur',
  'gaussianBlur',
  'fastBlur',
  'dirBlur',
  'motionBlur',
  'radialBlur',
  'zoomBlur',
  'lensBlur',
  'channelBlur',
  'glowEdges',
  'stroke',
  'dropShadow',
  'longShadow',
  'wave',
  'ripple',
  'turbulent',
  'glitch',
  'glitchBlocks',
  'chromatic',
  'ghostTrail',
  'radialRepeat',
  'linearArray',
  'spiralRepeat',
  'extrude3d',
  'box3d',
  'fire',
  'electric',
]);

export function isTimeAnimatedEffect(type: string): boolean {
  return TIME_ANIMATED_EFFECT_TYPES.has(type);
}

export function isBoundsExpandingEffect(type: string): boolean {
  return BOUNDS_EXPANDING_EFFECT_TYPES.has(type);
}

export function isCanvasVisualEffect(type: string, isTextLayer: boolean = false): boolean {
  if (type === 'motionStars' || type === 'starfield' || type === 'spaceLines') return false; // handled in 3D star/line pass
  if (isTextLayer && TEXT_NATIVE_EFFECT_TYPES.has(type)) return false; // handled natively in renderText
  return !TRANSFORM_ONLY_EFFECT_TYPES.has(type);
}

export function isOverlayProceduralEffect(type: string): boolean {
  return (
    type === 'fire' ||
    type === 'dustOrbs' ||
    type === 'electric' ||
    type === 'matrixRain' ||
    type === 'smoke' ||
    type === 'rain' ||
    type === 'snow' ||
    type === 'cyberGrid' ||
    type === 'fractalNoise' ||
    type === 'confetti' ||
    type === 'vignette' ||
    type === 'scanlines' ||
    type === 'filmGrain'
  );
}

function deterministicRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#00e676').replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return { r: 0, g: 230, b: 118 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function safeGetImageData(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): ImageData | null {
  try {
    return ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
}

function writeBilinearSample(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  dstIdx: number,
  w: number,
  h: number,
  fx: number,
  fy: number
) {
  const cx = Math.max(0, Math.min(w - 1.001, fx));
  const cy = Math.max(0, Math.min(h - 1.001, fy));
  const x0 = cx | 0;
  const y0 = cy | 0;
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  dst[dstIdx] = src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11;
  dst[dstIdx + 1] = src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11;
  dst[dstIdx + 2] = src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11;
  dst[dstIdx + 3] = src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
}

/**
 * Computes all unified transform/motion/3D/visibility effect deltas for any layer.
 */
export function computeEffectTransforms(
  layer: Layer,
  currentFrame: number,
  settings: ProjectSettings
): EffectTransformDelta {
  let extraX = 0;
  let extraY = 0;
  let extraZ = 0;
  let extraRotZ = 0;
  let extraRotX = 0;
  let extraRotY = 0;
  let extraScaleX = 1;
  let extraScaleY = 1;
  let extraScaleZ = 1;
  let effectOpacity = 1;
  let perspectiveOverride: number | undefined;

  if (!layer.effects || layer.effects.length === 0) {
    return {
      extraX,
      extraY,
      extraZ,
      extraRotZ,
      extraRotX,
      extraRotY,
      extraScaleX,
      extraScaleY,
      extraScaleZ,
      effectOpacity,
      perspectiveOverride,
    };
  }

  const fps = Math.max(1, settings.fps || 30);
  const timeSec = currentFrame / fps;
  const relFrame = Math.max(0, currentFrame - (layer.startFrame || 0));
  const relSec = relFrame / fps;

  for (const effect of layer.effects) {
    if (!effect.enabled) continue;
    const p = effect.params || {};
    const mixRatio = p.mix === undefined ? 1 : Math.max(0, Math.min(2, Number(p.mix) / 100));
    if (mixRatio <= 0.0001) continue;

    let dX = 0;
    let dY = 0;
    let dZ = 0;
    let dRotX = 0;
    let dRotY = 0;
    let dRotZ = 0;
    let dScaleX = 1;
    let dScaleY = 1;
    let dScaleZ = 1;
    let dOp = 1;

    switch (effect.type) {
      case 'oscillate': {
        const freq = Number(p.frequency ?? 1.5);
        const mag = Number(p.magnitude ?? 25);
        const ang = (Number(p.angle ?? 0) * Math.PI) / 180;
        const phase = (Number(p.phase ?? 0) * Math.PI) / 180;
        const osc = Math.sin(timeSec * freq * Math.PI * 2 + phase) * mag;
        dX += Math.cos(ang) * osc;
        dY += Math.sin(ang) * osc;
        break;
      }

      case 'pulse': {
        const freq = Number(p.frequency ?? 2);
        const maxScale = Number(p.scale ?? 1.25);
        const minScale = Number(p.minScale ?? 1.0);
        const phase = (Number(p.phase ?? 0) * Math.PI) / 180;
        const tWave = Math.sin(timeSec * freq * Math.PI * 2 + phase) * 0.5 + 0.5;
        const pulse = minScale + tWave * (maxScale - minScale);
        dScaleX *= pulse;
        dScaleY *= pulse;
        break;
      }

      case 'blink': {
        const freq = Number(p.frequency ?? 4);
        const isVisible = Math.floor(timeSec * freq * 2) % 2 === 0;
        if (!isVisible) dOp = 0;
        break;
      }

      case 'strobe': {
        const freq = Number(p.frequency ?? 6);
        const duty = Math.max(0.05, Math.min(0.95, Number(p.dutyCycle ?? 0.5)));
        const cycle = (timeSec * freq) % 1;
        if (cycle > duty) dOp *= 0.08;
        break;
      }

      case 'flicker': {
        const speed = Number(p.speed ?? 12);
        const minOp = Math.max(0, Math.min(1, Number(p.minOpacity ?? 0.4)));
        const maxOp = Math.max(minOp, Math.min(1, Number(p.maxOpacity ?? 1.0)));
        const n = deterministicRand(Math.floor(timeSec * speed) * 19.3 + 7.1);
        dOp *= minOp + n * (maxOp - minOp);
        break;
      }

      case 'shake': {
        const speed = Number(p.speed ?? 8);
        const amp = Number(p.amplitude ?? 18);
        const seedOffset = Number(p.seed ?? 1) * 17.13;
        const seed = currentFrame * speed * 0.35 + seedOffset;
        dX += (Math.sin(seed * 0.7) + Math.cos(seed * 1.3)) * (amp * 0.5);
        dY += (Math.cos(seed * 0.9) + Math.sin(seed * 1.1)) * (amp * 0.5);
        break;
      }

      case 'jitter': {
        const amt = Number(p.amount ?? 6);
        const freq = Number(p.frequency ?? 16);
        const rotAmt = Number(p.rotAmount ?? 0.4);
        const tick = Math.floor(timeSec * freq);
        dX += (deterministicRand(tick * 13.7 + 1) - 0.5) * amt * 2;
        dY += (deterministicRand(tick * 29.3 + 2) - 0.5) * amt * 2;
        dRotZ += (deterministicRand(tick * 41.1 + 3) - 0.5) * amt * rotAmt;
        break;
      }

      case 'swing': {
        const maxAng = Number(p.maxAngle ?? 25);
        const speed = Number(p.speed ?? 2.2);
        const phase = (Number(p.phase ?? 0) * Math.PI) / 180;
        dRotZ += Math.sin(timeSec * speed * Math.PI + phase) * maxAng;
        break;
      }

      case 'spin360': {
        const rps = Number(p.rotationsPerSec ?? 0.5);
        const cw = Number(p.clockwise ?? 1) >= 0.5 ? 1 : -1;
        const startAngle = Number(p.startAngle ?? 0);
        dRotZ += startAngle + timeSec * rps * 360 * cw;
        break;
      }

      case 'bounce': {
        const height = Number(p.height ?? 120);
        const bounciness = Math.max(0.1, Math.min(0.95, Number(p.bounciness ?? 0.65)));
        const count = Math.max(1, Math.round(Number(p.count ?? 4)));
        const cycle = (relSec * 0.85) % 1;
        const arc = Math.abs(Math.sin(cycle * Math.PI * count));
        const decay = Math.pow(bounciness, Math.floor(cycle * count));
        dY -= arc * height * decay;
        break;
      }

      case 'autoPan': {
        const sx = Number(p.speedX ?? 50);
        const sy = Number(p.speedY ?? 0);
        const ox = Number(p.offsetX ?? 0);
        const oy = Number(p.offsetY ?? 0);
        dX += ox + relSec * sx;
        dY += oy + relSec * sy;
        break;
      }

      case 'zoomLoop': {
        const speed = Number(p.speed ?? 1.8);
        const ease = String(p.ease || 'exponential').toLowerCase();
        const rawPhase = (relSec * speed * 0.5) % 1;
        let eased = rawPhase;
        if (ease === 'exponential') {
          eased = (Math.pow(2, rawPhase * 3) - 1) / 7;
        } else if (ease === 'smooth') {
          eased = rawPhase * rawPhase * (3 - 2 * rawPhase);
        }
        const zScale = 0.72 + eased * 0.72;
        dScaleX *= zScale;
        dScaleY *= zScale;
        break;
      }

      case 'snapPop': {
        const overshoot = Number(p.overshoot ?? 1.3);
        const dur = Math.max(0.05, Number(p.duration ?? 0.4));
        const t = Math.min(1, relSec / dur);
        if (t < 1) {
          const s =
            t < 0.6
              ? (t / 0.6) * overshoot
              : overshoot - ((t - 0.6) / 0.4) * (overshoot - 1);
          dScaleX *= Math.max(0.05, s);
          dScaleY *= Math.max(0.05, s);
        }
        break;
      }

      case 'flip3d': {
        const ang = Number(p.angle ?? 45);
        const axis = String(p.axis || 'y').toLowerCase();
        if (axis === 'y') dRotY += ang;
        else if (axis === 'x') dRotX += ang;
        else dRotZ += ang;
        if (p.perspective !== undefined) {
          const persp = Math.max(50, Math.min(4000, Number(p.perspective)));
          perspectiveOverride = 1000 + (persp - 1000) * Math.min(1, mixRatio);
        }
        break;
      }

      case 'box3d': {
        dRotX += Number(p.rotX ?? 25);
        dRotY += Number(p.rotY ?? -35);
        dRotZ += Number(p.rotZ ?? 0);
        break;
      }

      case 'isometric': {
        const ang = Number(p.angle ?? 30);
        dRotX += ang;
        dRotY += ang * 1.15;
        dScaleZ *= Number(p.scaleZ ?? 1);
        break;
      }

      case 'parallax': {
        const mult = Number(p.depthMultiplier ?? 2.0);
        const smoothing = Math.max(0, Math.min(1, Number(p.smoothing ?? 0.15)));
        const dampFreq = 1 / (1 + smoothing * 3);
        const ampScale = 1 - smoothing * 0.45;
        dX += Math.sin(timeSec * 1.2 * dampFreq) * 18 * mult * ampScale;
        dY += Math.cos(timeSec * 0.9 * dampFreq) * 12 * mult * ampScale;
        dRotY += Math.sin(timeSec * 1.2 * dampFreq) * 8 * mult * ampScale;
        dRotX += Math.cos(timeSec * 0.9 * dampFreq) * 5 * mult * ampScale;
        break;
      }

      case 'orbitCamera': {
        const speed = Number(p.speed ?? 1.5);
        const elev = Number(p.elevation ?? 20);
        const distance = Math.max(50, Number(p.distance ?? 400));
        const distScale = 400 / distance;
        dRotY += timeSec * speed * 45;
        dRotX += Math.sin(timeSec * speed * 0.7) * elev;
        dScaleX *= distScale;
        dScaleY *= distScale;
        dZ += (distance - 400) * 0.35;
        break;
      }

      case 'zFloat': {
        const zDepth = Number(p.zDepth ?? 180);
        const cycle = Math.max(0.1, Number(p.cycleDuration ?? 3.0));
        const bobbing = Number(p.bobbing ?? 20);
        dZ += Math.sin((timeSec / cycle) * Math.PI * 2) * (zDepth * 0.5);
        dY += Math.cos((timeSec / cycle) * Math.PI * 2) * bobbing;
        break;
      }

      case 'squeeze': {
        const amt = Number(p.amount ?? 0.4);
        const axis = String(p.axis || 'x').toLowerCase();
        if (axis === 'y') {
          dScaleX *= Math.max(0.05, 1 + amt * 0.5);
          dScaleY *= Math.max(0.05, 1 - amt * 0.5);
        } else {
          dScaleX *= Math.max(0.05, 1 - amt * 0.5);
          dScaleY *= Math.max(0.05, 1 + amt * 0.5);
        }
        break;
      }

      case 'fade': {
        const inDur = Number(p.inDuration ?? 0.5) * fps;
        const outDur = Number(p.outDuration ?? 0.5) * fps;
        const minOp = Math.max(0, Math.min(1, Number(p.minOpacity ?? 0)));
        const maxOp = Math.max(minOp, Math.min(1, Number(p.maxOpacity ?? 1)));
        const ease = String(p.ease || 'smooth').toLowerCase();
        const layerStart = layer.startFrame ?? 0;
        const layerEnd = layerStart + (layer.durationFrames ?? (settings.durationFrames || 90));
        let factor = 1;
        if (inDur > 0 && currentFrame < layerStart + inDur) {
          factor = Math.max(0, Math.min(1, (currentFrame - layerStart) / Math.max(1, inDur)));
        } else if (outDur > 0 && currentFrame > layerEnd - outDur) {
          factor = Math.max(0, Math.min(1, (layerEnd - currentFrame) / Math.max(1, outDur)));
        }
        if (ease === 'smooth') {
          factor = factor * factor * (3 - 2 * factor);
        } else if (ease === 'exponential') {
          factor = factor * factor;
        }
        dOp *= minOp + factor * (maxOp - minOp);
        break;
      }
    }

    extraX += dX * mixRatio;
    extraY += dY * mixRatio;
    extraZ += dZ * mixRatio;
    extraRotX += dRotX * mixRatio;
    extraRotY += dRotY * mixRatio;
    extraRotZ += dRotZ * mixRatio;
    extraScaleX *= Math.max(0.01, 1 + (dScaleX - 1) * mixRatio);
    extraScaleY *= Math.max(0.01, 1 + (dScaleY - 1) * mixRatio);
    extraScaleZ *= Math.max(0.01, 1 + (dScaleZ - 1) * mixRatio);
    effectOpacity *= Math.max(0, Math.min(1, 1 + (dOp - 1) * mixRatio));
  }

  return {
    extraX,
    extraY,
    extraZ,
    extraRotZ,
    extraRotX,
    extraRotY,
    extraScaleX,
    extraScaleY,
    extraScaleZ,
    effectOpacity,
    perspectiveOverride,
  };
}

/**
 * Applies EVERY visual/color/blur/distortion/edge/matte/procedural/retro shader effect
 * to an offscreen 2D canvas context (`offCtx`). Works uniformly for images, videos,
 * vectors, text, solids, particles, 3D models, adjustment layers, and effect thumbnails!
 */
export function applyCanvasEffects(
  offCtx: CanvasRenderingContext2D,
  effects: ShaderEffect[],
  width: number,
  height: number,
  frame: number,
  fps: number = 30,
  options?: { isTextLayer?: boolean; scratchCanvas?: HTMLCanvasElement; layerZ?: number }
): void {
  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));
  const activeEffects = (effects || []).filter(
    (e) => e.enabled && isCanvasVisualEffect(e.type, Boolean(options?.isTextLayer))
  );
  if (activeEffects.length === 0) return;

  const scratch =
    options?.scratchCanvas ||
    (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  if (!scratch) return;
  const sCtx = scratch.getContext('2d');
  if (!sCtx) return;

  const ensureScratch = () => {
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
    }
  };

  const copySrcToScratch = () => {
    ensureScratch();
    sCtx.setTransform(1, 0, 0, 1, 0, 0);
    sCtx.filter = 'none';
    sCtx.globalCompositeOperation = 'source-over';
    sCtx.globalAlpha = 1;
    sCtx.clearRect(0, 0, w, h);
    sCtx.drawImage(offCtx.canvas, 0, 0, w, h);
  };

  const applyFilterPass = (filterStr: string) => {
    copySrcToScratch();
    offCtx.save();
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, w, h);
    offCtx.filter = filterStr;
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.globalAlpha = 1;
    offCtx.drawImage(scratch, 0, 0, w, h);
    offCtx.restore();
  };

  const timeSec = frame / Math.max(1, fps);

  for (const effect of activeEffects) {
    const p = effect.params || {};
    const type = effect.type;
    const mixRatio = p.mix === undefined ? 1 : Math.max(0, Math.min(1, Number(p.mix) / 100));
    if (mixRatio <= 0.0005) continue;
    let preMixData: Uint8ClampedArray | null = null;
    if (mixRatio < 0.999) {
      const preImg = safeGetImageData(offCtx, w, h);
      preMixData = preImg ? new Uint8ClampedArray(preImg.data) : null;
    }

    switch (type) {
      // ==========================================
      // COLOR & LIGHT
      // ==========================================
      case 'brightness':
      case 'contrast': {
        const b = Number(p.brightness ?? 1.15);
        const c = Number(p.contrast ?? 1.2);
        const gamma = Math.max(0.1, Number(p.gamma ?? 1.0));
        applyFilterPass(`brightness(${b}) contrast(${c})`);
        if (Math.abs(gamma - 1.0) > 0.01) {
          const img = safeGetImageData(offCtx, w, h);
          if (img) {
            const d = img.data;
            const invG = 1 / gamma;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] === 0) continue;
              d[i] = Math.round(Math.pow(d[i] / 255, invG) * 255);
              d[i + 1] = Math.round(Math.pow(d[i + 1] / 255, invG) * 255);
              d[i + 2] = Math.round(Math.pow(d[i + 2] / 255, invG) * 255);
            }
            offCtx.putImageData(img, 0, 0);
          }
        }
        break;
      }

      case 'hue':
      case 'saturation': {
        const hue = Number(p.hue ?? 45);
        const sat = Number(p.saturation ?? 1.35);
        const light = Math.max(0, Number(p.lightness ?? 1.0));
        applyFilterPass(`hue-rotate(${hue}deg) saturate(${sat}) brightness(${light})`);
        break;
      }

      case 'colorGrading': {
        const hue = Number(p.hue ?? 0);
        const sat = Number(p.saturation ?? 1);
        const bri = Number(p.brightness ?? 1);
        const con = Number(p.contrast ?? 1);
        applyFilterPass(`hue-rotate(${hue}deg) saturate(${sat}) brightness(${bri}) contrast(${con})`);
        break;
      }

      case 'invert': {
        const amt = Math.max(0, Math.min(1, Number(p.amount ?? 1)));
        applyFilterPass(`invert(${amt})`);
        break;
      }

      case 'exposure': {
        const exp = Number(p.exposure ?? 0.25);
        const gamma = Math.max(0.1, Number(p.gamma ?? 1.0));
        const offset = Number(p.offset ?? 0) * 255;
        const gain = Math.pow(2, exp);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const invGamma = 1 / gamma;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            for (let c = 0; c < 3; c++) {
              let v = (d[i + c] / 255) * gain;
              v = Math.pow(Math.max(0, v), invGamma) * 255 + offset;
              d[i + c] = Math.max(0, Math.min(255, v));
            }
          }
          offCtx.putImageData(img, 0, 0);
        } else {
          applyFilterPass(`brightness(${gain.toFixed(2)})`);
        }
        break;
      }

      case 'colorTemp': {
        const temp = Number(p.temperature ?? 6500);
        const tint = Number(p.tint ?? 0);
        // True white-balance curve centered cleanly at 6500K:
        // < 6500K => warm golden amber (+R, subtle +G, -B)
        // > 6500K => cool daylight/cinema blue (-R, +B)
        const normShift =
          temp < 6500
            ? Math.min(1, (6500 - temp) / 4500)
            : -Math.min(1, (temp - 6500) / 5500);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const rMult = 1 + normShift * 0.24;
          const bMult = 1 - normShift * 0.26;
          const rAdd = normShift * 18;
          const bAdd = -normShift * 18;
          const gShift = tint * 1.1;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            d[i] = Math.max(0, Math.min(255, d[i] * rMult + rAdd));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + gShift + normShift * 5));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * bMult + bAdd));
          }
          offCtx.putImageData(img, 0, 0);
        } else {
          applyFilterPass(
            normShift >= 0
              ? `sepia(${(normShift * 0.4).toFixed(2)}) saturate(1.15)`
              : `hue-rotate(${Math.round(normShift * 25)}deg) saturate(1.05)`
          );
        }
        break;
      }

      case 'glow':
      case 'textGlow': {
        const color = String(p.color || '#00E5FF');
        const radius = Math.max(2, Number(p.radius ?? p.glowRadius ?? p.blur ?? 22));
        const intensity = Math.max(0.2, Number(p.intensity ?? 1.6));
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        // Draw colored aura via shadowBlur + bright additive glow overlay
        offCtx.shadowColor = color;
        offCtx.shadowBlur = radius;
        offCtx.globalCompositeOperation = 'screen';
        offCtx.globalAlpha = Math.min(1, 0.45 * intensity);
        offCtx.filter = `blur(${Math.max(2, radius * 0.45)}px)`;
        offCtx.drawImage(scratch, 0, 0, w, h);
        // Colored edge/aura tint
        offCtx.globalCompositeOperation = 'lighter';
        offCtx.globalAlpha = Math.min(0.75, 0.25 * intensity);
        offCtx.fillStyle = color;
        offCtx.shadowBlur = radius * 1.1;
        offCtx.drawImage(scratch, 0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'bloom': {
        const threshold = Math.max(0, Math.min(1, Number(p.threshold ?? 0.7)));
        const radius = Math.max(1, Number(p.radius ?? 20));
        const strength = Math.max(0, Number(p.strength ?? 1.4));
        const sat = Math.max(0, Number(p.saturation ?? 1.2));
        if (strength <= 0.01) break;
        copySrcToScratch();
        const img = safeGetImageData(sCtx, w, h);
        if (img) {
          const d = img.data;
          const tVal = threshold * 255;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            if (lum < tVal) {
              d[i + 3] = 0;
            } else {
              const k = Math.min(1, (lum - tVal) / Math.max(15, 255 - tVal));
              d[i + 3] = Math.round(d[i + 3] * k);
            }
          }
          sCtx.putImageData(img, 0, 0);
        }
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'screen';
        offCtx.globalAlpha = Math.min(1, strength * 0.65);
        offCtx.filter = `blur(${(radius * 0.55).toFixed(1)}px) saturate(${sat.toFixed(2)}) brightness(1.35)`;
        offCtx.drawImage(scratch, 0, 0, w, h);
        offCtx.globalCompositeOperation = 'lighter';
        offCtx.globalAlpha = Math.min(0.85, strength * 0.32);
        offCtx.filter = `blur(${radius.toFixed(1)}px) saturate(${sat.toFixed(2)}) brightness(1.5)`;
        offCtx.drawImage(scratch, 0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'rays': {
        const rayLength = Math.max(0.05, Math.min(1.5, Number(p.rayLength ?? 0.6)));
        const intensity = Math.max(0.1, Number(p.intensity ?? 2.0));
        const cx = (Number(p.x ?? 50) / 100) * w;
        const cy = (Number(p.y ?? 50) / 100) * h;
        const rayColor = p.color ? String(p.color) : '';
        copySrcToScratch();
        if (rayColor) {
          sCtx.save();
          sCtx.globalCompositeOperation = 'source-atop';
          sCtx.globalAlpha = 0.45;
          sCtx.fillStyle = rayColor;
          sCtx.fillRect(0, 0, w, h);
          sCtx.restore();
        }
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'lighter';
        offCtx.filter = 'brightness(1.3) contrast(1.35)';
        const steps = 12;
        for (let s = 1; s <= steps; s++) {
          const frac = (s / steps) * rayLength * 0.65;
          const sc = 1 + frac;
          offCtx.globalAlpha = (Math.min(0.48, 0.14 * intensity) * (steps - s + 1)) / steps;
          offCtx.setTransform(sc, 0, 0, sc, cx * (1 - sc), cy * (1 - sc));
          offCtx.drawImage(scratch, 0, 0, w, h);
        }
        offCtx.restore();
        break;
      }

      case 'solidColor': {
        const tint = String(p.tintColor || '#7C3AED');
        const blend = Math.max(0, Math.min(1, Number(p.blend ?? 0.65)));
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'source-atop';
        offCtx.globalAlpha = blend;
        offCtx.fillStyle = tint;
        offCtx.fillRect(0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'gradientOverlay':
      case 'textGradient': {
        const c1 = String(p.color1 || p.colorA || '#00E5FF');
        const c2 = String(p.color2 || p.colorB || '#7C3AED');
        const ang = (Number(p.angle ?? 45) * Math.PI) / 180;
        const op = Math.max(0, Math.min(1, Number(p.opacity ?? 0.72)));
        const dx = Math.cos(ang) * w * 0.5;
        const dy = Math.sin(ang) * h * 0.5;
        const grad = offCtx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'source-atop';
        offCtx.globalAlpha = op;
        offCtx.fillStyle = grad;
        offCtx.fillRect(0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'rgbSplit': {
        const rGain = Number(p.red ?? 1.2);
        const gGain = Number(p.green ?? 0.8);
        const bGain = Number(p.blue ?? 1.1);
        const offsetAdd = Number(p.offset ?? 0) * 255;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.max(0, Math.min(255, d[i] * rGain + offsetAdd));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * gGain + offsetAdd));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * bGain + offsetAdd));
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'posterize': {
        const levels = Math.max(2, Math.min(64, Math.round(Number(p.levels ?? 6))));
        const soft = Math.max(0, Math.min(1, Number(p.softness ?? 0)));
        const step = 255 / (levels - 1);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const qr = Math.round(d[i] / step) * step;
            const qg = Math.round(d[i + 1] / step) * step;
            const qb = Math.round(d[i + 2] / step) * step;
            d[i] = Math.round(qr * (1 - soft) + d[i] * soft);
            d[i + 1] = Math.round(qg * (1 - soft) + d[i + 1] * soft);
            d[i + 2] = Math.round(qb * (1 - soft) + d[i + 2] * soft);
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      // ==========================================
      // BLUR & DEFOCUS
      // ==========================================
      case 'blur':
      case 'boxBlur':
      case 'fastBlur': {
        const rad = Math.max(0, Number(p.radius ?? p.amount ?? 14));
        const quality = Math.max(1, Math.min(5, Math.round(Number(p.quality ?? 1))));
        if (rad > 0.05) {
          const passRad = rad / Math.sqrt(quality);
          for (let q = 0; q < quality; q++) {
            applyFilterPass(`blur(${passRad.toFixed(2)}px)`);
          }
        }
        break;
      }

      case 'gaussianBlur': {
        const rad = Math.max(0, Number(p.radius ?? 24));
        const quality = Math.max(1, Math.min(5, Math.round(Number(p.quality ?? 3))));
        if (rad > 0.05) {
          const passRad = rad / Math.sqrt(quality);
          for (let q = 0; q < quality; q++) {
            applyFilterPass(`blur(${passRad.toFixed(2)}px)`);
          }
        }
        break;
      }

      case 'maskFeather': {
        const feather = Math.max(0, Number(p.featherRadius ?? 25));
        const insetPct = Math.max(0, Math.min(45, Number(p.inset ?? 0))) / 100;
        const maxR = Math.min(w, h) * (0.5 - insetPct * 0.5);
        const innerR = Math.max(2, maxR - feather * 1.4);
        const outerR = Math.max(innerR + 2, maxR);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'destination-in';
        const grad = offCtx.createRadialGradient(w / 2, h / 2, innerR, w / 2, h / 2, outerR);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        offCtx.fillStyle = grad;
        offCtx.fillRect(0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'dof3d': {
        const focalDepth = Number(p.focalDepth ?? 0);
        const focalRange = Math.max(10, Number(p.focalRange ?? 150));
        const blurMax = Math.max(0, Number(p.blurMax ?? 22));
        const layerZ = options?.layerZ ?? focalDepth + focalRange * 1.6;
        const dist = Math.abs(layerZ - focalDepth);
        if (dist > focalRange && blurMax > 0.2) {
          const factor = Math.min(1, (dist - focalRange) / Math.max(40, focalRange));
          applyFilterPass(`blur(${(blurMax * factor).toFixed(1)}px)`);
        }
        break;
      }

      case 'lensBlur': {
        const rad = Math.max(0.5, Number(p.radius ?? 16));
        const bri = Number(p.brightness ?? 1.24);
        const blades = Math.max(3, Math.min(12, Math.round(Number(p.bladeCount ?? 6))));
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        // Polygonal bokeh aperture tap pattern matching bladeCount
        const tapRadius = rad * 0.35;
        offCtx.globalAlpha = 1 / blades;
        offCtx.filter = `blur(${(rad * 0.55).toFixed(1)}px)`;
        for (let b = 0; b < blades; b++) {
          const a = (b / blades) * Math.PI * 2;
          offCtx.drawImage(scratch, Math.cos(a) * tapRadius, Math.sin(a) * tapRadius, w, h);
        }
        if (bri > 0.85) {
          offCtx.globalCompositeOperation = 'lighter';
          offCtx.globalAlpha = Math.min(0.65, Math.max(0.08, (bri - 0.8) * 0.45));
          offCtx.filter = `blur(${(rad * 0.4).toFixed(1)}px) brightness(1.35) contrast(1.45)`;
          offCtx.drawImage(scratch, 0, 0, w, h);
        }
        offCtx.restore();
        break;
      }

      case 'bilateralBlur': {
        const rad = Math.max(1, Math.min(8, Math.round(Number(p.radius ?? 6) * 0.45)));
        const colorSigma = Math.max(12, Number(p.threshold ?? 0.25) * 140);
        const img = safeGetImageData(offCtx, w, h);
        if (img && w * h <= 450000) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const stepK = Math.max(1, Math.floor(rad / 2));
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const ci = (y * w + x) * 4;
              if (src[ci + 3] === 0) continue;
              const cr = src[ci];
              const cg = src[ci + 1];
              const cb = src[ci + 2];
              let sumR = 0;
              let sumG = 0;
              let sumB = 0;
              let wSum = 0;
              const y0 = Math.max(0, y - rad);
              const y1 = Math.min(h - 1, y + rad);
              const x0 = Math.max(0, x - rad);
              const x1 = Math.min(w - 1, x + rad);
              for (let ny = y0; ny <= y1; ny += stepK) {
                for (let nx = x0; nx <= x1; nx += stepK) {
                  const ni = (ny * w + nx) * 4;
                  const dr = src[ni] - cr;
                  const dg = src[ni + 1] - cg;
                  const db = src[ni + 2] - cb;
                  const cDist = Math.abs(dr) + Math.abs(dg) + Math.abs(db);
                  if (cDist > colorSigma * 2.2) continue;
                  const wght = Math.exp(-(cDist * cDist) / (2 * colorSigma * colorSigma));
                  sumR += src[ni] * wght;
                  sumG += src[ni + 1] * wght;
                  sumB += src[ni + 2] * wght;
                  wSum += wght;
                }
              }
              if (wSum > 0) {
                d[ci] = sumR / wSum;
                d[ci + 1] = sumG / wSum;
                d[ci + 2] = sumB / wSum;
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        } else {
          copySrcToScratch();
          offCtx.save();
          offCtx.setTransform(1, 0, 0, 1, 0, 0);
          offCtx.filter = `blur(${Math.min(12, rad * 0.75)}px)`;
          offCtx.globalAlpha = 0.65;
          offCtx.drawImage(scratch, 0, 0, w, h);
          offCtx.restore();
        }
        break;
      }

      case 'dirBlur':
      case 'motionBlur': {
        const strength = Math.max(0.5, Number(p.strength ?? 22));
        const ang = (Number(p.angle ?? 45) * Math.PI) / 180;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        const samples = 15;
        const half = Math.floor(samples / 2);
        offCtx.globalAlpha = 1 / samples;
        for (let s = -half; s <= half; s++) {
          const dist = (s / half) * (strength * 0.65);
          offCtx.drawImage(scratch, dx * dist, dy * dist, w, h);
        }
        offCtx.restore();
        break;
      }

      case 'radialBlur': {
        const amount = Math.max(0.5, Number(p.amount ?? 15));
        const cx = (Number(p.centerX ?? 50) / 100) * w;
        const cy = (Number(p.centerY ?? 50) / 100) * h;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        const samples = 15;
        const maxRad = (amount * Math.PI) / 180;
        offCtx.globalAlpha = 1 / samples;
        for (let s = 0; s < samples; s++) {
          const t = (s / (samples - 1) - 0.5) * maxRad;
          offCtx.save();
          offCtx.translate(cx, cy);
          offCtx.rotate(t);
          offCtx.drawImage(scratch, -cx, -cy, w, h);
          offCtx.restore();
        }
        offCtx.restore();
        break;
      }

      case 'zoomBlur': {
        const strength = Math.max(0.5, Number(p.strength ?? 25));
        const cx = (Number(p.centerX ?? 50) / 100) * w;
        const cy = (Number(p.centerY ?? 50) / 100) * h;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        const samples = 14;
        const maxZoom = Math.min(0.55, strength / 110);
        offCtx.globalAlpha = 1 / samples;
        for (let s = 0; s < samples; s++) {
          const sc = 1 + (s / (samples - 1)) * maxZoom;
          offCtx.setTransform(sc, 0, 0, sc, cx * (1 - sc), cy * (1 - sc));
          offCtx.drawImage(scratch, 0, 0, w, h);
        }
        offCtx.restore();
        break;
      }

      case 'channelBlur': {
        const rBlur = Math.max(0, Number(p.redBlur ?? 15));
        const gBlur = Math.max(0, Number(p.greenBlur ?? 0));
        const bBlur = Math.max(0, Number(p.blueBlur ?? 8));
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const copy = new Uint8ClampedArray(d);
          const rOff = Math.round(rBlur * 0.4);
          const gOff = Math.round(gBlur * 0.4);
          const bOff = Math.round(bBlur * 0.4);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              if (rOff > 0) {
                const rx1 = Math.max(0, x - rOff);
                const rx2 = Math.min(w - 1, x + rOff);
                d[idx] = Math.round((copy[idx] + copy[(y * w + rx1) * 4] + copy[(y * w + rx2) * 4]) / 3);
              }
              if (gOff > 0) {
                const gy1 = Math.max(0, y - gOff);
                const gy2 = Math.min(h - 1, y + gOff);
                d[idx + 1] = Math.round((copy[idx + 1] + copy[(gy1 * w + x) * 4 + 1] + copy[(gy2 * w + x) * 4 + 1]) / 3);
              }
              if (bOff > 0) {
                const bx1 = Math.max(0, x - bOff);
                const bx2 = Math.min(w - 1, x + bOff);
                d[idx + 2] = Math.round((copy[idx + 2] + copy[(y * w + bx1) * 4 + 2] + copy[(y * w + bx2) * 4 + 2]) / 3);
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'sharpen': {
        const amount = Math.max(0, Math.min(4, Number(p.amount ?? 1.8)));
        const stepR = Math.max(1, Math.min(5, Math.round(Number(p.radius ?? 1.5))));
        if (amount <= 0.01) break;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const k = amount * 0.65;
          for (let y = stepR; y < h - stepR; y++) {
            for (let x = stepR; x < w - stepR; x++) {
              const i = (y * w + x) * 4;
              if (src[i + 3] === 0) continue;
              const up = ((y - stepR) * w + x) * 4;
              const dn = ((y + stepR) * w + x) * 4;
              const lf = (y * w + (x - stepR)) * 4;
              const rt = (y * w + (x + stepR)) * 4;
              for (let c = 0; c < 3; c++) {
                const blurAvg = (src[up + c] + src[dn + c] + src[lf + c] + src[rt + c]) * 0.25;
                d[i + c] = Math.max(0, Math.min(255, src[i + c] + (src[i + c] - blurAvg) * k * 2.2));
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      // ==========================================
      // DISTORTION / WARP
      // ==========================================
      case 'wave':
      case 'textWave': {
        const amp = Number(p.amplitude ?? p.waveHeight ?? 14);
        const freq = Number(p.frequency ?? (p.wavelength ? 1 / Math.max(1, Number(p.wavelength)) * 0.2 : 0.045));
        const speed = Number(p.speed ?? p.waveSpeed ?? 3.5);
        const ang = (Number(p.angle ?? 0) * Math.PI) / 180;
        const phase = timeSec * speed * Math.PI * 2;
        const dirX = Math.cos(ang);
        const dirY = Math.sin(ang);
        const perpX = -dirY;
        const perpY = dirX;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const proj = x * perpX + y * perpY;
              const disp = Math.sin(proj * freq + phase) * amp;
              const fx = x - dirX * disp;
              const fy = y - dirY * disp;
              writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'bend': {
        const curvature = Number(p.curvature ?? 45);
        const dirRad = ((Number(p.direction ?? 90) - 90) * Math.PI) / 180;
        const cosD = Math.cos(dirRad);
        const sinD = Math.sin(dirRad);
        const shift = (curvature / 100) * (Math.min(w, h) * 0.35);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const cx = w / 2;
          const cy = h / 2;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              const dy = y - cy;
              const rx = dx * cosD + dy * sinD;
              const ry = -dx * sinD + dy * cosD;
              const normY = ry / (h * 0.5);
              const bendDisp = (normY * normY - 0.5) * shift;
              const sxLocal = rx - bendDisp;
              const fx = cx + sxLocal * cosD - ry * sinD;
              const fy = cy + sxLocal * sinD + ry * cosD;
              writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'stretchAxis': {
        const scale = Math.max(0.3, Number(p.scale ?? 1.6));
        const ang = (Number(p.angle ?? 45) * Math.PI) / 180;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        offCtx.translate(w / 2, h / 2);
        offCtx.rotate(ang);
        offCtx.scale(scale, 1 / Math.sqrt(scale));
        offCtx.rotate(-ang);
        offCtx.drawImage(scratch, -w / 2, -h / 2, w, h);
        offCtx.restore();
        break;
      }

      case 'bulge':
      case 'pinchBulge': {
        const radiusRatio = Math.min(0.98, Math.max(0.15, (Number(p.radius ?? 120) / Math.max(w, h, 200)) * 1.4));
        const strength = Number(p.strength ?? 0.65);
        const cx = ((Number(p.centerX ?? 50)) / 100) * w;
        const cy = ((Number(p.centerY ?? 50)) / 100) * h;
        const rMax = Math.min(w, h) * 0.48 * Math.max(0.45, radiusRatio);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              const dy = y - cy;
              const dist = Math.hypot(dx, dy);
              if (dist < rMax && dist > 0.001) {
                const nd = dist / rMax;
                const factor = Math.pow(nd, Math.max(0.08, 1 + strength));
                const fx = cx + (dx / dist) * factor * rMax;
                const fy = cy + (dy / dist) * factor * rMax;
                writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'sphere3d': {
        const radiusRatio = Math.min(0.95, Math.max(0.25, Number(p.radius ?? 140) / 300));
        const rotYRad = ((Number(p.rotY ?? 45) % 360) / 360);
        const lightRad = (Number(p.lightAngle ?? 60) * Math.PI) / 180;
        const lx = Math.cos(lightRad);
        const ly = -Math.sin(lightRad);
        const cx = w / 2;
        const cy = h / 2;
        const rMax = Math.min(w, h) * 0.46 * Math.max(0.45, radiusRatio);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const nx = (x - cx) / rMax;
              const ny = (y - cy) / rMax;
              const r2 = nx * nx + ny * ny;
              const di = (y * w + x) * 4;
              if (r2 <= 1) {
                const nz = Math.sqrt(Math.max(0, 1 - r2));
                // Spherical UV unwrap + longitude spin by rotY
                const uRaw = 0.5 + Math.atan2(nx, nz) / Math.PI + rotYRad;
                const u = ((uRaw % 1) + 1) % 1;
                const v = 0.5 + Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;
                writeBilinearSample(src, d, di, w, h, u * (w - 1), v * (h - 1));
                const shade = Math.max(0.32, Math.min(1.35, 0.55 + (nx * lx + ny * ly + nz * 0.65) * 0.55));
                d[di] = Math.min(255, Math.round(d[di] * shade));
                d[di + 1] = Math.min(255, Math.round(d[di + 1] * shade));
                d[di + 2] = Math.min(255, Math.round(d[di + 2] * shade));
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'cylinder3d': {
        const radCurve = Math.max(0.35, Math.min(1.6, 160 / Math.max(50, Number(p.radius ?? 160))));
        const rotPhase = (((Number(p.rotation ?? 30) % 360) + 360) % 360) / 360;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        const cols = 72;
        const colW = w / cols;
        for (let i = 0; i < cols; i++) {
          const u = (i / (cols - 1)) * 2 - 1;
          const compress = Math.cos(u * Math.min(1.25, 0.85 * radCurve));
          const xCenter = (u * 0.85 * 0.5 + 0.5) * w;
          const dstW = colW * Math.max(0.22, compress) * 1.15;
          const sx = (((i / cols + rotPhase) % 1) * w);
          const safeSw = Math.min(colW + 0.5, w - sx);
          offCtx.globalAlpha = 0.5 + 0.5 * compress;
          offCtx.drawImage(scratch, sx, 0, Math.max(1, safeSw), h, xCenter - dstW / 2, 0, dstW, h);
        }
        offCtx.restore();
        break;
      }

      case 'ripple': {
        const freq = Number(p.frequency ?? 12);
        const amp = Number(p.amplitude ?? 10);
        const speed = Number(p.speed ?? 4);
        const cx = ((Number(p.centerX ?? 50)) / 100) * w;
        const cy = ((Number(p.centerY ?? 50)) / 100) * h;
        const maxR = Math.max(20, Math.hypot(w, h) * (Number(p.radius ?? 180) / 360));
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const phase = timeSec * speed * 3;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              const dy = y - cy;
              const dist = Math.hypot(dx, dy);
              if (dist > 0.01 && dist < maxR) {
                const attenuation = Math.max(0, 1 - dist / maxR);
                const waveOffset = Math.sin((dist / maxR) * freq * Math.PI - phase) * amp * attenuation;
                const fx = x + (dx / dist) * waveOffset;
                const fy = y + (dy / dist) * waveOffset;
                writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'swirl': {
        const angDeg = Number(p.angle ?? 180);
        const maxRadAng = (angDeg * Math.PI) / 180;
        const cx = ((Number(p.centerX ?? 50)) / 100) * w;
        const cy = ((Number(p.centerY ?? 50)) / 100) * h;
        const radScale = Math.min(1.0, Math.max(0.15, Number(p.radius ?? 150) / 300));
        const rMax = Math.min(w, h) * 0.55 * radScale;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              const dy = y - cy;
              const dist = Math.hypot(dx, dy);
              if (dist < rMax) {
                const percent = (rMax - dist) / rMax;
                const theta = percent * percent * maxRadAng;
                const cosT = Math.cos(theta);
                const sinT = Math.sin(theta);
                const fx = cx + dx * cosT - dy * sinT;
                const fy = cy + dx * sinT + dy * cosT;
                writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'mirror': {
        const angleRad = (Number(p.angle ?? 90) * Math.PI) / 180;
        const offsetPx = (Number(p.offset ?? 0) / 100) * Math.min(w, h) * 0.45;
        const nx = Math.cos(angleRad);
        const ny = Math.sin(angleRad);
        const cx = w / 2 + nx * offsetPx;
        const cy = h / 2 + ny * offsetPx;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const signedDist = (x - cx) * nx + (y - cy) * ny;
              if (signedDist > 0) {
                const fx = x - 2 * signedDist * nx;
                const fy = y - 2 * signedDist * ny;
                writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'polar': {
        const polarType = String(p.type || 'rectToPolar');
        const interp = Math.max(0, Math.min(1, Number(p.interpolation ?? 1.0)));
        if (interp <= 0.005) break;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const cx = w / 2;
          const cy = h / 2;
          const maxR = Math.min(cx, cy);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              let targetX = x;
              let targetY = y;
              if (polarType === 'polarToRect') {
                const theta = (x / Math.max(1, w - 1)) * Math.PI * 2;
                const r = (y / Math.max(1, h - 1)) * maxR;
                targetX = cx + Math.cos(theta) * r;
                targetY = cy + Math.sin(theta) * r;
              } else {
                const dx = x - cx;
                const dy = y - cy;
                const r = Math.hypot(dx, dy);
                let theta = Math.atan2(dy, dx);
                if (theta < 0) theta += Math.PI * 2;
                targetX = (theta / (Math.PI * 2)) * (w - 1);
                targetY = (r / Math.max(1, maxR)) * (h - 1);
              }
              const fx = x + (targetX - x) * interp;
              const fy = y + (targetY - y) * interp;
              writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'glass': {
        const rough = Math.max(1, Number(p.roughness ?? 12));
        const ior = Math.max(1.0, Number(p.refractiveIndex ?? 1.4));
        const disp = (ior - 1.0) * 1.65;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const ox = Math.sin(x * 0.16 + y * 0.05) * rough * 0.52 * disp;
              const oy = Math.cos(y * 0.16 - x * 0.05) * rough * 0.52 * disp;
              const di = (y * w + x) * 4;
              writeBilinearSample(src, d, di, w, h, x + ox, y + oy);
              const glint = Math.min(35, Math.round(disp * 10));
              d[di] = Math.min(255, d[di] + glint * 0.6);
              d[di + 1] = Math.min(255, d[di + 1] + glint * 0.9);
              d[di + 2] = Math.min(255, d[di + 2] + glint * 1.2);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'pixelate': {
        const blockSize = Math.max(1, Math.min(128, Number(p.size ?? p.blockSize ?? 14)));
        if (blockSize <= 1.2) break;
        const cxPct = (Number(p.centerX ?? 50) - 50) * 0.01;
        const cyPct = (Number(p.centerY ?? 50) - 50) * 0.01;
        const smallW = Math.max(2, Math.round(w / blockSize));
        const smallH = Math.max(2, Math.round(h / blockSize));
        ensureScratch();
        sCtx.save();
        sCtx.setTransform(1, 0, 0, 1, 0, 0);
        sCtx.clearRect(0, 0, w, h);
        sCtx.imageSmoothingEnabled = true;
        sCtx.drawImage(offCtx.canvas, cxPct * blockSize, cyPct * blockSize, w, h, 0, 0, smallW, smallH);
        sCtx.restore();

        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(scratch, 0, 0, smallW, smallH, 0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'displaceMap': {
        const maxH = Number(p.maxHorizontal ?? 20);
        const maxV = Number(p.maxVertical ?? 20);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const lum = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255 - 0.5;
              const fx = x + lum * maxH * 2;
              const fy = y + lum * maxV * 2;
              writeBilinearSample(src, d, i, w, h, fx, fy);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'turbulent': {
        const amt = Number(p.amount ?? 25);
        const cellSize = Math.max(8, Number(p.size ?? 60));
        const freq = (Math.PI * 2) / cellSize;
        const speed = Number(p.speed ?? 2.5);
        const phase = timeSec * speed * 2;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const nx =
                Math.sin(y * freq + phase) * 0.55 +
                Math.cos(x * freq * 1.4 - phase * 1.3) * 0.3 +
                Math.sin((x + y) * freq * 2.1 + phase * 2.0) * 0.15;
              const ny =
                Math.cos(x * freq - phase) * 0.55 +
                Math.sin(y * freq * 1.4 + phase * 1.2) * 0.3;
              writeBilinearSample(src, d, (y * w + x) * 4, w, h, x + nx * amt * 0.55, y + ny * amt * 0.55);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'pageCurl': {
        const progress = Math.max(5, Math.min(85, Number(p.progress ?? 35))) / 100;
        const corner = String(p.corner || 'bottom-right');
        const foldSize = Math.min(w, h) * (0.22 + progress * 0.48);
        const isLeft = corner.includes('left');
        const isTop = corner.includes('top');
        const cx = isLeft ? 0 : w;
        const cy = isTop ? 0 : h;
        const sx = isLeft ? 1 : -1;
        const sy = isTop ? 1 : -1;
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        // Clear peeled corner
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.beginPath();
        offCtx.moveTo(cx, cy);
        offCtx.lineTo(cx + sx * foldSize, cy);
        offCtx.lineTo(cx, cy + sy * foldSize);
        offCtx.closePath();
        offCtx.fill();

        // Rolled back-side curl flap
        offCtx.globalCompositeOperation = 'source-over';
        const grad = offCtx.createLinearGradient(
          cx + sx * foldSize,
          cy + sy * foldSize,
          cx + sx * foldSize * 0.2,
          cy + sy * foldSize * 0.2
        );
        grad.addColorStop(0, '#E2E8F0');
        grad.addColorStop(0.55, '#94A3B8');
        grad.addColorStop(1, '#334155');
        offCtx.fillStyle = grad;
        offCtx.shadowColor = 'rgba(0,0,0,0.6)';
        offCtx.shadowBlur = 12;
        offCtx.beginPath();
        offCtx.moveTo(cx + sx * foldSize, cy);
        offCtx.lineTo(cx, cy + sy * foldSize);
        offCtx.lineTo(cx + sx * foldSize * 0.85, cy + sy * foldSize * 0.85);
        offCtx.closePath();
        offCtx.fill();
        offCtx.restore();
        break;
      }

      // ==========================================
      // DRAWING & EDGE
      // ==========================================
      case 'findEdges': {
        const edgeHex = String(p.color || '#00E676');
        const thresh = Math.max(0.01, Number(p.threshold ?? 0.12)) * 220;
        const invert = Number(p.invert ?? 1) >= 0.5;
        const glowAmt = Math.max(0, Number(p.glow ?? 1.5));
        const rgb = hexToRgb(edgeHex);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const lum = (x: number, y: number) => {
            const idx = (y * w + x) * 4;
            return src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
          };
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = (y * w + x) * 4;
              if (src[i + 3] === 0) continue;
              const tl = lum(x - 1, y - 1);
              const tc = lum(x, y - 1);
              const tr = lum(x + 1, y - 1);
              const ml = lum(x - 1, y);
              const mr = lum(x + 1, y);
              const bl = lum(x - 1, y + 1);
              const bc = lum(x, y + 1);
              const br = lum(x + 1, y + 1);
              const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
              const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
              const mag = Math.hypot(gx, gy) * 0.55;
              const edge = mag > thresh ? Math.min(1, ((mag - thresh) / 145) * (0.7 + glowAmt * 0.35)) : 0;
              if (invert) {
                d[i] = Math.min(255, Math.round(rgb.r * edge + 8));
                d[i + 1] = Math.min(255, Math.round(rgb.g * edge + 10));
                d[i + 2] = Math.min(255, Math.round(rgb.b * edge + 13));
              } else {
                d[i] = Math.max(0, Math.round(244 - edge * (244 - rgb.r * 0.35)));
                d[i + 1] = Math.max(0, Math.round(246 - edge * (246 - rgb.g * 0.35)));
                d[i + 2] = Math.max(0, Math.round(249 - edge * (249 - rgb.b * 0.35)));
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
          if (glowAmt > 0.1 && invert) {
            copySrcToScratch();
            offCtx.save();
            offCtx.setTransform(1, 0, 0, 1, 0, 0);
            offCtx.globalCompositeOperation = 'lighter';
            offCtx.globalAlpha = Math.min(0.85, glowAmt * 0.32);
            offCtx.filter = `blur(${Math.max(2, glowAmt * 4)}px)`;
            offCtx.drawImage(scratch, 0, 0, w, h);
            offCtx.restore();
          }
        }
        break;
      }

      case 'glowEdges': {
        const col = String(p.color || '#00E5FF');
        const thresh = Math.max(0, Number(p.threshold ?? 0.25)) * 180;
        const width = Math.max(1, Math.min(16, Number(p.width ?? 4)));
        const glowMult = Math.max(0.1, Number(p.glow ?? 2.0));
        const rgb = hexToRgb(col);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const lum = (x: number, y: number) => {
            const idx = (y * w + x) * 4;
            return src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
          };
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = (y * w + x) * 4;
              if (src[i + 3] === 0) continue;
              const gx = -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) + lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
              const gy = -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) + lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
              const rawEdge = Math.hypot(gx, gy) * 0.48;
              const edge = rawEdge > thresh ? Math.min(1, ((rawEdge - thresh) / Math.max(30, 255 - thresh)) * glowMult * 0.7) : 0;
              d[i] = Math.min(255, Math.round(src[i] * 0.55 + edge * rgb.r));
              d[i + 1] = Math.min(255, Math.round(src[i + 1] * 0.55 + edge * rgb.g));
              d[i + 2] = Math.min(255, Math.round(src[i + 2] * 0.55 + edge * rgb.b));
            }
          }
          offCtx.putImageData(img, 0, 0);
          if (width > 1.5) {
            copySrcToScratch();
            offCtx.save();
            offCtx.setTransform(1, 0, 0, 1, 0, 0);
            offCtx.globalCompositeOperation = 'lighter';
            offCtx.globalAlpha = Math.min(0.65, glowMult * 0.2);
            offCtx.filter = `blur(${width}px)`;
            offCtx.drawImage(scratch, 0, 0, w, h);
            offCtx.restore();
          }
        }
        break;
      }

      case 'stroke': {
        const sw = Math.max(0.5, Math.min(32, Number(p.strokeWidth ?? 6)));
        const sc = String(p.strokeColor || '#FACC15');
        const op = Math.max(0, Math.min(1, Number(p.opacity ?? 1.0)));
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        if (op > 0.01) {
          offCtx.globalAlpha = op;
          offCtx.shadowColor = sc;
          offCtx.shadowBlur = 1;
          for (let a = 0; a < 8; a++) {
            const rad = (a * Math.PI) / 4;
            offCtx.shadowOffsetX = Math.cos(rad) * sw;
            offCtx.shadowOffsetY = Math.sin(rad) * sw;
            offCtx.drawImage(scratch, 0, 0, w, h);
          }
          offCtx.strokeStyle = sc;
          offCtx.lineWidth = Math.max(1.5, sw * 0.7);
          offCtx.strokeRect(sw * 0.35, sw * 0.35, w - sw * 0.7, h - sw * 0.7);
        }
        offCtx.globalAlpha = 1;
        offCtx.shadowColor = 'transparent';
        offCtx.drawImage(scratch, 0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'dropShadow':
      case 'longShadow':
      case 'extrude3d':
      case 'box3d': {
        const ang =
          type === 'box3d'
            ? (Math.atan2(Number(p.rotX ?? 25), Number(p.rotY ?? -35) || 1))
            : (Number(p.angle ?? 45) * Math.PI) / 180;
        const len =
          type === 'dropShadow'
            ? Number(p.blur ?? 16)
            : type === 'box3d'
            ? Math.min(60, Number(p.depth ?? 150) * 0.24)
            : Number(p.length ?? p.depth ?? 32);
        const ox = type === 'dropShadow' ? Number(p.offsetX ?? 8) : Math.cos(ang) * Math.min(64, len * 0.42);
        const oy = type === 'dropShadow' ? Number(p.offsetY ?? 10) : Math.sin(ang) * Math.min(64, len * 0.42);
        const shOp = Math.max(0, Math.min(1, Number(p.opacity ?? 0.65)));
        const shRgb = hexToRgb(String(p.shadowColor || '#000000'));
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        if (type === 'dropShadow') {
          offCtx.shadowColor = `rgba(${shRgb.r},${shRgb.g},${shRgb.b},${shOp})`;
          offCtx.shadowBlur = Math.max(1, len * 0.75);
          offCtx.shadowOffsetX = ox;
          offCtx.shadowOffsetY = oy;
          offCtx.drawImage(scratch, 0, 0, w, h);
        } else if (type === 'longShadow') {
          const steps = 16;
          const useFade = Number(p.fade ?? 1) >= 0.5;
          for (let s = steps; s >= 1; s--) {
            const k = s / steps;
            offCtx.globalAlpha = useFade ? shOp * 0.28 * (1 - k * 0.85) : shOp * 0.35;
            offCtx.shadowColor = `rgb(${shRgb.r},${shRgb.g},${shRgb.b})`;
            offCtx.shadowBlur = 0;
            offCtx.shadowOffsetX = ox * k;
            offCtx.shadowOffsetY = oy * k;
            offCtx.drawImage(scratch, 0, 0, w, h);
          }
          offCtx.globalAlpha = 1;
          offCtx.shadowColor = 'transparent';
          offCtx.drawImage(scratch, 0, 0, w, h);
        } else {
          // extrude3d & box3d extrusion walls with bevel and lightIntensity
          const bevel = Math.max(0, Number(p.bevel ?? 3));
          const lightInt = Math.max(0.2, Number(p.lightIntensity ?? 1.3));
          const steps = 14;
          for (let s = steps; s >= 1; s--) {
            const k = s / steps;
            offCtx.globalAlpha = 0.65;
            offCtx.filter = `brightness(${Math.max(0.15, (0.32 + (1 - k) * 0.3) * lightInt)})`;
            offCtx.drawImage(scratch, ox * k, oy * k, w, h);
          }
          offCtx.globalAlpha = 1;
          offCtx.filter = lightInt !== 1 && type === 'extrude3d' ? `brightness(${Math.min(1.6, 0.7 + lightInt * 0.3)})` : 'none';
          offCtx.drawImage(scratch, 0, 0, w, h);
          if (bevel > 0.2) {
            offCtx.filter = 'none';
            offCtx.strokeStyle = `rgba(255,255,255,${Math.min(0.65, 0.2 * lightInt)})`;
            offCtx.lineWidth = Math.min(8, bevel);
            offCtx.strokeRect(bevel * 0.5, bevel * 0.5, w - bevel, h - bevel);
          }
        }
        offCtx.restore();
        break;
      }

      case 'celShading': {
        const bands = Math.max(2, Math.min(12, Math.round(Number(p.bands ?? 4))));
        const edgeThresh = Math.max(12, (1 - Math.max(0, Math.min(0.92, Number(p.edgeThreshold ?? 0.3)))) * 110);
        const inkRadius = Math.max(0, Math.min(4, Math.round(Number(p.inkWidth ?? 2) * 0.5)));
        const inkRgb = hexToRgb(String(p.inkColor || '#101014'));
        const step = 255 / bands;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const lum = (x: number, y: number) => {
            const cx = Math.max(0, Math.min(w - 1, x));
            const cy = Math.max(0, Math.min(h - 1, y));
            const idx = (cy * w + cx) * 4;
            return src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
          };
          const edges = new Uint8Array(w * h);
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const gx = Math.abs(lum(x + 1, y) - lum(x - 1, y));
              const gy = Math.abs(lum(x, y + 1) - lum(x, y - 1));
              if (gx + gy > edgeThresh) edges[y * w + x] = 1;
            }
          }
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = (y * w + x) * 4;
              if (src[i + 3] === 0) continue;
              let isInk = edges[y * w + x] === 1;
              if (!isInk && inkRadius > 0) {
                for (let oy = -inkRadius; oy <= inkRadius && !isInk; oy++) {
                  for (let ox = -inkRadius; ox <= inkRadius; ox++) {
                    const nx = Math.max(0, Math.min(w - 1, x + ox));
                    const ny = Math.max(0, Math.min(h - 1, y + oy));
                    if (edges[ny * w + nx]) {
                      isInk = true;
                      break;
                    }
                  }
                }
              }
              if (isInk && Number(p.inkWidth ?? 2) > 0.2) {
                d[i] = inkRgb.r;
                d[i + 1] = inkRgb.g;
                d[i + 2] = inkRgb.b;
              } else {
                d[i] = Math.min(255, Math.round(src[i] / step) * step);
                d[i + 1] = Math.min(255, Math.round(src[i + 1] / step) * step);
                d[i + 2] = Math.min(255, Math.round(src[i + 2] / step) * step);
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'emboss': {
        const depth = Math.max(1, Math.min(12, Math.round(Number(p.depth ?? 4))));
        const angRad = (Number(p.angle ?? 135) * Math.PI) / 180;
        const ox = Math.round(Math.cos(angRad) * depth);
        const oy = Math.round(Math.sin(angRad) * depth);
        const contrast = Number(p.contrast ?? 1.5);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              if (src[i + 3] === 0) continue;
              const x1 = Math.max(0, Math.min(w - 1, x - ox));
              const y1 = Math.max(0, Math.min(h - 1, y - oy));
              const x2 = Math.max(0, Math.min(w - 1, x + ox));
              const y2 = Math.max(0, Math.min(h - 1, y + oy));
              const p1 = (y1 * w + x1) * 4;
              const p2 = (y2 * w + x2) * 4;
              const diffR = (src[p2] - src[p1]) * contrast;
              const diffG = (src[p2 + 1] - src[p1 + 1]) * contrast;
              const diffB = (src[p2 + 2] - src[p1 + 2]) * contrast;
              const gray = Math.max(0, Math.min(255, 128 + (diffR + diffG + diffB) * 0.45));
              d[i] = gray;
              d[i + 1] = gray;
              d[i + 2] = Math.min(255, gray + 6);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'sketch': {
        const intensity = Number(p.strokeIntensity ?? 1.4);
        const paperLum = Math.round(140 + Math.max(0, Math.min(1, Number(p.paperTone ?? 0.9))) * 112);
        const edgeFloor = Math.max(0, Math.min(1, Number(p.threshold ?? 0.1))) * 120;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const lum = (x: number, y: number) => {
            const idx = (y * w + x) * 4;
            return src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114;
          };
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = (y * w + x) * 4;
              if (src[i + 3] === 0) continue;
              const gx = -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) + lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
              const gy = -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) + lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
              const rawGrad = Math.hypot(gx, gy) * 0.65;
              const grad = rawGrad > edgeFloor ? rawGrad - edgeFloor : 0;
              const v = Math.max(14, Math.min(paperLum, paperLum - grad * intensity));
              d[i] = v;
              d[i + 1] = Math.max(0, v - 3);
              d[i + 2] = Math.max(0, v - 8);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'halftone': {
        const spacing = Math.max(3, Math.min(36, Math.round(Number(p.dotRadius ?? 6) * 1.5)));
        const angRad = (Number(p.angle ?? 45) * Math.PI) / 180;
        const contrast = Math.max(0.2, Number(p.contrast ?? 1.0));
        const cosA = Math.cos(angRad);
        const sinA = Math.sin(angRad);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const src = img.data;
          const cx = w * 0.5;
          const cy = h * 0.5;
          const diag = Math.ceil(Math.hypot(w, h) * 0.6);
          offCtx.save();
          offCtx.setTransform(1, 0, 0, 1, 0, 0);
          offCtx.fillStyle = '#0F1115';
          offCtx.fillRect(0, 0, w, h);
          for (let gy = -diag; gy <= diag; gy += spacing) {
            for (let gx = -diag; gx <= diag; gx += spacing) {
              const px = Math.round(cx + gx * cosA - gy * sinA);
              const py = Math.round(cy + gx * sinA + gy * cosA);
              if (px < 0 || px >= w || py < 0 || py >= h) continue;
              const idx = (py * w + px) * 4;
              if (src[idx + 3] < 20) continue;
              const rawLum = (src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114) / 255;
              const lum = Math.max(0.05, Math.min(1.2, (rawLum - 0.5) * contrast + 0.5));
              const r = Math.max(0.6, lum * spacing * 0.54);
              offCtx.fillStyle = `rgb(${src[idx]},${src[idx + 1]},${src[idx + 2]})`;
              offCtx.beginPath();
              offCtx.arc(px, py, r, 0, Math.PI * 2);
              offCtx.fill();
            }
          }
          offCtx.restore();
        }
        break;
      }

      case 'innerGlow': {
        const size = Math.max(4, Number(p.size ?? 18));
        const col = String(p.color || '#A855F7');
        const op = Math.max(0.05, Math.min(1, Number(p.opacity ?? 0.85)));
        const rgb = hexToRgb(col);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'source-atop';
        const grad = offCtx.createRadialGradient(
          w / 2,
          h / 2,
          Math.max(2, Math.min(w, h) * 0.48 - size * 1.5),
          w / 2,
          h / 2,
          Math.max(w, h) * 0.62
        );
        grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},${op})`);
        offCtx.fillStyle = grad;
        offCtx.fillRect(0, 0, w, h);
        offCtx.restore();
        break;
      }

      // ==========================================
      // REPEAT
      // ==========================================
      case 'tiles':
      case 'mirrorTiles': {
        const countX = Math.min(8, Math.max(1, Math.floor(Number(p.countX ?? p.tilesX ?? 3))));
        const countY = Math.min(8, Math.max(1, Math.floor(Number(p.countY ?? p.tilesY ?? countX))));
        const mirror = p.mirror !== 0;
        const tileW = w / countX;
        const tileH = h / countY;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        for (let ix = 0; ix < countX; ix++) {
          for (let iy = 0; iy < countY; iy++) {
            offCtx.save();
            offCtx.translate(ix * tileW + tileW / 2, iy * tileH + tileH / 2);
            if (mirror && ix % 2 === 1) offCtx.scale(-1, 1);
            if (mirror && iy % 2 === 1) offCtx.scale(1, -1);
            offCtx.drawImage(scratch, -tileW / 2, -tileH / 2, tileW, tileH);
            offCtx.restore();
          }
        }
        offCtx.restore();
        break;
      }

      case 'offsetRepeat': {
        const cols = Math.min(8, Math.max(1, Math.floor(Number(p.columns ?? 3))));
        const rows = Math.min(8, Math.max(1, Math.floor(Number(p.rows ?? 3))));
        const stagger = Number(p.staggerRatio ?? 0.5);
        const tileW = w / cols;
        const tileH = h / rows;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        for (let r = 0; r < rows; r++) {
          const offsetX = r % 2 === 1 ? tileW * stagger : 0;
          for (let c = -1; c <= cols; c++) {
            offCtx.drawImage(scratch, c * tileW + offsetX, r * tileH, tileW, tileH);
          }
        }
        offCtx.restore();
        break;
      }

      case 'kaleidoscope': {
        const segs = Math.max(2, Math.min(24, Math.round(Number(p.segments ?? 8))));
        const rot = ((Number(p.rotation ?? 0) + timeSec * Number(p.rotSpeed ?? 0) * 35) * Math.PI) / 180;
        const zoom = Math.max(0.25, Number(p.zoom ?? 1.2));
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const cx = w / 2;
          const cy = h / 2;
          const slice = (Math.PI * 2) / segs;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              const dy = y - cy;
              const r = Math.hypot(dx, dy) / zoom;
              let a = Math.atan2(dy, dx) + rot;
              a = ((a % slice) + slice) % slice;
              if (a > slice * 0.5) a = slice - a;
              const fx = cx + Math.cos(a) * r;
              const fy = cy + Math.sin(a) * r;
              writeBilinearSample(src, d, (y * w + x) * 4, w, h, fx, fy);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'hexMosaic': {
        const hexR = Math.max(5, Math.min(48, Number(p.hexRadius ?? 12)));
        const borderW = Math.max(0, Number(p.border ?? 2));
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const src = img.data;
          const rowH = hexR * 0.86;
          const colW = hexR * 1.5;
          offCtx.save();
          offCtx.setTransform(1, 0, 0, 1, 0, 0);
          for (let row = 0; row * rowH < h + rowH; row++) {
            const cy = Math.min(h - 1, Math.max(0, Math.round(row * rowH)));
            const xShift = row % 2 === 1 ? colW * 0.5 : 0;
            for (let col = -1; col * colW < w + colW; col++) {
              const cx = Math.min(w - 1, Math.max(0, Math.round(col * colW + xShift)));
              const idx = (cy * w + cx) * 4;
              if (src[idx + 3] < 20) continue;
              offCtx.fillStyle = `rgb(${src[idx]},${src[idx + 1]},${src[idx + 2]})`;
              offCtx.beginPath();
              for (let k = 0; k < 6; k++) {
                const a = (k * Math.PI) / 3;
                const px = col * colW + xShift + Math.cos(a) * (hexR * 0.58);
                const py = row * rowH + Math.sin(a) * (hexR * 0.58);
                if (k === 0) offCtx.moveTo(px, py);
                else offCtx.lineTo(px, py);
              }
              offCtx.closePath();
              offCtx.fill();
              if (borderW > 0.05) {
                offCtx.strokeStyle = 'rgba(0,0,0,0.45)';
                offCtx.lineWidth = borderW * 0.5;
                offCtx.stroke();
              }
            }
          }
          offCtx.restore();
        }
        break;
      }

      case 'radialRepeat': {
        const count = Math.max(2, Math.min(20, Math.round(Number(p.count ?? 6))));
        const radScale = Math.min(w, h) / 420;
        const rad = Math.max(10, Number(p.radius ?? 120) * radScale);
        const rotateCopies = Number(p.rotateCopies ?? 1) >= 0.5;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        const copySizeW = w * 0.36;
        const copySizeH = h * 0.36;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const cx = w / 2 + Math.cos(a) * rad;
          const cy = h / 2 + Math.sin(a) * rad;
          offCtx.save();
          offCtx.translate(cx, cy);
          if (rotateCopies) offCtx.rotate(a + Math.PI / 2);
          offCtx.drawImage(scratch, -copySizeW / 2, -copySizeH / 2, copySizeW, copySizeH);
          offCtx.restore();
        }
        offCtx.restore();
        break;
      }

      case 'linearArray':
      case 'ghostTrail': {
        const count = Math.max(2, Math.min(12, Math.round(Number(p.count ?? p.echoCount ?? 4))));
        let sx = Number(p.stepX ?? 14);
        let sy = Number(p.stepY ?? 0);
        if (type === 'ghostTrail') {
          const ang = (Number(p.angle ?? 180) * Math.PI) / 180;
          const delayDist = Math.max(2, Number(p.delayFrames ?? 3) * 6);
          sx = Math.cos(ang) * delayDist;
          sy = Math.sin(ang) * delayDist;
        }
        const decay = Math.max(0.15, Math.min(0.95, Number(p.decay ?? 0.65)));
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        for (let i = count - 1; i >= 0; i--) {
          offCtx.globalAlpha = Math.pow(decay, i);
          offCtx.drawImage(scratch, i * (sx * 0.5), i * (sy * 0.5), w, h);
        }
        offCtx.restore();
        break;
      }

      case 'tunnel': {
        const rings = Math.max(2, Math.min(20, Math.round(Number(p.rings ?? 7))));
        const twist = (Number(p.twist ?? 12) * Math.PI) / 180;
        const speed = Number(p.speed ?? 2);
        const anim = (timeSec * speed) % 1;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 1; i < rings; i++) {
          const sc = Math.max(0.08, 1 - ((i + anim * 0.5) / rings) * 0.85);
          offCtx.save();
          offCtx.translate(w / 2, h / 2);
          offCtx.rotate(i * twist * 0.25);
          offCtx.globalAlpha = 0.85;
          offCtx.drawImage(scratch, (-w * sc) / 2, (-h * sc) / 2, w * sc, h * sc);
          offCtx.restore();
        }
        offCtx.restore();
        break;
      }

      case 'spiralRepeat': {
        const count = Math.max(3, Math.min(20, Math.round(Number(p.count ?? 8))));
        const rStep = Number(p.radiusStep ?? 15) * (Math.min(w, h) / 450);
        const aStep = (Number(p.angleStep ?? 36) * Math.PI) / 180;
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.clearRect(0, 0, w, h);
        for (let i = count; i >= 1; i--) {
          const t = i / count;
          const a = i * aStep;
          const r = i * rStep;
          const cw = w * (0.25 + (1 - t) * 0.25);
          const ch = h * (0.25 + (1 - t) * 0.25);
          offCtx.globalAlpha = 1 - t * 0.45;
          offCtx.drawImage(scratch, w / 2 + Math.cos(a) * r - cw / 2, h / 2 + Math.sin(a) * r - ch / 2, cw, ch);
        }
        offCtx.restore();
        break;
      }

      // ==========================================
      // MATTE / MASK / KEY
      // ==========================================
      case 'chroma':
      case 'chromaKey':
      case 'colorKey': {
        const keyHex = String(p.keyColor || p.targetColor || '#00E676');
        const key = hexToRgb(keyHex);
        const tol = p.tolerance !== undefined ? Number(p.tolerance) * 3.5 : Number(p.threshold ?? 0.35) * 260;
        const feather = Number(p.feather ?? 0.15) * 120;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const dist = Math.hypot(d[i] - key.r, d[i + 1] - key.g, d[i + 2] - key.b);
            if (dist < tol) {
              d[i + 3] = 0;
            } else if (dist < tol + feather) {
              const alphaFactor = (dist - tol) / Math.max(1, feather);
              d[i + 3] = Math.round(d[i + 3] * alphaFactor);
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'lumaKey': {
        const thresh = Number(p.threshold ?? 0.25) * 255;
        const soft = Math.max(5, Number(p.softness ?? 0.2) * 180);
        const keyDark = Number(p.keyOutDark ?? 1) >= 0.5;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            const delta = keyDark ? lum - thresh : thresh - lum;
            if (delta < 0) d[i + 3] = 0;
            else if (delta < soft) d[i + 3] = Math.round(d[i + 3] * (delta / soft));
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'linearWipe':
      case 'wipe':
      case 'typewriter': {
        const progress = Math.max(0, Math.min(100, Number(p.progress ?? 50))) / 100;
        const feather = Math.max(1, Number(p.feather ?? 14));
        const angRad = ((Number(p.angle ?? 90) - 90) * Math.PI) / 180;
        const span = Math.abs(Math.cos(angRad)) * w + Math.abs(Math.sin(angRad)) * h;
        const cutDist = (0.5 - progress) * span;
        const cosA = Math.cos(angRad);
        const sinA = Math.sin(angRad);
        const cx = w * 0.5;
        const cy = h * 0.5;
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'destination-in';
        const grad = offCtx.createLinearGradient(
          cx + cosA * (cutDist - feather * 0.5),
          cy + sinA * (cutDist - feather * 0.5),
          cx + cosA * (cutDist + feather * 0.5),
          cy + sinA * (cutDist + feather * 0.5)
        );
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        offCtx.fillStyle = grad;
        offCtx.fillRect(0, 0, w, h);
        offCtx.restore();
        break;
      }

      case 'radialWipe':
      case 'clockWipe': {
        const progress = Math.max(0, Math.min(100, Number(p.progress ?? 60))) / 100;
        const startAng = ((Number(p.startAngle ?? 0) - 90) * Math.PI) / 180;
        const cw = Number(p.clockwise ?? 1) >= 0.5;
        const anchorPct = Math.max(0, Math.min(100, Number(p.centerAnchor ?? 50))) / 100;
        const cx = type === 'clockWipe' ? w * anchorPct : w * 0.5;
        const cy = h * 0.5;
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'destination-in';
        offCtx.beginPath();
        offCtx.moveTo(cx, cy);
        const sweep = progress * Math.PI * 2;
        const endAng = cw ? startAng + sweep : startAng - sweep;
        offCtx.arc(cx, cy, Math.hypot(w, h), startAng, endAng, !cw);
        offCtx.closePath();
        offCtx.fillStyle = '#ffffff';
        offCtx.fill();
        offCtx.restore();
        break;
      }

      case 'irisWipe': {
        const radiusPct = Math.max(2, Math.min(100, Number(p.radius ?? 68))) / 100;
        const r = Math.min(w, h) * 0.55 * radiusPct;
        const shape = String(p.shape || 'circle');
        const feather = Math.max(0, Number(p.feather ?? 10));
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'destination-in';
        const cx = w / 2;
        const cy = h / 2;
        if (shape === 'circle') {
          const grad = offCtx.createRadialGradient(cx, cy, Math.max(0, r - feather), cx, cy, Math.max(1, r));
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          offCtx.fillStyle = grad;
          offCtx.fillRect(0, 0, w, h);
        } else {
          if (feather > 0) offCtx.filter = `blur(${feather * 0.5}px)`;
          offCtx.fillStyle = '#ffffff';
          offCtx.beginPath();
          if (shape === 'square') {
            offCtx.rect(cx - r, cy - r, r * 2, r * 2);
          } else if (shape === 'diamond') {
            offCtx.moveTo(cx, cy - r);
            offCtx.lineTo(cx + r, cy);
            offCtx.lineTo(cx, cy + r);
            offCtx.lineTo(cx - r, cy);
            offCtx.closePath();
          } else {
            // star
            const spikes = 5;
            for (let i = 0; i < spikes * 2; i++) {
              const ang = (i * Math.PI) / spikes - Math.PI / 2;
              const sr = i % 2 === 0 ? r : r * 0.45;
              const px = cx + Math.cos(ang) * sr;
              const py = cy + Math.sin(ang) * sr;
              if (i === 0) offCtx.moveTo(px, py);
              else offCtx.lineTo(px, py);
            }
            offCtx.closePath();
          }
          offCtx.fill();
        }
        offCtx.restore();
        break;
      }

      case 'matteChoker':
      case 'trackMatte': {
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          if (type === 'trackMatte') {
            const mode = String(p.mode || 'alpha');
            const doInvert = Number(p.invert ?? 0) >= 0.5 || mode === 'invert';
            if (mode === 'luma') {
              for (let i = 0; i < d.length; i += 4) {
                const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
                d[i + 3] = Math.round(d[i + 3] * (doInvert ? 1 - lum : lum));
              }
            } else if (doInvert) {
              for (let i = 0; i < d.length; i += 4) {
                d[i + 3] = 255 - d[i + 3];
                d[i] = 255 - d[i];
                d[i + 1] = 255 - d[i + 1];
                d[i + 2] = 255 - d[i + 2];
              }
            }
          } else {
            const choke = Number(p.chokeAmount ?? -2);
            const grayCenter = (Math.max(0, Math.min(100, Number(p.grayLevel ?? 50))) / 100) * 255;
            for (let i = 0; i < d.length; i += 4) {
              const shifted = (d[i + 3] - grayCenter) * (1 + Math.abs(choke) * 0.2) + grayCenter + choke * 18;
              d[i + 3] = Math.max(0, Math.min(255, Math.round(shifted)));
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      // ==========================================
      // PROCEDURAL & PARTICLES
      // ==========================================
      case 'fire': {
        const flameH = Math.max(10, Math.min(120, Number(p.flameHeight ?? 80))) / 100;
        const speed = Number(p.speed ?? 4);
        const heat = Math.max(0.2, Number(p.heat ?? 1.2));
        const showSparks = Number(p.sparks ?? 1) >= 0.5;
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'lighter';
        const flameCount = Math.min(26, Math.round(10 * heat));
        for (let i = 0; i < flameCount; i++) {
          const rx = deterministicRand(i * 17.1 + 2.3);
          const bx = rx * w;
          const phase = (timeSec * speed + i * 0.37) % 1;
          const fh = h * flameH * (0.45 + 0.35 * deterministicRand(i * 9.3));
          const by = h - phase * fh * 0.45;
          const r = w * 0.15 * (1 - phase * 0.65) * Math.min(1.5, 0.7 + heat * 0.3);
          const grad = offCtx.createRadialGradient(bx, by, 1, bx, by - fh * 0.25, r * 1.6);
          grad.addColorStop(0, `rgba(255, 245, 160, ${Math.min(1, 0.58 * heat)})`);
          grad.addColorStop(0.35, `rgba(249, 115, 22, ${Math.min(1, 0.48 * heat)})`);
          grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
          offCtx.fillStyle = grad;
          offCtx.beginPath();
          offCtx.arc(bx + Math.sin(timeSec * 6 + i) * 5, by - fh * 0.18, r * 1.6, 0, Math.PI * 2);
          offCtx.fill();
        }
        if (showSparks) {
          for (let s = 0; s < 18; s++) {
            const sx = (deterministicRand(s * 41.3) * w + timeSec * 12) % w;
            const sy = h - ((deterministicRand(s * 19.7) * h + timeSec * speed * 35) % (h * 0.85));
            offCtx.fillStyle = 'rgba(254, 240, 138, 0.9)';
            offCtx.beginPath();
            offCtx.arc(sx, sy, 1.8, 0, Math.PI * 2);
            offCtx.fill();
          }
        }
        offCtx.restore();
        break;
      }

      case 'dustOrbs': {
        const count = Math.min(100, Math.max(4, Math.round(Number(p.count ?? 45))));
        const speed = Number(p.speed ?? 0.8);
        const baseSize = Math.max(1.5, Number(p.size ?? 6));
        const glow = Math.max(0, Number(p.glow ?? 15));
        const haloMult = 1.4 + (glow / 20) * 1.5;
        const coreAlpha = Math.min(1, 0.55 + glow / 40);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < count; i++) {
          const rx = deterministicRand(i * 11.7 + 1.3);
          const ry = deterministicRand(i * 23.1 + 4.9);
          const px = ((rx * w + Math.sin(timeSec * speed + i) * 16) % w + w) % w;
          const py = ((ry * h - timeSec * speed * 18) % h + h) % h;
          const r = baseSize * (0.5 + deterministicRand(i * 5.9));
          const grad = offCtx.createRadialGradient(px, py, 0, px, py, r * haloMult);
          grad.addColorStop(0, `rgba(255, 250, 210, ${coreAlpha})`);
          grad.addColorStop(0.4, `rgba(253, 224, 71, ${coreAlpha * 0.5})`);
          grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
          offCtx.fillStyle = grad;
          offCtx.beginPath();
          offCtx.arc(px, py, r * haloMult, 0, Math.PI * 2);
          offCtx.fill();
        }
        offCtx.restore();
        break;
      }

      case 'electric': {
        const branches = Math.max(1, Math.min(18, Math.round(Number(p.branchCount ?? 6))));
        const intensity = Math.max(0.2, Number(p.intensity ?? 2.2));
        const col = String(p.color || '#00E5FF');
        const speed = Number(p.speed ?? 14);
        const tick = Math.floor(timeSec * speed);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'lighter';
        offCtx.shadowColor = col;
        offCtx.shadowBlur = Math.min(32, 6 * intensity);
        offCtx.globalAlpha = Math.min(1, 0.55 + intensity * 0.2);
        for (let b = 0; b < branches; b++) {
          let x = deterministicRand(b * 13 + tick * 7) * w;
          let y = 0;
          const targetX = deterministicRand(b * 31 + tick * 11) * w;
          offCtx.strokeStyle = col;
          offCtx.lineWidth = Math.max(1.2, Math.min(w, h) * 0.01 * intensity);
          offCtx.beginPath();
          offCtx.moveTo(x, y);
          const segs = 7;
          for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            x = x + (targetX - x) * (1 / (segs - s + 1)) + (deterministicRand(b * 100 + s * 19 + tick) - 0.5) * (w * 0.22);
            y = t * h;
            offCtx.lineTo(x, y);
          }
          offCtx.stroke();
          offCtx.strokeStyle = '#FFFFFF';
          offCtx.lineWidth = Math.max(0.6, offCtx.lineWidth * 0.42);
          offCtx.stroke();
        }
        offCtx.restore();
        break;
      }

      case 'matrixRain':
      case 'textHacker': {
        const reqFs = Number(p.fontSize ?? 14);
        const fontSize = Math.max(7, Math.min(28, Math.round(reqFs * (Math.min(w, h) / 420 + 0.55))));
        const speed = Number(p.speed ?? 6);
        const density = Math.max(5, Math.round(Number(p.density ?? 30)));
        const maxCols = Math.max(4, Math.floor(w / fontSize));
        const activeCols = Math.min(maxCols, Math.max(4, Math.round((density / 30) * maxCols)));
        const chars = '01アイウエオカキクケコ#$%@';
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.fillStyle = 'rgba(0, 20, 8, 0.38)';
        offCtx.fillRect(0, 0, w, h);
        offCtx.font = `bold ${fontSize}px monospace`;
        offCtx.globalCompositeOperation = 'lighter';
        for (let c = 0; c < activeCols; c++) {
          const colX = (c / activeCols) * w;
          const drop = (deterministicRand(c * 17.3) * h + timeSec * speed * 28) % (h + fontSize * 5);
          for (let k = 0; k < 5; k++) {
            const y = drop - k * fontSize;
            if (y < 0 || y > h + fontSize) continue;
            const ch = chars[Math.floor(deterministicRand(c * 31 + k + Math.floor(timeSec * 6)) * chars.length)];
            offCtx.fillStyle = k === 0 ? 'rgba(200,255,220,0.95)' : `rgba(0,255,102,${Math.max(0.15, 0.85 - k * 0.16)})`;
            offCtx.fillText(ch, colX, y);
          }
        }
        offCtx.restore();
        break;
      }

      case 'smoke': {
        const density = Math.max(0.05, Math.min(1, Number(p.density ?? 0.6)));
        const speed = Number(p.speed ?? 1.2);
        const turb = Number(p.turbulence ?? 15);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < 10; i++) {
          const px = ((deterministicRand(i * 19.1) * w + Math.sin(timeSec * speed + i) * turb * 1.6) % w + w) % w;
          const py = ((h * (0.35 + 0.6 * deterministicRand(i * 7.3)) + Math.cos(timeSec * speed * 0.8 + i * 2) * turb * 0.8) % h + h) % h;
          const r = Math.min(w, h) * (0.24 + 0.18 * deterministicRand(i * 3.7));
          const grad = offCtx.createRadialGradient(px, py, 0, px, py, r);
          grad.addColorStop(0, `rgba(226, 232, 240, ${0.46 * density})`);
          grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
          offCtx.fillStyle = grad;
          offCtx.beginPath();
          offCtx.arc(px, py, r, 0, Math.PI * 2);
          offCtx.fill();
        }
        offCtx.restore();
        break;
      }

      case 'rain': {
        const count = Math.min(200, Math.max(10, Math.round(Number(p.density ?? 120))));
        const ang = (Number(p.angle ?? 15) * Math.PI) / 180;
        const speed = Number(p.speed ?? 22);
        const wind = Number(p.wind ?? 5);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.strokeStyle = 'rgba(186, 230, 253, 0.58)';
        offCtx.lineWidth = Math.max(1, w * 0.006);
        const len = Math.max(10, h * 0.14);
        const dx = Math.sin(ang) * len + wind * 0.4;
        const dy = Math.cos(ang) * len;
        for (let i = 0; i < count; i++) {
          const x = ((deterministicRand(i * 13.7) * w + timeSec * (speed * 4 + wind * 14)) % w + w) % w;
          const y = (deterministicRand(i * 29.1) * h + timeSec * speed * 18) % h;
          offCtx.beginPath();
          offCtx.moveTo(x, y);
          offCtx.lineTo(x - dx, y + dy);
          offCtx.stroke();
        }
        offCtx.restore();
        break;
      }

      case 'snow': {
        const count = Math.min(180, Math.max(10, Math.round(Number(p.count ?? 80))));
        const speed = Number(p.speed ?? 1.5);
        const size = Math.max(1.2, Number(p.size ?? 4));
        const sway = Number(p.windSway ?? 8);
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < count; i++) {
          const x = ((deterministicRand(i * 17.9) * w + Math.sin(timeSec * 2 + i) * sway) % w + w) % w;
          const y = (deterministicRand(i * 43.3) * h + timeSec * speed * 28) % h;
          const r = size * (0.4 + deterministicRand(i * 7.1) * 0.8);
          offCtx.fillStyle = `rgba(255,255,255,${0.45 + deterministicRand(i * 3.1) * 0.5})`;
          offCtx.beginPath();
          offCtx.arc(x, y, r, 0, Math.PI * 2);
          offCtx.fill();
        }
        offCtx.restore();
        break;
      }

      case 'cyberGrid': {
        const col = String(p.gridColor || '#EC4899');
        const speed = Number(p.speed ?? 4);
        const horizon = h * (Math.min(85, Math.max(20, Number(p.horizonHeight ?? 60))) / 100);
        const dens = Math.max(3, Math.min(18, Math.round(Number(p.density ?? 6))));
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'lighter';
        offCtx.strokeStyle = col;
        offCtx.lineWidth = Math.max(1, w * 0.008);
        offCtx.shadowColor = col;
        offCtx.shadowBlur = 8;
        for (let i = -dens; i <= dens; i++) {
          offCtx.beginPath();
          offCtx.moveTo(w / 2 + i * (w * 0.05), horizon);
          offCtx.lineTo(w / 2 + i * (w * 0.25), h);
          offCtx.stroke();
        }
        const scroll = (timeSec * speed * 0.5) % 1;
        const rows = dens + 2;
        for (let r = 0; r < rows; r++) {
          const t = Math.pow((r + scroll) / rows, 1.6);
          const y = horizon + t * (h - horizon);
          offCtx.beginPath();
          offCtx.moveTo(0, y);
          offCtx.lineTo(w, y);
          offCtx.stroke();
        }
        offCtx.restore();
        break;
      }

      case 'fractalNoise': {
        const octaves = Math.max(1, Math.min(6, Math.round(Number(p.complexity ?? 4))));
        const scale = Math.max(5, Number(p.scale ?? 50));
        const speed = Number(p.evolutionSpeed ?? 1.5);
        const phase = timeSec * speed;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              if (d[idx + 3] === 0) continue;
              let n = 0;
              let amp = 0.55;
              let freq = 1 / Math.max(3, scale * 0.35);
              let norm = 0;
              for (let o = 0; o < octaves; o++) {
                n += (Math.sin(x * freq + phase * (o + 1) * 0.6) * Math.cos(y * freq - phase * 0.7)) * amp;
                norm += amp;
                amp *= 0.5;
                freq *= 2.05;
              }
              const v = (n / Math.max(0.1, norm) + 1) * 0.5;
              d[idx] = Math.min(255, Math.round(d[idx] * (0.45 + v * 0.9)));
              d[idx + 1] = Math.min(255, Math.round(d[idx + 1] * (0.45 + v * 0.9)));
              d[idx + 2] = Math.min(255, Math.round(d[idx + 2] * (0.55 + v * 0.95)));
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'confetti': {
        const count = Math.min(150, Math.max(8, Math.round(Number(p.particleCount ?? 90))));
        const spreadRad = ((Number(p.spread ?? 360) * Math.PI) / 180) * 0.5;
        const gravity = Math.max(0.1, Number(p.gravity ?? 0.8));
        const colors = ['#F43F5E', '#38BDF8', '#FACC15', '#34D399', '#A855F7', '#FB923C'];
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < count; i++) {
          const rx = deterministicRand(i * 19.3) - 0.5;
          const ang = -Math.PI / 2 + rx * spreadRad * 2;
          const speedMult = 0.5 + deterministicRand(i * 29.7);
          const life = (deterministicRand(i * 37.7) + timeSec * 0.65 * gravity) % 1;
          const px = ((w * 0.5 + Math.cos(ang) * w * 0.9 * life * speedMult) % w + w) % w;
          const py = ((h * 0.25 + Math.sin(ang) * h * 0.35 * life + gravity * h * 0.95 * life * life) % h + h) % h;
          offCtx.save();
          offCtx.translate(px, py);
          offCtx.rotate(i + timeSec * 4);
          offCtx.fillStyle = colors[i % colors.length];
          const cw = Math.max(3, w * 0.035);
          const ch = Math.max(2, h * 0.018);
          offCtx.fillRect(-cw / 2, -ch / 2, cw, ch);
          offCtx.restore();
        }
        offCtx.restore();
        break;
      }

      // ==========================================
      // OPACITY / VISIBILITY & WIPE
      // ==========================================
      case 'dissolve': {
        const prog = Math.max(0, Math.min(1, Number(p.progress ?? 50) / 100));
        const grain = Math.max(1, Math.round(Number(p.grainSize ?? 3)));
        const seed = Number(p.seed ?? 1) * 19.37;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          for (let y = 0; y < h; y++) {
            const gy = Math.floor(y / grain);
            for (let x = 0; x < w; x++) {
              const gx = Math.floor(x / grain);
              const idx = (y * w + x) * 4;
              if (d[idx + 3] === 0) continue;
              if (deterministicRand(gx * 73.1 + gy * 139.7 + seed) < prog) {
                d[idx + 3] = 0;
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'blinds': {
        const slats = Math.max(2, Math.min(24, Math.round(Number(p.slatCount ?? 10))));
        const angRad = (Number(p.angle ?? 0) * Math.PI) / 180;
        const prog = Math.max(0, Math.min(1, Number(p.progress ?? 40) / 100));
        const diag = Math.hypot(w, h) * 1.1;
        const slatH = diag / slats;
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.translate(w * 0.5, h * 0.5);
        offCtx.rotate(angRad);
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.fillStyle = '#000';
        for (let i = 0; i < slats; i++) {
          offCtx.fillRect(-diag * 0.5, -diag * 0.5 + i * slatH, diag, slatH * prog);
        }
        offCtx.restore();
        break;
      }

      case 'checkerboard': {
        const box = Math.max(6, Math.min(96, Math.round(Number(p.boxSize ?? 40))));
        const prog = Math.max(0, Math.min(1, Number(p.progress ?? 50) / 100));
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.globalCompositeOperation = 'destination-out';
        offCtx.fillStyle = '#000';
        for (let y = 0; y < h; y += box) {
          for (let x = 0; x < w; x += box) {
            const isEven = (Math.floor(x / box) + Math.floor(y / box)) % 2 === 0;
            const cutSize = isEven
              ? box * Math.min(1, prog * 2)
              : box * Math.max(0, (prog - 0.5) * 2);
            if (cutSize > 0.5) {
              const pad = (box - cutSize) * 0.5;
              offCtx.fillRect(x + pad, y + pad, cutSize, cutSize);
            }
          }
        }
        offCtx.restore();
        break;
      }

      case 'vignette': {
        const amount = Math.max(0, Math.min(1, Number(p.amount ?? 0.65)));
        const radius = Math.max(0.01, Math.min(1.5, Number(p.radius ?? 0.35)));
        const roundness = Math.max(0.2, Math.min(2.2, Number(p.roundness ?? 1)));
        const vRgb = hexToRgb(String(p.color || '#000000'));
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.translate(w / 2, h / 2);
        offCtx.scale(1, roundness);
        const rInner = Math.min(w, h) * radius * 0.7;
        const rOuter = Math.max(w, h) * (0.45 + radius * 0.55);
        const grad = offCtx.createRadialGradient(0, 0, rInner, 0, 0, Math.max(rInner + 4, rOuter));
        grad.addColorStop(0, `rgba(${vRgb.r},${vRgb.g},${vRgb.b},0)`);
        grad.addColorStop(1, `rgba(${vRgb.r},${vRgb.g},${vRgb.b},${amount})`);
        offCtx.fillStyle = grad;
        offCtx.fillRect(-w, -h / roundness, w * 2, (h * 2) / roundness);
        offCtx.restore();
        break;
      }

      // ==========================================
      // GLITCH & RETRO
      // ==========================================
      case 'chromatic': {
        const amount = Math.max(0, Number(p.amount ?? 8));
        const angleRad = (Number(p.angle ?? 0) * Math.PI) / 180;
        const centerRadius = Math.max(0, Math.min(0.95, Number(p.centerRadius ?? 0)));
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const cx = w * 0.5;
          const cy = h * 0.5;
          const maxDist = Math.max(1, Math.hypot(cx, cy));
          const cosA = Math.cos(angleRad);
          const sinA = Math.sin(angleRad);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const dx = x - cx;
              const dy = y - cy;
              const dist = Math.hypot(dx, dy);
              const distRatio = Math.max(0, (dist / maxDist - centerRadius) / Math.max(0.05, 1 - centerRadius));
              const rxBase = dx / Math.max(1, dist);
              const ryBase = dy / Math.max(1, dist);
              const dirX = rxBase * cosA - ryBase * sinA;
              const dirY = rxBase * sinA + ryBase * cosA;
              const shiftX = dirX * amount * (0.45 + distRatio * 0.85) * (centerRadius > 0 ? Math.min(1, distRatio * 1.4) : 1);
              const shiftY = dirY * amount * (0.45 + distRatio * 0.85) * (centerRadius > 0 ? Math.min(1, distRatio * 1.4) : 1);
              const i = (y * w + x) * 4;
              const rx = Math.min(w - 1, Math.max(0, Math.round(x + shiftX)));
              const ry = Math.min(h - 1, Math.max(0, Math.round(y + shiftY)));
              const bx = Math.min(w - 1, Math.max(0, Math.round(x - shiftX)));
              const by = Math.min(h - 1, Math.max(0, Math.round(y - shiftY)));
              d[i] = src[(ry * w + rx) * 4];
              d[i + 2] = src[(by * w + bx) * 4 + 2];
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'glitch':
      case 'glitchBlocks':
      case 'textGlitch': {
        const intensity = Math.max(0.05, Number(p.intensity ?? 0.6));
        const blockSz = Math.max(6, Math.min(80, Number(p.blockSize ?? 24)));
        const speed = Math.max(0.5, Number(p.speed ?? 6));
        const slices = Math.max(3, Math.floor(intensity * 10));
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        const seedBase = Math.floor(timeSec * speed * 2) + 1;
        for (let i = 0; i < slices; i++) {
          const sy = deterministicRand(seedBase + i * 11.3) * h;
          const sh = Math.max(3, Math.min(blockSz, deterministicRand(seedBase + i * 29.7) * (h * 0.14 + blockSz * 0.5)));
          const dx = (deterministicRand(seedBase + i * 47.1) - 0.5) * (w * 0.22 * intensity);
          offCtx.drawImage(scratch, 0, sy, w, sh, dx, sy, w, sh);
        }
        offCtx.globalCompositeOperation = 'lighter';
        offCtx.fillStyle = `rgba(0, 229, 255, ${Math.min(0.4, 0.22 * intensity)})`;
        offCtx.fillRect(0, h * 0.3, w, Math.max(2, h * 0.04));
        offCtx.fillStyle = `rgba(244, 63, 94, ${Math.min(0.4, 0.22 * intensity)})`;
        offCtx.fillRect(0, h * 0.65, w, Math.max(2, h * 0.04));
        offCtx.restore();
        break;
      }

      case 'vhs': {
        const bleed = Math.max(0, Math.round(Number(p.colorBleed ?? 1.5) * 2));
        const trackingNoise = Math.max(0, Math.min(1, Number(p.trackingNoise ?? 0.4)));
        const staticLines = Number(p.staticLines ?? 1) >= 0.5;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const bandY = Math.floor(((timeSec * 0.4) % 1) * h);
          const bandHalfH = Math.max(2, h * 0.08 * trackingNoise);
          for (let y = 0; y < h; y++) {
            const inTear = trackingNoise > 0.01 && Math.abs(y - bandY) < bandHalfH;
            const shift = inTear ? Math.round(Math.sin(y * 0.5) * 14 * trackingNoise) : 0;
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              const rx = Math.min(w - 1, Math.max(0, x + bleed + shift));
              const gx = Math.min(w - 1, Math.max(0, x + shift));
              const bx = Math.min(w - 1, Math.max(0, x - bleed + shift));
              d[i] = src[(y * w + rx) * 4];
              d[i + 1] = src[(y * w + gx) * 4 + 1];
              d[i + 2] = src[(y * w + bx) * 4 + 2];
              if (staticLines && y % 3 === 0) {
                d[i] *= 0.78;
                d[i + 1] *= 0.78;
                d[i + 2] *= 0.78;
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'scanlines': {
        const spacing = Math.max(2, Math.round(Number(p.lineSpacing ?? 4)));
        const op = Math.max(0, Math.min(0.95, Number(p.opacity ?? 0.35)));
        const curv = Math.max(0, Math.min(1, Number(p.curvature ?? 0.1)));
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.strokeStyle = `rgba(0,0,0,${op})`;
        offCtx.lineWidth = Math.max(1, spacing * 0.4);
        for (let y = 0; y < h; y += spacing) {
          const normY = (y / h - 0.5) * 2;
          const sag = curv * 18 * -normY;
          offCtx.beginPath();
          offCtx.moveTo(0, y);
          if (curv > 0.02) {
            offCtx.quadraticCurveTo(w * 0.5, y + sag, w, y);
          } else {
            offCtx.lineTo(w, y);
          }
          offCtx.stroke();
        }
        if (curv > 0.05) {
          const vg = offCtx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
          vg.addColorStop(0, 'rgba(0,0,0,0)');
          vg.addColorStop(1, `rgba(0,0,0,${curv * 0.6})`);
          offCtx.fillStyle = vg;
          offCtx.fillRect(0, 0, w, h);
        }
        offCtx.restore();
        break;
      }

      case 'badTv': {
        const level = Math.max(0, Math.min(1.5, Number(p.noiseLevel ?? 0.35)));
        const syncRoll = Math.max(0, Math.min(1.5, Number(p.syncRoll ?? 0.2)));
        const tvSpeed = Math.max(0.1, Number(p.speed ?? 8));
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const src = new Uint8ClampedArray(d);
          const tSeed = Math.floor(timeSec * tvSpeed * 3.5) * 13.7;
          const rollOffset = Math.floor((timeSec * syncRoll * (tvSpeed / 8) * 0.8) % 1 * h);
          for (let y = 0; y < h; y++) {
            const sy = syncRoll > 0.02 ? (y + rollOffset) % h : y;
            const tear = syncRoll > 0.05 && Math.sin(y * 0.25 + timeSec * tvSpeed) > 0.82 ? Math.round(16 * syncRoll) : 0;
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              if (src[i + 3] === 0) continue;
              const noise = (deterministicRand(i * 0.01 + tSeed) - 0.5) * 230 * level;
              const si = (sy * w + Math.min(w - 1, Math.max(0, x + tear))) * 4;
              d[i] = Math.max(0, Math.min(255, src[si] + noise));
              d[i + 1] = Math.max(0, Math.min(255, src[si + 1] + noise));
              d[i + 2] = Math.max(0, Math.min(255, src[si + 2] + noise));
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'filmGrain': {
        const intensity = Math.max(0, Math.min(2, Number(p.intensity ?? 0.25)));
        const gSize = Math.max(1, Math.min(12, Math.round(Number(p.size ?? 1.2))));
        const gSpeed = Math.max(0, Number(p.speed ?? 12));
        const gSeed = Number(p.seed ?? 1) * 43.7;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          const seed = (Math.floor(timeSec * gSpeed * 2) % 120) * 17.3 + gSeed;
          for (let y = 0; y < h; y++) {
            const gy = Math.floor(y / gSize);
            for (let x = 0; x < w; x++) {
              const gx = Math.floor(x / gSize);
              const i = (y * w + x) * 4;
              if (d[i + 3] === 0) continue;
              const g = (deterministicRand((gy * w + gx) * 0.13 + seed) - 0.5) * 150 * intensity;
              d[i] = Math.max(0, Math.min(255, d[i] + g));
              d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + g));
              d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + g));
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'pixelSorter': {
        const thresh = Number(p.threshold ?? 0.45) * 255;
        const maxLen = Math.max(4, Math.round(Number(p.sortLength ?? 90)));
        const isVert = Number(p.vertical ?? 0) >= 0.5;
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          if (isVert) {
            for (let x = 0; x < w; x++) {
              for (let y = 0; y < h; y++) {
                const i = (y * w + x) * 4;
                const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
                if (lum > thresh && y + 1 < h) {
                  const stretch = Math.min(h - 1 - y, maxLen);
                  for (let k = 1; k < stretch; k++) {
                    const ti = ((y + k) * w + x) * 4;
                    d[ti] = Math.round((d[ti] + d[i]) * 0.5);
                    d[ti + 1] = Math.round((d[ti + 1] + d[i + 1]) * 0.5);
                    d[ti + 2] = Math.round((d[ti + 2] + d[i + 2]) * 0.5);
                  }
                  y += Math.floor(stretch * 0.5);
                }
              }
            }
          } else {
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
                if (lum > thresh && x + 1 < w) {
                  const stretch = Math.min(w - 1 - x, maxLen);
                  for (let k = 1; k < stretch; k++) {
                    const ti = (y * w + (x + k)) * 4;
                    d[ti] = Math.round((d[ti] + d[i]) * 0.5);
                    d[ti + 1] = Math.round((d[ti + 1] + d[i + 1]) * 0.5);
                    d[ti + 2] = Math.round((d[ti + 2] + d[i + 2]) * 0.5);
                  }
                  x += Math.floor(stretch * 0.5);
                }
              }
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      case 'dither': {
        const bayer4 = [
          [0, 8, 2, 10],
          [12, 4, 14, 6],
          [3, 11, 1, 9],
          [15, 7, 13, 5],
        ];
        const scale = Math.max(1, Math.round(Number(p.scale ?? 2)));
        const levels = Math.max(2, Math.round(Number(p.paletteColors ?? 4)));
        const step = 255 / (levels - 1);
        const img = safeGetImageData(offCtx, w, h);
        if (img) {
          const d = img.data;
          for (let y = 0; y < h; y++) {
            const by = Math.floor(y / scale) % 4;
            for (let x = 0; x < w; x++) {
              const bx = Math.floor(x / scale) % 4;
              const i = (y * w + x) * 4;
              if (d[i + 3] === 0) continue;
              const thresh = (bayer4[by][bx] / 16 - 0.5) * step;
              d[i] = Math.max(0, Math.min(255, Math.round((d[i] + thresh) / step) * step));
              d[i + 1] = Math.max(0, Math.min(255, Math.round((d[i + 1] + thresh) / step) * step));
              d[i + 2] = Math.max(0, Math.min(255, Math.round((d[i + 2] + thresh) / step) * step));
            }
          }
          offCtx.putImageData(img, 0, 0);
        }
        break;
      }

      // Non-text fallback visuals for remaining text-category effects when applied to any layer
      case 'textTracking':
      case 'charTransform':
      case 'textCounter':
      case 'textFlipWord': {
        copySrcToScratch();
        offCtx.save();
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        if (type === 'textFlipWord') {
          offCtx.clearRect(0, 0, w, h);
          offCtx.drawImage(scratch, 0, 0, w, h * 0.48, 0, 0, w, h * 0.48);
          offCtx.fillStyle = 'rgba(0,0,0,0.45)';
          offCtx.fillRect(0, h * 0.48, w, 2);
          offCtx.drawImage(scratch, 0, h * 0.5, w, h * 0.5, w * 0.04, h * 0.52, w * 0.92, h * 0.42);
        } else {
          offCtx.filter = 'contrast(1.12) saturate(1.15)';
          offCtx.drawImage(scratch, 0, 0, w, h);
        }
        offCtx.restore();
        break;
      }
    }

    if (preMixData && mixRatio < 0.999) {
      const postImg = safeGetImageData(offCtx, w, h);
      if (postImg) {
        const pd = postImg.data;
        const inv = 1 - mixRatio;
        for (let i = 0; i < pd.length; i += 4) {
          pd[i] = Math.round(preMixData[i] * inv + pd[i] * mixRatio);
          pd[i + 1] = Math.round(preMixData[i + 1] * inv + pd[i + 1] * mixRatio);
          pd[i + 2] = Math.round(preMixData[i + 2] * inv + pd[i + 2] * mixRatio);
          pd[i + 3] = Math.round(preMixData[i + 3] * inv + pd[i + 3] * mixRatio);
        }
        offCtx.putImageData(postImg, 0, 0);
      }
    }
  }
}
