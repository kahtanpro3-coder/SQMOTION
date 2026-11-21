import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, ChevronDown, Edit3, XCircle } from 'lucide-react';
import { Project, Language } from '../types';
import { getNextProjectName } from '../utils/projectNaming';
import {
  AMBIENT_BACKDROP_STYLE,
  AmbientModalGlow,
  PILL_SPRING,
  PanelRimSheen,
  backdropVariants,
  bottomSheetVariants,
  dropdownVariants,
  dropdownUpVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedProjects: Project[];
  lang: Language;
  defaultResolution?: '720p' | '1080p' | '1440p' | '4K';
  defaultFps?: number;
  onCreateNewProject: (settings: {
    name: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    backgroundColor: string;
  }) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  savedProjects,
  lang,
  defaultResolution = '1080p',
  defaultFps = 60,
  onCreateNewProject,
}) => {
  // Modal state
  const [createType, setCreateType] = useState<'project' | 'element'>('project');
  const [newProjName, setNewProjName] = useState<string>(() =>
    getNextProjectName(savedProjects, lang)
  );
  const [newProjAspect, setNewProjAspect] = useState<'16:9' | '9:16' | '1:1' | '4:5' | '4:3'>('16:9');
  const [newProjResolution, setNewProjResolution] = useState<'1440p' | '1080p' | '720p' | '4K'>(defaultResolution);
  const [newProjFps, setNewProjFps] = useState<number>(defaultFps);
  const [newProjBg, setNewProjBg] = useState<string>('#000000');
  const [newProjBgName, setNewProjBgName] = useState<string>(lang === 'ar' ? 'أسود' : 'Black');

  React.useEffect(() => {
    if (isOpen) {
      setNewProjName(getNextProjectName(savedProjects, lang));
      setNewProjResolution(defaultResolution);
      setNewProjFps(defaultFps);
    }
  }, [isOpen, defaultResolution, defaultFps, lang]);

  // Dropdowns state
  const [openResDropdown, setOpenResDropdown] = useState<boolean>(false);
  const [openFpsDropdown, setOpenFpsDropdown] = useState<boolean>(false);
  const [openBgDropdown, setOpenBgDropdown] = useState<boolean>(false);

  const getCalculatedDimensions = (
    aspect: '16:9' | '9:16' | '1:1' | '4:5' | '4:3',
    res: '1440p' | '1080p' | '720p' | '4K'
  ) => {
    let baseShort = 1440;
    if (res === '720p') baseShort = 720;
    else if (res === '1080p') baseShort = 1080;
    else if (res === '1440p') baseShort = 1440;
    else if (res === '4K') baseShort = 2160;

    switch (aspect) {
      case '16:9':
        return { width: Math.round((baseShort * 16) / 9), height: baseShort };
      case '9:16':
        return { width: baseShort, height: Math.round((baseShort * 16) / 9) };
      case '1:1':
        return { width: baseShort, height: baseShort };
      case '4:5':
        return { width: baseShort, height: Math.round((baseShort * 5) / 4) };
      case '4:3':
        return { width: Math.round((baseShort * 4) / 3), height: baseShort };
      default:
        return { width: 1920, height: 1080 };
    }
  };

  const handleCreateProjectSubmit = () => {
    const dim = getCalculatedDimensions(newProjAspect, newProjResolution);
    const defaultSequentialName = getNextProjectName(savedProjects, lang);
    onCreateNewProject({
      name: newProjName.trim() || defaultSequentialName,
      width: dim.width,
      height: dim.height,
      fps: newProjFps,
      duration: 10,
      backgroundColor: newProjBg === 'transparent' ? 'transparent' : newProjBg,
    });
    onClose();
  };

  // Staggered Child Animation Variants
  const containerVariants = staggerContainerVariants;
  const itemVariants = staggerItemVariants;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="project-creator-backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col justify-end select-none overflow-hidden gpu-layer"
          style={AMBIENT_BACKDROP_STYLE}
        >
          {/* Subtle Ambient Radial Glow at bottom */}
          <AmbientModalGlow />

          {/* ================= 240HZ HARDWARE-ACCELERATED SPRING BOTTOM SHEET ================= */}
          <motion.div
            key="project-creator-panel"
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
            className="bg-[#0D0E13]/[0.98] border-t border-x border-white/15 rounded-t-[38px] w-full max-w-lg mx-auto p-5 sm:p-6 pb-8 space-y-4 text-white relative overflow-hidden gpu-layer"
          >
            <PanelRimSheen roundedClass="rounded-t-[36px]" />

            {/* Staggered Content Container */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4 relative z-10"
            >
              {/* 1. Top Segmented Pill: [العنصر | المشروع] */}
              <motion.div
                variants={itemVariants}
                className="bg-[#15171E]/90 border border-white/10 p-1 rounded-full flex items-center justify-between w-64 mx-auto shadow-inner relative"
              >
                <button
                  type="button"
                  onClick={() => setCreateType('element')}
                  className={`relative flex-1 py-1.5 rounded-full text-xs font-black transition-all text-center cursor-pointer ${
                    createType === 'element'
                      ? 'text-[var(--app-accent-contrast)] font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {createType === 'element' && (
                    <motion.div
                      layoutId="createTypeIndicator"
                      style={{ boxShadow: '0 0 12px var(--app-accent-glow)' }}
                      className="absolute inset-0 bg-[var(--app-accent-solid)] rounded-full -z-0"
                      transition={PILL_SPRING}
                    />
                  )}
                  <span className="relative z-10">{lang === 'ar' ? 'العنصر' : 'Element'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateType('project')}
                  className={`relative flex-1 py-1.5 rounded-full text-xs font-black transition-all text-center cursor-pointer ${
                    createType === 'project'
                      ? 'text-[var(--app-accent-contrast)] font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {createType === 'project' && (
                    <motion.div
                      layoutId="createTypeIndicator"
                      style={{ boxShadow: '0 0 12px var(--app-accent-glow)' }}
                      className="absolute inset-0 bg-[var(--app-accent-solid)] rounded-full -z-0"
                      transition={PILL_SPRING}
                    />
                  )}
                  <span className="relative z-10">{lang === 'ar' ? 'المشروع' : 'Project'}</span>
                </button>
              </motion.div>

              {/* 2. Project Name Field with Clear Button & Underline */}
              <motion.div
                variants={itemVariants}
                className="pt-1 pb-1 border-b border-white/15 flex items-center justify-between gap-2 px-1 focus-within:border-[var(--app-accent-bright)] transition-colors"
              >
                <div className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => setNewProjName('')}
                    className="text-slate-400 hover:text-white active:scale-90 transition-all cursor-pointer"
                    title="Clear"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder={getNextProjectName(savedProjects, lang)}
                    className="bg-transparent text-sm sm:text-base font-bold text-white placeholder:text-slate-500 focus:outline-none w-full"
                  />
                </div>
              </motion.div>

              {/* 3. Aspect Ratio Selector Buttons */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-between gap-1.5 py-1 px-1"
              >
                {/* Custom Aspect Pencil Button */}
                <button
                  type="button"
                  onClick={() => setNewProjAspect('16:9')}
                  className="w-9 h-9 rounded-xl bg-[#15171E] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white hover:border-[var(--app-accent-border)] shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Custom"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {/* 4:3 Ratio */}
                <button
                  type="button"
                  onClick={() => setNewProjAspect('4:3')}
                  style={newProjAspect === '4:3' ? { boxShadow: '0 0 15px var(--app-accent-glow)' } : undefined}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    newProjAspect === '4:3'
                      ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)] scale-105 animate-neon-green-glow'
                      : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/25 hover:scale-102 active:scale-95'
                  }`}
                >
                  4:3
                </button>

                {/* 1:1 Ratio */}
                <button
                  type="button"
                  onClick={() => setNewProjAspect('1:1')}
                  style={newProjAspect === '1:1' ? { boxShadow: '0 0 15px var(--app-accent-glow)' } : undefined}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    newProjAspect === '1:1'
                      ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)] scale-105 animate-neon-green-glow'
                      : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/25 hover:scale-102 active:scale-95'
                  }`}
                >
                  1:1
                </button>

                {/* 4:5 Ratio */}
                <button
                  type="button"
                  onClick={() => setNewProjAspect('4:5')}
                  style={newProjAspect === '4:5' ? { boxShadow: '0 0 15px var(--app-accent-glow)' } : undefined}
                  className={`px-3 py-3 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    newProjAspect === '4:5'
                      ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)] scale-105 animate-neon-green-glow'
                      : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/25 hover:scale-102 active:scale-95'
                  }`}
                >
                  4:5
                </button>

                {/* 9:16 Ratio */}
                <button
                  type="button"
                  onClick={() => setNewProjAspect('9:16')}
                  style={newProjAspect === '9:16' ? { boxShadow: '0 0 15px var(--app-accent-glow)' } : undefined}
                  className={`px-3 py-3.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    newProjAspect === '9:16'
                      ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] font-black border border-[var(--app-accent-bright)] scale-105 animate-neon-green-glow'
                      : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/25 hover:scale-102 active:scale-95'
                  }`}
                >
                  9:16
                </button>

                {/* 16:9 Ratio */}
                <button
                  type="button"
                  onClick={() => setNewProjAspect('16:9')}
                  style={newProjAspect === '16:9' ? { boxShadow: '0 0 18px var(--app-accent-glow)' } : undefined}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md cursor-pointer ${
                    newProjAspect === '16:9'
                      ? 'bg-[var(--app-accent-solid)] text-[var(--app-accent-contrast)] border border-[var(--app-accent-bright)] scale-105 animate-neon-green-glow'
                      : 'bg-[#15171E] text-slate-300 border border-white/10 hover:border-white/25 hover:scale-102 active:scale-95'
                  }`}
                >
                  16:9
                </button>
              </motion.div>

              {/* 4. Settings Rows (RTL: Label on Right, Sleek Dropdown on Left) */}
              <motion.div variants={itemVariants} className="space-y-3 pt-1">
                {/* Row 1: الدقة (Resolution) */}
                <div className="flex items-center justify-between gap-4 relative">
                  {/* Left Dropdown Box */}
                  <div className="relative w-44 sm:w-48">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenResDropdown(!openResDropdown);
                        setOpenFpsDropdown(false);
                        setOpenBgDropdown(false);
                      }}
                      className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          openResDropdown ? 'rotate-180 text-[var(--app-accent-bright)]' : ''
                        }`}
                      />
                      <span>
                        {newProjResolution === '1440p'
                          ? '1440p (QHD)'
                          : newProjResolution === '1080p'
                          ? '1080p (FHD)'
                          : newProjResolution === '720p'
                          ? '720p (HD)'
                          : '4K (UHD)'}
                      </span>
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
                              onClick={() => {
                                setNewProjResolution(r);
                                setOpenResDropdown(false);
                              }}
                              className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                                newProjResolution === r
                                  ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black'
                                  : 'text-slate-300'
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

                  {/* Right Labels */}
                  <div className="text-right">
                    <div className="text-xs sm:text-sm font-extrabold text-white">
                      {lang === 'ar' ? 'الدقة' : 'Resolution'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {lang === 'ar' ? 'حجم التكوين' : 'Composition size'}
                    </div>
                    <div className="text-[10px] text-[var(--app-accent-bright)] font-mono">
                      {getCalculatedDimensions(newProjAspect, newProjResolution).width} ×{' '}
                      {getCalculatedDimensions(newProjAspect, newProjResolution).height}
                    </div>
                  </div>
                </div>

                {/* Row 2: معدل الإطار (Frame Rate) */}
                <div className="flex items-center justify-between gap-4 relative">
                  {/* Left Dropdown Box */}
                  <div className="relative w-44 sm:w-48">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenFpsDropdown(!openFpsDropdown);
                        setOpenResDropdown(false);
                        setOpenBgDropdown(false);
                      }}
                      className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          openFpsDropdown ? 'rotate-180 text-[var(--app-accent-bright)]' : ''
                        }`}
                      />
                      <span className="font-mono text-[var(--app-accent-light)]">fps {newProjFps}</span>
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
                              onClick={() => {
                                setNewProjFps(f);
                                setOpenFpsDropdown(false);
                              }}
                              className={`w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer ${
                                newProjFps === f
                                  ? 'bg-[var(--app-accent-surface)] text-[var(--app-accent-light)] font-black'
                                  : 'text-slate-300'
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
                    <div className="text-xs sm:text-sm font-extrabold text-white">
                      {lang === 'ar' ? 'معدل الإطار' : 'Frame Rate'}
                    </div>
                  </div>
                </div>

                {/* Row 3: الخلفية (Background) */}
                <div className="flex items-center justify-between gap-4 relative">
                  {/* Left Dropdown Box */}
                  <div className="relative w-44 sm:w-48">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenBgDropdown(!openBgDropdown);
                        setOpenResDropdown(false);
                        setOpenFpsDropdown(false);
                      }}
                      className="w-full bg-[#15171E] border border-white/10 hover:border-[var(--app-accent-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer"
                    >
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          openBgDropdown ? 'rotate-180 text-[var(--app-accent-bright)]' : ''
                        }`}
                      />
                      <div className="flex items-center gap-2">
                        <span>{newProjBgName}</span>
                        <div
                          className="w-4 h-4 rounded-sm border border-white/20 shadow-inner"
                          style={
                            newProjBg === 'transparent'
                              ? {
                                  backgroundColor: '#1a1e26',
                                  backgroundImage:
                                    'linear-gradient(45deg, #525866 25%, transparent 25%), linear-gradient(-45deg, #525866 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #525866 75%), linear-gradient(-45deg, transparent 75%, #525866 75%)',
                                  backgroundSize: '8px 8px',
                                  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                                }
                              : { backgroundColor: newProjBg }
                          }
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
                          {[
                            { name: lang === 'ar' ? 'أسود' : 'Black', color: '#000000' },
                            { name: lang === 'ar' ? 'أبيض' : 'White', color: '#FFFFFF' },
                            { name: lang === 'ar' ? 'رمادي داكن' : 'Dark Gray', color: '#181E29' },
                            { name: lang === 'ar' ? 'شفاف' : 'Transparent', color: 'transparent' },
                            { name: lang === 'ar' ? 'أخضر شاشة' : 'Green Screen', color: '#00FF00' },
                          ].map((b) => (
                            <button
                              key={b.name}
                              type="button"
                              onClick={() => {
                                setNewProjBg(b.color);
                                setNewProjBgName(b.name);
                                setOpenBgDropdown(false);
                              }}
                              className="w-full text-right px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <div
                                className="w-3.5 h-3.5 rounded-sm border border-white/20"
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
                              <span className="text-slate-200">{b.name}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right Label */}
                  <div className="text-right">
                    <div className="text-xs sm:text-sm font-extrabold text-white">
                      {lang === 'ar' ? 'الخلفية' : 'Background'}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 5. Bottom Create Project Action Button */}
              <motion.div variants={itemVariants} className="pt-3 flex items-center justify-between gap-3">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreateProjectSubmit}
                  style={{ boxShadow: '0 0 24px var(--app-accent-glow)' }}
                  className="w-full py-3.5 bg-[var(--app-accent-solid)] hover:bg-[var(--app-accent-solid-hover)] text-[var(--app-accent-contrast)] font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer animate-neon-green-glow"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{lang === 'ar' ? 'إنشاء مشروع' : 'Create Project'}</span>
                </motion.button>
              </motion.div>

              {/* 6. Bottom Centered Close (X) Button */}
              <motion.div variants={itemVariants} className="flex items-center justify-center pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full active:scale-90 transition-all p-1.5 cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
