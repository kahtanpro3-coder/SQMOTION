// Dynamic Google Fonts loader over HTTPS for Arabic & English typography
export interface OnlineFontEntry {
  family: string;
  labelAr: string;
  labelEn: string;
  script: 'arabic' | 'latin';
}

export const ONLINE_GOOGLE_FONTS: OnlineFontEntry[] = [
  { family: 'Cairo', labelAr: 'القاهرة (Cairo)', labelEn: 'Cairo', script: 'arabic' },
  { family: 'Tajawal', labelAr: 'تجوّل (Tajawal)', labelEn: 'Tajawal', script: 'arabic' },
  { family: 'Almarai', labelAr: 'المراعي (Almarai)', labelEn: 'Almarai', script: 'arabic' },
  { family: 'IBM Plex Sans Arabic', labelAr: 'آي بي إم عربي', labelEn: 'IBM Plex Sans Arabic', script: 'arabic' },
  { family: 'Changa', labelAr: 'تشانغا (Changa)', labelEn: 'Changa', script: 'arabic' },
  { family: 'Readex Pro', labelAr: 'ريدكس برو', labelEn: 'Readex Pro', script: 'arabic' },
  { family: 'Amiri', labelAr: 'أميري الكلاسيكي', labelEn: 'Amiri', script: 'arabic' },
  { family: 'El Messiri', labelAr: 'المسيري (El Messiri)', labelEn: 'El Messiri', script: 'arabic' },
  { family: 'Lalezar', labelAr: 'لالزار العريض', labelEn: 'Lalezar', script: 'arabic' },
  { family: 'Aref Ruqaa', labelAr: 'عارف رقعة', labelEn: 'Aref Ruqaa', script: 'arabic' },
  { family: 'Rubik', labelAr: 'روبيك (Rubik)', labelEn: 'Rubik', script: 'arabic' },
  { family: 'Montserrat', labelAr: 'مونتسيرات', labelEn: 'Montserrat', script: 'latin' },
  { family: 'Bebas Neue', labelAr: 'بيباس نيو', labelEn: 'Bebas Neue', script: 'latin' },
  { family: 'Oswald', labelAr: 'أوزوالد', labelEn: 'Oswald', script: 'latin' },
  { family: 'Space Grotesk', labelAr: 'سبيس جروتيسك', labelEn: 'Space Grotesk', script: 'latin' },
  { family: 'Orbitron', labelAr: 'أوربيترون', labelEn: 'Orbitron', script: 'latin' },
  { family: 'Playfair Display', labelAr: 'بلايفير ديسبلاي', labelEn: 'Playfair Display', script: 'latin' },
  { family: 'Syne', labelAr: 'ساين', labelEn: 'Syne', script: 'latin' },
  { family: 'Cinzel', labelAr: 'سينزيل', labelEn: 'Cinzel', script: 'latin' },
];

const loadedFontFamilies = new Set<string>();

export async function ensureGoogleFontLoaded(family: string): Promise<boolean> {
  const clean = family.trim();
  if (!clean) return false;
  if (loadedFontFamilies.has(clean)) return true;

  if (typeof document === 'undefined') return false;

  const linkId = `sq-gfont-${clean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean)}:wght@400;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  }

  try {
    await Promise.race([
      document.fonts.load(`700 32px "${clean}"`),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    loadedFontFamilies.add(clean);
    return true;
  } catch {
    return false;
  }
}
