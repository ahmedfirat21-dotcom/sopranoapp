/**
 * SopranoChat — Sahne Desteği Sheet (oda host'a SP bağışı)
 * ═══════════════════════════════════════════════════════════════════
 * v107.3 (2 May 2026) — SPDonateSheet'in oda-içi host bağışı ayrımı.
 * Eski tek-modal-her-bağlam yaklaşımı bölündü; bu sheet SADECE oda host'una
 * "sahne desteği" tip atma akışı için (canlı an, anlık, gösterişli).
 *
 * Tema: SAHNE
 *   - Watermark: Üstten yumuşak sahne ışığı huzmesi (tier rengi → transparan dikey)
 *   - Host avatarı sahne ışığı altında parlar (tier glow ring + breathing pulse)
 *   - Oda adı küçük subtitle olarak gösterilir
 *   - Mesaj input YOK (canlı an, hızlı tip — Hediye'den ayrım noktası)
 *   - Buton: "Sahneyi Destekle"
 *
 * Tutarlılık (Hediye Sheet ile ortak):
 *   - Tier paleti: constants/tierColors.ts (paylaşılan)
 *   - Yumuşak 4-stop gradient, locations [0, 0.4, 0.75, 1] — keskin geçiş yok
 *   - Android: shadowColor yok, border + iç gradient + tierShadow helper
 *   - Drag-to-dismiss (X butonu YOK)
 *   - Bakiye-aware slider/chip
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
  Pressable, GestureResponderEvent, Platform, Image,
} from 'react-native';
import AppLoader from '../AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileService } from '../../services/profile';
import { supabase } from '../../constants/supabase';
import { showToast } from '../Toast';
import SPSentSuccessModal from '../profile/SPSentSuccessModal';
import { getSPAmountTier } from '../../constants/spAmountTier';
import SPHexagonIcon from '../SPHexagonIcon';
import PremiumAlert from '../PremiumAlert';
import { useRouter } from 'expo-router';
import { TIER_PALETTES, PANEL_BG_GRADIENT, tierShadow, tierButtonShadow } from '../../constants/tierColors';
import { getAvatarSource } from '../../constants/avatars';

const { width: W } = Dimensions.get('window');

const PANEL_CONTENT_HEIGHT = 480; // mesaj input olmadığı için Hediye'den 60px kısa
const SLIDER_WIDTH = Math.max(1, W - 80);
const QUICK_AMOUNTS = [10, 25, 100, 250, 500];
const MIN_AMOUNT = 10; // ★ v107.18: Min gönderim 10 SP
const HARD_MAX = 1000;

interface Props {
  visible: boolean;
  onClose: () => void;
  senderId: string;
  /** Host kullanıcı ID'si — bağış buraya gider */
  hostId: string;
  /** Host'un display name'i */
  hostName: string;
  /** Host avatar URL'i — sahne ışığı altında parıldar */
  hostAvatar?: string;
  /** Host tier (Plus/Pro) — avatar yanında rozet */
  hostTier?: string | null;
  /** Oda adı — alt subtitle */
  roomName?: string;
  onSuccess?: (amount: number) => void;
}

export default function StageSupportSheet({
  visible, onClose, senderId, hostId, hostName, hostAvatar, hostTier, roomName, onSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // ★ Sahne ışığı huzmesi — subtle yana sallanır + opacity dans (4sn cycle)
  const spotlightFloat = useRef(new Animated.Value(0)).current;
  // ★ Host avatar breathing — sahne ışığı altında nefes alır gibi (2sn)
  const avatarBreath = useRef(new Animated.Value(0)).current;
  // ★ Tier glow ring — host avatar etrafında pulse halo (2sn)
  const glowRing = useRef(new Animated.Value(0)).current;
  // Hexagon scale spring (slider değişiminde)
  const hexScale = useRef(new Animated.Value(1)).current;
  // ★ v107.31: Light sweep — panel arkasında diagonal ışık şeridi soldan sağa kayar (5sn loop)
  const lightSweep = useRef(new Animated.Value(0)).current;
  // ★ v107.31: 6 ambient drift particle (yıldız) — alttan üste yumuşakça süzülür
  const driftAnims = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;
  // ★ v284 (16 May 2026): Loop instance ref'ler — orphan loop önleme (5 ana + 6 drift)
  const spotlightLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const avatarBreathLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowRingLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const lightSweepLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const driftLoopsRef = useRef<(Animated.CompositeAnimation | null)[]>([]);

  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  const [insufficientAlert, setInsufficientAlert] = useState<{ visible: boolean; needed: number }>({
    visible: false, needed: 0,
  });

  const sliderRef = useRef<View>(null);
  const sliderX = useRef(0);
  const sliderMeasured = useRef(false);
  const sliderActiveRef = useRef(false);
  const lastSliderUpdate = useRef(0);

  // Bakiye-aware slider üst sınırı
  const effectiveMax = balance !== null ? Math.max(1, Math.min(HARD_MAX, balance)) : HARD_MAX;

  useEffect(() => {
    if (visible) {
      setAmount(10);
      setLoading(false);
      sliderMeasured.current = false;
      (async () => {
        try {
          const { data } = await supabase.from('profiles').select('system_points').eq('id', senderId).single();
          setBalance(data?.system_points ?? 0);
        } catch (e) {
          if (__DEV__) console.warn('[StageSupportSheet] balance fetch failed:', e);
        }
      })();
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      // ★ v284 (16 May 2026): 5 loop ref pattern — orphan loop önleme
      spotlightLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(spotlightFloat, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(spotlightFloat, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
      );
      spotlightLoopRef.current.start();
      avatarBreathLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(avatarBreath, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(avatarBreath, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      );
      avatarBreathLoopRef.current.start();
      glowRingLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowRing, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowRing, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
      );
      glowRingLoopRef.current.start();
      lightSweepLoopRef.current = Animated.loop(
        Animated.timing(lightSweep, { toValue: 1, duration: 5000, useNativeDriver: true }),
      );
      lightSweepLoopRef.current.start();
      driftAnims.forEach((a, i) => {
        const l = Animated.loop(
          Animated.sequence([
            Animated.delay(i * 600),
            Animated.timing(a, { toValue: 1, duration: 4500, useNativeDriver: true }),
            Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        );
        driftLoopsRef.current[i] = l;
        l.start();
      });
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      spotlightLoopRef.current?.stop(); spotlightLoopRef.current = null;
      avatarBreathLoopRef.current?.stop(); avatarBreathLoopRef.current = null;
      glowRingLoopRef.current?.stop(); glowRingLoopRef.current = null;
      lightSweepLoopRef.current?.stop(); lightSweepLoopRef.current = null;
      driftLoopsRef.current.forEach(l => l?.stop());
      driftLoopsRef.current = [];
    }
  }, [visible]);
  useEffect(() => () => {
    spotlightLoopRef.current?.stop();
    avatarBreathLoopRef.current?.stop();
    glowRingLoopRef.current?.stop();
    lightSweepLoopRef.current?.stop();
    driftLoopsRef.current.forEach(l => l?.stop());
  }, []);

  // Hexagon spring
  useEffect(() => {
    Animated.sequence([
      Animated.spring(hexScale, { toValue: 1.06, useNativeDriver: true, damping: 10, stiffness: 200 }),
      Animated.spring(hexScale, { toValue: 1.0, useNativeDriver: true, damping: 12, stiffness: 180 }),
    ]).start();
  }, [amount]);

  // Pan responder — drag-to-dismiss
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 25 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true })
            .start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  const calcAmount = (pageX: number, originX: number) => {
    const touchX = pageX - originX;
    const ratio = Math.max(0, Math.min(1, touchX / SLIDER_WIDTH));
    const val = Math.max(MIN_AMOUNT, Math.round(MIN_AMOUNT + ratio * Math.max(0, effectiveMax - MIN_AMOUNT)));
    return Number.isFinite(val) ? val : MIN_AMOUNT;
  };

  const handleSliderTouch = useCallback((e: GestureResponderEvent) => {
    sliderActiveRef.current = true;
    if (!sliderRef.current) return;
    try {
      const pageX = e.nativeEvent?.pageX;
      if (pageX == null || !Number.isFinite(pageX)) return;
      sliderRef.current.measureInWindow((x: number) => {
        if (x == null || !Number.isFinite(x)) return;
        sliderX.current = x;
        sliderMeasured.current = true;
        setAmount(calcAmount(pageX, x));
      });
    } catch {}
  }, [effectiveMax]);

  const handleSliderMove = useCallback((e: GestureResponderEvent) => {
    try {
      if (!sliderMeasured.current) return;
      const pageX = e.nativeEvent?.pageX;
      if (pageX == null || !Number.isFinite(pageX)) return;
      const now = Date.now();
      if (now - lastSliderUpdate.current < 16) return;
      lastSliderUpdate.current = now;
      setAmount(calcAmount(pageX, sliderX.current));
    } catch {}
  }, [effectiveMax]);

  const handleSliderRelease = useCallback(() => {
    sliderActiveRef.current = false;
  }, []);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const handleSupport = async () => {
    if (amount <= 0 || loading) return;
    if (senderId === hostId) return;
    if (balance !== null && balance < amount) {
      setInsufficientAlert({ visible: true, needed: amount - (balance ?? 0) });
      return;
    }

    // Optimistic UI
    const sentAmount = amount;
    setBalance(prev => (prev ?? 0) - sentAmount);
    setSuccessAmount(sentAmount);
    setShowSuccess(true);
    onClose();

    try {
      // Sahne desteği = mesaj yok (4. parametre undefined)
      const result = await ProfileService.donateToUser(senderId, hostId, sentAmount);
      if (!mountedRef.current) return;
      if (!result.success) {
        setBalance(prev => (prev ?? 0) + sentAmount);
        setShowSuccess(false);
        showToast({
          title: 'Destek gönderilemedi',
          message: result.error || 'Bilinmeyen bir hata oluştu, lütfen tekrar dene.',
          type: 'error',
        });
        return;
      }
      onSuccess?.(sentAmount);
    } catch (e: any) {
      if (mountedRef.current) {
        setBalance(prev => (prev ?? 0) + sentAmount);
        setShowSuccess(false);
        showToast({
          title: 'Destek gönderilemedi',
          message: e?.message || 'Beklenmeyen bir hata, internet bağlantını kontrol et.',
          type: 'error',
        });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const tier = getSPAmountTier(amount);
  const palette = TIER_PALETTES[tier];
  const canSupport = amount >= MIN_AMOUNT && balance !== null && balance >= amount && senderId !== hostId;
  const fillRatio = effectiveMax > MIN_AMOUNT ? (amount - MIN_AMOUNT) / (effectiveMax - MIN_AMOUNT) : 0;

  if (!visible && !showSuccess) return null;

  if (showSuccess) {
    return (
      <SPSentSuccessModal
        visible={showSuccess}
        amount={successAmount}
        recipientName={hostName}
        recipientAvatar={hostAvatar}
        onClose={() => setShowSuccess(false)}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 500 }} pointerEvents="box-none">
        {/* Backdrop — NotificationDrawer dim tonu */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,22,0.45)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            tierShadow(palette.accent),
            {
              borderColor: palette.accent + (Platform.OS === 'android' ? 'AA' : '66'),
              paddingBottom: 22 + insets.bottom,
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* ★ 2026-05-05: NotificationDrawer dili — slate diagonal + üst tier halo + soft glow.
              Sahne ışığı huzmesi + light sweep KORUNUR (sahne karakteri). */}
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[palette.accent + '38', palette.accent + '10', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[palette.accent + '14', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* ★ Sahne ışığı huzmesi — panel üstünden yumuşakça düşer.
              Tier rengi tepede yoğun, dipte transparan. Yana hafif sallanır (4sn cycle).
              "Spotlight from above" hissi — sade ve premium. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spotlight,
              {
                opacity: spotlightFloat.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.18, 0.32, 0.18],
                }),
                transform: [
                  {
                    translateX: spotlightFloat.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [-8, 8, -8],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[
                palette.accent + 'CC',
                palette.accent + '55',
                palette.accent + '11',
                'transparent',
              ]}
              locations={[0, 0.35, 0.7, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          {/* ★ v107.31: LIGHT SWEEP — panel arkasında diagonal ışık şeridi soldan sağa kayar.
               Tier rengi 60% opaklık, skewX -25deg ile kayma efekti. 5sn cycle. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lightSweep,
              {
                transform: [
                  { translateX: lightSweep.interpolate({ inputRange: [0, 1], outputRange: [-W, W * 1.3] }) },
                  { skewX: '-25deg' },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['transparent', palette.accent + '55', 'transparent']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          {/* ★ v107.31: AMBIENT DRIFT — 6 yıldız partikülü panel altından yumuşakça yukarı süzülür.
               Stagger gecikmeli, fade-in / fade-out, scale 0.6 → 1.2. */}
          {driftAnims.map((anim, i) => {
            const startX = ((i * 137) % (W - 80)) + 40;  // pseudo-random distribution
            const drift = ((i * 53) % 60) - 30;
            const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_HEIGHT * 0.9, -40] });
            const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
            const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.7, 0.7, 0] });
            const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.0, 1.2] });
            return (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: startX,
                  top: 0,
                  opacity,
                  transform: [{ translateX: tx }, { translateY: ty }, { scale }],
                }}
              >
                <Text style={[styles.driftParticle, { color: palette.accent }]} allowFontScaling={false}>✦</Text>
              </Animated.View>
            );
          })}

          {/* Top edge highlight */}
          <LinearGradient
            colors={['transparent', palette.topEdge, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.topEdge}
          />

          {/* Drag handle */}
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: palette.accent + '88' }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="mic" size={20} color={palette.accent} style={iconShadow} />
            <Text style={[styles.headerTitle, { color: palette.accent }]}>{i18n.t('room.stagesupportsheet.001')}</Text>
            {palette.label && (
              <View style={[styles.tierBadge, { backgroundColor: palette.accentSoft, borderColor: palette.accent + '60' }]}>
                <Text style={[styles.tierBadgeText, { color: palette.accent }]}>{palette.label}</Text>
              </View>
            )}
            <View style={[styles.balancePill, { backgroundColor: palette.accentTint, borderColor: palette.accent + '40' }]}>
              <Ionicons name="wallet" size={10} color={palette.accent} />
              <Text style={[styles.balanceText, { color: palette.accent }]}>
                {balance !== null ? balance.toLocaleString('tr-TR') : '...'}
              </Text>
            </View>
          </View>

          {/* Host kartı — avatar sahne ışığı altında parlar */}
          <View style={styles.hostCardWrap}>
            {/* Glow ring — avatar arkasında pulse halo */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.hostGlowRing,
                {
                  borderColor: palette.accent,
                  opacity: glowRing.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] }),
                  transform: [{
                    scale: glowRing.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.12] }),
                  }],
                },
              ]}
            />
            {/* Avatar — breathing pulse */}
            <Animated.View
              style={[
                styles.hostAvatarWrap,
                {
                  borderColor: palette.accent,
                  transform: [{
                    scale: avatarBreath.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.04] }),
                  }],
                },
              ]}
            >
              <Image source={getAvatarSource(hostAvatar)} style={styles.hostAvatar} />
            </Animated.View>
            {/* İsim + "Host" etiketi + oda adı */}
            <View style={styles.hostInfo}>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName} numberOfLines={1}>{hostName}</Text>
                <View style={[styles.hostLabel, { borderColor: palette.accent + '55', backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="mic" size={8} color={palette.accent} />
                  <Text style={[styles.hostLabelText, { color: palette.accent }]}>HOST</Text>
                </View>
                {hostTier && hostTier !== 'free' && (
                  <View style={[styles.hostTierChip, { borderColor: palette.accent + '40' }]}>
                    <Ionicons name="star" size={8} color={palette.accent} />
                    <Text style={[styles.hostTierText, { color: palette.accent }]}>{hostTier}</Text>
                  </View>
                )}
              </View>
              {roomName && (
                <Text style={styles.roomName} numberOfLines={1}>"{roomName}"</Text>
              )}
            </View>
          </View>

          {/* Hexagon + amount */}
          <View style={styles.amountWrap}>
            <Animated.View style={[styles.amountHexWrap, { transform: [{ scale: hexScale }] }]}>
              <SPHexagonIcon size={64} tier={tier as any} />
            </Animated.View>
            <Text style={[styles.amountValue, { color: palette.amountText }]}>
              {amount.toLocaleString('tr-TR')}
            </Text>
            <Text style={[styles.amountUnit, { color: palette.accent }]}>SP</Text>
          </View>

          {/* Slider */}
          <View style={styles.sliderWrap}>
            <Text style={[styles.sliderMin, { color: palette.accent + '70' }]}>{MIN_AMOUNT}</Text>
            <View
              ref={sliderRef}
              style={styles.sliderTrack}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={handleSliderTouch}
              onResponderMove={handleSliderMove}
              onResponderRelease={handleSliderRelease}
              onResponderTerminate={handleSliderRelease}
              onResponderTerminationRequest={() => false}
            >
              <LinearGradient
                colors={palette.fillGrad}
                locations={palette.fillLocations}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.sliderFill, { width: `${fillRatio * 100}%` }]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  {
                    backgroundColor: palette.fillGrad[0],
                    borderColor: palette.accent,
                    left: Math.max(0, Math.min(fillRatio * SLIDER_WIDTH - 10, SLIDER_WIDTH - 20)),
                  },
                ]}
              />
            </View>
            <Text style={[styles.sliderMax, { color: palette.accent + '70' }]}>
              {effectiveMax.toLocaleString('tr-TR')}
            </Text>
          </View>

          {/* Quick presets — bakiye altıysa sönük */}
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map(q => {
              const active = amount === q;
              const overBalance = balance !== null && q > balance;
              const qTier = getSPAmountTier(q);
              const qAccent = TIER_PALETTES[qTier].accent;
              return (
                <Pressable
                  key={q}
                  style={[
                    styles.quickBtn,
                    active && { backgroundColor: qAccent + '22', borderColor: qAccent },
                    overBalance && { opacity: 0.35 },
                  ]}
                  onPress={() => !overBalance && setAmount(q)}
                  disabled={overBalance}
                >
                  <Text style={[styles.quickText, active && { color: qAccent }]}>{q}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sahneyi Destekle butonu */}
          <Pressable
            style={[
              styles.sendBtn,
              tierButtonShadow(palette.accent),
              { borderColor: palette.fillGrad[0] + (Platform.OS === 'android' ? 'CC' : '99') },
              !canSupport && { opacity: 0.4 },
            ]}
            onPress={handleSupport}
            disabled={!canSupport || loading}
          >
            <LinearGradient
              colors={palette.buttonGrad}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.sendBtnGrad}
            >
              {loading ? (
                <AppLoader color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#FFF" style={iconShadow} />
                  <Text style={styles.sendBtnText}>
                    {amount.toLocaleString('tr-TR')} SP Sahneyi Destekle
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      {/* Yetersiz bakiye */}
      <PremiumAlert
        visible={insufficientAlert.visible}
        title="Yetersiz SP"
        message={`${insufficientAlert.needed} SP eksik. Mağazadan SP yükleyip sahneyi destekleyebilirsin.`}
        type="warning"
        buttons={[
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Mağazaya Git',
            style: 'default',
            onPress: () => {
              setInsufficientAlert({ visible: false, needed: 0 });
              onClose();
              setTimeout(() => router.push('/sp-store' as any), 220);
            },
          },
        ]}
        onDismiss={() => setInsufficientAlert({ visible: false, needed: 0 })}
      />
    </View>
  );
}

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomWidth: 0,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 40, height: 4, borderRadius: 2 },

  // ★ Sahne ışığı huzmesi — panel üst kısmında, tier rengi tepede yoğun
  spotlight: {
    position: 'absolute',
    top: 0,
    left: 0, right: 0,
    height: 280,
    overflow: 'hidden',
  },
  // ★ v107.31: Light sweep — panel arkasında diagonal ışık şeridi (5sn loop)
  lightSweep: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 80,
    opacity: 0.6,
  },
  // ★ v107.31: Ambient drift particle — alttan üste süzülen yıldız emoji (Text style)
  driftParticle: {
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 10,
  },
  headerTitle: {
    flex: 1, fontSize: 13, fontWeight: '900',
    letterSpacing: 1.2, ...iconShadow,
  },
  tierBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    borderWidth: 0.7,
  },
  tierBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1,
  },
  balanceText: { fontSize: 11, fontWeight: '800' },

  // ★ Host kartı — avatar merkezde, sahne ışığı altında parlar
  hostCardWrap: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 6,
  },
  hostGlowRing: {
    position: 'absolute',
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 2,
    top: 6, // avatar konumu ile align
  },
  hostAvatarWrap: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  hostAvatar: { width: '100%', height: '100%' } as any,
  hostInfo: {
    alignItems: 'center',
    gap: 4,
  },
  hostNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    flexWrap: 'wrap', justifyContent: 'center',
  },
  hostName: {
    fontSize: 16, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  hostLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    borderWidth: 0.7,
  },
  hostLabelText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  hostTierChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    borderWidth: 0.7,
  },
  hostTierText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  roomName: {
    fontSize: 11, color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    fontWeight: '500',
    marginTop: 2,
  },

  // Amount alanı
  amountWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 18,
  },
  amountHexWrap: {
    width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
  },
  amountValue: {
    fontSize: 42, fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 46,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  amountUnit: {
    fontSize: 16, fontWeight: '900', letterSpacing: 1,
    marginLeft: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  sliderWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, marginVertical: 10,
  },
  sliderMin: { fontSize: 10, fontWeight: '700', width: 16, textAlign: 'center' },
  sliderMax: { fontSize: 10, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  sliderTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    borderRadius: 4,
    ...Platform.select({
      android: {
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.4)',
      },
    }),
  },
  sliderThumb: {
    position: 'absolute', top: -6,
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2,
  },

  quickRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  quickBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  quickText: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.55)' },

  sendBtn: {
    marginHorizontal: 18, marginTop: 10,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
  },
  sendBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  sendBtnText: {
    fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
