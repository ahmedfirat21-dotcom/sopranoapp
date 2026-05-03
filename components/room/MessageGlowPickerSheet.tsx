// ★ v107 (3 May 2026): Mesaj Parlat — 6 stil seçim sheet.
//   Kullanıcı input bar'daki ✨ butonuna basınca açılır. 6 stilden birini seçer →
//   parent'a callback ile id iletir → bir sonraki mesaj o stilde gönderilir.
//   SP yetersizse stil disabled görünür. PowerUpsSheet pattern'ı (slate gradient + handle).

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, PanResponder, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SPIcon from '../SPIcon';
import { GLOW_STYLES, PREMIUM_GLOW_IDS, type GlowStyleId } from './glowStyles';

const { width: W } = Dimensions.get('window');
// ★ v107: 6 sabit + 5 premium stil ekran sığması için panel yüksekliği +200
const PANEL_HEIGHT_BASE = 660;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Kullanıcının SP bakiyesi — yeterlilik kontrolü için */
  currentSP: number;
  /** Stil seçildiğinde tetiklenir; parent state'te tutar, sonraki mesajda kullanır */
  onSelect: (style: GlowStyleId) => void;
  /** ★ Mağazadan satın alınan premium stiller (cosmetic_items id'leri) — kilit kontrolü için */
  ownedPremiumIds?: Set<string>;
  /** ★ Premium stil tıklandı + sahip değil → mağazaya yönlendir */
  onOpenStore?: () => void;
}

const STYLE_ORDER: GlowStyleId[] = ['gold', 'heart', 'fire', 'neon', 'celebration', 'galaxy'];

export default function MessageGlowPickerSheet({ visible, onClose, currentSP, onSelect, ownedPremiumIds, onOpenStore }: Props) {
  const insets = useSafeAreaInsets();
  const PANEL_HEIGHT = PANEL_HEIGHT_BASE + Math.max(insets.bottom, 0);
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, PANEL_HEIGHT]);

  // Pan-down to dismiss (memory: feedback_no_x_on_draggable)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 200, useNativeDriver: true }).start(() => onCloseRef.current());
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
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Panel */}
        <Animated.View
          style={[
            s.panel,
            { paddingBottom: 24 + insets.bottom, transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Bg slate gradient */}
          <LinearGradient
            colors={['#1e2230', '#15182a', '#0a0b16']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Top edge altın highlight */}
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.85)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* Handle */}
          <View style={s.handle}><View style={s.handleBar} /></View>

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerIconWrap}>
              <Ionicons name="sparkles" size={16} color="#FBBF24" style={iconShadow} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>MESAJINI PARLAT</Text>
              <Text style={s.headerSub}>Bir stil seç — bir sonraki mesajın o şekilde gönderilir</Text>
            </View>
            <View style={s.balancePill}>
              <SPIcon size={14} />
              <Text style={s.balanceText}>{currentSP.toLocaleString('tr-TR')}</Text>
            </View>
          </View>

          {/* ─── Standart 6 stil — pay-per-use ─── */}
          <Text style={s.sectionLabel}>STANDART · MESAJ BAŞI ÜCRET</Text>
          <View style={s.grid}>
            {STYLE_ORDER.map((id) => {
              const cfg = GLOW_STYLES[id];
              const insufficient = currentSP < cfg.cost;
              return (
                <Pressable
                  key={id}
                  style={[s.card, insufficient && { opacity: 0.45 }]}
                  onPress={() => {
                    if (insufficient) return;
                    onSelect(id);
                    onClose();
                  }}
                  disabled={insufficient}
                >
                  <View style={s.preview}>
                    <LinearGradient
                      colors={cfg.bgGradient as any}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text style={s.previewIcon}>{cfg.icon}</Text>
                  </View>
                  <Text style={s.cardLabel}>{cfg.label}</Text>
                  <View style={s.costRow}>
                    <SPIcon size={12} />
                    <Text style={s.costText}>{cfg.cost} SP</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ─── Premium 5 stil — Mağaza unlock ─── */}
          <View style={s.premiumDivider}>
            <View style={s.dividerLine} />
            <Text style={s.premiumLabel}>★ PREMIUM · KOLEKSİYON ★</Text>
            <View style={s.dividerLine} />
          </View>
          <View style={s.grid}>
            {PREMIUM_GLOW_IDS.map((id) => {
              const cfg = GLOW_STYLES[id];
              const owned = !!ownedPremiumIds?.has(id);
              return (
                <Pressable
                  key={id}
                  style={[s.card, !owned && s.cardLocked]}
                  onPress={() => {
                    if (!owned) {
                      onOpenStore?.();
                      onClose();
                      return;
                    }
                    onSelect(id);
                    onClose();
                  }}
                >
                  <View style={s.preview}>
                    <LinearGradient
                      colors={cfg.bgGradient as any}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text style={s.previewIcon}>{cfg.icon}</Text>
                    {!owned && (
                      <View style={s.lockOverlay}>
                        <Ionicons name="lock-closed" size={20} color="#FBBF24" />
                      </View>
                    )}
                  </View>
                  <Text style={s.cardLabel}>{cfg.label}</Text>
                  <View style={s.costRow}>
                    {owned ? (
                      <Text style={[s.costText, { color: '#5DCAA5' }]}>SAHİPSİN · FREE</Text>
                    ) : (
                      <>
                        <SPIcon size={12} />
                        <Text style={s.costText}>{cfg.unlockPrice} SP · KİLİTLİ</Text>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.footnote}>
            Standart stiller mesaj başı SP harcar. Premium stiller mağazadan tek seferlik
            satın alınır, sonsuz kullanım.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

const s = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    minHeight: PANEL_HEIGHT_BASE,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.35)',
    borderBottomWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.6,
        shadowRadius: 22,
      },
      android: {},
    }),
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.6 },
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(251,191,36,0.5)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
  },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)',
  },
  headerTitle: {
    fontSize: 13, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 1.4, ...iconShadow,
  },
  headerSub: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  balanceText: { fontSize: 11, fontWeight: '800', color: '#FBBF24' },
  sectionLabel: {
    fontSize: 9.5, fontWeight: '900', color: 'rgba(251,191,36,0.7)',
    letterSpacing: 2, textAlign: 'center',
    marginTop: 4, marginBottom: 8,
  },
  premiumDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, marginTop: 12, marginBottom: 8,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(251,191,36,0.4)' },
  premiumLabel: {
    fontSize: 9.5, fontWeight: '900', color: '#FBBF24',
    letterSpacing: 2,
  },
  cardLocked: { opacity: 0.7 },
  lockOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, justifyContent: 'space-between',
  },
  card: {
    width: (W - 14 * 2 - 10) / 2,
    marginBottom: 10,
    paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  preview: {
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  previewIcon: { fontSize: 26, ...iconShadow },
  cardLabel: {
    fontSize: 11, fontWeight: '900',
    color: '#F1F5F9',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 4,
    ...iconShadow,
  },
  costRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4,
  },
  costText: { fontSize: 11, fontWeight: '800', color: '#FBBF24' },
  footnote: {
    fontSize: 10.5, fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 18,
    lineHeight: 14,
  },
});
