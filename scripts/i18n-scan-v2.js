/**
 * i18n Scan v2 — agresif tarayıcı
 * ════════════════════════════════════════════════════════════════════
 * v1 (i18n-scan.js) JSX text + bazı prop pattern'leri yakalıyordu ama
 * şu pattern'leri kaçırdı:
 *   - Template literal: `${x} arşivlendi`
 *   - accessibilityLabel + onPress ternary stringleri
 *   - Object literal değerleri: `label: 'Sesli Ara'`
 *   - Toast title/message values
 *   - Alert text: '...' button items
 *
 * v2 yaklaşım: Babel parser ile AST üzerinden YÜRÜ. Tüm StringLiteral +
 * TemplateLiteral node'larında TR karakter ara. Comment/import/console.X
 * ve i18n.t() çağrılarını skip et.
 *
 * Çıktı: i18n-scan-v2-report.json
 *   { file, line, col, kind: 'string'|'template', value, raw, context }
 *
 * Kullanım:
 *   node scripts/i18n-scan-v2.js          → tara, rapor yaz
 *   node scripts/i18n-scan-v2.js --apply  → otomatik replace (key üret + locales/tr.ts ekle)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');

// Babel parser
let parser, traverse;
try {
  parser = require('@babel/parser');
  traverse = require('@babel/traverse').default;
} catch (e) {
  console.error('@babel/parser veya @babel/traverse yüklü değil. npm i -D @babel/parser @babel/traverse');
  process.exit(1);
}

// ─── Tarama hedefi ──────────────────────────────────────────
const SCAN_DIRS = ['app', 'components', 'services'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.expo', 'android', 'ios', 'web-admin', 'locales']);
const EXT = /\.(tsx|ts)$/;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (EXT.test(e.name)) out.push(full);
  }
  return out;
}

// ─── Yardımcı: TR karakter detect ────────────────────────────
const TR_RE = /[ışğüöçŞĞÇİÖÜ]/;

function hasTurkish(s) {
  if (!s || typeof s !== 'string') return false;
  return TR_RE.test(s);
}

// ─── Context filtering ──────────────────────────────────────
// Skip patterns (import, type, key in object that's "name" etc.)
function shouldSkipNode(path) {
  const p = path.node;
  // Skip if parent is ImportDeclaration / TSTypeReference
  let cur = path.parentPath;
  while (cur) {
    const t = cur.node?.type;
    if (t === 'ImportDeclaration' || t === 'ExportNamedDeclaration' && cur.node.source) return true;
    if (t === 'TSLiteralType') return true;
    if (t === 'TSEnumMember') return true;
    cur = cur.parentPath;
  }
  return false;
}

// Skip if value is just a short identifier like 'iç', 'şu' (no, keep)
// Skip if inside i18n.t() call (already translated)
function insideI18nCall(path) {
  let cur = path.parentPath;
  while (cur) {
    const n = cur.node;
    if (n?.type === 'CallExpression') {
      const callee = n.callee;
      if (callee?.type === 'MemberExpression' &&
          callee.object?.name === 'i18n' &&
          callee.property?.name === 't') return true;
      if (callee?.type === 'Identifier' && callee.name === 't' &&
          cur.node.arguments?.[0] === path.node) return true;
    }
    cur = cur.parentPath;
  }
  return false;
}

// Skip if inside console.* call
function insideConsole(path) {
  let cur = path.parentPath;
  while (cur) {
    const n = cur.node;
    if (n?.type === 'CallExpression' && n.callee?.type === 'MemberExpression' &&
        n.callee.object?.name === 'console') return true;
    cur = cur.parentPath;
  }
  return false;
}

// Skip if inside __DEV__ block (debug-only)
function insideDevBlock(path) {
  let cur = path.parentPath;
  while (cur) {
    const n = cur.node;
    if (n?.type === 'IfStatement' && n.test?.name === '__DEV__') return true;
    if (n?.type === 'LogicalExpression' && n.left?.name === '__DEV__') return true;
    cur = cur.parentPath;
  }
  return false;
}

// ─── Tara ─────────────────────────────────────────────────────
const results = [];
const dirs = SCAN_DIRS.map(d => path.join(ROOT, d));
const files = dirs.flatMap(d => walk(d));

console.log(`Tarama: ${files.length} dosya`);

for (const file of files) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
  if (!hasTurkish(src)) continue;

  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'optionalChaining', 'nullishCoalescingOperator', 'classProperties', 'objectRestSpread'],
      errorRecovery: true,
    });
  } catch (e) {
    console.warn(`PARSE FAIL: ${file}: ${e.message}`);
    continue;
  }

  const rel = path.relative(ROOT, file);

  traverse(ast, {
    StringLiteral(path) {
      if (shouldSkipNode(path) || insideI18nCall(path) || insideConsole(path) || insideDevBlock(path)) return;
      const v = path.node.value;
      if (!hasTurkish(v)) return;
      // Skip property keys (we want values, not keys)
      if (path.parentPath.node?.type === 'ObjectProperty' && path.parentPath.node.key === path.node && !path.parentPath.node.computed) return;
      // Skip import source
      if (path.parentPath.node?.type === 'ImportDeclaration') return;
      results.push({
        file: rel,
        line: path.node.loc?.start.line,
        col: path.node.loc?.start.column,
        kind: 'string',
        value: v,
        raw: src.slice(path.node.start, path.node.end),
      });
    },
    TemplateLiteral(path) {
      if (shouldSkipNode(path) || insideI18nCall(path) || insideConsole(path) || insideDevBlock(path)) return;
      // Construct concatenated value (preserves order)
      const parts = [];
      const exprs = [];
      for (let i = 0; i < path.node.quasis.length; i++) {
        parts.push(path.node.quasis[i].value.cooked);
        if (i < path.node.expressions.length) {
          parts.push('${' + (i) + '}');
          exprs.push(src.slice(path.node.expressions[i].start, path.node.expressions[i].end));
        }
      }
      const merged = parts.join('');
      if (!hasTurkish(merged)) return;
      results.push({
        file: rel,
        line: path.node.loc?.start.line,
        col: path.node.loc?.start.column,
        kind: 'template',
        value: merged,
        expressions: exprs,
        raw: src.slice(path.node.start, path.node.end),
      });
    },
    JSXText(path) {
      const v = path.node.value.trim();
      if (!hasTurkish(v)) return;
      results.push({
        file: rel,
        line: path.node.loc?.start.line,
        col: path.node.loc?.start.column,
        kind: 'jsx_text',
        value: v,
        raw: path.node.value,
      });
    },
  });
}

console.log(`Bulunan: ${results.length} satır`);
const byFile = {};
for (const r of results) {
  byFile[r.file] = (byFile[r.file] || 0) + 1;
}
const sorted = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
console.log('Top dosyalar:');
for (const [f, n] of sorted.slice(0, 15)) console.log(`  ${n.toString().padStart(4)} ${f}`);

fs.writeFileSync(path.join(ROOT, 'i18n-scan-v2-report.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('Rapor: i18n-scan-v2-report.json');
