import React, { useRef, useState, useEffect } from 'react';
import { useAppTheme } from '../utils/appSettings';

interface PrecisionRulerScrubberProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  accentColor?: string;
  needleColor?: string;
  defaultValue?: number;
  unit?: string;
  decimals?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
  sensitivityScale?: number;
}

/**
 * Tactile horizontal tick-mark ruler scrubber (matching Alight Motion precision scrubbers).
 * Drag left / right smoothly with mouse, touch, or scroll wheel for micro-accurate tuning.
 */
export const PrecisionRulerScrubber: React.FC<PrecisionRulerScrubberProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  accentColor,
  needleColor,
  defaultValue,
  unit = '',
  decimals,
  height = 38,
  className = '',
  ariaLabel,
  sensitivityScale = 1,
}) => {
  const { palette } = useAppTheme();
  const resolvedAccent = accentColor || palette.bright;
  const stripRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startVal: number;
  }>({
    pointerId: null,
    startX: 0,
    startVal: value,
  });

  const resolvedDecimals =
    decimals !== undefined
      ? decimals
      : step < 0.005
      ? 3
      : step < 0.05
      ? 2
      : step < 1
      ? 1
      : 0;

  const clampAndQuantize = (raw: number): number => {
    const clamped = Math.min(max, Math.max(min, raw));
    const factor = 1 / Math.max(0.0001, step);
    const snapped = Math.round((clamped - min) * factor) / factor + min;
    const clampedSnapped = Math.min(max, Math.max(min, snapped));
    return Number(clampedSnapped.toFixed(Math.max(resolvedDecimals, 4)));
  };

  // Dynamic sensitivity: small pixel drag feels buttery accurate regardless of range size
  const span = Math.max(0.0001, max - min);
  const totalPixelsForSpan = Math.min(420, Math.max(220, (span / step) * 2.2));
  const valuePerPixel = span / totalPixelsForSpan;

  // Keep local visual offset synced smoothly with current value
  const normalizedPos = (Math.min(max, Math.max(min, value)) - min) / span;
  // Translate tick track proportionally to value so ticks physically scroll under center needle
  const tickSpacing = 8; // px per minor tick
  const majorEvery = 5;
  const virtualTravelPx = totalPixelsForSpan * 1.4;
  const scrollOffsetPx = -normalizedPos * virtualTravelPx;

  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalUp = () => {
      setIsDragging(false);
      dragStateRef.current.pointerId = null;
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [isDragging]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = stripRef.current;
    if (el && el.setPointerCapture) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture not supported
      }
    }
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startVal: value,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragStateRef.current.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - dragStateRef.current.startX;
    // Holding Shift multiplies precision 4x for ultra-fine micro edits, scaled by sensitivityScale
    const fineFactor = (e.shiftKey ? 0.2 : 1) * Math.max(0.02, sensitivityScale);
    const nextRaw = dragStateRef.current.startVal + dx * valuePerPixel * fineFactor;
    const nextVal = clampAndQuantize(nextRaw);
    if (nextVal !== value) {
      onChange(nextVal);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    const el = stripRef.current;
    if (el && el.releasePointerCapture) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
    dragStateRef.current.pointerId = null;
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
    if (rawDelta === 0) return;
    e.stopPropagation();
    const stepsCount = rawDelta > 0 ? 1 : -1;
    const nextVal = clampAndQuantize(value + stepsCount * step);
    if (nextVal !== value) {
      onChange(nextVal);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (defaultValue !== undefined) {
      onChange(clampAndQuantize(defaultValue));
    }
  };

  const activeNeedle = isDragging ? '#FFFFFF' : needleColor || resolvedAccent;

  return (
    <div
      ref={stripRef}
      dir="ltr"
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${Number(value).toFixed(resolvedDecimals)}${unit}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          onChange(clampAndQuantize(value + step * (e.shiftKey ? 10 : 1)));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(clampAndQuantize(value - step * (e.shiftKey ? 10 : 1)));
        }
      }}
      style={{ height: `${height}px` }}
      className={`relative w-full select-none touch-none overflow-hidden rounded-[8px] cursor-ew-resize transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--app-accent-bright)] ${
        isDragging ? 'bg-[#26282E]' : 'bg-[#1C1D22] hover:bg-[#222329]'
      } border border-white/[0.06] ${className}`}
    >
      {/* Faded Vertical Tick Ruler Strip */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 14%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 65%, rgba(0,0,0,0.45) 86%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.45) 14%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 65%, rgba(0,0,0,0.45) 86%, transparent 100%)',
        }}
      >
        {/* Repeating crisp tick pattern shifted continuously as value changes */}
        <div
          className="absolute inset-y-1.5 left-[-64px] right-[-64px]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                to right,
                rgba(255, 255, 255, 0.42) 0px,
                rgba(255, 255, 255, 0.42) 1.5px,
                transparent 1.5px,
                transparent ${tickSpacing * majorEvery}px
              ),
              repeating-linear-gradient(
                to right,
                rgba(255, 255, 255, 0.18) 0px,
                rgba(255, 255, 255, 0.18) 1px,
                transparent 1px,
                transparent ${tickSpacing}px
              )
            `,
            backgroundPositionX: `calc(50% + ${scrollOffsetPx.toFixed(1)}px)`,
          }}
        />
      </div>

      {/* Subtle Edge Direction Hints */}
      <div className="absolute inset-y-0 left-1.5 flex items-center pointer-events-none opacity-35 text-[9px] font-mono text-slate-400">
        ‹
      </div>
      <div className="absolute inset-y-0 right-1.5 flex items-center pointer-events-none opacity-35 text-[9px] font-mono text-slate-400">
        ›
      </div>

      {/* Stationary Center Precision Needle */}
      <div
        className="absolute top-0.5 bottom-0.5 left-1/2 -translate-x-1/2 w-[2px] rounded-full pointer-events-none transition-colors duration-100"
        style={{
          backgroundColor: activeNeedle,
          boxShadow: isDragging
            ? `0 0 8px ${activeNeedle}`
            : activeNeedle.startsWith('#')
            ? `0 0 4px ${activeNeedle}66`
            : '0 0 4px rgba(var(--app-accent-bright-rgb), 0.4)',
        }}
      />
    </div>
  );
};
