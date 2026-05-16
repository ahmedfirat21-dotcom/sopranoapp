// ★ v107 (3 May 2026): Çift oturum çakışma modal'ı.
//
// Tetikleyici: services/sessionConflict.ts → subscribeSessionConflict callback.
// İki seçenek:
//   - "Bu Cihazda Devam Et" → markSessionActive tekrar çağrılır (diğer cihaz modal alır)
//   - "Çıkış Yap" → caller signOut tetikler

import React, { useEffect, useRef } from 'react';
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, Pressable, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  /** "Bu Cihazda Devam Et" — markSessionActive tekrar çağrılır */
  onContinueHere: () => void;
  /** "Çıkış Yap" — Firebase signOut + login ekranına yönlendir */
  onSignOut: () => void;
}

export default function SessionConflictModal({ visible, onContinueHere, onSignOut }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: visible ? 1 : 0.92, useNativeDriver: true, damping: 18, stiffness: 220 }),
    ]).start();
  }, [visible, opacity, scale]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFillObject, { opacity, zIndex: 9999, elevation: 9999 }]}>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)' }]} />

      <View style={s.center}>
        <Animated.View style={[s.card, { transform: [{ scale }] }]}>
          <LinearGradient
            colors={['#1e2230', '#15182a', '#0a0b16']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.85)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          <View style={s.iconWrap}>
            <Ionicons name="phone-portrait-outline" size={36} color="#FBBF24" style={iconShadow} />
          </View>

          <Text style={s.title}>{i18n.t('sessionconflictmodal.001')}</Text>
          <Text style={s.message}>
            Bu hesap az önce başka bir cihazda kullanılmaya başladı. Aynı hesap iki yerden aktif olamaz.
          </Text>

          <View style={s.buttons}>
            <Pressable style={s.btnSecondary} onPress={onSignOut}>
              <Ionicons name="exit-outline" size={16} color="#94A3B8" />
              <Text style={s.btnSecondaryText}>{i18n.t('sessionconflictmodal.002')}</Text>
            </Pressable>
            <Pressable style={s.btnPrimary} onPress={onContinueHere}>
              <LinearGradient
                colors={['#14B8A6', '#0D9488']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="checkmark-circle" size={16} color="#FFF" style={iconShadow} />
              <Text style={s.btnPrimaryText}>Bu Cihazda Devam Et</Text>
            </Pressable>
          </View>

          <Text style={s.footnote}>
            "Devam Et" dersen diğer cihaz oturumdan düşer.
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 380,
    paddingTop: 28, paddingBottom: 22, paddingHorizontal: 22,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.35)',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 22 },
      android: { elevation: 14 },
    }),
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.6 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.45)',
    marginBottom: 14,
  },
  title: {
    fontSize: 17, fontWeight: '900', color: '#F1F5F9',
    textAlign: 'center', marginBottom: 8,
    ...iconShadow,
  },
  message: {
    fontSize: 13, fontWeight: '500', color: '#CBD5E1',
    textAlign: 'center', lineHeight: 19,
    marginBottom: 20,
  },
  buttons: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  btnSecondary: {
    flex: 1, height: 46,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnSecondaryText: { fontSize: 13, fontWeight: '700', color: '#CBD5E1' },
  btnPrimary: {
    flex: 1.4, height: 46, borderRadius: 12, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnPrimaryText: {
    fontSize: 13, fontWeight: '800', color: '#FFF',
    ...iconShadow,
  },
  footnote: {
    fontSize: 11, fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    paddingHorizontal: 6, lineHeight: 14,
  },
});
