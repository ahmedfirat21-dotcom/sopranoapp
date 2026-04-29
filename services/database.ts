/**
 * SopranoChat — Veritabanı Servis Katmanı (Re-export Hub)
 * ═══════════════════════════════════════════════════
 * Bu dosya artık monolitik değil — tüm servisler modüler dosyalara
 * ayrıştırıldı. Bu hub geriye uyumluluk için tüm servisleri
 * tek noktadan re-export eder.
 *
 * Modüler servis dosyaları:
 *   services/profile.ts   — ProfileService
 *   services/room.ts      — RoomService
 *   services/messages.ts  — MessageService
 *   services/sp.ts        — SPService
 *   services/realtime.ts  — RealtimeService
 *
 * ★ 2026-04-26: store.ts kaldırıldı — kozmetik mağaza Google Play kuralları gereği silindi
 * ★ 2026-04-26: social.ts kaldırıldı — oda duvarı/post sistemi kullanıcı kararıyla silindi
 * ★ 2026-04-28: status.ts kaldırıldı — StatusService hiçbir UI'da kullanılmıyordu (ölü kod)
 *
 * Yeni kod yazarken doğrudan modül dosyalarından import etmeyi
 * tercih edin. Bu hub, mevcut import'ları bozmamak için korunur.
 */

// ── Modüler servisler ──────────────────
export { ProfileService } from './profile';
export { RoomService } from './room';
export { MessageService } from './messages';
export { SPService } from './sp';
export { RealtimeService } from './realtime';

// ── Tipler — types/index.ts TEK KAYNAK ──────────────────
//   ★ 2026-04-25: Tier sabitleri (TIER_DEFINITIONS, getRoomLimits vb.) ve
//   migrateLegacyTier re-export'ları kaldırıldı. Artık doğrudan
//   `constants/tiers` ve `types` importlanmalı. Kafa karışıklığı sonu.
export type { Profile, Room, RoomParticipant, RoomSettings } from '../types';
export type { Message, InboxItem } from '../types';
export type { SubscriptionTier, TierName } from '../types';
