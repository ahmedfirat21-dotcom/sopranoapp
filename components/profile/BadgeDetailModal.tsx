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

function PremiumMedal({ rarity }: { rarity: BadgeRarity }) {
  const palette = RARITY_PALETTE[rarity];
  const Skia = SkiaMod;
  const Reanimated = ReanimatedMod;

  // ★ Legendary için sürekli rotasyon (sparkle ring)
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rarity !== 'legendary' && rarity !== 'epic') return;
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: rarity === 'legendary' ? 9000 : 14000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [rarity]);

  const rotateStr = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const reverseRotateStr = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  // Skia yoksa fallback: RN gradient + Animated.View
  if (!Skia) {
    return (
      <View style={{ width: MEDAL_SIZE, height: MEDAL_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {/* Halo */}
        <View style={{
          position: 'absolute', width: MEDAL_SIZE * 0.96, height: MEDAL_SIZE * 0.96,
          borderRadius: MEDAL_SIZE / 2, shadowColor: palette.primary,
          shadowOpacity: 0.6, shadowRadius: 32, shadowOffset: { width: 0, height: 0 }, elevation: 18,
          backgroundColor: palette.halo,
        }} />
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

  const { Canvas, Group, Path, Circle, LinearGradient: SkLinearGradient, BlurMask, vec, useFonts } = Skia;

  // ★ Medal path — rarity'e göre şekil
  const buildMedalPath = (): any => {
    const path = Skia.Skia.Path.Make();
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
  const cx = MEDAL_SIZE / 2;
  const cy = MEDAL_SIZE / 2;
  const haloRadius = MEDAL_SIZE * 0.45;

  return (
    <View style={{ width: MEDAL_SIZE, height: MEDAL_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={{ width: MEDAL_SIZE, height: MEDAL_SIZE }}>
        {/* Halo glow (blur arka katman) */}
        <Group>
          <Circle cx={cx} cy={cy} r={haloRadius} color={palette.halo}>
            <BlurMask blur={24} style="normal" />
          </Circle>
        </Group>

        {/* Ana medal — gradient'li path */}
        <Group>
          <Path path={medalPath} style="fill">
            <SkLinearGradient
              start={vec(0, 0)} end={vec(MEDAL_SIZE, MEDAL_SIZE)}
              colors={palette.gradient}
            />
          </Path>

          {/* İç highlight — üstte ışık vurgusu (Path stroke) */}
          <Path path={medalPath} style="stroke" strokeWidth={3} color={palette.light}>
            <BlurMask blur={1} style="solid" />
          </Path>
        </Group>

        {/* Inner sparkle (legendary için sürekli, epic için yavaş, rare/common yok) */}
        {(rarity === 'legendary' || rarity === 'epic') && (
          <Group origin={vec(cx, cy)}>
            {[0, 60, 120, 180, 240, 300].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const sx = cx + Math.cos(rad) * (haloRadius * 0.95);
              const sy = cy + Math.sin(rad) * (haloRadius * 0.95);
              return (
                <Circle key={i} cx={sx} cy={sy} r={3} color={palette.light}>
                  <BlurMask blur={4} style="solid" />
                </Circle>
              );
            })}
          </Group>
        )}
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

      {/* Animasyonlu sparkle ring overlay (legendary/epic) */}
      {(rarity === 'legendary' || rarity === 'epic') && (
        <Animated.View
          style={{
            position: 'absolute', width: MEDAL_SIZE, height: MEDAL_SIZE,
            transform: [{ rotate: rotateStr }],
            pointerEvents: 'none',
          }}
        >
          {[0, 90, 180, 270].map(deg => (
            <View
              key={deg}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: 6, height: 6,
                borderRadius: 3,
                backgroundColor: palette.light,
                transform: [
                  { translateX: -3 },
                  { translateY: -3 },
                  { rotate: `${deg}deg` },
                  { translateY: -MEDAL_SIZE * 0.42 },
                ],
                shadowColor: palette.primary,
                shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              }}
            />
          ))}
        </Animated.View>
      )}

      {/* İkincil halka (sadece legendary) — counter-rotating küçük noktalar */}
      {rarity === 'legendary' && (
        <Animated.View
          style={{
            position: 'absolute', width: MEDAL_SIZE, height: MEDAL_SIZE,
            transform: [{ rotate: reverseRotateStr }],
            pointerEvents: 'none',
          }}
        >
          {[45, 135, 225, 315].map(deg => (
            <View
              key={deg}
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: 4, height: 4,
                borderRadius: 2,
                backgroundColor: palette.primary,
                transform: [
                  { translateX: -2 },
                  { translateY: -2 },
                  { rotate: `${deg}deg` },
                  { translateY: -MEDAL_SIZE * 0.48 },
                ],
                shadowColor: palette.primary,
                shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
                elevation: 4,
              }}
            />
          ))}
        </Animated.View>
      )}
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
}

export default function BadgeDetailModal({ visible, onClose, badge }: Props) {
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
    borderColor: 'rgba(255,255,255,0.06)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 18,
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
