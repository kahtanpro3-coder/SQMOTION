import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Language, Layer, ShaderEffect } from '../types';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Copy,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import { AlightEffectsStudioModal } from './AlightEffectsStudioModal';
import { ALIGHT_EFFECTS_FULL_CATALOG } from '../data/alightEffectsCatalog';
import { EffectPortraitThumbnail } from './EffectPortraitThumbnail';
import { EffectControlSettingsBar } from './EffectControlSettingsBar';
import { EffectParamControlRow } from './EffectParamControlRow';
import { useEffectControlSettings } from '../utils/effectControlSettings';
import {
  MODAL_EASE,
  PANEL_SPRING,
  PanelRimSheen,
  dropdownVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface AlightEffectsViewProps {
  project: Project;
  lang: Language;
  selectedLayer: Layer;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onBack: () => void;
  onExitLayer?: () => void;
  onAddKeyframe?: (layerId: string, propertyPath: string) => void;
}

export const AlightEffectsView: React.FC<AlightEffectsViewProps> = ({
  project,
  lang,
  selectedLayer,
  onUpdateLayer,
  onBack,
  onExitLayer,
  onAddKeyframe,
}) => {
  const [showBrowserModal, setShowBrowserModal] = useState<boolean>(false);
  const [expandedEffectId, setExpandedEffectId] = useState<string | null>(() =>
    selectedLayer.effects?.length === 1 ? selectedLayer.effects[0].id : null
  );
  const [showOptionsMenu, setShowOptionsMenu] = useState<boolean>(false);
  const [effectSettings] = useEffectControlSettings();

  useEffect(() => {
    if (selectedLayer.effects?.length === 1) {
      setExpandedEffectId(selectedLayer.effects[0].id);
    } else if (
      expandedEffectId &&
      !selectedLayer.effects?.some((e) => e.id === expandedEffectId)
    ) {
      setExpandedEffectId(null);
    }
  }, [selectedLayer.id, selectedLayer.effects?.length]);

  // Helper copy layer
  const getCopy = (): Layer => JSON.parse(JSON.stringify(selectedLayer));

  const handleToggleEffectEnabled = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = getCopy();
    const eff = copy.effects?.find((x) => x.id === id);
    if (eff) {
      eff.enabled = !eff.enabled;
      onUpdateLayer(copy);
    }
  };

  const handleRemoveEffect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = getCopy();
    copy.effects = copy.effects?.filter((x) => x.id !== id) || [];
    onUpdateLayer(copy);
    if (expandedEffectId === id) setExpandedEffectId(null);
  };

  const handleDuplicateEffect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = getCopy();
    const target = copy.effects?.find((x) => x.id === id);
    if (target) {
      const cloned: ShaderEffect = {
        ...JSON.parse(JSON.stringify(target)),
        id: `eff-${Date.now()}`,
        name: `${target.name} (Copy)`,
      };
      copy.effects.push(cloned);
      onUpdateLayer(copy);
    }
  };

  const handleUpdateParam = (effectId: string, paramKey: string, value: any) => {
    const copy = getCopy();
    const eff = copy.effects?.find((x) => x.id === effectId);
    if (eff) {
      eff.params[paramKey] = value;
      onUpdateLayer(copy);
    }
  };

  const handleResetEffectParams = (effectId: string) => {
    const copy = getCopy();
    const eff = copy.effects?.find((x) => x.id === effectId);
    if (eff) {
      const orig = ALIGHT_EFFECTS_FULL_CATALOG.find((x) => x.id === eff.type);
      eff.params = { ...(orig?.defaultParams || {}), mix: 100 };
      onUpdateLayer(copy);
    }
  };

  const handleClearAllEffects = () => {
    const copy = getCopy();
    copy.effects = [];
    onUpdateLayer(copy);
    setShowOptionsMenu(false);
  };

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="w-full max-w-full bg-[#141517] flex flex-col select-none text-slate-200 font-sans flex-1 min-h-0"
    >
      {/* Clean Matte Header */}
      <div className="h-9 bg-[#191A1D] border-b border-white/[0.06] px-3 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-100 hover:text-white transition-colors cursor-pointer"
          title={lang === 'ar' ? 'رجوع' : 'Back'}
        >
          {lang === 'ar' ? <ArrowRight className="w-4 h-4 text-slate-200" /> : <ArrowLeft className="w-4 h-4 text-slate-200" />}
          <span>{lang === 'ar' ? 'التأثيرات' : 'Effects'}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-medium text-slate-400 truncate max-w-[130px]">
            {selectedLayer.name}
          </span>
          {selectedLayer.effects && selectedLayer.effects.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#25262A] text-slate-200 text-[10px] font-mono tabular-nums">
              {selectedLayer.effects.length}
            </span>
          )}
          {onExitLayer && (
            <button
              type="button"
              onClick={onExitLayer}
              className="px-2 py-0.5 rounded-md bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[rgba(var(--app-accent-rgb),0.35)] text-[10.5px] font-bold text-[var(--app-accent-bright)] flex items-center gap-1 transition-colors cursor-pointer"
              title={lang === 'ar' ? 'الخروج من الطبقة' : 'Exit Layer'}
            >
              <LogOut className="w-3 h-3 shrink-0" />
              <span>{lang === 'ar' ? 'خروج' : 'Exit'}</span>
            </button>
          )}

          {/* Options 3-dots */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showOptionsMenu && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className={`absolute top-8 ${
                    lang === 'ar' ? 'left-0' : 'right-0'
                  } w-44 bg-[#1F2024]/95 backdrop-blur-xl border border-white/[0.08] rounded-[10px] shadow-2xl p-1.5 z-50 text-xs font-medium space-y-1 overflow-hidden origin-top`}
                >
                  <PanelRimSheen roundedClass="rounded-[10px]" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsMenu(false);
                      setShowBrowserModal(true);
                    }}
                    className="relative z-10 w-full text-right px-2.5 py-1.5 rounded-[7px] hover:bg-[#2C2E33] text-slate-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>{lang === 'ar' ? 'إضافة تأثير جديد' : 'Add New Effect'}</span>
                    <Plus className="w-3.5 h-3.5 text-[var(--app-accent-bright)]" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllEffects}
                    className="relative z-10 w-full text-right px-2.5 py-1.5 rounded-[7px] hover:bg-rose-950/40 text-rose-400 flex items-center justify-between cursor-pointer"
                  >
                    <span>{lang === 'ar' ? 'مسح جميع التأثيرات' : 'Clear All Effects'}</span>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Effects List & Matte "+ إضافة تأثير" Button */}
      <div className="p-2.5 space-y-2 flex-1 overflow-y-auto pb-8 overscroll-contain max-w-2xl mx-auto w-full">
        <EffectControlSettingsBar lang={lang} />

        {selectedLayer.effects && selectedLayer.effects.length > 0 ? (
          <motion.div
            variants={staggerFastContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-1.5 max-w-full"
          >
            {selectedLayer.effects.map((effect, idx) => {
              const effDef = ALIGHT_EFFECTS_FULL_CATALOG.find((x) => x.id === effect.type);
              const isExpanded = expandedEffectId === effect.id;

              return (
                <motion.div
                  key={effect.id}
                  variants={staggerItemVariants}
                  className={`bg-[#222326] border rounded-[10px] overflow-hidden transition-colors max-w-full ${
                    effect.enabled
                      ? isExpanded
                        ? 'border-white/20'
                        : 'border-white/[0.06]'
                      : 'border-white/[0.04] opacity-55'
                  }`}
                >
                  {/* Effect Header Row */}
                  <div
                    onClick={() => setExpandedEffectId(isExpanded ? null : effect.id)}
                    className="px-2.5 py-2 flex items-center justify-between cursor-pointer hover:bg-[#292B2F] transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => handleToggleEffectEnabled(effect.id, e)}
                        className={`p-1.5 rounded-[7px] transition-all shrink-0 cursor-pointer ${
                          effect.enabled
                            ? 'bg-[#2C2E33] text-[var(--app-accent-bright)]'
                            : 'bg-[#191A1D] text-slate-500'
                        }`}
                        title={effect.enabled ? 'Disable' : 'Enable'}
                      >
                        {effect.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      <div className="w-8 h-8 rounded-[7px] bg-[#191A1D] overflow-hidden border border-white/[0.08] shrink-0">
                        <EffectPortraitThumbnail
                          effectId={effect.type}
                          color={effDef?.color || '#5EEB9A'}
                          params={effect.params}
                          alt={effect.name}
                          liveMode={true}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-white truncate">{effect.name}</h4>
                        <span className="text-[9.5px] text-slate-400 block truncate font-mono">
                          #{idx + 1} · {effect.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicateEffect(effect.id, e)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-[6px] hover:bg-white/[0.06] cursor-pointer"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleRemoveEffect(effect.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-[6px] hover:bg-rose-950/30 cursor-pointer"
                        title="Delete Effect"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="p-1 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--app-accent-bright)]" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Parameters Area */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto', transition: PANEL_SPRING }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.14, ease: MODAL_EASE } }}
                        className="overflow-hidden"
                      >
                        <div className="p-2.5 bg-[#191A1D] border-t border-white/[0.06] space-y-2 text-xs max-w-full">
                      {/* Quick Effect Extremes & Full Reset Bar */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateParam(effect.id, 'mix', 0)}
                          className="py-1 px-2 rounded-[6px] bg-[#222326] hover:bg-[#2A2C32] border border-white/[0.06] text-[10.5px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          {lang === 'ar' ? 'أصغر نقطة (0%)' : 'Min (0%)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetEffectParams(effect.id)}
                          className="py-1 px-2 rounded-[6px] bg-[#222326] hover:bg-[#2A2C32] border border-white/[0.06] text-[10.5px] font-medium text-amber-300/90 hover:text-amber-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'الافتراضي' : 'Default'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateParam(effect.id, 'mix', 100)}
                          className="py-1 px-2 rounded-[6px] bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[rgba(var(--app-accent-rgb),0.4)] text-[10.5px] font-semibold text-[var(--app-accent-bright)] transition-colors cursor-pointer"
                        >
                          {lang === 'ar' ? 'أقصى قوة (100%)' : 'Max (100%)'}
                        </button>
                      </div>

                      {/* Quick Quantity Bar for Space Stars / Space Lines */}
                      {(effect.type === 'motionStars' || effect.type === 'starfield' || effect.type === 'spaceLines') && (
                        <div className="bg-[#222326] border border-cyan-400/20 rounded-[8px] p-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-cyan-300">
                              {effect.type === 'spaceLines'
                                ? lang === 'ar'
                                  ? 'كمية الخطوط السريعة'
                                  : 'Quick Line Count'
                                : lang === 'ar'
                                ? 'كمية النجوم السريعة'
                                : 'Quick Star Count'}
                            </span>
                            <span className="font-mono text-white font-bold">
                              {Math.round(Number(effect.params?.count ?? (effect.type === 'spaceLines' ? 220 : 280)))}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(effect.type === 'spaceLines'
                              ? [25, 80, 220, 500, 900, 1500]
                              : [30, 100, 280, 600, 1000, 1500]
                            ).map((qty) => {
                              const defCnt = effect.type === 'spaceLines' ? 220 : 280;
                              const active = Math.round(Number(effect.params?.count ?? defCnt)) === qty;
                              return (
                                <button
                                  key={qty}
                                  type="button"
                                  onClick={() => handleUpdateParam(effect.id, 'count', qty)}
                                  className={`px-2 py-0.5 rounded-[5px] border font-mono text-[10.5px] transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-[var(--app-accent-surface)] border-[rgba(var(--app-accent-rgb),0.55)] text-[var(--app-accent-bright)] font-bold'
                                      : 'bg-[#191A1D] border-white/[0.07] text-slate-300 hover:text-white'
                                  }`}
                                >
                                  {qty}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pinned Master Mix Control */}
                      <EffectParamControlRow
                        isMasterMix
                        effectId={effect.id}
                        paramKey="mix"
                        paramVal={effect.params?.mix ?? 100}
                        origDefault={100}
                        effectType={effect.type}
                        layerId={selectedLayer.id}
                        lang={lang}
                        settings={effectSettings}
                        onUpdateParam={handleUpdateParam}
                        onAddKeyframe={onAddKeyframe}
                      />

                      {Object.entries({ ...(effDef?.defaultParams || {}), ...(effect.params || {}) })
                        .filter(([paramKey]) => paramKey !== 'mix')
                        .map(([paramKey, paramVal]) => (
                          <EffectParamControlRow
                            key={paramKey}
                            effectId={effect.id}
                            paramKey={paramKey}
                            paramVal={paramVal}
                            origDefault={effDef?.defaultParams?.[paramKey]}
                            effectType={effect.type}
                            layerId={selectedLayer.id}
                            lang={lang}
                            settings={effectSettings}
                            onUpdateParam={handleUpdateParam}
                            onAddKeyframe={onAddKeyframe}
                          />
                        ))}
                    </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        ) : null}

        {/* Matte Full-Width "+ إضافة تأثير" Button matching f_75.jpg */}
        <motion.button
          whileTap={{ scale: 0.99 }}
          type="button"
          onClick={() => setShowBrowserModal(true)}
          className="w-full py-2.5 px-4 bg-[#222326] hover:bg-[#2C2E33] border border-white/[0.06] rounded-[9px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 text-slate-200 stroke-[2]" />
          <span className="text-xs font-semibold text-slate-200">
            {lang === 'ar' ? 'إضافة تأثير' : 'Add Effect'}
          </span>
        </motion.button>
      </div>

      {/* Dedicated Full-Screen Effects Browser */}
      <AnimatePresence>
        {showBrowserModal && (
          <AlightEffectsStudioModal
            project={project}
            lang={lang}
            selectedLayer={selectedLayer}
            onUpdateLayer={onUpdateLayer}
            onClose={() => setShowBrowserModal(false)}
            onAddKeyframe={onAddKeyframe}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
