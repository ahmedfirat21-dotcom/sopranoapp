/**
 * i18n Apply — i18n-scan-report.json'daki TR bulgularını otomatik dönüştürür.
 *
 * Akış:
 *   1. i18n-scan-report.json'u oku
 *   2. Her bulgu için unique key üret: auto.{dir}.{file}.{counter}
 *   3. Dosyayı patch et: TR string → `{i18n.t('key')}`
 *   4. locales/tr.ts + en.ts'ye toplu append
 *   5. import statement'ı yoksa otomatik ekle
 *
 * GÜVENLİ pattern'ler (ilk faz):
 *   - JSX Text node:           <Text>TR</Text>  →  <Text>{i18n.t('key')}</Text>
 *   - placeholder attribute:   placeholder="TR" →  placeholder={i18n.t('key')}
 *
 * RİSKLİ pattern'ler (atlanır, manuel kalır):
 *   - label/title/desc/message prop (object property context — toast/alert
 *     karışıyor, manual değerlendirilmeli)
 *
 * Mod:
 *   node scripts/i18n-apply.js --dry      → değişiklikleri sadece bildirir
 *   node scripts/i18n-apply.js --apply    → gerçek patch
 *   node scripts/i18n-apply.js --apply --file=path/to/file.tsx  → tek dosya
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARGV = process.argv.slice(2);
const APPLY = ARGV.includes('--apply');
const DRY = ARGV.includes('--dry') || !APPLY;
const FILE_FILTER = (ARGV.find(a => a.startsWith('--file=')) || '').slice('--file='.length);

const REPORT_PATH = path.join(ROOT, 'i18n-scan-report.json');
const TR_PATH = path.join(ROOT, 'locales/tr.ts');
const EN_PATH = path.join(ROOT, 'locales/en.ts');

if (!fs.existsSync(REPORT_PATH)) {
  console.error('Önce: node scripts/i18n-scan.js');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

// ─── Sadece bu pattern'leri uygula (güvenli) ────────────
const SAFE_TYPES = new Set(['JSX Text', 'placeholder']);

// ─── Key generation ─────────────────────────────────────
function fileToKeyBase(rel) {
  // 'components/room/RoomGiftPanel.tsx' → 'room.roomgiftpanel'
  const noExt = rel.replace(/\.(tsx?|jsx?)$/, '');
  const parts = noExt.split('/').filter(p => p !== 'components' && p !== 'app');
  return parts.map(p => p.toLowerCase().replace(/[^a-z0-9]/g, '')).join('.');
}

// ─── tr.ts + en.ts append blok hazırla ──────────────────
const NEW_KEYS_TR = [];
const NEW_KEYS_EN = [];

// ─── Her dosya için patch hazırla ───────────────────────
const filePatches = {};
let totalApplied = 0;
let totalSkipped = 0;

for (const [rel, findings] of Object.entries(report.byFile)) {
  if (FILE_FILTER && !rel.includes(FILE_FILTER)) continue;

  const baseKey = fileToKeyBase(rel);
  const fullPath = path.join(ROOT, rel);
  if (!fs.existsSync(fullPath)) continue;

  let text = fs.readFileSync(fullPath, 'utf8');
  const originalText = text;

  // Mevcut auto.* key sayısı (counter offset için)
  let counter = 1;

  // Her bulgu için key + replace
  const fileMods = [];

  for (const f of findings) {
    if (!SAFE_TYPES.has(f.type)) {
      totalSkipped++;
      continue;
    }

    const trStr = f.text;
    if (!trStr) { totalSkipped++; continue; }

    // Unique key — counter dosya başına artar
    const key = `${baseKey}.${counter.toString().padStart(3, '0')}`;
    counter++;

    // Replacement — pattern türüne göre
    let oldNeedle, newNeedle;

    if (f.type === 'JSX Text') {
      // <Tag>TR</Tag>  — text node arasında
      // İçeride boşluk olabilir, escape edilmiş chars olabilir
      const escaped = trStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Tag içeriği = TR string (whitespace dahil olabilir)
      const re = new RegExp(`(>)([^<]*?${escaped}[^<]*?)(<\\/(?:Text|Title|Heading|Label)>)`, 'g');
      let matched = false;
      text = text.replace(re, (m, open, content, close) => {
        if (matched) return m; // sadece ilk eşleşme
        if (content.trim() !== trStr) return m; // exact match
        matched = true;
        oldNeedle = m;
        newNeedle = `${open}{i18n.t('${key}')}${close}`;
        return newNeedle;
      });
      if (!matched) {
        // Tekrar dene — multiline content için
        const reMulti = new RegExp(`>\\s*(${escaped})\\s*<`, 'g');
        text = text.replace(reMulti, (m, captured) => {
          if (matched) return m;
          matched = true;
          oldNeedle = m;
          newNeedle = `>{i18n.t('${key}')}<`;
          return newNeedle;
        });
      }
      if (matched) {
        NEW_KEYS_TR.push(`  '${key}': ${JSON.stringify(trStr)},`);
        NEW_KEYS_EN.push(`  '${key}': ${JSON.stringify(trStr)},  // TODO: translate`);
        fileMods.push({ key, type: f.type, text: trStr });
        totalApplied++;
      } else {
        totalSkipped++;
      }
    } else if (f.type === 'placeholder') {
      const escaped = trStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`placeholder=["']${escaped}["']`, 'g');
      let matched = false;
      text = text.replace(re, (m) => {
        if (matched) return m;
        matched = true;
        return `placeholder={i18n.t('${key}')}`;
      });
      if (matched) {
        NEW_KEYS_TR.push(`  '${key}': ${JSON.stringify(trStr)},`);
        NEW_KEYS_EN.push(`  '${key}': ${JSON.stringify(trStr)},  // TODO: translate`);
        fileMods.push({ key, type: f.type, text: trStr });
        totalApplied++;
      } else {
        totalSkipped++;
      }
    }
  }

  if (fileMods.length === 0) continue;

  // Import statement var mı?
  const hasImport = /from ['"][^'"]*services\/i18n['"]/.test(text);
  if (!hasImport) {
    // import { i18n } from '<relative>/services/i18n' ekle
    const depth = rel.split('/').length - 1;
    const prefix = '../'.repeat(depth - (rel.startsWith('app/') ? 0 : 0)) || './';
    // app/foo.tsx için: ../services/i18n
    // app/foo/bar.tsx için: ../../services/i18n
    // components/foo.tsx için: ../services/i18n
    let rel2 = '';
    if (rel.startsWith('app/')) {
      const parts = rel.split('/');
      rel2 = '../'.repeat(parts.length - 1) + 'services/i18n';
    } else if (rel.startsWith('components/')) {
      const parts = rel.split('/');
      rel2 = '../'.repeat(parts.length - 1) + 'services/i18n';
    } else {
      rel2 = '../services/i18n';
    }
    // İlk import satırının altına ekle
    text = text.replace(/^(import [^;]+;)/m, `$1\nimport { i18n } from '${rel2}';`);
  }

  filePatches[rel] = { text, originalLength: originalText.length, newLength: text.length, mods: fileMods };
}

// ─── Sonuç ────────────────────────────────────────────────
console.log('═'.repeat(70));
console.log(`i18n Apply — ${DRY ? 'DRY-RUN' : 'APPLY'} mode`);
console.log('═'.repeat(70));
console.log(`Dosya: ${Object.keys(filePatches).length}`);
console.log(`Uygulanan dönüşüm: ${totalApplied}`);
console.log(`Atlanan (risky / matched değil): ${totalSkipped}`);
console.log('');

if (DRY) {
  console.log('İlk 10 örnek değişiklik:');
  console.log('─'.repeat(70));
  let shown = 0;
  for (const [rel, p] of Object.entries(filePatches)) {
    for (const m of p.mods.slice(0, 3)) {
      console.log(`  ${rel}`);
      console.log(`    → key: ${m.key}`);
      console.log(`    → text: "${m.text}"`);
      shown++;
      if (shown >= 10) break;
    }
    if (shown >= 10) break;
  }
  console.log('');
  console.log('Uygulamak için: node scripts/i18n-apply.js --apply');
  process.exit(0);
}

// ─── Gerçek patch ─────────────────────────────────────────
let modifiedFiles = 0;
for (const [rel, p] of Object.entries(filePatches)) {
  fs.writeFileSync(path.join(ROOT, rel), p.text, 'utf8');
  modifiedFiles++;
}

// locales/tr.ts ve en.ts'ye append
if (NEW_KEYS_TR.length > 0) {
  let trText = fs.readFileSync(TR_PATH, 'utf8');
  const trMarker = '\n  // ═══ AUTO-EXTRACTED (i18n-apply.js) ═══\n';
  if (!trText.includes(trMarker)) {
    trText = trText.replace(/^};\s*$/m, trMarker + NEW_KEYS_TR.join('\n') + '\n};');
  } else {
    trText = trText.replace(trMarker, trMarker + NEW_KEYS_TR.join('\n') + '\n');
  }
  fs.writeFileSync(TR_PATH, trText, 'utf8');

  let enText = fs.readFileSync(EN_PATH, 'utf8');
  const enMarker = '\n  // ═══ AUTO-EXTRACTED (translate me) ═══\n';
  if (!enText.includes(enMarker)) {
    enText = enText.replace(/^};\s*$/m, enMarker + NEW_KEYS_EN.join('\n') + '\n};');
  } else {
    enText = enText.replace(enMarker, enMarker + NEW_KEYS_EN.join('\n') + '\n');
  }
  fs.writeFileSync(EN_PATH, enText, 'utf8');
}

console.log(`✓ ${modifiedFiles} dosya patch'lendi`);
console.log(`✓ ${NEW_KEYS_TR.length} yeni key tr.ts + en.ts'ye eklendi`);
console.log('');
console.log('NOT: en.ts içindeki yeni key\'ler TR string ile dolduruldu (// TODO: translate).');
console.log('Sonraki adım: en.ts\'de "AUTO-EXTRACTED" bölümünü manuel çevir veya Google Translate API ile batch çevir.');
