// SopranoChat — Room Recording Egress (Faz 6.2)
// ═══════════════════════════════════════════════════
// LiveKit Egress API ile oda audio kaydını başlatır/durdurur.
// MEVCUT LİVEKİT BAĞLANTISINA DOKUNMAZ — ayrı Server SDK call'u, sadece
// Hetzner LiveKit'in egress modülünden fayda alır.
//
// Deploy:
//   npx supabase functions deploy room-egress --project-ref kpofiuczyjesjlqjxswh
//
// Action: 'start' veya 'stop'
//   POST /room-egress { action: 'start', room_id, host_id }
//   POST /room-egress { action: 'stop',  room_id, host_id, egress_id }
//
// Gerekli env (Functions secrets):
//   LIVEKIT_URL          → wss://<hetzner-ip>:7880  (token fonksiyonuyla aynı)
//   LIVEKIT_API_KEY      → APIxxxxxxxxxx           (token fonksiyonuyla aynı)
//   LIVEKIT_API_SECRET   → secret                  (token fonksiyonuyla aynı)
//   EGRESS_BUCKET        → 'room-recordings'        (Supabase Storage public bucket; manuel yarat)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   → Supabase otomatik enjekte
//
// ÖNEMLİ — Hetzner LiveKit Egress modülü:
//   Self-hosted LiveKit'te egress ayrı bir Docker container olarak çalışır.
//   Eğer henüz kurulmadıysa: https://docs.livekit.io/realtime/egress/deployment/
//   Egress container'ı livekit server'a bağlanır, kayıt streamlerini fileSystem
//   veya S3-compatible storage'a yazar. Supabase Storage S3-compatible'tır.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { EgressClient, EncodedFileType, EncodedFileOutput, S3Upload } from 'npm:livekit-server-sdk@2.6.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL');
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY');
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET');
    const EGRESS_BUCKET = Deno.env.get('EGRESS_BUCKET') || 'room-recordings';

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'LiveKit env config eksik.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json();
    const { action, room_id, egress_id } = body as {
      action: 'start' | 'stop';
      room_id: string;
      egress_id?: string;
    };

    if (!action || !room_id) {
      return new Response(
        JSON.stringify({ error: 'action, room_id zorunlu.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ★ v1.7.13.137 SECURITY FIX: host_id artık body'den DEĞİL, JWT'den çekilir.
    //   Önceden saldırgan başkasının host_id'sini body'de gönderebilirdi.
    //   Şimdi caller JWT sub claim'i extract → o user host_id olup olmadığı kontrol.
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization header gerekli.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.slice(7);
    let callerUid: string | null = null;
    try {
      // JWT payload'ından sub claim çek (verify_jwt=true ile Supabase zaten verify etmiş)
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('invalid jwt');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      callerUid = payload.sub || payload.user_id || null;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Geçersiz JWT.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!callerUid) {
      return new Response(
        JSON.stringify({ error: 'JWT sub bulunamadı.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Auth — caller bu odanın host'u olmalı ──
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: room } = await sb
      .from('rooms')
      .select('id, host_id, name')
      .eq('id', room_id)
      .maybeSingle();

    if (!room) {
      return new Response(
        JSON.stringify({ error: 'Oda bulunamadı.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (room.host_id !== callerUid) {
      return new Response(
        JSON.stringify({ error: 'Sadece oda sahibi kayıt başlatabilir.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const host_id = callerUid;

    // ── LiveKit Egress client ──
    const egress = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    if (action === 'start') {
      const filename = `${room_id}/${Date.now()}.mp4`;

      // Supabase Storage S3-compatible endpoint için S3Upload kullanılır.
      // Bucket Supabase Studio'dan public yaratılmalı: 'room-recordings'.
      // Storage S3 endpoint: https://<project>.supabase.co/storage/v1/s3
      // Access key: storage S3 access key (Storage settings'ten oluşturulur)
      const STORAGE_S3_ENDPOINT = `${SUPABASE_URL}/storage/v1/s3`;
      const STORAGE_S3_ACCESS_KEY = Deno.env.get('STORAGE_S3_ACCESS_KEY') || '';
      const STORAGE_S3_SECRET_KEY = Deno.env.get('STORAGE_S3_SECRET_KEY') || '';
      const STORAGE_S3_REGION = Deno.env.get('STORAGE_S3_REGION') || 'us-east-1';

      const fileOutput = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: filename,
        output: {
          case: 's3',
          value: new S3Upload({
            accessKey: STORAGE_S3_ACCESS_KEY,
            secret: STORAGE_S3_SECRET_KEY,
            region: STORAGE_S3_REGION,
            bucket: EGRESS_BUCKET,
            endpoint: STORAGE_S3_ENDPOINT,
            forcePathStyle: true,
          }),
        },
      });

      // Audio-only egress: room composite, sadece audio mix
      const info = await egress.startRoomCompositeEgress(
        room_id,
        { file: fileOutput },
        { audioOnly: true, layout: 'speaker' }
      );

      return new Response(
        JSON.stringify({
          ok: true,
          egress_id: info.egressId,
          status: info.status,
          filename,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'stop') {
      if (!egress_id) {
        return new Response(
          JSON.stringify({ error: 'egress_id zorunlu (stop).' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const info = await egress.stopEgress(egress_id);

      // Egress webhook (room-egress-webhook) durumu yakalar ve room_recordings INSERT eder.
      // Burada sadece stop confirmation döner.
      return new Response(
        JSON.stringify({ ok: true, egress_id: info.egressId, status: info.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'action invalid: start|stop' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[room-egress] error:', e?.message);
    return new Response(
      JSON.stringify({ error: e?.message || 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
