/**
 * SopranoChat — Hediye Sheet (kişiye SP gönderme)
 * ═══════════════════════════════════════════════════════════════════
 * v107 (2 May 2026) — SPDonateSheet'in kişiye-özel ayrımı.
 * Eski tek-modal-her-bağlam yaklaşımı bölündü; bu sheet SADECE bireysel
 * hediye akışı için (profil/oda içi profil/odada birine tip).
 *
 * Tema: HEDİYE
 *   - Watermark: büyük hediye paketi (Ionicons "gift" 220px, opacity 0.10-0.20)
 *   - Alıcı kartı öne çıkar (avatar 56px + isim + tier rozeti)
 *   - Opsiyonel kişisel mesaj (tek satır, max 60 char)
 *   - Bakiye-aware: slider max = min(1000, bakiye), chip'ler bakiye altıysa sönük
 *
 * Tutarlılık:
 *   - Tier paleti: constants/tierColors.ts (paylaşılan, gelecek sheet'lerle ortak)
 *   - Yumuşak 4-stop gradient (locations [0, 0.4, 0.75, 1]) — keskin geçiş yok
 *   - Android: shadowColor yok, border + iç gradient + tierShadow helper
 *   - Drag-to-dismiss (X butonu YOK — memory: feedback_no_x_on_draggable)
 *   - SafeAreaProvider root'ta (memory) → useSafeAreaInsets().bottom kullanılır
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions,
  Pressable, GestureResponderEvent, Platform, Image, TextInput,
  KeyboardAvoidingView, Keyboard,
} from 'react-native';
import AppLoader from '../AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ProfileService } from '../../services/profile';
import { supabase } from '../../constants/supabase';
import { showToast } from '../Toast';
import SPSentSuccessModal from './SPSentSuccessModal';
import { getSPAmountTier, type SPAmountTier } from '../../constants/spAmountTier';
import SPHexagonIcon from '../SPHexagonIcon';
import SPIcon from '../SPIcon';
import PremiumAlert from '../PremiumAlert';
import { useRouter } from 'expo-router';
import { TIER_PALETTES, PANEL_BG_GRADIENT, tierShadow, tierButtonShadow } from '../../constants/tierColors';
import { getAvatarSource } from '../../constants/avatars';

const { width: W } = Dimensions.get('window');

const PANEL_CONTENT_HEIGHT = 540; // mesaj input için +100 (eski sheet 380'di)
const SLIDER_WIDTH = Math.max(1, W - 80);
const QUICK_AMOUNTS = [10, 25, 100, 250, 500];
const MIN_AMOUNT = 10; // ★ v107.18: Minimum gönderim 10 SP (kullanıcı talebi)
const HARD_MAX = 1000; // server-side limit

interface Props {
  visible: boolean;
  onClose: () => void;
  senderId: string;
  recipientId: string;
  recipientName: string;
  /** Alıcı avatar URL'i — alıcı kartında 56px gösterilir */
  recipientAvatar?: string;
  /** Alıcı kullanıcı adı (@username) — kartta küçük olarak görünür */
  recipientUsername?: string;
  /** Alıcı tier — kartta rozet olarak görünür (Plus/Pro) */
  recipientTier?: string | null;
  /** ★ v107.16: Oda içi mi? — başarı modalı sinematik (true) veya sade kart (false).
   *  Default false: profil/DM bağlamında sade kart formu çıkar. */
  inRoom?: boolean;
  onSuccess?: (amount: number) => void;
}

export default function GiftSheet({
  visible, onClose, senderId, recipientId, recipientName, recipientAvatar,
  recipientUsername, recipientTier, inRoom = false, onSuccess,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Floating gift watermark — yukarı-aşağı süzülür + hafif rotate
  const giftFloat = useRef(new Animated.Value(0)).current;
  // Alıcı avatarı subtle breathing (scale 1.0↔1.02, 3sn cycle)
  const avatarBreath = useRef(new Animated.Value(0)).current;
  // Hexagon scale spring (slider değişiminde)
  const hexScale = useRef(new Animated.Value(1)).current;
  // ★ v107.31: inRoom modu için ek ambient drift (4 kalp partikülü, alttan üste süzülür)
  const driftAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState('');
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

  // Bakiye-aware slider üst sınırı: min(HARD_MAX, balance)
  // Bakiye null ise (yüklenmemiş) HARD_MAX ile başla, yüklenince güncellensin.
  const effectiveMax = balance !== null ? Math.max(1, Math.min(HARD_MAX, balance)) : HARD_MAX;

  useEffect(() => {
    if (visible) {
      setAmount(10);
      setMessage('');
      setLoading(false);
      sliderMeasured.current = false;
      (async () => {
        try {
          const { data } = await supabase.from('profiles').select('system_points').eq('id', senderId).single();
          setBalance(data?.system_points ?? 0);
        } catch (e) {
          if (__DEV__) console.warn('[GiftSheet] balance fetch failed:', e);
        }
      })();
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
      // Gift watermark — yumuşak süzülme (4sn cycle, opacity + scale + rotate)
      Animated.loop(
        Animated.sequence([
          Animated.timing(giftFloat, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(giftFloat, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
      ).start();
      // Avatar breathing (scale 1.0 ↔ 1.02, 3sn cycle)
      Animated.loop(
        Animated.sequence([
          Animated.timing(avatarBreath, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(avatarBreath, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      ).start();
      // ★ v107.31: inRoom modu — 4 ambient kalp partikülü alttan üste süzülür (stagger)
      if (inRoom) {
        driftAnims.forEach((a, i) => {
          Animated.loop(
            Animated.sequence([
              Animated.delay(i * 800),
              Animated.timing(a, { toValue: 1, duration: 5000, useNativeDriver: true }),
              Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
            ]),
          ).start();
        });
      }
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      giftFloat.stopAnimation();
      avatarBreath.stopAnimation();
      driftAnims.forEach(a => a.stopAnimation());
    }
  }, [visible]);

  // Hexagon spring — amount değişince hafif "pop"
  useEffect(() => {
    Animated.sequence([
      Animated.spring(hexScale, { toValue: 1.06, useNativeDriver: true, damping: 10, stiffness: 200 }),
      Animated.spring(hexScale, { toValue: 1.0, useNativeDriver: true, damping: 12, stiffness: 180 }),
    ]).start();
  }, [amount]);

  // Pan responder — sheet drag-to-dismiss (handle alanı + tüm sheet)
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
          Keyboard.dismiss();
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
    // ★ v107.18: Min 10 SP — slider 10'dan başlar, 10 ile effectiveMax arası interpolate
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

  const handleGift = async () => {
    if (amount <= 0 || loading) return;
    if (senderId === recipientId) return;
    if (balance !== null && balance < amount) {
      setInsufficientAlert({ visible: true, needed: amount - (balance ?? 0) });
      return;
    }

    Keyboard.dismiss();

    // Optimistic: hemen success modalı aç, balance düş, DB write arkada
    const sentAmount = amount;
    const sentMessage = message.trim();
    setBalance(prev => (prev ?? 0) - sentAmount);
    setSuccessAmount(sentAmount);
    setShowSuccess(true);
    onClose();

    try {
      const result = await ProfileService.donateToUser(senderId, recipientId, sentAmount, sentMessage || undefined);
      if (!mountedRef.current) return;
      if (!result.success) {
        // Rollback
        setBalance(prev => (prev ?? 0) + sentAmount);
        setShowSuccess(false);
        showToast({
          title: 'Hediye gönderilemedi',
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
          title: 'Hediye gönderilemedi',
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
  const canGift = amount >= MIN_AMOUNT && balance !== null && balance >= amount && senderId !== recipientId;
  // ★ v107.18: Slider 10'dan başlar (MIN_AMOUNT)
  const fillRatio = effectiveMax > MIN_AMOUNT ? (amount - MIN_AMOUNT) / (effectiveMax - MIN_AMOUNT) : 0;

  if (!visible && !showSuccess) return null;

  // Başarı modalı aktifse sadece onu göster
  if (showSuccess) {
    return (
      <SPSentSuccessModal
        visible={showSuccess}
        amount={successAmount}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        variant={inRoom ? 'cinematic' : 'compact'}
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

        {/* ★ v107.2: Watermark hediye paketi — kullanıcı HTML preview verdi (1:1 birebir).
            Sağ üst köşede dışarı taşmış (right: -30), -15° sabit eğik, opacity 0.10-0.20.
            Hareket: hafif translate + scale (rotate sabit kalır — paket "aksesuar" gibi durur).
            Eski versiyon ortada büyük + dönüyordu, "gölge gibi" görünüyordu — bu sürüm dengeli. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.giftWatermark,
            {
              opacity: Animated.multiply(
                backdropOpacity,
                giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.20, 0.10] }),
              ),
              transform: [
                {
                  translateY: Animated.add(
                    translateY.interpolate({ inputRange: [0, PANEL_HEIGHT], outputRange: [0, -30], extrapolate: 'clamp' }),
                    giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -5, 0] }),
                  ),
                },
                {
                  translateX: giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] }),
                },
                { scale: giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.0, 1.05, 1.0] }) },
                { rotate: '-15deg' },
              ],
            },
          ]}
        >
          <Text style={styles.giftEmoji} allowFontScaling={false}>🎁</Text>
        </Animated.View>

        {/* ★ v107.31: AMBIENT DRIFT — sadece inRoom modunda 4 kalp emoji alttan üste süzülür */}
        {inRoom && driftAnims.map((anim, i) => {
          const startX = ((i * 211) % (W - 80)) + 40;
          const drift = ((i * 71) % 60) - 30;
          const ty = anim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_HEIGHT * 0.95, -50] });
          const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
          const opacity = Animated.multiply(
            backdropOpacity,
            anim.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 0.6, 0.6, 0] }),
          );
          const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.0, 1.3] });
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
              <Text style={styles.driftEmoji} allowFontScaling={false}>
                {i % 2 === 0 ? '💗' : '✨'}
              </Text>
            </Animated.View>
          );
        })}

        {/* Panel */}
        <KeyboardAvoidingView
          // ★ v107.48: Android'de behavior=undefined sheet klavye altında kalıyordu.
          //   BioEditorSheet ile aynı pattern: iOS=padding, Android=height.
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          pointerEvents="box-none"
        >
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
            {/* Koyu zemin — paylaşılan PANEL_BG_GRADIENT */}
            <LinearGradient
              colors={PANEL_BG_GRADIENT}
              start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Tier tint — amount değiştikçe yumuşak renk geçişi */}
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
              <Ionicons name="gift" size={20} color={palette.accent} style={iconShadow} />
              <Text style={[styles.headerTitle, { color: palette.accent }]}>HEDİYE GÖNDER</Text>
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

            {/* Alıcı kartı — büyük avatar + isim + tier rozeti */}
            <View style={[styles.recipientCard, { borderColor: palette.accent + '33' }]}>
              <LinearGradient
                colors={[palette.accentTint, 'rgba(255,255,255,0.02)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Animated.View
                style={[
                  styles.recipientAvatarWrap,
                  {
                    borderColor: palette.accent + '88',
                    transform: [{
                      scale: avatarBreath.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.02] }),
                    }],
                  },
                ]}
              >
                <Image source={getAvatarSource(recipientAvatar)} style={styles.recipientAvatar} />
              </Animated.View>
              <View style={styles.recipientInfo}>
                <Text style={styles.recipientName} numberOfLines={1}>{recipientName}</Text>
                {recipientUsername && (
                  <Text style={styles.recipientUsername} numberOfLines={1}>@{recipientUsername}</Text>
                )}
                {recipientTier && recipientTier !== 'free' && (
                  <View style={[styles.recipientTierChip, { borderColor: palette.accent + '55' }]}>
                    <Ionicons name="star" size={8} color={palette.accent} />
                    <Text style={[styles.recipientTierText, { color: palette.accent }]}>{recipientTier}</Text>
                  </View>
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

            {/* Mesaj input — opsiyonel, tek satır, max 60 */}
            <View style={[styles.messageWrap, { borderColor: palette.accent + '22' }]}>
              <Ionicons name="mail-outline" size={14} color={palette.accent + 'AA'} />
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Kısa bir mesaj ekle (isteğe bağlı)"
                placeholderTextColor="rgba(255,255,255,0.30)"
                maxLength={60}
                returnKeyType="done"
                blurOnSubmit
              />
              {message.length > 0 && (
                <Text style={[styles.messageCounter, { color: palette.accent + 'AA' }]}>
                  {message.length}/60
                </Text>
              )}
            </View>

            {/* Gönder butonu — tier gradient */}
            <Pressable
              style={[
                styles.sendBtn,
                tierButtonShadow(palette.accent),
                { borderColor: palette.fillGrad[0] + (Platform.OS === 'android' ? 'CC' : '99') },
                !canGift && { opacity: 0.4 },
              ]}
              onPress={handleGift}
              disabled={!canGift || loading}
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
                    <Ionicons name="gift" size={18} color="#FFF" style={iconShadow} />
                    <Text style={styles.sendBtnText}>
                      {amount.toLocaleString('tr-TR')} SP Hediye Gönder
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>

      {/* Yetersiz bakiye — Mağazaya Git CTA */}
      <PremiumAlert
        visible={insufficientAlert.visible}
        title="Yetersiz SP"
        message={`${insufficientAlert.needed} SP eksik. Mağazadan SP yükleyip hediyeni gönderebilirsin.`}
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

  // Alıcı kartı — yatay layout, avatar 56px sol, info sağ
  recipientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 18, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recipientAvatarWrap: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2,
    overflow: 'hidden',
  },
  recipientAvatar: { width: '100%', height: '100%' } as any,
  recipientInfo: { flex: 1, gap: 2 },
  recipientName: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.2,
  },
  recipientUsername: {
    fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '600',
  },
  recipientTierChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1,
    marginTop: 3,
  },
  recipientTierText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Amount alanı — yatay (hexagon + sayı + SP)
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
    // Android'de neon glow yok — borderHighlight ile parlatma
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

  // Mesaj input — tek satır, ikon + input + counter
  messageWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginVertical: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  messageInput: {
    flex: 1,
    fontSize: 13, color: '#F1F5F9', fontWeight: '500',
    paddingVertical: 0, // Android'de default padding'i temizle
  },
  messageCounter: {
    fontSize: 10, fontWeight: '700',
  },

  sendBtn: {
    marginHorizontal: 18, marginTop: 6,
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

  // ★ v107.2: Watermark hediye — sağ üst köşede dışarı taşmış (right negative),
  // sabit -15° eğik, opacity 0.10-0.20 ile aksesuar gibi durur.
  giftWatermark: {
    position: 'absolute',
    top: '8%',
    right: -30,        // sağ kenardan 30px dışarı taşar (yarısı görünür)
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  giftEmoji: {
    fontSize: 220,
    lineHeight: 250,   // Android'de büyük emoji clip'lenmesin
    textAlign: 'center',
  },
  // ★ v107.31: Ambient drift emoji (kalp/yıldız) — inRoom modunda
  driftEmoji: {
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
