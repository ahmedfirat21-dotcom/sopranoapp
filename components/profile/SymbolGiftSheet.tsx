/**
 * SopranoChat — Sembol Hediye Sheet
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Mağazadan satın alınmış gift sembollerinin
 * arkadaşa gönderilmesi. Envanter düşmez, sadece notification + ekran
 * animasyonu (cosmetic publicity).
 *
 * Akış:
 *   1. Kullanıcı arkadaş profilini açar → "Sembol Hediye" butonuna basar
 *   2. Bu sheet açılır → envanterindeki gift item'ları grid'de
 *   3. Birini seçer → onay → send_symbol_gift RPC çağrılır
 *   4. Receiver tarafında notif düşer + GiftRT realtime ile floating animasyon
 *
 * Tema: Hediye (pembe/altın gradient + drag-to-dismiss)
 */

import React, { useEffect, useRef, useState } from 'react';
import { i18n } from '../../services/i18n';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions, Pressable, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../constants/supabase';
import { StoreService, type CosmeticItem } from '../../services/store';
import Item3DArt from '../store/Item3DArt';
import { showToast } from '../Toast';
import { getGiftLottie, hasGiftLottie } from '../../constants/giftLottieRegistry';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback */ }

const { width: W } = Dimensions.get('window');
const PANEL_HEIGHT_BASE = 580;

interface Props {
  visible: boolean;
  onClose: () => void;
  senderId: string;
  recipientId: string;
  recipientName: string;
  /** ★ v107: Oda içinden gönderim — RPC bunu room_live_gifts + sistem mesajına yansıtır */
  roomId?: string | null;
}

function GiftThumb({ itemId }: { itemId: string }) {
  // ★ v107: Lottie animasyonu varsa onu göster (Bigo/TikTok seviyesi), yoksa PNG
  if (hasGiftLottie(itemId) && LottieView) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <LottieView source={getGiftLottie(itemId)} autoPlay loop style={{ flex: 1 }} />
      </View>
    );
  }
  return <Item3DArt itemId={itemId} fullSize />;
}

export default function SymbolGiftSheet({ visible, onClose, senderId, recipientId, recipientName, roomId }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_HEIGHT_BASE + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [allGifts, setAllGifts] = useState<CosmeticItem[]>([]);
  const [senderSP, setSenderSP] = useState<number>(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const [{ items }, profileRes] = await Promise.all([
        StoreService.getCatalog(),
        supabase.from('profiles').select('donatable_sp').eq('id', senderId).single(),
      ]);
      if (cancelled) return;
      const gifts = items.filter((i) => i.category === 'gift');
      gifts.sort((a, b) => a.price_sp - b.price_sp);
      setAllGifts(gifts);
      setSenderSP(profileRes.data?.donatable_sp || 0);
    })();
    return () => { cancelled = true; };
  }, [visible, senderId]);

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

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
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

  const handleSend = async (item: CosmeticItem) => {
    if (sending) return;
    if (senderSP < item.price_sp) {
      showToast({
        title: 'Yetersiz SP',
        message: `${item.name} için ${item.price_sp} SP gerekli, ${senderSP} SP'n var.`,
        type: 'error',
      });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc('send_symbol_gift', {
      p_sender_id: senderId,
      p_recipient_id: recipientId,
      p_item_id: item.id,
      p_room_id: roomId || null,
    });
    setSending(false);
    if (error || !data?.success) {
      showToast({
        title: i18n.t('profile.symbolgiftsheet.002'),
        message: data?.error || error?.message || 'Bağlantı hatası',
        type: 'error',
      });
      return;
    }
    setSenderSP((prev) => Math.max(0, prev - item.price_sp));
    showToast({
      title: `${item.art_emoji || '✨'} Gönderildi`,
      message: `${recipientName} → ${item.name} (-${item.price_sp} SP)`,
      type: 'success',
    });
    onClose();
  };

  if (!visible) return null;

  // ★ v107 hotfix: Modal — sistem seviyesinde render, parent layout takılmasını önler.
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[s.panel, { paddingBottom: 24 + insets.bottom, transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
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

          <View style={s.handle}><View style={s.handleBar} /></View>

          <View style={s.header}>
            <View style={s.headerIconWrap}>
              <Ionicons name="gift" size={18} color="#F472B6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{i18n.t('profile.symbolgiftsheet.001')}</Text>
              <Text style={s.headerSub}>{recipientName} kişisine</Text>
            </View>
          </View>

          {allGifts.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bag-outline" size={42} color="rgba(255,255,255,0.3)" />
              <Text style={s.emptyText}>{i18n.t('profile.symbolgiftsheet.002')}</Text>
            </View>
          ) : (
            <>
              <View style={s.grid}>
                {allGifts.map((item) => {
                  const affordable = senderSP >= item.price_sp;
                  return (
                    <Pressable
                      key={item.id}
                      style={[s.giftCard, sending && { opacity: 0.5 }, !affordable && { opacity: 0.55 }]}
                      onPress={() => handleSend(item)}
                      disabled={sending}
                    >
                      <View style={s.giftThumbWrap}>
                        <GiftThumb itemId={item.id} />
                      </View>
                      <Text style={s.giftName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.giftPrice}>{item.price_sp} SP</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.footnote}>{i18n.t('profile.symbolgiftsheet.001')}</Text>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const s = StyleSheet.create({
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    minHeight: PANEL_HEIGHT_BASE,
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 14 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244,114,182,0.15)',
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.45)',
  },
  headerTitle: {
    fontSize: 13, fontWeight: '900', color: '#F472B6',
    letterSpacing: 1.4, fontFamily: serif,
  },
  headerSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 14, paddingHorizontal: 32 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  emptyCta: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 100, overflow: 'hidden',
    minWidth: 160, alignItems: 'center',
  },
  emptyCtaText: { color: '#3D1F00', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, justifyContent: 'space-between',
  },
  giftCard: {
    width: (W - 14 * 2 - 10) / 2,
    height: (W - 14 * 2 - 10) / 2 + 28,
    marginBottom: 10,
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  giftThumbWrap: {
    flex: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 6,
    position: 'relative',
  },
  giftName: {
    fontSize: 11, fontWeight: '800',
    color: '#F1F5F9',
    textAlign: 'center',
    fontFamily: serif,
  },
  giftPrice: {
    fontSize: 10, fontWeight: '800',
    color: '#FBBF24',
    textAlign: 'center',
    marginTop: 2,
  },
  footnote: {
    fontSize: 10.5, fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    marginTop: 10, paddingHorizontal: 18, lineHeight: 14,
  },
});
