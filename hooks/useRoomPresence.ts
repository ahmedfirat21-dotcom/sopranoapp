/**
 * SopranoChat — useRoomPresence Hook
 * ════════════════════════════════════════════════════════
 * ★ v319.6 (18 May 2026) — Hayalet kullanıcı fix.
 *
 * Problem: Heartbeat 60sn + cleanup 90sn ile odadan ayrılan kullanıcı diğer
 * client'larda ~2.5dk hayalet kalıyordu (telefon kapanma, crash, network).
 *
 * Çözüm: Supabase Realtime Presence — WebSocket bağlantısı kopunca sub-second
 * presence_state diğer client'larda otomatik update. DB heartbeat sistemi
 * paralel kalır (history + cleanup için), ama UI filter presence'a güvenir.
 *
 * Kullanım:
 *   const { onlineUserIds, isOnline } = useRoomPresence(roomId, userId);
 *   const visibleParticipants = participants.filter(p =>
 *     p.user_id === userId || isOnline(p.user_id)
 *   );
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../constants/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRoomPresence(roomId: string | null, userId: string | null) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomId || !userId) {
      setOnlineUserIds(new Set());
      return;
    }

    const channel = supabase.channel(`room_presence_${roomId}`, {
      config: {
        presence: { key: userId },
      },
    });
    channelRef.current = channel;

    const recomputeOnline = () => {
      const state = channel.presenceState() as Record<string, { user_id?: string }[]>;
      const ids = new Set<string>();
      Object.keys(state).forEach((presenceKey) => {
        // Presence key user_id'dir (config.presence.key). Aynı user_id birden
        // fazla cihazdan bağlanabilir (array içinde). Tek bir online = yeterli.
        ids.add(presenceKey);
      });
      setOnlineUserIds(ids);
    };

    channel
      .on('presence', { event: 'sync' }, recomputeOnline)
      .on('presence', { event: 'join' }, recomputeOnline)
      .on('presence', { event: 'leave' }, recomputeOnline)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, joined_at: new Date().toISOString() });
        }
      });

    return () => {
      try { channel.untrack(); } catch {}
      try { supabase.removeChannel(channel); } catch {}
      channelRef.current = null;
    };
  }, [roomId, userId]);

  const isOnline = useCallback(
    (uid: string | null | undefined) => !!uid && onlineUserIds.has(uid),
    [onlineUserIds],
  );

  return { onlineUserIds, isOnline };
}
