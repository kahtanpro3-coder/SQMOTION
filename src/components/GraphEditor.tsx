import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Language, Layer, Keyframe, BezierHandle, EasingType } from '../types';
import { evaluateEasing } from '../engine/interpolator';
import { Activity, Sliders, Check, Copy, ClipboardPaste, RotateCcw, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import {
  copyCurveToClipboard,
  getCopiedCurveFromClipboard,
  subscribeToCurveClipboard,
  StoredCurve,
} from '../engine/curveClipboard';
import { PrecisionRulerScrubber } from './PrecisionRulerScrubber';
import {
  MODAL_EASE,
  PILL_SPRING,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';
import { useAppTheme } from '../utils/appSettings';

interface GraphEditorProps {
  project: Project;
  lang: Language;
  onUpdateLayer: (layer: Layer) => void;
}

export const GraphEditor: React.FC<GraphEditorProps> = ({ project, lang, onUpdateLayer }) => {
  const { palette } = useAppTheme();
  const selectedLayer = project.layers.find(l => l.id === project.selectedLayerId);

  const [selectedProp, setSelectedProp] = useState<string>('position');
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  // Curve clipboard state
  const [clipboardCurve, setClipboardCurve] = useState<StoredCurve | null>(() => getCopiedCurveFromClipboard());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMsg(msg);
    toastTimeoutRef.current = window.setTimeout(() => setToastMsg(null), 2000);
  };

  useEffect(() => {
    return subscribeToCurveClipboard(() => {
      setClipboardCurve(getCopiedCurveFromClipboard());
    });
  }, []);

  // Easing bezier handles state
  const [handle, setHandle] = useState<{ x1: number; y1: number; x2: number; y2: number }>({
    x1: 0.25,
    y1: 0.1,
    x2: 0.25,
    y2: 1.0,
  });

  if (!selectedLayer) {
    return (
      <div className="p-6 text-center text-slate-500 text-xs">
        {lang === 'ar' ? 'حدد طبقة لعرض محرر المنحنيات' : 'Select a layer to open Graph Curve Editor'}
      </div>
    );
  }

  // Get current property
  let targetProp: any = selectedLayer.transform.position;
  if (selectedProp === 'scale') targetProp = selectedLayer.transform.scale;
  if (selectedProp === 'rotation') targetProp = selectedLayer.transform.rotation;
  if (selectedProp === 'opacity') targetProp = selectedLayer.transform.opacity;

  const keyframes: Keyframe<any>[] = (targetProp.keyframes || []).sort((a: any, b: any) => a.frame - b.frame);

  // Auto-select first keyframe if none is selected
  useEffect(() => {
    if (keyframes.length > 0 && !selectedKeyframeId) {
      handleSelectKeyframe(keyframes[0].id);
    }
  }, [keyframes, selectedKeyframeId]);

  // When keyframe selection changes, load its existing handle
  const handleSelectKeyframe = (kfId: string) => {
    setSelectedKeyframeId(kfId);
    const kf = keyframes.find(k => k.id === kfId);
    if (kf?.bezierHandle) {
      setHandle({ ...kf.bezierHandle });
    } else if (kf?.easing === 'ease-in') {
      setHandle({ x1: 0.42, y1: 0, x2: 1, y2: 1 });
    } else if (kf?.easing === 'ease-out') {
      setHandle({ x1: 0, y1: 0, x2: 0.58, y2: 1 });
    } else if (kf?.easing === 'ease-in-out') {
      setHandle({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 });
    } else if (kf?.easing === 'bounce') {
      setHandle({ x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 });
    } else if (kf?.easing === 'elastic') {
      setHandle({ x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275 });
    } else {
      setHandle({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 });
    }
  };

  const applyHandleToKeyframe = (newHandle: { x1: number; y1: number; x2: number; y2: number }, kfId?: string) => {
    const targetKfId = kfId || selectedKeyframeId;
    if (!targetKfId) return;

    setHandle(newHandle);
    const copyLayer: Layer = JSON.parse(JSON.stringify(selectedLayer));
    let propToUpdate: any = copyLayer.transform.position;
    if (selectedProp === 'scale') propToUpdate = copyLayer.transform.scale;
    if (selectedProp === 'rotation') propToUpdate = copyLayer.transform.rotation;
    if (selectedProp === 'opacity') propToUpdate = copyLayer.transform.opacity;

    const kf = propToUpdate.keyframes.find((k: any) => k.id === targetKfId);
    if (kf) {
      kf.easing = 'bezier';
      kf.bezierHandle = { ...newHandle };
      onUpdateLayer(copyLayer);
    }
  };

  const handleApplyBezier = () => {
    if (!selectedKeyframeId) return;
    applyHandleToKeyframe(handle);
    showToast(lang === 'ar' ? '✅ تم حفظ المنحنى لهذا الكي فريم!' : '✅ Curve Applied to Keyframe!');
  };

  const handleCopyCurve = () => {
    copyCurveToClipboard(handle, 'bezier');
    showToast(lang === 'ar' ? '📋 تم نسخ المنحنى إلى الحافظة!' : '📋 Curve Copied!');
  };

  const handlePasteCurve = (targetKfId?: string) => {
    const copied = getCopiedCurveFromClipboard();
    if (!copied) {
      showToast(lang === 'ar' ? '⚠️ لا يوجد منحنى منسوخ' : '⚠️ No copied curve');
      return;
    }
    const destId = targetKfId || selectedKeyframeId;
    setHandle({ ...copied.handle });
    if (destId) {
      const copyLayer: Layer = JSON.parse(JSON.stringify(selectedLayer));
      let propToUpdate: any = copyLayer.transform.position;
      if (selectedProp === 'scale') propToUpdate = copyLayer.transform.scale;
      if (selectedProp === 'rotation') propToUpdate = copyLayer.transform.rotation;
      if (selectedProp === 'opacity') propToUpdate = copyLayer.transform.opacity;

      const kf = propToUpdate.keyframes.find((k: any) => k.id === destId);
      if (kf) {
        kf.easing = copied.easing;
        kf.bezierHandle = { ...copied.handle };
        onUpdateLayer(copyLayer);
        showToast(lang === 'ar' ? '📥 تم لصق المنحنى بنجاح!' : '📥 Curve Pasted to Keyframe!');
      }
    }
  };

  // Generate SVG path for the cubic bezier curve
  const svgWidth = 260;
  const svgHeight = 160;
  const padding = 20;

  const startX = padding;
  const startY = svgHeight - padding;
  const endX = svgWidth - padding;
  const endY = padding;

  const cp1X = startX + handle.x1 * (endX - startX);
  const cp1Y = startY - handle.y1 * (startY - endY);

  const cp2X = startX + handle.x2 * (endX - startX);
  const cp2Y = startY - handle.y2 * (startY - endY);

  const curvePath = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

  return (
    <motion.div
      variants={staggerFastContainerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 bg-slate-900 text-slate-200 text-xs space-y-4 relative"
    >
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key="graph-toast-pill"
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: PILL_SPRING }}
            exit={{ opacity: 0, y: -8, scale: 0.92, transition: { duration: 0.14, ease: MODAL_EASE } }}
            className="absolute top-2 right-4 z-50 bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] font-extrabold text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={staggerItemVariants} className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-[var(--app-accent-bright)]" />
          {lang === 'ar' ? 'محرر منحنيات الحركة المستقلة' : 'Independent Curve Graph Editor'}
        </span>

        {/* Global Quick Copy & Paste Curve Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyCurve}
            className="px-2 py-1 bg-[#14161D] hover:bg-[#1D202A] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)] rounded-md font-bold flex items-center gap-1 transition-all active:scale-95 text-[10px]"
            title={lang === 'ar' ? 'نسخ المنحنى الحالي' : 'Copy Current Curve'}
          >
            <Copy className="w-3 h-3" />
            <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
          </button>
          <button
            onClick={handlePasteCurve}
            disabled={!clipboardCurve}
            style={clipboardCurve ? { boxShadow: '0 0 8px var(--app-accent-glow)' } : undefined}
            className={`px-2 py-1 rounded-md font-bold flex items-center gap-1 transition-all active:scale-95 text-[10px] border ${
              clipboardCurve
                ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] border-[var(--app-accent-bright)]'
                : 'bg-[#121318] text-slate-500 border-white/[0.07] opacity-50 cursor-not-allowed'
            }`}
            title={
              clipboardCurve
                ? (lang === 'ar' ? `لصق المنحنى (${clipboardCurve.name || 'Curve'})` : `Paste Curve`)
                : (lang === 'ar' ? 'انسخ منحنى أولاً' : 'No curve copied')
            }
          >
            <ClipboardPaste className="w-3 h-3" />
            <span>{lang === 'ar' ? 'لصق' : 'Paste'}</span>
          </button>
        </div>
      </motion.div>

      {/* Property Selector */}
      <motion.div variants={staggerItemVariants} className="flex items-center gap-2">
        <span className="text-slate-400 font-bold">{lang === 'ar' ? 'الخاصية:' : 'Property:'}</span>
        <select
          value={selectedProp}
          onChange={(e) => {
            setSelectedProp(e.target.value);
            setSelectedKeyframeId(null);
          }}
          className="bg-slate-950 border border-slate-800 text-slate-200 px-2 py-1 rounded font-bold"
        >
          <option value="position">Position (الموقع X/Y/Z)</option>
          <option value="scale">Scale (الحجم والتكبير)</option>
          <option value="rotation">Rotation (الدوران)</option>
          <option value="opacity">Opacity (الشفافية)</option>
        </select>
      </motion.div>

      {/* Keyframe Selector */}
      {keyframes.length === 0 ? (
        <p className="text-slate-500 italic text-[11px]">
          {lang === 'ar' ? 'لا توجد كي فريمز على هذه الخاصية بعد' : 'No keyframes recorded for this property yet'}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">{lang === 'ar' ? 'اختر الكي فريم:' : 'Keyframe:'}</span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {keyframes.map((k, idx) => {
                const isSelected = selectedKeyframeId === k.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => handleSelectKeyframe(k.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition-all ${
                      isSelected
                        ? 'bg-[var(--app-accent-bright)] text-[var(--app-accent-contrast)] border-[var(--app-accent-bright)] shadow-md scale-105'
                        : 'bg-[#12141A] hover:bg-[#1B1E26] text-slate-300 border-white/[0.08]'
                    }`}
                  >
                    KF {idx + 1} ({k.frame}f)
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Bezier Handle Controls */}
          {selectedKeyframeId ? (
            <div className="space-y-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] font-medium text-slate-400 block">
                {lang === 'ar' ? 'منحنى البيزيه المخصص المنفصل (Independent Cubic-Bezier)' : 'Independent Cubic-Bezier Curve'}
              </span>

              {/* Quick Alight Curve Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold block">{lang === 'ar' ? 'منحنيات جاهزة (Presets):' : 'Alight Presets:'}</span>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <button
                    onClick={() => applyHandleToKeyframe({ x1: 0.42, y1: 0, x2: 1, y2: 1 })}
                    className="p-1.5 bg-[#161820] hover:bg-[#1F222C] border border-white/[0.08] hover:border-[var(--app-accent-bright)] rounded text-[var(--app-accent-bright)] font-bold text-center"
                  >
                    Ease In ⚡
                  </button>
                  <button
                    onClick={() => applyHandleToKeyframe({ x1: 0, y1: 0, x2: 0.58, y2: 1 })}
                    className="p-1.5 bg-[#161820] hover:bg-[#1F222C] border border-white/[0.08] hover:border-[var(--app-accent-bright)] rounded text-[var(--app-accent-bright)] font-bold text-center"
                  >
                    Ease Out 🎯
                  </button>
                  <button
                    onClick={() => applyHandleToKeyframe({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 })}
                    className="p-1.5 bg-[#161820] hover:bg-[#1F222C] border border-white/[0.08] hover:border-[var(--app-accent-bright)] rounded text-[var(--app-accent-bright)] font-bold text-center"
                  >
                    Smooth S 🌊
                  </button>
                  <button
                    onClick={() => applyHandleToKeyframe({ x1: 0.68, y1: -0.55, x2: 0.265, y2: 1.55 })}
                    className="p-1.5 bg-[#161820] hover:bg-[#1F222C] border border-white/[0.08] hover:border-[var(--app-accent-bright)] rounded text-[var(--app-accent-bright)] font-bold text-center"
                  >
                    Bounce 🏀
                  </button>
                  <button
                    onClick={() => applyHandleToKeyframe({ x1: 0.175, y1: 0.885, x2: 0.32, y2: 1.275 })}
                    className="p-1.5 bg-[#161820] hover:bg-[#1F222C] border border-white/[0.08] hover:border-[var(--app-accent-bright)] rounded text-[var(--app-accent-bright)] font-bold text-center"
                  >
                    Elastic 🪀
                  </button>
                  <button
                    onClick={() => applyHandleToKeyframe({ x1: 0.95, y1: 0.05, x2: 0.795, y2: 0.035 })}
                    className="p-1.5 bg-[#161820] hover:bg-[#1F222C] border border-white/[0.08] hover:border-[var(--app-accent-bright)] rounded text-[var(--app-accent-bright)] font-bold text-center"
                  >
                    Expo 🚀
                  </button>
                </div>
              </div>

              {/* SVG Canvas Preview */}
              <div className="bg-[#0D0F14] border border-white/[0.08] rounded-xl p-2 flex justify-center shadow-inner">
                <svg width={svgWidth} height={svgHeight} className="overflow-visible">
                  {/* Grid Lines */}
                  <line x1={startX} y1={startY} x2={endX} y2={startY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  <line x1={startX} y1={startY} x2={startX} y2={endY} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

                  {/* Handle Control Lines */}
                  <line x1={startX} y1={startY} x2={cp1X} y2={cp1Y} stroke={palette.bright} strokeWidth="1.5" strokeDasharray="3 3" />
                  <line x1={endX} y1={endY} x2={cp2X} y2={cp2Y} stroke={palette.secondary} strokeWidth="1.5" strokeDasharray="3 3" />

                  {/* Curve Path */}
                  <path d={curvePath} fill="none" stroke={palette.bright} strokeWidth="3.5" />

                  {/* Control Nodes */}
                  <circle cx={cp1X} cy={cp1Y} r="6" fill={palette.bright} style={{ filter: `drop-shadow(0 0 6px ${palette.bright})` }} />
                  <circle cx={cp2X} cy={cp2Y} r="6" fill={palette.secondary} style={{ filter: `drop-shadow(0 0 6px ${palette.secondary})` }} />
                </svg>
              </div>

              {/* Precision Ruler Scrubbers for Handles */}
              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-mono text-[10px]">P1 X: {handle.x1.toFixed(2)}</label>
                  <PrecisionRulerScrubber
                    value={handle.x1}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    defaultValue={0.25}
                    ariaLabel="P1 X"
                    onChange={(val) => setHandle({ ...handle, x1: val })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-mono text-[10px]">P1 Y: {handle.y1.toFixed(2)}</label>
                  <PrecisionRulerScrubber
                    value={handle.y1}
                    min={-0.5}
                    max={1.5}
                    step={0.01}
                    decimals={2}
                    defaultValue={0.1}
                    ariaLabel="P1 Y"
                    onChange={(val) => setHandle({ ...handle, y1: val })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-mono text-[10px]">P2 X: {handle.x2.toFixed(2)}</label>
                  <PrecisionRulerScrubber
                    value={handle.x2}
                    min={0}
                    max={1}
                    step={0.01}
                    decimals={2}
                    defaultValue={0.25}
                    ariaLabel="P2 X"
                    onChange={(val) => setHandle({ ...handle, x2: val })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block font-mono text-[10px]">P2 Y: {handle.y2.toFixed(2)}</label>
                  <PrecisionRulerScrubber
                    value={handle.y2}
                    min={-0.5}
                    max={1.5}
                    step={0.01}
                    decimals={2}
                    defaultValue={1.0}
                    ariaLabel="P2 Y"
                    onChange={(val) => setHandle({ ...handle, y2: val })}
                  />
                </div>
              </div>

              <button
                onClick={handleApplyBezier}
                style={{ boxShadow: '0 0 12px var(--app-accent-glow)' }}
                className="w-full py-2 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-extrabold rounded-lg text-xs flex items-center justify-center gap-1 transition-all active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{lang === 'ar' ? 'تطبيق هذا المنحنى على الكي فريم المحدد' : 'Apply Curve to Selected Keyframe'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-center text-slate-500">
              {lang === 'ar' ? 'انقر على أحد الكي فريمات بالأعلى لتعديل منحناه المستقل أو لصق منحنى فيه' : 'Click a keyframe above to edit its curve or paste a copied curve'}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
