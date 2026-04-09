/**
 * SopranoChat — Rozet Kontrol & Unlock Servisi
 * 30 rozet kataloğu ile tam entegre otomatik kontrol
 */
import { supabase } from '../../constants/supabase';
import { BADGE_CATALOG, type BadgeDefinition, getBadgeById, TOTAL_BADGES, getBadgeProgress } from '../../constants/badges';
import type { TierName } from '../../types';

// ═══════════════════════════════════════════════════
// TIPLER
// ═══════════════════════════════════════════════════

export interface UserBadge extends BadgeDefinition {
  unlockedAt: string;
}

export interface BadgeCheckResult {
  newlyUnlocked: string[];  // Yeni açılan rozet ID'leri
  totalUnlocked: number;
  totalBadges: number;
}

// Kullanıcı istatistikleri — rozet kontrolünde kullanılır
interface UserStats {
  followers: number;
  following: number;
  rooms_created: number;
  wall_posts: number;
  messages_sent: number;
  system_points: number;
  tier: TierName;
  rooms_visited: number;
  login_streak: number;
  referrals: number;
  created_at: string;
}

// 5-tier abonelik hiyerarşisi
const TIER_ORDER: Record<string, number> = {
  'Free': 0,
  'Bronze': 1,
  'Silver': 2,
  'Gold': 3,
  'VIP': 4,
  // DB normalizasyonu (küçük harf ve eski isimler)
  'newcomer': 0, 'Newcomer': 0,
  'bronze': 1, 'silver': 2, 'gold': 3,
  'Plus': 2, 'Premium': 3, 'Diamond': 4,
  'diamond': 4, 'Plat': 3,
};

// ═══════════════════════════════════════════════════
// BADGE CHECKER SERVİSİ
// ═══════════════════════════════════════════════════

export const BadgeCheckerService = {
  /**
   * Rozet aç (idempotent — zaten varsa skip)
   */
  async unlock(userId: string, badgeId: string): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badgeId)
        .maybeSingle();

      if (existing) return false;

      await supabase.from('user_badges').insert({
        user_id: userId,
        badge_id: badgeId,
        unlocked_at: new Date().toISOString(),
      });

      return true;
    } catch (e) {
      if (__DEV__) console.warn('[BadgeChecker] unlock error:', e);
      return false;
    }
  },

  /**
   * Kullanıcının tüm rozetlerini getir (katalog bilgisi ile zenginleştirilmiş)
   */
  async getUserBadges(userId: string): Promise<UserBadge[]> {
    try {
      const { data } = await supabase
        .from('user_badges')
        .select('badge_id, unlocked_at')
        .eq('user_id', userId);

      if (!data) return [];

      return data
        .map(ub => {
          const def = getBadgeById(ub.badge_id);
          if (!def) return null;
          return { ...def, unlockedAt: ub.unlocked_at } as UserBadge;
        })
        .filter(Boolean) as UserBadge[];
    } catch {
      return [];
    }
  },

  /**
   * Kullanıcı istatistiklerini topla
   */
  async _gatherStats(userId: string): Promise<UserStats> {
    const stats: UserStats = {
      followers: 0, following: 0, rooms_created: 0,
      wall_posts: 0, messages_sent: 0,
      system_points: 0, tier: 'Free',
      rooms_visited: 0, login_streak: 0, referrals: 0,
      created_at: new Date().toISOString(),
    };

    try {
      // Profil verisi
      const { data: profile } = await supabase
        .from('profiles')
        .select('system_points, subscription_tier, created_at')
        .eq('id', userId)
        .single();

      if (profile) {
        stats.system_points = profile.system_points || 0;
        stats.tier = (profile.subscription_tier || 'Free') as TierName;
        stats.created_at = profile.created_at || stats.created_at;
      }

      // Takipçi sayısı
      const { count: followerCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('friend_id', userId)
        .eq('status', 'accepted');
      stats.followers = followerCount ?? 0;

      // Oluşturulan oda sayısı
      const { count: roomCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', userId);
      stats.rooms_created = roomCount ?? 0;

      // Duvar paylaşımları
      const { count: wallCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      stats.wall_posts = wallCount ?? 0;

      // Gönderilen mesaj sayısı
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', userId);
      stats.messages_sent = msgCount ?? 0;

      // Login streak
      try {
        const { data: streakData } = await supabase
          .from('daily_checkins')
          .select('streak')
          .eq('user_id', userId)
          .order('check_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        stats.login_streak = streakData?.streak || 0;
      } catch {}

      // Referral sayısı
      try {
        const { count: refCount } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referrer_id', userId);
        stats.referrals = refCount ?? 0;
      } catch {}

    } catch (e) {
      if (__DEV__) console.warn('[BadgeChecker] stat gathering error:', e);
    }

    return stats;
  },

  /**
   * Tek bir rozet koşulunu kontrol et
   */
  _checkCondition(badge: BadgeDefinition, stats: UserStats): boolean {
    switch (badge.id) {
      // ═══ SOSYAL ═══
      case 'first_friend':        return stats.followers >= 1;
      case 'social_butterfly':    return stats.followers >= 10;
      case 'influencer':          return stats.followers >= 50;
      case 'celebrity':           return stats.followers >= 200;
      case 'legend':              return stats.followers >= 1000;
      case 'wall_writer':         return stats.wall_posts >= 10;
      case 'dm_master':           return stats.messages_sent >= 100;

      // ═══ HOSTİNG ═══
      case 'first_room':          return stats.rooms_created >= 1;
      case 'frequent_host':       return stats.rooms_created >= 10;
      case 'veteran_host':        return stats.rooms_created >= 50;
      case 'crowd_puller':        return false; // Gerçek zamanlı — odada kontrol edilir
      case 'marathon_host':       return false; // Gerçek zamanlı — oda süresine bağlı
      case 'night_owl': {
        const hour = new Date().getHours();
        return hour >= 2 && hour < 5;
      }
      case 'music_maestro':       return false; // Gerçek zamanlı — müzik odası oluşturma sayısı

      // ═══ EKONOMİ (SP) ═══
      case 'sp_collector':        return stats.system_points >= 1000;
      case 'sp_master':           return stats.system_points >= 5000;
      case 'sp_legend':           return stats.system_points >= 25000;

      // ═══ DİNLEYİCİ ═══
      case 'curious_listener':    return false; // rooms_visited — ayrı takip gerekir
      case 'explorer':            return false;
      case 'active_listener':     return false; // listen_hours — ayrı takip gerekir
      case 'stage_star':          return false; // times_on_stage — ayrı takip gerekir
      case 'chat_warrior':        return false; // room_chats — ayrı takip gerekir

      // ═══ ÖZEL ═══
      case 'early_bird': {
        // İlk 1000 kullanıcı — created_at sırasına göre kontrol
        // Basit kontrol: profil oluşturma tarihi ne kadar eski
        return false; // Manuel olarak admin tarafından atanacak
      }
      case 'streak_master':       return stats.login_streak >= 30;
      case 'referral_king':       return stats.referrals >= 10;

      // ═══ TIER ═══
      case 'tier_bronze':   return (TIER_ORDER[stats.tier] ?? 0) >= 1;
      case 'tier_silver':   return (TIER_ORDER[stats.tier] ?? 0) >= 2;
      case 'tier_gold':     return (TIER_ORDER[stats.tier] ?? 0) >= 3;
      case 'tier_vip':    return (TIER_ORDER[stats.tier] ?? 0) >= 4;

      default: return false;
    }
  },

  /**
   * TÜM rozetleri kontrol et ve açılmayanları aç
   * Login, oda oluşturma, hediye gönderme gibi aksiyonlarda çağrılır
   */
  async checkAll(userId: string): Promise<BadgeCheckResult> {
    const result: BadgeCheckResult = {
      newlyUnlocked: [],
      totalUnlocked: 0,
      totalBadges: TOTAL_BADGES,
    };

    try {
      // Mevcut açık rozetleri al
      const { data: existing } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      const unlockedIds = new Set((existing || []).map(e => e.badge_id));
      result.totalUnlocked = unlockedIds.size;

      // İstatistikleri topla
      const stats = await this._gatherStats(userId);

      // Kilitsiz değil + koşul sağlanan rozetleri kontrol et
      for (const badge of BADGE_CATALOG) {
        if (unlockedIds.has(badge.id)) continue;
        if (this._checkCondition(badge, stats)) {
          const unlocked = await this.unlock(userId, badge.id);
          if (unlocked) {
            result.newlyUnlocked.push(badge.id);
            result.totalUnlocked++;
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[BadgeChecker] checkAll error:', e);
    }

    return result;
  },

  /**
   * Belirli bir aksiyon için hızlı rozet kontrolü (checkAll yerine hafif versiyon)
   * Sadece ilgili rozetleri kontrol eder
   */
  async checkForAction(userId: string, action: string): Promise<string | null> {
    try {
      switch (action) {
        case 'room_created': {
          const { count } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('host_id', userId);
          const c = count ?? 0;
          if (c >= 1 && await this.unlock(userId, 'first_room')) return 'first_room';
          if (c >= 10 && await this.unlock(userId, 'frequent_host')) return 'frequent_host';
          if (c >= 50 && await this.unlock(userId, 'veteran_host')) return 'veteran_host';
          // Gece kontrolü
          const hour = new Date().getHours();
          if (hour >= 2 && hour < 5 && await this.unlock(userId, 'night_owl')) return 'night_owl';
          break;
        }

        case 'new_follower': {
          const { count } = await supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('friend_id', userId).eq('status', 'accepted');
          const c = count ?? 0;
          if (c >= 1 && await this.unlock(userId, 'first_friend')) return 'first_friend';
          if (c >= 10 && await this.unlock(userId, 'social_butterfly')) return 'social_butterfly';
          if (c >= 50 && await this.unlock(userId, 'influencer')) return 'influencer';
          if (c >= 200 && await this.unlock(userId, 'celebrity')) return 'celebrity';
          if (c >= 1000 && await this.unlock(userId, 'legend')) return 'legend';
          break;
        }
        case 'wall_post': {
          const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId);
          if ((count ?? 0) >= 10 && await this.unlock(userId, 'wall_writer')) return 'wall_writer';
          break;
        }
        case 'message_sent': {
          const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', userId);
          if ((count ?? 0) >= 100 && await this.unlock(userId, 'dm_master')) return 'dm_master';
          break;
        }
        case 'daily_checkin': {
          const { data } = await supabase.from('daily_checkins').select('streak').eq('user_id', userId).order('check_date', { ascending: false }).limit(1).maybeSingle();
          if ((data?.streak ?? 0) >= 30 && await this.unlock(userId, 'streak_master')) return 'streak_master';
          break;
        }
        case 'tier_up': {
          const { data: profile } = await supabase.from('profiles').select('subscription_tier, tier').eq('id', userId).single();
          const tierKey = profile?.subscription_tier || profile?.tier || 'Free';
          const tierLevel = TIER_ORDER[tierKey] ?? 0;
          if (tierLevel >= 1 && await this.unlock(userId, 'tier_bronze')) return 'tier_bronze';
          if (tierLevel >= 2 && await this.unlock(userId, 'tier_silver')) return 'tier_silver';
          if (tierLevel >= 3 && await this.unlock(userId, 'tier_gold')) return 'tier_gold';
          if (tierLevel >= 4 && await this.unlock(userId, 'tier_vip')) return 'tier_vip';
          break;
        }
        case 'login': {
          // SP kontrolü
          const { data: profile } = await supabase.from('profiles').select('system_points').eq('id', userId).single();
          if (profile) {
            if ((profile.system_points ?? 0) >= 1000 && await this.unlock(userId, 'sp_collector')) return 'sp_collector';
            if ((profile.system_points ?? 0) >= 5000 && await this.unlock(userId, 'sp_master')) return 'sp_master';
            if ((profile.system_points ?? 0) >= 25000 && await this.unlock(userId, 'sp_legend')) return 'sp_legend';
          }
          // Gece kuşu
          const h = new Date().getHours();
          if (h >= 2 && h < 5 && await this.unlock(userId, 'night_owl')) return 'night_owl';
          break;
        }
        case 'referral': {
          try {
            const { count } = await supabase.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', userId);
            if ((count ?? 0) >= 10 && await this.unlock(userId, 'referral_king')) return 'referral_king';
          } catch {}
          break;
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[BadgeChecker] checkForAction error:', e);
    }
    return null;
  },

  /** Rozet ilerleme bilgisi */
  async getProgress(userId: string) {
    const { data } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const count = data?.length ?? 0;
    return getBadgeProgress(count);
  },
};
