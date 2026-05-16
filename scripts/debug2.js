const ln = `  'auth.onboarding.001': "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  18 HOURS 46 MINUTES 32 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE",  // translated`;

const re1 = /^(\s*)'([^']+)':\s*"[^"]*"(.*)$/;
console.log('re1 simple:', re1.test(ln));

const re2 = /^(\s*)'([^']+)'\s*:\s*"(?:[^"\\]|\\.)*"/;
console.log('re2 strict:', re2.test(ln));

const re3 = /^(\s*)'([^']+)'\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')(,?)(\s*\/\/.*)?$/;
console.log('re3 anchored:', re3.test(ln));

// Try matching without anchor:
const re4 = /'([^']+)'\s*:\s*"(?:[^"\\]|\\.)*"/;
const m = ln.match(re4);
console.log('re4 unanchored:', !!m, m && m[0].length, 'vs line length', ln.length);

// Check line ending — \r?
console.log('last 4 char codes:', ln.charCodeAt(ln.length - 4), ln.charCodeAt(ln.length - 3), ln.charCodeAt(ln.length - 2), ln.charCodeAt(ln.length - 1));
