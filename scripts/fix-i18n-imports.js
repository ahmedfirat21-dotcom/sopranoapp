const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.expo', 'android', 'ios', 'web-admin', 'locales'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = ['app', 'components', 'services'].flatMap(d => walk(d));
let fixed = 0;
const wrongFiles = [];
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  if (!/from\s+'[^']*services\/i18n'/.test(src)) continue;
  const fileDir = path.dirname(f);
  const target = path.join('services', 'i18n');
  let rel = path.relative(fileDir, target);
  rel = rel.split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  const expected = "from '" + rel + "'";
  const newSrc = src.replace(/from\s+'[^']*services\/i18n'/g, expected);
  if (newSrc !== src) {
    fs.writeFileSync(f, newSrc, 'utf8');
    wrongFiles.push(f + ' → ' + rel);
    fixed++;
  }
}
console.log('Düzeltildi:', fixed);
for (const f of wrongFiles.slice(0, 20)) console.log('  ' + f);
if (wrongFiles.length > 20) console.log('  ... +' + (wrongFiles.length - 20) + ' daha');
