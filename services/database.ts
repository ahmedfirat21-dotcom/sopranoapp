/**
 * SopranoChat — Veritabanı Servis Katmanı
 * Tüm Supabase işlemleri buradan yönetilir.
 * Yeni özellik eklendiğinde buraya yeni fonksiyon eklenir.
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';

// ============================================
// TYPES
// ============================================
export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string;
  bio: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  birth_date?: string | null;
  tier: 'Silver' | 'Plat' | 'VIP';
  coins: number;
  is_plus: boolean;
  is_online: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  last_seen: string;
  created_at: string;
  active_frame?: string | null;
  active_chat_color?: string | null;
  active_entry_effect?: string | null;
};

export type ItemType = 'profile_frame' | 'room_theme' | 'entry_effect' | 'chat_bubble';
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type StoreItem = {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  price_coins: number;
  image_url: string;
  rarity: ItemRarity;
  is_limited: boolean;
  is_active: boolean;
  created_at: string;
};

export type UserPurchase = {
  id: string;
  user_id: string;
  item_id: string;
  purchased_at: string;
  item?: StoreItem;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  category: 'chat' | 'music' | 'game' | 'book' | 'film' | 'tech';
  type: 'open' | 'closed' | 'invite';
  host_id: string;
  is_live: boolean;
  listener_count: number;
  max_speakers: number;
  created_at: string;
  expires_at?: string | null; // Otomatik kapanma zamanı (free: 3 saat, VIP: null)
  host?: Profile;
};

export type RoomParticipant = {
  id: string;
  room_id: string;
  user_id: string;
  role: 'host' | 'moderator' | 'speaker' | 'listener';
  is_muted: boolean;
  is_chat_muted?: boolean; // Metin sohbetinde susturulmuş mu
  joined_at: string;
  user?: Profile;
};

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
};

export type CoinTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: 'purchase' | 'gift_sent' | 'gift_received' | 'room_boost' | 'reward';
  description: string;
  created_at: string;
};

export type InboxItem = {
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  partner_is_online: boolean;
  last_message_content: string;
  last_message_time: string;
  unread_count: number;
};

// ============================================
// PROFİL İŞLEMLERİ
// ============================================
export const ProfileService = {
  /** Yeni profil oluştur (ilk giriş sonrası) */
  async create(userId: string, data: Partial<Profile>) {
    // Username unique constraint'i önlemek için suffix ekle
    const baseUsername = (data.username || `user_${userId.substring(0, 6)}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const username = `${baseUsername}_${userId.substring(0, 4)}`;

    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, ...data, username },
        { onConflict: 'id' }
      )
      .select()
      .single();
    if (error) throw error;
    return profile as Profile;
  },

  /** Profil bilgisi getir */
  async get(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data as Profile | null;
  },

  /** Profil güncelle */
  async update(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  },

  /** Online durumunu güncelle */
  async setOnline(userId: string, isOnline: boolean) {
    await supabase
      .from('profiles')
      .update({ is_online: isOnline, last_seen: new Date().toISOString() })
      .eq('id', userId);
  },

  /** Önerilen kullanıcıları getir (Keşfet sayfası için, boost'lu profiller önde) */
  async getRecommended(currentUserId: string, limit: number = 10, offset: number = 0): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, profile_boost_expires_at')
      .neq('id', currentUserId)
      .order('is_online', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    const profiles = (data || []) as (Profile & { profile_boost_expires_at?: string })[];
    const now = new Date();
    // Boost'lu profilleri öne al
    profiles.sort((a, b) => {
      const aB = a.profile_boost_expires_at && new Date(a.profile_boost_expires_at) > now;
      const bB = b.profile_boost_expires_at && new Date(b.profile_boost_expires_at) > now;
      if (aB && !bB) return -1;
      if (!aB && bB) return 1;
      return 0;
    });
    return profiles;
  },

  /** Profili öne çıkar (Boost) — Keşfet'te üst sıralara taşır */
  async boostProfile(userId: string, coinCost: number = 10) {
    // Coin yeterli mi kontrol et
    const profile = await this.get(userId);
    if (!profile || profile.coins < coinCost) {
      throw new Error('Yetersiz Soprano Coin');
    }
    // Atomik işlem: coin düş + boost süresi ayarla (60 dk)
    const boostUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        coins: profile.coins - coinCost,
        profile_boost_expires_at: boostUntil,
      })
      .eq('id', userId);
    if (updateErr) throw updateErr;
    // Coin işlem kaydı
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: -coinCost,
      type: 'purchase',
      description: 'Profil Boost (1 saat)',
    });
    return { success: true, boost_expires_at: boostUntil };
  },

  /** Kullanıcı ara — display_name veya username ile */
  async search(query: string, limit: number = 20): Promise<Profile[]> {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
      .order('is_online', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('Kullanıcı arama hatası:', error);
      return [];
    }
    return (data || []) as Profile[];
  },
};

// ============================================
// ODA İŞLEMLERİ
// ============================================
// ─── ODA TİER LİMİTLERİ ───────────────────────────────────
export const ROOM_TIER_LIMITS = {
  Silver: { maxSpeakers: 4, maxListeners: 100, durationHours: 1.5, dailyRooms: 2, maxModerators: 1, allowedTypes: ['open'],            audioSampleRate: 24000, audioChannels: 1, videoMaxRes: 480 },
  Plat:   { maxSpeakers: 8, maxListeners: 500, durationHours: 4,   dailyRooms: 5, maxModerators: 3, allowedTypes: ['open', 'closed'],  audioSampleRate: 48000, audioChannels: 1, videoMaxRes: 720 },
  VIP:    { maxSpeakers: 12, maxListeners: 2000, durationHours: 0, dailyRooms: 999, maxModerators: 5, allowedTypes: ['open', 'closed', 'invite'], audioSampleRate: 48000, audioChannels: 2, videoMaxRes: 1080 },
} as const;

export type TierName = keyof typeof ROOM_TIER_LIMITS;

export const getRoomLimits = (tier: TierName = 'Silver') => ROOM_TIER_LIMITS[tier] || ROOM_TIER_LIMITS.Silver;

export const RoomService = {
  /** Yeni oda oluştur (tier bazlı limitlerle) */
  async create(hostId: string, data: { name: string; category: string; type: string; description?: string }, tier: TierName = 'Silver') {
    const limits = getRoomLimits(tier);

    // Süre: 0 = sınırsız (VIP)
    const expiresAt = limits.durationHours > 0
      ? new Date(Date.now() + limits.durationHours * 60 * 60 * 1000).toISOString()
      : null;

    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        host_id: hostId,
        is_live: true,
        expires_at: expiresAt,
        max_speakers: limits.maxSpeakers,
        ...data,
      })
      .select('*, host:profiles!host_id(*)')
      .single();
    if (error) throw error;

    // Host'u konuşmacı olarak ekle
    await supabase.from('room_participants').insert({
      room_id: room.id,
      user_id: hostId,
      role: 'host',
      is_muted: false,
    });

    return room as Room;
  },

  /** Canli odalari getir (Aktif Boostlu odalar önde, ardindan dinleyici sayisina gore) */
  async getLive(limit: number = 20, offset: number = 0) {
    // Süresi dolan odaları arka planda temizle
    this.closeExpiredRooms().catch(() => {});

    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('is_live', true)
      .order('listener_count', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const rooms = (data || []) as (Room & { boost_expires_at?: string; total_gifts?: number })[];
    const now = new Date();

    rooms.sort((a, b) => {
      const aIsBoosted = a.boost_expires_at && new Date(a.boost_expires_at) > now;
      const bIsBoosted = b.boost_expires_at && new Date(b.boost_expires_at) > now;

      // 1. Kural: Boost'lu odalar önce
      if (aIsBoosted && bIsBoosted) {
        return new Date(b.boost_expires_at!).getTime() - new Date(a.boost_expires_at!).getTime();
      }
      if (aIsBoosted && !bIsBoosted) return -1;
      if (!aIsBoosted && bIsBoosted) return 1;

      // 2. Kural: Engagement skoru (dinleyici * 2 + hediye * 5)
      const aScore = (a.listener_count || 0) * 2 + (a.total_gifts || 0) * 5;
      const bScore = (b.listener_count || 0) * 2 + (b.total_gifts || 0) * 5;
      return bScore - aScore;
    });

    return rooms;
  },

  /** Kategoriye göre odaları getir */
  async getByCategory(category: string, limit: number = 20, offset: number = 0) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('category', category)
      .eq('is_live', true)
      .order('listener_count', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data || []) as Room[];
  },

  /** Oda detayı getir */
  async get(roomId: string) {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('id', roomId)
      .single();
    if (error) throw error;
    return data as Room;
  },

  /** Odaya katıl */
  async join(roomId: string, userId: string, role: 'speaker' | 'listener' | 'host' = 'listener') {
    // ★ Zombie önleme: Bu kullanıcının başka odalardaki eski kayıtlarını temizle
    await supabase
      .from('room_participants')
      .delete()
      .eq('user_id', userId)
      .neq('room_id', roomId);

    // Önce mevcut kaydı kontrol et
    const { data: existing } = await supabase
      .from('room_participants')
      .select('id, role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Mevcut kayıt varsa rolü ve heartbeat'i güncelle
      await supabase
        .from('room_participants')
        .update({ role, is_muted: role === 'listener', joined_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      // Yeni kayıt ekle
      const { error } = await supabase
        .from('room_participants')
        .insert({ room_id: roomId, user_id: userId, role, is_muted: role === 'listener' });
      if (error) throw error;
    }

    // Dinleyici sayısını artır
    await supabase.rpc('increment_listener_count', { room_id_input: roomId });

    // Katıldı mesajını sisteme ekle (throttle içeride yapılıyor)
    await supabase.rpc('record_room_join_system_message', { 
      p_room_id: roomId, 
      p_user_id: userId 
    });
  },

  /** Odadan ayrıl */
  async leave(roomId: string, userId: string) {
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    // Dinleyici sayısını azalt
    await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
  },

  /** Oda katılımcılarını getir */
  async getParticipants(roomId: string) {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*, user:profiles!user_id(*)')
      .eq('room_id', roomId)
      .order('role');
    if (error) throw error;
    return (data || []) as RoomParticipant[];
  },

  /** Odayı kapat */
  async close(roomId: string) {
    await supabase.from('rooms').update({ is_live: false }).eq('id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
  },

  /** Dinleyici sayısını gerçek katılımcı sayısıyla senkronize et */
  async syncListenerCount(roomId: string) {
    const { count } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);
    if (count !== null) {
      await supabase.from('rooms').update({ listener_count: count }).eq('id', roomId);
    }
  },

  /** Heartbeat — "ben hâlâ buradayım" sinyali
   * NOT: joined_at alanı hem katılma zamanı hem heartbeat olarak kullanılıyor.
   * Zombie temizleyici bu alana bakarak aktif olmayan kullanıcıları tespit eder.
   */
  async heartbeat(roomId: string, userId: string) {
    await supabase
      .from('room_participants')
      .update({ joined_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** Zombie katılımcıları temizle — 5 dakikadan eski heartbeat olanları sil (BUG-6: 3dk→5dk, daha güvenli) */
  async cleanupZombies(roomId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: zombies } = await supabase
      .from('room_participants')
      .select('id, user_id')
      .eq('room_id', roomId)
      .lt('joined_at', fiveMinutesAgo);
    
    if (zombies && zombies.length > 0) {
      const ids = zombies.map(z => z.id);
      await supabase
        .from('room_participants')
        .delete()
        .in('id', ids);
      console.log(`[Zombie Cleanup] ${zombies.length} zombie temizlendi - oda: ${roomId}`);
    }
    return zombies?.length || 0;
  },

  /** Süresi dolan odaları otomatik kapat */
  async closeExpiredRooms(): Promise<number> {
    const now = new Date().toISOString();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    let closedCount = 0;

    // 1. expires_at set edilmiş ve süresi geçmiş odaları kapat
    const { data: expired } = await supabase
      .from('rooms')
      .select('id')
      .eq('is_live', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    if (expired && expired.length > 0) {
      for (const room of expired) {
        await supabase.from('rooms').update({ is_live: false }).eq('id', room.id);
        await supabase.from('room_participants').delete().eq('room_id', room.id);
      }
      closedCount += expired.length;
    }

    // 2. expires_at NULL olan eski odaları da kapat (migration öncesi açılmış, VIP olmayan)
    // 3 saatten eski ve expires_at null olan odalar → normal kullanıcı odası kabul et
    const { data: oldRooms } = await supabase
      .from('rooms')
      .select('id, host_id')
      .eq('is_live', true)
      .is('expires_at', null)
      .lt('created_at', threeHoursAgo);

    if (oldRooms && oldRooms.length > 0) {
      for (const room of oldRooms) {
        // Host'un VIP olup olmadığını kontrol et
        const { data: hostProfile } = await supabase
          .from('profiles')
          .select('is_plus')
          .eq('id', room.host_id)
          .single();

        if (!hostProfile?.is_plus) {
          // Normal üye — odayı kapat
          await supabase.from('rooms').update({ is_live: false }).eq('id', room.id);
          await supabase.from('room_participants').delete().eq('room_id', room.id);
          closedCount++;
        }
      }
    }

    return closedCount;
  },

  /** Odanın süresinin dolup dolmadığını kontrol et */
  isExpired(room: Room): boolean {
    if (!room.expires_at) {
      // expires_at yoksa created_at + 3 saat ile kontrol et
      const createdAt = new Date(room.created_at);
      const threeHoursLater = new Date(createdAt.getTime() + 3 * 60 * 60 * 1000);
      return new Date() >= threeHoursLater;
    }
    return new Date(room.expires_at) <= new Date();
  },

  /** Odayı öne çıkar (Boost) */
  async boostRoom(roomId: string, userId: string, amount: number = 50) {
    const { data, error } = await supabase.rpc('boost_room', {
      p_room_id: roomId,
      p_user_id: userId,
      p_amount: amount
    });
    
    if (error) {
      console.error('Oda boost hatasi:', error);
      throw error;
    }
    
    return data[0]; // { success, new_boost_score, new_boost_expires_at, user_remaining_coins }
  },

  /** Konuşmacı olmak için el kaldır (Plus kullanıcılar öncelikli) */
  async requestToSpeak(roomId: string, userId: string): Promise<void> {
    // Dinleyiciyi 'pending_speaker' olarak işaretle
    await supabase
      .from('room_participants')
      .update({ role: 'pending_speaker', hand_raised_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** Host: Bekleyen konuşmacıları getir (Plus öncelikli sıralama) */
  async getPendingSpeakers(roomId: string): Promise<RoomParticipant[]> {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*, user:profiles!user_id(*)')
      .eq('room_id', roomId)
      .eq('role', 'pending_speaker')
      .order('joined_at', { ascending: true });
    if (error) throw error;

    const participants = (data || []) as (RoomParticipant & { user?: Profile })[];

    // Plus kullanıcıları öne al
    participants.sort((a, b) => {
      const aPlus = (a.user as any)?.is_plus || false;
      const bPlus = (b.user as any)?.is_plus || false;
      if (aPlus && !bPlus) return -1;
      if (!aPlus && bPlus) return 1;
      return 0;
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
      .update({ role: 'listener', is_muted: true })
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

  /** Host çıkınca: Moderatöre hostluğu devret */
  async transferHost(roomId: string, oldHostId: string): Promise<{ newHostId: string | null }> {
    // En eski moderatörü bul
    const { data: mods } = await supabase
      .from('room_participants')
      .select('user_id, joined_at')
      .eq('room_id', roomId)
      .eq('role', 'moderator')
      .order('joined_at', { ascending: true })
      .limit(1);

    if (mods && mods.length > 0) {
      const newHostId = mods[0].user_id;
      // Yeni host'un rolünü güncelle
      await supabase
        .from('room_participants')
        .update({ role: 'host' })
        .eq('room_id', roomId)
        .eq('user_id', newHostId);
      // Odanın host_id'sini güncelle
      await supabase
        .from('rooms')
        .update({ host_id: newHostId })
        .eq('id', roomId);
      // Eski host'u katılımcılardan sil
      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', oldHostId);
      // Dinleyici sayısını azalt
      await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
      return { newHostId };
    }

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

  /** Süresi dolan odaları otomatik kapat (client-side cleanup) */
  async autoCloseExpired(): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('rooms')
      .select('id')
      .eq('is_live', true)
      .not('expires_at', 'is', null)
      .lte('expires_at', now);
    
    if (error || !data || data.length === 0) return 0;

    // Her bir expired odayı kapat
    for (const room of data) {
      await supabase.from('rooms').update({ is_live: false }).eq('id', room.id);
      await supabase.from('room_participants').delete().eq('room_id', room.id);
    }
    return data.length;
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

  /** Yeni mesaj gönder (Optimistic Update uyumlu) */
  async send(senderId: string, receiverId: string, content: string) {
    const { data: msg, error } = await supabase
      .from('messages')
      .insert({ sender_id: senderId, receiver_id: receiverId, content })
      .select('*, sender:profiles!sender_id(*)')
      .single();
    if (error) throw error;

    // Push bildirim gönder (arka planda, hata yutulur)
    const senderName = (msg as any).sender?.display_name || 'Birisi';
    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
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
      console.warn('Okundu işaretleme hatası:', error.message);
    }
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

  /** Realtime Yeni Mesaj Dinleyici — hem alıcı hem gönderici tarafı */
  onNewMessage(userId: string, callback: (msg: Message) => void) {
    return supabase
      .channel(`user_messages_${userId}`)
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
  },

  /** Yazıyor... (Typing Indicator) - Gönderici
   * ÖNEMLİ: Her çağrıda yeni kanal AÇMA! Mevcut kanalı yeniden kullan.
   * Eski implementasyon her tuşa basıldığında yeni kanal açıp hiç kapatmıyordu → zombie kanallar
   */
  _typingChannels: new Map<string, ReturnType<typeof supabase.channel>>(),

  async sendTypingStatus(senderId: string, receiverId: string, isTyping: boolean) {
    // Kanal adı alıcının dinlediği kanal ile aynı olmalı: typing_${receiverId}
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
        // 2 saniye içinde subscribe olamazsa devam et
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

  /** Yazıyor... (Typing Indicator) - Dinleyici */
  onTypingStatus(currentUserId: string, callback: (payload: { user_id: string, is_typing: boolean, conversation_partner_id: string }) => void) {
    return supabase
      .channel(`typing_${currentUserId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        callback(payload.payload as any);
      })
      .subscribe();
  }
};

// ============================================
// SOPRANO COIN İŞLEMLERİ
// ============================================
export const CoinService = {
  /** Bakiye getir */
  async getBalance(userId: string) {
    const profile = await ProfileService.get(userId);
    return profile?.coins ?? 0;
  },

  /** Coin ekle/çıkar + işlem kaydı (ATOMİK — tek transaction) */
  async transaction(userId: string, amount: number, type: CoinTransaction['type'], description: string) {
    // Atomik RPC ile hem bakiye güncelleme hem işlem kaydı tek transaction'da
    const { data, error } = await supabase.rpc('process_coin_transaction', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description || null,
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.message);

    return data;
  },

  /** İşlem geçmişi */
  async getHistory(userId: string, limit = 20) {
    const { data, error } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as CoinTransaction[];
  },
};

// ============================================
// REALTIME — Oda dinleyicisi
// ============================================
export const RealtimeService = {
  /** Oda katılımcı değişikliklerini dinle */
  onRoomChange(roomId: string, callback: (participants: RoomParticipant[]) => void) {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastEmit = 0;
    const handler = async () => {
      // BUG-5 FIX: Throttle — ilk değişiklikte hemen güncelle, sonra 500ms bekle
      const now = Date.now();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (now - lastEmit >= 500) {
        lastEmit = now;
        const participants = await RoomService.getParticipants(roomId);
        callback(participants);
      } else {
        debounceTimer = setTimeout(async () => {
          lastEmit = Date.now();
          const participants = await RoomService.getParticipants(roomId);
          callback(participants);
        }, 300); // 300ms — anlık tepki
      }
    };
    return supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        handler
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        handler
      )
      // ★ UPDATE event — sahneye çıkma/inme (role değişimi) anlık yansısın
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'room_participants',
          filter: `room_id=eq.${roomId}`,
        },
        handler
      )
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
      }, 3000);
    };
    return supabase
      .channel('rooms:all')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rooms' },
        handler
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        handler
      )
      .subscribe();
  },

  /** Belirli bir odanın durum değişikliklerini dinle (is_live, expires_at vb.) */
  onRoomStatusChange(roomId: string, callback: (room: Room) => void) {
    return supabase
      .channel(`room_status:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        async (payload) => {
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

// ============================================
// MAĞAZA İŞLEMLERİ (STORE & WALLET)
// ============================================
export const StoreService = {
  /** Mağazadaki tüm aktif ürünleri getirir */
  async getStoreItems() {
    const { data, error } = await supabase
      .from('store_items')
      .select('*')
      .eq('is_active', true)
      .order('price_coins', { ascending: true });
    if (error) throw error;
    return data as StoreItem[];
  },

  /** Kullanıcının sahip olduğu dijital eşyaları getirir */
  async getUserPurchases(userId: string) {
    const { data, error } = await supabase
      .from('user_purchases')
      .select('*, item:store_items(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return data as UserPurchase[];
  },

  /** Coin karşılığında ürün satın alır (RPC tetikler) */
  async purchaseItem(userId: string, itemId: string) {
    const { data, error } = await supabase.rpc('purchase_store_item', {
      p_user_id: userId,
      p_item_id: itemId,
    });
    
    if (error) {
       console.error("Purchase RPC error:", error);
       throw new Error("Satın alma işleminde bir hata oluştu.");
    }
    
    if (data && data[0] && !data[0].success) {
      throw new Error(data[0].message);
    }
    
    return data[0]; 
  },

  /** Kullanıcının sahip olduğu kozmetiği giymesini sağlar */
  async equipItem(userId: string, itemId: string | null) {
    const { data, error } = await supabase.rpc('equip_store_item', {
      p_user_id: userId,
      p_item_id: itemId,
    });
    
    if (error) {
       console.error("Equip RPC error:", error);
       throw error;
    }
    return data;
  }
};
