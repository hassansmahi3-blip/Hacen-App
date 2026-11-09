/**
 * Hacen-App (AutoEditor) — Updated Motion & Whiteboard Panel Component
 * المسار المقترح في المستودع: source_code/components/panels/MotionPanel.js
 *
 * يضيف:
 * 1. شريط النسبة المئوية التلقائي (0% إلى 100%) لتوزيع التحريك على الصور تلقائياً
 * 2. خيارات السبورة البيضاء (Whiteboard Animation بدون ظهور اليد نهائياً) المستوحاة من Golpo AI
 * 3. تفعيل الخلفية الضبابية الذكية (Smart Blurred Backdrop) ومنحنيات Easing الناعمة
 */

import React, { useState } from 'react';
import { WHITEBOARD_STYLES, applyAutoAnimationByPercentage } from '../../lib/whiteboardEngine.js';

export default function MotionPanel({
  selectedClip,
  clips = [],
  onUpdateClip,
  onUpdateAllClips,
}) {
  const [coveragePercent, setCoveragePercent] = useState(
    selectedClip?.autoMotion?.coveragePercent ?? 75
  );
  const [intensityPercent, setIntensityPercent] = useState(
    selectedClip?.autoMotion?.intensityPercent ?? 75
  );
  const [whiteboardStyle, setWhiteboardStyle] = useState(
    selectedClip?.autoMotion?.whiteboardStyle ?? 'CLEAN_MARKER'
  );
  const [motionMode, setMotionMode] = useState(
    selectedClip?.autoMotion?.mode ?? 'whiteboard_no_hand'
  );
  const [smartBackdrop, setSmartBackdrop] = useState(
    selectedClip?.autoMotion?.smartBackdrop ?? true
  );
  const [mixCinematicModes, setMixCinematicModes] = useState(true);

  // تطبيق الإعدادات على المقطع المحدد حالياً
  const handleApplyToSelected = () => {
    if (!selectedClip || !onUpdateClip) return;
    onUpdateClip(selectedClip.id, {
      ...selectedClip,
      autoMotion: {
        enabled: intensityPercent > 0,
        mode: motionMode,
        whiteboardStyle,
        showHand: false, // بدون ظهور اليد نهائياً
        intensityPercent,
        coveragePercent,
        smartBackdrop,
        easing: 'easeInOutCubic',
      },
    });
  };

  // التوزيع التلقائي الذكي على جميع صور ومقاطع الشريط الزمني وفق النسبة المحددة
  const handleAutoApplyTimeline = () => {
    if (!onUpdateAllClips) return;
    const updated = applyAutoAnimationByPercentage(clips, {
      coveragePercent,
      intensityPercent,
      preferredStyle: whiteboardStyle,
      mixCinematicModes,
    });
    onUpdateAllClips(updated);
  };

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        color: '#F4F4F6',
        backgroundColor: '#12131A',
        borderRadius: '12px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>
          تحريك الصور الذكي والسبورة البيضاء (بدون يد)
        </h3>
        <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
          معالجة محلية 100% بدون إنترنت أو مفاتيح API مع استهلاك منخفض للرام
        </p>
      </div>

      {/* شريط نسبة التغطية التلقائية على التايملاين */}
      <div
        style={{
          background: '#1C1E28',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid #2A2D3D',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>
            نسبة الصور المتحركة تلقائياً في الفيديو
          </label>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8' }}>
            {coveragePercent}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={coveragePercent}
          onChange={(e) => setCoveragePercent(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#38BDF8', cursor: 'pointer' }}
        />
        <small style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#9CA3AF' }}>
          عند ضبطها على {coveragePercent}% سيقوم المحرك بتحريك {coveragePercent}% من صور المشروع تلقائياً.
        </small>
      </div>

      {/* شريط شدة وسرعة الحركة */}
      <div
        style={{
          background: '#1C1E28',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid #2A2D3D',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>
            قوة التحريك ونعومة التسارع (Intensity)
          </label>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#A78BFA' }}>
            {intensityPercent}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={intensityPercent}
          onChange={(e) => setIntensityPercent(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#A78BFA', cursor: 'pointer' }}
        />
      </div>

      {/* اختيار نمط التحريك الأساسي */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600 }}>نمط التحريك الجمالي</label>
        <select
          value={motionMode}
          onChange={(e) => setMotionMode(e.target.value)}
          style={{
            padding: '10px',
            borderRadius: '8px',
            backgroundColor: '#1C1E28',
            color: '#FFFFFF',
            border: '1px solid #2E3244',
            fontSize: '13px',
          }}
        >
          <option value="whiteboard_no_hand">
            رسم السبورة البيضاء التدريجي (Golpo Style — بدون ظهور اليد)
          </option>
          <option value="parallax_card_3d">
            بطاقة سينمائية ثلاثية الأبعاد (2.5D Parallax Card)
          </option>
          <option value="smooth_ken_burns_in">
            تقريب سينمائي ناعم (Smooth Cubic-Bezier Zoom In)
          </option>
          <option value="smooth_ken_burns_out">
            تبعيد سينمائي ناعم (Smooth Cubic-Bezier Zoom Out)
          </option>
          <option value="pendulum_float_3d">
            طفو وإمالة ثلاثية الأبعاد (3D Pendulum Float)
          </option>
        </select>
      </div>

      {/* إعدادات السبورة البيضاء (تظهر عند اختيار السبورة) */}
      {motionMode === 'whiteboard_no_hand' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>
            ثيم السبورة البيضاء (بدون يد)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {Object.entries(WHITEBOARD_STYLES).map(([key, styleObj]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWhiteboardStyle(key)}
                style={{
                  padding: '9px',
                  borderRadius: '8px',
                  border:
                    whiteboardStyle === key
                      ? '2px solid #38BDF8'
                      : '1px solid #2E3244',
                  backgroundColor: whiteboardStyle === key ? '#1E293B' : '#181A24',
                  color: '#F3F4F6',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'right',
                }}
              >
                {styleObj.nameAr}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* خيارات إضافية للجمالية */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={smartBackdrop}
            onChange={(e) => setSmartBackdrop(e.target.checked)}
          />
          خلفية ضبابية ذكية وحواف دائرية وظل ناعم للصور (Smart Backdrop)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mixCinematicModes}
            onChange={(e) => setMixCinematicModes(e.target.checked)}
          />
          تنويع تلقائي بين السبورة البيضاء والتحريك ثلاثي الأبعاد لمنع الملل
        </label>
      </div>

      {/* أزرار التطبيق */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={handleApplyToSelected}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid #38BDF8',
            backgroundColor: 'transparent',
            color: '#38BDF8',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          تطبيق على الصورة المحددة
        </button>

        <button
          type="button"
          onClick={handleAutoApplyTimeline}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #0284C7, #7C3AED)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          توزيع تلقائي ({coveragePercent}%) على كل المشروع
        </button>
      </div>
    </div>
  );
}