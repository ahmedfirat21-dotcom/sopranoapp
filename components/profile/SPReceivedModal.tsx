// SopranoChat — SP Alındı Modalı
// Biri SP bağışladığında alıcıya gösterilir.
// - Altın düşen diamond animasyonu
// - Gönderenin adı + avatar
// - Ücretsiz teşekkür butonları (emoji reaction — sadece notification, SP kosttaki)

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../constants/supabase';
import { getAvatarSource } from '../../constants/avatars';
import { Image } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Hızlı teşekkür seçenekleri — ücretsiz, sadece notification döner
const THANK_YOU_REPLIES = [
  { emoji: '🙏', label: 'Teşekkürler' },
  { emoji: '❤️', label: 'Sağol' },
  { emoji: '🎉', label: 'Harika' },
  { emoji: '😊', label: 'Mutlu oldum' },
  { emoji: '🌹', label: 'Çok naziksin' },
  { emoji: '✨', label: 'İyisin' },
];

interface Props {
  visible: boolean;
  amount: number;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  onClose: () => void;
}

export default function SPReceivedModal({
  visible, amount, senderId, senderName, senderAvatar, recipientId, onClose,
}: Props) {
  const [thanked, setThanked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Animasyonlar
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  // Diamond bounce
  const diamondY = useRef(new Animated.Value(-80)).current;
  const diamondRotate = useRef(new Animated.Value(0)).current;
  const diamondScale = useRef(new Animated.Value(0)).current;
  // Amount count-up
  const countAnim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  // Glow pulse
  const glowPulse = useRef(new Animated.Value(1)).current;
  // Confetti
  const confetti = useRef(
    Array.from({ length: 10 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rot: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    backdropOpacity.setValue(0);
    cardScale.setValue(0.85);
    cardOpacity.setValue(0);
    diamondY.setValue(-80);
    diamondRotate.setValue(0);
    diamondScale.setValue(0);
    countAnim.setValue(0);
    setDisplay(0);
    setThanked(null);
    setSending(false);
    confetti.forEach(c => {
      c.x.setValue(0);
      c.y.setValue(-20);
      c.rot.setValue(0);
      c.opacity.setValue(0);
    });

    const listener = countAnim.addListener(({ value }) => setDisplay(Math.floor(value)));

    Animated.sequence([
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        // Diamond düşüyor + dönüyor
        Animated.spring(diamondY, { toValue: 0, tension: 100, friction: 6, useNativeDriver: true }),
        Animated.spring(diamondScale, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
        Animated.timing(diamondRotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        // Count-up
        Animated.timing(countAnim, { toValue: amount, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        // Confetti
        Animated.stagger(60, confetti.map((c, i) => {
          const dir = i % 2 === 0 ? 1 : -1;
          const distX = (40 + Math.random() * 60) * dir;
          const distY = 120 + Math.random() * 80;
          return Animated.parallel([
            Animated.timing(c.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(c.x, { toValue: distX, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(c.y, { toValue: distY, duration: 1200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(c.rot, { toValue: (Math.random() * 4) - 2, duration: 1200, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(800),
              Animated.timing(c.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
          ]);
        })),
      ]),
    ]).start();

    // Glow pulse loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    return () => {
      countAnim.removeListener(listener);
      glowLoop.stop();
    };
  }, [visible, amount]);

  const handleThankYou = async (reply: { emoji: string; label: string }) => {
    if (sending || thanked) return;
    setSending(true);
    setThanked(reply.emoji);
    try {
      // Ücretsiz: sadece notification insert — SP harcanmaz
      await supabase.from('notifications').insert({
        user_id: senderId,
        sender_id: recipientId,
        type: 'thank_you',
        body: `${reply.emoji} ${reply.label}`,
        reference_id: null,
      });
    } catch {}
    setSending(false);
    // 1.2s sonra kapanır
    setTimeout(onClose, 1200);
  };

  if (!visible) return null;

  const rotate = diamondRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={s.center} pointerEvents="box-none">
        {/* Confetti */}
        {confetti.map((c, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              s.confetti,
              {
                opacity: c.opacity,
                transform: [
                  { translateX: c.x },
                  { translateY: c.y },
                  { rotate: c.rot.interpolate({ inputRange: [-1, 1], outputRange: ['-180deg', '180deg'] }) },
                ],
              },
            ]}
          >
            <Text style={{ fontSize: 20 }}>{['💎', '⭐', '✨', '🎉'][i % 4]}</Text>
          </Animated.View>
        ))}

        {/* Card */}
        <Animated.View
          style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
          pointerEvents="auto"
        >
          {/* Altın zemin katmanları */}
          <LinearGradient
            colors={['#2a1e14', '#17100a', '#0a0604']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.3)', 'rgba(251,191,36,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.9)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* Header — "SP Bağış Aldın!" */}
          <Text style={s.headerText}>🎁 SP ALDIN!</Text>

          {/* Diamond + glow */}
          <View style={s.diamondSection}>
            <Animated.View
              style={[s.glowRing, { transform: [{ scale: glowPulse }] }]}
              pointerEvents="none"
            />
            <Animated.View
              style={[s.diamondWrap, {
                transform: [{ translateY: diamondY }, { scale: diamondScale }, { rotate }],
              }]}
            >
              <LinearGradient
                colors={['#FFE082', '#FBBF24', '#D97706']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.diamondGrad}
              >
                <Ionicons name="diamond" size={44} color="#FFF" style={s.diamondIcon} />
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Amount */}
          <View style={s.amountRow}>
            <Text style={s.amountValue}>{display.toLocaleString('tr-TR')}</Text>
            <Text style={s.amountLabel}>SP</Text>
          </View>

          {/* Sender info */}
          <View style={s.senderRow}>
            {senderAvatar && (
              <Image source={getAvatarSource(senderAvatar)} style={s.senderAvatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.senderLabel}>Gönderen</Text>
              <Text style={s.senderName} numberOfLines={1}>{senderName}</Text>
            </View>
          </View>

          {/* Thank-you replies */}
          {thanked ? (
            <View style={s.thankedBox}>
              <Text style={s.thankedEmoji}>{thanked}</Text>
              <Text style={s.thankedText}>Teşekkürün iletildi</Text>
            </View>
          ) : (
            <>
              <Text style={s.repliesLabel}>Ücretsiz teşekkür et:</Text>
              <View style={s.repliesGrid}>
                {THANK_YOU_REPLIES.map(r => (
                  <Pressable
                    key={r.emoji}
                    style={({ pressed }) => [s.replyBtn, pressed && s.replyBtnPressed]}
                    onPress={() => handleThankYou(r)}
                    disabled={sending}
                  >
                    <Text style={s.replyEmoji}>{r.emoji}</Text>
                    <Text style={s.replyLabel}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* Close */}
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={16} color="rgba(251,191,36,0.8)" style={s.closeIcon} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  confetti: {
    position: 'absolute',
    zIndex: 100,
  },
  card: {
    width: W * 0.88, maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.4)',
    overflow: 'hidden',
    paddingVertical: 22, paddingHorizontal: 20,
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 24,
    elevation: 24,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  headerText: {
    fontSize: 13, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 2, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  diamondSection: {
    alignItems: 'center', justifyContent: 'center',
    height: 130, marginVertical: 10,
  },
  glowRing: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, borderColor: 'rgba(251,191,36,0.3)',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20,
  },
  diamondWrap: {
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9, shadowRadius: 16,
    elevation: 20,
  },
  diamondGrad: {
    width: 92, height: 92, borderRadius: 46,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  diamondIcon: {
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 5,
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5,
    marginTop: 4,
  },
  amountValue: {
    fontSize: 44, fontWeight: '900', color: '#FFD700',
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8,
  },
  amountLabel: {
    fontSize: 18, fontWeight: '800', color: 'rgba(251,191,36,0.75)',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  senderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 14, marginBottom: 16,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  senderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)',
  },
  senderLabel: {
    fontSize: 9, fontWeight: '700', color: 'rgba(251,191,36,0.55)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  senderName: {
    fontSize: 14, fontWeight: '800', color: '#F1F5F9',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  repliesLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(251,191,36,0.65)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
    textAlign: 'center',
  },
  repliesGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    justifyContent: 'center',
  },
  replyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.22)',
  },
  replyBtnPressed: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.5)',
    transform: [{ scale: 0.95 }],
  },
  replyEmoji: { fontSize: 14 },
  replyLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.2,
  },
  thankedBox: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 4,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  thankedEmoji: { fontSize: 32 },
  thankedText: {
    fontSize: 12, fontWeight: '700', color: '#22C55E',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  closeBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: {
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
