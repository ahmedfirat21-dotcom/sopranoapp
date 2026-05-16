/**
 * SopranoChat — Çerçeve & Giriş Efekti Seçim Sheet
 * ═══════════════════════════════════════════════════════════════════
 * v108 (4 May 2026) — Profile'da kozmetik seçim bottom sheet.
 * İki tab: Çerçeveler | Giriş Efektleri
 *
 * Çerçeve  → equip_frame RPC → profiles.active_frame
 * Efekt    → equip_entry_effect RPC → profiles.active_entry_effect
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions, Pressable, Platform, Modal, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StoreService, type CosmeticItem } from '../../services/store';
import { CosmeticService } from '../../services/cosmetic';
import { supabase } from '../../constants/supabase';
import Item3DArt from '../store/Item3DArt';
import AvatarFrame from './AvatarFrame';
import { hasFrameLottie, getFrameLottie } from '../../constants/frameLottieRegistry';
import { i18n } from '../../services/i18n';
import { hasGiftLottie, getGiftLottie } from '../../constants/giftLottieRegistry';
import { hasIllustration } from '../../constants/storeIllustrationsPng';
import { Image } from 'react-native';
import { getAvatarSource } from '../../constants/avatars';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback */ }
import { showToast } from '../Toast';

const { width: W } = Dimensions.get('window');
const PANEL_HEIGHT_BASE = 580;

type TabKey = 'frames' | 'effects';

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  currentFrameId?: string | null;
  currentEntryEffectId?: string | null;
  /** ★ v108.14: kullanıcının kendi avatar URL'i — frame preview'inde mock avatar yerine kullanılır */
  currentAvatarUrl?: string | null;
  onFrameChange?: (frameId: string | null) => void;
  onEntryEffectChange?: (effectId: string | null) => void;
}

export default function FrameSelectSheet({
  visible, onClose, userId,
  currentFrameId, currentEntryEffectId, currentAvatarUrl,
  onFrameChange, onEntryEffectChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_HEIGHT_BASE + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [activeTab, setActiveTab] = useState<TabKey>('frames');
  const [frames, setFrames] = useState<CosmeticItem[]>([]);
  const [effects, setEffects] = useState<CosmeticItem[]>([]);
  const [busy, setBusy] = useState(false);
  // ★ 2026-05-05: mounted state — visible false olunca anında unmount olmasın,
  //   kapanış animasyonu bitsin sonra Modal kalksın. Akıcı kapanma için şart.
  const [mounted, setMounted] = useState(visible);

  // ★ Akıcı kapatma helper — backdrop tap, drag-release, programatik close hepsi bunu çağırır.
  const closeWithAnim = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setMounted(false);
      onClose();
    });
  }, [PANEL_HEIGHT, onClose, translateY, backdropOpacity]);

  // Veri yükle
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const [{ items }, inv] = await Promise.all([
        StoreService.getCatalog(),
        StoreService.getUserInventory(userId),
      ]);
      if (cancelled) return;
      // Çerçeveler: frames + atelier (geriye uyumlu)
      const ownedFrames = items.filter(
        (i) => (i.category === 'frames' || i.category === 'atelier') && inv.has(i.id)
      );
      // Giriş efektleri: entry_effect + message_art (geriye uyumlu)
      const ownedEffects = items.filter(
        (i) => (i.category === 'entry_effect' || i.category === 'message_art') && inv.has(i.id)
      );
      setFrames(ownedFrames);
      setEffects(ownedEffects);
    })();
    return () => { cancelled = true; };
  }, [visible, userId]);

  // Animasyon — visible açılınca mounted true + spring up; kapanış closeWithAnim üzerinden
  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Bir frame sonra spring (mount + layout settle)
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
          Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        ]).start();
      });
    } else if (mounted) {
      // Programatik kapanış (visible prop false oldu) → akıcı animasyon
      Animated.parallel([
        Animated.timing(translateY, { toValue: PANEL_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, PANEL_HEIGHT]);

  // ★ 2026-05-10 (v2): Pan-to-dismiss — Modal içindeki ScrollView+Lottie kombinasyonu
  //   render thread'i bloklayıp parent gesture detection'ı geç tetikliyordu. Çözüm:
  //   1. Header pan responder (handle/tabs/header) — her zaman drag-down yakalar
  //   2. Body pan responder (panel) — scroll-top'ta drag-down yakalar
  //   3. Capture threshold düşük (5-8px) — child Lottie'ler kapamadan önce parent yakar
  const closeRef = useRef(closeWithAnim);
  closeRef.current = closeWithAnim;
  const scrollOffsetRef = useRef(0);
  const handleScroll = React.useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);

  // Header pan — handle + tabs + header bölgesi. Scroll-aware DEĞİL, her zaman drag yakalar.
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onMoveShouldSetPanResponderCapture: (_, gs) => Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          closeRef.current();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  // Body pan — ScrollView'un dış wrapper'ında. Scroll-top'ta drag-down yakalar.
  const bodyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (Math.abs(gs.dy) < 8) return false;
        if (Math.abs(gs.dy) <= Math.abs(gs.dx)) return false;
        return gs.dy > 0 && scrollOffsetRef.current <= 0;
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        if (Math.abs(gs.dy) < 12) return false;
        if (Math.abs(gs.dy) <= Math.abs(gs.dx) * 1.5) return false;
        return gs.dy > 0 && scrollOffsetRef.current <= 0;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          closeRef.current();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
        }
      },
    })
  ).current;

  // ★ 2026-05-10: Kullanıcı odadayken kozmetik değiştirirse, oda içindeki diğer
  //   katılımcılar değişikliği realtime görsün. profiles UPDATE oda kanalında
  //   dinlenmiyor; room_participants tablosuna touch UPDATE atınca mevcut sub
  //   fetchParticipants tetikler, profiles join ile fresh active_frame gelir.
  const touchRoomPresenceIfInRoom = async () => {
    try {
      const inRoomId = (global as any).__sopranoInRoom as string | undefined;
      if (!inRoomId) return;
      await supabase
        .from('room_participants')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('room_id', inRoomId)
        .eq('user_id', userId);
    } catch { /* realtime push non-critical */ }
  };

  // Çerçeve equip
  const handleEquipFrame = async (frameId: string | null) => {
    if (busy) return;
    setBusy(true);
    const result = await CosmeticService.equipFrame(userId, frameId);
    setBusy(false);
    if (!result.success) {
      showToast({ title: 'Hata', message: result.error || 'Bağlantı hatası', type: 'error' });
      return;
    }
    onFrameChange?.(frameId);
    touchRoomPresenceIfInRoom();
  };

  // Giriş efekti equip
  const handleEquipEffect = async (effectId: string | null) => {
    if (busy) return;
    setBusy(true);
    const result = await CosmeticService.equipEntryEffect(userId, effectId);
    setBusy(false);
    if (!result.success) {
      showToast({ title: 'Hata', message: result.error || 'Bağlantı hatası', type: 'error' });
      return;
    }
    onEntryEffectChange?.(effectId);
    touchRoomPresenceIfInRoom();
  };

  if (!mounted) return null;

  const isFrameTab = activeTab === 'frames';
  const currentItems = isFrameTab ? frames : effects;
  const currentId = isFrameTab ? currentFrameId : currentEntryEffectId;
  const handleEquip = isFrameTab ? handleEquipFrame : handleEquipEffect;
  const accentColor = isFrameTab ? '#FBBF24' : '#A855F7';

  return (
    // ★ 2026-05-10 v3: Modal sarmalı kaldırıldı — UserSearchModal pattern'i.
    //   RN Modal native component pan gesture'ları yutuyordu (drag-to-dismiss
    //   FrameSelectSheet'in tab değişiminden sonra kırılıyordu). View overlay
    //   zIndex:300 ile aynı görsel davranış, ama gesture'lar tertemiz iletilir.
    <View style={[StyleSheet.absoluteFillObject as any, { zIndex: 300, elevation: 24 }]} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnim} />
        </Animated.View>

        <Animated.View
          style={[s.panel, { paddingBottom: 24 + insets.bottom, transform: [{ translateY }] }]}
        >
          <LinearGradient
            colors={['#1e2230', '#15182a', '#0a0b16']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={['transparent', accentColor + 'D9', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          {/* ★ 2026-05-10 v2: Header pan zone (handle/tabs/header) — her zaman drag yakalar */}
          <View {...headerPanResponder.panHandlers}>
            <View style={s.handle}><View style={[s.handleBar, { backgroundColor: accentColor + '80' }]} /></View>

          {/* Tab seçici */}
          <View style={s.tabRow}>
            <Pressable
              style={[s.tab, activeTab === 'frames' && [s.tabActive, { borderBottomColor: '#FBBF24' }]]}
              onPress={() => setActiveTab('frames')}
            >
              <Ionicons name="ribbon" size={16} color={activeTab === 'frames' ? '#FBBF24' : 'rgba(255,255,255,0.4)'} />
              <Text style={[s.tabText, activeTab === 'frames' && { color: '#FBBF24' }]}>{i18n.t('profile.frames_tab')}</Text>
            </Pressable>
            <Pressable
              style={[s.tab, activeTab === 'effects' && [s.tabActive, { borderBottomColor: '#A855F7' }]]}
              onPress={() => setActiveTab('effects')}
            >
              <Ionicons name="sparkles" size={16} color={activeTab === 'effects' ? '#A855F7' : 'rgba(255,255,255,0.4)'} />
              <Text style={[s.tabText, activeTab === 'effects' && { color: '#A855F7' }]}>{i18n.t('profile.entry_effects_tab')}</Text>
            </Pressable>
          </View>

          {/* Header */}
          <View style={s.header}>
            <View style={[s.headerIconWrap, { backgroundColor: accentColor + '26', borderColor: accentColor + '73' }]}>
              <Ionicons name={isFrameTab ? 'ribbon' : 'sparkles'} size={18} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.headerTitle, { color: accentColor }]}>
                {isFrameTab ? 'ÇERÇEVE SEÇİMİ' : 'GİRİŞ EFEKTİ SEÇ'}
              </Text>
              <Text style={s.headerSub}>
                {isFrameTab ? 'Avatarın etrafında görünür' : 'Odaya girdiğinde herkese gösterilir'}
              </Text>
            </View>
            {currentId && (
              <Pressable
                onPress={() => handleEquip(null)}
                disabled={busy}
                style={s.removeBtn}
              >
                <Ionicons name="close" size={14} color="#F87171" />
                <Text style={s.removeBtnText}>{i18n.t('profile.remove_uppercase')}</Text>
              </Pressable>
            )}
          </View>
          </View>{/* /header pan zone */}

          {/* ★ 2026-05-10 v3: Body pan zone KALDIRILDI — ScrollView native scroll'unu
              engelliyordu. Drag-to-dismiss artık SADECE handle/tabs/header bölgesinden.
              Memory feedback_modal_drag_dismiss.md uyumlu (handle yeter). */}
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {currentItems.length === 0 ? (
              <View style={s.empty}>
                <Ionicons
                  name={isFrameTab ? 'ribbon-outline' : 'sparkles-outline'}
                  size={42}
                  color="rgba(255,255,255,0.3)"
                />
                <Text style={s.emptyText}>
                  {isFrameTab ? 'Envanterinde çerçeve yok' : 'Envanterinde giriş efekti yok'}
                </Text>
                <Pressable style={s.emptyCta} onPress={() => { onClose(); router.push('/store' as any); }}>
                  <LinearGradient
                    colors={isFrameTab ? ['#FFE082', '#FAC775'] : ['#C4B5FD', '#A855F7']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={[s.emptyCtaText, !isFrameTab && { color: '#fff' }]}>{i18n.t('profile.go_to_store')}</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={s.grid}>
                  {currentItems.map((item) => {
                    const selected = item.id === currentId;
                    return (
                      <Pressable
                        key={item.id}
                        style={[
                          s.frameCard,
                          selected && [s.frameCardSelected, { borderColor: accentColor + 'B3' }],
                          busy && { opacity: 0.5 },
                        ]}
                        onPress={() => !selected && handleEquip(item.id)}
                        disabled={busy}
                      >
                        <View style={s.frameThumbWrap}>
                          {/* ★ v108.14: Frame preview — mock avatar + AvatarFrame
                               (gerçek görünümün birebir simülasyonu).
                               Effect preview — Lottie / PNG / emoji fallback. */}
                          {isFrameTab ? (
                            <View style={s.framePreviewWrap}>
                              <Image source={getAvatarSource(currentAvatarUrl)} style={s.framePreviewAvatar} />
                              <AvatarFrame frameId={item.id} size={64} />
                            </View>
                          ) : hasGiftLottie(item.id) && LottieView ? (
                            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                              <LottieView source={getGiftLottie(item.id)} autoPlay loop style={{ flex: 1 }} />
                            </View>
                          ) : hasIllustration(item.id) ? (
                            <Item3DArt itemId={item.id} fullSize />
                          ) : (
                            <Text style={s.fallbackEmoji}>{item.art_emoji || '✨'}</Text>
                          )}
                        </View>
                        <Text style={s.frameName} numberOfLines={1}>{item.name}</Text>
                        {selected && (
                          <View style={[s.activeBadge, { backgroundColor: accentColor }]}>
                            <Ionicons name="checkmark" size={12} color="#0A0F1A" />
                            <Text style={s.activeBadgeText}>{i18n.t('profile.active_uppercase')}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.footnote}>
                  {isFrameTab
                    ? 'Tek seferde tek çerçeve aktif. Çıkar diyerek kaldırabilirsin.'
                    : 'Odaya her girişte seçili efekt gösterilir.'}
                </Text>
              </>
            )}
          </ScrollView>
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
    maxHeight: '85%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.35)',
    borderBottomWidth: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.6, shadowRadius: 22 },
      android: {},
    }),
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.6 },
  handle: { alignItems: 'center', paddingVertical: 10 },
  handleBar: { width: 44, height: 4, borderRadius: 2 },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 14, marginBottom: 12,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.03)' },
  tabText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 1.4, fontFamily: serif },
  headerSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 0.8, borderColor: 'rgba(248,113,113,0.45)',
  },
  removeBtnText: { color: '#F87171', fontSize: 9.5, fontWeight: '900', letterSpacing: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 14, paddingHorizontal: 32 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  emptyCta: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 100, overflow: 'hidden',
    minWidth: 160, alignItems: 'center',
  },
  emptyCtaText: { color: '#3D1F00', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, justifyContent: 'space-between',
  },
  frameCard: {
    width: (W - 14 * 2 - 10) / 2,
    height: (W - 14 * 2 - 10) / 2 + 28,
    marginBottom: 10,
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  frameCardSelected: {
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  frameThumbWrap: { flex: 1, borderRadius: 10, overflow: 'visible', marginBottom: 6, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  framePreviewWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  framePreviewAvatar: { width: 64, height: 64, borderRadius: 32 },
  fallbackEmoji: { fontSize: 44, textAlign: 'center' },
  frameName: { fontSize: 11, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', fontFamily: serif },
  activeBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  activeBadgeText: { color: '#0A0F1A', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  footnote: {
    fontSize: 10.5, fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    marginTop: 10, marginBottom: 20, paddingHorizontal: 18, lineHeight: 14,
  },
});
