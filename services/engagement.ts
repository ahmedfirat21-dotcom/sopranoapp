/**
 * SopranoChat — Günlük Check-in & Başarı Rozetleri Servisi
 */
import { supabase } from '../constants/supabase';

// ─── Günlük Check-in Ödülleri ─────────────────
const DAILY_REWARDS = [5, 10, 15, 20, 25, 35, 50]; // 7 günlük seri

export interface CheckInResult {
  success: boolean;
  coinsEarned: number;
  streak: number;
  alreadyCheckedIn: boolean;
  error?: string;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  condition: string; // Koşul açıklaması
  unlockedAt?: string;
}

// Tüm rozetler
export const ALL_BADGES: Badge[] = [
  { id: 'first_room', name: 'İlk Oda', icon: '🎙️', description: 'İlk odasını oluşturdu', condition: 'Bir oda oluştur' },
  { id: 'social_butterfly', name: 'Sosyal Kelebek', icon: '💬', description: '50 mesaj gönderdi', condition: '50 mesaj gönder' },
  { id: 'generous', name: 'Cömert', icon: '🎁', description: '10 hediye gönderdi', condition: '10 hediye gönder' },
  { id: 'streak_7', name: '7 Gün Seri', icon: '🔥', description: '7 gün üst üste giriş yaptı', condition: '7 gün üst üste giriş yap' },
  { id: 'followers_100', name: '100 Takipçi', icon: '⭐', description: '100 takipçiye ulaştı', condition: '100 takipçiye ulaş' },
  { id: 'first_post', name: 'İlk Gönderi', icon: '📝', description: 'İlk gönderisini paylaştı', condition: 'Bir gönderi paylaş' },
  { id: 'night_owl', name: 'Gece Kuşu', icon: '🦉', description: 'Gece 2-5 arası aktif', condition: 'Gece 2-5 arası giriş yap' },
  { id: 'early_bird', name: 'Erken Kuş', icon: '🐦', description: 'Sabah 5-7 arası aktif', condition: 'Sabah 5-7 arası giriş yap' },
  { id: 'room_veteran', name: 'Oda Ustası', icon: '🏆', description: '10 oda oluşturdu', condition: '10 oda oluştur' },
  { id: 'coin_collector', name: 'Coin Avcısı', icon: '💰', description: '1000 coin biriktirdi', condition: '1000 coin birikmiş ol' },
];

export const DailyCheckInService = {
  /**
   * Günlük check-in yap — coin kazan
   */
  async checkIn(userId: string): Promise<CheckInResult> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Bugün zaten check-in yaptı mı?
      const { data: existing } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', userId)
        .eq('check_date', today)
        .maybeSingle();

      if (existing) {
        return { success: true, coinsEarned: 0, streak: existing.streak, alreadyCheckedIn: true };
      }

      // Dünkü check-in — seri kontrolü
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: yesterdayCheck } = await supabase
        .from('daily_checkins')
        .select('streak')
        .eq('user_id', userId)
        .eq('check_date', yesterdayStr)
        .maybeSingle();

      const newStreak = yesterdayCheck ? (yesterdayCheck.streak || 0) + 1 : 1;
      const rewardIndex = Math.min(newStreak - 1, DAILY_REWARDS.length - 1);
      const coinsEarned = DAILY_REWARDS[rewardIndex];

      // Check-in kaydet
      await supabase.from('daily_checkins').insert({
        user_id: userId,
        check_date: today,
        streak: newStreak,
        coins_earned: coinsEarned,
      });

      // Coin ekle
      const { error: rpcError } = await supabase.rpc('increment_coins', { uid: userId, amount: coinsEarned });
      if (rpcError) {
        // RPC yoksa fallback
        const { data } = await supabase.from('profiles').select('coins').eq('id', userId).single();
        if (data) {
          await supabase.from('profiles').update({ coins: (data.coins || 0) + coinsEarned }).eq('id', userId);
        }
      }

      // 7 gün seri rozeti kontrol
      if (newStreak >= 7) {
        await BadgeService.unlock(userId, 'streak_7');
      }

      return { success: true, coinsEarned, streak: newStreak, alreadyCheckedIn: false };
    } catch (e: any) {
      console.error('Check-in error:', e);
      return { success: false, coinsEarned: 0, streak: 0, alreadyCheckedIn: false, error: e.message };
    }
  },

  /**
   * Mevcut seri bilgisini al
   */
  async getStreak(userId: string): Promise<{ streak: number; checkedInToday: boolean }> {
    try {
      const today = new Date().toISOString().split('T')[0];
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
   * Rozet aç
   */
  async unlock(userId: string, badgeId: string): Promise<boolean> {
    try {
      // Zaten var mı?
      const { data: existing } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badgeId)
        .maybeSingle();

      if (existing) return false; // Zaten açılmış

      await supabase.from('user_badges').insert({
        user_id: userId,
        badge_id: badgeId,
        unlocked_at: new Date().toISOString(),
      });

      return true;
    } catch (e) {
      console.warn('Badge unlock error:', e);
      return false;
    }
  },

  /**
   * Kullanıcının rozetlerini getir
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    try {
      const { data } = await supabase
        .from('user_badges')
        .select('badge_id, unlocked_at')
        .eq('user_id', userId);

      if (!data) return [];

      return data.map(ub => {
        const badge = ALL_BADGES.find(b => b.id === ub.badge_id);
        return badge ? { ...badge, unlockedAt: ub.unlocked_at } : null;
      }).filter(Boolean) as Badge[];
    } catch {
      return [];
    }
  },

  /**
   * Otomatik rozet kontrolü — belirli eylemlerde çağrılır
   */
  async checkAndUnlock(userId: string, action: 'post_created' | 'room_created' | 'message_sent' | 'gift_sent' | 'login'): Promise<string | null> {
    try {
      switch (action) {
        case 'post_created': {
          const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
          if ((count || 0) >= 1) {
            const unlocked = await this.unlock(userId, 'first_post');
            if (unlocked) return 'first_post';
          }
          break;
        }
        case 'room_created': {
          const { count } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', userId);
          if ((count || 0) >= 1) {
            const unlocked = await this.unlock(userId, 'first_room');
            if (unlocked) return 'first_room';
          }
          if ((count || 0) >= 10) {
            const unlocked = await this.unlock(userId, 'room_veteran');
            if (unlocked) return 'room_veteran';
          }
          break;
        }
        case 'gift_sent': {
          const { count } = await supabase.from('gifts').select('*', { count: 'exact', head: true }).eq('sender_id', userId);
          if ((count || 0) >= 10) {
            const unlocked = await this.unlock(userId, 'generous');
            if (unlocked) return 'generous';
          }
          break;
        }
        case 'login': {
          const hour = new Date().getHours();
          if (hour >= 2 && hour < 5) {
            const unlocked = await this.unlock(userId, 'night_owl');
            if (unlocked) return 'night_owl';
          }
          if (hour >= 5 && hour < 7) {
            const unlocked = await this.unlock(userId, 'early_bird');
            if (unlocked) return 'early_bird';
          }
          // Coin kontrolü
          const { data: prof } = await supabase.from('profiles').select('coins').eq('id', userId).single();
          if (prof && (prof.coins || 0) >= 1000) {
            const unlocked = await this.unlock(userId, 'coin_collector');
            if (unlocked) return 'coin_collector';
          }
          break;
        }
      }
      return null;
    } catch {
      return null;
    }
  },
};
