import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  PanelRimSheen,
  backdropVariants,
  bottomSheetVariants,
  staggerContainerVariants,
  staggerItemVariants,
  dropdownVariants,
  dropdownUpVariants,
  centerModalVariants,
} from './MotionPrimitives';
import { Project, Language, PreviewQuality } from '../types';
import {
  X,
  ChevronDown,
  Edit3,
  Check,
  Trash2,
  Share2,
  History,
  Users,
} from 'lucide-react';

interface ProjectSettingsModalProps {
  project: Project;
  lang: Language;
  onUpdateSettings: (settings: Project['settings']) => void;
  onDeleteProject?: () => void;
  onOpenExport?: () => void;
  onOpenHistory?: () => void;
  onOpenCollab?: () => void;
  onClose: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  project,
  lang,
  onUpdateSettings,
  onDeleteProject,
  onOpenExport,
  onOpenHistory,
  onOpenCollab,
  onClose,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  // Current aspect ratio determination
  const determineAspect = (): '16:9' | '9:16' | '4:5' | '1:1' | '4:3' | 'custom' => {
    const ratio = project.settings.width / project.settings.height;
    if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
    if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16';
    if (Math.abs(ratio - 4 / 5) < 0.05) return '4:5';
    if (Math.abs(ratio - 1) < 0.05) return '1:1';
    if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
    return '16:9';
  };

  const [selectedAspect, setSelectedAspect] = useState<'16:9' | '9:16' | '4:5' | '1:1' | '4:3'>(
    determineAspect() === 'custom' ? '16:9' : (determineAspect() as any)
  );

  // Resolution determination
  const determineRes = (): '1440p' | '1080p' | '720p' | '4K' => {
    const h = project.settings.height;
    const w = project.settings.width;
    const minDim = Math.min(w, h);
    if (minDim >= 2000) return '4K';
    if (minDim >= 1400) return '1440p';
    if (minDim >= 1000) return '1080p';
    return '720p';
  };

  const [selectedResolution, setSelectedResolution] = useState<'1440p' | '1080p' | '720p' | '4K'>(
    determineRes()
  );
  const [selectedFps, setSelectedFps] = useState<number>(project.settings.fps || 120);
  useEffect(() => {
    if (project.settings.fps) {
      setSelectedFps(project.settings.fps);
    }
  }, [project.settings.fps]);
  const rawBg = project.settings.backgroundColor || '#000000';
  const normalizedInitBg =
    rawBg === '#00000000' || rawBg === 'transparent' || rawBg === 'rgba(0,0,0,0)'
      ? 'transparent'
      : rawBg;
  const [selectedBg, setSelectedBg] = useState<string>(normalizedInitBg);
  const [selectedQuality, setSelectedQuality] = useState<PreviewQuality>(
    project.settings.previewQuality || 'auto'
  );

  // Dropdown states
  const [openResDropdown, setOpenResDropdown] = useState<boolean>(false);
  const [openFpsDropdown, setOpenFpsDropdown] = useState<boolean>(false);
  const [openBgDropdown, setOpenBgDropdown] = useState<boolean>(false);
  const [openQualityDropdown, setOpenQualityDropdown] = useState<boolean>(false);

  // Apply changes helper
  const applyDimensions = (
    aspect: '16:9' | '9:16' | '4:5' | '1:1' | '4:3',
    res: '1440p' | '1080p' | '720p' | '4K',
    fps: number,
    bg: string,
    quality?: PreviewQuality
  ) => {
    let baseShort = 1440;
    if (res === '720p') baseShort = 720;
    else if (res === '1080p') baseShort = 1080;
    else if (res === '1440p') baseShort = 1440;
    else if (res === '4K') baseShort = 2160;

    let w = 2560;
    let h = 1440;

    switch (aspect) {
      case '16:9':
        w = Math.round((baseShort * 16) / 9);
        h = baseShort;
        break;
      case '9:16':
        w = baseShort;
        h = Math.round((baseShort * 16) / 9);
        break;
      case '1:1':
        w = baseShort;
        h = baseShort;
        break;
      case '4:5':
        w = baseShort;
        h = Math.round((baseShort * 5) / 4);
        break;
      case '4:3':
        w = Math.round((baseShort * 4) / 3);
        h = baseShort;
        break;
    }

    onUpdateSettings({
      ...project.settings,
      width: w,
      height: h,
      fps: fps,
      backgroundColor: bg,
      previewQuality: quality !== undefined ? quality : selectedQuality,
      settingsUpdatedAt: Date.now(),
    });
  };

  const handleAspectChange = (aspect: '16:9' | '9:16' | '4:5' | '1:1' | '4:3') => {
    setSelectedAspect(aspect);
    applyDimensions(aspect, selectedResolution, selectedFps, selectedBg, selectedQuality);
  };

  const handleResChange = (res: '1440p' | '1080p' | '720p' | '4K') => {
    setSelectedResolution(res);
    setOpenResDropdown(false);
    applyDimensions(selectedAspect, res, selectedFps, selectedBg, selectedQuality);
  };

  const handleFpsChange = (fps: number) => {
    setSelectedFps(fps);
    setOpenFpsDropdown(false);
    applyDimensions(selectedAspect, selectedResolution, fps, selectedBg, selectedQuality);
  };

  const handleBgChange = (bg: string) => {
    setSelectedBg(bg);
    setOpenBgDropdown(false);
    applyDimensions(selectedAspect, selectedResolution, selectedFps, bg, selectedQuality);
  };

  const handleQualityChange = (q: PreviewQuality) => {
    setSelectedQuality(q);
    setOpenQualityDropdown(false);
    try {
      localStorage.setItem('sqmotion_preview_quality', q);
    } catch {}
    applyDimensions(selectedAspect, selectedResolution, selectedFps, selectedBg, q);
  };

  // Background choices
  const bgOptions = [
    { label: lang === 'ar' ? 'أسود' : 'Black', color: '#000000', id: '#000000' },
    { label: lang === 'ar' ? 'أبيض' : 'White', color: '#FFFFFF', id: '#FFFFFF' },
    { label: lang === 'ar' ? 'رمادي داكن' : 'Dark Gray', color: '#1E2433', id: '#1E2433' },
    { label: lang === 'ar' ? 'شفاف' : 'Transparent', color: 'transparent', id: 'transparent' },
  ];

  // Calculate duration string e.g. "00:08"
  const totalSeconds = Math.round((project.settings.durationFrames || 240) / (project.settings.fps || 30));
  const minutesStr = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secondsStr = String(totalSeconds % 60).padStart(2, '0');
  const durationFormatted = `${minutesStr}:${secondsStr}`;

  return (
    <motion.div
      key="proj-settings-backdrop"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col justify-end select-none overflow-hidden gpu-layer"
      style={AMBIENT_BACKDROP_STYLE}
    >
      <AmbientModalGlow />

      <motion.div
        key="proj-settings-panel"
        variants={bottomSheetVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        style={{
          willChange: 'transform, opacity',
          transform: 'translate3d(0,0,0)',
          boxShadow: '0 -25px 60px rgba(0,0,0,0.85), 0 0 35px rgba(var(--app-accent-rgb), 0.1), inset 0 1px 1px rgba(255,255,255,0.2)',
        }}
        className="bg-[#0D0E13]/[0.98] border-t border-x border-white/15 rounded-t-[38px] w-full max-w-lg mx-auto p-5 sm:p-6 pb-6 text-white relative overflow-hidden gpu-layer"
      >
        <PanelRimSheen roundedClass="rounded-t-[36px]" />

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 space-y-2"
        >
        {/* Top Header Row with Close 'X' Button on Right */}
        <motion.div variants={staggerItemVariants} className="flex items-center justify-between pb-2">
          <div className="text-xs font-bold text-slate-400">
            {project.settings.width} × {project.settings.height}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 rounded-full active:scale-90 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </motion.div>

        {/* Aspect Ratio Selector Row */}
        <motion.div variants={staggerItemVariants} className="flex items-center justify-between gap-1.5 py-2 px-1">
          {/* Custom Aspect Pencil Button */}
          <button
            type="button"
            onClick={() => handleAspectChange('16:9')}
            className="w-10 h-10 rounded-xl bg-[#15171E] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-[var(--app-accent-border)] shadow-sm active:scale-95 transition-all"
            title="Custom Aspect"
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* 4:3 Ratio */}
          <button
            type="button"
            onClick={() => handleAspectChange('4:3')}
            style={selectedAspect === '4:3' ? { boxShadow: '0 0 12px var(--app-accent-glow)' } : undefined}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              selectedAspect === '4:3'
                ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)]'
                : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/20'
            }`}
          >
            4:3
          </button>

          {/* 1:1 Ratio */}
          <button
            type="button"
            onClick={() => handleAspectChange('1:1')}
            style={selectedAspect === '1:1' ? { boxShadow: '0 0 12px var(--app-accent-glow)' } : undefined}
            className={`px-3.5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
              selectedAspect === '1:1'
                ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)]'
                : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/20'
            }`}
          >
            1:1
          </button>

          {/* 4:5 Ratio */}
          <button
            type="button"
            onClick={() => handleAspectChange('4:5')}
            style={selectedAspect === '4:5' ? { boxShadow: '0 0 12px var(--app-accent-glow)' } : undefined}
            className={`px-3.5 py-3.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              selectedAspect === '4:5'
                ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)]'
                : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/20'
            }`}
          >
            4:5
          </button>

          {/* 9:16 Ratio (Tall box) */}
          <button
            type="button"
            onClick={() => handleAspectChange('9:16')}
            style={selectedAspect === '9:16' ? { boxShadow: '0 0 12px var(--app-accent-glow)' } : undefined}
            className={`px-3.5 py-4 rounded-xl text-xs font-bold transition-all shadow-sm ${
              selectedAspect === '9:16'
                ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)]'
                : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/20'
            }`}
          >
            9:16
          </button>

          {/* 16:9 Ratio */}
          <button
            type="button"
            onClick={() => handleAspectChange('16:9')}
            style={selectedAspect === '16:9' ? { boxShadow: '0 0 15px var(--app-accent-glow)' } : undefined}
            className={`px-4 py-3 rounded-xl text-xs font-black transition-all shadow-md ${
              selectedAspect === '16:9'
                ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] border border-[var(--app-accent-bright)]'
                : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/20'
            }`}
          >
            16:9
          </button>
        </motion.div>

        {/* Settings Rows (RTL: Dropdown Box on Left, Arabic Label on Right) */}
        <motion.div variants={staggerItemVariants} className="space-y-3.5 pt-2 pb-3">
          {/* Row 1: الدقة (Resolution) */}
          <div className="flex items-center justify-between gap-4 relative">
            {/* Left Dropdown Box */}
            <div className="relative w-48 sm:w-56">
              <button
                type="button"
                onClick={() => {
                  setOpenResDropdown(!openResDropdown);
                  setOpenFpsDropdown(false);
                  setOpenBgDropdown(false);
                  setOpenQualityDropdown(false);
                }}
                className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-slate-400" />
                <span>{selectedResolution}</span>
              </button>

              <AnimatePresence>
                {openResDropdown && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute top-11 left-0 right-0 bg-[#12141A] border border-white/15 rounded-xl p-1 shadow-2xl z-50 text-xs font-bold text-white space-y-1 backdrop-blur-xl"
                  >
                    {(['1440p', '1080p', '720p', '4K'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleResChange(r)}
                        className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                          selectedResolution === r ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black' : 'text-slate-300'
                        }`}
                      >
                        <span className="font-mono text-[11px] text-slate-400">
                          {r === '1440p' ? 'QHD' : r === '1080p' ? 'FHD' : r === '720p' ? 'HD' : 'UHD'}
                        </span>
                        <span>{r}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Label */}
            <div className="text-right">
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {lang === 'ar' ? 'الدقة' : 'Resolution'}
              </span>
            </div>
          </div>

          {/* Row 2: معدل الإطار (Frame Rate) */}
          <div className="flex items-center justify-between gap-4 relative">
            {/* Left Dropdown Box */}
            <div className="relative w-48 sm:w-56">
              <button
                type="button"
                onClick={() => {
                  setOpenFpsDropdown(!openFpsDropdown);
                  setOpenResDropdown(false);
                  setOpenBgDropdown(false);
                  setOpenQualityDropdown(false);
                }}
                className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-slate-400" />
                <span className="font-mono text-[var(--app-accent-light)]">fps {selectedFps}</span>
              </button>

              <AnimatePresence>
                {openFpsDropdown && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute top-11 left-0 right-0 bg-[#12141A] border border-white/15 rounded-xl p-1 shadow-2xl z-50 text-xs font-bold text-white space-y-1 backdrop-blur-xl"
                  >
                    {[120, 60, 30, 24].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => handleFpsChange(f)}
                        className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                          selectedFps === f ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black' : 'text-slate-300'
                        }`}
                      >
                        <span className="font-mono text-[11px] text-slate-400">
                          {f === 120 ? 'Ultra Smooth' : f === 60 ? 'Smooth' : f === 30 ? 'Standard' : 'Cinema'}
                        </span>
                        <span className="font-mono">fps {f}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Label */}
            <div className="text-right">
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {lang === 'ar' ? 'معدل الإطار' : 'Frame Rate'}
              </span>
            </div>
          </div>

          {/* Row 3: الخلفية (Background) */}
          <div className="flex items-center justify-between gap-4 relative">
            {/* Left Dropdown Box */}
            <div className="relative w-48 sm:w-56">
              <button
                type="button"
                onClick={() => {
                  setOpenBgDropdown(!openBgDropdown);
                  setOpenResDropdown(false);
                  setOpenFpsDropdown(false);
                  setOpenQualityDropdown(false);
                }}
                className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-slate-400" />
                <div className="flex items-center gap-2">
                  <span>
                    {selectedBg === '#000000'
                      ? (lang === 'ar' ? 'أسود' : 'Black')
                      : selectedBg === '#FFFFFF'
                      ? (lang === 'ar' ? 'أبيض' : 'White')
                      : selectedBg === 'transparent'
                      ? (lang === 'ar' ? 'شفاف' : 'Transparent')
                      : (lang === 'ar' ? 'رمادي' : 'Gray')}
                  </span>
                  <div
                    className="w-4 h-4 rounded-md border border-white/30 shadow-inner"
                    style={{
                      backgroundColor: selectedBg === 'transparent' ? '#141B29' : selectedBg,
                      backgroundImage:
                        selectedBg === 'transparent'
                          ? 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)'
                          : 'none',
                      backgroundSize: '6px 6px',
                    }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {openBgDropdown && (
                  <motion.div
                    variants={dropdownUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute bottom-full mb-1.5 left-0 right-0 bg-[#12141A] border border-white/15 rounded-xl p-1 shadow-2xl z-50 text-xs font-bold text-white space-y-1 backdrop-blur-xl"
                  >
                    {bgOptions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleBgChange(b.id)}
                        className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                          selectedBg === b.id ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black' : 'text-slate-300'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded border border-white/20"
                          style={
                            b.color === 'transparent'
                              ? {
                                  backgroundColor: '#1a1e26',
                                  backgroundImage:
                                    'linear-gradient(45deg, #525866 25%, transparent 25%), linear-gradient(-45deg, #525866 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #525866 75%), linear-gradient(-45deg, transparent 75%, #525866 75%)',
                                  backgroundSize: '8px 8px',
                                  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                                }
                              : { backgroundColor: b.color }
                          }
                        />
                        <span>{b.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Label */}
            <div className="text-right">
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {lang === 'ar' ? 'الخلفية' : 'Background'}
              </span>
            </div>
          </div>

          {/* Row 4: جودة المعاينة (Preview Quality) */}
          <div className="flex items-center justify-between gap-4 relative">
            {/* Left Dropdown Box */}
            <div className="relative w-48 sm:w-56">
              <button
                type="button"
                onClick={() => {
                  setOpenQualityDropdown(!openQualityDropdown);
                  setOpenResDropdown(false);
                  setOpenFpsDropdown(false);
                  setOpenBgDropdown(false);
                }}
                className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-slate-400" />
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      selectedQuality === 'full'
                        ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                        : selectedQuality === 'medium'
                        ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]'
                        : selectedQuality === 'low'
                        ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                        : 'bg-blue-400 shadow-[0_0_8px_#3b82f6]'
                    }`}
                  />
                  <span>
                    {selectedQuality === 'full'
                      ? (lang === 'ar' ? 'كاملة (100%)' : 'Full (100%)')
                      : selectedQuality === 'medium'
                      ? (lang === 'ar' ? 'وسط (50%)' : 'Medium (50%)')
                      : selectedQuality === 'low'
                      ? (lang === 'ar' ? 'منخفض (25%)' : 'Low (25%)')
                      : (lang === 'ar' ? 'تلقائي (ذكي)' : 'Auto (Smart)')}
                  </span>
                </div>
              </button>

              <AnimatePresence>
                {openQualityDropdown && (
                  <motion.div
                    variants={dropdownUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute bottom-full mb-1.5 left-0 right-0 bg-[#12141A] border border-white/15 rounded-xl p-1 shadow-2xl z-50 text-xs font-bold text-white space-y-1 backdrop-blur-xl"
                  >
                    {[
                      { id: 'full', labelAr: 'كاملة (100% دقة أصلية)', labelEn: 'Full (100% Native)', tag: '100%' },
                      { id: 'medium', labelAr: 'وسط (50% متوازن)', labelEn: 'Medium (50% Balanced)', tag: '50%' },
                      { id: 'low', labelAr: 'منخفض (25% فائق السرعة)', labelEn: 'Low (25% Fast)', tag: '25%' },
                      { id: 'auto', labelAr: 'تلقائي (تكيف ذكي 60FPS)', labelEn: 'Auto (Smart 60FPS)', tag: 'ذكي' },
                    ].map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => handleQualityChange(q.id as PreviewQuality)}
                        className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                          selectedQuality === q.id ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black' : 'text-slate-300'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-[var(--app-accent-bright)] bg-[var(--app-accent-surface)] px-1.5 py-0.5 rounded border border-[var(--app-accent-border)]">
                          {q.tag}
                        </span>
                        <span>{lang === 'ar' ? q.labelAr : q.labelEn}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Label */}
            <div className="text-right">
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {lang === 'ar' ? 'جودة المعاينة' : 'Preview Quality'}
              </span>
            </div>
          </div>
        </motion.div>

        {(onOpenHistory || onOpenCollab) && (
          <motion.div variants={staggerItemVariants} className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
            {onOpenHistory && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHistory();
                }}
                className="py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <History className="w-4 h-4 text-[var(--app-accent-bright)] shrink-0" />
                <span>{lang === 'ar' ? 'السجل والإصدارات' : 'History & Versions'}</span>
              </button>
            )}
            {onOpenCollab && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCollab();
                }}
                className="py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/10 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-sky-400 shrink-0" />
                <span>{lang === 'ar' ? 'العمل التعاوني' : 'Collaboration'}</span>
              </button>
            )}
          </motion.div>
        )}

        {/* Export Video Action */}
        {onOpenExport && (
          <motion.div variants={staggerItemVariants} className="pt-2 border-t border-white/10">
            <motion.button
              type="button"
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                onClose();
                onOpenExport();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[var(--app-accent-surface)] hover:bg-[var(--app-accent-surface-hover)] text-[var(--app-accent-bright)] border border-[var(--app-accent-border)] font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تصدير وحفظ الفيديو' : 'Export & Save Video'}</span>
            </motion.button>
          </motion.div>
        )}

        {/* Delete Project Action */}
        {onDeleteProject && (
          <motion.div variants={staggerItemVariants} className="pt-2 border-t border-white/10">
            <AnimatePresence mode="popLayout" initial={false}>
              {!showConfirmDelete ? (
                <motion.button
                  key="delete-trigger"
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowConfirmDelete(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حذف هذا المشروع' : 'Delete This Project'}</span>
                </motion.button>
              ) : (
                <motion.div
                  key="delete-confirm"
                  variants={centerModalVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2 text-center"
                >
                  <p className="text-xs font-bold text-rose-200">
                    {lang === 'ar'
                      ? 'هل تريد بالتأكيد حذف هذا المشروع نهائياً؟'
                      : 'Are you sure you want to delete this project?'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onDeleteProject();
                      }}
                      className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer active:scale-95"
                    >
                      {lang === 'ar' ? 'نعم، تأكيد الحذف' : 'Yes, Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(false)}
                      className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 font-medium text-xs transition-colors cursor-pointer active:scale-95"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Bottom Centered Subtitle: إجمالي وقت التحرير */}
        <motion.div variants={staggerItemVariants} className="text-center pt-2 pb-1">
          <span className="text-[11px] text-slate-500 font-medium">
            {lang === 'ar' ? `إجمالي وقت التحرير: ${durationFormatted}` : `Total Editing Time: ${durationFormatted}`}
          </span>
        </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
