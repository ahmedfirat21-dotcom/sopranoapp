# Play Store Listing Görsel Spec + AI Prompts

Play Console > Mağaza listelemesi bölümünde bu görseller gerekli. Hepsini sen (Figma/Canva/AI) üretip yükleyeceksin, metinler hazır.

## 1. Uygulama ikonu (zorunlu)
- **Boyut:** 512×512 px, 32-bit PNG, alfa kanalı YOK (saydam değil)
- **Kaynak:** `assets/ikon3.png` → Figma'ya import → 512×512 crop → PNG export
- Play Console > Mağaza listelemesi > Uygulama simgesi

## 2. Özellik grafiği (zorunlu)
- **Boyut:** 1024×500 px, JPEG veya PNG (saydam YOK)
- **Amaç:** Mağaza ana sayfa banner'ı, "Editor's Choice" koleksiyonları
- **Öneri:** App adı + slogan + arka planda ikon motifi

### AI prompt (Midjourney/DALL-E):
```
SopranoChat Play Store feature graphic, size 1024x500, 
cinematic horizontal banner.
Left side: premium mobile app icon (treble clef merging with speech bubble, 
glassmorphic 3D, cyan-teal gradient), glowing teal aura.
Center-right: large elegant wordmark "SopranoChat" in custom modern sans-serif,
white with subtle teal glow, below tagline "Sesin. Sohbetin. Topluluğun."
Background: deep midnight navy #0A1322 gradient to teal #0B7F78,
subtle sound wave patterns, soft bokeh particles.
Professional, clean, Apple app store featured quality, no cluttered elements.
--ar 1024:500 --style raw --s 300
```

### Canva alternatif (hazır şablon):
1. canva.com → "Google Play feature graphic" ara
2. Koyu mavi/mor şablon seç
3. Logo (ikon3.png) sola, metin sağa
4. Renk paletini teal'a uyarla (#14B8A6 accent)

## 3. Telefon ekran görüntüleri (2-8 adet, zorunlu)
- **Boyut:** 1080×1920 px (9:16) veya 1440×2560, PNG/JPEG
- **Minimum:** 2 görsel
- **Öneri:** 6-8 görsel, her biri bir ana özelliği tanıtan

### Önerilen 8 screenshot:

| # | Ekran | Başlık (üst) | Alt metin |
|---|-------|---------------|-----------|
| 1 | Ana sayfa (odalar listesi) | "Sesli sohbet odaları" | Binlerce oda, tek dokunuşla katıl |
| 2 | Oda içi (konuşan avatarlar) | "Sahneye çık, konuş" | Mikrofon iste, sahne al |
| 3 | Oda içi sohbet (reaction) | "❤️ ile tepki ver" | Canlı mesajlaşma + beğenme |
| 4 | DM ekranı (mesajlar) | "Birebir mesajlaşma" | Sesli not + fotoğraf paylaş |
| 5 | Profil (tier badge) | "Premium üyelik" | Plus / Pro / GodMaster avantajları |
| 6 | Arkadaşlar (online) | "Arkadaşlıklar" | Çevrimiçi arkadaşlarını gör |
| 7 | Keşfet | "Keşfet" | Yeni insanlar, yeni odalar |
| 8 | Ayarlar / Gizlilik | "Güvenli sohbet" | Engelle, şikayet et, kontrol sende |

### Üretim yöntemi
**Seçenek A — Cihaz screenshot + Figma çerçeve (önerilen):**
1. Kendi telefonunda her ekrandan screenshot al (uygulama içinden)
2. Figma'da "Play Store screenshot template" seç (bedava Community dosyaları var: "Google Play Store Screenshots - Kit")
3. Telefon çerçevesi içine koy + üste başlık + alta alt metin ekle
4. Export: 1080×1920 PNG

**Seçenek B — AI ile mock-up:**
Her ekran için Midjourney:
```
SopranoChat mobile app screenshot, size 1080x1920, 
[EKRAN AÇIKLAMASI — ör: "main screen with grid of live voice chat room cards, dark midnight background, teal accents, top banner with user avatar and SopranoChat logo"],
premium UI design, glassmorphic cards, teal #14B8A6 accent, 
text in Turkish, realistic mobile interface, 
Dribbble top-shot quality, clean typography.
--ar 9:16
```

## 4. Tablet ekran görüntüleri (opsiyonel, önerilen)
- **7 inç tablet:** 1200×1920 veya 1536×2048
- **10 inç tablet:** 1920×1200 veya 2560×1600
- Minimum 1 görsel yeterli — yoksa telefon screenshot'ları tablet'te yeniden ölçeklenir

## 5. Promo video (opsiyonel ama ÇOK ÖNERİLİR)
- **Format:** YouTube link (listeleme dışı / unlisted OK)
- **Süre:** 30 saniye - 2 dakika
- **Boyut:** 16:9 (yatay) önerilen
- **İçerik:** "1080p ekran kaydı" + arka plan müziği + alt yazı
- Google Play Console > Listelemeler > Promo videosu URL

### Video senaryosu (60 saniye):
```
0-5 sn: Logo açılış + slogan "Sesinle Bağlan"
5-15 sn: Ana sayfa → Oda seçimi → Oda içi
15-25 sn: Mikrofon iste → Sahneye çık → Konuş
25-35 sn: Sohbet → Reaction ❤️ → Mesaj
35-45 sn: Arkadaş ekle → DM → Voice note
45-55 sn: Premium badge → Özellikler listesi
55-60 sn: Logo kapanış + "Ücretsiz indir" CTA
```

## 6. Kısa tanıtım metni (zorunlu)
- **Max:** 80 karakter
- **Öneri:**
  > "Sesli sohbet odaları, canlı yayınlar ve gerçek arkadaşlıklar."

## 7. Tam açıklama (zorunlu)
- **Max:** 4000 karakter
- **Örnek şablon:**

```
🎤 SopranoChat — Sesinle Bağlan

Sesli sohbet odalarında tanış, sohbet et, arkadaş ol. Türkiye'nin 
yeni nesil sosyal ses platformu.

🎯 NE YAPABİLİRSİN?
• Canlı ses odalarına katıl, sahneye çık
• Yeni insanlarla tanış, arkadaş ol
• Özel mesajlaşma + sesli not
• Oda sahibi ol, kendi topluluğunu kur
• Hediye gönder, topluluğu destekle

🎁 ÜYELİK AVANTAJLARI
• Plus: Daha fazla oda, sohbet rozetleri
• Pro: Avatar çerçevesi, ses filtreleri
• GodMaster: Sınırsız özellikler

🔒 GÜVENLİ VE KONTROL SENDE
• Anlık engelleme + şikayet sistemi
• Moderasyon ekibi 7/24
• Yaş uygun içerik filtreleri
• Gizlilik odaklı veri politikası

📱 NEDEN SOPRANOCHAT?
• Çoklu odada aynı anda bulunma
• 60fps akıcı animasyonlar, düşük gecikme
• Türkiye sunucuları — hızlı bağlantı
• Türkçe tam destek

Uygulama sürekli güncelleniyor. Geri bildirimlerin bizim için değerli!

Destek: sopranochat@gmail.com
Gizlilik: https://sopranochat.com/privacy
Şartlar: https://sopranochat.com/terms
```

## 8. Kategori + etiketler (zorunlu)
- **Kategori:** Sosyal (Social) — birincil
- **İkincil etiketler:** İletişim (Communication), Yaşam tarzı (Lifestyle)

## 9. İçerik derecelendirmesi anketi (zorunlu)
Play Console > Uygulama içeriği > İçerik derecelendirmesi
- **Şiddet:** Yok
- **Cinsel içerik:** Yok (moderasyonlu)
- **Küfür:** Kullanıcı üretimli + filtrelenen (!)
- **Kumar:** Yok
- **Korku:** Yok
- **Uyuşturucu:** Yok
- **Kullanıcı etkileşimi:** Evet — sesli + metin sohbet
- **Konum paylaşımı:** Hayır
- **Dijital satın alma:** Evet (SP + üyelik — gelecekte)

→ Sonuç muhtemelen: **PEGI 12+ / IARC Teen**
→ Minimum yaş ayarı: `13+` yeterli (ama uygulama içinde mod/blok var)

## 10. Gizlilik politikası URL (zorunlu)
- **URL:** `https://sopranochat.com/privacy` (canlı olduğundan emin ol!)
- Data Safety formu bu URL'yi isteyecek
- İçerik: Hangi veri toplanıyor, nerede saklanıyor, 3. taraf paylaşımları

## Action plan

### Öncelik sırası:
1. ✅ **İkon 512×512** — en kolay, ikon3'ten Figma ile crop
2. ⚡ **Kısa tanıtım + tam açıklama** — bunları yukarıdan kopyala, kaydet
3. 🎨 **4 screenshot** — kendi telefonunda 4 önemli ekrandan (ana, oda içi, DM, profil) screenshot + Figma template ile çerçevele
4. 🖼️ **Özellik grafiği** — Midjourney prompt ile üret, 5dk
5. 🎬 **Promo video** — en son, 30-60 saniye ekran kaydı + iMovie/Canva ile kurgu

### Tahmini süre:
- Hızlı (minimum viable): **2 saat** (1-4 tamam, promo video atla)
- Tam paket: **6-8 saat** (hepsi)

Sen hangisini ilk yapmak istersen bana söyle, ben dostu olarak rehberlik ederim.
