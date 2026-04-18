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

// ★ Firebase JWT → Supabase Third-Party Auth entegrasyonu
// Token'ı dinamik olarak Supabase REST client header'ına enjekte eder.
// _layout.tsx'ten çağrılır (Firebase auth state değiştiğinde).
export function setSupabaseAuthToken(token: string | null) {
  if (token) {
    // @ts-ignore — internal API, supabase-js v2 için çalışır
    supabase['rest']['headers']['Authorization'] = `Bearer ${token}`;
  } else {
    // Token yoksa anon key'e geri dön
    // @ts-ignore
    supabase['rest']['headers']['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
}
