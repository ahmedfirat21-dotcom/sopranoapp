-- ════════════════════════════════════════════════════════════════════
-- v116: Oda Düzen Config'i Dramatic Genişletme
-- ════════════════════════════════════════════════════════════════════
-- v115'te host/speakers/listeners/stage/global vardı. v116:
--   + animations  (pulse, halo, transition, reduce motion)
--   + accents     (owner/moderator/hand-raise/new-join vurgu renkleri)
--   + indicators  (online dot, mute, camera, hand raise badge)
--   + shadows     (host/speaker/listener gölge ince ayarları — Skia render)
--   + header      (oda başlığı yazı tipleri, canlı göstergesi)
--   + controls    (alt kontrol barı: rengi, blur, buton şekli)
--   + speakers_advanced (kamera tile, spotlight, owner scale)
--   + listeners_advanced (overflow, hand raise badge, max visible)
--   + name_advanced (text shadow, stroke, glow)
--
-- Bütün eklemeler additive — mobile tarafta mergeWithDefaults zaten yeni
-- alanları otomatik DEFAULT'a düşürür, var olanları korur.
-- ════════════════════════════════════════════════════════════════════

UPDATE public.room_layout_config
SET config = config || jsonb_build_object(
  'animations', jsonb_build_object(
    'speakingPulseEnabled',  true,
    'speakingPulseSpeed',    1400,    -- ms (1 saykıl)
    'speakingRingExpand',    1.35,    -- max scale
    'haloPulseEnabled',      false,
    'haloPulseSpeed',        2000,
    'haloPulseAmplitude',    0.20,    -- 0..0.5
    'avatarTapScale',        0.96,    -- press feedback
    'enterTransition',       'fade',  -- fade | slide | bounce | none
    'enterDurationMs',       400,
    'reduceMotion',          false
  ),
  'accents', jsonb_build_object(
    'ownerHighlight',        '#FBBF24',
    'ownerRingWidth',        3,
    'ownerHaloEnabled',      true,
    'moderatorHighlight',    '#A78BFA',
    'moderatorRingWidth',    2,
    'handRaiseColor',        '#FBBF24',
    'handRaiseEnabled',      true,
    'newJoinHighlight',      '#10B981',
    'newJoinDurationMs',     4000,
    'selectedHighlight',     '#14B8A6'
  ),
  'indicators', jsonb_build_object(
    'onlineDotEnabled',      true,
    'onlineDotColor',        '#10B981',
    'onlineDotSize',         8,
    'onlineDotPosition',     'bottomRight',  -- TR | TL | BR | BL
    'muteIndicatorEnabled',  true,
    'muteIndicatorColor',    '#EF4444',
    'muteIndicatorSize',     18,
    'muteIndicatorPosition', 'bottomRight',
    'cameraIndicatorEnabled', true,
    'cameraIndicatorColor',  '#3B82F6',
    'verifiedTickEnabled',   true,
    'verifiedTickColor',     '#3B82F6'
  ),
  'shadows', jsonb_build_object(
    'hostShadowColor',       '#FBBF24',
    'hostShadowBlur',        18,
    'hostShadowOpacity',     0.50,
    'speakerShadowColor',    '#14B8A6',
    'speakerShadowBlur',     12,
    'speakerShadowOpacity',  0.30,
    'speakerShadowEnabled',  false,
    'listenerShadowEnabled', false,
    'listenerShadowColor',   '#000000',
    'listenerShadowBlur',    4,
    'listenerShadowOpacity', 0.30
  ),
  'header', jsonb_build_object(
    'titleFontSize',         16,
    'titleFontWeight',       '700',
    'titleColor',            '#F1F5F9',
    'subtitleFontSize',      11,
    'subtitleColor',         '#94A3B8',
    'showLiveIndicator',     true,
    'liveDotColor',          '#EF4444',
    'liveDotPulse',          true,
    'showListenerCount',     true,
    'headerBgOpacity',       0.0,
    'headerBorderBottom',    true,
    'headerBorderColor',     'rgba(255,255,255,0.04)'
  ),
  'controls', jsonb_build_object(
    'barBackground',         'rgba(15,25,38,0.85)',
    'barBlurEnabled',        true,
    'barBlurIntensity',      28,
    'barBorderTop',          'rgba(255,255,255,0.05)',
    'barPaddingV',           10,
    'buttonSize',            44,
    'buttonGap',             12,
    'buttonShape',           'circle', -- circle | rounded
    'buttonBorderRadius',    12,
    'micActiveColor',        '#10B981',
    'micMutedColor',         '#475569',
    'leaveButtonColor',      '#EF4444',
    'iconColor',             '#E2E8F0',
    'iconSize',              22
  ),
  'speakers_advanced', jsonb_build_object(
    'cameraTileEnabled',     true,
    'cameraAspectRatio',     '1:1',         -- 1:1 | 16:9 | 4:3
    'cameraTileBorderRadius', 16,
    'singleCameraFullWidth', true,
    'spotlightEnabled',      false,
    'spotlightScale',        1.20,
    'ownerScale',            1.0,
    'micIconColor',          '#10B981',
    'micIconOffsetY',        -2,
    'mutedAvatarGrayscale',  0.0           -- 0..1 (susturulduğunda griye düşürme)
  ),
  'listeners_advanced', jsonb_build_object(
    'maxVisibleSmallScreen', 10,
    'maxVisibleDefault',     14,
    'overflowBadgeText',     '+{N} Seyirci',
    'overflowBadgeColor',    'rgba(20,184,166,0.16)',
    'overflowBadgeTextColor', '#5EEAD4',
    'showHandRaiseBadge',    true,
    'handRaiseBadgePosition', 'topLeft',
    'showMicRequestPulse',   true
  ),
  'name_advanced', jsonb_build_object(
    'textShadowEnabled',     true,
    'textShadowColor',       'rgba(0,0,0,0.7)',
    'textShadowOffsetY',     1,
    'textShadowRadius',      2,
    'strokeEnabled',         false,
    'strokeColor',           'rgba(0,0,0,0.5)',
    'strokeWidth',           0.5,
    'letterSpacing',         0.0,
    'lineHeight',            1.2
  )
)
WHERE id = 'default';
