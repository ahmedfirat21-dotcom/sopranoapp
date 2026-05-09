// Splash preview üretici — build almadan farklı padding değerlerini denemek için.
// Çıktı: scripts/splash-preview/padding-XX.png (telefon ekranı oranlı simülasyon)
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'assets', 'app_icon.png');
const OUT_DIR = path.join(__dirname, 'splash-preview');
const BG = '#0A0F1A';
// Telefon ekranı simülasyonu: 540×1200 (1080×2400 yarısı, hızlı render)
const PHONE_W = 540, PHONE_H = 1200;
// Splash icon canvas 192dp; mock phone'da xxxhdpi varsayımıyla 192dp = ~768px,
// fakat 540 genişlik içinde oranlamak için 192dp / 360dp_screen = %53 → 540*0.53 = ~286
const ICON_RENDER_SIZE = 286;

const PADDING_PERCENTS = [10, 15, 20, 25, 30];

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const trimmed = await sharp(SRC).trim({ threshold: 5 }).toBuffer({ resolveWithObject: true });
  console.log(`Trim sonrası logo: ${trimmed.info.width}x${trimmed.info.height}`);

  for (const pct of PADDING_PERCENTS) {
    const maxDim = Math.max(trimmed.info.width, trimmed.info.height);
    const padding = Math.round(maxDim * (pct / 100));
    const canvasSize = maxDim + padding * 2;
    // Logo'yu kareye yerleştir
    const squared = await sharp({
      create: { width: canvasSize, height: canvasSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: trimmed.data, left: Math.round((canvasSize - trimmed.info.width) / 2), top: Math.round((canvasSize - trimmed.info.height) / 2) }])
      .png().toBuffer();
    // ICON_RENDER_SIZE'a küçült
    const iconResized = await sharp(squared).resize(ICON_RENDER_SIZE, ICON_RENDER_SIZE, { kernel: 'lanczos3' }).png().toBuffer();
    // Telefon zemini üstüne yerleştir
    const phone = await sharp({
      create: { width: PHONE_W, height: PHONE_H, channels: 3, background: BG },
    })
      .composite([{
        input: iconResized,
        left: Math.round((PHONE_W - ICON_RENDER_SIZE) / 2),
        top: Math.round((PHONE_H - ICON_RENDER_SIZE) / 2),
      }])
      .png()
      .toFile(path.join(OUT_DIR, `padding-${pct}.png`));
    console.log(`✓ padding-${pct}.png — canvas ${canvasSize}px, logo ekranda %${Math.round(ICON_RENDER_SIZE / PHONE_W * 100)} (içerik %${Math.round(maxDim / canvasSize * 100)})`);
  }

  // Side-by-side karşılaştırma (5 preview yan yana)
  const sources = PADDING_PERCENTS.map(p => path.join(OUT_DIR, `padding-${p}.png`));
  const comboW = PHONE_W * PADDING_PERCENTS.length;
  const labels = await Promise.all(PADDING_PERCENTS.map(async (p, i) => {
    return {
      input: Buffer.from(`<svg width="${PHONE_W}" height="60"><rect width="100%" height="100%" fill="#000"/><text x="50%" y="40" text-anchor="middle" font-family="Arial" font-size="32" fill="#fff">%${p}</text></svg>`),
      left: i * PHONE_W, top: 0,
    };
  }));
  const composites = sources.map((s, i) => ({ input: s, left: i * PHONE_W, top: 60 }));
  await sharp({ create: { width: comboW, height: PHONE_H + 60, channels: 3, background: BG } })
    .composite([...labels, ...composites])
    .png()
    .toFile(path.join(OUT_DIR, 'compare.png'));
  console.log(`✓ compare.png — yan yana ${PADDING_PERCENTS.length} seçenek`);
})().catch(e => { console.error(e); process.exit(1); });
