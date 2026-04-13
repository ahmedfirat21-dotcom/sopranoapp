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
import { useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { RoomService } from '../services/database';
import { getRoomLimits } from '../constants/tiers';
import { UpsellService } from '../services/upsell';
import { liveKitService } from '../services/livekit';
// ★ TOAST KALDIRMA: Oda içinde toast bildirimi yok
const showToast = (_opts: { title?: string; message?: string; type?: string }) => {};
import { safeGoBack } from '../constants/navigation';
import type { Room } from '../types';

type UseRoomLifecycleParams = {
  roomId: string | undefined;
  firebaseUser: { uid: string } | null;
  room: Room | null;
  router: any;
  isMinimizingRef: React.MutableRefObject<boolean>;
  setMinimizedRoom: (val: any) => void;
};

export function useRoomLifecycle(params: UseRoomLifecycleParams) {
  const { roomId, firebaseUser, room, isMinimizingRef, router, setMinimizedRoom } = params;

  // ── Heartbeat + Zombie Cleanup ────────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    // İlk heartbeat + temizlik
    RoomService.heartbeat(roomId, firebaseUser.uid).catch(() => {});
    RoomService.cleanupZombies(roomId).catch(() => {});

    const heartbeatInterval = setInterval(() => {
      RoomService.heartbeat(roomId, firebaseUser.uid).catch(() => {});
    }, 60000);

    const cleanupInterval = setInterval(() => {
      RoomService.cleanupZombies(roomId).catch(() => {});
    }, 90000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(cleanupInterval);
    };
  }, [roomId, firebaseUser]);

  // ── AppState — Arka Plan Tespiti ──────────────
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const bgTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (isMinimizingRef.current) return;
        // 60sn arka planda kalırsa odadan çıkar
        bgTimerRef.current = setTimeout(() => {
          RoomService.leave(roomId, firebaseUser.uid).catch(() => {});
        }, 60000);
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
  const [roomDuration, setRoomDuration] = useState('0 dk');
  const [roomExpiry, setRoomExpiry] = useState('');

  useEffect(() => {
    if (!room?.created_at) return;
    const updateDuration = () => {
      const diff = Date.now() - new Date(room.created_at).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) setRoomDuration(`${hrs} sa ${mins % 60} dk`);
      else setRoomDuration(`${mins} dk`);

      // Kalan süre göstergesi
      if (room.expires_at) {
        const remaining = new Date(room.expires_at).getTime() - Date.now();
        if (remaining <= 0) {
          const _t = ((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free') as any;
          UpsellService.onRoomDurationExpired(_t);
          setRoomExpiry('⏰ Süre doldu!');
          const isHost = room.host_id === firebaseUser?.uid;
          if (isHost) {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapatılıyor...', type: 'warning' });
            setTimeout(async () => {
              try {
                await RoomService.close(roomId as string);
                liveKitService.disconnect().catch(() => {});
                setMinimizedRoom(null);
                safeGoBack(router);
              } catch {}
            }, 3000);
          } else {
            showToast({ title: '⏰ Süre Doldu', message: 'Oda süresi doldu. Oda kapanıyor...', type: 'warning' });
            setTimeout(() => {
              liveKitService.disconnect().catch(() => {});
              setMinimizedRoom(null);
              safeGoBack(router);
            }, 5000);
          }
          return;
        }
        const remMins = Math.floor(remaining / 60000);
        const remHrs = Math.floor(remMins / 60);
        if (remHrs > 0) setRoomExpiry(`${remHrs} sa ${remMins % 60} dk kaldı`);
        else setRoomExpiry(`${remMins} dk kaldı`);
      }
    };
    updateDuration();
    // Son 2 dakikada 5sn'de bir kontrol
    const remaining = room.expires_at ? new Date(room.expires_at).getTime() - Date.now() : Infinity;
    const interval = remaining < 120000 ? 5000 : 30000;
    const timer = setInterval(updateDuration, interval);
    return () => clearInterval(timer);
  }, [room?.created_at, room?.expires_at]);

  return { roomDuration, roomExpiry };
}
