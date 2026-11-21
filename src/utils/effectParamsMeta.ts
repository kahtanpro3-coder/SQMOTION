import type { EffectPrecisionMode } from './effectControlSettings';

export interface EffectParamOption {
  value: string | number;
  labelAr: string;
  labelEn: string;
}

export interface EffectParamMeta {
  min: number;
  max: number;
  step: number;
  decimals: number;
  unit: string;
  labelAr: string;
  labelEn: string;
  options?: EffectParamOption[];
  isBoolean?: boolean;
  isInteger?: boolean;
}

export interface EffectParamControlOptions {
  extendedRange?: boolean;
  precisionMode?: EffectPrecisionMode;
}

const AR_PARAM_LABELS: Record<string, string> = {
  count: 'العدد / التكرار',
  countX: 'تكرار أفقي (X)',
  countY: 'تكرار عمودي (Y)',
  tilesX: 'عدد البلاطات X',
  tilesY: 'عدد البلاطات Y',
  columns: 'عدد الأعمدة',
  rows: 'عدد الصفوف',
  speed: 'سرعة الطيران التلقائي (0 = ثابت)',
  evolutionSpeed: 'سرعة التطور',
  waveSpeed: 'سرعة الموجة',
  floatSpeed: 'سرعة الطفو ثلاثي الأبعاد 3D',
  floatAmount: 'سعة وارتفاع الطفو',
  reactivity: 'التفاعل مع الكاميرا 3D',
  trailLength: 'طول ذيل الحركة',
  twinkle: 'سرعة الوميض والتلألؤ',
  starSize: 'حجم النجوم',
  starShape: 'شكل النجوم',
  sizeVariation: 'تفاوت أحجام النجوم',
  starRotation: 'زاوية تدوير النجوم',
  spinSpeed: 'سرعة دوران النجوم',
  lineStyle: 'شكل واتجاه الخطوط',
  lineCapStyle: 'أسلوب الخط والحواف',
  lineLength: 'طول الخطوط',
  lineThickness: 'سماكة الخطوط',
  lengthVariation: 'تفاوت أطوال الخطوط',
  lineRotation: 'زاوية تدوير الخطوط',
  glow: 'التوهج المشع (Glow)',
  glowRadius: 'نطاق التوهج',
  spread: 'نطاق الانتشار 3D',
  color: 'اللون الرئيسي',
  secondaryColor: 'اللون الثانوي',
  keyColor: 'لون العزل (Key Color)',
  targetColor: 'اللون المستهدف',
  strokeColor: 'لون الإطار',
  tintColor: 'لون الصبغة',
  gridColor: 'لون الشبكة',
  shadowColor: 'لون الظل',
  inkColor: 'لون الحبر والحدود',
  color1: 'اللون الأول',
  color2: 'اللون الثاني',
  colorA: 'اللون الأول',
  colorB: 'اللون الثاني',
  threshold: 'عتبة الحساسية',
  edgeThreshold: 'عتبة حدود الحافة',
  feather: 'نعومة الحواف',
  featherRadius: 'نعومة حواف القناع',
  softness: 'نعومة التدرج',
  strength: 'قوة وشدة التأثير',
  angle: 'الزاوية',
  startAngle: 'زاوية البداية',
  lightAngle: 'زاوية الإضاءة',
  lightIntensity: 'شدة الإضاءة 3D',
  rotation: 'الدوران',
  rotSpeed: 'سرعة الدوران التلقائي',
  radius: 'نصف القطر / الانتشار',
  radiusStep: 'خطوة اتساع نصف القطر',
  angleStep: 'زاوية تدرج الحلزون',
  redBlur: 'طمس القناة الحمراء',
  greenBlur: 'طمس القناة الخضراء',
  blueBlur: 'طمس القناة الزرقاء',
  quality: 'جودة ودقة التنعيم',
  bladeCount: 'عدد شفرات فتحة العدسة',
  amount: 'مقدار التأثير',
  scale: 'مقياس التكبير / النطاق',
  frequency: 'التردد / الموجات',
  wavelength: 'الطول الموجي',
  amplitude: 'سعة الاهتزاز والتموج',
  waveHeight: 'ارتفاع الموجة',
  magnitude: 'شدة التذبذب',
  maxAngle: 'أقصى زاوية تأرجح',
  blur: 'التمويه والضبابية',
  inDuration: 'مدة الظهور',
  outDuration: 'مدة التلاشي',
  duration: 'المدة الزمنية',
  flipDuration: 'مدة التقليب',
  flipAngle: 'زاوية الانقلاب',
  invert: 'عكس الألوان / القناع',
  blend: 'نسبة الدمج',
  axis: 'محور الدوران / الضغط',
  direction: 'اتجاه الانحناء',
  corner: 'زاوية الطي',
  type: 'نوع التحويل القطبي',
  interpolation: 'نسبة الدمج القطبي',
  ease: 'منحنى التسارع (Ease)',
  shape: 'شكل القناع',
  mode: 'وضع المسار (Matte Mode)',
  curvature: 'شدة الانحناء والتقويس',
  hue: 'تدوير تدرج اللون',
  saturation: 'التشبع اللوني',
  brightness: 'السطوع والإضاءة',
  contrast: 'التباين اللوني',
  exposure: 'التعرض للضوء',
  gamma: 'غاما السينمائية',
  offset: 'الإزاحة',
  temperature: 'حرارة اللون',
  tint: 'مسحة اللون',
  red: 'قناة الأحمر (R)',
  green: 'قناة الأخضر (G)',
  blue: 'قناة الأزرق (B)',
  levels: 'مستويات التدرج',
  flameHeight: 'ارتفاع ألسنة اللهب',
  heat: 'شدة حرارة وسطوع اللهب',
  sparks: 'إظهار الشرر المتطاير',
  density: 'الكثافة والوفرة',
  fontSize: 'حجم الخط والرموز',
  hexRadius: 'حجم السداسي',
  border: 'سمك حدود الشبكة',
  segments: 'عدد القطاعات والمرايا',
  slatCount: 'عدد الشرائح',
  trackingNoise: 'تشويش المسار التناظري',
  colorBleed: 'انحراف اللون VHS',
  staticLines: 'خطوط التشويش الثابتة',
  noiseLevel: 'شدة التشويش',
  syncRoll: 'انزلاق التزامن العمودي',
  dotRadius: 'حجم النقاط',
  focalDepth: 'العمق البؤري (Z)',
  focalRange: 'نطاق التركيز الحاد',
  blurMax: 'أقصى ضبابية',
  rotationsPerSec: 'دورات في الثانية',
  clockwise: 'اتجاه عقارب الساعة',
  rotateCopies: 'تدوير النسخ مع الدائرة',
  bounciness: 'المرونة والارتداد',
  height: 'ارتفاع الارتداد',
  speedX: 'السرعة الأفقية (X)',
  speedY: 'السرعة العمودية (Y)',
  overshoot: 'تجاوز الانبثاق المرن',
  lineSpacing: 'تباعد الخطوط',
  spacing: 'تباعد الأحرف',
  lineGap: 'تباعد الأسطر',
  opacity: 'درجة العتامة',
  minOpacity: 'أدنى شفافية',
  maxOpacity: 'أقصى شفافية',
  dutyCycle: 'نسبة زمن الإضاءة',
  depth: 'العمق والبروز 3D',
  bevel: 'حجم شطف الحواف (Bevel)',
  perspective: 'شدة المنظور 3D',
  strokeWidth: 'سمك الإطار',
  inkWidth: 'سمك خطوط الحبر',
  width: 'عرض التوهج',
  progress: 'نسبة التقدم',
  mirror: 'عكس المرآة',
  centerX: 'المركز الأفقي X',
  centerY: 'المركز العمودي Y',
  centerAnchor: 'نقطة ارتكاز المسح',
  x: 'الموضع الأفقي X',
  y: 'الموضع العمودي Y',
  size: 'الحجم',
  zoom: 'نسبة التكبير (Zoom)',
  intensity: 'الشدة والسطوع',
  rayLength: 'طول الأشعة',
  roughness: 'الخشونة / التموج',
  refractiveIndex: 'معامل الانكسار الضوئي',
  maxHorizontal: 'أقصى إزاحة أفقية (X)',
  maxVertical: 'أقصى إزاحة عمودية (Y)',
  bands: 'عدد طبقات التظليل',
  strokeIntensity: 'شدة قلم الرصاص',
  paperTone: 'سطوع لون الورق',
  length: 'طول الظل',
  fade: 'تلاشي الظل تدريجياً',
  distance: 'مسافة الكاميرا',
  smoothing: 'نعومة الاستجابة والتخميد',
  offsetX: 'الإزاحة X',
  offsetY: 'الإزاحة Y',
  stepX: 'الخطوة X',
  stepY: 'الخطوة Y',
  decay: 'تلاشي الأثر',
  mix: 'الشدة الكلية للتأثير (Mix)',
  phase: 'إزاحة الطور الزمني (Phase)',
  minScale: 'أدنى مقياس نبض',
  rotAmount: 'شدة ارتعاش الدوران',
  inset: 'إزاحة الحافة للداخل',
  center: 'نقطة ارتكاز الضغط',
  lightness: 'إضاءة اللون (Lightness)',
  centerRadius: 'نطاق صفاء المركز',
  delayFrames: 'تأخر الإطارات (Delay)',
  rings: 'عدد الحلقات',
  twist: 'زاوية الالتواء',
  echoCount: 'عدد الأصداء',
  staggerRatio: 'نسبة التداخل',
  chokeAmount: 'تضييق/توسيع الحافة',
  grayLevel: 'عتبة الرمادي للقناع',
  keyOutDark: 'حذف المناطق الداكنة',
  branchCount: 'عدد التفريعات',
  turbulence: 'شدة الاضطراب',
  particleCount: 'عدد القصاصات',
  gravity: 'شدة الجاذبية',
  wind: 'سرعة واتجاه الرياح',
  windSway: 'تمايل نسيم الهواء',
  horizonHeight: 'ارتفاع خط الأفق',
  complexity: 'مستوى التعقيد (Octaves)',
  grainSize: 'حجم الحبيبات',
  seed: 'بذرة العشوائية',
  boxSize: 'حجم المربع',
  roundness: 'استدارة الهالة',
  sortLength: 'طول الفرز اللوني',
  vertical: 'فرز عمودي (Vertical)',
  paletteColors: 'عدد الألوان',
  rotX: 'دوران X',
  rotY: 'دوران Y',
  rotZ: 'دوران Z',
  scaleZ: 'عمق Z',
  depthMultiplier: 'مضاعف العمق',
  elevation: 'زاوية الارتفاع',
  zDepth: 'العمق Z',
  cycleDuration: 'مدة الدورة',
  bobbing: 'سعة التمايل',
  tolerance: 'التسامح اللوني',
  blockSize: 'حجم الكتل',
  delayPerChar: 'التأخير بين كل حرف',
  jumpHeight: 'ارتفاع قفز الحرف',
  glitchChance: 'احتمال تشويه الحروف',
  scrambleSpeed: 'سرعة تبعثر الرموز',
  startVal: 'قيمة البداية',
  endVal: 'قيمة النهاية',
  decimals: 'الخانات العشرية',
  prefix: 'البادئة / الرمز',
  cursorBlink: 'وميض المؤشر',
  cursorChar: 'رمز المؤشر',
  characters: 'مجموعة الرموز العشوائية',
};

const DISCRETE_OPTION_PARAMS: Record<string, EffectParamOption[]> = {
  type: [
    { value: 'rectToPolar', labelAr: 'مستطيل → قطبي', labelEn: 'Rect → Polar' },
    { value: 'polarToRect', labelAr: 'قطبي → مستطيل', labelEn: 'Polar → Rect' },
  ],
  corner: [
    { value: 'bottom-right', labelAr: 'أسفل يمين', labelEn: 'Bottom Right' },
    { value: 'bottom-left', labelAr: 'أسفل يسار', labelEn: 'Bottom Left' },
    { value: 'top-right', labelAr: 'أعلى يمين', labelEn: 'Top Right' },
    { value: 'top-left', labelAr: 'أعلى يسار', labelEn: 'Top Left' },
  ],
  ease: [
    { value: 'linear', labelAr: 'خطي', labelEn: 'Linear' },
    { value: 'exponential', labelAr: 'أسي سريع', labelEn: 'Exponential' },
    { value: 'smooth', labelAr: 'ناعم سلس', labelEn: 'Smooth' },
  ],
  shape: [
    { value: 'circle', labelAr: 'دائرة', labelEn: 'Circle' },
    { value: 'star', labelAr: 'نجمة', labelEn: 'Star' },
    { value: 'diamond', labelAr: 'معين', labelEn: 'Diamond' },
    { value: 'square', labelAr: 'مربع', labelEn: 'Square' },
  ],
  starShape: [
    { value: 'mixed', labelAr: 'مختلط', labelEn: 'Mixed' },
    { value: 'star4', labelAr: 'نجمة رباعية ✦', labelEn: '4-Point Star' },
    { value: 'star5', labelAr: 'نجمة خماسية ★', labelEn: '5-Point Star' },
    { value: 'sparkle', labelAr: 'وميض نجمي ✨', labelEn: 'Sparkle' },
    { value: 'diamond', labelAr: 'معين ◆', labelEn: 'Diamond' },
    { value: 'hexagon', labelAr: 'سداسي ⬡', labelEn: 'Hexagon' },
    { value: 'crescent', labelAr: 'هلال ☽', labelEn: 'Crescent' },
    { value: 'circle', labelAr: 'دائرة ●', labelEn: 'Circle' },
  ],
  lineStyle: [
    { value: 'mixed', labelAr: 'مختلط', labelEn: 'Mixed' },
    { value: 'depth', labelAr: 'أشعة عمق Z', labelEn: 'Depth Rays Z' },
    { value: 'radial', labelAr: 'إشعاعي من المركز', labelEn: 'Radial' },
    { value: 'random3d', labelAr: 'عشوائي 3D', labelEn: '3D Scatter' },
    { value: 'parallel', labelAr: 'متوازي', labelEn: 'Parallel' },
    { value: 'cross', labelAr: 'متقاطع +', labelEn: 'Cross Grid' },
  ],
  lineCapStyle: [
    { value: 'glow', labelAr: 'لامع مدبب', labelEn: 'Glowing Laser' },
    { value: 'solid', labelAr: 'متصل ناعم', labelEn: 'Solid Smooth' },
    { value: 'dashed', labelAr: 'متقطع', labelEn: 'Dashed' },
  ],
  mode: [
    { value: 'alpha', labelAr: 'ألفا (Alpha)', labelEn: 'Alpha' },
    { value: 'luma', labelAr: 'إضاءة (Luma)', labelEn: 'Luma' },
    { value: 'invert', labelAr: 'معكوس (Invert)', labelEn: 'Invert' },
  ],
};

const BOOLEAN_PARAM_KEYS = new Set<string>([
  'mirror',
  'invert',
  'keyOutDark',
  'fade',
  'clockwise',
  'rotateCopies',
  'sparks',
  'staticLines',
  'cursorBlink',
  'vertical',
]);

const INTEGER_PARAM_KEYS = new Set<string>([
  'count',
  'countX',
  'countY',
  'tilesX',
  'tilesY',
  'columns',
  'rows',
  'segments',
  'slatCount',
  'rings',
  'echoCount',
  'branchCount',
  'particleCount',
  'delayFrames',
  'seed',
  'quality',
  'bladeCount',
  'levels',
  'paletteColors',
  'bands',
  'complexity',
  'decimals',
]);

function applyPrecisionAndExtendedBounds(
  meta: EffectParamMeta,
  paramKey: string,
  effectType: string | undefined,
  controlOptions?: EffectParamControlOptions
): EffectParamMeta {
  if (meta.options || meta.isBoolean) return meta;
  const extended = Boolean(controlOptions?.extendedRange);
  const mode = controlOptions?.precisionMode ?? 'normal';
  const isInt = Boolean(meta.isInteger || INTEGER_PARAM_KEYS.has(paramKey));

  let min = meta.min;
  let max = meta.max;
  let step = meta.step;
  let decimals = meta.decimals;

  if (extended) {
    if (paramKey === 'mix') {
      min = 0;
      max = 100;
    } else if (paramKey === 'angle' || paramKey === 'startAngle' || paramKey === 'rotation' || paramKey === 'rotX' || paramKey === 'rotY' || paramKey === 'rotZ' || paramKey === 'twist' || paramKey === 'angleStep' || paramKey === 'flipAngle' || paramKey === 'direction') {
      min = -1080;
      max = 1080;
    } else if (paramKey === 'hue') {
      min = -360;
      max = 360;
    } else if (paramKey === 'temperature') {
      min = 1000;
      max = 15000;
    } else if (paramKey === 'perspective' || paramKey === 'distance') {
      min = 50;
      max = 4000;
    } else if (paramKey === 'focalDepth') {
      min = -2000;
      max = 2000;
    } else if (paramKey === 'focalRange') {
      min = 0;
      max = 2000;
    } else if (paramKey === 'offsetX' || paramKey === 'offsetY' || paramKey === 'stepX' || paramKey === 'stepY' || paramKey === 'maxHorizontal' || paramKey === 'maxVertical') {
      min = -500;
      max = 500;
    } else if (paramKey === 'speedX' || paramKey === 'speedY') {
      min = -1000;
      max = 1000;
    } else if (paramKey === 'speed' || paramKey === 'waveSpeed' || paramKey === 'rotSpeed' || paramKey === 'scrambleSpeed' || paramKey === 'twinkle') {
      min = -50;
      max = 100;
    } else if (paramKey === 'frequency' || paramKey === 'reactivity' || paramKey === 'floatSpeed' || paramKey === 'evolutionSpeed') {
      min = 0;
      max = effectType === 'wave' ? 1.0 : 60;
    } else if (paramKey === 'rotationsPerSec') {
      min = -15;
      max = 15;
    } else if (paramKey === 'duration' || paramKey === 'inDuration' || paramKey === 'outDuration' || paramKey === 'cycleDuration' || paramKey === 'flipDuration') {
      min = 0;
      max = 30;
    } else if (paramKey === 'delayPerChar') {
      min = 0;
      max = 2;
    } else if (paramKey === 'opacity' || paramKey === 'minOpacity' || paramKey === 'maxOpacity' || paramKey === 'blend' || paramKey === 'threshold' || paramKey === 'edgeThreshold' || paramKey === 'interpolation' || paramKey === 'smoothing' || paramKey === 'paperTone' || paramKey === 'softness' || paramKey === 'decay' || paramKey === 'noiseLevel' || paramKey === 'syncRoll' || paramKey === 'trackingNoise' || paramKey === 'glitchChance' || paramKey === 'staggerRatio' || paramKey === 'dutyCycle' || paramKey === 'centerRadius') {
      min = 0;
      max = 1;
    } else if (paramKey === 'amount' && (effectType === 'invert' || effectType === 'vignette')) {
      min = 0;
      max = 1;
    } else if (paramKey === 'progress' || paramKey === 'centerX' || paramKey === 'centerY' || paramKey === 'centerAnchor' || paramKey === 'grayLevel' || paramKey === 'x' || paramKey === 'y' || paramKey === 'horizonHeight' || paramKey === 'center') {
      min = 0;
      max = 100;
    } else if (paramKey === 'inset') {
      min = 0;
      max = 45;
    } else if (paramKey === 'radius' && effectType === 'vignette') {
      min = 0;
      max = 1.5;
    } else if (paramKey === 'radius' && effectType === 'irisWipe') {
      min = 0;
      max = 150;
    } else if (paramKey === 'count' || paramKey === 'particleCount' || paramKey === 'density') {
      min = 1;
      max =
        paramKey === 'count' &&
        (effectType === 'motionStars' || effectType === 'starfield' || effectType === 'spaceLines')
          ? 3000
          : 500;
    } else if (paramKey === 'sizeVariation' || paramKey === 'lengthVariation') {
      min = 0;
      max = 300;
    } else if (paramKey === 'spinSpeed') {
      min = -720;
      max = 720;
    } else if (paramKey === 'starRotation' || paramKey === 'lineRotation') {
      min = -1080;
      max = 1080;
    } else if (paramKey === 'lineLength') {
      min = 5;
      max = 1200;
    } else if (paramKey === 'lineThickness') {
      min = 0.25;
      max = 40;
    } else if (paramKey === 'countX' || paramKey === 'countY' || paramKey === 'tilesX' || paramKey === 'tilesY' || paramKey === 'columns' || paramKey === 'rows') {
      min = 1;
      max = 24;
    } else if (paramKey === 'segments' || paramKey === 'slatCount' || paramKey === 'rings' || paramKey === 'echoCount' || paramKey === 'branchCount') {
      min = 1;
      max = 64;
    } else if (paramKey === 'levels' || paramKey === 'paletteColors') {
      min = 2;
      max = 64;
    } else if (paramKey === 'quality') {
      min = 1;
      max = 8;
    } else if (paramKey === 'bladeCount') {
      min = 3;
      max = 16;
    } else if (paramKey === 'scale' || paramKey === 'scaleZ' || paramKey === 'zoom' || paramKey === 'minScale') {
      min = effectType === 'fractalNoise' ? 1 : 0.01;
      max = effectType === 'fractalNoise' ? 400 : 10;
    } else if (paramKey === 'brightness' || paramKey === 'contrast' || paramKey === 'saturation' || paramKey === 'gamma' || paramKey === 'lightness' || paramKey === 'red' || paramKey === 'green' || paramKey === 'blue') {
      min = paramKey === 'gamma' ? 0.1 : 0;
      max = 5;
    } else if (paramKey === 'exposure') {
      min = -5;
      max = 5;
    } else if (paramKey === 'intensity' || paramKey === 'strength' || paramKey === 'heat' || paramKey === 'lightIntensity' || paramKey === 'strokeIntensity') {
      min = 0;
      max = Math.max(10, Math.round(meta.max * 3));
    } else if (!isInt) {
      min = meta.min < 0 ? meta.min * 3 : 0;
      max = Math.max(meta.max * 3, min + 100);
    }
  }

  if (!isInt) {
    if (mode === 'micro') {
      const span = Math.max(0.01, max - min);
      const rawStep = span <= 2 ? 0.001 : span <= 200 ? 0.01 : 0.05;
      step = Math.min(meta.step, rawStep);
      decimals = step < 0.005 ? 3 : step < 0.05 ? 2 : 1;
    } else if (mode === 'fine') {
      const scaled = meta.step * 0.2;
      step = Math.max(0.01, Number(scaled.toFixed(3)));
      decimals = step < 0.05 ? 2 : 1;
    } else if (mode === 'macro') {
      step = meta.step >= 1 ? Math.round(meta.step * 2.5) : Number((meta.step * 2.5).toFixed(2));
    }
  }

  return {
    ...meta,
    min,
    max,
    step,
    decimals,
    isInteger: isInt,
  };
}

export function getEffectParamMeta(
  paramKey: string,
  paramVal: unknown,
  effectType?: string,
  controlOptions?: EffectParamControlOptions
): EffectParamMeta {
  const base = getBaseEffectParamMeta(paramKey, paramVal, effectType);
  return applyPrecisionAndExtendedBounds(base, paramKey, effectType, controlOptions);
}

function getBaseEffectParamMeta(
  paramKey: string,
  paramVal: unknown,
  effectType?: string
): EffectParamMeta {
  const k = paramKey;
  const labelAr = AR_PARAM_LABELS[k] || k;
  const EN_OVERRIDE_LABELS: Record<string, string> = {
    starShape: 'Star Shape',
    lineStyle: 'Line Pattern',
    lineCapStyle: 'Line Style',
    lineLength: 'Line Length',
    lineThickness: 'Line Thickness',
    lengthVariation: 'Length Variation',
    lineRotation: 'Line Angle',
  };
  const labelEn = EN_OVERRIDE_LABELS[k] || k;

  // Discrete Axis options
  if (k === 'axis') {
    const options: EffectParamOption[] =
      effectType === 'flip3d'
        ? [
            { value: 'x', labelAr: 'محور X', labelEn: 'X Axis' },
            { value: 'y', labelAr: 'محور Y', labelEn: 'Y Axis' },
            { value: 'z', labelAr: 'محور Z', labelEn: 'Z Axis' },
          ]
        : [
            { value: 'x', labelAr: 'أفقي (X)', labelEn: 'X Axis' },
            { value: 'y', labelAr: 'عمودي (Y)', labelEn: 'Y Axis' },
          ];
    return { min: 0, max: 1, step: 1, decimals: 0, unit: '', labelAr, labelEn, options };
  }

  if (DISCRETE_OPTION_PARAMS[k]) {
    return {
      min: 0,
      max: 1,
      step: 1,
      decimals: 0,
      unit: '',
      labelAr,
      labelEn,
      options: DISCRETE_OPTION_PARAMS[k],
    };
  }

  if (BOOLEAN_PARAM_KEYS.has(k)) {
    return {
      min: 0,
      max: 1,
      step: 1,
      decimals: 0,
      unit: '',
      labelAr,
      labelEn,
      isBoolean: true,
    };
  }

  if (k === 'mix') {
    return { min: 0, max: 100, step: 0.5, decimals: 1, unit: '%', labelAr, labelEn };
  }
  if (k === 'phase') {
    return { min: -360, max: 360, step: 1, decimals: 0, unit: '°', labelAr, labelEn };
  }
  if (k === 'minScale') {
    return { min: 0.1, max: 2.0, step: 0.02, decimals: 2, unit: 'x', labelAr, labelEn };
  }
  if (k === 'rotAmount') {
    return { min: 0, max: 5, step: 0.05, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'inset') {
    return { min: 0, max: 45, step: 0.5, decimals: 1, unit: '%', labelAr, labelEn };
  }
  if (k === 'center') {
    return { min: 0, max: 100, step: 0.5, decimals: 1, unit: '%', labelAr, labelEn };
  }
  if (k === 'centerRadius') {
    return { min: 0, max: 1, step: 0.01, decimals: 2, unit: '', labelAr, labelEn };
  }

  // Special temperature white balance
  if (k === 'temperature') {
    return { min: 2000, max: 12000, step: 50, decimals: 0, unit: 'K', labelAr, labelEn };
  }

  // Exposure / color grading
  if (k === 'exposure') {
    return { min: -2.0, max: 2.0, step: 0.02, decimals: 2, unit: 'EV', labelAr, labelEn };
  }
  if (k === 'offset') {
    if (effectType === 'mirror') {
      return { min: -100, max: 100, step: 1, decimals: 0, unit: '%', labelAr, labelEn };
    }
    return { min: -0.5, max: 0.5, step: 0.01, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'gamma') {
    return { min: 0.2, max: 3.0, step: 0.02, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'brightness' || k === 'contrast' || k === 'saturation' || k === 'lightness') {
    if (k === 'brightness' && (effectType === 'motionStars' || effectType === 'starfield')) {
      return { min: 0.2, max: 2.5, step: 0.05, decimals: 2, unit: 'x', labelAr: 'سطوع النجوم', labelEn: 'Star Brightness' };
    }
    if (k === 'brightness' && effectType === 'spaceLines') {
      return { min: 0.2, max: 2.5, step: 0.05, decimals: 2, unit: 'x', labelAr: 'سطوع الخطوط', labelEn: 'Line Brightness' };
    }
    return { min: 0.0, max: 3.0, step: 0.02, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'red' || k === 'green' || k === 'blue') {
    return { min: 0.0, max: 2.5, step: 0.02, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'hue') {
    return { min: -180, max: 180, step: 1, decimals: 0, unit: '°', labelAr, labelEn };
  }
  if (k === 'tint') {
    return { min: -50, max: 50, step: 0.5, decimals: 1, unit: '', labelAr, labelEn };
  }
  if (k === 'levels' || k === 'paletteColors') {
    return { min: 2, max: 32, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'bands') {
    return { min: 2, max: 12, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }

  // Integer qualities / blade counts / complexities
  if (k === 'quality') {
    return { min: 1, max: 5, step: 1, decimals: 0, unit: 'x', labelAr, labelEn };
  }
  if (k === 'bladeCount') {
    return { min: 3, max: 12, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'complexity') {
    return { min: 1, max: 6, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'decimals') {
    return { min: 0, max: 4, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }

  // Refractive index & physics ratios
  if (k === 'refractiveIndex') {
    return { min: 1.0, max: 3.0, step: 0.05, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'heat' || k === 'lightIntensity' || k === 'bounciness') {
    return { min: 0.1, max: 3.0, step: 0.05, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'gravity') {
    return { min: 0.1, max: 3.0, step: 0.05, decimals: 2, unit: 'g', labelAr, labelEn };
  }
  if (k === 'overshoot') {
    return { min: 1.0, max: 2.2, step: 0.02, decimals: 2, unit: 'x', labelAr, labelEn };
  }
  if (k === 'zoom') {
    return { min: 0.3, max: 3.0, step: 0.05, decimals: 2, unit: 'x', labelAr, labelEn };
  }
  if (k === 'lineGap') {
    return { min: 0.8, max: 2.5, step: 0.05, decimals: 2, unit: 'x', labelAr, labelEn };
  }
  if (k === 'perspective') {
    return { min: 200, max: 2000, step: 20, decimals: 0, unit: 'px', labelAr, labelEn };
  }
  if (k === 'distance') {
    return { min: 150, max: 1200, step: 10, decimals: 0, unit: 'px', labelAr, labelEn };
  }
  if (k === 'elevation') {
    return { min: -90, max: 90, step: 1, decimals: 0, unit: '°', labelAr, labelEn };
  }
  if (k === 'temperature' || k === 'startVal' || k === 'endVal') {
    return { min: -10000, max: 100000, step: 10, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'fontSize') {
    return { min: 8, max: 48, step: 1, decimals: 0, unit: 'px', labelAr, labelEn };
  }
  if (k === 'wavelength') {
    return { min: 1, max: 24, step: 0.5, decimals: 1, unit: '', labelAr, labelEn };
  }

  // Normalized 0..1 controls
  if (
    k === 'blend' ||
    k === 'opacity' ||
    k === 'minOpacity' ||
    k === 'maxOpacity' ||
    k === 'dutyCycle' ||
    k === 'threshold' ||
    k === 'edgeThreshold' ||
    k === 'interpolation' ||
    k === 'smoothing' ||
    k === 'paperTone' ||
    k === 'roundness' ||
    k === 'curvature' && effectType === 'scanlines' ||
    k === 'feather' && (effectType === 'chroma' || effectType === 'chromaKey') ||
    k === 'softness' ||
    k === 'decay' ||
    k === 'rayLength' ||
    k === 'noiseLevel' ||
    k === 'syncRoll' ||
    k === 'trackingNoise' ||
    k === 'glitchChance' ||
    k === 'staggerRatio' ||
    (k === 'density' && effectType === 'smoke')
  ) {
    return { min: 0, max: 1, step: 0.01, decimals: 2, unit: '', labelAr, labelEn };
  }

  if (k === 'amount') {
    if (effectType === 'invert' || effectType === 'vignette' || effectType === 'squeeze') {
      return { min: 0, max: 1, step: 0.01, decimals: 2, unit: '', labelAr, labelEn };
    }
    if (effectType === 'chromatic') {
      return { min: 0, max: 40, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
    }
    if (effectType === 'sharpen') {
      return { min: 0, max: 4, step: 0.05, decimals: 2, unit: '', labelAr, labelEn };
    }
    return { min: 0, max: 100, step: 0.5, decimals: 1, unit: '', labelAr, labelEn };
  }

  if (k === 'strength') {
    if (effectType === 'bulge' || effectType === 'pinchBulge' || effectType === 'sphere3d') {
      return { min: -1, max: 1.5, step: 0.02, decimals: 2, unit: '', labelAr, labelEn };
    }
    if (effectType === 'bloom') {
      return { min: 0, max: 3, step: 0.05, decimals: 2, unit: '', labelAr, labelEn };
    }
    return { min: 0, max: 100, step: 0.5, decimals: 1, unit: '', labelAr, labelEn };
  }

  if (k === 'intensity') {
    if (effectType === 'filmGrain' || effectType === 'glitch' || effectType === 'glitchBlocks') {
      return { min: 0, max: 1.5, step: 0.01, decimals: 2, unit: '', labelAr, labelEn };
    }
    return { min: 0, max: 4, step: 0.05, decimals: 2, unit: '', labelAr, labelEn };
  }

  // Angles & rotations
  if (
    k === 'angle' ||
    k === 'startAngle' ||
    k === 'lightAngle' ||
    k === 'direction' ||
    k === 'rotation' ||
    k === 'rotX' ||
    k === 'rotY' ||
    k === 'rotZ' ||
    k === 'flipAngle' ||
    k === 'angleStep' ||
    k === 'twist'
  ) {
    return { min: -360, max: 360, step: 0.5, decimals: 1, unit: '°', labelAr, labelEn };
  }

  // Positions / Percentages / Progress
  if (
    k === 'progress' ||
    k === 'centerX' ||
    k === 'centerY' ||
    k === 'centerAnchor' ||
    k === 'grayLevel' ||
    k === 'x' ||
    k === 'y' ||
    k === 'horizonHeight' ||
    k === 'flameHeight'
  ) {
    return { min: 0, max: 100, step: 0.5, decimals: 1, unit: '%', labelAr, labelEn };
  }

  // Offsets & Spatial steps
  if (
    k === 'offsetX' ||
    k === 'offsetY' ||
    k === 'stepX' ||
    k === 'stepY' ||
    k === 'maxHorizontal' ||
    k === 'maxVertical'
  ) {
    return { min: -150, max: 150, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k === 'speedX' || k === 'speedY') {
    return { min: -300, max: 300, step: 2, decimals: 0, unit: 'px/s', labelAr, labelEn };
  }
  if (k === 'wind') {
    return { min: -40, max: 40, step: 0.5, decimals: 1, unit: '', labelAr, labelEn };
  }
  if (k === 'windSway') {
    return { min: 0, max: 60, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k === 'chokeAmount') {
    return { min: -10, max: 10, step: 0.25, decimals: 2, unit: '', labelAr, labelEn };
  }

  // Frequencies & Speeds
  if (k === 'reactivity' && (effectType === 'motionStars' || effectType === 'starfield' || effectType === 'spaceLines')) {
    return { min: 0, max: 5, step: 0.05, decimals: 2, unit: 'x', labelAr, labelEn };
  }
  if (k === 'floatSpeed' && (effectType === 'motionStars' || effectType === 'starfield' || effectType === 'spaceLines')) {
    return { min: 0, max: 20, step: 0.1, decimals: 1, unit: 'Hz', labelAr, labelEn };
  }
  if (k.includes('frequency') || k === 'reactivity' || k === 'floatSpeed' || k === 'evolutionSpeed') {
    if (effectType === 'wave') {
      return { min: 0.005, max: 0.3, step: 0.005, decimals: 3, unit: '', labelAr, labelEn };
    }
    return { min: 0.05, max: 30, step: 0.05, decimals: 2, unit: 'Hz', labelAr, labelEn };
  }
  if (k === 'twinkle' && (effectType === 'motionStars' || effectType === 'starfield' || effectType === 'spaceLines')) {
    return { min: 0, max: 20, step: 0.1, decimals: 1, unit: '', labelAr, labelEn };
  }
  if (
    k === 'speed' ||
    k === 'waveSpeed' ||
    k === 'snapSpeed' ||
    k === 'rotSpeed' ||
    k === 'scrambleSpeed' ||
    k === 'twinkle'
  ) {
    return { min: -20, max: 40, step: 0.1, decimals: 1, unit: '', labelAr, labelEn };
  }
  if (k === 'rotationsPerSec') {
    return { min: 0, max: 6, step: 0.05, decimals: 2, unit: 'rps', labelAr, labelEn };
  }
  if (
    k === 'inDuration' ||
    k === 'outDuration' ||
    k === 'cycleDuration' ||
    k === 'duration' ||
    k === 'flipDuration'
  ) {
    return { min: 0.05, max: 10, step: 0.05, decimals: 2, unit: 's', labelAr, labelEn };
  }
  if (k === 'delayPerChar') {
    return { min: 0.01, max: 0.5, step: 0.01, decimals: 2, unit: 's', labelAr, labelEn };
  }

  // Counts & Tiles
  if (k === 'count') {
    if (effectType === 'motionStars' || effectType === 'starfield') {
      return { min: 5, max: 2000, step: 5, decimals: 0, unit: '', labelAr: 'كمية النجوم', labelEn: 'Star Count', isInteger: true };
    }
    if (effectType === 'spaceLines') {
      return { min: 5, max: 2000, step: 5, decimals: 0, unit: '', labelAr: 'كمية الخطوط', labelEn: 'Line Count', isInteger: true };
    }
    return { min: 1, max: 120, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'sizeVariation' || k === 'lengthVariation') {
    return {
      min: 0,
      max: 200,
      step: 5,
      decimals: 0,
      unit: '%',
      labelAr,
      labelEn: k === 'lengthVariation' ? 'Length Variation' : 'Size Variation',
    };
  }
  if (k === 'starRotation' || k === 'lineRotation') {
    return {
      min: -180,
      max: 180,
      step: 1,
      decimals: 0,
      unit: '°',
      labelAr,
      labelEn: k === 'lineRotation' ? 'Line Angle' : 'Shape Angle',
    };
  }
  if (k === 'spinSpeed') {
    return {
      min: -180,
      max: 180,
      step: 2,
      decimals: 0,
      unit: '°/s',
      labelAr: effectType === 'spaceLines' ? 'سرعة دوران الخطوط' : labelAr,
      labelEn: effectType === 'spaceLines' ? 'Line Spin' : 'Shape Spin',
    };
  }
  if (k === 'lineLength') {
    return { min: 10, max: 400, step: 2, decimals: 0, unit: 'px', labelAr, labelEn: 'Line Length' };
  }
  if (k === 'lineThickness') {
    return { min: 0.5, max: 18, step: 0.25, decimals: 2, unit: 'px', labelAr, labelEn: 'Line Thickness' };
  }
  if (k === 'countX' || k === 'countY' || k === 'tilesX' || k === 'tilesY' || k === 'columns' || k === 'rows') {
    return { min: 1, max: 12, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'segments' || k === 'slatCount' || k === 'rings' || k === 'echoCount' || k === 'branchCount') {
    return { min: 2, max: 32, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'particleCount') {
    return { min: 5, max: 180, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'delayFrames') {
    return { min: 1, max: 20, step: 1, decimals: 0, unit: 'f', labelAr, labelEn };
  }
  if (k === 'density') {
    return { min: 3, max: 220, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'seed') {
    return { min: 1, max: 100, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }

  // 3D & DOF
  if (k === 'focalDepth') return { min: -500, max: 500, step: 2, decimals: 0, unit: 'px', labelAr, labelEn };
  if (k === 'focalRange') return { min: 10, max: 500, step: 2, decimals: 0, unit: 'px', labelAr, labelEn };
  if (k === 'depth' || k === 'zDepth') return { min: 1, max: 300, step: 1, decimals: 0, unit: 'px', labelAr, labelEn };
  if (
    k === 'floatAmount' ||
    k === 'amplitude' ||
    k === 'waveHeight' ||
    k === 'bobbing' ||
    k === 'magnitude' ||
    k === 'jumpHeight' ||
    k === 'turbulence'
  ) {
    return { min: 0, max: 150, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k === 'height') return { min: 10, max: 400, step: 2, decimals: 0, unit: 'px', labelAr, labelEn };
  if (k === 'spread') {
    if (effectType === 'confetti') return { min: 30, max: 360, step: 5, decimals: 0, unit: '°', labelAr, labelEn };
    return { min: 20, max: 300, step: 2, decimals: 0, unit: '%', labelAr, labelEn };
  }
  if (k === 'starSize') return { min: 0.5, max: 30, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn: 'Star Size' };
  if (k === 'trailLength') return { min: 0, max: 100, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  if (k === 'scale') {
    if (effectType === 'fractalNoise') {
      return { min: 5, max: 150, step: 1, decimals: 0, unit: '', labelAr, labelEn };
    }
    return { min: 0.2, max: 4, step: 0.05, decimals: 2, unit: 'x', labelAr, labelEn };
  }
  if (k === 'scaleZ') return { min: 0.2, max: 3, step: 0.05, decimals: 2, unit: 'x', labelAr, labelEn };

  // Blur / Radius / Stroke / Shadow / Size
  if (k === 'radius' && effectType === 'vignette') {
    return { min: 0.05, max: 0.95, step: 0.02, decimals: 2, unit: '', labelAr, labelEn };
  }
  if (k === 'radius' && (effectType === 'bulge' || effectType === 'ripple' || effectType === 'swirl' || effectType === 'sphere3d' || effectType === 'cylinder3d' || effectType === 'radialRepeat')) {
    return { min: 20, max: 400, step: 2, decimals: 0, unit: 'px', labelAr, labelEn };
  }
  if (k === 'radius' && effectType === 'irisWipe') {
    return { min: 5, max: 100, step: 1, decimals: 0, unit: '%', labelAr, labelEn };
  }
  if (k === 'radiusStep') {
    return { min: 2, max: 60, step: 1, decimals: 0, unit: 'px', labelAr, labelEn };
  }
  if (k === 'radius' && effectType === 'sharpen') {
    return { min: 1, max: 5, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k.includes('blur') || k.includes('Blur') || k.includes('radius') || k.includes('Radius') || k === 'feather') {
    return { min: 0, max: 120, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k === 'size') {
    if (effectType === 'filmGrain') return { min: 1, max: 6, step: 0.2, decimals: 1, unit: 'px', labelAr, labelEn };
    if (effectType === 'turbulent') return { min: 10, max: 200, step: 2, decimals: 0, unit: 'px', labelAr, labelEn };
    return { min: 2, max: 64, step: 1, decimals: 0, unit: 'px', labelAr, labelEn };
  }
  if (k === 'strokeWidth' || k === 'inkWidth' || k === 'width' || k === 'dotRadius' || k === 'lineSpacing' || k === 'grainSize' || k === 'bevel') {
    return { min: 0.5, max: 40, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k === 'border') {
    return { min: 0, max: 10, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k === 'length' || k === 'sortLength' || k === 'boxSize' || k === 'blockSize' || k === 'hexRadius') {
    return { min: 4, max: 200, step: 1, decimals: 0, unit: 'px', labelAr, labelEn };
  }
  if (k === 'curvature') {
    return { min: -120, max: 120, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }
  if (k === 'colorBleed') {
    return { min: 0, max: 15, step: 0.5, decimals: 1, unit: 'px', labelAr, labelEn };
  }
  if (k === 'tolerance') {
    return { min: 1, max: 100, step: 1, decimals: 0, unit: '', labelAr, labelEn };
  }

  // Fallback
  const num = typeof paramVal === 'number' ? paramVal : 0;
  if (num > 0 && num <= 1) {
    return { min: 0, max: 2, step: 0.01, decimals: 2, unit: '', labelAr, labelEn };
  }
  return { min: 0, max: Math.max(100, Math.ceil(num * 2)), step: 0.5, decimals: 1, unit: '', labelAr, labelEn };
}
