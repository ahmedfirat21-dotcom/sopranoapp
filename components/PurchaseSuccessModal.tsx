// SopranoChat — Satın Alma Başarı Modalı
// Tam ekran kutlama: animasyonlu tik + sparkle + glow + auto-dismiss.
// Plus/Pro üyelik, SP paket gibi satın alma sonrası toast yerine bu kullanılır.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';

const { width: W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  /** Büyük başlık örn. "Pro Üyelik Aktif!" */
  title: string;
  /** Alt satır açıklaması örn. "Tebrikler, tüm premium özellikler açıldı." */
  subtitle?: string;
  /** Tik dairesinin gradient renkleri — tier/contexte göre */
  accent?: readonly [string, string];
  /** Kendi kendine kapanma süresi ms (default 2800) */
  autoHideMs?: number;
  onClose: () => void;
}

export default function PurchaseSuccessModal({
  visible,
  title,
  subtitle,
  accent = ['#14B8A6', '#0E7490'] as const,
  autoHideMs = 2800,
  onClose,
}: Props) {
  // Ana badge scale (spring pop)
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeRotate = useRef(new Animated.Value(0)).current;
  // Checkmark (scale + draw-in fade)
  const tickScale = useRef(new Animated.Value(0)).current;
  const tickOpacity = useRef(new Animated.Value(0)).current;
  // Glow pulse ring
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  // Text fade-up
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(14)).current;
  // Sparkles — 8 adet radial
  const sparkles = useRef(
    Array.from({ length: 8 }, () => ({
      scale: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    badgeScale.setValue(0);
    badgeRotate.setValue(0);
    tickScale.setValue(0);
    tickOpacity.setValue(0);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0);
    textOpacity.setValue(0);
    textTranslateY.setValue(14);
    sparkles.forEach(s => {
      s.scale.setValue(0);
      s.translateX.setValue(0);
      s.translateY.setValue(0);
      s.opacity.setValue(0);
    });

    // Sequence: 1) badge pop + ring 2) tick draw 3) sparkles 4) text
    Animated.parallel([
      // Badge spring-pop
      Animated.spring(badgeScale, {
        toValue: 1, tension: 80, friction: 6, useNativeDriver: true,
      }),
      // Badge slight wiggle
      Animated.sequence([
        Animated.timing(badgeRotate, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(badgeRotate, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
      // Ring pulse — 2 tekrar
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale, { toValue: 1.5, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(ringOpacity, { toValue: 0.5, duration: 160, useNativeDriver: true }),
              Animated.timing(ringOpacity, { toValue: 0, duration: 940, useNativeDriver: true }),
            ]),
          ]),
          Animated.timing(ringScale, { toValue: 0.6, duration: 1, useNativeDriver: true }),
        ]),
        { iterations: 2 }
      ),
      // Tick — badge pop sonrası delayed
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.spring(tickScale, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
          Animated.timing(tickOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]),
      ]),
      // Sparkles — radial out
      ...sparkles.map((s, i) => {
        const angle = (i / sparkles.length) * Math.PI * 2;
        const radius = 60 + Math.random() * 20;
        const tx = Math.cos(angle) * radius;
        const ty = Math.sin(angle) * radius;
        return Animated.sequence([
          Animated.delay(320 + i * 30),
          Animated.parallel([
            Animated.timing(s.scale, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(s.translateX, { toValue: tx, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(s.translateY, { toValue: ty, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(s.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.delay(250),
              Animated.timing(s.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
          ]),
        ]);
      }),
      // Text
      Animated.sequence([
        Animated.delay(360),
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(textTranslateY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    // Auto-dismiss
    const t = setTimeout(() => onClose(), autoHideMs);
    return () => clearTimeout(t);
  }, [visible]);

  const { translateValue: swipeTranslate, panHandlers } = useSwipeToDismiss({
    direction: 'down',
    threshold: 70,
    onDismiss: onClose,
  });

  if (!visible) return null;

  const badgeRot = badgeRotate.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.content, { transform: [{ translateY: swipeTranslate }] }]} {...panHandlers}>
        {/* Pulse ring */}
        <Animated.View style={[styles.glowRing, {
          borderColor: accent[0],
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }]} />

        {/* Sparkles */}
        {sparkles.map((s, i) => (
          <Animated.View key={i} style={[styles.sparkle, {
            opacity: s.opacity,
            transform: [
              { translateX: s.translateX },
              { translateY: s.translateY },
              { scale: s.scale },
            ],
          }]}>
            <Ionicons name="star" size={11} color={accent[0]} />
          </Animated.View>
        ))}

        {/* Badge with check */}
        <Animated.View style={{
          transform: [{ scale: badgeScale }, { rotate: badgeRot }],
        }}>
          <LinearGradient
            colors={accent as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Animated.View style={{ transform: [{ scale: tickScale }], opacity: tickOpacity }}>
              <Ionicons name="checkmark" size={68} color="#fff" style={styles.tickIcon} />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[styles.textWrap, {
          opacity: textOpacity,
          transform: [{ translateY: textTranslateY }],
        }]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const BADGE_SIZE = 128;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,10,18,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 3,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
  },
  tickIcon: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  sparkle: {
    position: 'absolute',
  },
  textWrap: {
    marginTop: 26,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F1F5F9',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 19,
    maxWidth: W * 0.78,
  },
});
