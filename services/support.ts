/**
 * SopranoChat â Destek Talepleri Servisi (v300)
 * âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
 * KullanÄ±cÄ± uygulama iÃ§inden destek talebi gÃ¶nderir â support_tickets
 * tablosuna INSERT. Web admin /yonet/destek panelinde gÃ¶rÃ¼nÃ¼r.
 *
 * AkÄ±Å:
 *   APK Form â SupportService.submitTicket(...) â DB insert â trigger
 *     â pg_notify('support_ticket_new', ...) â web admin realtime liste
 *
 * RLS: kullanÄ±cÄ± sadece kendi user_id ile INSERT edebilir + kendi
 * ticket'larÄ±nÄ± SELECT gÃ¶rebilir.
 */
import { supabase } from '../constants/supabase';
import { Platform } from 'react-native';

let APP_VERSION = 'unknown';
try {
  const Constants = require('expo-constants').default;
  APP_VERSION = `v${Constants?.expoConfig?.version || 'unknown'}`;
} catch { /* silent */ }

export type SupportCategory = 'bug' | 'suggestion' | 'complaint' | 'question' | 'other';

export interface SupportTicket {
  id: string;
  user_id: string;
  user_display_name: string | null;
  user_email: string | null;
  category: SupportCategory;
  subject: string;
  message: string;
  app_version: string | null;
  platform: string | null;
  status: 'new' | 'read' | 'in_progress' | 'resolved' | 'closed';
  admin_response: string | null;
  admin_response_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export const SupportService = {
  /**
   * Yeni destek talebi gÃ¶nder.
   * Validasyon DB CHECK constraint'leri ile de korunuyor (subject 3-120,
   * message 10-2000 karakter, category enum).
   */
  async submitTicket(params: {
    userId: string;
    displayName?: string | null;
    email?: string | null;
    category: SupportCategory;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; ticketId?: string; error?: string }> {
    // Client-side hÄ±zlÄ± validasyon (DB tarafÄ± zaten kontrol ediyor)
    const subject = params.subject?.trim() || '';
    const message = params.message?.trim() || '';
    if (subject.length < 3) return { success: false, error: i18n.t('support.subject_too_short') };
    if (subject.length > 120) return { success: false, error: i18n.t('support.subject_too_long') };
    if (message.length < 10) return { success: false, error: i18n.t('support.message_too_short') };
    if (message.length > 2000) return { success: false, error: i18n.t('support.message_too_long') };

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: params.userId,
          user_display_name: params.displayName || null,
          user_email: params.email || null,
          category: params.category,
          subject,
          message,
          app_version: APP_VERSION,
          platform: Platform.OS,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, ticketId: data?.id };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Bilinmeyen hata' };
    }
  },

  /**
   * KullanÄ±cÄ±nÄ±n kendi geÃ§miÅ ticket'larÄ±nÄ± getir.
   */
  async getMyTickets(userId: string): Promise<SupportTicket[]> {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return [];
      return (data as SupportTicket[]) || [];
    } catch {
      return [];
    }
  },
};
