import React from 'react';
import { View, Image, Text, StyleSheet, Platform, Animated, Easing, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../constants/avatars';
import { TIER_DEFINITIONS } from '../constants/tiers';
import type { SubscriptionTier } from '../types';
import { migrateLegacyTier } from '../types';
import AvatarFrame from './profile/AvatarFrame';
import { getFrameAvatarRatio } from '../constants/frameLottieRegistry';
import TierBadge from './TierBadge';
import { ensureFrameConfig, getCachedFrameConfig, subscribeConfigChange } from '../services/cosmeticConfigCache';
import { useEffect, useRef, useState } from 'react';

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

  // ★ v213: Web admin'den yapılandırılmış frame_config — cosmetic_items.meta.frame_config
  const [dynFrameCfg, setDynFrameCfg] = useState<any>(getCachedFrameConfig(frameId));
  useEffect(() => {
    if (!frameId) { setDynFrameCfg(null); return; }
    ensureFrameConfig(frameId).then((cfg) => setDynFrameCfg(cfg));
  }, [frameId]);

  // ★ 2026-05-11: REALTIME — admin değişiklik yapınca AvatarFrame gibi
  //   StatusAvatar da anında güncellensin (5dk cache yerine ~1sn).
  useEffect(() => {
    if (!frameId) return;
    const unsub = subscribeConfigChange((id) => {
      if (id !== frameId) return;
      ensureFrameConfig(frameId).then((cfg) => setDynFrameCfg(cfg));
    });
    return unsub;
  }, [frameId]);

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

  // ★ AVATAR FİLTRE OVERLAY'leri — RN'de Image filter native değil.
  //   Her filtre için kademeli overlay yaklaşımı: blur (expo-blur),
  //   grayscale (siyah-beyaz overlay), sepia (kahverengi tint), brightness (siyah/beyaz),
  //   saturation/hue (mümkün değil, skip + uyarı log).
  const filterOverlays: React.ReactNode[] = [];
  const targetSizeForFilters = frameId ? Math.round(size * dynamicAvatarRatio) : (size - borderWidth * 2 - 2);
  if ((dynFrameCfg?.avatar_grayscale ?? 0) > 0) {
    filterOverlays.push(
      <View key="gray" pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0,
        width: targetSizeForFilters, height: targetSizeForFilters,
        borderRadius: shapeRadius,
        backgroundColor: 'rgba(128,128,128,1)',
        opacity: (dynFrameCfg.avatar_grayscale / 100) * 0.55, // gri tone yaklaşımı
      }} />
    );
  }
  if ((dynFrameCfg?.avatar_sepia ?? 0) > 0) {
    filterOverlays.push(
      <View key="sepia" pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0,
        width: targetSizeForFilters, height: targetSizeForFilters,
        borderRadius: shapeRadius,
        backgroundColor: '#704214',
        opacity: (dynFrameCfg.avatar_sepia / 100) * 0.4,
      }} />
    );
  }
  const brightnessVal = dynFrameCfg?.avatar_brightness ?? 1;
  if (brightnessVal !== 1) {
    const isUp = brightnessVal > 1;
    filterOverlays.push(
      <View key="bright" pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0,
        width: targetSizeForFilters, height: targetSizeForFilters,
        borderRadius: shapeRadius,
        backgroundColor: isUp ? 'white' : 'black',
        opacity: Math.abs(brightnessVal - 1) * 0.4,
      }} />
    );
  }

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
          //   Image → boyut + dinamik şekil (borderRadius mapping).
          //   Filter overlay'leri → grayscale/sepia/brightness yaklaşımı.
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
              {/* Avatar filtre overlay'leri (grayscale/sepia/brightness) */}
              {filterOverlays}
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

      {/* ★ 2026-04-29: Tier badge — Free'yi hiç gösterme (default), Plus/Pro/GM için
          minimalist yuvarlak ikon (yazı kaldırıldı, daha zarif).
          ★ v108.14: Aktif çerçeve varsa rozet gizlenir — kullanıcının istediği
          sade görünüm (avatar + frame + hafif gölge yeterli). */}
      {/* ★ v109.4.2: TierBadge avatar üstünde, mini için xs ikon-only.
           Sahne/profil çağrıları `tierBadgeSize="sm"` ile büyük "PRO" pill alır.
           ★ 2026-05-11: Web admin tier_badge_enabled=true ise eski badge gizlenir
           — AvatarFrame içindeki TierBadgeOverlay tarafından (web admin konum/stil ile)
           render edilir, çift badge görünmesin. */}
      {showTierBadge && normalizedTier !== 'Free' && !dynFrameCfg?.tier_badge_enabled && (
        <View
          style={{
            position: 'absolute',
            bottom: -2, right: -2,
            transform: [{ scale: pillScale }],
            zIndex: 4, elevation: 8,
          }}
          pointerEvents="none"
        >
          <TierBadge tier={normalizedTier} size={tierBadgeSize} />
        </View>
      )}
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
