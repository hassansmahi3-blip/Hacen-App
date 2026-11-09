/**
 * Hacen-App (AutoEditor) — Low-RAM & High-Speed Render Optimizer
 * المسار المقترح في المستودع: source_code/lib/ramOptimizer.js
 *
 * يعالج كافة عنق الزجاجة ومشاكل استهلاك الرامات (RAM) في المتصفح والخادم المحلي وبيئة Termux:
 * 1. Downscale-on-Load: تقليص أبعاد الصور الكبيرة (4K/8K) فور استيرادها إلى 1.2x من دقة التصدير لتوفير 80% من الرامات.
 * 2. FramePoolGuard: تحرير فوري لكائنات VideoFrame و ImageBitmap في WebCodecs لمنع تسرب الذاكرة (Memory Leaks).
 * 3. Smart Stream Copy (-c copy): مستوحى من LosslessCut (https://github.com/mifi/lossless-cut) للقص السريع بدون إعادة ترميز عند عدم وجود فلاتر.
 * 4. Adaptive Thread & Buffer Limiter: ضبط خيوط FFmpeg تلقائياً لحماية الهواتف (Android/Termux) والأجهزة الضعيفة من OOM Killer.
 */

import os from 'os';

/**
 * تحديد العدد الأمثل لخيوط المعالجة (Threads) وحجم المخزن المؤقت (Buffer)
 * لمنع انهيار الذاكرة على أجهزة أندرويد (Termux) والأجهزة ذات الرامات المحدودة.
 */
export function getOptimalFFmpegResourceFlags(customEnv = process.env) {
  const totalMemGB = os.totalmem() / (1024 * 1024 * 1024);
  const cpuCores = os.cpus()?.length || 2;
  const isTermuxOrAndroid =
    Boolean(customEnv.TERMUX_VERSION) ||
    Boolean(customEnv.PREFIX && customEnv.PREFIX.includes('com.termux')) ||
    os.platform() === 'android';

  if (customEnv.RENDER_THREADS) {
    const manualThreads = Math.max(1, parseInt(customEnv.RENDER_THREADS, 10) || 2);
    return {
      threads: manualThreads,
      filterThreads: 1,
      bufsize: '2M',
      maxMuxingQueueSize: 512,
      preset: 'veryfast',
    };
  }

  // على الهواتف أو الأجهزة التي تقل ذاكرتها عن 4.5GB، نفرض حدوداً صارمة لمنع OOM Killer
  if (isTermuxOrAndroid || totalMemGB <= 4.5) {
    return {
      threads: Math.min(2, cpuCores),
      filterThreads: 1,
      filterComplexThreads: 1,
      bufsize: '2M',
      maxMuxingQueueSize: 400,
      preset: 'ultrafast',
    };
  }

  // للأجهزة المتوسطة (4.5GB - 8GB RAM)
  if (totalMemGB <= 8.5) {
    return {
      threads: Math.min(4, Math.max(2, cpuCores - 1)),
      filterThreads: 2,
      filterComplexThreads: 2,
      bufsize: '4M',
      maxMuxingQueueSize: 1024,
      preset: 'veryfast',
    };
  }

  // للأجهزة القوية (> 8GB RAM)
  return {
    threads: Math.max(2, cpuCores - 1),
    filterThreads: Math.min(4, cpuCores),
    filterComplexThreads: Math.min(4, cpuCores),
    bufsize: '8M',
    maxMuxingQueueSize: 2048,
    preset: 'fast',
  };
}

/**
 * فحص ما إذا كان المقطع قابلاً للقص المباشر بدون إعادة ترميز (Lossless Stream Copy)
 * على غرار مشروع LosslessCut لتقليل وقت التصدير من دقائق إلى ثوانٍ وباستهلاك رام شبه صفري.
 */
export function canUseLosslessStreamCopy(renderPlan) {
  if (!renderPlan || !Array.isArray(renderPlan.clips) || renderPlan.clips.length !== 1) {
    return false;
  }
  const clip = renderPlan.clips[0];
  const hasEffects = Array.isArray(clip.effects) && clip.effects.length > 0;
  const hasCaptions = Array.isArray(renderPlan.captions) && renderPlan.captions.length > 0;
  const hasAutoMotion = Boolean(clip.autoMotion?.enabled);
  const hasCustomAudioMix = Array.isArray(renderPlan.sfx) && renderPlan.sfx.length > 0;
  const isImage = clip.type === 'image';

  return !isImage && !hasEffects && !hasCaptions && !hasAutoMotion && !hasCustomAudioMix;
}

/**
 * بناء معاملات FFmpeg السريعة للنسخ المباشر (Stream Copy) بدون إعادة ترميز
 */
export function buildStreamCopyFFmpegArgs(inputPath, outputPath, startTime = 0, duration = null) {
  const args = ['-hide_banner', '-y'];
  if (startTime > 0) {
    args.push('-ss', String(startTime));
  }
  args.push('-i', inputPath);
  if (duration && duration > 0) {
    args.push('-t', String(duration));
  }
  args.push('-c', 'copy', '-movflags', '+faststart', outputPath);
  return args;
}

/**
 * تقليص حجم الصور الضخمة فور استيرادها في المتصفح (Downscale on Load)
 * بدلاً من الاحتفاظ بصورة 4000x6000 في الرام (تستهلك ~96MB لكل صورة خام)،
 * يتم تحجيمها إلى 1.2x من دقة التصدير (مثلاً 2304x1296 لفيديو 1080p)، مما يوفر 80% من الرام!
 */
export async function loadOptimizedImageBitmap(fileOrBlob, targetWidth = 1920, targetHeight = 1080) {
  const maxSafeW = Math.round(targetWidth * 1.2);
  const maxSafeH = Math.round(targetHeight * 1.2);

  if (typeof createImageBitmap === 'function') {
    const probe = await createImageBitmap(fileOrBlob);
    const origW = probe.width;
    const origH = probe.height;

    if (origW <= maxSafeW && origH <= maxSafeH) {
      return probe;
    }

    const scale = Math.min(maxSafeW / origW, maxSafeH / origH);
    const resizeWidth = Math.max(1, Math.round(origW * scale));
    const resizeHeight = Math.max(1, Math.round(origH * scale));

    // إغلاق الصورة الأصلية الضخمة فوراً لتحرير الرام
    probe.close();

    return await createImageBitmap(fileOrBlob, {
      resizeWidth,
      resizeHeight,
      resizeQuality: 'medium',
    });
  }

  return fileOrBlob;
}

/**
 * حارس تحرير الإطارات (FramePoolGuard) لمسار WebCodecs
 * يضمن إغلاق جميع كائنات VideoFrame و ImageBitmap فور انتهاء رسم الإطار
 * لمنع تراكمها في الذاكرة العشوائية قبل عمل Garbage Collector.
 */
export class FramePoolGuard {
  constructor() {
    this.activeResources = new Set();
  }

  track(resource) {
    if (resource && typeof resource.close === 'function') {
      this.activeResources.add(resource);
    }
    return resource;
  }

  releaseFrame(resource) {
    if (!resource) return;
    try {
      if (typeof resource.close === 'function') {
        resource.close();
      }
    } catch (_) {
      // تم إغلاقه مسبقاً
    } finally {
      this.activeResources.delete(resource);
    }
  }

  releaseAll() {
    for (const res of this.activeResources) {
      try {
        res.close();
      } catch (_) {}
    }
    this.activeResources.clear();
  }
}