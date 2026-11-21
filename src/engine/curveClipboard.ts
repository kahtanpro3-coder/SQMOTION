import { BezierHandle, EasingType } from '../types';

export interface StoredCurve {
  handle: BezierHandle;
  easing: EasingType;
  name?: string;
  timestamp: number;
}

let inMemoryCurve: StoredCurve | null = null;
const STORAGE_KEY = 'alight_motion_copied_curve';

// Initialize from localStorage if available
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    inMemoryCurve = JSON.parse(raw);
  }
} catch {
  // Ignore localStorage errors in sandboxed environments
}

const listeners = new Set<() => void>();

export function copyCurveToClipboard(
  handle: BezierHandle,
  easing: EasingType = 'bezier',
  name?: string
): StoredCurve {
  const stored: StoredCurve = {
    handle: {
      x1: Math.round(Math.max(0, Math.min(1, handle.x1)) * 100) / 100,
      y1: Math.round(Math.max(-1, Math.min(2, handle.y1)) * 100) / 100,
      x2: Math.round(Math.max(0, Math.min(1, handle.x2)) * 100) / 100,
      y2: Math.round(Math.max(-1, Math.min(2, handle.y2)) * 100) / 100,
    },
    easing,
    name: name || (easing === 'bezier' ? `Cubic (${handle.x1.toFixed(2)}, ${handle.y1.toFixed(2)})` : easing),
    timestamp: Date.now(),
  };

  inMemoryCurve = stored;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage issues
  }

  listeners.forEach((fn) => fn());
  return stored;
}

export function getCopiedCurveFromClipboard(): StoredCurve | null {
  if (inMemoryCurve) return inMemoryCurve;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      inMemoryCurve = JSON.parse(raw);
      return inMemoryCurve;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function subscribeToCurveClipboard(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
