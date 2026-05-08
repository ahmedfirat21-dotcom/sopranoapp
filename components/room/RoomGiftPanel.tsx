/**
 * SopranoChat — Oda İçi Hızlı Hediye Paneli
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Kontrol barındaki 🎁 butonu bunu açar.
 * TikTok/Bigo paritesi: hep elinin altında, tek dokunuşla hediye gönder.
 *
 * Akış:
 *   1. Üst kısım: oda speakerlarının (host + mod + speaker) horizontal scroll
 *      avatar listesi. Default seçili: HOST.
 *   2. Alt kısım: kullanıcının envanterindeki hediyeler grid.
 *   3. Bir hediyeye tıkla → onay modal → send_symbol_gift RPC (room_id ile).
 *   4. Tüm odadaki kullanıcılar Lottie animasyonu görür + sohbete sysmsg düşer.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, PanResponder,
  Dimensions, Platform, ScrollView, Image, DeviceEventEmitter, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../constants/supabase';
import { getAvatarSource } from '../../constants/avatars';
import { StoreService, type CosmeticItem } from '../../services/store';
import SPHexagonIcon from '../SPHexagonIcon';
import { showToast } from '../Toast';
import { getGiftLottie, hasGiftLottie } from '../../constants/giftLottieRegistry';
import Item3DArt from '../store/Item3DArt';
import type { RoomParticipant } from '../../services/database';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback */ }

const { width: W, height: H } = Dimensions.get('window');
const PANEL_HEIGHT_BASE = 540;

// ★ v108.10: Module-level catalog cache — modal her açılışta DB'ye gitmek
//   yerine 60sn cache'ten döndür. Hediye katalogu nadiren değişir.
let _catalogCache: { items: CosmeticItem[]; ts: number } | null = null;
const CATALOG_TTL = 60_000;
async function getGiftsCached(): Promise<CosmeticItem[]> {
  if (_catalogCache && Date.now() - _catalogCache.ts < CATALOG_TTL) {
    return _catalogCache.items;
  }
  const { items } = await StoreService.getCatalog();
  const gifts = items.filter((i) => i.category === 'gift');
  gifts.sort((a, b) => a.price_sp - b.price_sp);
  _catalogCache = { items: gifts, ts: Date.now() };
  return gifts;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  senderId: string;
  roomId: string;
  /** Hedef seçici için: oda host'u + sahnedeki konuşmacılar */
  participants: RoomParticipant[];
  /** Default selected user (genelde host) */
  defaultRecipientId?: string;
}

interface Recipient {
  id: string;
  display_name: string;
  avatar_url: string;
  role: string;
}

export default function RoomGiftPanel({
  visible, onClose, senderId, roomId, participants, defaultRecipientId,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_HEIGHT_BASE + Math.max(insets.bottom, 0);

  // ★ v108.5: 3-snap drag mekaniği (MessageGlowPickerSheet paritesi)
  const SNAP_FULL = 0;
  const SNAP_HALF = PANEL_HEIGHT * 0.55;
  const SNAP_DISMISS = PANEL_HEIGHT;
  const translateY = useRef(new Animated.Value(SNAP_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentSnapRef = useRef<number>(SNAP_DISMISS);
  // Header watermark + handle pulse
  const giftFloat = useRef(new Animated.Value(0)).current;

  const [allGifts, setAllGifts] = useState<CosmeticItem[]>([]);
  const [senderSP, setSenderSP] = useState<number>(0);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // ★ v108.8: Hedef listesi — odadaki tüm kullanıcılar (sender hariç).
  //   Önce sahnedekiler (host/speaker/moderator), sonra dinleyiciler — kullanıcı
  //   istediği kişiye hediye yollayabilsin (TikTok'tan farkı: çoklu hedef seçilebilir).
  useEffect(() => {
    if (!visible) return;
    const others = participants.filter((p) => p.user_id !== senderId);
    // Rol önceliği: owner > moderator > speaker > listener
    const rolePriority: Record<string, number> = { owner: 0, moderator: 1, speaker: 2, listener: 3 };
    others.sort((a, b) =>
      (rolePriority[a.role] ?? 4) - (rolePriority[b.role] ?? 4)
    );
    const list: Recipient[] = others.map((p) => ({
      id: p.user_id,
      display_name: (p as any).disguise?.display_name || p.user?.display_name || 'Kullanıcı',
      avatar_url: (p as any).disguise?.avatar_url || p.user?.avatar_url || '',
      role: p.role,
    }));
    setRecipients(list);
    // ★ v108.8: defaultRecipientId === senderId ise atla (kendine gönderim engeli);
    //   list ihtimali "list (sender hariç)" olduğu için sender'ın kendisi listede yok,
    //   ama eski state'ten kalmış selectedRecipientId === senderId olabiliyordu.
    const safeDefault = defaultRecipientId && defaultRecipientId !== senderId
      ? list.find((r) => r.id === defaultRecipientId)?.id
      : null;
    const defaultId = safeDefault
      || list.find((r) => r.role === 'owner')?.id
      || list[0]?.id
      || null;
    setSelectedRecipientId(defaultId);
  }, [visible, participants, senderId, defaultRecipientId]);

  // ★ v108.10: Cache'li yükleme — katalog ilk açılışta fetch, sonrakilerde anında.
  //   senderSP her açılışta fresh (gönderim sonrası gerçek bakiye doğru olsun).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    // Cache varsa hemen göster, yoksa loading
    if (_catalogCache && Date.now() - _catalogCache.ts < CATALOG_TTL) {
      setAllGifts(_catalogCache.items);
      setLoading(false);
    } else {
      setLoading(true);
    }
    (async () => {
      const [gifts, profileRes] = await Promise.all([
        getGiftsCached(),
        supabase.from('profiles').select('donatable_sp').eq('id', senderId).single(),
      ]);
      if (cancelled) return;
      setAllGifts(gifts);
      setSenderSP(profileRes.data?.donatable_sp || 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [visible, senderId]);

  // Animasyon
  useEffect(() => {
    if (visible) {
      currentSnapRef.current = SNAP_FULL;
      Animated.parallel([
        Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
      // Floating gift watermark — yumuşak süzülme (4sn cycle)
      Animated.loop(
        Animated.sequence([
          Animated.timing(giftFloat, { toValue: 1, duration: 4000, useNativeDriver: true }),
          Animated.timing(giftFloat, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      currentSnapRef.current = SNAP_DISMISS;
      Animated.parallel([
        Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      giftFloat.stopAnimation();
    }
  }, [visible, PANEL_HEIGHT]);

  // ★ v108.6: InRoomUserProfile paritesi — capture pattern + 3-snap
  //   onMoveShouldSetPanResponderCapture child Pressable/ScrollView'dan responder ÇALMAYI sağlar.
  //   Capture olmadan grid scrollu/kart Pressable drag'ı engelliyordu.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleRelease = (gs: { dy: number; vy: number }) => {
    const finalPos = currentSnapRef.current + gs.dy;
    const fastDown = gs.vy > 0.8;
    const fastUp = gs.vy < -0.5;

    const animateDismiss = () => {
      currentSnapRef.current = SNAP_DISMISS;
      Animated.parallel([
        Animated.timing(translateY, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => onCloseRef.current());
    };
    const animateToHalf = () => {
      currentSnapRef.current = SNAP_HALF;
      Animated.spring(translateY, { toValue: SNAP_HALF, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
    };
    const animateToFull = () => {
      currentSnapRef.current = SNAP_FULL;
      Animated.spring(translateY, { toValue: SNAP_FULL, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
    };

    if (fastDown) {
      if (currentSnapRef.current === SNAP_FULL) animateToHalf();
      else animateDismiss();
      return;
    }
    if (fastUp) { animateToFull(); return; }
    const halfMid = (SNAP_FULL + SNAP_HALF) / 2;
    const dismissMid = (SNAP_HALF + SNAP_DISMISS) / 2;
    if (finalPos > dismissMid) animateDismiss();
    else if (finalPos > halfMid) animateToHalf();
    else animateToFull();
  };

  // Header pan — her zaman yakalar (handle bar + başlık alanı)
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnapRef.current + g.dy;
        translateY.setValue(Math.max(SNAP_FULL - 10, newY));
      },
      onPanResponderRelease: (_, g) => handleRelease(g),
    })
  ).current;

  // Body pan — küçük threshold normal, büyük threshold capture (Pressable'dan responder çal)
  const bodyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dy) < 8) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx)) return false;
        return true;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => {
        if (Math.abs(g.dy) < 25) return false;
        if (Math.abs(g.dy) <= Math.abs(g.dx) * 2) return false;
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newY = currentSnapRef.current + g.dy;
        translateY.setValue(Math.max(SNAP_FULL - 10, newY));
      },
      onPanResponderRelease: (_, g) => handleRelease(g),
    })
  ).current;

  const handleSend = async (item: CosmeticItem) => {
    if (sending) return;
    if (recipients.length === 0) {
      showToast({ title: 'Odada kimse yok', message: 'Hediye gönderebileceğin kullanıcı yok.', type: 'info' });
      return;
    }
    if (!selectedRecipientId) {
      showToast({ title: 'Kime?', message: 'Önce alıcı seç (üstteki avatarlardan)', type: 'info' });
      return;
    }
    if (selectedRecipientId === senderId) {
      showToast({ title: 'Kendine olmaz', message: 'Kendine hediye gönderemezsin — sahneden başka birini seç.', type: 'info' });
      return;
    }
    if (senderSP < item.price_sp) {
      showToast({
        title: 'Yetersiz SP',
        message: `${item.name} için ${item.price_sp} SP gerekli, ${senderSP} SP'n var.`,
        type: 'error',
      });
      return;
    }
    setSending(true);
    // ★ v108.7: Optimistic local play — RPC'yi beklemeden animasyonu başlat.
    //   Realtime gecikmesi (200-1500ms) sender'a hissettirilmiyor; başarısız olursa
    //   zaten kısa sürede biter, uyarı toast ile gösterilir.
    const recipient = recipients.find((r) => r.id === selectedRecipientId);
    const optimisticId = `local-${Date.now()}-${Math.random()}`;
    DeviceEventEmitter.emit('room_gift_local', {
      id: optimisticId,
      itemId: item.id,
      emoji: item.art_emoji || '✨',
      color: item.art_color || '#FBBF24',
      itemName: item.name,
      senderName: 'Sen',
      recipientName: recipient?.display_name || 'Alıcı',
      amount: item.price_sp,
      priceSP: item.price_sp,
      receivedAt: Date.now(),
    });
    // Bakiye anında güncelle
    setSenderSP((prev) => Math.max(0, prev - item.price_sp));

    const { data, error } = await supabase.rpc('send_symbol_gift', {
      p_sender_id: senderId,
      p_recipient_id: selectedRecipientId,
      p_item_id: item.id,
      p_room_id: roomId,
    });
    setSending(false);
    if (error || !data?.success) {
      // Rollback bakiye + uyarı
      setSenderSP((prev) => prev + item.price_sp);
      showToast({
        title: 'Gönderilemedi',
        message: data?.error || error?.message || 'Bağlantı hatası',
        type: 'error',
      });
      return;
    }
    // ★ v108.11: Animasyon + setTimeout fallback. Animated.timing'in Android'de
    //   bazen callback'i çalışmıyordu; setTimeout garanti onClose tetikler.
    currentSnapRef.current = SNAP_DISMISS;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SNAP_DISMISS,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
    setTimeout(() => onCloseRef.current(), 270);
  };

  if (!visible) return null;

  // ★ v108.6: Modal kaldırıldı (InRoomUserProfile paritesi). Modal pan capture'ı bazı
  //   Android sürümlerinde bloklar; absolute fill View ile drag her zaman çalışır.
  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 600 }]} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* ★ v108.5: Floating gift watermark — sağ üst, arkada süzülür */}
        <Animated.View
          pointerEvents="none"
          style={[
            s.giftWatermark,
            {
              opacity: Animated.multiply(
                backdropOpacity,
                giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.16, 0.08] }),
              ),
              transform: [
                { translateY: Animated.add(
                    translateY.interpolate({ inputRange: [0, PANEL_HEIGHT], outputRange: [0, -30], extrapolate: 'clamp' }),
                    giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] }),
                  ) },
                { translateX: giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] }) },
                { scale: giftFloat.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.0, 1.05, 1.0] }) },
                { rotate: '-15deg' },
              ],
            },
          ]}
        >
          <Text style={s.giftWatermarkEmoji} allowFontScaling={false}>🎁</Text>
        </Animated.View>

        {/* Panel — body PanResponder ScrollView/Pressable'dan capture eder */}
        <Animated.View
          style={[s.panel, { paddingBottom: 24 + insets.bottom, transform: [{ translateY }] }]}
          {...bodyPanResponder.panHandlers}
        >
          <LinearGradient
            colors={['#1e2230', '#15182a', '#0a0b16']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', 'rgba(244,114,182,0.85)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* ★ v108.6: Header pan ayrı — handle + başlık alanında her zaman drag */}
          <View {...headerPanResponder.panHandlers} collapsable={false}>
            <View style={s.handle}><View style={s.handleBar} /></View>

            <View style={s.header}>
              <View style={s.headerIconWrap}>
                <Ionicons name="gift" size={18} color="#F472B6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.headerTitle}>HEDİYE GÖNDER</Text>
                <Text style={s.headerSub}>
                  {recipients.length === 0
                    ? 'Odada başka kimse yok'
                    : selectedRecipientId
                      ? (() => {
                          const r = recipients.find(x => x.id === selectedRecipientId);
                          return r ? `→ ${r.display_name}` : `${recipients.length} kişi seçilebilir`;
                        })()
                      : `${recipients.length} kişiyi seç`}
                </Text>
              </View>
              <View style={s.spPill}>
                <SPHexagonIcon size={14} />
                <Text style={s.spPillText}>{senderSP.toLocaleString('tr-TR')}</Text>
              </View>
            </View>
          </View>

          {/* ── Hedef seçici (avatar carousel) ── */}
          {recipients.length > 0 && (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.recipientRow}
              >
                {recipients.map((r) => {
                  const isSelected = r.id === selectedRecipientId;
                  const ringColor = r.role === 'owner' ? '#D4AF37'
                    : r.role === 'moderator' ? '#A78BFA'
                    : r.role === 'speaker' ? '#14B8A6'
                    : 'rgba(148,163,184,0.7)'; // listener — gri
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => setSelectedRecipientId(r.id)}
                      style={s.recipientCell}
                    >
                      <View style={[
                        s.recipientAvatarRing,
                        { borderColor: isSelected ? '#F472B6' : ringColor + '60' },
                        isSelected && s.recipientAvatarRingActive,
                      ]}>
                        <Image source={getAvatarSource(r.avatar_url)} style={s.recipientAvatar} />
                        {r.role === 'owner' && (
                          <View style={s.ownerCrown}>
                            <Ionicons name="star" size={8} color="#1A0A00" />
                          </View>
                        )}
                      </View>
                      <Text style={[s.recipientName, isSelected && { color: '#F472B6' }]} numberOfLines={1}>
                        {r.display_name.split(' ')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── Hediye grid — loading / katalog / boş ── */}
          {loading ? (
            <View style={s.empty}>
              <Animated.View style={{ transform: [{ rotate: giftFloat.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                <Ionicons name="gift" size={42} color="rgba(244,114,182,0.6)" />
              </Animated.View>
              <Text style={s.emptyText}>Hediyeler yükleniyor…</Text>
            </View>
          ) : allGifts.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bag-outline" size={42} color="rgba(255,255,255,0.3)" />
              <Text style={s.emptyText}>Hediye katalogu yüklenemedi</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              <View style={s.grid}>
                {allGifts.map((item) => {
                  const affordable = senderSP >= item.price_sp;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        s.giftCard,
                        sending && { opacity: 0.5 },
                        !affordable && { opacity: 0.55 },
                      ]}
                      onPress={() => handleSend(item)}
                      disabled={sending}
                    >
                      <View style={s.giftThumbWrap}>
                        {hasGiftLottie(item.id) && LottieView ? (
                          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                            {/* ★ v108.11: autoPlay geri açıldı — bazı Lottie'lerin
                                 ilk frame'i boştu (Konfeti, Kar Tanesi vb.).
                                 Görünen kart sayısı max 6 → CPU yükü kabul edilebilir. */}
                            <LottieView source={getGiftLottie(item.id)} autoPlay loop style={{ flex: 1 }} />
                          </View>
                        ) : (
                          <Item3DArt itemId={item.id} fullSize />
                        )}
                      </View>
                      <Text style={s.giftName} numberOfLines={1}>{item.name}</Text>
                      <View style={s.giftPriceRow}>
                        <Text style={s.giftPriceText}>{item.price_sp} SP</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.footnote}>
                Hediyeler her gönderimde SP'ni düşürür · Alıcı %50 SP kazanır
              </Text>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const s = StyleSheet.create({
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    minHeight: PANEL_HEIGHT_BASE,
    maxHeight: H * 0.85,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(244,114,182,0.35)',
    borderBottomWidth: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.6, shadowRadius: 22 },
      android: {},
    }),
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.6 },
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(244,114,182,0.5)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 10 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244,114,182,0.15)',
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.45)',
  },
  headerTitle: { color: '#F1F5F9', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  headerSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  spPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)',
  },
  spPillText: { color: '#FBBF24', fontSize: 11, fontWeight: '800' },

  // ★ v108.5: Floating gift watermark — sağ üst köşede dışarı taşar, hareketli aksesuar
  giftWatermark: {
    position: 'absolute',
    top: '12%',
    right: -30,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    zIndex: 0,
  },
  giftWatermarkEmoji: {
    fontSize: 200,
    lineHeight: 230,
    textAlign: 'center',
  },

  // Hedef seçici
  recipientRow: {
    paddingHorizontal: 14, paddingVertical: 10, gap: 12,
  },
  recipientCell: {
    alignItems: 'center', width: 60,
  },
  recipientAvatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, padding: 2,
    position: 'relative',
    // overflow:hidden KALDIRILDI — ownerCrown rozeti (top:-2/right:-2) halkanın
    // dışına taşmalı; aksi halde sağ-üst köşede yarım pacman gibi kesilir.
    // Image kendi borderRadius:23 ile dairesel görünmeye devam eder.
  },
  recipientAvatarRingActive: {
    ...Platform.select({
      ios: { shadowColor: '#F472B6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  recipientAvatar: { width: '100%', height: '100%', borderRadius: 23 },
  ownerCrown: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#1A1330',
  },
  recipientName: {
    fontSize: 10, color: 'rgba(255,255,255,0.7)',
    marginTop: 4, fontWeight: '600', textAlign: 'center',
  },

  // ★ v108.4: Yüzdelik width + space-between → konteyner genişliğine göre garanti 3 kolon
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    rowGap: 10,
  },
  giftCard: {
    width: '31.5%',
    aspectRatio: 0.85,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    padding: 6,
    alignItems: 'center',
  },
  giftThumbWrap: {
    width: '100%', flex: 1,
    borderRadius: 10, overflow: 'hidden',
    position: 'relative',
  },
  giftName: {
    fontSize: 9, color: '#F1F5F9',
    marginTop: 4, fontWeight: '700',
    maxWidth: '100%',
  },
  giftPriceRow: {
    marginTop: 2,
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 0.5, borderColor: 'rgba(251,191,36,0.4)',
  },
  giftPriceText: { fontSize: 8, color: '#FFE082', fontWeight: '800' },

  // ★ v108.2: Kilitli hediye için kilit ikonu overlay (envanterde olmayanlar)
  lockOverlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  footnote: {
    fontSize: 10, color: 'rgba(255,255,255,0.4)',
    textAlign: 'center', marginTop: 14, paddingHorizontal: 24,
    fontStyle: 'italic',
  },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 36, gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  emptyCta: {
    marginTop: 8, paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 100, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  emptyCtaText: {
    color: '#3D1F00', fontWeight: '900', fontSize: 12,
    fontFamily: serif, letterSpacing: 1.2,
  },
});
