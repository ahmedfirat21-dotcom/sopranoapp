// SopranoChat — Weekly Email Digest (Faz 5.2)
// ═══════════════════════════════════════════════════
// Bu fonksiyon haftalık aktivite özetini email_weekly_digest=true olan
// kullanıcılara Resend API üzerinden yollar.
//
// Deploy:
//   npx supabase functions deploy send-email-digest --project-ref kpofiuczyjesjlqjxswh
//
// Tetikleme:
//   - Manuel: POST /send-email-digest { user_id?: string }   (test)
//   - Cron: pg_cron veya external scheduler haftada bir POST {}
//          → email_weekly_digest=true olan tüm kullanıcılara loop'lar
//
// Gerekli env (Supabase Functions → Secrets):
//   RESEND_API_KEY     → re_... (resend.com dashboard'dan)
//   EMAIL_FROM         → 'SopranoChat <noreply@sopranochat.com>' (verified domain)
//
// SendGrid alternatifi:
//   RESEND_API_KEY yerine SENDGRID_API_KEY ekle ve fetch URL'i değiştir.
//   API contract çok benzer: POST /v3/mail/send body { personalizations, from, content }.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DigestStats {
  user_id: string;
  display_name: string;
  email: string;
  rooms_attended: number;
  new_followers: number;
  sp_received: number;
  unread_messages: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'SopranoChat <noreply@sopranochat.com>';
    if (!RESEND_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY tanımlı değil. Functions secrets ekle.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.user_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Hedef kullanıcı listesi ──
    let userIds: string[] = [];
    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('user_id')
        .eq('email_weekly_digest', true)
        .eq('email_enabled', true);
      userIds = (prefs || []).map((p: any) => p.user_id);
    }

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'Eligible kullanıcı yok.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Her kullanıcı için stats topla ──
    const oneWeekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const results: { user_id: string; ok: boolean; error?: string }[] = [];

    for (const uid of userIds) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .eq('id', uid)
          .maybeSingle();
        if (!profile?.email) {
          results.push({ user_id: uid, ok: false, error: 'no email' });
          continue;
        }

        const [followerRes, spRes, roomsRes, msgRes] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid).gte('created_at', oneWeekAgo),
          supabase.from('sp_transactions').select('amount').eq('to_user_id', uid).eq('type', 'gift').gte('created_at', oneWeekAgo),
          // ★ Faz 5.2 FIX: room_participants tablosundan son 1 haftada katıldığı oda sayısı
          supabase.from('room_participants').select('room_id', { count: 'exact', head: true }).eq('user_id', uid).gte('joined_at', oneWeekAgo),
          // ★ Faz 5.2 FIX: Okunmamış DM sayısı — read_at NULL olan mesajlar
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', uid).is('read_at', null),
        ]);

        const stats: DigestStats = {
          user_id: uid,
          display_name: profile.display_name || 'Kullanıcı',
          email: profile.email,
          rooms_attended: roomsRes.count ?? 0,
          new_followers: followerRes.count ?? 0,
          sp_received: (spRes.data || []).reduce((s: number, r: any) => s + (r.amount || 0), 0),
          unread_messages: msgRes.count ?? 0,
        };

        // Boş haftalar — hiçbir aktivite yoksa email gönderme (spam'ı önle)
        if (stats.new_followers === 0 && stats.sp_received === 0 && stats.rooms_attended === 0 && stats.unread_messages === 0) {
          results.push({ user_id: uid, ok: false, error: 'no activity' });
          continue;
        }

        const html = renderDigestHtml(stats);
        const subject = `📬 SopranoChat haftalık özetin — ${stats.new_followers} yeni takipçi`;

        const resendRes = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: stats.email,
            subject,
            html,
          }),
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          results.push({ user_id: uid, ok: false, error: `resend ${resendRes.status}: ${errText.slice(0, 120)}` });
        } else {
          results.push({ user_id: uid, ok: true });
        }
      } catch (e: any) {
        results.push({ user_id: uid, ok: false, error: e?.message || 'unknown' });
      }
    }

    const sent = results.filter(r => r.ok).length;
    return new Response(
      JSON.stringify({ sent, total: userIds.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── HTML template ──────────────────────────────────────────────
function renderDigestHtml(s: DigestStats): string {
  const items: string[] = [];
  if (s.new_followers > 0) items.push(`<li><strong>${s.new_followers}</strong> yeni takipçi</li>`);
  if (s.sp_received > 0)   items.push(`<li><strong>${s.sp_received.toLocaleString('tr-TR')} SP</strong> hediye aldın</li>`);
  if (s.rooms_attended > 0) items.push(`<li><strong>${s.rooms_attended}</strong> odaya katıldın</li>`);
  if (s.unread_messages > 0) items.push(`<li><strong>${s.unread_messages}</strong> okunmamış mesajın var</li>`);

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SopranoChat — Haftalık Özet</title>
</head>
<body style="margin:0;padding:0;background:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F1F5F9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#1E293B;border-radius:16px;overflow:hidden;border:1px solid rgba(20,184,166,0.18);">
          <tr>
            <td style="padding:32px 28px 22px;background:linear-gradient(135deg,#14B8A6 0%,#0F766E 100%);">
              <h1 style="margin:0;font-size:22px;font-weight:900;color:#FFF;letter-spacing:0.4px;">SopranoChat</h1>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Haftalık özet — ${s.display_name}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 14px;font-size:15px;color:#CBD5E1;line-height:1.55;">
                Merhaba <strong style="color:#F1F5F9;">${escapeHtml(s.display_name)}</strong> 👋<br/>
                Geçen hafta SopranoChat'te neler oldu:
              </p>
              <ul style="margin:0 0 22px;padding-left:20px;font-size:14px;color:#E2E8F0;line-height:1.8;">
                ${items.join('\n')}
              </ul>
              <a href="sopranochat://home" style="display:inline-block;padding:12px 22px;background:#14B8A6;color:#FFF;font-weight:800;font-size:13px;text-decoration:none;border-radius:10px;">Uygulamayı Aç</a>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#64748B;line-height:1.5;">
              Bu emaili "Haftalık Özet" tercihin açık olduğu için alıyorsun.
              <br/>
              <a href="sopranochat://settings" style="color:#5EEAD4;text-decoration:none;">Tercihlerini değiştir</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
