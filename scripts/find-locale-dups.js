// Find duplicate keys in locale files
const fs = require('fs');

['locales/tr.ts', 'locales/en.ts'].forEach(file => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const keys = {};
  
  lines.forEach((line, idx) => {
    // Match keys like 'key.name': or "key.name":
    const m = line.match(/^\s*['"]([^'"]+)['"]\s*:/);
    if (m) {
      const key = m[1];
      if (!keys[key]) keys[key] = [];
      keys[key].push({ line: idx + 1, content: line.trim() });
    }
  });
  
  const dups = Object.entries(keys).filter(([, v]) => v.length > 1);
  
  if (dups.length === 0) {
    console.log(`\n=== ${file}: NO DUPLICATES ===`);
    return;
  }
  
  console.log(`\n=== ${file}: ${dups.length} DUPLICATE KEYS ===`);
  dups.forEach(([key, entries]) => {
    console.log(`\nKEY: ${key} (${entries.length} occurrences)`);
    entries.forEach((e, i) => {
      console.log(`  [${i+1}] Line ${e.line}: ${e.content}`);
    });
  });
});
