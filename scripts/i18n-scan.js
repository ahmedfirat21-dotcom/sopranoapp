/**
 * i18n Scanner — Hardcoded Türkçe string'leri tarar.
 *
 * Mod: node scripts/i18n-scan.js              → rapor üretir
 *      node scripts/i18n-scan.js --verbose    → tüm bulguları listeler
 *
 * Çıktı: i18n-scan-report.json — apply scripti bu raporu kullanır.
 *
 * RAPORDA HER BULGU İÇİN:
 *   - type:        pattern türü (jsx_text / placeholder / label / title / ...)
 *   - line:        satır numarası
 *   - text:        TR metin
 *   - fullMatch:   regex tam eşleşmesi (apply'da bu STRING'i replace eder)
 *   - replacement: önerilen yeni kod (apply uygular)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

// Türkçe karakter detection
const TR_CHARS = /[şçğüıöŞÇĞÜİÖ]/;

const SKIP_DIRS = ['node_modules', '.git', 'android', 'ios', 'build', 'dist', '.expo', 'scripts', 'locales', 'supabase'];
const SKIP_FILES = [/\.test\.tsx?$/, /\.spec\.tsx?$/, /\.d\.ts$/];
const SKIP_LINE_PATTERNS = [
  /^\s*\/\//, /^\s*\*/,
  /console\.(log|warn|error|info)/,
  /throw new Error/, /__DEV__/,
  /logger\.(warn|error|info|log)/,
  /\.toISOString\(\)/,
];
const SKIP_STRING_VALUES = new Set([
  'Free', 'Plus', 'Pro', 'GodMaster', 'VIP', 'BOOST', 'TREND',
  'live', 'open', 'closed', 'invite', 'password', 'public', 'private',
  'ios', 'android', 'web', 'tr', 'en', 'TR', 'EN',
]);

// ─── Pattern'ler (her biri fullMatch + content capture eder) ───
// Önemli: pattern'leri tek-tırnak ve çift-tırnak için ayrı tutarız,
// içerikteki escape karakterleri böylece doğru yakalanır.
const PATTERNS = [
  // 1. <Text>TR</Text> — JSX text node (single-line)
  {
    type: 'jsx_text',
    // Tag içeriği <…>TR</…> — tek satırda, içeride { } yok
    regex: />\s*([^<>{}\n]*[şçğüıöŞÇĞÜİÖ][^<>{}\n]*?)\s*<\/(?:Text|Title|Heading|Label)>/g,
    build: (key) => (m, content) => m.replace(content, `{i18n.t('${key}')}`),
  },
  // 2. placeholder="TR"  (double-quote)
  {
    type: 'placeholder_dq',
    regex: /(placeholder=)"([^"\n]*[şçğüıöŞÇĞÜİÖ][^"\n]*)"/g,
    build: (key) => (m) => m.replace(/"([^"]*)"/, `{i18n.t('${key}')}`),
  },
  // 3. placeholder='TR'  (single-quote)
  {
    type: 'placeholder_sq',
    // tek tırnak içinde \' olabilir
    regex: /(placeholder=)'((?:[^'\\\n]|\\.)*[şçğüıöŞÇĞÜİÖ](?:[^'\\\n]|\\.)*)'/g,
    build: (key) => (m) => m.replace(/'(?:[^'\\]|\\.)*'/, `{i18n.t('${key}')}`),
  },
  // 4. prop: "TR"  → object property double-quote
  {
    type: 'prop_obj_dq',
    regex: /(\b(?:label|title|message|desc|description|sub|subtitle|subText|name|hint)\s*:\s*)"([^"\n]*[şçğüıöŞÇĞÜİÖ][^"\n]*)"/g,
    build: (key) => (m, prefix) => `${prefix}i18n.t('${key}')`,
  },
  // 5. prop: 'TR'  → object property single-quote (apostrof-aware)
  {
    type: 'prop_obj_sq',
    regex: /(\b(?:label|title|message|desc|description|sub|subtitle|subText|name|hint)\s*:\s*)'((?:[^'\\\n]|\\.)*[şçğüıöŞÇĞÜİÖ](?:[^'\\\n]|\\.)*)'/g,
    build: (key) => (m, prefix) => `${prefix}i18n.t('${key}')`,
  },
  // 6. prop="TR" → JSX attribute double-quote
  {
    type: 'prop_attr_dq',
    regex: /(\b(?:label|title|message|desc|description|sub|subtitle|subText|name|hint))="([^"\n]*[şçğüıöŞÇĞÜİÖ][^"\n]*)"/g,
    build: (key) => (m, attr) => `${attr}={i18n.t('${key}')}`,
  },
  // 7. prop='TR' → JSX attribute single-quote (apostrof-aware)
  {
    type: 'prop_attr_sq',
    regex: /(\b(?:label|title|message|desc|description|sub|subtitle|subText|name|hint))='((?:[^'\\\n]|\\.)*[şçğüıöŞÇĞÜİÖ](?:[^'\\\n]|\\.)*)'/g,
    build: (key) => (m, attr) => `${attr}={i18n.t('${key}')}`,
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

  for (const { type, regex } of PATTERNS) {
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      const matchStart = m.index;
      const beforeText = text.slice(0, matchStart);
      const lineNo = beforeText.split('\n').length;
      const lineContent = lines[lineNo - 1] || '';
      if (SKIP_LINE_PATTERNS.some(p => p.test(lineContent))) continue;

      // TR string content (capture group)
      const content = m[m.length - 1];
      if (!content) continue;
      if (!TR_CHARS.test(content)) continue;
      const trimmed = content.trim();
      if (trimmed.length < 2) continue;
      if (SKIP_STRING_VALUES.has(trimmed)) continue;

      findings.push({
        type,
        line: lineNo,
        text: trimmed,
        fullMatch: m[0],   // ← bu kritik: apply bu STRING'i replace eder
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
console.log('i18n Scanner — Hardcoded TR detection (v2 — apostrof-aware)');
console.log('═'.repeat(70));
console.log(`Taranan dosya: ${files.length}`);
console.log(`TR bulgu sayısı: ${totalFindings}`);
console.log(`Etkilenen dosya: ${Object.keys(byFile).length}`);
console.log('');

const sorted = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
console.log('İlk 30 dosya:');
console.log('─'.repeat(70));
for (const [file, findings] of sorted.slice(0, 30)) {
  console.log(`  ${findings.length.toString().padStart(3)} - ${file}`);
}

if (VERBOSE) {
  console.log('\n─── TÜM BULGULAR ───');
  for (const [file, findings] of sorted) {
    console.log(`\n${file}:`);
    for (const f of findings) {
      console.log(`  L${f.line.toString().padStart(4)} [${f.type.padEnd(15)}] "${f.text}"`);
    }
  }
}

const reportPath = path.join(ROOT, 'i18n-scan-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  totalFindings,
  filesAffected: Object.keys(byFile).length,
  filesScanned: files.length,
  byFile,
}, null, 2));
console.log(`\nRapor: i18n-scan-report.json`);
