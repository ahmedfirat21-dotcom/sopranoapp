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
export const RealtimeService = {
  /** Oda katılımcı değişikliklerini dinle */
  onRoomChange(roomId: string, callback: (participants: RoomParticipant[]) => void) {
    const handler = async () => {
      try {
        const participants = await RoomService.getParticipants(roomId);
        callback(participants);
      } catch (e) {
        if (__DEV__) console.warn('[Realtime] getParticipants hatası:', e);
      }
    };
    return supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .subscribe();
  },

  /** Oda listesi değişikliklerini dinle */
  onRoomsChange(callback: (rooms: Room[]) => void) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const rooms = await RoomService.getLive();
        callback(rooms);
      }, 500);
    };
    return supabase
      .channel('rooms:all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, handler)
      .subscribe();
  },

  /** Belirli bir odanın durum değişikliklerini dinle */
  onRoomStatusChange(roomId: string, callback: (room: Room) => void) {
    return supabase
      .channel(`room_status:${roomId}`)
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

  /** Kanaldan çık */
  unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    supabase.removeChannel(channel);
  },
};
