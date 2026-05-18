import React from 'react';
import { View, Image, Text, StyleSheet, Platform, Animated, Easing, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Image as SvgImage,
  Defs,
  ClipPath,
  Path as SvgPath,
  Filter,
  FeColorMatrix,
  FeGaussianBlur,
  G as SvgG,
} from 'react-native-svg';
import { getAvatarSource } from '../constants/avatars';
import { TIER_DEFINITIONS } from '../constants/tiers';
import type { SubscriptionTier } from '../types';
import { useRoomLayout as _useRoomLayoutSafe } from '../services/roomLayoutConfig';
import { migrateLegacyTier } from '../types';
import AvatarFrame from './profile/AvatarFrame';
import { getFrameAvatarRatio } from '../constants/frameLottieRegistry';
// ★ v280 (15 May 2026): TierBadge KALDIRILDI — web admin "Rozetler" editörü
//   (CosmeticBadge) tüm rozet yönetimini üstlendi. Eski hardcoded Plus/Pro/GM pill artık yok.
import { CosmeticBadge } from './skia';
import { useBadgeConfig, getBadgeRenderSize } from '../services/cosmeticEditorConfigs';
import { ensureFrameConfig, getCachedFrameConfig, subscribeConfigChange, pickSizeKey, type SizeKey } from '../services/cosmeticConfigCache';
import { useEffect, useRef, useState } from 'react';

// ★ v1.3.54 (2026-05-11): SVG Filter matrix yardımcıları — web admin avatar filter
//   ayarlarını gerçek render etmek için. CSS filter karşılığı:
//   - brightness(b): RGB scale matrix
//   - sepia(s): identity × sepia matrix lineer karışımı
//   - grayscale(g): identity × luminance matrix lineer karışımı
//   Birden fazla filter zincirleme uygulanır (feColorMatrix peş peşe + feGaussianBlur).

/** Brightness matrix — RGB her kanalı b ile çarp */
function brightnessMatrix(b: number): string {
  return `${b} 0 0 0 0  0 ${b} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`;
}

/** Sepia karışım matrisi — s: 0-1 arası karışım oranı */
function sepiaMatrix(s: number): string {
  const r1 = 1 - s * (1 - 0.393), r2 = s * 0.769,        r3 = s * 0.189;
  const g1 = s * 0.349,           g2 = 1 - s * (1 - 0.686), g3 = s * 0.168;
  const b1 = s * 0.272,           b2 = s * 0.534,        b3 = 1 - s * (1 - 0.131);
  return `${r1} ${r2} ${r3} 0 0  ${g1} ${g2} ${g3} 0 0  ${b1} ${b2} ${b3} 0 0  0 0 0 1 0`;
}

/** Grayscale karışım matrisi — g: 0-1 arası karışım oranı (1 = tam siyah-beyaz) */
function grayscaleMatrix(g: number): string {
  const r1 = 0.2126 + 0.7874 * (1 - g), r2 = 0.7152 - 0.7152 * (1 - g), r3 = 0.0722 - 0.0722 * (1 - g);
  const g1 = 0.2126 - 0.2126 * (1 - g), g2 = 0.7152 + 0.2848 * (1 - g), g3 = 0.0722 - 0.0722 * (1 - g);
  const b1 = 0.2126 - 0.2126 * (1 - g), b2 = 0.7152 - 0.7152 * (1 - g), b3 = 0.0722 + 0.9278 * (1 - g);
  return `${r1} ${r2} ${r3} 0 0  ${g1} ${g2} ${g3} 0 0  ${b1} ${b2} ${b3} 0 0  0 0 0 1 0`;
}

/** Avatar şekli için SVG path d-string. cx=cy=size/2 merkezli, size genişlikte. */
function shapePath(shape: string, size: number): string | null {
  const s = size;
  switch (shape) {
    case 'hexagon':
      return `M ${s * 0.25},${s * 0.067} L ${s * 0.75},${s * 0.067} L ${s},${s * 0.5} L ${s * 0.75},${s * 0.933} L ${s * 0.25},${s * 0.933} L 0,${s * 0.5} Z`;
    case 'star':
      // 5-uçlu yıldız
      return `M ${s * 0.5},0 L ${s * 0.61},${s * 0.35} L ${s * 0.98},${s * 0.35} L ${s * 0.68},${s * 0.57} L ${s * 0.79},${s * 0.91} L ${s * 0.5},${s * 0.70} L ${s * 0.21},${s * 0.91} L ${s * 0.32},${s * 0.57} L ${s * 0.02},${s * 0.35} L ${s * 0.39},${s * 0.35} Z`;
    case 'diamond':
      return `M ${s * 0.5},0 L ${s},${s * 0.5} L ${s * 0.5},${s} L 0,${s * 0.5} Z`;
    case 'rounded-square': {
      // ★ v1.3.59: %22 köşe yuvarlatma (web admin borderRadius='22%' parite)
      const r = s * 0.22;
      return `M ${r},0 L ${s - r},0 Q ${s},0 ${s},${r} L ${s},${s - r} Q ${s},${s} ${s - r},${s} L ${r},${s} Q 0,${s} 0,${s - r} L 0,${r} Q 0,0 ${r},0 Z`;
    }
    case 'squircle': {
      // ★ v1.3.59: Yumuşak squircle (Bezier ile ~%36 yuvarlatma — web admin borderRadius='36%' parite)
      const r = s * 0.36;
      return `M ${r},0 L ${s - r},0 Q ${s},0 ${s},${r} L ${s},${s - r} Q ${s},${s} ${s - r},${s} L ${r},${s} Q 0,${s} 0,${s - r} L 0,${r} Q 0,0 ${r},0 Z`;
    }
    case 'circle': {
      // ★ v1.3.68: SVG render dalında (filter varken) circle için clipPath yoksa
      //   SvgImage dikdörtgen kalıyordu (web admin "Daire" parite bozuk). Açık daire path.
      const r = s / 2;
      return `M ${r},0 a ${r},${r} 0 1,0 0,${s} a ${r},${r} 0 1,0 0,-${s} Z`;
    }
    default:
      return null;
  }
}

/**
 * ★ v1.3.70 PARİTE: CSS translate(-50%, -50%) simülasyonu.
 * Web admin badge konumlandırması: left/top ile merkez noktası belirler,
 * transform: translate(-50%, -50%) ile badge kendi boyutunun yarısı kadar geri çekilir.
 * RN Paper bridge'de % translate desteklenmiyor — onLayout ile child boyutunu ölçüp
 * negatif translateX/Y uyguluyoruz. İlk render için yaklaşık boyut kullanılır.
 */
function BadgeCenterWrapper({ x, y, scale, expected, children }: {
  x: number; y: number; scale: number; expected?: { w: number; h: number }; children: React.ReactNode;
}) {
  // ★ v281 (16 May 2026): expected prop ile badge boyutu ÖNCEDEN biliniyor —
  //   useBadgeConfig + getBadgeRenderSize parent'ta hesaplandı. Initial render'da
  //   konum zaten doğru, "tik önce yan tarafta sonra avatara kayma" bug'ı yok.
  //   onLayout sadece doğrulama (genelde aynı değer döner, re-render olmaz).
  const initial = expected || { w: 28, h: 28 };
  const [dims, setDims] = React.useState(initial);
  React.useEffect(() => {
    setDims((prev) => (prev.w === initial.w && prev.h === initial.h ? prev : initial));
  }, [initial.w, initial.h]);
  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
          setDims((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
        }
      }}
      style={{
        position: 'absolute',
        left: x - dims.w / 2,
        top: y - dims.h / 2,
        transform: [{ scale }],
        zIndex: 4,
        elevation: 8,
      }}
      pointerEvents="none"
    >
      {children}
    </View>
  );
}

interface StatusAvatarProps {
  /** Avatar URL string or ImageSource */
  uri?: string | null;
  /** Avatar diameter in pixels */
  size?: number;
  /** Show online green dot */
  isOnline?: boolean;
  /** Subscription tier — border rengi + pill badge belirler */
  tier?: SubscriptionTier | string | null;
  /** Admin mi? (GodMaster kırmızı çerçeve) */
  isAdmin?: boolean;
  /** Optional border color override (tier yoksa kullanılır) */
  borderColor?: string;
  /** Optional border width override */
  borderWidth?: number;
  /** Rozet gösterimi (web admin CosmeticBadge) — customBadgeId varsa badge render edilir */
  showTierBadge?: boolean;
  /** Kullanıcının kendi avatarı mı? Evetse online dot gizlenir (kendi online durumunu görmek anlamsız). */
  isSelf?: boolean;
  /** ★ v107: profiles.active_frame — mağaza atelier item id'si, varsa avatar etrafına çerçeve render */
  frameId?: string | null;
  /** ★ v280 (15 May 2026): tierBadgeSize KALDIRILDI — web admin badge editörü
   *  kendi size/scale ayarlarını yapıyor, eski pill boyut prop'u artık gereksiz. */
  tierBadgeSize?: 'xs' | 'sm' | 'md' | 'lg'; // geriye dönük uyum — ignored
  /** ★ 2026-05-11: Web admin frame name overlay için kullanıcı adı.
   *  Sağlanmadıysa name_enabled config olsa bile gösterilmez. */
  displayName?: string;
  /** ★ v1.3.55: Hangi size_overrides anahtarı kullanılacak — set edilirse pickSizeKey(size)
   *  yerine kullanılır. ProfileHero gibi "ekran bağlamı" bilinen yerlerde anahtar override edilebilir
   *  (ProfileHero size=92 normalde 'listener' key alır ama context "profil sayfası" olduğu için
   *  contextKey="profile" geçilir). */
  contextKey?: SizeKey;
  /** ★ v117 (13 May 2026): Kullanıcının active_badge_id'si — varsa TierBadge yerine
   *  CosmeticBadge (Skia, web admin'den config'li) render edilir. */
  customBadgeId?: string | null;
  /**
   * ★ v282 (16 May 2026): Tek profil objesi pass etme yöntemi.
   * Verilirse içinden frameId, customBadgeId, tier, vb. otomatik resolve edilir.
   * Explicit prop'lar (frameId, customBadgeId, tier) varsa onlar öncelikli (override).
   * Yeni cosmetic alanı eklendiğinde callsite'larda DEĞİŞİKLİK GEREKMEZ — sadece
   * user objesi DB select'inde alan var olsun yeter.
   *
   * Pattern: `<StatusAvatar uri={u.avatar_url} size={44} user={u} />`
   */
  user?: {
    active_frame?: string | null;
    active_badge_id?: string | null;
    subscription_tier?: string | null;
    is_online?: boolean | null;
    is_admin?: boolean | null;
    display_name?: string | null;
  } | null;
  /** ★ v283 (16 May 2026): Web admin "Oda Düzeni" avatar şekli override.
   *  Frame'in customShape'i yoksa bu kullanılır. Listener/speaker grid'lerinde
   *  layout config'inden geçirilir. */
  shapeOverride?: 'circle' | 'square' | 'rounded' | 'hex';
  /** Rounded shape için köşe yuvarlama miktarı (cfgBorderRadius). Sadece shapeOverride='rounded' ise etkili. */
  shapeOverrideRadius?: number;
  /** ★ v319.12 (18 May 2026): Web admin shadow config'ten avatar arkası gölge.
   *  Frame priority kuralı: frame varsa shadow render ETMEZ. Listener default
   *  enabled=false, owner her zaman aktif. SpeakerSection/ListenerGrid çağrılırken
   *  geçilir. */
  shadowRole?: 'host' | 'speaker' | 'listener';
}

/**
 * StatusAvatar — Ortak avatar + online durum + tier çerçeve bileşeni.
 * 
 * Profil sayfasındaki avatarRing + tierPill + onlineDot sisteminin
 * uygulamanın her yerinde tutarlı kullanılmasını sağlar.
 * 
 * Kullanım:
 * ```tsx
 * <StatusAvatar uri={url} size={44} isOnline={true} tier="Pro" />
 * <StatusAvatar uri={url} size={60} tier="Plus" showTierBadge />
 * ```
 */
export default function StatusAvatar({
  uri,
  size = 44,
  isOnline: isOnlineProp,
  tier: tierProp,
  isAdmin: isAdminProp,
  borderColor,
  borderWidth = 2,
  // ★ 2026-05-05: Default true — kullanıcı talebi: "mini avatarların tamamına
  //   plus ve pro etiketlerinin kompakt versiyonu". Free zaten otomatik gizli
  //   (`normalizedTier !== 'Free'` filtresi). Hiç istenmeyen yerlerde explicit
  //   `showTierBadge={false}` geç.
  showTierBadge = true,
  isSelf = false,
  frameId: frameIdProp,
  tierBadgeSize = 'xs',
  displayName: displayNameProp,
  contextKey,
  customBadgeId: customBadgeIdProp,
  user,
  shapeOverride,
  shapeOverrideRadius,
  shadowRole,
}: StatusAvatarProps) {
  // ★ v282 (16 May 2026): user objesi verilirse içinden default'ları al; explicit
  //   prop'lar (frameId/customBadgeId/tier/vb.) öncelikli override. Bu pattern sayesinde
  //   yeni cosmetic alanı eklendiğinde callsite'lar değişmez — sadece user objesi DB
  //   select'inde alan var olsun.
  const frameId = frameIdProp !== undefined ? frameIdProp : (user?.active_frame ?? null);
  const customBadgeId = customBadgeIdProp !== undefined ? customBadgeIdProp : (user?.active_badge_id ?? null);
  const tier = tierProp !== undefined ? tierProp : (user?.subscription_tier ?? undefined);
  const isOnline = isOnlineProp !== undefined ? isOnlineProp : !!user?.is_online;
  const isAdmin = isAdminProp !== undefined ? isAdminProp : !!user?.is_admin;
  const displayName = displayNameProp !== undefined ? displayNameProp : (user?.display_name ?? undefined);
  // ★ v286 (16 May 2026): Web admin online dot config. useRoomLayout oda dışı
  //   bağlamlarda DEFAULT_ROOM_LAYOUT döner — Rules of Hooks ihlali olmaz.
  const _layoutCfg = _useRoomLayoutSafe();
  const onlineDotEnabled = _layoutCfg.indicators.onlineDotEnabled !== false;
  const onlineDotColor = _layoutCfg.indicators.onlineDotColor || '#10B981';

  // ★ v319.12 (18 May 2026): Web admin shadow config — host/speaker/listener
  //   role'e göre avatar arkasında Skia gölge. Frame priority kuralı: frame
  //   varsa shadow yok. Listener default disabled (admin enable etmedikçe).
  const _shadows = _layoutCfg.shadows;
  const _shadowEnabled = !!shadowRole && !frameId && (() => {
    if (shadowRole === 'host') return true; // host her zaman aktif
    if (shadowRole === 'speaker') return _shadows.speakerShadowEnabled;
    if (shadowRole === 'listener') return _shadows.listenerShadowEnabled;
    return false;
  })();
  const _shadowColor = shadowRole === 'speaker' ? _shadows.speakerShadowColor
    : shadowRole === 'listener' ? _shadows.listenerShadowColor
    : _shadows.hostShadowColor;
  const _shadowBlur = shadowRole === 'speaker' ? _shadows.speakerShadowBlur
    : shadowRole === 'listener' ? _shadows.listenerShadowBlur
    : _shadows.hostShadowBlur;
  const _shadowOpacity = shadowRole === 'speaker' ? _shadows.speakerShadowOpacity
    : shadowRole === 'listener' ? _shadows.listenerShadowOpacity
    : _shadows.hostShadowOpacity;

  // ★ v283 (16 May 2026): shapeOverride (web admin oda düzeni) frame customShape'i
  //   yoksa borderRadius'u belirler. Default 'circle' (size/2).
  const radius = (() => {
    if (!shapeOverride) return size / 2;
    if (shapeOverride === 'square') return 0;
    if (shapeOverride === 'rounded') return Math.min(shapeOverrideRadius ?? 16, size / 2);
    // 'circle' ve 'hex' için size/2 — hex SVG-side renderlanır, wrap daire
    return size / 2;
  })();
  // ★ 2026-04-21: Daha zarif nokta — %26 yerine %22, çerçeve 0.3x → 0.18x
  const dotSize = Math.max(8, size * 0.22);
  const dotRadius = dotSize / 2;
  const dotBorder = Math.max(1, dotSize * 0.18);

  // Tier renk çözümleme
  const normalizedTier = tier ? migrateLegacyTier(tier as string) : 'Free';
  const tierDef = TIER_DEFINITIONS[normalizedTier as SubscriptionTier];
  
  // ★ GodMaster: tier='GodMaster' VEYA isAdmin=true → aynı premium görünüm
  const isGM = isAdmin || normalizedTier === 'GodMaster';

  // Çerçeve rengi: GodMaster > tier > fallback
  const ringColor = isGM
    ? '#DC2626'
    : tierDef
      ? tierDef.color
      : borderColor || 'rgba(255,255,255,0.12)';

  // Gradient ve ikon (tier pill için)
  const tierGradient = isGM ? ['#DC2626', '#7F1D1D'] : tierDef ? tierDef.gradient : ['#94A3B8', '#64748B'];
  const tierIcon = isGM ? 'flash' : tierDef?.icon || 'person-outline';
  const tierLabel = isGM ? '⚡GM' : normalizedTier;

  // Avatar source  
  const source: ImageSourcePropType =
    uri && typeof uri === 'string' && uri.startsWith('http')
      ? { uri }
      : getAvatarSource(uri || '');

  // ★ v280: pillScale KALDIRILDI — TierBadge kaldırıldıktan sonra artık gereksiz.
  // ★ v1.3.55: contextKey set edilirse kullan (parent ekran "ben profilim" der), yoksa pickSizeKey(size).
  const sizeKey: SizeKey = contextKey ?? pickSizeKey(size);
  // ★ v281 (16 May 2026): Badge config'i önceden çek — render size BadgeCenterWrapper'a
  //   expected olarak verilir. İlk render'da konum doğru, kayma yok.
  //   avatarSize × scale_on_avatar gerçek render boyutu (CosmeticBadge içinde uygulanır)
  //   — expected dims hesabı da bu boyuta göre yapılır.
  const badgeCfgForSize = useBadgeConfig(customBadgeId ?? null);
  const effectiveBadgeCfg = badgeCfgForSize && typeof badgeCfgForSize.scale_on_avatar === 'number'
    ? { ...badgeCfgForSize, size: Math.max(8, Math.round(size * badgeCfgForSize.scale_on_avatar)) }
    : badgeCfgForSize;
  const badgeExpectedSize = getBadgeRenderSize(effectiveBadgeCfg);
  const [dynFrameCfg, setDynFrameCfg] = useState<any>(getCachedFrameConfig(frameId, sizeKey));
  useEffect(() => {
    if (!frameId) { setDynFrameCfg(null); return; }
    ensureFrameConfig(frameId, sizeKey).then((cfg) => {
      setDynFrameCfg(cfg);
    });
  }, [frameId, sizeKey, size]);

  useEffect(() => {
    if (!frameId) return;
    const unsub = subscribeConfigChange((id) => {
      if (id !== frameId) return;
      ensureFrameConfig(frameId, sizeKey).then((cfg) => setDynFrameCfg(cfg));
    });
    return unsub;
  }, [frameId, sizeKey]);

  // Avatar oranı: önce dynamic config, yoksa registry default
  const dynamicAvatarRatio = dynFrameCfg?.avatar_ratio ?? (frameId ? getFrameAvatarRatio(frameId) : 1.0);
  // ★ v275 (14 May 2026): Glow opacity cap'i 0.6 → host avatar 140px+ büyüklükte
  //   intensity=1.0 ile shadowOpacity tam yoğun renk avatarı kaplıyordu.
  //   shadowRadius ise daha büyük yayılmaya bırakıldı (görsel etki).
  const dynamicGlow = dynFrameCfg?.glow_enabled ? {
    shadowColor: dynFrameCfg.glow_color || '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: Math.min(0.6, (dynFrameCfg.glow_intensity ?? 0.5) * 0.6),
    shadowRadius: 14 * (dynFrameCfg.glow_intensity ?? 0.5),
  } : null;

  // ★ 2026-05-11: AVATAR HAREKET ANİMASYONLARI — web admin'deki ön izlemenin
  //   mobil gerçek karşılığı. Hepsi paralel (toggle bağımsız), useNativeDriver:true.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnimY = useRef(new Animated.Value(0)).current;
  const swingAnim = useRef(new Animated.Value(0)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dynFrameCfg?.avatar_pulse) return;
    const dur = (dynFrameCfg?.avatar_pulse_speed ?? 2) * 500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, dynFrameCfg?.avatar_pulse, dynFrameCfg?.avatar_pulse_speed]);

  useEffect(() => {
    if (!dynFrameCfg?.avatar_float) return;
    const dur = (dynFrameCfg?.avatar_float_speed ?? 4) * 500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [floatAnim, dynFrameCfg?.avatar_float, dynFrameCfg?.avatar_float_speed]);

  useEffect(() => {
    if (!dynFrameCfg?.avatar_shake) return;
    // ★ v1.3.70 PARİTE: Web admin shake X+Y çapraz hareket kullanır:
    //   translate(-2px,1px) → (2px,-1px) → (-1px,2px) → (1px,-2px)
    //   APK'da paralel iki Animated.Value (X ve Y) ile birebir simüle.
    const loopX = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    const loopY = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnimY, { toValue: -0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnimY, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    loopX.start();
    loopY.start();
    return () => { loopX.stop(); loopY.stop(); };
  }, [shakeAnim, shakeAnimY, dynFrameCfg?.avatar_shake]);

  useEffect(() => {
    if (!dynFrameCfg?.avatar_swing) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(swingAnim, { toValue: 1, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: 0, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: -1, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(swingAnim, { toValue: 0, duration: 625, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [swingAnim, dynFrameCfg?.avatar_swing]);

  useEffect(() => {
    if (!dynFrameCfg?.avatar_tilt) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(tiltAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(tiltAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [tiltAnim, dynFrameCfg?.avatar_tilt]);

  // Avatar transform stack — hepsi paralel
  const avatarTransform: any[] = [];
  if (dynFrameCfg?.avatar_pulse) avatarTransform.push({ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) });
  if (dynFrameCfg?.avatar_float) avatarTransform.push({ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) });
  if (dynFrameCfg?.avatar_shake) {
    avatarTransform.push({ translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) });
    avatarTransform.push({ translateY: shakeAnimY.interpolate({ inputRange: [-1, 1], outputRange: [-1, 1] }) });
  }
  if (dynFrameCfg?.avatar_swing) avatarTransform.push({ rotate: swingAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) });
  if (dynFrameCfg?.avatar_tilt)  avatarTransform.push({ rotate: tiltAnim.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) });

  // ★ AVATAR ŞEKLİ — clip-path mobile'da yok, borderRadius mapping ile yaklaşım.
  //   Tam parite için react-native-masked-view gerek; circle/squircle/rounded-square
  //   mevcut araçlarla doğru, hex/star/diamond için 'squircle' fallback.
  const shapeRadius = (() => {
    const targetSize = frameId ? Math.round(size * dynamicAvatarRatio) : (size - borderWidth * 2 - 2);
    // ★ v283 (16 May 2026): Frame avatar_shape varsa öncelikli. Yoksa shapeOverride
    //   (web admin oda düzeni) bak. İkisi yoksa default circle.
    if (dynFrameCfg?.avatar_shape) {
      switch (dynFrameCfg.avatar_shape) {
        case 'rounded-square': return targetSize * 0.22;
        case 'squircle':       return targetSize * 0.36;
        case 'hexagon':        return targetSize * 0.36;
        case 'star':           return targetSize * 0.36;
        case 'diamond':        return targetSize * 0.36;
        case 'circle':
        default:               return targetSize / 2;
      }
    }
    // Web admin shapeOverride
    if (shapeOverride === 'square') return 0;
    if (shapeOverride === 'rounded') return Math.min(shapeOverrideRadius ?? 12, targetSize / 2);
    if (shapeOverride === 'hex') return targetSize * 0.36; // squircle fallback (RN'de tam hex yok)
    return targetSize / 2; // circle default
  })();

  // ★ v1.3.54: GERÇEK FİLTRE — eski overlay yaklaşımı kaldırıldı; SVG feColorMatrix
  //   ile native render. avatar Image SVG <Image> içine alınıp filter zinciri uygulanır.
  //   Sadece filter VEYA custom shape (hex/star/diamond) varsa SVG kullan — yoksa
  //   normal RN Image (performans için).
  const targetSizeForFilters = frameId ? Math.round(size * dynamicAvatarRatio) : (size - borderWidth * 2 - 2);
  const hueRotate = dynFrameCfg?.avatar_hue_rotate ?? 0;
  const saturationVal = dynFrameCfg?.avatar_saturation ?? 1;
  const blurVal = dynFrameCfg?.avatar_blur ?? 0;
  const brightnessVal = dynFrameCfg?.avatar_brightness ?? 1;
  const grayscaleVal = (dynFrameCfg?.avatar_grayscale ?? 0) / 100; // 0-1
  const sepiaVal = (dynFrameCfg?.avatar_sepia ?? 0) / 100;          // 0-1
  const hasAnyFilter =
    hueRotate !== 0 || saturationVal !== 1 || blurVal > 0 ||
    brightnessVal !== 1 || grayscaleVal > 0 || sepiaVal > 0;
  // ★ v1.3.59: rounded-square + squircle SVG clip-path ile yansıması için
  //   customShape listesine dahil — wrap borderRadius=0 olur, SVG clip görünür.
  //   Circle default null path → eski davranış (Image + wrap borderRadius=size/2 yuvarlak crop).
  const customShape = ['hexagon', 'star', 'diamond', 'rounded-square', 'squircle'].includes(dynFrameCfg?.avatar_shape || '');
  const useSvgRender = hasAnyFilter || customShape;

  // ★ glow_pulse — Animated shadowOpacity (iOS) / overlay opacity (Android)
  //   useNativeDriver:false çünkü shadowOpacity native driver'a yok.
  const glowPulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!dynFrameCfg?.glow_enabled || !dynFrameCfg?.glow_pulse) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowPulseAnim, { toValue: 1.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glowPulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glowPulseAnim, dynFrameCfg?.glow_enabled, dynFrameCfg?.glow_pulse]);

  // ★ v319.7 (18 May 2026): Online glow ek halo (Android elevation renksiz olduğu
  //   için ek bir absolute View ile yeşil halka çiziyoruz). iOS'ta avatar ring
  //   kendi shadowColor:#22C55E ile glow yapar; Android'de bu halka soft yeşil
  //   border + elevation kombinasyonu ile aynı etkiyi verir. Frame varsa eklenmez
  //   (frame priority kuralı).
  const showOnlineGlow = isOnline && !isSelf && !frameId && onlineDotEnabled;

  return (
    <View style={{ width: size, height: size + (showTierBadge ? 8 : 0), position: 'relative' }}>
      {/* ★ v319.12 (18 May 2026): Admin shadow config (Skia tabanlı, cross-platform).
          host/speaker/listener role'üne göre admin'in ayarladığı renk/blur/opacity. */}
      {_shadowEnabled && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0, top: 0,
            width: size, height: size,
            borderRadius: customShape ? 0 : size / 2,
            ...Platform.select({
              ios: {
                shadowColor: _shadowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: _shadowOpacity,
                shadowRadius: _shadowBlur,
              },
              android: { elevation: Math.max(4, Math.round(_shadowBlur * 0.5)) },
            }),
            zIndex: 0,
            backgroundColor: 'transparent',
          }}
        />
      )}
      {/* ★ v319.7: Yeşil online halka — avatar'ın hemen dışında, soft border + glow */}
      {showOnlineGlow && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -3, top: -3,
            width: size + 6, height: size + 6,
            borderRadius: customShape ? 0 : (size + 6) / 2,
            borderWidth: 2.5,
            borderColor: 'rgba(34,197,94,0.75)',
            ...Platform.select({
              ios: {
                shadowColor: '#22C55E',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 14,
              },
              android: { elevation: 8 },
            }),
            zIndex: 1,
          }}
        />
      )}
      {/* ★ v107.69: Mağaza çerçevesi avatar'dan ÖNCE render — yoksa AvatarFrame'in iç
         koyu cutout'u avatar Image'i kapatıyor (kullanıcı: "profil resmi gidiyor"). */}
      <AvatarFrame
        frameId={frameId}
        size={size}
        userName={displayName}
        userTier={normalizedTier !== 'Free' ? normalizedTier.toUpperCase() : undefined}
        contextKey={contextKey}
      />
      {/* ★ v108.13: Aktif çerçeve varsa tier border'ı kapat — çift halka görünmesin.
         Çerçeve zaten tema halkası; tier rozeti (showTierBadge) avatar altında ayrıca gösterilir.
         ★ v108.14: Frame varsa avatar'a hafif yumuşak gölge — derinlik hissi. */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            // ★ v1.3.58: Android'de borderRadius içeriği clip ediyor — custom shape
            //   (hexagon/diamond/star) varsa borderRadius=0, SVG kendi clipPath'ini
            //   uygular. circle/rounded-square/squircle için yuvarlak/dikdörtgen wrap.
            borderRadius: customShape ? 0 : radius,
            borderWidth: frameId ? 0 : borderWidth,
            borderColor: frameId ? 'transparent' : ringColor,
          },
          // ★ v319.7 (18 May 2026): Online glow — kullanıcı feedback:
          //   "online olan kullanıcılara yeşil glow ver". Frame priority kuralı
          //   gereği frame satın almış kullanıcıda frame glow korunur, ek glow yok.
          isOnline && !isSelf && !frameId && onlineDotEnabled && Platform.select({
            ios: {
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.85,
              shadowRadius: Math.max(8, size * 0.22),
            },
            android: { elevation: 10 },
          }),
          frameId && {
            // ★ v1.3.58: customShape (hexagon/diamond/star) ise wrap borderRadius=0
            //   olduğundan elevation shadow KARE oluşuyordu — Android'de avatar
            //   arkasında belirgin kare gölge. Custom shape için shadow kapat.
            ...(customShape ? {} : Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
              },
              android: { elevation: 12 },
            })),
            zIndex: 2,
          },
        ]}
      >
        {(() => {
          // ★ 2026-05-11: Avatar render — web admin'den gelen avatar_* config'leri uygulanır.
          //   Animated.View wrapper → transform stack (pulse/float/shake/swing/tilt).
          //   v1.3.54: SVG branch — filter veya custom shape (hex/star/diamond) varsa
          //   SVG <Image> + <Filter feColorMatrix> + <ClipPath> gerçek native render.
          //   Diğer durumda mevcut RN Image (performans korunur).
          const ratio = frameId ? dynamicAvatarRatio : 1.0;
          const targetSize = frameId ? Math.round(size * ratio) : (size - borderWidth * 2 - 2);
          // Glow pulse aktifse shadowRadius animated, değilse sabit.
          // ★ v1.3.68: Android elevation:16 KALDIRILDI — wrapper kare olduğu için
          //   Android elevation kare gölge kutusu çiziyordu (yuvarlak/hexagon avatarın
          //   etrafında kare köşeler görünüyordu — "altıgen gölge" bug'ı).
          //   Halo zaten BgHaloOverlay (Skia RadialGradient) ile çiziliyor, elevation gereksiz.
          const glowStyle = dynamicGlow
            ? Platform.select({
                ios: dynFrameCfg?.glow_pulse
                  ? { ...dynamicGlow, shadowRadius: glowPulseAnim.interpolate({ inputRange: [1, 1.4], outputRange: [dynamicGlow.shadowRadius, dynamicGlow.shadowRadius * 2] }) as any }
                  : dynamicGlow,
                android: {}, // BgHaloOverlay (Skia) glow'u sağlar; elevation kullanma.
              })
            : {};

          // ★ SVG render dalı — filter veya custom shape varsa
          if (useSvgRender) {
            // ★ v1.3.57: SVG <Image href> string URI gerektirir. http URL'ler hazır;
            //   local require()'lar için Image.resolveAssetSource ile URI'ye çevir
            //   (dev'de http://localhost:8081/assets/..., prod'da file://). Böylece
            //   default avatar_m/f_X.png gibi local resimlerde de custom shape +
            //   filter uygulanır.
            let svgHref: string | null = null;
            if (typeof source === 'object' && source && 'uri' in source) {
              svgHref = (source as any).uri;
            } else if (typeof source === 'number') {
              const resolved = Image.resolveAssetSource(source);
              svgHref = resolved?.uri || null;
            }
            if (svgHref) {
              const filterId = `f-${targetSize}-${hueRotate}-${saturationVal}-${blurVal}-${brightnessVal}-${grayscaleVal}-${sepiaVal}`;
              const clipId = `c-${targetSize}-${dynFrameCfg?.avatar_shape}`;
              const sPath = shapePath(dynFrameCfg?.avatar_shape || 'circle', targetSize);
              return (
                <Animated.View style={{
                  width: targetSize, height: targetSize,
                  transform: avatarTransform.length > 0 ? avatarTransform : undefined,
                  ...glowStyle,
                }}>
                  <Svg width={targetSize} height={targetSize}>
                    <Defs>
                      {sPath && (
                        <ClipPath id={clipId}>
                          <SvgPath d={sPath} />
                        </ClipPath>
                      )}
                      {hasAnyFilter && (
                        // ★ v1.3.63 PARİTE: Eski %10 padding (120% width) yüksek blur
                        //   değerlerinde halo'yu kırpıyordu (5px blur → 5px halo > 0.5px pad).
                        //   Yeni: %25 padding (150% width) — blur=5px (max) için bile halo
                        //   kırpılmaz. Web filter:blur() Chrome'da overflow:visible default.
                        <Filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
                          {blurVal > 0 && (
                            // CSS filter:blur(Npx) ≈ SVG feGaussianBlur stdDeviation=N
                            // (W3C spec birebir; RN SVG aynı yorum). Direkt geçir.
                            <FeGaussianBlur stdDeviation={blurVal} />
                          )}
                          {brightnessVal !== 1 && (
                            <FeColorMatrix type="matrix" values={brightnessMatrix(brightnessVal)} />
                          )}
                          {hueRotate !== 0 && (
                            <FeColorMatrix type="hueRotate" values={String(hueRotate)} />
                          )}
                          {saturationVal !== 1 && (
                            <FeColorMatrix type="saturate" values={String(saturationVal)} />
                          )}
                          {grayscaleVal > 0 && (
                            <FeColorMatrix type="matrix" values={grayscaleMatrix(grayscaleVal)} />
                          )}
                          {sepiaVal > 0 && (
                            <FeColorMatrix type="matrix" values={sepiaMatrix(sepiaVal)} />
                          )}
                        </Filter>
                      )}
                    </Defs>
                    {/* ★ v1.3.58: <Image> doğrudan clipPath prop'u react-native-svg'de
                         güvenilir çalışmıyor — <G clipPath="url(...)"> wrapper'ı ile
                         sar, hexagon/diamond/star clip path'ler net uygulanır. */}
                    {sPath ? (
                      <SvgG clipPath={`url(#${clipId})`}>
                        <SvgImage
                          href={svgHref}
                          width={targetSize}
                          height={targetSize}
                          preserveAspectRatio="xMidYMid slice"
                          filter={hasAnyFilter ? `url(#${filterId})` : undefined}
                        />
                      </SvgG>
                    ) : (
                      <SvgImage
                        href={svgHref}
                        width={targetSize}
                        height={targetSize}
                        preserveAspectRatio="xMidYMid slice"
                        filter={hasAnyFilter ? `url(#${filterId})` : undefined}
                      />
                    )}
                  </Svg>
                </Animated.View>
              );
            }
            // require source — SVG kullanamayız, normal Image'a düş (filter yok, fallback)
          }

          // Standart RN Image render — filter/custom shape yoksa
          // ★ v1.3.67: Android elevation + Image borderRadius çakışması — elevation hardware
          //   layer'a yükseltince Image'ın borderRadius'u clip etmiyor (kare köşeler görünür).
          //   Çözüm: Image'ı overflow:'hidden' + borderRadius olan bir clip wrapper içine al,
          //   elevation/glow dış wrapper'da kalsın. Web admin "Daire" parite sorunu çözüldü.
          return (
            <Animated.View style={{
              width: targetSize, height: targetSize,
              transform: avatarTransform.length > 0 ? avatarTransform : undefined,
              ...glowStyle,
            }}>
              <View style={{
                width: targetSize, height: targetSize,
                borderRadius: shapeRadius,
                overflow: 'hidden',
              }}>
                <Animated.Image
                  source={source}
                  style={{
                    width: targetSize, height: targetSize,
                  }}
                />
              </View>
            </Animated.View>
          );
        })()}
      </View>

      {/* ★ v319.7 (18 May 2026): Online dot KALDIRILDI — kullanıcı feedback:
          "online status simgesi tüm avatarlardan kaldır, online olan
          kullanıcılara yeşil glow ver yeterli". Glow render avatar ring
          shadow'una taşındı (yukarıda style merge). */}

      {/* ★ v280 (15 May 2026): CosmeticBadge — web admin rozet editörü.
            Eski TierBadge (hardcoded Plus/Pro pill) KALDIRILDI.
            Artık SADECE web admin'den yapılandırılan CosmeticBadge gösterilir.
            customBadgeId (profiles.active_badge_id) yoksa hiç rozet gösterilmez. */}
      {showTierBadge && customBadgeId && (() => {
        const BADGE_POS: Record<string, { x: number; y: number }> = {
          tl: { x: -0.354, y: -0.354 },
          tc: { x: 0,      y: -0.5   },
          tr: { x: 0.354,  y: -0.354 },
          ml: { x: -0.5,   y: 0      },
          mr: { x: 0.5,    y: 0      },
          bl: { x: -0.354, y: 0.354  },
          bc: { x: 0,      y: 0.5    },
          br: { x: 0.354,  y: 0.354  },
        };
        // ★ v283 (16 May 2026): Konum ARTIK SADECE badge cfg'den (BadgeEditor → konum sekmesi).
        //   Eski frame cfg.tier_badge_* fallback'ı kaldırıldı — çerçeve editöründe rozet
        //   ayarları yer almıyor artık. Tek kaynak: Mağaza → Rozetler.
        const POS_MAP: Record<string, string> = {
          topLeft: 'tl', topRight: 'tr', bottomLeft: 'bl', bottomRight: 'br', inline: 'br',
        };
        const tbPos = String(
          (badgeCfgForSize?.position ? POS_MAP[badgeCfgForSize.position] : undefined) || 'br'
        );
        const pos = BADGE_POS[tbPos] || BADGE_POS.br;
        const offsetXPct = Number(badgeCfgForSize?.offset_x ?? 0);
        const offsetYPct = Number(badgeCfgForSize?.offset_y ?? 0);
        // ★ v283 (16 May 2026): Boyut CosmeticBadge içinde avatarSize prop ile uygulanır.
        //   Wrap için ekstra scale gerekmiyor — frame cfg tier_badge_scale fallback'ı KALDIRILDI.
        const dynScale = 1.0;
        // ★ v281 (16 May 2026): Offset % artık ROZET boyutuna oranlı (avatar değil) —
        //   web admin BadgeEditor'da CSS `translate(${offset_x}%, ${offset_y}%)` rozet'in
        //   kendi boyutuna göre. APK'da avatar boyutuyla çarpıyordum → 5-10x büyük kayma.
        //   effectiveBadgeSize: scale_on_avatar varsa avatar × oran, yoksa cfg.size.
        const effectiveBadgeSize = (typeof badgeCfgForSize?.scale_on_avatar === 'number')
          ? size * badgeCfgForSize.scale_on_avatar
          : (badgeCfgForSize?.size || 24);
        const fineOffsetX = Math.round((offsetXPct / 100) * effectiveBadgeSize);
        const fineOffsetY = Math.round((offsetYPct / 100) * effectiveBadgeSize);
        const badgeCenterX = size / 2 + pos.x * size + fineOffsetX;
        const badgeCenterY = size / 2 + pos.y * size + fineOffsetY;
        return (
          <BadgeCenterWrapper
            x={badgeCenterX}
            y={badgeCenterY}
            scale={dynScale}
            expected={badgeExpectedSize}
          >
            <CosmeticBadge badgeItemId={customBadgeId} context="avatar" avatarSize={size} />
          </BadgeCenterWrapper>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1,
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#22C55E',
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
    // ★ v109.3: zIndex 3 — AvatarFrame (zIndex:1) üstünde, frame altında kalmasın
    zIndex: 3,
    elevation: 6,
  },
  tierBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F1923',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2.5,
    // ★ v109.3: zIndex 3 — frame üstünde
    zIndex: 3,
    elevation: 6,
  },
});
