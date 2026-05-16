// ★ v107 (3 May 2026): Mesaj Parlat — 6 stil seçim sheet.
//   Kullanıcı input bar'daki ✨ butonuna basınca açılır. 6 stilden birini seçer →
//   parent'a callback ile id iletir → bir sonraki mesaj o stilde gönderilir.
//   SP yetersizse stil disabled görünür. PowerUpsSheet pattern'ı (slate gradient + handle).

import React, { useEffect, useMemo, useRef } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Pressable, Animated, PanResponder, Dimensions, Platform,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SPIcon from '../SPIcon';
import { GLOW_STYLES, PREMIUM_GLOW_IDS, type GlowStyleId } from './glowStyles';

const { width: W } = Dimensions.get('window');

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
  const { height: windowH } = useWindowDimensions();
  // ★ v110 fix (6 May 2026): Panel ekrana oranlı, içerik ScrollView ile kaydırılabilir.
  // ★ v110.6 fix (6 May 2026): Panel ekranın %92'sine çıkarıldı — alt içerik kırpılıyordu.
  //   maxAllowed sabit cap (640) yerine ekrana oranlı; içerik tüm ürünleri görsün.
  const PANEL_HEIGHT = useMemo(() => {
    const topPad = Math.max(insets.top, 24) + 24;
    const maxAllowed = windowH - topPad;
    return Math.max(480, maxAllowed);
  }, [windowH, insets.top, insets.bottom]);
  const SNAP_FULL = 0;
  const SNAP_DISMISS = PANEL_HEIGHT;
  const translateY = useRef(new Animated.Value(SNAP_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentSnapRef = useRef<number>(SNAP_DISMISS);

  useEffect(() => {
    if (visible) {
      currentSnapRef.current = SNAP_FULL;
      Animated.parallel([
        Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      currentSnapRef.current = SNAP_DISMISS;
      Animated.parallel([
        Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 220, useNativeDriver: true }),
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
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        const newY = currentSnapRef.current + gs.dy;
        // ★ Sadece üst sınır (FULL'un üstüne çıkma); aşağı hareketi serbest — kullanıcı
        //   parmağıyla panel'i tam olarak takip edebilsin (kayıp hissi olmasın).
        translateY.setValue(Math.max(SNAP_FULL - 10, newY));
      },
      onPanResponderRelease: (_, gs) => {
        const finalPos = currentSnapRef.current + gs.dy;
        const fastDown = gs.vy > 0.6;

        const animateDismiss = () => {
          currentSnapRef.current = SNAP_DISMISS;
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: SNAP_DISMISS,
              useNativeDriver: true,
              damping: 28, stiffness: 180, mass: 0.9,
              overshootClamping: true,
            }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
        };
        const animateToFull = () => {
          currentSnapRef.current = SNAP_FULL;
          Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        };

        // 2-snap: FULL ↔ DISMISS. Hızlı aşağı çek veya yarıdan fazla indi → kapan.
        const dismissThreshold = PANEL_HEIGHT * 0.30;
        if (fastDown || finalPos > dismissThreshold) animateDismiss();
        else animateToFull();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      {/* ★ v110.7 fix (7 May 2026): Android elevation eklendi.
          RoomChatDrawer sheet'i elevation:58 ile renderlanıyor; picker'ın ScrollView
          alanı drawer ile fiziksel olarak çakıştığı için touch event drawer'a gidiyor,
          scroll çalışmıyordu. zIndex Android'de cross-component stacking için yetmez,
          elevation şart. 100 → drawer'ın 58'inin çok üstünde. */}
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 540, elevation: 100 }} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,22,0.45)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Panel */}
        <Animated.View
          style={[
            s.panel,
            { height: PANEL_HEIGHT, transform: [{ translateY }] },
          ]}
        >
          {/* ★ 2026-05-05: NotificationDrawer dili — slate diagonal + üst amber halo (mevcut palet).
              2 katman gradient (FPS koruma). */}
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.20)', 'rgba(251,191,36,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(251,191,36,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* Top edge altın highlight */}
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.85)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
            pointerEvents="none"
          />

          {/* ★ v110 fix: handle+header+ScrollView'u explicit flex container'a sar.
              Android'de Animated.View > flex:1 ScrollView bazen düzgün ölçülmüyor;
              ek View {flex:1} sınır net hale getirir. */}
          <View style={{ flex: 1, minHeight: 0 }}>
            {/* Drag yalnız handle + header'da; ScrollView'a karışmaz */}
            <View {...panResponder.panHandlers}>
              {/* Handle */}
              <View style={s.handle}><View style={s.handleBar} /></View>

              {/* Header */}
              <View style={s.header}>
                <View style={s.headerIconWrap}>
                  <Ionicons name="sparkles" size={16} color="#FBBF24" style={iconShadow} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.headerTitle}>MESAJINI PARLAT</Text>
                  <Text style={s.headerSub}>{i18n.t('room.messageglowpickersheet.001')}</Text>
                </View>
                <View style={s.balancePill}>
                  <SPIcon size={14} />
                  <Text style={s.balanceText}>{currentSP.toLocaleString('tr-TR')}</Text>
                </View>
              </View>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 220 + insets.bottom, flexGrow: 1 }}
              showsVerticalScrollIndicator
              indicatorStyle="white"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              bounces
              overScrollMode="auto"
              scrollEventThrottle={16}
            >
          {/* ─── Standart 6 stil — pay-per-use ─── */}
          <Text style={s.sectionLabel}>{i18n.t('room.messageglowpickersheet.002')}</Text>
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
            <Text style={s.premiumLabel}>{i18n.t('room.messageglowpickersheet.003')}</Text>
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
                      <Text style={[s.costText, { color: '#5DCAA5' }]}>{i18n.t('room.messageglowpickersheet.004')}</Text>
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
            </ScrollView>
          </View>
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
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    borderBottomWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
      },
      // ★ v110.7: Android elevation panel düzeyinde de — outer wrapper 100 yetmezse
      //   panel kendi içinde de chat drawer'ı ezsin. ScrollView'un touch event'i
      //   drawer tarafından çalınmasını engeller.
      android: { elevation: 100 },
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
