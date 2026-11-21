import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Lock,
  BellRing,
  Globe,
  Mail,
  User as UserIcon,
  Loader2,
  Languages,
  Check,
} from 'lucide-react';
import type { Language } from '../types';
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  resetPassword,
  saveUserProfileDetails,
} from '../lib/firebase';
import { VioletEnergyWavesBackdrop } from './VioletEnergyWavesBackdrop';
import {
  ITEM_SPRING,
  PILL_SPRING,
  PanelRimSheen,
  VIEW_SPRING,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';
import { loadAppSettings } from '../utils/appSettings';

interface WelcomeAuthGateProps {
  lang: Language;
  onSetLang: (lang: Language) => void;
}

function getTimeOfDayGreeting(isAr: boolean): string {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 12) {
    return isAr ? 'صباح الإبداع' : 'Good morning';
  }
  if (hr >= 12 && hr < 18) {
    return isAr ? 'أهلاً بك' : 'Good afternoon';
  }
  return isAr ? 'مساء الإبداع' : 'Good evening';
}

export const WelcomeAuthGate: React.FC<WelcomeAuthGateProps> = ({ lang, onSetLang }) => {
  const isAr = lang === 'ar';
  const [appTheme] = useState(() => loadAppSettings().theme);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const greeting = getTimeOfDayGreeting(isAr);

  const handleGoogle = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setNotice({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : isAr
            ? 'تعذر تسجيل الدخول عبر Google'
            : 'Google sign-in failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      if (mode === 'register') {
        const cleanName = displayName.trim() || email.split('@')[0] || 'Creator';
        await registerWithEmail(email.trim(), password, cleanName);
        const cleanHandle = handle.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48);
        if (cleanHandle) {
          await saveUserProfileDetails({ displayName: cleanName, handle: cleanHandle }).catch(() => {});
        }
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (err: unknown) {
      setNotice({
        tone: 'err',
        text:
          err instanceof Error
            ? err.message
            : isAr
            ? 'تحقق من البريد الإلكتروني وكلمة المرور'
            : 'Invalid email or password',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      setNotice({
        tone: 'err',
        text: isAr ? 'أدخل بريدك الإلكتروني أولاً لاستعادة كلمة المرور' : 'Enter your email first',
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await resetPassword(email.trim());
      setNotice({
        tone: 'ok',
        text: isAr
          ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك'
          : 'Password reset link sent to your email',
      });
    } catch {
      setNotice({
        tone: 'err',
        text: isAr ? 'تعذر إرسال رابط الاستعادة' : 'Failed to send reset link',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 w-screen h-[100dvh] bg-[#05060A] text-white flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none font-['Cairo',sans-serif]"
    >
      <VioletEnergyWavesBackdrop theme={appTheme} />

      {/* Top language switcher */}
      <button
        type="button"
        onClick={() => onSetLang(isAr ? 'en' : 'ar')}
        className="fixed top-4 end-4 z-30 min-h-[42px] px-3.5 rounded-2xl bg-[#0D1018]/90 hover:bg-[#171C2A] border border-white/15 text-xs font-bold text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
      >
        <Languages className="w-4 h-4 text-[var(--app-accent-bright)]" />
        <span>{isAr ? 'English' : 'العربية'}</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={VIEW_SPRING}
        className="relative z-20 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl bg-[#0A0D15]/92 backdrop-blur-xl border border-white/10 shadow-[0_32px_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        <PanelRimSheen roundedClass="rounded-t-3xl" />

        {/* Editorial Welcome Column */}
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-6 p-6 sm:p-9 flex flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-e border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-transparent"
        >
          <div className="space-y-4">
            <motion.div variants={staggerItemVariants} className="inline-flex items-center gap-2.5">
              <div className="w-11 h-11 rounded-2xl bg-[rgba(var(--app-accent-rgb),0.18)] border border-[rgba(var(--app-accent-rgb),0.4)] flex items-center justify-center text-[var(--app-accent-bright)] shadow-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--app-accent-bright)]">
                  SQMOTION STUDIO
                </div>
                <div className="text-[11px] text-slate-400">
                  {isAr ? 'حسابات محمية وخاصة' : 'Protected Private Accounts'}
                </div>
              </div>
            </motion.div>

            <motion.h1
              variants={staggerItemVariants}
              className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-snug"
            >
              {greeting}، {isAr ? 'مرحباً بك في استوديو الحركة والمجتمع' : 'welcome to your motion workspace'}
            </motion.h1>

            <motion.p variants={staggerItemVariants} className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
              {isAr
                ? 'سجّل الدخول بحسابك الشخصي المحمي لتبقى مشاريعك، رسائلك، ومتابعوك خاصين بك وحدك مع إشعارات فورية وردود مباشرة.'
                : 'Sign in to your protected account so your projects, messages, and followers stay private with live notifications and instant replies.'}
            </motion.p>
          </div>

          <motion.div variants={staggerItemVariants} className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-white">
                  {isAr ? 'خصوصية تامة لكل حساب' : 'Isolated Private Workspace'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isAr
                    ? 'بياناتك ومشاريعك ومحادثاتك محمية ومرتبطة بهويتك الموثقة فقط.'
                    : 'Every account keeps its own projects, favorites, and encrypted private chats.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-black text-white">
                  {isAr ? 'إشعارات وردود حقيقية فورية' : 'Real-Time Notifications & Replies'}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isAr
                    ? 'عند مراسلة أي شخص يصله إشعار لحظي ويمكنه الرد مباشرة من داخل الإشعار.'
                    : 'Recipients receive an instant alert and can reply right from the notification card.'}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Auth Form Column */}
        <div className="lg:col-span-6 p-6 sm:p-9 flex flex-col justify-center space-y-5">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#06080D] border border-white/10">
            {(
              [
                { id: 'login' as const, ar: 'تسجيل الدخول', en: 'Sign In' },
                { id: 'register' as const, ar: 'إنشاء حساب محمي', en: 'Create Account' },
              ] as const
            ).map((tab) => {
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setNotice(null);
                  }}
                  className={`relative min-h-[42px] rounded-xl text-xs font-black transition-colors cursor-pointer ${
                    active ? 'text-[#090B10]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="authGateTabBg"
                      transition={PILL_SPRING}
                      className="absolute inset-0 rounded-xl bg-white"
                    />
                  )}
                  <span className="relative z-10">{isAr ? tab.ar : tab.en}</span>
                </button>
              );
            })}
          </div>

          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ITEM_SPRING}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                notice.tone === 'err'
                  ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{notice.text}</span>
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full min-h-[46px] px-4 rounded-2xl bg-white hover:bg-slate-100 text-[#090B10] font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 shadow-lg"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-sky-600" />}
            <span>{isAr ? 'المتابعة باستخدام Google' : 'Continue with Google'}</span>
          </motion.button>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>{isAr ? 'أو بالبريد الإلكتروني' : 'or with email'}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={isAr ? 'اسمك المعروض' : 'Display Name'}
                    className="w-full min-h-[44px] ps-9 pe-3 rounded-xl bg-[#0F131D] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={40}
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                  placeholder={isAr ? '@المعرف (اختياري)' : '@handle (optional)'}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#0F131D] border border-white/10 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-white/30"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
                className="w-full min-h-[44px] ps-9 pe-3 rounded-xl bg-[#0F131D] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="password"
                required
                minLength={6}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isAr ? 'كلمة المرور (6 أحرف على الأقل)' : 'Password (min 6 chars)'}
                className="w-full min-h-[44px] ps-9 pe-3 rounded-xl bg-[#0F131D] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-white/30"
              />
            </div>

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                </button>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--app-accent-solid)',
                color: 'var(--app-accent-contrast)',
              }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === 'login'
                  ? isAr
                    ? 'دخول إلى حسابي المحمي'
                    : 'Sign In to My Account'
                  : isAr
                  ? 'إنشاء حساب خاص محمي'
                  : 'Create Protected Account'}
              </span>
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
