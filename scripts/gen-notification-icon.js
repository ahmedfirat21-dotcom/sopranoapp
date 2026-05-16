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

  // ★ 2026-05-16 v284: status bar'da silüet WhatsApp gibi 24dp x 24dp alanı dolsun.
  //   Silüet 0.80 oranlı (yatayda dar) → kare canvas'a sığarken sağ-sol %18 boşluk.
  //   Çözüm: silüeti hedef oran 0.94'e gelene kadar YATAYDA stretch et (kırpma yok).
  //   Aspect değişimi simetrik formlar için göze batmaz; status bar'da görünür alan +%17.
  const TARGET_ASPECT = 0.94; // width / height — kareye yakın ama tam değil (asimetri korunsun)
  const origAspect = trimmed.info.width / trimmed.info.height;
  let stretchedBuf, stretchedW, stretchedH;
  if (origAspect < TARGET_ASPECT) {
    stretchedH = trimmed.info.height;
    stretchedW = Math.round(stretchedH * TARGET_ASPECT);
    stretchedBuf = await sharp(trimmed.data).resize(stretchedW, stretchedH, { fit: 'fill', kernel: 'lanczos3' }).toBuffer();
    console.log(`Yatay stretch: ${trimmed.info.width}x${trimmed.info.height} → ${stretchedW}x${stretchedH} (oran ${origAspect.toFixed(2)} → ${TARGET_ASPECT})`);
  } else {
    stretchedBuf = trimmed.data;
    stretchedW = trimmed.info.width;
    stretchedH = trimmed.info.height;
  }

  // 2) Kareye getir (içerik tam kareye yerleşsin)
  const maxDim = Math.max(stretchedW, stretchedH);
  const padding = 0;
  const canvasSize = maxDim + padding * 2;
  const squared = await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: stretchedBuf, left: Math.round((canvasSize - stretchedW) / 2), top: Math.round((canvasSize - stretchedH) / 2) }])
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
