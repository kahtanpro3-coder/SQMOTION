import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../types';
import {
  Search,
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import {
  ALIGHT_EFFECTS_FULL_CATALOG,
  CATEGORIES_LIST,
  AlightEffectItem,
  CategoryDefinition,
} from '../data/alightEffectsCatalog';
import { EffectPortraitThumbnail } from './EffectPortraitThumbnail';
import { EFFECTS_PREVIEW_PORTRAIT_URL } from '../utils/effectThumbnailRenderer';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  MODAL_EASE,
  PanelRimSheen,
  VIEW_SPRING,
  backdropVariants,
  fullScreenModalVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

export { ALIGHT_EFFECTS_FULL_CATALOG, CATEGORIES_LIST };
export type { AlightEffectItem, CategoryDefinition };

interface AlightEffectsBrowserModalProps {
  lang: Language;
  onSelectEffect: (effect: AlightEffectItem) => void;
  onClose: () => void;
}

export const AlightEffectsBrowserModal: React.FC<AlightEffectsBrowserModalProps> = ({
  lang,
  onSelectEffect,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const allCategoriesFlat: CategoryDefinition[] = [
    ...CATEGORIES_LIST.left,
    ...CATEGORIES_LIST.right,
  ];

  const renderThumbnail = (eff: AlightEffectItem) => (
    <EffectPortraitThumbnail
      effectId={eff.id}
      color={eff.color}
      params={eff.defaultParams}
      alt={lang === 'ar' ? eff.nameAr : eff.nameEn}
      className="w-full h-full object-cover"
    />
  );

  const topFive = ALIGHT_EFFECTS_FULL_CATALOG.slice(0, 5);
  const miniGrid = ALIGHT_EFFECTS_FULL_CATALOG.slice(5, 13);

  // Filter logic
  const filteredBySearch = searchQuery.trim()
    ? ALIGHT_EFFECTS_FULL_CATALOG.filter((eff) => {
        const q = searchQuery.toLowerCase();
        return (
          eff.nameAr.toLowerCase().includes(q) ||
          eff.nameEn.toLowerCase().includes(q) ||
          eff.descriptionAr.toLowerCase().includes(q) ||
          eff.descriptionEn.toLowerCase().includes(q) ||
          eff.category.toLowerCase().includes(q)
        );
      })
    : [];

  const activeCategoryList =
    selectedCategoryId === 'all'
      ? ALIGHT_EFFECTS_FULL_CATALOG
      : ALIGHT_EFFECTS_FULL_CATALOG.filter((e) => e.category === selectedCategoryId);

  const selectedCategoryObj = allCategoriesFlat.find((c) => c.id === selectedCategoryId);

  const modalContent = (
    <motion.div
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={AMBIENT_BACKDROP_STYLE}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[80] w-screen h-[100dvh] backdrop-blur-md flex flex-col select-none text-slate-200 font-sans overflow-hidden gpu-layer"
    >
      <AmbientModalGlow />
      <motion.div
        variants={fullScreenModalVariants}
        className="relative z-10 flex-1 flex flex-col min-h-0 bg-[#0A0B0F]/[0.98] overflow-hidden gpu-layer"
      >
        <PanelRimSheen roundedClass="rounded-none" />
        {/* 1. TOP APP BAR (Search Icon, Title, Badge, Close Icon) */}
        <div className="relative z-10 h-12 bg-[#0F1117] border-b border-white/[0.07] px-3 sm:px-4 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[rgba(var(--app-accent-rgb),0.15)] border border-[rgba(var(--app-accent-rgb),0.32)] flex items-center justify-center text-[var(--app-accent-bright)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
              <span>{lang === 'ar' ? 'متصفح التأثيرات' : 'Effect Browser'}</span>
              <span className="px-2 py-0.5 rounded-full bg-[rgba(var(--app-accent-rgb),0.15)] text-[var(--app-accent-bright)] text-[10px] font-mono font-bold">
                {ALIGHT_EFFECTS_FULL_CATALOG.length}
              </span>
            </h1>
          </div>
        </div>

        {/* Close Button 'X' */}
        <button
          onClick={onClose}
          className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          title={lang === 'ar' ? 'إغلاق' : 'Close'}
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 2. SEARCH BAR & QUICK STATS */}
      <div className="px-3 sm:px-4 py-2 bg-[#0C0E14] border-b border-white/[0.06] shrink-0">
        <div className="relative flex items-center">
          <Search className={`w-4 h-4 text-slate-400 absolute ${lang === 'ar' ? 'right-3' : 'left-3'} pointer-events-none`} />
          <input
            id="alight-effect-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? `ابحث في ${ALIGHT_EFFECTS_FULL_CATALOG.length} تأثير (كروما، ضبابي، توهج، تكرار البلاط، تشويه، 3D)...`
                : `Search ${ALIGHT_EFFECTS_FULL_CATALOG.length} effects (chroma, blur, glow, tiles, wave, 3D)...`
            }
            className={`w-full bg-[#151821] border border-white/[0.08] rounded-xl py-2 ${
              lang === 'ar' ? 'pr-9 pl-8' : 'pl-9 pr-8'
            } text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-[var(--app-accent-bright)] transition-colors shadow-inner`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute ${lang === 'ar' ? 'left-3' : 'right-3'} text-slate-400 hover:text-white text-xs font-bold`}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. HORIZONTAL CATEGORY CHIPS SCROLLER */}
      {!searchQuery && (
        <div className="px-3 sm:px-4 py-1.5 bg-[#0A0C11] border-b border-white/[0.06] overflow-x-auto scrollbar-none flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setSelectedCategoryId('all')}
            style={
              selectedCategoryId === 'all'
                ? { boxShadow: '0 0 12px rgba(var(--app-accent-rgb), 0.4)' }
                : undefined
            }
            className={`px-3 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)]'
                : 'bg-[#141720] text-slate-300 hover:bg-[#1C202B] border border-white/[0.07]'
            }`}
          >
            {lang === 'ar' ? `الكل (${ALIGHT_EFFECTS_FULL_CATALOG.length})` : `All (${ALIGHT_EFFECTS_FULL_CATALOG.length})`}
          </button>

          {allCategoriesFlat.map((cat) => {
            const count = ALIGHT_EFFECTS_FULL_CATALOG.filter((e) => e.category === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                style={
                  isSelected
                    ? { boxShadow: '0 0 12px rgba(var(--app-accent-rgb), 0.4)' }
                    : undefined
                }
                className={`px-3 py-1 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  isSelected
                    ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)]'
                    : 'bg-[#141720] text-slate-300 hover:bg-[#1C202B] border border-white/[0.07]'
                }`}
              >
                {lang === 'ar' ? `${cat.nameAr} (${count})` : `${cat.nameEn} (${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. MAIN CONTENT BODY */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-4">
        <AnimatePresence mode="popLayout" initial={false}>
        {/* CASE A: LIVE SEARCH ACTIVE */}
        {searchQuery.trim() !== '' ? (
          <motion.div
            key="browser-search"
            variants={staggerFastContainerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-[var(--app-accent-bright)]">
                {lang === 'ar'
                  ? `نتائج البحث (${filteredBySearch.length})`
                  : `Search Results (${filteredBySearch.length})`}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {searchQuery}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredBySearch.map((eff) => (
                <button
                  key={eff.id}
                  onClick={() => {
                    onSelectEffect(eff);
                    onClose();
                  }}
                  className="p-3 bg-[#151820] hover:bg-[#1D212C] border border-white/[0.08] hover:border-[rgba(var(--app-accent-bright-rgb),0.8)] rounded-2xl flex items-center gap-3 text-right transition-all group active:scale-[0.98] shadow-lg text-start"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md">
                    {renderThumbnail(eff)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-black text-white group-hover:text-[var(--app-accent-light)] truncate">
                        {lang === 'ar' ? eff.nameAr : eff.nameEn}
                      </h4>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono shrink-0">
                        {eff.category}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {lang === 'ar' ? eff.descriptionAr : eff.descriptionEn}
                    </p>
                  </div>
                </button>
              ))}

              {filteredBySearch.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-500 text-xs space-y-2">
                  <p className="text-slate-400 font-bold">
                    {lang === 'ar' ? 'لم يتم العثور على أي تأثير مطابق' : 'No matching effects found'}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {lang === 'ar' ? 'جرب البحث باسم آخر مثل: كروما، ضبابي، 3D، توهج، تكرار' : 'Try searching for: blur, chroma, 3D, glow, tiles, wave'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        ) : selectedCategoryId !== 'all' ? (
          /* CASE B: SPECIFIC CATEGORY SELECTED */
          <motion.div
            key={`browser-cat-${selectedCategoryId}`}
            variants={staggerFastContainerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className="flex items-center gap-1.5 text-xs font-black text-[var(--app-accent-bright)] hover:text-[var(--app-accent-light)] bg-[rgba(var(--app-accent-rgb),0.1)] px-2.5 py-1 rounded-xl border border-[rgba(var(--app-accent-rgb),0.22)]"
              >
                {lang === 'ar' ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                <span>{lang === 'ar' ? 'جميع الأقسام' : 'All Categories'}</span>
              </button>

              <span className="text-xs font-bold text-slate-300">
                {selectedCategoryObj ? (lang === 'ar' ? selectedCategoryObj.nameAr : selectedCategoryObj.nameEn) : ''} ({activeCategoryList.length})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {activeCategoryList.map((eff) => (
                <button
                  key={eff.id}
                  onClick={() => {
                    onSelectEffect(eff);
                    onClose();
                  }}
                  className="p-3 bg-[#151820] hover:bg-[#1D212C] border border-white/[0.08] hover:border-[rgba(var(--app-accent-bright-rgb),0.8)] rounded-2xl flex items-center gap-3 text-start transition-all group active:scale-[0.98] shadow-lg"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md">
                    {renderThumbnail(eff)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-white group-hover:text-[var(--app-accent-light)] truncate">
                      {lang === 'ar' ? eff.nameAr : eff.nameEn}
                    </h4>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {lang === 'ar' ? eff.descriptionAr : eff.descriptionEn}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          /* CASE C: DEFAULT OVERVIEW (Main Portrait Header + Top Featured Carousel + 12 Rich Category Cards) */
          <motion.div
            key="browser-overview"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: VIEW_SPRING }}
            exit={{ opacity: 0, scale: 0.96, y: -10, transition: { duration: 0.14, ease: MODAL_EASE } }}
            className="space-y-5 gpu-layer"
          >
            {/* Main Reference Portrait Card */}
            <div className="p-2.5 rounded-2xl bg-[#151820] border border-white/[0.08] flex items-center gap-3">
              <img
                src={EFFECTS_PREVIEW_PORTRAIT_URL}
                alt={lang === 'ar' ? 'الصورة الرئيسية للمؤثرات' : 'Main Effects Portrait'}
                className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
                draggable={false}
              />
              <div className="min-w-0">
                <div className="text-xs font-black text-white truncate">
                  {lang === 'ar' ? 'الصورة الرئيسية لمعاينة التأثيرات' : 'Main Effect Preview Portrait'}
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                  {lang === 'ar' ? 'كل تأثير يعرض نتيجته المباشرة على هذه الصورة' : 'Each card previews its real effect on this image'}
                </p>
              </div>
            </div>

            {/* 1. TOP 5 FEATURED HERO CARDS */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-black text-[var(--app-accent-bright)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'أبرز التأثيرات الشائعة' : 'Featured Essentials'}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {lang === 'ar' ? 'الأكثر استخداماً' : 'Most Popular'}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {topFive.map((eff) => (
                  <button
                    key={eff.id}
                    onClick={() => {
                      onSelectEffect(eff);
                      onClose();
                    }}
                    className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
                  >
                    <div className="w-full aspect-square rounded-2xl overflow-hidden border border-white/15 group-hover:border-[var(--app-accent-bright)] shadow-lg bg-[#161922] transition-colors">
                      {renderThumbnail(eff)}
                    </div>
                    <span className="text-[9.5px] sm:text-[10.5px] font-extrabold text-slate-200 text-center leading-tight line-clamp-2 group-hover:text-[var(--app-accent-light)]">
                      {lang === 'ar' ? eff.nameAr : eff.nameEn}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. MINI POPULAR GRID */}
            <div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1 pb-1">
                {miniGrid.map((eff) => (
                  <button
                    key={eff.id}
                    onClick={() => {
                      onSelectEffect(eff);
                      onClose();
                    }}
                    className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-white/10 group-hover:border-[var(--app-accent-bright)] shadow-md bg-[#161922] transition-colors">
                      {renderThumbnail(eff)}
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 text-center leading-tight line-clamp-1 group-hover:text-[var(--app-accent-light)]">
                      {lang === 'ar' ? eff.nameAr : eff.nameEn}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. THE 12 ALIGHT MOTION CATEGORY BANNERS WITH COUNTS */}
            <div>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[var(--app-accent-bright)]" />
                  <span>{lang === 'ar' ? 'تصفح حسب القسم (12 فئة)' : 'Browse by Category (12 Groups)'}</span>
                </span>
                <span className="text-[10px] text-[var(--app-accent-bright)] font-bold font-mono">
                  {ALIGHT_EFFECTS_FULL_CATALOG.length} {lang === 'ar' ? 'تأثير' : 'effects'}
                </span>
              </div>

              <motion.div
                variants={staggerFastContainerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
              >
                {allCategoriesFlat.map((cat) => {
                  const count = ALIGHT_EFFECTS_FULL_CATALOG.filter((e) => e.category === cat.id).length;
                  return (
                    <motion.button
                      key={cat.id}
                      variants={staggerItemVariants}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`h-14 sm:h-16 rounded-2xl bg-gradient-to-r ${cat.gradient} border border-white/10 hover:border-[rgba(var(--app-accent-bright-rgb),0.7)] shadow-lg flex flex-col items-center justify-center p-2 text-center transition-colors group relative overflow-hidden cursor-pointer`}
                    >
                      <div className="absolute inset-0 bg-white/[0.03] group-hover:bg-white/[0.08] transition-colors" />
                      <span className="relative z-10 text-xs sm:text-sm font-black text-white drop-shadow group-hover:text-[var(--app-accent-light)] transition-colors">
                        {lang === 'ar' ? cat.nameAr : cat.nameEn}
                      </span>
                      <span className="relative z-10 text-[9px] sm:text-[10px] font-mono text-slate-300/80 font-bold">
                        {count} {lang === 'ar' ? 'تأثير' : 'effects'}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
