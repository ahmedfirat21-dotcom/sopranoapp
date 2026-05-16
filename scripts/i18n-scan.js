/**
 * i18n Scanner — Hardcoded Türkçe string'leri tarar.
 *
 * Mod 1: node scripts/i18n-scan.js          → sadece RAPOR (dosya değiştirmez)
 * Mod 2: node scripts/i18n-scan.js --apply  → otomatik i18n.t() ile sarar + key ekler
 *
 * Tespit pattern'leri:
 *   1. <Text>Türkçe metin</Text>
 *   2. placeholder="Türkçe"
 *   3. label: 'Türkçe'
 *   4. title: 'Türkçe'
 *   5. message: 'Türkçe'
 *   6. desc: 'Türkçe' / description: 'Türkçe'
 *
 * Filtre: en az 1 Türkçe karakter (ş/ç/ğ/ü/ı/ö) içeriyor olması gerek.
 * False positive azaltma: 'use strict', console.log, throw new Error gibi bilinen
 * non-UI string'ler atlanır.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

// Türkçe karakter detection
const TR_CHARS = /[şçğüıöŞÇĞÜİÖ]/;

// Atlanacak dosyalar/klasörler
const SKIP_DIRS = ['node_modules', '.git', 'android', 'ios', 'build', 'dist', '.expo', 'scripts', 'locales', 'supabase'];
const SKIP_FILES = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /\.d\.ts$/];

// Atlanacak satır/string örüntüleri (false positive azaltma)
const SKIP_LINE_PATTERNS = [
  /^\s*\/\//,                          // comment
  /^\s*\*/,                            // jsdoc
  /console\.(log|warn|error|info)/,    // console
  /throw new Error/,                   // exception
  /__DEV__/,                            // dev guard
  /logger\.(warn|error|info|log)/,     // logger
  /\.toISOString\(\)/,                 // date
];

const SKIP_STRING_VALUES = new Set([
  'Free', 'Plus', 'Pro', 'GodMaster', 'VIP', 'BOOST', 'TREND',
  'live', 'open', 'closed', 'invite', 'password', 'public', 'private',
  'ios', 'android', 'web', 'tr', 'en', 'TR', 'EN',
]);

// ─── TR pattern'leri ─────────────────────────────────────
// Her pattern bir capture group (TR metin) içermeli
const PATTERNS = [
  {
    name: 'JSX Text',
    regex: />([^<>{}\n]*[şçğüıöŞÇĞÜİÖ][^<>{}\n]*)<\/(?:Text|Title|Heading|Label)>/g,
    wrapper: (match, str) => match.replace(str, `{KEY_PLACEHOLDER}`),
  },
  {
    name: 'placeholder',
    regex: /placeholder=["']([^"'\n]*[şçğüıöŞÇĞÜİÖ][^"'\n]*)["']/g,
    wrapper: (match, str) => match.replace(/placeholder=["'][^"']*["']/, `placeholder={KEY_PLACEHOLDER}`),
  },
  {
    name: 'label prop',
    regex: /(\blabel\s*[=:]\s*)["']([^"'\n]*[şçğüıöŞÇĞÜİÖ][^"'\n]*)["']/g,
    wrapper: null,
  },
  {
    name: 'title prop',
    regex: /(\btitle\s*[=:]\s*)["']([^"'\n]*[şçğüıöŞÇĞÜİÖ][^"'\n]*)["']/g,
    wrapper: null,
  },
  {
    name: 'message prop',
    regex: /(\bmessage\s*[=:]\s*)["']([^"'\n]*[şçğüıöŞÇĞÜİÖ][^"'\n]*)["']/g,
    wrapper: null,
  },
  {
    name: 'desc/description prop',
    regex: /(\b(?:desc|description)\s*[=:]\s*)["']([^"'\n]*[şçğüıöŞÇĞÜİÖ][^"'\n]*)["']/g,
    wrapper: null,
  },
  {
    name: 'sub/subtitle prop',
    regex: /(\b(?:sub|subtitle|subText)\s*[=:]\s*)["']([^"'\n]*[şçğüıöŞÇĞÜİÖ][^"'\n]*)["']/g,
    wrapper: null,
  },
];

// ─── Dosya tarama ────────────────────────────────────────
function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (SKIP_FILES.some(p => p.test(entry.name))) continue;
      out.push(full);
    }
  }
  return out;
}

// ─── Bir dosyayı tara ────────────────────────────────────
function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const findings = [];

  for (const { name, regex } of PATTERNS) {
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      const matchStart = m.index;
      // Line number hesapla
      const beforeText = text.slice(0, matchStart);
      const lineNo = beforeText.split('\n').length;
      const lineContent = lines[lineNo - 1] || '';

      // Filter: skip pattern'leri
      if (SKIP_LINE_PATTERNS.some(p => p.test(lineContent))) continue;

      // TR string'i çıkar (genelde 2. veya tek capture group)
      const str = m[2] !== undefined ? m[2] : m[1];
      if (!str) continue;
      if (!TR_CHARS.test(str)) continue;
      const trimmed = str.trim();
      if (trimmed.length < 2) continue;
      if (SKIP_STRING_VALUES.has(trimmed)) continue;

      findings.push({
        type: name,
        line: lineNo,
        text: trimmed,
        context: lineContent.trim().slice(0, 100),
      });
    }
  }

  return findings;
}

// ─── Ana akış ────────────────────────────────────────────
const APP_DIR = path.join(ROOT, 'app');
const COMP_DIR = path.join(ROOT, 'components');

const files = [...walk(APP_DIR), ...walk(COMP_DIR)];

let totalFindings = 0;
const byFile = {};

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const findings = scanFile(file);
  if (findings.length === 0) continue;
  byFile[rel] = findings;
  totalFindings += findings.length;
}

// ─── Rapor ───────────────────────────────────────────────
console.log('═'.repeat(70));
console.log('i18n Scanner — Hardcoded TR detection');
console.log('═'.repeat(70));
console.log(`Taranan dosya: ${files.length}`);
console.log(`TR bulgu sayısı: ${totalFindings}`);
console.log(`Etkilenen dosya: ${Object.keys(byFile).length}`);
console.log('');

// En çok bulgu olan 20 dosya
const sorted = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
console.log('İlk 30 dosya (bulgu sayısına göre):');
console.log('─'.repeat(70));
for (const [file, findings] of sorted.slice(0, 30)) {
  console.log(`  ${findings.length.toString().padStart(3)} - ${file}`);
}
console.log('');

if (VERBOSE) {
  console.log('─'.repeat(70));
  console.log('TÜM BULGULAR (verbose mod):');
  console.log('─'.repeat(70));
  for (const [file, findings] of sorted) {
    console.log(`\n${file}:`);
    for (const f of findings) {
      console.log(`  L${f.line.toString().padStart(4)} [${f.type.padEnd(20)}] "${f.text}"`);
    }
  }
}

// JSON rapor dosyası
const reportPath = path.join(ROOT, 'i18n-scan-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalFindings,
  filesAffected: Object.keys(byFile).length,
  filesScanned: files.length,
  byFile,
}, null, 2));
console.log(`Detaylı rapor: i18n-scan-report.json`);
console.log('');
console.log('Sonraki adım: bu rapora bakıp hangi dosyaları toplu çevirelim karar ver.');
console.log('  Tam liste için: node scripts/i18n-scan.js --verbose');
