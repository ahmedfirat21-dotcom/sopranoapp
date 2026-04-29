/**
 * SopranoChat — Kulüp Servisi (Faz 6.1)
 * ═══════════════════════════════════════════════════
 * Discord-tarzı sürekli topluluk: clubs + club_members + club_rooms.
 *
 * Tablolar v62'de, trigger/RPC'ler v67'de.
 * RLS kuralları:
 *   - clubs SELECT: public OR owner OR member
 *   - clubs INSERT: auth.uid() = owner_id
 *   - clubs UPDATE/DELETE: yalnızca owner
 *   - club_members SELECT: kulüp görünürse
 *   - club_members INSERT: yalnızca kendisi (kendi user_id'i)
 *   - club_members DELETE: yalnızca kendisi
 *
 * Premium kulüp (is_premium=true) Pro+ özelliği — caller tarafında tier check.
 */
import { supabase } from '../constants/supabase';
import type { Profile } from '../types';

export type ClubRole = 'owner' | 'moderator' | 'member';

export interface Club {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  owner_id: string;
  is_public: boolean;
  is_premium: boolean;
  member_count: number;
  treasury_balance: number;
  invite_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClubMember {
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
  profile?: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'username' | 'subscription_tier' | 'is_online'> & { last_seen?: string };
}

export interface CreateClubInput {
  slug: string;
  name: string;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  is_public?: boolean;
  is_premium?: boolean;
}

const SLUG_RE = /^[a-z0-9_-]{3,30}$/;

/** Slug normalize: lowercase + alfanumerik/dash/underscore. Boş/uygunsuz ise null. */
export function normalizeClubSlug(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim().toLowerCase();
  s = s.replace(/\s+/g, '-');
  s = s.replace(/[^a-z0-9_-]/g, '');
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return SLUG_RE.test(s) ? s : null;
}

export const ClubService = {
  // ── CRUD ────────────────────────────────────────────────────

  async createClub(ownerId: string, input: CreateClubInput): Promise<{ club?: Club; error?: string }> {
    const slug = normalizeClubSlug(input.slug);
    if (!slug) return { error: 'Slug geçersiz: 3-30 karakter, küçük harf/rakam/-/_' };
    const name = (input.name || '').trim();
    if (name.length < 2 || name.length > 50) return { error: 'İsim 2-50 karakter olmalı.' };

    const payload: any = {
      slug,
      name,
      description: input.description?.trim().slice(0, 500) || null,
      avatar_url: input.avatar_url || null,
      banner_url: input.banner_url || null,
      owner_id: ownerId,
      is_public: input.is_public !== false,
      is_premium: !!input.is_premium,
    };

    const { data, error } = await supabase
      .from('clubs')
      .insert(payload)
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') return { error: 'Bu slug zaten kullanılıyor.' };
      if (__DEV__) console.warn('[ClubService] createClub:', error.message);
      return { error: error.message };
    }
    return { club: data as Club };
  },

  async updateClub(clubId: string, ownerId: string, partial: Partial<CreateClubInput>): Promise<{ success: boolean; error?: string }> {
    if (!clubId || !ownerId) return { success: false, error: 'Geçersiz parametre.' };
    const update: any = { updated_at: new Date().toISOString() };
    if (partial.name !== undefined) {
      const n = (partial.name || '').trim();
      if (n.length < 2 || n.length > 50) return { success: false, error: 'İsim 2-50 karakter olmalı.' };
      update.name = n;
    }
    if (partial.description !== undefined) update.description = partial.description?.trim().slice(0, 500) || null;
    if (partial.avatar_url !== undefined) update.avatar_url = partial.avatar_url;
    if (partial.banner_url !== undefined) update.banner_url = partial.banner_url;
    if (partial.is_public !== undefined) update.is_public = partial.is_public;
    if (partial.is_premium !== undefined) update.is_premium = partial.is_premium;
    // slug değiştirme — UI'da yapma; istenirse ayrı RPC

    const { error } = await supabase.from('clubs').update(update).eq('id', clubId).eq('owner_id', ownerId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async deleteClub(clubId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('clubs').delete().eq('id', clubId).eq('owner_id', ownerId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // ── READ ────────────────────────────────────────────────────

  async getClub(clubId: string): Promise<Club | null> {
    if (!clubId) return null;
    const { data } = await supabase.from('clubs').select('*').eq('id', clubId).maybeSingle();
    return (data as Club) || null;
  },

  async getClubBySlug(slug: string): Promise<Club | null> {
    const norm = normalizeClubSlug(slug);
    if (!norm) return null;
    const { data } = await supabase.from('clubs').select('*').eq('slug', norm).maybeSingle();
    return (data as Club) || null;
  },

  /** Public kulüpler, member_count DESC. Discovery sayfası. */
  async listPublicClubs(limit = 30): Promise<Club[]> {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('is_public', true)
      .order('member_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) return [];
    return (data as Club[]) || [];
  },

  /** Kullanıcının üye olduğu kulüpler. */
  async listMyClubs(userId: string): Promise<Club[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from('club_members')
      .select('clubs(*)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });
    if (error) return [];
    return ((data as any[]) || [])
      .map(r => Array.isArray(r.clubs) ? r.clubs[0] : r.clubs)
      .filter(Boolean) as Club[];
  },

  // ── MEMBERSHIP ──────────────────────────────────────────────

  async joinClub(clubId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('join_club', { p_club_id: clubId, p_user_id: userId });
      if (error) return { success: false, error: error.message };
      return { success: !!data };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async leaveClub(clubId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('leave_club', { p_club_id: clubId, p_user_id: userId });
      if (error) return { success: false, error: error.message };
      return { success: !!data };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async getMyMembership(clubId: string, userId: string): Promise<ClubMember | null> {
    if (!clubId || !userId) return null;
    const { data } = await supabase
      .from('club_members')
      .select('*')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .maybeSingle();
    return (data as ClubMember) || null;
  },

  async getMembers(clubId: string, limit = 50): Promise<ClubMember[]> {
    if (!clubId) return [];
    const { data, error } = await supabase
      .from('club_members')
      .select(`
        club_id, user_id, role, joined_at,
        profile:profiles!user_id(id, display_name, avatar_url, username, subscription_tier, is_online, last_seen)
      `)
      .eq('club_id', clubId)
      .order('joined_at', { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) return [];
    return ((data as any[]) || []).map(r => ({
      ...r,
      profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
    })) as ClubMember[];
  },

  async setMemberRole(clubId: string, targetUserId: string, role: 'moderator' | 'member', byUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('set_club_member_role', {
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_new_role: role,
        p_by_user_id: byUserId,
      });
      if (error) return { success: false, error: error.message };
      return { success: !!data };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // ── CLUB ROOMS ──────────────────────────────────────────────

  async listClubRooms(clubId: string, limit = 30): Promise<{ room_id: string; pinned: boolean; created_at: string }[]> {
    if (!clubId) return [];
    const { data, error } = await supabase
      .from('club_rooms')
      .select('room_id, pinned, created_at')
      .eq('club_id', clubId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) return [];
    return data || [];
  },

  /** ★ v77 (2026-04-28): RPC ile yetki kontrolü server-side. Saldırgan REST bypass edemez. */
  async attachRoom(clubId: string, roomId: string, byUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('attach_room_to_club', {
        p_club_id: clubId,
        p_room_id: roomId,
        p_by_user_id: byUserId,
      });
      if (error) return { success: false, error: error.message };
      return { success: !!data };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  async detachRoom(clubId: string, roomId: string, byUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('detach_room_from_club', {
        p_club_id: clubId,
        p_room_id: roomId,
        p_by_user_id: byUserId,
      });
      if (error) return { success: false, error: error.message };
      return { success: !!data };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  /** ★ v77 (2026-04-28): Sahip Koroyu başka üyeye devreder. Eski sahip otomatik moderatör olur. */
  async transferOwnership(clubId: string, newOwnerId: string, byUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('transfer_club_ownership', {
        p_club_id: clubId,
        p_new_owner_id: newOwnerId,
        p_by_user_id: byUserId,
      });
      if (error) return { success: false, error: error.message };
      return { success: !!data };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  /**
   * Kulübe bağlı odaların (full Room datası ile) listesi.
   * club detail sayfasında "Kulüp Odaları" bölümünde kullanılır.
   */
  async listClubRoomsWithDetails(clubId: string): Promise<any[]> {
    if (!clubId) return [];
    const { data, error } = await supabase
      .from('club_rooms')
      .select(`
        room_id, pinned, created_at,
        room:rooms!room_id(
          id, name, description, category, is_live, listener_count,
          host_id, room_settings, boost_expires_at,
          host:profiles!host_id(id, display_name, avatar_url, username, subscription_tier)
        )
      `)
      .eq('club_id', clubId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (__DEV__) console.warn('[ClubService] listClubRoomsWithDetails:', error.message);
      return [];
    }
    return ((data as any[]) || [])
      .map(r => ({
        ...r,
        room: Array.isArray(r.room) ? r.room[0] : r.room,
      }))
      .filter(r => r.room); // null odaları (silinmiş) ele
  },

  // ── KICK & MODERATION ──────────────────────────────────────────

  /** Üyeyi kulüpten at (owner/mod) — RPC ile yetki kontrolü */
  async kickMember(clubId: string, targetUserId: string, byUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('kick_from_club', {
        p_club_id: clubId,
        p_target_user_id: targetUserId,
        p_by_user_id: byUserId,
      });
      if (error) return { success: false, error: error.message };
      return { success: !!data };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // ── TREASURY (Kolektif Boost) ──────────────────────────────────

  /** Üye SP'sini kulüp hazinesine bağışlar. Yeni hazine bakiyesini döner. */
  async contributeTreasury(clubId: string, amount: number, userId: string): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('contribute_to_club_treasury', {
        p_club_id: clubId,
        p_amount: amount,
        p_user_id: userId,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, newBalance: data as number };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // ★ 2026-04-27: DAVET KODU SİSTEMİ (v76)
  // ═══════════════════════════════════════════════════════════════

  /** Yeni davet kodu üret — sadece owner/admin. Eski kod invalidate olur. */
  async rotateInviteCode(clubId: string, byUserId: string): Promise<{ code?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('rotate_club_invite_code', {
        p_club_id: clubId,
        p_user_id: byUserId,
      });
      if (error) return { error: error.message };
      return { code: data as string };
    } catch (e: any) {
      return { error: e?.message || 'Davet kodu üretilemedi' };
    }
  },

  /** Kodla kulübe katıl. */
  async joinByInviteCode(code: string, userId: string): Promise<{ clubId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('join_club_by_invite_code', {
        p_code: code,
        p_user_id: userId,
      });
      if (error) return { error: error.message };
      return { clubId: data as string };
    } catch (e: any) {
      return { error: e?.message || 'Kodla katılım başarısız' };
    }
  },

  /** Hazineden kulüp odasını boost et (owner/mod) */
  async boostRoomWithTreasury(
    clubId: string,
    roomId: string,
    durationHours: 1 | 6,
    byUserId: string,
  ): Promise<{ success: boolean; cost?: number; newTreasury?: number; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('club_boost_room', {
        p_club_id: clubId,
        p_room_id: roomId,
        p_duration_hours: durationHours,
        p_by_user_id: byUserId,
      });
      if (error) return { success: false, error: error.message };
      const result = data as any;
      return {
        success: !!result?.success,
        cost: result?.cost,
        newTreasury: result?.new_treasury,
      };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },
};
