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
        { data: spTx },
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
        // SP işlemleri — toplam kazançlar ve bağışlar
        supabase.from('sp_transactions')
          .select('amount, type')
          .eq('user_id', userId),
        // Profil — mevcut SP ve streak
        supabase.from('profiles')
          .select('system_points, check_in_streak')
          .eq('id', userId)
          .single(),
      ]);

      const followers = followerCount || 0;
      const rooms = roomCount || 0;
      const txns = spTx || [];
      const profile = profileData || {};

      // Toplam kazanılan SP
      const totalEarned = txns.filter((t: any) => t.amount > 0).reduce((s: number, t: any) => s + t.amount, 0);
      // Toplam bağışlanan SP
      const totalDonated = txns.filter((t: any) => t.type === 'donation_sent').reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
      // Sahne süresi (stage_time event sayısı × 10dk)
      const stageMinutes = txns.filter((t: any) => t.type === 'stage_time').length * 10;
      // Streak
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
