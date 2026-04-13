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
import { liveKitService } from '../services/livekit';
import { showToast } from '../components/Toast';
import { safeGoBack } from '../constants/navigation';
import type { Room, RoomParticipant } from '../types';
import type { RoomMessage } from '../services/roomChat';
import type { FloatingReactionsRef } from '../components/EmojiReactions';

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
  roomHostRef: React.MutableRefObject<string | null>;
  lk: {
    isMicrophoneEnabled: boolean;
    toggleMic: () => Promise<any>;
    enableMic?: () => Promise<any>;
  };
};

export function useRoomBroadcast(params: UseRoomBroadcastParams) {
  const {
    roomId, firebaseUser, profile, room, router,
    floatingRef, setRoom, setParticipants, setChatMessages,
    setMicRequests, setMyMicRequested, setClosingCountdown,
    setSpeakingMode, setMinimizedRoom, roomHostRef, lk,
  } = params;

  // ── Refs ───────────────────────────────────────
  const emojiBroadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const micReqChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const modChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Emoji Rate Limit ──────────────────────────
  const lastEmojiTimeRef = useRef(0);
  const sendEmojiReaction = useCallback((emoji: string) => {
    const now = Date.now();
    if (now - lastEmojiTimeRef.current < 333) return; // 3/sn limit
    lastEmojiTimeRef.current = now;
    floatingRef.current?.spawn(emoji);
    emojiBroadcastRef.current?.send({
      type: 'broadcast',
      event: 'emoji',
      payload: { emoji },
    });
  }, []);

  // ── 1. Emoji Broadcast Kanalı ─────────────────
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`emoji:${roomId}`);
    ch.on('broadcast', { event: 'emoji' }, (payload: any) => {
      if (payload?.payload?.emoji) {
        floatingRef.current?.spawn(payload.payload.emoji);
      }
    }).subscribe();
    emojiBroadcastRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  // ── 2. Mikrofon İsteği Broadcast Kanalı ───────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const ch = supabase.channel(`mic_req:${roomId}`);
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
      } else if (data.type === 'approved' && data.userId === firebaseUser.uid) {
        setMyMicRequested(false);
        showToast({ title: '🤚 Onaylandı!', message: 'Sahneye alındınız! Mikrofon otomatik açılıyor...', type: 'success' });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
        setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
      } else if (data.type === 'rejected' && data.userId === firebaseUser.uid) {
        setMyMicRequested(false);
        showToast({ title: 'Reddedildi', message: 'Mikrofon isteğiniz reddedildi.', type: 'warning' });
      }
    }).subscribe();
    micReqChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId, firebaseUser]);

  // ── 3. Moderasyon Broadcast Kanalı ────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const ch = supabase.channel(`mod_action:${roomId}`);
    ch.on('broadcast', { event: 'mod_action' }, (payload: any) => {
      const data = payload?.payload;
      if (!data) return;

      // ── Oda geneli eventlar ──
      if (data.action === 'room_closing_countdown') {
        const seconds = data.seconds || 60;
        setClosingCountdown(seconds);
        showToast({ title: '⏳ Oda Kapanıyor', message: `Oda sahibi ve moderatör ayrıldı. Oda ${seconds} saniye içinde kapanacak.`, type: 'warning' });
        return;
      } else if (data.action === 'original_host_returned') {
        setClosingCountdown(null);
        showToast({ title: '👑 Oda Sahibi Döndü!', message: `${data.hostName || 'Oda sahibi'} geri döndü. Oda yönetimi devredildi.`, type: 'success' });
        RoomService.get(roomId as string).then(setRoom).catch(() => {});
        return;
      } else if (data.action === 'host_claimed') {
        setClosingCountdown(null);
        showToast({ title: '👑 Yeni Host!', message: `${data.hostName || 'Birisi'} odanın host'u oldu. Geri sayım iptal edildi.`, type: 'success' });
        RoomService.get(roomId as string).then(setRoom).catch(() => {});
        return;
      } else if (data.action === 'room_frozen') {
        showToast({ title: '❄️ Oda Donduruldu', message: `${data.hostName || 'Oda sahibi'} odayı dondurdu.`, type: 'warning' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 2000);
        return;
      } else if (data.action === 'room_deleted') {
        showToast({ title: '🗑️ Oda Silindi', message: `${data.hostName || 'Oda sahibi'} odayı kalıcı olarak sildi.`, type: 'error' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 2000);
        return;
      }

      // ── mute_all ──
      if (data.action === 'mute_all') {
        const amHost = roomHostRef.current === firebaseUser?.uid;
        if (!amHost && lk.isMicrophoneEnabled) {
          lk.toggleMic().catch(() => {});
        }
        showToast({ title: '🔇 Tümü Susturuldu', message: 'Oda sahibi tüm konuşmacıları susturdu.', type: 'warning' });
        return;
      }

      // ── Kullanıcı hedefli eventlar ──
      if (data.targetUserId !== firebaseUser.uid) return;

      if (data.action === 'kick') {
        showToast({ title: '⛔ Odadan Çıkarıldın', message: data.reason || 'Moderatör seni odadan çıkardı.', type: 'error' });
        setTimeout(() => {
          liveKitService.disconnect().catch(() => {});
          safeGoBack(router);
        }, 1500);
      } else if (data.action === 'mute') {
        showToast({ title: '🔇 Susturuldun', message: data.reason || 'Moderatör seni susturdu.', type: 'warning' });
        if (lk.isMicrophoneEnabled) { lk.toggleMic().catch(() => {}); }
      } else if (data.action === 'demote') {
        showToast({ title: '⬇️ Sahneden İndirildin', message: 'Moderatör seni dinleyiciye düşürdü.', type: 'info' });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'listener' as const } : p));
        if (lk.isMicrophoneEnabled) { lk.toggleMic().catch(() => {}); }
      } else if (data.action === 'promote') {
        showToast({ title: '🎤 Sahneye Alındın!', message: 'Artık konuşabilirsin! Mikrofon otomatik açılıyor...', type: 'success' });
        setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, role: 'speaker' as const, is_muted: false } : p));
        setTimeout(() => { lk.enableMic?.().catch(() => {}); }, 500);
      } else if (data.action === 'make_moderator') {
        showToast({ title: '🛡️ Moderatör Yapıldın!', message: 'Artık odayı yönetebilirsin.', type: 'success' });
      } else if (data.action === 'remove_moderator') {
        showToast({ title: '🛡️ Moderatörlük Kaldırıldı', message: 'Moderatörlük yetkin kaldırıldı.', type: 'info' });
      } else if (data.action === 'chat_mute') {
        showToast({ title: '💬 Metin Susturuldu', message: 'Moderatör metin sohbetini kapattı.', type: 'warning' });
      } else if (data.action === 'chat_unmute') {
        showToast({ title: '💬 Metin Açıldı', message: 'Artık mesaj yazabilirsin.', type: 'success' });
      } else if (data.action === 'host_transferred') {
        showToast({ title: '👑 Vekil Host Oldun!', message: `${data.oldHostName || 'Oda sahibi'} odayı sana devretti.`, type: 'success' });
      }
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
  };
}
