// ★ v1.7.13.137 (21 May 2026): RevenueCat Webhook — server-side subscription validation.
//
// PROBLEM:
//   Önceden tier güncellemesi tamamen client'a güveniliyordu. Saldırgan modifiye
//   client ile fake receipt olmadan apply_subscription_tier RPC çağırabilir
//   (yetki var çünkü authenticated user).
//
// ÇÖZÜM:
//   RevenueCat Dashboard'dan webhook URL kaydet:
//     https://<project>.supabase.co/functions/v1/revenuecat-webhook
//   Auth header: Bearer <REVENUECAT_WEBHOOK_TOKEN> (Supabase secrets).
//   Webhook event'leri INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION dinle.
//
// EVENT TYPES:
//   INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE → tier set + expires_at
//   CANCELLATION → expires_at güncelle (kullanıcı dönem sonuna kadar Pro kalır)
//   EXPIRATION   → tier='Free'
//   BILLING_ISSUE → grace period (şimdilik bekleyelim, ileride hatırlat)
//
// SETUP:
//   supabase secrets set REVENUECAT_WEBHOOK_TOKEN=<random-secret>
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<from project settings>
//   RC Dashboard → App settings → Webhooks → Add → URL + Auth header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';

interface RCWebhookEvent {
  event: {
    type: string;
    app_user_id: string;
    product_id?: string;
    period_type?: string;
    expiration_at_ms?: number;
    purchased_at_ms?: number;
    entitlement_id?: string;
    entitlement_ids?: string[];
  };
  api_version?: string;
}

const TIER_MAP: Record<string, 'Plus' | 'Pro'> = {
  // RevenueCat entitlement ID → bizim tier
  plus: 'Plus',
  pro: 'Pro',
  premium_plus: 'Plus',
  premium_pro: 'Pro',
};

function extractTier(ev: RCWebhookEvent['event']): 'Plus' | 'Pro' | null {
  const entIds = ev.entitlement_ids || (ev.entitlement_id ? [ev.entitlement_id] : []);
  for (const e of entIds) {
    const m = TIER_MAP[e.toLowerCase()];
    if (m) return m;
  }
  if (ev.product_id) {
    const p = ev.product_id.toLowerCase();
    if (p.includes('pro')) return 'Pro';
    if (p.includes('plus')) return 'Plus';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // Auth check
  const authHeader = req.headers.get('Authorization') || '';
  const expectedToken = Deno.env.get('REVENUECAT_WEBHOOK_TOKEN');
  if (!expectedToken) {
    return new Response('Webhook token not configured', { status: 500 });
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: RCWebhookEvent;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const ev = body?.event;
  if (!ev || !ev.type || !ev.app_user_id) {
    return new Response('Invalid event payload', { status: 400 });
  }

  // Service role client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const userId = ev.app_user_id;
  const expiresAt = ev.expiration_at_ms ? new Date(ev.expiration_at_ms).toISOString() : null;
  const eventType = ev.type.toUpperCase();

  let targetTier: 'Free' | 'Plus' | 'Pro' = 'Free';

  if (['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE', 'UNCANCELLATION'].includes(eventType)) {
    const tier = extractTier(ev);
    if (!tier) return new Response('Could not map tier from product/entitlement', { status: 422 });
    targetTier = tier;
  } else if (eventType === 'EXPIRATION') {
    targetTier = 'Free';
  } else if (eventType === 'CANCELLATION') {
    // İptal — kullanıcı dönem sonuna kadar Pro/Plus kalır. expires_at güncellenir.
    const tier = extractTier(ev) || 'Plus';
    targetTier = tier;
  } else if (eventType === 'BILLING_ISSUE') {
    // Grace period — şimdilik no-op (post-launch UI uyarı eklenebilir)
    return new Response(JSON.stringify({ ignored: true, event: eventType }), { status: 200 });
  } else {
    // Bilinmeyen event — log + skip
    return new Response(JSON.stringify({ ignored: true, event: eventType }), { status: 200 });
  }

  const { data, error } = await supabase.rpc('apply_subscription_tier', {
    p_user_id: userId,
    p_tier: targetTier,
    p_expires_at: expiresAt,
  });

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, tier: targetTier, expires_at: expiresAt, rpc: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
