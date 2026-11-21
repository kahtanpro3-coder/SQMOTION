import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Language, Layer, ShaderEffect } from '../types';
import { loadFavoritesState, toggleFavoriteItem, isItemFavorited } from '../engine/favoritesStore';
import {
  Search,
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Star,
} from 'lucide-react';
import {
  ALIGHT_EFFECTS_FULL_CATALOG,
  CATEGORIES_LIST,
  AlightEffectItem,
  CategoryDefinition,
} from '../data/alightEffectsCatalog';
import { EffectPortraitThumbnail } from './EffectPortraitThumbnail';
import { EFFECTS_PREVIEW_PORTRAIT_URL } from '../utils/effectThumbnailRenderer';
import { EffectControlSettingsBar } from './EffectControlSettingsBar';
import { EffectParamControlRow } from './EffectParamControlRow';
import { useEffectControlSettings } from '../utils/effectControlSettings';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  MODAL_EASE,
  PANEL_SPRING,
  PanelRimSheen,
  VIEW_SPRING,
  backdropVariants,
  dropdownVariants,
  fullScreenModalVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface AlightEffectsStudioModalProps {
  project: Project;
  lang: Language;
  selectedLayer: Layer;
  onUpdateLayer: (updatedLayer: Layer) => void;
  onClose: () => void;
  onAddKeyframe?: (layerId: string, propertyPath: string) => void;
}

export const AlightEffectsStudioModal: React.FC<AlightEffectsStudioModalProps> = ({
  lang,
  selectedLayer,
  onUpdateLayer,
  onClose,
  onAddKeyframe,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'active'>('catalog');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [expandedEffectId, setExpandedEffectId] = useState<string | null>(() =>
    selectedLayer.effects?.length === 1 ? selectedLayer.effects[0].id : null
  );
  const [hoveredEffect, setHoveredEffect] = useState<AlightEffectItem | null>(null);
  const [effectSettings] = useEffectControlSettings();
  const [favVersion, setFavVersion] = useState(0);

  useEffect(() => {
    const onFav = () => setFavVersion((v) => v + 1);
    window.addEventListener('sqmotion:favoritesChanged', onFav);
    return () => window.removeEventListener('sqmotion:favoritesChanged', onFav);
  }, []);

  const favState = React.useMemo(() => loadFavoritesState(), [favVersion]);

  const isAr = lang === 'ar';

  // Interleave left/right categories symmetrically (2-column grid matching f_78.jpg)
  const allCategoriesFlat: CategoryDefinition[] = [];
  const maxLen = Math.max(CATEGORIES_LIST.left.length, CATEGORIES_LIST.right.length);
  for (let i = 0; i < maxLen; i++) {
    if (CATEGORIES_LIST.left[i]) allCategoriesFlat.push(CATEGORIES_LIST.left[i]);
    if (CATEGORIES_LIST.right[i]) allCategoriesFlat.push(CATEGORIES_LIST.right[i]);
  }
  const navCategoryIds = [...allCategoriesFlat.map((c) => c.id), 'all'];

  const getCopy = (): Layer => JSON.parse(JSON.stringify(selectedLayer));

  const handleAddEffectFromCatalog = (effDef: AlightEffectItem) => {
    const copy = getCopy();
    const newEffect: ShaderEffect = {
      id: `eff-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: effDef.id as any,
      name: isAr ? effDef.nameAr : effDef.nameEn,
      enabled: true,
      params: { ...effDef.defaultParams },
    };
    if (!copy.effects) copy.effects = [];
    copy.effects.push(newEffect);
    onUpdateLayer(copy);
    onClose();
  };

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

  const handleResetEffectParams = (effectId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const copy = getCopy();
    const eff = copy.effects?.find((x) => x.id === effectId);
    if (eff) {
      const orig = ALIGHT_EFFECTS_FULL_CATALOG.find((x) => x.id === eff.type);
      eff.params = { ...(orig?.defaultParams || {}), mix: 100 };
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

  const renderThumbnail = (
    eff: { id: string; color?: string; defaultParams?: Record<string, any>; nameAr?: string; nameEn?: string },
    customParams?: Record<string, any>
  ) => (
    <EffectPortraitThumbnail
      effectId={eff.id}
      color={eff.color || '#5EEB9A'}
      params={customParams || eff.defaultParams || {}}
      alt={isAr ? eff.nameAr || eff.id : eff.nameEn || eff.id}
      className="w-full h-full object-cover"
    />
  );

  // Category artwork pattern overlay for the 2-column category banners matching f_78.jpg
  const renderCategoryPattern = (catId: string) => {
    switch (catId) {
      case 'drawing':
        return (
          <div
            className="absolute inset-0 opacity-35 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 22% 55%, #F59E0B 0%, transparent 45%), repeating-radial-gradient(circle at 75% 40%, rgba(255,255,255,0.22) 0, rgba(255,255,255,0.22) 1px, transparent 1px, transparent 5px)',
            }}
          />
        );
      case 'color':
        return (
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background:
                'linear-gradient(90deg, rgba(239,68,68,0.45), rgba(245,158,11,0.35), rgba(16,185,129,0.35), rgba(59,130,246,0.45))',
              filter: 'blur(8px)',
            }}
          />
        );
      case 'distortion':
        return (
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-25deg, rgba(34,211,238,0.3) 0px, rgba(34,211,238,0.3) 6px, transparent 6px, transparent 16px)',
            }}
          />
        );
      case 'blur':
        return (
          <div
            className="absolute inset-0 opacity-45 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 25% 40%, rgba(251,191,36,0.45), transparent 45%), radial-gradient(circle at 75% 65%, rgba(52,211,153,0.4), transparent 50%)',
              filter: 'blur(6px)',
            }}
          />
        );
      case '3d':
        return (
          <div
            className="absolute inset-0 opacity-35 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.25) 0%, transparent 38%), radial-gradient(circle at 75% 50%, rgba(148,163,184,0.28) 0%, transparent 40%)',
            }}
          />
        );
      case 'procedural':
        return (
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              background:
                'linear-gradient(115deg, rgba(52,211,153,0.4) 0%, rgba(56,189,248,0.35) 50%, rgba(236,72,153,0.45) 100%)',
            }}
          />
        );
      case 'repeat':
        return (
          <div
            className="absolute inset-0 opacity-35 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(232,121,249,0.5) 2px, transparent 2px), radial-gradient(circle, rgba(250,204,21,0.4) 2px, transparent 2px)',
              backgroundSize: '18px 18px',
              backgroundPosition: '0 0, 9px 9px',
            }}
          />
        );
      case 'move':
        return (
          <div className="absolute inset-0 opacity-35 pointer-events-none flex items-center justify-around">
            <div className="w-7 h-7 rounded-full bg-teal-300/35 blur-[3px]" />
            <div className="w-8 h-8 rounded-full bg-emerald-300/30 blur-[2px]" />
          </div>
        );
      case 'glitch':
        return (
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(244,63,94,0.28) 0px, rgba(244,63,94,0.28) 3px, transparent 3px, transparent 8px)',
            }}
          />
        );
      case 'text':
        return (
          <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-around font-black text-2xl tracking-widest text-white select-none rotate-[-12deg]">
            <span>Aa</span>
            <span>TEXT</span>
          </div>
        );
      default:
        return (
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 70% 50%, rgba(255,255,255,0.22), transparent 55%)',
            }}
          />
        );
    }
  };

  // Top featured row effects (matching f_78.jpg)
  const featuredIds = [
    'swing',
    'shake',
    'glitch',
    'oscillate',
    'motionStars',
    'spaceLines',
    'glow',
    'tiles',
    'chroma',
    'flip3d',
    'gaussianBlur',
  ];
  const featuredEffects = featuredIds
    .map((id) => ALIGHT_EFFECTS_FULL_CATALOG.find((e) => e.id === id))
    .filter((e): e is AlightEffectItem => Boolean(e));

  const miniIds = ['wipe', 'glow', 'chromatic', 'rays'];
  const miniEffects = miniIds
    .map((id) => ALIGHT_EFFECTS_FULL_CATALOG.find((e) => e.id === id))
    .filter((e): e is AlightEffectItem => Boolean(e));

  const isDrilledIn = selectedCategoryId !== null || searchQuery.trim().length > 0;

  const filteredEffects = ALIGHT_EFFECTS_FULL_CATALOG.filter((eff) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      eff.nameAr.toLowerCase().includes(q) ||
      eff.nameEn.toLowerCase().includes(q) ||
      eff.descriptionAr.toLowerCase().includes(q) ||
      eff.descriptionEn.toLowerCase().includes(q);

    const matchesCategory =
      !selectedCategoryId || selectedCategoryId === 'all' || eff.category === selectedCategoryId;

    return matchesSearch && matchesCategory;
  });

  const activeEffectsCount = selectedLayer.effects?.length || 0;
  const activeCatObj = allCategoriesFlat.find((c) => c.id === selectedCategoryId);

  const headerTitle = (() => {
    if (activeTab === 'active') {
      return isAr ? `تأثيرات الطبقة (${activeEffectsCount})` : `Layer Effects (${activeEffectsCount})`;
    }
    if (searchQuery.trim()) {
      return isAr ? 'نتائج البحث' : 'Search Results';
    }
    if (selectedCategoryId === 'all') {
      return isAr ? 'جميع التأثيرات' : 'All Effects';
    }
    if (activeCatObj) {
      return isAr ? activeCatObj.nameAr : activeCatObj.nameEn;
    }
    return isAr ? 'متصفح التأثير' : 'Effect Browser';
  })();

  const handleStepCategory = (dir: -1 | 1) => {
    if (!selectedCategoryId) return;
    const idx = navCategoryIds.indexOf(selectedCategoryId);
    if (idx === -1) return;
    const nextIdx = (idx + dir + navCategoryIds.length) % navCategoryIds.length;
    setSelectedCategoryId(navCategoryIds[nextIdx]);
  };

  const modalContent = (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={AMBIENT_BACKDROP_STYLE}
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[80] w-screen h-[100dvh] backdrop-blur-md flex flex-col select-none text-slate-100 font-sans overflow-hidden gpu-layer"
    >
      <AmbientModalGlow />
      <motion.div
        variants={fullScreenModalVariants}
        className="relative z-10 flex-1 flex flex-col min-h-0 bg-[#141517]/[0.98] overflow-hidden gpu-layer"
      >
        <PanelRimSheen roundedClass="rounded-none" />
        {/* 1. CLEAN MATTE TOP APP BAR (matching f_78.jpg & f_82.jpg) */}
        <div className="relative z-10 h-12 bg-[#141517] border-b border-white/[0.06] px-3 sm:px-5 flex items-center justify-between shrink-0 gap-2">
        {/* Start: Back arrow when drilled in, or Search toggle */}
        <div className="flex items-center gap-2 min-w-0">
          {activeTab === 'active' ? (
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="p-1.5 text-slate-200 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              title={isAr ? 'رجوع' : 'Back'}
            >
              {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
          ) : selectedCategoryId !== null ? (
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryId(null);
                setSearchQuery('');
              }}
              className="p-1.5 text-slate-200 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              title={isAr ? 'رجوع للفئات' : 'Back to Categories'}
            >
              {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showSearch ? 'bg-[#25262A] text-white' : 'text-slate-200 hover:text-white hover:bg-white/[0.06]'
              }`}
              title={isAr ? 'بحث' : 'Search'}
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Center Title */}
        <h1 className="text-[14px] sm:text-[15px] font-bold text-slate-100 truncate text-center flex-1">
          {headerTitle}
        </h1>

        {/* End: Active Stack Toggle Pill + Close X */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTab === 'catalog' && activeEffectsCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className="px-2 py-1 rounded-[7px] bg-[#222326] hover:bg-[#2C2E33] border border-white/[0.08] text-[10.5px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <span>{isAr ? 'المطبقة' : 'Active'}</span>
              <span className="font-mono tabular-nums text-[var(--app-accent-bright)]">{activeEffectsCount}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </div>

      {/* Inline Expandable Search Bar when toggled */}
      <AnimatePresence>
        {activeTab === 'catalog' && (showSearch || searchQuery.trim().length > 0) && (
          <motion.div
            key="studio-search-bar"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative z-10 px-3 py-2 bg-[#191A1D] border-b border-white/[0.06] shrink-0 origin-top"
          >
            <div className="relative max-w-xl mx-auto">
              <Search
                className={`w-4 h-4 text-slate-400 absolute ${
                  isAr ? 'right-3' : 'left-3'
                } top-1/2 -translate-y-1/2 pointer-events-none`}
              />
              <input
                type="text"
                autoFocus={showSearch}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث بالاسم: كروما، ضبابي، 3D، توهج، تكرار...'
                    : 'Search: chroma, blur, 3D, glow, tiles...'
                }
                className={`w-full bg-[#222326] border border-white/[0.08] rounded-[9px] py-1.5 ${
                  isAr ? 'pr-9 pl-8' : 'pl-9 pr-8'
                } text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/25`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute ${
                    isAr ? 'left-2.5' : 'right-2.5'
                  } top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer`}
                >
                  ✕
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. BODY CONTENT */}
      <AnimatePresence mode="popLayout" initial={false}>
      {activeTab === 'catalog' ? (
        !isDrilledIn ? (
          /* ================= OVERVIEW: MAIN PORTRAIT PREVIEW + FEATURED STRIPS + 2-COLUMN CATEGORY BANNERS ================= */
          <motion.div
            key="studio-overview"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: VIEW_SPRING }}
            exit={{ opacity: 0, scale: 0.96, y: -10, transition: { duration: 0.14, ease: MODAL_EASE } }}
            className="relative z-10 flex-1 overflow-y-auto overscroll-contain pb-8 gpu-layer"
          >
            {/* Compact Main Reference Portrait Banner */}
            <div className="px-3.5 pt-3 pb-1 max-w-5xl mx-auto">
              <div className="bg-[#1B1C20] border border-white/[0.07] rounded-[12px] p-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-14 h-14 rounded-[10px] overflow-hidden border border-white/15 shrink-0 bg-black">
                    <img
                      src={EFFECTS_PREVIEW_PORTRAIT_URL}
                      alt={isAr ? 'الصورة الرئيسية للمؤثرات' : 'Main Effects Portrait'}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {hoveredEffect
                        ? isAr
                          ? hoveredEffect.nameAr
                          : hoveredEffect.nameEn
                        : isAr
                        ? 'الصورة الرئيسية لمعاينة التأثيرات'
                        : 'Main Effect Preview Portrait'}
                    </div>
                    <p className="text-[10.5px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                      {hoveredEffect
                        ? isAr
                          ? hoveredEffect.descriptionAr
                          : hoveredEffect.descriptionEn
                        : isAr
                        ? 'كل بطاقة تعرض المعاينة الحقيقية لتأثيرها على هذه الصورة — وتعمل التأثيرات على جميع الطبقات'
                        : 'Each card previews its real visual effect on this portrait — works on every layer type'}
                    </p>
                  </div>
                </div>

                {hoveredEffect && (
                  <div className="w-14 h-14 rounded-[10px] overflow-hidden border border-[rgba(var(--app-accent-bright-rgb),0.5)] shrink-0 shadow-md">
                    {renderThumbnail(hoveredEffect)}
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal Featured Effects Row */}
            <div className="flex items-start gap-2.5 overflow-x-auto scrollbar-none px-3.5 pt-2.5 pb-2 max-w-5xl mx-auto">
              {featuredEffects.map((eff) => {
                const isAlreadyAdded = selectedLayer.effects?.some((e) => e.type === eff.id);
                return (
                  <button
                    key={eff.id}
                    type="button"
                    onMouseEnter={() => setHoveredEffect(eff)}
                    onFocus={() => setHoveredEffect(eff)}
                    onClick={() => handleAddEffectFromCatalog(eff)}
                    className="flex flex-col items-center gap-1.5 shrink-0 w-[72px] sm:w-[78px] group cursor-pointer active:scale-95 transition-transform"
                  >
                    <div className="w-[70px] h-[70px] sm:w-[76px] sm:h-[76px] rounded-[12px] overflow-hidden relative border border-white/[0.08] group-hover:border-[rgba(var(--app-accent-bright-rgb),0.6)] shadow-sm bg-[#1A1B20]">
                      {renderThumbnail(eff)}
                      {isAlreadyAdded && (
                        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#141517]/90 border border-[var(--app-accent-bright)] flex items-center justify-center text-[9px] text-[var(--app-accent-bright)]">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[10.5px] font-medium text-slate-300 group-hover:text-white truncate w-full text-center">
                      {isAr ? eff.nameAr : eff.nameEn}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Secondary Compact Quick Tiles Row */}
            <div className="flex items-center justify-end gap-3 px-4 py-1.5 max-w-5xl mx-auto">
              {miniEffects.map((eff) => (
                <button
                  key={`mini-${eff.id}`}
                  type="button"
                  onMouseEnter={() => setHoveredEffect(eff)}
                  onFocus={() => setHoveredEffect(eff)}
                  onClick={() => handleAddEffectFromCatalog(eff)}
                  className="flex flex-col items-center gap-1 group cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-11 h-11 rounded-[10px] overflow-hidden border border-white/[0.08] group-hover:border-[rgba(var(--app-accent-bright-rgb),0.6)] bg-[#1A1B20]">
                    {renderThumbnail(eff)}
                  </div>
                  <span className="text-[9.5px] text-slate-400 group-hover:text-slate-200 max-w-[54px] truncate">
                    {isAr ? eff.nameAr : eff.nameEn}
                  </span>
                </button>
              ))}
            </div>

            {/* Subtle Divider Indicator */}
            <div className="flex justify-center py-2">
              <div className="w-1.5 h-1.5 rounded-full border border-[rgba(var(--app-accent-bright-rgb),0.8)]" />
            </div>

            {/* 2-Column Textured Category Grid */}
            <motion.div
              variants={staggerFastContainerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 gap-2 px-3 max-w-4xl mx-auto"
            >
              {allCategoriesFlat.map((cat) => (
                <motion.button
                  key={cat.id}
                  variants={staggerItemVariants}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`h-[48px] sm:h-[54px] rounded-[10px] relative overflow-hidden flex items-center justify-center bg-gradient-to-br ${cat.gradient} border border-white/[0.06] hover:border-white/20 transition-colors cursor-pointer group`}
                >
                  {renderCategoryPattern(cat.id)}
                  <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors" />
                  <span className="relative z-10 text-xs sm:text-[13px] font-bold text-white px-2 text-center truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
                    {isAr ? cat.nameAr : cat.nameEn}
                  </span>
                </motion.button>
              ))}

              {/* Full-width All Effects card */}
              <motion.button
                variants={staggerItemVariants}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className="col-span-2 h-[46px] rounded-[10px] relative overflow-hidden flex items-center justify-center bg-[#222326] hover:bg-[#2A2C30] border border-white/[0.06] hover:border-white/20 transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <span>{isAr ? 'عرض جميع التأثيرات' : 'Browse All Effects'}</span>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    ({ALIGHT_EFFECTS_FULL_CATALOG.length})
                  </span>
                </span>
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          /* ================= DRILL-DOWN 4-COLUMN SQUARE GRID ================= */
          <motion.div
            key={`studio-drill-${selectedCategoryId || 'search'}`}
            initial={{ opacity: 0, x: isAr ? -48 : 48, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1, transition: PANEL_SPRING }}
            exit={{ opacity: 0, x: isAr ? 32 : -32, scale: 0.97, transition: { duration: 0.14, ease: MODAL_EASE } }}
            className="relative z-10 flex-1 flex flex-col min-h-0 gpu-layer"
          >
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
              {filteredEffects.length > 0 ? (
                <motion.div
                  variants={staggerFastContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-x-2.5 gap-y-4 max-w-5xl mx-auto"
                >
                  {filteredEffects.map((eff) => {
                    const isAlreadyAdded = selectedLayer.effects?.some((e) => e.type === eff.id);
                    const isFav = isItemFavorited(favState, 'effect', eff.id);
                    return (
                      <motion.div
                        key={eff.id}
                        role="button"
                        tabIndex={0}
                        variants={staggerItemVariants}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAddEffectFromCatalog(eff)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleAddEffectFromCatalog(eff);
                          }
                        }}
                        className="flex flex-col items-center group cursor-pointer text-center"
                      >
                        <div className="w-full aspect-square rounded-[12px] overflow-hidden relative border border-white/[0.08] group-hover:border-[rgba(var(--app-accent-bright-rgb),0.6)] bg-[#1D1E21]">
                          {renderThumbnail(eff)}

                          {isAlreadyAdded && (
                            <span
                              className="absolute top-1 left-1 w-5 h-5 rounded-full bg-[#141517]/90 border-[1.5px] border-[var(--app-accent-bright)] flex items-center justify-center text-[var(--app-accent-bright)] shadow-sm"
                              title={isAr ? 'مُضاف للطبقة' : 'Applied'}
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteItem(favState, {
                                type: 'effect',
                                refId: eff.id,
                                title: eff.nameEn,
                                titleAr: eff.nameAr,
                                folderId: 'fx',
                                payload: { effectType: eff.id, params: { ...eff.defaultParams } },
                              });
                              window.dispatchEvent(new CustomEvent('sqmotion:favoritesChanged'));
                            }}
                            className={`absolute top-1 right-1 w-5 h-5 rounded-full bg-[#141517]/85 flex items-center justify-center transition-all cursor-pointer ${
                              isFav
                                ? 'text-amber-400 border border-amber-400/50 opacity-100'
                                : 'text-slate-400 hover:text-amber-300 border border-white/10 opacity-75 group-hover:opacity-100'
                            }`}
                            title={isAr ? 'تثبيت في المفضلة' : 'Pin to Favorites'}
                          >
                            <Star className={`w-2.5 h-2.5 ${isFav ? 'fill-amber-400' : ''}`} />
                          </button>
                        </div>

                        <span className="mt-1.5 text-[10.5px] font-medium text-slate-200 group-hover:text-white leading-tight line-clamp-2 w-full">
                          {isAr ? eff.nameAr : eff.nameEn}
                        </span>
                        <span className="text-[9px] text-slate-500 truncate w-full mt-0.5">
                          {isAr ? eff.nameEn : eff.category}
                        </span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ) : (
                <div className="py-24 text-center text-slate-500 space-y-1.5">
                  <p className="text-slate-300 font-semibold text-sm">
                    {isAr ? 'لم يتم العثور على أي تأثير' : 'No matching effects found'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isAr ? 'جرب البحث بكلمة أخرى' : 'Try a different search keyword'}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom < / > Category Switcher (matching f_82.jpg & f_90.jpg) */}
            {selectedCategoryId && !searchQuery.trim() && (
              <div
                dir="ltr"
                className="h-11 bg-[#141517] border-t border-white/[0.06] px-4 flex items-center justify-between shrink-0"
              >
                <button
                  type="button"
                  onClick={() => handleStepCategory(-1)}
                  className="w-8 h-8 rounded-full bg-[#222326] hover:bg-[#2C2E33] flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                  title={isAr ? 'الفئة السابقة' : 'Previous Category'}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-[11px] font-medium text-slate-400">
                  {selectedCategoryId === 'all'
                    ? isAr
                      ? 'الكل'
                      : 'All'
                    : isAr
                    ? activeCatObj?.nameAr
                    : activeCatObj?.nameEn}
                </span>

                <button
                  type="button"
                  onClick={() => handleStepCategory(1)}
                  className="w-8 h-8 rounded-full bg-[#222326] hover:bg-[#2C2E33] flex items-center justify-center text-slate-200 transition-colors cursor-pointer"
                  title={isAr ? 'الفئة التالية' : 'Next Category'}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )
      ) : (
        /* ================= ACTIVE EFFECTS STACK & PARAMETERS ================= */
        <motion.div
          key="studio-active-stack"
          variants={staggerFastContainerVariants}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, transition: { duration: 0.14 } }}
          className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-5 max-w-3xl mx-auto w-full space-y-3"
        >
          <motion.div variants={staggerItemVariants} className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-300">
              {isAr ? 'التأثيرات المطبقة على الطبقة' : 'Applied Layer Effects'}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="px-3 py-1.5 rounded-[8px] bg-[#222326] hover:bg-[#2C2E33] border border-white/[0.08] text-slate-100 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--app-accent-bright)]" />
              <span>{isAr ? 'إضافة تأثير' : 'Add Effect'}</span>
            </button>
          </motion.div>

          <EffectControlSettingsBar lang={lang} />

          {selectedLayer.effects && selectedLayer.effects.length > 0 ? (
            <div className="space-y-2">
              {selectedLayer.effects.map((effect, idx) => {
                const effDef = ALIGHT_EFFECTS_FULL_CATALOG.find((x) => x.id === effect.type);
                const isExpanded = expandedEffectId === effect.id;

                return (
                  <motion.div
                    key={effect.id}
                    variants={staggerItemVariants}
                    className={`bg-[#222326] border rounded-[10px] overflow-hidden transition-colors ${
                      effect.enabled ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-55'
                    }`}
                  >
                    <div
                      onClick={() => setExpandedEffectId(isExpanded ? null : effect.id)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#292B2F] transition-colors gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => handleToggleEffectEnabled(effect.id, e)}
                          className={`p-1.5 rounded-[7px] transition-all shrink-0 cursor-pointer ${
                            effect.enabled ? 'bg-[#2C2E33] text-[var(--app-accent-bright)]' : 'bg-[#191A1D] text-slate-500'
                          }`}
                        >
                          {effect.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>

                        <div className="w-9 h-9 rounded-[8px] bg-[#191A1D] overflow-hidden border border-white/[0.08] shrink-0">
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
                          <h3 className="text-xs font-semibold text-white truncate">{effect.name}</h3>
                          <span className="text-[10px] text-slate-400 font-mono block truncate">
                            #{idx + 1} · {effect.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteItem(favState, {
                              type: 'effect',
                              refId: effect.type,
                              title: effDef?.nameEn || effect.name,
                              titleAr: effDef?.nameAr || effect.name,
                              folderId: 'fx',
                              payload: {
                                effectType: effect.type,
                                params: { ...effect.params },
                              },
                            });
                            window.dispatchEvent(new CustomEvent('sqmotion:favoritesChanged'));
                          }}
                          className={`p-1.5 rounded-[6px] hover:bg-white/5 cursor-pointer ${
                            isItemFavorited(favState, 'effect', effect.type) ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'
                          }`}
                          title={isAr ? 'حفظ التأثير في المفضلة' : 'Save Effect to Favorites'}
                        >
                          <Star className={`w-3.5 h-3.5 ${isItemFavorited(favState, 'effect', effect.type) ? 'fill-amber-400' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleResetEffectParams(effect.id, e)}
                          className="p-1.5 text-slate-400 hover:text-amber-300 rounded-[6px] hover:bg-white/5 cursor-pointer"
                          title={isAr ? 'استعادة الافتراضي' : 'Reset'}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateEffect(effect.id, e)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-[6px] hover:bg-white/5 cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveEffect(effect.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-[6px] hover:bg-rose-950/30 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="p-1 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--app-accent-bright)]" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto', transition: PANEL_SPRING }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.14, ease: MODAL_EASE } }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 bg-[#191A1D] border-t border-white/[0.06] space-y-2.5 text-xs">
                            {/* Quick Effect Extremes & Full Reset Bar */}
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateParam(effect.id, 'mix', 0)}
                                className="py-1 px-2 rounded-[6px] bg-[#222326] hover:bg-[#2A2C32] border border-white/[0.06] text-[10.5px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                              >
                                {isAr ? 'أصغر نقطة (0%)' : 'Min (0%)'}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleResetEffectParams(effect.id, e)}
                                className="py-1 px-2 rounded-[6px] bg-[#222326] hover:bg-[#2A2C32] border border-white/[0.06] text-[10.5px] font-medium text-amber-300/90 hover:text-amber-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{isAr ? 'الافتراضي' : 'Default'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateParam(effect.id, 'mix', 100)}
                                className="py-1 px-2 rounded-[6px] bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] border border-[rgba(var(--app-accent-rgb),0.4)] text-[10.5px] font-semibold text-[var(--app-accent-bright)] transition-colors cursor-pointer"
                              >
                                {isAr ? 'أقصى قوة (100%)' : 'Max (100%)'}
                              </button>
                            </div>

                            {(effect.type === 'motionStars' || effect.type === 'starfield' || effect.type === 'spaceLines') && (
                              <div className="bg-[#222326] border border-cyan-400/20 rounded-[8px] p-2 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-cyan-300">
                                    {effect.type === 'spaceLines'
                                      ? isAr
                                        ? 'كمية الخطوط السريعة'
                                        : 'Quick Line Count'
                                      : isAr
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
            </div>
          ) : null}
        </motion.div>
      )}
      </AnimatePresence>
      </motion.div>
    </motion.div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
