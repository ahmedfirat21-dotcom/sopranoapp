/**
 * SopranoChat — Destek Talepleri Servisi (v300)
 * ═══════════════════════════════════════════════════════════════════
 * Kullanıcı uygulama içinden destek talebi gönderir → support_tickets
 * tablosuna INSERT. Web admin /yonet/destek panelinde görünür.
 *
 * Akış:
 *   APK Form → SupportService.submitTicket(...) → DB insert → trigger
 *     → pg_notify('support_ticket_new', ...) → web admin realtime liste
 *
 * RLS: kullanıcı sadece kendi user_id ile INSERT edebilir + kendi
 * ticket'larını SELECT görebilir.
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
   * Yeni destek talebi gönder.
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
    // Client-side hızlı validasyon (DB tarafı zaten kontrol ediyor)
    const subject = params.subject?.trim() || '';
    const message = params.message?.trim() || '';
    if (subject.length < 3) return { success: false, error: 'Konu çok kısa (en az 3 karakter).' };
    if (subject.length > 120) return { success: false, error: 'Konu çok uzun (en fazla 120 karakter).' };
    if (message.length < 10) return { success: false, error: 'Mesaj çok kısa (en az 10 karakter).' };
    if (message.length > 2000) return { success: false, error: 'Mesaj çok uzun (en fazla 2000 karakter).' };

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
   * Kullanıcının kendi geçmiş ticket'larını getir.
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
