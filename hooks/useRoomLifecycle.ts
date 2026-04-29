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
  // ★ 2026-04-26: Aggressive ayarlar (30sn/45sn) emülatörde ANR'ye sebep olduğu için 60sn/90sn'e geri alındı.
  //   Zombi temizleme delay'i ~90sn — kabul edilebilir (kullanıcı odadan force-kill edince başkalarının ekranından silinmesi ~90sn sürer).
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
  // ★ 2026-04-26 FIX: Background'da otomatik leave KALDIRILDI.
  //   Eski: 60sn arka planda kalırsa otomatik RoomService.leave çağrılıyordu — Clubhouse'a aykırı.
  //   Clubhouse'da telefon ekranı kapansa, başka uygulamaya geçilse bile oda devam eder.
  //   Force-kill durumu zaten heartbeat (60sn) + host cleanup (90sn) ile temizleniyor.
  //   Listener'ı tamamen kaldırdık — kullanıcı "Ayrıl" demedikçe odada kalır.

  // ── Oda Süresi Zamanlayıcısı ──────────────────
  // ★ BUG FIX: Timer room/[id].tsx'de inline olarak çalışıyor (showToast + navigation erişimi var).
  // Hook'taki kopya kaldırıldı → çift RoomService.close() ve çift safeGoBack() race condition'ı önlendi.
  // Heartbeat, zombie, AppState → hook'ta kalıyor.

  // ── Foreground Dönüş Heartbeat ────────────────
  // ★ 2026-04-30 FIX: Android Doze mode setInterval'i durdurur → heartbeat gönderilmez
  //   → host zombie cleanup ile kullanıcıyı 90sn sonra siler. Foreground'a dönünce
  //   anında heartbeat göndererek zombie'ye düşmeyi önler.
  useEffect(() => {
    if (!roomId || !firebaseUser) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && roomId && firebaseUser && !isMinimizingRef.current) {
        RoomService.heartbeat(roomId, firebaseUser.uid).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [roomId, firebaseUser]);

  return {};
}
