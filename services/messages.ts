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
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, is_online, subscription_tier')
      .in('id', partnerIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // InboxItem formatına dönüştür
    const inbox: InboxItem[] = [];
    for (const [partnerId, { lastMsg, unread }] of partnerMap) {
      const prof = profileMap.get(partnerId);
      const isSentByMe = lastMsg.sender_id === userId;
      let preview = lastMsg.content || '';
      // Media tespiti content'ten (sütun yok)
      if (preview.startsWith('🎤') || preview.includes('voice_messages/')) preview = '🎤 Sesli mesaj';
      else if (preview.startsWith('📷') || preview.match(/^https?.*\.(jpg|png|webp)/i)) preview = '📷 Fotoğraf';
      if (isSentByMe && !preview.startsWith('Sen:')) preview = `Sen: ${preview}`;

      inbox.push({
        partner_id: partnerId,
        partner_name: prof?.display_name || 'Kullanıcı',
        partner_avatar: prof?.avatar_url || '',
        partner_is_online: prof?.is_online || false,
        partner_tier: (prof as any)?.subscription_tier || 'Free',
        last_message_content: preview,
        last_message_time: lastMsg.created_at,
        unread_count: unread,
        // ★ WhatsApp tik göstergesi verileri
        is_last_msg_mine: isSentByMe,
        is_last_msg_read: isSentByMe ? !!lastMsg.is_read : undefined,
      });
    }

    // ★ FIX: Gizlenmiş sohbetleri filtrele — deleteConversation ile gizlenenler
    const hiddenMap = await this.getHiddenConversations(userId);
    const filteredInbox = inbox.filter(item => {
      const hiddenAt = hiddenMap[item.partner_id];
      if (!hiddenAt) return true; // gizlenmemiş
      // Son mesaj gizleme tarihinden sonra geldiyse tekrar göster
      return new Date(item.last_message_time).getTime() > new Date(hiddenAt).getTime();
    });

    // Son mesaja göre sırala (en yeni üste)
    filteredInbox.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
    return filteredInbox;
  },

  /** İki kişi arasındaki tüm konuşma geçmişini getir */
  async getConversation(user1Id: string, user2Id: string, limit = 200) {
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

    // ★ A3 FIX: Arkadaşlık kontrolü — sadece accepted arkadaşlar mesajlaşabilir
    const { data: friendship } = await supabase
      .from('friendships')
      .select('status')
      .or(`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!friendship) {
      throw new Error('Mesaj göndermek için önce arkadaşlık isteği göndermelisiniz.');
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
    const pushTitle = 'Yeni Mesaj';
    PushService.sendToUser(receiverId, pushTitle, `${senderName}: ${preview}`, {
      type: 'dm',
      route: `/chat/${senderId}`,
    }).catch(() => {});

    return msg as Message;
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
   */
  async deleteConversation(userId: string, partnerId: string) {
    await this.markAsRead(userId, partnerId);

    const key = `hidden_conversations_${userId}`;
    const raw = await AsyncStorage.getItem(key);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[partnerId] = new Date().toISOString();
    await AsyncStorage.setItem(key, JSON.stringify(map));
  },

  /** Gizlenmiş sohbet timestamp'lerini oku */
  async getHiddenConversations(userId: string): Promise<Record<string, string>> {
    const key = `hidden_conversations_${userId}`;
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  },

  /** Okunmamış toplam mesaj sayısı (genel) — is_deleted filtreli + engellenenler hariç */
  async getUnreadCount(userId: string) {
    const blockedIds = await FriendshipService._getBlockedIds(userId);
    
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

    return {
      unsubscribe: () => { supabase.removeChannel(channel); },
    };
  },

  /** Yazıyor... (Typing Indicator) - Gönderici — ★ C2 FIX: Block kontrolü */
  _typingChannels: new Map<string, ReturnType<typeof supabase.channel>>(),

  async sendTypingStatus(senderId: string, receiverId: string, isTyping: boolean) {
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
    return { unsubscribe: () => { supabase.removeChannel(channel); } };
  }
};
