/**
 * i18n Apply v2 — fullMatch tabanlı doğrudan replace.
 *
 * Scan v2 her bulgu için `fullMatch` (regex tam eşleşmesi) kaydeder.
 * Apply bu STRING'i splice ile değiştirir — regex re-eval YOK, apostrof
 * bug'ı yok.
 *
 * Mod:
 *   node scripts/i18n-apply.js --dry      → preview
 *   node scripts/i18n-apply.js --apply    → uygula
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARGV = process.argv.slice(2);
const APPLY = ARGV.includes('--apply');
const DRY = !APPLY;

const REPORT_PATH = path.join(ROOT, 'i18n-scan-report.json');
const TR_PATH = path.join(ROOT, 'locales/tr.ts');
const EN_PATH = path.join(ROOT, 'locales/en.ts');

if (!fs.existsSync(REPORT_PATH)) {
  console.error('Önce: node scripts/i18n-scan.js');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

// ─── Key generation ─────────────────────────────────────
function fileToKeyBase(rel) {
  const noExt = rel.replace(/\.(tsx?|jsx?)$/, '');
  const parts = noExt.split('/').filter(p => p !== 'components' && p !== 'app');
  return parts.map(p => p.toLowerCase().replace(/[^a-z0-9]/g, '')).join('.');
}

// ─── Tek bulgu için yeni kod parçası üret ────────────────
function buildReplacement(type, key, fullMatch) {
  switch (type) {
    case 'jsx_text':
      // > ...TR... </Text>  → >{i18n.t('key')}</Text>
      return fullMatch.replace(/>\s*[^<]*</, `>{i18n.t('${key}')}<`);
    case 'placeholder_dq':
    case 'placeholder_sq':
      return fullMatch.replace(/=["'][\s\S]*["']/, `={i18n.t('${key}')}`);
    case 'prop_obj_dq':
    case 'prop_obj_sq': {
      // prop: 'value' → prop: i18n.t('key')
      const m = fullMatch.match(/^(\s*\w+\s*:\s*)/);
      const prefix = m ? m[1] : '';
      return `${prefix}i18n.t('${key}')`;
    }
    case 'prop_attr_dq':
    case 'prop_attr_sq': {
      // prop="value" → prop={i18n.t('key')}
      const m = fullMatch.match(/^(\w+)=/);
      const attr = m ? m[1] : 'label';
      return `${attr}={i18n.t('${key}')}`;
    }
    default:
      return null;
  }
}

// ─── Import path hesapla ─────────────────────────────────
function relImportPath(rel) {
  // rel örnek: 'app/(tabs)/profile.tsx' → '../../services/i18n'
  // rel örnek: 'components/foo.tsx' → '../services/i18n'
  // rel örnek: 'components/room/foo.tsx' → '../../services/i18n'
  const parts = rel.split('/');
  const depth = parts.length - 1; // file hariç klasör sayısı
  return '../'.repeat(depth) + 'services/i18n';
}

// ─── İşlem ───────────────────────────────────────────────
const NEW_KEYS_TR = [];
const NEW_KEYS_EN = [];
const filePatches = {};
let totalApplied = 0;
let totalSkipped = 0;
let totalAmbiguous = 0;

for (const [rel, findings] of Object.entries(report.byFile)) {
  const baseKey = fileToKeyBase(rel);
  const fullPath = path.join(ROOT, rel);
  if (!fs.existsSync(fullPath)) continue;

  let text = fs.readFileSync(fullPath, 'utf8');
  let counter = 1;
  const fileMods = [];

  for (const f of findings) {
    const key = `${baseKey}.${counter.toString().padStart(3, '0')}`;
    const replacement = buildReplacement(f.type, key, f.fullMatch);
    if (!replacement) { totalSkipped++; continue; }

    // fullMatch'in dosyada KAÇ KEZ geçtiğini say
    const occurrences = text.split(f.fullMatch).length - 1;
    if (occurrences === 0) {
      // Daha önceki bir patch bunu zaten dönüştürmüş olabilir
      totalSkipped++;
      continue;
    }
    if (occurrences > 1) {
      // Ambigous — birden çok eşleşme: ilkini değiştir, sonrakileri eski hâliyle bırak
      // (counter aynı key'i tekrar üretmesin diye sadece ilk match'i splice eder)
      totalAmbiguous++;
    }

    // İlk eşleşmeyi splice ile değiştir
    const idx = text.indexOf(f.fullMatch);
    text = text.slice(0, idx) + replacement + text.slice(idx + f.fullMatch.length);

    NEW_KEYS_TR.push(`  '${key}': ${JSON.stringify(f.text)},`);
    NEW_KEYS_EN.push(`  '${key}': ${JSON.stringify(f.text)},  // TODO: translate`);
    fileMods.push({ key, type: f.type, text: f.text });
    counter++;
    totalApplied++;
  }

  if (fileMods.length === 0) continue;

  // i18n import yoksa ekle
  if (!/from\s+['"][^'"]*services\/i18n['"]/.test(text)) {
    const importPath = relImportPath(rel);
    // İlk import statement'ın altına ekle
    text = text.replace(/^(import [^;]+;)/m, `$1\nimport { i18n } from '${importPath}';`);
  } else if (!/import\s*\{[^}]*\bi18n\b[^}]*\}\s*from\s+['"][^'"]*services\/i18n['"]/.test(text)) {
    // import { useTranslation } from '.../services/i18n'  →  import { i18n, useTranslation } from '.../services/i18n'
    text = text.replace(/import\s*\{([^}]*)\}\s*from\s+(['"][^'"]*services\/i18n['"])/, (m, named, src) => {
      const cleaned = named.split(',').map(s => s.trim()).filter(Boolean);
      if (cleaned.includes('i18n')) return m;
      cleaned.unshift('i18n');
      return `import { ${cleaned.join(', ')} } from ${src}`;
    });
  }

  filePatches[rel] = { text, mods: fileMods };
}

// ─── Çıktı ───────────────────────────────────────────────
console.log('═'.repeat(70));
console.log(`i18n Apply v2 — ${DRY ? 'DRY-RUN' : 'APPLY'}`);
console.log('═'.repeat(70));
console.log(`Dosya: ${Object.keys(filePatches).length}`);
console.log(`Uygulanan dönüşüm: ${totalApplied}`);
console.log(`Atlanan (eşleşme yok): ${totalSkipped}`);
console.log(`Çoklu eşleşme uyarısı (ilk match alındı): ${totalAmbiguous}`);
console.log('');

if (DRY) {
  let shown = 0;
  for (const [rel, p] of Object.entries(filePatches)) {
    for (const m of p.mods.slice(0, 2)) {
      console.log(`  ${rel}`);
      console.log(`    → key:  ${m.key}`);
      console.log(`    → type: ${m.type}`);
      console.log(`    → text: "${m.text}"`);
      shown++;
      if (shown >= 12) break;
    }
    if (shown >= 12) break;
  }
  console.log('\nUygula: node scripts/i18n-apply.js --apply');
  process.exit(0);
}

// ─── Gerçek yazma ────────────────────────────────────────
let modifiedFiles = 0;
for (const [rel, p] of Object.entries(filePatches)) {
  fs.writeFileSync(path.join(ROOT, rel), p.text, 'utf8');
  modifiedFiles++;
}

// locales append
if (NEW_KEYS_TR.length > 0) {
  let trText = fs.readFileSync(TR_PATH, 'utf8');
  const trMarker = '\n  // ═══ AUTO-EXTRACTED (i18n-apply v2) ═══\n';
  if (!trText.includes(trMarker.trim())) {
    trText = trText.replace(/^};\s*$/m, trMarker + NEW_KEYS_TR.join('\n') + '\n};');
  } else {
    trText = trText.replace(trMarker, trMarker + NEW_KEYS_TR.join('\n') + '\n');
  }
  fs.writeFileSync(TR_PATH, trText, 'utf8');

  let enText = fs.readFileSync(EN_PATH, 'utf8');
  const enMarker = '\n  // ═══ AUTO-EXTRACTED v2 (translate me) ═══\n';
  if (!enText.includes(enMarker.trim())) {
    enText = enText.replace(/^};\s*$/m, enMarker + NEW_KEYS_EN.join('\n') + '\n};');
  } else {
    enText = enText.replace(enMarker, enMarker + NEW_KEYS_EN.join('\n') + '\n');
  }
  fs.writeFileSync(EN_PATH, enText, 'utf8');
}

console.log(`✓ ${modifiedFiles} dosya patch'lendi`);
console.log(`✓ ${NEW_KEYS_TR.length} yeni key tr.ts + en.ts'ye eklendi`);
console.log(`\nNOT: en.ts içindeki yeni key'ler şu an TR string ile dolduruldu.`);
console.log(`Manuel veya Google Translate API ile çevirmen gerek.`);
