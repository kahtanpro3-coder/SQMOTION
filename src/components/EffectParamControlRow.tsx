import React, { useState, useEffect, useRef } from 'react';
import { Diamond, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Language } from '../types';
import { EffectControlSettings, getPrecisionMultipliers } from '../utils/effectControlSettings';
import { getEffectParamMeta } from '../utils/effectParamsMeta';
import { PrecisionRulerScrubber } from './PrecisionRulerScrubber';

export interface EffectParamControlRowProps {
  effectId: string;
  paramKey: string;
  paramVal: unknown;
  origDefault?: unknown;
  effectType: string;
  layerId: string;
  lang: Language;
  settings: EffectControlSettings;
  onUpdateParam: (effectId: string, paramKey: string, value: unknown) => void;
  onAddKeyframe?: (layerId: string, propertyPath: string) => void;
  isMasterMix?: boolean;
}

export const EffectParamControlRow: React.FC<EffectParamControlRowProps> = ({
  effectId,
  paramKey,
  paramVal,
  origDefault,
  effectType,
  layerId,
  lang,
  settings,
  onUpdateParam,
  onAddKeyframe,
  isMasterMix = false,
}) => {
  const isAr = lang === 'ar';
  const [isEditingNumeric, setIsEditingNumeric] = useState(false);
  const [draftNumeric, setDraftNumeric] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isColor =
    paramKey.toLowerCase().includes('color') ||
    (typeof paramVal === 'string' && paramVal.startsWith('#'));

  const meta = getEffectParamMeta(paramKey, paramVal, effectType, {
    extendedRange: settings.unboundedRange,
    precisionMode: settings.precisionMode,
  });

  const mult = getPrecisionMultipliers(settings.precisionMode);
  const hasOptions = Boolean(meta.options && meta.options.length > 0);
  const isBoolean = Boolean(meta.isBoolean);
  const isNumber = typeof paramVal === 'number' && !hasOptions && !isBoolean;
  const labelText = isAr ? meta.labelAr : meta.labelEn;
  const defaultNumber = typeof origDefault === 'number' ? origDefault : undefined;

  const activeOpt = hasOptions
    ? meta.options!.find((o) => String(o.value) === String(paramVal))
    : undefined;
  const boolEnabled = typeof paramVal === 'boolean' ? paramVal : Number(paramVal) >= 0.5;

  const currentNumeric = isNumber ? Number(paramVal) : 0;
  const displayPrecision = isNumber
    ? Math.max(meta.decimals, settings.precisionMode === 'micro' ? Math.min(3, meta.decimals + 1) : meta.decimals)
    : 0;

  const formatNumber = (n: number) => {
    const fixed = Number(n.toFixed(meta.isInteger ? 0 : Math.max(meta.decimals, 3)));
    return meta.isInteger ? String(Math.round(fixed)) : fixed.toFixed(displayPrecision).replace(/\.?0+$/, (m) => (meta.decimals === 0 ? '' : m.length > 1 ? '' : m));
  };

  const formattedNumberText = isNumber
    ? `${Number(currentNumeric).toFixed(meta.decimals)}${meta.unit}`
    : '';

  const displayBadge = hasOptions
    ? activeOpt
      ? isAr
        ? activeOpt.labelAr
        : activeOpt.labelEn
      : String(paramVal)
    : isBoolean
    ? boolEnabled
      ? isAr
        ? 'مفعل'
        : 'On'
      : isAr
      ? 'معطل'
      : 'Off'
    : isNumber
    ? formattedNumberText
    : String(paramVal);

  const isModified = origDefault !== undefined && String(paramVal) !== String(origDefault);

  useEffect(() => {
    if (isEditingNumeric && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingNumeric]);

  const quantizeAndClamp = (raw: number): number => {
    const clamped = Math.min(meta.max, Math.max(meta.min, raw));
    if (meta.isInteger) return Math.round(clamped);
    return Number(clamped.toFixed(4));
  };

  const commitDraftNumeric = () => {
    const parsed = parseFloat(draftNumeric);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      onUpdateParam(effectId, paramKey, quantizeAndClamp(parsed));
    }
    setIsEditingNumeric(false);
  };

  const stepNumeric = (dir: -1 | 1) => {
    const next = currentNumeric + dir * meta.step;
    const factor = 1 / Math.max(0.0001, meta.step);
    const snapped = Math.round((next - meta.min) * factor) / factor + meta.min;
    onUpdateParam(effectId, paramKey, quantizeAndClamp(snapped));
  };

  const formatBound = (val: number) => {
    if (meta.isInteger) return `${Math.round(val)}${meta.unit}`;
    const str = Math.abs(val) < 1 && val !== 0 ? Number(val.toFixed(3)).toString() : Number(val.toFixed(2)).toString();
    return `${str}${meta.unit}`;
  };

  return (
    <div
      className={`space-y-1.5 p-2.5 rounded-[8px] border max-w-full ${
        isMasterMix
          ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.3)]'
          : 'bg-[#222326] border-white/[0.05]'
      }`}
    >
      {/* Top Row: Label + Value/Direct Input + Reset + Keyframe */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-medium min-w-0 flex-1 truncate flex items-center gap-1.5 ${
            isMasterMix ? 'text-[var(--app-accent-bright)] font-semibold' : 'text-slate-200'
          }`}
          title={labelText}
        >
          {isMasterMix && <Sparkles className="w-3 h-3 text-[var(--app-accent-bright)] shrink-0" />}
          <span className="truncate">{labelText}</span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {isModified && (
            <button
              type="button"
              onClick={() => onUpdateParam(effectId, paramKey, origDefault)}
              className="p-1 text-slate-400 hover:text-amber-300 hover:bg-white/[0.06] rounded-[5px] transition-colors cursor-pointer"
              title={isAr ? 'استعادة القيمة الافتراضية' : 'Reset to default'}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          {isNumber && isEditingNumeric ? (
            <input
              ref={inputRef}
              type="number"
              step="any"
              dir="ltr"
              value={draftNumeric}
              onChange={(e) => setDraftNumeric(e.target.value)}
              onBlur={commitDraftNumeric}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitDraftNumeric();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsEditingNumeric(false);
                }
              }}
              className="w-20 font-mono text-[11px] text-[var(--app-accent-bright)] font-semibold tabular-nums bg-[#121316] px-1.5 py-0.5 rounded-[5px] border border-[rgba(var(--app-accent-bright-rgb),0.6)] text-center focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isNumber) {
                  setDraftNumeric(formatNumber(currentNumeric));
                  setIsEditingNumeric(true);
                } else if (origDefault !== undefined) {
                  onUpdateParam(effectId, paramKey, origDefault);
                }
              }}
              title={
                isNumber
                  ? isAr
                    ? 'انقر لكتابة رقم دقيق مباشرة'
                    : 'Click to type exact number'
                  : origDefault !== undefined
                  ? isAr
                    ? 'نقر لاستعادة القيمة الافتراضية'
                    : 'Click to reset'
                  : undefined
              }
              className="font-mono text-[11px] text-slate-100 font-semibold tabular-nums bg-[#191A1D] hover:bg-[#272A30] px-2 py-0.5 rounded-[5px] border border-white/[0.06] min-w-[46px] text-center cursor-pointer transition-colors"
            >
              {displayBadge}
            </button>
          )}

          {onAddKeyframe && (
            <button
              type="button"
              onClick={() => onAddKeyframe(layerId, `effect.${effectId}.${paramKey}`)}
              className="p-1 text-slate-400 hover:text-[var(--app-accent-bright)] hover:bg-[rgba(var(--app-accent-bright-rgb),0.1)] rounded-[6px] transition-colors cursor-pointer"
              title={isAr ? 'إضافة كي فريم لهذه الخاصية' : 'Add Keyframe for this parameter'}
            >
              <Diamond className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Control Input Area */}
      {isColor ? (
        <div className="flex items-center gap-2 pt-0.5">
          <input
            type="color"
            value={String(paramVal)}
            onChange={(e) => onUpdateParam(effectId, paramKey, e.target.value)}
            className="h-7 w-12 rounded-[6px] bg-[#191A1D] border border-white/[0.08] cursor-pointer p-0.5 shrink-0"
          />
          <span className="font-mono text-[11px] text-slate-400 uppercase">
            {String(paramVal)}
          </span>
        </div>
      ) : hasOptions ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {meta.options!.map((opt) => {
            const selected = String(opt.value) === String(paramVal);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onUpdateParam(effectId, paramKey, opt.value)}
                className={`px-2.5 py-1 rounded-[6px] border text-[11px] transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-semibold'
                    : 'bg-[#191A1D] border-white/[0.07] text-slate-300 hover:text-white hover:bg-[#2A2C32]'
                }`}
              >
                {isAr ? opt.labelAr : opt.labelEn}
              </button>
            );
          })}
        </div>
      ) : isBoolean ? (
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() =>
              onUpdateParam(effectId, paramKey, typeof origDefault === 'boolean' ? true : 1)
            }
            className={`py-1 px-2.5 rounded-[6px] border text-[11px] transition-colors cursor-pointer ${
              boolEnabled
                ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-semibold'
                : 'bg-[#191A1D] border-white/[0.07] text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? 'مفعل' : 'On'}
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdateParam(effectId, paramKey, typeof origDefault === 'boolean' ? false : 0)
            }
            className={`py-1 px-2.5 rounded-[6px] border text-[11px] transition-colors cursor-pointer ${
              !boolEnabled
                ? 'bg-[#2C2023] border-rose-500/40 text-rose-300 font-semibold'
                : 'bg-[#191A1D] border-white/[0.07] text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? 'معطل' : 'Off'}
          </button>
        </div>
      ) : isNumber ? (
        <div className="space-y-1">
          <div dir="ltr" className="flex items-center gap-1.5">
            {settings.showStepButtons && (
              <button
                type="button"
                onClick={() => stepNumeric(-1)}
                className="w-7 h-[38px] rounded-[7px] bg-[#191A1D] hover:bg-[#26282E] border border-white/[0.06] text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer active:scale-95"
                title={isAr ? `إنقاص بمقدار ${meta.step}` : `Decrease by ${meta.step}`}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex-1 min-w-0">
              <PrecisionRulerScrubber
                value={currentNumeric}
                min={meta.min}
                max={meta.max}
                step={meta.step}
                decimals={meta.decimals}
                unit={meta.unit}
                defaultValue={defaultNumber}
                sensitivityScale={mult.sensitivityScale}
                ariaLabel={labelText}
                onChange={(val) => onUpdateParam(effectId, paramKey, val)}
              />
            </div>

            {settings.showStepButtons && (
              <button
                type="button"
                onClick={() => stepNumeric(1)}
                className="w-7 h-[38px] rounded-[7px] bg-[#191A1D] hover:bg-[#26282E] border border-white/[0.06] text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer active:scale-95"
                title={isAr ? `زيادة بمقدار ${meta.step}` : `Increase by ${meta.step}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clickable Min / Max quick-jump micro bounds */}
          <div dir="ltr" className="flex items-center justify-between px-0.5 text-[9.5px] font-mono text-slate-500">
            <button
              type="button"
              onClick={() => onUpdateParam(effectId, paramKey, meta.min)}
              className="hover:text-[var(--app-accent-bright)] transition-colors cursor-pointer"
              title={isAr ? 'ضبط على أصغر نقطة' : 'Set to minimum'}
            >
              {formatBound(meta.min)}
            </button>
            <span className="text-[9px] text-slate-600">
              Δ {meta.step}
            </span>
            <button
              type="button"
              onClick={() => onUpdateParam(effectId, paramKey, meta.max)}
              className="hover:text-[var(--app-accent-bright)] transition-colors cursor-pointer"
              title={isAr ? 'ضبط على أكبر نقطة' : 'Set to maximum'}
            >
              {formatBound(meta.max)}
            </button>
          </div>
        </div>
      ) : (
        <input
          type="text"
          value={String(paramVal)}
          onChange={(e) => onUpdateParam(effectId, paramKey, e.target.value)}
          className="w-full bg-[#191A1D] border border-white/[0.08] rounded-[6px] px-2 py-1 text-white font-mono text-xs"
        />
      )}
    </div>
  );
};
