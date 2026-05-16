/**
 * SopranoChat — SP Gönderme Başarı Modalı (Sinematik Kutlama)
 * ═══════════════════════════════════════════════════════════════════
 * v107.8 (2 May 2026) — HTML referans bazlı SİNEMATİK kutlama.
 *
 * Sahne kronolojisi (HTML referansından birebir):
 *   0.0sn  — Modal açılır, recipient pill üstte fade-in (0.3s delay sonra)
 *   1.0sn  — Mücevher yukarıdan -360° dönerek atılır (cubic bounce)
 *   1.4sn  — Beyaz flash patlar, hexagon shockwave dışa fırlar
 *   1.5sn  — 8 konfeti her yöne fırlar (kalp, yıldız, kutlama)
 *   1.6sn  — "+X" devasa yazı patlar (letter-spacing animasyonu)
 *   1.8sn  — 10 mücevher/yıldız/kalp ekran üstünden yağar (coin shower)
 *   2.2sn  — "SOPRANO POINTS HEDİYE EDİLDİ" alt etiket
 *   2.4sn  — Mücevher idle moda geçer (breathing + ring pulse + light sweep)
 *   2.6sn  — "💝 X'e hediye gönderdin" pembe pill
 *   3.2sn  — Bakiye animasyonu (eski → yeni, count-up tween)
 *   3.5sn  — "Tamam" butonu + close X belirir
 *
 * API korundu (visible, amount, recipientName, recipientAvatar, onClose) —
 * 3 sheet (Gift/Stage/Treasury) hiçbiri dokunulmadı.
 *
 * Tier-aware: tier paleti `constants/tierColors.ts`'ten alınır, gem rengi
 * basic/premium/elite/legendary'e göre değişir.
 *
 * Android shadow:
 *   - shadowColor sadece iOS için (helper)
 *   - Glow LinearGradient katmanı (Android'de de görünür)
 *   - Text shadow renkli (Android'de çalışır)
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import SPHexagonIcon from '../SPHexagonIcon';
import { getSPAmountTier } from '../../constants/spAmountTier';
import { getAvatarSource } from '../../constants/avatars';
import { TIER_PALETTES, tierShadow } from '../../constants/tierColors';
import { supabase } from '../../constants/supabase';
// ★ v107.32: useAuth import KALDIRILDI — circular dep oluşturuyordu
//   (_layout → InRoomUserProfile → GiftSheet → SPSentSuccessModal → _layout).
//   Firebase auth doğrudan firebase config'ten alınır, cycle kırılır.
import { auth as firebaseAuth } from '../../constants/firebase';

const { width: W, height: H } = Dimensions.get('window');

const HEX_SIZE = 180;

// Konfeti emoji havuzu (rastgele seçim)
const CONFETTI_EMOJIS = ['🎉', '✨', '⭐', '💗', '💛', '🎊'];
// Coin shower emoji havuzu
const COIN_EMOJIS = ['💎', '⭐', '✨', '💗'];

interface ConfettiPiece {
  id: number;
  emoji: string;
  tx: number;       // hedef x translate
  ty: number;       // hedef y translate
  rotEnd: number;   // hedef rotate (derece)
  delay: number;    // ms
}

interface CoinPiece {
  id: number;
  emoji: string;
  startX: number;   // başlangıç x offset
  drift: number;    // dikey düşüşte yatay sapma
  spin: number;     // toplam dönüş (derece)
  delay: number;    // ms
  duration: number; // ms
}

interface Props {
  visible: boolean;
  amount: number;
  recipientName: string;
  recipientAvatar?: string;
  /** ★ v107.16: Görsel zenginlik seviyesi.
   *  - 'compact': sade kart formu (profil/DM bağlamı) → SPSentSuccessCompact'a delege edilir
   *  - 'cinematic' (default): tam sinematik sahne (oda içi gönderim/bağış)
   */
  variant?: 'compact' | 'cinematic';
  onClose: () => void;
}

export default function SPSentSuccessModal({
  visible, amount, recipientName, recipientAvatar, variant = 'cinematic', onClose,
}: Props) {
  // ★ v107.16: Compact variant ise sade kart sürümüne delege et (oda dışı bağlamlar)
  if (variant === 'compact') {
    const SPSentSuccessCompact = require('./SPSentSuccessCompact').default;
    return (
      <SPSentSuccessCompact
        visible={visible}
        amount={amount}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        onClose={onClose}
      />
    );
  }
  const tier = useMemo(() => getSPAmountTier(amount), [amount]);
  const palette = TIER_PALETTES[tier];
  // ★ v107.32: useAuth() yerine direkt Firebase auth — cycle kırma
  const firebaseUid = firebaseAuth.currentUser?.uid;

  // ── Animated values ──
  const ambientOpacity = useRef(new Animated.Value(0.7)).current;
  const recipientOpacity = useRef(new Animated.Value(0)).current;
  const recipientTranslate = useRef(new Animated.Value(-10)).current;

  // Mücevher fırlatma (1.0s'de başlar, cubic bounce)
  const gemThrowProgress = useRef(new Animated.Value(0)).current;
  // Idle mücevher (2.4s sonra)
  const gemIdle = useRef(new Animated.Value(0)).current;

  // Flash + shockwave + rings (1.4s)
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashScale = useRef(new Animated.Value(0)).current;
  const shockwaveScale = useRef(new Animated.Value(0)).current;
  const shockwaveOpacity = useRef(new Animated.Value(0)).current;
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;

  // Light sweep (2.4s sonsuz)
  const sweep = useRef(new Animated.Value(0)).current;

  // Amount patlaması (1.6s)
  const amountOpacity = useRef(new Animated.Value(0)).current;
  const amountScale = useRef(new Animated.Value(0)).current;
  const amountGlow = useRef(new Animated.Value(0)).current;

  // Stagger: label, message pill, balance, CTA
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const messageAnim = useRef(new Animated.Value(0)).current;
  const balanceAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  // Bakiye count-up tween (3.2s)
  const balanceCountAnim = useRef(new Animated.Value(0)).current;
  const [balanceBefore, setBalanceBefore] = useState<number | null>(null);

  // Konfeti & Coin shower (memoize edildi, modal her açılışta yeniden üretilir)
  const confettiPieces = useMemo<ConfettiPiece[]>(() => {
    if (!visible) return [];
    return Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      tx: (Math.random() - 0.5) * 360,
      ty: -60 - Math.random() * 120,
      rotEnd: (Math.random() - 0.5) * 720,
      delay: 1500 + i * 80,
    }));
  }, [visible, amount]);

  const coinPieces = useMemo<CoinPiece[]>(() => {
    if (!visible) return [];
    return Array.from({ length: 10 }).map((_, i) => ({
      id: i,
      emoji: COIN_EMOJIS[Math.floor(Math.random() * COIN_EMOJIS.length)],
      startX: (i / 10) * W + (Math.random() - 0.5) * 30,
      drift: (Math.random() - 0.5) * 60,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
      delay: 1800 + i * 100,
      duration: 3000 + Math.random() * 1000,
    }));
  }, [visible, amount]);

  const confettiAnims = useRef<Animated.Value[]>([]).current;
  const coinAnims = useRef<Animated.Value[]>([]).current;

  // İlk render'da Animated.Value'ları üret
  if (confettiAnims.length !== confettiPieces.length) {
    confettiAnims.length = 0;
    confettiPieces.forEach(() => confettiAnims.push(new Animated.Value(0)));
  }
  if (coinAnims.length !== coinPieces.length) {
    coinAnims.length = 0;
    coinPieces.forEach(() => coinAnims.push(new Animated.Value(0)));
  }

  // Refs for cleanup
  const idleRef = useRef<Animated.CompositeAnimation | null>(null);
  const sweepRef = useRef<Animated.CompositeAnimation | null>(null);
  const ringARef = useRef<Animated.CompositeAnimation | null>(null);
  const ringBRef = useRef<Animated.CompositeAnimation | null>(null);
  const ambientRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowRef = useRef<Animated.CompositeAnimation | null>(null);

  // Bakiye fetch (modal açılır açılmaz)
  useEffect(() => {
    if (!visible || !firebaseUid) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('system_points')
          .eq('id', firebaseUid)
          .single();
        // Modal açılınca SP zaten düşmüş optimistic ile (GiftSheet/StageSheet/TreasurySheet hepsi optimistic)
        // Yani şu anki balance = NEW. Eski = balance + amount.
        if (!cancelled) {
          const newBalance = data?.system_points ?? 0;
          setBalanceBefore(newBalance + amount);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [visible, firebaseUid, amount]);

  useEffect(() => {
    if (!visible) return;

    // Reset
    recipientOpacity.setValue(0);
    recipientTranslate.setValue(-10);
    gemThrowProgress.setValue(0);
    gemIdle.setValue(0);
    flashOpacity.setValue(0);
    flashScale.setValue(0);
    shockwaveScale.setValue(0);
    shockwaveOpacity.setValue(0);
    ringA.setValue(0);
    ringB.setValue(0);
    sweep.setValue(0);
    amountOpacity.setValue(0);
    amountScale.setValue(0);
    amountGlow.setValue(0);
    labelOpacity.setValue(0);
    messageAnim.setValue(0);
    balanceAnim.setValue(0);
    ctaAnim.setValue(0);
    balanceCountAnim.setValue(0);
    confettiAnims.forEach(a => a.setValue(0));
    coinAnims.forEach(a => a.setValue(0));

    // Ambient drift loop
    ambientRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientOpacity, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(ambientOpacity, { toValue: 0.7, duration: 2500, useNativeDriver: true }),
      ])
    );
    ambientRef.current.start();

    // 0.3s — Recipient
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(recipientOpacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(recipientTranslate, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    // 1.0s — Mücevher fırlatma (cubic bounce, 1.4s süre)
    Animated.sequence([
      Animated.delay(1000),
      Animated.timing(gemThrowProgress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2.4s'de idle başlar
      idleRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(gemIdle, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(gemIdle, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      idleRef.current.start();

      // Light sweep loop
      sweepRef.current = Animated.loop(
        Animated.timing(sweep, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      );
      sweepRef.current.start();
    });

    // 1.4s — Flash + Shockwave + Ring loops
    Animated.sequence([
      Animated.delay(1400),
      Animated.parallel([
        // Flash burst
        Animated.sequence([
          Animated.parallel([
            Animated.timing(flashOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(flashScale, { toValue: 2, duration: 200, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(flashOpacity, { toValue: 0, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(flashScale, { toValue: 4, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
        // Shockwave (bir kez)
        Animated.parallel([
          Animated.timing(shockwaveScale, { toValue: 5, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(shockwaveOpacity, { toValue: 0.9, duration: 100, useNativeDriver: true }),
            Animated.timing(shockwaveOpacity, { toValue: 0, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
      ]),
    ]).start();

    // Ring loops (1.4s'den itibaren sonsuz)
    setTimeout(() => {
      ringARef.current = Animated.loop(
        Animated.timing(ringA, { toValue: 1, duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      );
      ringARef.current.start();

      ringBRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(1000),
          Animated.timing(ringB, { toValue: 1, duration: 2000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(ringB, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      ringBRef.current.start();
    }, 1400);

    // 1.5s — Konfeti her yöne fırlar
    confettiAnims.forEach((anim, i) => {
      const piece = confettiPieces[i];
      if (!piece) return;
      Animated.sequence([
        Animated.delay(piece.delay),
        Animated.timing(anim, { toValue: 1, duration: 2800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });

    // 1.6s — Amount patlaması (scale + opacity, useNativeDriver)
    Animated.sequence([
      Animated.delay(1600),
      Animated.parallel([
        Animated.timing(amountOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(amountScale, { toValue: 1.4, duration: 400, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
          Animated.timing(amountScale, { toValue: 0.95, duration: 200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(amountScale, { toValue: 1.05, duration: 200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(amountScale, { toValue: 1, duration: 200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => {
      // Amount glow pulse loop (2.6s sonra başlar)
      glowRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(amountGlow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(amountGlow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])
      );
      glowRef.current.start();
    });

    // 1.8s — Coin shower (yağmur)
    coinAnims.forEach((anim, i) => {
      const piece = coinPieces[i];
      if (!piece) return;
      Animated.sequence([
        Animated.delay(piece.delay),
        Animated.timing(anim, { toValue: 1, duration: piece.duration, easing: Easing.linear, useNativeDriver: true }),
      ]).start();
    });

    // 2.2s — Label
    Animated.sequence([
      Animated.delay(2200),
      Animated.timing(labelOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // 2.6s — Message pill
    Animated.sequence([
      Animated.delay(2600),
      Animated.timing(messageAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // 3.2s — Balance pill + count-up
    Animated.sequence([
      Animated.delay(3200),
      Animated.parallel([
        Animated.timing(balanceAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(balanceCountAnim, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();

    // 3.5s — CTA + close X
    Animated.sequence([
      Animated.delay(3500),
      Animated.timing(ctaAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    return () => {
      idleRef.current?.stop();
      sweepRef.current?.stop();
      ringARef.current?.stop();
      ringBRef.current?.stop();
      ambientRef.current?.stop();
      glowRef.current?.stop();
    };
  }, [visible, amount, tier]);

  if (!visible) return null;

  // Mücevher fırlatma transform (gem-throw keyframe)
  // 0 → -360deg + scale 0 + translateY -200
  // 1 → 0deg + scale 1 + translateY 0 (ile bounce ara değerler)
  const gemRotate = gemThrowProgress.interpolate({
    inputRange: [0, 0.4, 0.6, 0.8, 1],
    outputRange: ['-360deg', '20deg', '-8deg', '3deg', '0deg'],
  });
  const gemScale = gemThrowProgress.interpolate({
    inputRange: [0, 0.4, 0.6, 0.8, 1],
    outputRange: [0, 1.4, 0.92, 1.05, 1],
  });
  const gemTranslateY = gemThrowProgress.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [-200, 0, 0],
  });

  // Idle (2.4s sonra) — gem-idle keyframe (translate + rotate + scale)
  const gemIdleY = gemIdle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });
  const gemIdleRot = gemIdle.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-1.5deg', '1.5deg', '-1.5deg'] });
  const gemIdleScale = gemIdle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.02, 1] });

  // Light sweep — translateX -100% → 200%
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-W, W * 1.2] });

  // Ring scale (0.4 → 2.5) + opacity (1 → 0)
  const ringAScale = ringA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.5] });
  const ringAOpacity = ringA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 0] });
  const ringBScale = ringB.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.5] });
  const ringBOpacity = ringB.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 0] });

  // Bakiye count-up (eski → yeni)
  const balanceNow = balanceBefore !== null ? balanceBefore - amount : 0;
  const animatedBalance = balanceCountAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [balanceBefore || 0, balanceNow],
  });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* ★ v107.16 SPOTLIGHT BG — Kullanıcı talebi: arka plan ŞEFFAF olmalı, merkez opak,
           kenarlara doğru transparan, geçiş yumuşak. Eski full-screen siyah kaldırıldı. */}
      <View style={st.stage}>
        {/* Hafif blur backdrop — arkadaki ekran görünür ama dikkat dağıtmaz */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: ambientOpacity }]} pointerEvents="none">
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
          {/* Hafif dim — arka plan tamamen görünmez olmasın */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        </Animated.View>

        {/* ★ v107.17: Spotlight halo KALDIRILDI — borderRadius'lı circle View içindeki
             LinearGradient diagonal olduğu için belirgin çizgi gibi görünüyordu.
             Backdrop blur+dim zaten yumuşak arka plan sağlıyor; hexagon zaten kendi
             rich glow'unu üretiyor (drop-shadow), ekstra halo gereksiz. */}

        {/* Tap-to-close (recipient kart üstüne basılırsa kapatma) */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        {/* Top status (status bar boşluğu için) */}
        <View style={st.topStatus} />

        {/* Close X — 3.5s'de görünür */}
        <Animated.View style={[st.closeBtn, { opacity: ctaAnim }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <View style={st.closeBtnInner}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </Pressable>
        </Animated.View>

        {/* Recipient pill — üstte, 0.3s fade-in */}
        <Animated.View
          style={[
            st.recipientBlock,
            {
              opacity: recipientOpacity,
              transform: [{ translateY: recipientTranslate }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[st.recipientLabel, { color: palette.accent + 'AA' }]}>
            SP HEDİYE EDİLEN KİŞİ
          </Text>
          <View style={[st.recipientCard, { borderColor: palette.accent + '40' }]}>
            {recipientAvatar ? (
              <Image
                source={getAvatarSource(recipientAvatar)}
                style={[st.recipientAvatar, { borderColor: palette.accent + '88' }]}
              />
            ) : (
              <View style={[st.recipientAvatar, { backgroundColor: palette.accent + '40', borderColor: palette.accent + '88', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>{recipientName.charAt(0)}</Text>
              </View>
            )}
            <Text style={st.recipientName} numberOfLines={1}>{recipientName}</Text>
          </View>
        </Animated.View>

        {/* Coin shower — üstten aşağı, tier renkleriyle */}
        <View style={st.coinLayer} pointerEvents="none">
          {coinPieces.map((p, i) => {
            const anim = coinAnims[i];
            if (!anim) return null;
            const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [-60, H + 60] });
            const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [p.startX, p.startX + p.drift] });
            const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
            const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });
            return (
              <Animated.Text
                key={p.id}
                style={[
                  st.coinPiece,
                  {
                    opacity,
                    transform: [{ translateX: tx }, { translateY: ty }, { rotate }],
                  },
                ]}
                allowFontScaling={false}
              >
                {p.emoji}
              </Animated.Text>
            );
          })}
        </View>

        {/* Center stage — gem + flash + shockwave + rings */}
        <View style={st.centerStageWrap} pointerEvents="none">
          <View style={st.gemStage}>
            {/* Beyaz flash burst */}
            <Animated.View
              style={[
                st.flash,
                {
                  opacity: flashOpacity,
                  transform: [{ scale: flashScale }],
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.95)', palette.accent + '80', 'transparent']}
                start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
                style={st.flashGrad}
              />
            </Animated.View>

            {/* Ring A — sonsuz dışa pulse */}
            <Animated.View
              style={[
                st.ringWrap,
                {
                  opacity: ringAOpacity,
                  transform: [{ scale: ringAScale }],
                  borderColor: palette.accent,
                },
              ]}
            />
            {/* Ring B — gecikmeli */}
            <Animated.View
              style={[
                st.ringWrap,
                {
                  opacity: ringBOpacity,
                  transform: [{ scale: ringBScale }],
                  borderColor: palette.fillGrad[2],
                },
              ]}
            />

            {/* Shockwave — bir kez (1.4s) */}
            <Animated.View
              style={[
                st.ringWrap,
                {
                  opacity: shockwaveOpacity,
                  transform: [{ scale: shockwaveScale }],
                  borderColor: '#FFFFFF',
                  borderWidth: 3,
                },
              ]}
            />

            {/* Gem — fırlatma + idle */}
            <Animated.View
              style={[
                st.gemWrap,
                {
                  transform: [
                    { translateY: Animated.add(gemTranslateY, gemIdleY) },
                    { rotate: gemRotate },
                    { scale: Animated.multiply(gemScale, gemIdleScale) },
                  ],
                },
                tierShadow(palette.accent),
              ]}
            >
              <SPHexagonIcon size={HEX_SIZE} tier={tier as any} rich />
              {/* Light sweep — gem üzerinde geçen ışık */}
              <Animated.View
                style={[
                  st.sweep,
                  { transform: [{ translateX: sweepX }, { skewX: '-25deg' }] },
                ]}
                pointerEvents="none"
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.7)', 'transparent']}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={st.sweepGrad}
                />
              </Animated.View>
              {/* Idle rotate apply */}
              <Animated.View
                style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: gemIdleRot }] }]}
                pointerEvents="none"
              />
            </Animated.View>
          </View>
        </View>

        {/* Konfeti — center'dan her yöne */}
        <View style={st.confettiLayer} pointerEvents="none">
          {confettiPieces.map((p, i) => {
            const anim = confettiAnims[i];
            if (!anim) return null;
            const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.tx] });
            const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.ty] });
            const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotEnd}deg`] });
            const scale = anim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0.4] });
            const opacity = anim.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] });
            return (
              <Animated.Text
                key={p.id}
                style={[
                  st.confettiPiece,
                  {
                    opacity,
                    transform: [{ translateX: tx }, { translateY: ty }, { rotate }, { scale }],
                  },
                ]}
                allowFontScaling={false}
              >
                {p.emoji}
              </Animated.Text>
            );
          })}
        </View>

        {/* Amount block — büyük rakam + label + message + balance */}
        <View style={st.amountBlock} pointerEvents="none">
          {/* +X devasa rakam */}
          <Animated.View
            style={{
              opacity: amountOpacity,
              transform: [{ scale: amountScale }],
            }}
          >
            <Animated.Text
              style={[
                st.amountNum,
                {
                  color: palette.amountText,
                  textShadowColor: palette.accent + 'CC',
                  textShadowRadius: amountGlow.interpolate({ inputRange: [0, 1], outputRange: [25, 50] }),
                },
              ]}
              allowFontScaling={false}
            >
              +{amount.toLocaleString('tr-TR')}
            </Animated.Text>
          </Animated.View>

          {/* SOPRANO POINTS HEDİYE EDİLDİ */}
          <Animated.Text
            style={[
              st.amountUnit,
              { color: palette.accent, opacity: labelOpacity },
            ]}
            allowFontScaling={false}
          >
            SOPRANO POINTS HEDİYE EDİLDİ
          </Animated.Text>

          {/* Pembe message pill — "💝 X'e hediye gönderdin" */}
          <Animated.View
            style={[
              st.messagePill,
              {
                opacity: messageAnim,
                transform: [{ translateY: messageAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
              },
            ]}
          >
            <Text style={st.messageEmoji} allowFontScaling={false}>💝</Text>
            <Text style={st.messageText}>
              <Text style={st.messageStrong}>{recipientName}</Text>
              <Text>{i18n.t('profile.spsentsuccessmodal.001')}</Text>
            </Text>
          </Animated.View>

          {/* Bakiye değişimi — eski → yeni */}
          {balanceBefore !== null && (
            <Animated.View
              style={[
                st.balancePill,
                {
                  opacity: balanceAnim,
                  transform: [
                    { translateY: balanceAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                    { scale: balanceAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                  ],
                  borderColor: palette.accent + '40',
                },
              ]}
            >
              <Text style={st.balanceLabel}>Bakiyen</Text>
              <Text style={[st.balanceAmount, { color: palette.amountText }]}>
                {balanceBefore.toLocaleString('tr-TR')}
              </Text>
              <Ionicons name="arrow-forward" size={11} color="rgba(255,255,255,0.4)" />
              <Text style={[st.balanceNew, { color: palette.accent }]}>
                {balanceNow.toLocaleString('tr-TR')} SP
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Bottom CTA — Tamam butonu */}
        <Animated.View
          style={[
            st.bottomCta,
            {
              opacity: ctaAnim,
              transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          <Pressable
            style={[
              st.ctaBtn,
              tierShadow(palette.accent),
              { borderColor: palette.fillGrad[0] + (Platform.OS === 'android' ? 'CC' : '88') },
            ]}
            onPress={onClose}
          >
            <LinearGradient
              colors={palette.buttonGrad}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={st.ctaGrad}
            >
              <Text style={st.ctaText}>Tamam</Text>
            </LinearGradient>
          </Pressable>
          <Text style={st.notifText}>
            <Text style={{ fontSize: 13 }}>💝</Text>
            <Text>  {recipientName}'a bildirim gönderildi</Text>
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  stage: {
    flex: 1,
    // ★ v107.16: Siyah BG kaldırıldı — arka plan şeffaf, BlurView + dim ile yumuşak overlay
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  // ★ v107.16: Merkez spotlight halo — tier renkli, opak ortada → şeffaf kenar
  //   Geniş bir circle, ekran ortasına yerleştirilmiş, LinearGradient ile yumuşak fade
  spotlight: {
    position: 'absolute',
    top: H * 0.5 - W * 0.7,    // dikey ortala
    left: -W * 0.2,            // ekran genişliğinden taşar
    width: W * 1.4,
    height: W * 1.4,
    borderRadius: W * 0.7,
    overflow: 'hidden',
  },
  spotlightGrad: {
    width: '100%', height: '100%',
    borderRadius: W * 0.7,
  },
  topStatus: {
    height: Platform.OS === 'ios' ? 50 : 30,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Recipient pill — üstte
  recipientBlock: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 24,
    zIndex: 3,
  },
  recipientLabel: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  recipientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 100,
  },
  recipientAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2,
  } as any,
  recipientName: {
    color: '#FFF', fontSize: 14, fontWeight: '700',
    paddingRight: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Center stage
  centerStageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  gemStage: {
    width: 220, height: 220,
    alignItems: 'center', justifyContent: 'center',
  },
  flash: {
    position: 'absolute',
    width: 200, height: 200,
    borderRadius: 100,
    overflow: 'hidden',
  },
  flashGrad: {
    width: '100%', height: '100%',
    borderRadius: 100,
  },
  ringWrap: {
    position: 'absolute',
    width: HEX_SIZE, height: HEX_SIZE,
    borderRadius: HEX_SIZE / 2,
    borderWidth: 2,
  },
  gemWrap: {
    width: HEX_SIZE, height: HEX_SIZE,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: HEX_SIZE / 2,
  },
  sweep: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 60,
  },
  sweepGrad: {
    width: '100%', height: '100%',
  },

  // Konfeti
  confettiLayer: {
    position: 'absolute',
    top: '40%', left: '50%',
    width: 0, height: 0,
  },
  confettiPiece: {
    position: 'absolute',
    fontSize: 22,
    width: 30, height: 30,
    textAlign: 'center',
    marginLeft: -15, marginTop: -15,
  },

  // Coin shower
  coinLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  coinPiece: {
    position: 'absolute',
    fontSize: 22,
  },

  // Amount block
  amountBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: -30,
    zIndex: 5,
  },
  amountNum: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 78,
    textShadowOffset: { width: 0, height: 4 },
    marginBottom: 6,
  },
  amountUnit: {
    fontSize: 11, fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 16,
  },
  messagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(248,180,192,0.15)',
    borderWidth: 1, borderColor: 'rgba(248,180,192,0.35)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 100,
    marginBottom: 12,
  },
  messageEmoji: {
    fontSize: 14,
  },
  messageText: {
    color: '#FFF', fontSize: 12, fontWeight: '500',
  },
  messageStrong: {
    color: '#F8B4C0', fontWeight: '800',
  },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 100,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.50)', fontSize: 10, fontWeight: '600' },
  balanceAmount: { fontSize: 12, fontWeight: '800' },
  balanceNew: { fontSize: 12, fontWeight: '800' },

  // Bottom CTA
  bottomCta: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 18,
    alignItems: 'center',
    zIndex: 4,
  },
  ctaBtn: {
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
  },
  ctaGrad: {
    paddingHorizontal: 48, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: {
    color: '#3D1F00', fontSize: 14, fontWeight: '900',
    letterSpacing: 0.5,
  },
  notifText: {
    color: 'rgba(255,255,255,0.45)', fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
  },
});
