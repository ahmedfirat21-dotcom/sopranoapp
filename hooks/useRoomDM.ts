/**
 * SopranoChat — useRoomDM Hook
 * ═══════════════════════════════════════════════════
 * ★ ARCH-1 FIX: room/[id].tsx God Component decomposition — Hook 5
 *
 * Sorumluluk:
 *   - DM okunmamış sayacı (badge)
 *   - DM gönderme (engel + takip kontrolü ile)
 *   - DM inbox mesajları
 *
 * Kaldırılan satırlar: room/[id].tsx L834-851, L1629-1675 (~80 satır)
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../constants/supabase';
import { MessageService } from '../services/messages';
import { ModerationService } from '../services/moderation';
import { FriendshipService } from '../services/friendship';

type DmTarget = { userId: string; nick: string } | null;

type UseRoomDMParams = {
  firebaseUser: { uid: string } | null;
};

export function useRoomDM(params: UseRoomDMParams) {
  const { firebaseUser } = params;

  // ── State ─────────────────────────────────────
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [dmInboxMessages, setDmInboxMessages] = useState<any[]>([]);
  const [dmTarget, setDmTarget] = useState<DmTarget>(null);
  const [dmText, setDmText] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [showDmPanel, setShowDmPanel] = useState(false);

  // ── DM Okunmamış Sayacı + Inbox Preload ───────
  // ★ 2026-04-26: Inbox'ı sayaç ile aynı anda preload — DM panel açıldığında anında dolu görünür.
  //   Eski: panel açılınca getInbox çağrılıyor → 2sn boş gözüküyordu.
  // ★ 2026-04-29 v85: +1/-1 yerine getUnreadCount() debounced — yabancı pending request
  //   mesajları DM badge'inde sayılmaz, ayrıca markAsRead/delete sonrasında doğru sayım.
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    const uid = firebaseUser.uid;
    MessageService.getUnreadCount(uid).then(setDmUnreadCount).catch(() => {});
    MessageService.getInbox(uid).then(setDmInboxMessages).catch(() => {});

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshDmBadge = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        MessageService.getUnreadCount(uid).then(setDmUnreadCount).catch(() => {});
        MessageService.getInbox(uid).then(setDmInboxMessages).catch(() => {});
      }, 250);
    };

    const ch = supabase.channel(`dm_badge_${uid}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${uid}`,
      }, refreshDmBadge)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${uid}`,
      }, (payload) => {
        const oldM = payload.old as { is_read?: boolean };
        const newM = payload.new as { is_read?: boolean };
        if ((oldM?.is_read === false && newM?.is_read === true) ||
            (oldM?.is_read === true && newM?.is_read === false)) {
          refreshDmBadge();
        }
      })
      // ★ message_requests durumu değişince DM badge yeniden hesaplansın (pending hariç)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_requests',
        filter: `receiver_id=eq.${uid}`,
      }, refreshDmBadge)
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(ch);
    };
  }, [firebaseUser?.uid]);

  // ── DM Gönder ─────────────────────────────────
  const handleSendDm = useCallback(async () => {
    if (!dmTarget || !dmText.trim() || dmSending || !firebaseUser) return;
    setDmSending(true);
    try {
      // Engel kontrolü
      try {
        const isBlocked = await ModerationService.isBlocked(firebaseUser.uid, dmTarget.userId);
        if (isBlocked) {
          setDmTarget(null);
          return;
        }
        const blockedByTarget = await ModerationService.isBlocked(dmTarget.userId, firebaseUser.uid);
        if (blockedByTarget) {
          setDmTarget(null);
          return;
        }
      } catch {}

      // Takip kontrolü — ★ 2026-04-27 FIX: tek yönlü accepted = arkadaş (OR)
      let isMessageRequest = false;
      try {
        const { outgoing, incoming } = await FriendshipService.getDetailedStatus(firebaseUser.uid, dmTarget.userId);
        const isFriend = outgoing === 'accepted' || incoming === 'accepted';
        if (!isFriend) isMessageRequest = true;
      } catch {}

      await MessageService.send(firebaseUser.uid, dmTarget.userId, dmText.trim(), isMessageRequest);
      setDmTarget(null);
      setDmText('');
    } catch {
      // Sessiz hata — UI'da mesaj gönderilmemiş olarak kalır
    } finally {
      setDmSending(false);
    }
  }, [dmTarget, dmText, dmSending, firebaseUser]);

  // ── DM Panel Aç ───────────────────────────────
  const toggleDmPanel = useCallback(() => {
    setShowDmPanel(prev => {
      if (!prev && firebaseUser?.uid) {
        MessageService.getInbox(firebaseUser.uid).then(msgs => setDmInboxMessages(msgs)).catch(() => {});
        setDmUnreadCount(0);
      }
      return !prev;
    });
  }, [firebaseUser?.uid]);

  return {
    dmUnreadCount,
    dmInboxMessages, setDmInboxMessages,
    dmTarget, setDmTarget,
    dmText, setDmText,
    dmSending,
    showDmPanel, setShowDmPanel,
    handleSendDm,
    toggleDmPanel,
  };
}
