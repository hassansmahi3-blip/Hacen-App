/**
 * Hacen-App (AutoEditor) — Cinematic Image Aesthetics & GPU Shader Transitions
 * المسار المقترح في المستودع: source_code/lib/cinematicEffects.js
 *
 * يجمع أقوى الميزات الجمالية من البرامج المنافسة والمشاريع مفتوحة المصدر:
 * - gl-transitions (https://github.com/gl-transitions/gl-transitions): SimpleZoom, FadeColor, StarWipe, Revolve
 * - xfade-easing (https://github.com/scriptituk/xfade-easing): منحنيات تسارع غير خطية ناعمة لـ FFmpeg وCanvas
 * - CapCut & DaVinci Resolve Aesthetics:
 *   1. Smart Blurred Backdrop + Drop Shadow + Rounded Corners للصور
 *   2. 2.5D Parallax & 3D Perspective Card Tilt
 *   3. Directional Motion Blur (ضبابية الحركة السلسة أثناء الانتقال)
 *   4. Procedural Overlays (Vignette, Documentary Spotlight, Film Grain, Warm/Cinema Grading)
 */

import { EASING_FUNCTIONS, renderWhiteboardFrameNoHand } from './whiteboardEngine.js';

/**
 * رسم صورة بجمالية البطاقة السينمائية (Smart Blurred Backdrop + Drop Shadow + 2.5D Parallax)
 * يمنع ظهور الحواف السوداء حول الصور ويجعلها تتحرك بنعومة فائقة (Sub-pixel precision).
 */
export function renderCinematicImageCard(ctx, image, options = {}) {
  const {
    canvasWidth = 1920,
    canvasHeight = 1080,
    progress = 0, // 0.0 -> 1.0
    mode = 'parallax_card_3d', // 'parallax_card_3d' | 'smooth_ken_burns_in' | 'smooth_ken_burns_out' | 'pendulum_float_3d' | 'whiteboard_no_hand'
    intensityPercent = 75,
    smartBackdrop = true,
    cornerRadius = 24,
    vignetteStrength = 0.28,
    spotlightFocus = null, // { x: 0.5, y: 0.5, radius: 0.35 } للتأثير الوثائقي
    whiteboardStyle = 'CLEAN_MARKER',
    frameIndex = 0,
  } = options;

  // إذا كان النمط المختار هو السبورة البيضاء (بدون يد)، نمرره مباشرة لمحرك السبورة
  if (mode === 'whiteboard_no_hand') {
    renderWhiteboardFrameNoHand(ctx, image, {
      canvasWidth,
      canvasHeight,
      progress,
      frameIndex,
      styleId: whiteboardStyle,
      intensityPercent,
      enableLineBoil: true,
      enableCameraMotion: true,
    });
    return;
  }

  const intensity = Math.max(0, Math.min(100, intensityPercent)) / 100;
  const t = EASING_FUNCTIONS.easeInOutCubic(Math.max(0, Math.min(1, progress)));

  const imgW = image.width || image.videoWidth || canvasWidth;
  const imgH = image.height || image.videoHeight || canvasHeight;

  ctx.save();

  // 1. الخلفية الضبابية الذكية (Smart Blurred Backdrop) تتحرك بسرعة معاكسة لإعطاء عمق 2.5D Parallax
  if (smartBackdrop) {
    const bgScale = Math.max(canvasWidth / imgW, canvasHeight / imgH) * (1.18 - 0.08 * t * intensity);
    const bgW = imgW * bgScale;
    const bgH = imgH * bgScale;
    const bgPanX = Math.sin(progress * Math.PI) * (-18 * intensity);
    const bgPanY = Math.cos(progress * Math.PI) * (-10 * intensity);

    ctx.save();
    ctx.filter = 'blur(28px) brightness(0.48) saturate(1.25)';
    ctx.drawImage(
      image,
      (canvasWidth - bgW) / 2 + bgPanX,
      (canvasHeight - bgH) / 2 + bgPanY,
      bgW,
      bgH
    );
    ctx.filter = 'none';
    ctx.restore();
  } else {
    ctx.fillStyle = '#0B0D12';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. حساب حركة الطبقة الأمامية وفق النمط المختار
  let fgScale = 1.0;
  let fgX = 0;
  let fgY = 0;
  let fgRotation = 0;
  let skewX = 0;

  if (mode === 'smooth_ken_burns_in') {
    fgScale = 1.0 + 0.18 * intensity * t;
    fgX = Math.sin(progress * Math.PI) * (14 * intensity);
  } else if (mode === 'smooth_ken_burns_out') {
    fgScale = 1.0 + 0.18 * intensity * (1 - t);
    fgX = Math.cos(progress * Math.PI) * (14 * intensity);
  } else if (mode === 'pendulum_float_3d') {
    fgScale = 1.03 + 0.06 * intensity * Math.sin(progress * Math.PI);
    fgRotation = Math.sin(progress * Math.PI * 2) * (0.025 * intensity);
    fgY = Math.sin(progress * Math.PI * 2) * (12 * intensity);
    skewX = Math.cos(progress * Math.PI * 2) * (0.018 * intensity);
  } else {
    // parallax_card_3d
    fgScale = 0.94 + 0.10 * intensity * t;
    fgX = (t - 0.5) * (26 * intensity);
    fgY = Math.sin(progress * Math.PI) * (-12 * intensity);
    fgRotation = (t - 0.5) * (0.018 * intensity);
  }

  // أبعاد البطاقة الأمامية
  const marginFactor = smartBackdrop ? 0.86 : 1.0;
  const baseFit = Math.min((canvasWidth * marginFactor) / imgW, (canvasHeight * marginFactor) / imgH);
  const cardW = imgW * baseFit;
  const cardH = imgH * baseFit;

  ctx.save();
  ctx.translate(canvasWidth / 2 + fgX, canvasHeight / 2 + fgY);
  ctx.rotate(fgRotation);
  if (skewX !== 0) {
    ctx.transform(1, 0, skewX, 1, 0, 0);
  }
  ctx.scale(fgScale, fgScale);

  // 3. ظل سينمائي ناعم (Drop Shadow) وحواف دائرية (Rounded Card Clipping)
  if (smartBackdrop) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 42;
    ctx.shadowOffsetY = 18;
  }

  drawRoundedImage(ctx, image, -cardW / 2, -cardH / 2, cardW, cardH, smartBackdrop ? cornerRadius : 0);

  // 4. لمعة ضوئية خفيفة تعبر فوق البطاقة (Subtle Specular Light Sweep)
  if (smartBackdrop && intensity > 0.2) {
    const sweepPos = -cardW + t * (cardW * 2.2);
    const sheenGrad = ctx.createLinearGradient(sweepPos, -cardH / 2, sweepPos + cardW * 0.35, cardH / 2);
    sheenGrad.addColorStop(0, 'rgba(255,255,255,0)');
    sheenGrad.addColorStop(0.5, `rgba(255,255,255,${(0.08 * intensity).toFixed(3)})`);
    sheenGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
  }

  ctx.restore();

  // 5. التأثير الوثائقي الاختياري (Documentary Spotlight Focus)
  if (spotlightFocus) {
    const sx = (spotlightFocus.x ?? 0.5) * canvasWidth;
    const sy = (spotlightFocus.y ?? 0.5) * canvasHeight;
    const sr = (spotlightFocus.radius ?? 0.3) * Math.min(canvasWidth, canvasHeight);
    const spotGrad = ctx.createRadialGradient(sx, sy, sr * 0.25, sx, sy, sr * 1.6);
    spotGrad.addColorStop(0, 'rgba(0,0,0,0)');
    spotGrad.addColorStop(1, 'rgba(0,0,0,0.68)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // 6. تظليل الأطراف السينمائي (Cinematic Vignette)
  if (vignetteStrength > 0) {
    const rad = Math.hypot(canvasWidth, canvasHeight) / 2;
    const vig = ctx.createRadialGradient(
      canvasWidth / 2,
      canvasHeight / 2,
      rad * 0.45,
      canvasWidth / 2,
      canvasHeight / 2,
      rad
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${vignetteStrength})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.restore();
}

/**
 * مساعد رسم صورة بحواف دائرية
 */
function drawRoundedImage(ctx, image, x, y, width, height, radius) {
  if (radius <= 0) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}

/**
 * انتقالات سينمائية مستوحاة من gl-transitions مع ضبابية الحركة (Motion Blur) ومنحنيات Easing
 * تعمل مباشرة داخل مسار المتصفح (WebCodecs / Canvas) بسرعة فائقة.
 */
export function renderGLStyleTransition(ctx, fromDrawable, toDrawable, options = {}) {
  const {
    width = 1920,
    height = 1080,
    rawProgress = 0, // 0.0 -> 1.0
    transitionType = 'simple_zoom', // 'simple_zoom' | 'whip_pan_blur' | 'fade_color' | 'revolve_3d' | 'star_iris'
    fadeColorHex = '#0E1015',
  } = options;

  const p = EASING_FUNCTIONS.easeInOutCubic(Math.max(0, Math.min(1, rawProgress)));
  ctx.save();

  switch (transitionType) {
    case 'simple_zoom': {
      // مستوحى من SimpleZoom.glsl في gl-transitions
      const zoomOut = 1 + p * 0.35;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoomOut, zoomOut);
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(fromDrawable, -width / 2, -height / 2, width, height);
      ctx.restore();

      const zoomIn = 1.25 - p * 0.25;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoomIn, zoomIn);
      ctx.globalAlpha = p;
      ctx.drawImage(toDrawable, -width / 2, -height / 2, width, height);
      ctx.restore();
      break;
    }

    case 'whip_pan_blur': {
      // انتقال سحب سريع مع محاكاة ضبابية الحركة الاتجاهية (Directional Motion Blur)
      const velocity = Math.sin(rawProgress * Math.PI); // أقصى سرعة في المنتصف
      const blurSteps = 4;
      const offsetMain = -p * width;

      for (let i = 0; i < blurSteps; i++) {
        const stepShift = (i - blurSteps / 2) * velocity * 18;
        ctx.globalAlpha = 1 / blurSteps;
        ctx.drawImage(fromDrawable, offsetMain + stepShift, 0, width, height);
        ctx.drawImage(toDrawable, offsetMain + width + stepShift, 0, width, height);
      }
      ctx.globalAlpha = 1;
      break;
    }

    case 'fade_color': {
      // مستوحى من fadecolor.glsl في gl-transitions
      const dist = Math.abs(p - 0.5) * 2; // 1 -> 0 -> 1
      const activeDrawable = p < 0.5 ? fromDrawable : toDrawable;
      ctx.drawImage(activeDrawable, 0, 0, width, height);
      ctx.fillStyle = fadeColorHex;
      ctx.globalAlpha = 1 - dist;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'revolve_3d': {
      // مستوحى من Revolve.glsl في gl-transitions
      ctx.save();
      const angle = (1 - p) * 0.12;
      ctx.translate(width / 2, height / 2);
      ctx.scale(1 - p * 0.15, 1);
      ctx.rotate(-angle);
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(fromDrawable, -width / 2, -height / 2, width, height);
      ctx.restore();

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(0.85 + p * 0.15, 1);
      ctx.rotate((1 - p) * 0.12);
      ctx.globalAlpha = p;
      ctx.drawImage(toDrawable, -width / 2, -height / 2, width, height);
      ctx.restore();
      break;
    }

    default: {
      // Star / Iris Circle Wipe
      ctx.drawImage(fromDrawable, 0, 0, width, height);
      const maxR = Math.hypot(width, height) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, maxR * p, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(toDrawable, 0, 0, width, height);
      ctx.restore();
      break;
    }
  }

  ctx.restore();
}

/**
 * توليد تعبيرات FFmpeg المحسنة مع منحنيات Easing ومنع رجفة البكسلات (Sub-pixel Supersampling)
 * لاستخدامها داخل دالة buildRenderPlan في server/index.js
 */
export function buildFFmpegSmoothImageFilter({
  width = 1920,
  height = 1080,
  fps = 30,
  durationSec = 5,
  intensityPercent = 75,
  smartBackdrop = true,
}) {
  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const maxZoom = (1 + (0.16 * Math.max(0, Math.min(100, intensityPercent))) / 100).toFixed(4);

  // تكبير مسبق (Supersampling 2x) قبل zoompan لمنع رجفة البكسلات الشهيرة في FFmpeg، مع معادلة جيبية ناعمة (Ease-In-Out)
  const smoothZoomExpr = `1+(${maxZoom}-1)*(0.5-0.5*cos(PI*on/${totalFrames}))`;
  const centerXExpr = `iw/2-(iw/zoom/2)`;
  const centerYExpr = `ih/2-(ih/zoom/2)`;

  if (!smartBackdrop) {
    return [
      `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase`,
      `crop=${width * 2}:${height * 2}`,
      `zoompan=z='${smoothZoomExpr}':x='${centerXExpr}':y='${centerYExpr}':d=${totalFrames}:s=${width}x${height}:fps=${fps}`,
      `vignette=PI/5`,
    ].join(',');
  }

  // فلتر الخلفية الضبابية المزدوجة (Smart Blurred Backdrop) في FFmpeg
  return [
    `split=2[bg][fg];`,
    `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=24:4,eq=brightness=-0.18:saturation=1.2[bg_out];`,
    `[fg]scale=${width * 2}:${height * 2}:force_original_aspect_ratio=decrease,zoompan=z='${smoothZoomExpr}':x='${centerXExpr}':y='${centerYExpr}':d=${totalFrames}:s=${Math.round(width * 0.88)}x${Math.round(height * 0.88)}:fps=${fps}[fg_out];`,
    `[bg_out][fg_out]overlay=(W-w)/2:(H-h)/2:shortest=1,vignette=PI/6`,
  ].join('');
}