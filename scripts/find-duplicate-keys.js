/**
 * locales/{tr,en}.ts içinde duplicate key bulur.
 * Duplicate'ler JS object literal'de override yapar — son tanımlanan kazanır,
 * ilk tanımlanan sessiz kaybolur. UI'da yanlış metin gösterilmesinin sebebi.
 */
const fs = require('fs');
const path = require('path');

function findDupes(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');
  const seen = new Map(); // key → first line number
  const dupes = []; // {key, firstLine, dupLine, firstVal, dupVal}
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].replace(/\r$/, '');
    const m = ln.match(/^\s*'([^']+)'\s*:\s*(.+?)(,)?\s*(\/\/.*)?$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].slice(0, 60);
    if (seen.has(key)) {
      dupes.push({ key, firstLine: seen.get(key) + 1, dupLine: i + 1, firstVal: seen.get(key + '_val') || '', dupVal: val });
    } else {
      seen.set(key, i);
      seen.set(key + '_val', val);
    }
  }
  return dupes;
}

for (const file of ['locales/tr.ts', 'locales/en.ts']) {
  const dupes = findDupes(file);
  console.log(`\n═══ ${file} — ${dupes.length} duplicate ═══`);
  for (const d of dupes.slice(0, 30)) {
    console.log(`  '${d.key}' L${d.firstLine}→${d.dupLine}`);
    console.log(`    first: ${d.firstVal}`);
    console.log(`    dupe:  ${d.dupVal}`);
  }
  if (dupes.length > 30) console.log(`  ... +${dupes.length - 30} daha`);
}
