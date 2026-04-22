/**
 * ★ 2026-04-21: Account service — logout + hesap silme flow'ları.
 * ═══════════════════════════════════════════════════════════════════
 * Hem /settings hem /profile sekmelerinden aynı logic kullanılsın diye
 * ortak helper. Pattern: atomic RPC (DB) + storage cleanup + Firebase auth.
 *
 * Önceden delete flow 9 ayrı DELETE query'siydi (non-atomic) → partial
 * deletion + veri kalıntısı riski. Şimdi v49 `delete_user_cascade()` RPC
 * tek transaction'da yapıyor; client sadece storage + Firebase cleanup
 * ekliyor.
 */
import { signOut } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';

/** Full logout flow — state cleanup + navigation caller'da yapılır. */
export async function performLogout(): Promise<void> {
  // 1) Google hesap cache — tekrar girişte seçici açılsın
  try {
    const gsignin = require('@react-native-google-signin/google-signin');
    await gsignin.GoogleSignin.revokeAccess();
    await gsignin.GoogleSignin.signOut();
  } catch { /* Google yoksa atla */ }

  // 2) RevenueCat — entitlement cache temizlensin
  try {
    const { RevenueCatService } = require('./revenuecat');
    await RevenueCatService.logout?.();
  } catch { /* opsiyonel */ }

  // 3) Firebase signOut
  await signOut(auth);
}

/**
 * Full delete flow — atomic DB delete + storage cleanup + Firebase delete.
 * Hata durumlarında partial cleanup log'lanır, caller'a exception fırlatılır.
 *
 * @param firebaseUser — auth.currentUser (Firebase SDK User instance)
 * @returns deletion istatistikleri (silinen oda/mesaj sayıları vb.)
 */
export async function performDeleteAccount(firebaseUser: any): Promise<{ success: boolean; stats?: any }> {
  if (!firebaseUser?.uid) {
    throw new Error('Kullanıcı kimliği bulunamadı.');
  }
  const uid = firebaseUser.uid;

  // 1) Atomic DB cleanup — v49 RPC (single transaction)
  const { data: stats, error: rpcError } = await supabase.rpc('delete_user_cascade', {
    p_executor_id: uid,
  });
  if (rpcError) {
    if (__DEV__) logger.error('[Account] delete_user_cascade RPC fail:', rpcError);
    throw new Error(rpcError.message || 'Hesap silme işlemi başarısız.');
  }

  // 2) Storage cleanup — best effort (DB zaten silindi, orphan'lar admin cleanup ile)
  try {
    const buckets = ['avatars', 'post-images', 'voice-notes'] as const;
    await Promise.all(buckets.map(async (bucket) => {
      const { data: files } = await supabase.storage.from(bucket).list(uid, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f: any) => `${uid}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
      }
    }));
  } catch (e: any) {
    if (__DEV__) logger.warn('[Account] Storage cleanup error (non-critical):', e?.message);
  }

  // 3) Firebase auth hesabı sil
  try {
    await firebaseUser.delete();
  } catch (e: any) {
    // Re-auth gerekebilir. DB verileri zaten silindi → kullanıcı çıkış yapabilir,
    // hesap Firebase tarafında Zombie kalır ama DB profili yok.
    if (__DEV__) logger.warn('[Account] Firebase delete error (may need re-auth):', e?.message);
  }

  // 4) Logout (Google revoke + RevenueCat + Firebase signOut)
  try { await performLogout(); } catch {}

  return { success: true, stats };
}
