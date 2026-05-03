/**
 * SopranoChat — SP Alındı Modalı (3 Tip × 3 Boyut)
 * ═══════════════════════════════════════════════════════════════════
 * v107.9 (2 May 2026) — HTML referans (sopranochat_sp_reward_animations_3types_3tiers).
 *
 * 3 TRANSFER TİPİ:
 *   🎁 gift       — bireysel hediye (pembe-altın, kalp parçacıkları)
 *   💝 donation   — sahne desteği bağışı (yeşil-altın, ring pulse + yıldız orbit)
 *   🚪 room_entry — oda bilet ücreti (mor-altın, door-open + kullanıcı emoji)
 *
 * 3 BOYUT (amount bazlı):
 *   mini   (1-99 SP)    : 1 partikül, 1.5sn — sade
 *   normal (100-999 SP) : 4-5 orbit partikül, 2sn — zengin
 *   big    (1000+ SP)   : yağmur + shake + halo katmanları, 2.5sn — sinematik
 *
 * Backend notu: Şu an notifications.type her zaman 'gift'. Bu modal'in
 * transferType prop'u default 'gift'. Backend'de tip ayrımı (gift_stage,
 * gift_room) ileride eklenince otomatik 3 tip kullanılabilir.
 *
 * Korunanlar:
 *   - Thank-you replies (ücretsiz teşekkür sistemi) — kullanıcı için kritik
 *   - giftNotificationId tracking
 *   - Realtime gift handler (_layout) ile API geriye uyumlu
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, Modal, Dimensions, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SPHexagonIcon from '../SPHexagonIcon';
import { supabase } from '../../constants/supabase';
import { getAvatarSource } from '../../constants/avatars';
import { showToast } from '../Toast';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';

const { width: W, height: H } = Dimensions.get('window');

// ═══ Hızlı teşekkür seçenekleri (mevcut davranış korundu) ═══
const THANK_YOU_REPLIES = [
  { emoji: '🙏', label: 'Teşekkürler' },
  { emoji: '❤️', label: 'Sağol' },
  { emoji: '🎉', label: 'Harika' },
  { emoji: '😊', label: 'Mutlu oldum' },
  { emoji: '🌹', label: 'Çok naziksin' },
  { emoji: '✨', label: 'İyisin' },
];

// ═══ TRANSFER TİP PALETİ ═══
type TransferType = 'gift' | 'donation' | 'room_entry';

interface TypeVisual {
  /** Header üst etiket */
  label: string;
  /** Ana tip rengi (pembe/yeşil/mor) */
  primary: string;
  /** İkincil altın rengi (vurgu) */
  accent: string;
  /** Halo rengi (rgba string) */
  halo: string;
  /** Kart zemin gradient */
  bgGradient: [string, string, string];
  /** Top edge highlight */
  topEdge: string;
  /** Tip-spesifik partikül emoji havuzu */
  particles: string[];
  /** Header üstündeki açıklama (sender adıyla) */
  describe: (senderName: string) => string;
  /** Header altındaki ikon */
  icon: keyof typeof Ionicons.glyphMap;
}

const TYPE_VISUAL: Record<TransferType, TypeVisual> = {
  gift: {
    label: 'HEDİYE GELDİ',
    primary: '#F8B4C0',          // pembe
    accent: '#FAC775',           // altın
    halo: 'rgba(248,180,192,0.7)',
    bgGradient: ['#3a1825', '#1f0a14', '#0a0518'],
    topEdge: 'rgba(248,180,192,0.85)',
    particles: ['💗', '✨', '🎀', '💖', '⭐'],
    describe: (s) => `${s} sana hediye gönderdi`,
    icon: 'gift',
  },
  donation: {
    label: 'BAĞIŞ ALDIN',
    primary: '#5DCAA5',          // yeşil
    accent: '#FAC775',           // altın
    halo: 'rgba(93,202,165,0.7)',
    bgGradient: ['#0e3025', '#051912', '#000a06'],
    topEdge: 'rgba(93,202,165,0.85)',
    particles: ['⭐', '✨', '🌟', '💫'],
    describe: (s) => `${s} seni destekledi`,
    icon: 'sparkles',
  },
  room_entry: {
    label: 'ODANA KATILDI',
    primary: '#B8A4F0',          // mor
    accent: '#FAC775',           // altın
    halo: 'rgba(184,164,240,0.7)',
    bgGradient: ['#2a1d4a', '#15102a', '#080418'],
    topEdge: 'rgba(184,164,240,0.85)',
    particles: ['👤', '✨', '🎉', '⭐'],
    describe: (s) => `${s} odana katıldı`,
    icon: 'enter',
  },
};

// ═══ BOYUT KONFİGÜRASYONU ═══
type SizeTier = 'mini' | 'normal' | 'big';

interface SizeConfig {
  hexSize: number;
  particleCount: number;
  hasShake: boolean;
  hasRain: boolean;     // büyük: üstten partikül yağmuru
  hasOrbit: boolean;    // normal/büyük: yörünge partikül
  ringCount: number;    // ring pulse sayısı (0-3)
  duration: number;     // ms — toplam animasyon
}

const SIZE_CONFIG: Record<SizeTier, SizeConfig> = {
  mini:   { hexSize: 130, particleCount: 1,  hasShake: false, hasRain: false, hasOrbit: false, ringCount: 1, duration: 1500 },
  normal: { hexSize: 165, particleCount: 5,  hasShake: false, hasRain: false, hasOrbit: true,  ringCount: 2, duration: 2000 },
  big:    { hexSize: 195, particleCount: 12, hasShake: true,  hasRain: true,  hasOrbit: true,  ringCount: 3, duration: 2500 },
};

function getReceiveSize(amount: number): SizeTier {
  if (amount >= 1000) return 'big';
  if (amount >= 100) return 'normal';
  return 'mini';
}

interface Props {
  visible: boolean;
  amount: number;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  /** ★ v107.9: Transfer tipi — 'gift' (default) | 'donation' | 'room_entry'.
   *  Backend notifications.type genişletilince otomatik kullanılır. */
  transferType?: TransferType;
  giftNotificationId?: string;
  onClose: () => void;
}

export default function SPReceivedModal({
  visible, amount, senderId, senderName, senderAvatar, recipientId,
  transferType = 'gift', giftNotificationId, onClose,
}: Props) {
  const tv = TYPE_VISUAL[transferType];
  const size = useMemo(() => getReceiveSize(amount), [amount]);
  const cfg = SIZE_CONFIG[size];

  const [thanked, setThanked] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [alreadyThanked, setAlreadyThanked] = useState(false);

  // ── Animated values ──
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  // Hexagon entrance — pop-in (0 → 1.2 → 1)
  const gemPop = useRef(new Animated.Value(0)).current;
  // room_entry için door-open (scaleX 1 → 0.1)
  const doorAnim = useRef(new Animated.Value(0)).current;
  // big için shake (3 kez sallanma)
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Halo pulse (sürekli loop)
  const haloPulse = useRef(new Animated.Value(0)).current;
  // Ring pulse'lar (1-3 ring, gecikmeli)
  const ringAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  // Amount count-up
  const countAnim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  // Particles (orbit + rain)
  const MAX_PARTICLES = 14;
  const particles = useRef(
    Array.from({ length: MAX_PARTICLES }, () => ({
      anim: new Animated.Value(0),
      angle: 0,
      radius: 0,
      emoji: '',
      isRain: false,
      x: 0,
    }))
  ).current;

  // Refs for cleanup
  const haloLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const ringLoopRefs = useRef<(Animated.CompositeAnimation | null)[]>([null, null, null]);

  useEffect(() => {
    if (!visible) return;

    // Reset
    backdropOpacity.setValue(0);
    cardScale.setValue(0.85);
    cardOpacity.setValue(0);
    gemPop.setValue(0);
    doorAnim.setValue(0);
    shakeAnim.setValue(0);
    haloPulse.setValue(0);
    ringAnims.forEach(a => a.setValue(0));
    countAnim.setValue(0);
    setDisplay(0);
    setThanked(null);
    setSending(false);
    setAlreadyThanked(false);
    particles.forEach(p => p.anim.setValue(0));

    // Daha önce teşekkür edilmiş mi kontrol
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

    // Partikül havuzunu hazırla
    const isRain = cfg.hasRain;
    for (let i = 0; i < cfg.particleCount; i++) {
      const p = particles[i];
      p.emoji = tv.particles[i % tv.particles.length];
      if (isRain && i >= 5) {
        // Yağmur: üstten düşer
        p.isRain = true;
        p.x = Math.random() * (W * 0.7);
      } else {
        // Orbit: yörüngede döner
        p.isRain = false;
        p.angle = (360 / Math.max(1, cfg.particleCount)) * i;
        p.radius = 50 + Math.random() * 20;
      }
    }

    const listener = countAnim.addListener(({ value }) => setDisplay(Math.floor(value)));

    // ★ ENTRANCE — Card + backdrop
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 110, friction: 9, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();

    // ★ DOOR — sadece room_entry için, gem'in önünde kapı açılır
    if (transferType === 'room_entry') {
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(doorAnim, {
          toValue: 1, duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // ★ GEM POP-IN — pop-in keyframe (0 → 1.2 → 1) cubic bounce
    Animated.sequence([
      Animated.delay(transferType === 'room_entry' ? 400 : 250),
      Animated.timing(gemPop, {
        toValue: 1, duration: 600,
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Big için shake (3 kez sallanma)
      if (cfg.hasShake) {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]).start();
      }
    });

    // ★ HALO PULSE LOOP — sürekli yumuşak nabız
    haloLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(haloPulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    haloLoopRef.current.start();

    // ★ RING PULSE LOOPS — gecikmeli, ringCount kadar
    for (let i = 0; i < cfg.ringCount; i++) {
      ringLoopRefs.current[i] = Animated.loop(
        Animated.sequence([
          Animated.delay(i * 400),
          Animated.timing(ringAnims[i], {
            toValue: 1, duration: 1400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ringAnims[i], { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      ringLoopRefs.current[i]?.start();
    }

    // ★ COUNT-UP — amount sayacı 0 → final
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(countAnim, {
        toValue: amount, duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // ★ PARTICLES — orbit (normal/big) + rain (sadece big)
    for (let i = 0; i < cfg.particleCount; i++) {
      const p = particles[i];
      Animated.sequence([
        Animated.delay(400 + i * 80),
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.isRain ? 2200 : 1600,
          easing: p.isRain ? Easing.in(Easing.quad) : Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      countAnim.removeListener(listener);
      haloLoopRef.current?.stop();
      ringLoopRefs.current.forEach(r => r?.stop());
    };
  }, [visible, amount, transferType]);

  const handleThankYou = async (reply: { emoji: string; label: string }) => {
    if (sending || thanked) return;
    setSending(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: senderId,
        sender_id: recipientId,
        type: 'thank_you',
        body: `${reply.emoji} ${reply.label}`,
        reference_id: giftNotificationId || null,
      });
      if (error) {
        if (__DEV__) console.warn('[ThankYou] insert error:', error.message);
        showToast({ title: 'İletilemedi', message: error.message || 'Teşekkür gönderilemedi.', type: 'error' });
        setSending(false);
        return;
      }
      setThanked(reply.emoji);
    } catch (e: any) {
      if (__DEV__) console.warn('[ThankYou] catch:', e);
      showToast({ title: 'Teşekkür Gönderilemedi', message: e?.message || 'Yanıtın iletilemedi.', type: 'error' });
      setSending(false);
      return;
    }
    setSending(false);
    setTimeout(onClose, 1100);
  };

  const { translateValue: swipeTranslate, panHandlers } = useSwipeToDismiss({
    direction: 'down',
    threshold: 80,
    onDismiss: onClose,
  });

  if (!visible) return null;

  // Pop-in interpolations
  const gemScale = gemPop.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });
  const gemOpacity = gemPop.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 1],
  });
  const shakeX = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });

  // Halo pulse (scale 1 → 1.15)
  const haloScale = haloPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const haloOpacity = haloPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.6, 0.3] });

  // Door open (scaleX 1 → 0.1)
  const doorScaleX = doorAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.05] });
  const doorOpacity = doorAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.5, 0] });

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <View style={s.center} pointerEvents="box-none">
        {/* Card */}
        <Animated.View
          style={[
            s.card,
            Platform.OS === 'ios'
              ? { shadowColor: tv.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 24 }
              : {},
            {
              borderColor: tv.primary + (Platform.OS === 'android' ? 'AA' : '66'),
              opacity: cardOpacity,
              transform: [
                { scale: cardScale },
                { translateY: swipeTranslate },
              ],
            },
          ]}
          pointerEvents="auto"
          {...panHandlers}
        >
          {/* Swipe handle */}
          <View style={s.handleWrap}>
            <View style={[s.handle, { backgroundColor: tv.primary + 'AA' }]} />
          </View>

          {/* Card zemin gradient */}
          <LinearGradient
            colors={tv.bgGradient}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Tip-rengi tint katmanı */}
          <LinearGradient
            colors={[tv.primary + '30', tv.primary + '0A', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Top edge highlight */}
          <LinearGradient
            colors={['transparent', tv.topEdge, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* Header */}
          <View style={s.headerRow}>
            <Ionicons name={tv.icon} size={14} color={tv.primary} style={s.iconShadow} />
            <Text style={[s.headerText, { color: tv.primary }]}>{tv.label}</Text>
          </View>

          {/* ═══ HEXAGON SAHNESİ — Halo + Rings + Gem + Particles + Door ═══ */}
          <View style={s.gemSection}>
            {/* Halo (yumuşak nabız) */}
            <Animated.View
              style={[
                s.halo,
                {
                  width: cfg.hexSize + 60,
                  height: cfg.hexSize + 60,
                  borderRadius: (cfg.hexSize + 60) / 2,
                  opacity: haloOpacity,
                  transform: [{ scale: haloScale }],
                },
              ]}
              pointerEvents="none"
            >
              <LinearGradient
                colors={[tv.primary + 'AA', tv.primary + '33', 'transparent']}
                start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }}
                style={[s.haloGrad, { borderRadius: (cfg.hexSize + 60) / 2 }]}
              />
            </Animated.View>

            {/* Ring pulse'lar (ringCount kadar, gecikmeli) */}
            {Array.from({ length: cfg.ringCount }).map((_, i) => {
              const ringScale = ringAnims[i].interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 2.2],
              });
              const ringOpacity = ringAnims[i].interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: [0.9, 0.5, 0],
              });
              const ringColor = i === 0 ? tv.primary : (i === 1 ? tv.accent : tv.primary);
              return (
                <Animated.View
                  key={i}
                  style={[
                    s.ring,
                    {
                      width: cfg.hexSize,
                      height: cfg.hexSize,
                      borderRadius: cfg.hexSize / 2,
                      borderColor: ringColor,
                      opacity: ringOpacity,
                      transform: [{ scale: ringScale }],
                    },
                  ]}
                  pointerEvents="none"
                />
              );
            })}

            {/* Hexagon — pop-in + (big için shake) */}
            <Animated.View
              style={{
                opacity: gemOpacity,
                transform: [
                  { scale: gemScale },
                  { translateX: shakeX },
                ],
              }}
            >
              <SPHexagonIcon size={cfg.hexSize} rich />
            </Animated.View>

            {/* Door (sadece room_entry) — kapı açılır animasyonu, gem'i kapatan iki dikdörtgen */}
            {transferType === 'room_entry' && (
              <Animated.View
                style={[
                  s.doorWrap,
                  {
                    width: cfg.hexSize,
                    height: cfg.hexSize,
                    opacity: doorOpacity,
                  },
                ]}
                pointerEvents="none"
              >
                <Animated.View
                  style={[
                    s.doorPanel,
                    {
                      borderColor: tv.primary + 'AA',
                      transform: [{ scaleX: doorScaleX }, { translateX: doorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -cfg.hexSize / 2] }) }],
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    s.doorPanel,
                    {
                      borderColor: tv.primary + 'AA',
                      transform: [{ scaleX: doorScaleX }, { translateX: doorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.hexSize / 2] }) }],
                    },
                  ]}
                />
              </Animated.View>
            )}

            {/* Particles — orbit (normal/big) + rain (big) */}
            {particles.slice(0, cfg.particleCount).map((p, i) => {
              if (p.isRain) {
                // Rain: üstten aşağı düşer
                const ty = p.anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 140] });
                const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] });
                const opacity = p.anim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });
                return (
                  <Animated.Text
                    key={`rain-${i}`}
                    style={[
                      s.rainParticle,
                      {
                        left: p.x,
                        opacity,
                        color: tv.primary,
                        transform: [{ translateY: ty }, { rotate }],
                      },
                    ]}
                    allowFontScaling={false}
                  >
                    {p.emoji}
                  </Animated.Text>
                );
              }
              // Orbit: yörüngede döner
              const rotate = p.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [`${p.angle}deg`, `${p.angle + 360}deg`],
              });
              const scale = p.anim.interpolate({
                inputRange: [0, 0.2, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              });
              const opacity = p.anim.interpolate({
                inputRange: [0, 0.2, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              });
              return (
                <Animated.View
                  key={`orbit-${i}`}
                  style={[
                    s.orbitWrap,
                    {
                      transform: [{ rotate }],
                      opacity,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Animated.Text
                    style={[
                      s.orbitParticle,
                      {
                        color: tv.primary,
                        transform: [{ translateX: p.radius }, { scale }],
                      },
                    ]}
                    allowFontScaling={false}
                  >
                    {p.emoji}
                  </Animated.Text>
                </Animated.View>
              );
            })}

            {/* Mini için tek kalp/yıldız float-up (cfg.hasOrbit=false ve cfg.particleCount=1) */}
            {size === 'mini' && cfg.particleCount === 1 && (() => {
              const p = particles[0];
              const ty = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
              const opacity = p.anim.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: [0, 1, 1, 0] });
              return (
                <Animated.Text
                  style={[
                    s.miniParticle,
                    {
                      color: tv.primary,
                      opacity,
                      transform: [{ translateY: ty }],
                    },
                  ]}
                  allowFontScaling={false}
                >
                  {tv.particles[0]}
                </Animated.Text>
              );
            })()}
          </View>

          {/* Amount + SP */}
          <View style={s.amountRow}>
            <Text style={[s.amountValue, { color: tv.primary, textShadowColor: tv.primary + '88' }]}>
              {display.toLocaleString('tr-TR')}
            </Text>
            <Text style={[s.amountUnit, { color: tv.primary + 'CC' }]}>SP</Text>
          </View>

          {/* Tip-spesifik açıklama */}
          <Text style={[s.description, { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={2}>
            <Text style={[s.descriptionStrong, { color: tv.primary }]}>{senderName}</Text>
            <Text>{tv.describe('').replace(senderName, '').trim() ? ` ${tv.describe('').replace(senderName, '').trim()}` : ''}</Text>
            <Text>{tv.describe(senderName).replace(senderName, '').replace(/^\s+/, ' ')}</Text>
          </Text>

          {/* Sender info */}
          <View style={[s.senderRow, { borderColor: tv.primary + '22' }]}>
            {senderAvatar && (
              <Image
                source={getAvatarSource(senderAvatar)}
                style={[s.senderAvatar, { borderColor: tv.primary + 'AA' }]}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.senderLabel}>Gönderen</Text>
              <Text style={s.senderName} numberOfLines={1}>{senderName}</Text>
            </View>
          </View>

          {/* Thank-you replies (mevcut özellik korundu) */}
          {thanked ? (
            <View style={[s.thankedBox, { borderColor: tv.primary + '40' }]}>
              <Text style={s.thankedEmoji}>{thanked}</Text>
              <Text style={s.thankedText}>
                {alreadyThanked ? 'Daha önce teşekkür ettin' : 'Teşekkürün iletildi'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={s.repliesLabel}>Ücretsiz teşekkür et:</Text>
              <View style={s.repliesGrid}>
                {THANK_YOU_REPLIES.map(r => (
                  <Pressable
                    key={r.emoji}
                    style={({ pressed }) => [
                      s.replyBtn,
                      { borderColor: tv.primary + '33' },
                      pressed && { backgroundColor: tv.primary + '20' },
                    ]}
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

          {/* Close X */}
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={16} color={tv.primary + 'CC'} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: W * 0.88, maxWidth: 380,
    borderRadius: 24,
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
    overflow: 'hidden',
    paddingVertical: 22, paddingHorizontal: 20,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  handleWrap: { alignItems: 'center', paddingTop: 2, paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  iconShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 4,
  },
  headerText: {
    fontSize: 12, fontWeight: '900',
    letterSpacing: 2, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Hexagon sahnesi
  gemSection: {
    alignItems: 'center', justifyContent: 'center',
    height: 240, marginVertical: 10,
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    overflow: 'hidden',
  },
  haloGrad: {
    width: '100%', height: '100%',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  // Door (sadece room_entry)
  doorWrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorPanel: {
    width: '50%', height: '100%',
    borderWidth: 1.5,
    backgroundColor: 'rgba(15,8,30,0.5)',
  },

  // Orbit/rain particles
  orbitWrap: {
    position: 'absolute',
    width: 0, height: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  orbitParticle: {
    position: 'absolute',
    fontSize: 14,
    width: 30, height: 30,
    textAlign: 'center',
    lineHeight: 30,
    marginLeft: -15, marginTop: -15,
  },
  rainParticle: {
    position: 'absolute',
    top: 0,
    fontSize: 14,
    width: 24,
    textAlign: 'center',
  },
  miniParticle: {
    position: 'absolute',
    top: '15%',
    fontSize: 18,
  },

  // Amount
  amountRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 5,
    marginTop: 6,
  },
  amountValue: {
    fontSize: 44, fontWeight: '900',
    letterSpacing: -1.2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  amountUnit: {
    fontSize: 16, fontWeight: '900', letterSpacing: 0.8,
  },

  // Description (tip-spesifik mesaj)
  description: {
    fontSize: 13, fontWeight: '500',
    textAlign: 'center',
    marginTop: 10, marginHorizontal: 8,
    lineHeight: 18,
  },
  descriptionStrong: { fontWeight: '800' },

  // Sender row
  senderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1,
  },
  senderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2,
  } as any,
  senderLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.45)',
    fontWeight: '700', letterSpacing: 1,
  },
  senderName: {
    fontSize: 14, color: '#F1F5F9',
    fontWeight: '800',
  },

  // Thank-you (mevcut)
  thankedBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  thankedEmoji: { fontSize: 20 },
  thankedText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  repliesLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.45)',
    fontWeight: '700', letterSpacing: 1,
    textAlign: 'center',
    marginTop: 14, marginBottom: 8,
  },
  repliesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 6, justifyContent: 'center',
  },
  replyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  replyEmoji: { fontSize: 13 },
  replyLabel: { fontSize: 10, color: 'rgba(255,255,255,0.78)', fontWeight: '600' },

  // Close X
  closeBtn: {
    position: 'absolute',
    top: 12, right: 12,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
