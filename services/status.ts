/**
 * SopranoChat — Durum Servisi
 * ═══════════════════════════════════════════════════
 * Sesli/yazılı durum paylaşımları, canlı yayın durumu.
 * database.ts monolitinden ayrıştırıldı.
 */
import { supabase } from '../constants/supabase';
import type { Profile } from '../types';

// ════════════════════════════════════════════════════════════
// DURUM SERVİSİ — Sesli/yazılı durum paylaşımları
// ════════════════════════════════════════════════════════════
export type UserStatus = {
  id: string;
  user_id: string;
  content: string | null;
  type: 'text' | 'voice' | 'auto_live';
  voice_url: string | null;
  emoji: string;
  expires_at: string;
  created_at: string;
  profile?: Profile;
};

export const StatusService = {
  async getActive(limit: number = 30): Promise<UserStatus[]> {
    const { data, error } = await supabase
      .from('user_statuses')
      .select('*, profile:profiles!user_id(*)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as UserStatus[];
  },

  async getUserStatus(userId: string): Promise<UserStatus | null> {
    const { data, error } = await supabase
      .from('user_statuses')
      .select('*, profile:profiles!user_id(*)')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as UserStatus | null;
  },

  async create(userId: string, content: string, emoji: string = '💭'): Promise<UserStatus> {
    // ★ SEC-STATUS: Input sanitization — max 200 char, HTML strip, emoji limit
    const sanitizedContent = (content || '').trim().replace(/<[^>]*>/g, '').slice(0, 200);
    if (sanitizedContent.length < 1) throw new Error('Durum metni boş olamaz');
    const sanitizedEmoji = (emoji || '💭').slice(0, 6); // Max 1 emoji + variant selectors

    await supabase.from('user_statuses').delete().eq('user_id', userId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('user_statuses')
      .insert({ user_id: userId, content: sanitizedContent, type: 'text', emoji: sanitizedEmoji, expires_at: expiresAt })
      .select('*')
      .single();
    if (error) throw error;
    return data as UserStatus;
  },

  async delete(userId: string): Promise<void> {
    await supabase.from('user_statuses').delete().eq('user_id', userId);
  },

  async setLiveStatus(userId: string, roomName: string): Promise<void> {
    await supabase.from('user_statuses').delete().eq('user_id', userId).eq('type', 'auto_live');
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await supabase.from('user_statuses').insert({
      user_id: userId, content: roomName, type: 'auto_live', emoji: '🔴', expires_at: expiresAt,
    });
  },

  async clearLiveStatus(userId: string): Promise<void> {
    await supabase.from('user_statuses').delete().eq('user_id', userId).eq('type', 'auto_live');
  },
};
