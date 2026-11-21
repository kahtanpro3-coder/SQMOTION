import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CameraViewMode, PreviewQuality } from '../types';
import {
  PanelRimSheen,
  sideDrawerLeftVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface AlightMotionSideToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  zoom: number;
  onSetZoom: (zoom: number | ((prev: number) => number)) => void;
  cameraViewMode: CameraViewMode;
  onChangeCameraViewMode: (mode: CameraViewMode) => void;
  lang: 'ar' | 'en';
  previewQuality?: PreviewQuality;
  onSetPreviewQuality?: (q: PreviewQuality) => void;
}

export const AlightMotionSideToolbar: React.FC<AlightMotionSideToolbarProps> = ({
  isOpen,
  onClose: _onClose,
  showGrid,
  onToggleGrid,
  zoom,
  onSetZoom,
  cameraViewMode,
  onChangeCameraViewMode,
  lang,
  previewQuality = 'auto',
  onSetPreviewQuality,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="side-toolbar-drawer"
          variants={sideDrawerLeftVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          dir="ltr"
          className="absolute top-0 bottom-0 left-0 w-16 bg-[#13151B]/95 backdrop-blur-xl border-r border-white/[0.08] z-30 flex flex-col justify-between select-none shadow-2xl overflow-hidden"
        >
          <PanelRimSheen roundedClass="rounded-none" />

          {/* Top Tool Buttons */}
          <motion.div
            variants={staggerFastContainerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 flex flex-col items-center py-2 space-y-1 w-full"
          >
            {/* 1. Preview / Framing Icon */}
            <motion.button
              variants={staggerItemVariants}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                const canvas = document.querySelector('canvas');
                if (canvas) {
                  canvas.requestFullscreen().catch(() => {});
                }
              }}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={lang === 'ar' ? 'معاينة ملء الشاشة' : 'Framing Preview'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9V5h4" />
                <path d="M15 5h4v4" />
                <path d="M19 15v4h-4" />
                <path d="M9 19H5v-4" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </motion.button>

            {/* 2. Grid Toggle Icon */}
            <motion.button
              variants={staggerItemVariants}
              whileTap={{ scale: 0.92 }}
              onClick={onToggleGrid}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                showGrid
                  ? 'text-[var(--app-accent-bright)] bg-[rgba(var(--app-accent-rgb),0.2)] shadow-[0_0_10px_rgba(var(--app-accent-rgb),0.3)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title={lang === 'ar' ? 'إظهار / إخفاء الشبكة' : 'Toggle Grid'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="4" strokeWidth="1.8" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
              </svg>
            </motion.button>

            {/* 3. Layers / 3D Space Studio Perspective Mode */}
            <motion.button
              variants={staggerItemVariants}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                onChangeCameraViewMode(
                  cameraViewMode === 'third_person' ? 'first_person' : 'third_person'
                );
              }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                cameraViewMode === 'third_person'
                  ? 'text-[var(--app-accent-bright)] bg-[rgba(var(--app-accent-rgb),0.2)] shadow-[0_0_10px_rgba(var(--app-accent-rgb),0.3)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title={
                lang === 'ar'
                  ? 'طبقات الفضاء ثلاثي الأبعاد 3D'
                  : '3D Space Layers Studio'
              }
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <polygon points="12,2 21,7 12,12 3,7" stroke="currentColor" strokeWidth="1.8" fill={cameraViewMode === 'third_person' ? 'var(--app-accent-bright)' : 'none'} fillOpacity="0.25" />
                <polyline points="3,11.5 12,16.5 21,11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="3,16 12,21 21,16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>

            {/* 4. Camera View / Lens Icon */}
            <motion.button
              variants={staggerItemVariants}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                onChangeCameraViewMode('first_person');
              }}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                cameraViewMode === 'first_person'
                  ? 'text-[var(--app-accent-bright)] bg-[rgba(var(--app-accent-rgb),0.2)] shadow-[0_0_10px_rgba(var(--app-accent-rgb),0.3)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title={lang === 'ar' ? 'منظور عدسة الكاميرا' : 'Camera Lens View'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7z" fill="currentColor" fillOpacity="0.2" />
                <rect x="1" y="5" width="15" height="14" rx="3" strokeWidth="1.8" />
                <circle cx="8.5" cy="12" r="2.5" />
              </svg>
            </motion.button>

            {/* 5. Preview Quality Mode (Full -> Medium -> Low -> Auto) */}
            {onSetPreviewQuality && (
              <motion.button
                variants={staggerItemVariants}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  const cycle: Record<PreviewQuality, PreviewQuality> = {
                    full: 'medium',
                    medium: 'low',
                    low: 'auto',
                    auto: 'full',
                  };
                  onSetPreviewQuality(cycle[previewQuality]);
                }}
                className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center transition-colors border cursor-pointer ${
                  previewQuality === 'full'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : previewQuality === 'medium'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : previewQuality === 'low'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                }`}
                title={
                  lang === 'ar'
                    ? `جودة المعاينة: ${
                        previewQuality === 'full'
                          ? 'كاملة (100%)'
                          : previewQuality === 'medium'
                          ? 'وسط (50%)'
                          : previewQuality === 'low'
                          ? 'منخفض (25%)'
                          : 'تلقائي (ذكي 60FPS)'
                      } - اضغط للتبديل`
                    : `Preview Quality: ${previewQuality.toUpperCase()} - click to switch`
                }
              >
                <span className="text-[9px] font-black uppercase font-mono tracking-tighter leading-none">
                  {previewQuality === 'full' ? '100%' : previewQuality === 'medium' ? '50%' : previewQuality === 'low' ? '25%' : 'AUTO'}
                </span>
                <span className="text-[8px] opacity-80 mt-0.5 leading-none">
                  {lang === 'ar' ? 'دقة' : 'RES'}
                </span>
              </motion.button>
            )}
          </motion.div>

          {/* Bottom Zoom Strip (Plus, Percentage Display, Minus) */}
          <div className="relative z-10 w-full bg-[#0F1116] border-t border-white/[0.08] py-2 px-1 flex flex-col items-center justify-center space-y-1">
            {/* Zoom In (+) */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onSetZoom((z: number) => Math.min(3, Math.round((z + 0.1) * 10) / 10))}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-mono text-xl font-bold cursor-pointer"
              title={lang === 'ar' ? 'تكبير (+)' : 'Zoom In (+)'}
            >
              +
            </motion.button>

            {/* Percentage Display */}
            <button
              onClick={() => onSetZoom(1.0)}
              className="py-1 px-1 text-[11px] font-mono font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={lang === 'ar' ? 'إعادة التعيين لـ 100%' : 'Reset to 100%'}
            >
              {Math.round(zoom * 100)}%
            </button>

            {/* Zoom Out (-) */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => onSetZoom((z: number) => Math.max(0.2, Math.round((z - 0.1) * 10) / 10))}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-mono text-xl font-bold cursor-pointer"
              title={lang === 'ar' ? 'تصغير (-)' : 'Zoom Out (-)'}
            >
              -
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
