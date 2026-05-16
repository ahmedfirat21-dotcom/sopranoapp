/**
 * SopranoChat — Badge Celebration Overlay
 * ═══════════════════════════════════════════════════════════════════
 * v107.5 (2 May 2026) — KART FORMUNA YENİDEN YAZILDI.
 *
 * Eski versiyon (v92.23): 4.5 saniye süre + 28 parçacık + 16 ray +
 * shadowColor/elevation karışık (Android'de gri kare görünüyordu, glow
 * halo render olmuyordu) = "berbat" hissi. Bağış sonrası başarı modalı
 * (2.7s) + bu pop-up (4.5s) = 7.2s toplam ekran zamanı.
 *
 * Yeni versiyon (v107.5):
 *   - Kart formu (CARD_WIDTH 320, ortada) — full-screen tier renkli BG YOK
 *   - 2400ms toplam (entrance 700 + hold 1450 + exit 250) — %46 hızlı
 *   - Android shadow: shadowColor/elevation TAMAMEN KALDIRILDI; glow için
 *     LinearGradient katman + border highlight kullanıldı (cross-platform)
 *   - Parçacık/ray sayıları yarıya indirildi (sade sahne)
 *   - Backdrop: BlurView + dim (sade)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Animated, Easing, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BadgeDef, BadgeRarity } from '../../constants/badges';

const { width: W, height: H } = Dimensions.get('window');
const CARD_WIDTH = Math.min(W - 32, 340);

// ═══ Rarity görsel ayarları — sadeleştirildi ═══
const RARITY_VISUALS: Record<BadgeRarity, {
  label: string;
  labelColor: string;
  particleCount: number;
  rayCount: number;
  glowOpacity: number; // tier glow yoğunluğu (LinearGradient opacity)
}> = {
  common: {
    label: 'YAYGIN',
    labelColor: '#94A3B8',
    particleCount: 4,    // 8 → 4
    rayCount: 4,         // 6 → 4
    glowOpacity: 0.30,
  },
  rare: {
    label: i18n.t('profile.badgecelebration.001'),
    labelColor: '#60A5FA',
    particleCount: 8,    // 14 → 8
    rayCount: 6,         // 8 → 6
    glowOpacity: 0.40,
  },
  epic: {
    label: i18n.t('profile.badgecelebration.002'),
    labelColor: '#C084FC',
    particleCount: 12,   // 20 → 12
    rayCount: 8,         // 12 → 8
    glowOpacity: 0.50,
  },
  legendary: {
    label: i18n.t('profile.badgecelebration.003'),
    labelColor: '#FBBF24',
    particleCount: 16,   // 28 → 16
    rayCount: 10,        // 16 → 10
    glowOpacity: 0.60,
  },
};

// ═══ Parçacık — Animated.loop cleanup zorunlu (memory) ═══
function Sparkle({ delay, color, intensity }: { delay: number; color: string; intensity: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const angle = useRef(Math.random() * 360).current;
  const distance = useRef(50 + Math.random() * 60).current;
  const size = useRef(3 + Math.random() * 4).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1, duration: 1400 + Math.random() * 600,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rad = (angle * Math.PI) / 180;
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * distance] });
  const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * distance] });
  const opacity = anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, intensity, intensity * 0.6, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 0.4] });

  return (
    <Animated.View style={{
      position: 'absolute',
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
      opacity,
      transform: [{ translateX: tx }, { translateY: ty }, { scale }],
    }} />
  );
}

// ═══ Işık çizgisi — sade ═══
function Ray({ angle, color, length }: { angle: number; color: string; length: number }) {
  const anim = useRef(new Animated.Value(0.1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.30, duration: 1100 + Math.random() * 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.10, duration: 1100 + Math.random() * 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      width: 2, height: length,
      backgroundColor: color,
      opacity: anim,
      transform: [{ rotate: `${angle}deg` }, { translateY: -length / 2 }],
      borderRadius: 1,
    }} />
  );
}

// ═══ Global event bus ═══
type BadgeCelebrationListener = (badge: BadgeDef) => void;
const _listeners = new Set<BadgeCelebrationListener>();

export function triggerBadgeCelebration(badge: BadgeDef) {
  _listeners.forEach(fn => fn(badge));
}

export function onBadgeCelebration(fn: BadgeCelebrationListener) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// ═══ ANA BİLEŞEN ═══
export default function BadgeCelebration() {
  const [badge, setBadge] = useState<BadgeDef | null>(null);
  const [visible, setVisible] = useState(false);

  // Animasyon değerleri
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardTranslateY = useRef(new Animated.Value(20)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.5)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(12)).current;
  const spOpacity = useRef(new Animated.Value(0)).current;
  const spScale = useRef(new Animated.Value(0.7)).current;
  const shineRotate = useRef(new Animated.Value(0)).current;

  // Refs for cleanup
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const shineRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAnims = useCallback(() => {
    overlayOpacity.setValue(0);
    cardScale.setValue(0.92);
    cardTranslateY.setValue(20);
    badgeScale.setValue(0);
    badgeRotate.setValue(0);
    glowPulse.setValue(0.5);
    textOpacity.setValue(0);
    textTranslateY.setValue(12);
    spOpacity.setValue(0);
    spScale.setValue(0.7);
    shineRotate.setValue(0);
  }, []);

  // Subscribe to global events
  useEffect(() => {
    const unsub = onBadgeCelebration((b) => {
      resetAnims();
      setBadge(b);
      setVisible(true);
    });
    return () => {
      unsub();
      pulseRef.current?.stop();
      shineRef.current?.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Animate in when visible
  useEffect(() => {
    if (!visible || !badge) return;

    // ★ ENTRANCE — toplam ~700ms
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      // Card slide-up + scale spring
      Animated.spring(cardScale, { toValue: 1, tension: 90, friction: 11, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, tension: 90, friction: 11, useNativeDriver: true }),
      // Badge entrance — bouncy scale + slight rotate
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.spring(badgeScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
          Animated.timing(badgeRotate, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        ]),
      ]),
      // Text reveal
      Animated.sequence([
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(textTranslateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
      // SP reward pop (badge.spReward > 0 ise)
      Animated.sequence([
        Animated.delay(620),
        Animated.parallel([
          Animated.spring(spScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
          Animated.timing(spOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    // Glow pulse loop — LinearGradient opacity dans
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.5, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();

    // Shine rotation loop — ışık çizgileri
    shineRef.current = Animated.loop(
      Animated.timing(shineRotate, { toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true })
    );
    shineRef.current.start();

    // ★ AUTO-DISMISS — 1450ms hold + 250ms fade-out (toplam 2400ms görünür)
    //   Eski: 4500ms. Yeni: 700 + 1450 + 250 = 2400ms (%46 hızlı).
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.95, duration: 250, useNativeDriver: true }),
        Animated.timing(cardTranslateY, { toValue: -10, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        pulseRef.current?.stop();
        shineRef.current?.stop();
        setVisible(false);
        setBadge(null);
      });
    }, 700 + 1450);
  }, [visible, badge]);

  if (!visible || !badge) return null;

  const vis = RARITY_VISUALS[badge.rarity];
  const rotateInterp = badgeRotate.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] });
  const shineRotateInterp = shineRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[st.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
      {/* Backdrop — BlurView + koyu dim (full-screen tier rengi YOK) */}
      <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />

      {/* ═══ Card — tier accent border + panel BG, ortada compact ═══ */}
      <Animated.View
        style={[
          st.card,
          {
            borderColor: badge.color + (Platform.OS === 'android' ? 'AA' : '66'),
            opacity: overlayOpacity,
            transform: [
              { translateY: cardTranslateY },
              { scale: cardScale },
            ],
          },
        ]}
      >
        {/* Card iç zemin */}
        <LinearGradient
          colors={['#1c2330', '#11151e', '#06080d']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Tier ışık huzmesi — kart üstünden yumuşak */}
        <View style={st.spotlight} pointerEvents="none">
          <LinearGradient
            colors={[
              badge.color + 'AA',
              badge.color + '44',
              badge.color + '11',
              'transparent',
            ]}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        {/* Top edge highlight */}
        <LinearGradient
          colors={['transparent', badge.color + 'CC', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={st.topEdge}
        />

        {/* ═══ Badge bölgesi — ışık çizgileri + glow halo + ikon ═══ */}
        <View style={st.badgeRegion} pointerEvents="none">
          {/* Dönen ışık çizgileri (sayı yarıya indirildi) */}
          <Animated.View style={[st.rayContainer, { transform: [{ rotate: shineRotateInterp }] }]}>
            {Array.from({ length: vis.rayCount }).map((_, i) => (
              <Ray
                key={i}
                angle={(360 / vis.rayCount) * i}
                color={badge.color + '50'}
                length={100 + Math.random() * 40}
              />
            ))}
          </Animated.View>

          {/* ★ Glow halo — LinearGradient circle (Android-safe, shadow YOK) */}
          <Animated.View
            style={[
              st.glowHalo,
              {
                opacity: Animated.multiply(glowPulse, vis.glowOpacity),
              },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[badge.color + 'AA', badge.color + '44', 'transparent']}
              start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
              style={st.glowGrad}
            />
          </Animated.View>

          {/* Parçacıklar (yarıya indirildi) */}
          <View style={st.particleContainer} pointerEvents="none">
            {Array.from({ length: vis.particleCount }).map((_, i) => (
              <Sparkle
                key={i}
                delay={i * 100}
                color={badge.color}
                intensity={vis.glowOpacity + 0.2}
              />
            ))}
          </View>

          {/* Badge icon — 2 katman (Android shadow yok, sade) */}
          <Animated.View
            style={[
              st.badgeIconWrap,
              { transform: [{ scale: badgeScale }, { rotate: rotateInterp }] },
            ]}
          >
            {/* Arka katman — tier renkli circle (cam efekti) */}
            <View style={[st.badgeBackLayer, { backgroundColor: badge.color + '18', borderColor: badge.color + '50' }]} />
            {/* Ön katman — koyu zemin + ikon (shadow YOK, border highlight) */}
            <View style={[st.badgeFrontLayer, { borderColor: badge.color + '88' }]}>
              <Ionicons
                name={badge.icon}
                size={48}
                color={badge.color}
                style={{
                  // Text shadow Android'de renkli glow olur
                  textShadowColor: badge.color + 'CC',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 14,
                }}
              />
            </View>
            {/* Cam efekti — üst parlatma */}
            <View style={st.badgeGlassHighlight} />
          </Animated.View>
        </View>

        {/* ═══ Metin — rarity pill + isim + açıklama ═══ */}
        <Animated.View
          style={[
            st.textContainer,
            { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
          ]}
        >
          <View style={[st.rarityPill, { borderColor: vis.labelColor + '40', backgroundColor: vis.labelColor + '14' }]}>
            <Text style={[st.rarityText, { color: vis.labelColor }]}>{vis.label}</Text>
          </View>
          <Text
            style={[
              st.badgeName,
              {
                textShadowColor: badge.color + '88',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 12,
              },
            ]}
          >
            {badge.label}
          </Text>
          <Text style={st.badgeDesc}>{badge.description}</Text>
        </Animated.View>

        {/* ═══ SP Ödül ═══ */}
        {badge.spReward > 0 && (
          <Animated.View style={[st.spReward, { opacity: spOpacity, transform: [{ scale: spScale }] }]}>
            <LinearGradient
              colors={['rgba(251,191,36,0.18)', 'rgba(251,191,36,0.06)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={st.spGrad}
            >
              <Ionicons name="flash" size={14} color="#FBBF24" />
              <Text style={st.spText}>+{badge.spReward} SP</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ★ Card — ortada compact, tier accent border (Android shadow YOK)
  card: {
    width: CARD_WIDTH,
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
    overflow: 'hidden',
    alignItems: 'center',
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
  },
  // Sahne ışığı — kart üst kısmı
  spotlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 180,
    opacity: 0.30,
  },
  // Badge bölgesi — ray + halo + icon merkezleme
  badgeRegion: {
    width: 200, height: 200,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  rayContainer: {
    position: 'absolute',
    width: 220, height: 220,
    justifyContent: 'center', alignItems: 'center',
  },
  // ★ Glow halo — LinearGradient circle (Android-safe, shadowColor YOK)
  glowHalo: {
    position: 'absolute',
    width: 180, height: 180,
    borderRadius: 90,
    overflow: 'hidden',
  },
  glowGrad: {
    width: '100%', height: '100%',
    borderRadius: 90,
  },
  particleContainer: {
    position: 'absolute',
    width: 0, height: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  // Badge icon — sade 2 katman (eski 3D katman + 4 shadow yerine)
  badgeIconWrap: {
    width: 100, height: 100,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeBackLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    borderWidth: 1.2,
    transform: [{ scale: 1.12 }],
  },
  badgeFrontLayer: {
    width: 86, height: 86, borderRadius: 43,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1.5,
  },
  badgeGlassHighlight: {
    position: 'absolute',
    top: 14, left: 24, right: 24, height: 22,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ scaleX: 0.85 }],
  },
  textContainer: {
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rarityPill: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  rarityText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.8,
  },
  badgeName: {
    fontSize: 22, fontWeight: '900', color: '#F8FAFC',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  badgeDesc: {
    fontSize: 12, color: 'rgba(148,163,184,0.78)',
    fontWeight: '500',
    textAlign: 'center', maxWidth: 240,
    marginTop: 1,
  },
  spReward: {
    marginTop: 14,
  },
  spGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)',
  },
  spText: {
    fontSize: 14, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(251,191,36,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
