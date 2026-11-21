import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  Globe,
  Wifi,
  WifiOff,
  LogOut,
  Mail,
  Lock,
  User as UserIcon,
  Sparkles,
  Check,
  Loader2,
  Share2,
} from 'lucide-react';
import type { Language, Project } from '../types';
import {
  FirebaseUser,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  logoutUser,
  syncProjectToCloud,
  loadCloudProjects,
  publishCommunityTemplate,
  loadCommunityTemplates,
  CommunityTemplateItem,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  PanelRimSheen,
  backdropVariants,
  centerModalVariants,
} from './MotionPrimitives';

interface CloudAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: FirebaseUser | null;
  activeProject?: Project | null;
  savedProjects: Project[];
  onMergeCloudProjects: (cloudProjects: Project[]) => void;
  onOpenProject: (project: Project) => void;
  onOpenCollab?: () => void;
  onOpenProfile?: () => void;
}

export const CloudAccountModal: React.FC<CloudAccountModalProps> = ({
  isOpen,
  onClose,
  lang,
  user,
  activeProject,
  savedProjects,
  onMergeCloudProjects,
  onOpenProject,
  onOpenCollab,
  onOpenProfile,
}) => {
  const isAr = lang === 'ar';
  const [tab, setTab] = useState<'account' | 'community'>('account');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [firestoreOnline, setFirestoreOnline] = useState<boolean | null>(null);
  const [communityTemplates, setCommunityTemplates] = useState<CommunityTemplateItem[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [publishDesc, setPublishDesc] = useState('');

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
    setStatusMsg(null);
    fetch('/api/online/status')
      .then((r) => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));
    testFirestoreConnection().then(setFirestoreOnline);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || tab !== 'community') return;
    setLoadingCommunity(true);
    loadCommunityTemplates()
      .then(setCommunityTemplates)
      .finally(() => setLoadingCommunity(false));
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const notify = (text: string, tone: 'ok' | 'err' = 'ok') => {
    setStatusMsg({ text, tone });
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await loginWithGoogle();
      const cloudList = await loadCloudProjects();
      if (cloudList.length > 0) onMergeCloudProjects(cloudList);
      notify(isAr ? 'تم تسجيل الدخول والمزامنة بنجاح' : 'Signed in & synced with cloud');
    } catch (err: any) {
      notify(err?.message || (isAr ? 'تعذر تسجيل الدخول عبر Google' : 'Google sign-in failed'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      if (authMode === 'register') {
        await registerWithEmail(email.trim(), password, displayName.trim() || 'SQ Creator');
      } else {
        await loginWithEmail(email.trim(), password);
      }
      const cloudList = await loadCloudProjects();
      if (cloudList.length > 0) onMergeCloudProjects(cloudList);
      notify(isAr ? 'تم الاتصال بحسابك السحابي' : 'Connected to cloud account');
    } catch (err: any) {
      notify(err?.message || (isAr ? 'خطأ في البريد أو كلمة المرور' : 'Authentication error'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      notify(isAr ? 'أدخل بريدك الإلكتروني أولاً' : 'Enter your email address first', 'err');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      notify(isAr ? 'تم إرسال رابط استعادة كلمة المرور لبريدك' : 'Password reset email sent');
    } catch (err: any) {
      notify(err?.message || (isAr ? 'تعذر إرسال رابط الاستعادة' : 'Reset failed'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncAllToCloud = async () => {
    if (!user) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const targets = activeProject
        ? [activeProject, ...savedProjects.filter((p) => p.id !== activeProject.id)]
        : savedProjects;
      let synced = 0;
      for (const proj of targets.slice(0, 20)) {
        const ok = await syncProjectToCloud(proj);
        if (ok) synced += 1;
      }
      notify(
        isAr
          ? `تم رفع ومزامنة ${synced} مشروع إلى السحابة`
          : `Uploaded & synced ${synced} project(s) to cloud`
      );
    } catch (err: any) {
      notify(err?.message || (isAr ? 'فشل رفع المشاريع' : 'Upload failed'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const handlePullFromCloud = async () => {
    if (!user) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const cloudList = await loadCloudProjects();
      onMergeCloudProjects(cloudList);
      notify(
        isAr
          ? `تم جلب ${cloudList.length} مشروع من السحابة`
          : `Pulled ${cloudList.length} project(s) from cloud`
      );
    } catch (err: any) {
      notify(err?.message || (isAr ? 'فشل الجلب من السحابة' : 'Pull failed'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const handlePublishTemplate = async () => {
    if (!user || !activeProject) return;
    setBusy(true);
    setStatusMsg(null);
    const res = await publishCommunityTemplate(activeProject, publishDesc.trim());
    if (res.ok) {
      setPublishDesc('');
      notify(isAr ? 'تم نشر القالب أونلاين لمجتمع SQMOTION!' : 'Published template online!');
      const list = await loadCommunityTemplates();
      setCommunityTemplates(list);
    } else {
      notify(res.error || (isAr ? 'تعذر نشر القالب' : 'Failed to publish template'), 'err');
    }
    setBusy(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={onClose}
        style={AMBIENT_BACKDROP_STYLE}
        className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none"
      >
        <AmbientModalGlow />
        <motion.div
          variants={centerModalVariants}
          onClick={(e) => e.stopPropagation()}
          dir={isAr ? 'rtl' : 'ltr'}
          className="relative w-full max-w-lg bg-[#111319] border border-white/15 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[88vh]"
        >
          <PanelRimSheen roundedClass="rounded-2xl" />

          {/* Header */}
          <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-2 bg-[#161922]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 text-sky-300 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  {isAr ? 'الاتصال بالإنترنت والمزامنة السحابية' : 'Internet & Cloud Sync'}
                </h2>
                <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                  <span className={`inline-flex items-center gap-1 ${isBrowserOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isBrowserOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {isBrowserOnline ? (isAr ? 'متصل بالإنترنت' : 'Online') : (isAr ? 'غير متصل' : 'Offline')}
                  </span>
                  {serverOnline !== null && (
                    <span>· {serverOnline ? (isAr ? 'الخادم نشط' : 'Media API Ready') : (isAr ? 'الخادم متوقف' : 'API Offline')}</span>
                  )}
                  {firestoreOnline !== null && (
                    <span>· {firestoreOnline ? (isAr ? 'السحابة متصلة' : 'Cloud DB Ready') : (isAr ? 'السحابة متوقفة' : 'Cloud DB Offline')}</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-4 pt-2.5 flex items-center gap-2 border-b border-white/10 bg-[#13161F]">
            <button
              type="button"
              onClick={() => setTab('account')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'account'
                  ? 'border-sky-400 text-sky-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'الحساب والمزامنة السحابية' : 'Cloud Account & Sync'}
            </button>
            <button
              type="button"
              onClick={() => setTab('community')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'community'
                  ? 'border-sky-400 text-sky-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'قوالب المجتمع أونلاين' : 'Online Community Templates'}
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto space-y-4">
            {statusMsg && (
              <div
                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  statusMsg.tone === 'err'
                    ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                }`}
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{statusMsg.text}</span>
              </div>
            )}

            {tab === 'account' ? (
              user ? (
                <div className="space-y-4">
                  {/* Signed in card */}
                  <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User'}
                          className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 font-bold shrink-0">
                          {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">
                          {user.displayName || (isAr ? 'منشئ محتوى' : 'Creator')}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onOpenProfile && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenProfile();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserIcon className="w-3.5 h-3.5" />
                          <span>{isAr ? 'الملف' : 'Profile'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => logoutUser()}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{isAr ? 'خروج' : 'Sign Out'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Cloud Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSyncAllToCloud}
                      className="p-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/35 text-start transition-colors flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-5 h-5 text-sky-300 animate-spin shrink-0" /> : <CloudUpload className="w-5 h-5 text-sky-300 shrink-0" />}
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isAr ? 'رفع المشاريع للسحابة' : 'Upload Projects to Cloud'}
                        </div>
                        <div className="text-[10.5px] text-slate-400">
                          {isAr ? 'حفظ آمن متاح من أي جهاز' : 'Access your work from any device'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={handlePullFromCloud}
                      className="p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-start transition-colors flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
                    >
                      <CloudDownload className="w-5 h-5 text-emerald-300 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isAr ? 'استيراد من السحابة' : 'Pull Cloud Projects'}
                        </div>
                        <div className="text-[10.5px] text-slate-400">
                          {isAr ? 'مزامنة المشاريع والمفضلة' : 'Fetch synced cloud workspace'}
                        </div>
                      </div>
                    </button>
                  </div>

                  {activeProject && (
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>
                          {isAr
                            ? `نشر "${activeProject.settings.name}" كقالب أونلاين`
                            : `Publish "${activeProject.settings.name}" Online`}
                        </span>
                      </div>
                      <input
                        value={publishDesc}
                        onChange={(e) => setPublishDesc(e.target.value)}
                        placeholder={isAr ? 'وصف مختصر للقالب (اختياري)...' : 'Short description (optional)...'}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handlePublishTemplate}
                        className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'نشر في مكتبة المجتمع أونلاين' : 'Publish to Online Community'}</span>
                      </button>
                    </div>
                  )}

                  {onOpenCollab && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCollab();
                      }}
                      className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Cloud className="w-4 h-4 text-sky-300" />
                      <span>{isAr ? 'فتح جلسة التحرير التعاوني المباشر' : 'Open Live Collaborative Session'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGoogleSignIn}
                    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Globe className="w-4 h-4 text-sky-600" />
                    <span>{isAr ? 'تسجيل الدخول عبر Google للمزامنة السحابية' : 'Sign in with Google for Cloud Sync'}</span>
                  </button>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <div className="flex-1 h-px bg-white/10" />
                    <span>{isAr ? 'أو بالبريد الإلكتروني' : 'or with email'}</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <form onSubmit={handleEmailSubmit} className="space-y-2.5">
                    {authMode === 'register' && (
                      <div className="relative">
                        <UserIcon className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder={isAr ? 'الاسم المعروض' : 'Display name'}
                          className="w-full ps-9 pe-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
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
                        placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
                        className="w-full ps-9 pe-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
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
                        placeholder={isAr ? 'كلمة المرور (6 أحرف+)' : 'Password (6+ chars)'}
                        className="w-full ps-9 pe-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                        className="text-sky-400 hover:underline cursor-pointer"
                      >
                        {authMode === 'login'
                          ? isAr ? 'إنشاء حساب جديد' : 'Create new account'
                          : isAr ? 'لدي حساب بالفعل' : 'Already have an account'}
                      </button>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {authMode === 'login'
                          ? isAr ? 'دخول ومزامنة' : 'Sign In & Sync'
                          : isAr ? 'إنشاء حساب سحابي' : 'Create Cloud Account'}
                      </span>
                    </button>
                  </form>
                </div>
              )
            ) : (
              /* Community Templates Tab */
              <div className="space-y-2.5">
                {loadingCommunity ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                    <span>{isAr ? 'جاري تحميل قوالب المجتمع من الإنترنت...' : 'Loading online community templates...'}</span>
                  </div>
                ) : communityTemplates.length === 0 ? (
                  <div className="py-10 text-center space-y-2 text-xs text-slate-400">
                    <Globe className="w-8 h-8 mx-auto text-slate-600" />
                    <p>
                      {isAr
                        ? 'لا توجد قوالب منشورة بعد. سجّل الدخول وانشر أول قالب من مشروعك!'
                        : 'No online community templates yet. Sign in and publish your project!'}
                    </p>
                  </div>
                ) : (
                  communityTemplates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-sky-400/50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{tmpl.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {tmpl.authorName} · {tmpl.project.layers.length} {isAr ? 'طبقات' : 'layers'}
                        </div>
                        {tmpl.description && (
                          <div className="text-[10.5px] text-slate-500 truncate mt-0.5">{tmpl.description}</div>
                        )}
                      </div>
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
                        className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        {isAr ? 'فتح' : 'Open'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
