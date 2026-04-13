/**
 * SopranoChat — Günlük Check-in & Başarı Rozetleri Servisi
 * SP (Sistem Puanları) entegrasyonlu.
 */
import { supabase } from '../constants/supabase';
import { GamificationService } from './gamification';

// ─── Günlük Check-in Ödülleri ─────────────────
const DAILY_REWARDS = [2, 4, 6, 8, 10, 15, 25]; // 7 günlük seri (tiers.ts ile senkron)

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
      } catch {}


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


