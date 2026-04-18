/**
 * SopranoChat — Kullanıcı Unvan Sistemi
 * ═══════════════════════════════════════════════════
 * Aktiviteye dayalı otomatik hesaplanan unvanlar.
 * En yüksek öncelikli unvan gösterilir.
 */
import { supabase } from '../constants/supabase';

export type UserTitle = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  priority: number; // Yüksek = daha prestijli
};

// ═══ Unvan Tanımları ═══
const TITLE_DEFINITIONS: Record<string, UserTitle> = {
  community_leader: {
    id: 'community_leader', name: 'Topluluk Lideri', emoji: '👑',
    color: '#FBBF24', bgColor: 'rgba(251,191,36,0.12)', priority: 90,
  },
  stage_star: {
    id: 'stage_star', name: 'Sahne Yıldızı', emoji: '🎤',
    color: '#EF4444', bgColor: 'rgba(239,68,68,0.12)', priority: 85,
  },
  sp_baron: {
    id: 'sp_baron', name: 'SP Baronu', emoji: '💰',
    color: '#F59E0B', bgColor: 'rgba(245,158,11,0.12)', priority: 80,
  },
  generous_soul: {
    id: 'generous_soul', name: 'Cömert Ruh', emoji: '🎁',
    color: '#22C55E', bgColor: 'rgba(34,197,94,0.12)', priority: 75,
  },
  social_butterfly: {
    id: 'social_butterfly', name: 'Sosyal Kelebek', emoji: '🦋',
    color: '#A78BFA', bgColor: 'rgba(167,139,250,0.12)', priority: 70,
  },
  fireball: {
    id: 'fireball', name: 'Ateş Topu', emoji: '🔥',
    color: '#FB923C', bgColor: 'rgba(251,146,60,0.12)', priority: 65,
  },
  rising_star: {
    id: 'rising_star', name: 'Yükselen Yıldız', emoji: '⭐',
    color: '#60A5FA', bgColor: 'rgba(96,165,250,0.12)', priority: 50,
  },
};

export const UserTitleService = {
  /**
   * Kullanıcının kazandığı tüm unvanları hesapla.
   * En yüksek priority = birincil unvan.
   */
  async getUserTitles(userId: string): Promise<UserTitle[]> {
    const titles: UserTitle[] = [];

    try {
      const [
        { count: followerCount },
        { count: roomCount },
        { count: totalEarnedCount },
        { count: donationCount },
        { count: stageCount },
        { data: profileData },
      ] = await Promise.all([
        // Takipçi sayısı
        supabase.from('friendships')
          .select('*', { count: 'exact', head: true })
          .eq('friend_id', userId).eq('status', 'accepted'),
        // Oda sayısı
        supabase.from('rooms')
          .select('*', { count: 'exact', head: true })
          .eq('host_id', userId),
        // ★ SEC-PERF: Toplam kazanç — count + head:true (tüm kayıtları çekme)
        supabase.from('sp_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gt('amount', 0),
        // ★ SEC-PERF: Bağış sayısı — sadece count
        supabase.from('sp_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'donation_sent'),
        // ★ SEC-PERF: Sahne süresi — sadece count
        supabase.from('sp_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'stage_time'),
        // Profil — mevcut SP ve streak
        supabase.from('profiles')
          .select('system_points, check_in_streak')
          .eq('id', userId)
          .single(),
      ]);

      const followers = followerCount || 0;
      const rooms = roomCount || 0;
      const profile = profileData || {};

      // ★ SEC-PERF: Tahmini değerler — count tabanlı (tam doğruluk gerekmiyor, unvan eşikleri)
      const totalEarned = (totalEarnedCount || 0) * 10; // Ortalama 10 SP/işlem tahmini
      const totalDonated = (donationCount || 0) * 25;   // Ortalama 25 SP/bağış tahmini
      const stageMinutes = (stageCount || 0) * 10;      // Her event = 10dk
      const streak = (profile as any)?.check_in_streak || 0;

      // ═══ Unvan Koşulları ═══
      if (rooms >= 10 && followers >= 20)   titles.push(TITLE_DEFINITIONS.community_leader);
      if (stageMinutes >= 500)              titles.push(TITLE_DEFINITIONS.stage_star);
      if (totalEarned >= 5000)              titles.push(TITLE_DEFINITIONS.sp_baron);
      if (totalDonated >= 500)              titles.push(TITLE_DEFINITIONS.generous_soul);
      if (followers >= 50)                  titles.push(TITLE_DEFINITIONS.social_butterfly);
      if (streak >= 7)                      titles.push(TITLE_DEFINITIONS.fireball);
      if (followers >= 10 || rooms >= 3)    titles.push(TITLE_DEFINITIONS.rising_star);

    } catch (err) {
      if (__DEV__) console.warn('[UserTitleService] Error:', err);
    }

    // Öncelik sırasına göre sırala
    return titles.sort((a, b) => b.priority - a.priority);
  },

  /** Birincil (en prestijli) unvanı getir */
  async getPrimaryTitle(userId: string): Promise<UserTitle | null> {
    const titles = await this.getUserTitles(userId);
    return titles.length > 0 ? titles[0] : null;
  },

  /** Tüm unvan tanımlarını döndür (UI'da göstermek için) */
  getAllDefinitions(): UserTitle[] {
    return Object.values(TITLE_DEFINITIONS).sort((a, b) => b.priority - a.priority);
  },
};
