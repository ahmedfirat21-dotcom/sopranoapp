import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth as firebaseAuth } from './firebase';

const SUPABASE_URL = 'https://kpofiuczyjesjlqjxswh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';

// ★ 2026-04-27: Firebase Third-Party Auth tam entegrasyonu (resmi Supabase pattern).
//   v45 ile tüm RLS policy'leri app_uid() (auth.jwt()->>'sub' text) kullanıyor → UUID
//   cast sorunu tarihte kaldı. Artık accessToken factory ile Firebase ID token her
//   istekte taze gönderilir, Supabase JWKS ile verify eder, auth.jwt() doğru claims
//   ile dolar, app_uid() doğru Firebase UID döner, RLS gerçekten enforce eder.
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
  // ★ Resmi 3PA factory: her sorguda Firebase'den taze ID token alınır.
  //   auth.currentUser null'sa anon olarak gider (login öncesi durum).
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
 * ★ 2026-04-27: Eski API korunuyor (geri uyumlu) ama artık no-op.
 * accessToken factory zaten her istekte taze Firebase token alıyor.
 * Bu fonksiyonun çağrıları (app/_layout.tsx) bir şey yapmıyor ama
 * crash olmasın diye signature korundu. Sonraki temizlikte kaldırılabilir.
 */
export function setSupabaseAuthToken(_token: string | null) {
  // no-op: accessToken factory artık otomatik
}
