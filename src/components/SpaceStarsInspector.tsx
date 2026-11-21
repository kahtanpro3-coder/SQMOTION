import React from 'react';
import { ArrowUpRight, RotateCcw, Sparkles, Star } from 'lucide-react';
import { Language, Layer, ShaderEffect } from '../types';
import { ALIGHT_EFFECTS_FULL_CATALOG } from '../data/alightEffectsCatalog';
import { getEffectParamMeta } from '../utils/effectParamsMeta';
import { PrecisionRulerScrubber } from './PrecisionRulerScrubber';

interface SpaceStarsInspectorProps {
  layer: Layer;
  effect: ShaderEffect;
  lang: Language;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onAddKeyframe?: (layerId: string, propertyPath: string) => void;
}

const STAR_SHAPES: Array<{ value: string; labelAr: string; labelEn: string }> = [
  { value: 'mixed', labelAr: 'مختلط', labelEn: 'Mixed' },
  { value: 'star4', labelAr: 'نجمة رباعية ✦', labelEn: '4-Point Star' },
  { value: 'star5', labelAr: 'نجمة خماسية ★', labelEn: '5-Point Star' },
  { value: 'sparkle', labelAr: 'وميض نجمي ✨', labelEn: 'Sparkle' },
  { value: 'diamond', labelAr: 'معين ◆', labelEn: 'Diamond' },
  { value: 'hexagon', labelAr: 'سداسي ⬡', labelEn: 'Hexagon' },
  { value: 'crescent', labelAr: 'هلال ☽', labelEn: 'Crescent' },
  { value: 'circle', labelAr: 'دائرة ●', labelEn: 'Circle' },
];

const LINE_STYLES: Array<{ value: string; labelAr: string; labelEn: string }> = [
  { value: 'mixed', labelAr: 'مختلط', labelEn: 'Mixed' },
  { value: 'depth', labelAr: 'أشعة عمق Z', labelEn: 'Depth Rays Z' },
  { value: 'radial', labelAr: 'إشعاعي من المركز', labelEn: 'Radial' },
  { value: 'random3d', labelAr: 'عشوائي 3D', labelEn: '3D Scatter' },
  { value: 'parallel', labelAr: 'متوازي', labelEn: 'Parallel' },
  { value: 'cross', labelAr: 'متقاطع +', labelEn: 'Cross Grid' },
];

const LINE_CAP_STYLES: Array<{ value: string; labelAr: string; labelEn: string }> = [
  { value: 'glow', labelAr: 'لامع مدبب', labelEn: 'Glowing Laser' },
  { value: 'solid', labelAr: 'متصل ناعم', labelEn: 'Solid Smooth' },
  { value: 'dashed', labelAr: 'متقطع', labelEn: 'Dashed' },
];

const QUICK_STAR_COUNTS = [30, 100, 280, 600, 1000, 1500];
const QUICK_LINE_COUNTS = [25, 80, 220, 500, 900, 1500];

const STAR_NUMERIC_GROUPS: Array<{
  titleAr: string;
  titleEn: string;
  keys: string[];
}> = [
  {
    titleAr: 'الحجم والسطوع',
    titleEn: 'Size & Luminance',
    keys: ['starSize', 'sizeVariation', 'brightness', 'glow', 'twinkle'],
  },
  {
    titleAr: 'الدوران والحركة ثلاثية الأبعاد',
    titleEn: 'Rotation & 3D Motion',
    keys: [
      'starRotation',
      'spinSpeed',
      'reactivity',
      'speed',
      'trailLength',
      'spread',
      'floatSpeed',
      'floatAmount',
    ],
  },
];

const LINE_NUMERIC_GROUPS: Array<{
  titleAr: string;
  titleEn: string;
  keys: string[];
}> = [
  {
    titleAr: 'الأبعاد والسطوع',
    titleEn: 'Length, Width & Luminance',
    keys: ['lineLength', 'lineThickness', 'lengthVariation', 'brightness', 'glow', 'twinkle'],
  },
  {
    titleAr: 'الدوران والحركة ثلاثية الأبعاد',
    titleEn: 'Rotation & 3D Motion',
    keys: [
      'lineRotation',
      'spinSpeed',
      'reactivity',
      'speed',
      'spread',
      'floatSpeed',
      'floatAmount',
    ],
  },
];

const COSMIC_SWATCHES = [
  '#FFFFFF',
  '#E0F2FE',
  '#38BDF8',
  '#A855F7',
  '#FDE68A',
  '#F59E0B',
  '#FB7185',
  '#5EEB9A',
];

export const SpaceStarsInspector: React.FC<SpaceStarsInspectorProps> = ({
  layer,
  effect,
  lang,
  onUpdateLayer,
  onAddKeyframe,
}) => {
  const isAr = lang === 'ar';
  const isSpaceLines = effect.type === 'spaceLines';
  const effDef = ALIGHT_EFFECTS_FULL_CATALOG.find(
    (x) => x.id === (isSpaceLines ? 'spaceLines' : 'motionStars')
  );
  const defaults = effDef?.defaultParams || {};

  const getParam = <T extends number | string>(key: string, fallback: T): T => {
    const val = effect.params?.[key];
    if (val === undefined || val === null) {
      return (defaults[key] !== undefined ? defaults[key] : fallback) as T;
    }
    return val as T;
  };

  const updateParams = (patch: Record<string, number | string>) => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    const target = copy.effects?.find((e) => e.id === effect.id);
    if (!target) return;
    target.params = { ...defaults, ...target.params, ...patch };
    onUpdateLayer(copy);
  };

  const resetAll = () => {
    const copy: Layer = JSON.parse(JSON.stringify(layer));
    const target = copy.effects?.find((e) => e.id === effect.id);
    if (!target) return;
    target.params = { ...defaults, mix: 100 };
    onUpdateLayer(copy);
  };

  const defaultCount = isSpaceLines ? 220 : 280;
  const currentCount = Math.round(Number(getParam('count', defaultCount)));
  const currentShape = String(getParam('starShape', 'mixed'));
  const currentLineStyle = String(getParam('lineStyle', 'mixed'));
  const currentLineCapStyle = String(getParam('lineCapStyle', 'glow'));
  const primaryColor = String(getParam('color', isSpaceLines ? '#38BDF8' : '#FFFFFF'));
  const secondaryColor = String(getParam('secondaryColor', isSpaceLines ? '#FFFFFF' : '#F1F5F9'));
  const quickCounts = isSpaceLines ? QUICK_LINE_COUNTS : QUICK_STAR_COUNTS;
  const numericGroups = isSpaceLines ? LINE_NUMERIC_GROUPS : STAR_NUMERIC_GROUPS;

  return (
    <div className="space-y-3">
      {/* Header & Reset */}
      <div className="flex items-center justify-between bg-[#1F2024] px-3 py-2 rounded-[10px] border border-white/[0.06]">
        <div className="flex items-center gap-2">
          {isSpaceLines ? (
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          ) : (
            <Star className="w-4 h-4 text-cyan-400" />
          )}
          <span className="text-xs font-bold text-white">
            {isSpaceLines
              ? isAr
                ? 'تحكم الخطوط الفضائية الكامل'
                : 'Space Lines Full Controls'
              : isAr
              ? 'تحكم النجوم الفضائية الكامل'
              : 'Space Stars Full Controls'}
          </span>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="px-2 py-1 rounded-[6px] bg-[#26282E] hover:bg-[#30333B] text-[10.5px] font-medium text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{isAr ? 'الافتراضي' : 'Reset'}</span>
        </button>
      </div>

      {/* Quantity (Count) Hero Control */}
      <div
        className={`bg-[#1F2024] p-3 rounded-[10px] border space-y-2 ${
          isSpaceLines ? 'border-purple-400/25' : 'border-cyan-400/20'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className={`w-3.5 h-3.5 ${isSpaceLines ? 'text-purple-400' : 'text-cyan-400'}`} />
            <span>
              {isSpaceLines
                ? isAr
                  ? 'كمية الخطوط'
                  : 'Line Quantity'
                : isAr
                ? 'كمية النجوم'
                : 'Star Quantity'}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`font-mono text-xs font-bold bg-[#141517] px-2 py-0.5 rounded-[5px] border border-white/10 tabular-nums ${
                isSpaceLines ? 'text-purple-300' : 'text-cyan-300'
              }`}
            >
              {currentCount}
            </span>
            {onAddKeyframe && (
              <button
                type="button"
                onClick={() => onAddKeyframe(layer.id, `effect.${effect.id}.count`)}
                className="px-1.5 py-0.5 text-[10px] rounded bg-[#26282E] hover:text-[var(--app-accent-bright)] text-slate-300 cursor-pointer"
                title={isAr ? 'إضافة كي فريم' : 'Add Keyframe'}
              >
                ◆
              </button>
            )}
          </div>
        </div>

        <PrecisionRulerScrubber
          value={currentCount}
          min={5}
          max={2000}
          step={5}
          decimals={0}
          defaultValue={defaultCount}
          ariaLabel={isSpaceLines ? (isAr ? 'كمية الخطوط' : 'Line Quantity') : isAr ? 'كمية النجوم' : 'Star Quantity'}
          onChange={(val) => updateParams({ count: Math.round(val) })}
        />

        <div className="flex flex-wrap gap-1 pt-0.5">
          {quickCounts.map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => updateParams({ count: qty })}
              className={`px-2 py-1 rounded-[6px] border font-mono text-[10.5px] transition-colors cursor-pointer ${
                currentCount === qty
                  ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.6)] text-[var(--app-accent-bright)] font-bold'
                  : 'bg-[#141517] border-white/[0.07] text-slate-300 hover:text-white'
              }`}
            >
              {qty}
            </button>
          ))}
        </div>
      </div>

      {/* Shape / Orientation Selector */}
      {isSpaceLines ? (
        <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-3">
          <div className="space-y-2">
            <span className="text-xs font-bold text-white block">
              {isAr ? 'شكل واتجاه الخطوط 3D' : 'Line Pattern & 3D Direction'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {LINE_STYLES.map((opt) => {
                const active = currentLineStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateParams({ lineStyle: opt.value })}
                    className={`px-2.5 py-1.5 rounded-[7px] border text-[11px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-bold'
                        : 'bg-[#141517] border-white/[0.07] text-slate-300 hover:text-white hover:bg-[#26282E]'
                    }`}
                  >
                    {isAr ? opt.labelAr : opt.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/[0.06] pt-2.5">
            <span className="text-xs font-bold text-white block">
              {isAr ? 'أسلوب رسم الخط' : 'Line Rendering Style'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {LINE_CAP_STYLES.map((opt) => {
                const active = currentLineCapStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateParams({ lineCapStyle: opt.value })}
                    className={`px-2.5 py-1.5 rounded-[7px] border text-[11px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-bold'
                        : 'bg-[#141517] border-white/[0.07] text-slate-300 hover:text-white hover:bg-[#26282E]'
                    }`}
                  >
                    {isAr ? opt.labelAr : opt.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2">
          <span className="text-xs font-bold text-white block">
            {isAr ? 'شكل النجوم' : 'Star Shape'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {STAR_SHAPES.map((opt) => {
              const active = currentShape === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateParams({ starShape: opt.value })}
                  className={`px-2.5 py-1.5 rounded-[7px] border text-[11px] transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-bold'
                      : 'bg-[#141517] border-white/[0.07] text-slate-300 hover:text-white hover:bg-[#26282E]'
                  }`}
                >
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Numeric Control Groups */}
      {numericGroups.map((group) => (
        <div
          key={group.titleEn}
          className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2.5"
        >
          <div className="text-[11px] font-bold text-slate-300 border-b border-white/[0.06] pb-1.5">
            {isAr ? group.titleAr : group.titleEn}
          </div>
          {group.keys.map((key) => {
            const numVal = Number(getParam(key, Number(defaults[key] ?? 0)));
            const meta = getEffectParamMeta(key, numVal, effect.type);
            const defNum = Number(defaults[key] ?? 0);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200 text-[11px] font-medium">
                    {isAr ? meta.labelAr : meta.labelEn}
                  </span>
                  <span className="font-mono text-[11px] text-slate-100 tabular-nums">
                    {numVal.toFixed(meta.decimals)}
                    {meta.unit}
                  </span>
                </div>
                <PrecisionRulerScrubber
                  value={numVal}
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  decimals={meta.decimals}
                  unit={meta.unit}
                  defaultValue={defNum}
                  ariaLabel={isAr ? meta.labelAr : meta.labelEn}
                  onChange={(val) => updateParams({ [key]: val })}
                />
              </div>
            );
          })}
        </div>
      ))}

      {/* Colors */}
      <div className="bg-[#1F2024] p-3 rounded-[10px] border border-white/[0.06] space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex items-center justify-between bg-[#141517] px-2.5 py-1.5 rounded-[8px] border border-white/[0.06]">
            <span className="text-[11px] text-slate-300 font-medium">
              {isAr ? 'اللون الرئيسي' : 'Primary'}
            </span>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => updateParams({ color: e.target.value })}
              className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between bg-[#141517] px-2.5 py-1.5 rounded-[8px] border border-white/[0.06]">
            <span className="text-[11px] text-slate-300 font-medium">
              {isAr ? 'اللون الثانوي' : 'Secondary'}
            </span>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => updateParams({ secondaryColor: e.target.value })}
              className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COSMIC_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateParams({ color: c })}
              className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                primaryColor.toUpperCase() === c.toUpperCase()
                  ? 'border-cyan-400 ring-2 ring-cyan-400/40'
                  : 'border-white/20'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
