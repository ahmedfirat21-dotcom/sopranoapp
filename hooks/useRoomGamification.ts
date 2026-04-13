/**
 * SopranoChat — useRoomGamification Hook
 * ═══════════════════════════════════════════════════
 * ★ ARCH-1 FIX: room/[id].tsx God Component decomposition — Hook 4
 *
 * Sorumluluk:
 *   - VIP: Peak CCU takibi
 *   - SP tetikleyiciler: sahnede olma (10dk), kamera açık (10dk)
 *   - Sistem odası prompt (5dk)
 *
 * Kaldırılan satırlar: room/[id].tsx L1399-1476 (~80 satır)
 */
import { useEffect, useState } from 'react';
import { GamificationService } from '../services/gamification';
import { UpsellService } from '../services/upsell';
import { isSystemRoom } from '../services/showcaseRooms';
import { showToast } from '../components/Toast';
import type { Room } from '../types';

type RoomStats = {
  peakCCU: number;
  totalUniqueListeners: number;
};

type UseRoomGamificationParams = {
  roomId: string | undefined;
  firebaseUser: { uid: string } | null;
  profile: { subscription_tier?: string } | null;
  room: Room | null;
  myCurrentRole: 'owner' | 'moderator' | 'speaker' | 'listener';
  participantCount: number;
  isCameraEnabled: boolean;
  spToastRef: React.RefObject<{ show: (sp: number, label: string) => void }>;
};

export function useRoomGamification(params: UseRoomGamificationParams) {
  const { roomId, firebaseUser, profile, room, myCurrentRole, participantCount, isCameraEnabled, spToastRef } = params;

  // ── VIP: Peak CCU ─────────────────────────────
  const [roomStats, setRoomStats] = useState<RoomStats>({ peakCCU: 0, totalUniqueListeners: 0 });

  useEffect(() => {
    setRoomStats(prev => ({
      ...prev,
      peakCCU: Math.max(prev.peakCCU, participantCount),
      totalUniqueListeners: Math.max(prev.totalUniqueListeners, participantCount),
    }));
  }, [participantCount]);

  // ── SP Tetikleyiciler: Sahne + Kamera ──────────
  useEffect(() => {
    const isOnStage = myCurrentRole === 'owner' || myCurrentRole === 'moderator' || myCurrentRole === 'speaker';
    if (!isOnStage || !firebaseUser?.uid) return;

    const stageTimer = setInterval(() => {
      GamificationService.onStageTime(firebaseUser.uid).then(sp => {
        if (sp > 0) spToastRef.current?.show(sp, 'Sahne');
      }).catch(() => {});
    }, 10 * 60 * 1000);

    const cameraTimer = setInterval(() => {
      if (isCameraEnabled) {
        GamificationService.onCameraTime(firebaseUser.uid).then(sp => {
          if (sp > 0) spToastRef.current?.show(sp, 'Kamera');
        }).catch(() => {});
      }
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(stageTimer);
      clearInterval(cameraTimer);
    };
  }, [myCurrentRole, firebaseUser?.uid, isCameraEnabled]);

  // ── Sistem odası prompt (5dk) ──────────────────
  useEffect(() => {
    if (!room || !isSystemRoom(roomId as string)) return;
    const timer = setTimeout(() => {
      const _tier = (profile?.subscription_tier || 'Free') as any;
      UpsellService.onSystemRoomPrompt(_tier);
      showToast({
        title: '🏠 Kendi Odanı Aç!',
        message: 'SopranoChat\'ta kendi kişisel odanı oluştur ve topluluğun lideri ol!',
        type: 'info',
      });
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [room, roomId]);

  return { roomStats, setRoomStats };
}
