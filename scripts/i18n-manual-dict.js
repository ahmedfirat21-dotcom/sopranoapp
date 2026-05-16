/**
 * i18n manual dictionary — TR → quality EN
 * ════════════════════════════════════════════════════════════════════
 * MyMemory kotası dolduğu için kullanılan TR fallback değerleri yerine
 * elle yazılmış kaliteli EN çevirilerini uygular. Sadece exact match
 * yapanlar değiştirilir; geri kalanı bekler.
 *
 * Çalışma: en.ts içindeki '// TODO: translate' marker'lı her satırın
 * mevcut TR değeri sözlükle eşleşirse, EN değer + // translated marker
 * ile yeniden yazılır.
 */
const fs = require('fs');
const path = require('path');

const EN_PATH = path.join(__dirname, '../locales/en.ts');

// ─── TR → EN sözlük (sık görülen, kullanıcı yüzlü) ──────────
const DICT = {
  // Genel
  'Kullanıcı': 'User',
  'Kullanıcılar': 'Users',
  'İptal': 'Cancel',
  'Vazgeç': 'Cancel',
  'Tamam': 'OK',
  'Kaydet': 'Save',
  'Sil': 'Delete',
  'Düzenle': 'Edit',
  'Geri': 'Back',
  'İleri': 'Next',
  'Devam': 'Continue',
  'Kapat': 'Close',
  'Aç': 'Open',
  'Evet': 'Yes',
  'Hayır': 'No',
  'Bilinmiyor': 'Unknown',
  'Yükleniyor': 'Loading',
  'Yükleniyor...': 'Loading...',
  'Yenile': 'Refresh',
  'Yeniden Dene': 'Try Again',
  'Tekrar dene.': 'Try again.',
  'Tekrar Dene': 'Try Again',
  'Tekrar deneyin.': 'Try again.',

  // Durumlar
  'Çevrimdışı': 'Offline',
  'Çevrimiçi': 'Online',
  'Aktif': 'Active',
  'Pasif': 'Inactive',
  'Açık': 'Open',
  'Kapalı': 'Closed',
  'Beklemede': 'Pending',
  'Kabul Edildi': 'Accepted',
  'Reddedildi': 'Rejected',

  // Hata başlıkları (toast titles)
  'Hata': 'Error',
  'Bağlantı Hatası': 'Connection Error',
  'Ağ Hatası': 'Network Error',
  'Bilinmeyen Hata': 'Unknown Error',
  'Sunucu Hatası': 'Server Error',
  'İzin Verilmedi': 'Permission Denied',
  'Yetersiz Yetki': 'Insufficient Permission',
  'Geçersiz İstek': 'Invalid Request',
  'Geçersiz Kod': 'Invalid Code',
  'Bir hata oluştu.': 'An error occurred.',
  'Bir hata oluştu': 'An error occurred',
  'İşlem başarısız': 'Action failed',
  'İşlem başarısız.': 'Action failed.',
  'Başarısız': 'Failed',

  // Onaylar
  'Başarılı': 'Success',
  'Başarıyla kaydedildi': 'Saved successfully',
  'Kaydedildi': 'Saved',
  'Güncellendi': 'Updated',
  'Silindi': 'Deleted',
  'Eklendi': 'Added',
  'Kaldırıldı': 'Removed',

  // Onboarding — kategori
  'Kadın': 'Female',
  'Erkek': 'Male',
  'Diğer': 'Other',
  'Belirtmek istemiyorum': 'Prefer not to say',
  'Müzik': 'Music',
  'Spor': 'Sports',
  'Sanat': 'Art',
  'Oyun': 'Gaming',
  'Teknoloji': 'Technology',
  'Sinema': 'Cinema',
  'Kitap': 'Books',
  'Seyahat': 'Travel',
  'Yemek': 'Food',
  'Felsefe': 'Philosophy',

  // Şifre güç
  'Zayıf': 'Weak',
  'Orta': 'Medium',
  'İyi': 'Good',
  'Güçlü': 'Strong',
  'Çok Güçlü': 'Very Strong',
  'Şifre Çok Kısa': 'Password Too Short',
  'Şifre Yenilendi': 'Password Reset',
  'Şifre Yenilendi.': 'Password reset.',
  'Şifreler Eşleşmiyor': 'Passwords Don\'t Match',

  // Onboarding hataları
  'Onboarding tamamlanamadı — DB hatası. Tekrar deneyin.': 'Onboarding could not complete — database error. Try again.',
  'Onboarding kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.': 'Onboarding could not be saved. Check your internet connection and try again.',
  'Lütfen geçerli bir davet kodu gir.': 'Please enter a valid invite code.',
  'Topluluğa hoş geldin! Hesabına 50 SP yüklendi.': 'Welcome to the community! 50 SP added to your account.',
  '📸 Fotoğraf Yüklendi': '📸 Photo Uploaded',
  'Profil fotoğrafın hazır!': 'Your profile photo is ready!',

  // Tabs / common UI
  'Aktivite verileri yüklenemedi': 'Activity data could not be loaded',
  'Hesabından çıkış yapmak istediğinden emin misin?': 'Are you sure you want to sign out?',
  '✨ Öne Çıkan Profil': '✨ Featured Profile',

  // Admin
  'Şikayet Kapatıldı': 'Report Closed',
  'Uyarı': 'Warning',
  'Kullanıcı Uyarıldı': 'User Warned',
  'Kullanıcı Banlandı': 'User Banned',
  'Kullanıcı Silinemedi': 'User Could Not Be Deleted',
  'Oda Kapatıldı': 'Room Closed',
  'Oda Uyandırıldı': 'Room Reopened',
  'Uyandırılamadı': 'Could Not Reopen',
  'Tier Güncellenemedi': 'Tier Could Not Be Updated',
  'Yetki Değiştirilemedi': 'Permission Could Not Be Changed',
  'Kendi hesabını silemezsin.': 'You cannot delete your own account.',

  // Empty / placeholder
  'Henüz mesaj yok.': 'No messages yet.',
  'Henüz bildirim yok.': 'No notifications yet.',
  'Henüz arkadaşın yok.': 'No friends yet.',
  'Sonuç bulunamadı.': 'No results found.',
  'Boş.': 'Empty.',

  // Time
  'şimdi': 'now',
  'az önce': 'just now',
  '1 dakika önce': '1 minute ago',
  '1 saat önce': '1 hour ago',
  '1 gün önce': '1 day ago',
  'dün': 'yesterday',
  'bugün': 'today',
};

// ─── Uygula ───────────────────────────────────────────────
const src = fs.readFileSync(EN_PATH, 'utf8');
const lines = src.split('\n');
let fixed = 0;

for (let i = 0; i < lines.length; i++) {
  const ln = lines[i].replace(/\r$/, '');
  if (!ln.includes('// TODO: translate')) continue;
  // Parse: '  'key': "VALUE",  // TODO: translate'
  const m = ln.match(/^(\s*)('([^']+)'\s*:\s*)(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')(,?)(\s*\/\/.*)$/);
  if (!m) continue;
  const indent = m[1];
  const prefix = m[2];
  const key = m[3];
  const trVal = m[4] != null ? m[4] : m[5];
  const comma = m[6] || ',';

  // JSON unescape
  let cleanTr;
  try { cleanTr = JSON.parse('"' + trVal.replace(/"/g, '\\"') + '"'); }
  catch { cleanTr = trVal; }

  const enVal = DICT[cleanTr];
  if (!enVal) continue;

  lines[i] = `${indent}${prefix}${JSON.stringify(enVal)}${comma}  // translated`;
  fixed++;
}

fs.writeFileSync(EN_PATH, lines.join('\n'), 'utf8');
console.log(`Sözlükten eşleşen ve düzeltilen: ${fixed}`);
console.log(`Sözlükte ${Object.keys(DICT).length} ifade vardı.`);
