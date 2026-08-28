import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const FIREBASE_PROJECT_ID = "sopranochat-5738e";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const CERT_TTL_MS = 30 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type FirebaseClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
};

type JwksResponse = { keys: JsonWebKey[] };
let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

async function getFirebaseJwks(): Promise<JsonWebKey[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < CERT_TTL_MS) return jwksCache.keys;

  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) throw new Error("Firebase doğrulama anahtarları alınamadı.");
  const payload = await response.json() as JwksResponse;
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error("Firebase doğrulama anahtarları geçersiz.");
  }
  jwksCache = { keys: payload.keys, fetchedAt: now };
  return payload.keys;
}

async function verifyFirebaseToken(token: string): Promise<FirebaseClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Geçersiz oturum anahtarı.");

  const header = decodeJsonPart<{ alg?: string; kid?: string }>(parts[0]);
  const claims = decodeJsonPart<FirebaseClaims>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Geçersiz oturum algoritması.");

  const jwks = await getFirebaseJwks();
  const jwk = jwks.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Oturum imza anahtarı bulunamadı.");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = decodeBase64Url(parts[2]);
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedBytes,
  );
  if (!validSignature) throw new Error("Oturum imzası doğrulanamadı.");

  const now = Math.floor(Date.now() / 1000);
  const audienceValid = Array.isArray(claims.aud)
    ? claims.aud.includes(FIREBASE_PROJECT_ID)
    : claims.aud === FIREBASE_PROJECT_ID;
  if (claims.iss !== FIREBASE_ISSUER || !audienceValid) throw new Error("Oturum kaynağı geçersiz.");
  if (!claims.sub || claims.sub.length > 128) throw new Error("Kullanıcı kimliği geçersiz.");
  if (!Number.isFinite(claims.exp) || claims.exp <= now) throw new Error("Oturumun süresi dolmuş.");
  if (!Number.isFinite(claims.iat) || claims.iat > now + 300) throw new Error("Oturum zamanı geçersiz.");
  return claims;
}

const allowedActions = new Set([
  "claim", "heartbeat", "request", "cancel", "list",
  "promote", "reject", "demote",
]);
const roomIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse(405, { error: "Yalnızca POST desteklenir." });

  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) return jsonResponse(401, { error: "Oturum gerekli." });
    const claims = await verifyFirebaseToken(authorization.slice(7));

    const body = await request.json() as {
      action?: string;
      roomId?: string;
      targetUserId?: string | null;
    };
    const action = body.action?.trim().toLowerCase() || "";
    const roomId = body.roomId?.trim() || "";
    const targetUserId = body.targetUserId?.trim() || null;
    if (!allowedActions.has(action)) return jsonResponse(400, { error: "Geçersiz sahne işlemi." });
    if (!roomIdPattern.test(roomId)) return jsonResponse(400, { error: "Geçersiz oda kimliği." });
    if (targetUserId && targetUserId.length > 128) return jsonResponse(400, { error: "Hedef kullanıcı kimliği geçersiz." });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Sunucu yapılandırması eksik.");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc("system_stage_action", {
      p_action: action,
      p_room_id: roomId,
      p_actor_id: claims.sub,
      p_target_user_id: targetUserId,
    });
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sahne işlemi başarısız.";
    const unauthorized = /oturum|imza|firebase|token/i.test(message);
    return jsonResponse(unauthorized ? 401 : 500, { error: message });
  }
});
