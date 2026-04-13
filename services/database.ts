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
 *   services/store.ts     — StoreService
 *   services/status.ts    — StatusService + UserStatus
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
export { StoreService } from './store';
export { StatusService } from './status';
export type { UserStatus } from './status';

// ── Tier sabitleri (constants'dan) ──────────────────
export { TIER_DEFINITIONS, TIER_ORDER, getRoomLimits, getBroadcastLimits, isTierAtLeast } from '../constants/tiers';

// ── Tipler — types/index.ts TEK KAYNAK ──────────────────
export type { Profile, Room, RoomParticipant, RoomSettings } from '../types';
export type { Message, InboxItem } from '../types';
export type { SubscriptionTier, TierName } from '../types';
export { migrateLegacyTier } from '../types';
