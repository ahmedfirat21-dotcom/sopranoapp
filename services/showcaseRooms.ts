/**
 * SopranoChat — Vitrin / Sistem Odaları Veritabanı
 * ═══════════════════════════════════════════════════
 * SopranoChat resmi odalarının statik tanımları.
 */
import type { Room } from '../types';

// ════════════════════════════════════════════════════════════
// SİSTEM ODA TANIMLARI
// ════════════════════════════════════════════════════════════

/**
 * Keşfet sayfasında aktif kullanıcı odası MIN_ACTIVE_ROOMS'un
 * altına düştüğünde bu sabit odalar gösterilir.
 */
export const MIN_ACTIVE_ROOMS = 3;

/**
 * 4 sabit sistem odası — platform tarafından oluşturulur.
 * Sahip: "sopranochat_official" hesabı (slug ile çözümlenir).
 * Moderasyon: AI-lite moderatör (yapay zeka).
 */
// ★ 2026-04-18: Mock/placeholder sistem odaları kaldırıldı.
// Artık gerçek kullanıcı odaları dışında hiçbir sahte oda listelenmez.
// isSystemRoom() hâlâ `system_` prefix'i arar — gelecekte gerçek sistem
// odası isterseniz o şema ile eklenebilir.
export const SHOWCASE_ROOMS: Partial<Room>[] = [];

/**
 * Sistem odalarını seed verisi olarak DB'ye eklemek için kullanılır.
 * Zaten varsa upsert ile günceller.
 */
export function getShowcaseRoomInserts(systemUserId: string): Partial<Room>[] {
  return SHOWCASE_ROOMS.map(room => ({
    ...room,
    host_id: systemUserId,
    listener_count: 0,
    created_at: new Date().toISOString(),
  }));
}

/**
 * Keşfet sayfası için sistem odalarını Room[] formatında döndürür.
 * Kullanıcı odası yokken Keşfet'te gösterilir.
 */
export function getSystemRooms(): Room[] {
  // ★ BUG-K2 FIX: Sabit listener_count ve created_at — her çağrıda rastgele değişmesin
  const STABLE_COUNTS = [8, 5, 3, 6]; // Her sistem odası için sabit değer
  const STABLE_DATE = '2026-01-01T00:00:00.000Z'; // Sabit tarih — "yeni oda" bonusu almaz
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

/** Sistem oda ID'leri listesi */
export const SYSTEM_ROOMS = SHOWCASE_ROOMS.map(r => r.id!);
