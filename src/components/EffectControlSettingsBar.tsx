import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SlidersHorizontal, ChevronDown, ChevronUp, Maximize2, Crosshair } from 'lucide-react';
import { Language } from '../types';
import { EffectPrecisionMode, useEffectControlSettings } from '../utils/effectControlSettings';
import { MODAL_EASE } from './MotionPrimitives';

interface EffectControlSettingsBarProps {
  lang: Language;
  className?: string;
}

const PRECISION_MODES: Array<{
  id: EffectPrecisionMode;
  labelAr: string;
  labelEn: string;
  badge: string;
}> = [
  { id: 'micro', labelAr: 'أدق نقطة', labelEn: 'Micro', badge: '0.01x' },
  { id: 'fine', labelAr: 'ناعم', labelEn: 'Fine', badge: '0.1x' },
  { id: 'normal', labelAr: 'عادي', labelEn: 'Normal', badge: '1x' },
  { id: 'macro', labelAr: 'سريع', labelEn: 'Macro', badge: '3x' },
];

export const EffectControlSettingsBar: React.FC<EffectControlSettingsBarProps> = ({
  lang,
  className = '',
}) => {
  const [settings, updateSettings] = useEffectControlSettings();
  const [isOpen, setIsOpen] = useState(false);
  const isAr = lang === 'ar';

  const activeModeObj =
    PRECISION_MODES.find((m) => m.id === settings.precisionMode) || PRECISION_MODES[1];

  return (
    <div
      className={`bg-[#1B1C20] border border-white/[0.07] rounded-[10px] overflow-hidden ${className}`}
    >
      {/* Compact Header Summary */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-2.5 py-2 flex items-center justify-between gap-2 hover:bg-[#222328] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-[6px] bg-[#25272D] flex items-center justify-center text-[var(--app-accent-bright)] shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] font-semibold text-slate-100 truncate">
            {isAr ? 'إعدادات دقة ونطاق التأثيرات' : 'Effect Control & Range Settings'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded bg-[#141517] border border-white/[0.06] text-[10px] font-mono text-[var(--app-accent-bright)]">
            {isAr ? activeModeObj.labelAr : activeModeObj.labelEn} · {activeModeObj.badge}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
              settings.unboundedRange
                ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.4)] text-[var(--app-accent-bright)]'
                : 'bg-[#141517] border-white/[0.06] text-slate-400'
            }`}
          >
            {settings.unboundedRange
              ? isAr
                ? 'النطاق الكامل'
                : 'Full Range'
              : isAr
              ? 'قياسي'
              : 'Standard'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expandable Settings Body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.12, ease: MODAL_EASE }}
            className="overflow-hidden"
          >
            <div className="p-2.5 bg-[#151619] border-t border-white/[0.06] space-y-2.5 text-[11px]">
          {/* Precision Mode Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <Crosshair className="w-3 h-3 text-[var(--app-accent-bright)]" />
                {isAr ? 'حساسية ودقة السحب' : 'Scrubbing Precision'}
              </span>
              <span className="text-[9.5px] text-slate-500">
                {isAr ? 'انقر أي رقم للكتابة المباشرة' : 'Tap any number to type exact'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {PRECISION_MODES.map((mode) => {
                const selected = settings.precisionMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => updateSettings({ precisionMode: mode.id })}
                    className={`py-1.5 px-1 rounded-[7px] border flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      selected
                        ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.6)] text-[var(--app-accent-bright)] font-semibold'
                        : 'bg-[#1E1F24] border-white/[0.06] text-slate-300 hover:bg-[#25272D] hover:text-white'
                    }`}
                  >
                    <span className="text-[10.5px] leading-tight">
                      {isAr ? mode.labelAr : mode.labelEn}
                    </span>
                    <span className="text-[9px] font-mono opacity-80">{mode.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Range & Stepper Toggles */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateSettings({ unboundedRange: !settings.unboundedRange })}
              className={`px-2.5 py-1.5 rounded-[7px] border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                settings.unboundedRange
                  ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-semibold'
                  : 'bg-[#1E1F24] border-white/[0.06] text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate text-[10.5px]">
                <Maximize2 className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {isAr ? 'نطاق كامل (أصغر ← أكبر)' : 'Full Min–Max Range'}
                </span>
              </span>
              <span className="font-mono text-[9.5px] shrink-0">
                {settings.unboundedRange ? (isAr ? 'مفعل' : 'ON') : isAr ? 'معطل' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ showStepButtons: !settings.showStepButtons })}
              className={`px-2.5 py-1.5 rounded-[7px] border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                settings.showStepButtons
                  ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-semibold'
                  : 'bg-[#1E1F24] border-white/[0.06] text-slate-400 hover:text-white'
              }`}
            >
              <span className="truncate text-[10.5px]">
                {isAr ? 'أزرار خطوة (- / +)' : 'Step Buttons (- / +)'}
              </span>
              <span className="font-mono text-[9.5px] shrink-0">
                {settings.showStepButtons ? (isAr ? 'مفعل' : 'ON') : isAr ? 'معطل' : 'OFF'}
              </span>
            </button>
          </div>
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
