/**
 * MyMemory rate-limit corruption fix
 * ════════════════════════════════════════════════════════════════════
 * MyMemory API günlük kotası dolduğunda 'MYMEMORY WARNING: YOU USED...'
 * stringini başarılı çeviri gibi döndürdü. Bu metin en.ts'te 1638 key'e
 * çeviri olarak yazıldı.
 *
 * Bu script:
 *   1. en.ts'te 'MYMEMORY' içeren her satırı bul
 *   2. Aynı key'in TR değerini tr.ts'ten oku
 *   3. EN satırı TR değeri + '// TODO: translate' işareti ile geri yaz
 *   4. Sonraki gün translate scripti otomatik tekrar çevirir
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TR_PATH = path.join(ROOT, 'locales/tr.ts');
const EN_PATH = path.join(ROOT, 'locales/en.ts');

const trSrc = fs.readFileSync(TR_PATH, 'utf8');
const enSrc = fs.readFileSync(EN_PATH, 'utf8');

// ── TR key→value map (gevşek parser) ─────────────────────
const trMap = new Map();
const trLines = trSrc.split('\n');
for (const ln of trLines) {
  // 'key': value pattern — value herhangi bir quote türü
  const m = ln.match(/^\s*'([^']+)'\s*:\s*(.+?),?\s*(\/\/.*)?$/);
  if (!m) continue;
  const key = m[1];
  let raw = m[2].trim();
  // Strip trailing comma artifact
  if (raw.endsWith(',')) raw = raw.slice(0, -1).trim();
  let val;
  try {
    if (raw.startsWith('"') && raw.endsWith('"')) {
      val = JSON.parse(raw);
    } else if (raw.startsWith("'") && raw.endsWith("'")) {
      // single-quoted: çevir double-quoted JSON'a
      const inner = raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
      val = inner.replace(/\\n/g, '\n');
    } else {
      continue; // non-string value (object/array vs.)
    }
    if (typeof val === 'string') trMap.set(key, val);
  } catch {}
}
console.log('TR key sayısı:', trMap.size);

// ── EN satırlarını işle ───────────────────────────────────
const enLines = enSrc.split('\n');
let fixed = 0, missing = 0;

for (let i = 0; i < enLines.length; i++) {
  const rawLine = enLines[i];
  if (!rawLine.includes('MYMEMORY')) continue;
  // ★ CRLF: \r tail kırp — yoksa $ anchor fail eder
  const line = rawLine.replace(/\r$/, '');

  // Parse: '  'key': "VALUE",  // marker'
  const lm = line.match(/^(\s*)'([^']+)'\s*:\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(,?)(\s*\/\/.*)?$/);
  if (!lm) { missing++; continue; }

  const indent = lm[1];
  const key = lm[2];
  const comma = lm[3] || ',';

  const trVal = trMap.get(key);
  if (trVal == null) { missing++; continue; }

  // Yeni satır: TR değeri + TODO marker
  const escaped = JSON.stringify(trVal);
  enLines[i] = `${indent}'${key}': ${escaped}${comma}  // TODO: translate`;
  fixed++;
}

fs.writeFileSync(EN_PATH, enLines.join('\n'), 'utf8');
console.log(`Düzeltildi: ${fixed}`);
console.log(`Eksik (TR key yok): ${missing}`);
console.log('Sonraki adım: yarın quota reset olunca node scripts/i18n-translate.js --apply');
