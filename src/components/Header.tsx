import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Language, Layer, PreviewQuality } from '../types';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { LayerParentModal } from './LayerParentModal';
import { PANEL_SPRING, PanelRimSheen, dropdownVariants } from './MotionPrimitives';
import {
  Settings,
  ArrowRight,
  ArrowLeft,
  Trash2,
  MoreVertical,
  Link,
  Copy,
  LogOut,
  Check,
  Search,
  History,
  Star,
  Users,
  ClipboardCopy,
  Globe,
  User as UserIcon,
  Compass,
} from 'lucide-react';

interface HeaderProps {
  project: Project;
  lang: Language;
  onSetLang: (lang: Language) => void;
  onTogglePlay: () => void;
  onRewind: () => void;
  onOpenExport: () => void;
  onOpenTemplates: () => void;
  onSaveJSON: () => void;
  onLoadJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAddLayer: (type: any, customConfig?: any) => void;
  onOpenAddModal?: () => void;
  onUpdateSettings?: (settings: Project['settings']) => void;
  onToggleInspector?: () => void;
  showInspector?: boolean;
  onSelectLayer?: (id: string | null) => void;
  onDeleteLayer?: (id: string) => void;
  onDuplicateLayer?: (id: string) => void;
  onUpdateLayer?: (layer: Layer) => void;
  onBackToHome?: () => void;
  onDeleteProject?: () => void;
  onOpenSearch?: () => void;
  onOpenHistory?: () => void;
  onToggleQuickAccess?: () => void;
  isQuickAccessOpen?: boolean;
  onOpenCollab?: () => void;
  collabOnlineCount?: number;
  collabSyncStatus?: 'offline' | 'connecting' | 'synced' | 'syncing' | 'error';
  onOpenCopyPasteProps?: () => void;
  cloudUser?: { displayName?: string | null; email?: string | null } | null;
  onOpenCloudSync?: () => void;
  onOpenProfile?: () => void;
  onOpenSocial?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  lang,
  onOpenExport,
  onSaveJSON,
  onLoadJSON,
  onAddLayer,
  onUpdateSettings,
  onToggleInspector,
  showInspector,
  onSelectLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onUpdateLayer,
  onBackToHome,
  onDeleteProject,
  onOpenSearch,
  onOpenHistory,
  onToggleQuickAccess,
  isQuickAccessOpen = false,
  onOpenCollab,
  collabOnlineCount = 0,
  collabSyncStatus = 'offline',
  onOpenCopyPasteProps,
  cloudUser,
  onOpenCloudSync,
  onOpenProfile,
  onOpenSocial,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showNullLinkModal, setShowNullLinkModal] = useState<boolean>(false);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);

  const [previewQuality, setPreviewQuality] = useState<PreviewQuality>(() => {
    try {
      const saved = localStorage.getItem('sqmotion_preview_quality');
      if (saved === 'full' || saved === 'medium' || saved === 'low' || saved === 'auto') {
        return saved as PreviewQuality;
      }
    } catch {}
    return project.settings.previewQuality || 'auto';
  });

  useEffect(() => {
    const syncHandler = (e: Event) => {
      const detail = (e as CustomEvent<PreviewQuality>).detail;
      if (detail) setPreviewQuality(detail);
    };
    window.addEventListener('sqmotion:previewQualityChange', syncHandler);
    return () => window.removeEventListener('sqmotion:previewQualityChange', syncHandler);
  }, []);

  useEffect(() => {
    if (project.settings.previewQuality && project.settings.previewQuality !== previewQuality) {
      setPreviewQuality(project.settings.previewQuality);
    }
  }, [project.settings.previewQuality]);

  const handleSelectQuality = (q: PreviewQuality) => {
    setPreviewQuality(q);
    setShowQualityMenu(false);
    try {
      localStorage.setItem('sqmotion_preview_quality', q);
    } catch {}
    if (onUpdateSettings) {
      onUpdateSettings({ ...project.settings, previewQuality: q });
    }
    window.dispatchEvent(new CustomEvent<PreviewQuality>('sqmotion:previewQualityChange', { detail: q }));
  };

  const qualityBadgeLabel =
    previewQuality === 'full'
      ? 'FULL'
      : previewQuality === 'medium'
      ? 'MED'
      : previewQuality === 'low'
      ? 'LOW'
      : 'AUTO';

  const selectedLayer = project.layers.find((l) => l.id === project.selectedLayerId);

  // Selected Element Top Header (clean matte charcoal matching redesigned editor)
  if (selectedLayer && onSelectLayer) {
    return (
      <header
        dir="ltr"
        className="h-12 bg-[#090A0B] border-b border-white/[0.06] px-3 sm:px-4 flex items-center justify-between text-slate-200 select-none z-30 relative shrink-0"
      >
        <motion.div
          key="selected-layer-actions"
          initial={{ opacity: 0, x: -16, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={PANEL_SPRING}
          className="flex items-center gap-1.5 sm:gap-2"
        >
          <button
            type="button"
            onClick={() => onSelectLayer(null)}
            className="h-8 px-2.5 bg-[rgba(var(--app-accent-rgb),0.16)] hover:bg-[rgba(var(--app-accent-rgb),0.26)] border border-[rgba(var(--app-accent-rgb),0.4)] text-[var(--app-accent-bright)] rounded-[8px] transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95"
            title={lang === 'ar' ? 'الخروج من الطبقة' : 'Exit Layer'}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{lang === 'ar' ? 'خروج' : 'Exit'}</span>
          </button>

          {onDeleteLayer && (
            <button
              onClick={() => onDeleteLayer(selectedLayer.id)}
              className="p-2 text-slate-300 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer"
              title={lang === 'ar' ? 'حذف الطبقة' : 'Delete Layer'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {onDuplicateLayer && (
            <button
              onClick={() => onDuplicateLayer(selectedLayer.id)}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
              title={lang === 'ar' ? 'تكرار الطبقة' : 'Duplicate Layer'}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowNullLinkModal(!showNullLinkModal)}
              className={`p-2 rounded-lg transition-all flex items-center justify-center relative cursor-pointer ${
                showNullLinkModal
                  ? 'bg-[rgba(var(--app-accent-rgb),0.22)] text-[var(--app-accent-bright)] ring-1 ring-[rgba(var(--app-accent-rgb),0.5)]'
                  : selectedLayer.parentId
                  ? 'bg-[rgba(var(--app-accent-rgb),0.14)] text-[var(--app-accent-solid)] ring-1 ring-[rgba(var(--app-accent-rgb),0.4)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
              }`}
              title={
                selectedLayer.parentId
                  ? lang === 'ar'
                    ? 'الطبقة مربوطة (انقر للتعديل)'
                    : 'Layer is linked (Click to edit)'
                  : lang === 'ar'
                  ? 'ربط الطبقات (Parenting)'
                  : 'Link / Parent Layer'
              }
            >
              <Link className="w-4 h-4" />
              {selectedLayer.parentId && (
                <span className="w-2 h-2 rounded-full bg-[var(--app-accent-solid)] absolute top-1.5 right-1.5 ring-2 ring-[#090A0B]" />
              )}
            </button>

            <LayerParentModal
              isOpen={showNullLinkModal}
              onClose={() => setShowNullLinkModal(false)}
              selectedLayer={selectedLayer}
              layers={project.layers}
              lang={lang}
              onUpdateLayer={onUpdateLayer || (() => {})}
              onAddLayer={onAddLayer}
              onSelectLayer={onSelectLayer}
            />
          </div>

          {onOpenCopyPasteProps && (
            <button
              type="button"
              onClick={onOpenCopyPasteProps}
              className="p-2 text-slate-300 hover:text-[var(--app-accent-bright)] hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
              title={lang === 'ar' ? 'نسخ ولصق الخصائص' : 'Copy & Paste Properties'}
            >
              <ClipboardCopy className="w-4 h-4" />
            </button>
          )}
        </motion.div>

        <motion.div
          key="selected-layer-meta"
          initial={{ opacity: 0, x: 16, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={PANEL_SPRING}
          className="flex items-center gap-2"
        >
          <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate max-w-[160px] sm:max-w-[260px]">
            {selectedLayer.name || (lang === 'ar' ? 'طبقة' : 'Layer')}
          </span>
          <button
            onClick={() => {
              if (onToggleInspector) onToggleInspector();
            }}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
            title={lang === 'ar' ? 'الخصائص والمزيد' : 'Properties & More'}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </motion.div>
      </header>
    );
  }

  return (
    <header
      dir="ltr"
      className="h-12 bg-[#090A0B] px-3 sm:px-4 flex items-center justify-between gap-2.5 text-slate-200 select-none z-30 relative shrink-0"
    >
      {/* Left Cluster: Green Export Square + Settings Gear + AUTO Quality Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Themed Rounded-Square Export Button */}
        <button
          onClick={onOpenExport}
          className="w-8 h-8 rounded-[7px] bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] flex items-center justify-center shadow-sm transition-transform active:scale-95 cursor-pointer"
          title={lang === 'ar' ? 'تصدير المشهد' : 'Export Video'}
        >
          <svg
            className="w-[18px] h-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>

        {/* Project Settings Gear */}
        <button
          onClick={() => setShowSettingsModal(!showSettingsModal)}
          className="p-1 text-slate-200 hover:text-white transition-colors cursor-pointer active:scale-95"
          title={lang === 'ar' ? 'إعدادات المشروع' : 'Project Settings'}
        >
          <Settings className="w-[21px] h-[21px] stroke-[1.75]" />
        </button>

        {/* Themed Outlined Preview Quality Badge (AUTO / FULL / MED / LOW) */}
        <div className="relative">
          <button
            onClick={() => setShowQualityMenu((prev) => !prev)}
            className="min-w-[44px] text-center px-2 py-[2px] rounded-[5px] border border-[var(--app-accent-bright)] text-[var(--app-accent-bright)] hover:bg-[rgba(var(--app-accent-rgb),0.12)] font-mono text-[10px] font-bold tracking-wider transition-colors cursor-pointer active:scale-95 leading-tight"
            title={lang === 'ar' ? 'جودة المعاينة' : 'Preview Quality'}
          >
            {qualityBadgeLabel}
          </button>

          <AnimatePresence>
            {showQualityMenu && (
              <>
                <motion.div
                  key="quality-menu-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowQualityMenu(false)}
                />
                <motion.div
                  key="quality-menu-popover"
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className="absolute top-full mt-2 left-0 w-60 bg-[#141619]/[0.98] border border-white/10 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] p-1.5 z-50 overflow-hidden origin-top-left gpu-layer"
                >
                  <PanelRimSheen roundedClass="rounded-xl" />
                  <div className="relative z-10 px-2.5 py-1.5 mb-1 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200">
                    {lang === 'ar' ? 'جودة المعاينة' : 'Preview Quality'}
                  </span>
                  <span className="text-[10px] text-[var(--app-accent-bright)] font-mono">{project.settings.fps} FPS</span>
                </div>

                {(
                  [
                    {
                      id: 'auto' as PreviewQuality,
                      title: lang === 'ar' ? 'تلقائي (Auto)' : 'Auto',
                      tag: 'AUTO',
                      desc: lang === 'ar' ? 'سريع أثناء التشغيل ودقيق عند التوقف' : 'Adaptive during playback',
                    },
                    {
                      id: 'full' as PreviewQuality,
                      title: lang === 'ar' ? 'كاملة (Full)' : 'Full (100%)',
                      tag: '100%',
                      desc: lang === 'ar' ? 'دقة أصلية كاملة 1:1' : 'Full native resolution',
                    },
                    {
                      id: 'medium' as PreviewQuality,
                      title: lang === 'ar' ? 'متوسطة (Medium)' : 'Medium (50%)',
                      tag: '50%',
                      desc: lang === 'ar' ? 'توازن بين الأداء والوضوح' : 'Balanced speed & clarity',
                    },
                    {
                      id: 'low' as PreviewQuality,
                      title: lang === 'ar' ? 'منخفضة (Low)' : 'Low (25%)',
                      tag: '25%',
                      desc: lang === 'ar' ? 'أداء فائق للمشاهد الثقيلة' : 'Fastest preview performance',
                    },
                  ]
                ).map((item) => {
                  const active = previewQuality === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectQuality(item.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-start transition-colors cursor-pointer ${
                        active
                          ? 'bg-[rgba(var(--app-accent-rgb),0.16)] text-[var(--app-accent-bright)] border border-[rgba(var(--app-accent-rgb),0.45)]'
                          : 'text-slate-300 hover:bg-white/[0.05] border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold">{item.title}</span>
                          <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-white/[0.06] text-slate-300">
                            {item.tag}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">{item.desc}</span>
                      </div>
                      {active && <Check className="w-3.5 h-3.5 text-[var(--app-accent-bright)] shrink-0" />}
                    </button>
                  );
                })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Center-Right: Editable Project Title over subtle bottom underline rule */}
      <div className="flex-1 min-w-0 flex items-center justify-end border-b border-white/[0.14] pb-1 mx-1 sm:mx-2">
        <input
          type="text"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          value={project.settings.name || (lang === 'ar' ? 'مشروع جديد' : 'New Project')}
          onChange={(e) => {
            if (onUpdateSettings) {
              onUpdateSettings({ ...project.settings, name: e.target.value });
            }
          }}
          className="w-full max-w-[200px] sm:max-w-[260px] bg-transparent text-right text-[13px] font-medium text-slate-200 placeholder-slate-500 focus:outline-none focus:text-white truncate"
        />
      </div>

      {/* Far-Right: Workspace System Tools + Exit Button */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer active:scale-95"
            title={lang === 'ar' ? 'بحث متقدم (Ctrl+K)' : 'Advanced Search (Ctrl+K)'}
          >
            <Search className="w-[17px] h-[17px]" />
          </button>
        )}

        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer active:scale-95"
            title={lang === 'ar' ? 'السجل والإصدارات' : 'History & Versions'}
          >
            <History className="w-[17px] h-[17px]" />
          </button>
        )}

        {onToggleQuickAccess && (
          <button
            type="button"
            onClick={onToggleQuickAccess}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
              isQuickAccessOpen
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                : 'text-slate-300 hover:text-amber-300 hover:bg-white/[0.07]'
            }`}
            title={lang === 'ar' ? 'المفضلة والوصول السريع' : 'Favorites & Quick Access'}
          >
            <Star className={`w-[17px] h-[17px] ${isQuickAccessOpen ? 'fill-amber-300' : ''}`} />
          </button>
        )}

        {onOpenCollab && (
          <button
            type="button"
            onClick={onOpenCollab}
            className={`relative h-8 px-2 rounded-lg flex items-center gap-1 transition-colors cursor-pointer active:scale-95 ${
              collabSyncStatus === 'synced' || collabSyncStatus === 'syncing'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.07]'
            }`}
            title={lang === 'ar' ? 'التعاون الجماعي' : 'Collaborative Workspace'}
          >
            <Users className="w-[17px] h-[17px]" />
            {collabOnlineCount > 0 && (
              <span className="text-[10px] font-mono font-bold tabular-nums">{collabOnlineCount}</span>
            )}
          </button>
        )}

        {onOpenSocial && (
          <button
            type="button"
            onClick={onOpenSocial}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer active:scale-95"
            title={lang === 'ar' ? 'المجتمع، القنوات والفيديوهات' : 'Community, Channels & Videos'}
          >
            <Compass className="w-[17px] h-[17px]" />
          </button>
        )}

        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer active:scale-95"
            title={lang === 'ar' ? 'الملف الشخصي' : 'Creator Profile'}
          >
            <UserIcon className="w-[17px] h-[17px]" />
          </button>
        )}

        {onOpenCloudSync && (
          <button
            type="button"
            onClick={onOpenCloudSync}
            className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
              cloudUser
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/35'
                : 'text-slate-300 hover:text-[var(--app-accent-bright)] hover:bg-white/[0.07]'
            }`}
            title={
              cloudUser
                ? lang === 'ar'
                  ? `السحابة متصلة (${cloudUser.displayName || cloudUser.email || ''})`
                  : `Cloud Synced (${cloudUser.displayName || cloudUser.email || ''})`
                : lang === 'ar'
                ? 'الحساب السحابي والإنترنت'
                : 'Cloud Account & Internet'
            }
          >
            <Globe className="w-[17px] h-[17px]" />
          </button>
        )}

        {/* Hidden desktop .sq project import shortcut */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={onLoadJSON}
          accept=".sq"
          className="hidden"
        />
        {onBackToHome ? (
          <button
            onClick={onBackToHome}
            className="p-1 text-slate-200 hover:text-white transition-colors cursor-pointer active:scale-95 ml-0.5"
            title={lang === 'ar' ? 'العودة للمشاريع' : 'Exit to Projects'}
          >
            <LogOut className="w-[21px] h-[21px] stroke-[1.8]" />
          </button>
        ) : (
          <button
            onClick={onSaveJSON}
            className="p-1 text-slate-200 hover:text-white transition-colors cursor-pointer ml-0.5"
            title={lang === 'ar' ? 'حفظ' : 'Save'}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Project Settings Bottom Sheet Modal */}
      <AnimatePresence>
        {showSettingsModal && onUpdateSettings && (
          <ProjectSettingsModal
            project={project}
            lang={lang}
            onUpdateSettings={onUpdateSettings}
            onDeleteProject={onDeleteProject}
            onOpenExport={onOpenExport}
            onOpenHistory={onOpenHistory}
            onOpenCollab={onOpenCollab}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </AnimatePresence>
    </header>
  );
};
