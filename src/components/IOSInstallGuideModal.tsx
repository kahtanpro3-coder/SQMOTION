import React from 'react';
import { motion } from 'motion/react';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  PanelRimSheen,
  backdropVariants,
  bottomSheetVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';
import { Language } from '../types';
import { X, Share2, PlusSquare, Smartphone, CheckCircle, Sparkles } from 'lucide-react';

interface IOSInstallGuideModalProps {
  lang: Language;
  onClose: () => void;
}

export const IOSInstallGuideModal: React.FC<IOSInstallGuideModalProps> = ({ lang, onClose }) => {
  return (
    <motion.div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClose}
      style={AMBIENT_BACKDROP_STYLE}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 select-none overflow-hidden gpu-layer"
    >
      <AmbientModalGlow />

      <motion.div
        variants={bottomSheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        style={{
          willChange: 'transform, opacity',
          transform: 'translate3d(0,0,0)',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.85), 0 0 35px rgba(var(--app-accent-rgb), 0.1)',
        }}
        className="w-full max-w-md bg-[#0D0E13]/[0.98] border border-white/15 rounded-3xl overflow-hidden flex flex-col relative gpu-layer"
      >
        <PanelRimSheen roundedClass="rounded-t-3xl" />

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col"
        >
          {/* Modal Header */}
          <motion.div
            variants={staggerItemVariants}
            className="p-4 bg-[#15171E]/90 border-b border-white/10 flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div
                style={{
                  background: 'var(--app-accent-grad)',
                  boxShadow: '0 0 15px var(--app-accent-glow)',
                }}
                className="w-10 h-10 rounded-2xl p-0.5"
              >
                <div className="w-full h-full bg-[#0D0E13] rounded-[14px] flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[var(--app-accent-bright)]" />
                </div>
              </div>
              <div>
                <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                  <span>{lang === 'ar' ? 'تثبيت التطبيق على آيفون وآيباد (iOS)' : 'Install on iPhone & iPad (iOS)'}</span>
                  <span className="text-[10px] bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] px-2 py-0.5 rounded-full font-mono font-bold">
                    iOS Web App
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'يعمل كتطبيق أصلي شاشة كاملة وبدون أشرطة' : 'Runs fullscreen like a native App Store app'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>

          {/* Step-by-Step Apple Visual Guide */}
          <div className="p-4 sm:p-5 space-y-3.5 text-xs">
            {/* Step 1 */}
            <motion.div
              variants={staggerItemVariants}
              className="flex items-start gap-3 bg-[#15171E] p-3 rounded-2xl border border-white/10"
            >
              <div className="w-8 h-8 rounded-xl bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] flex items-center justify-center shrink-0 border border-[var(--app-accent-border)]">
                <Share2 className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-black text-white text-xs">
                  {lang === 'ar' ? '1. اضغط على زر المشاركة (Share)' : '1. Tap the Share button'}
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {lang === 'ar'
                    ? 'في متصفح Safari بالأسفل (أو في شريط الأدوات بالآيباد)، اضغط على أيقونة المربع مع السهم المتجه لأعلى ⎋.'
                    : 'In Safari at the bottom bar (or top toolbar on iPad), tap the square Share icon with upward arrow ⎋.'}
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              variants={staggerItemVariants}
              className="flex items-start gap-3 bg-[#15171E] p-3 rounded-2xl border border-white/10"
            >
              <div className="w-8 h-8 rounded-xl bg-[var(--app-accent-surface)] text-[var(--app-accent-bright)] flex items-center justify-center shrink-0 border border-[var(--app-accent-border)]">
                <PlusSquare className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-black text-white text-xs">
                  {lang === 'ar' ? '2. اختر "إضافة إلى الشاشة الرئيسية"' : '2. Select "Add to Home Screen"'}
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {lang === 'ar'
                    ? 'مرر للأسفل في قائمة الخيارات واضغط على "إضافة إلى الصفحة الرئيسية" (Add to Home Screen ⊞).'
                    : 'Scroll down through the share sheet options and select "Add to Home Screen" ⊞.'}
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              variants={staggerItemVariants}
              className="flex items-start gap-3 bg-[#15171E] p-3 rounded-2xl border border-white/10"
            >
              <div className="w-8 h-8 rounded-xl bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] flex items-center justify-center shrink-0 border border-[var(--app-accent-border)]">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-black text-white text-xs">
                  {lang === 'ar' ? '3. اضغط على "إضافة" (Add) في الزاوية' : '3. Tap "Add" in top corner'}
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {lang === 'ar'
                    ? 'اضغط زر "إضافة" في أعلى اليمين. سيظهر تطبيق SQMOTION فوراً بين تطبيقات جهازك.'
                    : 'Tap "Add" in top right. SQMOTION will now appear with its app icon on your home screen.'}
                </p>
              </div>
            </motion.div>

            {/* Pro Benefits Banner */}
            <motion.div
              variants={staggerItemVariants}
              className="bg-[var(--app-accent-surface)] p-3 rounded-2xl border border-[var(--app-accent-border)] flex items-center gap-3"
            >
              <Sparkles className="w-5 h-5 text-[var(--app-accent-bright)] shrink-0" />
              <p className="text-[10.5px] text-slate-200 leading-relaxed font-bold">
                {lang === 'ar'
                  ? 'عند فتحه من الشاشة الرئيسية، يعمل التطبيق بملء الشاشة مع حواف النوتش (Dynamic Island) وحفظ المشاريع بدون إنترنت.'
                  : 'When launched from Home Screen, it opens standalone with Dynamic Island safe area support and offline capability.'}
              </p>
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            variants={staggerItemVariants}
            className="p-3.5 bg-[#121319] border-t border-white/10 flex items-center justify-end gap-2"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              style={{ boxShadow: '0 0 16px var(--app-accent-glow)' }}
              className="w-full py-2.5 rounded-xl bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-black text-xs transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'فهمت، شكراً' : 'Got it, thanks'}
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
