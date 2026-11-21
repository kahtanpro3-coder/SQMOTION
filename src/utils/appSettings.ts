import { useEffect, useState } from 'react';

export type ThemeToneCount = 1 | 2 | 3;

export type AppThemeAccent =
  // 1-Color (Mono)
  | 'mono_emerald'
  | 'mono_amber'
  | 'mono_crimson'
  | 'mono_cobalt'
  | 'mono_silver'
  // 2-Color (Duo)
  | 'violet'
  | 'cyan'
  | 'emerald'
  | 'rose'
  | 'sunset_duo'
  | 'gold_emerald'
  // 3-Color (Tri)
  | 'aurora_tri'
  | 'cyber_tri'
  | 'nebula_tri'
  | 'solar_tri';

export type DefaultResolution = '720p' | '1080p' | '1440p' | '4K';
export type EditorUiScale = 'compact' | 'normal' | 'large';
export type ExportTargetFormat = 'mp4' | 'webm' | 'gif' | 'png' | 'sq';
export type ExportTargetQuality = 'high' | 'standard' | 'low';
export type ExportTargetAspect = 'auto' | '9:16' | '16:9' | '1:1' | '4:5' | '4:3';

export interface AppSettings {
  theme: AppThemeAccent;
  defaultResolution: DefaultResolution;
  defaultFps: 24 | 30 | 60 | 120;
  savePath: string;
  editorUiScale: EditorUiScale;
  defaultExportTarget: ExportTargetFormat;
  defaultExportQuality: ExportTargetQuality;
  defaultExportAspect: ExportTargetAspect;
  settingsExportUpdatedAt: number;
}

export interface ThemePalette {
  toneCount: ThemeToneCount;
  swatchColors: string[];
  primary: string;
  bright: string;
  light: string;
  solid: string;
  solidHover: string;
  contrast: string;
  secondary: string;
  tertiary: string;
  deep: string;
  surfaceTint: string;
  surfaceTintHover: string;
  primaryRgb: string;
  brightRgb: string;
  secondaryRgb: string;
  tertiaryRgb: string;
  glow: string;
  border: string;
  buttonGrad: string;
  cssGrad: string;
  labelAr: string;
  labelEn: string;
}

const STORAGE_KEY = 'sqmotion_app_settings_v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'violet',
  defaultResolution: '1080p',
  defaultFps: 60,
  savePath: '/storage/emulated/0/Movies/SQMOTION',
  editorUiScale: 'normal',
  defaultExportTarget: 'mp4',
  defaultExportQuality: 'high',
  defaultExportAspect: 'auto',
  settingsExportUpdatedAt: 0,
};

export const THEME_PALETTES: Record<AppThemeAccent, ThemePalette> = {
  // =========================================================================
  // 1-COLOR THEMES (مضاهر لون واحد - Mono)
  // =========================================================================
  mono_emerald: {
    toneCount: 1,
    swatchColors: ['#10B981'],
    primary: '#10B981',
    bright: '#34D399',
    light: '#A7F3D0',
    solid: '#059669',
    solidHover: '#10B981',
    contrast: '#04140D',
    secondary: '#10B981',
    tertiary: '#059669',
    deep: '#022C22',
    surfaceTint: '#0D2119',
    surfaceTintHover: '#133024',
    primaryRgb: '16, 185, 129',
    brightRgb: '52, 211, 153',
    secondaryRgb: '16, 185, 129',
    tertiaryRgb: '5, 150, 105',
    glow: 'rgba(16, 185, 129, 0.45)',
    border: 'rgba(16, 185, 129, 0.45)',
    buttonGrad: 'from-[#047857] via-[#059669] to-[#10B981]',
    cssGrad: 'linear-gradient(135deg, #047857 0%, #059669 50%, #10B981 100%)',
    labelAr: 'أخضر صافي',
    labelEn: 'Pure Emerald',
  },
  mono_amber: {
    toneCount: 1,
    swatchColors: ['#F59E0B'],
    primary: '#F59E0B',
    bright: '#FBBF24',
    light: '#FDE68A',
    solid: '#D97706',
    solidHover: '#F59E0B',
    contrast: '#140B02',
    secondary: '#F59E0B',
    tertiary: '#D97706',
    deep: '#451A03',
    surfaceTint: '#241809',
    surfaceTintHover: '#34220D',
    primaryRgb: '245, 158, 11',
    brightRgb: '251, 191, 36',
    secondaryRgb: '245, 158, 11',
    tertiaryRgb: '217, 119, 6',
    glow: 'rgba(245, 158, 11, 0.45)',
    border: 'rgba(245, 158, 11, 0.45)',
    buttonGrad: 'from-[#B45309] via-[#D97706] to-[#F59E0B]',
    cssGrad: 'linear-gradient(135deg, #B45309 0%, #D97706 50%, #F59E0B 100%)',
    labelAr: 'ذهبي عنبري',
    labelEn: 'Pure Amber',
  },
  mono_crimson: {
    toneCount: 1,
    swatchColors: ['#EF4444'],
    primary: '#EF4444',
    bright: '#F87171',
    light: '#FECACA',
    solid: '#DC2626',
    solidHover: '#EF4444',
    contrast: '#FFFFFF',
    secondary: '#EF4444',
    tertiary: '#DC2626',
    deep: '#450A0A',
    surfaceTint: '#240D0E',
    surfaceTintHover: '#351315',
    primaryRgb: '239, 68, 68',
    brightRgb: '248, 113, 113',
    secondaryRgb: '239, 68, 68',
    tertiaryRgb: '220, 38, 38',
    glow: 'rgba(239, 68, 68, 0.45)',
    border: 'rgba(239, 68, 68, 0.45)',
    buttonGrad: 'from-[#991B1B] via-[#DC2626] to-[#EF4444]',
    cssGrad: 'linear-gradient(135deg, #991B1B 0%, #DC2626 50%, #EF4444 100%)',
    labelAr: 'أحمر قرمزي',
    labelEn: 'Pure Crimson',
  },
  mono_cobalt: {
    toneCount: 1,
    swatchColors: ['#3B82F6'],
    primary: '#3B82F6',
    bright: '#60A5FA',
    light: '#BFDBFE',
    solid: '#2563EB',
    solidHover: '#3B82F6',
    contrast: '#FFFFFF',
    secondary: '#3B82F6',
    tertiary: '#2563EB',
    deep: '#172554',
    surfaceTint: '#0D182C',
    surfaceTintHover: '#132440',
    primaryRgb: '59, 130, 246',
    brightRgb: '96, 165, 250',
    secondaryRgb: '59, 130, 246',
    tertiaryRgb: '37, 99, 235',
    glow: 'rgba(59, 130, 246, 0.45)',
    border: 'rgba(59, 130, 246, 0.45)',
    buttonGrad: 'from-[#1D4ED8] via-[#2563EB] to-[#3B82F6]',
    cssGrad: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)',
    labelAr: 'أزرق ياقوتي',
    labelEn: 'Pure Cobalt',
  },
  mono_silver: {
    toneCount: 1,
    swatchColors: ['#CBD5E1'],
    primary: '#CBD5E1',
    bright: '#F1F5F9',
    light: '#FFFFFF',
    solid: '#94A3B8',
    solidHover: '#CBD5E1',
    contrast: '#090B10',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    deep: '#1E293B',
    surfaceTint: '#181C24',
    surfaceTintHover: '#232833',
    primaryRgb: '203, 213, 225',
    brightRgb: '241, 245, 249',
    secondaryRgb: '203, 213, 225',
    tertiaryRgb: '148, 163, 184',
    glow: 'rgba(226, 232, 240, 0.35)',
    border: 'rgba(203, 213, 225, 0.4)',
    buttonGrad: 'from-[#475569] via-[#64748B] to-[#94A3B8]',
    cssGrad: 'linear-gradient(135deg, #475569 0%, #64748B 50%, #CBD5E1 100%)',
    labelAr: 'فضي بلاتيني',
    labelEn: 'Pure Silver',
  },

  // =========================================================================
  // 2-COLOR THEMES (مضاهر لونين - Duo)
  // =========================================================================
  violet: {
    toneCount: 2,
    swatchColors: ['#A855F7', '#6366F1'],
    primary: '#A855F7',
    bright: '#C084FC',
    light: '#E9D5FF',
    solid: '#9333EA',
    solidHover: '#A855F7',
    contrast: '#FFFFFF',
    secondary: '#6366F1',
    tertiary: '#818CF8',
    deep: '#3B0764',
    surfaceTint: '#160E29',
    surfaceTintHover: '#21153D',
    primaryRgb: '168, 85, 247',
    brightRgb: '192, 132, 252',
    secondaryRgb: '99, 102, 241',
    tertiaryRgb: '129, 140, 248',
    glow: 'rgba(168, 85, 247, 0.45)',
    border: 'rgba(168, 85, 247, 0.45)',
    buttonGrad: 'from-[#6D28D9] via-[#7C3AED] to-[#4F46E5]',
    cssGrad: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #6366F1 100%)',
    labelAr: 'بنفسجي ونيلي',
    labelEn: 'Royal Violet',
  },
  cyan: {
    toneCount: 2,
    swatchColors: ['#06B6D4', '#3B82F6'],
    primary: '#06B6D4',
    bright: '#22D3EE',
    light: '#A5F3FC',
    solid: '#06B6D4',
    solidHover: '#22D3EE',
    contrast: '#041318',
    secondary: '#3B82F6',
    tertiary: '#60A5FA',
    deep: '#083344',
    surfaceTint: '#091B26',
    surfaceTintHover: '#0F2A3A',
    primaryRgb: '6, 182, 212',
    brightRgb: '34, 211, 238',
    secondaryRgb: '59, 130, 246',
    tertiaryRgb: '96, 165, 250',
    glow: 'rgba(6, 182, 212, 0.45)',
    border: 'rgba(6, 182, 212, 0.45)',
    buttonGrad: 'from-[#0891B2] via-[#0284C7] to-[#2563EB]',
    cssGrad: 'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 50%, #3B82F6 100%)',
    labelAr: 'سماوي وأزرق',
    labelEn: 'Cyber Cyan',
  },
  emerald: {
    toneCount: 2,
    swatchColors: ['#22C55E', '#14B8A6'],
    primary: '#10B981',
    bright: '#5EEB9A',
    light: '#A7F3D0',
    solid: '#22C55E',
    solidHover: '#4ADE80',
    contrast: '#07140C',
    secondary: '#14B8A6',
    tertiary: '#2DD4BF',
    deep: '#022C22',
    surfaceTint: '#132219',
    surfaceTintHover: '#1B3124',
    primaryRgb: '34, 197, 94',
    brightRgb: '94, 235, 154',
    secondaryRgb: '20, 184, 166',
    tertiaryRgb: '45, 212, 191',
    glow: 'rgba(34, 197, 94, 0.45)',
    border: 'rgba(34, 197, 94, 0.45)',
    buttonGrad: 'from-[#059669] via-[#10B981] to-[#0D9488]',
    cssGrad: 'linear-gradient(135deg, #16A34A 0%, #10B981 50%, #14B8A6 100%)',
    labelAr: 'زمردي وفيروزي',
    labelEn: 'Neon Emerald',
  },
  rose: {
    toneCount: 2,
    swatchColors: ['#EC4899', '#A855F7'],
    primary: '#EC4899',
    bright: '#F472B6',
    light: '#FBCFE8',
    solid: '#EC4899',
    solidHover: '#F472B6',
    contrast: '#FFFFFF',
    secondary: '#A855F7',
    tertiary: '#C084FC',
    deep: '#500724',
    surfaceTint: '#240D1B',
    surfaceTintHover: '#341327',
    primaryRgb: '236, 72, 153',
    brightRgb: '244, 114, 182',
    secondaryRgb: '168, 85, 247',
    tertiaryRgb: '192, 132, 252',
    glow: 'rgba(236, 72, 153, 0.45)',
    border: 'rgba(236, 72, 153, 0.45)',
    buttonGrad: 'from-[#DB2777] via-[#9333EA] to-[#701A75]',
    cssGrad: 'linear-gradient(135deg, #EC4899 0%, #D946EF 50%, #A855F7 100%)',
    labelAr: 'وردي وأرجواني',
    labelEn: 'Magenta Glow',
  },
  sunset_duo: {
    toneCount: 2,
    swatchColors: ['#F97316', '#EC4899'],
    primary: '#F97316',
    bright: '#FB923C',
    light: '#FED7AA',
    solid: '#EA580C',
    solidHover: '#F97316',
    contrast: '#FFFFFF',
    secondary: '#EC4899',
    tertiary: '#F43F5E',
    deep: '#431407',
    surfaceTint: '#24120B',
    surfaceTintHover: '#351A10',
    primaryRgb: '249, 115, 22',
    brightRgb: '251, 146, 60',
    secondaryRgb: '236, 72, 153',
    tertiaryRgb: '244, 63, 94',
    glow: 'rgba(249, 115, 22, 0.45)',
    border: 'rgba(249, 115, 22, 0.45)',
    buttonGrad: 'from-[#EA580C] via-[#F43F5E] to-[#DB2777]',
    cssGrad: 'linear-gradient(135deg, #F97316 0%, #F43F5E 50%, #EC4899 100%)',
    labelAr: 'غروب ناري',
    labelEn: 'Sunset Fire',
  },
  gold_emerald: {
    toneCount: 2,
    swatchColors: ['#F59E0B', '#10B981'],
    primary: '#F59E0B',
    bright: '#FBBF24',
    light: '#FEF08A',
    solid: '#D97706',
    solidHover: '#F59E0B',
    contrast: '#0B120D',
    secondary: '#10B981',
    tertiary: '#34D399',
    deep: '#1F1A06',
    surfaceTint: '#1A1B10',
    surfaceTintHover: '#262717',
    primaryRgb: '245, 158, 11',
    brightRgb: '251, 191, 36',
    secondaryRgb: '16, 185, 129',
    tertiaryRgb: '52, 211, 153',
    glow: 'rgba(245, 158, 11, 0.42)',
    border: 'rgba(245, 158, 11, 0.45)',
    buttonGrad: 'from-[#D97706] via-[#059669] to-[#10B981]',
    cssGrad: 'linear-gradient(135deg, #F59E0B 0%, #84CC16 50%, #10B981 100%)',
    labelAr: 'ذهبي وزمردي',
    labelEn: 'Royal Jade',
  },

  // =========================================================================
  // 3-COLOR THEMES (مضاهر ثلاث ألوان - Tri-Color)
  // =========================================================================
  aurora_tri: {
    toneCount: 3,
    swatchColors: ['#22C55E', '#06B6D4', '#A855F7'],
    primary: '#10B981',
    bright: '#34D399',
    light: '#A5F3FC',
    solid: '#059669',
    solidHover: '#10B981',
    contrast: '#041410',
    secondary: '#06B6D4',
    tertiary: '#A855F7',
    deep: '#072227',
    surfaceTint: '#0C1D22',
    surfaceTintHover: '#122B32',
    primaryRgb: '16, 185, 129',
    brightRgb: '52, 211, 153',
    secondaryRgb: '6, 182, 212',
    tertiaryRgb: '168, 85, 247',
    glow: 'rgba(6, 182, 212, 0.48)',
    border: 'rgba(16, 185, 129, 0.48)',
    buttonGrad: 'from-[#059669] via-[#0891B2] to-[#7C3AED]',
    cssGrad: 'linear-gradient(135deg, #22C55E 0%, #06B6D4 50%, #A855F7 100%)',
    labelAr: 'شفق قطبي',
    labelEn: 'Aurora Prism',
  },
  cyber_tri: {
    toneCount: 3,
    swatchColors: ['#06B6D4', '#EC4899', '#FACC15'],
    primary: '#06B6D4',
    bright: '#22D3EE',
    light: '#FDE047',
    solid: '#0891B2',
    solidHover: '#06B6D4',
    contrast: '#041318',
    secondary: '#EC4899',
    tertiary: '#FACC15',
    deep: '#1F0A24',
    surfaceTint: '#141322',
    surfaceTintHover: '#1E1C33',
    primaryRgb: '6, 182, 212',
    brightRgb: '34, 211, 238',
    secondaryRgb: '236, 72, 153',
    tertiaryRgb: '250, 204, 21',
    glow: 'rgba(236, 72, 153, 0.46)',
    border: 'rgba(34, 211, 238, 0.48)',
    buttonGrad: 'from-[#0891B2] via-[#DB2777] to-[#CA8A04]',
    cssGrad: 'linear-gradient(135deg, #06B6D4 0%, #EC4899 52%, #FACC15 100%)',
    labelAr: 'سايبر نيون',
    labelEn: 'Cyber Tri-Neon',
  },
  nebula_tri: {
    toneCount: 3,
    swatchColors: ['#F43F5E', '#A855F7', '#38BDF8'],
    primary: '#A855F7',
    bright: '#C084FC',
    light: '#BAE6FD',
    solid: '#9333EA',
    solidHover: '#A855F7',
    contrast: '#FFFFFF',
    secondary: '#F43F5E',
    tertiary: '#38BDF8',
    deep: '#2A082E',
    surfaceTint: '#1A0F26',
    surfaceTintHover: '#261638',
    primaryRgb: '168, 85, 247',
    brightRgb: '192, 132, 252',
    secondaryRgb: '244, 63, 94',
    tertiaryRgb: '56, 189, 248',
    glow: 'rgba(168, 85, 247, 0.48)',
    border: 'rgba(244, 63, 94, 0.45)',
    buttonGrad: 'from-[#E11D48] via-[#9333EA] to-[#0284C7]',
    cssGrad: 'linear-gradient(135deg, #F43F5E 0%, #A855F7 50%, #38BDF8 100%)',
    labelAr: 'سديم المجرة',
    labelEn: 'Cosmic Nebula',
  },
  solar_tri: {
    toneCount: 3,
    swatchColors: ['#F59E0B', '#EF4444', '#8B5CF6'],
    primary: '#F59E0B',
    bright: '#FBBF24',
    light: '#DDD6FE',
    solid: '#EA580C',
    solidHover: '#F59E0B',
    contrast: '#FFFFFF',
    secondary: '#EF4444',
    tertiary: '#8B5CF6',
    deep: '#330A18',
    surfaceTint: '#201218',
    surfaceTintHover: '#2F1A23',
    primaryRgb: '245, 158, 11',
    brightRgb: '251, 191, 36',
    secondaryRgb: '239, 68, 68',
    tertiaryRgb: '139, 92, 246',
    glow: 'rgba(239, 68, 68, 0.46)',
    border: 'rgba(245, 158, 11, 0.48)',
    buttonGrad: 'from-[#D97706] via-[#DC2626] to-[#7C3AED]',
    cssGrad: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #8B5CF6 100%)',
    labelAr: 'توهج استوائي',
    labelEn: 'Solar Prism',
  },
};

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw);
    const hasTheme =
      typeof parsed.theme === 'string' &&
      Object.prototype.hasOwnProperty.call(THEME_PALETTES, parsed.theme);
    return {
      theme: hasTheme ? (parsed.theme as AppThemeAccent) : DEFAULT_APP_SETTINGS.theme,
      defaultResolution: ['720p', '1080p', '1440p', '4K'].includes(parsed.defaultResolution)
        ? parsed.defaultResolution
        : DEFAULT_APP_SETTINGS.defaultResolution,
      defaultFps: [24, 30, 60, 120].includes(Number(parsed.defaultFps))
        ? (Number(parsed.defaultFps) as 24 | 30 | 60 | 120)
        : DEFAULT_APP_SETTINGS.defaultFps,
      savePath:
        typeof parsed.savePath === 'string' && parsed.savePath.trim()
          ? parsed.savePath === '/storage/emulated/0'
            ? '/storage/emulated/0/Movies/SQMOTION'
            : parsed.savePath
          : DEFAULT_APP_SETTINGS.savePath,
      editorUiScale: ['compact', 'normal', 'large'].includes(parsed.editorUiScale)
        ? parsed.editorUiScale
        : DEFAULT_APP_SETTINGS.editorUiScale,
      defaultExportTarget: ['mp4', 'webm', 'gif', 'png', 'sq'].includes(parsed.defaultExportTarget)
        ? parsed.defaultExportTarget
        : DEFAULT_APP_SETTINGS.defaultExportTarget,
      defaultExportQuality: ['high', 'standard', 'low'].includes(parsed.defaultExportQuality)
        ? parsed.defaultExportQuality
        : DEFAULT_APP_SETTINGS.defaultExportQuality,
      defaultExportAspect: ['auto', '9:16', '16:9', '1:1', '4:5', '4:3'].includes(parsed.defaultExportAspect)
        ? parsed.defaultExportAspect
        : DEFAULT_APP_SETTINGS.defaultExportAspect,
      settingsExportUpdatedAt:
        typeof parsed.settingsExportUpdatedAt === 'number' && Number.isFinite(parsed.settingsExportUpdatedAt)
          ? parsed.settingsExportUpdatedAt
          : 0,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

let activeThemeAccent: AppThemeAccent = DEFAULT_APP_SETTINGS.theme;
let activeThemePalette: ThemePalette = THEME_PALETTES[DEFAULT_APP_SETTINGS.theme];

export function getActiveThemeAccent(): AppThemeAccent {
  return activeThemeAccent;
}

export function getActiveThemePalette(): ThemePalette {
  return activeThemePalette;
}

export function applyThemeToDocument(theme: AppThemeAccent): ThemePalette {
  const safeTheme: AppThemeAccent = THEME_PALETTES[theme] ? theme : DEFAULT_APP_SETTINGS.theme;
  const p = THEME_PALETTES[safeTheme];
  activeThemeAccent = safeTheme;
  activeThemePalette = p;

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.appTheme = safeTheme;
    root.style.setProperty('--app-accent', p.primary);
    root.style.setProperty('--app-accent-bright', p.bright);
    root.style.setProperty('--app-accent-light', p.light);
    root.style.setProperty('--app-accent-solid', p.solid);
    root.style.setProperty('--app-accent-solid-hover', p.solidHover);
    root.style.setProperty('--app-accent-contrast', p.contrast);
    root.style.setProperty('--app-accent-secondary', p.secondary);
    root.style.setProperty('--app-accent-tertiary', p.tertiary);
    root.style.setProperty('--app-accent-deep', p.deep);
    root.style.setProperty('--app-accent-surface', p.surfaceTint);
    root.style.setProperty('--app-accent-surface-hover', p.surfaceTintHover);
    root.style.setProperty('--app-accent-rgb', p.primaryRgb);
    root.style.setProperty('--app-accent-bright-rgb', p.brightRgb);
    root.style.setProperty('--app-accent-secondary-rgb', p.secondaryRgb);
    root.style.setProperty('--app-accent-tertiary-rgb', p.tertiaryRgb);
    root.style.setProperty('--app-accent-grad', p.cssGrad);
  }
  return p;
}

export function saveAppSettings(next: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    applyThemeToDocument(next.theme);
    window.dispatchEvent(new CustomEvent('sqmotion-settings-changed', { detail: next }));
  } catch (e) {
    console.error('Failed to save app settings', e);
  }
}

export function useAppTheme(): { theme: AppThemeAccent; palette: ThemePalette } {
  const [theme, setTheme] = useState<AppThemeAccent>(() => {
    const loaded = loadAppSettings().theme;
    applyThemeToDocument(loaded);
    return loaded;
  });

  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail;
      if (detail?.theme) {
        applyThemeToDocument(detail.theme);
        setTheme(detail.theme);
      }
    };
    window.addEventListener('sqmotion-settings-changed', onSettingsChanged);
    return () => window.removeEventListener('sqmotion-settings-changed', onSettingsChanged);
  }, []);

  return {
    theme,
    palette: THEME_PALETTES[theme] || THEME_PALETTES.violet,
  };
}

// Initialize theme variables immediately on module load
if (typeof window !== 'undefined') {
  applyThemeToDocument(loadAppSettings().theme);
}
