import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://kpofiuczyjesjlqjxswh.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting — mobilde gereksiz flood önleme
    },
  },
});

// ★ 2026-04-20 NOT: Firebase Third-Party Auth ile `accessToken` factory denendi
//   ama Supabase'in native `auth.uid()` fonksiyonu hardcoded UUID cast yapıyor
//   (sub'ı UUID'ye çevirmeye çalışır). Firebase UID (ör. "1GwzWKsxWwhpKpMrd...")
//   UUID formatında değil → "invalid input syntax for type uuid" hatası → tüm
//   RLS policy'ler ve sorgu RLS-bağımlı her şey FAİL.
//
//   Çözüm: anon key ile REST header gönder. auth.uid() NULL kalır, RLS policy'ler
//   hata vermez ama auth yok. Yazma işlemleri (ban/promote/unfriend) için v44
//   atomic RPC'lerin p_executor_id fallback'i devreye girer — client kim olduğunu
//   söyler, RPC içinde yetki kontrolü yapılır, SECURITY DEFINER ile RLS bypass.
//
//   TODO: SQL migration v45 — tüm RLS policy'lerdeki auth.uid()::text çağrılarını
//   (auth.jwt()->>'sub') ile değiştir. O zaman accessToken factory yeniden
//   aktifleştirilebilir ve RLS server-side Firebase UID ile çalışır.

export function setSupabaseAuthToken(token: string | null) {
  if (token) {
    // @ts-ignore — internal API, REST header override
    supabase['rest']['headers']['Authorization'] = `Bearer ${token}`;
  } else {
    // @ts-ignore
    supabase['rest']['headers']['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
}
