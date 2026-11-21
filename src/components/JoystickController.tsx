import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Layer, Language } from '../types';
import { Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, Infinity as InfinityIcon, Zap, Play, Pause, Move } from 'lucide-react';

interface JoystickControllerProps {
  layer: Layer;
  lang: Language;
  onUpdatePosition: (newPos: { x: number; y: number; z: number }) => void;
  onUpdateExpression: (expr: string) => void;
  compact?: boolean;
}

export const JoystickController: React.FC<JoystickControllerProps> = ({
  layer,
  lang,
  onUpdatePosition,
  onUpdateExpression,
  compact = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 }); // offset from center in px
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(5);
  const [isInfiniteDrive, setIsInfiniteDrive] = useState<boolean>(false);
  const [activeVelocity, setActiveVelocity] = useState<{ vx: number; vy: number }>({ vx: 0, vy: 0 });

  const joystickRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeVelocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const isDraggingRef = useRef(false);
  const layerPosRef = useRef(layer.transform.position.value);

  // Keep ref up to date
  useEffect(() => {
    layerPosRef.current = layer.transform.position.value;
  }, [layer.transform.position.value]);

  const currentX = layer.transform.position.value.x;
  const currentY = layer.transform.position.value.y;
  const currentZ = layer.transform.position.value.z;
  const currentExpression = layer.transform.position.expression || '';

  // Continuous loop while dragging joystick
  const updateLoop = useCallback(() => {
    if (isDraggingRef.current) {
      const vx = activeVelocityRef.current.vx;
      const vy = activeVelocityRef.current.vy;

      if (vx !== 0 || vy !== 0) {
        onUpdatePosition({
          x: Math.round(layerPosRef.current.x + vx),
          y: Math.round(layerPosRef.current.y + vy),
          z: layerPosRef.current.z,
        });
      }
      animFrameRef.current = requestAnimationFrame(updateLoop);
    }
  }, [onUpdatePosition]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;

    const maxRadius = rect.width / 2 - 12; // Radius bound
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobPos({ x: dx, y: dy });

    // Calculate velocity vector
    const normX = dx / maxRadius; // -1 to 1
    const normY = dy / maxRadius; // -1 to 1

    const vx = normX * speedMultiplier;
    const vy = normY * speedMultiplier;

    activeVelocityRef.current = { vx, vy };
    setActiveVelocity({ vx: Math.round(vx * 10), vy: Math.round(vy * 10) });

    if (!animFrameRef.current) {
      animFrameRef.current = requestAnimationFrame(updateLoop);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // If infinite mode is ON, write velocity expression so it glides forever
    if (isInfiniteDrive && (activeVelocityRef.current.vx !== 0 || activeVelocityRef.current.vy !== 0)) {
      const vx = Math.round(activeVelocityRef.current.vx * 30);
      const vy = Math.round(activeVelocityRef.current.vy * 30);
      onUpdateExpression(`time * ${vx}, time * ${vy}`);
    }

    activeVelocityRef.current = { vx: 0, vy: 0 };
  };

  // Nudge direction button
  const nudgePosition = (dx: number, dy: number) => {
    const step = speedMultiplier * 2;
    const nextX = Math.round(currentX + dx * step);
    const nextY = Math.round(currentY + dy * step);

    if (isInfiniteDrive) {
      const vx = dx * step * 10;
      const vy = dy * step * 10;
      onUpdateExpression(`time * ${vx}, time * ${vy}`);
    } else {
      onUpdatePosition({ x: nextX, y: nextY, z: currentZ });
    }
  };

  return (
    <div className={`bg-[#181818] rounded-lg border border-[#262626] p-3 text-xs select-none space-y-3 ${compact ? 'max-w-xs' : 'w-full'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-2">
        <div className="flex items-center gap-1.5 text-[var(--app-accent-bright)] font-semibold">
          <Gamepad2 className="w-4 h-4" />
          <span>{lang === 'ar' ? 'ذراع التحكم بالتحريك (Joystick)' : 'Joystick Motion Controller'}</span>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-[#1E1E1E] p-0.5 rounded border border-[#262626]">
          {[1, 5, 15, 30].map((s) => (
            <button
              key={s}
              onClick={() => setSpeedMultiplier(s)}
              className={`px-1.5 py-0.5 text-[10px] rounded font-mono transition-colors ${
                speedMultiplier === s ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-bold' : 'text-[#808080] hover:text-white'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Main Joystick Pad & D-Pad Split */}
      <div className="grid grid-cols-2 gap-3 items-center">
        {/* Analog Joystick Pad */}
        <div className="flex flex-col items-center">
          <div
            ref={joystickRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={isDragging ? { boxShadow: '0 0 15px var(--app-accent-glow)' } : undefined}
            className={`w-28 h-28 rounded-full bg-[#111111] border-2 ${
              isDragging ? 'border-[var(--app-accent-bright)]' : 'border-[#333333]'
            } relative flex items-center justify-center cursor-grab active:cursor-grabbing touch-none`}
          >
            {/* Crosshair guide lines */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-full h-px bg-[var(--app-accent-bright)]" />
              <div className="h-full w-px bg-[var(--app-accent-bright)] absolute" />
            </div>

            {/* Inner Ring Guide */}
            <div className="w-16 h-16 rounded-full border border-dashed border-[rgba(var(--app-accent-bright-rgb),0.3)] pointer-events-none" />

            {/* Movable Thumbstick Knob */}
            <div
              className={`w-10 h-10 rounded-full shadow-lg border border-white/40 flex items-center justify-center transition-transform ${
                isDragging ? 'scale-110' : ''
              }`}
              style={{
                background: 'var(--app-accent-grad)',
                transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
              }}
            >
              <div className="w-3 h-3 rounded-full bg-white/80 shadow-inner" />
            </div>
          </div>
          <span className="text-[9px] text-[#808080] mt-1.5 font-mono">
            {isDragging ? `Vx: ${activeVelocity.vx} | Vy: ${activeVelocity.vy}` : lang === 'ar' ? 'اسحب الجويستك للتحريك' : 'Drag Joystick Pad'}
          </span>
        </div>

        {/* D-Pad Buttons */}
        <div className="flex flex-col items-center justify-center space-y-1">
          <button
            onClick={() => nudgePosition(0, -1)}
            className="w-8 h-8 bg-[#1E1E1E] hover:bg-[var(--app-accent-solid)] hover:text-[var(--app-accent-contrast)] text-[#E0E0E0] rounded border border-[#262626] flex items-center justify-center transition-colors shadow"
            title="Move Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => nudgePosition(-1, 0)}
              className="w-8 h-8 bg-[#1E1E1E] hover:bg-[var(--app-accent-solid)] hover:text-[var(--app-accent-contrast)] text-[#E0E0E0] rounded border border-[#262626] flex items-center justify-center transition-colors shadow"
              title="Move Left"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onUpdatePosition({ x: 640, y: 360, z: currentZ })}
              className="w-8 h-8 bg-[#1E1E1E] hover:bg-[#262626] text-[var(--app-accent-bright)] rounded border border-[#262626] flex items-center justify-center transition-colors"
              title="Reset to Center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => nudgePosition(1, 0)}
              className="w-8 h-8 bg-[#1E1E1E] hover:bg-[var(--app-accent-solid)] hover:text-[var(--app-accent-contrast)] text-[#E0E0E0] rounded border border-[#262626] flex items-center justify-center transition-colors shadow"
              title="Move Right"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => nudgePosition(0, 1)}
            className="w-8 h-8 bg-[#1E1E1E] hover:bg-[var(--app-accent-solid)] hover:text-[var(--app-accent-contrast)] text-[#E0E0E0] rounded border border-[#262626] flex items-center justify-center transition-colors shadow"
            title="Move Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Infinite Mode Drive Toggle */}
      <div className="pt-2 border-t border-[#262626] space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsInfiniteDrive(!isInfiniteDrive)}
            style={isInfiniteDrive ? { boxShadow: '0 0 10px var(--app-accent-glow)' } : undefined}
            className={`flex-1 py-1.5 px-2.5 rounded border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
              isInfiniteDrive
                ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] border-[var(--app-accent-bright)]'
                : 'bg-[#1E1E1E] text-[#808080] hover:text-white border-[#262626]'
            }`}
          >
            <InfinityIcon className={`w-4 h-4 ${isInfiniteDrive ? 'animate-spin' : ''}`} />
            <span>{lang === 'ar' ? 'وضع التحريك اللانهائي' : 'Infinite Motion Drive'}</span>
          </button>
        </div>

        {/* Instant Infinite Velocity Presets */}
        <div className="space-y-1">
          <span className="text-[10px] text-[#666666] font-medium block">
            {lang === 'ar' ? 'أنماط حركة لانهائية سريعة:' : 'Quick Infinite Motion Presets:'}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onUpdateExpression('time * 180, time * 0')}
              className="p-1.5 bg-[#1E1E1E] hover:bg-[#262626] border border-[#262626] rounded text-[10px] text-[var(--app-accent-light)] text-left truncate flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-[var(--app-accent-bright)]" />
              <span>{lang === 'ar' ? 'طيران أفقي لا نهائي' : 'Infinite Horizontal'}</span>
            </button>

            <button
              onClick={() => onUpdateExpression('time * 0, time * -180')}
              className="p-1.5 bg-[#1E1E1E] hover:bg-[#262626] border border-[#262626] rounded text-[10px] text-[var(--app-accent-light)] text-left truncate flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-[var(--app-accent-bright)]" />
              <span>{lang === 'ar' ? 'صعود رأسي لا نهائي' : 'Infinite Vertical'}</span>
            </button>

            <button
              onClick={() => onUpdateExpression('time * 150, time * 120')}
              className="p-1.5 bg-[#1E1E1E] hover:bg-[#262626] border border-[#262626] rounded text-[10px] text-[var(--app-accent-light)] text-left truncate flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-[var(--app-accent-bright)]" />
              <span>{lang === 'ar' ? 'طيران قطري لا نهائي' : 'Infinite Diagonal'}</span>
            </button>

            <button
              onClick={() => onUpdateExpression('wiggle(5, 50)')}
              className="p-1.5 bg-[#1E1E1E] hover:bg-[#262626] border border-[#262626] rounded text-[10px] text-[var(--app-accent-light)] text-left truncate flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-[var(--app-accent-bright)]" />
              <span>{lang === 'ar' ? 'اهتزاز لا نهائي' : 'Infinite Wiggle'}</span>
            </button>
          </div>

          {currentExpression && (
            <div className="mt-1 flex items-center justify-between bg-[#111111] px-2 py-1 rounded border border-[#262626]">
              <span className="text-[10px] font-mono text-[var(--app-accent-bright)] truncate">{currentExpression}</span>
              <button
                onClick={() => onUpdateExpression('')}
                className="text-[10px] text-red-400 hover:text-red-300 font-bold px-1"
                title="Clear Expression"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
