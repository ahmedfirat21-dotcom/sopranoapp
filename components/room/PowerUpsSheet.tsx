// SopranoChat — Power-Ups Sheet v92 (1 May 2026)
// ═══════════════════════════════════════════════════════════════════
// Oda içi sarf güçlendiriciler — kullanıcının "SP'm ne işime yarayacak?"
// sorusuna anlık tüketim cevabı. Mağaza yok prensibine uyumlu (kalıcı
// edinim değil, anlık etki).
//
// 4 power-up:
//   1. Süre Uzat (50 SP) — host'un Free oda süresini 30 dk uzatır
//   2. Altın Davet (10 SP) — premium notification ile sahneye çağrı
//   3. Mesaj Parlat (25 SP) — sonraki 5 mesaja altın çerçeve [planlandı]
//   4. Sahne Işığı (30 SP) — 10 dk avatar glow [planlandı]
//
// v92 sadece 1 ve 2 fonksiyonel; 3 ve 4 UI'da görünür ama "Yakında" badge.
//
// Tasarım dili: SPDonateSheet ile tutarlı (slate gradient + amber edge,
// PanResponder swipe-to-dismiss). Android shadow telafisi border + elevation.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, PanResponder,
  Dimensions, Platform, ScrollView,
} from 'react-native';
import AppLoader from '../AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../constants/supabase';
import { showToast } from '../Toast';
import SPIcon from '../SPIcon';

const { width: W } = Dimensions.get('window');
const PANEL_CONTENT_HEIGHT = 460;

interface PowerUp {
  id: 'extend' | 'gold_invite' | 'message_glow' | 'stage_light';
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgGradient: [string, string];
  borderColor: string;
  title: string;
  subtitle: string;
  cost: number;
  available: boolean; // false → "Yakında" badge
  hostOnly?: boolean;
  needsTarget?: boolean;
}

const POWERUPS: PowerUp[] = [
  {
    id: 'extend',
    icon: 'time',
    iconColor: '#FBBF24',
    bgGradient: ['rgba(251,191,36,0.18)', 'rgba(251,191,36,0.04)'],
    borderColor: 'rgba(251,191,36,0.45)',
    title: 'Süre Uzat',
    subtitle: 'Odanın süresini +30 dk uzatır',
    cost: 50,
    available: true,
    hostOnly: true,
  },
  // ★ v92.11.1 (1 May 2026): Altın Davet kaldırıldı — kullanıcı talebi.
  //   "Sahne daveti zaten ücretsiz, 10 SP'lik değer üretmiyor" prensibi.
  // ★ v107 (3 May 2026): Mesaj Parlat KALDIRILDI — yeni 6 stilli sistem input bar'daki
  //   ✨ butonuna taşındı. Anlık seçim, mesaj başına bağımsız stil/cost. PowerUpsSheet'te
  //   kalması çift trigger karmaşası yaratıyordu.
  {
    id: 'stage_light',
    icon: 'flashlight',
    iconColor: '#A78BFA',
    bgGradient: ['rgba(167,139,250,0.18)', 'rgba(167,139,250,0.04)'],
    borderColor: 'rgba(167,139,250,0.45)',
    title: 'Sahne Işığı',
    subtitle: '10 dk avatarın etrafında glow',
    cost: 30,
    available: true,
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  userId: string;
  isHost: boolean;
  /** SP balance — yeterlilik kontrolü için */
  currentSP: number;
  /** Altın davet için: hedef seçim flow tetikleyici (null verilirse henüz seçim yok) */
  onSelectInviteTarget?: () => void;
  /** Süre uzat başarılıysa parent'a expires_at güncellemesi bildirilir */
  onRoomExtended?: (newExpiresAt: string) => void;
  /** SP balance refresh */
  onBalanceUpdated?: (newBalance: number) => void;
}

export default function PowerUpsSheet({
  visible, onClose, roomId, userId, isHost, currentSP,
  onSelectInviteTarget, onRoomExtended, onBalanceUpdated,
}: Props) {
  const insets = useSafeAreaInsets();
  const PANEL_HEIGHT = PANEL_CONTENT_HEIGHT + Math.max(insets.bottom, 0);
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // Ring loop — premium derinlik
  const ringPulse = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(ringPulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      ringPulse.stopAnimation();
    }
  }, [visible]);

  // Pan-down to dismiss
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
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

  const handleUse = useCallback(async (pu: PowerUp) => {
    if (!pu.available) {
      showToast({ title: 'Yakında', message: `"${pu.title}" çok yakında geliyor.`, type: 'info' });
      return;
    }
    if (currentSP < pu.cost) {
      showToast({ title: 'Yetersiz SP', message: `${pu.cost - currentSP} SP eksik.`, type: 'warning' });
      return;
    }
    if (pu.hostOnly && !isHost) {
      showToast({ title: 'Sadece host', message: 'Bu güçlendiriciyi sadece oda sahibi kullanabilir.', type: 'warning' });
      return;
    }

    if (pu.id === 'extend') {
      setLoading(pu.id);
      try {
        const { data, error } = await supabase.rpc('powerup_extend_room', { p_room_id: roomId, p_user_id: userId });
        if (error) throw error;
        const r = data as any;
        if (!r?.success) {
          showToast({ title: 'Yapılamadı', message: r?.error || 'Tekrar dene.', type: 'error' });
          return;
        }
        showToast({ title: '+30 dk eklendi', message: 'Oda süresi uzatıldı.', type: 'success' });
        onRoomExtended?.(r.new_expires_at);
        onBalanceUpdated?.(r.new_balance);
        onClose();
      } catch (e: any) {
        showToast({ title: 'Hata', message: e?.message || 'Bağlantı sorunu', type: 'error' });
      } finally {
        setLoading(null);
      }
      return;
    }

    if (pu.id === 'gold_invite') {
      onSelectInviteTarget?.();
      onClose();
      return;
    }

    // ★ v92.11 (1 May 2026): Mesaj Parlat — sonraki 5 mesajda altın çerçeve.
    if (pu.id === 'message_glow') {
      setLoading(pu.id);
      try {
        const { data, error } = await supabase.rpc('powerup_message_glow', { p_user_id: userId });
        if (error) throw error;
        const r = data as any;
        if (!r?.success) {
          showToast({ title: 'Yapılamadı', message: r?.error || 'Tekrar dene.', type: 'error' });
          return;
        }
        showToast({ title: '✨ Mesaj Parlat aktif', message: 'Sonraki 5 mesajın altın çerçeveli.', type: 'success' });
        onBalanceUpdated?.(r.new_balance);
        onClose();
      } catch (e: any) {
        showToast({ title: 'Hata', message: e?.message || 'Bağlantı sorunu', type: 'error' });
      } finally {
        setLoading(null);
      }
      return;
    }

    // ★ v92.11: Sahne Işığı — 10 dk avatar etrafında glow (sahnedeyken).
    if (pu.id === 'stage_light') {
      setLoading(pu.id);
      try {
        const { data, error } = await supabase.rpc('powerup_stage_light', { p_room_id: roomId, p_user_id: userId });
        if (error) throw error;
        const r = data as any;
        if (!r?.success) {
          showToast({ title: 'Yapılamadı', message: r?.error || 'Tekrar dene.', type: 'error' });
          return;
        }
        showToast({ title: '🔦 Sahne Işığı açıldı', message: '10 dk boyunca avatarın parlak.', type: 'success' });
        onBalanceUpdated?.(r.new_balance);
        onClose();
      } catch (e: any) {
        showToast({ title: 'Hata', message: e?.message || 'Bağlantı sorunu', type: 'error' });
      } finally {
        setLoading(null);
      }
      return;
    }
  }, [currentSP, isHost, roomId, userId, onClose, onRoomExtended, onBalanceUpdated, onSelectInviteTarget]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 520 }} pointerEvents="box-none">
        {/* Backdrop — BlurView + dim layer */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* ★ v92.10.2 (1 May 2026): Pulse halo katmanı KALDIRILDI — Android'de
            elevation + amber border ile çakışıp çirkin sarı halka oluşturuyordu. */}

        {/* Panel */}
        <Animated.View
          style={[
            styles.panel,
            { paddingBottom: 24 + insets.bottom, transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Bg gradient — slate */}
          <LinearGradient
            colors={['#1e2230', '#15182a', '#0a0b16']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Top edge highlight */}
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.85)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.topEdge}
          />
          {/* Subtle radial tint */}
          <LinearGradient
            colors={['rgba(251,191,36,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Handle */}
          <View style={styles.handle}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="flash" size={16} color="#FBBF24" style={iconShadow} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>GÜÇLENDİRİCİLER</Text>
              <Text style={styles.headerSub}>Oda içinde anlık etki — SP harca, an'ı taçlandır</Text>
            </View>
            <View style={styles.balancePill}>
              <SPIcon size={14} />
              <Text style={styles.balanceText}>{currentSP.toLocaleString('tr-TR')}</Text>
            </View>
          </View>

          {/* Power-up grid */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
            bounces={false}
          >
            <View style={styles.grid}>
              {POWERUPS.map((pu) => {
                const insufficient = currentSP < pu.cost;
                const disabled = !pu.available || insufficient || (pu.hostOnly && !isHost);
                const isLoading = loading === pu.id;
                return (
                  <Pressable
                    key={pu.id}
                    style={[
                      styles.card,
                      { borderColor: disabled ? 'rgba(255,255,255,0.08)' : pu.borderColor },
                      disabled && { opacity: 0.5 },
                    ]}
                    onPress={() => handleUse(pu)}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={pu.bgGradient}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    {/* "Yakında" badge */}
                    {!pu.available && (
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonText}>YAKINDA</Text>
                      </View>
                    )}
                    <View style={[styles.iconCircle, { backgroundColor: pu.iconColor + '22', borderColor: pu.iconColor + '55' }]}>
                      <Ionicons name={pu.icon} size={22} color={pu.iconColor} style={iconShadow} />
                    </View>
                    <Text style={styles.cardTitle}>{pu.title}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>{pu.subtitle}</Text>
                    <View style={styles.cardFooter}>
                      {isLoading ? (
                        <AppLoader size="small" color={pu.iconColor} />
                      ) : (
                        <>
                          <SPIcon size={14} />
                          <Text style={[styles.costText, { color: pu.iconColor }]}>{pu.cost}</Text>
                          {pu.hostOnly && (
                            <Text style={styles.hostOnlyTag}>· host</Text>
                          )}
                        </>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.footnote}>
              Kalıcı edinim değil, anlık tüketim. Süre Uzat ve Altın Davet aktif;
              diğer iki güçlendirici çok yakında.
            </Text>
          </ScrollView>
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

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    minHeight: PANEL_CONTENT_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    // ★ v92.10.2: Android'de elevation kaldırıldı (border yeterli, elevation
    //   amber border ile çakışıp glow halka yapıyordu). iOS shadow korunuyor.
    borderWidth: Platform.OS === 'android' ? 1.5 : 1.5,
    borderColor: 'rgba(251,191,36,0.35)',
    borderBottomWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.6,
        shadowRadius: 22,
      },
      android: {},  // elevation YOK — border + LinearGradient bg yeterli
    }),
  },
  topEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.6,
  },
  // ★ v92.10.2: haloLayer KALDIRILDI (Android sarı halka sorunu).
  handle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(251,191,36,0.5)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)',
  },
  headerTitle: {
    fontSize: 13, fontWeight: '900',
    color: '#FBBF24',
    letterSpacing: 1.4,
    ...iconShadow,
  },
  headerSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  balanceText: {
    fontSize: 11, fontWeight: '800',
    color: '#FBBF24',
  },
  gridContent: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: (W - 14 * 2 - 10) / 2,  // 2'li grid, 10px gap
    minHeight: 156,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1.2,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    // ★ v92.10.2: Android'de elevation kaldırıldı (kart border + tier rengi yeterli;
    //   elevation glow halka yapıyordu). iOS shadow korunuyor.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {},
    }),
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.2,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F1F5F9',
    letterSpacing: 0.3,
    marginBottom: 4,
    ...iconShadow,
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 14,
    marginBottom: 10,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  costText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
    ...iconShadow,
  },
  hostOnlyTag: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 2,
  },
  soonBadge: {
    position: 'absolute',
    top: 8, right: 8,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    zIndex: 2,
  },
  soonText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1,
  },
  footnote: {
    fontSize: 10.5,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 18,
    lineHeight: 14,
  },
});
