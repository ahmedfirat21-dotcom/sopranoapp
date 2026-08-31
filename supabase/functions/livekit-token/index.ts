import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { AccessToken } from "npm:livekit-server-sdk@2.6.1";

const FIREBASE_PROJECT_ID = "sopranochat-5738e";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const CERT_TTL_MS = 30 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-firebase-auth, x-livekit-role-refresh",
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

const BLOCKED_ROLES = new Set(["banned"]);
const roomIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

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
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Geçersiz oturum algoritması.");
  }

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
  if (claims.iss !== FIREBASE_ISSUER || !audienceValid) {
    throw new Error("Oturum kaynağı geçersiz.");
  }
  if (!claims.sub || claims.sub.length > 128) {
    throw new Error("Kullanıcı kimliği geçersiz.");
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= now) {
    throw new Error("Oturumun süresi dolmuş.");
  }
  if (!Number.isFinite(claims.iat) || claims.iat > now + 300) {
    throw new Error("Oturum zamanı geçersiz.");
  }
  return claims;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Yalnızca POST desteklenir." });
  }

  try {
    const firebaseToken = request.headers.get("x-firebase-auth")?.trim();
    if (!firebaseToken) return jsonResponse(401, { error: "Oturum gerekli." });

    const claims = await verifyFirebaseToken(firebaseToken);
    const body = await request.json() as {
      roomId?: string;
      userId?: string;
      displayName?: string;
    };
    const roomId = body.roomId?.trim() || "";
    const userId = body.userId?.trim() || "";
    const displayName = body.displayName?.trim().slice(0, 80) || "User";

    if (!roomIdPattern.test(roomId)) {
      return jsonResponse(400, { error: "Geçersiz oda kimliği." });
    }
    if (!userId || userId.length > 128) {
      return jsonResponse(400, { error: "Geçersiz kullanıcı kimliği." });
    }
    if (claims.sub !== userId) {
      return jsonResponse(403, { error: "Kullanıcı kimliği eşleşmiyor." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Sunucu yapılandırması eksik.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Vault ve oda kontrolleri bağımsızdır; cold-start gecikmesini büyütmemek
    // için tek tek beklemek yerine paralel çalıştırılır.
    const [credentialResult, roomResult, banResult, participantResult] =
      await Promise.all([
        admin.rpc("get_livekit_credentials").single(),
        admin
          .from("rooms")
          .select("id, is_live, is_system_room")
          .eq("id", roomId)
          .maybeSingle(),
        admin
          .from("room_bans")
          .select("id, expires_at")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .maybeSingle(),
        admin
          .from("room_participants")
          .select("role, is_muted")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    const credentials = credentialResult.data as
      | { api_key?: string; api_secret?: string }
      | null;
    if (
      credentialResult.error ||
      !credentials?.api_key ||
      !credentials?.api_secret
    ) {
      throw new Error("LiveKit kimlik bilgileri alınamadı.");
    }

    if (roomResult.error) throw new Error("Oda bilgisi alınamadı.");
    const roomRow = roomResult.data;
    if (!roomRow) return jsonResponse(404, { error: "Oda bulunamadı." });
    if (!roomRow.is_live) return jsonResponse(403, { error: "Oda aktif değil." });

    if (banResult.error) throw new Error("Oda yasaklama bilgisi alınamadı.");
    const banRow = banResult.data;
    if (banRow) {
      const expired =
        !!banRow.expires_at && new Date(banRow.expires_at).getTime() <= Date.now();
      if (!expired) return jsonResponse(403, { error: "Bu odadan yasaklandınız." });
    }

    if (participantResult.error) {
      throw new Error("Katılımcı bilgisi alınamadı.");
    }
    const participant = participantResult.data;
    // Normal odalarda access/join tamamlanmadan token verilmez. Kalıcı sistem
    // lobisi ise bağlantıyı hızlandırmak için DB join ile paralel bağlanabilir.
    if (!participant && !roomRow.is_system_room) {
      return jsonResponse(403, { error: "Önce odaya katılmalısınız." });
    }
    if (participant && BLOCKED_ROLES.has(participant.role)) {
      return jsonResponse(403, { error: "Bu odaya erişim engelli." });
    }

    const effectiveRole = participant?.role || "listener";

    // Yeni istemci dinleyici token'ını yayınsız alır ve sahne rolü kazandığında
    // kontrollü token refresh yapar. Play'deki v163 bu protokolü bilmediği için,
    // geçiş süresince yalnız işaret göndermeyen eski sürümlerde mevcut davranış korunur.
    const supportsRoleRefresh =
      request.headers.get("x-livekit-role-refresh") === "1";
    const canPublish = supportsRoleRefresh
      ? ["owner", "moderator", "speaker"].includes(effectiveRole)
      : true;
    const token = new AccessToken(credentials.api_key, credentials.api_secret, {
      identity: userId,
      name: displayName,
      ttl: "6h",
      metadata: JSON.stringify({ role: effectiveRole }),
    });
    token.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    });

    return jsonResponse(200, {
      token: await token.toJwt(),
      role: effectiveRole,
      canPublish,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ses bağlantısı hazırlanamadı.";
    const unauthorized = /oturum|imza|firebase|token|kimliği eşleşmiyor/i.test(message);
    return jsonResponse(unauthorized ? 401 : 500, { error: message });
  }
});
