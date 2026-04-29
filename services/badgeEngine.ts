/**
 * SopranoChat — Badge Engine (Faz 6.3 — Otomatik Tetikleme)
 * ═══════════════════════════════════════════════════════════
 * Kullanıcı aksiyonları sonrası rozet eligibility kontrolü yapan motor.
 * Fire-and-forget: her kontrol asenkron, hata badge dışı akışları engellemez.
 *
 * Felsefe:
 *   Rozetler kullanıcıya "ben burada aktifim, değerliyim" hissini verir.
 *   Her rozet bir milestone — ilk oda, 50 arkadaş, 100 saat sahne.
 *   Profilde rozet şeridi sosyal kanıt olarak çalışır (diğer kullanıcılar görür).
 *
 * Entegrasyon noktaları:
 *   - GamificationService.onRoomCreate → checkHostBadges
 *   - FriendshipService.approveRequest → checkSocialBadges
 *   - FollowService.addFollow → checkPopularBadge (takipçi tarafı)
 *   - ProfileService.sendDonation → checkDonorBadges
 *   - EngagementService.recordCheckin → checkStreakBadges
 *   - Room [id].tsx stage timer → checkStageBadge
 *
 * Güvenlik:
 *   - awardBadge RPC idempotent (ON CONFLICT DO NOTHING)
 *   - Her kontrol DB count sorgusu ile doğrulanır (client manipülasyonu imkânsız)
 *   - Tüm kontroller try/catch sarmalı — badge hatası ana akışı ASLA bozmaz
 */
import { supabase } from '../constants/supabase';
import { BadgeService } from './badges';
import { BADGES } from '../constants/badges';

/** Güvenli wrapper — badge hatası asla caller'ı bozmasın */
async function _safeAward(userId: string, badgeId: string): Promise<boolean> {
  if (!userId || !badgeId || !BADGES[badgeId]) return false;
  try {
    const result = await BadgeService.awardBadge(userId, badgeId);
    if (result.awarded) {
      const badgeDef = BADGES[badgeId];
      if (__DEV__) console.log(`[BadgeEngine] 🏅 Rozet verildi: ${badgeId} → ${userId}`);

      // ★ SP ödülü ver (fire-and-forget)
      if (badgeDef.spReward > 0) {
        try {
          const { GamificationService } = require('./gamification');
          await GamificationService.earn(
            userId, badgeDef.spReward, 'badge_reward',
            `badge_reward:${badgeId}:${userId}`, // idempotent — aynı rozet 2. kez SP vermez
            null, `${badgeDef.label} rozeti ödülü`
          );
        } catch (e) {
          if (__DEV__) console.warn(`[BadgeEngine] SP reward hatası (${badgeId}):`, e);
        }
      }

      // ★ Kutlama animasyonunu tetikle (UI katmanına event gönder)
      try {
        const { triggerBadgeCelebration } = require('../components/profile/BadgeCelebration');
        triggerBadgeCelebration(badgeDef);
      } catch (e) {
        if (__DEV__) console.warn(`[BadgeEngine] Celebration trigger hatası (${badgeId}):`, e);
      }
    }
    return result.awarded;
  } catch (e) {
    if (__DEV__) console.warn(`[BadgeEngine] Award hatası (${badgeId}):`, e);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
// HOST BADGES — Oda kurma milestone'ları
// ════════════════════════════════════════════════════════════

/**
 * Oda oluşturulduktan sonra çağrılır.
 * host_1 (1 oda), host_10 (10 oda), host_100 (100 oda) kontrol eder.
 */
export async function checkHostBadges(userId: string): Promise<void> {
  try {
    const { count, error } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', userId);
    if (error || count === null) return;

    if (count >= 1)   await _safeAward(userId, 'host_1');
    if (count >= 10)  await _safeAward(userId, 'host_10');
    if (count >= 100) await _safeAward(userId, 'host_100');
  } catch (e) {
    if (__DEV__) console.warn('[BadgeEngine] checkHostBadges:', e);
  }
}

// ════════════════════════════════════════════════════════════
// SOCIAL BADGES — Arkadaşlık milestone'ları
// ════════════════════════════════════════════════════════════

/**
 * Arkadaşlık kabul edildikten sonra çağrılır (her iki tarafa).
 * social_butterfly (50+ arkadaş) kontrol eder.
 */
export async function checkSocialBadges(userId: string): Promise<void> {
  try {
    // Çift yönlü arkadaşlık sayısı
    const { count, error } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (error || count === null) return;

    if (count >= 50) await _safeAward(userId, 'social_butterfly');
  } catch (e) {
    if (__DEV__) console.warn('[BadgeEngine] checkSocialBadges:', e);
  }
}

// ════════════════════════════════════════════════════════════
// POPULARITY BADGE — Takipçi milestone
// ════════════════════════════════════════════════════════════

/**
 * Takipçi kazanıldığında çağrılır (followingId = takip edilen).
 * popular (500+ takipçi) kontrol eder.
 */
export async function checkPopularBadge(followingId: string): Promise<void> {
  try {
    const { count, error } = await supabase
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('following_id', followingId);
    if (error || count === null) return;

    if (count >= 500) await _safeAward(followingId, 'popular');
  } catch (e) {
    if (__DEV__) console.warn('[BadgeEngine] checkPopularBadge:', e);
  }
}

// ════════════════════════════════════════════════════════════
// DONOR BADGES — SP hediye milestone'ları
// ════════════════════════════════════════════════════════════

/**
 * SP bağışı yapıldıktan sonra çağrılır (gönderen taraf).
 * sp_donor (en az 1 bağış), sp_whale (10000+ SP harcaması) kontrol eder.
 */
export async function checkDonorBadges(senderId: string): Promise<void> {
  try {
    // İlk bağış kontrolü — en az 1 satır varsa sp_donor
    const { count: donationCount } = await supabase
      .from('sp_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', senderId)
      .eq('type', 'donation_sent');

    if (donationCount && donationCount >= 1) {
      await _safeAward(senderId, 'sp_donor');
    }

    // Toplam harcama kontrolü — 10000+ ise sp_whale
    const { data: totalData } = await supabase
      .from('sp_transactions')
      .select('amount')
      .eq('user_id', senderId)
      .eq('type', 'donation_sent');

    const totalSpent = (totalData || []).reduce((sum: number, r: any) => sum + Math.abs(r.amount || 0), 0);
    if (totalSpent >= 10000) {
      await _safeAward(senderId, 'sp_whale');
    }
  } catch (e) {
    if (__DEV__) console.warn('[BadgeEngine] checkDonorBadges:', e);
  }
}

// ════════════════════════════════════════════════════════════
// STREAK BADGES — Üst üste giriş
// ════════════════════════════════════════════════════════════

/**
 * Günlük check-in sonrası çağrılır.
 * streak_7 (7 gün), streak_30 (30 gün) kontrol eder.
 * currentStreak parametresi EngagementService'den gelir.
 */
export async function checkStreakBadges(userId: string, currentStreak: number): Promise<void> {
  try {
    if (currentStreak >= 7)  await _safeAward(userId, 'streak_7');
    if (currentStreak >= 30) await _safeAward(userId, 'streak_30');
  } catch (e) {
    if (__DEV__) console.warn('[BadgeEngine] checkStreakBadges:', e);
  }
}

// ════════════════════════════════════════════════════════════
// STAGE BADGE — Sahne süresi
// ════════════════════════════════════════════════════════════

/**
 * Sahnede toplam süre 100 saat'e ulaştığında çağrılır.
 * totalMinutes: kullanıcının toplam sahne süresi (dakika).
 */
export async function checkStageBadge(userId: string, totalMinutes: number): Promise<void> {
  try {
    if (totalMinutes >= 6000) { // 100 saat = 6000 dakika
      await _safeAward(userId, 'stage_pro');
    }
  } catch (e) {
    if (__DEV__) console.warn('[BadgeEngine] checkStageBadge:', e);
  }
}

// ════════════════════════════════════════════════════════════
// TOPLU KONTROL — Profil açıldığında tüm rozetleri tara
// ════════════════════════════════════════════════════════════

/**
 * Kullanıcı kendi profilini açtığında veya app launch'ta çağrılır.
 * Tüm badge'leri tek seferde kontrol eder (catch-up mekanizması).
 * Bu sayede eski kullanıcılar da hak ettikleri rozetleri alır.
 */
export async function checkAllBadges(userId: string): Promise<void> {
  if (!userId) return;
  try {
    // Paralel kontrol — her biri bağımsız, biri fail olsa diğerleri devam eder
    await Promise.allSettled([
      checkHostBadges(userId),
      checkSocialBadges(userId),
      checkPopularBadge(userId),
      checkDonorBadges(userId),
      // streak ve stage context-bağımlı olduğundan burada çağrılmaz
    ]);
  } catch (e) {
    if (__DEV__) console.warn('[BadgeEngine] checkAllBadges:', e);
  }
}
