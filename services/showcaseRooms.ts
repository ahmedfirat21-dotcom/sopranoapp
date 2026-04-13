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
export const SHOWCASE_ROOMS: Partial<Room>[] = [
  {
    id: 'system_genel',
    name: '💬 Genel Sohbet',
    description: 'SopranoChat topluluğuyla tanış, sohbet et, arkadaş edin!',
    category: 'chat',
    type: 'open',
    is_live: true,
    is_system_room: true,
    ai_moderated: true,
    owner_tier: 'VIP',
    max_speakers: 12,
    max_listeners: 20,
    max_cameras: 8,
    max_moderators: 5,
    tags: ['sohbet', 'tanışma', 'topluluk'],
    language: 'tr',
    room_settings: {
      welcome_message: 'Hoş geldiniz! SopranoChat topluluğuna katıldınız. Saygılı bir ortam için kurallara uyun. 🙏',
      rules: [
        'Hakaret ve küfür yasaktır',
        'Herkes konuşabilir — sıra bekleyin',
        'Reklam ve spam yasaktır',
        'Eğlenin! 🎉',
      ],
      auto_mute_on_join: true,
      allow_hand_raise: true,
      stage_layout: 'grid',
    },
  },
  {
    id: 'system_muzik',
    name: '🎵 Müzik Odası',
    description: 'Müzik dinle, paylaş, birlikte keyfini çıkar!',
    category: 'music',
    type: 'open',
    is_live: true,
    is_system_room: true,
    ai_moderated: true,
    owner_tier: 'VIP',
    max_speakers: 12,
    max_listeners: 20,
    max_cameras: 8,
    max_moderators: 5,
    tags: ['müzik', 'dinle', 'paylaş'],
    language: 'tr',
    room_settings: {
      welcome_message: '🎵 Müzik odasına hoş geldiniz! Sahneye çıkın ve müziğinizi paylaşın.',
      rules: [
        'Sahneye çıkmadan önce el kaldırın',
        'Müzik paylaşırken kaliteye dikkat edin',
        'Hakaret yasaktır',
      ],
      auto_mute_on_join: true,
      allow_hand_raise: true,
      stage_layout: 'spotlight',
    },
  },
  {
    id: 'system_egitim',
    name: '📚 Eğitim & Bilgi',
    description: 'Öğren, paylaş, tartış — bilgi herkes için!',
    category: 'book',
    type: 'open',
    is_live: true,
    is_system_room: true,
    ai_moderated: true,
    owner_tier: 'VIP',
    max_speakers: 12,
    max_listeners: 20,
    max_cameras: 8,
    max_moderators: 5,
    tags: ['eğitim', 'bilgi', 'kitap', 'teknoloji'],
    language: 'tr',
    room_settings: {
      welcome_message: '📚 Eğitim & Bilgi odasına hoş geldiniz! Bilgiyi paylaşın, birlikte öğrenin.',
      rules: [
        'Saygılı bir tartışma ortamı',
        'Kaynak belirtin',
        'Spam yasaktır',
      ],
      auto_mute_on_join: true,
      allow_hand_raise: true,
      stage_layout: 'grid',
    },
  },
  {
    id: 'system_oyun',
    name: '🎮 Oyun & Eğlence',
    description: 'Oyun sohbetleri, eğlence ve yarışmalar!',
    category: 'game',
    type: 'open',
    is_live: true,
    is_system_room: true,
    ai_moderated: true,
    owner_tier: 'VIP',
    max_speakers: 12,
    max_listeners: 20,
    max_cameras: 8,
    max_moderators: 5,
    tags: ['oyun', 'eğlence', 'yarışma'],
    language: 'tr',
    room_settings: {
      welcome_message: '🎮 Oyun odasına hoş geldiniz! Eğlenin, yarışın, arkadaş edinin.',
      rules: [
        'Fair play — hile yasak',
        'Hakaret ve toxic davranış yasak',
        'Eğlenceye odaklanın!',
      ],
      auto_mute_on_join: true,
      allow_hand_raise: true,
      stage_layout: 'grid',
    },
  },
];

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
