/**
 * Hacen-App (AutoEditor) — Local Whiteboard & Image Animation Engine (No-Hand Edition)
 * المسار المقترح في المستودع: source_code/lib/whiteboardEngine.js
 *
 * مستوحى من:
 * - Golpo AI (https://video.golpoai.com/) — رسم تدريجي للخطوط ثم إظهار الألوان (بدون ظهور اليد نهائياً بناءً على طلبك)
 * - Potrace (https://potrace.sourceforge.net/) & img2svg-animation (https://github.com/a1stok/img2svg-animation)
 * - Rough.js (https://github.com/rough-stuff/rough) — تأثير اهتزاز الخطوط الحي (Sketch Line Boil)
 * - Vivus (https://github.com/maxwellito/vivus) — كشف المسارات التدريجي
 *
 * يعمل محلياً 100% بدون إنترنت وبدون أي مفتاح API، مع استهلاك منخفض جداً للذاكرة (RAM)
 * عبر OffscreenCanvas ومعالجة الصور المصغرة مسبقاً (Downscaled Bitmaps).
 */

// منحنيات التسارع غير الخطية (Easing Curves) بدلاً من الحركة الخطية الجامدة
export const EASING_FUNCTIONS = {
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  springSmooth: (t) => 1 - Math.cos(t * Math.PI * 0.5),
};

// أنماط السبورة البيضاء المتاحة (بدون يد نهائياً)
export const WHITEBOARD_STYLES = {
  CLEAN_MARKER: {
    id: 'clean_marker',
    nameAr: 'سبورة بيضاء نقية (بدون يد)',
    bgColor: '#FFFFFF',
    strokeColor: [24, 24, 27],
    edgeThreshold: 38,
    colorFillStart: 0.55, // يبدأ ظهور الألوان الأصلية عند 55% من وقت الرسم
    lineBoilAmplitude: 1.2,
  },
  CHALKBOARD_DARK: {
    id: 'chalkboard_dark',
    nameAr: 'سبورة طباشير داكنة (بدون يد)',
    bgColor: '#141A17',
    strokeColor: [240, 244, 241],
    edgeThreshold: 42,
    colorFillStart: 0.65,
    lineBoilAmplitude: 1.6,
  },
  EDITORIAL_SKETCH: {
    id: 'editorial_sketch',
    nameAr: 'رسم تحريري ملون (Golpo Studio Style)',
    bgColor: '#FAF7F0',
    strokeColor: [35, 31, 32],
    edgeThreshold: 32,
    colorFillStart: 0.45,
    lineBoilAmplitude: 1.8,
  },
  BLUEPRINT_TECH: {
    id: 'blueprint_tech',
    nameAr: 'مخطط هندسي أزرق (Blueprint)',
    bgColor: '#0D2137',
    strokeColor: [110, 212, 255],
    edgeThreshold: 40,
    colorFillStart: 0.70,
    lineBoilAmplitude: 0.9,
  },
};

/**
 * ذاكرة تخزين مؤقت خفيفة (LRU Cache بحد أقصى 3 صور) لمنع إعادة حساب الحواف لكل إطار
 * مع حماية صارمة لذاكرة الرام (RAM).
 */
class SketchCache {
  constructor(maxEntries = 3) {
    this.maxEntries = maxEntries;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return null;
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key, value) {
    if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      const oldVal = this.map.get(oldestKey);
      if (oldVal?.edgeCanvas && typeof oldVal.edgeCanvas.width === 'number') {
        oldVal.edgeCanvas.width = 0;
        oldVal.edgeCanvas.height = 0;
      }
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }

  clear() {
    for (const val of this.map.values()) {
      if (val?.edgeCanvas) {
        val.edgeCanvas.width = 0;
        val.edgeCanvas.height = 0;
      }
    }
    this.map.clear();
  }
}

export const globalSketchCache = new SketchCache(3);

/**
 * إنشاء لوحة رسم متوافقة مع المتصفح أو العامل الخلفي (Web Worker / OffscreenCanvas)
 */
function createWorkCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/**
 * استخراج حواف الصورة محلياً بسرعة فائقة عبر مرشح Sobel المدمج وترتيب البكسلات
 * لترسم نفسها تدريجياً من الأعلى لليسار نحو الأسفل واليمين (أو من المركز للخارج) بدون أي يد.
 */
export function extractImageSketchData(sourceImage, width, height, styleConfig = WHITEBOARD_STYLES.CLEAN_MARKER) {
  const cacheKey = `${sourceImage?.src || sourceImage?.id || 'img'}_${width}x${height}_${styleConfig.id}`;
  const cached = globalSketchCache.get(cacheKey);
  if (cached) return cached;

  // العمل على دقة داخلية مخفضة قليلاً لاستخراج الحواف بسرعة فائقة وتوفير الرام
  const workW = Math.min(width, 960);
  const workH = Math.round((height / width) * workW);

  const tempCanvas = createWorkCanvas(workW, workH);
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceImage, 0, 0, workW, workH);

  const imgData = ctx.getImageData(0, 0, workW, workH);
  const src = imgData.data;

  // تحويل إلى تدرج رمادي (Luminance)
  const gray = new Uint8Array(workW * workH);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    gray[p] = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
  }

  // حساب حواف Sobel وإنشاء صورة الخطوط الشفافة
  const edgeCanvas = createWorkCanvas(workW, workH);
  const edgeCtx = edgeCanvas.getContext('2d');
  const edgeImgData = edgeCtx.createImageData(workW, workH);
  const dst = edgeImgData.data;

  const threshold = styleConfig.edgeThreshold || 38;
  const [sr, sg, sb] = styleConfig.strokeColor || [24, 24, 27];

  for (let y = 1; y < workH - 1; y++) {
    for (let x = 1; x < workW - 1; x++) {
      const idx = y * workW + x;
      const gx =
        -gray[idx - workW - 1] + gray[idx - workW + 1] +
        -2 * gray[idx - 1] + 2 * gray[idx + 1] +
        -gray[idx + workW - 1] + gray[idx + workW + 1];
      const gy =
        -gray[idx - workW - 1] - 2 * gray[idx - workW] - gray[idx - workW + 1] +
        gray[idx + workW - 1] + 2 * gray[idx + workW] + gray[idx + workW + 1];

      const mag = Math.min(255, Math.hypot(gx, gy));
      const outIdx = idx * 4;

      if (mag > threshold) {
        dst[outIdx] = sr;
        dst[outIdx + 1] = sg;
        dst[outIdx + 2] = sb;
        dst[outIdx + 3] = Math.min(255, (mag - threshold) * 2.4);
      } else {
        dst[outIdx + 3] = 0;
      }
    }
  }

  edgeCtx.putImageData(edgeImgData, 0, 0);

  // تحرير اللوحة المؤقتة فوراً لتقليل استهلاك الرامات
  tempCanvas.width = 0;
  tempCanvas.height = 0;

  const result = { edgeCanvas, workW, workH, styleConfig };
  globalSketchCache.set(cacheKey, result);
  return result;
}

/**
 * رسم إطار واحد من تأثير السبورة البيضاء والتحريك الحي (بدون ظهور اليد نهائياً)
 *
 * @param {CanvasRenderingContext2D} targetCtx - سياق الرسم النهائي للفيديو
 * @param {ImageBitmap|HTMLImageElement} sourceImage - الصورة الأصلية
 * @param {Object} options - إعدادات التحريك والنسبة
 */
export function renderWhiteboardFrameNoHand(targetCtx, sourceImage, options = {}) {
  const {
    canvasWidth = 1920,
    canvasHeight = 1080,
    progress = 0, // من 0.0 إلى 1.0 خلال مدة عرض الصورة
    frameIndex = 0,
    styleId = 'CLEAN_MARKER',
    intensityPercent = 75, // النسبة التي يحددها المستخدم (0% - 100%)
    enableLineBoil = true, // تحريك الخطوط الحي مثل Golpo Studio
    enableCameraMotion = true,
  } = options;

  const style = WHITEBOARD_STYLES[styleId] || WHITEBOARD_STYLES.CLEAN_MARKER;
  const intensity = Math.max(0, Math.min(100, intensityPercent)) / 100;
  const easedProgress = EASING_FUNCTIONS.easeInOutCubic(Math.max(0, Math.min(1, progress)));

  const sketchData = extractImageSketchData(sourceImage, canvasWidth, canvasHeight, style);

  targetCtx.save();

  // 1. رسم خلفية السبورة النقية
  targetCtx.fillStyle = style.bgColor;
  targetCtx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. حساب حركة الكاميرا الناعمة (Sub-pixel Smooth Zoom & Floating بدون رجفة)
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;

  if (enableCameraMotion && intensity > 0) {
    const maxZoom = 1.0 + 0.14 * intensity; // تقريب ناعم يصل إلى 1.14x عند 100%
    scale = 1.0 + (maxZoom - 1.0) * EASING_FUNCTIONS.easeInOutSine(progress);
    // حركة عائمة جيبية ناعمة (Floating Motion)
    offsetX = Math.sin(progress * Math.PI * 2) * (10 * intensity);
    offsetY = Math.cos(progress * Math.PI * 1.5) * (6 * intensity);
  }

  // 3. تأثير اهتزاز الرسم الحي (Sketch Boil مستوحى من Rough.js / Golpo Studio) كل 4 إطارات
  let boilX = 0;
  let boilY = 0;
  let boilRot = 0;
  if (enableLineBoil && intensity > 0) {
    const boilTick = Math.floor(frameIndex / 4);
    const amp = style.lineBoilAmplitude * intensity;
    boilX = Math.sin(boilTick * 12.9898) * amp;
    boilY = Math.cos(boilTick * 78.233) * amp;
    boilRot = Math.sin(boilTick * 45.164) * 0.0025 * intensity;
  }

  targetCtx.translate(canvasWidth / 2 + offsetX + boilX, canvasHeight / 2 + offsetY + boilY);
  targetCtx.rotate(boilRot);
  targetCtx.scale(scale, scale);
  targetCtx.translate(-canvasWidth / 2, -canvasHeight / 2);

  // حساب أبعاد الصورة مع الحفاظ على نسبة العرض إلى الارتفاع (Aspect Ratio)
  const imgW = sourceImage.width || sourceImage.videoWidth || canvasWidth;
  const imgH = sourceImage.height || sourceImage.videoHeight || canvasHeight;
  const fitScale = Math.min((canvasWidth * 0.88) / imgW, (canvasHeight * 0.88) / imgH);
  const drawW = imgW * fitScale;
  const drawH = imgH * fitScale;
  const drawX = (canvasWidth - drawW) / 2;
  const drawY = (canvasHeight - drawH) / 2;

  // 4. كشف تدريجي للخطوط المرسومة (Progressive Diagonal Sweep Reveal بدون أي يد)
  const strokeRevealProgress = Math.min(1, easedProgress / Math.max(0.25, style.colorFillStart));

  targetCtx.save();
  targetCtx.beginPath();
  // كشف قطري متموج يحاكي الرسم الطبيعي السريع على الشاشة بدون ظهور يد
  const revealHeight = drawH * 1.35 * strokeRevealProgress;
  targetCtx.rect(drawX - 20, drawY - 20, drawW + 40, revealHeight);
  targetCtx.clip();

  targetCtx.drawImage(sketchData.edgeCanvas, drawX, drawY, drawW, drawH);
  targetCtx.restore();

  // 5. إظهار الألوان الأصلية للصورة بنعومة بعد تقدم رسم الخطوط (Fade-in Color Fill)
  if (easedProgress > style.colorFillStart) {
    const colorProgress = Math.min(
      1,
      (easedProgress - style.colorFillStart) / (1 - style.colorFillStart)
    );
    const smoothColorAlpha = EASING_FUNCTIONS.easeInOutSine(colorProgress);

    targetCtx.save();
    targetCtx.globalAlpha = smoothColorAlpha * 0.92;
    targetCtx.drawImage(sourceImage, drawX, drawY, drawW, drawH);
    targetCtx.restore();

    // إبقاء طبقة خفيفة من الخطوط المرسومة فوق الصورة الملونة لإعطاء طابع الرسم التوضيحي
    targetCtx.save();
    targetCtx.globalAlpha = 0.35;
    targetCtx.drawImage(sketchData.edgeCanvas, drawX, drawY, drawW, drawH);
    targetCtx.restore();
  }

  targetCtx.restore();
}

/**
 * الموزع التلقائي لنسبة التحريك (Auto-Percentage Timeline Distributor)
 * يقوم بتطبيق التحريك الجمالي تلقائياً على نسبة محددة (0% - 100%) من صور ومقاطع المشروع
 * بضغطة زر واحدة أو بشكل تلقائي عند التصدير.
 *
 * @param {Array} clips - قائمة المقاطع والصور في الشريط الزمني (Timeline)
 * @param {Object} config - إعدادات النسبة والنمط
 */
export function applyAutoAnimationByPercentage(clips = [], config = {}) {
  const {
    coveragePercent = 70, // النسبة المئوية للصور التي سيتم تحريكها تلقائياً (0% - 100%)
    intensityPercent = 75, // قوة وسرعة التحريك (0% - 100%)
    preferredStyle = 'CLEAN_MARKER',
    mixCinematicModes = true, // التنويع بين السبورة البيضاء، والبطاقة ثلاثية الأبعاد، والتقريب الناعم
  } = config;

  if (!Array.isArray(clips) || clips.length === 0) return [];

  const clampedCoverage = Math.max(0, Math.min(100, coveragePercent)) / 100;
  const totalCount = clips.length;
  const targetAnimatedCount = Math.round(totalCount * clampedCoverage);

  const animationPresets = mixCinematicModes
    ? [
        'whiteboard_no_hand',
        'parallax_card_3d',
        'smooth_ken_burns_in',
        'whiteboard_no_hand',
        'pendulum_float_3d',
        'smooth_ken_burns_out',
      ]
    : ['whiteboard_no_hand'];

  // توزيع متوازن (Deterministic Even Spacing) حتى تتوزع الحركات بجمالية على طول الفيديو
  let animatedSoFar = 0;

  return clips.map((clip, index) => {
    const shouldAnimate =
      clampedCoverage >= 1
        ? true
        : clampedCoverage <= 0
        ? false
        : Math.floor(((index + 1) * targetAnimatedCount) / totalCount) > animatedSoFar;

    if (!shouldAnimate) {
      return {
        ...clip,
        autoMotion: {
          enabled: false,
          intensityPercent: 0,
        },
      };
    }

    animatedSoFar++;
    const selectedMode = animationPresets[(index + animatedSoFar) % animationPresets.length];

    return {
      ...clip,
      autoMotion: {
        enabled: true,
        mode: selectedMode,
        whiteboardStyle: preferredStyle,
        showHand: false, // صارم: بدون ظهور اليد نهائياً
        intensityPercent,
        easing: 'easeInOutCubic',
        smartBackdrop: true,
      },
    };
  });
}