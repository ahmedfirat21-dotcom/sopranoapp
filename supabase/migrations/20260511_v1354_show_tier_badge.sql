-- v1.3.54 — Profil tier rozeti gizleme tercihi
-- Kullanıcı APK'daki "Çerçeve Ayarları" içinden kendi tier rozetini gizleyebilir.
-- Default true: yeni kullanıcılar varsayılan olarak rozeti gösterir.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_tier_badge BOOLEAN DEFAULT true;
