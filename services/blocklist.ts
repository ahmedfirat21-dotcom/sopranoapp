/**
 * SopranoChat — Blocklist Utility
 * ═══════════════════════════════════════════════════
 * ★ ARCH-3 FIX: room.ts ↔ friendship.ts circular dependency çözümü.
 * Engellenen kullanıcı ID'lerini çeken utility — her iki servis
 * tarafından güvenle import edilebilir (bağımlılık döngüsü kırıldı).
 */
import { supabase } from '../constants/supabase';

/**
 * Engellenen kullanıcı ID'lerini getir (her iki yön + her iki tablo)
 * Kaynak 1: friendships tablosu (status = 'blocked')
 * Kaynak 2: blocked_users tablosu (ModerationService)
 */
export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  try {
    const [
      { data: iBlockedFship },
      { data: blockedMeFship },
      { data: iBlockedMod },
      { data: blockedMeMod },
    ] = await Promise.all([
      // friendships tablosundan
      supabase.from('friendships').select('friend_id').eq('user_id', userId).eq('status', 'blocked'),
      supabase.from('friendships').select('user_id').eq('friend_id', userId).eq('status', 'blocked'),
      // blocked_users tablosundan (ModerationService)
      supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId),
      supabase.from('blocked_users').select('blocker_id').eq('blocked_id', userId),
    ]);
    const ids = new Set<string>();
    (iBlockedFship || []).forEach((r: any) => ids.add(r.friend_id));
    (blockedMeFship || []).forEach((r: any) => ids.add(r.user_id));
    (iBlockedMod || []).forEach((r: any) => ids.add(r.blocked_id));
    (blockedMeMod || []).forEach((r: any) => ids.add(r.blocker_id));
    return ids;
  } catch {
    return new Set();
  }
}
