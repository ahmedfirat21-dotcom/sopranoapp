// ★ v107 (3 May 2026): Çift oturum koruyucusu — auth-aware wrapper.
//
// _layout.tsx'te AuthContext.Provider'ın içinde render edilir. firebaseUser değişince:
//   - Login → markSessionActive + realtime subscribe
//   - Logout → unsubscribe
// AppState 'active'e dönünce → markSessionActive (cihazlar arası en güncel "buradayım" sinyali)
// Realtime başka cihaz takeover'ı tetiklerse → modal aç, kullanıcı seçim yapar.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../constants/firebase';
import { markSessionActive, subscribeSessionConflict } from '../services/sessionConflict';
import SessionConflictModal from './SessionConflictModal';

interface Props {
  /** Firebase UID — null ise hiçbir şey yapma. _layout.tsx prop ile geçirir (require cycle önlemi). */
  userId: string | null;
}

export default function SessionConflictGuard({ userId }: Props) {
  const [conflictVisible, setConflictVisible] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const lastMarkRef = useRef<number>(0);

  // Login değişince: önceki sub'ı kapat, yenisini başlat
  useEffect(() => {
    // Cleanup
    if (unsubRef.current) {
      try { unsubRef.current(); } catch {}
      unsubRef.current = null;
    }
    setConflictVisible(false);
    if (!userId) return;

    let cancelled = false;
    (async () => {
      // İlk işaretleme
      await markSessionActive(userId);
      lastMarkRef.current = Date.now();
      if (cancelled) return;

      // Realtime başka cihaz takeover'ı dinle
      const unsub = await subscribeSessionConflict(userId, () => {
        setConflictVisible(true);
      });
      if (cancelled) {
        try { unsub(); } catch {}
      } else {
        unsubRef.current = unsub;
      }
    })();

    return () => {
      cancelled = true;
      if (unsubRef.current) { try { unsubRef.current(); } catch {} }
      unsubRef.current = null;
    };
  }, [userId]);

  // Foreground'a dönünce yeniden işaretle (uzun arka plandan sonra cihazın "halen burada" sinyali)
  useEffect(() => {
    if (!userId) return;
    const handler = (state: AppStateStatus) => {
      if (state === 'active') {
        // Throttle: 30sn'den sık çağırma
        if (Date.now() - lastMarkRef.current < 30_000) return;
        lastMarkRef.current = Date.now();
        markSessionActive(userId).catch(() => {});
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [userId]);

  const handleContinueHere = useCallback(async () => {
    if (!userId) return;
    setConflictVisible(false);
    // Bizim cihazı tekrar aktif olarak işaretle → diğer cihaz aynı modal'ı görür
    await markSessionActive(userId);
    lastMarkRef.current = Date.now();
  }, [userId]);

  const handleSignOut = useCallback(async () => {
    setConflictVisible(false);
    try { await signOut(auth); } catch { /* sessiz */ }
  }, []);

  return (
    <SessionConflictModal
      visible={conflictVisible}
      onContinueHere={handleContinueHere}
      onSignOut={handleSignOut}
    />
  );
}
