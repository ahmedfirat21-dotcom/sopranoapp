// SopranoChat — LiveKit Server Webhook (Faz 6.2)
// ═══════════════════════════════════════════════════
// LiveKit server webhook'larını alır. Şu an sadece egress-completed
// olayını dinler ve room_recordings tablosuna meta yazar.
//
// LiveKit Cloud panelindeki webhook URL'i:
//   https://kpofiuczyjesjlqjxswh.supabase.co/functions/v1/livekit-webhook
//
// Deploy:
//   npx supabase functions deploy livekit-webhook --project-ref kpofiuczyjesjlqjxswh
//
// HMAC doğrulama: LiveKit webhook gövdesini API_SECRET ile imzalar.
// "Authorization: <signature>" header'ı kontrol edilir (security baseline).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { WebhookReceiver } from 'npm:livekit-server-sdk@2.6.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY');
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const EGRESS_BUCKET = Deno.env.get('EGRESS_BUCKET') || 'room-recordings';

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response('config missing', { status: 500, headers: corsHeaders });
    }

    const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const authHeader = req.headers.get('Authorization') || '';
    const rawBody = await req.text();

    // HMAC doğrulama — saldırgan random POST atarsa reddedilir
    let event: any;
    try {
      event = await receiver.receive(rawBody, authHeader);
    } catch (e: any) {
      console.warn('[livekit-webhook] HMAC fail:', e?.message);
      return new Response('invalid signature', { status: 401, headers: corsHeaders });
    }

    // Sadece egress completed event'leri umurumuzda
    if (event.event !== 'egress_ended') {
      return new Response('ignored', { headers: corsHeaders });
    }

    const egressInfo = event.egressInfo;
    if (!egressInfo) {
      return new Response('no egress info', { headers: corsHeaders });
    }

    const roomId: string = egressInfo.roomName;
    const fileResults = egressInfo.fileResults || [];
    if (fileResults.length === 0) {
      return new Response('no file', { headers: corsHeaders });
    }

    const file = fileResults[0];
    const filename: string = file.filename;
    const durationMs = Number(egressInfo.duration || 0);
    const durationSeconds = Math.max(1, Math.floor(durationMs / 1000));

    // Public URL — Supabase Storage:
    //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const audioUrl = `${SUPABASE_URL}/storage/v1/object/public/${EGRESS_BUCKET}/${filename}`;

    // TTL: tier'a göre. Şimdilik 30 gün default — host_id query'siyle tier okunup
    // geliştirilebilir. v68 RecordingService TTL hesabı client tarafında.
    const ttlDays = 30;
    const expiresAt = new Date(Date.now() + ttlDays * 86400_000).toISOString();

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await sb.from('room_recordings').insert({
      room_id: roomId,
      audio_url: audioUrl,
      duration_seconds: durationSeconds,
      expires_at: expiresAt,
      is_public: true,
    });

    if (error) {
      console.error('[livekit-webhook] DB insert fail:', error.message);
      return new Response('db error', { status: 500, headers: corsHeaders });
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (e: any) {
    console.error('[livekit-webhook] error:', e?.message);
    return new Response('error', { status: 500, headers: corsHeaders });
  }
});
