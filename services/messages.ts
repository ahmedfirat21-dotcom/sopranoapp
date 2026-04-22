/**
 * SopranoChat — Mesajlaşma Servisi
 * ═══════════════════════════════════════════════════
 * DM, Inbox, conversation, typing indicator, reactions.
 * database.ts monolitinden ayrıştırıldı.
 */
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PushService } from './push';
// ★ Lazy import — circular dependency önleme
const _getFriendshipService = () => require('./friendship').FriendshipService;
const FriendshipService = { _getBlockedIds: (userId: string) => _getFriendshipService()._getBlockedIds(userId) } as { _getBlockedIds: (userId: string) => Promise<Set<string>> };
import type { Message, InboxItem } from '../types';

// ============================================
// MESAJ İŞLEMLERİ
// ============================================
export const MessageService = {
  /** Gelen kutusunu (Inbox) getir */
  async getInbox(userId: string) {
    // Kullanıcının gönderdiği veya aldığı tüm silinmemiş mesajları çek
    let data: any[] | null = null;

    // is_deleted sütunu varsa filtrele, yoksa filtresiz çek
    const { data: d1, error: e1 } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at, is_deleted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .not('is_deleted', 'is', true)
      .order('created_at', { ascending: false })
      .limit(500);

    if (e1 && e1.code === '42703') {
      // is_deleted sütunu henüz yok — filtresiz çek
      const { data: d2, error: e2 } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, is_read, created_at')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(500);
      if (e2) throw e2;
      data = d2;
    } else if (e1) {
      throw e1;
    } else {
      data = d1;
    }

    if (!data || data.length === 0) return [] as InboxItem[];

    // Partner bazında grupla — her partner için son mesajı bul
    const partnerMap = new Map<string, { lastMsg: any; unread: number }>();
    for (const msg of data) {
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      // ★ Null/undefined partnerId — bozuk veri, atla
      if (!partnerId) continue;
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { lastMsg: msg, unread: 0 });
      }
      // Okunmamış sayısı: karşı taraftan gelen + okunmamış
      if (msg.receiver_id === userId && !msg.is_read) {
        const entry = partnerMap.get(partnerId)!;
        entry.unread++;
      }
    }

    // ★ Engellenen kişileri filtrele — inbox'ta görünmesinler
    const blockedIds = await FriendshipService._getBlockedIds(userId);

    // Partner profil bilgilerini toplu çek
    const partnerIds = Array.from(partnerMap.keys()).filter(id => !blockedIds.has(id));
    if (partnerIds.length === 0) return [] as InboxItem[];

    // ★ Paralel çek: profiller + conversation_state (pin/archive/mute)
    const [profRes, stateRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, is_online, subscription_tier, last_seen')
        .in('id', partnerIds),
      supabase
        .from('conversation_state')
        .select('partner_id, pinned_at, archived_at, muted_at')
        .eq('user_id', userId)
        .in('partner_id', partnerIds),
    ]);
    const profileMap = new Map((profRes.data || []).map(p => [p.id, p]));
    const stateMap = new Map<string, { pinned: boolean; archived: boolean; muted: boolean }>(
      (stateRes.data || []).map((s: any) => [
        s.partner_id,
        { pinned: !!s.pinned_at, archived: !!s.archived_at, muted: !!s.muted_at },
      ])
    );

    // InboxItem formatına dönüştür
    const inbox: InboxItem[] = [];
    for (const [partnerId, { lastMsg, unread }] of partnerMap) {
      const prof = profileMap.get(partnerId);
      const state = stateMap.get(partnerId);
      const isSentByMe = lastMsg.sender_id === userId;
      let preview = lastMsg.content || '';
      if (preview.startsWith('🎤') || preview.includes('voice_messages/')) preview = '🎤 Sesli mesaj';
      else if (preview.startsWith('📷') || preview.match(/^https?.*\.(jpg|png|webp)/i)) preview = '📷 Fotoğraf';
      if (isSentByMe && !preview.startsWith('Sen:')) preview = `Sen: ${preview}`;

      inbox.push({
        partner_id: partnerId,
        partner_name: prof?.display_name || 'Kullanıcı',
        partner_avatar: prof?.avatar_url || '',
        partner_is_online: prof?.is_online || false,
        partner_tier: (prof as any)?.subscription_tier || 'Free',
        partner_last_seen: (prof as any)?.last_seen,
        last_message_content: preview,
        last_message_time: lastMsg.created_at,
        unread_count: unread,
        is_last_msg_mine: isSentByMe,
        is_last_msg_read: isSentByMe ? !!lastMsg.is_read : undefined,
        is_pinned: state?.pinned || false,
        is_archived: state?.archived || false,
        is_muted: state?.muted || false,
      });
    }

    // ★ Gizlenmiş sohbetleri filtrele — deleteConversation ile gizlenenler
    // ★ 2026-04-21: Auto-unhide kaldırıldı. Silinen sohbet yeni mesaj gelse bile gizli kalır.
    //   Kullanıcı chat ekranına girdiğinde hidden entry temizlenir (explicit restore).
    //   Hem DM inbox (/messages tab) hem oda içi DM panel aynı servisi kullandığı için
    //   bu değişiklik ikisinde de senkron çalışır.
    const hiddenMap = await this.getHiddenConversations(userId);
    const filteredInbox = inbox.filter(item => !hiddenMap[item.partner_id]);

    // ★ Sıralama: pinli olanlar ÜSTTE, sonra zaman bazlı (en yeni üste)
    filteredInbox.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });
    return filteredInbox;
  },

  /** ★ Sohbeti sabitle / sabitlemeyi kaldır (toggle) — v33 + v48 Firebase JWT fallback */
  async togglePin(partnerId: string, executorId?: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_conversation_pin', {
      p_partner_id: partnerId,
      p_executor_id: executorId || null,
    });
    if (error) throw error;
    return !!data;
  },

  /** ★ Sohbeti arşivle / arşivden çıkar (toggle) — v33 + v48 Firebase JWT fallback */
  async toggleArchive(partnerId: string, executorId?: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('toggle_conversation_archive', {
      p_partner_id: partnerId,
      p_executor_id: executorId || null,
    });
    if (error) throw error;
    return !!data;
  },

  /** İki kişi arasındaki tüm konuşma geçmişini getir */
  async getConversation(user1Id: string, user2Id: string, limit = 200) {
    // ★ ORTA-H: Engel kontrolü — blocker/blocked çifti sohbet açsa da mesaj görülmesin.
    // Privacy: blocklanan kişi eski mesajları OKUYAMASIN.
    try {
      const blockedIds = await FriendshipService._getBlockedIds(user1Id);
      if (blockedIds.has(user2Id)) return [];
      const reverseBlock = await FriendshipService._getBlockedIds(user2Id);
      if (reverseBlock.has(user1Id)) return [];
    } catch { /* block check başarısızsa sohbeti göster */ }

    // ★ is_deleted sütunu varsa filtrele, yoksa filtresiz — getInbox ile aynı strateji
    const orFilter = `and(sender_id.eq.${user1Id},receiver_id.eq.${user2Id}),and(sender_id.eq.${user2Id},receiver_id.eq.${user1Id})`;

    const { data: d1, error: e1 } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .or(orFilter)
      .not('is_deleted', 'is', true)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (e1 && e1.code === '42703') {
      // is_deleted sütunu yok — filtresiz çek
      const { data: d2, error: e2 } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*)')
        .or(orFilter)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (e2) throw e2;
      return (d2 || []) as Message[];
    }
    if (e1) throw e1;
    return (d1 || []) as Message[];
  },

  /** Yeni mesaj gönder — ★ A3+A4+SEC-DM FIX: arkadaşlık + rate limit + engel + content validation */
  async send(senderId: string, receiverId: string, content: string, imageUrlOrIsRequest?: string | boolean, voiceUrl?: string, voiceDuration?: number) {
    // ★ SEC-DM1: Content sanitizasyon + uzunluk limiti
    // Unicode bidi override, zero-width karakterleri ve kontrol karakterlerini temizle
    const sanitized = (content || '').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g, '').trim();
    // Sesli mesaj ve fotoğraf dışında boş content engelle
    if (!sanitized && !voiceUrl && typeof imageUrlOrIsRequest !== 'string') {
      throw new Error('Boş mesaj gönderilemez.');
    }
    // Max 2000 karakter limiti
    if (sanitized.length > 2000) {
      throw new Error('Mesaj çok uzun (max 2000 karakter).');
    }
    content = sanitized;

    // ★ Engel kontrolü: Her iki yönde de mesaj engellenir
    const blockedIds = await FriendshipService._getBlockedIds(senderId);
    if (blockedIds.has(receiverId)) {
      throw new Error('Bu kullanıcıyla mesajlaşamazsınız.');
    }

    // ★ A3 FIX: Arkadaşlık kontrolü — MUTUAL follow accepted olanlar direkt mesajlaşır.
    // ★ 2026-04-22: Instagram-style request flow. Mutual değilse (tek yön veya hiç):
    //   - Mevcut request yoksa: yeni message_request (pending) + 1 mesaj atılabilir
    //   - Request pending: aynı gönderen ekstra mesaj atamaz (onay bekliyor)
    //   - Request accepted: normal mesajlaşma serbest
    //   - Request rejected: mesaj engellenir
    const { data: friendshipRows } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`);
    const hasOutgoing = (friendshipRows || []).some((f: any) => f.user_id === senderId && f.friend_id === receiverId);
    const hasIncoming = (friendshipRows || []).some((f: any) => f.user_id === receiverId && f.friend_id === senderId);
    const isFriend = hasOutgoing && hasIncoming; // mutual follow accepted

    let isFirstRequestMessage = false;
    if (!isFriend) {
      const { data: req } = await supabase
        .from('message_requests')
        .select('status')
        .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
        .maybeSingle();

      if (req?.status === 'rejected') {
        throw new Error('Bu kullanıcıya mesaj gönderemezsiniz.');
      }

      if (!req) {
        // İlk mesaj → request oluştur, bu mesaj geçebilir
        const { error: reqErr } = await supabase
          .from('message_requests')
          .insert({ sender_id: senderId, receiver_id: receiverId, status: 'pending' });
        if (reqErr && reqErr.code !== '23505') throw reqErr; // unique conflict ignore
        isFirstRequestMessage = true;
      } else if (req.status === 'pending') {
        // Pending → receiver kim? Eğer ben sender isem: ekstra mesaj atamam (Instagram davranışı)
        // Eğer receiver bensem: ben gönderebilirim (karşı onayım sayılır ama direkt accept etmeyelim)
        // Bu edge-case: receiver henüz accept etmeden cevap yazıyor → accept'e çevir
        const { data: reqRow } = await supabase
          .from('message_requests')
          .select('sender_id, receiver_id')
          .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
          .maybeSingle();
        if (reqRow && reqRow.receiver_id === senderId) {
          // Receiver cevap veriyor → accept
          await supabase
            .from('message_requests')
            .update({ status: 'accepted', responded_at: new Date().toISOString() })
            .eq('sender_id', reqRow.sender_id)
            .eq('receiver_id', reqRow.receiver_id);
        } else {
          throw new Error('İsteğiniz henüz onaylanmadı. Karşı tarafın cevabını bekleyin.');
        }
      }
      // accepted → serbest
    }

    // ★ A4 FIX: Rate limiting — son 1 dakikada max 30 mesaj
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .gte('created_at', oneMinuteAgo);
    if ((recentCount || 0) >= 30) {
      throw new Error('Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin.');
    }

    const imageUrl = typeof imageUrlOrIsRequest === 'string' ? imageUrlOrIsRequest : undefined;

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
    const pushTitle = isFirstRequestMessage ? '📨 Mesaj İsteği' : 'Yeni Mesaj';
    PushService.sendToUser(receiverId, pushTitle, `${senderName}: ${preview}`, {
      type: isFirstRequestMessage ? 'message_request' : 'dm',
      route: `/chat/${senderId}`,
    }).catch(() => {});

    return msg as Message;
  },

  /** ★ 2026-04-22: Receiver mesaj isteğini kabul eder → normal chat açılır. */
  async acceptMessageRequest(receiverId: string, senderId: string): Promise<void> {
    const { error } = await supabase
      .from('message_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending');
    if (error) throw error;
  },

  /** ★ 2026-04-22: Receiver mesaj isteğini reddeder → mesajlar gizlenir, sender engellenemez ama yazı atamaz. */
  async rejectMessageRequest(receiverId: string, senderId: string): Promise<void> {
    const { error } = await supabase
      .from('message_requests')
      .update({ status: 'rejected', responded_at: new Date().toISOString() })
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .eq('status', 'pending');
    if (error) throw error;
    // İsteğe bağlı: mevcut request mesajlarını is_deleted=true yaparak gizle
    await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId);
  },

  /** İki kullanıcı arasındaki message_request durumunu çekip döner (null = yok). */
  async getMessageRequest(userA: string, userB: string): Promise<{ sender_id: string; receiver_id: string; status: 'pending' | 'accepted' | 'rejected' } | null> {
    const { data } = await supabase
      .from('message_requests')
      .select('sender_id, receiver_id, status')
      .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
      .maybeSingle();
    return (data as any) || null;
  },

  /** Kullanıcıya gelen pending mesaj istekleri — Messages tab "İstekler" bölümü. */
  async getPendingRequests(userId: string) {
    const { data, error } = await supabase
      .from('message_requests')
      .select('*, sender:profiles!sender_id(id, display_name, avatar_url, subscription_tier, is_online)')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    // İlk mesajı da çek (preview için)
    const list = data || [];
    return list;
  },

  /** Karşı tarafın gönderdiği mesajları okundu olarak işaretle — silinmişler hariç */
  async markAsRead(currentUserId: string, otherUserId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', currentUserId)
      .eq('sender_id', otherUserId)
      .eq('is_read', false)
      .not('is_deleted', 'is', true);
    if (error && error.code !== 'PGRST116') {
      if (__DEV__) console.warn('Okundu işaretleme hatası:', error.message);
    }
  },

  /** Mesaj sil — soft delete (sadece kendi gönderdiğin mesajlar) */
  async deleteMessage(messageId: string, senderId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', messageId)
      .eq('sender_id', senderId);
    if (error) throw error;
  },

  /** ★ Emoji tepki güncelle (WhatsApp tarzı) — SEC-DM2: Yetki kontrolü eklendi */
  async updateReaction(messageId: string, reactionsJson: string, userId?: string) {
    // ★ SEC-DM2: Yetki kontrolü — sadece mesajın göndericisi veya alıcısı tepki ekleyebilir
    if (userId) {
      const { data: msg } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .eq('id', messageId)
        .single();
      if (!msg || (msg.sender_id !== userId && msg.receiver_id !== userId)) {
        throw new Error('Bu mesaja tepki ekleme yetkiniz yok.');
      }
    }
    // JSON formatı doğrulaması
    try { JSON.parse(reactionsJson); } catch { throw new Error('Geçersiz tepki formatı.'); }

    const { error } = await supabase
      .from('messages')
      .update({ reactions: reactionsJson })
      .eq('id', messageId);
    if (error && error.code !== '42703') throw error; // 42703 = column doesn't exist yet
  },

  /**
   * ★ Sohbeti gizle — tek taraflı (WhatsApp modeli)
   * ★ 2026-04-22: İki ayrı timestamp yazılır:
   *   - hidden_conversations_{uid}: inbox'tan gizleme — yeni mesaj gelirse/gönderilirse temizlenir
   *   - cleared_before_{uid}: mesaj filtresi — ASLA temizlenmez, silme her tekrar edildiğinde üst üste yazılır
   */
  async deleteConversation(userId: string, partnerId: string) {
    await this.markAsRead(userId, partnerId);
    const now = new Date().toISOString();

    const hiddenKey = `hidden_conversations_${userId}`;
    const hiddenRaw = await AsyncStorage.getItem(hiddenKey);
    const hiddenMap: Record<string, string> = hiddenRaw ? JSON.parse(hiddenRaw) : {};
    hiddenMap[partnerId] = now;
    await AsyncStorage.setItem(hiddenKey, JSON.stringify(hiddenMap));

    const clearKey = `cleared_before_${userId}`;
    const clearRaw = await AsyncStorage.getItem(clearKey);
    const clearMap: Record<string, string> = clearRaw ? JSON.parse(clearRaw) : {};
    clearMap[partnerId] = now;
    await AsyncStorage.setItem(clearKey, JSON.stringify(clearMap));
  },

  /** Gizlenmiş sohbet timestamp'lerini oku (inbox için) */
  async getHiddenConversations(userId: string): Promise<Record<string, string>> {
    const key = `hidden_conversations_${userId}`;
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  },

  /** Temizlenme timestamp'lerini oku (mesaj filtresi için — kalıcı).
   *  Backward-compat: eski `hidden_conversations_` kayıtlarını da fallback olarak kullanır
   *  — önceki APK sadece onu yazıyordu, yeni sürümde cleared_before boş kalmasın.
   */
  async getClearedBefore(userId: string): Promise<Record<string, string>> {
    const clearKey = `cleared_before_${userId}`;
    const clearRaw = await AsyncStorage.getItem(clearKey);
    const clearMap: Record<string, string> = clearRaw ? JSON.parse(clearRaw) : {};

    const hiddenKey = `hidden_conversations_${userId}`;
    const hiddenRaw = await AsyncStorage.getItem(hiddenKey);
    const hiddenMap: Record<string, string> = hiddenRaw ? JSON.parse(hiddenRaw) : {};
    for (const partnerId of Object.keys(hiddenMap)) {
      if (!clearMap[partnerId]) {
        clearMap[partnerId] = hiddenMap[partnerId];
      }
    }
    return clearMap;
  },

  /** Okunmamış toplam mesaj sayısı (genel) — is_deleted filtreli + engellenenler + gizlenenler hariç */
  async getUnreadCount(userId: string) {
    const blockedIds = await FriendshipService._getBlockedIds(userId);
    // ★ 2026-04-21: Kalıcı silinen (hidden) sohbetlerden gelen mesajlar unread sayılmaz.
    //   Kullanıcı silmiş bir sohbet için bildirim badge'i kafa karıştırıcı olur.
    const hiddenMap = await this.getHiddenConversations(userId);
    const hiddenPartnerIds = Object.keys(hiddenMap);

    let query = supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .not('is_deleted', 'is', true);

    if (blockedIds.size > 0) {
      const blockedArr = Array.from(blockedIds);
      query = query.not('sender_id', 'in', `(${blockedArr.map(id => `"${id}"`).join(',')})`);
    }
    if (hiddenPartnerIds.length > 0) {
      // Hidden partnerlerden gelen mesajlar sayılmaz
      query = query.not('sender_id', 'in', `(${hiddenPartnerIds.map(id => `"${id}"`).join(',')})`);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /** Realtime Yeni Mesaj Dinleyici */
  onNewMessage(userId: string, callback: (msg: Message) => void) {
    const channelName = `user_messages_${userId}`;
    // ★ FIX: supabase.channel() her çağrıda YENİ kanal oluşturur.
    // Mevcut kanalı bulmak için getChannels() kullanılmalı.
    try {
      const existingChannels = supabase.getChannels();
      const existing = existingChannels.find((ch: any) => ch.topic === `realtime:${channelName}`);
      if (existing) supabase.removeChannel(existing);
    } catch { /* ilk çağrıda kanal olmayabilir */ }

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
          if (data && !(data as any).is_deleted) callback(data as Message);
        }
      )
      .subscribe();

    return channel;
  },

  /** Yazıyor... (Typing Indicator) - Gönderici — ★ C2 FIX: Block kontrolü */
  _typingChannels: new Map<string, ReturnType<typeof supabase.channel>>(),
  // ★ ORTA-K: Per-receiver throttle — her keystroke yerine 1sn'de max 1 broadcast
  _typingLastSent: new Map<string, number>(),

  async sendTypingStatus(senderId: string, receiverId: string, isTyping: boolean) {
    // ★ ORTA-K: Throttle — isTyping=true için 1000ms, isTyping=false her zaman gider (anında durdur)
    if (isTyping) {
      const last = (this as any)._typingLastSent.get(receiverId) || 0;
      if (Date.now() - last < 1000) return;
      (this as any)._typingLastSent.set(receiverId, Date.now());
    }

    // ★ C2 FIX: Engellenen kişiye typing status gönderme
    const blockedIds = await FriendshipService._getBlockedIds(senderId);
    if (blockedIds.has(receiverId)) return;

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
    return channel;
  }
};
