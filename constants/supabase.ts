import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth as firebaseAuth } from './firebase';

const SUPABASE_URL = 'https://kpofiuczyjesjlqjxswh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';

// ════════════════════════════════════════════════════════════════════
// ★ 2026-04-30 v80: REST için Firebase JWT, Realtime için Anon Key.
// ════════════════════════════════════════════════════════════════════
// ARKA PLAN:
//   27 Nisan v45 setup'ında Firebase 3PA aktif edildi → REST tarafı Firebase
//   JWT'leri JWKS ile doğruluyor, app_uid() Firebase UID'yi RLS'lere veriyor.
//   FAKAT Realtime servisi Firebase JWT'lerinde "role" claim'i bulamayınca
//   "InvalidJWTToken: Fields role and exp are required" diye reddediyor →
//   tüm canlı kanallar (mesaj/emoji/el kaldırma/DM/presence) sessizce kopuyor.
//
//   Modern Supabase asymmetric key sistemine geçtiği için (SUPABASE_JWKS env
//   mevcut, klasik HS256 JWT_SECRET dışarı verilmiyor) Edge Function ile
//   Supabase-uyumlu JWT mint edemiyoruz.
//
// ÇÖZÜM:
//   İki ayrı Supabase client:
//     - supabase     → REST + Storage + Auth state (Firebase JWT factory)
//     - supabaseRT   → Realtime (anon key — role:'anon' içeriyor, kabul edilir)
//   Ana `supabase` instance'ının channel/removeChannel/getChannels/realtime
//   property'leri supabaseRT'ye yönlendiriliyor → mevcut 22 dosyada hiçbir
//   import değişikliği gerekmedi.
//
// GÜVENLİK:
//   - INSERT/UPDATE/DELETE policy'leri REST üzerinden gidiyor → Firebase JWT
//     zorunlu, app_uid() ile RLS sıkı şekilde enforce ediyor (DEĞIŞMEDİ).
//   - SELECT policy'leri Realtime tabloları için zaten USING (true) (room_*,
//     notifications) — yani anon okuma 27 Nisan'dan beri zaten açıktı.
//   - Bu değişiklik yeni bir veri exposure açmıyor; sadece var olan SELECT
//     izinlerini Realtime kanalı üzerinden kullanmamızı sağlıyor.
// ════════════════════════════════════════════════════════════════════

// REST + Auth client — Firebase JWT factory ile
const _supabaseREST = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Firebase user yoksa null → anon key kullanılır.
  accessToken: async () => {
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) return null;
      return await fbUser.getIdToken(false);
    } catch {
      return null;
    }
  },
});

// Realtime-only client — anon key ile, accessToken factory YOK.
// Realtime postgres_changes ve broadcast bu client üzerinden çalışıyor.
const _supabaseRT = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// `supabase.channel(...)` ve arkadaşlarını Realtime client'a yönlendir.
// Mevcut tüm dosyaların (services, hooks, screens) aynı `supabase` import'unu
// kullanmaya devam etmesini sağlıyor — refactor gerekmiyor.
Object.defineProperty(_supabaseREST, 'channel', {
  value: _supabaseRT.channel.bind(_supabaseRT),
  writable: true,
  configurable: true,
});
Object.defineProperty(_supabaseREST, 'removeChannel', {
  value: _supabaseRT.removeChannel.bind(_supabaseRT),
  writable: true,
  configurable: true,
});
Object.defineProperty(_supabaseREST, 'removeAllChannels', {
  value: _supabaseRT.removeAllChannels.bind(_supabaseRT),
  writable: true,
  configurable: true,
});
Object.defineProperty(_supabaseREST, 'getChannels', {
  value: _supabaseRT.getChannels.bind(_supabaseRT),
  writable: true,
  configurable: true,
});
Object.defineProperty(_supabaseREST, 'realtime', {
  value: _supabaseRT.realtime,
  writable: true,
  configurable: true,
});

export const supabase = _supabaseREST;

/**
 * ★ Eski API korunuyor (geri uyumlu) — no-op.
 * accessToken factory zaten her istekte taze Firebase token alıyor.
 */
export function setSupabaseAuthToken(_token: string | null) {
  // no-op: accessToken factory artık otomatik
}

/** Logout sırasında çağrılır — token cache temizleme (gelecek kullanım). */
export function clearTokenCache(): void {
  // no-op: accessToken factory auth.currentUser null döndürerek anon'a düşürür
}

/** Token yenileme — cache invalidation (gelecek kullanım). */
export async function refreshTokenCache(): Promise<void> {
  // no-op: accessToken factory her çağrıda getIdToken yapıyor
}
