/**
 * SopranoChat — Veritabanı Servis Katmanı
 * ═══════════════════════════════════════════════════
 * Profil, Oda, Katılımcı, Mesaj, Markaşla işlemleri.
 * Keşfet algoritması, heartbeat, zombie temizliği.
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';
import { getRoomLimits, getBroadcastLimits, TIER_ORDER, isTierAtLeast, getTierLevel } from '../constants/tiers';
import type {
  Profile, Room, RoomParticipant, RoomSettings,
  SubscriptionTier, Message, InboxItem,
  StoreItem, UserPurchase,
} from '../types';
import { migrateLegacyTier, normalizeRole } from '../types';

// ── Yeni modüler servisler (re-export) ──────────────────
// Tier sabitleri
export { TIER_DEFINITIONS, TIER_ORDER, getRoomLimits, getBroadcastLimits, isTierAtLeast } from '../constants/tiers';
// Tipler — types/index.ts TEK KAYNAK (duplikat tanım yok)
export type { Profile, Room, RoomParticipant, RoomSettings } from '../types';
export type { Message, InboxItem } from '../types';
export type { SubscriptionTier, TierName } from '../types';
export { migrateLegacyTier } from '../types';

// ============================================
// PROFİL İŞLEMLERİ
// ============================================
export const ProfileService = {
  async get(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    // Legacy tier normalizasyonu
    if (data && data.tier && !data.subscription_tier) {
      (data as any).subscription_tier = migrateLegacyTier(data.tier);
    }
    return data as Profile;
  },

  async update(userId: string, updates: Partial<Profile>): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  },

  async setOnline(userId: string, isOnline: boolean): Promise<void> {
    await supabase
      .from('profiles')
      .update({ is_online: isOnline, last_seen: new Date().toISOString() })
      .eq('id', userId);
  },

  /** Kullanıcı adı müsait mi? */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('username', username);
    if (error) return false;
    return (count || 0) === 0;
  },

  /** Arama */
  async search(query: string, limit = 20): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(limit);
    if (error) throw error;
    return (data || []) as Profile[];
  },

  /** Yeni profil oluştur (ilk giriş sonrası) */
  async create(userId: string, profileData: Partial<Profile>): Promise<Profile> {
    const baseUsername = (profileData.username || `user_${userId.substring(0, 6)}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const username = `${baseUsername}_${userId.substring(0, 4)}`;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, ...profileData, username },
        { onConflict: 'id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  /** Profili öne çıkar (Boost) — SP ile */
  async boostProfile(userId: string, spCost: number = 50) {
    const profile = await ProfileService.get(userId);
    if (!profile || profile.system_points < spCost) {
      throw new Error('Yetersiz SP');
    }
    const boostUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        system_points: profile.system_points - spCost,
        profile_boost_expires_at: boostUntil,
      })
      .eq('id', userId);
    if (updateErr) throw updateErr;

    try {
      await supabase.from('sp_transactions').insert({
        user_id: userId,
        amount: -spCost,
        type: 'profile_boost',
        description: 'Profil Boost (1 saat)',
      });
    } catch { /* SP transaction opsiyonel */ }
    return { success: true, boost_expires_at: boostUntil };
  },
};

// ============================================
// ODA İŞLEMLERİ
// ============================================
export const RoomService = {
  /** Tekil oda getir */
  async get(roomId: string): Promise<Room> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('id', roomId)
      .single();
    if (error) throw error;
    return data as Room;
  },

  /**
   * ★ Keşfet — Canlı odaları çek (sıralama algoritması)
   * Sıralama katmanları:
   *   1. followed_categories
   *   2. frequent_categories
   *   3. boost_score
   *   4. concurrent_users (listener_count)
   *   5. gift_count (total_gifts)
   *   6. recency (created_at)
   *
   * @param userId Kategori tercihi sorgulamak için (optional)
   */
  async getLive(userId?: string): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('is_live', true)
      .order('listener_count', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    let rooms = (data || []) as Room[];

    // Boost sıralaması — aktif boost'lu odalar öne çıkar
    const now = new Date().toISOString();
    rooms.sort((a, b) => {
      const aBoost = (a as any).boost_score || 0;
      const bBoost = (b as any).boost_score || 0;
      const aActive = (a as any).boost_expires_at && (a as any).boost_expires_at > now;
      const bActive = (b as any).boost_expires_at && (b as any).boost_expires_at > now;
      // Aktif boost'lu odalar önce
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      // İkisi de aktifse boost_score'a göre
      if (aActive && bActive && aBoost !== bBoost) return bBoost - aBoost;
      // Sonra listener_count (zaten DB'den sıralı geliyor)
      return 0;
    });

    // Kullanıcı kategori tercihi varsa, tercih edilen kategorileri öne çıkar
    if (userId && rooms.length > 1) {
      const prefs = await this._getUserCategoryPreferences(userId);
      if (prefs.length > 0) {
        const prefSet = new Set(prefs.map(p => p.category));
        // Tercih edilen kategorilerdeki odaları öne al — boost sıralamasını bozmadan
        const boosted = rooms.filter(r => (r as any).boost_expires_at && (r as any).boost_expires_at > now);
        const preferred = rooms.filter(r => !((r as any).boost_expires_at && (r as any).boost_expires_at > now) && prefSet.has(r.category));
        const others = rooms.filter(r => !((r as any).boost_expires_at && (r as any).boost_expires_at > now) && !prefSet.has(r.category));
        rooms = [...boosted, ...preferred, ...others];
      }
    }

    // Gizli profil filtreleme — is_private kullanıcıların odalarını yalnızca takipçilere göster
    if (userId) {
      rooms = await this._filterPrivateRooms(rooms, userId);
    }

    return rooms;
  },

  /** Kullanıcının kategori tercihlerini getir */
  async _getUserCategoryPreferences(userId: string): Promise<{ category: string; score: number }[]> {
    try {
      const { data, error } = await supabase
        .from('user_category_preferences')
        .select('category, follow_score, visit_count')
        .eq('user_id', userId)
        .order('follow_score', { ascending: false })
        .order('visit_count', { ascending: false })
        .limit(10);
      if (error) return [];
      return (data || []).map(d => ({
        category: d.category,
        score: (d.follow_score || 0) + (d.visit_count || 0),
      }));
    } catch {
      return []; // Tablo yoksa sessizce devam et
    }
  },

  /** Kullanıcının oda kategorisi ziyaretini kaydet */
  async trackCategoryVisit(userId: string, category: string): Promise<void> {
    try {
      await supabase.rpc('increment_category_visit', {
        p_user_id: userId,
        p_category: category,
      });
    } catch {
      // RPC yoksa fallback: upsert
      try {
        const { data } = await supabase
          .from('user_category_preferences')
          .select('visit_count')
          .eq('user_id', userId)
          .eq('category', category)
          .maybeSingle();
        if (data) {
          await supabase
            .from('user_category_preferences')
            .update({ visit_count: (data.visit_count || 0) + 1, last_visited_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('category', category);
        } else {
          await supabase
            .from('user_category_preferences')
            .insert({ user_id: userId, category, visit_count: 1, follow_score: 0, last_visited_at: new Date().toISOString() });
        }
      } catch { /* tablo yoksa sessiz */ }
    }
  },

  /** Gizli profil odaları filtrele */
  async _filterPrivateRooms(rooms: Room[], viewerId: string): Promise<Room[]> {
    const filtered: Room[] = [];
    for (const room of rooms) {
      if (room.host && (room.host as any).is_private) {
        // Takipçi kontrolü
        const { data } = await supabase
          .from('friendships')
          .select('status')
          .eq('user_id', viewerId)
          .eq('friend_id', room.host_id)
          .eq('status', 'accepted')
          .maybeSingle();
        if (data || room.host_id === viewerId) {
          filtered.push(room);
        }
      } else {
        filtered.push(room);
      }
    }
    return filtered;
  },

  /**
   * ★ Heartbeat — Katılımcının hâlâ aktif olduğunu bildir.
   * room_participants tablosunda last_seen_at günceller.
   */
  async heartbeat(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /**
   * ★ Zombie Temizliği — 120 saniyeden uzun süredir heartbeat göndermeyen
   * katılımcıları otomatik çıkarır.
   */
  async cleanupZombies(roomId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 120_000).toISOString();
    try {
      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .lt('last_seen_at', cutoff);
    } catch { /* last_seen_at kolonu yoksa sessiz geç */ }
  },

  /**
   * ★ Listener Count Sync — Gerçek katılımcı sayısını
   * rooms tablosundaki listener_count ile eşitle.
   */
  async syncListenerCount(roomId: string): Promise<void> {
    try {
      const { count } = await supabase
        .from('room_participants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId);
      await supabase
        .from('rooms')
        .update({ listener_count: count || 0 })
        .eq('id', roomId);
    } catch { /* sessiz */ }
  },

  /**
   * ★ Kullanıcının sahip olduğu odaları getir (Odalarım sekmesi)
   */
  async getMyRooms(userId: string): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('host_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Room[];
  },

  /** Uyuyan odayı uyandır — is_live=true, süreyi sıfırla, host'u ekle */
  async wakeUpRoom(roomId: string, hostId: string, tier: SubscriptionTier = 'Free'): Promise<Room> {
    const limits = getRoomLimits(tier);

    // Süreyi tier'a göre yeniden hesapla
    const now = new Date();
    const expiresAt = limits.durationHours > 0
      ? new Date(now.getTime() + limits.durationHours * 60 * 60 * 1000).toISOString()
      : null; // VIP: süresiz

    // Odayı uyandır
    const { data, error } = await supabase
      .from('rooms')
      .update({
        is_live: true,
        created_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .eq('id', roomId)
      .eq('host_id', hostId)
      .select('*, host:profiles!host_id(*)')
      .single();

    if (error) throw new Error('Oda uyandırılamadı: ' + error.message);

    // Host'u katılımcı olarak ekle
    try {
      await supabase.from('room_participants').upsert({
        room_id: roomId,
        user_id: hostId,
        role: 'owner',
        joined_at: now.toISOString(),
      }, { onConflict: 'room_id,user_id' });
    } catch { /* upsert hatası sessiz */ }

    return data as Room;
  },

  /** Oda oluştur */
  async create(
    hostId: string,
    options: {
      name: string;
      category?: string;
      type?: string;
      description?: string;
      mode?: string;
      tags?: string[];
      language?: string;
      welcome_message?: string;
      rules?: string;
      room_password?: string;
    },
    tier: SubscriptionTier = 'Free'
  ): Promise<Room> {
    // Tier normalize et
    const normalizedTier = migrateLegacyTier(tier);
    const limits = getRoomLimits(normalizedTier);

    // Oda süresini hesapla
    const expiresAt = limits.durationHours > 0
      ? new Date(Date.now() + limits.durationHours * 60 * 60 * 1000).toISOString()
      : null; // Sınırsız süre

    const roomSettings: RoomSettings = {};
    if (options.welcome_message) roomSettings.welcome_message = options.welcome_message;
    if (options.rules) roomSettings.rules = options.rules;

    // Tüm kolonlarla dene, eksik kolon varsa minimal fallback
    let data: any;
    let error: any;

    // Önce tüm kolonlarla dene
    const fullInsert = {
      name: options.name,
      description: options.description || '',
      category: options.category || 'chat',
      type: options.type || 'open',
      host_id: hostId,
      is_live: true,
      listener_count: 0,
      max_speakers: limits.maxSpeakers,
      max_listeners: limits.maxListeners,
      max_cameras: limits.maxCameras,
      max_moderators: limits.maxModerators,
      owner_tier: normalizedTier,
      is_persistent: limits.persistent,
      language: options.language || 'tr',
      mode: options.mode || 'audio',
      tags: options.tags || [],
      room_settings: roomSettings,
      room_password: options.room_password || null,
      expires_at: expiresAt,
    };

    ({ data, error } = await supabase
      .from('rooms')
      .insert(fullInsert)
      .select('*, host:profiles!host_id(*)')
      .single());

    // Kolon hatası varsa, minimal insert ile tekrar dene
    if (error?.message?.includes('column') || error?.code === '42703') {
      // Ekstra verileri room_settings'e taşı
      (roomSettings as any).language = options.language || 'tr';
      (roomSettings as any).mode = options.mode || 'audio';
      (roomSettings as any).owner_tier = normalizedTier;
      (roomSettings as any).max_cameras = limits.maxCameras;
      (roomSettings as any).max_moderators = limits.maxModerators;
      (roomSettings as any).is_persistent = limits.persistent;
      if (options.room_password) (roomSettings as any).room_password = options.room_password;

      ({ data, error } = await supabase
        .from('rooms')
        .insert({
          name: options.name,
          description: options.description || '',
          category: options.category || 'chat',
          type: options.type || 'open',
          host_id: hostId,
          is_live: true,
          listener_count: 0,
          max_speakers: limits.maxSpeakers,
          max_listeners: limits.maxListeners,
          tags: options.tags || [],
          room_settings: roomSettings,
          expires_at: expiresAt,
        })
        .select('*, host:profiles!host_id(*)')
        .single());
    }
    if (error) throw error;

    // Host'u owner olarak katılımcıya ekle
    await supabase.from('room_participants').insert({
      room_id: (data as Room).id,
      user_id: hostId,
      role: 'owner',
      is_muted: false,
    });

    return data as Room;
  },

  /** Odaya katıl */
  async join(roomId: string, userId: string, roleHint?: string): Promise<RoomParticipant> {
    // ★ Ban kontrolü — banlı kullanıcı giremez
    const banned = await this.isBanned(roomId, userId);
    if (banned) {
      throw new Error('Bu odaya erişiminiz yasaklanmıştır.');
    }

    // ★ Kilitli oda kontrolü — room_settings.is_locked (JSONB tek kaynak)
    const { data: lockCheck } = await supabase
      .from('rooms')
      .select('room_settings, host_id')
      .eq('id', roomId)
      .single();
    const lockSettings = (lockCheck?.room_settings || {}) as any;
    if (lockSettings.is_locked && lockCheck?.host_id !== userId) {
      throw new Error('Bu oda şu an kilitli. Yeni giriş kabul edilmiyor.');
    }

    // ★ Zaten katılımcı mı kontrol et
    const { data: existing } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return existing as RoomParticipant;
    }

    // ★ Original Host Recovery — oda sahibi geri dönüyorsa owner olarak ata
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, room_settings, owner_tier')
      .eq('id', roomId)
      .single();

    let role: string = 'listener';
    if (room) {
      const settings = (room.room_settings || {}) as RoomSettings;
      if (settings.original_host_id === userId || room.host_id === userId) {
        role = 'owner';
        // Host geri dönüyorsa room'un host_id'sini güncelle
        if (room.host_id !== userId) {
          await supabase
            .from('rooms')
            .update({ host_id: userId })
            .eq('id', roomId);

          // Mevcut "geçici host"u speaker'a düşür
          await supabase
            .from('room_participants')
            .update({ role: 'speaker' })
            .eq('room_id', roomId)
            .eq('role', 'owner');
        }
      } else {
        // Dinleyici grid doluysa spectator olarak ekle
        const { count } = await supabase
          .from('room_participants')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .eq('role', 'listener');

        // ★ BUG FIX: Sabit 20 yerine tier bazlı maxListeners kullan
        const roomOwnerTier = migrateLegacyTier(room.owner_tier);
        const roomLimits = getRoomLimits(roomOwnerTier);
        if ((count || 0) >= roomLimits.maxListeners) {
          role = 'spectator';
        }
      }
    }

    const { data, error } = await supabase
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: userId,
        role,
        is_muted: true,
      })
      .select('*, user:profiles!user_id(*)')
      .single();

    if (error) throw error;

    // Dinleyici sayısını artır
    await supabase.rpc('increment_listener_count', { room_id_input: roomId });

    return data as RoomParticipant;
  },

  /** Odadan ayrıl */
  async leave(roomId: string, userId: string): Promise<void> {
    // Katılımcıyı sil
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    // Dinleyici sayısını azalt
    await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
  },

  /** Oda katılımcılarını getir (ghost filtreleme opsiyonel) */
  async getParticipants(roomId: string): Promise<RoomParticipant[]> {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*, user:profiles!user_id(*)')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    if (error) throw error;

    return (data || []).map((p: any) => ({
      ...p,
      role: normalizeRole(p.role), // Legacy 'host' → 'owner'
    })) as RoomParticipant[];
  },

  /** Oda ayarlarını güncelle */
  async updateSettings(roomId: string, hostId: string, updates: Partial<Room & { room_settings?: Partial<RoomSettings> }>): Promise<void> {
    // Odanın gerçekten bu host'a ait olduğunu doğrula
    const { data: room } = await supabase.from('rooms').select('host_id, room_settings').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error('Bu odanın sahibi değilsiniz');

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.max_listeners !== undefined) dbUpdates.max_listeners = updates.max_listeners;
    if (updates.max_speakers !== undefined) dbUpdates.max_speakers = updates.max_speakers;
    if (updates.max_cameras !== undefined) dbUpdates.max_cameras = updates.max_cameras;
    if (updates.max_moderators !== undefined) dbUpdates.max_moderators = updates.max_moderators;

    // room_settings JSONB merge
    if (updates.room_settings) {
      const existingSettings = (room.room_settings || {}) as RoomSettings;
      dbUpdates.room_settings = { ...existingSettings, ...updates.room_settings };
    }

    const { error } = await supabase.from('rooms').update(dbUpdates).eq('id', roomId);
    if (error) throw error;
  },

  /** Odayı sil (kalıcı oda) */
  async deleteRoom(roomId: string, hostId: string): Promise<void> {
    const { data: room } = await supabase.from('rooms').select('host_id').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error('Bu odanın sahibi değilsiniz');

    // Katılımcıları temizle
    await supabase.from('room_participants').delete().eq('room_id', roomId);
    // Odayı sil
    await supabase.from('rooms').delete().eq('id', roomId);
  },

  /** Odayı kapat (geçici oda) */
  async close(roomId: string): Promise<void> {
    await supabase.from('rooms').update({ is_live: false }).eq('id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
  },

  /**
   * Oda süresi doldu mu? Tier-bazlı süre kontrolü
   * Hardcoded 3-saat fallback kaldırıldı.
   */
  isExpired(room: Partial<Room>): boolean {
    if (!room.expires_at) return false; // Sınırsız süre (VIP/Gold 24h+)
    return new Date(room.expires_at) < new Date();
  },


  /** ★ Oda temasını değiştir (host + Silver+ gerekli) */
  async setRoomTheme(roomId: string, hostId: string, themeId: string | null) {
    const { data: room } = await supabase.from('rooms').select('host_id, owner_tier').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error('Bu odanın sahibi değilsiniz');
    // ★ Tier guard: Silver+ gerekli
    const tier = migrateLegacyTier(room.owner_tier);
    if (!isTierAtLeast(tier, 'Silver')) throw new Error('Tema değiştirmek için Silver+ üyelik gerekli.');
    const { error } = await supabase.from('rooms').update({ theme_id: themeId }).eq('id', roomId);
    if (error) throw error;
  },

  /**
   * Konuşmacı olmak için el kaldır.
   * subscription_tier bazlı öncelik sıralaması.
   */
  async requestToSpeak(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ role: 'pending_speaker', hand_raised_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /**
   * Host: Bekleyen konuşmacıları getir.
   * subscription_tier bazlı öncelik sıralaması
   * (ücretli aboneler öne alınır).
   */
  async getPendingSpeakers(roomId: string): Promise<RoomParticipant[]> {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*, user:profiles!user_id(*)')
      .eq('room_id', roomId)
      .eq('role', 'pending_speaker')
      .order('joined_at', { ascending: true });
    if (error) throw error;

    const participants = (data || []) as (RoomParticipant & { user?: Profile })[];

    // subscription_tier bazlı sıralama (VIP > Gold > Silver > Bronze > Free)
    participants.sort((a, b) => {
      const aTier = migrateLegacyTier((a.user as any)?.subscription_tier || (a.user as any)?.tier);
      const bTier = migrateLegacyTier((b.user as any)?.subscription_tier || (b.user as any)?.tier);
      const aLevel = getTierLevel(aTier);
      const bLevel = getTierLevel(bTier);
      if (aLevel !== bLevel) return bLevel - aLevel; // Yüksek tier önce
      return 0; // Aynı tier → joined_at sırasını koru
    });

    return participants;
  },

  /** Host: Kullanıcıyı konuşmacıya yükselt */
  async promoteSpeaker(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ role: 'speaker', is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** Host: Konuşmacıyı dinleyiciye düşür */
  async demoteSpeaker(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ role: 'listener', is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** Host: Kullanıcıyı moderatör yap */
  async setModerator(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ role: 'moderator', is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** Host/Mod: Kullanıcının moderatörlüğünü kaldır */
  async removeModerator(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ role: 'speaker' })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** Odadaki moderatör sayısını getir */
  async getModeratorCount(roomId: string): Promise<number> {
    const { count, error } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('role', 'moderator');
    if (error) return 0;
    return count || 0;
  },

  /**
   * Host çıkınca: Yetki zinciri ile devret (Mod → Speaker → Uyku/Kapanış)
   *
   *   Free: Oda kapanır (close)
   *   Bronze: 60sn geri sayım (countdown_60s)
   *   Silver+: Uyku modu (sleep — oda kapanmaz, tekrar açılabilir)
   */
  async transferHost(roomId: string, oldHostId: string): Promise<{ newHostId: string | null; sleepMode?: boolean }> {
    // Odanın bilgilerini al
    const { data: roomInfo } = await supabase
      .from('rooms')
      .select('is_persistent, owner_tier, room_settings')
      .eq('id', roomId)
      .single();

    const ownerTier = migrateLegacyTier(roomInfo?.owner_tier);
    const limits = getRoomLimits(ownerTier);
    const isPersistent = roomInfo?.is_persistent || false;

    // ── Adım 1: En eski moderatörü bul ──
    const { data: mods } = await supabase
      .from('room_participants')
      .select('user_id, joined_at')
      .eq('room_id', roomId)
      .eq('role', 'moderator')
      .order('joined_at', { ascending: true })
      .limit(1);

    let newHostId: string | null = null;

    if (mods && mods.length > 0) {
      newHostId = mods[0].user_id;
    } else {
      // ── Adım 2: Moderatör yok — en eski speaker'ı bul ──
      const { data: speakers } = await supabase
        .from('room_participants')
        .select('user_id, joined_at')
        .eq('room_id', roomId)
        .eq('role', 'speaker')
        .neq('user_id', oldHostId)
        .order('joined_at', { ascending: true })
        .limit(1);

      if (speakers && speakers.length > 0) {
        newHostId = speakers[0].user_id;
      }
    }

    // ── Devir yapılacak biri BULUNDU ──
    if (newHostId) {
      await supabase
        .from('room_participants')
        .update({ role: 'owner' })
        .eq('room_id', roomId)
        .eq('user_id', newHostId);

      const updatedSettings = {
        ...(roomInfo?.room_settings || {}),
        original_host_id: oldHostId,
      };
      await supabase
        .from('rooms')
        .update({ host_id: newHostId, room_settings: updatedSettings })
        .eq('id', roomId);

      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', oldHostId);

      await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
      return { newHostId };
    }

    // ── Kimse bulunamadı ──
    if (isPersistent || limits.ownerLeavePolicy === 'sleep') {
      // Silver+: Uyku moduna al — oda kapanmaz, tekrar açılabilir
      const updatedSettings = {
        ...(roomInfo?.room_settings || {}),
        original_host_id: oldHostId,
      };
      await supabase
        .from('rooms')
        .update({ is_live: false, room_settings: updatedSettings })
        .eq('id', roomId);

      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId);

      return { newHostId: null, sleepMode: true };
    }

    // Free (close) / Bronze (countdown_60s): null döner → frontend davranış belirler
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', oldHostId);
    await supabase.rpc('decrement_listener_count', { room_id_input: roomId });

    return { newHostId: null, sleepMode: false };
  },

  /** Host/Mod: Kullanıcıyı metin sohbetinde sustur/aç */
  async setChatMute(roomId: string, userId: string, muted: boolean): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ is_chat_muted: muted })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  // ════════════════════════════════════════════════════════════
  // ODA TAKİP SİSTEMİ (v4)
  // ════════════════════════════════════════════════════════════

  /** Odayı takip et */
  async followRoom(roomId: string, userId: string): Promise<void> {
    await supabase.from('room_followers').upsert(
      { room_id: roomId, user_id: userId, followed_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id' }
    );
  },

  /** Oda takibini bırak */
  async unfollowRoom(roomId: string, userId: string): Promise<void> {
    await supabase.from('room_followers').delete().eq('room_id', roomId).eq('user_id', userId);
  },

  /** Odayı takip ediyor mu? */
  async isFollowingRoom(roomId: string, userId: string): Promise<boolean> {
    const { data } = await supabase.from('room_followers').select('id').eq('room_id', roomId).eq('user_id', userId).maybeSingle();
    return !!data;
  },

  /** Oda takipçi sayısı */
  async getRoomFollowerCount(roomId: string): Promise<number> {
    const { count } = await supabase.from('room_followers').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
    return count || 0;
  },

  // ════════════════════════════════════════════════════════════
  // ODA DAVET SİSTEMİ (v4)
  // ════════════════════════════════════════════════════════════

  /** Davet linki oluştur (deep link) */
  generateInviteLink(roomId: string): string {
    return `https://sopranochat.app/room/${roomId}`;
  },

  /** Uygulama içi arkadaşlarını davete gönder */
  async sendRoomInvite(roomId: string, fromUserId: string, toUserIds: string[]): Promise<void> {
    const inserts = toUserIds.map(uid => ({
      room_id: roomId,
      user_id: uid,
      invited_by: fromUserId,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));
    await supabase.from('room_invites').insert(inserts);

    // Push bildirim (toplu)
    for (const uid of toUserIds) {
      try {
        await PushService.sendToUser(uid, 'Oda Daveti', 'Bir odaya davet edildiniz!', { type: 'room_invite' as any, route: `/room/${roomId}` });
      } catch { /* push başarısız olabilir */ }
    }
  },

  // ════════════════════════════════════════════════════════════
  // OWNER SÜPER GÜÇLERİ (v4)
  // ════════════════════════════════════════════════════════════

  /** 👻 Ghost Mode — Owner görünmez olur (katılımcı listesinde gizlenir) */
  async setGhostMode(roomId: string, userId: string, isGhost: boolean): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ is_ghost: isGhost })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** 🎭 Kılık Değiştirme — Hedef kullanıcının adı/avatarı geçici değişir */
  async setDisguise(
    roomId: string,
    targetUserId: string,
    disguise: { display_name: string; avatar_url: string; applied_by: string } | null,
  ): Promise<void> {
    await supabase
      .from('room_participants')
      .update({
        disguise: disguise
          ? { ...disguise, applied_at: new Date().toISOString() }
          : null,
      })
      .eq('room_id', roomId)
      .eq('user_id', targetUserId);
  },

  /** 🔒 Oda Kilidi — Yeni girişleri engelle/aç (room_settings JSONB üzerinden) */
  async setRoomLock(roomId: string, locked: boolean): Promise<void> {
    // ★ BUG-5 FIX: room_settings JSONB tek kaynak — direkt kolon yerine
    const { data: room } = await supabase
      .from('rooms')
      .select('room_settings')
      .eq('id', roomId)
      .single();
    const existingSettings = (room?.room_settings || {}) as any;
    await supabase
      .from('rooms')
      .update({ room_settings: { ...existingSettings, is_locked: locked } })
      .eq('id', roomId);
  },

  /** 🚫 Kullanıcıyı odadan at (yeniden katılabilir) */
  async kickUser(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
    try { await supabase.rpc('decrement_listener_count', { room_id_input: roomId }); } catch {}
  },

  /** ⛔ Geçici ban (dakika cinsinden) */
  async banTemporary(roomId: string, userId: string, durationMinutes: number): Promise<void> {
    const banUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    // Rol → banned, ban_until set
    await supabase
      .from('room_participants')
      .update({ role: 'banned', muted_until: banUntil })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    // Ban kaydı
    try {
      await supabase.from('room_bans').insert({
        room_id: roomId,
        user_id: userId,
        ban_type: 'temporary',
        expires_at: banUntil,
      });
    } catch { /* tablo yoksa sessiz */ }
  },

  /** ⛔ Kalıcı ban (sadece owner) */
  async banPermanent(roomId: string, userId: string): Promise<void> {
    // Participantı sil
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
    try { await supabase.rpc('decrement_listener_count', { room_id_input: roomId }); } catch {}
    // Kalıcı ban kaydı
    try {
      await supabase.from('room_bans').insert({
        room_id: roomId,
        user_id: userId,
        ban_type: 'permanent',
        expires_at: null,
      });
    } catch { /* tablo yoksa sessiz */ }
  },

  /** Ban kontrolü — kullanıcı bu odada banlı mı? */
  async isBanned(roomId: string, userId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('room_bans')
        .select('id, ban_type, expires_at')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return false;
      if (data.ban_type === 'permanent') return true;
      if (data.expires_at && new Date(data.expires_at) > new Date()) return true;
      return false;
    } catch { return false; }
  },

  /** Spectator → Listener yükseltme */
  async promoteToListener(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ role: 'listener' })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /**
   * Süresi dolan + boş + terk edilmiş odaları otomatik kapat/uyut.
   * Tier-bazlı süre/uyku mantığı
   */
  async autoCloseExpired(): Promise<number> {
    const now = new Date().toISOString();
    let closedCount = 0;

    // 1. expires_at set edilmiş ve süresi geçmiş odaları kapat
    const { data: expired } = await supabase
      .from('rooms')
      .select('id, is_persistent')
      .eq('is_live', true)
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (expired && expired.length > 0) {
      for (const room of expired) {
        if (room.is_persistent) {
          // Kalıcı oda — uyku moduna al
          await supabase.from('rooms').update({ is_live: false }).eq('id', room.id);
        } else {
          // Geçici oda — kapat
          await supabase.from('rooms').update({ is_live: false }).eq('id', room.id);
        }
        await supabase.from('room_participants').delete().eq('room_id', room.id);
      }
      closedCount += expired.length;
    }

    // 2. Boş odaları kapat/uyut
    const { data: liveRooms } = await supabase
      .from('rooms')
      .select('id, is_persistent')
      .eq('is_live', true);

    if (liveRooms && liveRooms.length > 0) {
      for (const room of liveRooms) {
        const { count } = await supabase
          .from('room_participants')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', room.id);

        if (count === 0) {
          await supabase.from('rooms').update({ is_live: false }).eq('id', room.id);
          closedCount++;
          if (__DEV__) console.log(`[AutoClose] Boş oda ${room.is_persistent ? 'uyutuldu' : 'kapatıldı'}: ${room.id}`);
        }
      }
    }

    // 3. Host'suz odaları kontrol et
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: hostlessRooms } = await supabase
      .from('rooms')
      .select('id, host_id, is_persistent')
      .eq('is_live', true)
      .lt('created_at', tenMinutesAgo);

    if (hostlessRooms && hostlessRooms.length > 0) {
      for (const room of hostlessRooms) {
        const { data: hostP } = await supabase
          .from('room_participants')
          .select('id')
          .eq('room_id', room.id)
          .eq('role', 'owner')
          .maybeSingle();

        if (!hostP) {
          const { count: authCount } = await supabase
            .from('room_participants')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .in('role', ['moderator', 'speaker']);

          if (!authCount || authCount === 0) {
            await supabase.from('rooms').update({ is_live: false }).eq('id', room.id);
            await supabase.from('room_participants').delete().eq('room_id', room.id);
            closedCount++;
            if (__DEV__) console.log(`[AutoClose] Yetkisiz oda ${room.is_persistent ? 'uyutuldu' : 'kapatıldı'}: ${room.id}`);
          }
        }
      }
    }

    return closedCount;
  },

  // ════════════════════════════════════════════════════════════
  // ODA BOOST (SP harcama ile keşfette öne çıkarma)
  // ════════════════════════════════════════════════════════════

  /**
   * Odayı SP harcayarak boost et — keşfette öne çıkar.
   * 100 SP = 1 saat boost. boost_score artar, boost_expires_at güncellenir.
   */
  async boostRoom(roomId: string, userId: string, spAmount: number): Promise<{ success: boolean; error?: string }> {
    try {
      // SP bakiyesini kontrol et
      const { data: profile } = await supabase
        .from('profiles')
        .select('system_points')
        .eq('id', userId)
        .single();

      if (!profile || (profile.system_points || 0) < spAmount) {
        return { success: false, error: 'Yetersiz SP bakiyesi' };
      }

      const boostHours = Math.floor(spAmount / 100);
      if (boostHours < 1) return { success: false, error: 'Minimum 100 SP gerekli' };

      const boostUntil = new Date(Date.now() + boostHours * 60 * 60 * 1000).toISOString();

      // SP düş
      await supabase
        .from('profiles')
        .update({ system_points: (profile.system_points || 0) - spAmount })
        .eq('id', userId);

      // Boost uygula
      const { data: room } = await supabase
        .from('rooms')
        .select('boost_score')
        .eq('id', roomId)
        .single();

      await supabase
        .from('rooms')
        .update({
          boost_score: (room?.boost_score || 0) + spAmount,
          boost_expires_at: boostUntil,
        })
        .eq('id', roomId);

      // SP log
      try {
        await supabase.from('sp_transactions').insert({
          user_id: userId,
          amount: -spAmount,
          type: 'room_boost',
          description: `Oda boost: ${boostHours} saat`,
        });
      } catch { /* sp_transactions yoksa sessiz */ }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  // ════════════════════════════════════════════════════════════
  // ERİŞİM İSTEKLERİ (Davetli/Kapalı Odalar)
  // Hiyerarşi: Owner → Moderator → Speaker
  // ════════════════════════════════════════════════════════════

  /**
   * Odaya giriş isteği gönder.
   * İstek, odadaki en yetkili kişiye yönlendirilir.
   */
  async sendAccessRequest(roomId: string, userId: string): Promise<{ sent: boolean; targetRole: string }> {
    // En yetkili katılımcıyı bul: owner > moderator > speaker
    const { data: participants } = await supabase
      .from('room_participants')
      .select('user_id, role')
      .eq('room_id', roomId)
      .in('role', ['owner', 'moderator', 'speaker'])
      .order('role', { ascending: true }); // owner ilk gelir (alfabetik)

    // Rol önceliği: owner > moderator > speaker
    const rolePriority: Record<string, number> = { owner: 0, moderator: 1, speaker: 2 };
    const sorted = (participants || []).sort((a, b) =>
      (rolePriority[a.role] ?? 9) - (rolePriority[b.role] ?? 9)
    );
    const target = sorted[0];
    const targetRole = target?.role || 'owner';

    await supabase.from('room_access_requests').insert({
      room_id: roomId,
      user_id: userId,
      status: 'pending',
      target_role: targetRole,
    });

    // Push bildirim gönder (varsa)
    if (target) {
      try {
        await PushService.sendToUser(target.user_id, 'Oda Giriş İsteği', 'Birisi odanıza katılmak istiyor', { type: 'room_request' as any, route: `/room/${roomId}` });
      } catch { /* push başarısız olabilir */ }
    }

    return { sent: true, targetRole };
  },

  /** Bekleyen erişim isteklerini getir */
  async getRoomAccessRequests(roomId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('room_access_requests')
        .select('*, user:profiles!user_id(*)')
        .eq('room_id', roomId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    } catch { return []; }
  },

  /** Erişim isteğini kabul et */
  async acceptRequest(requestId: string, handlerId: string): Promise<void> {
    const { data } = await supabase
      .from('room_access_requests')
      .update({ status: 'accepted', handled_by: handlerId })
      .eq('id', requestId)
      .select('room_id, user_id')
      .single();

    if (data) {
      // Kullanıcıyı odaya listener olarak ekle
      await supabase.from('room_participants').insert({
        room_id: data.room_id,
        user_id: data.user_id,
        role: 'listener',
        is_muted: true,
      });
    }
  },

  /** Erişim isteğini reddet */
  async rejectRequest(requestId: string, handlerId: string): Promise<void> {
    await supabase
      .from('room_access_requests')
      .update({ status: 'rejected', handled_by: handlerId })
      .eq('id', requestId);
  },

  // ════════════════════════════════════════════════════════════
  // ODA KAPATMA
  // ════════════════════════════════════════════════════════════

  /** Odayı tamamen kapat (owner veya admin tarafından) */
  async closeRoom(roomId: string): Promise<void> {
    await supabase.from('rooms').update({ is_live: false }).eq('id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
  },
};

// ============================================
// MESAJ İŞLEMLERİ
// ============================================
export const MessageService = {
  /** Gelen kutusunu (Inbox) getir (N+1 engellenmiş RPC ile) */
  async getInbox(userId: string) {
    const { data, error } = await supabase.rpc('get_user_inbox', { p_user_id: userId });
    if (error) throw error;
    return (data || []) as InboxItem[];
  },

  /** İki kişi arasındaki tüm konuşma geçmişini getir */
  async getConversation(user1Id: string, user2Id: string, limit = 50) {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .or(`and(sender_id.eq.${user1Id},receiver_id.eq.${user2Id}),and(sender_id.eq.${user2Id},receiver_id.eq.${user1Id})`)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []) as Message[];
  },

  /** Yeni mesaj gönder — voice_url/voice_duration desteği */
  async send(senderId: string, receiverId: string, content: string, imageUrl?: string, voiceUrl?: string, voiceDuration?: number) {
    const insertData: any = { sender_id: senderId, receiver_id: receiverId, content };
    if (imageUrl) insertData.image_url = imageUrl;
    if (voiceUrl) insertData.voice_url = voiceUrl;
    if (voiceDuration !== undefined) insertData.voice_duration = voiceDuration;

    const { data: msg, error } = await supabase
      .from('messages')
      .insert(insertData)
      .select('*, sender:profiles!sender_id(*)')
      .single();
    if (error) throw error;

    // Push bildirim gönder (arka planda, hata yutulur)
    const senderName = (msg as any).sender?.display_name || 'Birisi';
    const preview = voiceUrl ? '🎙️ Sesli mesaj' : imageUrl ? '📷 Fotoğraf' : (content.length > 50 ? content.substring(0, 50) + '...' : content);
    PushService.sendToUser(receiverId, 'Yeni Mesaj', `${senderName}: ${preview}`, {
      type: 'dm',
      route: `/chat/${senderId}`,
    }).catch(() => {});

    return msg as Message;
  },

  /** Karşı tarafın gönderdiği mesajları okundu olarak işaretle */
  async markAsRead(currentUserId: string, otherUserId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', currentUserId)
      .eq('sender_id', otherUserId)
      .eq('is_read', false);
    if (error && error.code !== 'PGRST116') {
      if (__DEV__) console.warn('Okundu işaretleme hatası:', error.message);
    }
  },

  /** Mesaj sil (sadece kendi gönderdiğin mesajlar) */
  async deleteMessage(messageId: string, senderId: string) {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', senderId);
    if (error) throw error;
  },

  /** Okunmamış toplam mesaj sayısı (genel) */
  async getUnreadCount(userId: string) {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count || 0;
  },

  /** Realtime Yeni Mesaj Dinleyici */
  onNewMessage(userId: string, callback: (msg: Message) => void) {
    const channelName = `user_messages_${userId}`;
    // Önce varolan kanalı temizle (duplicate önleme)
    const existing = supabase.channel(channelName);
    try { supabase.removeChannel(existing); } catch { /* ilk çağrıda kanal olmayabilir */ }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const { data } = await supabase.from('messages').select('*, sender:profiles!sender_id(*)').eq('id', payload.new.id).single();
          if (data) callback(data as Message);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => { supabase.removeChannel(channel); },
    };
  },

  /** Yazıyor... (Typing Indicator) - Gönderici */
  _typingChannels: new Map<string, ReturnType<typeof supabase.channel>>(),

  async sendTypingStatus(senderId: string, receiverId: string, isTyping: boolean) {
    const channelKey = `typing_send_${receiverId}`;
    let channel = this._typingChannels.get(channelKey);

    if (!channel) {
      channel = supabase.channel(`typing_${receiverId}`, {
        config: { broadcast: { self: false } },
      });
      await new Promise<void>((resolve) => {
        channel!.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
        });
        setTimeout(resolve, 2000);
      });
      this._typingChannels.set(channelKey, channel);
    }

    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: senderId, is_typing: isTyping, conversation_partner_id: receiverId },
    });
  },

  /** Chat ekranından çıkıldığında typing kanalını temizle */
  cleanupTypingChannel(receiverId: string) {
    const channelKey = `typing_send_${receiverId}`;
    const channel = this._typingChannels.get(channelKey);
    if (channel) {
      try { supabase.removeChannel(channel); } catch { /* silent */ }
      this._typingChannels.delete(channelKey);
    }
  },

  /** Yazıyor... (Typing Indicator) - Dinleyici */
  onTypingStatus(currentUserId: string, callback: (payload: { user_id: string, is_typing: boolean, conversation_partner_id: string }) => void) {
    const channelName = `typing_${currentUserId}`;
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing' }, (payload) => {
        callback(payload.payload as any);
      })
      .subscribe();
    return { unsubscribe: () => { supabase.removeChannel(channel); } };
  }
};

// ============================================
// SİSTEM PUANLARI (SP) İŞLEMLERİ
// ============================================
export const SPService = {
  /** SP bakiyesi getir */
  async getBalance(userId: string) {
    const profile = await ProfileService.get(userId);
    return profile?.system_points ?? 0;
  },

  /** SP ekle/çıkar + işlem kaydı */
  async transaction(userId: string, amount: number, type: string, description: string) {
    try {
      const { error: rpcError } = await supabase.rpc('grant_system_points', {
        p_user_id: userId,
        p_amount: amount,
        p_action: type,
      });
      if (!rpcError) return { success: true };
    } catch {}

    // Fallback: manuel
    const profile = await ProfileService.get(userId);
    if (!profile) throw new Error('Profil bulunamadı');
    const newTotal = (profile.system_points || 0) + amount;
    if (newTotal < 0) throw new Error('Yetersiz SP');
    await supabase.from('profiles').update({ system_points: newTotal }).eq('id', userId);

    try {
      await supabase.from('sp_transactions').insert({
        user_id: userId, amount, type, description: description || null,
      });
    } catch {}

    return { success: true };
  },

  /** SP işlem geçmişi */
  async getHistory(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('sp_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};

// ============================================
// REALTIME — Oda dinleyicisi
// ============================================
export const RealtimeService = {
  /** Oda katılımcı değişikliklerini dinle */
  onRoomChange(roomId: string, callback: (participants: RoomParticipant[]) => void) {
    const handler = async () => {
      try {
        const participants = await RoomService.getParticipants(roomId);
        callback(participants);
      } catch (e) {
        if (__DEV__) console.warn('[Realtime] getParticipants hatası:', e);
      }
    };
    return supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, handler)
      .subscribe();
  },

  /** Oda listesi değişikliklerini dinle */
  onRoomsChange(callback: (rooms: Room[]) => void) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handler = async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const rooms = await RoomService.getLive();
        callback(rooms);
      }, 500);
    };
    return supabase
      .channel('rooms:all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, handler)
      .subscribe();
  },

  /** Belirli bir odanın durum değişikliklerini dinle */
  onRoomStatusChange(roomId: string, callback: (room: Room) => void) {
    return supabase
      .channel(`room_status:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        async () => {
          try {
            const room = await RoomService.get(roomId);
            callback(room);
          } catch {}
        }
      )
      .subscribe();
  },

  /** Kanaldan çık */
  unsubscribe(channel: ReturnType<typeof supabase.channel>) {
    supabase.removeChannel(channel);
  },
};

// ── Hardcoded mağaza kataloğu (DB tablosu eklenince kaldırılacak) ──
const STORE_CATALOG: StoreItem[] = [
  { id: 'frame_neon_teal', name: 'Neon Teal Çerçeve', description: 'Parlak teal renkli profil çerçevesi', type: 'profile_frame', price: 500, image_url: '', rarity: 'rare', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'frame_gold_crown', name: 'Altın Taç Çerçeve', description: 'Prestige altın taç efektli çerçeve', type: 'profile_frame', price: 1500, image_url: '', rarity: 'legendary', is_limited: true, is_active: true, created_at: '2026-01-01' },
  { id: 'frame_diamond_ring', name: 'Elmas Yüzük Çerçeve', description: 'Pırıl pırıl elmas efektli çerçeve', type: 'profile_frame', price: 2000, image_url: '', rarity: 'legendary', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'frame_purple_aura', name: 'Mor Aura Çerçeve', description: 'Gizemli mor ışıltılı çerçeve', type: 'profile_frame', price: 800, image_url: '', rarity: 'epic', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'chat_ocean_blue', name: 'Okyanus Mavisi', description: 'Sohbet balonlarına okyanus mavisi renk', type: 'chat_bubble', price: 300, image_url: '', rarity: 'common', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'chat_sunset_orange', name: 'Gün Batımı', description: 'Sıcak turuncu sohbet rengi', type: 'chat_bubble', price: 300, image_url: '', rarity: 'common', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'chat_galaxy_purple', name: 'Galaksi Moru', description: 'Uzay temalı mor sohbet rengi', type: 'chat_bubble', price: 600, image_url: '', rarity: 'rare', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'entry_sparkle', name: 'Parıltı Girişi', description: 'Odaya girerken parıltılı efekt', type: 'entry_effect', price: 1000, image_url: '', rarity: 'epic', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'entry_thunder', name: 'Şimşek Girişi', description: 'Güçlü şimşek efektiyle giriş', type: 'entry_effect', price: 1500, image_url: '', rarity: 'legendary', is_limited: false, is_active: true, created_at: '2026-01-01' },
  { id: 'theme_midnight', name: 'Gece Yarısı Teması', description: 'Koyu mor ve yıldızlı oda teması', type: 'room_theme', price: 800, image_url: '', rarity: 'epic', is_limited: false, is_active: true, created_at: '2026-01-01' },
];

// ============================================
// MAĞAZA İŞLEMLERİ (STORE & WALLET)
// ============================================
export const StoreService = {
  async getStoreItems(): Promise<StoreItem[]> {
    return STORE_CATALOG;
  },

  async getUserPurchases(userId: string): Promise<UserPurchase[]> {
    const ids = await this.getUserPurchasedIds(userId);
    return ids.map(itemId => ({
      id: `${userId}_${itemId}`,
      user_id: userId,
      item_id: itemId,
      purchased_at: new Date().toISOString(),
    }));
  },

  async getUserPurchasedIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('purchased_items')
        .eq('id', userId)
        .single();
      if (error || !data) return [];
      return Array.isArray(data.purchased_items) ? data.purchased_items : [];
    } catch {
      return [];
    }
  },

  async hasUserPurchased(userId: string, itemId: string): Promise<boolean> {
    const ids = await StoreService.getUserPurchasedIds(userId);
    return ids.includes(itemId);
  },

  async purchaseItem(userId: string, itemId: string, itemPrice?: number) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('system_points, purchased_items')
      .eq('id', userId)
      .single();

    if (profileError || !profile) throw new Error('Profil bulunamadı');

    const price = itemPrice || 0;
    if (price <= 0) throw new Error('Geçersiz ürün fiyatı');
    if (profile.system_points < price) throw new Error('Yetersiz SP');

    const owned: string[] = Array.isArray(profile.purchased_items) ? profile.purchased_items : [];
    if (owned.includes(itemId)) throw new Error('Bu ürüne zaten sahipsin!');

    const newOwned = [...owned, itemId];
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        system_points: profile.system_points - price,
        purchased_items: newOwned,
      })
      .eq('id', userId);

    if (updateError) throw new Error('Satın alma başarısız: ' + updateError.message);
    return { success: true, remaining_sp: profile.system_points - price };
  },

  async equipItem(userId: string, itemId: string | null) {
    const updates: Record<string, any> = {};
    if (!itemId) {
      updates.active_frame = null;
      updates.active_chat_color = null;
      updates.active_entry_effect = null;
    } else if (itemId.startsWith('frame_')) {
      updates.active_frame = itemId;
    } else if (itemId.startsWith('chat_')) {
      updates.active_chat_color = itemId;
    } else if (itemId.startsWith('entry_')) {
      updates.active_entry_effect = itemId;
    } else if (itemId.startsWith('theme_')) {
      updates.active_room_theme = itemId;
    }
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
  },

  async unequipItem(userId: string, itemId: string) {
    const updates: Record<string, any> = {};
    if (itemId.startsWith('frame_')) updates.active_frame = null;
    else if (itemId.startsWith('chat_')) updates.active_chat_color = null;
    else if (itemId.startsWith('entry_')) updates.active_entry_effect = null;
    else if (itemId.startsWith('theme_')) updates.active_room_theme = null;
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (error) throw error;
  }
};

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
    await supabase.from('user_statuses').delete().eq('user_id', userId);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('user_statuses')
      .insert({ user_id: userId, content, type: 'text', emoji, expires_at: expiresAt })
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
