import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth as firebaseAuth } from './firebase';

const SUPABASE_URL = 'https://kpofiuczyjesjlqjxswh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';

// ★ 2026-04-28 v79: Firebase Third-Party Auth — resmi Supabase pattern.
//   accessToken factory ile Firebase ID token HER istekte (REST + Realtime)
//   taze gönderilir. Supabase JWKS ile verify eder, auth.jwt() doğru claims
//   ile dolar, app_uid() doğru Firebase UID döner, RLS enforce eder.
//
// KRİTİK: Manual setAuth() ÇAĞIRMA!
//   setAuth() çağrısı accessToken factory'yi override eder. Firebase JWT'yi
//   direkt setAuth'a verirsen Realtime server HS256 ile doğrulamaya çalışıp
//   "InvalidJWTToken: Fields role and exp are required" hatası verir.
//   accessToken factory ise JWKS (RS256) ile doğrulanır ve çalışır.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  // ★ Resmi 3PA factory: her sorgu + Realtime bağlantısı için Firebase'den taze ID token.
  //   auth.currentUser null'sa null döner → anon key kullanılır.
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
