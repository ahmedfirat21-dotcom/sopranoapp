/**
 * SopranoChat — Email Digest Client Wrapper (Faz 5.2)
 * ═══════════════════════════════════════════════════
 * Edge function `send-email-digest` için thin client wrapper.
 *
 * Production'da haftalık cron (pg_cron veya GitHub Actions scheduler)
 * /send-email-digest body:{} POST'lar — tüm eligible kullanıcılara gönderir.
 *
 * Bu wrapper test/admin paneli için: belirli user_id ile manuel trigger.
 *
 * Setup (kullanıcı tarafı):
 *   1. resend.com'a kaydol → API key al
 *   2. Domain verify et (sopranochat.com TXT record)
 *   3. Supabase Functions secrets:
 *        npx supabase secrets set RESEND_API_KEY=re_xxx
 *        npx supabase secrets set EMAIL_FROM='SopranoChat <noreply@sopranochat.com>'
 *   4. Deploy:
 *        npx supabase functions deploy send-email-digest --project-ref kpofiuczyjesjlqjxswh
 *   5. Cron (pg_cron örneği):
 *        SELECT cron.schedule('weekly-digest', '0 9 * * 1', $$
 *          SELECT net.http_post(
 *            url := 'https://kpofiuczyjesjlqjxswh.supabase.co/functions/v1/send-email-digest',
 *            headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
 *          );
 *        $$);
 */
import { supabase } from '../constants/supabase';

export const EmailDigestService = {
  /**
   * Kullanıcıya tek seferlik test digest gönder (admin only).
   * Production'da kullanılmamalı — cron tetikler.
   */
  async sendTestDigest(userId: string): Promise<{ ok: boolean; error?: string }> {
    if (!userId) return { ok: false, error: 'Geçersiz kullanıcı.' };
    try {
      const { data, error } = await supabase.functions.invoke('send-email-digest', {
        body: { user_id: userId },
      });
      if (error) return { ok: false, error: error.message };
      const sent = (data as any)?.sent || 0;
      return { ok: sent > 0 };
    } catch (e: any) {
      return { ok: false, error: e?.message };
    }
  },
};
