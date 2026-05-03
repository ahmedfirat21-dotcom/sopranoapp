/**
 * SopranoChat — Koro Hazinesi Sheet (koroya SP katkısı)
 * ═══════════════════════════════════════════════════════════════════
 * v107.6 (2 May 2026) — SPDonateSheet'in koro hazinesi ayrımı.
 * Eski tek-modal-her-bağlam yaklaşımı bölündü; bu sheet SADECE koroya
 * (eski kulüp) topluluk yatırımı yapma akışı için.
 *
 * Tema: KORO HAZİNESİ
 *   - Watermark: 💰 emoji (sağ üst, -15° eğik) — hazine sandığı hissi
 *   - Koro kartı: avatar + isim + üye sayısı + MEVCUT HAZİNE (büyük gösterilir)
 *   - Mesaj input YOK — topluluğa katkı, kişisel mesaj uygun değil
 *   - Buton: "X SP Hazineye Katkı"
 *   - Bireye bağış değil → ProfileService.donateToUser DEĞİL,
 *     ClubService.contributeTreasury çağrılır
 *
 * Tutarlılık (Hediye/Sahne ile ortak):
 *   - Tier paleti: constants/tierColors.ts (paylaşılan)
 *   - Yumuşak 4-stop gradient, locations [0, 0.4, 0.75, 1] — keskin geçiş yok
 *   - Android: shadowColor yok, border + iç gradient + tierShadow helper
 *   - Drag-to-dismiss (X butonu YOK)
 *   - Bakiye-aware slider/chip
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
  Pressable, GestureResponderEvent, Platform, Image,
} from 'react-native';
import AppLoader from '../AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ClubService } from '../../services/clubs';
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

const PANEL_CONTENT_HEIGHT = 510; // Hediye'den biraz daha kısa (mesaj yok), Sahne'den uzun (treasury bilgisi var)
const SLIDER_WIDTH = Math.max(1, W - 80);
const QUICK_AMOUNTS = [10, 25, 100, 250, 500];
const MIN_AMOUNT = 10; // ★ v107.18: Min katkı 10 SP
const HARD_MAX = 1000;

interface Props {
  visible: boolean;
  onClose: () => void;
  senderId: string;
  /** Koro ID'si — bağış buraya gider */
  clubId: string;
  /** Koro adı */
  clubName: string;
  /** Koro avatarı / logosu */
  clubAvatar?: string | null;
  /** Mevcut hazine bakiyesi — kart üstünde büyük gösterilir */
  treasuryBalance: number;
  /** Üye sayısı */
  memberCount: number;
  /** Premium koro mu? — rozet gösterilir */
  isPremium?: boolean;
  /** Bağış başarılı olunca yeni hazine bakiyesi callback ile bildirilir */
  onTreasuryUpdate?: (newBalance: number) => void;
  onSuccess?: (amount: number) => void;
}

export default function TreasurySheet({
  visible, onClose, senderId, clubId, clubName, clubAvatar,
  treasuryBalance, memberCount, isPremium, onTreasuryUpdate, onSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Watermark süzülme — 4sn cycle
  const moneyFloat = useRef(new Animated.Value(0)).current;
  // Koro avatar breathing
  const clubBreath = useRef(new Animated.Value(0)).current;
  // Treasury sayacı pulse — kart içinde para birikim hissi
  const treasuryPulse = useRef(new Animated.Value(0)).current;
  // Hexagon scale spring
  const hexScale = useRef(new Animated.Value(1)).current;

  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  // Optimistic treasury — bağış sonrası kartta hemen güncellensin
  const [displayedTreasury, setDisplayedTreasury] = useState(treasuryBalance);
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

  const effectiveMax = balance !== null ? Math.max(1, Math.min(HARD_MAX, balance)) : HARD_MAX;

  // Treasury balance prop'u dışarıdan değişirse senkronize et
  useEffect(() => {
    setDisplayedTreasury(treasuryBalance);
  }, [treasuryBalance]);

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
          if (__DEV__) console.warn('[TreasurySheet] balance fetch failed:', e);
        }
      })();
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      // Watermark süzülme
      Animated.loop(
        Animated.sequence([
          Animated.timing(moneyFloat, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(moneyFloat, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
      ).start();
      // Koro avatar breathing
      Animated.loop(
        Animated.sequence([
          Animated.timing(clubBreath, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(clubBreath, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      ).start();
      // Treasury sayacı subtle pulse — para birikim hissi
      Animated.loop(
        Animated.sequence([
          Animated.timing(treasuryPulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(treasuryPulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      moneyFloat.stopAnimation();
      clubBreath.stopAnimation();
      treasuryPulse.stopAnimation();
    }
  }, [visible]);

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

  const handleContribute = async () => {
    if (amount <= 0 || loading) return;
    if (balance !== null && balance < amount) {
      setInsufficientAlert({ visible: true, needed: amount - (balance ?? 0) });
      return;
    }

    // Optimistic UI
    const sentAmount = amount;
    setBalance(prev => (prev ?? 0) - sentAmount);
    setDisplayedTreasury(prev => prev + sentAmount); // hazine kartında hemen güncelle
    setSuccessAmount(sentAmount);
    setShowSuccess(true);
    onClose();

    try {
      const r = await ClubService.contributeTreasury(clubId, sentAmount, senderId);
      if (!mountedRef.current) return;
      if (!r.success) {
        // Rollback
        setBalance(prev => (prev ?? 0) + sentAmount);
        setDisplayedTreasury(prev => prev - sentAmount);
        setShowSuccess(false);
        showToast({
          title: 'Katkı gönderilemedi',
          message: r.error || 'Bilinmeyen bir hata oluştu, lütfen tekrar dene.',
          type: 'error',
        });
        return;
      }
      onTreasuryUpdate?.(r.newBalance ?? 0);
      onSuccess?.(sentAmount);
    } catch (e: any) {
      if (mountedRef.current) {
        setBalance(prev => (prev ?? 0) + sentAmount);
        setDisplayedTreasury(prev => prev - sentAmount);
        setShowSuccess(false);
        showToast({
          title: 'Katkı gönderilemedi',
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
  const canContribute = amount >= MIN_AMOUNT && balance !== null && balance >= amount;
  const fillRatio = effectiveMax > MIN_AMOUNT ? (amount - MIN_AMOUNT) / (effectiveMax - MIN_AMOUNT) : 0;

  if (!visible && !showSuccess) return null;

  if (showSuccess) {
    return (
      <SPSentSuccessModal
        visible={showSuccess}
        amount={successAmount}
        recipientName={`${clubName} Korosu`}
        recipientAvatar={clubAvatar || undefined}
        variant="compact"
        onClose={() => setShowSuccess(false)}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 500 }} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Watermark — 💰 emoji sağ üstte eğik (Hediye paketi pattern'iyle tutarlı) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.watermark,
            {
              opacity: Animated.multiply(
                backdropOpacity,
                moneyFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.20, 0.10] }),
              ),
              transform: [
                {
                  translateY: Animated.add(
                    translateY.interpolate({ inputRange: [0, PANEL_HEIGHT], outputRange: [0, -30], extrapolate: 'clamp' }),
                    moneyFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -5, 0] }),
                  ),
                },
                { translateX: moneyFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] }) },
                { scale: moneyFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.0, 1.05, 1.0] }) },
                { rotate: '-15deg' },
              ],
            },
          ]}
        >
          <Text style={styles.watermarkEmoji} allowFontScaling={false}>💰</Text>
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
          {/* Koyu zemin */}
          <LinearGradient
            colors={PANEL_BG_GRADIENT}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Tier tint */}
          <LinearGradient
            colors={[palette.accentTint, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
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
            <Ionicons name="business" size={20} color={palette.accent} style={iconShadow} />
            <Text style={[styles.headerTitle, { color: palette.accent }]}>HAZİNEYE KATKI</Text>
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

          {/* Koro kartı — avatar + isim + üye sayısı + MEVCUT HAZİNE (büyük) */}
          <View style={[styles.clubCard, { borderColor: palette.accent + '33' }]}>
            <LinearGradient
              colors={[palette.accentTint, 'rgba(255,255,255,0.02)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.clubHeaderRow}>
              <Animated.View
                style={[
                  styles.clubAvatarWrap,
                  {
                    borderColor: palette.accent + 'AA',
                    transform: [{
                      scale: clubBreath.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.03] }),
                    }],
                  },
                ]}
              >
                <Image source={getAvatarSource(clubAvatar)} style={styles.clubAvatar} />
              </Animated.View>
              <View style={styles.clubInfo}>
                <Text style={styles.clubName} numberOfLines={1}>{clubName}</Text>
                <View style={styles.clubMetaRow}>
                  <Ionicons name="people" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.clubMetaText}>{memberCount.toLocaleString('tr-TR')} Üye</Text>
                  {isPremium && (
                    <View style={[styles.premiumChip, { borderColor: palette.accent + '55' }]}>
                      <Ionicons name="star" size={8} color={palette.accent} />
                      <Text style={[styles.premiumChipText, { color: palette.accent }]}>PREMIUM</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            {/* Mevcut Hazine — büyük, pulse efektiyle */}
            <View style={[styles.treasuryRow, { borderTopColor: palette.accent + '22' }]}>
              <View style={styles.treasuryLabelRow}>
                <Ionicons name="server" size={11} color={palette.accent + 'AA'} />
                <Text style={[styles.treasuryLabel, { color: palette.accent + 'AA' }]}>MEVCUT HAZİNE</Text>
              </View>
              <Animated.Text
                style={[
                  styles.treasuryAmount,
                  {
                    color: palette.accent,
                    transform: [{
                      scale: treasuryPulse.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.015] }),
                    }],
                    textShadowColor: palette.accent + '55',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 8,
                  },
                ]}
                allowFontScaling={false}
              >
                {displayedTreasury.toLocaleString('tr-TR')}
                <Text style={[styles.treasuryUnit, { color: palette.accent + 'CC' }]}> SP</Text>
              </Animated.Text>
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

          {/* Quick presets */}
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

          {/* Hazineye Katkı butonu */}
          <Pressable
            style={[
              styles.sendBtn,
              tierButtonShadow(palette.accent),
              { borderColor: palette.fillGrad[0] + (Platform.OS === 'android' ? 'CC' : '99') },
              !canContribute && { opacity: 0.4 },
            ]}
            onPress={handleContribute}
            disabled={!canContribute || loading}
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
                  <Ionicons name="business" size={18} color="#FFF" style={iconShadow} />
                  <Text style={styles.sendBtnText}>
                    {amount.toLocaleString('tr-TR')} SP Hazineye Katkı
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
        message={`${insufficientAlert.needed} SP eksik. Mağazadan SP yükleyip korona katkı yapabilirsin.`}
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
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 40, height: 4, borderRadius: 2 },

  // Watermark — 💰 sağ üstte eğik
  watermark: {
    position: 'absolute',
    top: '8%',
    right: -30,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  watermarkEmoji: {
    fontSize: 220,
    lineHeight: 250,
    textAlign: 'center',
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

  // ★ Koro kartı — avatar + isim + üye sayısı + treasury bilgisi
  clubCard: {
    marginHorizontal: 18, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  clubHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 10,
  },
  clubAvatarWrap: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2,
    overflow: 'hidden',
  },
  clubAvatar: { width: '100%', height: '100%' } as any,
  clubInfo: { flex: 1, gap: 3 },
  clubName: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.2,
  },
  clubMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    flexWrap: 'wrap',
  },
  clubMetaText: {
    fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600',
  },
  premiumChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5,
    borderWidth: 0.7,
    marginLeft: 4,
  },
  premiumChipText: {
    fontSize: 8, fontWeight: '900', letterSpacing: 0.8,
  },
  treasuryRow: {
    paddingTop: 10,
    borderTopWidth: 1,
  },
  treasuryLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 2,
  },
  treasuryLabel: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.2,
  },
  treasuryAmount: {
    fontSize: 26, fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  treasuryUnit: {
    fontSize: 14, fontWeight: '900', letterSpacing: 0.8,
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
