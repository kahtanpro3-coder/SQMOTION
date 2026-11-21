import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings,
  MoreVertical,
  Clock,
  Video,
  Layers,
  FolderPlus,
  Plus,
  ChevronRight,
  Trash2,
  Copy,
  Edit3,
  Download,
  FolderOpen,
  Globe,
  User as UserIcon,
  MessageCircle,
  UserPlus,
  Film,
  Bell,
  ShieldCheck,
} from 'lucide-react';
import type { SocialTabId } from './SocialCommunityModal';
import type { FirebaseUser } from '../lib/firebase';
import { Project, Language } from '../types';
import { downloadProjectSQ } from '../engine/exporter';
import { NewProjectModal } from './NewProjectModal';
import { SettingsView } from './SettingsView';
import { VioletEnergyWavesBackdrop } from './VioletEnergyWavesBackdrop';
import {
  AppSettings,
  THEME_PALETTES,
  loadAppSettings,
  saveAppSettings,
} from '../utils/appSettings';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  MODAL_EASE,
  PanelRimSheen,
  PILL_SPRING,
  VIEW_SPRING,
  backdropVariants,
  centerModalVariants,
  dropdownVariants,
  staggerContainerVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface HomeScreenProps {
  lang: Language;
  onSetLang: (lang: Language) => void;
  onOpenProject: (proj: Project) => void;
  onCreateNewProject: (settings: {
    name: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    backgroundColor: string;
  }) => void;
  onImportProject?: (proj: Project) => void;
  savedProjects: Project[];
  onDeleteProject?: (id: string) => void;
  onDuplicateProject?: (proj: Project) => void;
  cloudUser?: FirebaseUser | null;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onOpenCloudSync?: () => void;
  onOpenProfile?: () => void;
  onOpenSocial?: (tab?: SocialTabId) => void;
}

const ProjectThumbnail: React.FC<{ proj: Project; accentColor: string }> = ({
  proj,
  accentColor,
}) => {
  const [imgError, setImgError] = useState(false);

  const imageLayer = proj.layers.find((l) => l.type === 'image' && l.mediaUrl);
  const textLayer = proj.layers.find((l) => l.type === 'text' && l.textConfig?.text);
  const vectorLayer = proj.layers.find((l) => l.type === 'vector' && l.vectorConfig);

  const bg = proj.settings.backgroundColor;
  const isTransparent = !bg || bg === '#00000000' || bg === 'transparent';

  if (imageLayer?.mediaUrl && !imgError) {
    return (
      <div className="w-[74px] h-[46px] sm:w-[82px] sm:h-[50px] rounded-xl overflow-hidden shrink-0 border border-white/15 bg-[#090B10] relative">
        <img
          src={imageLayer.mediaUrl}
          alt={proj.settings.name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
      </div>
    );
  }

  if (textLayer?.textConfig?.text) {
    return (
      <div
        className="w-[74px] h-[46px] sm:w-[82px] sm:h-[50px] rounded-xl overflow-hidden shrink-0 border border-white/15 flex items-center justify-center p-1.5 relative"
        style={{
          backgroundColor: isTransparent ? '#0B0D14' : bg,
        }}
      >
        <span
          className="text-[10px] font-black leading-tight truncate max-w-full drop-shadow"
          style={{ color: textLayer.textConfig.fill || '#FFFFFF' }}
        >
          {textLayer.textConfig.text}
        </span>
      </div>
    );
  }

  if (vectorLayer?.vectorConfig) {
    const fill = vectorLayer.vectorConfig.fill || accentColor;
    return (
      <div
        className="w-[74px] h-[46px] sm:w-[82px] sm:h-[50px] rounded-xl overflow-hidden shrink-0 border border-white/15 flex items-center justify-center relative"
        style={{
          backgroundColor: isTransparent ? '#0B0D14' : bg,
        }}
      >
        <svg viewBox="0 0 36 24" className="w-7 h-5 drop-shadow">
          {vectorLayer.vectorConfig.type === 'circle' ? (
            <circle cx="18" cy="12" r="7" fill={fill} />
          ) : vectorLayer.vectorConfig.type === 'rect' ? (
            <rect x="10" y="5" width="16" height="14" rx="3" fill={fill} />
          ) : (
            <polygon points="18,4 28,15 18,20 8,15" fill={fill} />
          )}
        </svg>
      </div>
    );
  }

  if (isTransparent) {
    return (
      <div
        className="w-[74px] h-[46px] sm:w-[82px] sm:h-[50px] rounded-xl overflow-hidden shrink-0 border border-white/12 relative"
        style={{
          backgroundColor: '#171920',
          backgroundImage:
            'linear-gradient(45deg, #2a2e39 25%, transparent 25%), linear-gradient(-45deg, #2a2e39 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2e39 75%), linear-gradient(-45deg, transparent 75%, #2a2e39 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
        }}
      />
    );
  }

  return (
    <div
      className="w-[74px] h-[46px] sm:w-[82px] sm:h-[50px] rounded-xl overflow-hidden shrink-0 border border-white/15 flex items-center justify-center"
      style={{ backgroundColor: bg }}
    >
      {proj.layers.length > 0 && <div className="w-3 h-3 rounded-full bg-white/25" />}
    </div>
  );
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  lang,
  onSetLang,
  onOpenProject,
  onCreateNewProject,
  onImportProject,
  savedProjects,
  onDeleteProject,
  onDuplicateProject,
  cloudUser,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onOpenCloudSync,
  onOpenProfile,
  onOpenSocial,
}) => {
  const [subScreen, setSubScreen] = useState<'projects' | 'settings'>('projects');
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());
  const [selectedProjectMenu, setSelectedProjectMenu] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const palette = THEME_PALETTES[appSettings.theme] || THEME_PALETTES.violet;

  // Close open project context menu when clicking outside
  useEffect(() => {
    if (!selectedProjectMenu) return;
    const handleOutside = () => setSelectedProjectMenu(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [selectedProjectMenu]);

  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail;
      if (detail) setAppSettings(detail);
    };
    window.addEventListener('sqmotion-settings-changed', onSettingsChanged);
    return () => window.removeEventListener('sqmotion-settings-changed', onSettingsChanged);
  }, []);

  const handleUpdateAppSettings = (next: AppSettings) => {
    setAppSettings(next);
    saveAppSettings(next);
  };

  const showToast = (text: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage({ text, tone });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3000);
  };

  const formatDurationString = (frames: number, fps: number) => {
    const totalSecs = Math.max(0, Math.floor((frames || 0) / (fps || 30)));
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  };

  const sortedProjects = [...savedProjects].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.sq')) {
      showToast(
        lang === 'ar'
          ? 'يرجى اختيار ملف مشروع بصيغة .sq فقط'
          : 'Please select a .sq project file only',
        'error'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as Project;
        if (!parsed || !parsed.settings || !Array.isArray(parsed.layers)) {
          throw new Error('Invalid project schema');
        }
        const importedProject: Project = {
          ...parsed,
          id: `proj-${Date.now()}`,
          updatedAt: Date.now(),
          isPlaying: false,
          selectedLayerId: null,
        };
        if (onImportProject) {
          onImportProject(importedProject);
        } else {
          onOpenProject(importedProject);
        }
      } catch {
        showToast(
          lang === 'ar'
            ? 'تعذر استيراد الملف — يرجى اختيار ملف مشروع .sq صالح'
            : 'Could not import file — please select a valid .sq project',
          'error'
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05060A]">
    <AnimatePresence initial={false}>
      {subScreen === 'settings' ? (
        <motion.div
          key="subscreen-settings"
          initial={{ opacity: 0, x: -72, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1, transition: VIEW_SPRING }}
          exit={{ opacity: 0, x: -48, scale: 0.95, transition: { duration: 0.16, ease: MODAL_EASE } }}
          className="fixed inset-0 h-screen w-screen overflow-hidden gpu-layer z-20"
        >
          <SettingsView
            lang={lang}
            onSetLang={onSetLang}
            settings={appSettings}
            onUpdateSettings={handleUpdateAppSettings}
            onBack={() => setSubScreen('projects')}
          />
        </motion.div>
      ) : (
        <motion.div
          key="subscreen-projects"
          initial={{ opacity: 0, scale: 0.93, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: VIEW_SPRING }}
          exit={{ opacity: 0, scale: 0.95, y: -12, transition: { duration: 0.16, ease: MODAL_EASE } }}
          className="fixed inset-0 w-full h-screen bg-[#05060A] text-white flex flex-col overflow-hidden select-none font-['Cairo',sans-serif] gpu-layer z-10"
        >
          <VioletEnergyWavesBackdrop theme={appSettings.theme} />

          {/* ================= TOP HEADER (Folder + Title on Left, Settings Hex Button on Right) ================= */}
          <motion.header
            dir="ltr"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={VIEW_SPRING}
            className="relative z-20 shrink-0 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-4"
          >
            {/* Left Group: Stylized Glass Folder-Play Icon + مشاريعي */}
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Glowing Themed Glass Folder + Play Emblem */}
              <div className="relative w-14 h-12 shrink-0 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-2xl blur-xl opacity-60"
                  style={{ backgroundColor: palette.primary }}
                />
                {/* Orbital ring accent */}
                <svg
                  viewBox="0 0 64 54"
                  className="relative w-14 h-12"
                  style={{ filter: `drop-shadow(0 6px 18px ${palette.glow})` }}
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="folderBack" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.95" />
                      <stop offset="100%" stopColor={palette.deep} stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="folderFront" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={palette.bright} stopOpacity="0.52" />
                      <stop offset="50%" stopColor={palette.primary} stopOpacity="0.45" />
                      <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.58" />
                    </linearGradient>
                  </defs>
                  {/* Orbit ellipse */}
                  <ellipse
                    cx="32"
                    cy="29"
                    rx="28"
                    ry="13"
                    transform="rotate(-14 32 29)"
                    fill="none"
                    stroke={palette.primary}
                    strokeOpacity="0.45"
                    strokeWidth="1.2"
                  />
                  {/* Folder back tab */}
                  <path
                    d="M8,15 C8,11.5 10.8,9 14.2,9 L24,9 L28,13.5 L48,13.5 C51.5,13.5 54,16 54,19.5 L54,39 C54,42.5 51.5,45 48,45 L14,45 C10.7,45 8,42.5 8,39 Z"
                    fill="url(#folderBack)"
                    stroke={palette.bright}
                    strokeOpacity="0.45"
                    strokeWidth="1"
                  />
                  {/* Frosted front flap */}
                  <rect
                    x="11"
                    y="16"
                    width="45"
                    height="29"
                    rx="7"
                    fill="url(#folderFront)"
                    stroke={palette.light}
                    strokeOpacity="0.55"
                    strokeWidth="1.1"
                  />
                  {/* Play triangle */}
                  <path
                    d="M29,24.5 L39.5,30.5 L29,36.5 Z"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.1"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Title & Subtitle */}
              <div className="min-w-0 text-left">
                <h1 className="text-2xl sm:text-[28px] font-black text-white leading-none tracking-tight">
                  {lang === 'ar' ? 'مشاريعي' : 'My Projects'}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
                  {lang === 'ar'
                    ? 'كل مشاريعك في مكان واحد'
                    : 'All your projects in one place'}
                </p>
              </div>
            </div>

            {/* Right Controls: Notifications Bell + Creator Profile + Cloud/Internet Sync + Settings Gear */}
            <div className="flex items-center gap-2 shrink-0">
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="relative min-w-[44px] min-h-[44px] w-11 h-11 rounded-2xl bg-[#0D1018]/85 hover:bg-[#151A26] border flex items-center justify-center text-white transition-all cursor-pointer shrink-0 active:scale-95"
                  style={{
                    borderColor: unreadNotificationsCount > 0 ? 'rgba(254,44,85,0.65)' : palette.border,
                    boxShadow:
                      unreadNotificationsCount > 0
                        ? '0 0 18px rgba(254,44,85,0.35), inset 0 1px 0 rgba(255,255,255,0.12)'
                        : `0 0 18px ${palette.glow}38, inset 0 1px 0 rgba(255,255,255,0.12)`,
                  }}
                  aria-label={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
                  title={lang === 'ar' ? 'الإشعارات' : 'Notifications'}
                >
                  <Bell className="w-5 h-5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-[#FE2C55] text-white text-[10px] font-black flex items-center justify-center font-mono tabular-nums shadow">
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>
              )}

              {onOpenProfile && (
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="relative min-w-[44px] min-h-[44px] px-2.5 sm:px-3 h-11 rounded-2xl bg-[#0D1018]/85 hover:bg-[#151A26] border flex items-center justify-center gap-2 text-white transition-all cursor-pointer shrink-0 active:scale-95"
                  style={{
                    borderColor: palette.border,
                    boxShadow: `0 0 18px ${palette.glow}38, inset 0 1px 0 rgba(255,255,255,0.12)`,
                  }}
                  aria-label={lang === 'ar' ? 'الملف الشخصي' : 'Profile'}
                  title={lang === 'ar' ? 'الملف الشخصي' : 'Profile'}
                >
                  {cloudUser?.photoURL ? (
                    <img
                      src={cloudUser.photoURL}
                      alt={cloudUser.displayName || 'Profile'}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-lg object-cover border border-white/20 shrink-0"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 shrink-0" style={{ color: palette.bright }} />
                  )}
                  <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">
                    {lang === 'ar' ? 'الملف الشخصي' : 'Profile'}
                  </span>
                </button>
              )}

              {onOpenCloudSync && (
                <button
                  type="button"
                  onClick={onOpenCloudSync}
                  className="relative min-w-[44px] min-h-[44px] px-2.5 sm:px-3 h-11 rounded-2xl bg-[#0D1018]/85 hover:bg-[#151A26] border flex items-center justify-center gap-1.5 text-white transition-all cursor-pointer shrink-0 active:scale-95"
                  style={{
                    borderColor: cloudUser ? 'rgba(52,211,153,0.45)' : palette.border,
                    boxShadow: cloudUser
                      ? '0 0 16px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,255,255,0.12)'
                      : `0 0 18px ${palette.glow}44, inset 0 1px 0 rgba(255,255,255,0.12)`,
                  }}
                  aria-label={lang === 'ar' ? 'السحابة والإنترنت' : 'Cloud & Internet'}
                  title={lang === 'ar' ? 'السحابة والإنترنت' : 'Cloud & Internet'}
                >
                  <Globe className={`w-4 h-4 ${cloudUser ? 'text-emerald-400' : 'text-[var(--app-accent-bright)]'}`} />
                  <span className="hidden md:inline text-xs font-bold whitespace-nowrap">
                    {cloudUser
                      ? (cloudUser.displayName?.split(' ')[0] || (lang === 'ar' ? 'متصل' : 'Synced'))
                      : (lang === 'ar' ? 'سحابي' : 'Cloud')}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSubScreen('settings')}
                className="relative min-w-[44px] min-h-[44px] w-11 h-11 rounded-2xl bg-[#0D1018]/85 hover:bg-[#151A26] border flex items-center justify-center text-white transition-all cursor-pointer shrink-0 active:scale-95"
                style={{
                  borderColor: palette.border,
                  boxShadow: `0 0 18px ${palette.glow}44, inset 0 1px 0 rgba(255,255,255,0.12)`,
                }}
                aria-label={lang === 'ar' ? 'الإعدادات' : 'Settings'}
                title={lang === 'ar' ? 'الإعدادات' : 'Settings'}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </motion.header>

          {/* ================= INLINE TOAST (NO WINDOW.ALERT) ================= */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative z-30 max-w-2xl w-full mx-auto px-4 sm:px-6 pb-2 shrink-0"
              >
                <div
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold text-center ${
                    toastMessage.tone === 'error'
                      ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                      : 'bg-[rgba(var(--app-accent-rgb),0.18)] border-[rgba(var(--app-accent-rgb),0.45)] text-[var(--app-accent-light)]'
                  }`}
                >
                  {toastMessage.text}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ================= SCROLLABLE PROJECTS LIST ================= */}
          <motion.main
            variants={staggerFastContainerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 py-1.5 max-w-2xl w-full mx-auto space-y-2.5"
          >
            {/* Personalized Welcome Greeting Card */}
            {cloudUser && (() => {
              const hr = new Date().getHours();
              const firstName =
                cloudUser.displayName?.trim() ||
                cloudUser.email?.split('@')[0] ||
                (lang === 'ar' ? 'مبدع الموشن' : 'Creator');
              const greetingText =
                lang === 'ar'
                  ? hr < 12
                    ? `صباح الإبداع يا ${firstName} 👋`
                    : hr < 17
                    ? `أهلاً بعودتك، ${firstName} 👋`
                    : `مساء الإبداع يا ${firstName} 👋`
                  : hr < 12
                  ? `Good morning, ${firstName} 👋`
                  : hr < 17
                  ? `Welcome back, ${firstName} 👋`
                  : `Good evening, ${firstName} 👋`;

              return (
                <motion.div
                  variants={staggerItemVariants}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className="relative rounded-2xl bg-[#0D111B]/90 backdrop-blur-md border px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 overflow-hidden"
                  style={{
                    borderColor: `rgba(${palette.primaryRgb}, 0.32)`,
                    boxShadow: `0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }}
                >
                  <PanelRimSheen roundedClass="rounded-2xl" />
                  <div className="relative z-10 min-w-0 flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: `rgba(${palette.primaryRgb}, 0.16)`,
                        borderColor: `rgba(${palette.primaryRgb}, 0.35)`,
                      }}
                    >
                      <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-black text-white truncate">
                        {greetingText}
                      </h2>
                      <p className="text-[11px] text-slate-400 truncate">
                        {lang === 'ar'
                          ? 'حسابك محمي وبياناتك ومشاريعك خاصة بك وحدك'
                          : 'Your account is protected & private to you'}
                      </p>
                    </div>
                  </div>

                  {unreadNotificationsCount > 0 && onOpenNotifications && (
                    <button
                      type="button"
                      onClick={onOpenNotifications}
                      className="relative z-10 px-3 py-1.5 rounded-xl bg-[#FE2C55] hover:bg-[#e5244a] text-white text-[11px] font-black flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'ar'
                          ? `لديك ${unreadNotificationsCount} إشعار جديد — رد الآن`
                          : `${unreadNotificationsCount} new notification(s)`}
                      </span>
                    </button>
                  )}
                </motion.div>
              );
            })()}

            {sortedProjects.length === 0 ? (
              <motion.div
                variants={staggerItemVariants}
                className="relative mt-8 p-8 rounded-2xl bg-[#0B0D14]/85 border text-center space-y-3 overflow-hidden"
                style={{ borderColor: palette.border }}
              >
                <PanelRimSheen roundedClass="rounded-2xl" />
                <div
                  className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border bg-white/[0.04]"
                  style={{ borderColor: palette.border, color: palette.primary }}
                >
                  <FolderOpen className="w-7 h-7" />
                </div>
                <h2 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'لا توجد مشاريع بعد' : 'No Projects Yet'}
                </h2>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {lang === 'ar'
                    ? 'ابدأ بإنشاء مشروع جديد أو استيراد ملف مشروع محفوظ.'
                    : 'Start by creating a new project or importing a saved project file.'}
                </p>
              </motion.div>
            ) : (
              sortedProjects.map((proj) => {
                const duration = formatDurationString(
                  proj.settings.durationFrames,
                  proj.settings.fps
                );
                const isMenuOpen = selectedProjectMenu === proj.id;

                return (
                  <motion.div
                    key={proj.id}
                    variants={staggerItemVariants}
                    whileTap={{ scale: 0.99 }}
                    dir="ltr"
                    onClick={() => onOpenProject(proj)}
                    className={`relative rounded-2xl bg-[#0B0D14]/85 hover:bg-[#131722]/90 backdrop-blur-md border transition-colors px-2 sm:px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer group ${
                      isMenuOpen ? 'z-50' : 'z-0'
                    }`}
                    style={{
                      borderColor: isMenuOpen
                        ? palette.primary
                        : `rgba(${palette.primaryRgb}, 0.25)`,
                      boxShadow: isMenuOpen
                        ? `0 0 22px ${palette.glow}55`
                        : '0 4px 18px rgba(0,0,0,0.45)',
                    }}
                  >
                    {/* Left: Three Vertical Dots Menu Trigger (min 44px touch target) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjectMenu(isMenuOpen ? null : proj.id);
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                      aria-label={lang === 'ar' ? 'خيارات المشروع' : 'Project Options'}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {/* Middle: Title + Clean Unboxed Metadata */}
                    <div className="flex-1 min-w-0 text-left">
                      <h3
                        dir="auto"
                        className="font-bold text-sm sm:text-[15px] text-white group-hover:text-[var(--app-accent-light)] transition-colors truncate leading-snug"
                      >
                        {proj.settings.name || (lang === 'ar' ? 'مشروع بدون عنوان' : 'Untitled Project')}
                      </h3>

                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400 font-mono tabular-nums whitespace-nowrap overflow-hidden">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{duration}</span>
                        </span>
                        <span className="text-white/20" aria-hidden="true">
                          |
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Video className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{proj.settings.fps} FPS</span>
                        </span>
                        <span className="text-white/20" aria-hidden="true">
                          |
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{proj.layers.length}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: Compact Rounded Thumbnail */}
                    <ProjectThumbnail proj={proj} accentColor={palette.primary} />

                    {/* Project Action Context Menu */}
                    <AnimatePresence>
                      {isMenuOpen && (
                        <motion.div
                          variants={dropdownVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          dir={lang === 'ar' ? 'rtl' : 'ltr'}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-12 left-3 bg-[#0E111A]/95 backdrop-blur-xl text-slate-200 border rounded-2xl p-1.5 shadow-2xl z-40 min-w-[168px] space-y-0.5 text-xs font-bold overflow-hidden origin-top-left"
                          style={{
                            borderColor: palette.border,
                            boxShadow: `0 12px 32px rgba(0,0,0,0.85), 0 0 20px ${palette.glow}33`,
                          }}
                        >
                          <PanelRimSheen roundedClass="rounded-2xl" />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectMenu(null);
                              onOpenProject(proj);
                            }}
                            className="relative z-10 w-full min-h-[40px] px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between gap-2 text-white cursor-pointer"
                          >
                            <span>{lang === 'ar' ? 'فتح في المحرر' : 'Open in Editor'}</span>
                            <Edit3 className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectMenu(null);
                              if (onDuplicateProject) onDuplicateProject(proj);
                            }}
                            className="relative z-10 w-full min-h-[40px] px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between gap-2 text-slate-200 cursor-pointer"
                          >
                            <span>{lang === 'ar' ? 'تكرار المشروع' : 'Duplicate'}</span>
                            <Copy className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectMenu(null);
                              downloadProjectSQ(proj);
                            }}
                            className="relative z-10 w-full min-h-[40px] px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between gap-2 text-slate-200 cursor-pointer"
                          >
                            <span>{lang === 'ar' ? 'تصدير ملف .sq' : 'Export .sq'}</span>
                            <Download className="w-3.5 h-3.5" style={{ color: palette.bright }} />
                          </button>

                          <div className="h-px bg-white/10 my-1" />

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProjectMenu(null);
                              setProjectToDelete(proj);
                            }}
                            className="relative z-10 w-full min-h-[40px] px-3 py-1.5 rounded-xl hover:bg-rose-500/20 flex items-center justify-between gap-2 text-rose-400 cursor-pointer"
                          >
                            <span>{lang === 'ar' ? 'حذف المشروع' : 'Delete'}</span>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </motion.main>

          {/* ================= BOTTOM PROJECT ACTIONS & ORGANIZED COMMUNITY DOCK ================= */}
          <motion.footer
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={VIEW_SPRING}
            className="relative z-20 shrink-0 max-w-2xl w-full mx-auto px-4 sm:px-6 pt-2.5 pb-4 space-y-2.5"
          >
            <input
              ref={importInputRef}
              type="file"
              accept=".sq"
              onChange={handleImportFileChange}
              className="hidden"
            />

            {/* Top Row: Import (.sq) + New Project */}
            <div className="grid grid-cols-2 gap-2.5">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="min-h-[44px] rounded-2xl px-3 border flex items-center justify-center gap-2 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                style={{
                  background: palette.cssGrad,
                  color: palette.contrast,
                  borderColor: `rgba(${palette.brightRgb}, 0.5)`,
                  boxShadow: `0 0 22px ${palette.glow}, inset 0 1px 1px rgba(255,255,255,0.35)`,
                }}
              >
                <FolderPlus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="whitespace-nowrap truncate">
                  {lang === 'ar' ? 'استيراد (.sq)' : 'Import (.sq)'}
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setShowNewProjectModal(true)}
                className="min-h-[44px] rounded-2xl px-3 bg-[#0B0D14]/92 hover:bg-[#131724] border flex items-center justify-center gap-2 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                style={{
                  borderColor: palette.primary,
                  boxShadow: `0 4px 18px rgba(0,0,0,0.65), inset 0 0 14px rgba(${palette.primaryRgb}, 0.16)`,
                }}
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="whitespace-nowrap truncate">
                  {lang === 'ar' ? 'مشروع جديد' : 'New Project'}
                </span>
                <ChevronRight className="w-4 h-4 opacity-75 shrink-0 rtl:rotate-180" />
              </motion.button>
            </div>

            {/* Compact Single-Row Community Bar (3 Unified Hubs) */}
            {onOpenSocial && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={PILL_SPRING}
                className="relative overflow-hidden rounded-2xl bg-[#0B0D14]/90 backdrop-blur-md border p-1 grid grid-cols-3 gap-1"
                style={{
                  borderColor: `rgba(${palette.primaryRgb}, 0.28)`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.55), inset 0 0 12px rgba(${palette.primaryRgb}, 0.08)`,
                }}
              >
                <PanelRimSheen roundedClass="rounded-2xl" />
                {(
                  [
                    {
                      tab: 'videos' as SocialTabId,
                      ar: 'الفيديوهات',
                      en: 'Videos',
                      iconCls: 'text-[#FF4D6D]',
                      icon: <Film className="w-4 h-4 shrink-0" />,
                    },
                    {
                      tab: 'chats' as SocialTabId,
                      ar: 'المحادثات',
                      en: 'Chats',
                      iconCls: 'text-[#64B5F6]',
                      icon: <MessageCircle className="w-4 h-4 shrink-0" />,
                    },
                    {
                      tab: 'followers' as SocialTabId,
                      ar: 'المتابعون',
                      en: 'Followers',
                      iconCls: 'text-emerald-400',
                      icon: <UserPlus className="w-4 h-4 shrink-0" />,
                    },
                  ] as const
                ).map((item) => (
                  <motion.button
                    key={item.tab}
                    type="button"
                    whileHover={{ y: -1.5, scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    transition={PILL_SPRING}
                    onClick={() => onOpenSocial(item.tab)}
                    className="relative z-10 min-h-[42px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    <span className={item.iconCls}>{item.icon}</span>
                    <span className="whitespace-nowrap truncate">
                      {lang === 'ar' ? item.ar : item.en}
                    </span>
                    {item.tab === 'chats' && unreadNotificationsCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#FE2C55] text-white text-[10px] font-black flex items-center justify-center font-mono tabular-nums">
                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                      </span>
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </motion.footer>

          {/* ================= NEW PROJECT BOTTOM SHEET ================= */}
          <NewProjectModal
            isOpen={showNewProjectModal}
            onClose={() => setShowNewProjectModal(false)}
            savedProjects={savedProjects}
            lang={lang}
            defaultResolution={appSettings.defaultResolution}
            defaultFps={appSettings.defaultFps}
            onCreateNewProject={onCreateNewProject}
          />

          {/* ================= PROJECT DELETE CONFIRMATION MODAL ================= */}
          <AnimatePresence>
            {projectToDelete && (
              <motion.div
                key="delete-modal-backdrop"
                variants={backdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={AMBIENT_BACKDROP_STYLE}
                onClick={() => setProjectToDelete(null)}
                className="fixed inset-0 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none overflow-hidden gpu-layer"
              >
                <AmbientModalGlow />
                <motion.div
                  key="delete-modal-card"
                  variants={centerModalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onClick={(e) => e.stopPropagation()}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className="bg-[#0E131D]/[0.97] border rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_24px_80px_rgba(0,0,0,0.9)] relative overflow-hidden gpu-layer"
                  style={{ borderColor: palette.border }}
                >
                  <PanelRimSheen roundedClass="rounded-3xl" />
                  <motion.div
                    variants={staggerContainerVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative z-10 space-y-4"
                  >
                    <motion.div
                      variants={staggerItemVariants}
                      className="w-14 h-14 mx-auto rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center"
                    >
                      <Trash2 className="w-7 h-7" />
                    </motion.div>

                    <motion.div variants={staggerItemVariants} className="space-y-1.5 text-center">
                      <h3 className="font-black text-white text-base">
                        {lang === 'ar' ? 'حذف المشروع نهائياً؟' : 'Delete Project Permanently?'}
                      </h3>
                      <p className="text-xs text-slate-300 font-bold">
                        "{projectToDelete.settings.name || (lang === 'ar' ? 'المشروع' : 'Project')}"
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {lang === 'ar'
                          ? 'هل أنت متأكد من رغبتك في حذف هذا المشروع؟ سيتم مسح كافة الطبقات والحركات ولا يمكن التراجع عن هذه العملية.'
                          : 'Are you sure you want to delete this project? All layers and animations will be permanently removed.'}
                      </p>
                    </motion.div>

                    <motion.div variants={staggerItemVariants} className="flex items-center gap-2.5 pt-2">
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => {
                          if (onDeleteProject) onDeleteProject(projectToDelete.id);
                          setProjectToDelete(null);
                        }}
                        className="flex-1 min-h-[44px] py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-rose-900/40"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => setProjectToDelete(null)}
                        className="flex-1 min-h-[44px] py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </motion.button>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
};
