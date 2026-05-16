/**
 * SopranoChat — Hediye Detay Modalı
 * ═══════════════════════════════════════════════════════════════════
 * v109 (5 May 2026) — Profil stats satırındaki "Hediye" butonuna tıklayınca
 * açılan detay modal. İçinde "Aldığı" ve "Verdiği" hediyeler alt alta
 * gruplanmış halde — tab yok, sade sıralı dizilim.
 *
 * NotificationDrawer aile dili: slate diagonal + amber halo + soft glow,
 * borderRadius 26, backdrop rgba(8,12,22,0.45), drag-to-dismiss.
 */

import React, { useEffect, useRef } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, PanResponder, Dimensions, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GiftShowcase from './GiftShowcase';

const { height: H } = Dimensions.get('window');
// ★ 2026-05-05: 0.75 → 0.5 (kullanıcı talebi). İçerik scroll edilebilir kalır.
const PANEL_HEIGHT = H * 0.5;

interface Props {
  visible: boolean;
  userId: string;
  /** Profil sahibinin adı — başlıkta görünür */
  displayName?: string;
  onClose: () => void;
}

export default function GiftDetailModal({
  visible, userId, displayName, onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const closeWithAnim = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.parallel([
            Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 540 }} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: 'rgba(8,12,22,0.45)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnim} />
        </Animated.View>

        <Animated.View
          style={[s.panel, { paddingBottom: 16 + insets.bottom, transform: [{ translateY }] }]}
        >
          {/* NotificationDrawer aile dili — 3 katman gradient */}
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(245,158,11,0.20)', 'rgba(245,158,11,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(245,158,11,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Drag handle — pan yalnız header bölgesinde */}
          <View {...panResponder.panHandlers}>
            <View style={s.handleWrap}>
              <View style={s.handle} />
            </View>

            {/* Header */}
            <View style={s.header}>
              <Ionicons name="gift" size={18} color="#FBBF24" style={s.headerIcon} />
              <Text style={s.headerTitle}>
                {displayName ? `${displayName} · Hediyeler` : 'Hediyeler'}
              </Text>
              <Pressable onPress={closeWithAnim} hitSlop={10} style={s.closeBtn}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <View style={s.headerSeparator} />
          </View>

          {/* İçerik — Aldığı + Verdiği alt alta gruplanmış */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Aldığı Hediyeler */}
            <View style={s.groupHeader}>
              <Ionicons name="gift" size={13} color="#FBBF24" />
              <Text style={s.groupTitle}>{i18n.t('profile.giftdetailmodal.001')}</Text>
            </View>
            <GiftShowcase userId={userId} mode="received" limit={50} embedded />

            {/* Ayraç */}
            <View style={s.divider} />

            {/* Verdiği Hediyeler */}
            <View style={s.groupHeader}>
              <Ionicons name="send" size={12} color="#FBBF24" />
              <Text style={s.groupTitle}>{i18n.t('profile.giftdetailmodal.002')}</Text>
            </View>
            <GiftShowcase userId={userId} mode="sent" limit={50} embedded />
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: PANEL_HEIGHT,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10, paddingBottom: 4,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
  },
  headerIcon: {
    textShadowColor: 'rgba(245,158,11,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerSeparator: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 12,
  },
  // ★ Grup başlıkları — "ALDIĞI HEDİYELER" / "VERDİĞİ HEDİYELER"
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
  },
  groupTitle: {
    fontSize: 11, fontWeight: '800', color: 'rgba(251,191,36,0.85)',
    letterSpacing: 1.2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
