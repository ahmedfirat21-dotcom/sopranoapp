/**
 * SopranoChat — Rozet Detay Modal (Skia Premium Celebration)
 * ═══════════════════════════════════════════════════════════════
 * v295 (17 May 2026) — Eski PremiumAlert (jenerik) yerine zengin
 * celebration tarzı modal. Rarity'e duyarlı, Skia-based büyük medal,
 * aile dili gradient (slate diagonal + rarity halo + soft glow).
 *
 * Tasarım:
 * - Center modal, scale + fade-in spring animation
 * - Rarity pill (üst)
 * - 200dp Skia medal (rarity-specific path + animated glow)
 *   • Common    → slate disc (sade)
 *   • Rare      → bronze shield (etched border)
 *   • Epic      → hexagon (holographic shimmer)
 *   • Legendary → 5-yıldız (rotating sparkles + gold gradient)
 * - Title (rarity color, büyük)
 * - Description (multi-line)
 * - Criteria pill (kazanma şartı, varsa)
 * - SP reward chip (varsa, altın hexagon ikon)
 * - "Tamam" CTA (rarity gradient)
 * - Drag-down ile kapanır (memory rule)
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Animated, Easing, PanResponder, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { BadgeDef, BadgeRarity } from '../../constants/badges';
import { i18n } from '../../services/i18n';

// ★ v295: Skia safe-load — module yoksa fallback (RN gradient medal)
let SkiaMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch {}
let ReanimatedMod: any = null;
try { ReanimatedMod = require('react-native-reanimated'); } catch {}

const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════
// RARITY PALETLERİ
// ═══════════════════════════════════════════════════════════════
const RARITY_PALETTE: Record<BadgeRarity, {
  label: string;
  primary: string;      // Ana renk (ring, text)
  light: string;        // Açık tonu (highlight)
  deep: string;         // Koyu tonu (shadow)
  gradient: [string, string, string];   // Medal path gradient
  halo: string;         // Halo rgba
  bgHaloRgb: string;    // "R,G,B" — aile gradient halo için
  ctaGradient: [string, string];        // CTA button gradient
}> = {
  common: {
    label: 'YAYGIN',
    primary: '#94A3B8',
    light: '#CBD5E1',
    deep: '#475569',
    gradient: ['#CBD5E1', '#64748B', '#334155'],
    halo: 'rgba(148,163,184,0.45)',
    bgHaloRgb: '148,163,184',
    ctaGradient: ['#64748B', '#475569'],
  },
  rare: {
    label: 'NADİR',
    primary: '#FBBF24',
    light: '#FDE68A',
    deep: '#854D0E',
    gradient: ['#FDE68A', '#CA8A04', '#854D0E'],
    halo: 'rgba(251,191,36,0.55)',
    bgHaloRgb: '251,191,36',
    ctaGradient: ['#D97706', '#92400E'],
  },
  epic: {
    label: 'EPİK',
    primary: '#A78BFA',
    light: '#DDD6FE',
    deep: '#5B21B6',
    gradient: ['#DDD6FE', '#A78BFA', '#5B21B6'],
    halo: 'rgba(167,139,250,0.6)',
    bgHaloRgb: '167,139,250',
    ctaGradient: ['#7C3AED', '#5B21B6'],
  },
  legendary: {
    label: 'EFSANEVİ',
    primary: '#FCD34D',
    light: '#FEF3C7',
    deep: '#78350F',
    gradient: ['#FEF3C7', '#FCD34D', '#D97706'],
    halo: 'rgba(252,211,77,0.75)',
    bgHaloRgb: '252,211,77',
    ctaGradient: ['#F59E0B', '#B45309'],
  },
};

// ═══════════════════════════════════════════════════════════════
// SKIA PREMIUM MEDAL — Rarity'e özel path + glow + animasyon
// ═══════════════════════════════════════════════════════════════
const MEDAL_SIZE = 180;
// ★ v297 (17 May 2026): Halo glow Canvas kenarında clip oluyordu (BlurMask
//   normal style → blur radius'un yarısı canvas dışına taşıyor). GLOW_PAD ile
//   Canvas büyütüldü, content GLOW_PAD kadar offset'lendi. CosmeticBadge ile aynı pattern.
// ★ v319.4 (18 May 2026): GLOW_PAD 40 → 100 — en dış halo (r*1.7 + blur 70)
//   eskiden hâlâ Canvas sınırında "çizgi izi" bırakıyordu. Ek mesafe Mach band
//   optik yanılgısını da yumuşatır.
const GLOW_PAD = 100;
const CANVAS_SIZE = MEDAL_SIZE + GLOW_PAD * 2;

// ★ v297: Hex → rgba helper (multi-layer halo için)
function hexToRgba(hex: string, alpha: number): string {
  if (!hex?.startsWith('#') || hex.length !== 7) return `rgba(252,211,77,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function PremiumMedal({ rarity }: { rarity: BadgeRarity }) {
  const palette = RARITY_PALETTE[rarity];
  // ★ v297: Doğru Skia namespace pattern — CosmeticBadge'daki v281 fix ile aynı.
  //   SkiaMod = full module (Canvas/Path JSX components), SkiaMod.Skia = imperative
  //   namespace (Path.Make() vb.). İkisini karıştırmak "Skia.Path.Make is not a function"
  //   render hatası verir.
  const SkiaNS = SkiaMod?.Skia;

  // ★ v319.4 (18 May 2026): Pulse glow + shimmer animasyonu — kullanıcı feedback:
  //   "animasyonlu parlama efekti olsun yani çok daha kaliteli görünsün". İki
  //   bağımsız loop:
  //     pulseAnim    → halo opacity + scale (1.8 sn nefes alma)
  //     shimmerAnim  → diagonal beyaz ışık şeridi medal üzerinde geçer (3.2 sn)
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1600),
      ])
    );
    pulse.start();
    shimmer.start();
    return () => { pulse.stop(); shimmer.stop(); };
  }, []);
  const haloOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const haloScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.04] });
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-MEDAL_SIZE * 0.8, MEDAL_SIZE * 0.8],
  });
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.15, 0.5, 0.85, 1],
    outputRange: [0, 0.45, 0.7, 0.45, 0],
  });

  // Skia yoksa fallback: RN gradient + Animated.View (Android elevation YOK — keskin shadow olur)
  if (!SkiaMod || !SkiaNS) {
    return (
      <View style={{ width: MEDAL_SIZE, height: MEDAL_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={palette.gradient}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: MEDAL_SIZE * 0.72, height: MEDAL_SIZE * 0.72, borderRadius: MEDAL_SIZE * 0.36, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.light }}
        >
          <MaterialCommunityIcons name={medalIconName(rarity)} size={MEDAL_SIZE * 0.4} color={palette.light} style={{ textShadowColor: palette.deep, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
        </LinearGradient>
      </View>
    );
  }

  const { Canvas, Group, Path, Circle, LinearGradient: SkLinearGradient, RadialGradient: SkRadialGradient, BlurMask, vec } = SkiaMod;

  // ★ Medal path — rarity'e göre şekil. Coordinates 0..MEDAL_SIZE range — Group
  //   transform ile GLOW_PAD offset'i Canvas üstünden uygulanır.
  const buildMedalPath = (): any => {
    const path = SkiaNS.Path.Make();
    const cx = MEDAL_SIZE / 2;
    const cy = MEDAL_SIZE / 2;
    const r = MEDAL_SIZE * 0.34;
    switch (rarity) {
      case 'legendary': {
        // 8-uçlu yıldız (gerçek geometri)
        const points = 8;
        const rOut = r;
        const rIn = r * 0.5;
        for (let i = 0; i < points * 2; i++) {
          const angle = (Math.PI / points) * i - Math.PI / 2;
          const radius = i % 2 === 0 ? rOut : rIn;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.close();
        break;
      }
      case 'epic': {
        // Hexagon
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        path.close();
        break;
      }
      case 'rare': {
        // Shield
        path.moveTo(cx, cy - r);
        path.lineTo(cx + r, cy - r * 0.5);
        path.lineTo(cx + r, cy + r * 0.5);
        path.lineTo(cx, cy + r);
        path.lineTo(cx - r, cy + r * 0.5);
        path.lineTo(cx - r, cy - r * 0.5);
        path.close();
        break;
      }
      case 'common':
      default: {
        path.addCircle(cx, cy, r);
      }
    }
    return path;
  };

  const medalPath = buildMedalPath();
  // ★ v297: Coords Canvas içinde GLOW_PAD offset'li çizilir (Group transform).
  const cx = MEDAL_SIZE / 2 + GLOW_PAD;
  const cy = MEDAL_SIZE / 2 + GLOW_PAD;
  const haloRadius = MEDAL_SIZE * 0.45;

  return (
    <View style={{ width: MEDAL_SIZE, height: MEDAL_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* ★ v319.4: Halo Canvas Animated.View ile sarıldı — pulse opacity+scale loop.
          En dış halo + Canvas (artık 380x380) kart background'una doğal fade,
          "çizgi izi" artefaktı yok. */}
      <Animated.View
        style={{
          position: 'absolute',
          left: -GLOW_PAD, top: -GLOW_PAD,
          width: CANVAS_SIZE, height: CANVAS_SIZE,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
        pointerEvents="none"
      >
        <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
          {/* ★ v319.4: 4 katmanlı halo — en dış çok yumuşak fade (Mach band fix).
              Eski 3 katmanda en dış r*1.25, blur=36 keskin sınır bırakıyordu. */}
          <Circle cx={cx} cy={cy} r={haloRadius * 1.75} color={hexToRgba(palette.primary, 0.06)}>
            <BlurMask blur={70} style="normal" />
          </Circle>
          <Circle cx={cx} cy={cy} r={haloRadius * 1.30} color={hexToRgba(palette.primary, 0.18)}>
            <BlurMask blur={38} style="normal" />
          </Circle>
          <Circle cx={cx} cy={cy} r={haloRadius} color={palette.halo}>
            <BlurMask blur={22} style="normal" />
          </Circle>
          <Circle cx={cx} cy={cy} r={haloRadius * 0.9} color={hexToRgba(palette.light, 0.35)}>
            <BlurMask blur={12} style="normal" />
          </Circle>
        </Canvas>
      </Animated.View>
      <Canvas
        style={{
          position: 'absolute',
          left: -GLOW_PAD, top: -GLOW_PAD,
          width: CANVAS_SIZE, height: CANVAS_SIZE,
        }}
        pointerEvents="none"
      >

        {/* Ana medal — KESKIN ÇERÇEVE YOK, sadece soft glow + gradient fill.
            Kullanıcı feedback: "kare çerçeve yapmışsın, glow belirsiz blur tarzı istiyorum". */}
        <Group transform={[{ translateX: GLOW_PAD }, { translateY: GLOW_PAD }]}>
          {/* (a) Heavy blur aura — sharp stroke YOK, edge'lerde dağılan glow */}
          <Path path={medalPath} style="stroke" strokeWidth={8} color={hexToRgba(palette.light, 0.55)}>
            <BlurMask blur={14} style="normal" />
          </Path>

          {/* (b) Ana fill — RADIAL gradient (sol-üst aydınlık, sağ-alt koyu)
              spherical/gem 3D hissi */}
          <Path path={medalPath} style="fill">
            <SkRadialGradient
              c={vec(MEDAL_SIZE * 0.32, MEDAL_SIZE * 0.28)}
              r={MEDAL_SIZE * 0.85}
              colors={[palette.light, palette.gradient[1], palette.gradient[2]]}
              positions={[0, 0.55, 1]}
            />
          </Path>

          {/* (c) Üst highlight — gem refraction (üst yarıda yumuşak parlak overlay) */}
          <Path path={medalPath} style="fill">
            <SkLinearGradient
              start={vec(MEDAL_SIZE / 2, 0)}
              end={vec(MEDAL_SIZE / 2, MEDAL_SIZE * 0.55)}
              colors={[hexToRgba(palette.light, 0.45), 'transparent']}
            />
          </Path>
        </Group>

        {/* ★ v297 (17 May 2026): Sparkle nokta'lar KALDIRILDI — kullanıcı feedback:
            "kare desen oluşturuyor". 8 nokta (Skia 6 + Animated 4+4) ızgara hissi
            veriyordu. Sade gem + halo daha premium. */}
      </Canvas>

      {/* Üst overlay — orta ikon (MaterialCommunityIcons, Skia content üstünde) */}
      <View style={{ position: 'absolute', width: MEDAL_SIZE, height: MEDAL_SIZE, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <MaterialCommunityIcons
          name={medalIconName(rarity)}
          size={MEDAL_SIZE * 0.34}
          color={palette.deep}
          style={{ textShadowColor: palette.light, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, opacity: 0.85 }}
        />
      </View>

      {/* ★ v319.4: Diagonal shimmer — medal yüzeyinde sweeping beyaz ışık şeridi.
          Sadece medal alanında görünür (overflow:hidden clip). 3.2sn'de bir geçer. */}
      <View
        style={{ position: 'absolute', width: MEDAL_SIZE * 0.72, height: MEDAL_SIZE * 0.72, borderRadius: MEDAL_SIZE * 0.36, overflow: 'hidden' }}
        pointerEvents="none"
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: -MEDAL_SIZE * 0.2,
            bottom: -MEDAL_SIZE * 0.2,
            width: MEDAL_SIZE * 0.32,
            transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }],
            opacity: shimmerOpacity,
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.65)', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>

      {/* ★ v297 (17 May 2026): Tüm Animated.View rotating sparkle overlay'leri KALDIRILDI.
          Sebep: kullanıcı geri bildirimi "kare çerçeve görünüyor". 8 dot (4+4 ızgara konumu)
          + Skia içi 6 dot birleşince kareli ızgara hissi veriyordu. Plus shadow elevation:6
          Android'de zaten dikdörtgen native shadow çiziyordu. Sade gem + multi-layer halo
          daha premium ("belirsiz blur tarzı" kullanıcı isteği). */}
    </View>
  );
}

function medalIconName(rarity: BadgeRarity): any {
  switch (rarity) {
    case 'legendary': return 'crown';
    case 'epic':      return 'diamond-stone';
    case 'rare':      return 'shield-star';
    case 'common':
    default:          return 'star';
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════
interface Props {
  visible: boolean;
  onClose: () => void;
  badge: BadgeDef | null;
  /** ★ v1.7.13.46: locked=true ise rozet kazanılmamış. Detail modal grayscale
   *  ikon + "Nasıl kazanırım" + "Avantajlar (kazanınca)" gösterir. */
  locked?: boolean;
}

export default function BadgeDetailModal({ visible, onClose, badge, locked = false }: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.85, duration: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const closeWithAnim = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: 400, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  // ★ Drag-to-dismiss (memory rule: her modal sürüklenir)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.6) {
          closeWithAnim();
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
        }
      },
    })
  ).current;

  if (!badge) return null;
  const palette = RARITY_PALETTE[badge.rarity];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeWithAnim} />

        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale }, { translateY: dragY }],
              opacity,
              shadowColor: palette.primary,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Aile dili 3-katman gradient */}
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[`rgba(${palette.bgHaloRgb},0.28)`, `rgba(${palette.bgHaloRgb},0.08)`, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[`rgba(${palette.bgHaloRgb},0.10)`, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Üst hairline */}
          <LinearGradient
            colors={['transparent', palette.primary, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.topEdge}
          />

          {/* Drag handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>

          {/* Rarity pill */}
          <View style={[styles.rarityPill, { borderColor: `${palette.primary}55`, backgroundColor: `${palette.primary}1F` }]}>
            <View style={[styles.rarityDot, { backgroundColor: palette.primary }]} />
            <Text style={[styles.rarityPillText, { color: palette.primary }]}>{palette.label}</Text>
          </View>

          {/* Medal */}
          <View style={styles.medalWrap}>
            <PremiumMedal rarity={badge.rarity} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: palette.light }]} numberOfLines={2}>
            {badge.label}
          </Text>

          {/* Description */}
          {!!badge.description && (
            <Text style={styles.description} numberOfLines={4}>
              {badge.description}
            </Text>
          )}

          {/* Criteria */}
          {!!badge.criteriaText && (
            <View style={styles.criteriaPill}>
              <Ionicons name="flag-outline" size={12} color="#94A3B8" />
              <Text style={styles.criteriaText} numberOfLines={3}>{badge.criteriaText}</Text>
            </View>
          )}

          {/* SP Reward */}
          {(badge.spReward || 0) > 0 && (
            <View style={styles.rewardChip}>
              <LinearGradient
                colors={['rgba(251,191,36,0.20)', 'rgba(251,191,36,0.06)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="sparkles" size={14} color="#FBBF24" />
              <Text style={styles.rewardText}>+{badge.spReward} SP ödül kazandın</Text>
            </View>
          )}

          {/* CTA */}
          <Pressable
            onPress={closeWithAnim}
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <LinearGradient
              colors={palette.ctaGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.ctaText}>{i18n.t('common.ok') || 'Tamam'}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const CARD_W = Math.min(SCREEN_W - 32, 360);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,22,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_W,
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // ★ v297 (17 May 2026): Android elevation:18 + RN shadow KALDIRILDI —
    //   keskin dikdörtgen native shadow oluyordu. Medal kendi Skia halo'sunu
    //   taşıyor + backdrop dim arka plan zaten yeterli görsel ayrım. iOS'ta
    //   da artık shadow yok (sade premium).
  },
  topEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.5,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 4, paddingBottom: 6,
  },
  handle: {
    width: 44, height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  rarityPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
  },
  rarityDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  rarityPillText: {
    fontSize: 10, fontWeight: '900', letterSpacing: 1.2,
  },
  medalWrap: {
    marginTop: 6, marginBottom: 12,
  },
  title: {
    fontSize: 22, fontWeight: '800', textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 13, lineHeight: 19, color: '#CBD5E1',
    textAlign: 'center',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  criteriaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    maxWidth: '100%',
  },
  criteriaText: {
    fontSize: 11, color: '#94A3B8', flex: 1,
  },
  rewardChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)',
    marginBottom: 14,
  },
  rewardText: {
    fontSize: 12, fontWeight: '700', color: '#FBBF24',
    letterSpacing: 0.3,
  },
  cta: {
    height: 46, width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: {
    fontSize: 14, fontWeight: '800', color: '#FFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
