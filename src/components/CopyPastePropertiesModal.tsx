import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  ClipboardCopy,
  ClipboardPaste,
  CheckSquare,
  Square,
  Sparkles,
  Bookmark,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import type {
  CopiedPropertiesBundle,
  Language,
  Layer,
  PropertyPreset,
  PropertyTransferMode,
  PropertyTransferSelection,
} from '../types';
import {
  addPropertyPreset,
  createDefaultPropertySelection,
  createEmptyPropertySelection,
  deletePropertyPreset,
  exportPropertyPresetsJSON,
  extractLayerProperties,
  getCompatibilityReport,
  importPropertyPresetsJSON,
  loadPropertyPresets,
} from '../engine/propertyTransfer';

interface CopyPastePropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  sourceLayer: Layer | null;
  allLayers: Layer[];
  preselectedTargetIds: string[];
  copiedBundle: CopiedPropertiesBundle | null;
  onCopyBundle: (bundle: CopiedPropertiesBundle) => void;
  onPasteToLayers: (bundle: CopiedPropertiesBundle, targetLayerIds: string[], mode: PropertyTransferMode) => void;
}

export const CopyPastePropertiesModal: React.FC<CopyPastePropertiesModalProps> = ({
  isOpen,
  onClose,
  lang,
  sourceLayer,
  allLayers,
  preselectedTargetIds,
  copiedBundle,
  onCopyBundle,
  onPasteToLayers,
}) => {
  const isAr = lang === 'ar';
  const [tab, setTab] = useState<'transfer' | 'presets'>('transfer');
  const [selection, setSelection] = useState<PropertyTransferSelection>(() =>
    createDefaultPropertySelection(sourceLayer)
  );
  const [pasteMode, setPasteMode] = useState<PropertyTransferMode>('replace');
  const [targetIds, setTargetIds] = useState<string[]>(() =>
    preselectedTargetIds.length > 0
      ? preselectedTargetIds
      : sourceLayer
        ? allLayers.filter((l) => l.id !== sourceLayer.id).slice(0, 1).map((l) => l.id)
        : []
  );

  const [presets, setPresets] = useState<PropertyPreset[]>(() => loadPropertyPresets());
  const [presetName, setPresetName] = useState('');
  const [presetFolder, setPresetFolder] = useState('Motion');
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewBundle = useMemo(() => {
    if (!sourceLayer) return copiedBundle;
    return extractLayerProperties(sourceLayer, selection);
  }, [sourceLayer, selection, copiedBundle]);

  const compatWarnings = useMemo(() => {
    const activeSel = previewBundle?.selection || selection;
    return targetIds
      .map((id) => allLayers.find((l) => l.id === id))
      .filter((l): l is Layer => Boolean(l))
      .map((l) => ({
        layer: l,
        report: getCompatibilityReport(l.type, activeSel),
      }))
      .filter((item) => item.report.skippedLabels.length > 0);
  }, [targetIds, allLayers, previewBundle, selection]);

  if (!isOpen) return null;

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2800);
  };

  const selectAll = () => setSelection(createDefaultPropertySelection(sourceLayer));
  const deselectAll = () => setSelection(createEmptyPropertySelection());

  const toggleCategory = (cat: 'transform' | 'animation' | 'appearance' | 'effects' | 'mask', val: boolean) => {
    setSelection((prev) => {
      if (cat === 'transform') {
        return {
          ...prev,
          transform: {
            positionX: val,
            positionY: val,
            positionZ: val,
            scaleX: val,
            scaleY: val,
            scaleZ: val,
            rotationX: val,
            rotationY: val,
            rotationZ: val,
            anchorPoint: val,
            opacity: val,
            perspective3D: val,
          },
        };
      }
      if (cat === 'animation') {
        return {
          ...prev,
          animation: {
            keyframes: val,
            easingCurves: val,
            springSettings: val,
            motionPaths: val,
            timing: val,
            speed: val,
          },
        };
      }
      if (cat === 'appearance') {
        return {
          ...prev,
          appearance: {
            fill: val,
            stroke: val,
            gradientAndColors: val,
            shadowsAndGlow: val,
            bordersAndCorner: val,
            typography: val,
          },
        };
      }
      if (cat === 'effects') {
        return {
          ...prev,
          effects: {
            allEffects: val,
            selectedEffectIds: val && sourceLayer ? sourceLayer.effects.map((e) => e.id) : [],
            effectOrder: val,
            effectParams: val,
            blendMode: val,
          },
        };
      }
      return {
        ...prev,
        mask: { maskLayerAndMode: val },
      };
    });
  };

  const handleCopy = () => {
    if (!sourceLayer) return;
    const bundle = extractLayerProperties(sourceLayer, selection);
    onCopyBundle(bundle);
    notify(isAr ? `تم نسخ خصائص "${sourceLayer.name}"` : `Copied properties from "${sourceLayer.name}"`);
  };

  const handlePaste = () => {
    const activeBundle = copiedBundle || previewBundle;
    if (!activeBundle || targetIds.length === 0) return;
    onPasteToLayers(activeBundle, targetIds, pasteMode);
    notify(
      isAr
        ? `تم لصق الخصائص على ${targetIds.length} طبقات (${pasteMode === 'merge' ? 'دمج' : 'استبدال'})`
        : `Pasted to ${targetIds.length} layer(s) (${pasteMode} mode)`
    );
  };

  const handleSaveAsPreset = () => {
    const bundle = previewBundle || copiedBundle;
    if (!bundle) return;
    const updated = addPropertyPreset(
      presetName || (isAr ? `قالب ${sourceLayer?.name || ''}` : `${sourceLayer?.name || 'Layer'} Style`),
      presetFolder,
      bundle
    );
    setPresets(updated);
    setPresetName('');
    notify(isAr ? 'تم حفظ مجموعة الخصائص في القوالب' : 'Saved Property Preset');
  };

  const handleExportPresets = () => {
    const json = exportPropertyPresetsJSON(presets);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sqmotion-presets-${Date.now()}.sqpreset.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPresets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importPropertyPresetsJSON(text);
    setPresets(res.presets);
    notify(isAr ? `تم استيراد ${res.addedCount} قالب` : `Imported ${res.addedCount} preset(s)`);
    e.target.value = '';
  };

  const toggleTarget = (id: string) => {
    setTargetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-800 bg-[#18181c]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ClipboardCopy className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold truncate">
                {isAr ? 'نسخ ولصق خصائص الطبقات المتقدم' : 'Advanced Copy & Paste Properties'}
              </h2>
              {sourceLayer && (
                <p className="text-[11px] text-zinc-400 truncate">
                  {isAr ? 'الطبقة المصدر:' : 'Source Layer:'} {sourceLayer.name} ({sourceLayer.type})
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-nav */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-zinc-800">
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
            <button
              onClick={() => setTab('transfer')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                tab === 'transfer' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isAr ? 'تحديد الخصائص واللصق' : 'Select & Transfer'}
            </button>
            <button
              onClick={() => setTab('presets')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                tab === 'presets' ? 'bg-rose-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {isAr ? `قوالب الخصائص (${presets.length})` : `Property Presets (${presets.length})`}
            </button>
          </div>

          {tab === 'transfer' && (
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <CheckSquare className="w-3.5 h-3.5 text-rose-400" />
                <span>{isAr ? 'تحديد الكل' : 'Select All'}</span>
              </button>
              <button
                onClick={deselectAll}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 text-zinc-400" />
                <span>{isAr ? 'إلغاء الكل' : 'Clear'}</span>
              </button>
            </div>
          )}
        </div>

        {feedback && (
          <div className="px-5 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs">
            {feedback}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'transfer' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Property Category Matrix */}
              <div className="lg:col-span-7 space-y-3">
                {/* 1. Transform */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">
                      {isAr ? '1. التحويل والأبعاد (Transform)' : '1. Transform & 3D'}
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button onClick={() => toggleCategory('transform', true)} className="text-rose-400 hover:underline">
                        {isAr ? 'الكل' : 'All'}
                      </button>
                      <button onClick={() => toggleCategory('transform', false)} className="text-zinc-500 hover:underline">
                        {isAr ? 'لا شيء' : 'None'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {([
                      ['positionX', 'Position X'],
                      ['positionY', 'Position Y'],
                      ['positionZ', 'Position Z'],
                      ['scaleX', 'Scale X'],
                      ['scaleY', 'Scale Y'],
                      ['scaleZ', 'Scale Z'],
                      ['rotationX', 'Rotation X'],
                      ['rotationY', 'Rotation Y'],
                      ['rotationZ', 'Rotation Z'],
                      ['anchorPoint', isAr ? 'نقطة الارتكاز' : 'Anchor Point'],
                      ['opacity', isAr ? 'الشفافية' : 'Opacity'],
                      ['perspective3D', isAr ? 'المنظور والـ 3D' : '3D & Perspective'],
                    ] as Array<[keyof PropertyTransferSelection['transform'], string]>).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selection.transform[key]}
                          onChange={(e) =>
                            setSelection((prev) => ({
                              ...prev,
                              transform: { ...prev.transform, [key]: e.target.checked },
                            }))
                          }
                          className="accent-rose-500 w-3.5 h-3.5"
                        />
                        <span className="truncate">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2. Animation */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">
                      {isAr ? '2. الحركة والمنحنيات (Animation)' : '2. Animation & Timing'}
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button onClick={() => toggleCategory('animation', true)} className="text-rose-400 hover:underline">
                        {isAr ? 'الكل' : 'All'}
                      </button>
                      <button onClick={() => toggleCategory('animation', false)} className="text-zinc-500 hover:underline">
                        {isAr ? 'لا شيء' : 'None'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {([
                      ['keyframes', isAr ? 'الإطارات المفتاحية' : 'Keyframes'],
                      ['easingCurves', isAr ? 'منحنيات التسارع' : 'Easing Curves'],
                      ['springSettings', isAr ? 'إعدادات الزنبرك' : 'Spring Settings'],
                      ['motionPaths', isAr ? 'مسارات الحركة' : 'Motion Paths'],
                      ['timing', isAr ? 'التوقيت والمدة' : 'Layer Timing'],
                      ['speed', isAr ? 'سرعة التشغيل' : 'Playback Speed'],
                    ] as Array<[keyof PropertyTransferSelection['animation'], string]>).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selection.animation[key]}
                          onChange={(e) =>
                            setSelection((prev) => ({
                              ...prev,
                              animation: { ...prev.animation, [key]: e.target.checked },
                            }))
                          }
                          className="accent-rose-500 w-3.5 h-3.5"
                        />
                        <span className="truncate">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 3. Appearance & Mask */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">
                      {isAr ? '3. المظهر والحدود والأقنعة' : '3. Appearance & Mask'}
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button onClick={() => toggleCategory('appearance', true)} className="text-rose-400 hover:underline">
                        {isAr ? 'الكل' : 'All'}
                      </button>
                      <button onClick={() => toggleCategory('appearance', false)} className="text-zinc-500 hover:underline">
                        {isAr ? 'لا شيء' : 'None'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {([
                      ['fill', isAr ? 'التعبئة (Fill)' : 'Fill'],
                      ['stroke', isAr ? 'الحد (Stroke)' : 'Stroke'],
                      ['gradientAndColors', isAr ? 'الألوان والتدرج' : 'Colors & Gradient'],
                      ['shadowsAndGlow', isAr ? 'الظلال والتوهج' : 'Shadows & Glow'],
                      ['bordersAndCorner', isAr ? 'الحواف والزوايا' : 'Borders & Radius'],
                      ['typography', isAr ? 'خصائص الخط' : 'Typography'],
                    ] as Array<[keyof PropertyTransferSelection['appearance'], string]>).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer text-zinc-300">
                        <input
                          type="checkbox"
                          checked={selection.appearance[key]}
                          onChange={(e) =>
                            setSelection((prev) => ({
                              ...prev,
                              appearance: { ...prev.appearance, [key]: e.target.checked },
                            }))
                          }
                          className="accent-rose-500 w-3.5 h-3.5"
                        />
                        <span className="truncate">{label}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-300 col-span-2 sm:col-span-3 pt-1 border-t border-zinc-800/80">
                      <input
                        type="checkbox"
                        checked={selection.mask.maskLayerAndMode}
                        onChange={(e) =>
                          setSelection((prev) => ({
                            ...prev,
                            mask: { maskLayerAndMode: e.target.checked },
                          }))
                        }
                        className="accent-rose-500 w-3.5 h-3.5"
                      />
                      <span>{isAr ? 'إعدادات القناع (Mask Path & Mode)' : 'Mask Configuration & Mode'}</span>
                    </label>
                  </div>
                </div>

                {/* 4. Effects */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isAr ? '4. التأثيرات والمزج (Effects)' : '4. Effects & Blending'}</span>
                    </span>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selection.effects.allEffects}
                        onChange={(e) => toggleCategory('effects', e.target.checked)}
                        className="accent-rose-500 w-3.5 h-3.5"
                      />
                      <span>{isAr ? 'كل التأثيرات' : 'All Effects'}</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                      <input
                        type="checkbox"
                        checked={selection.effects.effectParams}
                        onChange={(e) =>
                          setSelection((prev) => ({
                            ...prev,
                            effects: { ...prev.effects, effectParams: e.target.checked },
                          }))
                        }
                        className="accent-rose-500 w-3.5 h-3.5"
                      />
                      <span>{isAr ? 'قيم التأثيرات' : 'Effect Parameters'}</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                      <input
                        type="checkbox"
                        checked={selection.effects.blendMode}
                        onChange={(e) =>
                          setSelection((prev) => ({
                            ...prev,
                            effects: { ...prev.effects, blendMode: e.target.checked },
                          }))
                        }
                        className="accent-rose-500 w-3.5 h-3.5"
                      />
                      <span>{isAr ? 'وضع المزج (Blend Mode)' : 'Blend Mode'}</span>
                    </label>
                  </div>

                  {sourceLayer && sourceLayer.effects.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {sourceLayer.effects.map((fx) => {
                        const checked =
                          selection.effects.allEffects || selection.effects.selectedEffectIds.includes(fx.id);
                        return (
                          <button
                            key={fx.id}
                            type="button"
                            onClick={() => {
                              setSelection((prev) => {
                                const current = prev.effects.allEffects
                                  ? sourceLayer.effects.map((e) => e.id)
                                  : prev.effects.selectedEffectIds;
                                const next = checked ? current.filter((id) => id !== fx.id) : [...current, fx.id];
                                return {
                                  ...prev,
                                  effects: {
                                    ...prev.effects,
                                    allEffects: next.length === sourceLayer.effects.length,
                                    selectedEffectIds: next,
                                  },
                                };
                              });
                            }}
                            className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors ${
                              checked
                                ? 'bg-rose-500/20 border-rose-500/60 text-rose-200'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                            }`}
                          >
                            {fx.name || fx.type}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Preview + Multi-Layer Target + Mode + Actions */}
              <div className="lg:col-span-5 space-y-4">
                {/* Preview Box */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="text-xs font-semibold text-zinc-200">
                    {isAr ? 'معاينة الخصائص المحددة' : 'Selection Preview'}
                  </div>
                  <div className="text-[11px] text-zinc-400 space-y-1 font-mono">
                    <div>
                      • Transform: {previewBundle?.payload.transform ? Object.keys(previewBundle.payload.transform).join(', ') || 'none' : 'none'}
                    </div>
                    <div>• Effects: {previewBundle?.payload.effects?.length ?? 0}</div>
                    <div>• Blend Mode: {previewBundle?.payload.blendMode || 'unchanged'}</div>
                    <div>• Mask: {previewBundle?.payload.mask ? previewBundle.payload.mask.mode : 'none'}</div>
                    <div>• Timing: {previewBundle?.payload.timing ? `${previewBundle.payload.timing.startFrame}..${previewBundle.payload.timing.durationFrames}f` : 'unchanged'}</div>
                  </div>
                  <button
                    onClick={handleCopy}
                    disabled={!sourceLayer}
                    className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <ClipboardCopy className="w-4 h-4 text-rose-400" />
                    <span>{isAr ? 'نسخ الخصائص للحافظة' : 'Copy Selected Properties'}</span>
                  </button>
                </div>

                {/* Paste Targets & Replace/Merge */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isAr ? 'الطبقات المستهدفة للصق' : 'Target Layers for Paste'}</span>
                    </span>
                    <button
                      onClick={() =>
                        setTargetIds(
                          targetIds.length === allLayers.length ? [] : allLayers.map((l) => l.id)
                        )
                      }
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      {targetIds.length === allLayers.length
                        ? isAr ? 'إلغاء الكل' : 'None'
                        : isAr ? 'تحديد الكل' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {allLayers.map((l) => (
                      <label
                        key={l.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={targetIds.includes(l.id)}
                            onChange={() => toggleTarget(l.id)}
                            className="accent-rose-500 w-3.5 h-3.5 shrink-0"
                          />
                          <span className="truncate">{l.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 uppercase shrink-0">{l.type}</span>
                      </label>
                    ))}
                  </div>

                  {compatWarnings.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{isAr ? 'توافق ذكي بين الطبقات:' : 'Safe Cross-Layer Skipping:'}</span>
                      </div>
                      {compatWarnings.map((w) => (
                        <div key={w.layer.id}>
                          {w.layer.name}: {w.report.skippedLabels.join(', ')}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mode Switch */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setPasteMode('replace')}
                      className={`py-1.5 rounded-md text-xs font-medium ${
                        pasteMode === 'replace' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                      }`}
                    >
                      {isAr ? 'استبدال الخصائص' : 'Replace Mode'}
                    </button>
                    <button
                      onClick={() => setPasteMode('merge')}
                      className={`py-1.5 rounded-md text-xs font-medium ${
                        pasteMode === 'merge' ? 'bg-zinc-800 text-white' : 'text-zinc-400'
                      }`}
                    >
                      {isAr ? 'دمج مع الحالية' : 'Merge Mode'}
                    </button>
                  </div>

                  <button
                    onClick={handlePaste}
                    disabled={targetIds.length === 0 || (!copiedBundle && !previewBundle)}
                    className="w-full py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    <span>
                      {isAr
                        ? `لصق على ${targetIds.length} طبقات`
                        : `Paste to ${targetIds.length} Layer(s)`}
                    </span>
                  </button>
                </div>

                {/* Quick Save Preset */}
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                  <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-rose-400" />
                    <span>{isAr ? 'حفظ كقالب خصائص قابل لإعادة الاستخدام' : 'Save Selection as Preset'}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder={isAr ? 'اسم القالب...' : 'Preset name...'}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                    />
                    <input
                      value={presetFolder}
                      onChange={(e) => setPresetFolder(e.target.value)}
                      placeholder={isAr ? 'المجلد' : 'Folder'}
                      className="w-24 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                    />
                    <button
                      onClick={handleSaveAsPreset}
                      disabled={!sourceLayer && !copiedBundle}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500 text-xs font-medium whitespace-nowrap"
                    >
                      {isAr ? 'حفظ' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">
                  {isAr
                    ? 'طبّق أي قالب خصائص على الطبقات المحددة أو صدّره كملف JSON للمشاركة.'
                    : 'Apply saved property presets onto selected layers or export/import JSON packages.'}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.sqpreset.json"
                    onChange={handleImportPresets}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isAr ? 'استيراد' : 'Import'}</span>
                  </button>
                  <button
                    onClick={handleExportPresets}
                    disabled={presets.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تصدير' : 'Export'}</span>
                  </button>
                </div>
              </div>

              {presets.length === 0 ? (
                <div className="p-8 rounded-xl border border-zinc-800 text-center text-xs text-zinc-500">
                  {isAr
                    ? 'لا توجد قوالب خصائص محفوظة بعد. احفظ أي خصائص من تبويب "تحديد الخصائص واللصق".'
                    : 'No saved property presets yet. Save one from the Select & Transfer tab.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {presets.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{p.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {p.folder} · {p.bundle.sourceLayerType} · {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            const targets =
                              targetIds.length > 0
                                ? targetIds
                                : sourceLayer
                                  ? [sourceLayer.id]
                                  : allLayers.slice(0, 1).map((l) => l.id);
                            if (targets.length === 0) return;
                            onPasteToLayers(p.bundle, targets, pasteMode);
                            notify(isAr ? `تم تطبيق "${p.name}"` : `Applied "${p.name}"`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium whitespace-nowrap"
                        >
                          {isAr ? 'تطبيق' : 'Apply'}
                        </button>
                        <button
                          onClick={() => setPresets(deletePropertyPreset(p.id))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
