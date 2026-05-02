// SopranoChat — SP Alındı Modalı
// Biri SP bağışladığında alıcıya gösterilir.
// - Altın düşen diamond animasyonu
// - Gönderenin adı + avatar
// - Ücretsiz teşekkür butonları (emoji reaction — sadece notification, SP kosttaki)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SPHexagonIcon from '../SPHexagonIcon';
import { supabase } from '../../constants/supabase';
import { getAvatarSource } from '../../constants/avatars';
import { Image } from 'react-native';
import { showToast } from '../Toast';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
// ★ 2026-04-29: SP miktarına göre tier paleti — SPSentSuccess/SPDonate ile tutarlı.
import { getSPAmountTier, SP_TIER_VISUAL, SP_TIER_EMOJIS } from '../../constants/spAmountTier';

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
  /** Bağış bildirim ID — teşekkür limitini takip etmek için */
  giftNotificationId?: string;
  onClose: () => void;
}

export default function SPReceivedModal({
  visible, amount, senderId, senderName, senderAvatar, recipientId, giftNotificationId, onClose,
}: Props) {
  const [thanked, setThanked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [alreadyThanked, setAlreadyThanked] = useState(false);

  // ★ 2026-04-29: Miktara göre tier — palet/partikül/sayı bunlardan türer.
  const tier = useMemo(() => getSPAmountTier(amount), [amount]);
  const tv = SP_TIER_VISUAL[tier];
  const tierEmojis = SP_TIER_EMOJIS[tier];

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
  // Confetti — tier'a göre 8/12/16/22 partikül, max havuz 22
  const MAX_CONFETTI = 22;
  const confetti = useRef(
    Array.from({ length: MAX_CONFETTI }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rot: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;
  const activeConfettiCount = tv.particleCount;

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
    setAlreadyThanked(false);
    // ★ 2026-04-24: Daha önce teşekkür edilmiş mi kontrol et (1 hak/bağış)
    (async () => {
      try {
        const { count } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', senderId)
          .eq('sender_id', recipientId)
          .eq('type', 'thank_you')
          .eq('reference_id', giftNotificationId || '')
          .limit(1);
        if ((count ?? 0) > 0) {
          setAlreadyThanked(true);
          setThanked('✓');
        }
      } catch (e) {
        if (__DEV__) console.warn('[SPReceivedModal] thank-you check failed:', e);
      }
    })();
    confetti.forEach(c => {
      c.x.setValue(0);
      c.y.setValue(-20);
      c.rot.setValue(0);
      c.opacity.setValue(0);
    });
    // ★ tier'a göre fazlalıkları gizli tut (opacity 0 ve animate dışı)

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
        // Confetti — tier'a göre aktif sayı kadar partikül uçar
        Animated.stagger(60, confetti.slice(0, activeConfettiCount).map((c, i) => {
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
    try {
      // ★ 2026-04-21: Ücretsiz notification insert + realtime broadcast.
      //   Göndericiye gerçek zamanlı görünür hale getirmek için insert + log.
      const { error } = await supabase.from('notifications').insert({
        user_id: senderId,
        sender_id: recipientId,
        type: 'thank_you',
        body: `${reply.emoji} ${reply.label}`,
        reference_id: giftNotificationId || null,
      });
      if (error) {
        if (__DEV__) console.warn('[ThankYou] Notification insert error:', error.message, error.code);
        showToast({ title: 'İletilemedi', message: error.message || 'Teşekkür gönderilemedi, tekrar dene.', type: 'error' });
        setSending(false);
        return;
      }
      setThanked(reply.emoji);
    } catch (e: any) {
      if (__DEV__) console.warn('[ThankYou] Catch:', e);
      showToast({ title: 'Teşekkür Gönderilemedi', message: e?.message || 'Yanıtın iletilemedi.', type: 'error' });
      setSending(false);
      return;
    }
    setSending(false);
    // 1.2s sonra kapanır
    setTimeout(onClose, 1200);
  };

  const { translateValue: swipeTranslate, panHandlers } = useSwipeToDismiss({
    direction: 'down',
    threshold: 80,
    onDismiss: onClose,
  });

  if (!visible) return null;

  const rotate = diamondRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={s.center} pointerEvents="box-none">
        {/* ★ 2026-04-29 v2: Confetti kaldırıldı — DiscoverWelcome temizliği, tek hexagon hakim. */}

        {/* Card */}
        <Animated.View
          style={[
            s.card,
            { borderColor: tv.glow + '66', shadowColor: tv.glow },
            { opacity: cardOpacity, transform: [{ scale: cardScale }, { translateY: swipeTranslate }] },
          ]}
          pointerEvents="auto"
          {...panHandlers}
        >
          {/* ★ Swipe handle — görsel tutamak (pan tüm kartta aktif) */}
          <View style={s.handleWrap}>
            <View style={[s.handle, { backgroundColor: tv.glow + '80' }]} />
          </View>
          {/* ★ Tier'a göre zemin katmanları (basic teal / premium altın / elite rose / legendary mor) */}
          <LinearGradient
            colors={tv.bgGradient}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={[tv.glow + '4D', tv.glow + '14', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', tv.topEdge, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* Header — Tier label varsa onu, yoksa "SP ALDIN!" */}
          <Text style={[s.headerText, { color: tv.labelColor }]}>
            {tv.label ? `${tv.label} · SP ALDIN!` : '🎁 SP ALDIN!'}
          </Text>

          {/* Diamond + glow */}
          <View style={s.diamondSection}>
            <Animated.View
              style={[
                s.glowRing,
                { borderColor: tv.glow + '4D', shadowColor: tv.glow },
                { transform: [{ scale: glowPulse }] },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                s.diamondWrap,
                { shadowColor: tv.glow },
                { transform: [{ translateY: diamondY }, { scale: diamondScale }, { rotate }] },
              ]}
            >
              {/* ★ 2026-04-29 v2: DiscoverWelcome kalitesinde — hexagon 200 px, hakim element. */}
              <SPHexagonIcon size={200} />
            </Animated.View>
          </View>

          {/* Amount — tier rengi */}
          <View style={s.amountRow}>
            <Text style={[s.amountValue, { color: tv.glow }]}>{display.toLocaleString('tr-TR')}</Text>
            <Text style={[s.amountLabel, { color: tv.glow + 'CC' }]}>SP</Text>
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
            <Ionicons name="close" size={16} color={tv.glow + 'CC'} style={s.closeIcon} />
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
  handleWrap: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(251,191,36,0.5)',
  },
  headerText: {
    fontSize: 13, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 2, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  diamondSection: {
    alignItems: 'center', justifyContent: 'center',
    height: 220, marginVertical: 14, // ★ hexagon 200 px, container 220
  },
  glowRing: {
    position: 'absolute',
    width: 230, height: 230, borderRadius: 115, // ★ hexagon etrafı yumuşak halo
    borderWidth: 2, borderColor: 'rgba(251,191,36,0.3)',
    // ★ v92.23 (1 May 2026): Android elevation eklendi
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 28,
    elevation: 16,
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
