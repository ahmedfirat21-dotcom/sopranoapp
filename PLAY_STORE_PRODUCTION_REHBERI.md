# Play Store Production Yayın Rehberi — SopranoChat

**Son güncelleme:** 6 Mayıs 2026
**Mevcut durum:** Internal Test ✓ canlı (v36) · Closed Test ✓ canlı · Production henüz çıkmadı

> Bu rehber Claude Opus 4.x için yazıldı. Opus tarayıcı/screenshot alabilir; her adımda **ne göreceği** + **ne yapması gerektiği** + **ekran görseli alma noktaları** açıkça belirtilmiş.

---

## 0. Açılış — Play Console giriş

**URL:** https://play.google.com/console

**Hesap:** `sopranochat@gmail.com` (proje sahibi)

**Beklenen ekran:** Sol menüde proje listesi. **"SopranoChat"** projesini seç.

**Screenshot al:** Açılış dashboard'u + sol menü (rehberdeki tüm adımları kontrol etmek için referans)

---

## 1. Production track durumu — neden yayında değil?

### Adım 1.1 — Production sekmesine git

Sol menüden: **Test and release → Production**

**Beklenen ekran 1 — Hâlâ submit edilmemişse:**
- "Create new release" butonu görünür (yeşil, sağ üstte)
- Sayfa altında "Production releases" listesi BOŞ veya sadece taslak (Draft)

**Beklenen ekran 2 — Submit edilmiş ama bekliyorsa:**
- "In review" rozetli son release var
- Status: Pending publication / In review / Rejected
- Reject ise sebep gösterilir (Issues section)

**Beklenen ekran 3 — Yayında ama eski sürüm:**
- Sürüm tablosu var, "Active" sütunu doluysa zaten production'da

**📸 Screenshot al:** Production sayfasının tamamı (yukarıdaki uyarılar + release listesi)

### Adım 1.2 — "Why can't I publish?" tıkla

Sayfanın üstünde **kırmızı veya sarı uyarı kutucukları** olabilir. Her uyarının yanında **"Resolve"** veya **"Fix this"** linki var.

Olası uyarılar:
1. ❌ **"Closed test required for 14 days with 12+ testers"**
2. ❌ **"Complete the Data safety section"**
3. ❌ **"Add a privacy policy"**
4. ❌ **"Set up the App content section"**
5. ❌ **"Complete content rating"**
6. ❌ **"Add target audience"**
7. ❌ **"Provide store listing details"**

**Her uyarı için:**
- 📸 Screenshot al
- Uyarı metnini bu rehbere `## Bulunan engeller` bölümüne yaz
- "Fix this" tıkla, ilgili sayfaya git

---

## 2. Closed Test 14-gün ve 12-tester kontrolü

**Bu şart Production'a Promote için en yaygın engel.**

### Adım 2.1 — Closed Test sekmesi

Sol menü: **Test and release → Testing → Closed testing**

Ekranda bir veya birden fazla "Track" görünür (örn. "Alpha", "Closed test 1").

**Her track için:**
- 📊 **Day count** — kaç gündür açık? (örn. "Active for 12 days")
- 👥 **Tester count** — kaç kişi katılmış?
- ✅ **Eligible for promotion?** — promote etmek için 14 gün + 12 aktif tester gerekir

**📸 Screenshot al:** Closed test summary (üstteki sayılar net görünsün)

### Adım 2.2 — Tester engagement detay

Track adına tıkla, sonra **"Testers"** sekmesine git.

**Beklenen tablo:**

| Sütun | Açıklama |
|---|---|
| Email opted in | Listene eklediğin tester sayısı |
| Email opted in (active) | Yüklemiş + en az 1 kez açmış kişi sayısı |
| Reach | Test linki üzerinden katılan kişi sayısı |

**Critical:** "active" 12'nin altındaysa Production'a promote edemezsin.

**Eğer 12'den azsa:**
1. **"Manage testers"** → email ekle
2. Davet linkini tester'a gönder (memory'de "14 tester listesi hazır" notu var — Soprano dev tarafında bu liste mevcut, kullanıcıya sor)
3. Tester'ların gerçekten **APK'yı yüklemesi + uygulamayı 1 kez açması** gerekiyor (sadece email listesinde olmak yetmez)

### Adım 2.3 — 14 gün hesaplama

**Closed test ilk publish edilen gün** + 14 = promote eligible date.

Memory'e göre Closed Test 24 Nisan 2026'da submit edildi. **+14 gün = 8 Mayıs 2026.**

**Bugün 6 Mayıs ise:** 2 gün daha bekle.
**Bugün 8 Mayıs sonrası ise:** ✓ süre dolmuş

**📸 Screenshot al:** Closed test detay sayfası (track adı + start date + day count net)

---

## 3. Pending changes (eksik bilgiler) tek tek doldurma

Memory'e göre "7 pending change" var. Aşağıdaki sırayla **her birini doldur**.

### 3.1 — Privacy Policy URL

**Yer:** App content → Privacy policy

**Ne yazılacak:**
- URL: `https://sopranochat.com/privacy` veya yeni bir sayfa lazım

**Eğer URL yoksa:**
- Bir privacy policy generator kullan (örn. https://app-privacy-policy-generator.firebaseapp.com)
- App detayları:
  - Adı: SopranoChat
  - Type: Android app
  - Owner: SopranoChat (sahibi)
  - Veri toplanan: email, profile, location (yok), camera, microphone, contacts (yok), messages
  - Üçüncü taraf: Firebase, Supabase, LiveKit, RevenueCat, Google AdMob (varsa)
- Üretilen HTML'i Vercel'e ya da `https://sopranochat.com/privacy` rotasına koy

**📸 Screenshot al:** Privacy policy alanı boş/dolu

### 3.2 — Data safety form

**Yer:** App content → Data safety

**Doldurulacak ana sorular:**

#### "Does your app collect or share any of the required user data types?"
✓ Yes

#### Toplanan veri tipleri:
- ✅ **Personal info:** Email address, Name, User ID
  - Collected: Yes
  - Shared: No
  - Optional: Yes (signup için zorunlu)
  - Purpose: Account management, App functionality
  - Encrypted in transit: Yes
  - Can users delete: Yes (account deletion → admin_delete_user_cascade RPC)
- ✅ **Photos and videos:** Profile photos
  - Same answers
- ✅ **Audio files:** Voice messages, voice bio, room recordings (LiveKit)
  - Same answers
- ✅ **Messages:** Direct messages, room chat
  - Collected, not shared, encrypted in transit, deletable
- ✅ **Audio (microphone):** for voice rooms (LiveKit)
- ✅ **Camera:** for video rooms (LiveKit, Pro tier)
- ✅ **App activity:** in-app actions, analytics (Firebase Analytics)
- ✅ **Crash logs and diagnostics:** (Firebase Crashlytics)

#### Tüm bu sorular için cevap pattern'i:
- Collected: **Yes**
- Shared with third parties: **No** (sadece data processors — Firebase/Supabase, hizmet sağlayıcı)
- Required or optional: çoğu Required (signup için), Profile photo Optional
- Purpose: App functionality, Account management, Analytics
- Encrypted in transit: **Yes** (HTTPS)
- Users can request deletion: **Yes**

**📸 Screenshot al:** Data safety form'unun her sayfası (5-7 sayfa olabilir)

### 3.3 — Content rating questionnaire

**Yer:** App content → Content rating

**Doldurulacak:**
- App category: **Communication** veya **Social**
- Email: sopranochat@gmail.com
- Anket soruları:
  - Şiddet: No
  - Cinsel içerik: No
  - Kötü dil: **User-generated** (kullanıcılar yazabilir, mod ekibi var)
  - Kontrollü maddeler: No
  - Korkutucu içerik: No
  - Simulated gambling: No (SP ekonomisi para değil, şans oyunu yok)
  - Real money gambling: No
  - **User generated content:** **Yes**
  - **Users can interact:** **Yes** (sesli/yazılı sohbet)
  - **Users share location:** No (sadece şehir/ülke profil bilgisi varsa)
  - **Personal info shared:** Yes (display name, profile photo)
  - **Digital purchases:** Yes (SP, abonelik)

**Sonuç rating:** Muhtemelen **Teen (13+)** veya **Mature 17+** (sosyal + kullanıcı üretimli içerik = en az Teen)

**📸 Screenshot al:** Anket sonuç sayfası

### 3.4 — Target audience and content

**Yer:** App content → Target audience and content

**Doldurulacak:**
- Target age groups: **18+**
- Appeals to children: **No**
- Ads: depends — eğer reklam yoksa No, varsa Yes (memory'de bilgi yok)

**📸 Screenshot al:** Target audience sayfası

### 3.5 — Ads declaration

**Yer:** App content → Ads

- Does your app contain ads: **No** (eğer AdMob/banner yoksa)

### 3.6 — App access (login required?)

**Yer:** App content → App access

- All functionality available without restrictions: **No** (login zorunlu)
- "Provide instructions" → test hesabı bilgileri ver:
  - Username: sopranochat-test@example.com (test hesabı oluştur)
  - Password: [test şifresi]
  - Notes: "Test hesabıyla giriş yapın, tüm özellikler erişilebilir"

**📸 Screenshot al:** App access sayfası

### 3.7 — News app declaration

**Yer:** App content → News app

- Is this a news app: **No**

### 3.8 — COVID-19 contact tracing

**Yer:** App content → COVID-19 contact tracing

- Is this app related: **No**

### 3.9 — Government services

**Yer:** App content → Government apps

- Is this a government app: **No**

### 3.10 — Health and Wellness

- No

### 3.11 — Financial features

- Hangi özellikler var? SP "in-app currency" (gerçek para değil), abonelik (Plus/Pro)
- Subscriptions: Yes (Google Play Billing kullanılıyor mu? Evet → mark Yes)
- Real money: No (in-app currency)

**📸 Screenshot al:** Tüm App content sayfasının tam dolmuş hâli

---

## 4. Store listing — mağaza görünümü

**Yer:** Grow → Store presence → Main store listing

### 4.1 — Temel bilgiler

| Alan | Doldurulacak |
|---|---|
| **App name** | SopranoChat |
| **Short description** (80 karakter) | "Sade, özgün bir sesli sosyal platform. Anlık odalar, doğrudan mesaj." |
| **Full description** (4000 karakter) | aşağıda full text |

**Full description:**

```
🎙 SopranoChat — Sesinle tanış, ses koroyla büyü.

Clubhouse'un anlık sesli odalarıyla Discord'un kalıcı topluluklarını harmanlayan, Türkiye merkezli özgün bir sesli sosyal platform.

★ ANLIK SESLİ ODALAR
Sohbet, müzik, oyun, teknik, kitap, film... Bir kategori seç, başlat. Sesinin geldiği kişiyi gör, sahneye davet et, mikrofonunu uzat.

★ DOĞRUDAN MESAJ
Yazılı, sesli mesaj, görsel paylaşım. Tepkiler, sesli not, hızlı yanıt.

★ MÜSAİTİM — DROP-IN PATTERN
"Müsaitim" dediğin an arkadaşların görür. Tek tıkla katıl, takılma yok.

★ SP EKONOMİSİ
Konuştukça kazan, hediye gönder, mağazadan çerçeve/giriş animasyonu/parlak mesaj satın al.

★ 3 ÜYELİK PLANI
- Free: 5 sahne · 15 dinleyici · ücretsiz
- Plus: 8/25 + kalıcı oda + davet sistemi · 39,99 ₺/ay
- Pro: 13 sahne · sınırsız dinleyici · 7/24 oda · stereo ses · 1080p video · 99,99 ₺/ay

★ GÜVENLİK
Firebase Auth + Supabase RLS. Kullanıcı raporlama, oda moderatörü, geçici host koruması, doğrulama tiki. KVKK uyumlu.

★ TIKTOK YASAK
Zorla akış yok. Sadece ses, sadece sen.

iOS yakında.

İletişim: sopranochat@gmail.com
```

**📸 Screenshot al:** Store listing'in tam dolu hâli

### 4.2 — Görseller (önemli!)

#### 4.2.1 — App icon
- 512×512 PNG, 32-bit, 1 MB max
- Path: `assets/app_icon.png` (mevcut, yüklendi)

#### 4.2.2 — Feature graphic (zorunlu)
- 1024×500 PNG/JPG, 1 MB max
- "Sesinle buradasın" başlık + telefon mockup'ı + Cooper Black logo
- Eğer yoksa, oluştur (Figma/Canva veya AI ile)

#### 4.2.3 — Phone screenshots (en az 2, en fazla 8)

**Bu rehberin asıl amacı.** Mock data ile doldurulmuş ekranlardan al:

1. **Keşfet** (Home) — kategori filter chip'leri + 3-4 oda kartı (Aranan host, 24 dinleyici, vb)
2. **Oda içi** — Sahne grid + dinleyici gözleri + chat drawer açık (mesajlar görünür)
3. **Profil** — Avatar + voice bio waveform + Pro rozeti + 12.480 SP + envanter
4. **Mesajlar** — DM listesi (Aranan, Murat, Selin) + okunmamış sayacı
5. **Mağaza** — Çerçeve/hediye/giriş animasyonu kartları gridi
6. **Plus tier** — Üyelik planları karşılaştırma sayfası
7. **Giriş efekti** — RoomEntryEffectOverlay tetiklenmiş hâli (kullanıcı odaya girdi)
8. **Korolar** veya **Mağaza önizleme**

**Her screenshot için kurallar:**
- 9:16 aspect (portrait)
- 1080×1920 minimum
- PNG/JPG
- "Türkçe arayüz" (kullanıcı kitlesi Türkçe)
- Test hesabı / mock data ile doldurulmuş, gerçekçi içerik

**📸 Çekim için:**
- Telefon emülatörü (Pixel 6/7, API 33+)
- Volume Down + Power = screenshot
- Veya `adb shell screencap /sdcard/screen.png`

#### 4.2.4 — 7-inch tablet screenshots (opsiyonel ama önerilen)
- En az 1 adet, 16:9 aspect
- Aynı içeriklerden tablet'te göster

#### 4.2.5 — 10-inch tablet screenshots (opsiyonel)
- Aynı şekilde

#### 4.2.6 — Promo video (opsiyonel ama güçlü)
- YouTube link, 30 sn-2 dk
- Uygulama tanıtımı

### 4.3 — Categorization

| Alan | Cevap |
|---|---|
| **Application type** | App (Game değil) |
| **Category** | Social |
| **Tags** | "voice chat", "social", "rooms", "Turkish" |

### 4.4 — Contact details

- Email: sopranochat@gmail.com
- Website: https://sopranochat.com
- Phone: opsiyonel
- Privacy policy: https://sopranochat.com/privacy

### 4.5 — External marketing

- Permission to market outside Play: Yes (önerilen)

**📸 Screenshot al:** Mağaza listing tam dolu hâli, "All checks passed" gri rozetli

---

## 5. Production release — submission

### Adım 5.1 — "Create new release"

**Yer:** Production → Create new release

### Adım 5.2 — Release content

**Bundle:** Yeni AAB'yi yükle (`app-release.aab`, versionCode 158)

**Release name:** "v1.2.75 - Yeni asset sistemi + bug fix"

**Release notes** (Türkçe + İngilizce):

```html
<tr-TR>
• Yeni mağaza sistemi: çerçeve, hediye, giriş animasyonu kategorileri
• Mesaj parlat panel scroll düzeltmesi
• Avatar çerçeve animasyon iyileştirmeleri
• Stabilite ve performans iyileştirmeleri
</tr-TR>

<en-US>
• New store system: frames, gifts, entry animations
• Message glow panel scroll fix
• Avatar frame animation improvements
• Stability and performance improvements
</en-US>
```

### Adım 5.3 — Review and rollout

- "Review release" tıkla
- Tüm uyarılar yeşilse "Start rollout to Production" tıkla
- **Rollout percentage: 20%** ile başla (riski azaltır), 1 hafta sonra 100% yap

**📸 Screenshot al:** Submission onay ekranı

### Adım 5.4 — Bekle

- Google review süresi: 1-7 gün (genelde 1-3 gün)
- Email bildirimi gelir
- Approved ise: ✓ canlı
- Rejected ise: sebep email'de + Play Console'da, düzelt + resubmit

---

## 6. Submit sonrası — yapılacaklar

### 6.1 — Email/bildirim takibi

- sopranochat@gmail.com'da Google Play uyarıları
- Her gün 1 kez kontrol et

### 6.2 — Crashlytics izle

Firebase Console → Crashlytics → uygulama
- Yeni release sonrası crash artışı varsa: rollback (Production → eski release'i tekrar aktif et)

### 6.3 — Reviews / feedback

- Play Store'da yeni yorumlar
- Olumsuz yorumlara yanıt yaz

---

## 7. Sık görülen reddedilme sebepleri

| Sebep | Nasıl çözülür |
|---|---|
| "Privacy policy violations" | Privacy policy'de Firebase/Supabase/LiveKit data processor'ları belirt |
| "Permission not declared" | AndroidManifest'te microphone/camera permission'ları + rationale text |
| "Misleading content" | Screenshot'lar gerçek uygulamayı yansıtmalı (mock data dahil ama gerçekçi) |
| "Copyrighted material" | Logo + assets kendi ürünün olmalı |
| "Subscription terms" | Plus/Pro fiyatlandırması açıkça store listing'de yazılmalı, otomatik yenileme bilgisi |
| "User-generated content moderation" | Şikayet mekanizması olduğunu açıkla (web admin paneli var) |

---

## 8. Acil durum: rollback

**Production'da kritik bug çıktıysa:**

1. Play Console → Production → release listesinde önceki sürümü bul
2. **"Rollout halt"** tıkla (yeni sürümü durdur)
3. Önceki sürüm canlıda kalır
4. Bug'ı düzelt → yeni AAB → tekrar release

---

## 9. Referans — Memory snapshot

Memory'deki Play Store ile ilgili notlar:
- `project_play_store_internal_live_2026_04_23.md` — v1.2.3 (27) Internal canlı
- `project_play_store_alpha_submit_2026_04_24.md` — v1.2.4 (36) Closed Test gönderildi, 14 tester
- `project_play_store_cooling_2026_04_22.md` — Upload key reset, 72h cooling

---

## ✅ Bu rehbere göre sırayla:

1. Play Console aç, Production sekmesini gör
2. Hangi uyarılar/engeller var, listele
3. Closed Test 14 gün + 12 tester durumunu kontrol et
4. Eksik App content alanlarını sırayla doldur (3.1-3.11)
5. Store listing'i tamamla (4.1-4.5)
6. Yeni AAB'yi yükle (versionCode 158)
7. Production submit et
8. Onay bekle

**Süre tahmini:** Form doldurma 2-3 saat. Closed test 14-gün şartı 8 Mayıs sonrası dolar. Google review 1-3 gün.

**Kritik tarih:** 8 Mayıs 2026 sonrası Production submit yapılabilir (Closed test eligibility).
