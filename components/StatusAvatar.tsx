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
import { migrateLegacyTier } from '../types';
import AvatarFrame from './profile/AvatarFrame';
import { getFrameAvatarRatio } from '../constants/frameLottieRegistry';
import TierBadge from './TierBadge';
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
    default:
      return null;
  }
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
  /** Tier pill badge'i göster (avatarın altında küçük etiket) */
  showTierBadge?: boolean;
  /** Kullanıcının kendi avatarı mı? Evetse online dot gizlenir (kendi online durumunu görmek anlamsız). */
  isSelf?: boolean;
  /** ★ v107: profiles.active_frame — mağaza atelier item id'si, varsa avatar etrafına çerçeve render */
  frameId?: string | null;
  /** ★ v109.4.3: TierBadge boyutu — xs (mini avatar, sadece ikon) / sm (label dahil "PRO" pill).
   *  Default xs. Profil hero ve sahnede sm/md kullanılır. */
  tierBadgeSize?: 'xs' | 'sm' | 'md' | 'lg';
  /** ★ 2026-05-11: Web admin frame name overlay için kullanıcı adı.
   *  Sağlanmadıysa name_enabled config olsa bile gösterilmez. */
  displayName?: string;
  /** ★ v1.3.55: Hangi size_overrides anahtarı kullanılacak — set edilirse pickSizeKey(size)
   *  yerine kullanılır. ProfileHero gibi "ekran bağlamı" bilinen yerlerde anahtar override edilebilir
   *  (ProfileHero size=92 normalde 'listener' key alır ama context "profil sayfası" olduğu için
   *  contextKey="profile" geçilir). */
  contextKey?: SizeKey;
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
  isOnline,
  tier,
  isAdmin,
  borderColor,
  borderWidth = 2,
  // ★ 2026-05-05: Default true — kullanıcı talebi: "mini avatarların tamamına
  //   plus ve pro etiketlerinin kompakt versiyonu". Free zaten otomatik gizli
  //   (`normalizedTier !== 'Free'` filtresi). Hiç istenmeyen yerlerde explicit
  //   `showTierBadge={false}` geç.
  showTierBadge = true,
  isSelf = false,
  frameId,
  tierBadgeSize = 'xs',
  displayName,
  contextKey,
}: StatusAvatarProps) {
  const radius = size / 2;
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

  // Pill badge boyut hesabı (avatar boyutuna göre ölçekli)
  const pillScale = Math.max(0.7, Math.min(1, size / 60));

  // ★ v1.3.55: contextKey set edilirse kullan (parent ekran "ben profilim" der), yoksa pickSizeKey(size).
  const sizeKey: SizeKey = contextKey ?? pickSizeKey(size);
  const [dynFrameCfg, setDynFrameCfg] = useState<any>(getCachedFrameConfig(frameId, sizeKey));
  useEffect(() => {
    if (!frameId) { setDynFrameCfg(null); return; }
    ensureFrameConfig(frameId, sizeKey).then((cfg) => setDynFrameCfg(cfg));
  }, [frameId, sizeKey]);

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
  const dynamicGlow = dynFrameCfg?.glow_enabled ? {
    shadowColor: dynFrameCfg.glow_color || '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: dynFrameCfg.glow_intensity ?? 0.5,
    shadowRadius: 12 * (dynFrameCfg.glow_intensity ?? 0.5),
  } : null;

  // ★ 2026-05-11: AVATAR HAREKET ANİMASYONLARI — web admin'deki ön izlemenin
  //   mobil gerçek karşılığı. Hepsi paralel (toggle bağımsız), useNativeDriver:true.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
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
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -0.5, duration: 120, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [shakeAnim, dynFrameCfg?.avatar_shake]);

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
  if (dynFrameCfg?.avatar_shake) avatarTransform.push({ translateX: shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] }) });
  if (dynFrameCfg?.avatar_swing) avatarTransform.push({ rotate: swingAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) });
  if (dynFrameCfg?.avatar_tilt)  avatarTransform.push({ rotate: tiltAnim.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) });

  // ★ AVATAR ŞEKLİ — clip-path mobile'da yok, borderRadius mapping ile yaklaşım.
  //   Tam parite için react-native-masked-view gerek; circle/squircle/rounded-square
  //   mevcut araçlarla doğru, hex/star/diamond için 'squircle' fallback.
  const shapeRadius = (() => {
    const targetSize = frameId ? Math.round(size * dynamicAvatarRatio) : (size - borderWidth * 2 - 2);
    switch (dynFrameCfg?.avatar_shape) {
      case 'rounded-square': return targetSize * 0.22;
      case 'squircle':       return targetSize * 0.36;
      case 'hexagon':        return targetSize * 0.36; // squircle fallback
      case 'star':           return targetSize * 0.36; // squircle fallback (clip-path yok)
      case 'diamond':        return targetSize * 0.36; // squircle fallback
      case 'circle':
      default:               return targetSize / 2;
    }
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
  const customShape = ['hexagon', 'star', 'diamond'].includes(dynFrameCfg?.avatar_shape || '');
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

  return (
    <View style={{ width: size, height: size + (showTierBadge ? 8 : 0), position: 'relative' }}>
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
            borderRadius: radius,
            borderWidth: frameId ? 0 : borderWidth,
            borderColor: frameId ? 'transparent' : ringColor,
          },
          frameId && {
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
              },
              android: { elevation: 12 },
            }),
            zIndex: 2, // Avatar Image her zaman frame'in üstünde
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
          // Glow pulse aktifse shadowRadius animated, değilse sabit
          const glowStyle = dynamicGlow
            ? Platform.select({
                ios: dynFrameCfg?.glow_pulse
                  ? { ...dynamicGlow, shadowRadius: glowPulseAnim.interpolate({ inputRange: [1, 1.4], outputRange: [dynamicGlow.shadowRadius, dynamicGlow.shadowRadius * 2] }) as any }
                  : dynamicGlow,
                android: { elevation: 16 },
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
                        <Filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
                          {blurVal > 0 && (
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
          return (
            <Animated.View style={{
              width: targetSize, height: targetSize,
              transform: avatarTransform.length > 0 ? avatarTransform : undefined,
            }}>
              <Animated.Image
                source={source}
                style={{
                  width: targetSize, height: targetSize,
                  borderRadius: shapeRadius,
                  ...glowStyle,
                }}
              />
            </Animated.View>
          );
        })()}
      </View>

      {/* ★ v213f: Modern online indicator — gradient nokta + dual halo + glow.
          Eski tek-ton yeşil dot yerine emerald-teal gradient + iç parlak iz + dış soft glow */}
      {isOnline && !isSelf && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: showTierBadge ? 0 : 2,
            right: 2,
            width: dotSize, height: dotSize,
            zIndex: 3, elevation: 6,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Dış soft glow halo */}
          <View style={{
            position: 'absolute',
            width: dotSize * 1.6, height: dotSize * 1.6,
            borderRadius: (dotSize * 1.6) / 2,
            backgroundColor: 'rgba(16,185,129,0.18)',
          }} />
          {/* Gradient nokta */}
          <LinearGradient
            colors={['#34D399', '#10B981', '#047857']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: dotSize, height: dotSize,
              borderRadius: dotRadius,
              borderWidth: Math.max(1.5, dotBorder),
              borderColor: 'rgba(255,255,255,0.92)',
              ...Platform.select({
                ios: {
                  shadowColor: '#10B981',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.55,
                  shadowRadius: dotSize * 0.45,
                },
                android: {},
              }),
            }}
          />
          {/* İç highlight (specular hint) */}
          <View style={{
            position: 'absolute',
            top: dotBorder + 1, left: dotBorder + 1,
            width: dotSize * 0.32, height: dotSize * 0.32,
            borderRadius: (dotSize * 0.32) / 2,
            backgroundColor: 'rgba(255,255,255,0.55)',
          }} />
        </View>
      )}

      {/* ★ v1.3.54: Tier badge görünürlük zinciri (öncelik sırası):
            1) Kullanıcı APK'dan kapatmışsa (showTierBadge=false) → gizli
            2) Web admin çerçeve ayarında tier_badge_enabled=false ise → gizli (admin kapattı)
            3) Web admin tier_badge_enabled=true ise → görünür (Free dahil, admin açtı)
            4) Hiç ayarlanmamışsa (undefined) → default: Free gizli, Plus/Pro/GM görünür. */}
      {(() => {
        if (!showTierBadge) return false;
        if (dynFrameCfg?.tier_badge_enabled === false) return false;
        if (dynFrameCfg?.tier_badge_enabled === true) return true;
        return normalizedTier !== 'Free';
      })() && (() => {
        const useDyn = !!dynFrameCfg?.tier_badge_enabled;
        const tbPos = String(dynFrameCfg?.tier_badge_position || 'br');
        // tl/tc/tr/ml/mr/bl/bc/br → top/left/right/bottom değerleri
        const POS_STYLES: Record<string, any> = {
          tl: { top: -2, left: -2 },
          tc: { top: -2, alignSelf: 'center' },
          tr: { top: -2, right: -2 },
          ml: { top: '50%', left: -2, marginTop: -10 },
          mr: { top: '50%', right: -2, marginTop: -10 },
          bl: { bottom: -2, left: -2 },
          bc: { bottom: -2, alignSelf: 'center' },
          br: { bottom: -2, right: -2 },
        };
        // tc/bc için flex hizalama (transform translate ile ortala)
        const isCenter = tbPos === 'tc' || tbPos === 'bc';
        const positionStyle = useDyn
          ? (isCenter
              ? { ...(POS_STYLES[tbPos] || POS_STYLES.br), left: 0, right: 0, alignItems: 'center' }
              : POS_STYLES[tbPos] || POS_STYLES.br)
          : { bottom: -2, right: -2 };
        return (
          <View
            style={{
              position: 'absolute',
              ...positionStyle,
              transform: [{ scale: pillScale }],
              zIndex: 4, elevation: 8,
            }}
            pointerEvents="none"
          >
            <TierBadge
              tier={normalizedTier}
              size={tierBadgeSize}
              frameId={frameId}
            />
          </View>
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
