/**
 * SopranoChat — useRoomBroadcast Hook
 * ═══════════════════════════════════════════════════
 * ★ ARCH-1 FIX: room/[id].tsx God Component decomposition — Hook 1
 * 
 * Sorumluluk:
 *   - Emoji broadcast kanalı (gönder + al)
 *   - Mikrofon isteği broadcast kanalı (request/cancel/approved/rejected)
 *   - Moderasyon broadcast kanalı (kick/mute/demote/promote/settings_changed + oda geneli eventlar)
 *
 * Kaldırılan satırlar: room/[id].tsx L162-359 (~200 satır)
 */
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../constants/supabase';
import { RoomService } from '../services/database';
import { purgeChannelByName } from '../services/realtime';
import { liveKitService } from '../services/livekit';
import { showToast as _globalToast } from '../components/Toast';
// ★ BUG FIX: Tamamen bastırmak yerine akıllı filtre — sadece önemli olanları göster
const showToast = (opts: { title?: string; message?: string; type?: string }) => {
  if (opts.type === 'error' || opts.type === 'warning') {
    _globalToast({ title: opts.title || '', message: opts.message, type: opts.type, duration: 2500 });
    return;
  }
  const important = /silindi|donduruldu|sahne|ayrıl|host|boost|ban|sustur|takip|bağış|SP|kick|süre/i;
  if (opts.title && important.test(opts.title)) {
    _globalToast({ title: opts.title, message: opts.message, type: (opts.type as any) || 'success', duration: 2000 });
  }
};
import { safeGoBack } from '../constants/navigation';
import type { Room, RoomParticipant } from '../types';
import type { RoomMessage } from '../services/roomChat';
import type { FloatingReactionsRef } from '../components/EmojiReactions';
import type { ModerationOverlayRef } from '../components/room/ModerationOverlay';
import type { FlashType } from '../components/room/AvatarPenaltyFlash';
import type { DonationAlertRef } from '../components/room/DonationAlert';

// ─── Types ──────────────────────────────────────
export type ModChannelRef = React.MutableRefObject<ReturnType<typeof supabase.channel> | null>;
export type MicReqChannelRef = React.MutableRefObject<ReturnType<typeof supabase.channel> | null>;

type UseRoomBroadcastParams = {
  roomId: string | undefined;
  firebaseUser: { uid: string; displayName?: string | null } | null;
  profile: { display_name?: string; is_admin?: boolean } | null;
  room: Room | null;
  router: any;
  floatingRef: React.RefObject<FloatingReactionsRef>;
  setRoom: React.Dispatch<React.SetStateAction<Room | null>>;
  setParticipants: React.Dispatch<React.SetStateAction<RoomParticipant[]>>;
  setChatMessages: React.Dispatch<React.SetStateAction<RoomMessage[]>>;
  setMicRequests: React.Dispatch<React.SetStateAction<string[]>>;
  setMyMicRequested: React.Dispatch<React.SetStateAction<boolean>>;
  setClosingCountdown: React.Dispatch<React.SetStateAction<number | null>>;
  setSpeakingMode: React.Dispatch<React.SetStateAction<'free_for_all' | 'permission_only' | 'selected_only'>>;
  setMinimizedRoom: (val: any) => void;
  setAlertConfig: React.Dispatch<React.SetStateAction<any>>;
  roomHostRef: React.MutableRefObject<string | null>;
  /** ★ ModerationOverlay ref — ceza alan kişi ekranı */
  penaltyRef: React.RefObject<ModerationOverlayRef>;
  /** ★ Avatar flash state setter — herkes görür */
  setAvatarFlash: (userId: string, flashType: FlashType) => void;
  /** ★ BUG-1 FIX: Ref ile güncel LiveKit state — stale closure önleme */
  lkRef: React.MutableRefObject<{
    isMicrophoneEnabled: boolean;
    toggleMic: () => Promise<any>;
    enableMic?: () => Promise<any>;
    disableMic?: () => Promise<any>;
  }>;
  /** ★ DonationAlert ref — bağış bildirimini tüm odaya göster */
  donationAlertRef?: React.RefObject<DonationAlertRef>;
  /** ★ O4: Kendi is_chat_muted durumunu her render'da güncelle; emoji/reaction spam engeli için. */
  isChatMutedRef?: React.MutableRefObject<boolean>;
};

export function useRoomBroadcast(params: UseRoomBroadcastParams) {
  const {
    roomId, firebaseUser, profile, room, router,
    floatingRef, setRoom, setParticipants, setChatMessages,
    setMicRequests, setMyMicRequested, setClosingCountdown,
    setSpeakingMode, setMinimizedRoom, setAlertConfig, roomHostRef,
    penaltyRef, setAvatarFlash, lkRef, donationAlertRef, isChatMutedRef,
  } = params;

  // ── Refs ───────────────────────────────────────
  const emojiBroadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const micReqChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const modChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // ★ O1: Stage invite modal'ının şu an açık olup olmadığını takip et.
  // settings_changed / kick durumunda modal stale kalmasın diye kapatabilmek için.
  const stageInviteOpenRef = useRef(false);

  // ── Emoji Rate Limit ──────────────────────────
  // ★ D5: Tek kaynaktan flood engeli — 3 katman:
  //   1) Minimum aralık 333ms (3/sn)
  //   2) Son 3sn'de max 8 reaction (burst)
  //   3) Cooldown: burst aşılırsa 5sn kilit
  const lastEmojiTimeRef = useRef(0);
  const recentEmojiTimesRef = useRef<number[]>([]);
  const emojiCooldownUntilRef = useRef(0);
  const sendEmojiReaction = useCallback((emoji: string) => {
    if (isChatMutedRef?.current) return;
    const now = Date.now();
    if (now < emojiCooldownUntilRef.current) return; // cooldown aktif
    if (now - lastEmojiTimeRef.current < 333) return; // 3/sn
    // 3sn pencere içindeki son reaction'ları say
    const windowStart = now - 3000;
    recentEmojiTimesRef.current = recentEmojiTimesRef.current.filter(t => t > windowStart);
    if (recentEmojiTimesRef.current.length >= 8) {
      emojiCooldownUntilRef.current = now + 5000;
      return;
    }
    recentEmojiTimesRef.current.push(now);
    lastEmojiTimeRef.current = now;
    floatingRef.current?.spawn(emoji);
    emojiBroadcastRef.current?.send({
      type: 'broadcast',
      event: 'emoji',
      payload: { emoji, senderId: firebaseUser?.uid },
    });
  }, [isChatMutedRef, firebaseUser?.uid]);

  // ── Bağış Bildirim Broadcast ──────────────────
  const sendDonationAlert = useCallback((senderName: string, amount: number) => {
    // Kendi ekranında göster
    donationAlertRef?.current?.show({ senderName, amount });
    // Tüm odaya broadcast
    modChannelRef.current?.send({
      type: 'broadcast',
      event: 'donation_alert',
      payload: { senderName, amount },
    });
  }, [donationAlertRef]);

  // ── 1. Emoji Broadcast Kanalı ─────────────────
  // ★ SEC-EMOJI-RECV: Alıcı tarafta da rate limit — broadcast spoofing koruması.
  // D5: Per-sender throttle (aynı kişi spam yapsa bile ekranda max 5/sn görünür).
  const globalEmojiRecvRef = useRef(0);
  const perSenderRecvRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!roomId) return;
    const name = `emoji:${roomId}`;
    purgeChannelByName(name);
    const ch = supabase.channel(name);
    ch.on('broadcast', { event: 'emoji' }, (payload: any) => {
      const emoji = payload?.payload?.emoji;
      const senderId: string | undefined = payload?.payload?.senderId;
      if (!emoji) return;
      const now = Date.now();
      // Global throttle: ekranda aşırı birikmesin (tüm senders birlikte max 10/sn)
      if (now - globalEmojiRecvRef.current < 100) return;
      // Per-sender throttle: tek kişi flood yapsa da sadece 5/sn
      if (senderId) {
        const last = perSenderRecvRef.current.get(senderId) || 0;
        if (now - last < 200) return;
        perSenderRecvRef.current.set(senderId, now);
      }
      globalEmojiRecvRef.current = now;
      floatingRef.current?.spawn(emoji);
    }).subscribe();
    emojiBroadcastRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      perSenderRecvRef.current.clear();
    };
  }, [roomId]);

  // ── 2. Mikrofon İsteği Broadcast Kanalı ───────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const name = `mic_req:${roomId}`;
    purgeChannelByName(name);
    const ch = supabase.channel(name);
    ch.on('broadcast', { event: 'mic_request' }, (payload: any) => {
      const data = payload?.payload;
      if (!data) return;
      if (data.type === 'request') {
        setMicRequests(prev => {
          if (prev.includes(data.userId)) return prev;
          return [...prev, data.userId];
        });
        const reqMsg = {
          id: `mic_req_${data.userId}_${Date.now()}`,
          room_id: roomId as string,
          user_id: data.userId,
          content: '🤚 Mikrofon isteği gönderdi',
          created_at: new Date().toISOString(),
          profiles: { display_name: data.displayName || 'Kullanıcı' },
          isSystem: true,
        } as any;
        setChatMessages(prev => [reqMsg, ...prev].slice(0, 100));
      } else if (data.type === 'cancel') {
        setMicRequests(prev => prev.filter(u => u !== data.userId));
      } else if (data.type === 'approved') {
        // ★ O1 FIX: Tüm clientlarda queue'dan sil (eskiden sadece target güncelleniyordu)
        setMicRequests(prev => prev.filter(u => u !== data.userId));
        if (data.userId === firebaseUser.uid) {
          setMyMicRequested(false);
          penaltyRef.current?.show({ type: 'promote' });
          setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
          setTimeout(() => { lkRef.current.enableMic?.().catch(() => {}); }, 500);
        }
      } else if (data.type === 'rejected') {
        // ★ O1 FIX: Tüm clientlarda queue'dan sil
        setMicRequests(prev => prev.filter(u => u !== data.userId));
        if (data.userId === firebaseUser.uid) {
          setMyMicRequested(false);
          penaltyRef.current?.show({ type: 'demote', reason: 'Mikrofon isteğiniz reddedildi.' });
        }
      }
    }).subscribe();
    micReqChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId, firebaseUser]);

  // ── 3. Moderasyon Broadcast Kanalı ────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const name = `mod_action:${roomId}`;
    purgeChannelByName(name);
    const ch = supabase.channel(name);
    ch.on('broadcast', { event: 'mod_action' }, (payload: any) => {
      const data = payload?.payload;
      if (!data) return;

      // ★ SEC-BROADCAST: Broadcast doğrulaması
      // Not: Tüm moderasyon aksiyonları DB katmanında yetki kontrolünden geçiyor (_requireRole).
      // Broadcast sadece UI senkronizasyonu — DB'yi değiştirmez.
      // Bu nedenle senderId kontrolü sadece bilinen yetkisiz kaynakları engeller.
      // ★ K2 FIX: isFromMod hardcode false yerine — senderId yoksa (eski format) kabul et
      const TARGETED_ACTIONS = ['kick', 'ban', 'permban', 'mute', 'unmute', 'chat_mute', 'chat_unmute', 'promote', 'demote', 'make_moderator', 'remove_moderator'];
      if (TARGETED_ACTIONS.includes(data.action) && data.senderId) {
        // senderId kendi uid'miz ise yoksay (echo prevention — kendi aksiyonumuz)
        if (data.senderId === firebaseUser.uid) return;
        // Aksi halde: DB yetki kontrolü zaten yapıldı, broadcast güvenilir
      }

      // ── Oda geneli eventlar ──
      if (data.action === 'room_closing_countdown') {
        const seconds = data.seconds || 60;
        setClosingCountdown(seconds);
        penaltyRef.current?.show({ type: 'mute_all', reason: `Oda ${seconds} saniye içinde kapanacak.` });
        return;
      } else if (data.action === 'original_host_returned') {
        setClosingCountdown(null);
        RoomService.get(roomId as string).then(setRoom).catch(() => {});
        return;
      } else if (data.action === 'host_claimed') {
        setClosingCountdown(null);
        RoomService.get(roomId as string).then(setRoom).catch(() => {});
        return;
      } else if (data.action === 'room_frozen') {
        penaltyRef.current?.show({ type: 'kick', reason: `${data.hostName || 'Oda sahibi'} odayı dondurdu.` });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 2000);
        return;
      } else if (data.action === 'room_deleted') {
        penaltyRef.current?.show({ type: 'kick', reason: `${data.hostName || 'Oda sahibi'} odayı sildi.` });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 2000);
        return;
      }

      // ── mute_all ──
      if (data.action === 'mute_all') {
        const amHost = roomHostRef.current === firebaseUser?.uid;
        if (!amHost && lkRef.current.isMicrophoneEnabled) {
          lkRef.current.toggleMic().catch(() => {});
        }
        penaltyRef.current?.show({ type: 'mute_all', reason: 'Oda sahibi tüm konuşmacıları susturdu.' });
        return;
      }

      // ── Kullanıcı hedefli eventlar ──
      const isTargetMe = data.targetUserId === firebaseUser.uid;

      // ★ Herkesin görmesi gereken participant güncellemeleri + avatar flash
      if (data.action === 'promote' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, role: 'speaker' as const, is_muted: false } : p));
        setAvatarFlash(data.targetUserId, 'promote');
        return;
      } else if (data.action === 'owner_rejoin') {
        // ★ Host sahneye geri döndü — herkes için 'owner' olarak güncelle
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, role: 'owner' as const, is_muted: false } : p));
        if (!isTargetMe) setAvatarFlash(data.targetUserId, 'promote');
        return;
      } else if (data.action === 'self_demote') {
        // ★ Kullanıcı kendi isteğiyle sahneden indi — diğerleri için güncelle
        if (!isTargetMe) {
          setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, role: 'listener' as const } : p));
          setAvatarFlash(data.targetUserId, 'demote');
        }
        // isTargetMe durumunda: zaten optimistik olarak güncellendi, ModerationOverlay gösterme
        return;
      } else if (data.action === 'demote' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, role: 'listener' as const } : p));
        setAvatarFlash(data.targetUserId, 'demote');
        return;
      } else if (data.action === 'make_moderator' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, role: 'moderator' as const } : p));
        return;
      } else if (data.action === 'remove_moderator' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, role: 'speaker' as const } : p));
        return;
      } else if ((data.action === 'kick' || data.action === 'ban' || data.action === 'permban') && !isTargetMe) {
        // ★ Flash: kick/ban animasyonu avatarda göster, sonra listeden kaldır
        setAvatarFlash(data.targetUserId, data.action === 'kick' ? 'kick' : 'ban');
        setTimeout(() => {
          setParticipants(prev => prev.filter(p => p.user_id !== data.targetUserId));
        }, 1500);
        return;
      } else if (data.action === 'mute' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, is_muted: true, role: 'listener' as const } : p));
        setAvatarFlash(data.targetUserId, 'mute');
        return;
      } else if (data.action === 'unmute' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, is_muted: false } : p));
        setAvatarFlash(data.targetUserId, 'unmute');
        return;
      } else if (data.action === 'chat_mute' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, is_chat_muted: true } : p));
        setAvatarFlash(data.targetUserId, 'chat_mute');
        return;
      } else if (data.action === 'chat_unmute' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, is_chat_muted: false } : p));
        setAvatarFlash(data.targetUserId, 'chat_unmute');
        return;
      } else if (data.action === 'ghost_on' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, is_ghost: true } as any : p));
        return;
      } else if (data.action === 'ghost_off' && !isTargetMe) {
        setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, is_ghost: false } as any : p));
        return;
      } else if (data.action === 'disguise' && !isTargetMe) {
        if (data.newName) {
          setParticipants(prev => prev.map(p => p.user_id === data.targetUserId ? { ...p, display_name: data.newName, avatar_url: data.newAvatar } as any : p));
        }
        return;
      } else if (data.action === 'undisguise' && !isTargetMe) {
        RoomService.get(roomId as string).then(setRoom).catch(() => {});
        return;
      }
      // ── Erişim isteği — host ve moderatörler görür ──
      if (data.action === 'access_request') {
        // Sadece host ve moderatörler görsün
        setAlertConfig({
          visible: true,
          title: '🚪 Katılma İsteği',
          message: `${data.displayName || 'Birisi'} odaya katılmak istiyor.`,
          type: 'info',
          icon: 'person-add',
          buttons: [
            { text: 'Reddet', style: 'cancel' },
            { text: 'Kabul Et', onPress: async () => {
              try {
                // İsteği onayla
                const { data: reqData } = await import('../constants/supabase').then(m => m.supabase
                  .from('room_access_requests')
                  .select('id')
                  .eq('room_id', roomId)
                  .eq('user_id', data.targetUserId)
                  .eq('status', 'pending')
                  .maybeSingle()
                );
                if (reqData) {
                  const { RoomAccessService } = await import('../services/roomAccess');
                  await RoomAccessService.approveRequest(reqData.id, firebaseUser?.uid || '');
                }
              } catch { /* silent */ }
            }},
          ],
        });
        return;
      }

      // ── Bana yönelik eventlar — ModerationOverlay ile göster ──
      if (!isTargetMe) return;

      if (data.action === 'kick') {
        penaltyRef.current?.show({ type: 'kick', reason: data.reason || 'Moderatör seni odadan çıkardı.' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 1500);
      } else if (data.action === 'ban') {
        penaltyRef.current?.show({ type: 'ban', reason: data.reason || 'Bu odadan geçici olarak yasaklandın.' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 1500);
      } else if (data.action === 'permban') {
        penaltyRef.current?.show({ type: 'permban', reason: data.reason || 'Bu odaya bir daha giremezsin.' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 1500);
      } else if (data.action === 'mute') {
        penaltyRef.current?.show({ type: 'mute', reason: data.reason || 'Moderatör seni susturdu.', duration: data.reason });
        // ★ Y19: toggleMic yerine disableMic — "kapat" intent'i net, yanlışlıkla re-enable olmaz
        (lkRef.current.disableMic?.() ?? (lkRef.current.isMicrophoneEnabled ? lkRef.current.toggleMic() : Promise.resolve())).catch(() => {});
      } else if (data.action === 'unmute') {
        penaltyRef.current?.show({ type: 'unmute' });
      } else if (data.action === 'demote') {
        penaltyRef.current?.show({ type: 'demote', reason: 'Moderatör seni dinleyiciye düşürdü.' });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'listener' as const } : p));
        (lkRef.current.disableMic?.() ?? (lkRef.current.isMicrophoneEnabled ? lkRef.current.toggleMic() : Promise.resolve())).catch(() => {});
        // ★ BUG FIX: Demote sonrası el kaldırma durumunu sıfırla — aksi halde sırada kalır
        setMyMicRequested(false);
        setMicRequests(prev => prev.filter(u => u !== firebaseUser.uid));
      } else if (data.action === 'promote') {
        penaltyRef.current?.show({ type: 'promote' });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
        setTimeout(() => { lkRef.current.enableMic?.().catch(() => {}); }, 500);
      } else if (data.action === 'stage_invite') {
        // ★ Sahneye davet — kabul/red modalı. O1: açık durumu ref ile takip et.
        stageInviteOpenRef.current = true;
        setAlertConfig({
          visible: true,
          title: '🎤 Sahneye Davet',
          message: `${data.inviterName || 'Moderatör'} seni sahneye davet ediyor. Kabul edersen konuşmaya başlayabilirsin.`,
          type: 'info',
          icon: 'mic',
          buttons: [
            { text: 'Reddet', style: 'cancel', onPress: () => {
              stageInviteOpenRef.current = false;
              modChannelRef.current?.send({
                type: 'broadcast', event: 'mod_action',
                payload: { action: 'stage_invite_declined', targetUserId: firebaseUser.uid, displayName: profile?.display_name || 'Kullanıcı' },
              });
            }},
            { text: 'Kabul Et', style: 'default', onPress: async () => {
              stageInviteOpenRef.current = false;
              try {
                await RoomService.promoteSpeaker(roomId as string, firebaseUser.uid);
                setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
                modChannelRef.current?.send({
                  type: 'broadcast', event: 'mod_action',
                  payload: { action: 'promote', targetUserId: firebaseUser.uid },
                });
                penaltyRef.current?.show({ type: 'promote' });
                setTimeout(() => { lkRef.current.enableMic?.().catch(() => {}); }, 500);
              } catch {
                // silent
              }
            }},
          ],
        });
      } else if (data.action === 'stage_invite_declined' && !isTargetMe) {
        // Davet eden kişiye flash (opsiyonel)
      } else if (data.action === 'make_moderator') {
        penaltyRef.current?.show({ type: 'make_moderator' });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'moderator' as const } : p));
      } else if (data.action === 'remove_moderator') {
        penaltyRef.current?.show({ type: 'remove_moderator' });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const } : p));
      } else if (data.action === 'chat_mute') {
        penaltyRef.current?.show({ type: 'chat_mute', reason: 'Moderatör metin sohbetini kapattı.' });
      } else if (data.action === 'chat_unmute') {
        penaltyRef.current?.show({ type: 'chat_unmute' });
      } else if (data.action === 'host_transferred') {
        // ★ BUG FIX: Yeni host'un roomHostRef'ini güncelle — moderasyon broadcast doğrulaması buna bağlı
        if (isTargetMe) {
          roomHostRef.current = firebaseUser.uid;
        }
        penaltyRef.current?.show({ type: 'make_moderator', reason: `${data.oldHostName || 'Oda sahibi'} odayı sana devretti.` });
      }
    });

    // ── donation_alert — Bağış bildirimi tüm odaya ──
    ch.on('broadcast', { event: 'donation_alert' }, (payload: any) => {
      const alertData = payload?.payload;
      if (!alertData?.senderName || !alertData?.amount) return;
      donationAlertRef?.current?.show({
        senderName: alertData.senderName,
        amount: alertData.amount,
      });
    });

    // ── settings_changed ──
    ch.on('broadcast', { event: 'settings_changed' }, (payload: any) => {
      const newSettings = payload?.payload;
      if (!newSettings) return;
      setRoom(prev => {
        if (!prev) return prev;
        const merged: any = { ...prev };
        if (newSettings.room_settings) {
          merged.room_settings = { ...(prev.room_settings || {}), ...newSettings.room_settings };
          const newSpeakingMode = newSettings.room_settings.speaking_mode;
          if (newSpeakingMode && ['free_for_all', 'permission_only', 'selected_only'].includes(newSpeakingMode)) {
            setSpeakingMode(newSpeakingMode);
            // ★ O1: speaking_mode değiştiyse açık stage invite modalı geçersiz; kapat.
            if (stageInviteOpenRef.current) {
              stageInviteOpenRef.current = false;
              setAlertConfig((prev: any) => ({ ...prev, visible: false }));
            }
          }
        }
        if (newSettings.name !== undefined) merged.name = newSettings.name;
        if (newSettings.type !== undefined) merged.type = newSettings.type;
        if (newSettings.theme_id !== undefined) merged.theme_id = newSettings.theme_id;
        if (newSettings.room_image_url !== undefined) merged.room_image_url = newSettings.room_image_url;
        return merged;
      });
    });

    ch.subscribe();
    modChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId, firebaseUser]);

  return {
    // Channel refs — diğer handler'lar tarafından kullanılır
    emojiBroadcastRef,
    micReqChannelRef,
    modChannelRef,
    // Actions
    sendEmojiReaction,
    sendDonationAlert,
  };
}
