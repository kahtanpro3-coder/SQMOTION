import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Repeat,
  RotateCcw,
  Sparkles,
  Zap,
  TrendingUp,
  Activity,
  Layers,
  Copy,
  ClipboardPaste,
  Check,
  ChevronLeft,
  ChevronRight,
  CopyCheck,
  Star,
} from 'lucide-react';
import { Language, Keyframe, BezierHandle, EasingType } from '../types';
import {
  copyCurveToClipboard,
  getCopiedCurveFromClipboard,
  subscribeToCurveClipboard,
  StoredCurve,
} from '../engine/curveClipboard';
import { loadFavoritesState, toggleFavoriteItem } from '../engine/favoritesStore';
import { useAppTheme } from '../utils/appSettings';

interface AlightBezierGraphProps {
  lang: Language;
  bezierHandle: { x1: number; y1: number; x2: number; y2: number };
  onChangeHandle: (handle: { x1: number; y1: number; x2: number; y2: number }, easingName?: string) => void;
  onClose: () => void;
  // Keyframe segment management
  keyframes?: Keyframe<any>[];
  activeSegmentIndex?: number;
  onSelectSegment?: (segmentIndex: number) => void;
  onApplyToAllSegments?: (handle: BezierHandle, easing: EasingType) => void;
  propertyName?: string;
}

export const AlightBezierGraph: React.FC<AlightBezierGraphProps> = ({
  lang,
  bezierHandle,
  onChangeHandle,
  onClose,
  keyframes = [],
  activeSegmentIndex = 0,
  onSelectSegment,
  onApplyToAllSegments,
  propertyName,
}) => {
  const { palette } = useAppTheme();
  const [categoryTab, setCategoryTab] = useState<'bezier' | 'elastic' | 'stepped'>('bezier');
  const [presetTab, setPresetTab] = useState<number | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<1 | 2 | null>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Toast / notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  // Curve clipboard state
  const [clipboardCurve, setClipboardCurve] = useState<StoredCurve | null>(() => getCopiedCurveFromClipboard());

  useEffect(() => {
    return subscribeToCurveClipboard(() => {
      setClipboardCurve(getCopiedCurveFromClipboard());
    });
  }, []);

  const [easingLabel, setEasingLabel] = useState<string>(
    lang === 'ar' ? 'منحنى بيزيي مكعب حر' : 'Free Cubic Bezier'
  );

  // Sort keyframes to calculate total segments
  const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);
  const totalSegments = Math.max(1, sortedKeyframes.length - 1);
  const currentSegment = sortedKeyframes.length >= 2 ? activeSegmentIndex : 0;
  const currentKfStart = sortedKeyframes[currentSegment];
  const currentKfEnd = sortedKeyframes[currentSegment + 1];

  // SVG coordinate system
  const svgWidth = 320;
  const svgHeight = 180;
  const marginX = 25;
  const marginY = 30;

  // Normalized (0,0) is at (marginX, svgHeight - marginY)
  // Normalized (1,1) is at (svgWidth - marginX, marginY)
  const p0 = { x: marginX, y: svgHeight - marginY }; // Bottom-Left (0,0)
  const p3 = { x: svgWidth - marginX, y: marginY }; // Top-Right (1,1)

  const drawW = p3.x - p0.x;
  const drawH = p0.y - p3.y;

  // Safe numerical values for handle points
  const hX1 = Number.isFinite(bezierHandle.x1) ? Math.max(0, Math.min(1, bezierHandle.x1)) : 0.25;
  const hY1 = Number.isFinite(bezierHandle.y1) ? Math.max(-0.4, Math.min(1.4, bezierHandle.y1)) : 0.1;
  const hX2 = Number.isFinite(bezierHandle.x2) ? Math.max(0, Math.min(1, bezierHandle.x2)) : 0.25;
  const hY2 = Number.isFinite(bezierHandle.y2) ? Math.max(-0.4, Math.min(1.4, bezierHandle.y2)) : 1.0;

  const p1 = {
    x: p0.x + hX1 * drawW,
    y: p0.y - hY1 * drawH,
  };

  const p2 = {
    x: p0.x + hX2 * drawW,
    y: p0.y - hY2 * drawH,
  };

  // Pointer drag logic with exact 1:1 coordinate projection
  const handlePointerDown = (handleIndex: 1 | 2, e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingHandle(handleIndex);
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingHandle || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      // Calculate position relative to SVG coordinate space
      const mouseSvgX = ((e.clientX - rect.left) / rect.width) * svgWidth;
      const mouseSvgY = ((e.clientY - rect.top) / rect.height) * svgHeight;

      // Convert to normalized (0..1) bezier coordinates
      const normX = (mouseSvgX - p0.x) / drawW;
      const normY = (p0.y - mouseSvgY) / drawH;

      // Keep X strictly between 0 and 1 (time monotonicity)
      // Allow Y free travel between -0.4 and 1.4 for overshoot, anticipation, and bounce
      const clampedX = Math.max(0, Math.min(1, normX));
      const clampedY = Math.max(-0.35, Math.min(1.35, normY));

      const newHandle = {
        x1: hX1,
        y1: hY1,
        x2: hX2,
        y2: hY2,
      };

      if (draggingHandle === 1) {
        newHandle.x1 = Math.round(clampedX * 100) / 100;
        newHandle.y1 = Math.round(clampedY * 100) / 100;
      } else {
        newHandle.x2 = Math.round(clampedX * 100) / 100;
        newHandle.y2 = Math.round(clampedY * 100) / 100;
      }

      setPresetTab(null);
      onChangeHandle(newHandle, 'bezier');
      setEasingLabel(lang === 'ar' ? 'منحنى مخصص حر' : 'Custom Free Curve');
    };

    const handlePointerUp = () => {
      setDraggingHandle(null);
    };

    if (draggingHandle) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingHandle, hX1, hY1, hX2, hY2, drawW, drawH, p0.x, p0.y, onChangeHandle, lang]);

  // Presets
  const applyPreset = (index: number) => {
    setPresetTab(index);
    if (index === 0) {
      // Linear
      const h = { x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0 };
      onChangeHandle(h, 'linear');
      setEasingLabel(lang === 'ar' ? 'خطي منتظم (Linear)' : 'Linear (Constant Speed)');
    } else if (index === 1) {
      // Ease In (Accelerate)
      const h = { x1: 0.42, y1: 0.0, x2: 1.0, y2: 1.0 };
      onChangeHandle(h, 'ease-in');
      setEasingLabel(lang === 'ar' ? 'تسارع بطيء ثم سريع (Ease In)' : 'Ease In (Accelerate)');
    } else if (index === 2) {
      // Ease Out (Decelerate)
      const h = { x1: 0.0, y1: 0.0, x2: 0.58, y2: 1.0 };
      onChangeHandle(h, 'ease-out');
      setEasingLabel(lang === 'ar' ? 'انطلاق سريع ثم تباطؤ (Ease Out)' : 'Ease Out (Decelerate)');
    } else if (index === 3) {
      // Ease In Out (Smooth S-Curve)
      const h = { x1: 0.42, y1: 0.0, x2: 0.58, y2: 1.0 };
      onChangeHandle(h, 'ease-in-out');
      setEasingLabel(lang === 'ar' ? 'تسارع وتباطؤ سلس (Ease In Out)' : 'Ease In-Out (Smooth)');
    } else if (index === 4) {
      // Fast Sharp Snappy
      const h = { x1: 0.15, y1: 0.85, x2: 0.35, y2: 1.0 };
      onChangeHandle(h, 'bezier');
      setEasingLabel(lang === 'ar' ? 'خاطف وسريع (Fast Snap)' : 'Fast Snap');
    } else if (index === 5) {
      // Overshoot / Springy Bounce
      const h = { x1: 0.34, y1: 1.35, x2: 0.64, y2: 1.0 };
      onChangeHandle(h, 'bezier');
      setEasingLabel(lang === 'ar' ? 'ارتداد وتجاوز الهدف (Overshoot)' : 'Overshoot Bounce');
    } else if (index === 6) {
      // Alight Motion Signature Ultra-Smooth
      const h = { x1: 0.1, y1: 0.9, x2: 0.2, y2: 1.0 };
      onChangeHandle(h, 'bezier');
      setEasingLabel(lang === 'ar' ? 'سلاسة لايت موشن الشهيرة (Alight Ultra Smooth)' : 'Alight Signature Ultra Smooth');
    } else if (index === 7) {
      // Spring Bounce Kick
      const h = { x1: 0.05, y1: 1.25, x2: 0.35, y2: 1.0 };
      onChangeHandle(h, 'bezier');
      setEasingLabel(lang === 'ar' ? 'انسياب نابض حر (Elastic Kick)' : 'Elastic Kick Bounce');
    }
  };

  // Flip Curve
  const handleFlip = () => {
    const flipped = {
      x1: Math.round((1 - hX2) * 100) / 100,
      y1: Math.round((1 - hY2) * 100) / 100,
      x2: Math.round((1 - hX1) * 100) / 100,
      y2: Math.round((1 - hY1) * 100) / 100,
    };
    setPresetTab(null);
    onChangeHandle(flipped, 'bezier');
    showToast(lang === 'ar' ? 'تم عكس اتجاه المنحنى 🔄' : 'Curve Flipped 🔄');
  };

  // Reset to default smooth curve
  const handleReset = () => {
    const defaultH = { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 };
    setPresetTab(3);
    onChangeHandle(defaultH, 'ease-in-out');
    setEasingLabel(lang === 'ar' ? 'المنحنى الافتراضي السلس' : 'Default Smooth Bezier');
    showToast(lang === 'ar' ? 'تمت إعادة تعيين المنحنى ↺' : 'Curve Reset ↺');
  };

  // Copy current curve to clipboard
  const handleCopyCurve = () => {
    const curHandle: BezierHandle = { x1: hX1, y1: hY1, x2: hX2, y2: hY2 };
    const easing: EasingType = (categoryTab === 'elastic' ? 'bounce' : categoryTab === 'stepped' ? 'stepped' : 'bezier') as EasingType;
    copyCurveToClipboard(curHandle, easing, easingLabel);
    showToast(lang === 'ar' ? '📋 تم نسخ المنحنى بنجاح!' : '📋 Curve Copied to Clipboard!');
  };

  // Paste curve from clipboard into current keyframe segment
  const handlePasteCurve = () => {
    const copied = getCopiedCurveFromClipboard();
    if (!copied) {
      showToast(lang === 'ar' ? '⚠️ لم يتم نسخ أي منحنى بعد' : '⚠️ No curve copied in clipboard');
      return;
    }
    setPresetTab(null);
    onChangeHandle(copied.handle, copied.easing);
    setEasingLabel(copied.name || (lang === 'ar' ? 'منحنى ملصوق' : 'Pasted Curve'));
    showToast(lang === 'ar' ? `📥 تم لصق المنحنى بنجاح!` : `📥 Curve Pasted Successfully!`);
  };

  // Copy curve across all keyframe segments of this property
  const handleApplyAll = () => {
    if (onApplyToAllSegments) {
      const curHandle: BezierHandle = { x1: hX1, y1: hY1, x2: hX2, y2: hY2 };
      const easing: EasingType = (categoryTab === 'elastic' ? 'bounce' : categoryTab === 'stepped' ? 'stepped' : 'bezier') as EasingType;
      onApplyToAllSegments(curHandle, easing);
      showToast(lang === 'ar' ? '✨ تم تطبيق المنحنى على جميع الكي فريمات!' : '✨ Applied to all keyframe segments!');
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 h-full bg-[#0C0D12] text-slate-200 select-none flex flex-col border-t border-white/[0.08] font-sans relative overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{ boxShadow: '0 0 16px var(--app-accent-glow)' }}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-extrabold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 animate-scaleIn"
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Segment Selector Bar (Independent Keyframe Segments) */}
      {sortedKeyframes.length >= 2 && (
        <div className="px-2.5 py-1 bg-[#090A0E] border-b border-white/[0.07] flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[70%]">
            <span className="text-[10px] font-bold text-slate-400 shrink-0">
              {lang === 'ar' ? 'المقطع:' : 'Segment:'}
            </span>
            {Array.from({ length: totalSegments }).map((_, idx) => {
              const kf1 = sortedKeyframes[idx];
              const kf2 = sortedKeyframes[idx + 1];
              const isActive = idx === currentSegment;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectSegment && onSelectSegment(idx)}
                  style={isActive ? { boxShadow: '0 0 8px var(--app-accent-glow)' } : undefined}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all shrink-0 flex items-center gap-1 border ${
                    isActive
                      ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] border-[var(--app-accent-bright)] scale-105'
                      : 'bg-[#15171E] hover:bg-[#1E212B] text-slate-300 border-white/[0.08]'
                  }`}
                  title={lang === 'ar' ? `المقطع ${idx + 1} من فريم ${kf1?.frame} إلى ${kf2?.frame}` : `Segment ${idx + 1}: ${kf1?.frame}f ➔ ${kf2?.frame}f`}
                >
                  <span>{idx + 1}</span>
                  <span className="opacity-75">({kf1?.frame}f➔{kf2?.frame}f)</span>
                </button>
              );
            })}
          </div>

          {/* Quick Segment Prev / Next Steppers */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onSelectSegment && onSelectSegment(Math.max(0, currentSegment - 1))}
              disabled={currentSegment <= 0}
              className="p-1 rounded bg-[#15171E] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-white/[0.08]"
              title={lang === 'ar' ? 'المقطع السابق' : 'Previous Segment'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSelectSegment && onSelectSegment(Math.min(totalSegments - 1, currentSegment + 1))}
              disabled={currentSegment >= totalSegments - 1}
              className="p-1 rounded bg-[#15171E] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-white/[0.08]"
              title={lang === 'ar' ? 'المقطع التالي' : 'Next Segment'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Curve Editor Body */}
      <div className="flex-1 flex items-stretch min-h-0 overflow-hidden">
        {/* Left Toolbar Column 1: Mode Category Tabs */}
        <div className="w-11 bg-[#08090D] border-r border-white/[0.07] flex flex-col items-center py-1.5 gap-2 z-10 overflow-y-auto no-scrollbar shrink-0">
          {/* Bezier Tab */}
          <button
            onClick={() => {
              setCategoryTab('bezier');
              applyPreset(3);
            }}
            style={categoryTab === 'bezier' ? { boxShadow: '0 0 10px var(--app-accent-glow)' } : undefined}
            className={`p-2 rounded-xl transition-all ${
              categoryTab === 'bezier'
                ? 'bg-[rgba(var(--app-accent-bright-rgb),0.15)] border border-[var(--app-accent-bright)] text-[var(--app-accent-bright)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={lang === 'ar' ? 'منحنى بيزيي السلس والحر' : 'Bezier Curve'}
          >
            <svg className="w-5 h-5 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
              <path d="M3 19 C8 19, 16 5, 21 5" strokeLinecap="round" />
            </svg>
          </button>

          {/* Elastic / Bounce Tab */}
          <button
            onClick={() => {
              setCategoryTab('elastic');
              onChangeHandle({ x1: 0.35, y1: 1.3, x2: 0.65, y2: 1.0 }, 'bounce');
              setEasingLabel(lang === 'ar' ? 'ارتداد مطاطي (Bounce)' : 'Elastic Bounce');
            }}
            style={categoryTab === 'elastic' ? { boxShadow: '0 0 10px var(--app-accent-glow)' } : undefined}
            className={`p-2 rounded-xl transition-all ${
              categoryTab === 'elastic'
                ? 'bg-[rgba(var(--app-accent-bright-rgb),0.15)] border border-[var(--app-accent-bright)] text-[var(--app-accent-bright)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={lang === 'ar' ? 'الارتداد والاهتزاز المطاطي' : 'Bounce & Elastic'}
          >
            <svg className="w-5 h-5 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
              <path d="M3 17 Q7 5 10 17 T15 17 T18 17 T21 17" strokeLinecap="round" />
            </svg>
          </button>

          {/* Stepped / Linear Tab */}
          <button
            onClick={() => {
              setCategoryTab('stepped');
              onChangeHandle({ x1: 0, y1: 0, x2: 0, y2: 1 }, 'stepped');
              setEasingLabel(lang === 'ar' ? 'توقف فجائي متقطع (Stepped / Hold)' : 'Stepped Hold');
            }}
            style={categoryTab === 'stepped' ? { boxShadow: '0 0 10px var(--app-accent-glow)' } : undefined}
            className={`p-2 rounded-xl transition-all ${
              categoryTab === 'stepped'
                ? 'bg-[rgba(var(--app-accent-bright-rgb),0.15)] border border-[var(--app-accent-bright)] text-[var(--app-accent-bright)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={lang === 'ar' ? 'منحنى متقطع / خطي' : 'Stepped / Linear'}
          >
            <svg className="w-5 h-5 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
              <path d="M3 19 L10 19 L10 12 L17 12 L17 5 L21 5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Left Toolbar Column 2: Presets Column */}
        <div className="w-11 bg-[#0B0C10] border-r border-white/[0.07] flex flex-col items-center py-1.5 gap-1 z-10 overflow-y-auto no-scrollbar shrink-0">
          {/* Preset 0: Linear Diagonal */}
          <button
            onClick={() => applyPreset(0)}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 0
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-secondary)] text-[var(--app-accent-secondary)]'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
            title={lang === 'ar' ? 'خطي (Linear)' : 'Linear'}
          >
            <svg className="w-4 h-4 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
              <line x1="4" y1="20" x2="20" y2="4" strokeLinecap="round" />
            </svg>
          </button>

          {/* Preset 1: Ease In */}
          <button
            onClick={() => applyPreset(1)}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 1
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-secondary)] text-[var(--app-accent-secondary)]'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
            title={lang === 'ar' ? 'تسارع دخول (Ease In)' : 'Ease In'}
          >
            <svg className="w-4 h-4 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
              <path d="M4 20 Q 20 20 20 4" strokeLinecap="round" />
            </svg>
          </button>

          {/* Preset 2: Ease Out */}
          <button
            onClick={() => applyPreset(2)}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 2
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-secondary)] text-[var(--app-accent-secondary)]'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
            title={lang === 'ar' ? 'تباطؤ خروج (Ease Out)' : 'Ease Out'}
          >
            <svg className="w-4 h-4 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
              <path d="M4 20 Q 4 4 20 4" strokeLinecap="round" />
            </svg>
          </button>

          {/* Preset 3: S-Curve */}
          <button
            onClick={() => applyPreset(3)}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 3
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-secondary)] text-[var(--app-accent-secondary)]'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
            title={lang === 'ar' ? 'سلس (Ease In Out)' : 'Ease In Out'}
          >
            <svg className="w-4 h-4 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
              <path d="M4 20 C 12 20, 12 4, 20 4" strokeLinecap="round" />
            </svg>
          </button>

          {/* Preset 4: Fast Snap */}
          <button
            onClick={() => applyPreset(4)}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 4
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-secondary)] text-[var(--app-accent-secondary)]'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
            title={lang === 'ar' ? 'خاطف سريع (Fast Snap)' : 'Fast Snap'}
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* Preset 5: Overshoot */}
          <button
            onClick={() => applyPreset(5)}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 5
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-secondary)] text-[var(--app-accent-secondary)]'
                : 'border-white/[0.08] text-slate-400 hover:text-white'
            }`}
            title={lang === 'ar' ? 'تجاوز الهدف (Overshoot)' : 'Overshoot'}
          >
            <TrendingUp className="w-4 h-4" />
          </button>

          {/* Preset 6: Signature Alight Motion Smooth */}
          <button
            onClick={() => applyPreset(6)}
            style={presetTab === 6 ? { boxShadow: '0 0 10px var(--app-accent-glow)' } : undefined}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 6
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-bright)] text-[var(--app-accent-bright)]'
                : 'border-white/[0.08] text-[var(--app-accent-bright)] hover:text-[var(--app-accent-light)]'
            }`}
            title={lang === 'ar' ? 'سلاسة لايت موشن الشهيرة (Alight Ultra Smooth)' : 'Alight Signature Ultra Smooth'}
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Preset 7: Dynamic Elastic Kick */}
          <button
            onClick={() => applyPreset(7)}
            style={presetTab === 7 ? { boxShadow: '0 0 10px rgba(var(--app-accent-secondary-rgb), 0.35)' } : undefined}
            className={`p-1.5 rounded-lg border transition-all ${
              presetTab === 7
                ? 'bg-[var(--app-accent-surface)] border-[var(--app-accent-secondary)] text-[var(--app-accent-secondary)]'
                : 'border-white/[0.08] text-[var(--app-accent-secondary)] hover:text-[var(--app-accent-light)]'
            }`}
            title={lang === 'ar' ? 'انسياب نابض حيوي (Elastic Kick)' : 'Elastic Kick Bounce'}
          >
            <Activity className="w-4 h-4" />
          </button>
        </div>

        {/* Central Bezier Canvas Graph */}
        <div className="flex-1 min-w-0 min-h-0 relative bg-[#101218] flex flex-col justify-between overflow-hidden">
          {/* SVG Interactive Canvas */}
          <div ref={graphRef} className="relative w-full flex-1 min-h-0 flex items-center justify-center p-1.5 cursor-crosshair touch-none">
            <svg
              ref={svgRef}
              className="w-full h-full"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
            >
              {/* Grid Pattern */}
              <defs>
                <pattern id="graph-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeDasharray="2 2" />
                </pattern>
              </defs>
              <rect width={svgWidth} height={svgHeight} fill="url(#graph-grid)" />

              {/* Baseline 0 and Ceiling 1 Guides */}
              <line x1={p0.x} y1={p0.y} x2={p3.x} y2={p0.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <line x1={p0.x} y1={p3.y} x2={p3.x} y2={p3.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

              {/* Center Dashed Vertical & Horizontal Guides */}
              <line
                x1={p0.x + drawW / 2}
                y1={marginY - 10}
                x2={p0.x + drawW / 2}
                y2={svgHeight - marginY + 10}
                stroke={`rgba(${palette.secondaryRgb}, 0.22)`}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={marginX - 10}
                y1={p0.y - drawH / 2}
                x2={svgWidth - marginX + 10}
                y2={p0.y - drawH / 2}
                stroke={`rgba(${palette.secondaryRgb}, 0.22)`}
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Dotted Handle Control Lines */}
              <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={palette.bright} strokeWidth="1.8" strokeDasharray="3 3" />
              <line x1={p3.x} y1={p3.y} x2={p2.x} y2={p2.y} stroke={palette.secondary} strokeWidth="1.8" strokeDasharray="3 3" />

              {/* Active Theme Bezier Curve */}
              <path
                d={`M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`}
                fill="none"
                stroke={palette.bright}
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Anchor End Points */}
              <circle cx={p0.x} cy={p0.y} r="4" fill={palette.bright} stroke="#ffffff" strokeWidth="1.5" />
              <circle cx={p3.x} cy={p3.y} r="4" fill={palette.secondary} stroke="#ffffff" strokeWidth="1.5" />

              {/* Handle 1 Control Circle */}
              <g
                className="cursor-pointer group"
                onPointerDown={(e) => handlePointerDown(1, e)}
              >
                <circle cx={p1.x} cy={p1.y} r="18" fill="transparent" />
                <circle cx={p1.x} cy={p1.y} r="8" fill={palette.bright} stroke="#ffffff" strokeWidth="2.5" className="drop-shadow-lg transition-transform group-hover:scale-125" />
              </g>

              {/* Handle 2 Control Circle */}
              <g
                className="cursor-pointer group"
                onPointerDown={(e) => handlePointerDown(2, e)}
              >
                <circle cx={p2.x} cy={p2.y} r="18" fill="transparent" />
                <circle cx={p2.x} cy={p2.y} r="8" fill={palette.secondary} stroke="#ffffff" strokeWidth="2.5" className="drop-shadow-lg transition-transform group-hover:scale-125" />
              </g>
            </svg>
          </div>

          {/* Bottom Coordinates & Label Bar */}
          <div className="h-7 shrink-0 bg-[#0B0D12] border-t border-white/[0.08] px-2.5 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2 font-mono text-[10px] shrink-0">
              <span className="text-[var(--app-accent-bright)]">P1: ({hX1.toFixed(2)}, {hY1.toFixed(2)})</span>
              <span className="text-[var(--app-accent-secondary)]">P2: ({hX2.toFixed(2)}, {hY2.toFixed(2)})</span>
            </div>
            <span className="font-bold text-slate-200 text-[10px] truncate max-w-[140px]">{easingLabel}</span>
          </div>
        </div>

        {/* Right Toolbar Column: Copy, Paste, Flip, Reset & Close Options */}
        <div className="w-12 bg-[#0B0C10] border-l border-white/[0.07] flex flex-col items-center justify-between py-1.5 px-1 z-10 gap-1 overflow-y-auto no-scrollbar shrink-0">
          {/* Close/Arrow Button */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#1B1E26] text-[var(--app-accent-secondary)] rounded-xl transition-colors active:scale-95 flex flex-col items-center"
            title={lang === 'ar' ? 'إغلاق والرجوع' : 'Close Graph'}
          >
            {lang === 'ar' ? <ArrowRight className="w-5 h-5 text-[var(--app-accent-secondary)]" /> : <ArrowLeft className="w-5 h-5 text-[var(--app-accent-secondary)]" />}
          </button>

          {/* Copy Curve Button (نسخ المنحنى) */}
          <button
            onClick={handleCopyCurve}
            className="p-1.5 bg-[#15171E] hover:bg-[#1E212B] text-[var(--app-accent-bright)] hover:text-[var(--app-accent-light)] border border-[rgba(var(--app-accent-bright-rgb),0.4)] hover:border-[var(--app-accent-bright)] rounded-xl transition-all active:scale-90 flex flex-col items-center gap-0.5 shadow-sm"
            title={lang === 'ar' ? 'نسخ هذا المنحنى (Copy Curve)' : 'Copy Curve'}
          >
            <Copy className="w-4 h-4" />
            <span className="text-[8px] font-bold">{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
          </button>

          {/* Paste Curve Button (لصق المنحنى) */}
          <button
            onClick={handlePasteCurve}
            style={clipboardCurve ? { boxShadow: '0 0 10px var(--app-accent-glow)' } : undefined}
            className={`p-1.5 rounded-xl transition-all active:scale-90 flex flex-col items-center gap-0.5 border ${
              clipboardCurve
                ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border-[var(--app-accent-bright)] animate-pulse'
                : 'bg-[#121319] text-slate-500 border-white/[0.08] opacity-50'
            }`}
            title={
              clipboardCurve
                ? (lang === 'ar' ? `لصق المنحنى المحفوظ (${clipboardCurve.name || 'Curve'})` : `Paste Copied Curve (${clipboardCurve.name || 'Curve'})`)
                : (lang === 'ar' ? 'انسخ منحنى أولاً للتمكن من لصقه' : 'Copy a curve first')
            }
          >
            <ClipboardPaste className="w-4 h-4" />
            <span className="text-[8px] font-bold">{lang === 'ar' ? 'لصق' : 'Paste'}</span>
          </button>

          {/* Apply to All Segments Button */}
          {onApplyToAllSegments && sortedKeyframes.length > 2 && (
            <button
              onClick={handleApplyAll}
              className="p-1 bg-[#15171E] hover:bg-[#1E212B] text-[var(--app-accent-secondary)] hover:text-[var(--app-accent-light)] border border-[rgba(var(--app-accent-secondary-rgb),0.3)] rounded-lg transition-all active:scale-90 flex flex-col items-center"
              title={lang === 'ar' ? 'تطبيق هذا المنحنى على كل الكي فريمات' : 'Apply to all keyframe segments'}
            >
              <CopyCheck className="w-3.5 h-3.5" />
              <span className="text-[7px] font-bold">{lang === 'ar' ? 'للجميع' : 'All'}</span>
            </button>
          )}

          {/* Reset to Default Button */}
          <button
            onClick={handleReset}
            className="p-1.5 hover:bg-[#1B1E26] text-slate-400 hover:text-[var(--app-accent-bright)] rounded-xl transition-colors active:scale-95"
            title={lang === 'ar' ? 'إعادة تعيين المنحنى' : 'Reset Curve'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Flip Handle Button */}
          <button
            onClick={handleFlip}
            className="p-1.5 hover:bg-[#1B1E26] text-slate-400 hover:text-slate-200 rounded-xl transition-colors active:scale-95"
            title={lang === 'ar' ? 'عكس المنحنى' : 'Flip Curve'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Pin Curve to Favorites Button */}
          <button
            type="button"
            onClick={() => {
              const refId = `curve-${hX1.toFixed(2)}-${hY1.toFixed(2)}-${hX2.toFixed(2)}-${hY2.toFixed(2)}`;
              toggleFavoriteItem(loadFavoritesState(), {
                type: 'easing',
                refId,
                title: `${easingLabel} (${hX1.toFixed(2)}, ${hY1.toFixed(2)})`,
                titleAr: `${easingLabel} (${hX1.toFixed(2)}, ${hY1.toFixed(2)})`,
                folderId: 'motion',
                payload: { bezierHandle: { x1: hX1, y1: hY1, x2: hX2, y2: hY2 }, easing: categoryTab === 'elastic' ? 'bounce' : categoryTab === 'stepped' ? 'stepped' : 'bezier' },
              });
              window.dispatchEvent(new CustomEvent('sqmotion:favoritesChanged'));
              showToast(lang === 'ar' ? 'تم تحديث المنحنى في المفضلة' : 'Updated Curve in Favorites');
            }}
            className="p-1.5 hover:bg-[#1B1E26] text-amber-400 hover:text-amber-300 rounded-xl transition-colors active:scale-95"
            title={lang === 'ar' ? 'تثبيت المنحنى في المفضلة' : 'Pin Curve to Favorites'}
          >
            <Star className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
