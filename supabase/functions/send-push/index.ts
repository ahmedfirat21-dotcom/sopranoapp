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
//   - Authorization header sadece "Bearer <anon_key>" gate'i (drive-by abuse koruması).
//   - push_tokens tablosu RLS ile korunuyor — sadece service_role okuyabilir.
//   - İleride: Firebase ID token doğrulaması + sender→target ilişki kontrolü.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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
    // Drive-by abuse gate: Authorization header zorunlu.
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse(401, { error: 'Authorization header eksik.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, { error: 'Edge function env eksik.' });
    }

    const { target_user_id, title, body, data, is_call } = await req.json();

    if (!target_user_id || !title || !body) {
      return jsonResponse(400, { error: 'target_user_id, title ve body zorunludur.' });
    }

    // Service-role client: RLS bypass ile push_tokens tablosundan okur.
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ★ v78: push_tokens tablosundan TÜM aktif cihaz token'larını çek
    const { data: tokens, error: tokensErr } = await adminClient
      .from('push_tokens')
      .select('token')
      .eq('user_id', target_user_id);

    if (tokensErr) {
      return jsonResponse(500, { error: 'Token sorgulama hatası: ' + tokensErr.message });
    }

    if (!tokens || tokens.length === 0) {
      // ★ Backward compat: push_tokens tablosu boşsa profiles.push_token'a bak
      //   Geçiş dönemi — eski client henüz push_tokens'a yazmamış olabilir.
      const { data: profile, error: profileErr } = await adminClient
        .from('profiles')
        .select('push_token')
        .eq('id', target_user_id)
        .single();

      if (profileErr || !profile?.push_token) {
        return jsonResponse(404, { error: 'Kullanıcıda push token bulunamadı.' });
      }

      // Fallback: tek token ile gönder (eski davranış)
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

      const pushResponse = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: profile.push_token,
          title,
          body,
          sound: 'default',
          data: data || {},
          ...callPayload,
        }),
      });

      const pushResult = await pushResponse.json();
      return jsonResponse(200, { success: true, result: pushResult, source: 'profiles_fallback' });
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
