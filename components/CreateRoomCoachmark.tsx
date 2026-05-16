// SopranoChat — Create Room Coachmark v92 (1 May 2026)
// ═══════════════════════════════════════════════════════════════════
// "Yeni Oda Oluştur" CTA butonunu işaret eden premium yönlendirici tooltip.
// RoomCreateHintSheet "Odalarım'a Git" tıklandıktan sonra myrooms ekranı
// açıldığında bir kez gösterilir; AsyncStorage flag'i ile takip edilir.
//
// Tasarım:
//   - Üstte premium altın gradient başarı yazısı "Hadi başla, ilk odanı aç!"
//   - Yazıdan aşağı doğru curved bouncy chevron ok (sürekli wiggle)
//   - Pointer-events="none" → buton tıklamayı engellemez
//   - Backdrop dim layer (hafif) → coachmark kontrastı için
//   - Tap-to-dismiss (backdrop tıklamayla)
//   - Buton tıklanırsa otomatik dismiss
//
// Animasyon orchestrasyonu:
//   1. Backdrop fade-in (250ms)
//   2. Yazı stagger fade + slide-down (300ms ease-out)
//   3. Ok bouncy entrance (spring) + sürekli wiggle loop (1200ms)
//   4. Sparkle particle scatter (8 adet, 60ms stagger)
//
// Android shadow: Platform.select — iOS shadow / Android elevation+border
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');
const STORAGE_KEY_PREFIX = 'soprano_create_room_coachmark_v1_';

export async function shouldShowCreateRoomCoachmark(uid?: string | null): Promise<boolean> {
  if (!uid) return false;
  try {
    const v = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${uid}`);
    if (v === 'seen') return false;
    // DB check — kullanıcı daha önce oda açtıysa coachmark gösterme.
    try {
      const { supabase } = await import('../constants/supabase');
      const { count } = await supabase
        .from('room_creation_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .limit(1);
      if ((count || 0) > 0) {
        try { await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, 'seen'); } catch {}
        return false;
      }
    } catch { /* DB fail — yine göster, kullanıcı dismiss eder */ }
    return true;
  } catch {
    return false;
  }
}

export async function markCreateRoomCoachmarkPending(uid?: string | null) {
  if (!uid) return;
  try { await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, 'pending'); } catch {}
}

export async function markCreateRoomCoachmarkSeen(uid?: string | null) {
  if (!uid) return;
  try { await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, 'seen'); } catch {}
}

interface Props {
  visible: boolean;
  /** CTA butonunun ekran üstünden alt kenarına kadar olan mesafe (insets.top + header + CTA height) */
  ctaTopOffset?: number;
  onDismiss: () => void;
}

const SPARKLE_COUNT = 8;

export default function CreateRoomCoachmark({ visible, ctaTopOffset = 130, onDismiss }: Props) {
  // ─── Backdrop ───
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // ─── Tooltip card ───
  // Yukarıdan aşağı doğru slide (tooltip CTA'nın altında, butona doğru süzülerek gelir)
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(12)).current;

  // ─── Arrow chain (üç chevron, stagger pulse) ───
  const arrowAnim1 = useRef(new Animated.Value(0)).current;
  const arrowAnim2 = useRef(new Animated.Value(0)).current;
  const arrowAnim3 = useRef(new Animated.Value(0)).current;

  // ─── Tooltip shine sweep ───
  const shineAnim = useRef(new Animated.Value(-W)).current;

  // ─── Sparkle scatter ───
  const sparkles = useRef(
    Array.from({ length: SPARKLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.4),
    }))
  ).current;

  useEffect(() => {
    if (!visible) {
      backdropOpacity.setValue(0);
      cardOpacity.setValue(0);
      cardY.setValue(12);
      sparkles.forEach(sp => {
        sp.opacity.setValue(0);
      });
      return;
    }

    // ─── Reset ───
    backdropOpacity.setValue(0);
    cardOpacity.setValue(0);
    cardY.setValue(12);
    sparkles.forEach(sp => {
      sp.x.setValue(0);
      sp.y.setValue(0);
      sp.opacity.setValue(0);
      sp.scale.setValue(0.4);
    });

    // ─── Entrance orchestration ───
    Animated.parallel([
      // Backdrop fade
      Animated.timing(backdropOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      // Card slide+fade
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(cardOpacity, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(cardY, { toValue: 0, tension: 90, friction: 8, useNativeDriver: true }),
        ]),
      ]),
      // Sparkle scatter — aşağıdan yukarıya hafif yelpaze (CTA butonuna doğru)
      Animated.sequence([
        Animated.delay(300),
        Animated.stagger(70, sparkles.map((sp, i) => {
          const angle = ((i / SPARKLE_COUNT) - 0.5) * Math.PI * 0.9; // -PI/2 → PI/2 yelpaze
          const dist = 60 + Math.random() * 40;
          const dx = Math.sin(angle) * dist;
          const dy = -Math.cos(angle) * dist; // yukarı doğru (butona)
          return Animated.parallel([
            Animated.timing(sp.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(sp.scale, { toValue: 0.8 + Math.random() * 0.5, duration: 600, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
            Animated.timing(sp.x, { toValue: dx, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(sp.y, { toValue: dy, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(900),
              Animated.timing(sp.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]),
          ]);
        })),
      ]),
    ]).start();

    // ─── Loops ───
    // Arrow chain — three chevrons cascading down (hareketli akan ok)
    const arrowChain = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(arrowAnim1, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(arrowAnim1, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(arrowAnim2, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(arrowAnim2, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(arrowAnim3, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(arrowAnim3, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    );
    arrowChain.start();

    // Shine sweep loop
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(shineAnim, { toValue: W, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(shineAnim, { toValue: -W, duration: 0, useNativeDriver: true }),
      ]),
    );
    shineLoop.start();

    // ─── Auto-dismiss timer (10 saniye) — kullanıcı tıklamasa da kapanır ───
    const autoDismiss = setTimeout(() => {
      onDismiss();
    }, 10000);

    return () => {
      arrowChain.stop();
      shineLoop.stop();
      clearTimeout(autoDismiss);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      {/* Backdrop — tap to dismiss; pointer-events normal (üzerine tıklayan butona değil backdrop'a değer) */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.45)' }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      </Animated.View>

      {/* ─── Arrow chain + tooltip (CTA'nın altında, ok yukarı bakar) ─── */}
      <View
        pointerEvents="box-none"
        style={[
          styles.coachWrap,
          { top: ctaTopOffset + 8 }, // CTA'nın hemen altında, biraz boşluk
        ]}
      >
        {/* ─── Arrow chain (3 chevron-up, cascading bounce — yukarı doğru akar) ─── */}
        <View style={styles.arrowWrap} pointerEvents="none">
          {[arrowAnim3, arrowAnim2, arrowAnim1].map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.arrow,
                { top: i * 14 }, // 3 chevron'un dikey aralığı
                {
                  opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] }),
                  transform: [
                    // Yukarı doğru hareket: alttan başlayıp yukarı kaydırma
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, -4] }) },
                    { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] }) },
                  ],
                },
              ]}
            >
              <Ionicons name="chevron-up" size={32} color="#FFD700" style={arrowShadow} />
            </Animated.View>
          ))}

          {/* Sparkles — yelpaze (yukarı doğru CTA'ya doğru) */}
          {sparkles.map((sp, i) => (
            <Animated.View
              key={`spark_${i}`}
              style={[
                styles.sparkle,
                {
                  opacity: sp.opacity,
                  transform: [
                    { translateX: sp.x },
                    { translateY: sp.y },
                    { scale: sp.scale },
                  ],
                },
              ]}
            >
              <Ionicons name="sparkles" size={11} color={i % 2 === 0 ? '#FFD700' : '#FFE082'} />
            </Animated.View>
          ))}
        </View>

        {/* Premium tooltip card (arrow'un altında) */}
        <Animated.View
          style={[
            styles.tooltip,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardY }],
            },
          ]}
        >
          <LinearGradient
            colors={['#5a3a10', '#2a1a08', '#080403']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(255,215,130,0.95)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.tooltipTopEdge}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.18)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Shine sweep */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shineBand,
              { transform: [{ translateX: shineAnim }, { skewX: '-15deg' }] },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          <View style={styles.tooltipContent}>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark-circle" size={22} color="#FFD700" style={iconShadow} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tooltipBody}>
                Yukarıdaki <Text style={styles.tooltipHighlight}>{i18n.t('createroomcoachmark.001')}</Text> butonuna dokun ve ilk odanı aç.
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

const arrowShadow = {
  textShadowColor: 'rgba(255,215,0,0.85)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 12,
} as const;

const styles = StyleSheet.create({
  coachWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  tooltip: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
    borderColor: Platform.OS === 'android' ? 'rgba(255,224,130,0.9)' : 'rgba(255,224,130,0.65)',
    ...Platform.select({
      ios: {
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  tooltipTopEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.6,
  },
  shineBand: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 80,
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,215,0,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,224,130,0.6)',
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFE082',
    letterSpacing: 0.3,
    marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tooltipBody: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 240, 200, 0.82)',
    lineHeight: 16,
  },
  tooltipHighlight: {
    color: '#FFD700',
    fontWeight: '900',
  },
  arrowWrap: {
    height: 64,
    width: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 6,
  },
  arrow: {
    position: 'absolute',
  },
  sparkle: {
    position: 'absolute',
    top: 30,
  },
});
