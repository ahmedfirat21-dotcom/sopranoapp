/**
 * SopranoChat — Türkçe Küfür / Hakaret Kelime Listesi
 * Moderasyon sistemi tarafından SADECE oda sohbetinde kullanılır (DM'de kullanılmaz)
 *
 * NOT: JavaScript'in \b word boundary'si Türkçe karakterleri (ş,ı,ç,ğ,ü,ö)
 * kelime karakteri saymaz. Bu yüzden özel Türkçe-aware boundary kullanılır.
 */

// Küfür / hakaret kelimeleri — Standart ASCII ve Türkçe karışık
export const BAD_WORDS: string[] = [
  // Ağır küfürler
  'amk', 'aq', 'amq', 'amınakoyim', 'aminakoyim', 'amına', 'amina',
  'ananı', 'anani', 'ananızı', 'ananizi',
  'orospu', 'oruspu', 'orosbu', 'orospuçocuğu', 'orospucocugu',
  'piç', 'pic', 'piçlik',
  'siktir', 'siktirgit', 'sikeyim', 'sikerim', 'sikik', 'sikiş',
  'yarrak', 'yarak', 'yarrağ',
  'götveren',
  'pezevenk', 'pezeveng',
  'gavat', 'ibne', 'götoş', 'godoş',
  'kaltak', 'kahpe', 'fahişe', 'sürtük', 'surtuk',
  'gerizekalı', 'gerizekali',
  'haysiyetsiz', 'şerefsiz', 'serefsiz', 'namussuz',
  'taşak', 'tasak', 'taşşak',
  'amcık', 'amcik',
  'ananıskim', 'ananiskim', 'ananiskm',
  'hassiktir', 'hssktr',
  'yavşak', 'yavsak',
  'puşt', 'pust',
  'dalyarak', 'dallama',
  'kodumun',
  // Kısa ağır formlar (standalone eşleşir)
  'oç', 'oc',
  'sg', 'sktir', 'sktr',
];

// Regex oluştururken özel karakterleri escape et
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Türkçe-aware kelime sınırı ile regex oluştur
// Lookbehind/lookahead kullanarak Türkçe harflerin doğru şekilde
// kelime sınırı olarak değerlendirilmesini sağlar
function buildPattern(): RegExp {
  const lookBehind = `(?<![a-zA-ZçğıöüşÇĞİÖÜŞ0-9])`;
  const lookAhead = `(?![a-zA-ZçğıöüşÇĞİÖÜŞ0-9])`;
  
  const pattern = BAD_WORDS
    .map(w => `${lookBehind}${escapeRegex(w)}${lookAhead}`)
    .join('|');
  
  return new RegExp(pattern, 'gi');
}

const badWordPattern = buildPattern();

/**
 * Küfürlü kelimeleri yıldızla değiştirir (sadece oda sohbeti için)
 * Örn: "siktir git" → "s***ir git"
 * "kamera" → "kamera" (korunur)
 * "çalışma" → "çalışma" (korunur — Türkçe boundary)
 */
export function filterBadWords(text: string): string {
  badWordPattern.lastIndex = 0;
  return text.replace(badWordPattern, (match) => {
    if (match.length <= 2) return '*'.repeat(match.length);
    return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
  });
}

/**
 * Metin içinde küfür var mı kontrol eder
 */
export function containsBadWords(text: string): boolean {
  badWordPattern.lastIndex = 0;
  return badWordPattern.test(text);
}
