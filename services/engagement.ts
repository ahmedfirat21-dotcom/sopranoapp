/**
 * SopranoChat — Günlük Check-in & Başarı Rozetleri Servisi
 * SP (Sistem Puanları) entegrasyonlu.
 */
import { supabase } from '../constants/supabase';
import { GamificationService } from './gamification';
import { logger } from '../utils/logger';

// ─── Günlük Check-in Ödülleri ─────────────────
// ★ v86 (1 May 2026): SP ekonomi rebalance — toplam 70→40 (7 gün). tiers.ts DAILY_BASE_REWARDS ile senkron.
const DAILY_REWARDS = [1, 2, 3, 5, 7, 10, 12]; // 7 günlük seri

export interface CheckInResult {
  success: boolean;
  /** Kazanılan SP miktarı */
  spEarned: number;
  streak: number;
  alreadyCheckedIn: boolean;
  error?: string;
}



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

      // SP kazandır — sadece DAILY_REWARDS tablosundan (çift sayma yok)
      let spEarned = 0;
      try {
        // ★ GamificationService üzerinden git → transaction kaydı + cap kontrolü
        spEarned = await GamificationService.earn(userId, spReward, 'daily_checkin');
      } catch (e) {
        logger.error('Daily check-in SP grant failed:', e);
      }

      // ★ Badge Engine: streak_7 / streak_30 kontrol
      try {
        const { checkStreakBadges } = require('./badgeEngine');
        checkStreakBadges(userId, newStreak);
      } catch {}

      return { success: true, spEarned, streak: newStreak, alreadyCheckedIn: false };
    } catch (e: any) {
      logger.error('Check-in error:', e);
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


