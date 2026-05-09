// Splash logo üretici — saydam zeminli app_icon.png'den her ekran yoğunluğu için
// splashscreen_logo.png oluşturur. Splash arka planındaki koyu daire kalkar.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'app_icon.png');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android 12+ Splash Screen icon boyutları (240dp baseline)
const SIZES = {
  'drawable-mdpi':    240,
  'drawable-hdpi':    360,
  'drawable-xhdpi':   480,
  'drawable-xxhdpi':  720,
  'drawable-xxxhdpi': 960,
};

(async () => {
  if (!fs.existsSync(SRC)) { console.error('Kaynak yok:', SRC); process.exit(1); }
  const img = sharp(SRC);
  const meta = await img.metadata();
  console.log(`Kaynak: ${meta.width}x${meta.height}, alpha=${meta.hasAlpha}`);

  // Trim alpha=0 padding
  const trimmed = await img.clone().trim({ threshold: 5 }).toBuffer({ resolveWithObject: true });
  console.log(`Kırpıldı: ${trimmed.info.width}x${trimmed.info.height}`);

  // Kareye getir + nefes payı
  const maxDim = Math.max(trimmed.info.width, trimmed.info.height);
  const padding = Math.round(maxDim * 0.05);
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
