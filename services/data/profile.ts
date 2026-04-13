/**
 * SopranoChat — Profil Servis Modülü (PROXY)
 * ═══════════════════════════════════════════════════
 * ★ B5 FIX: Bu dosya artık sadece re-export proxy'sidir.
 * Gerçek implementasyon: services/database.ts → ProfileService
 *
 * Bu dosya geriye uyumluluk için korunuyor.
 * Yeni kodda doğrudan database.ts'den import edin:
 *   import { ProfileService } from '../services/database';
 */
export { ProfileService } from '../database';
