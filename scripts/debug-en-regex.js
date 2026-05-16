const fs = require('fs');
const src = fs.readFileSync('locales/en.ts', 'utf8');
const lines = src.split('\n');
const re = /^(\s*)'([^']+)'\s*:\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(,?)(\s*\/\/.*)?$/;
let total = 0, matched = 0, unmatched = [];
for (const ln of lines) {
  if (!ln.includes('MYMEMORY')) continue;
  total++;
  if (re.test(ln)) matched++;
  else if (unmatched.length < 5) unmatched.push(ln);
}
console.log('total MYMEMORY lines:', total);
console.log('regex matched:', matched);
console.log('unmatched samples:');
for (const u of unmatched) console.log('  ::', u.slice(0, 100));
