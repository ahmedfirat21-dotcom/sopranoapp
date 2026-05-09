// Bildirim ikonu üretici — kaynak PNG'den boş alanları kırpar, her ekran yoğunluğu için
// uygun boyutta dosya üretir. Status bar'da WhatsApp ikonu kadar büyük görünmesi için.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'notification_icon_preview.png');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android notification icon boyutları (Material Design)
const SIZES = {
  'drawable-mdpi':    24,
  'drawable-hdpi':    36,
  'drawable-xhdpi':   48,
  'drawable-xxhdpi':  72,
  'drawable-xxxhdpi': 96,
};

(async () => {
  if (!fs.existsSync(SRC)) { console.error('Kaynak yok:', SRC); process.exit(1); }
  const img = sharp(SRC);
  const meta = await img.metadata();
  console.log(`Kaynak: ${meta.width}x${meta.height}, ${meta.channels} kanal, alpha=${meta.hasAlpha}`);

  // 1) Boş alanları kırp (alpha=0 pikselleri kes)
  const trimmed = await img.clone().trim({ threshold: 5 }).toBuffer({ resolveWithObject: true });
  console.log(`Kırpıldı: ${trimmed.info.width}x${trimmed.info.height}`);

  // 2) Kareye getir (içerik tam kareye yerleşsin, hafif kenar boşluğu ekle)
  const maxDim = Math.max(trimmed.info.width, trimmed.info.height);
  const padding = Math.round(maxDim * 0.08); // %8 nefes
  const canvasSize = maxDim + padding * 2;
  const squared = await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed.data, left: Math.round((canvasSize - trimmed.info.width) / 2), top: Math.round((canvasSize - trimmed.info.height) / 2) }])
    .png()
    .toBuffer();
  console.log(`Kare canvas: ${canvasSize}x${canvasSize}`);

  // 3) Her yoğunluk için ölçeklendir + beyaz monokrom (notification icon Android'de tek renk)
  for (const [folder, size] of Object.entries(SIZES)) {
    const outDir = path.join(ANDROID_RES, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'notification_icon.png');
    await sharp(squared)
      .resize(size, size, { kernel: 'lanczos3' })
      .ensureAlpha()
      // Tüm renk kanallarını beyaza çek, alpha kanalını koru → silüet
      .composite([{
        input: { create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } },
        blend: 'in',
      }])
      .png()
      .toFile(outPath);
    console.log(`✓ ${folder}/notification_icon.png (${size}x${size})`);
  }
  console.log('Bitti.');
})().catch(e => { console.error(e); process.exit(1); });
