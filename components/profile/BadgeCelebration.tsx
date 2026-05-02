/**
 * SopranoChat — Badge Celebration Overlay (Faz 6.3)
 * ═══════════════════════════════════════════════════
 * Rozet kazanıldığında tam ekran animasyonlu kutlama.
 * Modal/toast DEĞİL — üstte yüzen overlay, otomatik kaybolur.
 *
 * İllüstrasyon kalitesinde görsel:
 *   - Çok katmanlı radyal glow (iç/dış/halo)
 *   - Dönen ışık çizgileri (shine rays)
 *   - Yüzen parçacıklar (sparkles)
 *   - 3D derinlik hissi (çoklu shadow katmanı)
 *   - Rarity'ye göre farklı renk paleti + yoğunluk
 *   - Scale+rotate+fade giriş/çıkış animasyonları
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BadgeDef, BadgeRarity } from '../../constants/badges';

const { width: W, height: H } = Dimensions.get('window');

// ═══ Rarity görsel ayarları ═══
const RARITY_VISUALS: Record<BadgeRarity, {
  label: string;
  labelColor: string;
  bgGrad: [string, string, string];
  ringColors: [string, string];
  particleCount: number;
  rayCount: number;
  glowIntensity: number;
}> = {
  common: {
    label: 'YAYGIN',
    labelColor: '#94A3B8',
    bgGrad: ['rgba(15,23,42,0.97)', 'rgba(30,41,59,0.95)', 'rgba(15,23,42,0.97)'],
    ringColors: ['rgba(148,163,184,0.3)', 'rgba(148,163,184,0.08)'],
    particleCount: 8,
    rayCount: 6,
    glowIntensity: 0.4,
  },
  rare: {
    label: 'NADİR',
    labelColor: '#60A5FA',
    bgGrad: ['rgba(15,23,42,0.97)', 'rgba(23,37,84,0.95)', 'rgba(15,23,42,0.97)'],
    ringColors: ['rgba(96,165,250,0.4)', 'rgba(96,165,250,0.1)'],
    particleCount: 14,
    rayCount: 8,
    glowIntensity: 0.55,
  },
  epic: {
    label: 'EPİK',
    labelColor: '#C084FC',
    bgGrad: ['rgba(15,23,42,0.97)', 'rgba(49,29,97,0.95)', 'rgba(15,23,42,0.97)'],
    ringColors: ['rgba(192,132,252,0.45)', 'rgba(192,132,252,0.12)'],
    particleCount: 20,
    rayCount: 12,
    glowIntensity: 0.7,
  },
  legendary: {
    label: 'EFSANEVİ',
    labelColor: '#FBBF24',
    bgGrad: ['rgba(15,23,42,0.97)', 'rgba(78,53,12,0.92)', 'rgba(15,23,42,0.97)'],
    ringColors: ['rgba(251,191,36,0.5)', 'rgba(251,191,36,0.15)'],
    particleCount: 28,
    rayCount: 16,
    glowIntensity: 0.9,
  },
};

// ═══ Parçacık bileşeni ═══
function Sparkle({ delay, color, intensity }: { delay: number; color: string; intensity: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const angle = Math.random() * 360;
  const distance = 60 + Math.random() * 80;
  const size = 3 + Math.random() * 5;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1800 + Math.random() * 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(200 + Math.random() * 400),
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
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 4,
    }} />
  );
}

// ═══ Işık çizgisi bileşeni ═══
function Ray({ angle, color, length }: { angle: number; color: string; length: number }) {
  const anim = useRef(new Animated.Value(0.1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.35, duration: 1200 + Math.random() * 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.1, duration: 1200 + Math.random() * 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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

/** Herhangi bir yerden kutlamayı tetikle */
export function triggerBadgeCelebration(badge: BadgeDef) {
  _listeners.forEach(fn => fn(badge));
}

/** Kutlama event'ine subscribe ol */
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
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.3)).current;
  const glowPulse = useRef(new Animated.Value(0.5)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const spOpacity = useRef(new Animated.Value(0)).current;
  const spScale = useRef(new Animated.Value(0.5)).current;
  const shineRotate = useRef(new Animated.Value(0)).current;

  // Refs for cleanup
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const shineRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAnims = useCallback(() => {
    overlayOpacity.setValue(0);
    badgeScale.setValue(0);
    badgeRotate.setValue(0);
    glowScale.setValue(0.3);
    glowPulse.setValue(0.5);
    textOpacity.setValue(0);
    textTranslateY.setValue(20);
    spOpacity.setValue(0);
    spScale.setValue(0.5);
    shineRotate.setValue(0);
  }, []);

  // Subscribe to global events
  useEffect(() => {
    const unsub = onBadgeCelebration((b) => {
      resetAnims();
      setBadge(b);
      setVisible(true);
    });
    return () => { unsub(); pulseRef.current?.stop(); shineRef.current?.stop(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Animate in when visible
  useEffect(() => {
    if (!visible || !badge) return;

    // 1. Overlay fade in
    Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // 2. Badge entrance — bouncy scale + slight rotate
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        Animated.timing(badgeRotate, { toValue: 1, duration: 800, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]),
    ]).start();

    // 3. Glow expand
    Animated.sequence([
      Animated.delay(350),
      Animated.spring(glowScale, { toValue: 1, tension: 30, friction: 8, useNativeDriver: true }),
    ]).start();

    // 4. Glow pulse loop
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.5, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseRef.current.start();

    // 5. Shine rotation loop
    shineRef.current = Animated.loop(
      Animated.timing(shineRotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    );
    shineRef.current.start();

    // 6. Text reveal
    Animated.sequence([
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // 7. SP reward pop
    Animated.sequence([
      Animated.delay(900),
      Animated.parallel([
        Animated.spring(spScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
        Animated.timing(spOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    // 8. Auto dismiss after 4.5 seconds
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(badgeScale, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        pulseRef.current?.stop();
        shineRef.current?.stop();
        setVisible(false);
        setBadge(null);
      });
    }, 4500);
  }, [visible, badge]);

  if (!visible || !badge) return null;

  const vis = RARITY_VISUALS[badge.rarity];
  const rotateInterp = badgeRotate.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] });
  const shineRotateInterp = shineRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[st.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
      <LinearGradient
        colors={vis.bgGrad}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      />

      {/* ═══ Dönen ışık çizgileri ═══ */}
      <Animated.View style={[st.rayContainer, { transform: [{ rotate: shineRotateInterp }] }]}>
        {Array.from({ length: vis.rayCount }).map((_, i) => (
          <Ray key={i} angle={(360 / vis.rayCount) * i} color={badge.color + '40'} length={120 + Math.random() * 60} />
        ))}
      </Animated.View>

      {/* ═══ Dış glow halo ═══ */}
      {/* ★ v92.23 (1 May 2026): Android elevation eklendi — Android'de glow halo
           hiç render olmuyordu, rozet animasyonu vasat görünüyordu. */}
      <Animated.View style={[st.glowOuter, {
        opacity: glowPulse,
        transform: [{ scale: glowScale }],
        backgroundColor: badge.glow,
        shadowColor: badge.color,
        shadowOpacity: vis.glowIntensity,
        shadowRadius: 60,
        elevation: 18,
      }]} />

      {/* ═══ İç glow ring ═══ */}
      <Animated.View style={[st.glowInner, {
        transform: [{ scale: glowScale }],
        borderColor: vis.ringColors[0],
        shadowColor: badge.color,
        shadowOpacity: vis.glowIntensity * 0.7,
        shadowRadius: 30,
        elevation: 12,
      }]} />

      {/* ═══ Parçacıklar ═══ */}
      <View style={st.particleContainer}>
        {Array.from({ length: vis.particleCount }).map((_, i) => (
          <Sparkle key={i} delay={i * 120} color={badge.color} intensity={vis.glowIntensity} />
        ))}
      </View>

      {/* ═══ Badge İkon — 3D derinlik ═══ */}
      <Animated.View style={[st.badgeIconWrap, {
        transform: [{ scale: badgeScale }, { rotate: rotateInterp }],
      }]}>
        {/* Arka plan katmanı — derinlik */}
        <View style={[st.badgeBackLayer, { backgroundColor: badge.color + '15', borderColor: badge.color + '30' }]} />
        {/* Orta katman — gradient */}
        <LinearGradient
          colors={[badge.color + '25', badge.color + '08', 'transparent']}
          style={st.badgeMidLayer}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
        {/* Ön katman — ikon */}
        <View style={[st.badgeFrontLayer, {
          shadowColor: badge.color,
          shadowOpacity: 0.8,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 4 },
          elevation: 14,
        }]}>
          <Ionicons name={badge.icon} size={56} color={badge.color} style={{
            textShadowColor: badge.glow,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 20,
          }} />
        </View>
        {/* Üst parlama — cam efekti */}
        <View style={st.badgeGlassHighlight} />
      </Animated.View>

      {/* ═══ Metin — isim + açıklama ═══ */}
      <Animated.View style={[st.textContainer, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
        {/* Rarity pill */}
        <View style={[st.rarityPill, { borderColor: vis.labelColor + '40', backgroundColor: vis.labelColor + '12' }]}>
          <Text style={[st.rarityText, { color: vis.labelColor }]}>{vis.label}</Text>
        </View>
        {/* Badge name */}
        <Text style={[st.badgeName, { textShadowColor: badge.glow }]}>{badge.label}</Text>
        {/* Description */}
        <Text style={st.badgeDesc}>{badge.description}</Text>
      </Animated.View>

      {/* ═══ SP Ödül ═══ */}
      {badge.spReward > 0 && (
        <Animated.View style={[st.spReward, { opacity: spOpacity, transform: [{ scale: spScale }] }]}>
          <LinearGradient
            colors={['rgba(251,191,36,0.15)', 'rgba(251,191,36,0.05)']}
            style={st.spGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Ionicons name="flash" size={16} color="#FBBF24" />
            <Text style={st.spText}>+{badge.spReward} SP</Text>
          </LinearGradient>
        </Animated.View>
      )}
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
  rayContainer: {
    position: 'absolute',
    width: 300, height: 300,
    justifyContent: 'center', alignItems: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    elevation: 20,
  },
  glowInner: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    elevation: 10,
  },
  particleContainer: {
    position: 'absolute',
    width: 0, height: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeIconWrap: {
    width: 120, height: 120,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  badgeBackLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    borderWidth: 1.5,
    transform: [{ scale: 1.15 }],
  },
  badgeMidLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    transform: [{ scale: 1.05 }],
  },
  badgeFrontLayer: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 15,
  },
  badgeGlassHighlight: {
    position: 'absolute',
    top: 8, left: 20, right: 20, height: 30,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ scaleX: 0.8 }],
  },
  textContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  rarityPill: {
    paddingHorizontal: 12, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1,
  },
  rarityText: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2,
  },
  badgeName: {
    fontSize: 28, fontWeight: '900', color: '#F8FAFC',
    letterSpacing: 0.5,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  badgeDesc: {
    fontSize: 14, color: 'rgba(148,163,184,0.8)',
    fontWeight: '500',
    textAlign: 'center', maxWidth: 260,
  },
  spReward: {
    marginTop: 20,
  },
  spGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  spText: {
    fontSize: 18, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(251,191,36,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
