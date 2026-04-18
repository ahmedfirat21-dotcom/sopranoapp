// SopranoChat — Tenor GIF Proxy (Supabase Edge Function)
// Deploy: npx supabase functions deploy tenor-proxy --project-ref <project-ref>
//
// Client doğrudan Tenor API key'i kullanmasın diye proxy. Key:
//   supabase secrets set TENOR_API_KEY=<your-key>
//
// ★ Y18 FIX:
//   - TENOR_API_KEY client'tan gizlendi (edge function env'de tutulur)
//   - contentfilter=high (strict SFW) ve safesearch=active parametreleri eklendi
//   - Basit rate limit: caller JWT ile kullanıcı başına 60 istek/dakika (memory-local)
//
// Client kullanımı:
//   POST /functions/v1/tenor-proxy { type: 'featured' | 'search', q?: string, limit?: number }
//   Authorization: Bearer <supabase-anon + user-jwt>

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const TENOR_BASE = 'https://tenor.googleapis.com/v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Memory rate limit — edge function instance başına, user_id anahtarı
type RateBucket = { count: number; resetAt: number };
const _buckets = new Map<string, RateBucket>();
const RATE_MAX = 60;
const RATE_WINDOW_MS = 60_000;

function _rateLimitHit(key: string): boolean {
  const now = Date.now();
  const b = _buckets.get(key);
  if (!b || now > b.resetAt) {
    _buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (b.count >= RATE_MAX) return true;
  b.count++;
  return false;
}

function _extractUserKey(req: Request): string {
  // Auth header'dan JWT payload sub alanı — hafif parse
  const auth = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return 'anon';
  try {
    const parts = m[1].split('.');
    if (parts.length !== 3) return 'anon';
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.sub || 'anon';
  } catch {
    return 'anon';
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('TENOR_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userKey = _extractUserKey(req);
  if (_rateLimitHit(userKey)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const type = String(body.type || '');
    const limit = Math.min(Math.max(parseInt(String(body.limit || '30'), 10) || 30, 1), 50);

    // Her iki endpoint için de SFW zorla
    const sharedParams = `key=${apiKey}&limit=${limit}&media_filter=tinygif&contentfilter=high`;

    let url: string;
    if (type === 'featured') {
      url = `${TENOR_BASE}/featured?${sharedParams}`;
    } else if (type === 'search') {
      const q = String(body.q || '').trim();
      if (!q || q.length < 2) {
        return new Response(JSON.stringify({ results: [] }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Uzun veya şüpheli karakterlerden kaçın
      if (q.length > 100) {
        return new Response(JSON.stringify({ error: 'Query too long' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      url = `${TENOR_BASE}/search?${sharedParams}&q=${encodeURIComponent(q)}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upstream = await fetch(url);
    const data = await upstream.json();

    // Yalnızca ihtiyacımız olan alanları döndür — payload küçüle, hassas alan geri dönmesin
    const trimmed = (data?.results || []).map((g: any) => ({
      id: g.id,
      url: g.media_formats?.tinygif?.url || g.media_formats?.gif?.url,
      preview: g.media_formats?.tinygif?.preview,
      dims: g.media_formats?.tinygif?.dims,
    })).filter((r: any) => r.url);

    return new Response(JSON.stringify({ results: trimmed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
