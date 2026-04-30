/**
 * SopranoChat — Realtime Servisi
 * ═══════════════════════════════════════════════════
 * Oda katılımcı, oda listesi, oda durum değişiklikleri.
 * database.ts monolitinden ayrıştırıldı.
 *
 * ★ 2026-04-30 v5: Çift kanal yapısına geri dön (stabilite)
 *   - room_participants → room:{roomId} kanalı
 *   - rooms → room_status:{roomId} kanalı
 *   - Heartbeat filtresi kaldırıldı (kanal event gelişi doğrulanana kadar)
 *   - Subscribe status callback + CHANNEL_ERROR retry korundu
 */
import { supabase } from '../constants/supabase';
import { RoomService } from './room';
import type { Room, RoomParticipant } from '../types';

// ============================================
// REALTIME — Oda dinleyicisi
// ============================================

// Aynı topic ile zaten kayıtlı kanal varsa önce onu kaldır.
// (Hızlı remount / StrictMode / cleanup awaitsizliği → duplicate subscribe riskini eler.)
export function purgeChannelByName(name: string) {
  try {
    const existing = supabase.getChannels().find((ch: any) => ch.topic === `realtime:${name}`);
    if (existing) supabase.removeChannel(existing);
  } catch { /* ilk çağrıda kanal olmayabilir */ }
}
const _purgeSameName = purgeChannelByName;

export const RealtimeService = {
  /**
   * ★ v5: room_participants kanalı — INSERT / DELETE / UPDATE dinler.
   * Debounce 100ms — her event'te getParticipants çağrılır.
   */
  onRoomChange(
    roomId: string,
    onParticipants: (participants: RoomParticipant[]) => void,
  ) {
    const name = `room:${roomId}`;
    _purgeSameName(name);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchParticipants = async () => {
      try {
        const participants = await RoomService.getParticipants(roomId);
        onParticipants(participants);
      } catch (e) {
        if (__DEV__) console.warn('[Realtime] getParticipants hatası:', e);
      }
    };

    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchParticipants, 100);
    };

    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        debouncedFetch,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        debouncedFetch,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        debouncedFetch,
      );

    // ★ Subscribe — anon Realtime client kullanıldığı için artık CHANNEL_ERROR
    //   beklenmiyor, ama retry mekanizması ağ kopmaları için yine de korundu.
    //   Önemli: retry'de full callback ile yeniden subscribe et — yoksa
    //   SUBSCRIBED durumu yakalanmaz, fetchParticipants() asla tetiklenmez.
    const subscribeWithRetry = () => {
      channel.subscribe((status: string, err?: Error) => {
        if (__DEV__) console.log(`[Realtime] room:${roomId} status → ${status}`, err?.message || '');
        if (status === 'SUBSCRIBED') {
          fetchParticipants();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (__DEV__) console.warn(`[Realtime] room:${roomId} subscribe FAILED: ${status}`, err?.message);
          setTimeout(subscribeWithRetry, 3000);
        }
      });
    };
    subscribeWithRetry();

    return channel;
  },

  /** Oda listesi değişikliklerini dinle */
  onRoomsChange(callback: (rooms: Room[]) => void) {
    const name = 'rooms:all';
    _purgeSameName(name);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const rooms = await RoomService.getLive();
        callback(rooms);
      }, 500);
    };
    const channel = supabase
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, handler);
    
    channel.subscribe((status: string) => {
      if (__DEV__) console.log(`[Realtime] rooms:all status → ${status}`);
    });
    
    return channel;
  },

  /**
   * ★ v5: Oda durumu kanalı — rooms UPDATE dinler.
   * Ayrı kanal olarak geri döndürüldü (stabilite).
   */
  onRoomStatusChange(roomId: string, callback: (room: Room) => void) {
    const name = `room_status:${roomId}`;
    _purgeSameName(name);
    const channel = supabase
      .channel(name)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        async () => {
          try {
            const room = await RoomService.get(roomId);
            callback(room);
          } catch {}
        }
      );
    
    channel.subscribe((status: string) => {
      if (__DEV__) console.log(`[Realtime] room_status:${roomId} status → ${status}`);
    });
    
    return channel;
  },

  /** Kanaldan çık (removeChannel içinde channel.unsubscribe() zaten çağrılır) */
  unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    try { supabase.removeChannel(channel); } catch { /* silent */ }
  },
};
