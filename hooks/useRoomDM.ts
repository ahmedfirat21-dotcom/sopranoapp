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
import { useDMNotifOptional } from '../providers/DMNotifProvider';

type DmTarget = { userId: string; nick: string } | null;

type UseRoomDMParams = {
  firebaseUser: { uid: string } | null;
};

export function useRoomDM(params: UseRoomDMParams) {
  const { firebaseUser } = params;
  const dmNotif = useDMNotifOptional();

  // ── State ─────────────────────────────────────
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [dmInboxMessages, setDmInboxMessages] = useState<any[]>([]);
  const [dmTarget, setDmTarget] = useState<DmTarget>(null);
  const [dmText, setDmText] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [showDmPanel, setShowDmPanel] = useState(false);

  // ── DM Okunmamış Sayacı + Inbox Preload ───────
  // ★ 2026-04-30 v86: postgres_changes anon Realtime'da DM tablolarını görmüyor
  //   (RLS sender/receiver kontrolü). Çözüm: DMNotifProvider broadcast event'leri.
  //   Yeni mesaj gelince refreshDmBadge tetiklenir, sayım + inbox tekrar fetch.
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

    // DM broadcast — yeni mesaj/accept/reject geldiğinde badge yenile
    const unsub = dmNotif?.onSignal((signal) => {
      if (signal.event === 'dm_new' || signal.event === 'dm_accepted' || signal.event === 'dm_rejected') {
        refreshDmBadge();
      }
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsub?.();
    };
  }, [firebaseUser?.uid, dmNotif]);

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
