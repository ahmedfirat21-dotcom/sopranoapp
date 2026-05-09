// ★ v107 (4 May 2026): Mağaza ürün görsellerini WebView yerine PNG asset'e dönüştür.
//
// 14 unique HTML illustration (Aurum Strike + 13 wrapLuxuryFrame'li) → puppeteer ile
// 1024x1024 transparent PNG render → assets/store/items/{id}.png
//
// Çalıştır: node tools/render-store-pngs.mjs
//
// Not: storeIllustrations.ts TS dosyası, tsx ile compile etmek yerine ham HTML'leri
//      build script'i çalıştırılırken çalışan node bağlamına regex ile çıkarıyoruz.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'constants', 'storeIllustrations.ts');
const OUT_DIR = path.join(ROOT, 'assets', 'store', 'items');
const VIEWPORT = 1024; // kart kalitesi için yüksek çözünürlük

await fs.mkdir(OUT_DIR, { recursive: true });

const src = await fs.readFile(SOURCE, 'utf8');

// 1) Resolve template constants — storeIllustrations.ts içinde STAGE_CSS, COMMON_KEYFRAMES,
//    FRAME_CSS_INJECT gibi sabitler `${X}` ile referans veriliyor. Onları da çıkar.
function extractConst(name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\`([\\s\\S]*?)\`;`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${name} bulunamadı`);
  return m[1];
}

const STAGE_CSS = extractConst('STAGE_CSS');
const COMMON_KEYFRAMES = extractConst('COMMON_KEYFRAMES');
const FRAME_CSS_INJECT = extractConst('FRAME_CSS_INJECT');

// 2) FRAME palette object — JS-syntax içerdiği için JSON.parse zor. Eval ile çıkaralım.
const FRAME = (() => {
  const m = src.match(/const FRAME\s*=\s*(\{[\s\S]*?\n\});/m);
  if (!m) throw new Error('FRAME palette bulunamadı');
  // Eval — TS object literal Node ESM'de çalışır
  return Function(`return ${m[1]};`)();
})();

// 3) Resolve helper
function resolveTemplate(rawHtml) {
  return rawHtml
    .replace('${STAGE_CSS}', STAGE_CSS)
    .replace('${COMMON_KEYFRAMES}', COMMON_KEYFRAMES);
}

function wrapLuxuryFrame(rawHtml, opts) {
  const styleVars = `--frame-bg:${opts.bg};--frame-glow:${opts.glow};--frame-border:${opts.border}`;
  return rawHtml
    .replace('</style>', FRAME_CSS_INJECT + '</style>')
    .replace('<body>', `<body style="${styleVars}"><div class="frame"><div class="bg-rays-g"></div><div class="art-stack">`)
    .replace('</body>', '</div></div></body>');
}

// 4) Each base item HTML extraction
const BASE_ITEMS = [
  { id: 'phoenix-diadem', constName: 'PHOENIX_DIADEM_HTML', frame: FRAME.phoenix },
  { id: 'galactique',     constName: 'GALACTIQUE_HTML',     frame: FRAME.galactique },
  { id: 'aurum-strike',   constName: 'AURUM_STRIKE_HTML',   frame: null }, // kendi frame'i var
  { id: 'glacier-aura',   constName: 'GLACIER_AURA_HTML',   frame: FRAME.glacier },
  { id: 'vesuvius',       constName: 'VESUVIUS_HTML',       frame: FRAME.vesuvius },
  { id: 'constellation',  constName: 'CONSTELLATION_HTML',  frame: FRAME.constellation },
  { id: 'or-ancien',      constName: 'OR_ANCIEN_HTML',      frame: FRAME.orAncien },
  { id: 'inferno',        constName: 'INFERNO_HTML',        frame: FRAME.inferno },
  { id: 'voltaire',       constName: 'VOLTAIRE_HTML',       frame: FRAME.voltaire },
  { id: 'belle-epoque',   constName: 'BELLE_EPOQUE_HTML',   frame: FRAME.belleEpoque },
  { id: 'la-rose-noir',   constName: 'LA_ROSE_NOIR_HTML',   frame: FRAME.laRoseNoir },
  { id: 'marina-royale',  constName: 'MARINA_ROYALE_HTML',  frame: FRAME.marinaRoyale },
  { id: 'versailles',     constName: 'VERSAILLES_HTML',     frame: FRAME.versailles },
  { id: 'emeraude',       constName: 'EMERAUDE_HTML',       frame: FRAME.emeraude },
];

console.log('Puppeteer başlatılıyor...');
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: VIEWPORT, height: VIEWPORT, deviceScaleFactor: 1 });

  for (const { id, constName, frame } of BASE_ITEMS) {
    const raw = extractConst(constName);
    const resolved = resolveTemplate(raw);
    const html = frame ? wrapLuxuryFrame(resolved, frame) : resolved;

    // Transparent bg sağlamak için body { background: transparent }
    const fullHtml = `<!doctype html><html><body style="margin:0;padding:0;width:${VIEWPORT}px;height:${VIEWPORT}px;background:transparent;overflow:hidden;">${html.replace(/<!doctype[^>]*>|<\/?html>|<\/?head>|<\/?body[^>]*>/gi, '')}</body></html>`;

    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 5000 });
    // SVG animasyonları stabilize olsun — kısa bekleme
    await new Promise(r => setTimeout(r, 600));

    const outPath = path.join(OUT_DIR, `${id}.png`);
    await page.screenshot({
      path: outPath,
      omitBackground: true,
      clip: { x: 0, y: 0, width: VIEWPORT, height: VIEWPORT },
    });
    console.log(`✓ ${id}.png`);
  }
} finally {
  await browser.close();
}

console.log(`\n${BASE_ITEMS.length} PNG yazıldı → ${OUT_DIR}`);
