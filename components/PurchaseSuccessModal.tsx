// SopranoChat — Satın Alma Başarı Pop'u (v109.3)
// ════════════════════════════════════════════════════════════════════
// Modal yerine TOAST-STYLE POP. Backdrop yok — ekran ortasında çıkar,
// auto-dismiss eder, kullanıcı altta etkileşime devam edebilir.
// Applied-clean.json (beyaz BG layer'ı çıkarılmış) Lottie ile tik animasyonu.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');

let LottieView: any = null;
let APPLIED_LOTTIE: any = null;
try {
  LottieView = require('lottie-react-native').default;
  // ★ v109.3: BG layer'ı çıkarılmış temiz versiyon (şeffaf zemin)
  APPLIED_LOTTIE = require('../assets/Applied-clean.json');
} catch { /* fallback to Ionicons checkmark */ }

interface Props {
  visible: boolean;
  /** Büyük başlık örn. "Pro Üyelik Satın Alındı" */
  title: string;
  /** Alt satır örn. "Pro üyelik onaylandı" */
  subtitle?: string;
  /** Aksent rengi — tier/rarity'e göre */
  accent?: readonly [string, string];
  /** Auto-dismiss süresi (ms). Default 4000 — Lottie tik animasyonu ~2.2s,
   *  ardından kullanıcının başlık+alt metni rahat okuyup ürünün kazanıldığını
   *  hissetmesi için ~1.8s nefes payı. Çok hızlı kapanma "ne oldu?" hissini
   *  bırakıyor; bu süre kutlama anının değerini artırıyor. */
  autoHideMs?: number;
  onClose: () => void;
}

export default function PurchaseSuccessModal({
  visible,
  title,
  subtitle,
  accent = ['#14B8A6', '#0E7490'] as const,
  autoHideMs = 4000,
  onClose,
}: Props) {
  const cardScale = useRef(new Animated.Value(0.6)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      cardScale.setValue(0.6);
      cardOpacity.setValue(0);
      textOpacity.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 220 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.sequence([
        Animated.delay(360),
        Animated.timing(textOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();

    lottieRef.current?.reset?.();
    lottieRef.current?.play?.();

    const t = setTimeout(() => onClose(), autoHideMs);
    return () => clearTimeout(t);
  }, [visible, autoHideMs]);

  if (!visible) return null;

  return (
    <View style={s.overlay} pointerEvents="box-none">
      {/* ★ Tap-to-dismiss alt katman (önce render → en altta) */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Kapat"
      />
      <Animated.View
        style={[
          s.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
            borderColor: accent[0] + '99',
            ...Platform.select({
              ios: {
                shadowColor: accent[0],
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.55, shadowRadius: 26,
              },
              android: { elevation: 20 },
            }),
          },
        ]}
      >
        <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.96)', 'rgba(12,22,40,0.98)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Aksent halo top */}
        <LinearGradient
          colors={[accent[0] + '55', accent[0] + '08', 'transparent'] as [string, string, string]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
          style={[StyleSheet.absoluteFillObject, { height: 100 }] as any}
          pointerEvents="none"
        />

        {/* Tik animasyonu — temiz Lottie veya fallback */}
        <View style={s.tickWrap}>
          {LottieView && APPLIED_LOTTIE ? (
            <LottieView
              ref={lottieRef}
              source={APPLIED_LOTTIE}
              autoPlay
              loop={false}
              resizeMode="contain"
              style={{ width: 130, height: 130 }}
            />
          ) : (
            <View style={[s.fallbackBadge, { backgroundColor: accent[0] + '22', borderColor: accent[0] }]}>
              <Ionicons name="checkmark" size={56} color={accent[0]} />
            </View>
          )}
        </View>

        {/* Metin */}
        <Animated.View style={[s.textWrap, { opacity: textOpacity }]}>
          <Text style={s.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    width: Math.min(W * 0.78, 320),
    paddingTop: 14, paddingBottom: 18, paddingHorizontal: 20,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
  },
  tickWrap: {
    width: 130, height: 130,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  fallbackBadge: {
    width: 86, height: 86, borderRadius: 43,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  textWrap: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 16, fontWeight: '800',
    color: '#F1F5F9',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 17,
  },
});
