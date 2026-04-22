// ★ 2026-04-21 (v2): Modern immersive onboarding — Duolingo/Spotify tarzı full-screen.
//   3 slide: hero pulse rings + stagger text + animated progress bar + sparkles.
//   AsyncStorage ile bir kez gösterilir (`soprano_discover_welcome_seen=1`).
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Dimensions, Animated, Easing,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');
// ★ 2026-04-22 FIX: Storage key VERSION BUMP (v2). Eski buggy kayıtlar
// (legacy fallback set ettiği UID key'ler) geçersiz olsun — uninstall gerekmez.
// v1: 'soprano_discover_welcome_seen' (global) + 'soprano_discover_welcome_seen_${uid}' (buggy fallback)
// v2: 'swv2_${uid}' — yalnızca finalize/skip ile set edilir, otomatik migrasyon yok.
const STORAGE_KEY_PREFIX = 'swv2';
const buildKey = (uid?: string | null) => uid ? `${STORAGE_KEY_PREFIX}_${uid}` : STORAGE_KEY_PREFIX;

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  /** ★ 2026-04-21: Her slide için tematik partikül — soyut sparkle yerine konu ile örtüşen sembol */
  particleIcon: keyof typeof Ionicons.glyphMap;
  particleSize: number;
  title: string;
  body: string;
  accent: string;
  accentDeep: string;
  bgFrom: string;
  bgTo: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'mic',
    particleIcon: 'musical-note', // Sesli sohbet → nota
    particleSize: 16,
    title: 'Sesle tanış',
    body: 'SopranoChat, anlık sesli sohbet odaları platformudur.\nKonuş, dinle, keşfet — hepsi gerçek zamanlı.',
    accent: '#14B8A6',
    accentDeep: '#0D9488',
    bgFrom: '#042F2E',
    bgTo: '#0A0F1A',
  },
  {
    icon: 'add-circle',
    particleIcon: 'people-circle', // Oda aç → küçük topluluk ikonları
    particleSize: 18,
    title: 'Kendi odanı aç',
    body: 'Sağ alttaki + butonuyla istediğin konuda oda aç.\nArkadaşlarını davet et, topluluğunu kur.',
    accent: '#F59E0B',
    accentDeep: '#B45309',
    bgFrom: '#3B2507',
    bgTo: '#0A0F1A',
  },
  {
    icon: 'radio', // ★ 2026-04-21: Keşfet tab'ındaki radyo dalgası ikonu ile tutarlı
    particleIcon: 'musical-notes', // Keşfet → müzik notaları kontrastı
    particleSize: 16,
    title: 'Keşfet ve katıl',
    body: 'Canlı odaları kategoriye göre gez, popüler kullanıcıları keşfet.\nKatıl butonuyla anında sohbete dahil ol.',
    accent: '#8B5CF6',
    accentDeep: '#6D28D9',
    bgFrom: '#2E1065',
    bgTo: '#0A0F1A',
  },
];

export async function hasSeenDiscoverWelcome(uid?: string | null): Promise<boolean> {
  // ★ 2026-04-22 FIX: Legacy global-key fallback KALDIRILDI. Önceki halinde eski
  //   global flag "1" varsa her yeni UID otomatik "seen" olarak işaretleniyordu →
  //   launch öncesi olduğumuz için yeni hesaplar intro'yu hiç göremiyordu.
  try {
    const v = await AsyncStorage.getItem(buildKey(uid));
    return v === '1';
  } catch {
    return true;
  }
}

export async function markDiscoverWelcomeSeen(uid?: string | null) {
  try { await AsyncStorage.setItem(buildKey(uid), '1'); } catch {}
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** ★ 2026-04-21: UID-bazlı "seen" işaretlemesi için */
  uid?: string | null;
};

// ────────────────────────────────────────────────────────────────
// Pulse ring — concentric expanding glow
// ────────────────────────────────────────────────────────────────
function PulseRing({ color, delay, size }: { color: string; delay: number; size: number }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.6, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1700, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(scale, { toValue: 0.5, duration: 1, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          width: size, height: size, borderRadius: size / 2,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// Sparkle — radial floating particle (slide tematiği ile)
// ────────────────────────────────────────────────────────────────
function Sparkle({ accent, index, iconName, iconSize }: {
  accent: string;
  index: number;
  iconName: keyof typeof Ionicons.glyphMap;
  iconSize: number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = (index / 6) * Math.PI * 2 + (Math.random() * 0.5);
    const radius = 90 + Math.random() * 40;
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius;
    const delay = index * 220;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateX, { toValue: tx, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: ty, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.delay(1200),
            Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sparkle, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}
    >
      <Ionicons name={iconName} size={iconSize} color={accent} />
    </Animated.View>
  );
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
export default function DiscoverWelcomeSheet({ visible, onClose, uid }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const titleAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  const animateSlideIn = useCallback(() => {
    titleAnim.setValue(0);
    bodyAnim.setValue(0);
    iconScale.setValue(0);
    iconRotate.setValue(0);

    Animated.parallel([
      Animated.spring(iconScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      Animated.timing(iconRotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(titleAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(bodyAnim, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (visible) {
      setIndex(0);
      animateSlideIn();
      Animated.timing(progressAnim, { toValue: 1 / SLIDES.length, duration: 400, useNativeDriver: false }).start();

      // CTA subtle pulse loop — ★ 2026-04-21: amplitude 1.05 → 1.025 azaltıldı
      // (yüksek scale'de button edge'i shadow ile birleşip "çizgi" etkisi yaratıyordu)
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.025, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    animateSlideIn();
    Animated.timing(progressAnim, {
      toValue: (index + 1) / SLIDES.length,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [index]);

  const next = () => {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      markDiscoverWelcomeSeen(uid);
      onClose();
    }
  };

  const prev = () => {
    if (index > 0) setIndex(index - 1);
  };

  const skip = () => {
    markDiscoverWelcomeSeen(uid);
    onClose();
  };

  // Horizontal swipe between slides
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60) { // swipe left → next
          setIndex(i => Math.min(i + 1, SLIDES.length - 1));
        } else if (g.dx > 60) { // swipe right → prev
          setIndex(i => Math.max(i - 1, 0));
        }
      },
    }),
  ).current;

  const current = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const rotate = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] });

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={skip}>
      <View style={styles.root} {...panResponder.panHandlers}>
        {/* Dinamik arkaplan — slide accent'e göre */}
        <LinearGradient
          colors={[current.bgFrom, current.bgTo, '#050811']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Üst bar — progress + skip */}
        <View style={styles.topBar}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: current.accent,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  shadowColor: current.accent,
                },
              ]}
            />
          </View>
          <Pressable onPress={skip} hitSlop={14} style={styles.skipBtn}>
            <Text style={styles.skipText}>Geç</Text>
          </Pressable>
        </View>

        {/* ★ 2026-04-22: Hero + text + dots dikey merkez, CTA alt sabit
         *  Tüm içerik (animasyon + metin) ekranın ortasında hizalı, düğmeler altta. */}
        <View style={styles.centerBlock}>

        {/* Hero alanı — pulse rings + icon + sparkles */}
        <View style={styles.heroWrap}>
          {/* Pulse rings */}
          <PulseRing color={current.accent} delay={0} size={220} />
          <PulseRing color={current.accent} delay={600} size={220} />
          <PulseRing color={current.accent} delay={1200} size={220} />

          {/* Sparkles — slide tematiği ile */}
          {Array.from({ length: 6 }).map((_, i) => (
            <Sparkle
              key={`${index}-${i}`}
              accent={current.accent}
              index={i}
              iconName={current.particleIcon}
              iconSize={current.particleSize}
            />
          ))}

          {/* Icon badge */}
          <Animated.View
            style={[
              styles.iconBadge,
              {
                borderColor: current.accent + '55',
                shadowColor: current.accent,
                transform: [{ scale: iconScale }, { rotate }],
              },
            ]}
          >
            <LinearGradient
              colors={[current.accent, current.accentDeep]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.iconGrad}
            >
              <Ionicons name={current.icon} size={52} color="#FFF" style={styles.iconShadow} />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Metin alanı — stagger entrance */}
        <View style={styles.textWrap}>
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
          >
            {current.title}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.body,
              {
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            {current.body}
          </Animated.Text>

          {/* Feature chips — slide'a özel mini detaylar */}
          <Animated.View
            style={[
              styles.chipsRow,
              {
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              },
            ]}
          >
            {getSlideChips(index).map(chip => (
              <View key={chip.label} style={[styles.chip, { borderColor: current.accent + '44', backgroundColor: current.accent + '10' }]}>
                <Ionicons name={chip.icon} size={12} color={current.accent} />
                <Text style={[styles.chipText, { color: current.accent }]}>{chip.label}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Dots pagination */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setIndex(i)}
              style={[
                styles.dot,
                i === index && { backgroundColor: current.accent, width: 22, shadowColor: current.accent },
                i !== index && { backgroundColor: 'rgba(255,255,255,0.18)' },
              ]}
            />
          ))}
        </View>

        </View>{/* /centerBlock */}

        {/* CTA — full-width button + absolute prev button (her slide'da SABİT)
         *  ★ 2026-04-21 v3: Prev her slide'da görünür — slide 1'de opacity 0.35 ile pasif.
         *  İkisi de vertical gradient (parlak üst → gölge alt) → modern 3D buton hissi.
         *  CTA tam genişlik; prev absolute floats solda, CTA'yı daraltmaz. */}
        <View style={[styles.ctaRow, { paddingBottom: Math.max(16, insets.bottom + 10) }]}>
          <Animated.View style={[styles.cta, { transform: [{ scale: ctaPulse }] }]}>
            <Pressable
              // ★ 2026-04-22 FIX: flex:1 kaldırıldı — parent Animated.View auto-height
              //   olduğunda CTA yüksekliği 0'a düşüyor ve düğme görünmez oluyordu.
              style={({ pressed }) => [pressed && { opacity: 0.88 }]}
              onPress={next}
            >
              <LinearGradient
                // ★ Vertical: parlak üst → koyu alt (3D premium buton)
                colors={[current.accent, current.accentDeep]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={[styles.ctaGrad, { shadowColor: current.accent }]}
              >
                {/* Parlaklık highlight — üstte ince beyaz gradient overlay */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
                  style={StyleSheet.absoluteFillObject}
                  pointerEvents="none"
                />
                <Text style={styles.ctaText}>{isLast ? 'Başlayalım' : 'Sonraki'}</Text>
                <Ionicons
                  name={isLast ? 'checkmark-circle' : 'arrow-forward'}
                  size={20}
                  color="#FFF"
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Prev — slide 2+ için absolute gradient buton; slide 1'de hiç görünmez
              (CTA full-width olduğu için layout shift yok). */}
          {index > 0 && (
            <Pressable
              onPress={prev}
              // ★ bottom dinamik: CTA ile dikey hizalama — paddingBottom + CTA'nın
              //   merkez ofseti (CTA ~52px, prev 44px → 4px offset)
              style={[styles.prevBtnFloat, { bottom: Math.max(16, insets.bottom + 10) + 4 }]}
              hitSlop={10}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={styles.prevBtnGrad}
              >
                <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

function getSlideChips(idx: number): { icon: keyof typeof Ionicons.glyphMap; label: string }[] {
  switch (idx) {
    case 0: return [
      { icon: 'radio', label: 'Canlı ses' },
      { icon: 'flash', label: 'Anlık' },
      { icon: 'people', label: 'Topluluk' },
    ];
    case 1: return [
      { icon: 'mic-circle', label: 'Ücretsiz' },
      { icon: 'lock-closed', label: 'Gizli/Açık' },
      { icon: 'musical-notes', label: 'Müzik/Sohbet' },
    ];
    case 2: return [
      { icon: 'trending-up', label: 'Popüler' },
      { icon: 'sparkles', label: 'Yeni' },
      { icon: 'flame', label: 'Canlı' },
    ];
    default: return [];
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 40, // ★ 54 → 40: üst boşluk azaltıldı, içerik ekrana sığsın
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  /** ★ 2026-04-22 v3: Hero + text + dots sarmalayıcı — dikey ortalanır */
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  heroWrap: {
    height: H * 0.28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  sparkle: {
    position: 'absolute',
  },
  iconBadge: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 26,
    elevation: 18,
  },
  iconGrad: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  textWrap: {
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 28,   // ★ 2026-04-22: 4 → 28 — metinler hero'ya daha yakın olsun diye çok yukarıdaydı
    marginBottom: 14, // ★ 10 → 14
  },
  title: {
    fontSize: 27,        // ★ 26 → 27
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 10,    // ★ 8 → 10
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  body: {
    fontSize: 14.5,      // ★ 14 → 14.5
    color: 'rgba(248,250,252,0.72)',
    textAlign: 'center',
    lineHeight: 21,      // ★ 20 → 21
    marginBottom: 14,    // ★ 12 → 14
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 14, // ★ 24 → 14
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
  ctaRow: {
    paddingHorizontal: 18,
    position: 'relative',
    // ★ 2026-04-22 v3: CTA ekran altında sabit — centerBlock flex:1 sayesinde
    //   içerik ortada, CTA alt (varsayılan konum).
  },
  /** ★ 2026-04-21 v3: Prev absolute → CTA genişliğini değiştirmez. Her slide'da SABİT
   *  konumda; gradient (parlak üst → gölge alt) ile 3D premium hissi. */
  prevBtnFloat: {
    position: 'absolute',
    left: 26,
    // bottom dinamik olarak JSX'te geçiliyor (insets.bottom'a bağlı)
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  prevBtnGrad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  cta: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
