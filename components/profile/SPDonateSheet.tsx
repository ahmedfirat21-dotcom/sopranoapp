// SopranoChat — SP Bağış Premium Sheet
// - Alttan sürüklenerek açılır/kapanır
// - Quick preset (5/10/25/50/100) + kaydırmalı slider
// - Altın premium tema (SP marka paleti)
// Referans: components/room/DonationDrawer.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
  Pressable, GestureResponderEvent, Platform, Easing,
} from 'react-native';
import AppLoader from '../AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileService } from '../../services/profile';
import { ClubService } from '../../services/clubs';
import { supabase } from '../../constants/supabase';
import { showToast } from '../Toast';
import SPSentSuccessModal from './SPSentSuccessModal';
import { getSPAmountTier, type SPAmountTier } from '../../constants/spAmountTier';
import SPHexagonIcon from '../SPHexagonIcon';
import SPIcon from '../SPIcon';
import PremiumAlert, { type AlertButton } from '../PremiumAlert';
import { useRouter } from 'expo-router';

const { width: W } = Dimensions.get('window');
// ★ v92: panel içi büyük hexagon eklendi (92px) → toplam yükseklik artırıldı
const PANEL_CONTENT_HEIGHT = 380;
const SLIDER_WIDTH = Math.max(1, W - 80);
// ★ v87 (1 May 2026): Quick preset'ler yeni tier eşikleriyle senkronize, her tier'ın gateway'i:
//   10 (basic) / 25 (premium ilk) / 100 (elite ilk) / 250 (elite orta) / 500 (legendary ilk)
const QUICK_AMOUNTS = [10, 25, 100, 250, 500];
// ★ v87: Slider 1-1000 — legendary tier (500+) erişilebilir, üst limit 2x ile flex alan.
const MAX_SLIDER = 1000;

// ★ v87: Merkezi tier helper kullanılıyor (constants/spAmountTier.ts) — DRY ihlali kaldırıldı.
type Tier = SPAmountTier;
const getTier = getSPAmountTier;

// ★ v86: Tier-based BlurView intensity — sinematik backdrop
const BLUR_INTENSITY: Record<Tier, number> = { basic: 25, premium: 40, elite: 55, legendary: 70 };
// ★ v86: Halo katman sayısı tier başına — miktar arttıkça zenginleşen 3D glow
const HALO_LAYERS: Record<Tier, number> = { basic: 0, premium: 1, elite: 2, legendary: 3 };

interface SheetPalette {
  border: string;
  topEdge: string;
  tintColor: string;       // iç katman ek tint
  amountColor: string;
  accentSolid: string;     // balance pill, active chip
  fillGrad: [string, string, string];
  thumbColor: string;
  sendBtnGrad: [string, string, string];
  labelText: string | null;
}

const SHEET_PALETTES: Record<Tier, SheetPalette> = {
  basic: {
    border: 'rgba(148,163,184,0.35)',
    topEdge: 'rgba(148,163,184,0.65)',
    tintColor: 'rgba(148,163,184,0.18)',
    amountColor: '#E2E8F0',
    accentSolid: '#94A3B8',
    fillGrad: ['#E2E8F0', '#94A3B8', '#64748B'],
    thumbColor: '#E2E8F0',
    sendBtnGrad: ['#94A3B8', '#64748B', '#475569'],
    labelText: null,
  },
  premium: {
    border: 'rgba(251,191,36,0.45)',
    topEdge: 'rgba(251,191,36,0.85)',
    tintColor: 'rgba(251,191,36,0.22)',
    amountColor: '#FFD700',
    accentSolid: '#FBBF24',
    fillGrad: ['#FFE082', '#FBBF24', '#D97706'],
    thumbColor: '#FFE082',
    sendBtnGrad: ['#FFE082', '#FBBF24', '#D97706'],
    labelText: 'PREMIUM',
  },
  elite: {
    border: 'rgba(244,114,182,0.55)',
    topEdge: 'rgba(244,114,182,0.9)',
    tintColor: 'rgba(244,114,182,0.22)',
    amountColor: '#FFE4E6',
    accentSolid: '#F472B6',
    fillGrad: ['#FCE7F3', '#F472B6', '#BE185D'],
    thumbColor: '#FCE7F3',
    sendBtnGrad: ['#FBCFE8', '#F472B6', '#BE185D'],
    labelText: 'ELITE',
  },
  legendary: {
    border: 'rgba(167,139,250,0.65)',
    topEdge: 'rgba(167,139,250,0.95)',
    tintColor: 'rgba(167,139,250,0.24)',
    amountColor: '#F5F3FF',
    accentSolid: '#A78BFA',
    fillGrad: ['#DDD6FE', '#A78BFA', '#7C3AED'],
    thumbColor: '#DDD6FE',
    sendBtnGrad: ['#DDD6FE', '#A78BFA', '#7C3AED'],
    labelText: 'LEGENDARY',
  },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  senderId: string;
  recipientId: string;
  recipientName: string;
  /** ★ v92.6 (1 May 2026): Alıcı avatar URL'i — başarı modalında küçük avatar gösterilir */
  recipientAvatar?: string;
  /** ★ 2026-04-26: clubId verilirse SP kullanıcıya değil Koro hazinesine gider. */
  clubId?: string;
  onSuccess?: (amount: number) => void;
  /** Koro bağışı sonrası yeni hazine bakiyesini bildirir (opsiyonel). */
  onTreasuryUpdate?: (newBalance: number) => void;
}

export default function SPDonateSheet({
  visible, onClose, senderId, recipientId, recipientName, recipientAvatar, clubId, onSuccess, onTreasuryUpdate,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // ★ v86: Sinematik pulse — tier-based glow ring loop animasyonu
  const ringPulse = useRef(new Animated.Value(0)).current;
  const ringPulse2 = useRef(new Animated.Value(0)).current;
  // ★ v92 (1 May 2026): Backdrop floating watermark hexagon — gem-aura efekti.
  //   Panel'in üstünde-merkezinde yavaşça yukarı-aşağı süzülerek uçar (parallax).
  const gemFloat = useRef(new Animated.Value(0)).current;
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);
  // ★ v92.1 (1 May 2026): Yetersiz bakiye alert — toast yerine premium modal,
  //   "Mağazaya Git" / "İptal" butonları (kullanıcı talebi).
  const [insufficientAlert, setInsufficientAlert] = useState<{ visible: boolean; needed: number }>({ visible: false, needed: 0 });

  const sliderRef = useRef<View>(null);
  const sliderX = useRef(0);
  const sliderMeasured = useRef(false);
  const sliderActiveRef = useRef(false);
  const lastSliderUpdate = useRef(0);

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
          if (__DEV__) console.warn('[SPDonateSheet] balance fetch failed:', e);
        }
      })();
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      // ★ v86: Sinematik pulse loop — halo katmanları için
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(ringPulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulse2, { toValue: 1, duration: 2400, useNativeDriver: true }),
          Animated.timing(ringPulse2, { toValue: 0, duration: 2400, useNativeDriver: true }),
        ]),
      ).start();
      // ★ v92: Gem-float (yumuşak yukarı-aşağı süzülme + scale)
      Animated.loop(
        Animated.sequence([
          Animated.timing(gemFloat, { toValue: 1, duration: 3500, useNativeDriver: true }),
          Animated.timing(gemFloat, { toValue: 0, duration: 3500, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      ringPulse.stopAnimation();
      ringPulse2.stopAnimation();
      gemFloat.stopAnimation();
    }
  }, [visible]);

  // Panel kapatma gesture — sadece handle alanında
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      // ★ 2026-04-28: Pan tüm sheet'e bağlı (Clubhouse). Slider yatay, dy küçük kalır → çakışma yok.
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
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  const calcAmount = (pageX: number, originX: number) => {
    const touchX = pageX - originX;
    const ratio = Math.max(0, Math.min(1, touchX / SLIDER_WIDTH));
    const val = Math.max(1, Math.round(ratio * MAX_SLIDER));
    return Number.isFinite(val) ? val : 1;
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
  }, []);

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
  }, []);

  const handleSliderRelease = useCallback(() => {
    sliderActiveRef.current = false;
  }, []);

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const handleDonate = async () => {
    if (amount <= 0 || loading) return;
    if (!clubId && senderId === recipientId) return;
    if (balance !== null && balance < amount) {
      // ★ v92.1: Premium alert + "Mağazaya Git" yönlendirmesi
      setInsufficientAlert({ visible: true, needed: amount - (balance ?? 0) });
      return;
    }

    // ★ v92.1 (1 May 2026): OPTIMISTIC UI — kullanıcı butona basar basmaz success modal
    //   açılır, DB write arka planda devam eder. Hata olursa balance rollback + toast.
    //   Eski: DB await sonra modal → 800-1500ms gecikme. Yeni: anlık feedback.
    const sentAmount = amount;
    setBalance(prev => (prev ?? 0) - sentAmount);
    setSuccessAmount(sentAmount);
    setShowSuccess(true);
    onClose();

    try {
      if (clubId) {
        const r = await ClubService.contributeTreasury(clubId, sentAmount, senderId);
        if (!mountedRef.current) return;
        if (!r.success) {
          // Rollback
          setBalance(prev => (prev ?? 0) + sentAmount);
          setShowSuccess(false);
          showToast({ title: 'Bağış başarısız', message: r.error || '', type: 'error' });
          return;
        }
        onTreasuryUpdate?.(r.newBalance ?? 0);
        onSuccess?.(sentAmount);
      } else {
        const result = await ProfileService.donateToUser(senderId, recipientId, sentAmount);
        if (!mountedRef.current) return;
        if (!result.success) {
          // Rollback
          setBalance(prev => (prev ?? 0) + sentAmount);
          setShowSuccess(false);
          // ★ v92.28 (2 May 2026): Spesifik hata mesajı — kullanıcı neden başarısız
          //   olduğunu bilmek istiyor (welcome bonus exploit, rate limit, yetersiz, vs.)
          showToast({
            title: 'Bağış başarısız',
            message: result.error || 'Bilinmeyen bir hata oluştu, lütfen tekrar dene.',
            type: 'error',
          });
          return;
        }
        onSuccess?.(sentAmount);
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setBalance(prev => (prev ?? 0) + sentAmount);
        setShowSuccess(false);
        showToast({
          title: 'Bağış başarısız',
          message: e?.message || 'Beklenmeyen bir hata, internet bağlantını kontrol et.',
          type: 'error',
        });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const canDonate = amount > 0 && balance !== null && balance >= amount && (!!clubId || senderId !== recipientId);
  const fillRatio = (amount - 1) / (MAX_SLIDER - 1);
  // ★ 2026-04-21: Miktar arttıkça modal paleti değişir
  const tier = getTier(amount);
  const palette = SHEET_PALETTES[tier];

  if (!visible && !showSuccess) return null;

  // ★ Başarı modalı aktifse sadece onu göster (sheet kapanmış)
  if (showSuccess) {
    return (
      <SPSentSuccessModal
        visible={showSuccess}
        amount={successAmount}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        onClose={() => setShowSuccess(false)}
      />
    );
  }

  return (
    // ★ 2026-04-28: Modal sarmalı kaldırıldı (InRoomUserProfile/FollowListModal ile aynı pattern).
    //   Modal native dialog Pressable backdrop tap'i + pan responder Capture phase'i Pressable
    //   child'larla çakışıyordu → drag çalışmıyor, sadece backdrop tap kapatabiliyordu.
    //   View overlay zIndex:500 — InRoomUserProfile (300) ve FollowListModal (400) üstünde.
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 500 }} pointerEvents="box-none">
      {/* ★ v86: Sinematik backdrop — BlurView + tier-based intensity + dim layer */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
        <BlurView intensity={BLUR_INTENSITY[tier]} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* ★ v92 (1 May 2026): Floating gem-aura watermark — DiscoveryWelcomeSheet
          kalitesinde panel'in üstünde uçan dev tier-aware hexagon. Parallax: panel
          translateY * 0.35 ile birlikte hareket eder, kendi gem-float animasyonuyla
          süzülür (3.5sn cycle), tier rengine göre paletini değiştirir. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.gemAuraWrap,
          {
            opacity: Animated.multiply(
              backdropOpacity,
              gemFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.20, 0.10] }),
            ),
            transform: [
              { translateY: Animated.add(translateY.interpolate({ inputRange: [0, PANEL_HEIGHT], outputRange: [0, -40], extrapolate: 'clamp' }), gemFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -8, 0] })) },
              { scale: gemFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.0, 1.06, 1.0] }) },
              { rotate: gemFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-2deg', '2deg', '-2deg'] }) },
            ],
          },
        ]}
      >
        <SPHexagonIcon size={240} tier={tier as any} />
      </Animated.View>

      {/* ★ v86: Tier-based halo katmanları — panel'in arkasında pulsing 3D glow,
          miktar arttıkça katman sayısı artar (premium=1, elite=2, legendary=3) */}
      {HALO_LAYERS[tier] >= 1 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.haloLayer1,
            {
              transform: [
                { translateY },
                { scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.08] }) },
              ],
              opacity: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
            },
          ]}
        >
          <LinearGradient
            colors={[palette.accentSolid + '00', palette.accentSolid + '55', palette.accentSolid + '00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
      {HALO_LAYERS[tier] >= 2 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.haloLayer2,
            {
              transform: [
                { translateY },
                { scale: ringPulse2.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.15] }) },
              ],
              opacity: ringPulse2.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] }),
            },
          ]}
        >
          <LinearGradient
            colors={[palette.accentSolid + '00', palette.accentSolid + '70', palette.accentSolid + '00']}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
      {HALO_LAYERS[tier] >= 3 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.haloLayer3,
            {
              transform: [
                { translateY },
                { scale: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.22] }) },
              ],
              opacity: ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.35] }),
            },
          ]}
        >
          <LinearGradient
            colors={[palette.accentSolid + '00', palette.accentSolid + '88', palette.accentSolid + '00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}

      {/* Panel — border/tint/edge tier paletinden gelir */}
      <Animated.View
        style={[styles.panel, { borderColor: palette.border, paddingBottom: 28 + insets.bottom, transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Koyu zemin */}
        <LinearGradient
          colors={['#2a1e14', '#17100a', '#0a0604']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Tier tint — amount değiştikçe renk geçişi */}
        <LinearGradient
          colors={[palette.tintColor, palette.tintColor.replace(/[\d.]+\)$/, '0.06)'), 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['transparent', palette.topEdge, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.topEdge}
        />

        {/* ★ 2026-04-28: Handle artık görsel — pan tüm sheet'te (Clubhouse). */}
        <View style={styles.handle}>
          <View style={[styles.handleBar, { backgroundColor: palette.accentSolid + '73' }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          {/* ★ v92 (1 May 2026): Ionicons "diamond" → SPIcon (PNG hexagon) — marka tutarlılığı.
              Hazine bağışında "planet" korunur (oda hazinesi sembolü).
              ★ v92.1: ikon 20→28 büyütüldü (header'da daha belirgin). */}
          {clubId ? (
            <Ionicons name="planet" size={20} color={palette.accentSolid} style={iconShadow} />
          ) : (
            <SPIcon size={28} />
          )}
          <Text style={styles.headerTitle}>{clubId ? 'HAZİNEYE BAĞIŞ' : 'SP BAĞIŞLA'}</Text>
          {palette.labelText && (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: palette.accentSolid + '22', borderWidth: 0.7, borderColor: palette.accentSolid + '60' }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: palette.accentSolid, letterSpacing: 1.2 }}>{palette.labelText}</Text>
            </View>
          )}
          <View style={[styles.balancePill, { backgroundColor: palette.accentSolid + '1A', borderColor: palette.accentSolid + '33' }]}>
            <Ionicons name="wallet" size={10} color={palette.accentSolid} />
            <Text style={[styles.balanceText, { color: palette.accentSolid }]}>{balance !== null ? balance.toLocaleString('tr-TR') : '...'}</Text>
          </View>
        </View>

        {/* Alıcı */}
        <Text style={styles.recipientText}>
          <Text style={{ color: palette.accentSolid, fontWeight: '800' }}>{recipientName}</Text>
          <Text>{clubId ? ' Korosunun hazinesine' : ' adlı kullanıcıya'}</Text>
        </Text>

        {/* ★ v92 (1 May 2026): Miktar göstergesi — tier-aware hexagon + sayı/SP.
            Hexagon kendi içinde gem-float + halo + facet-bright animasyonlarına sahip. */}
        <View style={styles.amountWrap}>
          <View style={styles.amountHexWrap}>
            <SPHexagonIcon size={92} tier={tier as any} />
          </View>
          {/* ★ v92.1 (1 May 2026): "SP" alt label kaldırıldı — modalın her yerinde SP zaten yazıyor. */}
          <Text style={[styles.amountValue, { color: palette.amountColor }]}>{amount.toLocaleString('tr-TR')}</Text>
        </View>

        {/* Slider */}
        <View style={styles.sliderWrap}>
          <Text style={styles.sliderMin}>1</Text>
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
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.sliderFill, { width: `${fillRatio * 100}%` }]}
            />
            <View style={[styles.sliderThumb, { backgroundColor: palette.thumbColor, borderColor: palette.accentSolid, left: Math.max(0, Math.min(fillRatio * SLIDER_WIDTH - 10, SLIDER_WIDTH - 20)) }]} />
          </View>
          <Text style={styles.sliderMax}>{MAX_SLIDER}</Text>
        </View>

        {/* Quick presets */}
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map(q => {
            const active = amount === q;
            const qTier = getTier(q);
            const qAccent = SHEET_PALETTES[qTier].accentSolid;
            return (
              <Pressable
                key={q}
                style={[
                  styles.quickBtn,
                  active && { backgroundColor: qAccent + '26', borderColor: qAccent },
                ]}
                onPress={() => setAmount(q)}
              >
                <Text style={[styles.quickText, active && { color: qAccent }]}>{q}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Gönder butonu — tier gradient */}
        <Pressable
          style={[styles.sendBtn, !canDonate && { opacity: 0.4 }]}
          onPress={handleDonate}
          disabled={!canDonate || loading}
        >
          <LinearGradient
            colors={palette.sendBtnGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.sendBtnGrad}
          >
            {loading ? (
              <AppLoader color="#FFF" size="small" />
            ) : (
              <>
                {clubId ? (
                  <Ionicons name="planet" size={18} color="#FFF" style={iconShadow} />
                ) : (
                  <SPIcon size={26} />
                )}
                <Text style={styles.sendBtnText}>{amount.toLocaleString('tr-TR')} SP {clubId ? 'Hazineye Ekle' : 'Gönder'}</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
      </View>

      {/* ★ v92.1 (1 May 2026): Yetersiz bakiye alert — "Mağazaya Git" yönlendirmesi */}
      <PremiumAlert
        visible={insufficientAlert.visible}
        title="Yetersiz SP"
        message={`${insufficientAlert.needed} SP eksik. Mağazadan SP yükleyip bağışını tamamlayabilirsin.`}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: Platform.OS === 'android' ? 2 : 1.5,
    // ★ v86: Android border parlaklığı arttırıldı, glow yerine sharp altın çerçeve
    borderColor: Platform.OS === 'android' ? 'rgba(251,191,36,0.55)' : 'rgba(251,191,36,0.35)',
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
      },
      android: {
        // Android elevation üst gölge için yetersiz — modal'lar için subtle elevation yeterli
        elevation: 12,
      },
    }),
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(251,191,36,0.45)' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingBottom: 8,
  },
  headerTitle: {
    flex: 1, fontSize: 13, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 1.2, ...iconShadow,
  },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  balanceText: { fontSize: 11, fontWeight: '800', color: '#FBBF24' },

  recipientText: {
    fontSize: 12, color: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 18, marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // ★ v92: amount alanı yatay layout — sol tier-aware hexagon (92×92), sağ sayı+SP yığını.
  amountWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14,
    paddingVertical: 4,
    paddingHorizontal: 18,
  },
  amountHexWrap: {
    width: 92, height: 92,
    alignItems: 'center', justifyContent: 'center',
  },
  amountTextCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  amountValue: {
    fontSize: 46, fontWeight: '900', color: '#FFD700',
    letterSpacing: -1.5,
    lineHeight: 50,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  amountLabel: {
    fontSize: 14, fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: -4,
    color: 'rgba(251,191,36,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  sliderWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, marginVertical: 8,
  },
  sliderMin: { fontSize: 10, fontWeight: '700', color: 'rgba(251,191,36,0.45)', width: 24, textAlign: 'center' },
  sliderMax: { fontSize: 10, fontWeight: '700', color: 'rgba(251,191,36,0.45)', width: 32, textAlign: 'center' },
  sliderTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.2)',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    borderRadius: 4,
    // ★ v86: iOS'ta neon glow, Android'de görünmez idi → border highlight
    ...Platform.select({
      ios: {
        shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6, shadowRadius: 6,
      },
      android: {
        borderWidth: 0.5,
        borderColor: 'rgba(255,224,130,0.7)',
      },
    }),
  },
  sliderThumb: {
    position: 'absolute', top: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FFD700',
    borderWidth: 2, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4,
    elevation: 6,
  },

  quickRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  quickBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  // ★ v86: quickBtnActive ve quickTextActive kaldırıldı — render'da inline override yapılıyor (kullanılmıyordu)
  quickText: { fontSize: 13, fontWeight: '800', color: 'rgba(251,191,36,0.65)' },

  sendBtn: {
    marginHorizontal: 18, marginTop: 4,
    borderRadius: 14, overflow: 'hidden',
    // ★ v86: Android'de renkli neon glow yok — kalın parlak altın çerçeve telafi ediyor
    borderWidth: Platform.OS === 'android' ? 2 : 1,
    borderColor: Platform.OS === 'android' ? 'rgba(255,224,130,0.85)' : 'rgba(255,224,130,0.5)',
    ...Platform.select({
      ios: {
        shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45, shadowRadius: 10,
      },
      android: {
        elevation: 6,  // subtle drop shadow (gri ama varlığı belli olsun)
      },
    }),
  },
  sendBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  sendBtnText: {
    fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  // ★ v92 (1 May 2026): Floating gem-aura watermark — panel üstü dev hexagon glow.
  //   DiscoveryWelcomeSheet kalitesinde, parallax + gem-float ile süzülür.
  gemAuraWrap: {
    position: 'absolute',
    top: '20%',
    left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ★ v86: Sinematik halo katmanları — panel'in arkasında concentric pulse glow
  //   panel translateY ile birlikte hareket eder, scale + opacity ile pulse.
  haloLayer1: {
    position: 'absolute',
    bottom: 0, left: -20, right: -20,
    height: PANEL_CONTENT_HEIGHT + 40,
    borderRadius: 200,
  },
  haloLayer2: {
    position: 'absolute',
    bottom: -30, left: -50, right: -50,
    height: PANEL_CONTENT_HEIGHT + 80,
    borderRadius: 240,
  },
  haloLayer3: {
    position: 'absolute',
    bottom: -60, left: -90, right: -90,
    height: PANEL_CONTENT_HEIGHT + 140,
    borderRadius: 300,
  },
});
