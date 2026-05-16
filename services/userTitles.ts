/**
 * SopranoChat — Kullanıcı Unvan Sistemi
 * ═══════════════════════════════════════════════════
 * Aktiviteye dayalı otomatik hesaplanan unvanlar.
 * En yüksek öncelikli unvan gösterilir.
 */
import { supabase } from '../constants/supabase';
import { i18n } from './i18n';

// ★ v284 (16 May 2026): Title name'leri i18n key'lerden runtime çözülür.
//   TITLE_DEFINITIONS'taki name fallback olarak TR string tutar; resolveTitleName()
//   ile UI render anında geçerli locale'e döner.
function resolveTitleName(id: string, fallback: string): string {
  const key = `title.${id}`;
  const translated = i18n.t(key);
  return translated === key ? fallback : translated;
}

export type UserTitle = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  priority: number; // Yüksek = daha prestijli
};

// ═══ Unvan Tanımları ═══
// ★ v90 (1 May 2026): 4 katmanlı bağış unvan sistemi eklendi (philanthropist > patron
//   > generous_soul > supporter). Mevcut generous_soul korundu (eşik 500 SP),
//   üstüne 100/2000/10000 eşikleri eklendi. Lifetime_sp_donated tabanlı
//   gerçek hesaplama (eski tahmin değil).
const TITLE_DEFINITIONS: Record<string, UserTitle> = {
  // ── Bağış unvanları (legendary > altın > yeşil > bronz piramidi) ──
  philanthropist: {
    id: 'philanthropist', name: 'Hayırsever', emoji: '💎',
    color: '#A78BFA', bgColor: 'rgba(167,139,250,0.18)', priority: 95,
  },
  patron: {
    id: 'patron', name: 'Hami', emoji: '🌟',
    color: '#FBBF24', bgColor: 'rgba(251,191,36,0.18)', priority: 88,
  },
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
  supporter: {
    id: 'supporter', name: 'Destekçi', emoji: '🤝',
    color: '#CD7F32', bgColor: 'rgba(205,127,50,0.18)', priority: 55,
  },
  rising_star: {
    id: 'rising_star', name: 'Yükselen Yıldız', emoji: '⭐',
    color: '#60A5FA', bgColor: 'rgba(96,165,250,0.12)', priority: 50,
  },
};

// ★ v90: Bağış miktarına göre kazanılan unvan id'sini döndür (en yüksek tier).
//   Lower-tier'lar görünmez — kullanıcı sadece "ulaştığı en yüksek seviye"yi
//   sergiler (Diğer unvan kategorileri ile çakışmaz, priority sıralı).
export function getDonationTierTitleId(lifetimeDonated: number): string | null {
  if (lifetimeDonated >= 10000) return 'philanthropist';
  if (lifetimeDonated >= 2000)  return 'patron';
  if (lifetimeDonated >= 500)   return 'generous_soul';
  if (lifetimeDonated >= 100)   return 'supporter';
  return null;
}

// ★ v90: Bir sonraki eşiğe ne kadar kaldı + hangi unvan (UI'da progress bar için)
export function getNextDonationTier(lifetimeDonated: number): { remaining: number; nextId: string; nextThreshold: number } | null {
  if (lifetimeDonated < 100)   return { remaining: 100 - lifetimeDonated, nextId: 'supporter', nextThreshold: 100 };
  if (lifetimeDonated < 500)   return { remaining: 500 - lifetimeDonated, nextId: 'generous_soul', nextThreshold: 500 };
  if (lifetimeDonated < 2000)  return { remaining: 2000 - lifetimeDonated, nextId: 'patron', nextThreshold: 2000 };
  if (lifetimeDonated < 10000) return { remaining: 10000 - lifetimeDonated, nextId: 'philanthropist', nextThreshold: 10000 };
  return null; // En yüksek tier ulaşıldı
}

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
        // ★ v90: Bağış count fetch'i kaldırıldı — lifetime_sp_donated kolonu
        //   profile fetch'inde geliyor (gerçek toplam, tahmin değil).
        // ★ SEC-PERF: Sahne süresi — sadece count
        supabase.from('sp_transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'stage_time'),
        // ★ v90: lifetime_sp_donated kolonu eklendi — bağış unvanları artık
        //   tahmin değil, gerçek toplam üzerinden kararlaştırılır.
        supabase.from('profiles')
          .select('system_points, check_in_streak, lifetime_sp_donated')
          .eq('id', userId)
          .single(),
      ]);

      const followers = followerCount || 0;
      const rooms = roomCount || 0;
      const profile = profileData || {};

      // ★ SEC-PERF: Tahmini değerler — count tabanlı (tam doğruluk gerekmiyor, unvan eşikleri)
      const totalEarned = (totalEarnedCount || 0) * 10; // Ortalama 10 SP/işlem tahmini
      const stageMinutes = (stageCount || 0) * 10;      // Her event = 10dk
      const streak = (profile as any)?.check_in_streak || 0;
      // ★ v90: Gerçek toplam bağış (DB kolonu, trigger ile her donate'te artar)
      const lifetimeDonated = (profile as any)?.lifetime_sp_donated || 0;

      // ═══ Unvan Koşulları ═══
      // Bağış unvanları — sadece en yüksek tier verilir (lower'lar gizlenir)
      const donorId = getDonationTierTitleId(lifetimeDonated);
      if (donorId && TITLE_DEFINITIONS[donorId]) titles.push(TITLE_DEFINITIONS[donorId]);

      // Diğer aktivite unvanları (paralel kazanım)
      if (rooms >= 10 && followers >= 20)   titles.push(TITLE_DEFINITIONS.community_leader);
      if (stageMinutes >= 500)              titles.push(TITLE_DEFINITIONS.stage_star);
      if (totalEarned >= 5000)              titles.push(TITLE_DEFINITIONS.sp_baron);
      if (followers >= 50)                  titles.push(TITLE_DEFINITIONS.social_butterfly);
      if (streak >= 7)                      titles.push(TITLE_DEFINITIONS.fireball);
      if (followers >= 10 || rooms >= 3)    titles.push(TITLE_DEFINITIONS.rising_star);

    } catch (err) {
      if (__DEV__) console.warn('[UserTitleService] Error:', err);
    }

    // Öncelik sırasına göre sırala + i18n ile isimleri çevir
    return titles
      .sort((a, b) => b.priority - a.priority)
      .map(t => ({ ...t, name: resolveTitleName(t.id, t.name) }));
  },

  /** Birincil (en prestijli) unvanı getir */
  async getPrimaryTitle(userId: string): Promise<UserTitle | null> {
    const titles = await this.getUserTitles(userId);
    return titles.length > 0 ? titles[0] : null;
  },

  /** Tüm unvan tanımlarını döndür (UI'da göstermek için) — i18n ile çevrilmiş */
  getAllDefinitions(): UserTitle[] {
    return Object.values(TITLE_DEFINITIONS)
      .sort((a, b) => b.priority - a.priority)
      .map(t => ({ ...t, name: resolveTitleName(t.id, t.name) }));
  },
};
