// SopranoChat — SP Gönderme Başarı Modalı
// Tam ekran altın premium kutlama: parlayan diamond + sparkle + count-up + auto-dismiss.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  amount: number;
  recipientName: string;
  onClose: () => void;
}

export default function SPSentSuccessModal({ visible, amount, recipientName, onClose }: Props) {
  // Ana diamond scale (spring pop)
  const diamondScale = useRef(new Animated.Value(0)).current;
  const diamondRotate = useRef(new Animated.Value(0)).current;
  // Glow ring pulse
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  // Text fade-up
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  // Sparkles — 6 adet yıldız
  const sparkles = useRef(
    Array.from({ length: 6 }, () => ({
      scale: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;
  // Count-up
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayAmount, setDisplayAmount] = React.useState(0);

  useEffect(() => {
    if (!visible) return;

    // Reset
    diamondScale.setValue(0);
    diamondRotate.setValue(0);
    ringScale.setValue(0.8);
    ringOpacity.setValue(0);
    textOpacity.setValue(0);
    textTranslateY.setValue(20);
    countAnim.setValue(0);
    setDisplayAmount(0);
    sparkles.forEach(s => {
      s.scale.setValue(0);
      s.translateX.setValue(0);
      s.translateY.setValue(0);
      s.opacity.setValue(0);
    });

    // Count-up listener
    const listener = countAnim.addListener(({ value }) => {
      setDisplayAmount(Math.floor(value));
    });

    // Ana kompozisyon
    Animated.sequence([
      // 1. Diamond pop + ring expand
      Animated.parallel([
        Animated.spring(diamondScale, { toValue: 1, tension: 140, friction: 5, useNativeDriver: true }),
        Animated.timing(diamondRotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(ringScale, { toValue: 1.5, tension: 80, friction: 7, useNativeDriver: true }),
      ]),
      // 2. Sparkles burst + text fade + count-up
      Animated.parallel([
        Animated.stagger(
          50,
          sparkles.map((s, i) => {
            const angle = (i / sparkles.length) * Math.PI * 2;
            const dist = 80 + Math.random() * 30;
            return Animated.parallel([
              Animated.timing(s.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
              Animated.spring(s.scale, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
              Animated.timing(s.translateX, {
                toValue: Math.cos(angle) * dist,
                duration: 600, easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(s.translateY, {
                toValue: Math.sin(angle) * dist,
                duration: 600, easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]);
          }),
        ),
        Animated.timing(textOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(countAnim, { toValue: amount, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
      // 3. Sparkle fade
      Animated.stagger(30, sparkles.map(s =>
        Animated.timing(s.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      )),
    ]).start();

    // Auto-dismiss
    const t = setTimeout(onClose, 2800);
    return () => {
      countAnim.removeListener(listener);
      clearTimeout(t);
    };
  }, [visible, amount]);

  if (!visible) return null;

  const rotate = diamondRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose}>
        {/* Altın radial glow arka plan */}
        <LinearGradient
          colors={['rgba(251,191,36,0.25)', 'rgba(251,191,36,0.08)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={s.center}>
          {/* Expanding ring */}
          <Animated.View
            style={[s.ring, {
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            }]}
          />

          {/* Sparkles */}
          {sparkles.map((sp, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                s.sparkle,
                {
                  opacity: sp.opacity,
                  transform: [
                    { translateX: sp.translateX },
                    { translateY: sp.translateY },
                    { scale: sp.scale },
                  ],
                },
              ]}
            >
              <Ionicons name="star" size={14 + (i % 2) * 4} color="#FFD700" style={s.sparkleIcon} />
            </Animated.View>
          ))}

          {/* Diamond */}
          <Animated.View
            style={[s.diamondWrap, { transform: [{ scale: diamondScale }, { rotate }] }]}
          >
            <LinearGradient
              colors={['#FFE082', '#FBBF24', '#D97706']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.diamondGrad}
            >
              <Ionicons name="diamond" size={54} color="#FFF" style={s.diamondIcon} />
            </LinearGradient>
          </Animated.View>

          {/* Text block */}
          <Animated.View style={{ alignItems: 'center', opacity: textOpacity, transform: [{ translateY: textTranslateY }] }}>
            <View style={s.amountRow}>
              <Text style={s.amount}>{displayAmount.toLocaleString('tr-TR')}</Text>
              <Text style={s.amountUnit}>SP</Text>
            </View>
            <Text style={s.sentText}>
              <Text style={s.recipientName}>{recipientName}</Text>
              <Text>'a gönderildi</Text>
            </Text>
            <View style={s.checkRow}>
              <Ionicons name="checkmark-circle" size={14} color="#22C55E" style={s.checkIcon} />
              <Text style={s.checkText}>Başarıyla iletildi</Text>
            </View>
          </Animated.View>

          {/* Dismiss hint */}
          <Animated.Text style={[s.hint, { opacity: textOpacity }]}>
            Kapatmak için dokun
          </Animated.Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 2, borderColor: 'rgba(251,191,36,0.4)',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 30, elevation: 10,
  },
  sparkle: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  sparkleIcon: {
    textShadowColor: '#FBBF24',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  diamondWrap: {
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 24,
    elevation: 20,
  },
  diamondGrad: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  diamondIcon: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    marginTop: 28,
  },
  amount: {
    fontSize: 56, fontWeight: '900', color: '#FFD700',
    letterSpacing: -2,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  amountUnit: {
    fontSize: 22, fontWeight: '800', color: 'rgba(251,191,36,0.75)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sentText: {
    fontSize: 14, color: 'rgba(255,255,255,0.75)',
    marginTop: 4, fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recipientName: {
    color: '#FBBF24', fontWeight: '800',
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 12,
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  checkIcon: {
    textShadowColor: 'rgba(34,197,94,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  checkText: {
    fontSize: 11, fontWeight: '700', color: '#22C55E', letterSpacing: 0.2,
  },
  hint: {
    position: 'absolute', bottom: -H * 0.25,
    fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500',
  },
});
