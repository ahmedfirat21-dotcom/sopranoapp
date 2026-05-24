/**
 * SopranoChat �?? useRoomPresence Hook
 * �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
 * �?? v319.6 (18 May 2026) �?? Hayalet kullanıcı fix.
 *
 * Problem: Heartbeat 60sn + cleanup 90sn ile odadan ayrılan kullanıcı di�?er
 * client'larda ~2.5dk hayalet kalıyordu (telefon kapanma, crash, network).
 *
 * �?özüm: Supabase Realtime Presence �?? WebSocket ba�?lantısı kopunca sub-second
 * presence_state di�?er client'larda otomatik update. DB heartbeat sistemi
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

    // ★ v1.7.13.146 (24 May 2026): Unique suffix ile channel name — Supabase JS SDK
    //   aynı topic ile çağrıldığında mevcut channel instance'ını dönüyor; eğer önceki
    //   "joined" durumdaysa yeni .on() callback eklemek "cannot add presence callbacks
    //   after joining a channel" hatası fırlatıyor. Cleanup async (removeChannel) bittiği
    //   garanti değil → race. Unique suffix her mount'ta yeni instance garanti eder.
    const channel = supabase.channel(`room_presence_${roomId}_${Math.random().toString(36).slice(2, 8)}`, {
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
        // fazla cihazdan ba�?lanabilir (array içinde). Tek bir online = yeterli.
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
      // �?? v1.7.13.140: unsubscribe ZORUNLU �?? removeChannel async cleanup yapıyor,
      //   aynı channel name ile yeni useEffect tetiklenirse subscribed instance dönüp
      //   ".on()" ça�?rısını "cannot add presence callbacks after joining" ile reddediyor.
      //   Lobi gir/çık/gir döngüsünde bu hata pattern'i ortaya çıktı.
      try { channel.untrack(); } catch {}
      try { channel.unsubscribe(); } catch {}
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
