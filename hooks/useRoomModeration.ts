/**
 * useRoomModeration — Oda moderasyon aksiyonları hook'u
 * Kick, ban, mute, promote, demote, ghost, disguise, report, block işlemlerini yönetir.
 * room/[id].tsx dosyasından çıkarılmıştır (~600 satır azaltma).
 */
import { useCallback } from 'react';
import { RoomService, getRoomLimits } from '../services/database';
import { migrateLegacyTier } from '../types';
import { ModerationService } from '../services/moderation';
import { supabase } from '../constants/supabase';
import { showToast } from '../components/Toast';
import { UpsellService } from '../services/upsell';
import type { RoomParticipant, Room } from '../services/database';
import type { SubscriptionTier, ParticipantRole } from '../types';
import type { AlertButton, AlertType } from '../components/PremiumAlert';
import type { RoomMessage } from '../services/roomChat';

type AlertConfig = {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
  icon?: string;
};

type UseRoomModerationParams = {
  roomId: string;
  room: Room | null;
  firebaseUser: { uid: string; displayName?: string | null } | null;
  profile: any;
  participants: RoomParticipant[];
  ownerTier: string;
  modChannelRef: React.MutableRefObject<ReturnType<typeof supabase.channel> | null>;
  setSelectedUser: (u: RoomParticipant | null) => void;
  setParticipants: React.Dispatch<React.SetStateAction<RoomParticipant[]>>;
  setChatMessages: React.Dispatch<React.SetStateAction<RoomMessage[]>>;
  setAlertConfig: React.Dispatch<React.SetStateAction<AlertConfig>>;
  lk: { isMicrophoneEnabled?: boolean; toggleMic: () => Promise<any> };
};

export function useRoomModeration({
  roomId,
  room,
  firebaseUser,
  profile,
  participants,
  ownerTier,
  modChannelRef,
  setSelectedUser,
  setParticipants,
  setChatMessages,
  setAlertConfig,
  lk,
}: UseRoomModerationParams) {

  // ========== SAHNEYE AL (Listener → Speaker) ==========
  const handlePromoteToStage = useCallback(async (userId: string, displayName: string) => {
    const ownerTierForLimits = migrateLegacyTier((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free');
    const tierLimits = getRoomLimits(ownerTierForLimits);
    const maxSlots = tierLimits.maxSpeakers;
    const currentStageCount = participants.filter(p => ['owner', 'host', 'speaker', 'moderator'].includes(p.role)).length;
    if (currentStageCount >= maxSlots) {
      showToast({ title: 'Sahne Dolu', message: `Sahnede maksimum ${maxSlots} kişi olabilir`, type: 'warning' });
      UpsellService.onStageCapacityFull(ownerTierForLimits);
      return;
    }
    try {
      // ★ Sahneye davet gönder — direkt promote yerine
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: {
          action: 'stage_invite',
          targetUserId: userId,
          inviterName: profile?.display_name || firebaseUser?.displayName || 'Moderatör',
        },
      });
      setSelectedUser(null);
      showToast({ title: '📨 Sahne Daveti Gönderildi', message: `${displayName} sahneye davet edildi`, type: 'success' });
    } catch (e) {
      showToast({ title: 'Hata', message: 'Davet gönderilemedi', type: 'error' });
    }
  }, [roomId, room, participants, modChannelRef, profile, firebaseUser]);

  // ========== KULLANICIYI ODADAN ÇIKAR ==========
  const handleKickUser = useCallback((userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: 'Kullanıcıyı Çıkar', message: `${displayName} odadan çıkarılacak. Tekrar katılabilir. Devam?`, type: 'warning', icon: 'exit-outline',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Çıkar', style: 'destructive', onPress: async () => {
          try {
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'kick', targetUserId: userId, reason: `${displayName} odadan çıkarıldı.` },
            });
            await RoomService.leave(roomId, userId);
            // BUG FIX: Kick sonrası yerel state'den de kaldır
            setParticipants(prev => prev.filter(p => p.user_id !== userId));
            setSelectedUser(null);
            showToast({ title: 'Çıkarıldı', message: `${displayName} odadan çıkarıldı`, type: 'success' });
            const sysMsg = {
              id: `sys_kick_${userId}_${Date.now()}`,
              room_id: roomId,
              user_id: userId,
              content: '⛔ odadan çıkarıldı',
              created_at: new Date().toISOString(),
              profiles: { display_name: displayName },
              isSystem: true,
            } as any;
            setChatMessages(prev => [sysMsg, ...prev].slice(0, 100));
          } catch (e) {
            showToast({ title: 'Hata', message: 'Kullanıcı çıkarılamadı', type: 'error' });
          }
        }}
      ]
    });
  }, [roomId, modChannelRef]);

  // ========== METİN SUSTURMA (Chat Mute) ==========
  const handleToggleChatMute = useCallback(async (userId: string, displayName: string, currentMuted: boolean) => {
    try {
      await RoomService.setChatMute(roomId, userId, !currentMuted);
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: !currentMuted ? 'chat_mute' : 'chat_unmute', targetUserId: userId },
      });
      setSelectedUser(null);
      showToast({
        title: !currentMuted ? 'Metin Susturuldu' : 'Metin Açıldı',
        message: !currentMuted ? `${displayName} artık mesaj yazamaz` : `${displayName} artık mesaj yazabilir`,
        type: 'success'
      });
    } catch (e) {
      showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
    }
  }, [roomId, modChannelRef]);

  // ========== MODERATÖR YAP/KALDIR ==========
  const handleToggleModerator = useCallback(async (userId: string, displayName: string, currentRole: string) => {
    const isMod = currentRole === 'moderator';
    if (!isMod) {
      const currentModCount = participants.filter(p => p.role === 'moderator').length;
      const _ownerTierForMod = migrateLegacyTier((room as any)?.owner_tier || room?.host?.subscription_tier || 'Free');
      const limits = getRoomLimits(_ownerTierForMod);
      if (currentModCount >= limits.maxModerators) {
        showToast({
          title: 'Moderatör Limiti',
          message: `${_ownerTierForMod} planında en fazla ${limits.maxModerators} moderatör atayabilirsin.`,
          type: 'warning'
        });
        return;
      }
    }
    setAlertConfig({
      visible: true,
      title: isMod ? 'Moderatörlüğü Kaldır' : 'Moderatör Yap',
      message: isMod ? `${displayName} adlı kullanıcının moderatörlüğünü kaldırmak istiyor musun?` : `${displayName} adlı kullanıcıyı moderatör yapmak istiyor musun?\n\nModeratörler: Sahneye alma, sessize alma, metin susturma, çıkarma yapabilir.`,
      type: 'info', icon: isMod ? 'shield-outline' : 'shield-checkmark',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: isMod ? 'Kaldır' : 'Moderatör Yap', onPress: async () => {
          try {
            if (isMod) {
              await RoomService.removeModerator(roomId, userId);
              modChannelRef.current?.send({
                type: 'broadcast', event: 'mod_action',
                payload: { action: 'remove_moderator', targetUserId: userId },
              });
            } else {
              await RoomService.setModerator(roomId, userId);
              modChannelRef.current?.send({
                type: 'broadcast', event: 'mod_action',
                payload: { action: 'make_moderator', targetUserId: userId },
              });
            }
            setSelectedUser(null);
            showToast({ title: isMod ? 'Moderatörlük Kaldırıldı' : 'Moderatör Yapıldı', message: displayName, type: 'success' });
          } catch (e) {
            showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
          }
        }},
      ]
    });
  }, [roomId, room, participants, modChannelRef]);

  // ========== SÜRELİ SUSTURMA ==========
  const executeMute = useCallback(async (userId: string, displayName: string, durationMinutes?: number) => {
    try {
      await ModerationService.muteInRoom(roomId, userId, firebaseUser!.uid, undefined, durationMinutes);
      await RoomService.demoteSpeaker(roomId, userId);
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'mute', targetUserId: userId, reason: `${durationMinutes ? durationMinutes + ' dakika' : 'Süresiz'} susturuldun.` },
      });
      setSelectedUser(null);
      const durationText = durationMinutes ? `${durationMinutes} dakika` : 'süresiz';
      showToast({ title: 'Susturuldu', message: `${displayName} ${durationText} susturuldu`, type: 'success' });
      const sysMsg = {
        id: `sys_mute_${userId}_${Date.now()}`,
        room_id: roomId,
        user_id: userId,
        content: `🔇 ${durationText} susturuldu`,
        created_at: new Date().toISOString(),
        profiles: { display_name: displayName },
        isSystem: true,
      } as any;
      setChatMessages(prev => [sysMsg, ...prev].slice(0, 100));
    } catch (e) {
      showToast({ title: 'Hata', message: 'Susturulamadı', type: 'error' });
    }
  }, [roomId, firebaseUser, modChannelRef]);

  const handleTimedMuteUser = useCallback((userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: `${displayName} Sustur`, message: 'Susturma süresini seçin:', type: 'warning', icon: 'volume-mute',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: '5 Dakika', onPress: () => executeMute(userId, displayName, 5) },
        { text: '15 Dakika', onPress: () => executeMute(userId, displayName, 15) },
        { text: 'Süresiz', style: 'destructive', onPress: () => executeMute(userId, displayName, undefined) },
      ]
    });
  }, [executeMute]);

  const executeUnmute = useCallback(async (userId: string, displayName: string) => {
    try {
      await ModerationService.unmuteInRoom(roomId, userId);
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'unmute', targetUserId: userId },
      });
      setSelectedUser(null);
      showToast({ title: 'Susturma Kaldırıldı', message: `${displayName} artık konuşabilir`, type: 'success' });
    } catch {
      showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' });
    }
  }, [roomId, modChannelRef]);

  // ========== GHOST MODE ==========
  const handleGhostToggle = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    const myPart = participants.find(p => p.user_id === firebaseUser.uid);
    const isCurrentlyGhost = (myPart as any)?.is_ghost || false;
    try {
      await RoomService.setGhostMode(roomId, firebaseUser.uid, !isCurrentlyGhost);
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: !isCurrentlyGhost ? 'ghost_on' : 'ghost_off', targetUserId: firebaseUser.uid },
      });
      setParticipants(prev => prev.map(p => p.user_id === firebaseUser.uid ? { ...p, is_ghost: !isCurrentlyGhost } as any : p));
      setSelectedUser(null);
      showToast({
        title: !isCurrentlyGhost ? '👻 Görünmez Oldun' : '👁️ Görünür Oldun',
        message: !isCurrentlyGhost ? 'Diğer kullanıcılar seni göremez' : 'Artık herkes seni görebilir',
        type: 'info',
      });
    } catch { showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' }); }
  }, [roomId, firebaseUser, participants, modChannelRef]);

  // ========== KILIK DEĞİŞTİRME ==========
  const handleDisguiseUser = useCallback((userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: '🎭 Kılık Değiştir', message: `${displayName} adlı kullanıcının görünümü geçici olarak değiştirilecek.`, type: 'info', icon: 'mask-outline' as any,
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Anonim Yap', onPress: async () => {
          try {
            await RoomService.setDisguise(roomId, userId, {
              display_name: 'Anonim Kullanıcı',
              avatar_url: 'https://ui-avatars.com/api/?name=Anonim&background=1E293B&color=64748B',
              applied_by: firebaseUser!.uid,
            });
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'disguise', targetUserId: userId, newName: 'Anonim Kullanıcı', newAvatar: 'https://ui-avatars.com/api/?name=Anonim&background=1E293B&color=64748B' },
            });
            setSelectedUser(null);
            showToast({ title: '🎭 Kılık Değiştirildi', message: `${displayName} artık "Anonim Kullanıcı" olarak görünüyor`, type: 'success' });
          } catch { showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' }); }
        }},
        { text: 'Kılığı Kaldır', onPress: async () => {
          try {
            await RoomService.setDisguise(roomId, userId, null);
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'undisguise', targetUserId: userId },
            });
            setSelectedUser(null);
            showToast({ title: 'Kılık Kaldırıldı', message: `${displayName} normal görünümüne döndü`, type: 'info' });
          } catch { showToast({ title: 'Hata', message: 'İşlem başarısız', type: 'error' }); }
        }},
      ]
    });
  }, [roomId, firebaseUser, modChannelRef]);

  // ========== GEÇİCİ BAN ==========
  const executeTempBan = useCallback(async (userId: string, displayName: string, mins: number) => {
    try {
      await RoomService.banTemporary(roomId, userId, mins);
      modChannelRef.current?.send({
        type: 'broadcast', event: 'mod_action',
        payload: { action: 'ban', targetUserId: userId, reason: `${mins >= 60 ? Math.floor(mins/60) + ' saat' : mins + ' dakika'} yasaklandın.` },
      });
      setParticipants(prev => prev.filter(p => p.user_id !== userId));
      setSelectedUser(null);
      showToast({ title: '⛔ Yasaklandı', message: `${displayName} ${mins >= 60 ? Math.floor(mins/60) + ' saat' : mins + ' dakika'} yasaklandı`, type: 'success' });
    } catch { showToast({ title: 'Hata', message: 'Ban uygulanamadı', type: 'error' }); }
  }, [roomId, modChannelRef]);

  const handleTempBan = useCallback((userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: '⛔ Geçici Ban', message: `${displayName} geçici olarak yasaklanacak. Süre seçin:`, type: 'warning', icon: 'timer',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: '15 Dakika', onPress: () => executeTempBan(userId, displayName, 15) },
        { text: '1 Saat', onPress: () => executeTempBan(userId, displayName, 60) },
        { text: '24 Saat', style: 'destructive', onPress: () => executeTempBan(userId, displayName, 1440) },
      ]
    });
  }, [executeTempBan]);

  // ========== KALICI BAN ==========
  const handlePermBan = useCallback((userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: '⛔ Kalıcı Ban', message: `${displayName} bu odaya KALICI olarak yasaklanacak. Bu işlem geri alınamaz!`, type: 'error', icon: 'ban',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Kalıcı Yasakla', style: 'destructive', onPress: async () => {
          try {
            await RoomService.banPermanent(roomId, userId);
            modChannelRef.current?.send({
              type: 'broadcast', event: 'mod_action',
              payload: { action: 'permban', targetUserId: userId, reason: 'Kalıcı olarak yasaklandın.' },
            });
            setParticipants(prev => prev.filter(p => p.user_id !== userId));
            setSelectedUser(null);
            showToast({ title: '⛔ Kalıcı Yasaklandı', message: `${displayName} bu odaya bir daha giremez`, type: 'success' });
          } catch { showToast({ title: 'Hata', message: 'Ban uygulanamadı', type: 'error' }); }
        }},
      ]
    });
  }, [roomId, modChannelRef]);

  // ========== ŞİKAYET ==========
  const submitReport = useCallback(async (userId: string, reason: string) => {
    try {
      await ModerationService.reportUser(firebaseUser!.uid, userId, reason as any);
      setSelectedUser(null);
      showToast({ title: 'Şikayet Gönderildi', message: 'Şikayetiniz incelenecek. Teşekkürler.', type: 'success' });
    } catch (e) {
      showToast({ title: 'Hata', message: 'Şikayet gönderilemedi', type: 'error' });
    }
  }, [firebaseUser]);

  const handleReportUser = useCallback((userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: `${displayName} Şikayet Et`, message: 'Şikayet sebebini seçin:', type: 'warning', icon: 'flag',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport(userId, 'spam') },
        { text: 'Taciz', onPress: () => submitReport(userId, 'harassment') },
        { text: 'Nefret Söylemi', onPress: () => submitReport(userId, 'hate_speech') },
      ]
    });
  }, [submitReport]);

  // ========== ENGELLE ==========
  const handleBlockUser = useCallback((userId: string, displayName: string) => {
    setAlertConfig({
      visible: true, title: 'Kullanıcıyı Engelle', message: `${displayName} adlı kullanıcıyı engellemek istiyor musun? Mesajlarını göremeyeceksin.`, type: 'error', icon: 'ban',
      buttons: [
        { text: 'İptal', style: 'cancel' },
        { text: 'Engelle', style: 'destructive', onPress: async () => {
          try {
            await ModerationService.blockUser(firebaseUser!.uid, userId);
            setSelectedUser(null);
            showToast({ title: 'Engellendi', message: `${displayName} engellendi`, type: 'success' });
          } catch (e) {
            showToast({ title: 'Hata', message: 'Engellenemedi', type: 'error' });
          }
        }}
      ]
    });
  }, [firebaseUser]);

  return {
    handlePromoteToStage,
    handleKickUser,
    handleToggleChatMute,
    handleToggleModerator,
    handleTimedMuteUser,
    executeUnmute,
    handleGhostToggle,
    handleDisguiseUser,
    handleTempBan,
    handlePermBan,
    handleReportUser,
    handleBlockUser,
  };
}
