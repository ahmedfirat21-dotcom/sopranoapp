/**
 * SopranoChat �?? Vitrin / Sistem Odaları
 * �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
 * SHOWCASE_ROOMS mock listesi 2026-04-18'de kaldırıldı.
 * 2026-05-21: Soprano Lobi (sentinel UUID) eklendi �?? cold start çözümü.
 */
import type { Room } from '../types';
import { supabase } from '../constants/supabase';

/**
 * �?? Soprano Lobi UUID �?? 7/24 açık sistem odası.
 * rooms.id UUID tipi oldu�?u için string prefix kullanamayız (eski `system_` schema'sı dead code'du).
 * Sentinel UUID DB seed ile sabit; isSystemRoom helper bu listeyi kontrol eder.
 */
export const LOBI_ROOM_ID = '10000000-0000-0000-0000-000000000001';

/**
 * Home must never lose the permanent lobby card because of a transient REST
 * error. The database row is seeded separately; this object is only the
 * read-only UI fallback until the fresh listener count arrives.
 */
export const LOBI_FALLBACK_ROOM: Room = {
  id: LOBI_ROOM_ID,
  name: 'Soprano Lobi',
  description: 'Müzik dinle, tanış, konuş',
  category: 'music',
  type: 'open',
  host_id: '',
  is_live: true,
  listener_count: 0,
  max_speakers: 12,
  created_at: '2026-05-21T00:00:00.000Z',
  expires_at: null,
  is_persistent: true,
  is_system_room: true,
  owner_tier: 'Pro',
  room_settings: { auto_mute_on_join: true, allow_hand_raise: true },
};

/**
 * Tüm bilinen sistem odası UUID'leri. Yeni sistem odası eklenirse bu listeye ekle.
 */
const SYSTEM_ROOM_IDS = new Set<string>([LOBI_ROOM_ID]);

/**
 * Verilen oda ID'sinin sistem odası olup olmadı�?ını kontrol eder.
 * �?? v1.7.13.140 (21 May 2026): Eski `id.startsWith('system_')` revize edildi.
 *   rooms.id UUID tipi oldu�?u için prefix kontrolü ASLA true dönmüyordu (dead code).
 *   Yeni: sabit sentinel UUID listesi.
 */
export function isSystemRoom(roomId: string): boolean {
  return SYSTEM_ROOM_IDS.has(roomId);
}

/**
 * Soprano Lobi'nin sistem odası olup olmadı�?ı.
 */
export function isLobiRoom(roomId: string): boolean {
  return roomId === LOBI_ROOM_ID;
}

/**
 * Soprano Lobi room nesnesini DB'den getirir.
 * Yoksa null döner �?? UI graceful fallback yapmalı (kart gizlenir).
 */
export async function getLobiRoom(): Promise<Room | null> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select(`
        id, name, description, category, type, host_id,
        is_live, is_persistent, is_system_room,
        listener_count, room_settings, created_at, owner_tier
      `)
      .eq('id', LOBI_ROOM_ID)
      .maybeSingle();
    if (error || !data) return null;
    return data as Room;
  } catch {
    return null;
  }
}

/**
 * Ke�?fet sayfası için sistem odalarını Room[] formatında döndürür.
 * �?u an bo�? �?? Lobi ayrı LobiCard ile render ediliyor (showcase listesinde de�?il).
 */
export function getSystemRooms(): Room[] {
  return [];
}

/**
 * Belirli bir sistem odasını DB'den getirir (ID'ye göre).
 * room/[id].tsx içindeki sistem odası fallback'i için.
 */
export async function getSystemRoomById(roomId: string): Promise<Room | null> {
  if (roomId === LOBI_ROOM_ID) return getLobiRoom();
  return null;
}
