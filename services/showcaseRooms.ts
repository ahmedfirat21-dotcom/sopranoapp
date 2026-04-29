/**
 * SopranoChat — Vitrin / Sistem Odaları
 * ═══════════════════════════════════════════════════
 * SHOWCASE_ROOMS mock listesi 2026-04-18'de kaldırıldı.
 * Bu modülde kalan canlı API: isSystemRoom() ve getSystemRooms().
 */
import type { Room } from '../types';

/**
 * Placeholder: gelecekte sistem odaları burada tanımlanır.
 * Şu an boş — gerçek kullanıcı odaları dışında listelenmez.
 */
const SHOWCASE_ROOMS: Partial<Room>[] = [];

/**
 * Keşfet sayfası için sistem odalarını Room[] formatında döndürür.
 * Kullanıcı odası yokken Keşfet'te gösterilir.
 */
export function getSystemRooms(): Room[] {
  const STABLE_COUNTS = [8, 5, 3, 6];
  const STABLE_DATE = '2026-01-01T00:00:00.000Z';
  return SHOWCASE_ROOMS.map((room, idx) => ({
    ...room,
    host_id: 'system',
    listener_count: STABLE_COUNTS[idx] || 4,
    created_at: STABLE_DATE,
    host: {
      id: 'system',
      display_name: 'SopranoChat',
      username: 'sopranochat',
      avatar_url: null,
    },
  })) as unknown as Room[];
}

/**
 * Verilen oda ID'sinin sistem odası olup olmadığını kontrol eder.
 */
export function isSystemRoom(roomId: string): boolean {
  return roomId.startsWith('system_');
}
