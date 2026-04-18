/**
 * SopranoChat — Sistem Odaları Yönetimi
 * ═══════════════════════════════════════════════════
 * SopranoChat'in resmi odalarının özel davranış katmanı.
 * Sahne boş toast, rol atama, sahne yetkileri.
 */
import { supabase } from '../constants/supabase';
import { SHOWCASE_ROOMS, MIN_ACTIVE_ROOMS, getShowcaseRoomInserts } from './showcaseRooms';
import type { Room, ParticipantRole, SubscriptionTier } from '../types';

// ════════════════════════════════════════════════════════════
// SİSTEM ODA YÖNETİMİ
// ════════════════════════════════════════════════════════════

export const SystemRoomService = {
  /**
   * Keşfet sayfası için sistem odalarını kontrol et.
   * Kullanıcı odaları MIN_ACTIVE_ROOMS'un altındaysa sistem odaları eklenir.
   *
   * @returns Gösterilecek oda listesi (kullanıcı odaları + gerekirse sistem odaları)
   */
  async ensureMinimumRooms(userRooms: Partial<Room>[]): Promise<Partial<Room>[]> {
    if (userRooms.length >= MIN_ACTIVE_ROOMS) {
      return userRooms;
    }

    // Eksik oda sayısı kadar sistem odası ekle
    const needed = MIN_ACTIVE_ROOMS - userRooms.length;
    const systemRoomsToShow = SHOWCASE_ROOMS.slice(0, Math.min(needed, SHOWCASE_ROOMS.length));

    return [...userRooms, ...systemRoomsToShow];
  },

  /**
   * Sistem odalarını Supabase'e seed et.
   * Başlangıçta veya backup amaçlı çağrılır.
   */
  async seedSystemRooms(): Promise<void> {
    // sopranochat_official hesabını bul (slug ile)
    const { data: systemUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', 'sopranochat_official')
      .single();

    if (!systemUser) {
      if (__DEV__) console.warn('[SystemRooms] sopranochat_official hesabı bulunamadı — seed atlanıyor');
      return;
    }

    const inserts = getShowcaseRoomInserts(systemUser.id);
    for (const room of inserts) {
      try {
        await supabase
          .from('rooms')
          .upsert(room as any, { onConflict: 'id' });
      } catch (e) {
        if (__DEV__) console.warn(`[SystemRooms] Seed hatası: ${(room as any).id}`, e);
      }
    }
  },

  /**
   * Sistem odasına giren kullanıcının ilk rolünü belirle.
   * Spec: Giren kullanıcı HER ZAMAN 'listener' olarak katılır.
   * Sahneye çıkmak isterse → promote_speaker ile yükseltilir.
   */
  getJoinRole(_room: Partial<Room>, _userId: string): ParticipantRole {
    // Herkes dinleyici olarak başlar
    return 'listener';
  },

  /**
   * Sahne boş olduğunda gösterilecek toast prompt.
   * Kullanıcı sahneye çıkarsa yalnızca mic + cam yetkisi verilir,
   * yönetimsel yetki (kick, ban, moderator ata) yoktur.
   */
  getEmptyStagePrompt(): { title: string; message: string; action: string } {
    return {
      title: '🎤 Sahne Boş!',
      message: 'Sahne seni bekliyor — gel, konuş!',
      action: 'Sahneye Çık',
    };
  },

  /**
   * Yetkili kişi (moderator/owner) sistem odasına girdiğinde
   * kişisel oda açma teklifi gösterilir.
   */
  getPersonalRoomPrompt(): { title: string; message: string; action: string } {
    return {
      title: '🏠 Kendi Odanı Aç!',
      message: 'Sen de bir oda oluşturup topluluğunu kurabilirsin.',
      action: 'Oda Oluştur',
    };
  },

  /**
   * Odada sahne boş mu kontrol et (hiç speaker/owner yok mu?).
   */
  async isStageEmpty(roomId: string): Promise<boolean> {
    const { count } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .in('role', ['owner', 'speaker']);
    return (count || 0) === 0;
  },

  /**
   * Sahneye çıkan kullanıcıya verilecek yetkiler.
   * Sistem odasında sahneye çıksan bile yönetimsel yetki yok.
   */
  getStagePermissions(isSystemRoom: boolean): {
    canUseMic: boolean;
    canUseCamera: boolean;
    canManageRoom: boolean;
  } {
    return {
      canUseMic: true,
      canUseCamera: true,
      canManageRoom: !isSystemRoom, // Sistem odasında yönetim yok
    };
  },

  /**
   * Oda bir sistem odası mı kontrol et.
   */
  isSystemRoom(room: Partial<Room>): boolean {
    if (room.is_system_room) return true;
    // Fallback: ID ile kontrol
    const systemIds = SHOWCASE_ROOMS.map(r => r.id);
    return systemIds.includes(room.id);
  },
};
