const fs = require('fs');
const src = fs.readFileSync('locales/en.ts', 'utf8');
const lines = src.split('\n');
for (const ln of lines) {
  if (!ln.includes('MYMEMORY')) continue;
  const codes = [];
  for (let i = Math.max(0, ln.length - 6); i < ln.length; i++) codes.push(ln.charCodeAt(i));
  console.log('len=' + ln.length, 'last codes:', codes.join(','), '| first 50:', ln.slice(0, 50));
  break;
}
