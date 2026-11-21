import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Palette,
  Globe,
  SlidersHorizontal,
  Folder,
  Wand2,
  Monitor,
  Check,
  Focus,
  Share2,
} from 'lucide-react';
import { Language } from '../types';
import {
  AppSettings,
  AppThemeAccent,
  DefaultResolution,
  EditorUiScale,
  ExportTargetAspect,
  ExportTargetFormat,
  ExportTargetQuality,
  THEME_PALETTES,
  ThemeToneCount,
} from '../utils/appSettings';
import {
  canUseDirectoryPicker,
  clearPickedDirectoryHandle,
  pickExportMoviesDirectory,
} from '../utils/exportDirectoryStore';
import { VioletEnergyWavesBackdrop } from './VioletEnergyWavesBackdrop';
import {
  MODAL_EASE,
  PANEL_SPRING,
  PanelRimSheen,
  VIEW_SPRING,
  dropdownUpVariants,
  dropdownVariants,
  staggerFastContainerVariants,
  staggerItemVariants,
} from './MotionPrimitives';

interface SettingsViewProps {
  lang: Language;
  onSetLang: (lang: Language) => void;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onBack: () => void;
}

type OpenDropdown = 'resolution' | 'fps' | 'savePath' | 'uiScale' | null;

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  onSetLang,
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [expandedPanel, setExpandedPanel] = useState<'theme' | 'language' | null>(null);
  const [themeToneFilter, setThemeToneFilter] = useState<'all' | ThemeToneCount>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  const palette = THEME_PALETTES[settings.theme] || THEME_PALETTES.violet;
  const allThemeKeys = Object.keys(THEME_PALETTES) as AppThemeAccent[];
  const toneGroups: Array<{ count: ThemeToneCount; titleAr: string; titleEn: string }> = [
    { count: 3, titleAr: 'ثلاث ألوان', titleEn: '3 Colors (Tri-Neon)' },
    { count: 2, titleAr: 'لونين', titleEn: '2 Colors (Duo)' },
    { count: 1, titleAr: 'لون واحد', titleEn: '1 Color (Mono)' },
  ];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resolutionOptions: DefaultResolution[] = ['720p', '1080p', '1440p', '4K'];
  const fpsOptions: Array<24 | 30 | 60 | 120> = [24, 30, 60, 120];
  const savePathOptions = [
    '/storage/emulated/0/Movies/SQMOTION',
    '/Movies/SQMOTION',
    '/storage/emulated/0/SQMOTION',
    '/Documents/SQMOTION',
  ];
  const uiScaleOptions: Array<{ id: EditorUiScale; labelAr: string; labelEn: string }> = [
    { id: 'compact', labelAr: 'صغير', labelEn: 'Compact' },
    { id: 'normal', labelAr: 'عادي', labelEn: 'Normal' },
    { id: 'large', labelAr: 'كبير', labelEn: 'Large' },
  ];

  const currentUiScaleLabel =
    uiScaleOptions.find((o) => o.id === settings.editorUiScale)?.[
      lang === 'ar' ? 'labelAr' : 'labelEn'
    ] || (lang === 'ar' ? 'عادي' : 'Normal');

  const handleSelectDirectory = async () => {
    const picked = await pickExportMoviesDirectory();
    if (picked) {
      onUpdateSettings({
        ...settings,
        savePath: picked.displayPath,
        settingsExportUpdatedAt: Date.now(),
      });
    }
    setOpenDropdown(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-[#05060A] text-white flex flex-col overflow-hidden select-none font-['Cairo',sans-serif]"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <VioletEnergyWavesBackdrop theme={settings.theme} />

      {/* ================= TOP HEADER BAR ================= */}
      <motion.header
        dir="ltr"
        initial={{ opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={VIEW_SPRING}
        className="relative z-20 flex items-center justify-between px-4 sm:px-6 pt-5 pb-3 max-w-2xl w-full mx-auto shrink-0"
      >
        <button
          type="button"
          onClick={onBack}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:text-white hover:bg-white/5 transition-colors cursor-pointer active:scale-95"
          style={{ color: palette.primary }}
          aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
          title={lang === 'ar' ? 'رجوع' : 'Back'}
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
        </button>

        <h1
          className="text-xl sm:text-2xl font-black tracking-tight"
          style={{
            color: palette.primary,
            textShadow: `0 0 20px ${palette.glow}`,
          }}
        >
          {lang === 'ar' ? 'الإعدادات' : 'Settings'}
        </h1>

        <div className="w-[44px] h-[44px]" aria-hidden="true" />
      </motion.header>

      {/* ================= SCROLLABLE SETTINGS BODY ================= */}
      <motion.main
        variants={staggerFastContainerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-6 pt-2 pb-12 max-w-2xl w-full mx-auto space-y-5"
      >
        {/* TOP 2 STANDALONE CARDS: المظهر + اللغة */}
        <div className="space-y-3">
          {/* Card 1: المظهر (Appearance) */}
          <motion.div
            variants={staggerItemVariants}
            className="relative rounded-2xl bg-[#0B0D14]/[0.94] border transition-colors overflow-hidden"
            style={{
              borderColor: palette.border,
              boxShadow: `0 6px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <PanelRimSheen roundedClass="rounded-2xl" />
            <button
              type="button"
              onClick={() => setExpandedPanel(expandedPanel === 'theme' ? null : 'theme')}
              className="w-full px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ color: palette.primary }}
                >
                  <Palette className="w-6 h-6" />
                </div>
                <div className="w-px h-8 bg-white/10 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white leading-tight">
                    {lang === 'ar' ? 'المظهر' : 'Appearance'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                    {lang === 'ar' ? 'تخصيص مظهر التطبيق' : 'Customize app appearance'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" style={{ color: palette.primary }}>
                <span className="inline-flex items-center -space-x-1 rtl:space-x-reverse" aria-hidden="true">
                  {palette.swatchColors.map((col, idx) => (
                    <span
                      key={idx}
                      className="w-2.5 h-2.5 rounded-full ring-1 ring-black/60"
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </span>
                <span className="text-[11px] text-slate-300 font-semibold hidden sm:inline">
                  {lang === 'ar' ? palette.labelAr : palette.labelEn}
                </span>
                {lang === 'ar' ? (
                  <ChevronLeft
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedPanel === 'theme' ? '-rotate-90' : ''
                    }`}
                  />
                ) : (
                  <ChevronRight
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedPanel === 'theme' ? 'rotate-90' : ''
                    }`}
                  />
                )}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {expandedPanel === 'theme' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto', transition: PANEL_SPRING }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.14, ease: MODAL_EASE } }}
                  className="border-t border-white/10 px-4 py-3.5 bg-black/35 space-y-3 overflow-hidden"
                >
                  {/* Filter Tabs: All / 3 Colors / 2 Colors / 1 Color */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', labelAr: 'الكل', labelEn: 'All' },
                        { id: 3, labelAr: '3 ألوان', labelEn: '3 Colors' },
                        { id: 2, labelAr: 'لونين', labelEn: '2 Colors' },
                        { id: 1, labelAr: 'لون واحد', labelEn: '1 Color' },
                      ] as const
                    ).map((tab) => {
                      const isTabActive = themeToneFilter === tab.id;
                      return (
                        <button
                          key={String(tab.id)}
                          type="button"
                          onClick={() => setThemeToneFilter(tab.id)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                            isTabActive
                              ? 'text-white border-transparent'
                              : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.07]'
                          }`}
                          style={
                            isTabActive
                              ? {
                                  background: palette.cssGrad,
                                  color: palette.contrast,
                                  boxShadow: `0 0 12px ${palette.glow}`,
                                }
                              : undefined
                          }
                        >
                          {lang === 'ar' ? tab.labelAr : tab.labelEn}
                        </button>
                      );
                    })}
                  </div>

                  {/* Categorized Theme Swatches */}
                  <div className="space-y-3">
                    {toneGroups
                      .filter((g) => themeToneFilter === 'all' || themeToneFilter === g.count)
                      .map((group) => {
                        const groupKeys = allThemeKeys.filter(
                          (k) => THEME_PALETTES[k].toneCount === group.count
                        );
                        return (
                          <div key={group.count} className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-0.5">
                              <span>{lang === 'ar' ? group.titleAr : group.titleEn}</span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {groupKeys.length}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {groupKeys.map((key) => {
                                const item = THEME_PALETTES[key];
                                const active = settings.theme === key;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => onUpdateSettings({ ...settings, theme: key })}
                                    className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                      active
                                        ? 'bg-white/12 text-white'
                                        : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07]'
                                    }`}
                                    style={
                                      active
                                        ? {
                                            borderColor: item.primary,
                                            boxShadow: `0 0 16px ${item.glow}`,
                                          }
                                        : undefined
                                    }
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      {/* Gradient swatch pill + individual dots */}
                                      <span className="flex flex-col items-center gap-0.5 shrink-0">
                                        <span
                                          className="w-6 h-3 rounded-full border border-white/25 shadow-sm"
                                          style={{ background: item.cssGrad }}
                                        />
                                        <span className="flex items-center gap-0.5">
                                          {item.swatchColors.map((col, idx) => (
                                            <span
                                              key={idx}
                                              className="w-1.5 h-1.5 rounded-full"
                                              style={{ backgroundColor: col }}
                                            />
                                          ))}
                                        </span>
                                      </span>
                                      <span className="truncate">
                                        {lang === 'ar' ? item.labelAr : item.labelEn}
                                      </span>
                                    </span>
                                    {active && (
                                      <Check
                                        className="w-3.5 h-3.5 shrink-0"
                                        style={{ color: item.bright }}
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Card 2: اللغة (Language) */}
          <motion.div
            variants={staggerItemVariants}
            className="relative rounded-2xl bg-[#0B0D14]/[0.94] border transition-colors overflow-hidden"
            style={{
              borderColor: palette.border,
              boxShadow: `0 6px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <PanelRimSheen roundedClass="rounded-2xl" />
            <button
              type="button"
              onClick={() => setExpandedPanel(expandedPanel === 'language' ? null : 'language')}
              className="w-full px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 text-start cursor-pointer hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ color: palette.primary }}
                >
                  <Globe className="w-6 h-6" />
                </div>
                <div className="w-px h-8 bg-white/10 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white leading-tight">
                    {lang === 'ar' ? 'اللغة' : 'Language'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                    {lang === 'ar' ? 'اختر اللغة المفضلة' : 'Choose your preferred language'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" style={{ color: palette.primary }}>
                <span className="text-[11px] text-slate-300 font-semibold">
                  {lang === 'ar' ? 'العربية' : 'English'}
                </span>
                {lang === 'ar' ? (
                  <ChevronLeft
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedPanel === 'language' ? '-rotate-90' : ''
                    }`}
                  />
                ) : (
                  <ChevronRight
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedPanel === 'language' ? 'rotate-90' : ''
                    }`}
                  />
                )}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {expandedPanel === 'language' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto', transition: PANEL_SPRING }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.14, ease: MODAL_EASE } }}
                  className="border-t border-white/10 px-4 py-3 bg-black/30 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: 'ar' as Language, label: 'العربية' },
                      { id: 'en' as Language, label: 'English' },
                    ].map((opt) => {
                      const active = lang === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onSetLang(opt.id);
                            setExpandedPanel(null);
                          }}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                            active
                              ? 'bg-white/10 text-white'
                              : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.07]'
                          }`}
                          style={
                            active
                              ? {
                                  borderColor: palette.primary,
                                  boxShadow: `0 0 12px ${palette.glow}`,
                                }
                              : undefined
                          }
                        >
                          <span>{opt.label}</span>
                          {active && <Check className="w-4 h-4" style={{ color: palette.primary }} />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ================= SECTION 1: الإعدادات العامة ================= */}
        <motion.section
          variants={staggerItemVariants}
          className={`space-y-2.5 pt-1 relative ${
            openDropdown === 'resolution' || openDropdown === 'fps' || openDropdown === 'savePath'
              ? 'z-50'
              : 'z-10'
          }`}
        >
          <div className="flex items-center gap-2.5 px-1">
            <SlidersHorizontal className="w-5 h-5" style={{ color: palette.primary }} />
            <h2 className="text-sm sm:text-base font-bold" style={{ color: palette.primary }}>
              {lang === 'ar' ? 'الإعدادات العامة' : 'General Settings'}
            </h2>
          </div>

          <div
            className="relative rounded-2xl bg-[#0B0D14]/[0.94] border overflow-visible"
            style={{
              borderColor: palette.border,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <PanelRimSheen roundedClass="rounded-2xl" />
            </div>
            {/* Subtle glowing bottom corner edge highlights */}
            <div
              className="pointer-events-none absolute -bottom-[1px] left-4 w-10 h-[2px] rounded-full opacity-80"
              style={{
                background: `linear-gradient(90deg, ${palette.light}, ${palette.primary}, ${palette.tertiary}, transparent)`,
              }}
            />
            <div
              className="pointer-events-none absolute -bottom-[1px] right-4 w-10 h-[2px] rounded-full opacity-80"
              style={{
                background: `linear-gradient(270deg, ${palette.light}, ${palette.secondary}, ${palette.tertiary}, transparent)`,
              }}
            />

            <div className="divide-y divide-white/10">
              {/* Row 1: جودة التشغيل */}
              <div
                className={`px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 relative ${
                  openDropdown === 'resolution' ? 'z-30' : 'z-0'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 flex items-center justify-center shrink-0">
                    <span
                      className="inline-flex items-center justify-center w-7 h-6 rounded-md text-[11px] font-black tracking-tight"
                      style={{ background: palette.cssGrad, color: palette.contrast }}
                    >
                      HD
                    </span>
                  </div>
                  <div className="w-px h-8 bg-white/10 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-bold text-white leading-tight">
                      {lang === 'ar' ? 'جودة التشغيل' : 'Playback Quality'}
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                      {lang === 'ar'
                        ? 'اختر جودة المشغل الافتراضية'
                        : 'Choose default player quality'}
                    </div>
                  </div>
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === 'resolution' ? null : 'resolution')
                    }
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#121622] hover:bg-[#191F30] border text-xs font-mono font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer tabular-nums"
                    style={{ borderColor: palette.border }}
                  >
                    <span>{settings.defaultResolution}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-300 transition-transform duration-150 ${
                        openDropdown === 'resolution' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {openDropdown === 'resolution' && (
                      <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute top-full mt-1.5 left-0 min-w-[120px] rounded-xl bg-[#0E111A]/[0.98] gpu-layer border p-1 shadow-2xl z-40 space-y-0.5 origin-top"
                        style={{ borderColor: palette.border }}
                      >
                        {resolutionOptions.map((res) => (
                          <button
                            key={res}
                            type="button"
                            onClick={() => {
                              onUpdateSettings({
                                ...settings,
                                defaultResolution: res,
                                settingsExportUpdatedAt: Date.now(),
                              });
                              setOpenDropdown(null);
                            }}
                            className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              settings.defaultResolution === res
                                ? 'bg-white/12 text-white font-bold'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span>{res}</span>
                            {settings.defaultResolution === res && (
                              <Check className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Row 2: معدل الإطارات */}
              <div
                className={`px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 relative ${
                  openDropdown === 'fps' ? 'z-30' : 'z-0'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-9 h-9 flex items-center justify-center shrink-0"
                    style={{ color: palette.primary }}
                  >
                    <Focus className="w-6 h-6" />
                  </div>
                  <div className="w-px h-8 bg-white/10 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-bold text-white leading-tight">
                      {lang === 'ar' ? 'معدل الإطارات' : 'Frame Rate'}
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                      {lang === 'ar'
                        ? 'اختر معدل الإطارات الافتراضي'
                        : 'Choose default frame rate'}
                    </div>
                  </div>
                </div>

                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === 'fps' ? null : 'fps')}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#121622] hover:bg-[#191F30] border text-xs font-mono font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer tabular-nums"
                    style={{ borderColor: palette.border }}
                  >
                    <span>{settings.defaultFps} FPS</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-300 transition-transform duration-150 ${
                        openDropdown === 'fps' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {openDropdown === 'fps' && (
                      <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute top-full mt-1.5 left-0 min-w-[120px] rounded-xl bg-[#0E111A]/[0.98] gpu-layer border p-1 shadow-2xl z-40 space-y-0.5 origin-top"
                        style={{ borderColor: palette.border }}
                      >
                        {fpsOptions.map((fps) => (
                          <button
                            key={fps}
                            type="button"
                            onClick={() => {
                              onUpdateSettings({
                                ...settings,
                                defaultFps: fps,
                                settingsExportUpdatedAt: Date.now(),
                              });
                              setOpenDropdown(null);
                            }}
                            className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              settings.defaultFps === fps
                                ? 'bg-white/12 text-white font-bold'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span>{fps} FPS</span>
                            {settings.defaultFps === fps && (
                              <Check className="w-3.5 h-3.5" style={{ color: palette.primary }} />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Row 3: مسار الحفظ */}
              <div
                className={`px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 relative ${
                  openDropdown === 'savePath' ? 'z-30' : 'z-0'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-9 h-9 flex items-center justify-center shrink-0"
                    style={{ color: palette.primary }}
                  >
                    <Folder className="w-6 h-6 fill-current" />
                  </div>
                  <div className="w-px h-8 bg-white/10 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-bold text-white leading-tight">
                      {lang === 'ar' ? 'مسار حفظ الفيديوهات' : 'Video Save Folder'}
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                      {lang === 'ar'
                        ? 'مجلد الأفلام: Movies / SQMOTION'
                        : 'Target folder: Movies / SQMOTION'}
                    </div>
                  </div>
                </div>

                <div className="relative shrink-0 max-w-[46%]">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === 'savePath' ? null : 'savePath')
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#121622] hover:bg-[#191F30] border text-[11px] sm:text-xs font-mono font-medium text-white flex items-center gap-2 transition-colors cursor-pointer"
                    style={{ borderColor: palette.border }}
                    title={settings.savePath}
                  >
                    <span className="truncate max-w-[140px] sm:max-w-[180px]" dir="ltr">
                      {settings.savePath}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-300 shrink-0 transition-transform duration-150 ${
                        openDropdown === 'savePath' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {openDropdown === 'savePath' && (
                      <motion.div
                        variants={dropdownVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="absolute top-full mt-1.5 left-0 min-w-[210px] rounded-xl bg-[#0E111A]/[0.98] gpu-layer border p-1 shadow-2xl z-40 space-y-0.5 origin-top"
                        style={{ borderColor: palette.border }}
                      >
                        {savePathOptions.map((pathOpt) => (
                          <button
                            key={pathOpt}
                            type="button"
                            onClick={() => {
                              clearPickedDirectoryHandle().catch(() => {});
                              onUpdateSettings({
                                ...settings,
                                savePath: pathOpt,
                                settingsExportUpdatedAt: Date.now(),
                              });
                              setOpenDropdown(null);
                            }}
                            className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg text-[11px] font-mono flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              settings.savePath === pathOpt
                                ? 'bg-white/12 text-white font-bold'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span className="truncate" dir="ltr">
                              {pathOpt}
                            </span>
                            {settings.savePath === pathOpt && (
                              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: palette.primary }} />
                            )}
                          </button>
                        ))}
                        {canUseDirectoryPicker() && (
                          <button
                            type="button"
                            onClick={handleSelectDirectory}
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold text-start border-t border-white/10 mt-1 pt-2 hover:bg-white/5 cursor-pointer"
                            style={{ color: palette.primary }}
                          >
                            {lang === 'ar'
                              ? 'ربط مجلد Movies / SQMOTION من الجهاز...'
                              : 'Link Movies / SQMOTION folder...'}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ================= SECTION 1.5: إعدادات التصدير المستهدفة ================= */}
        <motion.section variants={staggerItemVariants} className="space-y-2.5 pt-1 relative z-10">
          <div className="flex items-center gap-2.5 px-1">
            <Share2 className="w-5 h-5" style={{ color: palette.primary }} />
            <h2 className="text-sm sm:text-base font-bold" style={{ color: palette.primary }}>
              {lang === 'ar' ? 'إعدادات التصدير المستهدفة' : 'Export Target Settings'}
            </h2>
          </div>

          <div
            className="relative rounded-2xl bg-[#0B0D14]/[0.94] border overflow-hidden"
            style={{
              borderColor: palette.border,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <PanelRimSheen roundedClass="rounded-2xl" />
            <div className="divide-y divide-white/10">
              {/* Target Export Format Button */}
              <div className="px-4 py-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm sm:text-base font-bold text-white leading-tight">
                      {lang === 'ar' ? 'زر التصدير المستهدف' : 'Target Export Format'}
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                      {lang === 'ar'
                        ? 'سيستهدف التصدير تلقائياً الصيغة التي تختارها هنا'
                        : 'Export modal will automatically target your selected format'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'mp4' as ExportTargetFormat, labelAr: 'MP4', labelEn: 'MP4' },
                      { id: 'webm' as ExportTargetFormat, labelAr: 'WebM', labelEn: 'WebM' },
                      { id: 'gif' as ExportTargetFormat, labelAr: 'GIF', labelEn: 'GIF' },
                      { id: 'png' as ExportTargetFormat, labelAr: 'PNG', labelEn: 'PNG' },
                      { id: 'sq' as ExportTargetFormat, labelAr: '.sq', labelEn: '.sq' },
                    ]
                  ).map((opt) => {
                    const active = settings.defaultExportTarget === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            defaultExportTarget: opt.id,
                            settingsExportUpdatedAt: Date.now(),
                          })
                        }
                        className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                          active
                            ? 'text-white border-transparent'
                            : 'bg-[#121622] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                        }`}
                        style={
                          active
                            ? {
                                background: palette.cssGrad,
                                color: palette.contrast,
                                boxShadow: `0 0 14px ${palette.glow}`,
                              }
                            : undefined
                        }
                      >
                        {lang === 'ar' ? opt.labelAr : opt.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Export Quality */}
              <div className="px-4 py-3.5 space-y-2.5">
                <div>
                  <div className="text-sm sm:text-base font-bold text-white leading-tight">
                    {lang === 'ar' ? 'جودة التصدير الافتراضية' : 'Default Export Quality'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    {lang === 'ar' ? 'تحديد معدل البت والوضوح عند التصدير' : 'Bitrate & encoding clarity'}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'high' as ExportTargetQuality, labelAr: 'فائقة (High)', labelEn: 'High' },
                      { id: 'standard' as ExportTargetQuality, labelAr: 'قياسية', labelEn: 'Standard' },
                      { id: 'low' as ExportTargetQuality, labelAr: 'توفير حجم', labelEn: 'Economy' },
                    ]
                  ).map((q) => {
                    const active = settings.defaultExportQuality === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            defaultExportQuality: q.id,
                            settingsExportUpdatedAt: Date.now(),
                          })
                        }
                        className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          active
                            ? 'text-white border-transparent font-black'
                            : 'bg-[#121622] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                        }`}
                        style={
                          active
                            ? {
                                background: palette.cssGrad,
                                color: palette.contrast,
                                boxShadow: `0 0 12px ${palette.glow}`,
                              }
                            : undefined
                        }
                      >
                        {lang === 'ar' ? q.labelAr : q.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Export Aspect Ratio */}
              <div className="px-4 py-3.5 space-y-2.5">
                <div>
                  <div className="text-sm sm:text-base font-bold text-white leading-tight">
                    {lang === 'ar' ? 'أبعاد التصدير المستهدفة' : 'Target Export Aspect'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    {lang === 'ar'
                      ? 'تلقائي حسب المشروع أو اختيار مقاس ثابت للتصدير'
                      : 'Match project aspect or force a preset ratio'}
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {(
                    [
                      { id: 'auto' as ExportTargetAspect, label: lang === 'ar' ? 'تلقائي' : 'Auto' },
                      { id: '9:16' as ExportTargetAspect, label: '9:16' },
                      { id: '16:9' as ExportTargetAspect, label: '16:9' },
                      { id: '1:1' as ExportTargetAspect, label: '1:1' },
                      { id: '4:5' as ExportTargetAspect, label: '4:5' },
                      { id: '4:3' as ExportTargetAspect, label: '4:3' },
                    ]
                  ).map((a) => {
                    const active = settings.defaultExportAspect === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            defaultExportAspect: a.id,
                            settingsExportUpdatedAt: Date.now(),
                          })
                        }
                        className={`min-h-[36px] px-1.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                          active
                            ? 'text-white border-transparent font-black'
                            : 'bg-[#121622] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                        }`}
                        style={
                          active
                            ? {
                                background: palette.cssGrad,
                                color: palette.contrast,
                                boxShadow: `0 0 12px ${palette.glow}`,
                              }
                            : undefined
                        }
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ================= SECTION 2: تخصيص المحرر ================= */}
        <motion.section
          variants={staggerItemVariants}
          className={`space-y-2.5 pt-1 relative ${
            openDropdown === 'uiScale' ? 'z-50' : 'z-10'
          }`}
        >
          <div className="flex items-center gap-2.5 px-1">
            <Wand2 className="w-5 h-5" style={{ color: palette.primary }} />
            <h2 className="text-sm sm:text-base font-bold" style={{ color: palette.primary }}>
              {lang === 'ar' ? 'تخصيص المحرر' : 'Editor Customization'}
            </h2>
          </div>

          <div
            className="relative rounded-2xl bg-[#0B0D14]/[0.94] border overflow-visible"
            style={{
              borderColor: palette.border,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
          >
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <PanelRimSheen roundedClass="rounded-2xl" />
            </div>
            {/* Subtle glowing bottom corner edge highlights */}
            <div
              className="pointer-events-none absolute -bottom-[1px] left-4 w-10 h-[2px] rounded-full opacity-80"
              style={{
                background: `linear-gradient(90deg, ${palette.light}, ${palette.primary}, ${palette.tertiary}, transparent)`,
              }}
            />
            <div
              className="pointer-events-none absolute -bottom-[1px] right-4 w-10 h-[2px] rounded-full opacity-80"
              style={{
                background: `linear-gradient(270deg, ${palette.light}, ${palette.secondary}, ${palette.tertiary}, transparent)`,
              }}
            />

            <div className="px-4 py-3.5 min-h-[68px] flex items-center justify-between gap-3 relative">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ color: palette.primary }}
                >
                  <Monitor className="w-6 h-6" />
                </div>
                <div className="w-px h-8 bg-white/10 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white leading-tight">
                    {lang === 'ar' ? 'حجم واجهة المحرر' : 'Editor Interface Size'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                    {lang === 'ar' ? 'اختر حجم عناصر الواجهة' : 'Choose UI element scale'}
                  </div>
                </div>
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'uiScale' ? null : 'uiScale')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#121622] hover:bg-[#191F30] border text-xs font-bold text-white flex items-center gap-2 transition-colors cursor-pointer"
                  style={{ borderColor: palette.border }}
                >
                  <span>{currentUiScaleLabel}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-300 transition-transform duration-150 ${
                      openDropdown === 'uiScale' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {openDropdown === 'uiScale' && (
                    <motion.div
                      variants={dropdownUpVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute bottom-full mb-1.5 left-0 min-w-[125px] rounded-xl bg-[#0E111A]/[0.98] gpu-layer border p-1 shadow-2xl z-40 space-y-0.5 origin-bottom"
                      style={{ borderColor: palette.border }}
                    >
                      {uiScaleOptions.map((opt) => {
                        const active = settings.editorUiScale === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              onUpdateSettings({ ...settings, editorUiScale: opt.id });
                              setOpenDropdown(null);
                            }}
                            className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              active
                                ? 'bg-white/12 text-white'
                                : 'text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <span>{lang === 'ar' ? opt.labelAr : opt.labelEn}</span>
                            {active && <Check className="w-3.5 h-3.5" style={{ color: palette.primary }} />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.section>
      </motion.main>
    </div>
  );
};
