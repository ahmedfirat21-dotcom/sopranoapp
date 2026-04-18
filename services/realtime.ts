/**
 * SopranoChat — Realtime Servisi
 * ═══════════════════════════════════════════════════
 * Oda katılımcı, oda listesi, oda durum değişiklikleri.
 * database.ts monolitinden ayrıştırıldı.
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
  /** Oda katılımcı değişikliklerini dinle — Debounce 300ms + duplicate koruması */
  onRoomChange(roomId: string, callback: (participants: RoomParticipant[]) => void) {
    const name = `room:${roomId}`;
    _purgeSameName(name);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const participants = await RoomService.getParticipants(roomId);
          callback(participants);
        } catch (e) {
          if (__DEV__) console.warn('[Realtime] getParticipants hatası:', e);
        }
      }, 300);
    };
    const channel = supabase
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler);
    channel.subscribe();
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
    return supabase
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, handler)
      .subscribe();
  },

  /** Belirli bir odanın durum değişikliklerini dinle */
  onRoomStatusChange(roomId: string, callback: (room: Room) => void) {
    const name = `room_status:${roomId}`;
    _purgeSameName(name);
    return supabase
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
      )
      .subscribe();
  },

  /** Kanaldan çık (removeChannel içinde channel.unsubscribe() zaten çağrılır) */
  unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    try { supabase.removeChannel(channel); } catch { /* silent */ }
  },
};
