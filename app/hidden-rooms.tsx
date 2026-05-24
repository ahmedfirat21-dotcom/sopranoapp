/**
 * SopranoChat â Gizlenen Odalar YÃ¶netimi
 * âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
 * v107.29 (2 May 2026) â Settings'ten eriÅilen kalÄ±cÄ± yÃ¶netim sayfasÄ±.
 * KullanÄ±cÄ± keÅfette swipe ile gizlediÄi odalarÄ± burada tek tek geri getirebilir.
 *
 * Veri kaynaÄÄ±: AsyncStorage 'ignored_room_ids' (Set<string> JSON serialized)
 * Oda detayÄ±: rooms tablosundan id IN (...) ile Ã§ekilir
 *
 * GÃ¶rÃ¼nÃ¼m:
 *   - Ãstte: "TÃ¼mÃ¼nÃ¼ Geri Getir" buton (X tane gizli)
 *   - Liste: her satÄ±r avatar + isim + host + "Geri Getir" buton
 *   - BoÅ durum: "HiÃ§ gizlediÄin oda yok" mesajÄ±
 */

import React, { useState, useEffect, useCallback } from 'react';
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, Pressable, FlatList, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeGoBack } from '../constants/navigation';
import { Colors } from '../constants/theme';
import { supabase } from '../constants/supabase';
import { getAvatarSource } from '../constants/avatars';
import AppBackground from '../components/AppBackground';
import UserListSkeleton from '../components/UserListSkeleton';
import { showToast } from '../components/Toast';

interface HiddenRoom {
  id: string;
  name: string;
  category: string;
  host_id: string;
  host?: { display_name: string | null; avatar_url: string | null };
}

export default function HiddenRoomsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [rooms, setRooms] = useState<HiddenRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHidden = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem('ignored_room_ids');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setHiddenIds(ids);
      if (ids.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }
      // Oda detaylarÄ±nÄ± Ã§ek
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, category, host_id, host:profiles!rooms_host_id_fkey(display_name, avatar_url)')
        .in('id', ids);
      if (error) throw error;
      setRooms((data || []) as any);
    } catch (e: any) {
      if (__DEV__) console.warn('[HiddenRooms] load error:', e?.message);
      showToast({ title: i18n.t('hiddenrooms.001'), message: e?.message || 'Tekrar dene', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHidden();
  }, [loadHidden]);

  const unignoreOne = useCallback(async (roomId: string) => {
    const next = hiddenIds.filter(id => id !== roomId);
    setHiddenIds(next);
    setRooms(prev => prev.filter(r => r.id !== roomId));
    try {
      await AsyncStorage.setItem('ignored_room_ids', JSON.stringify(next));
    } catch {}
  }, [hiddenIds]);

  const unignoreAll = useCallback(async () => {
    setHiddenIds([]);
    setRooms([]);
    try {
      await AsyncStorage.removeItem('ignored_room_ids');
    } catch {}
    showToast({ title: i18n.t('hiddenrooms.002'), type: 'success' });
  }, []);

  return (
    <AppBackground>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Gizlenen Odalar</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* "TÃ¼mÃ¼nÃ¼ Geri Getir" â sadece liste boÅ deÄilse */}
        {!loading && hiddenIds.length > 0 && (
          <View style={styles.actionRow}>
            <Text style={styles.countText}>{hiddenIds.length} gizli oda</Text>
            <Pressable onPress={unignoreAll} style={({ pressed }) => [styles.unignoreAllBtn, pressed && { opacity: 0.7 }]}>
              <Ionicons name="refresh" size={14} color="#FBBF24" />
              <Text style={styles.unignoreAllText}>{i18n.t('hiddenrooms.001')}</Text>
            </Pressable>
          </View>
        )}

        {/* Liste */}
        {loading ? (
          <UserListSkeleton count={4} showAction />
        ) : hiddenIds.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="eye-outline" size={42} color="rgba(94,234,212,0.25)" />
            <Text style={styles.emptyTitle}>{i18n.t('hiddenrooms.002')}</Text>
            <Text style={styles.emptySub}>{i18n.t('hiddenrooms.003')}</Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 10 }}
            initialNumToRender={10}
            windowSize={5}
            maxToRenderPerBatch={10}
            removeClippedSubviews
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Image
                  source={getAvatarSource(item.host?.avatar_url)}
                  style={styles.avatar}
                />
                <View style={styles.info}>
                  <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.hostName} numberOfLines={1}>
                    {item.host?.display_name || i18n.t('common.anonymous')}
                  </Text>
                </View>
                <Pressable
                  onPress={() => unignoreOne(item.id)}
                  style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.7 }]}
                >
                  <LinearGradient
                    colors={['rgba(20,184,166,0.18)', 'rgba(20,184,166,0.08)']}
                    style={styles.restoreBtnGrad}
                  >
                    <Ionicons name="refresh" size={13} color="#5EEAD4" />
                    <Text style={styles.restoreBtnText}>Geri Getir</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              hiddenIds.length > 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptySub}>{i18n.t('hiddenrooms.004')}</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 15, fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  countText: {
    fontSize: 12, fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  unignoreAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  unignoreAllText: {
    fontSize: 11, fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  info: { flex: 1, gap: 2 },
  roomName: {
    fontSize: 14, fontWeight: '700',
    color: Colors.text,
  },
  hostName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
  restoreBtn: {
    borderRadius: 100,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.30)',
  },
  restoreBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  restoreBtnText: {
    fontSize: 11, fontWeight: '800',
    color: '#5EEAD4',
    letterSpacing: 0.3,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32, paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15, fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 17,
  },
});
