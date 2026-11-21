import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Camera,
  ImagePlus,
  Edit3,
  Check,
  CloudUpload,
  CloudDownload,
  Globe,
  LogOut,
  ArrowUpRight,
  Download,
  Trash2,
  Share2,
  Loader2,
  Mail,
  Lock,
  User as UserIcon,
  RotateCcw,
  Copy,
  Wifi,
  WifiOff,
  FolderOpen,
  Compass,
  Shield,
} from 'lucide-react';
import type { Language, Project } from '../types';
import {
  FirebaseUser,
  UserProfileData,
  getAuthIdToken,
  getScopedProfileStorageKey,
  loadUserProfile,
  saveUserProfileDetails,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  logoutUser,
  syncProjectToCloud,
  loadCloudProjects,
  publishCommunityTemplate,
  loadCommunityTemplates,
  deleteCommunityTemplate,
  CommunityTemplateItem,
  testFirestoreConnection,
} from '../lib/firebase';
import { loadFavoritesState } from '../engine/favoritesStore';
import { downloadProjectSQ } from '../engine/exporter';
import defaultStudioCover from '../assets/images/profile_studio_cover_1795175932108.jpg';
import defaultCreatorAvatar from '../assets/images/profile_creator_avatar_1795175933359.jpg';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  ITEM_SPRING,
  PILL_SPRING,
  PanelRimSheen,
  backdropVariants,
  centerModalVariants,
  staggerContainerVariants,
  staggerItemVariants,
  viewTransitionVariants,
} from './MotionPrimitives';

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: FirebaseUser | null;
  activeProject?: Project | null;
  savedProjects: Project[];
  onMergeCloudProjects: (cloudProjects: Project[]) => void;
  onOpenProject: (project: Project) => void;
  onOpenCollab?: () => void;
  onOpenSocial?: () => void;
}

const SPECIALTY_OPTIONS: Array<{ id: string; ar: string; en: string }> = [
  { id: 'Motion Graphics', ar: 'موشن جرافيكس', en: 'Motion Graphics' },
  { id: '3D Camera', ar: 'كاميرا ثلاثية الأبعاد', en: '3D Camera' },
  { id: 'Kinetic Type', ar: 'تحريك النصوص', en: 'Kinetic Type' },
  { id: 'Visual Effects', ar: 'المؤثرات البصرية', en: 'Visual Effects' },
  { id: 'Character Rigging', ar: 'تحريك الشخصيات', en: 'Character Rigging' },
  { id: 'Color Grading', ar: 'تصحيح الألوان', en: 'Color Grading' },
  { id: 'Sound Design', ar: 'تصميم الصوت', en: 'Sound Design' },
  { id: 'Title Sequences', ar: 'شارات البداية', en: 'Title Sequences' },
];

interface LocalProfileState {
  displayName: string;
  handle: string;
  role: string;
  bio: string;
  location: string;
  website: string;
  photoURL: string;
  bannerURL: string;
  specialties: string[];
  isPrivateAccount: boolean;
  dmPrivacy: 'everyone' | 'followers';
}

function getDefaultProfile(lang: Language, user?: FirebaseUser | null): LocalProfileState {
  const emailHandle = user?.email
    ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').toLowerCase()
    : 'sq_creator';
  return {
    displayName: user?.displayName?.trim() || (lang === 'ar' ? 'مبدع الموشن' : 'Motion Creator'),
    handle: emailHandle || 'sq_creator',
    role: lang === 'ar' ? 'مخرج ومصمم حركة' : 'Motion Director',
    bio: '',
    location: '',
    website: '',
    photoURL: user?.photoURL || '',
    bannerURL: '',
    specialties: ['Motion Graphics', 'Kinetic Type', '3D Camera'],
    isPrivateAccount: false,
    dmPrivacy: 'everyone',
  };
}

function loadLocalProfile(lang: Language, user?: FirebaseUser | null): LocalProfileState {
  const defaults = getDefaultProfile(lang, user);
  if (!user?.uid) return defaults;
  try {
    const raw = localStorage.getItem(getScopedProfileStorageKey(user.uid));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalProfileState>;
      return {
        displayName: parsed.displayName || defaults.displayName,
        handle: parsed.handle || defaults.handle,
        role: parsed.role || defaults.role,
        bio: parsed.bio || '',
        location: parsed.location || '',
        website: parsed.website || '',
        photoURL: parsed.photoURL || defaults.photoURL,
        bannerURL: parsed.bannerURL || '',
        specialties: Array.isArray(parsed.specialties)
          ? parsed.specialties.slice(0, 6)
          : defaults.specialties,
        isPrivateAccount: Boolean(parsed.isPrivateAccount),
        dmPrivacy: parsed.dmPrivacy === 'followers' ? 'followers' : 'everyone',
      };
    }
  } catch {
    // ignore
  }
  return defaults;
}

function saveLocalProfile(next: LocalProfileState, uid?: string): void {
  if (!uid) return;
  try {
    localStorage.setItem(getScopedProfileStorageKey(uid), JSON.stringify(next));
    window.dispatchEvent(new Event('sqmotion:profileChanged'));
  } catch {
    // ignore quota errors
  }
}

async function compressImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.84
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function formatTotalDuration(projects: Project[]): string {
  const totalSec = projects.reduce((acc, p) => {
    const fps = Math.max(1, p.settings.fps || 30);
    return acc + (p.settings.durationFrames || 0) / fps;
  }, 0);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.round(totalSec % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatProjectDuration(proj: Project): string {
  const fps = Math.max(1, proj.settings.fps || 30);
  const secs = (proj.settings.durationFrames || 0) / fps;
  return `${secs.toFixed(1)}s`;
}

const ProjectPreviewVisual: React.FC<{ project: Project; featured?: boolean }> = ({
  project,
  featured = false,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const imageLayer = project.layers.find((l) => l.type === 'image' && l.mediaUrl);
  const textLayer = project.layers.find((l) => l.type === 'text' && l.textConfig?.text);
  const bg = project.settings.backgroundColor;
  const solidBg = !bg || bg === '#00000000' || bg === 'transparent' ? '#0C0F17' : bg;

  if (imageLayer?.mediaUrl && !imgErr) {
    return (
      <div
        className={`relative w-full overflow-hidden bg-[#0A0C12] ${
          featured ? 'aspect-[16/9]' : 'aspect-[16/10]'
        }`}
      >
        <img
          src={imageLayer.mediaUrl}
          alt={project.settings.name}
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090B10] via-[#090B10]/30 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden flex items-center justify-center p-5 ${
        featured ? 'aspect-[16/9]' : 'aspect-[16/10]'
      }`}
      style={{
        backgroundColor: solidBg,
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 55%)',
      }}
    >
      {textLayer?.textConfig?.text ? (
        <span
          className={`font-black text-center leading-tight line-clamp-2 max-w-[90%] drop-shadow-md ${
            featured ? 'text-2xl sm:text-3xl' : 'text-lg'
          }`}
          style={{ color: textLayer.textConfig.fill || '#F8FAFC' }}
        >
          {textLayer.textConfig.text}
        </span>
      ) : (
        <span className="text-xs font-mono tracking-wider text-white/45 tabular-nums">
          {project.settings.width}×{project.settings.height}
        </span>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090B10]/90 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({
  isOpen,
  onClose,
  lang,
  user,
  activeProject,
  savedProjects,
  onMergeCloudProjects,
  onOpenProject,
  onOpenCollab,
  onOpenSocial,
}) => {
  const isAr = lang === 'ar';
  const [section, setSection] = useState<'portfolio' | 'published' | 'edit'>('portfolio');
  const [profile, setProfile] = useState<LocalProfileState>(() => loadLocalProfile(lang, user));
  const [draft, setDraft] = useState<LocalProfileState>(() => loadLocalProfile(lang, user));
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [coverImgFailed, setCoverImgFailed] = useState(false);

  // Cloud / Auth / Feedback states
  const [busy, setBusy] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [firestoreReady, setFirestoreReady] = useState<boolean | null>(null);

  // Community templates
  const [communityTemplates, setCommunityTemplates] = useState<CommunityTemplateItem[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [publishDesc, setPublishDesc] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOnline = () => setIsBrowserOnline(true);
    const onOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setNotice(null);
    setAvatarImgFailed(false);
    setCoverImgFailed(false);
    testFirestoreConnection().then(setFirestoreReady);

    const local = loadLocalProfile(lang, user);
    setProfile(local);
    setDraft(local);
    if (user) {
      loadUserProfile(user.uid).then((remote: UserProfileData | null) => {
        if (!remote) return;
        const merged: LocalProfileState = {
          displayName: remote.displayName || user.displayName || local.displayName,
          handle:
            remote.handle ||
            local.handle ||
            (user.email?.split('@')[0] || 'creator').replace(/[^a-zA-Z0-9_.-]/g, ''),
          role: remote.role || local.role,
          bio: remote.bio || local.bio,
          location: remote.location || local.location,
          website: remote.website || local.website,
          photoURL: remote.photoURL || user.photoURL || local.photoURL,
          bannerURL: remote.bannerURL || local.bannerURL,
          specialties:
            remote.specialties && remote.specialties.length > 0
              ? remote.specialties
              : local.specialties,
          isPrivateAccount: Boolean(remote.isPrivateAccount),
          dmPrivacy: remote.dmPrivacy === 'followers' ? 'followers' : 'everyone',
        };
        setProfile(merged);
        setDraft(merged);
        saveLocalProfile(merged, user.uid);
      });
    }

    setLoadingCommunity(true);
    loadCommunityTemplates()
      .then(setCommunityTemplates)
      .finally(() => setLoadingCommunity(false));
  }, [isOpen, user?.uid, lang]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  const favoritesCount = useMemo(() => {
    try {
      return loadFavoritesState(user?.uid).items.length;
    } catch {
      return 0;
    }
  }, [isOpen, user?.uid]);

  const totalLayersCount = useMemo(
    () => savedProjects.reduce((sum, p) => sum + p.layers.length, 0),
    [savedProjects]
  );

  const totalTimelineDuration = useMemo(
    () => formatTotalDuration(savedProjects),
    [savedProjects]
  );

  const myTemplates = useMemo(() => {
    if (!user) return communityTemplates;
    return communityTemplates.filter((t) => t.authorId === user.uid);
  }, [communityTemplates, user]);

  if (!isOpen) return null;

  const notify = (text: string, tone: 'ok' | 'err' = 'ok') => {
    setNotice({ text, tone });
  };

  const activeAvatarSrc =
    draft.photoURL || (section !== 'edit' ? profile.photoURL : '') || defaultCreatorAvatar;
  const activeCoverSrc =
    (section === 'edit' ? draft.bannerURL : profile.bannerURL) || defaultStudioCover;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 360, 360, 0.84);
      setAvatarImgFailed(false);
      const next = { ...draft, photoURL: compressed };
      setDraft(next);
      setProfile(next);
      saveLocalProfile(next, user?.uid);
      if (user) {
        await saveUserProfileDetails({ photoURL: compressed, displayName: next.displayName });
      }
      notify(isAr ? 'تم تحديث الصورة الشخصية بنجاح' : 'Profile photo updated');
    } catch {
      notify(isAr ? 'تعذر معالجة الصورة المختارة' : 'Failed to process image', 'err');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 1200, 675, 0.8);
      setCoverImgFailed(false);
      const next = { ...draft, bannerURL: compressed };
      setDraft(next);
      setProfile(next);
      saveLocalProfile(next, user?.uid);
      if (user) {
        await saveUserProfileDetails({ bannerURL: compressed, displayName: next.displayName });
      }
      notify(isAr ? 'تم تحديث غلاف الملف الشخصي' : 'Profile cover updated');
    } catch {
      notify(isAr ? 'تعذر تحديث صورة الغلاف' : 'Failed to process cover image', 'err');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = draft.displayName.trim() || (isAr ? 'مبدع الموشن' : 'Motion Creator');
    const cleanedHandle = draft.handle.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48);
    const next: LocalProfileState = {
      ...draft,
      displayName: cleanedName,
      handle: cleanedHandle,
      role: draft.role.trim(),
      bio: draft.bio.trim().slice(0, 360),
      location: draft.location.trim().slice(0, 80),
      website: draft.website.trim().slice(0, 200),
      specialties: draft.specialties.slice(0, 6),
      isPrivateAccount: Boolean(draft.isPrivateAccount),
      dmPrivacy: draft.dmPrivacy === 'followers' ? 'followers' : 'everyone',
    };
    setSavingProfile(true);
    setNotice(null);
    try {
      saveLocalProfile(next, user?.uid);
      setProfile(next);
      setDraft(next);
      if (user) {
        await saveUserProfileDetails({
          displayName: next.displayName,
          handle: next.handle,
          role: next.role,
          bio: next.bio,
          location: next.location,
          website: next.website,
          photoURL: next.photoURL,
          bannerURL: next.bannerURL,
          specialties: next.specialties,
          isPrivateAccount: next.isPrivateAccount,
          dmPrivacy: next.dmPrivacy,
        });
        const token = await getAuthIdToken();
        if (token) {
          await fetch('/api/social/creators', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              displayName: next.displayName,
              handle: next.handle,
              role: next.role,
              bio: next.bio,
              location: next.location,
              photoURL: next.photoURL,
              specialties: next.specialties,
              isPrivateAccount: next.isPrivateAccount,
              dmPrivacy: next.dmPrivacy,
            }),
          }).catch(() => {});
        }
      }
      notify(
        user
          ? isAr
            ? 'تم حفظ الملف الشخصي وإعدادات الخصوصية'
            : 'Profile & privacy settings saved'
          : isAr
          ? 'تم حفظ الملف الشخصي'
          : 'Profile saved'
      );
      setSection('portfolio');
    } catch {
      notify(isAr ? 'تعذر حفظ التعديلات سحابياً' : 'Failed to save cloud changes', 'err');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await loginWithGoogle();
      const cloudList = await loadCloudProjects();
      if (cloudList.length > 0) onMergeCloudProjects(cloudList);
      notify(isAr ? 'تم تسجيل الدخول ومزامنة ملفك السحابي' : 'Signed in & synced');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : isAr ? 'تعذر تسجيل الدخول عبر Google' : 'Google sign-in failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      if (authMode === 'register') {
        await registerWithEmail(email.trim(), password, authName.trim() || profile.displayName);
      } else {
        await loginWithEmail(email.trim(), password);
      }
      const cloudList = await loadCloudProjects();
      if (cloudList.length > 0) onMergeCloudProjects(cloudList);
      notify(isAr ? 'تم تسجيل الدخول بنجاح' : 'Connected to cloud account');
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : isAr ? 'خطأ في المصادقة' : 'Auth error', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      notify(isAr ? 'أدخل بريدك الإلكتروني أولاً' : 'Enter your email address first', 'err');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      notify(isAr ? 'تم إرسال رابط استعادة كلمة المرور' : 'Password reset link sent');
    } catch {
      notify(isAr ? 'تعذر إرسال رابط الاستعادة' : 'Reset failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadProjects = async () => {
    if (!user) return;
    setBusy(true);
    setNotice(null);
    try {
      const targets = activeProject
        ? [activeProject, ...savedProjects.filter((p) => p.id !== activeProject.id)]
        : savedProjects;
      let synced = 0;
      for (const proj of targets.slice(0, 20)) {
        if (await syncProjectToCloud(proj)) synced += 1;
      }
      notify(isAr ? `تمت مزامنة ${synced} مشروع إلى السحابة` : `Synced ${synced} project(s) to cloud`);
    } catch {
      notify(isAr ? 'فشل الرفع السحابي' : 'Upload failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handlePullProjects = async () => {
    if (!user) return;
    setBusy(true);
    setNotice(null);
    try {
      const cloudList = await loadCloudProjects();
      onMergeCloudProjects(cloudList);
      notify(isAr ? `تم استيراد ${cloudList.length} مشروع من السحابة` : `Pulled ${cloudList.length} project(s)`);
    } catch {
      notify(isAr ? 'تعذر الجلب من السحابة' : 'Pull failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishTemplate = async () => {
    if (!user || !activeProject) return;
    setBusy(true);
    const res = await publishCommunityTemplate(activeProject, publishDesc.trim());
    if (res.ok) {
      setPublishDesc('');
      const refreshed = await loadCommunityTemplates();
      setCommunityTemplates(refreshed);
      notify(isAr ? 'تم نشر العمل في معرض المجتمع' : 'Published to showcase');
    } else {
      notify(res.error || (isAr ? 'تعذر النشر' : 'Publish failed'), 'err');
    }
    setBusy(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    setBusy(true);
    const ok = await deleteCommunityTemplate(templateId);
    if (ok) {
      setCommunityTemplates((prev) => prev.filter((t) => t.id !== templateId));
      notify(isAr ? 'تمت إزالة القالب المنشور' : 'Template removed');
    } else {
      notify(isAr ? 'تعذر حذف القالب' : 'Failed to delete template', 'err');
    }
    setBusy(false);
  };

  const handleCopyProfileHandle = () => {
    const label = `@${profile.handle || 'sq_creator'} — ${profile.displayName}`;
    navigator.clipboard?.writeText(label).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  const toggleSpecialty = (specId: string) => {
    setDraft((prev) => {
      const exists = prev.specialties.includes(specId);
      if (exists) {
        return { ...prev, specialties: prev.specialties.filter((s) => s !== specId) };
      }
      if (prev.specialties.length >= 6) return prev;
      return { ...prev, specialties: [...prev.specialties, specId] };
    });
  };

  const sortedProjects = [...savedProjects].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const featuredProject = sortedProjects[0] || null;
  const secondaryProjects = sortedProjects.slice(1, 5);

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        style={AMBIENT_BACKDROP_STYLE}
        className="fixed inset-0 z-[75] bg-black/82 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 lg:p-6 select-none overflow-hidden"
      >
        <AmbientModalGlow />
        <motion.div
          variants={centerModalVariants}
          onClick={(e) => e.stopPropagation()}
          dir={isAr ? 'rtl' : 'ltr'}
          className="relative w-full max-w-5xl h-full sm:h-auto sm:max-h-[92vh] bg-[#090B10] border-0 sm:border sm:border-white/[0.09] sm:rounded-3xl shadow-[0_32px_90px_rgba(0,0,0,0.9)] overflow-hidden text-slate-100 flex flex-col font-['Cairo',sans-serif] gpu-layer"
        >
          <PanelRimSheen roundedClass="sm:rounded-t-3xl" />
          {/* Hidden file pickers */}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />

          {/* Top Bar (3-zone editorial contract) */}
          <header className="shrink-0 h-14 px-4 sm:px-7 border-b border-white/[0.08] bg-[#090B10]/95 flex items-center justify-between gap-4 z-20">
            <span className="text-sm sm:text-base font-black tracking-tight text-white whitespace-nowrap shrink-0">
              {isAr ? 'الملف الشخصي' : 'Creator Profile'}
            </span>

            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'portfolio', ar: 'معرض الأعمال', en: 'Portfolio' },
                  { id: 'published', ar: 'المنشورات السحابية', en: 'Published' },
                  { id: 'edit', ar: 'تعديل الملف', en: 'Edit Profile' },
                ] as const
              ).map((tab) => {
                const active = section === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSection(tab.id)}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active ? 'text-[#090B10]' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="profileSectionActiveBg"
                        transition={PILL_SPRING}
                        className="absolute inset-0 rounded-lg bg-white"
                      />
                    )}
                    <span className="relative z-10">{isAr ? tab.ar : tab.en}</span>
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto">
            {/* Hero Cover Banner */}
            <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-[#10131C]">
              {!coverImgFailed ? (
                <img
                  src={activeCoverSrc}
                  alt={isAr ? 'غلاف الملف الشخصي' : 'Studio cover'}
                  referrerPolicy="no-referrer"
                  onError={() => setCoverImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{
                    background:
                      'radial-gradient(circle at 30% 35%, rgba(var(--app-accent-rgb), 0.25), #090B10 72%)',
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090B10] via-[#090B10]/45 to-black/20" />

              {/* Cover controls */}
              <div className="absolute top-3 end-3 sm:top-4 sm:end-5 flex items-center gap-2 z-10">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تغيير الغلاف' : 'Change Cover'}</span>
                </button>
                {(draft.bannerURL || profile.bannerURL) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = { ...draft, bannerURL: '' };
                      setDraft(next);
                      setProfile(next);
                      saveLocalProfile(next, user?.uid);
                      if (user) await saveUserProfileDetails({ bannerURL: '' }).catch(() => {});
                      notify(isAr ? 'تمت استعادة الغلاف الافتراضي' : 'Restored default studio cover');
                    }}
                    className="p-1.5 rounded-lg bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/15 text-slate-200 hover:text-white cursor-pointer"
                    title={isAr ? 'استعادة الغلاف الافتراضي' : 'Reset cover'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Identity Header Lockup + Quantitative Metrics Strip */}
            <div className="px-4 sm:px-8 -mt-12 sm:-mt-14 relative z-10 pb-6 border-b border-white/[0.08]">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5 min-w-0">
                  {/* Avatar */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#121622] border-2 border-[#090B10] ring-1 ring-white/20 shrink-0 shadow-2xl">
                    {!avatarImgFailed ? (
                      <img
                        src={activeAvatarSrc}
                        alt={profile.displayName}
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white bg-[#151925]">
                        {profile.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      title={isAr ? 'تحديث الصورة الشخصية' : 'Update avatar'}
                      className="absolute inset-x-0 bottom-0 py-1.5 bg-black/70 hover:bg-black/90 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      <span>{isAr ? 'تعديل' : 'Photo'}</span>
                    </button>
                  </div>

                  {/* Display Name, Unboxed Metadata & Bio */}
                  <div className="min-w-0 space-y-1.5 pt-1">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight truncate">
                      {profile.displayName}
                    </h1>

                    {/* Clean Unboxed Metadata (Zero-Pill Rule) */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-[13px] text-slate-400">
                      <span className="font-mono text-slate-200 tabular-nums">
                        @{profile.handle || 'sq_creator'}
                      </span>
                      {profile.role && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-200 font-semibold">{profile.role}</span>
                        </>
                      )}
                      {profile.location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{profile.location}</span>
                        </>
                      )}
                      {user && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400 font-semibold inline-flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {profile.isPrivateAccount
                              ? isAr
                                ? 'حساب خاص محمي'
                                : 'Private Protected'
                              : isAr
                              ? 'حساب محمي ومزامن'
                              : 'Protected & Synced'}
                          </span>
                        </>
                      )}
                    </div>

                    {profile.bio && (
                      <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed pt-1">
                        {profile.bio}
                      </p>
                    )}

                    {profile.website && (
                      <div className="pt-0.5">
                        <a
                          href={
                            profile.website.startsWith('http')
                              ? profile.website
                              : `https://${profile.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--app-accent-bright)] hover:underline"
                        >
                          <span>{profile.website.replace(/^https?:\/\//, '')}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Single-line Action Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onOpenSocial && (
                    <button
                      type="button"
                      onClick={onOpenSocial}
                      className="px-3.5 py-2 rounded-xl bg-[#12151E] hover:bg-[#191E2B] border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>{isAr ? 'المجتمع والفيديوهات' : 'Community & Videos'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyProfileHandle}
                    className="px-3.5 py-2 rounded-xl bg-[#12151E] hover:bg-[#191E2B] border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'مشاركة المعرف' : 'Copy Handle'}</span>
                  </button>

                  {section !== 'edit' && (
                    <button
                      type="button"
                      onClick={() => setSection('edit')}
                      className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-transform active:scale-95"
                      style={{
                        backgroundColor: 'var(--app-accent-solid)',
                        color: 'var(--app-accent-contrast)',
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تعديل الملف' : 'Edit Profile'}</span>
                    </button>
                  )}

                  {user && (
                    <button
                      type="button"
                      onClick={() => logoutUser()}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-bold text-rose-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isAr ? 'خروج' : 'Sign Out'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quantitative Metrics Strip (Tabular Numerals, Derived From Real Data) */}
              <div className="mt-6 pt-5 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {isAr ? 'المشاريع المحفوظة' : 'Saved Projects'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums mt-0.5">
                    {savedProjects.length}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {isAr ? 'إجمالي الطبقات' : 'Total Layers'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums mt-0.5">
                    {totalLayersCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {isAr ? 'مدة الأعمال' : 'Total Runtime'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums mt-0.5">
                    {totalTimelineDuration}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {isAr ? 'العناصر المفضلة' : 'Favorites'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums mt-0.5">
                    {favoritesCount}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-400 font-semibold">
                    {isAr ? 'القوالب المنشورة' : 'Published'}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums mt-0.5">
                    {myTemplates.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback Banner */}
            {notice && (
              <div className="px-4 sm:px-8 pt-4">
                <div
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    notice.tone === 'err'
                      ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                      : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{notice.text}</span>
                </div>
              </div>
            )}

            {/* Main Sections with App Signature Transitions */}
            <div className="p-4 sm:p-8">
              <AnimatePresence mode="wait">
                {section === 'portfolio' && (
                  <motion.div
                    key="profile-portfolio"
                    variants={viewTransitionVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
                  >
                  {/* Left 8 columns: Featured + Project Showreel Bento */}
                  <div className="lg:col-span-8 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base sm:text-lg font-black text-white">
                        {isAr ? 'أحدث الأعمال والمشاريع' : 'Selected Works & Projects'}
                      </h2>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        {sortedProjects.length} {isAr ? 'مشروع' : 'items'}
                      </span>
                    </div>

                    {sortedProjects.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-[#0F121B] border border-white/[0.08] text-center space-y-2">
                        <FolderOpen className="w-8 h-8 text-slate-500 mx-auto" />
                        <p className="text-sm font-bold text-slate-200">
                          {isAr ? 'لا توجد مشاريع في ملفك بعد' : 'No projects in your portfolio yet'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {isAr
                            ? 'ابدأ مشروعك الأول من الشاشة الرئيسية ليظهر هنا تلقائياً.'
                            : 'Create a project from the home workspace to showcase it here.'}
                        </p>
                      </div>
                    ) : (
                      <motion.div
                        variants={staggerContainerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        {featuredProject && (
                          <motion.div
                            variants={staggerItemVariants}
                            whileHover={{ y: -2 }}
                            transition={ITEM_SPRING}
                            className="sm:col-span-2 group rounded-2xl overflow-hidden bg-[#0F121B] border border-white/[0.08] hover:border-white/20 transition-colors"
                          >
                            <ProjectPreviewVisual project={featuredProject} featured />
                            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base font-black text-white truncate">
                                  {featuredProject.settings.name || (isAr ? 'مشروع مميز' : 'Featured Project')}
                                </div>
                                <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5 flex flex-wrap items-center gap-2">
                                  <span>
                                    {featuredProject.settings.width}×{featuredProject.settings.height}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{featuredProject.settings.fps} FPS</span>
                                  <span aria-hidden="true">·</span>
                                  <span>
                                    {featuredProject.layers.length} {isAr ? 'طبقات' : 'layers'}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatProjectDuration(featuredProject)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => downloadProjectSQ(featuredProject)}
                                  className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-slate-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>.sq</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenProject(featuredProject);
                                    onClose();
                                  }}
                                  className="px-3.5 py-1.5 rounded-lg text-xs font-black whitespace-nowrap cursor-pointer"
                                  style={{
                                    backgroundColor: 'var(--app-accent-solid)',
                                    color: 'var(--app-accent-contrast)',
                                  }}
                                >
                                  {isAr ? 'فتح في المحرر' : 'Open Editor'}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {secondaryProjects.map((proj) => (
                          <motion.div
                            key={proj.id}
                            variants={staggerItemVariants}
                            whileHover={{ y: -2 }}
                            transition={ITEM_SPRING}
                            className="group rounded-2xl overflow-hidden bg-[#0F121B] border border-white/[0.08] hover:border-white/20 transition-colors flex flex-col"
                          >
                            <ProjectPreviewVisual project={proj} />
                            <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-white truncate">
                                  {proj.settings.name || (isAr ? 'مشروع بدون عنوان' : 'Untitled Project')}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1 flex items-center gap-1.5">
                                  <span>
                                    {proj.settings.width}×{proj.settings.height}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{proj.layers.length} {isAr ? 'طبقات' : 'layers'}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatProjectDuration(proj)}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenProject(proj);
                                    onClose();
                                  }}
                                  className="text-xs font-bold text-[var(--app-accent-bright)] hover:underline cursor-pointer"
                                >
                                  {isAr ? 'تحرير المشروع' : 'Open Project'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadProjectSQ(proj)}
                                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                                  title={isAr ? 'تصدير .sq' : 'Export .sq'}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {/* Right 4 columns: Specialties + Cloud Account / Sign-in */}
                  <aside className="lg:col-span-4 space-y-6 lg:border-s lg:border-white/[0.08] lg:ps-7">
                    {/* Specialties as clean editorial list */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-white">
                          {isAr ? 'التخصصات والمهارات' : 'Creative Disciplines'}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setSection('edit')}
                          className="text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                      </div>
                      {profile.specialties.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          {isAr ? 'أضف تخصصاتك الإبداعية من تعديل الملف.' : 'Add your specialties in Edit Profile.'}
                        </p>
                      ) : (
                        <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
                          {profile.specialties.map((specId, index) => {
                            const found = SPECIALTY_OPTIONS.find((s) => s.id === specId);
                            const label = found ? (isAr ? found.ar : found.en) : specId;
                            return (
                              <div
                                key={specId}
                                className="py-2 flex items-center justify-between text-xs"
                              >
                                <span className="font-semibold text-slate-200">{label}</span>
                                <span className="font-mono text-slate-500 tabular-nums">
                                  {String(index + 1).padStart(2, '0')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Cloud Connection & Sync Controls */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <h3 className="text-sm font-black text-white">
                          {isAr ? 'الحساب السحابي والمزامنة' : 'Cloud & Sync'}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isBrowserOnline ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isBrowserOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {isBrowserOnline ? (isAr ? 'متصل' : 'Online') : isAr ? 'غير متصل' : 'Offline'}
                        </span>
                      </div>

                      {firestoreReady !== null && (
                        <div className="text-[11px] text-slate-400">
                          {firestoreReady
                            ? isAr
                              ? 'قاعدة البيانات السحابية متصلة وجاهزة للمزامنة.'
                              : 'Cloud database reachable and ready.'
                            : isAr
                            ? 'العمل محلياً — تعذر الوصول لقاعدة البيانات.'
                            : 'Working locally — Cloud DB offline.'}
                        </div>
                      )}

                      {user ? (
                        <div className="space-y-2.5 pt-1">
                          <div className="text-xs text-slate-300 truncate">
                            {user.email || profile.displayName}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={handleUploadProjects}
                              className="px-3 py-2 rounded-xl bg-[#12151E] hover:bg-[#191E2C] border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                              <span>{isAr ? 'رفع الكل' : 'Sync Up'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={handlePullProjects}
                              className="px-3 py-2 rounded-xl bg-[#12151E] hover:bg-[#191E2C] border border-white/10 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CloudDownload className="w-3.5 h-3.5" />
                              <span>{isAr ? 'جلب الكل' : 'Pull All'}</span>
                            </button>
                          </div>
                          {onOpenCollab && (
                            <button
                              type="button"
                              onClick={onOpenCollab}
                              className="w-full py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-xs font-bold text-slate-200 cursor-pointer"
                            >
                              {isAr ? 'فتح جلسة التحرير التعاوني' : 'Open Live Collaboration'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={handleGoogleSignIn}
                            className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-[#090B10] font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            <Globe className="w-4 h-4 text-sky-600" />
                            <span>{isAr ? 'الدخول بحساب Google' : 'Sign in with Google'}</span>
                          </button>

                          <form onSubmit={handleEmailAuth} className="space-y-2">
                            {authMode === 'register' && (
                              <div className="relative">
                                <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                                <input
                                  type="text"
                                  value={authName}
                                  onChange={(e) => setAuthName(e.target.value)}
                                  placeholder={isAr ? 'الاسم المعروض' : 'Display name'}
                                  className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#0F121B] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                                />
                              </div>
                            )}
                            <div className="relative">
                              <Mail className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                              <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder={isAr ? 'البريد الإلكتروني' : 'Email'}
                                className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#0F121B] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                              />
                            </div>
                            <div className="relative">
                              <Lock className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                              <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isAr ? 'كلمة المرور' : 'Password'}
                                className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#0F121B] border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <button
                                type="button"
                                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                className="text-[var(--app-accent-bright)] hover:underline cursor-pointer"
                              >
                                {authMode === 'login'
                                  ? isAr ? 'حساب جديد' : 'Create account'
                                  : isAr ? 'تسجيل دخول' : 'Sign in'}
                              </button>
                              <button
                                type="button"
                                onClick={handleResetPassword}
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                {isAr ? 'نسيت كلمة المرور؟' : 'Reset'}
                              </button>
                            </div>
                            <button
                              type="submit"
                              disabled={busy}
                              className="w-full py-2 rounded-xl text-xs font-black cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--app-accent-solid)',
                                color: 'var(--app-accent-contrast)',
                              }}
                            >
                              {authMode === 'login'
                                ? isAr ? 'دخول ومزامنة' : 'Sign In & Sync'
                                : isAr ? 'إنشاء حساب' : 'Create Account'}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </aside>
                </motion.div>
              )}

              {section === 'published' && (
                <motion.div
                  key="profile-published"
                  variants={viewTransitionVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white">
                        {isAr ? 'القوالب المنشورة في المجتمع' : 'Published Community Showcase'}
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {user
                          ? isAr
                            ? 'إدارة القوالب التي شاركتها مع بقية المصممين أونلاين.'
                            : 'Manage templates you published to the online community.'
                          : isAr
                          ? 'تصفح أحدث قوالب المجتمع أو سجّل الدخول لنشر أعمالك.'
                          : 'Browse community templates or sign in to publish your own.'}
                      </p>
                    </div>
                  </div>

                  {user && activeProject && (
                    <div className="p-4 rounded-2xl bg-[#0F121B] border border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <input
                        type="text"
                        value={publishDesc}
                        onChange={(e) => setPublishDesc(e.target.value)}
                        placeholder={
                          isAr
                            ? `أضف وصفاً لنشر "${activeProject.settings.name}"...`
                            : `Add description to publish "${activeProject.settings.name}"...`
                        }
                        className="flex-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handlePublishTemplate}
                        className="px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--app-accent-solid)',
                          color: 'var(--app-accent-contrast)',
                        }}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'نشر المشروع الحالي' : 'Publish Active Project'}</span>
                      </button>
                    </div>
                  )}

                  {loadingCommunity ? (
                    <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isAr ? 'جاري تحميل المنشورات...' : 'Loading showcase...'}</span>
                    </div>
                  ) : myTemplates.length === 0 ? (
                    <div className="py-12 px-4 rounded-2xl bg-[#0F121B] border border-white/[0.08] text-center space-y-2">
                      <Globe className="w-7 h-7 text-slate-500 mx-auto" />
                      <p className="text-sm font-bold text-slate-200">
                        {isAr ? 'لم تنشر أي قوالب بعد' : 'No published templates yet'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {isAr
                          ? 'افتح أي مشروع في المحرر ثم انشره هنا ليراه ويستخدمه الآخرون.'
                          : 'Open any project in the editor and publish it to share with others.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {myTemplates.map((tmpl) => (
                        <div
                          key={tmpl.id}
                          className="p-4 rounded-2xl bg-[#0F121B] border border-white/[0.08] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="text-sm font-bold text-white truncate">{tmpl.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                              {tmpl.authorName} · {tmpl.project.settings.width}×{tmpl.project.settings.height} ·{' '}
                              {tmpl.project.layers.length} {isAr ? 'طبقات' : 'layers'}
                            </div>
                            {tmpl.description && (
                              <p className="text-xs text-slate-400 line-clamp-1">{tmpl.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onOpenProject({
                                  ...JSON.parse(JSON.stringify(tmpl.project)),
                                  id: `proj-${Date.now()}`,
                                  updatedAt: Date.now(),
                                });
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-white text-[#090B10] text-xs font-black cursor-pointer"
                            >
                              {isAr ? 'فتح' : 'Open'}
                            </button>
                            {user && tmpl.authorId === user.uid && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeleteTemplate(tmpl.id)}
                                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                                title={isAr ? 'حذف القالب' : 'Delete template'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {section === 'edit' && (
                <motion.form
                  key="profile-edit"
                  variants={viewTransitionVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onSubmit={handleSaveProfile}
                  className="max-w-3xl space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-white">
                        {isAr ? 'تخصيص الهوية الإبداعية' : 'Customize Creator Identity'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {isAr
                          ? 'تظهر هذه البيانات في بطاقة ملفك وقوالبك المنشورة.'
                          : 'Visible on your creator profile and published community templates.'}
                      </p>
                    </div>
                  </div>

                  {/* Avatar & Cover quick row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-[#12151E] hover:bg-[#191E2C] border border-white/10 text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isAr ? 'رفع صورة شخصية جديدة' : 'Upload New Avatar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-[#12151E] hover:bg-[#191E2C] border border-white/10 text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>{isAr ? 'رفع صورة غلاف' : 'Upload Cover Banner'}</span>
                    </button>
                    {draft.photoURL && (
                      <button
                        type="button"
                        onClick={() => setDraft((p) => ({ ...p, photoURL: '' }))}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                      >
                        {isAr ? 'إزالة الصورة المخصصة' : 'Reset Avatar'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        {isAr ? 'الاسم المعروض' : 'Display Name'}
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={draft.displayName}
                        onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F121B] border border-white/10 text-sm text-white focus:outline-none focus:border-white/35"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        {isAr ? 'المعرّف (@Handle)' : 'Handle'}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={48}
                        value={draft.handle}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            handle: e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''),
                          }))
                        }
                        placeholder="creator_studio"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F121B] border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-white/35"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        {isAr ? 'المسمى الإبداعي' : 'Creative Role'}
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={draft.role}
                        onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value }))}
                        placeholder={isAr ? 'مصمم موشن جرافيك' : 'Motion Graphics Director'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F121B] border border-white/10 text-sm text-white focus:outline-none focus:border-white/35"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        {isAr ? 'المدينة / الاستوديو' : 'Location'}
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={draft.location}
                        onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                        placeholder={isAr ? 'القاهرة / دبي / الرياض' : 'Dubai / Remote'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F121B] border border-white/10 text-sm text-white focus:outline-none focus:border-white/35"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        {isAr ? 'الرابط أو معرض الأعمال الخارجي' : 'Portfolio Link / Website'}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={200}
                        value={draft.website}
                        onChange={(e) => setDraft((p) => ({ ...p, website: e.target.value }))}
                        placeholder="https://behance.net/yourname"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F121B] border border-white/10 text-sm text-white focus:outline-none focus:border-white/35"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">
                          {isAr ? 'نبذة تعريفية' : 'Bio'}
                        </label>
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          {draft.bio.length}/360
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={360}
                        value={draft.bio}
                        onChange={(e) => setDraft((p) => ({ ...p, bio: e.target.value }))}
                        placeholder={
                          isAr
                            ? 'اكتب نبذة مختصرة عن أسلوبك في التحريك والمونتاج...'
                            : 'Tell collaborators about your motion design style...'
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F121B] border border-white/10 text-sm text-white focus:outline-none focus:border-white/35 resize-none"
                      />
                    </div>
                  </div>

                  {/* Interactive Specialties Selector */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">
                        {isAr ? 'اختر التخصصات (حتى 6)' : 'Select Specialties (up to 6)'}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500">
                        {draft.specialties.length}/6
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALTY_OPTIONS.map((spec) => {
                        const selected = draft.specialties.includes(spec.id);
                        return (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => toggleSpecialty(spec.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                              selected
                                ? 'bg-white text-[#090B10] border-white'
                                : 'bg-[#0F121B] text-slate-300 border-white/10 hover:border-white/25'
                            }`}
                          >
                            {isAr ? spec.ar : spec.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Privacy & Account Protection Controls */}
                  <div className="p-4 rounded-2xl bg-[#0F121B] border border-white/[0.08] space-y-4">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-white">
                          {isAr ? 'الخصوصية وحماية الحساب' : 'Account Privacy & Protection'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {isAr
                            ? 'تحكم في خصوصية ملفك الشخصي ومن يمكنه مراسلتك مباشرة.'
                            : 'Control who can see your full profile details and send direct messages.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-300" />
                          <span>{isAr ? 'جعل الحساب خاصاً' : 'Private Account'}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isAr
                            ? 'إخفاء النبذة والموقع عن غير المتابعين مع بقاء الحساب محمياً بالكامل.'
                            : 'Hide your bio and location from non-followers.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({ ...p, isPrivateAccount: !p.isPrivateAccount }))
                        }
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer shrink-0 ${
                          draft.isPrivateAccount
                            ? 'bg-emerald-500 text-[#090B10]'
                            : 'bg-white/[0.07] text-slate-300 hover:bg-white/[0.12]'
                        }`}
                      >
                        {draft.isPrivateAccount ? (isAr ? 'مفعل' : 'On') : isAr ? 'متاح' : 'Off'}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isAr ? 'من يمكنه مراسلتي' : 'Who can message me'}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {isAr
                            ? 'حصر المراسلات الخاصة على من تتابعهم أو إتاحتها للجميع.'
                            : 'Restrict incoming direct messages to people you follow or allow everyone.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#090B10] border border-white/10 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, dmPrivacy: 'everyone' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            draft.dmPrivacy === 'everyone'
                              ? 'bg-white text-[#090B10]'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {isAr ? 'الجميع' : 'Everyone'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, dmPrivacy: 'followers' }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            draft.dmPrivacy === 'followers'
                              ? 'bg-[#FE2C55] text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {isAr ? 'المتابعون فقط' : 'Followers Only'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--app-accent-solid)',
                        color: 'var(--app-accent-contrast)',
                      }}
                    >
                      {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{isAr ? 'حفظ التغييرات' : 'Save Changes'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(profile);
                        setSection('portfolio');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-slate-200 cursor-pointer"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </motion.form>
              )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
