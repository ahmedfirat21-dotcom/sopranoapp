/**
 * SopranoChat — Günlük Check-in & Başarı Rozetleri Servisi
 * SP (Sistem Puanları) entegrasyonlu.
 */
import { supabase } from '../constants/supabase';
import { BadgeCheckerService } from './engagement/badges';
import { GamificationService } from './gamification';

// ─── Günlük Check-in Ödülleri ─────────────────
const DAILY_REWARDS = [5, 10, 15, 20, 25, 35, 50]; // 7 günlük seri

export interface CheckInResult {
  success: boolean;
  /** Kazanılan SP miktarı */
  spEarned: number;
  streak: number;
  alreadyCheckedIn: boolean;
  error?: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;       // Ionicons icon adı
  color: string;      // Badge rengi
  description: string;
  condition: string;
  unlockedAt?: string;
}

// Tüm rozetler — Modern Ionicons
export const ALL_BADGES: Badge[] = [
  { id: 'first_room',       name: 'İlk Oda',        icon: 'mic',                 color: '#5CC6C6', description: 'İlk odasını oluşturdu',       condition: 'Bir oda oluştur' },
  { id: 'social_butterfly',  name: 'Sosyal Kelebek', icon: 'chatbubbles',         color: '#3B82F6', description: '50 mesaj gönderdi',           condition: '50 mesaj gönder' },
  { id: 'streak_7',          name: '7 Gün Seri',     icon: 'flame',               color: '#F97316', description: '7 gün üst üste giriş yaptı', condition: '7 gün üst üste giriş yap' },
  { id: 'followers_100',     name: '100 Takipçi',    icon: 'people',              color: '#A855F7', description: '100 takipçiye ulaştı',       condition: '100 takipçiye ulaş' },
  { id: 'first_post',        name: 'İlk Gönderi',    icon: 'create',              color: '#10B981', description: 'İlk gönderisini paylaştı',   condition: 'Bir gönderi paylaş' },
  { id: 'night_owl',         name: 'Gece Kuşu',      icon: 'moon',                color: '#6366F1', description: 'Gece 2-5 arası aktif',       condition: 'Gece 2-5 arası giriş yap' },
  { id: 'early_bird',        name: 'Erken Kuş',      icon: 'sunny',               color: '#F59E0B', description: 'Sabah 5-7 arası aktif',      condition: 'Sabah 5-7 arası giriş yap' },
  { id: 'room_veteran',      name: 'Oda Ustası',     icon: 'trophy',              color: '#EAB308', description: '10 oda oluşturdu',            condition: '10 oda oluştur' },
  { id: 'sp_master',         name: 'SP Ustası',      icon: 'star',                color: '#14B8A6', description: '5000 SP biriktirdi',         condition: '5000 SP birikmiş ol' },
];

export const DailyCheckInService = {
  /**
   * Günlük check-in yap — SP kazan
   */
  async checkIn(userId: string): Promise<CheckInResult> {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Bugün zaten check-in yaptı mı?
      const { data: existing } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('check_date', today)
        .maybeSingle();

      if (existing) {
        return { success: true, spEarned: 0, streak: existing.streak, alreadyCheckedIn: true };
      }

      // Dünkü check-in — seri kontrolü
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const { data: yesterdayCheck } = await supabase
        .from('daily_checkins')
        .select('streak')
        .eq('user_id', userId)
        .eq('check_date', yesterdayStr)
        .maybeSingle();

      const newStreak = yesterdayCheck ? (yesterdayCheck.streak || 0) + 1 : 1;
      const rewardIndex = Math.min(newStreak - 1, DAILY_REWARDS.length - 1);
      const spReward = DAILY_REWARDS[rewardIndex];

      // Check-in kaydet
      await supabase.from('daily_checkins').insert({
        user_id: userId,
        check_date: today,
        streak: newStreak,
        sp_earned: spReward, // SP-only ekonomi — DB kolonu sp_earned
      });

      // SP kazandır
      let spEarned = 0;
      try { spEarned = await GamificationService.onDailyLogin(userId); } catch {}
      // Seri bonusu ek SP
      const streakBonus = Math.min(newStreak, 7) * 2;
      try {
        const { error: rpcError } = await supabase.rpc('grant_system_points', { p_user_id: userId, p_amount: spReward + streakBonus, p_action: 'daily_checkin' });
        if (rpcError) {
          const { data } = await supabase.from('profiles').select('system_points').eq('id', userId).single();
          if (data) {
            await supabase.from('profiles').update({ system_points: (data.system_points || 0) + spReward + streakBonus }).eq('id', userId);
          }
        }
        spEarned += spReward + streakBonus;
      } catch {}

      // Seri rozeti kontrolü
      await BadgeCheckerService.checkForAction(userId, 'daily_checkin');

      return { success: true, spEarned, streak: newStreak, alreadyCheckedIn: false };
    } catch (e: any) {
      console.error('Check-in error:', e);
      return { success: false, spEarned: 0, streak: 0, alreadyCheckedIn: false, error: e.message };
    }
  },

  /**
   * Mevcut seri bilgisini al
   */
  async getStreak(userId: string): Promise<{ streak: number; checkedInToday: boolean }> {
    try {
      // ★ NEW-8 FIX: Yerel tarih kullan
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const { data } = await supabase
        .from('daily_checkins')
        .select('streak, check_date')
        .eq('user_id', userId)
        .order('check_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return { streak: 0, checkedInToday: false };
      return { streak: data.streak || 0, checkedInToday: data.check_date === today };
    } catch {
      return { streak: 0, checkedInToday: false };
    }
  },
};

export const BadgeService = {
  /**
   * Rozet aç — yeni servise delege et
   */
  async unlock(userId: string, badgeId: string): Promise<boolean> {
    return BadgeCheckerService.unlock(userId, badgeId);
  },

  /**
   * Kullanıcının rozetlerini getir
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    try {
      const enriched = await BadgeCheckerService.getUserBadges(userId);
      // Badge tipine dönüştür
      return enriched.map(b => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        color: b.color,
        description: b.description,
        condition: b.condition,
        unlockedAt: b.unlockedAt,
      }));
    } catch {
      return [];
    }
  },

  /**
   * Otomatik rozet kontrolü — yeni servise delege et
   */
  async checkAndUnlock(userId: string, action: 'post_created' | 'room_created' | 'message_sent' | 'login'): Promise<string | null> {
    const actionMap: Record<string, string> = {
      'post_created': 'wall_post',
      'room_created': 'room_created',
      'message_sent': 'message_sent',
      'login': 'login',
    };
    return BadgeCheckerService.checkForAction(userId, actionMap[action] || action);
  },
};
