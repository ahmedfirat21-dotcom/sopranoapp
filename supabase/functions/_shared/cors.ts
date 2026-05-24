// ★ v1.7.13.138 (21 May 2026): CORS whitelist — wildcard yerine domain liste.
// Edge functions yalnızca SopranoChat origin'lerinden çağrılabilir.
// Mobile (React Native) → "null" veya origin yok (whitelist'e dahil).
// Web admin (Vercel) → sopranochat.com / sopranochatnorolji.vercel.app
// Localhost dev → 19000-19999 (Expo), 3000 (Next.js)

const ALLOWED_ORIGINS = new Set<string>([
  'https://sopranochat.com',
  'https://www.sopranochat.com',
  'https://sopranochatnorolji.vercel.app',
  'http://localhost:3000',
  'http://localhost:19006',
  'http://localhost:8081',
]);

const LOCALHOST_RE = /^http:\/\/localhost:(190[0-9]{2}|3000|8081)$/;

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  // React Native: Origin header yok veya 'null' → wildcard izinli (RN HTTP stack)
  // Web: whitelist'te değilse origin yansıtma (browser blokler)
  const allowOrigin =
    !origin || origin === 'null' ? '*' :
    ALLOWED_ORIGINS.has(origin) || LOCALHOST_RE.test(origin) ? origin :
    'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}
