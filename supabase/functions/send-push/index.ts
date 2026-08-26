// SopranoChat — Push Notification Sender (Supabase Edge Function)
// Deploy: npx supabase functions deploy send-push --project-ref kpofiuczyjesjlqjxswh
//
// ★ Mimari (v78 sonrası):
//   - push_tokens tablosu: kullanıcı başına N cihaz token'ı
//   - Bu edge function service_role ile push_tokens'tan okur, Expo Push API'a forward eder
//   - Multi-device: Bir kullanıcının TÜM aktif cihazlarına push gönderilir
//   - profiles.push_token kolonu deprecated (v78 migration ile taşındı)
//
// ★ Güvenlik:
//   - Authorization header Firebase JWT olarak Google JWKS ile doğrulanır.
//   - push_tokens tablosu RLS ile korunuyor — sadece service_role okuyabilir.
//   - Firebase project audience/issuer + actor identity eşleşmesi zorunlu.
//
// ★ v284 (16 May 2026): Status code politikası — beklenen "boş hedef" durumları
//   (token yok, izin verilmemiş) 200 + skipped döndürür. Bu sayede client tarafında
//   "non-2xx status" hata logu spam etmez. Yalnızca gerçek runtime hatalar 5xx kalır.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.10.0';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FIREBASE_PROJECT_ID = 'sopranochat-5738e';
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const ALLOWED_PUSH_TYPES = new Set([
  'dm', 'message_request', 'follow', 'follow_request', 'follow_accepted',
  'gift', 'room_invite', 'room_live', 'room_follow', 'event_reminder',
  'missed_call', 'incoming_call',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Firebase third-party JWT is not accepted by the Edge gateway's legacy
    // verify_jwt check. Validate it here against Google's signed JWKS instead.
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse(401, { error: 'Authorization header eksik.' });
    }
    const token = authHeader.slice(7).trim();
    let actorUserId = '';
    try {
      const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: FIREBASE_ISSUER,
        audience: FIREBASE_PROJECT_ID,
      });
      actorUserId = typeof payload.sub === 'string' ? payload.sub : '';
    } catch {
      return jsonResponse(401, { error: 'Geçersiz Firebase oturumu.' });
    }
    if (!actorUserId) return jsonResponse(401, { error: 'Kullanıcı kimliği bulunamadı.' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, { error: 'Edge function env eksik.' });
    }

    const { target_user_id, title, body, data, is_call, actor_user_id } = await req.json();

    if (!target_user_id || !title || !body) {
      return jsonResponse(400, { error: 'target_user_id, title ve body zorunludur.' });
    }
    // v1.7.13.153 and older clients do not send actor_user_id yet. Their signed
    // JWT subject remains authoritative; newer clients get an extra mismatch check.
    if (actor_user_id && actor_user_id !== actorUserId) {
      return jsonResponse(403, { error: 'Gönderen kimliği eşleşmiyor.' });
    }
    const pushType = data?.type;
    if (!pushType || !ALLOWED_PUSH_TYPES.has(pushType)) {
      return jsonResponse(400, { error: 'Desteklenmeyen bildirim türü.' });
    }
    if (String(title).length > 120 || String(body).length > 500) {
      return jsonResponse(400, { error: 'Bildirim içeriği çok uzun.' });
    }

    // Service-role client: RLS bypass ile push_tokens tablosundan okur.
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: actorProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('id', actorUserId)
      .maybeSingle();
    if (!actorProfile) return jsonResponse(403, { error: 'Gönderen profili bulunamadı.' });

    // ★ v78: push_tokens tablosundan TÜM aktif cihaz token'larını çek
    const { data: tokens, error: tokensErr } = await adminClient
      .from('push_tokens')
      .select('token')
      .eq('user_id', target_user_id);

    if (tokensErr) {
      return jsonResponse(500, { error: 'Token sorgulama hatası: ' + tokensErr.message });
    }

    if (!tokens || tokens.length === 0) {
      // ★ v284: Token yok = beklenen durum (kullanıcı uygulamayı açmamış / izin
      //   vermemiş). Client tarafı "fail" log'u atmasın diye 200 + skipped döndür.
      return jsonResponse(200, { success: true, skipped: 'no_token', devices: 0 });
    }

    // ★ Multi-device: Tüm cihazlara paralel push gönder
    const callPayload = is_call
      ? {
          priority: 'high',
          channelId: 'calls',
          ttl: 0,
          _contentAvailable: true,
          interruptionLevel: 'timeSensitive',
          sticky: true,
          categoryId: 'incoming_call',
        }
      : {};

    // Expo Push API batch endpoint: tek request'te birden fazla token
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      title,
      body,
      sound: 'default',
      data: data || {},
      ...callPayload,
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    // ★ v284: Expo API'dan non-2xx geldiyse hatayı 200 + error_detail ile döndür
    //   (client console'u temiz kalır, ama detay loglanabilir).
    if (!pushResponse.ok) {
      const errText = await pushResponse.text().catch(() => 'unknown');
      return jsonResponse(200, {
        success: false,
        expo_status: pushResponse.status,
        expo_error: errText.slice(0, 500),
        devices: tokens.length,
      });
    }

    const pushResult = await pushResponse.json();

    // ★ Stale token temizliği: Expo "DeviceNotRegistered" döndüyse token'ı sil
    if (pushResult?.data && Array.isArray(pushResult.data)) {
      const staleTokens: string[] = [];
      pushResult.data.forEach((ticket: any, idx: number) => {
        if (
          ticket?.status === 'error' &&
          ticket?.details?.error === 'DeviceNotRegistered' &&
          tokens[idx]
        ) {
          staleTokens.push(tokens[idx].token);
        }
      });

      if (staleTokens.length > 0) {
        // Arka planda temizle — response'u bekletme
        adminClient
          .from('push_tokens')
          .delete()
          .eq('user_id', target_user_id)
          .in('token', staleTokens)
          .then(({ error }) => {
            if (error) console.warn('[send-push] Stale token temizleme hatası:', error.message);
            else console.log(`[send-push] ${staleTokens.length} stale token temizlendi.`);
          });
      }
    }

    return jsonResponse(200, {
      success: true,
      devices: tokens.length,
      result: pushResult,
    });
  } catch (err: any) {
    return jsonResponse(500, { error: err?.message ?? 'unknown' });
  }
});
