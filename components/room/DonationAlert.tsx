/**
 * SopranoChat â DonationAlert v3 (1 May 2026)
 * âââââââââââââââââââââââââââââââââââââââââââââââââââ
 * â v92.10: Eski bÃ¼yÃ¼k ekran-ortasÄ± premium banner KALDIRILDI.
 * ArtÄ±k ekranÄ±n ALTINDAN slide-up kÃ¼Ã§Ã¼k altÄ±n chip â odayÄ± boÄmayan, ferah.
 * Tab bar'Ä±n hemen Ã¼stÃ¼nde 2.4sn gÃ¶rÃ¼nÃ¼r, sonra fade-out.
 *
 * Format: â¨ Burak â fÄ±rat â¢ 50 SP
 * Width: ~ekran geniÅliÄinin %72'si (kompakt)
 * Animasyon: alt â orta slide + opacity 0â1, sonra hold 1.4sn, fade-out.
 */
import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSPAmountTier, SP_TIER_VISUAL } from '../../constants/spAmountTier';
import { i18n } from '../../services/i18n';

const { width: W } = Dimensions.get('window');

export interface DonationAlertData {
  senderName: string;
  amount: number;
  recipientName?: string;
  senderAvatar?: string; // legacy â kullanÄ±lmÄ±yor (kompakt chip'te yer yok)
}

export interface DonationAlertRef {
  show: (data: DonationAlertData) => void;
}

const DonationAlert = forwardRef<DonationAlertRef>((_, ref) => {
  const [data, setData] = useState<DonationAlertData | null>(null);
  const slideY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAll = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopAll(), []);

  const show = useCallback((d: DonationAlertData) => {
    stopAll();
    setData(d);
    slideY.setValue(80);
    opacity.setValue(0);

    // Slide-up + fade-in (220ms ease-out cubic)
    Animated.parallel([
      Animated.timing(slideY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();

    // Hold 1.7sn sonra fade-out
    dismissTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 80, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(() => setData(null));
    }, 1700);
  }, []);

  useImperativeHandle(ref, () => ({ show }), [show]);

  if (!data) return null;
  const tier = getSPAmountTier(data.amount);
  const tv = SP_TIER_VISUAL[tier];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.wrap,
        {
          opacity,
          transform: [{ translateY: slideY }],
          borderColor: tv.glow + '88',
          shadowColor: tv.glow,
        },
      ]}
    >
      <LinearGradient
        colors={[tv.bgGradient[0], tv.bgGradient[1], tv.bgGradient[2]]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Ionicons name="sparkles" size={14} color={tv.glow} style={{
        textShadowColor: tv.glow + 'cc',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6,
      }} />
      <Text style={[s.text, { color: '#F8FAFC' }]} numberOfLines={1}>
        <Text style={{ fontWeight: '900', color: tv.glow }}>{data.senderName}</Text>
        <Text>{' â '}</Text>
        <Text style={{ fontWeight: '900' }}>{data.recipientName || '...'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)' }}>{'  â¢  '}</Text>
        <Text style={{ fontWeight: '900', color: tv.glow }}>{data.amount.toLocaleString(i18n.locale)} SP</Text>
      </Text>
    </Animated.View>
  );
});

DonationAlert.displayName = 'DonationAlert';

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    bottom: 110, // â Tab bar (CurvedTabBar ~84) + 26 buffer
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.2,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  text: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default DonationAlert;
