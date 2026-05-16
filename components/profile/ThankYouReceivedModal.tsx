// SopranoChat — Teşekkür Alındı Modalı (2026-04-24)
// ═══════════════════════════════════════════════════════════════════
// SP bağışı yaptığın biri sana teşekkür ettiğinde gösterilir.
// Glassmorphic teal-yeşil tema, animasyonlu giriş, 4sn auto-dismiss.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { i18n } from '../../services/i18n';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlowView } from '../skia';
import { Image } from 'react-native';
import { getAvatarSource } from '../../constants/avatars';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  senderName: string;     // Teşekkür eden kişi
  senderAvatar?: string;
  emoji?: string;         // Seçtiği emoji (🙏, ❤️, vb.)
  message?: string;       // "Teşekkürler", "Sağol" vb.
  onClose: () => void;
}

export default function ThankYouReceivedModal({
  visible, senderName, senderAvatar, emoji = '🙏', message, onClose,
}: Props) {
  // ★ Swipe-to-dismiss — aşağı sürükle kapat
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(panY, { toValue: H, duration: 200, useNativeDriver: true }).start(() => {
            panY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) panY.setValue(0);
  }, [visible]);

  // Animasyonlar
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const emojiRotate = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(12)).current;
  const glowPulse = useRef(new Animated.Value(1)).current;
  // Sparkle particles
  const sparkles = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    backdropOpacity.setValue(0);
    cardScale.setValue(0.8);
    cardOpacity.setValue(0);
    emojiScale.setValue(0);
    emojiRotate.setValue(0);
    checkScale.setValue(0);
    textOpacity.setValue(0);
    textTranslateY.setValue(12);
    glowPulse.setValue(1);
    sparkles.forEach(s => {
      s.x.setValue(0); s.y.setValue(0);
      s.opacity.setValue(0); s.scale.setValue(0);
    });

    // ACT 1: Backdrop + card entry (0-350ms)
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    // ACT 2: Emoji bounce + rotate (300ms+)
    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.spring(emojiScale, { toValue: 1, tension: 180, friction: 5, useNativeDriver: true }),
        Animated.timing(emojiRotate, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]),
    ]).start();

    // ACT 3: Sparkle burst (500ms+)
    Animated.sequence([
      Animated.delay(400),
      Animated.stagger(50, sparkles.map((sp, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 55 + Math.random() * 25;
        return Animated.parallel([
          Animated.timing(sp.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.spring(sp.scale, { toValue: 1, tension: 140, friction: 5, useNativeDriver: true }),
          Animated.timing(sp.x, { toValue: Math.cos(angle) * dist, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(sp.y, { toValue: Math.sin(angle) * dist, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]);
      })),
    ]).start(() => {
      // Fade out sparkles
      Animated.stagger(40, sparkles.map(sp =>
        Animated.timing(sp.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      )).start();
    });

    // ACT 4: Check mark (700ms+)
    Animated.sequence([
      Animated.delay(650),
      Animated.spring(checkScale, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
    ]).start();

    // ACT 5: Text fade in (800ms+)
    Animated.sequence([
      Animated.delay(750),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // Glow pulse loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    // Auto-dismiss — 4sn
    const t = setTimeout(onClose, 4000);
    return () => {
      clearTimeout(t);
      glowLoop.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const rotate = emojiRotate.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.75)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={s.center} pointerEvents="box-none">
        {/* Card — swipe-to-dismiss + entry animation. Animated outer + GlowView inner = Skia teal glow. */}
        <Animated.View
          style={{ opacity: cardOpacity, transform: [{ scale: cardScale }, { translateY: panY }] }}
          {...panResponder.panHandlers}
        >
        <GlowView style={s.card}>
          {/* Background layers */}
          <LinearGradient
            colors={['#1a2e2a', '#0f1f1c', '#091412']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(20,184,166,0.2)', 'rgba(20,184,166,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(34,197,94,0.7)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* Header */}
          <Text style={s.headerText}>{i18n.t('profile.thankyoureceivedmodal.001')}</Text>

          {/* Emoji hero + sparkles */}
          <View style={s.emojiSection}>
            {/* Glow ring — Animated split (outer transform, inner GlowView teal glow scales with ring) */}
            <Animated.View style={{ position: 'absolute', transform: [{ scale: glowPulse }] }} pointerEvents="none">
              <GlowView style={s.glowRing} />
            </Animated.View>
            {/* Emoji wrap — Animated split (outer scale + rotate, inner GlowView green glow scales with emoji) */}
            <Animated.View style={{ transform: [{ scale: emojiScale }, { rotate }] }}>
              <GlowView style={s.emojiWrap}>
                <LinearGradient
                  colors={['rgba(34,197,94,0.3)', 'rgba(20,184,166,0.2)', 'rgba(20,184,166,0.1)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.emojiGrad}
                >
                  <Text style={s.heroEmoji}>{emoji}</Text>
                </LinearGradient>
              </GlowView>
            </Animated.View>

            {/* Sparkles */}
            {sparkles.map((sp, i) => (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  opacity: sp.opacity,
                  transform: [
                    { translateX: sp.x },
                    { translateY: sp.y },
                    { scale: sp.scale },
                  ],
                }}
              >
                <Text style={{ fontSize: 14 }}>{['✨', '💚', '⭐', '🌟'][i % 4]}</Text>
              </Animated.View>
            ))}

            {/* Check badge */}
            <Animated.View style={[s.checkBadge, { transform: [{ scale: checkScale }] }]}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" style={s.checkIcon} />
            </Animated.View>
          </View>

          {/* Sender info */}
          <Animated.View style={[s.senderBlock, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
            <View style={s.senderRow}>
              {senderAvatar && (
                <Image source={getAvatarSource(senderAvatar)} style={s.senderAvatar} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.senderName} numberOfLines={1}>{senderName}</Text>
                <Text style={s.senderLabel}>{i18n.t('profile.thankyoureceivedmodal.002')}</Text>
              </View>
            </View>
            {message && (
              <View style={s.messageBox}>
                <Text style={s.messageEmoji}>{emoji}</Text>
                <Text style={s.messageText}>"{message}"</Text>
              </View>
            )}
          </Animated.View>

          {/* Close button */}
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={16} color="rgba(20,184,166,0.7)" />
          </Pressable>
        </GlowView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  card: {
    width: W * 0.85, maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.35)',
    overflow: 'hidden',
    paddingVertical: 22, paddingHorizontal: 20,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 20,
    elevation: 20,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  headerText: {
    fontSize: 12, fontWeight: '900', color: '#14B8A6',
    letterSpacing: 2, textAlign: 'center', marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  emojiSection: {
    alignItems: 'center', justifyContent: 'center',
    height: 120, marginVertical: 8,
  },
  glowRing: {
    position: 'absolute',
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2, borderColor: 'rgba(20,184,166,0.25)',
    // ★ v92.23 (1 May 2026): Android elevation eklendi
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16,
    elevation: 10,
  },
  emojiWrap: {
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 14,
    elevation: 16,
  },
  emojiGrad: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
  },
  heroEmoji: { fontSize: 40 },
  checkBadge: {
    position: 'absolute', bottom: 2, right: W * 0.5 - 80,
    backgroundColor: '#091412',
    borderRadius: 14,
    padding: 2,
  },
  checkIcon: {
    textShadowColor: 'rgba(34,197,94,0.8)',
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  senderBlock: {
    marginTop: 4,
  },
  senderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
  },
  senderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.35)',
  },
  senderName: {
    fontSize: 14, fontWeight: '800', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  senderLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(20,184,166,0.7)',
    marginTop: 1,
  },
  messageBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  messageEmoji: { fontSize: 18 },
  messageText: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
  },
  closeBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.1)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
});
