/**
 * i18n Apply v2 — AST tabanlı otomatik değiştirme
 * ════════════════════════════════════════════════════════════════════
 * scan-v2 raporundaki tüm StringLiteral / TemplateLiteral / JSXText
 * node'larını i18n.t('auto.{file}.{counter}') çağrılarına dönüştürür.
 *
 * Pattern:
 *   - StringLiteral 'X'   → i18n.t('auto.foo.001')
 *     (parent JSX attribute ise:  attr={i18n.t(...)} sarmalama; expression slot ise direkt)
 *   - TemplateLiteral `${x} arşivlendi`  → i18n.t('auto.foo.002', { 0: x })
 *   - JSXText "Düzenle"   → {i18n.t('auto.foo.003')}
 *
 * Çıktı:
 *   - File'da inline replace
 *   - locales/tr.ts'ye yeni key'ler eklenir (TR fallback)
 *   - locales/en.ts'ye `// TODO: translate` ile aynı TR (sonra translate script çevirir)
 *
 * Güvenlik:
 *   - i18n import yoksa otomatik ekle
 *   - Comment / __DEV__ / console / i18n.t() chain'ini scanner zaten skip etmişti
 *   - Babel generator ile çıktı format'ı korunmuyor → @babel/generator kullanırsam tüm dosya yeniden format'lanır.
 *     Bu RİSKLİ. Yerine: precise replace — node.loc range'inden src dilimi alıp metinde değiştir.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'i18n-scan-v2-report.json');
const TR_PATH = path.join(ROOT, 'locales/tr.ts');
const EN_PATH = path.join(ROOT, 'locales/en.ts');

if (!fs.existsSync(REPORT_PATH)) {
  console.error('Önce: node scripts/i18n-scan-v2.js');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

// ─── Dosya bazında grupla ────────────────────────────────────
const byFile = {};
for (const r of report) {
  if (!byFile[r.file]) byFile[r.file] = [];
  byFile[r.file].push(r);
}

// ─── Key namespace üret ──────────────────────────────────────
function fileToNs(file) {
  // app/(tabs)/messages.tsx → auto.tabs.messages
  // components/room/RoomManageSheet.tsx → auto.room.RoomManageSheet
  const noExt = file.replace(/\.(tsx|ts)$/, '');
  const parts = noExt.split(/[/\\]/).filter(Boolean);
  // İlk 'app' veya 'components' kısmını at
  if (parts[0] === 'app' || parts[0] === 'components' || parts[0] === 'services') parts.shift();
  // Parentheses kaldır
  const clean = parts.map(p => p.replace(/[()[\]]/g, '').replace(/[^a-zA-Z0-9_]/g, '_'));
  return 'auto.' + clean.join('.');
}

// ─── locales/tr.ts'i parse et — mevcut key'leri öğren ────────
const trSrc = fs.readFileSync(TR_PATH, 'utf8');
const existingKeys = new Set();
const keyRe = /^\s*'([^']+)':/gm;
let m;
while ((m = keyRe.exec(trSrc)) !== null) existingKeys.add(m[1]);
console.log(`Mevcut key sayısı: ${existingKeys.size}`);

// ─── Her dosya için replacement plan ─────────────────────────
const newTrEntries = [];   // { key, value }
const fileTouched = new Set();
let replaceCount = 0;
let skipCount = 0;

function quoteStr(s) {
  // JSON-safe string (preserves \n, \t, vs.)
  return JSON.stringify(s);
}

for (const file of Object.keys(byFile)) {
  const entries = byFile[file];
  // Line-col descending sort — sondan başlayarak değiştir (offset shift olmasın)
  entries.sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.col - a.col;
  });

  const ns = fileToNs(file);
  let counter = 1;
  // Mevcut auto.{ns}.NNN key'lerinden en yükseği bulup ileriye git
  for (const k of existingKeys) {
    if (k.startsWith(ns + '.')) {
      const num = parseInt(k.slice(ns.length + 1), 10);
      if (Number.isFinite(num) && num >= counter) counter = num + 1;
    }
  }

  const fullPath = path.join(ROOT, file);
  let src = fs.readFileSync(fullPath, 'utf8');
  const lines = src.split('\n');

  for (const e of entries) {
    const lineIdx = e.line - 1;
    const lineText = lines[lineIdx];
    if (lineText == null) { skipCount++; continue; }

    // Raw string'i satırda ara — basit indexOf
    const idx = lineText.indexOf(e.raw, e.col);
    if (idx === -1) {
      // Multiline template literal olabilir; çoklu satırı handle etmek karmaşık → skip
      skipCount++;
      continue;
    }

    const key = `${ns}.${String(counter).padStart(3, '0')}`;
    counter++;

    let replacement;
    if (e.kind === 'string') {
      // Decide: JSX attribute (foo="...") veya expression context
      // Heuristic: önceki char `=` ise JSX attribute → {i18n.t(...)}
      const before = lineText.slice(0, idx).trimEnd();
      const isJsxAttr = before.endsWith('=');
      replacement = isJsxAttr ? `{i18n.t('${key}')}` : `i18n.t('${key}')`;
      newTrEntries.push({ key, value: e.value, file });
    } else if (e.kind === 'template') {
      // expressions array varsa interpolation map oluştur
      const exprs = e.expressions || [];
      if (exprs.length === 0) {
        replacement = `i18n.t('${key}')`;
      } else {
        // Key'i {{0}}, {{1}} formatına çevir
        const trValue = e.value.replace(/\$\{(\d+)\}/g, (_, n) => `{{${n}}}`);
        const optsObj = '{ ' + exprs.map((x, i) => `${i}: ${x}`).join(', ') + ' }';
        // Heuristic: JSX attr ise sarmalanmalı
        const before = lineText.slice(0, idx).trimEnd();
        const isJsxAttr = before.endsWith('=');
        replacement = isJsxAttr ? `{i18n.t('${key}', ${optsObj})}` : `i18n.t('${key}', ${optsObj})`;
        newTrEntries.push({ key, value: trValue, file });
      }
    } else if (e.kind === 'jsx_text') {
      // JSX text içine i18n.t() koyamayız direkt — {} ile saralım
      replacement = `{i18n.t('${key}')}`;
      newTrEntries.push({ key, value: e.value, file });
    } else {
      skipCount++;
      continue;
    }

    // Replace
    lines[lineIdx] = lineText.slice(0, idx) + replacement + lineText.slice(idx + e.raw.length);
    replaceCount++;
    fileTouched.add(file);
  }

  // i18n import gerekiyor mu?
  if (fileTouched.has(file)) {
    const newSrc = lines.join('\n');
    const hasI18nImport = /import\s+\{[^}]*\bi18n\b[^}]*\}\s+from\s+['"][^'"]*services\/i18n['"]/.test(newSrc) ||
                         /import\s+i18n\s+from\s+['"][^'"]*services\/i18n['"]/.test(newSrc);
    let final = newSrc;
    if (!hasI18nImport) {
      // En son import satırından sonra ekle
      const importRe = /^(import\s+.+?from\s+['"][^'"]+['"];?)$/gm;
      let lastIdx = -1, lastEnd = 0;
      let mm;
      while ((mm = importRe.exec(newSrc)) !== null) { lastIdx = mm.index; lastEnd = importRe.lastIndex; }
      if (lastIdx >= 0) {
        final = newSrc.slice(0, lastEnd) + `\nimport { i18n } from '../../services/i18n';` + newSrc.slice(lastEnd);
      }
    }
    fs.writeFileSync(fullPath, final, 'utf8');
  }
}

console.log(`Değiştirildi: ${replaceCount}  Skip: ${skipCount}`);
console.log(`Yeni TR key: ${newTrEntries.length}`);
console.log(`Etkilenen dosya: ${fileTouched.size}`);

// ─── locales/tr.ts'e ekle ─────────────────────────────────────
const trMarker = "  'tabs.messages.057':";
const trInsertIdx = trSrc.indexOf(trMarker);
let trUpdated;
if (trInsertIdx === -1) {
  // En sondan bir satır geri ekleme yöntemi: } önünde
  const closeIdx = trSrc.lastIndexOf('};');
  if (closeIdx === -1) {
    console.error('locales/tr.ts kapanışı bulunamadı; manual eklenmeli.');
    process.exit(1);
  }
  const block = newTrEntries.map(e => `  '${e.key}': ${quoteStr(e.value)},`).join('\n') + '\n';
  trUpdated = trSrc.slice(0, closeIdx) + block + trSrc.slice(closeIdx);
} else {
  // tabs.messages.057 satırının sonuna ekleyelim
  const lineEnd = trSrc.indexOf('\n', trInsertIdx);
  const block = '\n' + newTrEntries.map(e => `  '${e.key}': ${quoteStr(e.value)},`).join('\n');
  trUpdated = trSrc.slice(0, lineEnd) + block + trSrc.slice(lineEnd);
}
fs.writeFileSync(TR_PATH, trUpdated, 'utf8');

// ─── locales/en.ts'e ekle (TR fallback + TODO marker) ───────
const enSrc = fs.readFileSync(EN_PATH, 'utf8');
const enMarker = "  'tabs.messages.057':";
const enInsertIdx = enSrc.indexOf(enMarker);
let enUpdated;
if (enInsertIdx === -1) {
  const closeIdx = enSrc.lastIndexOf('};');
  const block = newTrEntries.map(e => `  '${e.key}': ${quoteStr(e.value)},  // TODO: translate`).join('\n') + '\n';
  enUpdated = enSrc.slice(0, closeIdx) + block + enSrc.slice(closeIdx);
} else {
  const lineEnd = enSrc.indexOf('\n', enInsertIdx);
  const block = '\n' + newTrEntries.map(e => `  '${e.key}': ${quoteStr(e.value)},  // TODO: translate`).join('\n');
  enUpdated = enSrc.slice(0, lineEnd) + block + enSrc.slice(lineEnd);
}
fs.writeFileSync(EN_PATH, enUpdated, 'utf8');

console.log('locales/tr.ts + en.ts güncellendi.');
console.log('Sonraki adım: node scripts/i18n-translate.js --apply');
