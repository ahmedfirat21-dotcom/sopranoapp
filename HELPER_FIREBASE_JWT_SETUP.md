# SopranoChat — Supabase Firebase JWT Auth Setup Talimatları

**Yardım eden arkadaşa:** Bu görev ~10 dakika sürer. Aşağıdaki adımları sırasıyla yap.

## Bağlam (1 paragraf)

SopranoChat React Native uygulaması Firebase Auth kullanıyor. Backend Supabase. Şu an Firebase JWT'leri Supabase tarafında verify edilmiyor → tüm RLS policy'leri NULL üzerinden çalışıyor → "Allow all for anon" permissive policy'leriyle uygulama ayakta. Güvenlik açığı: ANON key + curl ile herkes DB'ye direkt erişebilir.

DB tarafı zaten hazır — 66 policy `app_uid()` helper'ına geçirildi (`auth.jwt() ->> 'sub'` öncelikli, `auth.uid()` fallback). Eksik: Supabase Dashboard'da Firebase Third-Party Auth kurulumu + sonra "Allow all for anon" drop.

## Proje bilgileri

- **Supabase Project**: `kpofiuczyjesjlqjxswh`
- **Supabase URL**: `https://kpofiuczyjesjlqjxswh.supabase.co`
- **Firebase Project ID**: `sopranochat-5738e`
- **Firebase Issuer**: `https://securetoken.google.com/sopranochat-5738e`
- **Firebase JWKS URL**: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`

## Gerekli erişim

- Supabase hesabı (proje sahibi): SopranoChat dev ekibinin Supabase login'i
- Test için: Android cihaz + APK (kullanıcıda var)

---

## ADIM 1: Supabase Dashboard'da Firebase Third-Party Auth ekle

### Öncelikli yöntem (yeni Supabase 3PA sistemi)

1. Tarayıcıda aç: https://supabase.com/dashboard/project/kpofiuczyjesjlqjxswh/auth/third-party
2. Sol menüden **Authentication** → **Sign In / Up** → **Third Party Auth** sekmesi
3. **"Add provider"** butonu → **Firebase** seç
4. Form:
   - **Project ID**: `sopranochat-5738e`
5. **Save**

Kontrol: Provider listesinde Firebase yeşil tik (✓) ile görünmeli.

### Yedek yöntem (Custom JWT — eğer 3PA UI'ı yoksa)

1. Project Settings (sol alt) → **API**
2. **JWT Settings** bölümüne kaydır
3. Üç alanı doldur:
   - **JWKS URL**: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`
   - **JWT Issuer**: `https://securetoken.google.com/sopranochat-5738e`
   - **JWT Audience**: `sopranochat-5738e`
4. **Save**

---

## ADIM 2: Doğrulama (SQL test)

Supabase Dashboard → **SQL Editor** → New Query:

```sql
-- 1) Helper fonksiyon var mı?
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_uid') AS app_uid_exists;
-- Beklenen: true

-- 2) Kaç policy app_uid() kullanıyor?
SELECT COUNT(*) AS app_uid_policies
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (pg_get_expr(p.polqual, p.polrelid) LIKE '%app_uid%'
    OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%app_uid%');
-- Beklenen: 66

-- 3) Hâlâ auth.uid() kullanan policy var mı?
SELECT COUNT(*) AS still_auth_uid
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%'
    OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%');
-- Beklenen: 0
```

---

## ADIM 3: Live test (telefondan)

Kullanıcının APK 56 yüklü olduğundan emin ol.

1. Uygulamayı aç, normal şekilde Firebase ile giriş yap (Google sign-in)
2. Bir oda aç, mesaj at, profil aç
3. Beklenen: hiçbir şey kırılmamalı, normal akış

Eğer giriş yapılamıyorsa veya RLS hataları görüyorsan: Adım 1'deki Project ID/Audience yanlış girilmiş olabilir → kontrol et.

Hata ayıklama için Supabase logs:
- Dashboard → **Logs** → **Postgres Logs**
- Filtre: `RLS`
- Hata: "permission denied for table X" → policy enforce çalışıyor demektir, başarılı

---

## ADIM 4: "Allow all for anon" policy'lerini DROP et

**ÖNCE Adım 3 başarılı olmalı.** Aksi halde uygulama tamamen kırılır.

Supabase SQL Editor'da çalıştır:

```sql
-- Tüm "Allow all for anon" permissive policy'leri tek tek DROP
DROP POLICY IF EXISTS "Allow all for anon" ON public.profiles;
DROP POLICY IF EXISTS "Allow all for anon" ON public.rooms;
DROP POLICY IF EXISTS "Allow all for anon" ON public.messages;
DROP POLICY IF EXISTS "Allow all for anon" ON public.notifications;
DROP POLICY IF EXISTS "Allow all for anon" ON public.room_participants;
DROP POLICY IF EXISTS "user_badges_all" ON public.user_badges;
DROP POLICY IF EXISTS "message_requests_all" ON public.message_requests;

-- Doğrulama: Allow all for anon kalmadığını teyit et
SELECT c.relname, p.polname
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (p.polname LIKE '%anon%' OR p.polname LIKE '%_all%' AND pg_get_expr(p.polqual, p.polrelid) IS NULL);
-- Beklenen: 0 satır
```

Tekrar test et:
1. APK'da giriş yap
2. Oda yarat, mesaj at — başarılı olmalı (RLS artık `app_uid()` ile match ediyor)
3. Tarayıcıda direkt API saldırısı dene (curl ile başkasının verisini güncelle) — başarısız olmalı

---

## ADIM 5: Kullanıcıya bildir

Tamamlandığında kullanıcıya şu mesajı at:
> "Firebase JWT auth Supabase'de aktif. 66 RLS policy enforce ediyor. 'Allow all for anon' drop edildi. Test edilmeli."

Kullanıcı (developer) Claude Code'a bunu söyleyince, Claude memory dosyasını güncelleyecek (`project_firebase_jwt_rls_v45.md` → "tamamlandı" işaretle).

---

## Geri alma (rollback) — bir şey kırılırsa

Adım 4'i geri al:

```sql
-- Eğer Adım 4 sonrası uygulama kırıldıysa, "Allow all" policy'leri geri kur
CREATE POLICY "Allow all for anon" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.room_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "user_badges_all" ON public.user_badges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "message_requests_all" ON public.message_requests FOR ALL USING (true) WITH CHECK (true);
```

Adım 1'i geri al: Dashboard'da provider'ı sil.

---

## Sorun çözme

| Belirti | Sebep | Çözüm |
|---|---|---|
| Login sonrası tüm queryler 401 | JWKS URL yanlış | URL'yi tekrar kontrol et |
| "permission denied" hatası her yerde | "Allow all" drop edildi ama JWT verify olmuyor | Adım 1'i tekrar yap |
| `app_uid()` NULL döner | JWT header iletilmiyor | Client kodu kontrol et: `setSupabaseAuthToken(idToken)` çağrısı var mı |
| Audience uyumsuz hatası | Project ID/Audience yanlış | `sopranochat-5738e` olduğunu teyit et |

---

## İletişim

Sorun çıkarsa kullanıcı (proje sahibi) Claude'la iletişime geçer, Claude SQL üzerinden tanı koyar.
