// Supabase Edge Function: Firebase JWT → Supabase JWT Köprüsü
// ═══════════════════════════════════════════════════════════════════
// Sorun: Supabase Realtime, Firebase JWT'sinde "role" claim'i bulamayınca
// "InvalidJWTToken: Fields `role` and `exp` are required" hatası verip
// tüm canlı kanalları reddediyor (mesaj, emoji, el kaldırma, DM, presence).
//
// Çözüm: Bu fonksiyon Firebase ID token'ını JWKS ile doğrular, sonra
// içinde { role: 'authenticated', sub: <firebase_uid>, exp, iat, aud,
// iss } olan yeni bir HS256 JWT üretip Supabase JWT secret ile imzalar.
// Client bu yeni token'ı accessToken factory üzerinden hem REST hem
// Realtime için kullanır → her ikisi de çalışır.
//
// RLS uyumlu: app_uid() = auth.jwt()->>'sub' = Firebase UID (değişmedi).
// ═══════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-firebase-auth",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Firebase config ─────────────────────────────────────────
const FIREBASE_PROJECT_ID = "sopranochat-5738e";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// ── JWKS (x509 PEM) cache ───────────────────────────────────
// Google sertifikaları her ~6 saat değişir.
// ★ 2026-05-10 SECURITY: TTL 1h → 30dk. Revoked cert ile token doğrulama
//   penceresini yarıya indir. Edge function memory cache zaten container
//   reboot'unda sıfırlanıyor, bu sadece warm container için ek güvenlik.
type CertCache = { certs: Record<string, string>; fetchedAt: number };
let _certCache: CertCache | null = null;
const CERT_TTL_MS = 30 * 60 * 1000; // 30 dk

async function getFirebaseCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_certCache && now - _certCache.fetchedAt < CERT_TTL_MS) {
    return _certCache.certs;
  }
  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Firebase certs fetch failed: ${res.status}`);
  }
  const certs = await res.json() as Record<string, string>;
  _certCache = { certs, fetchedAt: now };
  return certs;
}

// PEM x509 → CryptoKey (RS256 verify için)
async function pemToPublicKey(pem: string): Promise<CryptoKey> {
  // x509 sertifikadan public key çıkar
  // PEM body'yi decode et
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // x509 sertifikadan SubjectPublicKeyInfo çıkar (basit ASN.1 parse)
  // Bunu yapmak yerine WebCrypto'nun importKey raw-public-key formatını kullanırız:
  // Aslında SPKI formatında importKey çağrısı x509 cert'ten public key'i bulur değil — manuel parse şart.
  const spki = extractSpkiFromX509(der);
  return await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

// Minimal ASN.1 DER parser — sadece x509 → SPKI çıkarmak için
function extractSpkiFromX509(der: Uint8Array): Uint8Array {
  // x509 yapısı:
  //   Certificate SEQUENCE {
  //     tbsCertificate SEQUENCE {
  //       version [0] EXPLICIT (optional),
  //       serialNumber INTEGER,
  //       signature AlgorithmIdentifier,
  //       issuer Name,
  //       validity Validity,
  //       subject Name,
  //       subjectPublicKeyInfo SubjectPublicKeyInfo, ← ALDIĞIMIZ
  //       ...
  //     },
  //     ...
  //   }
  let pos = 0;

  // Outer SEQUENCE
  if (der[pos++] !== 0x30) throw new Error("x509: outer SEQUENCE bekleniyor");
  pos = readLength(der, pos).next;

  // tbsCertificate SEQUENCE
  if (der[pos++] !== 0x30) throw new Error("x509: tbsCertificate SEQUENCE bekleniyor");
  const tbsLen = readLength(der, pos);
  pos = tbsLen.next;
  const tbsEnd = pos + tbsLen.value;

  // version [0] EXPLICIT (optional, tag 0xA0)
  if (der[pos] === 0xA0) {
    pos += 1;
    pos = readLength(der, pos).next + readLength(der, pos).value;
  }
  // serialNumber INTEGER (0x02)
  pos = skipTLV(der, pos);
  // signature AlgorithmIdentifier (0x30)
  pos = skipTLV(der, pos);
  // issuer Name (0x30)
  pos = skipTLV(der, pos);
  // validity Validity (0x30)
  pos = skipTLV(der, pos);
  // subject Name (0x30)
  pos = skipTLV(der, pos);

  // subjectPublicKeyInfo SEQUENCE (0x30) — ALDIĞIMIZ
  const spkiStart = pos;
  if (der[pos++] !== 0x30) throw new Error("x509: SPKI SEQUENCE bekleniyor");
  const spkiLen = readLength(der, pos);
  const spkiEnd = spkiLen.next + spkiLen.value;
  return der.slice(spkiStart, spkiEnd);
}

function readLength(buf: Uint8Array, pos: number): { value: number; next: number } {
  const first = buf[pos];
  if (first < 0x80) {
    return { value: first, next: pos + 1 };
  }
  const numBytes = first & 0x7F;
  let len = 0;
  for (let i = 0; i < numBytes; i++) {
    len = (len << 8) | buf[pos + 1 + i];
  }
  return { value: len, next: pos + 1 + numBytes };
}

function skipTLV(buf: Uint8Array, pos: number): number {
  pos += 1; // tag
  const len = readLength(buf, pos);
  return len.next + len.value;
}

// ── Firebase JWT doğrula ────────────────────────────────────
type FirebaseClaims = {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  email?: string;
  name?: string;
};

async function verifyFirebaseJwt(token: string): Promise<FirebaseClaims> {
  // Header'ı çöz, kid bul
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Geçersiz JWT format");
  const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
  if (header.alg !== "RS256") throw new Error(`Beklenmeyen alg: ${header.alg}`);
  if (!header.kid) throw new Error("kid eksik");

  const certs = await getFirebaseCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error(`Bilinmeyen kid: ${header.kid}`);

  const publicKey = await pemToPublicKey(pem);

  // djwt verify
  const claims = await verify(token, publicKey) as FirebaseClaims;

  // Issuer/audience kontrolü
  if (claims.iss !== FIREBASE_ISSUER) {
    throw new Error(`Issuer uyumsuz: ${claims.iss}`);
  }
  if (claims.aud !== FIREBASE_PROJECT_ID) {
    throw new Error(`Audience uyumsuz: ${claims.aud}`);
  }
  if (!claims.sub) {
    throw new Error("sub claim eksik");
  }
  // exp/iat zaten djwt verify ediyor

  return claims;
}

// ── Supabase JWT mint ───────────────────────────────────────
async function mintSupabaseJwt(firebaseClaims: FirebaseClaims, jwtSecret: string): Promise<{ token: string; expiresAt: number }> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

  // Supabase Realtime + REST için gerekli claim'ler
  // Firebase token'ının kalan ömrü kadar veya max 1 saat
  const now = Math.floor(Date.now() / 1000);
  const fbRemaining = firebaseClaims.exp - now;
  const ttl = Math.min(Math.max(fbRemaining, 60), 3600); // 1 dk - 1 saat
  const exp = now + ttl;

  const payload = {
    sub: firebaseClaims.sub,           // Firebase UID — RLS app_uid() bunu okuyor
    role: "authenticated",             // ★ KRİTİK: Realtime bunu arıyor
    aud: "authenticated",
    iss: "supabase",
    iat: now,
    exp,
    // İsteğe bağlı bilgi (telemetri için)
    email: firebaseClaims.email,
    firebase_iss: firebaseClaims.iss,
  };

  const token = await create(
    { alg: "HS256", typ: "JWT" },
    payload,
    key,
  );

  return { token, expiresAt: exp };
}

// ── HTTP Handler ────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Firebase JWT iki şekilde gelebilir:
    // 1) X-Firebase-Auth header (LiveKit token endpoint pattern'inde olduğu gibi)
    // 2) Authorization: Bearer <jwt>
    let firebaseToken = req.headers.get("x-firebase-auth");
    if (!firebaseToken) {
      const auth = req.headers.get("authorization");
      if (auth?.startsWith("Bearer ")) {
        firebaseToken = auth.substring(7);
      }
    }

    if (!firebaseToken) {
      return new Response(
        JSON.stringify({ error: "Firebase token eksik (X-Firebase-Auth veya Authorization header)" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Hangi env var'lar mevcut görelim — debug için
    const supabaseJwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
    if (!supabaseJwtSecret) {
      const envKeys = Object.keys(Deno.env.toObject())
        .filter((k) => /jwt|key|secret|jwks/i.test(k));
      return new Response(
        JSON.stringify({
          error: "SUPABASE_JWT_SECRET env eksik",
          available_jwt_related_keys: envKeys,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Firebase JWT doğrula
    let claims: FirebaseClaims;
    try {
      claims = await verifyFirebaseJwt(firebaseToken);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `Firebase JWT geçersiz: ${e instanceof Error ? e.message : String(e)}` }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Supabase JWT mint et
    const { token, expiresAt } = await mintSupabaseJwt(claims, supabaseJwtSecret);

    return new Response(
      JSON.stringify({
        token,
        expiresAt,           // unix timestamp (saniye)
        sub: claims.sub,     // client log/cache için
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
