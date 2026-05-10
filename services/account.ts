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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../constants/firebase';
import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';

// ★ 2026-05-09: Hesap silme sonrası login ekranında Lottie animasyonu
//   tetiklemek için kullanılan bir kerelik bayrak. Login ekranı mount'ta
//   okur ve hemen temizler.
// ★ v211 (9 May 2026): AsyncStorage yerine module-level variable —
//   önceki delete denemelerinden kalan stale flag yüzünden logout sonrası
//   yanlışlıkla delete animasyonu gösteriliyordu. Module var her app
//   restart'ta sıfırlanır, sadece tek JS runtime ömrü boyunca yaşar.
export const ACCOUNT_DELETED_FLAG_KEY = '@soprano_account_just_deleted'; // legacy export, no longer used

let _accountJustDeleted = false;
export function markAccountJustDeleted() { _accountJustDeleted = true; }
export function consumeAccountJustDeletedFlag(): boolean {
  const v = _accountJustDeleted;
  _accountJustDeleted = false;
  return v;
}

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
  //   ★ Pagination: heavy user 1000+ dosya yapabilir; offset ile tüm batch'leri tara.
  try {
    const buckets = ['avatars', 'post-images', 'voice-notes'] as const;
    const PAGE = 1000;
    await Promise.all(buckets.map(async (bucket) => {
      let offset = 0;
      // Maks 20 sayfa (20k dosya) — sonsuz döngü koruması
      for (let page = 0; page < 20; page++) {
        const { data: files } = await supabase.storage.from(bucket).list(uid, { limit: PAGE, offset });
        if (!files || files.length === 0) break;
        const paths = files.map((f: any) => `${uid}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
        if (files.length < PAGE) break;
        offset += PAGE;
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
  try { await performLogout(); } catch (e: any) {
    if (__DEV__) logger.warn('[Account] performLogout error after delete:', e?.message);
  }

  // ★ 2026-05-10: Bayrak BURADA set edilmiyor — settings.tsx onPress içinde optimistic
  //   redirect anında zaten markAccountJustDeleted() çağrılıyor. Burada tekrar set edersek
  //   async işlem bittikten sonra flag yeniden true olur ve sonraki Google sign-in'de
  //   login mount'ta Lottie + onboarding tekrar tetiklenir (kullanıcı bug raporu).

  return { success: true, stats };
}
