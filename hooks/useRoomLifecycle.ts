/**
 * SopranoChat — useRoomLifecycle Hook
 * ═══════════════════════════════════════════════════
 * ★ ARCH-1 FIX: room/[id].tsx God Component decomposition — Hook 2
 *
 * Sorumluluk:
 *   - Heartbeat (60sn interval)
 *   - Zombie temizliği (90sn interval)
 *   - AppState arka plan tespiti (60sn sonra otomatik çıkış)
 *   - Oda süresi hesaplama (duration + expiry)
 *
 * Kaldırılan satırlar: room/[id].tsx L753-798, L1267-1321 (~120 satır)
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { RoomService } from '../services/database';
import { getRoomLimits } from '../constants/tiers';
import type { Room } from '../types';

type UseRoomLifecycleParams = {
  roomId: string | undefined;
  firebaseUser: { uid: string } | null;
  room: Room | null;
  router?: any; // ★ Timer kaldırıldı — artık kullanılmıyor ama çağrı uyumluluğu için bırakıldı
  isMinimizingRef: React.MutableRefObject<boolean>;
  setMinimizedRoom?: (val: any) => void; // ★ Timer kaldırıldı — artık kullanılmıyor
};

export function useRoomLifecycle(params: UseRoomLifecycleParams) {
  const { roomId, firebaseUser, room, isMinimizingRef } = params;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Heartbeat + Zombie Cleanup ────────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    // İlk heartbeat
    RoomService.heartbeat(roomId, firebaseUser.uid).catch(() => {});

    const heartbeatInterval = setInterval(() => {
      RoomService.heartbeat(roomId, firebaseUser.uid).catch(() => {});
    }, 60000);

    // ★ SEC-ZOMBIE-OPT: Zombie temizliği SADECE host'ta çalışır — 100 client yerine 1
    const isHost = room?.host_id === firebaseUser.uid;
    let cleanupInterval: ReturnType<typeof setInterval> | null = null;
    if (isHost) {
      RoomService.cleanupZombies(roomId).catch(() => {}); // İlk temizlik
      cleanupInterval = setInterval(() => {
        RoomService.cleanupZombies(roomId).catch(() => {});
      }, 90000);
    }

    return () => {
      clearInterval(heartbeatInterval);
      if (cleanupInterval) clearInterval(cleanupInterval);
    };
  }, [roomId, firebaseUser, room?.host_id]);

  // ── AppState — Arka Plan Tespiti ──────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const bgTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        // ★ O9 FIX: iki aşamalı tolerans — minimize ref henüz set edilmemiş olabilir.
        // 250ms fast-path check → eğer minimize aktifse timer'ı HİÇ kurma.
        // Timer 60sn'de fire eder; o anda da minimize flag tekrar kontrol edilir.
        const FAST_PATH_MS = 250;
        const LEAVE_GRACE_MS = 60_000;
        setTimeout(() => {
          if (isMinimizingRef.current) return;
          // Önceki timer varsa temizle (birden fazla background event)
          if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
          bgTimerRef.current = setTimeout(() => {
            // Kritik: timer fire ettiğinde minimize aktif olabilir (arada kullanıcı minimize'a bastı)
            if (isMinimizingRef.current) return;
            RoomService.leave(roomId, firebaseUser.uid).catch(() => {});
          }, LEAVE_GRACE_MS);
        }, FAST_PATH_MS);
      } else if (nextState === 'active') {
        if (bgTimerRef.current) {
          clearTimeout(bgTimerRef.current);
          bgTimerRef.current = null;
        }
      }
    });
    return () => {
      subscription.remove();
      if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
    };
  }, [roomId, firebaseUser]);

  // ── Oda Süresi Zamanlayıcısı ──────────────────
  // ★ BUG FIX: Timer room/[id].tsx'de inline olarak çalışıyor (showToast + navigation erişimi var).
  // Hook'taki kopya kaldırıldı → çift RoomService.close() ve çift safeGoBack() race condition'ı önlendi.
  // Heartbeat, zombie, AppState → hook'ta kalıyor.

  return {};
}
