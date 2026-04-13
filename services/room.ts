/**
 * SopranoChat — Oda Servisi
 * ═══════════════════════════════════════════════════
 * Oda CRUD, katılım, heartbeat, zombie temizliği,
 * keşfet algoritması, boost, ban, erişim istekleri.
 * database.ts monolitinden ayrıştırıldı.
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';
// ★ ARCH-3 FIX: Circular dependency kırıldı — shared utility import
import { getBlockedUserIds } from './blocklist';
import { getRoomLimits, isTierAtLeast, getTierLevel } from '../constants/tiers';
import type {
  Profile, Room, RoomParticipant, RoomSettings,
  SubscriptionTier,
} from '../types';
import { migrateLegacyTier, normalizeRole } from '../types';

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

  /**
   * Gizli profil odaları filtrele
   * ★ BUG-F7 FIX: N+1 sorgu → toplu sorgu ile değiştirildi
   */
  async _filterPrivateRooms(rooms: Room[], viewerId: string): Promise<Room[]> {
    if (!rooms.length) return rooms;

    // Gizli profil host'larını topla
    const privateHostIds = rooms
      .filter(room => room.host && (room.host as any).is_private)
      .map(room => room.host_id);

    // Gizli host yoksa doğrudan dön
    if (privateHostIds.length === 0) return rooms;

    const uniqueHostIds = [...new Set(privateHostIds)];

    // Tek sorguda tüm takip durumlarını al
    const { data: followData } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', viewerId)
      .in('friend_id', uniqueHostIds)
      .eq('status', 'accepted');

    const followedHostIds = new Set((followData || []).map((r: any) => r.friend_id));

    return rooms.filter(room => {
      // Public oda → göster
      if (!room.host || !(room.host as any).is_private) return true;
      // Kendi odam → göster
      if (room.host_id === viewerId) return true;
      // Gizli profil oda → takip ediyorsam göster
      return followedHostIds.has(room.host_id);
    });
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
      language?: string;
      welcome_message?: string;
      rules?: string;
      room_password?: string;
      speaking_mode?: 'free_for_all' | 'permission_only' | 'selected_only';
      scheduled_at?: string;
      entry_fee_sp?: number;
      donations_enabled?: boolean;
      followers_only?: boolean;
      theme_id?: string;
      room_image_url?: string;
      card_image_url?: string;
      tags?: string[];
    },
    tier: SubscriptionTier = 'Free'
  ): Promise<Room> {
    // ★ SEC-8b: Input sanitization — room name/description/settings
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
    options.name = stripHtml((options.name || '').trim()).slice(0, 60);
    if (options.name.length < 1) throw new Error('Oda ismi boş olamaz');
    if (options.description) options.description = stripHtml(options.description.trim()).slice(0, 500);
    if (options.welcome_message) options.welcome_message = stripHtml(options.welcome_message.trim()).slice(0, 500);
    if (options.rules) options.rules = stripHtml(options.rules.trim()).slice(0, 1000);
    if (options.room_password) options.room_password = options.room_password.trim().slice(0, 50);
    if (options.entry_fee_sp !== undefined) options.entry_fee_sp = Math.max(0, Math.min(options.entry_fee_sp || 0, 10000));

    // ★ Admin (GodMaster) kontrolü — admin odaları VIP limitleriyle oluşturulur
    let normalizedTier = migrateLegacyTier(tier);
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', hostId)
      .single();
    if (creatorProfile?.is_admin) {
      normalizedTier = 'VIP' as any;
    }

    const limits = getRoomLimits(normalizedTier);

    // ★ BUG-T1 FIX: allowedTypes backend guard — tier'ın izni olmayan oda tipi engellenir
    const requestedType = options.type || 'open';
    if (!limits.allowedTypes.includes(requestedType)) {
      throw new Error(`${normalizedTier} planıyla "${requestedType}" oda açılamaz. İzinli tipler: ${limits.allowedTypes.join(', ')}`);
    }

    // ★ BUG-T3 FIX: dailyRooms limiti — bugün oluşturulan oda sayısını kontrol et
    if (limits.dailyRooms < 999) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', hostId)
        .gte('created_at', todayStart.toISOString());
      if ((count || 0) >= limits.dailyRooms) {
        throw new Error(`Günlük oda limiti doldu (max ${limits.dailyRooms}/${normalizedTier}). Yarın tekrar deneyin.`);
      }
    }

    // Oda süresini hesapla
    const expiresAt = limits.durationHours > 0
      ? new Date(Date.now() + limits.durationHours * 60 * 60 * 1000).toISOString()
      : null; // Sınırsız süre

    const roomSettings: RoomSettings = {};
    if (options.welcome_message) roomSettings.welcome_message = options.welcome_message;
    if (options.rules) roomSettings.rules = options.rules;
    if (options.speaking_mode) roomSettings.speaking_mode = options.speaking_mode;
    if (options.scheduled_at) roomSettings.scheduled_at = options.scheduled_at;
    if (options.entry_fee_sp) roomSettings.entry_fee_sp = options.entry_fee_sp;
    if (options.donations_enabled) roomSettings.donations_enabled = options.donations_enabled;
    if (options.followers_only) roomSettings.followers_only = options.followers_only;
    if (options.card_image_url) (roomSettings as any).card_image_url = options.card_image_url;

    // ★ BUG-T4 FIX: maxPersistentRooms limiti — kalıcı oda sayısı kontrolü
    if (limits.persistent && limits.maxPersistentRooms < 999) {
      const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', hostId)
        .eq('is_persistent', true);
      if ((count || 0) >= limits.maxPersistentRooms) {
        throw new Error(`Kalıcı oda limitine ulaştınız (max ${limits.maxPersistentRooms}/${normalizedTier}). Mevcut odalarınızı silebilirsiniz.`);
      }
    }

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
      room_settings: roomSettings,
      room_password: options.room_password || null,
      expires_at: expiresAt,
      ...(options.theme_id ? { theme_id: options.theme_id } : {}),
      ...(options.room_image_url ? { room_image_url: options.room_image_url } : {}),
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
      if (options.theme_id) (roomSettings as any).theme_id = options.theme_id;
      if (options.room_image_url) (roomSettings as any).room_image_url = options.room_image_url;
      if (options.tags?.length) (roomSettings as any).tags = options.tags;

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

    // ★ BUG-R5 FIX: roleHint parametresini dikkate al
    let role: string = roleHint || 'listener';
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

    // BUG-RD4 FIX: Sadece listener/spectator rollerinde sayacı artır (owner/speaker/mod hariç)
    if (role === 'listener' || role === 'spectator') {
      await supabase.rpc('increment_listener_count', { room_id_input: roomId });
    }

    return data as RoomParticipant;
  },

  /** Odadan ayrıl */
  async leave(roomId: string, userId: string): Promise<void> {
    // BUG-RD7 FIX: Önce rolü kontrol et, sadece listener/spectator ise sayacı azalt
    const { data: participant } = await supabase
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    // Katılımcıyı sil
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    // Sadece listener/spectator ise sayacı azalt (owner/speaker/mod azaltmaz)
    if (participant && (participant.role === 'listener' || participant.role === 'spectator')) {
      await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
    }
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

  /** Oda ayarlarını güncelle — ★ SEC-8b: Input validation */
  async updateSettings(roomId: string, hostId: string, updates: Partial<Room & { room_settings?: Partial<RoomSettings> }>): Promise<void> {
    // Odanın gerçekten bu host'a ait olduğunu doğrula
    const { data: room } = await supabase.from('rooms').select('host_id, room_settings').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error('Bu odanın sahibi değilsiniz');

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
    const dbUpdates: any = {};
    if (updates.name !== undefined) {
      const sanitizedName = stripHtml((updates.name || '').trim()).slice(0, 60);
      if (sanitizedName.length < 1) throw new Error('Oda ismi boş olamaz');
      dbUpdates.name = sanitizedName;
    }
    if (updates.description !== undefined) dbUpdates.description = stripHtml((updates.description || '').trim()).slice(0, 500);
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
    // BUG-RD3 FIX: listener_count da sıfırla — uyandırılınca hayalet sayı göstermesin
    await supabase.from('rooms').update({ is_live: false, listener_count: 0 }).eq('id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
  },

  /**
   * ★ Manuel Oda Dondurma — Owner odayı dondurur.
   * Oda is_live=false olur ama silinmez. Katılımcılar temizlenir.
   * Daha sonra wakeUpRoom ile tekrar aktifleştirilebilir.
   * Sadece Bronze+ kullanıcılar (persistent: true) için.
   */
  async freezeRoom(roomId: string, hostId: string): Promise<void> {
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, room_settings')
      .eq('id', roomId)
      .single();

    if (!room || room.host_id !== hostId) throw new Error('Bu odanın sahibi değilsiniz');

    const updatedSettings = {
      ...(room.room_settings || {}),
      original_host_id: hostId,
      frozen_at: new Date().toISOString(),
    };

    // Odayı dondur — is_live: false, listener_count sıfırla, oda silinmez
    await supabase
      .from('rooms')
      .update({ is_live: false, listener_count: 0, room_settings: updatedSettings })
      .eq('id', roomId);

    // Tüm katılımcıları temizle
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId);
  },

  /**
   * Oda süresi doldu mu? Tier-bazlı süre kontrolü
   * Hardcoded 3-saat fallback kaldırıldı.
   */
  isExpired(room: Partial<Room>): boolean {
    if (!room.expires_at) return false; // Sınırsız süre (VIP/Gold 24h+)
    return new Date(room.expires_at) < new Date();
  },

  /**
   * ★ Keşfet Boost — Odayı keşfette öne çıkar.
   * boost_expires_at ve boost_score günceller.
   * ★ SP kontrolü dahil — yeterli SP yoksa hata fırlatır.
   * @param durationHours 1 veya 6 saat
   */
  async activateBoost(roomId: string, hostId: string, durationHours: 1 | 6): Promise<void> {
    const { data: room } = await supabase.from('rooms').select('host_id').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error('Bu odanın sahibi değilsiniz');

    // ★ BUG-A2 FIX: SP kontrolü — ücretsiz boost exploit önleme
    const spCost = durationHours === 6 ? 400 : 100;
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_points')
      .eq('id', hostId)
      .single();
    const currentSP = profile?.system_points || 0;
    if (currentSP < spCost) {
      throw new Error(`Yetersiz SP. Gerekli: ${spCost}, Mevcut: ${currentSP}`);
    }

    // SP düş (atomic RPC yoksa manuel)
    try {
      const { error: rpcError } = await supabase.rpc('grant_system_points', {
        p_user_id: hostId,
        p_amount: -spCost,
        p_action: 'room_boost',
      });
      if (rpcError) throw rpcError;
    } catch {
      await supabase.from('profiles')
        .update({ system_points: currentSP - spCost })
        .eq('id', hostId);
    }

    // SP işlem kaydı
    try {
      await supabase.from('sp_transactions').insert({
        user_id: hostId,
        amount: -spCost,
        type: 'room_boost',
        description: `Keşfet boost: ${durationHours} saat`,
      });
    } catch { /* sp_transactions yoksa sessiz */ }

    const boostUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const boostScore = durationHours === 6 ? 100 : 50;
    try {
      await supabase.from('rooms').update({
        boost_expires_at: boostUntil,
        boost_score: boostScore,
      }).eq('id', roomId);
    } catch {
      // boost_expires_at / boost_score kolonu yoksa room_settings'e yaz
      const { data: r2 } = await supabase.from('rooms').select('room_settings').eq('id', roomId).single();
      const settings = (r2?.room_settings || {}) as any;
      settings.boost_expires_at = boostUntil;
      settings.boost_score = boostScore;
      await supabase.from('rooms').update({ room_settings: settings }).eq('id', roomId);
    }
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

  /** Host: Kullanıcıyı konuşmacıya yükselt — ★ BUG-R4 FIX: Backend slot limiti */
  async promoteSpeaker(roomId: string, userId: string): Promise<void> {
    // ★ Sahne slot limiti kontrolü (backend guard)
    const { data: roomInfo } = await supabase
      .from('rooms')
      .select('owner_tier, host_id')
      .eq('id', roomId)
      .single();
    const ownerTier = migrateLegacyTier(roomInfo?.owner_tier);
    const limits = getRoomLimits(ownerTier);
    // Owner ve host her zaman sahneye çıkabilir  (slot aşılsa bile)
    if (roomInfo?.host_id !== userId) {
      const { count } = await supabase
        .from('room_participants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .in('role', ['owner', 'speaker', 'moderator']);
      if ((count || 0) >= limits.maxSpeakers) {
        throw new Error(`Sahne dolu (max ${limits.maxSpeakers}). Tier: ${ownerTier}`);
      }
    }
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
   * Host çıkınca: Yetki zinciri ile devret (Mod → Speaker → Tier-bazlı politika)
   */
  async transferHost(roomId: string, oldHostId: string): Promise<{ newHostId: string | null; keepAlive?: boolean }> {
    const { data: roomInfo } = await supabase
      .from('rooms')
      .select('is_persistent, owner_tier, room_settings, host_id')
      .eq('id', roomId)
      .single();

    let ownerTier = migrateLegacyTier(roomInfo?.owner_tier);
    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('is_admin, subscription_tier')
      .eq('id', oldHostId)
      .single();
    if (hostProfile?.is_admin) {
      ownerTier = 'VIP' as any;
    }

    const limits = getRoomLimits(ownerTier);

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

      return { newHostId };
    }

    // ── Kimse bulunamadı ──

    // ★ keep_alive (Silver/Gold/VIP): Oda açık kalır, host bilgisi korunur
    if (limits.ownerLeavePolicy === 'keep_alive') {
      const updatedSettings = {
        ...(roomInfo?.room_settings || {}),
        original_host_id: oldHostId,
      };
      await supabase
        .from('rooms')
        .update({ room_settings: updatedSettings })
        .eq('id', roomId);

      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', oldHostId);

      return { newHostId: null, keepAlive: true };
    }

    // ★ Free (close): null döner → frontend odayı kapatır
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', oldHostId);

    return { newHostId: null };
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
  // ODA TAKİP SİSTEMİ
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
  // ODA DAVET SİSTEMİ
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
  // OWNER SÜPER GÜÇLERİ
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

  /**
   * ⛔ Geçici ban (dakika cinsinden)
   */
  async banTemporary(roomId: string, userId: string, durationMinutes: number): Promise<void> {
    const banUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    try {
      await supabase.from('room_bans').upsert({
        room_id: roomId,
        user_id: userId,
        ban_type: 'temporary',
        expires_at: banUntil,
      }, { onConflict: 'room_id,user_id' });
    } catch { /* tablo yoksa sessiz */ }

    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    try { await supabase.rpc('decrement_listener_count', { room_id_input: roomId }); } catch {}
  },

  /**
   * ⛔ Kalıcı ban (sadece owner)
   */
  async banPermanent(roomId: string, userId: string): Promise<void> {
    try {
      await supabase.from('room_bans').upsert({
        room_id: roomId,
        user_id: userId,
        ban_type: 'permanent',
        expires_at: null,
      }, { onConflict: 'room_id,user_id' });
    } catch { /* tablo yoksa sessiz */ }

    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    try { await supabase.rpc('decrement_listener_count', { room_id_input: roomId }); } catch {}
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
   * Free tier odalar için otomatik temizlik.
   */
  async autoCloseExpired(): Promise<number> {
    const now = new Date().toISOString();
    let closedCount = 0;

    // ═══ 1. Free tier: expires_at süresi dolmuş odaları kapat ═══
    const { data: expired } = await supabase
      .from('rooms')
      .select('id, owner_tier')
      .eq('is_live', true)
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (expired && expired.length > 0) {
      for (const room of expired) {
        const roomTier = migrateLegacyTier((room as any).owner_tier);
        if (roomTier !== 'Free') continue; // Bronze+ muaf
        await supabase.from('rooms').update({ is_live: false, listener_count: 0 }).eq('id', room.id);
        await supabase.from('room_participants').delete().eq('room_id', room.id);
        closedCount++;
        if (__DEV__) console.log(`[AutoClose] Süresi dolan Free oda kapatıldı: ${room.id}`);
      }
    }

    // ═══ 2. Free tier: 30+ dakika boş kalan odaları kapat ═══
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: freeRooms } = await supabase
      .from('rooms')
      .select('id, owner_tier')
      .eq('is_live', true)
      .lt('created_at', thirtyMinAgo);

    if (freeRooms && freeRooms.length > 0) {
      const freeOnly = freeRooms.filter(r => migrateLegacyTier((r as any).owner_tier) === 'Free');
      if (freeOnly.length > 0) {
        const freeIds = freeOnly.map(r => r.id);
        const { data: activeParticipants } = await supabase
          .from('room_participants')
          .select('room_id')
          .in('room_id', freeIds);

        const roomsWithParticipants = new Set((activeParticipants || []).map((p: any) => p.room_id));

        for (const room of freeOnly) {
          if (!roomsWithParticipants.has(room.id)) {
            await supabase.from('rooms').update({ is_live: false, listener_count: 0 }).eq('id', room.id);
            await supabase.from('room_participants').delete().eq('room_id', room.id);
            closedCount++;
            if (__DEV__) console.log(`[AutoClose] 30dk+ boş Free oda kapatıldı: ${room.id}`);
          }
        }
      }
    }

    return closedCount;
  },

  // ════════════════════════════════════════════════════════════
  // ERİŞİM İSTEKLERİ (Davetli/Kapalı Odalar)
  // ════════════════════════════════════════════════════════════

  async sendAccessRequest(roomId: string, userId: string): Promise<{ sent: boolean; targetRole: string }> {
    const { data: participants } = await supabase
      .from('room_participants')
      .select('user_id, role')
      .eq('room_id', roomId)
      .in('role', ['owner', 'moderator', 'speaker'])
      .order('role', { ascending: true });

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

    if (target) {
      try {
        await PushService.sendToUser(target.user_id, 'Oda Giriş İsteği', 'Birisi odanıza katılmak istiyor', { type: 'room_request' as any, route: `/room/${roomId}` });
      } catch { /* push başarısız olabilir */ }
    }

    return { sent: true, targetRole };
  },

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

  async acceptRequest(requestId: string, handlerId: string): Promise<void> {
    const { data } = await supabase
      .from('room_access_requests')
      .update({ status: 'accepted', handled_by: handlerId })
      .eq('id', requestId)
      .select('room_id, user_id')
      .single();

    if (data) {
      await supabase.from('room_participants').insert({
        room_id: data.room_id,
        user_id: data.user_id,
        role: 'listener',
        is_muted: true,
      });
    }
  },

  async rejectRequest(requestId: string, handlerId: string): Promise<void> {
    await supabase
      .from('room_access_requests')
      .update({ status: 'rejected', handled_by: handlerId })
      .eq('id', requestId);
  },

  // ════════════════════════════════════════════════════════════
  // ODA KAPATMA
  // ════════════════════════════════════════════════════════════

  async closeRoom(roomId: string): Promise<void> {
    await supabase.from('rooms').update({ is_live: false, listener_count: 0 }).eq('id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
  },
};
