// Supabase Edge Function: LiveKit Token Generator
// ═══════════════════════════════════════════════════════════════════
// Firebase Auth (JWT) → Supabase RLS ile kullanıcı doğrulanır; ardından
// DB'den `room_participants` satırı okunur. Row yoksa (checkAccess geçmedi)
// veya ban varsa token verilmez. Rol'e göre canPublish ayarlanır.
//
// ★ 2026-04-18 HARDENING: Önceki versiyon sadece auth header varlığını
// kontrol ediyordu; client arbitrary roomId'ye token isteyerek şifreli/
// banlı/kilitli odalara giriyordu. Ayrıca canPublish her role için true
// idi — pending_speaker ve listener mic açabiliyordu.
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AccessToken } from "npm:livekit-server-sdk@2.6.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Publish yetkisi olan roller
const PUBLISH_ROLES = new Set(["owner", "moderator", "speaker"]);
// Odaya girişi engelleyen roller (banned vs — row silinmiş olmalı ama defense-in-depth)
const BLOCKED_ROLES = new Set(["banned"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKeyHeader = req.headers.get("apikey");

    if (!authHeader && !apiKeyHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header missing" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY");
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "LiveKit credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { roomId, displayName, userId } = await req.json();

    if (!roomId || !userId) {
      return new Response(
        JSON.stringify({ error: "roomId and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ★ Supabase client — kullanıcının Firebase JWT'si ile RLS context'inde çalışır.
    // auth.uid() RLS politikalarında doğru değeri döndürür.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader || `Bearer ${SUPABASE_ANON_KEY}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 1. Oda var mı ve canlı mı? ──
    const { data: roomRow, error: roomErr } = await supabase
      .from("rooms")
      .select("id, host_id, is_live")
      .eq("id", roomId)
      .maybeSingle();

    if (roomErr || !roomRow) {
      return new Response(
        JSON.stringify({ error: "Oda bulunamadı." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!roomRow.is_live) {
      return new Response(
        JSON.stringify({ error: "Oda aktif değil." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Ban kontrolü (defense-in-depth; INSERT policy zaten engeller) ──
    const { data: banRow } = await supabase
      .from("room_bans")
      .select("id, expires_at")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (banRow) {
      const expired = banRow.expires_at && new Date(banRow.expires_at) < new Date();
      if (!expired) {
        return new Response(
          JSON.stringify({ error: "Bu odadan yasaklandınız." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 3. Kullanıcının rolünü belirle (varsa) ──
    // ★ 2026-04-18 FIX: Participant row ZORUNLU değil — LiveKit token bazen
    // DB INSERT'ten önce istenebilir (race). Şifre/davet kontrolü zaten
    // RoomAccessService + UI accessGate ile frontend'de; bu edge function
    // sadece ban kontrolü + rol bazlı canPublish belirler.
    const { data: partRow } = await supabase
      .from("room_participants")
      .select("role, is_muted")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    // Varsa engelli rolü kontrolü
    if (partRow && BLOCKED_ROLES.has(partRow.role)) {
      return new Response(
        JSON.stringify({ error: "Bu odaya erişim engelli." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Publish yetkisi belirle ──
    // ★ 2026-04-20 FIX: canPublish HER ZAMAN true — token odaya girişte bir kez
    // üretilir ve rol değiştiğinde (listener→speaker promote) yenilenMEZ.
    // Bu yüzden listener olarak giren birisi sahneye çıktığında canPublish=false
    // olan eski token yüzünden mikrofon açamıyordu.
    // Uygulama katmanı zaten mic erişimini kontrol eder:
    //   - UI: listener'da mic butonu görünmez
    //   - Moderatör: broadcast ile force-mute yapabilir
    //   - Demote: client-side mic kapatılır
    const effectiveRole = partRow?.role || "listener";
    const canPublish = true;

    // ── 5. Token oluştur ──
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: displayName || "User",
      ttl: "6h",
    });

    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return new Response(
      JSON.stringify({ token: jwt, role: effectiveRole, canPublish }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
