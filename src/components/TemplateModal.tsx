import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  PanelRimSheen,
  backdropVariants,
  centerModalVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';
import { Project, Language } from '../types';
import { STARTER_TEMPLATES } from '../engine/templates';
import { loadFavoritesState, toggleFavoriteItem, isItemFavorited } from '../engine/favoritesStore';
import { loadCommunityTemplates, CommunityTemplateItem } from '../lib/firebase';
import { Sparkles, X, ArrowRight, Star, Globe, Loader2, RefreshCw, User as UserIcon } from 'lucide-react';

interface TemplateModalProps {
  lang: Language;
  onSelectTemplate: (project: Project) => void;
  onClose: () => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({ lang, onSelectTemplate, onClose }) => {
  const isAr = lang === 'ar';
  const [favVersion, setFavVersion] = useState(0);
  const [tab, setTab] = useState<'starter' | 'online'>('starter');
  const [communityTemplates, setCommunityTemplates] = useState<CommunityTemplateItem[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  useEffect(() => {
    const onFav = () => setFavVersion((v) => v + 1);
    window.addEventListener('sqmotion:favoritesChanged', onFav);
    return () => window.removeEventListener('sqmotion:favoritesChanged', onFav);
  }, []);

  const fetchCommunity = async () => {
    setLoadingOnline(true);
    setOnlineError(null);
    try {
      const items = await loadCommunityTemplates();
      setCommunityTemplates(items);
    } catch {
      setOnlineError(
        isAr
          ? 'تعذر جلب القوالب من الإنترنت. تحقق من اتصالك.'
          : 'Failed to load online community templates. Check connection.'
      );
    } finally {
      setLoadingOnline(false);
    }
  };

  useEffect(() => {
    if (tab === 'online' && communityTemplates.length === 0) {
      fetchCommunity();
    }
  }, [tab]);

  const favState = React.useMemo(() => loadFavoritesState(), [favVersion]);

  return (
    <motion.div
      key="template-modal-backdrop"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClose}
      style={AMBIENT_BACKDROP_STYLE}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none overflow-hidden gpu-layer"
    >
      <AmbientModalGlow />

      <motion.div
        key="template-modal-panel"
        variants={centerModalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        style={{
          willChange: 'transform, opacity',
          transform: 'translate3d(0,0,0)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(var(--app-accent-rgb), 0.1), inset 0 1px 1px rgba(255,255,255,0.2)',
        }}
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-[#0D0E13]/[0.98] border border-white/15 w-full max-w-xl rounded-[30px] p-5 sm:p-6 text-slate-200 text-xs relative overflow-hidden gpu-layer max-h-[86dvh] flex flex-col"
      >
        <PanelRimSheen roundedClass="rounded-t-[28px]" />

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 relative z-10 flex flex-col min-h-0 flex-1"
        >
          <motion.div
            variants={staggerItemVariants}
            className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--app-accent-bright)]" />
              <span className="text-sm font-black text-white">
                {isAr ? 'القوالب الجاهزة وقوالب الإنترنت' : 'Starter & Online Templates'}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-full active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>

          {/* Tabs: Starter vs Online Community */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#15171E] p-1 rounded-xl border border-white/10 flex-1">
              <button
                type="button"
                onClick={() => setTab('starter')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tab === 'starter'
                    ? 'bg-[rgba(var(--app-accent-rgb),0.2)] text-[var(--app-accent-bright)] border border-[rgba(var(--app-accent-rgb),0.45)]'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAr ? 'قوالب مدمجة' : 'Starter'}</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('online')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  tab === 'online'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/45'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{isAr ? 'قوالب المجتمع (أونلاين)' : 'Online Community'}</span>
              </button>
            </div>

            {tab === 'online' && (
              <button
                type="button"
                onClick={fetchCommunity}
                disabled={loadingOnline}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title={isAr ? 'تحديث' : 'Refresh'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOnline ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px]">
            {tab === 'starter' ? (
              <div className="grid grid-cols-1 gap-3">
                {STARTER_TEMPLATES.map((tmpl) => {
                  const isFav = isItemFavorited(favState, 'template', tmpl.id);
                  return (
                    <motion.div
                      key={tmpl.id}
                      variants={staggerItemVariants}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => onSelectTemplate(tmpl.project)}
                      className="p-4 bg-[#15171E]/90 hover:bg-[#1B1E28] border border-white/10 hover:border-[var(--app-accent-border)] rounded-2xl cursor-pointer transition-colors group flex items-center justify-between shadow-lg gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="font-bold text-slate-100 group-hover:text-[var(--app-accent-light)] text-sm block transition-colors truncate">
                          {isAr ? tmpl.nameAr : tmpl.name}
                        </span>
                        <p className="text-slate-400 text-xs">{isAr ? tmpl.descAr : tmpl.desc}</p>
                        <span className="text-[10px] font-mono text-[var(--app-accent-bright)] opacity-85 block tabular-nums">
                          {tmpl.project.settings.width}×{tmpl.project.settings.height} @ {tmpl.project.settings.fps} FPS
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteItem(favState, {
                              type: 'template',
                              refId: tmpl.id,
                              title: tmpl.name,
                              titleAr: tmpl.nameAr,
                              folderId: 'all',
                              payload: { templateId: tmpl.id },
                            });
                            window.dispatchEvent(new CustomEvent('sqmotion:favoritesChanged'));
                          }}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isFav ? 'text-amber-400 bg-amber-500/15' : 'text-slate-500 hover:text-amber-300 bg-white/5'
                          }`}
                          title={isAr ? 'تثبيت في المفضلة' : 'Favorite Template'}
                        >
                          <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                        </button>
                        <div className="p-2.5 bg-[var(--app-accent-surface)] group-hover:bg-[var(--app-accent-solid)] text-[var(--app-accent-bright)] group-hover:text-[var(--app-accent-contrast)] rounded-xl transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : loadingOnline ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="text-xs font-semibold">
                  {isAr ? 'جاري تحميل قوالب المجتمع من السحابة...' : 'Loading community templates from cloud...'}
                </span>
              </div>
            ) : onlineError ? (
              <div className="py-10 px-4 text-center space-y-2 bg-rose-950/30 border border-rose-500/30 rounded-2xl">
                <p className="text-rose-200 font-semibold">{onlineError}</p>
                <button
                  type="button"
                  onClick={fetchCommunity}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'إعادة المحاولة' : 'Retry'}
                </button>
              </div>
            ) : communityTemplates.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-1.5 bg-white/[0.03] border border-white/10 rounded-2xl">
                <Globe className="w-7 h-7 text-emerald-400/70 mx-auto" />
                <p className="text-slate-200 font-bold text-sm">
                  {isAr ? 'لا توجد قوالب منشورة حالياً' : 'No published templates yet'}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {isAr
                    ? 'افتح قائمة الحساب السحابي لنشر مشروعك الأول كمشاركة مجتمعية!'
                    : 'Open the Cloud Account menu to publish your project as a community template!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {communityTemplates.map((ct) => (
                  <div
                    key={ct.id}
                    onClick={() => {
                      const cloned: Project = {
                        ...JSON.parse(JSON.stringify(ct.project)),
                        id: `proj-${Date.now()}`,
                        selectedLayerId: null,
                        isPlaying: false,
                        updatedAt: Date.now(),
                      };
                      onSelectTemplate(cloned);
                    }}
                    className="p-4 bg-[#15171E]/90 hover:bg-[#1B1E28] border border-white/10 hover:border-emerald-400/45 rounded-2xl cursor-pointer transition-colors group flex items-center justify-between shadow-lg gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 group-hover:text-emerald-300 text-sm truncate">
                          {ct.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 inline-flex items-center gap-1 shrink-0">
                          <UserIcon className="w-2.5 h-2.5" />
                          {ct.authorName}
                        </span>
                      </div>
                      {ct.description && <p className="text-slate-400 text-xs line-clamp-2">{ct.description}</p>}
                      <span className="text-[10px] font-mono text-emerald-300/85 block tabular-nums">
                        {ct.project.settings.width}×{ct.project.settings.height} @ {ct.project.settings.fps} FPS • {ct.project.layers.length} {isAr ? 'طبقات' : 'layers'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-emerald-500/15 group-hover:bg-emerald-500 text-emerald-300 group-hover:text-black rounded-xl transition-colors shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
