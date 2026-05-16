/**
 * SopranoChat — Profil ekstra servisleri
 * v110.5 (6 May 2026)
 *
 * Faz B.1: VoiceBio (sesli tanıtım) — kayıt + storage + profiles update
 * Faz B.3: MutualRooms — ortak odalar (RPC)
 * Faz B.4: TopSupporters — en büyük destekçiler (RPC)
 * Faz B.5: FeaturedBadges — kullanıcının seçtiği 3 öne çıkan rozet
 * Faz C.1: UserNotes — kişisel notlar (her kullanıcı kendi gözünden bir kişiye not bırakır)
 * Faz C.5: SpeakingRhythm — konuşma ritmi (saat histogramı)
 */
import { supabase } from '../constants/supabase';
import { StorageService } from './storage';
import { i18n } from './i18n';

// ═══════════════════════════════════════════════════════════════════
// VOICE BIO — Sesli Tanıtım
// ═══════════════════════════════════════════════════════════════════

/** Sesli tanıtım için izin verilen min/max süre (ms) */
export const VOICE_BIO_MIN_MS = 3000;   // 3 saniye
export const VOICE_BIO_MAX_MS = 30000;  // 30 saniye

export const VoiceBioService = {
  /**
   * Kayıt edilen ses dosyasını storage'a yükler ve profiles tablosunu günceller.
   * Eski voice bio varsa storage'dan siler.
   */
  async upload(userId: string, audioUri: string, durationMs: number, prevUrl?: string | null): Promise<string> {
    if (durationMs < VOICE_BIO_MIN_MS) {
      throw new Error(i18n.t('auto.profileExtras.004'));
    }
    if (durationMs > VOICE_BIO_MAX_MS) {
      throw new Error(i18n.t('auto.profileExtras.003'));
    }
    const url = await StorageService.uploadVoiceNote(userId, audioUri);
    await supabase
      .from('profiles')
      .update({
        voice_bio_url: url,
        voice_bio_duration_ms: durationMs,
      })
      .eq('id', userId);
    // Eski voice bio'yu sil (best effort)
    if (prevUrl && prevUrl !== url) {
      try {
        const marker = `/storage/v1/object/public/voice-notes/`;
        const idx = prevUrl.indexOf(marker);
        if (idx >= 0) {
          const path = decodeURIComponent(prevUrl.slice(idx + marker.length).split('?')[0]);
          if (path.startsWith(`${userId}/`)) {
            await supabase.storage.from('voice-notes').remove([path]);
          }
        }
      } catch { /* sessiz */ }
    }
    return url;
  },

  async remove(userId: string, currentUrl?: string | null): Promise<void> {
    await supabase
      .from('profiles')
      .update({ voice_bio_url: null, voice_bio_duration_ms: null })
      .eq('id', userId);
    if (currentUrl) {
      try {
        const marker = `/storage/v1/object/public/voice-notes/`;
        const idx = currentUrl.indexOf(marker);
        if (idx >= 0) {
          const path = decodeURIComponent(currentUrl.slice(idx + marker.length).split('?')[0]);
          if (path.startsWith(`${userId}/`)) {
            await supabase.storage.from('voice-notes').remove([path]);
          }
        }
      } catch { /* sessiz */ }
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// TOP SUPPORTERS — En Büyük Destekçiler (Faz B.4)
// ═══════════════════════════════════════════════════════════════════

export type Supporter = {
  supporter_id: string;
  display_name: string;
  avatar_url: string;
  subscription_tier: string;
  total_amount: number;
  donation_count: number;
};

export const SupportersService = {
  async getTop(targetUserId: string, limit: number = 3): Promise<Supporter[]> {
    const { data, error } = await supabase.rpc('get_top_supporters', {
      p_target_user_id: targetUserId,
      p_limit: limit,
    });
    if (error || !data) return [];
    return (data as any[]).map(r => ({
      supporter_id: r.supporter_id,
      display_name: r.display_name || i18n.t('auto.profileExtras.002'),
      avatar_url: r.avatar_url || '',
      subscription_tier: r.subscription_tier || 'Free',
      total_amount: Number(r.total_amount) || 0,
      donation_count: Number(r.donation_count) || 0,
    }));
  },
};

// ═══════════════════════════════════════════════════════════════════
// MUTUAL ROOMS — Ortak Odalar (Faz B.3)
// ═══════════════════════════════════════════════════════════════════

export type MutualRoom = {
  room_id: string;
  room_name: string;
  is_live: boolean;
  is_persistent: boolean;
  listener_count: number;
};

export const MutualRoomsService = {
  async get(userA: string, userB: string, limit: number = 5): Promise<MutualRoom[]> {
    if (userA === userB) return [];
    const { data, error } = await supabase.rpc('get_mutual_rooms', {
      p_user_a: userA,
      p_user_b: userB,
      p_limit: limit,
    });
    if (error || !data) return [];
    return data as MutualRoom[];
  },
};

// ═══════════════════════════════════════════════════════════════════
// FEATURED BADGES — Öne Çıkan Rozetler (Faz B.5)
// ═══════════════════════════════════════════════════════════════════

export const MAX_FEATURED_BADGES = 3;

export const FeaturedBadgesService = {
  /** Bir kullanıcının öne çıkardığı rozetleri (max 3) getir */
  async getFeatured(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId)
      .eq('is_featured', true)
      .order('awarded_at', { ascending: false })
      .limit(MAX_FEATURED_BADGES);
    if (error || !data) return [];
    return data.map((r: any) => r.badge_id);
  },

  /** Kullanıcının seçimini topluca güncelle — eskileri kaldır, yenileri set et */
  async setFeatured(userId: string, badgeIds: string[]): Promise<void> {
    const limited = badgeIds.slice(0, MAX_FEATURED_BADGES);
    // Önce hepsini false yap
    await supabase
      .from('user_badges')
      .update({ is_featured: false })
      .eq('user_id', userId);
    // Sonra seçilenleri true yap
    if (limited.length > 0) {
      await supabase
        .from('user_badges')
        .update({ is_featured: true })
        .eq('user_id', userId)
        .in('badge_id', limited);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
// USER NOTES — Kişisel Notlar (Faz C.1)
// ═══════════════════════════════════════════════════════════════════

export const MAX_NOTE_LENGTH = 280;

export const UserNotesService = {
  async get(ownerId: string, targetId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('user_notes')
      .select('note')
      .eq('owner_id', ownerId)
      .eq('target_id', targetId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as any).note || null;
  },

  async upsert(ownerId: string, targetId: string, note: string): Promise<void> {
    const trimmed = (note || '').trim().slice(0, MAX_NOTE_LENGTH);
    if (!trimmed) {
      // Boş not → sil
      await supabase
        .from('user_notes')
        .delete()
        .eq('owner_id', ownerId)
        .eq('target_id', targetId);
      return;
    }
    await supabase
      .from('user_notes')
      .upsert(
        { owner_id: ownerId, target_id: targetId, note: trimmed },
        { onConflict: 'owner_id,target_id' },
      );
  },

  async remove(ownerId: string, targetId: string): Promise<void> {
    await supabase
      .from('user_notes')
      .delete()
      .eq('owner_id', ownerId)
      .eq('target_id', targetId);
  },
};

// ═══════════════════════════════════════════════════════════════════
// SPEAKING RHYTHM — Konuşma Ritmi (Faz C.5)
// ═══════════════════════════════════════════════════════════════════

export type RhythmBucket = { hour: number; count: number };

export const SpeakingRhythmService = {
  /** 24 bucket'lık histogram (Europe/Istanbul saat dilimi). */
  async get(userId: string): Promise<RhythmBucket[]> {
    const { data, error } = await supabase.rpc('get_speaking_rhythm', { p_user_id: userId });
    if (error || !data) return [];
    return (data as any[]).map(r => ({
      hour: Number(r.hour_bucket) || 0,
      count: Number(r.event_count) || 0,
    }));
  },

  /** "Genelde 21-23 arası canlı" gibi insight metni üret. Yetersiz veride null döner. */
  derivePrimeTimeText(rhythm: RhythmBucket[]): string | null {
    if (!rhythm || rhythm.length < 3) return null;
    const total = rhythm.reduce((s, b) => s + b.count, 0);
    if (total < 6) return null; // 6 stage event'ten az → anlamlı değil
    // En aktif 3 saatlik blok bul (sliding window)
    let bestStart = 0;
    let bestSum = 0;
    for (let h = 0; h < 24; h++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        const target = (h + k) % 24;
        const bucket = rhythm.find(b => b.hour === target);
        if (bucket) sum += bucket.count;
      }
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = h;
      }
    }
    if (bestSum < total * 0.4) return null; // 3 saat blok toplamın %40'ını taşımıyorsa pattern yok
    const end = (bestStart + 3) % 24;
    const fmt = (h: number) => `${h.toString().padStart(2, '0')}:00`;
    return i18n.t('auto.profileExtras.001', { 0: fmt(bestStart), 1: fmt(end) });
  },
};
