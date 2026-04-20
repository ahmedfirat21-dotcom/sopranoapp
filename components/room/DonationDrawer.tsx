/**
 * SopranoChat — Bağış Drawer
 * Oda içinde host'a SP bağışı yapmak için slider ile miktar seçilen panel.
 * Alt barın arkasından yukarı kayarak açılır, aşağı sürükleyerek kapatılır.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Dimensions, Pressable, ActivityIndicator, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileService } from '../../services/profile';
import { supabase } from '../../constants/supabase';

const { width: W } = Dimensions.get('window');
const PANEL_HEIGHT = 280;
// Math.max(1) — sıfıra bölme koruması (edge-case: çok küçük ekranlar)
const SLIDER_WIDTH = Math.max(1, W - 80);
const QUICK_AMOUNTS = [5, 10, 25, 50, 100];

interface Props {
  visible: boolean;
  onClose: () => void;
  senderId: string;
  hostId: string;
  hostName: string;
  bottomInset: number;
  onSuccess?: (amount: number) => void;
}

export default function DonationDrawer({ visible, onClose, senderId, hostId, hostName, bottomInset, onSuccess }: Props) {
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const sliderRef = useRef<View>(null);
  const sliderX = useRef(0); // Slider sol kenarının ekran x'i
  const sliderMeasured = useRef(false); // ★ BUG FIX: x=0 geçerli bir pozisyon olabilir — ayrı flag
  const sliderActiveRef = useRef(false); // Slider gesture aktif mi — panel PanResponder'ı engelle
  const lastSliderUpdate = useRef(0); // ★ BUG FIX: Throttle — aşırı re-render'ı önle

  useEffect(() => {
    if (visible) {
      setAmount(10);
      setLoading(false);
      sliderMeasured.current = false; // ★ BUG FIX: Yeniden ölçüm gerekli
      // ★ Balance'ı doğrudan profiles'dan çek (GamificationService importu kaldırıldı)
      (async () => {
        try {
          const { data } = await supabase.from('profiles').select('system_points').eq('id', senderId).single();
          setBalance(data?.system_points ?? 0);
        } catch { /* sessiz */ }
      })();
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Panel kapatma gesture'ı — ★ FIX: Sadece handle alanına uygulanacak, slider ile çakışmayacak
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true }).start(() => onCloseRef.current());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },
      onPanResponderTerminationRequest: () => true,
    })
  ).current;

  const calcAmount = (pageX: number, originX: number) => {
    const touchX = pageX - originX;
    const ratio = Math.max(0, Math.min(1, touchX / SLIDER_WIDTH));
    const val = Math.max(1, Math.round(ratio * 100));
    return Number.isFinite(val) ? val : 1;
  };

  // Custom slider touch handler — ★ FIX: Tüm callback'ler try-catch korumalı
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
    } catch {
      // ★ BUG FIX: measureInWindow crash koruması
    }
  }, []);

  const handleSliderMove = useCallback((e: GestureResponderEvent) => {
    try {
      // ★ BUG FIX: Ölçüm tamamlanmadıysa güncelleme yapma
      if (!sliderMeasured.current) return;
      const pageX = e.nativeEvent?.pageX;
      if (pageX == null || !Number.isFinite(pageX)) return;
      // ★ BUG FIX: Throttle — 16ms (60fps) aralıkla güncelle, aşırı re-render crash'ini önle
      const now = Date.now();
      if (now - lastSliderUpdate.current < 16) return;
      lastSliderUpdate.current = now;
      setAmount(calcAmount(pageX, sliderX.current));
    } catch {
      // Sessiz — crash önleme
    }
  }, []);

  const handleSliderRelease = useCallback(() => {
    sliderActiveRef.current = false;
  }, []);

  // ★ O6 FIX: Drawer unmount olursa setState çağırma — React warning ve stale state engeli.
  // ProfileService.donateToUser K6'dan beri idempotent: in-flight request tamamlanır,
  // çift kayıt olmaz.
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const handleDonate = async () => {
    if (amount <= 0 || loading) return;
    if (senderId === hostId) return; // ★ SEC-DONATE: Self-donation engeli
    setLoading(true);
    try {
      const result = await ProfileService.donateToUser(senderId, hostId, amount);
      if (!mountedRef.current) return;
      if (!result.success) {
        onSuccess?.(-1);
        setLoading(false);
        return;
      }
      setBalance(prev => (prev ?? 0) - amount);
      onSuccess?.(amount);
      onClose();
    } catch {
      if (mountedRef.current) onSuccess?.(-1);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  if (!visible) return null;

  const BAR_OFFSET = bottomInset + 56;
  const canDonate = amount > 0 && balance !== null && balance >= amount && senderId !== hostId;
  const fillRatio = (amount - 1) / 99;

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 48 }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} />
        </Pressable>
      </Animated.View>

      {/* Panel — ★ FIX: panHandlers artık sadece handle alanında, tüm panel'de değil */}
      <Animated.View
        style={[styles.panel, { bottom: BAR_OFFSET, transform: [{ translateY }] }]}
      >
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]} />
        {/* Sürükleme tutamağı — panHandlers SADECE buraya bağlı */}
        <View style={styles.handle} {...panResponder.panHandlers}>
          <View style={styles.handleBar} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="heart" size={18} color="#EF4444" />
          <Text style={styles.headerTitle}>Bağış Yap</Text>
          <View style={styles.balancePill}>
            <Ionicons name="diamond" size={10} color="#D4AF37" />
            <Text style={styles.balanceText}>{balance !== null ? balance : '...'} SP</Text>
          </View>
        </View>

        {/* Alıcı bilgisi */}
        <Text style={styles.recipientText}>
          <Text style={{ color: '#14B8A6', fontWeight: '700' }}>{hostName}</Text>'a bağış gönder
        </Text>

        {/* Miktar göstergesi */}
        <View style={styles.amountWrap}>
          <Text style={styles.amountValue}>{amount}</Text>
          <Text style={styles.amountLabel}>SP</Text>
        </View>

        {/* Custom Slider */}
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
            {/* Dolgu */}
            <View style={[styles.sliderFill, { width: `${fillRatio * 100}%` }]} />
            {/* Thumb — ★ BUG FIX: left değerini clamp et — negatif değer layout crash'ine neden olabilir */}
            <View style={[styles.sliderThumb, { left: Math.max(0, Math.min(fillRatio * SLIDER_WIDTH - 10, SLIDER_WIDTH - 20)) }]} />
          </View>
          <Text style={styles.sliderMax}>100</Text>
        </View>

        {/* Hızlı seçim butonları */}
        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map(q => (
            <Pressable
              key={q}
              style={[styles.quickBtn, amount === q && styles.quickBtnActive]}
              onPress={() => setAmount(q)}
            >
              <Text style={[styles.quickText, amount === q && styles.quickTextActive]}>{q}</Text>
            </Pressable>
          ))}
        </View>

        {/* Gönder butonu */}
        <Pressable
          style={[styles.sendBtn, !canDonate && { opacity: 0.4 }]}
          onPress={handleDonate}
          disabled={!canDonate || loading}
        >
          <LinearGradient
            colors={['#EF4444', '#DC2626', '#B91C1C']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.sendBtnGrad}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="heart" size={16} color="#FFF" />
                <Text style={styles.sendBtnText}>{amount} SP Bağış Yap</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  handle: { alignItems: 'center', paddingVertical: 14 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#F1F5F9' },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
  },
  balanceText: { fontSize: 11, fontWeight: '700', color: '#D4AF37' },

  recipientText: { fontSize: 12, color: 'rgba(255,255,255,0.5)', paddingHorizontal: 16, marginBottom: 4 },

  amountWrap: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4,
    paddingVertical: 2,
  },
  amountValue: { fontSize: 36, fontWeight: '900', color: '#EF4444' },
  amountLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(239,68,68,0.6)', marginBottom: 6 },

  sliderWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginVertical: 4,
  },
  sliderMin: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', width: 20, textAlign: 'center' },
  sliderMax: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', width: 20, textAlign: 'center' },
  sliderTrack: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  sliderThumb: {
    position: 'absolute', top: -7,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
    elevation: 4,
  },

  quickRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  quickBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  quickBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.35)',
  },
  quickText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  quickTextActive: { color: '#EF4444' },

  sendBtn: {
    marginHorizontal: 16, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 6,
  },
  sendBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13,
  },
  sendBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
