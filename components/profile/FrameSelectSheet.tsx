/**
 * SopranoChat — Çerçeve Seçim Sheet
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Profile sayfasında "Çerçeve" butonuna basınca açılır.
 * Kullanıcının envanterindeki atelier ürünlerini grid'de listeler, seçim
 * → equip_frame RPC ile profiles.active_frame UPDATE.
 *
 * "Çıkar" pill'i: active_frame=NULL.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Dimensions, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { supabase } from '../../constants/supabase';
import { StoreService, type CosmeticItem } from '../../services/store';
import { getIllustrationHtml } from '../../constants/storeIllustrations';
import { showToast } from '../Toast';

const { width: W } = Dimensions.get('window');
const PANEL_HEIGHT_BASE = 600;

interface Props {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Şu an takılı çerçevenin id'si — seçili gösterimi için */
  currentFrameId?: string | null;
  /** Seçim sonrası parent'a yeni frameId iletir (UI optimistic update için) */
  onFrameChange?: (frameId: string | null) => void;
}

function FrameThumb({ itemId }: { itemId: string }) {
  const html = getIllustrationHtml(itemId);
  if (!html) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <WebView source={{ html }} style={{ flex: 1, backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: 'transparent' }}
        scrollEnabled={false} bounces={false} originWhitelist={['*']}
        javaScriptEnabled domStorageEnabled={false} androidLayerType="hardware" scalesPageToFit={false} />
    </View>
  );
}

export default function FrameSelectSheet({ visible, onClose, userId, currentFrameId, onFrameChange }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const PANEL_HEIGHT = PANEL_HEIGHT_BASE + Math.max(insets.bottom, 0);

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const [frames, setFrames] = useState<CosmeticItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const [{ items }, inv] = await Promise.all([
        StoreService.getCatalog(),
        StoreService.getUserInventory(userId),
      ]);
      if (cancelled) return;
      const owned = items.filter((i) => i.category === 'atelier' && inv.has(i.id));
      setFrames(owned);
    })();
    return () => { cancelled = true; };
  }, [visible, userId]);

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

  const handleEquip = async (frameId: string | null) => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('equip_frame', {
      p_user_id: userId,
      p_item_id: frameId,
    });
    setBusy(false);
    if (error || !data?.success) {
      showToast({ title: 'Hata', message: data?.error || error?.message || 'Bağlantı hatası', type: 'error' });
      return;
    }
    onFrameChange?.(frameId);
    showToast({
      title: frameId ? '✓ Çerçeve Takıldı' : '✓ Çerçeve Çıkarıldı',
      message: data.item_name || 'Profilinde aktif',
      type: 'success',
    });
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject as any} pointerEvents="box-none">
      <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 540 }} pointerEvents="box-none">
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
            colors={['transparent', 'rgba(251,191,36,0.85)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.topEdge}
          />

          <View style={s.handle}><View style={s.handleBar} /></View>

          <View style={s.header}>
            <View style={s.headerIconWrap}>
              <Ionicons name="ribbon" size={18} color="#FBBF24" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>ÇERÇEVE SEÇİMİ</Text>
              <Text style={s.headerSub}>Avatarın etrafında görünür</Text>
            </View>
            {currentFrameId && (
              <Pressable
                onPress={() => handleEquip(null)}
                disabled={busy}
                style={s.removeBtn}
              >
                <Ionicons name="close" size={14} color="#F87171" />
                <Text style={s.removeBtnText}>ÇIKAR</Text>
              </Pressable>
            )}
          </View>

          {frames.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="ribbon-outline" size={42} color="rgba(255,255,255,0.3)" />
              <Text style={s.emptyText}>Envanterinde çerçeve yok</Text>
              <Pressable style={s.emptyCta} onPress={() => { onClose(); router.push('/store' as any); }}>
                <LinearGradient
                  colors={['#FFE082', '#FAC775']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={s.emptyCtaText}>ATELYE'YE GİT</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.grid}>
                {frames.map((item) => {
                  const selected = item.id === currentFrameId;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        s.frameCard,
                        selected && s.frameCardSelected,
                        busy && { opacity: 0.5 },
                      ]}
                      onPress={() => !selected && handleEquip(item.id)}
                      disabled={busy}
                    >
                      <View style={s.frameThumbWrap}>
                        <FrameThumb itemId={item.id} />
                      </View>
                      <Text style={s.frameName} numberOfLines={1}>{item.name}</Text>
                      {selected && (
                        <View style={s.activeBadge}>
                          <Ionicons name="checkmark" size={12} color="#0A0F1A" />
                          <Text style={s.activeBadgeText}>AKTİF</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.footnote}>
                Tek seferde tek çerçeve aktif. Çıkar diyerek kaldırabilirsin.
              </Text>
            </>
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
  handle: { alignItems: 'center', paddingVertical: 12 },
  handleBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(251,191,36,0.5)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 14 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)',
  },
  headerTitle: { fontSize: 13, fontWeight: '900', color: '#FBBF24', letterSpacing: 1.4, fontFamily: serif },
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
    borderColor: 'rgba(251,191,36,0.7)',
    backgroundColor: 'rgba(251,191,36,0.08)',
  },
  frameThumbWrap: { flex: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 6, position: 'relative' },
  frameName: { fontSize: 11, fontWeight: '800', color: '#F1F5F9', textAlign: 'center', fontFamily: serif },
  activeBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
    backgroundColor: '#FBBF24',
  },
  activeBadgeText: { color: '#0A0F1A', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  footnote: {
    fontSize: 10.5, fontWeight: '500',
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    marginTop: 10, paddingHorizontal: 18, lineHeight: 14,
  },
});
