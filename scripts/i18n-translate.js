/**
 * i18n Translate — locales/en.ts içindeki TR fallback satırlarını
 * MyMemory translation API ile EN'ye çevirir.
 *
 * Hedef: "// TODO: translate" işaretli satırların TR string'leri.
 * API:    https://api.mymemory.translated.net/  (free, anon ~5000 kelime/gün)
 *
 * Mod:
 *   node scripts/i18n-translate.js --dry        → preview (kaç satır işlenecek)
 *   node scripts/i18n-translate.js --apply      → gerçek translate + dosyayı yaz
 *
 * Notlar:
 *   - Hız limiti için 80ms request gap (50/sn altında)
 *   - Çevrilmiş satır: "// translated" markeri ile yeniden işaretlenir
 *   - Hata olursa o satır TR halinde bırakılır + console'a warn
 *   - emoji / format ifadeleri ({{var}}) korunur (API uyumlu)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const EN_PATH = path.join(ROOT, 'locales/en.ts');
const APPLY = process.argv.includes('--apply');

// ─── MyMemory request ────────────────────────────────────
function translate(tr) {
  return new Promise((resolve, reject) => {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(tr)}&langpair=tr|en`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const en = json?.responseData?.translatedText;
          if (en && typeof en === 'string') resolve(en);
          else reject(new Error('no translation'));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const text = fs.readFileSync(EN_PATH, 'utf8');
  const lines = text.split('\n');

  // TODO: translate işaretli satırları topla
  const todoLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// TODO: translate')) {
      // Parse: '  'key.id': "TR text",  // TODO: translate'
      // ★ CRLF tolerant — \r line ending'leri pattern'da kabul et
      const match = lines[i].replace(/\r$/, '').match(/^(\s*'[^']+':\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(,?)(\s*\/\/ TODO: translate.*)$/);
      if (match) {
        const [, prefix, valueLit, comma, comment] = match;
        // valueLit: "TR" veya 'TR' (escape'li olabilir)
        let trStr;
        try { trStr = JSON.parse(valueLit.replace(/^'/, '"').replace(/'$/, '"').replace(/\\'/g, "'")); }
        catch { trStr = valueLit.slice(1, -1); }
        todoLines.push({ lineIdx: i, prefix, trStr, comma });
      }
    }
  }

  console.log('═'.repeat(70));
  console.log(`Çevrilecek satır: ${todoLines.length}`);
  console.log('═'.repeat(70));

  if (!APPLY) {
    console.log('İlk 10 örnek:');
    for (const t of todoLines.slice(0, 10)) {
      console.log(`  L${t.lineIdx + 1}: "${t.trStr}"`);
    }
    console.log('\nUygula: node scripts/i18n-translate.js --apply');
    return;
  }

  let translated = 0, failed = 0;
  for (let i = 0; i < todoLines.length; i++) {
    const t = todoLines[i];
    try {
      const en = await translate(t.trStr);
      // Encode as JSON.stringify for proper escaping
      lines[t.lineIdx] = `${t.prefix}${JSON.stringify(en)}${t.comma}  // translated`;
      translated++;
      if (i % 25 === 0) console.log(`  ${i}/${todoLines.length} (${translated} ok, ${failed} fail)`);
      // Hız limiti
      await sleep(80);
    } catch (err) {
      failed++;
      // Satırı olduğu gibi bırak (TR fallback)
    }
  }

  fs.writeFileSync(EN_PATH, lines.join('\n'), 'utf8');
  console.log(`\n✓ ${translated} satır çevrildi, ${failed} başarısız.`);
})();
