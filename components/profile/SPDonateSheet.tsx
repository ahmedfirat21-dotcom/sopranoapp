// SopranoChat — SP Bağış Premium Sheet
// - Alttan sürüklenerek açılır/kapanır
// - Quick preset (5/10/25/50/100) + kaydırmalı slider
// - Altın premium tema (SP marka paleti)
// Referans: components/room/DonationDrawer.tsx

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
  Pressable, ActivityIndicator, GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileService } from '../../services/profile';
import { ClubService } from '../../services/clubs';
import { supabase } from '../../constants/supabase';
import { showToast } from '../Toast';
import SPSentSuccessModal from './SPSentSuccessModal';

const { width: W, height: H } = Dimensions.get('window');
const PANEL_CONTENT_HEIGHT = 340;
const SLIDER_WIDTH = Math.max(1, W - 80);
const QUICK_AMOUNTS = [5, 10, 25, 50, 100];
const MAX_SLIDER = 500;

// ★ 2026-04-21: SP miktarına göre modal tier paleti (success ekranıyla tutarlı)
type Tier = 'basic' | 'premium' | 'elite' | 'legendary';
const getTier = (amt: number): Tier =>
  amt >= 1000 ? 'legendary' : amt >= 250 ? 'elite' : amt >= 50 ? 'premium' : 'basic';

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
  /** ★ 2026-04-26: clubId verilirse SP kullanıcıya değil Koro hazinesine gider. */
  clubId?: string;
  onSuccess?: (amount: number) => void;
  /** Koro bağışı sonrası yeni hazine bakiyesini bildirir (opsiyonel). */
  onTreasuryUpdate?: (newBalance: number) => void;
}

export default function SPDonateSheet({
  visible, onClose, senderId, recipientId, recipientName, clubId, onSuccess, onTreasuryUpdate,
}: Props) {
  const insets = useSafeAreaInsets();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState(0);

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
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
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
      showToast({ title: 'Yetersiz bakiye', message: 'SP mağazadan yükleyebilirsin.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      // ★ 2026-04-26: Koro hazinesi bağışı vs kullanıcıya bağış
      if (clubId) {
        const r = await ClubService.contributeTreasury(clubId, amount, senderId);
        if (!mountedRef.current) return;
        if (!r.success) {
          showToast({ title: 'Bağış başarısız', message: r.error || '', type: 'error' });
          setLoading(false);
          return;
        }
        setBalance(prev => (prev ?? 0) - amount);
        onTreasuryUpdate?.(r.newBalance ?? 0);
        onSuccess?.(amount);
        setSuccessAmount(amount);
        setShowSuccess(true);
        onClose();
      } else {
        const result = await ProfileService.donateToUser(senderId, recipientId, amount);
        if (!mountedRef.current) return;
        if (!result.success) {
          showToast({ title: 'Bağış başarısız', type: 'error' });
          setLoading(false);
          return;
        }
        setBalance(prev => (prev ?? 0) - amount);
        onSuccess?.(amount);
        // ★ Premium success modal — toast yerine animasyonlu kutlama
        setSuccessAmount(amount);
        setShowSuccess(true);
        onClose();
      }
    } catch {
      if (mountedRef.current) showToast({ title: 'Bağış başarısız', type: 'error' });
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
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

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
          {/* ★ 2026-04-30: diamond → gelecekte inline SVG hexagon ile değiştirilecek (SPHexagonIcon WebView ağır) */}
          <Ionicons name={clubId ? 'planet' : 'diamond'} size={18} color={palette.accentSolid} style={iconShadow} />
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

        {/* Miktar göstergesi */}
        <View style={styles.amountWrap}>
          <Text style={[styles.amountValue, { color: palette.amountColor }]}>{amount.toLocaleString('tr-TR')}</Text>
          <Text style={[styles.amountLabel, { color: palette.amountColor + 'BF' }]}>SP</Text>
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
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name={clubId ? 'planet' : 'diamond'} size={16} color="#FFF" style={iconShadow} />
                <Text style={styles.sendBtnText}>{amount.toLocaleString('tr-TR')} SP {clubId ? 'Hazineye Ekle' : 'Gönder'}</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
      </View>
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
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.35)',
    borderBottomWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 24,
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

  amountWrap: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 5,
    paddingVertical: 6,
  },
  amountValue: {
    fontSize: 42, fontWeight: '900', color: '#FFD700',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  amountLabel: {
    fontSize: 16, fontWeight: '800', color: 'rgba(251,191,36,0.7)',
    marginBottom: 8,
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
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6,
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
  quickBtnActive: {
    backgroundColor: 'rgba(251,191,36,0.22)',
    borderColor: 'rgba(251,191,36,0.5)',
  },
  quickText: { fontSize: 13, fontWeight: '800', color: 'rgba(251,191,36,0.65)' },
  quickTextActive: {
    color: '#FFD700',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  sendBtn: {
    marginHorizontal: 18, marginTop: 4,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,224,130,0.5)',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  sendBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  sendBtnText: {
    fontSize: 15, fontWeight: '900', color: '#FFF', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
