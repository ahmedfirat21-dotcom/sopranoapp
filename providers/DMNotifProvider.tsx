/**
 * SopranoChat — DMNotifProvider
 * ═══════════════════════════════════════════════════════════════════
 * ★ 2026-04-30 v86: DM Broadcast Notification System
 *
 * Sorun (mimari):
 *   Two-client setup'ta Realtime anon ile bağlanıyor; messages tablosu RLS
 *   sender_id/receiver_id kontrolü yaptığı için anon Realtime client DM
 *   postgres_changes eventlerini hiç almıyor. → DM bildirimleri kopuk.
 *
 * Çözüm:
 *   send_message_with_request RPC içinde realtime.send() ile broadcast atılıyor
 *   (topic: dm:user:{receiver_id}, event: dm_new). Bu provider, kullanıcıya
 *   özel kanala subscribe edip global state tutar:
 *     - Toplam okunmamış DM sayısı (tab badge için)
 *     - Per-user okunmamış sayısı (inbox row için)
 *     - Bekleyen mesaj isteği sayısı (banner için)
 *     - onSignal listener API (chat ekranı + oda kontrol bar için)
 *
 * Güvenlik:
 *   Broadcast payload sadece sinyal — sender_id, message_id, is_request.
 *   Mesaj içeriği YOK. Receiver client signal alınca DB'den fresh fetch eder
 *   (REST + Firebase JWT + RLS). Anon broadcast scraping yapsa bile içerik
 *   görmez.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { supabase } from '../constants/supabase';

// ── Types ────────────────────────────────────────────────────────
export type DMSignal =
  | { event: 'dm_new'; sender_id: string; message_id: string; is_request: boolean; request_id?: string | null }
  | { event: 'dm_accepted'; sender_id: string; receiver_id: string; request_id: string }
  | { event: 'dm_rejected'; sender_id: string; receiver_id: string; request_id: string };

type DMNotifContextValue = {
  /** Toplam okunmamış mesaj sayısı (tab badge) */
  unreadTotal: number;
  /** Belirli bir kullanıcı ile okunmamış sayı */
  getUnreadFor: (otherUserId: string) => number;
  /** Konuşmayı okundu olarak işaretle (chat ekranı open olduğunda çağrılır) */
  markRead: (otherUserId: string) => void;
  /** Yeni DM signal listener — chat ekranı + oda kontrol bar için */
  onSignal: (callback: (signal: DMSignal) => void) => () => void;
  /** Bekleyen mesaj isteği var mı */
  hasPendingRequests: boolean;
};

const DMNotifContext = createContext<DMNotifContextValue | null>(null);

export function DMNotifProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [hasPendingRequests, setHasPendingRequests] = useState(false);
  const listenersRef = useRef<Set<(s: DMSignal) => void>>(new Set());

  // Subscribe lifecycle
  useEffect(() => {
    if (!userId) {
      setUnreadByUser({});
      setHasPendingRequests(false);
      return;
    }

    const topic = `dm:user:${userId}`;
    const ch = supabase.channel(topic, { config: { broadcast: { self: false } } });

    const dispatch = (signal: DMSignal) => {
      listenersRef.current.forEach(cb => {
        try { cb(signal); } catch { /* listener crash izole */ }
      });
    };

    ch.on('broadcast', { event: 'dm_new' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.sender_id) return;
      const signal: DMSignal = {
        event: 'dm_new',
        sender_id: data.sender_id,
        message_id: data.message_id,
        is_request: !!data.is_request,
        request_id: data.request_id || null,
      };
      // Unread count artır (eğer chat ekranı bu user için açık değilse listener markRead çağıracak)
      setUnreadByUser(prev => ({
        ...prev,
        [data.sender_id]: (prev[data.sender_id] || 0) + 1,
      }));
      if (signal.is_request) {
        setHasPendingRequests(true);
      }
      dispatch(signal);
    });

    ch.on('broadcast', { event: 'dm_accepted' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.request_id) return;
      const signal: DMSignal = {
        event: 'dm_accepted',
        sender_id: data.sender_id || '',
        receiver_id: data.receiver_id || '',
        request_id: data.request_id,
      };
      dispatch(signal);
    });

    ch.on('broadcast', { event: 'dm_rejected' }, (payload: any) => {
      const data = payload?.payload;
      if (!data?.request_id) return;
      const signal: DMSignal = {
        event: 'dm_rejected',
        sender_id: data.sender_id || '',
        receiver_id: data.receiver_id || '',
        request_id: data.request_id,
      };
      dispatch(signal);
    });

    ch.subscribe((status: string) => {
      if (__DEV__) console.log(`[DMNotif] ${topic} → ${status}`);
    });

    return () => {
      try { supabase.removeChannel(ch); } catch { /* silent */ }
    };
  }, [userId]);

  const getUnreadFor = useCallback(
    (otherUserId: string) => unreadByUser[otherUserId] || 0,
    [unreadByUser],
  );

  const markRead = useCallback((otherUserId: string) => {
    setUnreadByUser(prev => {
      if (!prev[otherUserId]) return prev;
      const next = { ...prev };
      delete next[otherUserId];
      return next;
    });
  }, []);

  const onSignal = useCallback((callback: (signal: DMSignal) => void) => {
    listenersRef.current.add(callback);
    return () => { listenersRef.current.delete(callback); };
  }, []);

  const unreadTotal = useMemo(
    () => Object.values(unreadByUser).reduce((a, b) => a + b, 0),
    [unreadByUser],
  );

  const value = useMemo(
    () => ({ unreadTotal, getUnreadFor, markRead, onSignal, hasPendingRequests }),
    [unreadTotal, getUnreadFor, markRead, onSignal, hasPendingRequests],
  );

  return <DMNotifContext.Provider value={value}>{children}</DMNotifContext.Provider>;
}

/** Provider zorunlu — yoksa exception fırlatır */
export function useDMNotif(): DMNotifContextValue {
  const ctx = useContext(DMNotifContext);
  if (!ctx) throw new Error('useDMNotif must be used inside DMNotifProvider');
  return ctx;
}

/** Optional — provider yoksa sessizce default döner (oda gibi guard'lı yerlerde) */
export function useDMNotifOptional(): DMNotifContextValue | null {
  return useContext(DMNotifContext);
}
