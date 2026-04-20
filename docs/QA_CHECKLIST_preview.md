# SopranoChat — Preview APK QA Checklist

APK: EAS preview build (internal distribution)
Build commit: `cac2054`
SQL durumu: v34 + v35 deployed

## 🔐 Auth akışı
- [ ] Google Sign-In açılıyor → **hesap seçici çıkıyor** (otomatik önceki hesapla giriş yapmıyor)
- [ ] Yeni kullanıcı → onboarding ekranı
- [ ] Mevcut kullanıcı → home'a direkt
- [ ] Logout → login ekranına geri dönüyor

## 🏠 Home (Keşfet)
- [ ] Canlı oda listesi yükleniyor
- [ ] Kategori filtreleri çalışıyor (chat/müzik/oyun vs.)
- [ ] Boost rozeti pembe roket ikonu ile görünüyor
- [ ] Odaya tıkla → oda ekranı açılıyor

## 🎙 Oda (en kritik)
- [ ] Oda açma: create-room → LiveKit bağlantısı → ses çalışıyor
- [ ] Mikrofon on/off → diğer cihazda ses değişiyor
- [ ] El kaldır → host bildirim alıyor
- [ ] Host: el kaldıranı speaker yap → sahneye geliyor
- [ ] Host: speaker'ı mute et → hedef cihazda mic kapanıyor
- [ ] **Uyuyan oda uyandırma** → owner mic'e basınca mute değil
- [ ] Odadan çık → listener_count doğru düşüyor
- [ ] Odayı küçült (minimize) → ses devam ediyor, MiniRoomCard görünüyor
- [ ] Küçültülmüş karta tıkla → odaya geri dönüyor
- [ ] Host çıkışı → transferHost çalışıyor, oda sahipsiz kalmıyor

## 💎 SP Bağış (v34 test)
- [ ] user/[id] sayfasında SPDonateSheet açılıyor
- [ ] Slider + preset butonlar çalışıyor
- [ ] 10 SP gönder → SPSentSuccessModal (diamond pop + 2.8s)
- [ ] Alıcı cihazda SPReceivedModal belirir → teşekkür emojisi gönder
- [ ] Gönderenin cihazında thank_you bildirimi drawer'da görünür
- [ ] **Rate limit testi**: 10 bağış art arda → 11. "Çok fazla bağış..." hatası

## 💬 Mesajlar
- [ ] Konuşma listesi yükleniyor
- [ ] Chat aç → eski mesajlar geliyor
- [ ] Typing indicator çalışıyor
- [ ] Mesaj gönder → karşı taraf realtime alıyor
- [ ] Pin/archive: long-press → menü → test
- [ ] Arşivlenmiş chat'e yeni mesaj gelirse → auto-unarchive

## 🔔 Bildirimler
- [ ] NotificationBell: yeni bildirim gelince shake+pulse+haptic
- [ ] NotificationDrawer ok ucu başlıkla hizalı
- [ ] Bildirime tıkla → ilgili sayfaya gidiyor
- [ ] Push notification: app kapalıyken bağış → push bildirimi geliyor

## 👤 Profil
- [ ] Profil sayfası yükleniyor (teal glow gradient hero)
- [ ] Takipçi/takip sayıları doğru
- [ ] SP geçmişi modalı swipe-to-dismiss çalışıyor
- [ ] Ayarlar listesi → settings sayfasına gidiyor
- [ ] Referans kodu kopyala/paylaş çalışıyor
- [ ] Edit profile → kaydet → profil güncelleniyor

## 🏆 Diğer
- [ ] Leaderboard yükleniyor, sıralama doğru
- [ ] SP Store: paket satın alma akışı (test modu)
- [ ] Incoming call overlay: arama geldiğinde görünüyor, cevap/reddet
- [ ] Admin panel (admin hesap): kullanıcı silme/SP verme çalışıyor

## 🚨 Regression — eskiden bozulmuş olmasın
- [ ] App açılışta splash overlay sonra login/home'a geçiyor
- [ ] Tab bar blur efekti, gölgesi var (çerçeve değil)
- [ ] FriendsDrawer swipe ile açılıyor, diğer jestler tetiklemiyor
- [ ] Klavye açılınca input ekranı kapatmıyor

---

## 🐛 Hata bulursan
1. Adımları ve cihaz modelini yaz
2. Varsa ekran görüntüsü al
3. `adb logcat | grep -i sopranochat` (Android) çıktısını kopyala

## ✅ Hepsini geçersen
Faz 5: version bump → production AAB → Play Store internal track.
