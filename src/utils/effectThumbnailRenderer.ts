import { ShaderEffect } from '../types';
import { applyCanvasEffects } from '../engine/effectsProcessor';

export const EFFECTS_PREVIEW_PORTRAIT_URL = '/assets/aistudio/retrato_bbf18678.jpg';

const THUMB_SIZE = 112;
const thumbnailCache = new Map<string, string>();

let portraitImagePromise: Promise<HTMLCanvasElement | null> | null = null;
let cachedBaseCanvas: HTMLCanvasElement | null = null;

interface QueueTask {
  key: string;
  effectId: string;
  color: string;
  params: Record<string, any>;
  liveMode: boolean;
  callbacks: Set<(url: string) => void>;
}

const pendingTasks = new Map<string, QueueTask>();
const taskQueue: string[] = [];
let rafScheduled = false;

function loadBasePortraitCanvas(): Promise<HTMLCanvasElement | null> {
  if (cachedBaseCanvas) return Promise.resolve(cachedBaseCanvas);
  if (portraitImagePromise) return portraitImagePromise;

  portraitImagePromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = THUMB_SIZE;
      c.height = THUMB_SIZE;
      const ctx = c.getContext('2d');
      if (ctx) {
        const iw = img.naturalWidth || img.width || THUMB_SIZE;
        const ih = img.naturalHeight || img.height || THUMB_SIZE;
        const scale = Math.max(THUMB_SIZE / iw, THUMB_SIZE / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.drawImage(img, (THUMB_SIZE - dw) * 0.5, (THUMB_SIZE - dh) * 0.5, dw, dh);
      }
      cachedBaseCanvas = c;
      resolve(c);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = EFFECTS_PREVIEW_PORTRAIT_URL;
  });

  return portraitImagePromise;
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number, cell = 8) {
  ctx.fillStyle = '#1C2028';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2C323E';
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      if (((x / cell + y / cell) | 0) % 2 === 0) {
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }
}

function drawRoundedPortraitInset(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  margin: number,
  radius: number
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const rw = w - margin * 2;
  const rh = h - margin * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(margin, margin, rw, rh, radius);
  ctx.clip();
  ctx.drawImage(base, margin, margin, rw, rh);
  ctx.restore();
}

function renderCustomPortraitEffect(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  effectId: string,
  color: string,
  params: Record<string, any>,
  liveMode = false
): boolean {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  switch (effectId) {
    // ==========================================
    // TRANSFORM & MOTION EFFECTS (clear visual cues on portrait)
    // ==========================================
    case 'swing': {
      ctx.fillStyle = '#14161A';
      ctx.fillRect(0, 0, w, h);
      // Faded pendulum echo
      ctx.save();
      ctx.translate(cx, cy * 0.25);
      ctx.rotate(0.28);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(base, -w * 0.36, 0, w * 0.72, h * 0.72);
      ctx.restore();
      // Main swung portrait
      ctx.save();
      ctx.translate(cx, cy * 0.25);
      ctx.rotate(-0.32);
      ctx.beginPath();
      ctx.roundRect(-w * 0.36, 0, w * 0.72, h * 0.72, 8);
      ctx.clip();
      ctx.drawImage(base, -w * 0.36, 0, w * 0.72, h * 0.72);
      ctx.restore();
      return true;
    }

    case 'shake':
    case 'jitter': {
      ctx.fillStyle = '#111216';
      ctx.fillRect(0, 0, w, h);
      const offsets = [
        { dx: -7, dy: -4, a: 0.32 },
        { dx: 7, dy: 4, a: 0.32 },
        { dx: -4, dy: 5, a: 0.42 },
        { dx: 2, dy: -2, a: 0.92 },
      ];
      for (const o of offsets) {
        ctx.save();
        ctx.globalAlpha = o.a;
        ctx.drawImage(base, o.dx, o.dy, w, h);
        ctx.restore();
      }
      return true;
    }

    case 'oscillate': {
      ctx.fillStyle = '#111216';
      ctx.fillRect(0, 0, w, h);
      for (const [dx, a] of [
        [-14, 0.22],
        [14, 0.22],
        [-7, 0.48],
        [4, 0.95],
      ] as [number, number][]) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.drawImage(base, dx, 0, w, h);
        ctx.restore();
      }
      return true;
    }

    case 'pulse':
    case 'zoomLoop':
    case 'snapPop': {
      ctx.fillStyle = '#121318';
      ctx.fillRect(0, 0, w, h);
      // Outer expanded pulse aura
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.drawImage(base, -8, -8, w + 16, h + 16);
      ctx.restore();
      // Crisp inner scaled frame
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(12, 12, w - 24, h - 24, 10);
      ctx.clip();
      ctx.drawImage(base, 12, 12, w - 24, h - 24);
      ctx.restore();
      ctx.strokeStyle = color || '#5EEB9A';
      ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      return true;
    }

    case 'spin360': {
      ctx.fillStyle = '#13151B';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.45 + i * 0.22);
        ctx.globalAlpha = 0.16 + i * 0.22;
        ctx.beginPath();
        ctx.roundRect(-w * 0.36, -h * 0.36, w * 0.72, h * 0.72, 10);
        ctx.clip();
        ctx.drawImage(base, -w * 0.36, -h * 0.36, w * 0.72, h * 0.72);
        ctx.restore();
      }
      return true;
    }

    case 'bounce': {
      ctx.fillStyle = '#12141A';
      ctx.fillRect(0, 0, w, h);
      // Floor shadow
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(cx, h - 10, 28, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bounced trails
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.drawImage(base, 18, 28, w - 36, h - 36);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(16, 8, w - 32, h - 32, 10);
      ctx.clip();
      ctx.drawImage(base, 16, 8, w - 32, h - 32);
      ctx.restore();
      return true;
    }

    case 'autoPan': {
      const split = Math.round(w * 0.38);
      ctx.drawImage(base, w - split, 0, split, h, 0, 0, split, h);
      ctx.drawImage(base, 0, 0, w - split, h, split, 0, w - split, h);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(split - 1, 0, 2, h);
      return true;
    }

    case 'squeeze': {
      ctx.fillStyle = '#14151A';
      ctx.fillRect(0, 0, w, h);
      const sx = 0.68;
      const sy = 1.16;
      const dw = w * 0.78 * sx;
      const dh = h * 0.78 * sy;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx - dw / 2, cy - dh / 2, dw, dh, 10);
      ctx.clip();
      ctx.drawImage(base, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
      return true;
    }

    // ==========================================
    // 3D PERSPECTIVE & SPATIAL EFFECTS
    // ==========================================
    case 'flip3d':
    case 'box3d':
    case 'isometric':
    case 'orbitCamera':
    case 'parallax':
    case 'zFloat': {
      ctx.fillStyle = '#13151C';
      ctx.fillRect(0, 0, w, h);
      // 3D side extrusion wall
      ctx.fillStyle = '#2B2F42';
      ctx.beginPath();
      ctx.moveTo(w * 0.72, h * 0.17);
      ctx.lineTo(w * 0.84, h * 0.22);
      ctx.lineTo(w * 0.84, h * 0.78);
      ctx.lineTo(w * 0.72, h * 0.83);
      ctx.closePath();
      ctx.fill();

      // Foreshortened perspective trapezoid strips of the portrait
      const leftX = w * 0.16;
      const rightX = w * 0.72;
      const topLeftY = h * 0.11;
      const botLeftY = h * 0.89;
      const topRightY = h * 0.17;
      const botRightY = h * 0.83;
      const slices = 28;
      for (let i = 0; i < slices; i++) {
        const t = i / slices;
        const dx = leftX + (rightX - leftX) * t;
        const dw = Math.ceil((rightX - leftX) / slices) + 1;
        const dyTop = topLeftY + (topRightY - topLeftY) * t;
        const dyBot = botLeftY + (botRightY - botLeftY) * t;
        const sx = t * w;
        const sw = w / slices;
        ctx.drawImage(base, sx, 0, sw, h, dx, dyTop, dw, dyBot - dyTop);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(leftX, topLeftY);
      ctx.lineTo(rightX, topRightY);
      ctx.lineTo(rightX, botRightY);
      ctx.lineTo(leftX, botLeftY);
      ctx.closePath();
      ctx.stroke();
      return true;
    }

    // ==========================================
    // MATTE / CHROMA / KEY / FADE / VISIBILITY
    // ==========================================
    case 'chroma':
    case 'chromaKey':
    case 'colorKey': {
      drawCheckerboard(ctx, w, h, 8);
      // Key out green half & show portrait isolated cleanly
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy * 1.02, w * 0.36, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(base, 0, 0, w, h);
      ctx.restore();
      // Show subtle green-screen edge tint on bottom corner
      ctx.fillStyle = 'rgba(0, 230, 118, 0.28)';
      ctx.fillRect(0, 0, w * 0.24, h);
      return true;
    }

    case 'lumaKey': {
      drawCheckerboard(ctx, w, h, 8);
      ctx.drawImage(base, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < 82) {
          d[i + 3] = Math.max(0, Math.round(((lum - 45) / 37) * 255));
        }
      }
      // Put luma-keyed foreground onto checkerboard
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tCtx = tmp.getContext('2d');
      if (tCtx) {
        tCtx.putImageData(img, 0, 0);
        drawCheckerboard(ctx, w, h, 8);
        ctx.drawImage(tmp, 0, 0);
      }
      return true;
    }

    case 'matteChoker':
    case 'trackMatte': {
      drawCheckerboard(ctx, w, h, 8);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(14, 14, w - 28, h - 28, 22);
      ctx.clip();
      ctx.drawImage(base, 0, 0, w, h);
      ctx.restore();
      return true;
    }

    case 'maskFeather': {
      drawCheckerboard(ctx, w, h, 8);
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tCtx = tmp.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(base, 0, 0, w, h);
        tCtx.globalCompositeOperation = 'destination-in';
        const grad = tCtx.createRadialGradient(cx, cy, w * 0.16, cx, cy, w * 0.46);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        tCtx.fillStyle = grad;
        tCtx.fillRect(0, 0, w, h);
        ctx.drawImage(tmp, 0, 0);
      }
      return true;
    }

    case 'fade': {
      drawCheckerboard(ctx, w, h, 8);
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tCtx = tmp.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(base, 0, 0, w, h);
        tCtx.globalCompositeOperation = 'destination-in';
        const grad = tCtx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(0.55, 'rgba(0,0,0,0.65)');
        grad.addColorStop(1, 'rgba(0,0,0,0.05)');
        tCtx.fillStyle = grad;
        tCtx.fillRect(0, 0, w, h);
        ctx.drawImage(tmp, 0, 0);
      }
      return true;
    }

    case 'blink':
    case 'strobe':
    case 'flicker': {
      ctx.drawImage(base, 0, 0, w, h);
      // Right side bright flash strobe vs left normal/dimmed split
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.fillRect(0, 0, w * 0.48, h);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.fillRect(w * 0.52, 0, w * 0.48, h);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(w * 0.5 - 1, 0, 2, h);
      ctx.restore();
      return true;
    }

    // ==========================================
    // EDGE / SHADOW / EXTRUSION EFFECTS (inset so alpha edge radiates visibly!)
    // ==========================================
    case 'stroke':
    case 'dropShadow':
    case 'longShadow':
    case 'extrude3d':
    case 'innerGlow': {
      ctx.fillStyle = '#121419';
      ctx.fillRect(0, 0, w, h);
      drawRoundedPortraitInset(ctx, base, 14, 12);
      applyCanvasEffects(
        ctx,
        [
          {
            id: 'thumb',
            type: effectId as any,
            name: effectId,
            enabled: true,
            params: liveMode
              ? { ...params }
              : {
                  ...params,
                  strokeWidth: effectId === 'stroke' ? 5 : params.strokeWidth,
                  color: effectId === 'stroke' ? '#5EEB9A' : effectId === 'innerGlow' ? '#38BDF8' : params.color,
                  blur: effectId === 'dropShadow' ? 10 : params.blur,
                  distance: effectId === 'dropShadow' ? 8 : params.distance,
                  length: effectId === 'longShadow' ? 18 : params.length,
                  depth: effectId === 'extrude3d' ? 14 : params.depth,
                  radius: effectId === 'innerGlow' ? 14 : params.radius,
                },
          },
        ],
        w,
        h,
        15,
        30
      );
      return true;
    }

    // ==========================================
    // WIPES / BLINDS / DISSOLVE OVER CHECKERBOARD
    // ==========================================
    case 'linearWipe':
    case 'wipe':
    case 'radialWipe':
    case 'clockWipe':
    case 'irisWipe':
    case 'blinds':
    case 'checkerboard':
    case 'dissolve': {
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      const tCtx = tmp.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(base, 0, 0, w, h);
        applyCanvasEffects(
          tCtx,
          [
            {
              id: 'thumb',
              type: effectId as any,
              name: effectId,
              enabled: true,
              params: liveMode
                ? { ...params }
                : {
                    ...params,
                    progress: 48,
                    completion: 48,
                    radius: 48,
                    feather: 6,
                    slatCount: 6,
                    boxSize: 18,
                    grainSize: 2,
                  },
            },
          ],
          w,
          h,
          15,
          30
        );
        drawCheckerboard(ctx, w, h, 8);
        ctx.drawImage(tmp, 0, 0);
      }
      return true;
    }

    // ==========================================
    // SPACE STARS (REALISTIC 3D SPHERES)
    // ==========================================
    case 'motionStars':
    case 'starfield': {
      ctx.drawImage(base, 0, 0, w, h);
      ctx.fillStyle = 'rgba(2, 4, 10, 0.72)';
      ctx.fillRect(0, 0, w, h);
      const stars: Array<[number, number, number, 'star4' | 'sparkle' | 'diamond' | 'star5' | 'circle']> = [
        [14, 18, 2.4, 'star4'],
        [36, 14, 2.8, 'diamond'],
        [52, 26, 6.4, 'sparkle'],
        [86, 20, 2.6, 'star5'],
        [98, 38, 1.5, 'circle'],
        [22, 46, 3.8, 'star4'],
        [68, 54, 2.4, 'diamond'],
        [88, 66, 4.6, 'sparkle'],
        [18, 78, 2.8, 'star5'],
        [44, 84, 1.8, 'circle'],
        [72, 92, 3.2, 'star4'],
        [94, 90, 2.2, 'diamond'],
        [30, 62, 1.4, 'circle'],
        [58, 72, 2.0, 'star5'],
      ];
      for (const [sx, sy, sr, kind] of stars) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = sr > 2.5 ? 0.98 : 0.85;
        ctx.beginPath();
        if (kind === 'star4') {
          for (let p = 0; p < 8; p++) {
            const rad = p % 2 === 0 ? sr * 1.4 : sr * 0.35;
            const a = (p * Math.PI) / 4;
            if (p === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();
        } else if (kind === 'star5') {
          for (let p = 0; p < 10; p++) {
            const rad = p % 2 === 0 ? sr * 1.3 : sr * 0.55;
            const a = (p * Math.PI) / 5 - Math.PI / 2;
            if (p === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();
        } else if (kind === 'sparkle') {
          const len = sr * 1.9;
          const wid = sr * 0.25;
          ctx.moveTo(-len, 0);
          ctx.quadraticCurveTo(0, -wid, len, 0);
          ctx.quadraticCurveTo(0, wid, -len, 0);
          ctx.moveTo(0, -len);
          ctx.quadraticCurveTo(wid, 0, 0, len);
          ctx.quadraticCurveTo(-wid, 0, 0, -len);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 0, sr * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 'diamond') {
          ctx.moveTo(0, -sr * 1.3);
          ctx.lineTo(sr * 0.9, 0);
          ctx.lineTo(0, sr * 1.3);
          ctx.lineTo(-sr * 0.9, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.arc(0, 0, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      return true;
    }

    // ==========================================
    // SPACE LINES (3D VOLUMETRIC STREAKS)
    // ==========================================
    case 'spaceLines': {
      ctx.drawImage(base, 0, 0, w, h);
      ctx.fillStyle = 'rgba(2, 5, 14, 0.74)';
      ctx.fillRect(0, 0, w, h);
      const lines: Array<[number, number, number, number, number, string]> = [
        [12, 20, 38, 12, 2.2, '#38BDF8'],
        [62, 16, 98, 28, 1.8, '#FFFFFF'],
        [24, 42, 58, 34, 3.0, '#A855F7'],
        [70, 50, 102, 38, 2.5, '#38BDF8'],
        [10, 68, 46, 58, 1.6, '#E0F2FE'],
        [44, 72, 84, 62, 2.8, '#FFFFFF'],
        [18, 92, 54, 82, 2.2, '#38BDF8'],
        [68, 94, 100, 80, 2.0, '#A855F7'],
        [34, 24, 44, 52, 1.5, '#FFFFFF'],
        [80, 18, 66, 48, 1.5, '#38BDF8'],
      ];
      for (const [x1, y1, x2, y2, lw, col] of lines) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = lw * 2.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, 'rgba(255,255,255,0.05)');
        grad.addColorStop(0.5, col);
        grad.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.strokeStyle = grad;
        ctx.globalAlpha = 0.96;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      }
      return true;
    }

    // ==========================================
    // TEXT & TYPOGRAPHY OVER PORTRAIT
    // ==========================================
    case 'typewriter':
    case 'textTracking':
    case 'charTransform':
    case 'textWave':
    case 'textGlitch':
    case 'textCounter':
    case 'textGradient':
    case 'textGlow':
    case 'textFlipWord':
    case 'textHacker': {
      ctx.save();
      ctx.filter = 'brightness(0.72)';
      ctx.drawImage(base, 0, 0, w, h);
      ctx.restore();

      const gradBottom = ctx.createLinearGradient(0, h * 0.4, 0, h);
      gradBottom.addColorStop(0, 'rgba(0,0,0,0)');
      gradBottom.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = gradBottom;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (effectId === 'typewriter') {
        ctx.font = '900 18px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('TXT_', cx, h * 0.72);
      } else if (effectId === 'textTracking') {
        ctx.font = '900 14px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('A   B   C', cx, h * 0.72);
      } else if (effectId === 'charTransform') {
        ctx.font = '900 19px sans-serif';
        const chars = [
          { ch: 'A', x: -24, y: -4, r: -0.22 },
          { ch: 'B', x: 0, y: 4, r: 0.14 },
          { ch: 'C', x: 24, y: -3, r: 0.24 },
        ];
        ctx.fillStyle = '#FDE047';
        for (const c of chars) {
          ctx.save();
          ctx.translate(cx + c.x, h * 0.72 + c.y);
          ctx.rotate(c.r);
          ctx.fillText(c.ch, 0, 0);
          ctx.restore();
        }
      } else if (effectId === 'textWave') {
        ctx.font = '900 17px sans-serif';
        ctx.fillStyle = '#38BDF8';
        const letters = ['W', 'A', 'V', 'E'];
        letters.forEach((ch, idx) => {
          const lx = cx - 27 + idx * 18;
          const ly = h * 0.72 + Math.sin(idx * 1.4) * 6;
          ctx.fillText(ch, lx, ly);
        });
      } else if (effectId === 'textGlitch') {
        ctx.font = '900 17px monospace';
        ctx.fillStyle = '#00E5FF';
        ctx.fillText('GLITCH', cx - 2.5, h * 0.72 - 1);
        ctx.fillStyle = '#F43F5E';
        ctx.fillText('GLITCH', cx + 2.5, h * 0.72 + 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('GLITCH', cx, h * 0.72);
      } else if (effectId === 'textCounter') {
        ctx.font = '900 19px monospace';
        ctx.fillStyle = '#5EEB9A';
        ctx.fillText('01,248', cx, h * 0.72);
      } else if (effectId === 'textGradient') {
        ctx.font = '900 20px sans-serif';
        const g = ctx.createLinearGradient(16, 0, w - 16, 0);
        g.addColorStop(0, '#00E5FF');
        g.addColorStop(0.5, '#F472B6');
        g.addColorStop(1, '#FACC15');
        ctx.fillStyle = g;
        ctx.fillText('COLOR', cx, h * 0.72);
      } else if (effectId === 'textGlow') {
        ctx.font = '900 20px sans-serif';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('GLOW', cx, h * 0.72);
      } else if (effectId === 'textFlipWord') {
        ctx.font = '800 14px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText('OLD', cx, h * 0.62);
        ctx.fillStyle = '#5EEB9A';
        ctx.fillText('NEW ↕', cx, h * 0.8);
      } else if (effectId === 'textHacker') {
        ctx.font = '900 17px monospace';
        ctx.fillStyle = '#22C55E';
        ctx.shadowColor = '#22C55E';
        ctx.shadowBlur = 6;
        ctx.fillText('0xA9#F', cx, h * 0.72);
      }
      ctx.restore();
      return true;
    }

    default:
      return false;
  }
}

function renderThumbnailToDataUrl(
  base: HTMLCanvasElement,
  effectId: string,
  color: string,
  params: Record<string, any>,
  liveMode = false
): string {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return EFFECTS_PREVIEW_PORTRAIT_URL;

  // 1. Custom portrait preview for motion / 3D / matte / wipe / text / star effects
  if (renderCustomPortraitEffect(ctx, base, effectId, color, params, liveMode)) {
    return canvas.toDataURL('image/jpeg', 0.88);
  }

  // 2. Real engine effect execution on the portrait via applyCanvasEffects
  ctx.drawImage(base, 0, 0, THUMB_SIZE, THUMB_SIZE);

  // Calibrate thumbnail scale parameters so subtle high-res defaults read clearly at 112x112
  const tunedParams: Record<string, any> = { ...params };
  if (liveMode) {
    // Preserve exact user values while proportionally scaling large pixel radii for 112px card
    if (effectId === 'blur' || effectId === 'gaussianBlur' || effectId === 'boxBlur' || effectId === 'fastBlur' || effectId === 'lensBlur') {
      const r = Number(params.radius ?? 0);
      tunedParams.radius = r <= 0 ? 0 : Math.min(12, Math.max(0.5, r * 0.35));
    } else if (effectId === 'pixelate') {
      const bs = Number(params.size ?? params.blockSize ?? 12);
      const scaled = Math.max(2, Math.round(bs * 0.45));
      tunedParams.size = scaled;
      tunedParams.blockSize = scaled;
    } else if (effectId === 'chromatic') {
      const amt = Number(params.amount ?? params.offset ?? params.shift ?? 0);
      tunedParams.amount = amt * 0.65;
      tunedParams.offset = amt * 0.65;
      tunedParams.shift = amt * 0.65;
    }
  } else {
    if (effectId === 'blur' || effectId === 'gaussianBlur' || effectId === 'boxBlur' || effectId === 'fastBlur') {
      tunedParams.radius = Math.min(8, Math.max(3.5, Number(params.radius ?? 5) * 0.45));
    } else if (effectId === 'lensBlur') {
      tunedParams.radius = 6;
    } else if (effectId === 'dirBlur' || effectId === 'motionBlur') {
      tunedParams.strength = 16;
    } else if (effectId === 'radialBlur') {
      tunedParams.amount = 18;
    } else if (effectId === 'zoomBlur') {
      tunedParams.strength = 34;
    } else if (effectId === 'colorTemp') {
      tunedParams.temperature = 3100;
      tunedParams.tint = 10;
    } else if (effectId === 'pixelate') {
      tunedParams.size = 10;
      tunedParams.blockSize = 10;
    } else if (effectId === 'tiles' || effectId === 'mirrorTiles') {
      tunedParams.countX = 3;
      tunedParams.countY = 3;
    } else if (effectId === 'halftone') {
      tunedParams.dotRadius = 4;
    } else if (effectId === 'hexMosaic') {
      tunedParams.hexRadius = 7;
    } else if (effectId === 'wave') {
      tunedParams.amplitude = 7;
      tunedParams.frequency = 0.14;
    } else if (effectId === 'bulge') {
      tunedParams.strength = 0.72;
      tunedParams.radius = 0.85;
    } else if (effectId === 'ripple') {
      tunedParams.amplitude = 6;
    } else if (effectId === 'swirl') {
      tunedParams.angle = 135;
    } else if (effectId === 'glitch' || effectId === 'glitchBlocks') {
      tunedParams.intensity = 1.6;
    } else if (effectId === 'chromatic') {
      tunedParams.amount = 7;
      tunedParams.offset = 7;
      tunedParams.shift = 7;
    }
  }

  const eff: ShaderEffect = {
    id: `preview-${effectId}`,
    type: effectId as any,
    name: effectId,
    enabled: true,
    params: tunedParams,
  };

  applyCanvasEffects(ctx, [eff], THUMB_SIZE, THUMB_SIZE, 16, 30, { layerZ: 220 });
  return canvas.toDataURL('image/jpeg', 0.88);
}

function flushBatchQueue() {
  rafScheduled = false;
  loadBasePortraitCanvas().then((base) => {
    if (!base) {
      pendingTasks.clear();
      taskQueue.length = 0;
      return;
    }

    const startTime = performance.now();
    let count = 0;
    // Process up to 6 thumbnails or ~10ms per frame so UI stays butter smooth
    while (taskQueue.length > 0 && count < 6 && performance.now() - startTime < 12) {
      const key = taskQueue.shift()!;
      const task = pendingTasks.get(key);
      if (!task) continue;
      pendingTasks.delete(key);

      let url = thumbnailCache.get(key);
      if (!url) {
        try {
          url = renderThumbnailToDataUrl(base, task.effectId, task.color, task.params, task.liveMode);
        } catch {
          url = EFFECTS_PREVIEW_PORTRAIT_URL;
        }
        if (thumbnailCache.size > 400) {
          const oldest = thumbnailCache.keys().next().value;
          if (oldest) thumbnailCache.delete(oldest);
        }
        thumbnailCache.set(key, url);
      }

      task.callbacks.forEach((cb) => cb(url!));
      count++;
    }

    if (taskQueue.length > 0 && !rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(flushBatchQueue);
    }
  });
}

export function getEffectThumbnailCacheKey(
  effectId: string,
  params?: Record<string, any>,
  liveMode = false
): string {
  const prefix = liveMode ? `live:${effectId}` : effectId;
  if (!params || Object.keys(params).length === 0) return prefix;
  return `${prefix}:${JSON.stringify(params)}`;
}

export function getCachedEffectThumbnail(
  effectId: string,
  params?: Record<string, any>,
  liveMode = false
): string | undefined {
  return thumbnailCache.get(getEffectThumbnailCacheKey(effectId, params, liveMode));
}

export function requestEffectThumbnail(
  effectId: string,
  color: string,
  params: Record<string, any> = {},
  onReady: (url: string) => void,
  liveMode = false
): () => void {
  const key = getEffectThumbnailCacheKey(effectId, params, liveMode);
  const existing = thumbnailCache.get(key);
  if (existing) {
    onReady(existing);
    return () => {};
  }

  let task = pendingTasks.get(key);
  if (!task) {
    task = {
      key,
      effectId,
      color,
      params,
      liveMode,
      callbacks: new Set(),
    };
    pendingTasks.set(key, task);
    taskQueue.push(key);
  }
  task.callbacks.add(onReady);

  if (!rafScheduled && typeof requestAnimationFrame !== 'undefined') {
    rafScheduled = true;
    requestAnimationFrame(flushBatchQueue);
  }

  return () => {
    const t = pendingTasks.get(key);
    if (t) {
      t.callbacks.delete(onReady);
    }
  };
}
