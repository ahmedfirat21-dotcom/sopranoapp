// Splash logo üretici — saydam zeminli app_icon.png'den her ekran yoğunluğu için
// splashscreen_logo.png oluşturur. Splash arka planındaki koyu daire kalkar.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'app_icon.png');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android 12+ Splash Screen icon — windowSplashScreenAnimatedIcon (no icon background)
// Resmi spec: 192dp × 192dp icon canvas (icon-only mode). PNG native pixel boyutuyla render edilir,
// dolayısıyla density başına 192dp = px/density katsayısı verilmeli.
//   mdpi(1×)=192, hdpi(1.5×)=288, xhdpi(2×)=384, xxhdpi(3×)=576, xxxhdpi(4×)=768
// Önceki 108dp tablosu küçük kalıyordu (logo ekranın ~25%'i); 192dp ile ~%40-45 ekran kaplama.
const SIZES = {
  'drawable-mdpi':    192,
  'drawable-hdpi':    288,
  'drawable-xhdpi':   384,
  'drawable-xxhdpi':  576,
  'drawable-xxxhdpi': 768,
};

(async () => {
  if (!fs.existsSync(SRC)) { console.error('Kaynak yok:', SRC); process.exit(1); }
  const img = sharp(SRC);
  const meta = await img.metadata();
  console.log(`Kaynak: ${meta.width}x${meta.height}, alpha=${meta.hasAlpha}`);

  // Trim alpha=0 padding
  const trimmed = await img.clone().trim({ threshold: 5 }).toBuffer({ resolveWithObject: true });
  console.log(`Kırpıldı: ${trimmed.info.width}x${trimmed.info.height}`);

  // Kareye getir + nefes payı (%25 — Android 12+ splash icon dairesel mask uygular;
  // logo bbox köşegeni inscribed circle'ın içine sığsın diye geniş padding gerekli.
  // Logo: 457×613 dikdörtgen, köşegeni ~765 → canvas 920+ olmalı.)
  const maxDim = Math.max(trimmed.info.width, trimmed.info.height);
  const padding = Math.round(maxDim * 0.30);
  const canvasSize = maxDim + padding * 2;
  const squared = await sharp({
    create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed.data, left: Math.round((canvasSize - trimmed.info.width) / 2), top: Math.round((canvasSize - trimmed.info.height) / 2) }])
    .png()
    .toBuffer();
  console.log(`Kare canvas: ${canvasSize}x${canvasSize}`);

  for (const [folder, size] of Object.entries(SIZES)) {
    const outDir = path.join(ANDROID_RES, folder);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'splashscreen_logo.png');
    await sharp(squared).resize(size, size, { kernel: 'lanczos3' }).png().toFile(outPath);
    console.log(`✓ ${folder}/splashscreen_logo.png (${size}x${size})`);
  }
  console.log('Bitti.');
})().catch(e => { console.error(e); process.exit(1); });
