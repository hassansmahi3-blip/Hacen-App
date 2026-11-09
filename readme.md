# Hacen-App (AutoEditor) — محرر الفيديو الذكي المحلي 100% (Offline & Zero-API)

محرر فيديو ومونتاج متكامل مفتوح المصدر يعمل **بالكامل بدون إنترنت وبدون أي مفتاح API أو اشتراك سحابي** على سطح المكتب (Windows / macOS / Linux) وعلى هواتف الأندرويد عبر بيئة **Termux**.

## أبرز المميزات (الإصدار المطور 10/10)

* **مونتاج محلي 100% بدون مفاتيح (Zero-API Offline Editing):** جميع عمليات القص، والانتقالات، والكابشنز، والمؤثرات الصوتية، وتحريك الصور تتم محلياً على جهازك.
* **محرك السبورة البيضاء وتحريك الصور الذكي (بدون ظهور اليد):** مستوحى من أسلوب الرسم التوضيحي التدريجي مع إظهار الألوان بنعومة (`Fade-in Color Fill`) واهتزاز الخطوط الحي (`Sketch Line Boil`) بدون ظهور يد الرسم نهائياً (`whiteboardEngine.js`).
* **شريط النسبة التلقائي (`0%` إلى `100%`):** إمكانية تحديد نسبة مئوية في لوحة التحريك (`MotionPanel.js`) ليقوم التطبيق تلقائياً بتوزيع أنماط التحريك والسبورة البيضاء والبطاقات ثلاثية الأبعاد على صور المشروع بضغطة زر واحدة.
* **جماليات سينمائية احترافية (`cinematicEffects.js`):**
  * خلفية ضبابية ذكية للصور (`Smart Blurred Backdrop`) مع حواف دائرية وظل ناعم وتحريك متعدد الطبقات (`2.5D Parallax`).
  * منحنيات تسارع غير خطية (`Cubic-Bezier Easing Curves`) تقضي على الحركة الخطية الجامدة.
  * تكبير فائق النعومة بدون رجفة البكسلات (`Sub-pixel Supersampling`).
  * انتقالات شيدر سينمائية مع ضبابية الحركة الاتجاهية (`Directional Motion Blur`).
* **أقل استهلاك للرامات وأعلى سرعة إخراج (`ramOptimizer.js`):**
  * **تقليص الصور عند الاستيراد (`Downscale on Load`):** يقلل استهلاك الذاكرة للصور عالية الدقة بنسبة تصل إلى 80%.
  * **القص اللحظي بدون إعادة ترميز (`Smart Stream Copy -c copy`):** تصدير المقاطع المقصوصة البسيطة في ثوانٍ معدودة.
  * **حارس الذاكرة (`FramePoolGuard`):** تحرير فوري لإطارات `WebCodecs` وكتابة مباشرة إلى `OPFS` بكتل 16MB لمنع انهيار المتصفح.
  * **حماية الهواتف والأجهزة الضعيفة:** ضبط تلقائي لخيوط FFmpeg (`RENDER_THREADS`) لمنع إغلاق التطبيق بواسطة `OOM Killer` على أندرويد.

## هيكلية الملفات المضافة والمحدثة

| المسار داخل `source_code/` | الوظيفة |
| :--- | :--- |
| `lib/whiteboardEngine.js` | محرك استخراج الحواف (`Sobel Edge Tracing`)، والرسم التدريجي للسبورة البيضاء بدون يد، والتوزيع التلقائي حسب النسبة المئوية (`0% - 100%`). |
| `lib/cinematicEffects.js` | البطاقات السينمائية (`2.5D Parallax`)، والخلفية الضبابية الذكية، وانتقالات `GL-Style` مع `Motion Blur`، وفلاتر FFmpeg الناعمة. |
| `lib/ramOptimizer.js` | تقليل استهلاك الرامات، وتحرير إطارات `WebCodecs`، وتحديد خيوط المعالجة التلقائي لـ Termux وسطح المكتب، والقص اللحظي `-c copy`. |
| `components/panels/MotionPanel.js` | واجهة التحكم في نسبة التحريك التلقائية وأنماط السبورة البيضاء والجماليات البصرية. |

## خطوات التشغيل السريع

### 1. التشغيل على سطح المكتب (Windows / macOS / Linux)

```bash
cd source_code
npm install
npm run dev
```

لتشغيل نسخة تطبيق سطح المكتب (Electron):

```bash
cd source_code
npm run electron:dev
```

### 2. التشغيل على هواتف أندرويد (عبر Termux)

```bash
pkg update && pkg upgrade -y
pkg install nodejs ffmpeg git -y
cd source_code
npm install
node build-dist-termux.mjs
```

## إصلاح مشكلة Git LFS في المستودع (هام جداً لرفع التقييم على GitHub)

حُفظت ملفات الكود النصية سابقاً كمؤشرات `Git LFS` مما يمنع قراءتها مباشرة في متصفح GitHub. لإصلاح ذلك نهائياً وجعل الكود يظهر بشكل طبيعي، استبدل محتوى ملف `.gitattributes` في الجذر بالأسطر التالية:

```gitattributes
*.asar filter=lfs diff=lfs merge=lfs -text
*.mp4 filter=lfs diff=lfs merge=lfs -text
*.wasm filter=lfs diff=lfs merge=lfs -text
*.js text eol=lf
*.mjs text eol=lf
*.cjs text eol=lf
*.json text eol=lf
*.css text eol=lf
*.md text eol=lf
```

ثم نفّذ الأمر التالي في مجلد المستودع لإرجاع ملفات الكود إلى ملفات Git نصية قياسية:

```bash
git lfs migrate export --everything --include="*.js,*.mjs,*.cjs,*.json,*.css,*.md"
git push --force-with-lease
```
