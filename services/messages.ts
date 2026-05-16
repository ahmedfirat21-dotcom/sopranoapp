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
import { i18n } from '../../services/i18n';

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
      .select('id, sender_id, receiver_id, content, is_read, created_at, is_deleted, deleted_for_everyone, expires_at')
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
    // ★ v109: Süresi dolmuş (expires_at < now()) mesajları client-side filtrele —
    //   cron 15dk'da bir çalışır, ara dilim için UI tutarsızlığı önle.
    const nowMs = Date.now();
    const partnerMap = new Map<string, { lastMsg: any; unread: number }>();
    for (const msg of data) {
      if (msg.expires_at && new Date(msg.expires_at).getTime() < nowMs) continue;
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      // ★ Null/undefined partnerId — bozuk veri, atla
      if (!partnerId) continue;
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, { lastMsg: msg, unread: 0 });
      }
      // Okunmamış sayısı: karşı taraftan gelen + okunmamış (silinmemiş)
      if (msg.receiver_id === userId && !msg.is_read && !msg.deleted_for_everyone) {
        const entry = partnerMap.get(partnerId)!;
        entry.unread++;
      }
    }

    // ★ v110.5.24 (6 May 2026): Engellenen kişiler İNBOX'TA GÖRÜNÜR — eski
    //   yazışmaların kaybolmasın. Tıklayınca chat açılır, mesajlar görünür,
    //   üstte "Engellediniz" banner + input disable. (Kullanıcı şikayeti.)
    //   Reverse block (beni engelleyenler) GİZLİ kalır — onların yeni mesajı
    //   bana zaten gelmedi, eski yazışma gizli olsun.
    const allBlockedIds = await FriendshipService._getBlockedIds(userId);
    // _getBlockedIds iki yönlü dönüyor; ben engelledim olanları AYIR.
    const { data: iBlockedRows } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);
    const iBlockedSet = new Set((iBlockedRows || []).map((r: any) => r.blocked_id));
    // Beni engelleyenler = allBlockedIds - iBlockedSet
    const reverseBlockedSet = new Set<string>();
    allBlockedIds.forEach(id => { if (!iBlockedSet.has(id)) reverseBlockedSet.add(id); });

    // ★ v85: Pending mesaj isteği gönderenleri filtrele — onlar "İstekler" sekmesinde görünür
    const { data: pendingReqRows } = await supabase
      .from('message_requests')
      .select('sender_id')
      .eq('receiver_id', userId)
      .eq('status', 'pending');
    const pendingRequestSenderIds = new Set((pendingReqRows || []).map((r: any) => r.sender_id));

    // Partner profil bilgilerini toplu çek — sadece BENİ ENGELLEYENLERİ + pending istekleri filtrele
    const partnerIds = Array.from(partnerMap.keys()).filter(id => !reverseBlockedSet.has(id) && !pendingRequestSenderIds.has(id));
    if (partnerIds.length === 0) return [] as InboxItem[];

    // ★ Paralel çek: profiller + conversation_state (pin/archive/mute)
    const [profRes, stateRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url, is_online, subscription_tier, last_seen, active_frame, active_badge_id')
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
      // ★ v109: Herkes için silinmiş mesaj önizlemede placeholder
      if (lastMsg.deleted_for_everyone) {
        preview = '🚫 Bu mesaj silindi';
      } else if (preview.startsWith('🎤') || preview.includes('voice_messages/')) preview = '🎤 Sesli mesaj';
      else if (preview.startsWith('📷') || preview.match(/^https?.*\.(jpg|png|webp)/i)) preview = i18n.t('auto.messages.009');
      if (isSentByMe && !preview.startsWith('Sen:') && !lastMsg.deleted_for_everyone) preview = `Sen: ${preview}`;

      inbox.push({
        partner_id: partnerId,
        // ★ v110.14: profile fetch RLS/network nedeniyle null dönerse generic 'Kullanıcı'
        //   yerine sender_id'den türetilmiş kısa tag — en azından unique görünür.
        partner_name: prof?.display_name || `…${String(partnerId).slice(0, 4)}`,
        partner_avatar: prof?.avatar_url || '',
        partner_is_online: prof?.is_online || false,
        partner_tier: (prof as any)?.subscription_tier || 'Free',
        partner_frame: (prof as any)?.active_frame || null,
        partner_active_badge_id: (prof as any)?.active_badge_id || null,
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
    // ★ v110.5.21 (6 May 2026): Mesajlar HER zaman görünür — kullanıcı mesaj
    //   geçmişini kaybolmasın, sadece cevap vermek için engel kaldırma gerek.
    //   Block filter UI tarafında yapılıyor (inbox'ta gizli + chat ekranı banner +
    //   input disabled). getConversation hep gerçek mesajları döndürür.

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
      throw new Error(i18n.t('auto.messages.008'));
    }
    // Max 2000 karakter limiti
    if (sanitized.length > 2000) {
      throw new Error(i18n.t('auto.messages.007'));
    }
    // ★ 2026-04-25: Profanity filter — DM'de de aktif. Soft mask, gönderim engellenmez.
    let filtered = sanitized;
    try {
      const { filterBadWords } = require('../constants/badwords');
      filtered = filterBadWords(sanitized);
    } catch { /* badwords yoksa sessiz */ }
    content = filtered;

    // ★ Engel kontrolü: Her iki yönde de mesaj engellenir
    const blockedIds = await FriendshipService._getBlockedIds(senderId);
    if (blockedIds.has(receiverId)) {
      throw new Error(i18n.t('auto.messages.006'));
    }

    // ★ 2026-04-29 v85: Mesaj İsteği akışı geri geldi (Instagram-style).
    //   Arkadaşlar arası direct mesaj. Yabancılar arası: ilk mesaj request olarak
    //   kaydedilir (status=pending), receiver "İstekler" tabında görür → Kabul/Red.
    //   send_message_with_request RPC atomic olarak request lookup + create + msg insert
    //   yapar; engel/duplicate/rejected hatalarını net mesajla fırlatır.

    // ★ A4 FIX: Rate limiting — son 1 dakikada max 30 mesaj
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', senderId)
      .gte('created_at', oneMinuteAgo);
    if ((recentCount || 0) >= 30) {
      throw new Error(i18n.t('auto.messages.005'));
    }

    const imageUrl = typeof imageUrlOrIsRequest === 'string' ? imageUrlOrIsRequest : undefined;

    // ★ Atomic RPC: request lookup + create + message insert
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('send_message_with_request', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
      p_content: content,
      p_image_url: imageUrl ?? null,
      p_voice_url: voiceUrl ?? null,
      p_voice_duration: voiceDuration ?? null,
    });
    if (rpcErr) throw new Error(rpcErr.message || i18n.t('auto.messages.004'));
    const isRequest = !!(rpcRes as any)?.is_request;
    const messageId = (rpcRes as any)?.message_id;

    // Yeni eklenen mesajı tekrar çek (sender bilgisi ile)
    const { data: msg, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*)')
      .eq('id', messageId)
      .single();
    if (error) throw error;

    // Push bildirim gönder (arka planda, hata yutulur)
    const senderName = (msg as any).sender?.display_name || 'Birisi';
    const preview = voiceUrl ? '🎙️ Sesli mesaj' : imageUrl ? i18n.t('auto.messages.003') : (content.length > 50 ? content.substring(0, 50) + '...' : content);
    // ★ v85: request ise farklı push tipi → receiver "Mesaj İsteği" görür
    const pushTitle = isRequest ? i18n.t('auto.messages.002') : 'Yeni Mesaj';
    const pushType = isRequest ? 'message_request' as const : 'dm' as const;
    const pushRoute = isRequest ? `/chat/${senderId}?request=1` : `/chat/${senderId}`;
    PushService.sendToUser(receiverId, pushTitle, `${senderName}: ${preview}`, {
      type: pushType,
      route: pushRoute,
    }).catch(() => {});

    return msg as Message;
  },

  /** ★ 2026-04-22: Receiver mesaj isteğini kabul eder → normal chat açılır.
   *  ★ v86: Atomic RPC + sender'a broadcast bildirim (realtime.send). */
  async acceptMessageRequest(receiverId: string, senderId: string): Promise<void> {
    const { error } = await supabase.rpc('accept_message_request_atomic', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
    });
    if (!error) return;
    // Fallback (eski sürüm DB'lerde RPC yoksa)
    if (/function .* does not exist|42883/i.test(error.message || '')) {
      const { error: legacyErr } = await supabase
        .from('message_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('sender_id', senderId)
        .eq('receiver_id', receiverId)
        .eq('status', 'pending');
      if (legacyErr) throw legacyErr;
      return;
    }
    throw error;
  },

  /** ★ 2026-04-22: Receiver mesaj isteğini reddeder → mesajlar gizlenir.
   *  ★ v86: Atomic RPC + sender'a broadcast bildirim. */
  async rejectMessageRequest(receiverId: string, senderId: string): Promise<void> {
    const { error } = await supabase.rpc('reject_message_request_atomic', {
      p_sender_id: senderId,
      p_receiver_id: receiverId,
    });
    if (!error) return;
    // Fallback eski sürüm DB için
    if (/function .* does not exist|42883/i.test(error.message || '')) {
      const { error: legacyErr } = await supabase
        .from('message_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('sender_id', senderId)
        .eq('receiver_id', receiverId)
        .eq('status', 'pending');
      if (legacyErr) throw legacyErr;
      await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', receiverId);
      return;
    }
    throw error;
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
    const list = (data || []) as any[];
    if (list.length === 0) return list;
    // ★ v109: Her istek için ilk mesaj snippet'i — Instagram tarzı önizleme
    const senderIds = list.map(r => r.sender_id);
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender_id, content, created_at')
      .in('sender_id', senderIds)
      .eq('receiver_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    if (msgs) {
      const firstBySender: Record<string, string> = {};
      for (const m of msgs as any[]) {
        if (!firstBySender[m.sender_id]) firstBySender[m.sender_id] = m.content;
      }
      for (const r of list) r.first_message_content = firstBySender[r.sender_id] || '';
    }
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

  /** ★ v109: Mesajı düzenle — RPC: 24 saat içinde, sadece kendi mesajı, metin */
  async editMessage(userId: string, messageId: string, newContent: string): Promise<{ success: boolean; error?: string; edited_at?: string }> {
    const { data, error } = await supabase.rpc('edit_message', {
      p_user_id: userId,
      p_message_id: messageId,
      p_new_content: newContent,
    });
    if (error) return { success: false, error: error.message };
    return data as any;
  },

  /** ★ v109: Herkes için sil — RPC: 1 saat içinde, sadece kendi mesajı */
  async deleteForEveryone(userId: string, messageId: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('delete_message_for_everyone', {
      p_user_id: userId,
      p_message_id: messageId,
    });
    if (error) return { success: false, error: error.message };
    return data as any;
  },

  /** ★ v109: Mesajı başka kişiye ilet — RPC: yetki kontrol + yeni satır oluştur */
  async forwardMessage(userId: string, sourceMessageId: string, targetPartnerId: string): Promise<{ success: boolean; error?: string; new_message_id?: string }> {
    const { data, error } = await supabase.rpc('forward_message', {
      p_user_id: userId,
      p_source_message_id: sourceMessageId,
      p_target_partner_id: targetPartnerId,
    });
    if (error) return { success: false, error: error.message };
    return data as any;
  },

  /** ★ v109: Reply (yanıt) ile mesaj gönder — reply_to_id yazılır.
   *  Mevcut send() image/voice destekli, biz sadece reply_to_id ek olarak gönderelim. */
  async sendReply(senderId: string, receiverId: string, content: string, replyToId: string): Promise<Message | null> {
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: senderId, receiver_id: receiverId, content, reply_to_id: replyToId, type: 'text' })
      .select('*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)')
      .single();
    if (error) { if (__DEV__) console.warn('[Messages] sendReply hata:', error.message); return null; }
    return data as Message;
  },

  /** ★ v109: Sohbet içinde arama — son 500 mesaj limit, ILIKE case-insensitive */
  async searchInChat(userA: string, userB: string, query: string, limit = 50): Promise<Message[]> {
    if (!query || query.trim().length < 2) return [];
    const q = `%${query.trim()}%`;
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(display_name, avatar_url)')
      .or(`and(sender_id.eq.${userA},receiver_id.eq.${userB}),and(sender_id.eq.${userB},receiver_id.eq.${userA})`)
      .ilike('content', q)
      .eq('is_deleted', false)
      .eq('deleted_for_everyone', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { if (__DEV__) console.warn('[Messages] searchInChat hata:', error.message); return []; }
    return (data || []) as Message[];
  },

  /** ★ v109: Taslak kaydet (yarım yazılmış mesaj) — RPC */
  async saveDraft(userId: string, partnerId: string, content: string, replyToId?: string | null) {
    const { error } = await supabase.rpc('save_draft', {
      p_user_id: userId,
      p_partner_id: partnerId,
      p_content: content || '',
      p_reply_to_id: replyToId || null,
    });
    if (error && __DEV__) console.warn('[Messages] saveDraft hata:', error.message);
  },

  /** ★ v109: Bir partnerin taslağını oku — chat ekranı açıldığında input'a doldur */
  async getDraft(userId: string, partnerId: string): Promise<{ content: string; reply_to_id: string | null } | null> {
    const { data, error } = await supabase
      .from('message_drafts')
      .select('content, reply_to_id')
      .eq('user_id', userId).eq('partner_id', partnerId)
      .maybeSingle();
    if (error || !data) return null;
    return data as any;
  },

  /** ★ v109: Inbox için tüm taslakları çek — listede "Taslak: ..." göstermek için */
  async getAllDrafts(userId: string): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('message_drafts')
      .select('partner_id, content')
      .eq('user_id', userId);
    if (error || !data) return {};
    const map: Record<string, string> = {};
    for (const r of data as any[]) map[r.partner_id] = r.content;
    return map;
  },

  /** ★ v109: Mute toggle — conversation_state.muted_at flip */
  async toggleMute(userId: string, partnerId: string): Promise<boolean> {
    const { data: existing } = await supabase
      .from('conversation_state')
      .select('muted_at')
      .eq('user_id', userId).eq('partner_id', partnerId)
      .maybeSingle();
    const newMuted = !existing?.muted_at;
    const { error } = await supabase
      .from('conversation_state')
      .upsert({
        user_id: userId, partner_id: partnerId,
        muted_at: newMuted ? new Date().toISOString() : null,
      }, { onConflict: 'user_id,partner_id' });
    if (error) throw error;
    return newMuted;
  },

  /** ★ v109: Disappearing messages — TTL süresi (saniye) belirle (0 = kapat) */
  async setDisappearingTimer(userId: string, partnerId: string, seconds: number): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('set_disappearing_timer', {
      p_user_id: userId, p_partner_id: partnerId, p_seconds: seconds,
    });
    if (error) return { success: false, error: error.message };
    return data as any;
  },

  /** ★ v109: Mevcut TTL'i oku (chat header rozet için) */
  async getDisappearingTimer(userId: string, partnerId: string): Promise<number> {
    const { data } = await supabase
      .from('conversation_state')
      .select('disappearing_seconds')
      .eq('user_id', userId).eq('partner_id', partnerId)
      .maybeSingle();
    return (data as any)?.disappearing_seconds || 0;
  },

  /** ★ v109: Saved messages — kaydet/kaldır/listele */
  async toggleSavedMessage(userId: string, messageId: string): Promise<boolean> {
    const { data: existing } = await supabase
      .from('saved_messages')
      .select('message_id')
      .eq('user_id', userId).eq('message_id', messageId)
      .maybeSingle();
    if (existing) {
      await supabase.from('saved_messages').delete()
        .eq('user_id', userId).eq('message_id', messageId);
      return false;
    }
    await supabase.from('saved_messages')
      .insert({ user_id: userId, message_id: messageId });
    return true;
  },

  async getSavedMessageIds(userId: string): Promise<Set<string>> {
    const { data } = await supabase
      .from('saved_messages').select('message_id').eq('user_id', userId);
    return new Set((data || []).map((r: any) => r.message_id));
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
    try { JSON.parse(reactionsJson); } catch { throw new Error(i18n.t('auto.messages.001')); }

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

  /** Okunmamış toplam mesaj sayısı (genel) — is_deleted + engellenenler + gizlenenler + pending istekler hariç */
  async getUnreadCount(userId: string) {
    // ★ 2026-04-29 v85: Yabancıdan pending request mesajları DM badge'inde sayılmaz —
    //   "İstekler (N)" chip'i ayrı sayaç tutuyor. Çift sayım engellenir.
    const [blockedIds, hiddenMap, pendingReqRows] = await Promise.all([
      FriendshipService._getBlockedIds(userId),
      this.getHiddenConversations(userId),
      supabase.from('message_requests').select('sender_id').eq('receiver_id', userId).eq('status', 'pending'),
    ]);
    const hiddenPartnerIds = Object.keys(hiddenMap);
    const pendingSenderIds = ((pendingReqRows as any).data || []).map((r: any) => r.sender_id).filter(Boolean);

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
      query = query.not('sender_id', 'in', `(${hiddenPartnerIds.map(id => `"${id}"`).join(',')})`);
    }
    if (pendingSenderIds.length > 0) {
      query = query.not('sender_id', 'in', `(${pendingSenderIds.map((id: string) => `"${id}"`).join(',')})`);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  },

  /** Realtime Yeni Mesaj Dinleyici
   *  ★ 2026-04-24 FIX: Aynı channel adı (user_messages_${uid}) farklı ekranlardan
   *  (messages listesi + chat ekranı) çağrılınca sonraki öncekini siliyor ve realtime
   *  kopuyordu. callerId ile benzersiz channel adı üret.
   */
  onNewMessage(userId: string, callerId: string, callback: (msg: Message) => void) {
    const channelName = `user_messages_${userId}_${callerId}`;
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

  /** Yazıyor... (Typing Indicator) - Dinleyici
   *  ★ v86: Sender ve receiver tarafları aynı broadcast config kullansın diye self:false eklendi. */
  onTypingStatus(currentUserId: string, callback: (payload: { user_id: string, is_typing: boolean, conversation_partner_id: string }) => void) {
    const channelName = `typing_${currentUserId}`;
    const channel = supabase
      .channel(channelName, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, (payload) => {
        callback(payload.payload as any);
      })
      .subscribe((status: string) => {
        if (__DEV__) console.log(`[Typing] ${channelName} → ${status}`);
      });
    return channel;
  }
};
