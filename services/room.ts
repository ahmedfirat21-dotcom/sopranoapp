/**
 * SopranoChat — Oda Servisi
 * ═══════════════════════════════════════════════════
 * Oda CRUD, katılım, heartbeat, zombie temizliği,
 * keşfet algoritması, boost, ban, erişim istekleri.
 * database.ts monolitinden ayrıştırıldı.
 */
import { supabase } from '../constants/supabase';
import { PushService } from './push';
// ★ ARCH-3 FIX: Circular dependency kırıldı — shared utility import
import { getBlockedUserIds } from './blocklist';
import { hashPassword as hashRoomPassword } from './roomAccess';
import { RateLimitService } from './rateLimit';
import { isSystemRoom } from './showcaseRooms';
import { getRoomLimits, isTierAtLeast } from '../constants/tiers';
import type {
  Profile, Room, RoomParticipant, RoomSettings,
  SubscriptionTier,
} from '../types';
import { migrateLegacyTier, normalizeRole } from '../types';
import { i18n } from './i18n';

/**
 * ★ 2026-04-27: Geçici host tespiti.
 *   Oda asıl sahibi room_settings.original_host_id'de saklanır (yaratılışta set edilir).
 *   Asıl sahip çıkıp transfer_host_atomic devraldığında rooms.host_id = yeni temp host olur.
 *   Geçici host: aktif host_id'yi taşıyor ama asıl sahip değil.
 *
 * Bu helper UI'da kritik ayarları gizlemek + service guard'ları için kullanılır.
 */
export function isTempHostUser(
  room: { host_id: string; room_settings?: any } | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!room || !userId) return false;
  const orig = (room.room_settings || {}).original_host_id as string | undefined;
  if (!orig) return false;
  return room.host_id === userId && orig !== userId;
}

/** Asıl sahip dışarıda mı? (geçici host devir aldı) */
export function isOriginalHostAway(room: { host_id: string; room_settings?: any } | null | undefined): boolean {
  if (!room) return false;
  const orig = (room.room_settings || {}).original_host_id as string | undefined;
  return !!orig && orig !== room.host_id;
}

// ★ v308 (18 May 2026): Asıl sahip override helper — geçici host transfer'i olan
//   odalarda UI'da "sahip" görünmesi gereken kişi original_host_id profilidir.
//   getLive, getMyRooms ve diğer host join'i kullanan kritik endpoint'lerde kullanılır.
//   FIRAT (host_id) yerine Burak DENİZ (original_host_id) avatar/display_name görünür.
// ★ v309: export — diğer servisler de kullanabilsin (RoomFollowService gibi).
export async function applyOriginalHostOverride<T extends Room>(rooms: T[]): Promise<T[]> {
  const transferred = rooms.filter(r => {
    const orig = (r.room_settings as any)?.original_host_id as string | undefined;
    return !!orig && orig !== r.host_id;
  });
  if (transferred.length === 0) return rooms;
  const origIds = Array.from(new Set(transferred.map(r => (r.room_settings as any).original_host_id as string)));
  const { data: origHosts } = await supabase.from('profiles').select('*').in('id', origIds);
  const origMap = new Map((origHosts || []).map((h: any) => [h.id, h]));
  for (const r of transferred) {
    const orig = origMap.get((r.room_settings as any).original_host_id);
    if (orig) (r as any).host = orig;
  }
  return rooms;
}

// ★ D2 FIX: Yetki kontrol yardımcısı — owner veya moderator olmalı
async function _requireRole(
  roomId: string,
  executorId: string,
  allowedRoles: string[] = ['owner', 'moderator'],
): Promise<void> {
  const { data } = await supabase
    .from('room_participants')
    .select('role')
    .eq('room_id', roomId)
    .eq('user_id', executorId)
    .maybeSingle();
  if (!data || !allowedRoles.includes(data.role)) {
    throw new Error(i18n.t('auto.room.043'));
  }
}

// ============================================
// FAZ 4.3 — Tag enrichment helper
// ============================================
// Listelenen odalara tek sorguyla `tags?: string[]` enjekte et.
async function enrichRoomsWithTags<T extends { id: string }>(rooms: T[]): Promise<T[]> {
  if (rooms.length === 0) return rooms;
  try {
    const ids = rooms.map(r => r.id);
    const { data, error } = await supabase
      .from('room_tags')
      .select('room_id, tag, created_at')
      .in('room_id', ids)
      .order('created_at', { ascending: true });
    if (error || !data) return rooms;
    const map: Record<string, string[]> = {};
    for (const row of data as any[]) {
      if (!map[row.room_id]) map[row.room_id] = [];
      if (map[row.room_id].length < 3) map[row.room_id].push(row.tag);
    }
    return rooms.map(r => ({ ...r, tags: map[r.id] || [] }));
  } catch {
    return rooms;
  }
}

// ============================================
// FAZ 4.2 — TRENDING SKOR (pure, IMMUTABLE)
// ============================================
// SQL tarafındaki public.room_trending_score(...) fonksiyonunun TS karşılığı.
// İki taraf tutarlı kalsın diye formül ortak: (listener*10 + gifts*5) / ln(age+2) * boost_mul.
const TRENDING_BOOST_MULT = 1.5;
function trendingScoreOf(r: Room): number {
  const listeners = r.listener_count || 0;
  const gifts = (r as any).total_gifts || 0;
  const createdAt = r.created_at ? new Date(r.created_at).getTime() : Date.now();
  const ageMin = Math.max((Date.now() - createdAt) / 60_000, 0);
  const boostExp = (r as any).boost_expires_at;
  const boostActive = !!(boostExp && new Date(boostExp).getTime() > Date.now());
  const denom = Math.max(Math.log(ageMin + 2), 1);
  const base = (listeners * 10 + gifts * 5) / denom;
  return base * (boostActive ? TRENDING_BOOST_MULT : 1);
}

// ============================================
// ODA İŞLEMLERİ
// ============================================
export const RoomService = {
  /**
   * ★ 2026-04-26: Tier yükseltilince mevcut odaların expires_at'ı yeni tier'a göre yeniden hesaplanır.
   *   Pro/GodMaster (durationHours=0) → expires_at NULL (sınırsız).
   *   Plus → şu andan 12 saat sonrasına ayarlanır (yeni süre).
   *   Free'e düşürmede expires_at değiştirmez (kullanıcı mağdur olmasın, mevcut odalar süreli kalır).
   */
  async refreshExpiresForTierChange(hostId: string, newTier: SubscriptionTier): Promise<void> {
    const limits = getRoomLimits(newTier);
    // ★ v1.7.13.142: Free downgrade'de de expires_at güncelle — eski Pro odaları 7/24 kalmasın
    let newExpiresAt: string | null;
    if (newTier === 'Free') {
      // Free'e düşen kullanıcının canlı odalarına 3 saat kalan süre ver
      newExpiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    } else {
      newExpiresAt = limits.durationHours > 0
        ? new Date(Date.now() + limits.durationHours * 60 * 60 * 1000).toISOString()
        : null;
    }
    await supabase
      .from('rooms')
      .update({ expires_at: newExpiresAt, owner_tier: newTier })
      .eq('host_id', hostId)
      .eq('is_live', true);
  },

  /**
   * ★ 2026-04-23: Host'un diğer canlı odalarını dondur — tek anda tek aktif oda kuralı.
   * wakeUpRoom ve create'in başında çağrılır. Excluded roomId dışındaki tüm is_live=true
   * odaları bulur, her birinin kalan süresini remaining_ms'e yazar, is_live=false yapar,
   * katılımcıları temizler. freezeRoom'un toplu versiyonu — ama tek tek update atmak
   * yerine tek sorguda filter + update.
   */
  async _freezeOtherLiveRooms(hostId: string, exceptRoomId?: string): Promise<void> {
    let q = supabase
      .from('rooms')
      .select('id, expires_at, room_settings')
      .eq('host_id', hostId)
      .eq('is_live', true);
    if (exceptRoomId) q = q.neq('id', exceptRoomId);
    const { data: others } = await q;
    if (!others || others.length === 0) return;

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    // Her oda için kalan süreyi hesaplayıp settings'e yaz + is_live=false
    for (const other of others) {
      const remainMs = (other as any).expires_at
        ? Math.max(0, new Date((other as any).expires_at).getTime() - nowMs)
        : undefined;
      const mergedSettings: any = { ...((other as any).room_settings || {}) };
      // ★ v309 (18 May 2026) KRİTİK BUG FIX: original_host_id YALNIZCA boşsa atanır.
      //   Eskiden her freeze'de bu satır overwrite yapıyordu — eğer host_id geçici
      //   host'a transfer edilmişse, freeze sırasında original_host_id GEÇİCİ HOST'A
      //   yazılıyordu → ASIL SAHİP DB'DEN KAYBOLUYORDU. Çoklu transfer + freeze ile
      //   asıl sahip silsile şeklinde yanlış değişiyordu. Şimdi sadece ilk freeze
      //   (veya yaratımda set edilmediyse) atanır, asıl sahip korunur.
      if (!mergedSettings.original_host_id) {
        mergedSettings.original_host_id = hostId;
      }
      mergedSettings.frozen_at = nowIso;
      if (remainMs !== undefined) mergedSettings.remaining_ms = remainMs;

      await supabase
        .from('rooms')
        .update({ is_live: false, listener_count: 0, expires_at: null, room_settings: mergedSettings })
        .eq('id', (other as any).id);

      // Katılımcıları temizle — eski session'dan stale user'lar kalmasın
      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', (other as any).id);
    }
  },


  /**
   * ★ 2026-04-22: Hızlı oda oluşturma — FAB action sheet + empty state chip'ler için.
   * Varsayılan isim + category + type='open' ile tek adımda açar.
   * İsim şablonu: kategori varsa "{displayName} — {kategoriEtiket}", yoksa "{displayName}'in Odası".
   */
  async quickCreate(
    hostId: string,
    displayName: string,
    category: string | undefined,
    tier: SubscriptionTier = 'Free'
  ): Promise<Room> {
    const catLabel = (() => {
      switch (category) {
        case 'chat': return i18n.t('auto.room.042');
        case 'music': return i18n.t('auto.room.041');
        case 'game': return i18n.t('auto.room.040');
        case 'tech': return 'Teknik Oda';
        case 'book': return i18n.t('auto.room.039');
        case 'film': return i18n.t('auto.room.038');
        default: return null;
      }
    })();
    const cleanName = (displayName || i18n.t('auto.room.037')).trim().split(/\s+/)[0] || i18n.t('auto.room.036');
    const name = catLabel
      ? `${cleanName} — ${catLabel}`
      : i18n.t('auto.room.035', { 0: cleanName });
    return this.create(hostId, { name, category: category || 'chat', type: 'open' }, tier);
  },

  /**
   * ★ Günlük oda açma limiti kontrolü — kullanıcı bugün limitini doldurmuş mu?
   * Pro/admin için 999 = limitsiz, hiç kontrol yapmadan true döner.
   * Create-room sayfasına navigate etmeden önce çağrılır.
   */
  async canCreateToday(userId: string, tier: SubscriptionTier): Promise<{ ok: boolean; count: number; limit: number }> {
    const limits = getRoomLimits(tier);
    if (limits.dailyRooms >= 999) return { ok: true, count: 0, limit: 999 };
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // ★ v110.14: room_creation_log'tan say — oda silinince row gitse bile log kalır
    //   (eski 'rooms' COUNT kullanımı exploit'e açıktı: kullanıcı silince limit yenilenirdi).
    const { count } = await supabase
      .from('room_creation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString());
    const today = count || 0;
    return { ok: today < limits.dailyRooms, count: today, limit: limits.dailyRooms };
  },

  /** Tekil oda getir */
  async get(roomId: string): Promise<Room> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('id', roomId)
      .single();
    if (error) throw error;
    // ★ v308 (18 May 2026): Asıl sahip override — odaya girince UI'da host avatar/isim
    //   asıl sahip görünür (geçici host transfer olmuş odalar için).
    const [overridden] = await applyOriginalHostOverride([data as Room]);
    return overridden;
  },

  /**
   * ★ Keşfet — Model A: Freemium Görünürlük
   * Tüm canlı odalar listelenir, sıralama 3 katmanlı:
   *   Katman 1: 🔥 ÖNE ÇIKAN — aktif boost'lu odalar (SP ile satın alınır)
   *   Katman 2: ⭐ TREND — 5+ dinleyici veya hediye almış odalar (organik)
   *   Katman 3: 📋 DİĞER — geri kalan tüm odalar (yeni açılanlar dahil)
   *
   * Her katman içinde: listener_count → created_at sıralaması
   * Kategori tercihi: boost dışı odalarda tercih edilen kategoriler öne çıkar
   *
   * @param userId Kategori tercihi sorgulamak için (optional)
   */
  async getLive(userId?: string): Promise<Room[]> {
    const now = new Date().toISOString();
    // ★ 2026-04-20: expires_at filtresi — süresi dolmuş odalar keşfette görünmesin
    // (autoCloseExpired henüz çalışmamış olabilir; query seviyesinde de filtre)
    // ★ v1.7.13.100 (20 May 2026): room_participants(count) embedded — listener_count
    //   stale olsa bile UI gerçek participant sayısını gösterir (trigger gecikme bypass).
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*), room_participants(count)')
      .eq('is_live', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('listener_count', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    let rooms = (data || []) as Room[];

    // ★ v307→v308 (18 May 2026): Asıl sahip override — helper'a refactor edildi
    //   (getMyRooms ile aynı pattern, kod tekrarı önlendi).
    rooms = await applyOriginalHostOverride(rooms);

    const TRENDING_THRESHOLD = 5; // 5+ dinleyici = trending tier eşiği

    // ★ Model A: 3 katmanlı sıralama
    const isBoosted = (r: Room) => (r as any).boost_expires_at && (r as any).boost_expires_at > now;
    const isTrending = (r: Room) => (r.listener_count || 0) >= TRENDING_THRESHOLD || ((r as any).total_gifts || 0) > 0;

    // ★ 2026-04-25: Faz 4.2 — Trending tier içinde gerçek skor sıralaması.
    //   Eski: listener_count DESC + boost_score → durağan; saatlik 8 dinleyici 5 dakikalık 7 dinleyiciyi yenerdi.
    //   Yeni: room_trending_score (SQL pure fonksiyonun TS karşılığı) — taze + popüler kombinasyon.
    const trendingScore = trendingScoreOf;

    // Boosted/Others için eski katman içi sıralama (boost_score → listener → created_at)
    const sortLegacy = (a: Room, b: Room) => {
      const aBoost = (a as any).boost_score || 0;
      const bBoost = (b as any).boost_score || 0;
      if (aBoost !== bBoost) return bBoost - aBoost;
      const aListeners = a.listener_count || 0;
      const bListeners = b.listener_count || 0;
      if (aListeners !== bListeners) return bListeners - aListeners;
      return (b.created_at || '').localeCompare(a.created_at || '');
    };

    // Trending katmanı: skor DESC → tie-break'te boost_score → created_at
    const sortByScore = (a: Room, b: Room) => {
      const aScore = trendingScore(a);
      const bScore = trendingScore(b);
      if (aScore !== bScore) return bScore - aScore;
      return (b.created_at || '').localeCompare(a.created_at || '');
    };

    const boosted = rooms.filter(isBoosted).sort(sortLegacy);
    let trending = rooms.filter(r => !isBoosted(r) && isTrending(r)).sort(sortByScore);
    let others = rooms.filter(r => !isBoosted(r) && !isTrending(r)).sort(sortLegacy);

    // Kullanıcı kategori tercihi: trending ve others içinde tercih edilen kategorileri öne al
    if (userId && (trending.length + others.length) > 1) {
      const prefs = await this._getUserCategoryPreferences(userId);
      if (prefs.length > 0) {
        const prefSet = new Set(prefs.map(p => p.category));
        const sortByPref = (arr: Room[]) => {
          const preferred = arr.filter(r => prefSet.has(r.category));
          const rest = arr.filter(r => !prefSet.has(r.category));
          return [...preferred, ...rest];
        };
        trending = sortByPref(trending);
        others = sortByPref(others);
      }
    }

    rooms = [...boosted, ...trending, ...others];

    // ★ FIX: Geçersiz zombie odaları filtrele — katılımcısı 0 + aktif boost'u olmayan + keep_alive olmayan
    // ★ SEC-ZOMBIE: Side-effect kaldırıldı — closeRoom() çağrısı getLive() read fonksiyonundan çıkarıldı
    // Zombie temizliği artık SADECE autoCloseExpired() interval'ında yapılır (write-only fonksiyon)
    rooms = rooms.filter(r => {
      if ((r.listener_count || 0) > 0) return true; // Katılımcısı var
      // Boost aktifse göster (sponsorlu oda)
      if ((r as any).boost_expires_at && (r as any).boost_expires_at > now) return true;
      // keep_alive (Plus/Pro persistent) oda — göster
      if ((r as any).is_persistent) return true;
      // Yeni açılmış (son 2 dk) — göster (henüz kimse girmemiş olabilir)
      if (r.created_at && (Date.now() - new Date(r.created_at).getTime()) < 120_000) return true;
      // Zombie — sadece gizle (temizlik autoCloseExpired'a bırakıldı)
      return false;
    });

    // Gizli profil filtreleme — is_private kullanıcıların odalarını yalnızca takipçilere göster
    if (userId) {
      rooms = await this._filterPrivateRooms(rooms, userId);
    }

    // ★ SEC-BLOCK: Engellenen kullanıcıların odalarını filtrele
    if (userId) {
      try {
        const blockedIds = await getBlockedUserIds(userId);
        if (blockedIds.size > 0) {
          const blockedSet = new Set(blockedIds);
          rooms = rooms.filter(r => !blockedSet.has(r.host_id));
        }
      } catch { /* blocklist servisi yoksa sessiz devam */ }
    }

    // ★ Faz 4.3 — etiketleri enjekte et (tek toplu sorgu)
    rooms = await enrichRoomsWithTags(rooms);

    return rooms;
  },

  /**
   * ★ 2026-04-25: Faz 4.2 — Top-N trending odalar.
   * "🔥 Trend" carousel widget'ı için. RPC önce dener, başarısızsa
   * client-side getLive() + skor sıralaması fallback'i.
   * Block + private filtreleme client-side yapılır (RPC saf veri döner).
   *
   * @param userId  Block/private filtreleme için (optional)
   * @param limit   Dönecek oda sayısı (default 10, max 50)
   */
  async getTrending(userId?: string, limit: number = 10): Promise<Room[]> {
    const safeLimit = Math.max(1, Math.min(limit, 50));

    // Önce RPC dene — sıralama DB tarafında, hızlı
    try {
      const { data: scoreRows, error: rpcErr } = await supabase
        .rpc('get_trending_rooms', { p_limit: safeLimit * 3 }); // block sonrası filtreyle azalsa diye 3x al
      if (!rpcErr && Array.isArray(scoreRows) && scoreRows.length > 0) {
        const ids = scoreRows.map((r: any) => r.room_id).filter(Boolean);
        if (ids.length > 0) {
          const { data: roomsData } = await supabase
            .from('rooms')
            .select('*, host:profiles!host_id(*)')
            .in('id', ids);
          if (roomsData) {
            // ★ v308: Trending listesi için de asıl sahip override
            await applyOriginalHostOverride(roomsData as Room[]);
            // RPC sıra korunsun — id → score map ile yeniden sırala
            const scoreMap = new Map<string, number>(scoreRows.map((r: any) => [r.room_id, Number(r.trending_score) || 0]));
            let result = (roomsData as Room[])
              .sort((a, b) => (scoreMap.get(b.id) || 0) - (scoreMap.get(a.id) || 0));

            // Block + private filtreleri
            if (userId) {
              result = await this._filterPrivateRooms(result, userId);
              try {
                const blocked = await getBlockedUserIds(userId);
                if (blocked.size > 0) result = result.filter(r => !blocked.has(r.host_id));
              } catch {}
            }
            // ★ Faz 4.3 — etiketleri enjekte et
            result = await enrichRoomsWithTags(result);
            return result.slice(0, safeLimit);
          }
        }
      }
    } catch { /* RPC yoksa fallback'e düş */ }

    // Fallback — getLive (zaten skor sıralı) ilk N
    const live = await this.getLive(userId);
    return live
      .filter(r => (r.listener_count || 0) > 0 || ((r as any).total_gifts || 0) > 0)
      .sort((a, b) => trendingScoreOf(b) - trendingScoreOf(a))
      .slice(0, safeLimit);
  },

  /** Kullanıcının kategori tercihlerini getir */
  async _getUserCategoryPreferences(userId: string): Promise<{ category: string; score: number }[]> {
    try {
      const { data, error } = await supabase
        .from('user_category_preferences')
        .select('category, follow_score, visit_count')
        .eq('user_id', userId)
        .order('follow_score', { ascending: false })
        .order('visit_count', { ascending: false })
        .limit(10);
      if (error) return [];
      return (data || []).map(d => ({
        category: d.category,
        score: (d.follow_score || 0) + (d.visit_count || 0),
      }));
    } catch {
      return []; // Tablo yoksa sessizce devam et
    }
  },

  /** Kullanıcının oda kategorisi ziyaretini kaydet */
  async trackCategoryVisit(userId: string, category: string): Promise<void> {
    try {
      await supabase.rpc('increment_category_visit', {
        p_user_id: userId,
        p_category: category,
      });
    } catch {
      // RPC yoksa fallback: upsert
      try {
        const { data } = await supabase
          .from('user_category_preferences')
          .select('visit_count')
          .eq('user_id', userId)
          .eq('category', category)
          .maybeSingle();
        if (data) {
          await supabase
            .from('user_category_preferences')
            .update({ visit_count: (data.visit_count || 0) + 1, last_visited_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('category', category);
        } else {
          await supabase
            .from('user_category_preferences')
            .insert({ user_id: userId, category, visit_count: 1, follow_score: 0, last_visited_at: new Date().toISOString() });
        }
      } catch { /* tablo yoksa sessiz */ }
    }
  },

  /**
   * Gizli profil odaları filtrele
   * ★ BUG-F7 FIX: N+1 sorgu → toplu sorgu ile değiştirildi
   */
  async _filterPrivateRooms(rooms: Room[], viewerId: string): Promise<Room[]> {
    if (!rooms.length) return rooms;

    // Gizli profil host'larını topla
    const privateHostIds = rooms
      .filter(room => room.host && (room.host as any).is_private)
      .map(room => room.host_id);

    // Gizli host yoksa doğrudan dön
    if (privateHostIds.length === 0) return rooms;

    const uniqueHostIds = [...new Set(privateHostIds)];

    // ★ 2026-04-26 FIX: Bidirectional friendship — herhangi bir yönde accepted yeterli
    //   Önceki sorgu sadece viewer→host yönüne bakıyordu; host→viewer accepted'larda
    //   gizli profil odası gözükmüyordu. Facebook tarzı: iki yönde de tara.
    const filter = uniqueHostIds.map(h => `and(user_id.eq.${viewerId},friend_id.eq.${h}),and(user_id.eq.${h},friend_id.eq.${viewerId})`).join(',');
    const { data: followData } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(filter)
      .eq('status', 'accepted');

    const friendHostIds = new Set<string>();
    (followData || []).forEach((r: any) => {
      // Hangi yöndeyse, viewer olmayan tarafı arkadaş kabul et
      if (r.user_id === viewerId) friendHostIds.add(r.friend_id);
      else if (r.friend_id === viewerId) friendHostIds.add(r.user_id);
    });

    return rooms.filter(room => {
      // Public oda → göster
      if (!room.host || !(room.host as any).is_private) return true;
      // Kendi odam → göster
      if (room.host_id === viewerId) return true;
      // Gizli profil oda → arkadaşımsa göster (çift yönlü)
      return friendHostIds.has(room.host_id);
    });
  },

  /**
   * ★ Heartbeat — Katılımcının hâlâ aktif olduğunu bildir.
   * room_participants tablosunda last_seen_at günceller.
   */
  /** ★ v1.7.13.96 (20 May 2026): UPDATE → UPSERT auto-resurrect.
   *  Eski: heartbeat sadece UPDATE → cleanup_ghost_participants kullanıcıyı silmişse
   *  0 row affected, sessiz fail. Minimize bar duruyor ama DB'de kayıt yok →
   *  listener_count=0 görünüyordu. Şimdi: kayıt yoksa otomatik yeniden eklenir
   *  (listener role default). RoomService.join role hesaplaması yapmadığı için
   *  UPSERT sırasında role mevcutsa korunur, yoksa 'listener' default.
   *  Uyarı: bu fonksiyon role belirleme yapmaz — banned/blocked kontrolü join'de. */
  async heartbeat(roomId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) {
      // Mevcut kayıt — sadece last_seen update (role'e dokunma)
      await supabase
        .from('room_participants')
        .update({ last_seen_at: now })
        .eq('room_id', roomId)
        .eq('user_id', userId);
    } else {
      // Kayıt yok — auto-resurrect olarak listener ekle
      await supabase.from('room_participants').insert({
        room_id: roomId,
        user_id: userId,
        role: 'listener',
        is_muted: false,
        last_seen_at: now,
      });
    }
  },

  /**
   * ★ 2026-04-21: Keşfet avatar stack — verilen oda ID'leri için her odada
   *   en üstteki N katılımcı avatarını toplu getir. Priority: moderator > speaker > listener.
   *   ★ 2026-04-21 (güncel): OWNER (host) filtrelendi — kart solunda zaten büyük avatarla
   *   gösteriliyor, stack'te tekrar göstermek kafa karıştırıyordu.
   */
  async getTopParticipants(roomIds: string[], limitPerRoom: number = 4): Promise<Record<string, { avatar_url: string | null; display_name: string | null }[]>> {
    if (roomIds.length === 0) return {};
    const roleOrder: Record<string, number> = { moderator: 0, speaker: 1, listener: 2, spectator: 3 };
    const { data, error } = await supabase
      .from('room_participants')
      .select('room_id, role, user:profiles!user_id(avatar_url, display_name)')
      .in('room_id', roomIds)
      .neq('role', 'owner'); // Host stack'te gösterilmez — zaten kartta büyük avatar
    if (error) return {};
    const grouped: Record<string, { role: string; avatar_url: string | null; display_name: string | null }[]> = {};
    (data || []).forEach((row: any) => {
      const rid = row.room_id;
      if (!grouped[rid]) grouped[rid] = [];
      grouped[rid].push({
        role: row.role,
        avatar_url: row.user?.avatar_url ?? null,
        display_name: row.user?.display_name ?? null,
      });
    });
    // Her odayı role'e göre sırala ve limit uygula
    const result: Record<string, { avatar_url: string | null; display_name: string | null }[]> = {};
    for (const rid of Object.keys(grouped)) {
      const sorted = grouped[rid]
        .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))
        .slice(0, limitPerRoom)
        .map(({ avatar_url, display_name }) => ({ avatar_url, display_name }));
      result[rid] = sorted;
    }
    return result;
  },

  /**
   * ★ Zombie Temizliği — 120 saniyeden uzun süredir heartbeat göndermeyen
   * katılımcıları otomatik çıkarır.
   * Y8: v21 atomic RPC — delete + listener_count sync + auto-close tek transaction.
   */
  async cleanupZombies(roomId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('cleanup_room_zombies_atomic', { p_room_id: roomId });
      if (!error) return;
      // ★ RPC yoksa sessiz fallback — konsol kirliliği önlenir
    } catch { /* fall through */ }

    // Fallback — v21 migrate edilmediyse eski yol
    const cutoff = new Date(Date.now() - 120_000).toISOString();
    try {
      const { data: zombies } = await supabase
        .from('room_participants')
        .select('id')
        .eq('room_id', roomId)
        .lt('last_seen_at', cutoff);
      if (zombies && zombies.length > 0) {
        await supabase
          .from('room_participants')
          .delete()
          .eq('room_id', roomId)
          .lt('last_seen_at', cutoff);
        await this.syncListenerCount(roomId);
        await this._autoCloseIfEmpty(roomId);
      }
    } catch { /* last_seen_at kolonu yoksa sessiz geç */ }
  },

  /**
   * ★ Listener Count Sync — Gerçek katılımcı sayısını
   * rooms tablosundaki listener_count ile eşitle.
   */
  async syncListenerCount(roomId: string): Promise<void> {
    try {
      const { count } = await supabase
        .from('room_participants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId);
      await supabase
        .from('rooms')
        .update({ listener_count: count || 0 })
        .eq('id', roomId);
    } catch { /* sessiz */ }
  },

  /**
   * ★ Kullanıcının sahip olduğu odaları getir (Odalarım sekmesi)
   */
  async getMyRooms(userId: string): Promise<Room[]> {
    // ★ v298 (17 May 2026) FIX: Geçici host bug'ı — kullanıcı başka birinin
    //   odasında geçici host olunca `host_id` ona geçer ama `original_host_id`
    //   asıl sahibi tutar. Eski query `eq('host_id', userId)` geçici host'a da
    //   "senin oda" gibi gösteriyordu (kullanıcı sildiğinde "yetki yok" hatası).
    //   Yeni query: SADECE asıl sahibi user olan odalar döner.
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .or(`host_id.eq.${userId},room_settings->>original_host_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Client-side guard: orijinal sahip kontrolü
    const ownedRooms = (data || []).filter((r: any) => {
      const orig = r.room_settings?.original_host_id as string | undefined;
      if (orig) return orig === userId; // Yeni odalar: original_host_id var
      return r.host_id === userId;       // Legacy odalar: original_host_id yok
    }) as Room[];

    // ★ v308 (18 May 2026): Avatar override — host_id geçici hosta transfer edilmişse,
    //   "Odalarım"daki kart avatar'ı ASIL SAHİBİ göstermeli (FIRAT yerine Burak DENİZ).
    //   Aynı fix getLive'de var (keşfet); getMyRooms'da da gerek.
    return await applyOriginalHostOverride(ownedRooms);
  },

  /** Uyuyan odayı uyandır.
   *  ★ 2026-04-22 FIX v2: room_settings.remaining_ms varsa → expires_at = now + remaining_ms.
   *  (Pasif hâldeyken saat durdurulmuş, kalan süre JSONB'ye donduruldu.)
   *  - remaining_ms yoksa → tier-based fresh süre
   *  - Pro (sınırsız): expires_at null kalır */
  async wakeUpRoom(roomId: string, hostId: string, tier: SubscriptionTier = 'Free'): Promise<Room> {
    // ★ v1.7.13.134: Tier'ı client param'a güvenmek yerine DB'den fresh çek.
    //   Senaryo: Pro user persistent dondurdu → Plus'a düştü → wakeUp yapıyor.
    //   Eski client'tan gelen `tier='Pro'` stale → CURRENT tier'a göre süre hesaplanmalı.
    const { data: freshProfile } = await supabase
      .from('profiles').select('is_admin, subscription_tier').eq('id', hostId).maybeSingle();
    const freshTier: SubscriptionTier = freshProfile?.is_admin
      ? 'Pro'
      : migrateLegacyTier(freshProfile?.subscription_tier || tier);
    const limits = getRoomLimits(freshTier);
    const now = new Date();

    // ★ v309 (18 May 2026): ASIL SAHİP AUTO-RECLAIM — kullanıcı geçici host transfer'i
    //   olmuş odanın asıl sahibi ise, host_id'yi otomatik kendisine geri al.
    //   Senaryo: Burak DENİZ odayı açtı → çıktı → FIRAT temp host oldu →
    //   Burak DENİZ tekrar girince host_id hâlâ FIRAT, wakeUp UPDATE 0 row yapardı.
    //   Şimdi: asıl sahip wakeUp denerse host_id kendisine reset edilir.
    const { data: roomMeta } = await supabase
      .from('rooms')
      .select('host_id, room_settings')
      .eq('id', roomId)
      .maybeSingle();
    const origHostId = (roomMeta?.room_settings as any)?.original_host_id;
    if (origHostId === hostId && roomMeta?.host_id !== hostId) {
      // ★ v1.7.13.22 (19 May 2026): Asıl sahip reclaim — RLS bypass için
      //   SECURITY DEFINER RPC kullan. Eski direct UPDATE RLS tarafından
      //   reddediliyordu (host_id farklı kişi → "Bu odayı uyandırma yetkiniz
      //   yok" hatası, Burak kendi odasını uyandıramıyordu).
      try {
        await supabase.rpc('reclaim_room_as_original_host', {
          p_room_id: roomId,
          p_user_id: hostId,
        });
      } catch (e) {
        if (__DEV__) console.warn('[wakeUpRoom] reclaim RPC fail:', (e as any)?.message);
      }
    }

    // ★ 2026-04-23 KRİTİK FIX: Host'un diğer canlı odalarını dondur — aynı anda birden
    //   fazla odada host olamaz. Kullanıcı birden çok odayı uyandırdığında hepsinde
    //   "CANLI • 1 (host)" görünüyordu; önce diğerlerini pasife çek.
    await this._freezeOtherLiveRooms(hostId, roomId);

    const { data: existing } = await supabase
      .from('rooms')
      .select('room_settings')
      .eq('id', roomId)
      .maybeSingle();
    const settings: any = { ...((existing?.room_settings as any) || {}) };
    const frozenRemaining = typeof settings.remaining_ms === 'number' ? settings.remaining_ms : null;

    let newExpiresAt: string | null = null;
    if (frozenRemaining !== null && frozenRemaining > 0) {
      // Dondurulmuş süre var → ona göre devam
      newExpiresAt = new Date(now.getTime() + frozenRemaining).toISOString();
    } else if (limits.durationHours > 0) {
      // Süre yok/bitti → tier'a göre fresh
      newExpiresAt = new Date(now.getTime() + limits.durationHours * 60 * 60 * 1000).toISOString();
    } else {
      // Pro: sınırsız → expires_at null
      newExpiresAt = null;
    }

    // remaining_ms'i temizle — uyandı, artık aktif takip ediliyor
    delete settings.remaining_ms;
    delete settings.frozen_at;

    const updatePayload: any = {
      is_live: true,
      created_at: now.toISOString(),
      expires_at: newExpiresAt,
      room_settings: settings,
    };

    // ★ v305 (18 May 2026): .single() → .maybeSingle() — UPDATE 0 satır etkilerse
    //   (host_id mismatch / RLS bloke / temp_host_protection trigger) net hata.
    //   Eskiden PostgREST "Cannot coerce the result to a single JSON object"
    //   atıyordu, kullanıcı hiçbir şey anlamıyordu. Tipik senaryo: kullanıcı
    //   başka birinin odasına geçici host olmuş, "Odalarım"da görünüyor ama
    //   wakeUp UPDATE'i host_id mismatch yüzünden 0 satır etkiliyor.
    const { data, error } = await supabase
      .from('rooms')
      .update(updatePayload)
      .eq('id', roomId)
      .eq('host_id', hostId)
      .select('*, host:profiles!host_id(*)')
      .maybeSingle();

    if (error) throw new Error(i18n.t('auto.room.034') + error.message);
    if (!data) {
      // UPDATE 0 row → host_id eşleşmiyor. Kullanıcı bu odanın asıl sahibi değil.
      throw new Error('Bu odayı uyandırma yetkiniz yok. Asıl sahibi değilsin ya da yetkin kaldırılmış olabilir. Ana sayfadan yeni bir oda oluşturabilirsin.');
    }

    // ★ 2026-04-29 v85: Host'un MEVCUT role'unu koru — sahneden inmiş listener ise
    //   wakeUp sonrası otomatik sahneye geri yükseltmeyelim. Sadece kayıt yoksa 'owner'.
    //   Eskiden upsert role:'owner' override ediyor → host audience'a inip minimize+restore
    //   sonrası kendini sahnede buluyordu. Şimdi mevcut role korunur.
    try {
      const { data: existingPart } = await supabase
        .from('room_participants')
        .select('role')
        .eq('room_id', roomId)
        .eq('user_id', hostId)
        .maybeSingle();
      const finalRole = (existingPart?.role && ['owner', 'moderator', 'speaker', 'listener', 'spectator'].includes(existingPart.role))
        ? existingPart.role
        : 'owner'; // İlk wakeUp veya kayıt yoksa default owner
      await supabase.from('room_participants').upsert({
        room_id: roomId,
        user_id: hostId,
        role: finalRole,
        is_muted: false,
        joined_at: now.toISOString(),
      }, { onConflict: 'room_id,user_id' });
      await supabase.from('room_mutes').delete().eq('room_id', roomId).eq('user_id', hostId);
    } catch { /* upsert hatası sessiz */ }

    // ★ 2026-04-23: listener_count'u hemen senkronize et — aksi halde DB'de 0 kalır,
    //   2 dakikalık zombie filter exemption sona erdiğinde keşfet odayı gizler.
    await this.syncListenerCount(roomId);

    // ★ 2026-05-10 v111: Persistent history Faz 1 — wakeUp 7-gün retention saatini
    //   sıfırlar. Frozen iken trigger metadata.archived_at damgası bastı, host
    //   uyandırınca damgaları temizliyoruz. Fail olursa worst case "biraz erken
    //   silinir" — trigger her freeze'de overwrite yapıyor, veri kaybı yok.
    supabase.rpc('clear_archived_at', { p_room_id: roomId }).then(() => {}).catch(() => {});

    return data as Room;
  },

  /** Oda oluştur */
  async create(
    hostId: string,
    options: {
      name: string;
      category?: string;
      type?: string;
      description?: string;
      mode?: string;
      language?: string;
      welcome_message?: string;
      rules?: string;
      room_password?: string;
      speaking_mode?: 'free_for_all' | 'permission_only' | 'selected_only';
      scheduled_at?: string;
      entry_fee_sp?: number;
      donations_enabled?: boolean;
      followers_only?: boolean;
      theme_id?: string;
      room_image_url?: string;
      card_image_url?: string;
      tags?: string[];
      music_link?: string;
      age_restricted?: boolean;
      slow_mode_seconds?: number;
      room_language?: string;
    },
    tier: SubscriptionTier = 'Free'
  ): Promise<Room> {
    // ★ Faz 2.2 — Server-side rate limit (5 oda / 1 saat). Fail-open if RPC missing.
    const rl = await RateLimitService.checkAndIncrement('room_create', hostId);
    if (!rl.allowed) {
      const wait = rl.resetAt ? Math.max(1, Math.ceil((rl.resetAt.getTime() - Date.now()) / 60000)) : 60;
      throw new Error(`${rl.message || i18n.t('auto.room.033')} (${wait} dk sonra tekrar dene)`);
    }

    // ★ 2026-04-23 KRİTİK: Yeni oda açmadan önce host'un diğer canlı odalarını dondur —
    //   tek anda tek aktif oda kuralı. Yeni roomId henüz yok; tüm canlı odaları dondur.
    await this._freezeOtherLiveRooms(hostId);

    // ★ SEC-8b: Input sanitization — room name/description/settings
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
    options.name = stripHtml((options.name || '').trim()).slice(0, 60);
    if (options.name.length < 1) throw new Error(i18n.t('auto.room.032'));
    if (options.description) options.description = stripHtml(options.description.trim()).slice(0, 500);
    if (options.welcome_message) options.welcome_message = stripHtml(options.welcome_message.trim()).slice(0, 500);
    if (options.rules) options.rules = stripHtml(options.rules.trim()).slice(0, 1000);
    // ★ SEC-PWD: Oda şifresini hash'le (SHA-256) — plaintext DB'ye yazılmaz
    if (options.room_password) {
      options.room_password = options.room_password.trim().slice(0, 50);
      options.room_password = await hashRoomPassword(options.room_password);
    }
    if (options.entry_fee_sp !== undefined) options.entry_fee_sp = Math.max(0, Math.min(options.entry_fee_sp || 0, 10000));

    // ★ v1.7.13.132: GodMaster kaldırıldı — admin odaları Pro limitleriyle açılır
    let normalizedTier = migrateLegacyTier(tier);
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', hostId)
      .single();
    if (creatorProfile?.is_admin) {
      normalizedTier = 'Pro';
    }

    const limits = getRoomLimits(normalizedTier);

    // ★ BUG-T1 FIX: allowedTypes backend guard — tier'ın izni olmayan oda tipi engellenir
    const requestedType = options.type || 'open';
    if (!limits.allowedTypes.includes(requestedType)) {
      throw new Error(i18n.t('auto.room.031', { 0: normalizedTier, 1: requestedType, 2: limits.allowedTypes.join(', ') }));
    }

    // ★ v110.14: dailyRooms limiti — room_creation_log'tan say (silmeye karşı dayanıklı)
    if (limits.dailyRooms < 999) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('room_creation_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', hostId)
        .gte('created_at', todayStart.toISOString());
      if ((count || 0) >= limits.dailyRooms) {
        throw new Error(i18n.t('auto.room.030', { 0: limits.dailyRooms, 1: normalizedTier }));
      }
    }

    // Oda süresini hesapla
    const expiresAt = limits.durationHours > 0
      ? new Date(Date.now() + limits.durationHours * 60 * 60 * 1000).toISOString()
      : null; // Sınırsız süre

    // ★ v1.7.13.132: Tier-gated alanları server-side guard ile filtrele.
    //   UI bypass durumunda Free user'ın Plus/Pro özelliği göndermesi engellenir.
    //   Sessizce drop ediyoruz (throw değil) çünkü createRoom ana akışı kırılmasın.
    const tierGated = {
      // Plus+ gerek
      card_image_url:   limits.canCustomizeImage ? options.card_image_url   : undefined,
      room_image_url:   limits.canCustomizeImage ? options.room_image_url   : undefined,
      theme_id:         limits.canCustomizeTheme ? options.theme_id         : undefined,
      followers_only:   limits.canUseFollowersOnly ? options.followers_only : undefined,
      age_restricted:   limits.canUseFilters ? options.age_restricted       : undefined,
      // Clubhouse modeli: dinleyici doğrudan sahneye çıkmaz; el kaldırır.
      speaking_mode: options.speaking_mode === 'free_for_all'
        ? 'permission_only' : options.speaking_mode,
      // Pro+ monetizasyon
      entry_fee_sp:       isTierAtLeast(normalizedTier, 'Pro') ? options.entry_fee_sp       : undefined,
      donations_enabled:  isTierAtLeast(normalizedTier, 'Pro') ? options.donations_enabled  : undefined,
      // Pro+ müzik (canUseRoomMusic flag'i)
      music_link: limits.canUseRoomMusic ? options.music_link : undefined,
    };

    const roomSettings: RoomSettings = {};
    // ★ 2026-04-24 KRİTİK FIX: Oda oluşturulurken original_host_id kaydet —
    //   host çıkıp birisi claim ettiğinde, asıl sahibin geri dönüşte
    //   otomatik olarak rolünü geri alabilmesi için gerekli.
    (roomSettings as any).original_host_id = hostId;
    if (options.welcome_message) roomSettings.welcome_message = options.welcome_message;
    if (options.rules) roomSettings.rules = options.rules;
    if (tierGated.speaking_mode) roomSettings.speaking_mode = tierGated.speaking_mode;
    if (options.scheduled_at) roomSettings.scheduled_at = options.scheduled_at;
    if (tierGated.entry_fee_sp) roomSettings.entry_fee_sp = tierGated.entry_fee_sp;
    if (tierGated.donations_enabled) roomSettings.donations_enabled = tierGated.donations_enabled;
    if (tierGated.followers_only) roomSettings.followers_only = tierGated.followers_only;
    if (tierGated.card_image_url) (roomSettings as any).card_image_url = tierGated.card_image_url;
    if (tierGated.music_link) (roomSettings as any).music_link = tierGated.music_link;
    if (tierGated.age_restricted) (roomSettings as any).age_restricted = tierGated.age_restricted;
    if (options.slow_mode_seconds) (roomSettings as any).slow_mode_seconds = options.slow_mode_seconds;
    if (options.room_language) (roomSettings as any).room_language = options.room_language;
    if (tierGated.theme_id) (roomSettings as any).theme_id = tierGated.theme_id;

    // ★ BUG-T4 FIX: maxPersistentRooms limiti — kalıcı oda sayısı kontrolü
    if (limits.persistent && limits.maxPersistentRooms < 999) {
      const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', hostId)
        .eq('is_persistent', true);
      if ((count || 0) >= limits.maxPersistentRooms) {
        throw new Error(i18n.t('auto.room.029', { 0: limits.maxPersistentRooms, 1: normalizedTier }));
      }
    }

    // ★ Planlı oda kontrolü — scheduled_at gelecek bir zamansa is_live=false
    //   Sahibi manuel olarak goLive() ile başlatana kadar oda canlıya çıkmaz.
    const isScheduledFuture = !!(options.scheduled_at && new Date(options.scheduled_at).getTime() > Date.now());
    const initialIsLive = !isScheduledFuture;

    // Tüm kolonlarla dene, eksik kolon varsa minimal fallback
    let data: any;
    let error: any;

    // Önce tüm kolonlarla dene
    const fullInsert = {
      name: options.name,
      description: options.description || '',
      category: options.category || 'chat',
      type: options.type || 'open',
      host_id: hostId,
      is_live: initialIsLive,
      listener_count: 0,
      max_speakers: limits.maxSpeakers,
      max_listeners: limits.maxListeners,
      max_cameras: limits.maxCameras,
      max_moderators: limits.maxModerators,
      owner_tier: normalizedTier,
      is_persistent: limits.persistent,
      language: options.room_language || options.language || 'tr',
      mode: options.mode || 'audio',
      room_settings: roomSettings,
      room_password: options.room_password || null,
      expires_at: expiresAt,
      ...(options.theme_id ? { theme_id: options.theme_id } : {}),
      ...(options.room_image_url ? { room_image_url: options.room_image_url } : {}),
    };

    ({ data, error } = await supabase
      .from('rooms')
      .insert(fullInsert)
      .select('*, host:profiles!host_id(*)')
      .single());

    // Kolon hatası varsa, minimal insert ile tekrar dene
    if (error?.message?.includes('column') || error?.code === '42703') {
      // Ekstra verileri room_settings'e taşı
      (roomSettings as any).language = options.language || 'tr';
      (roomSettings as any).mode = options.mode || 'audio';
      (roomSettings as any).owner_tier = normalizedTier;
      (roomSettings as any).max_cameras = limits.maxCameras;
      (roomSettings as any).max_moderators = limits.maxModerators;
      (roomSettings as any).is_persistent = limits.persistent;
      if (options.room_password) (roomSettings as any).room_password = options.room_password;
      if (options.theme_id) (roomSettings as any).theme_id = options.theme_id;
      if (options.room_image_url) (roomSettings as any).room_image_url = options.room_image_url;
      if (options.tags?.length) (roomSettings as any).tags = options.tags;

      ({ data, error } = await supabase
        .from('rooms')
        .insert({
          name: options.name,
          description: options.description || '',
          category: options.category || 'chat',
          type: options.type || 'open',
          host_id: hostId,
          is_live: initialIsLive,
          listener_count: 0,
          max_speakers: limits.maxSpeakers,
          max_listeners: limits.maxListeners,
          room_settings: roomSettings,
          expires_at: expiresAt,
        })
        .select('*, host:profiles!host_id(*)')
        .single());
    }
    if (error) throw error;

    // Host'u owner olarak katılımcıya ekle
    // NOT: insert'ten hemen sonra syncListenerCount çağırarak listener_count'u 1'e çekiyoruz —
    // aksi halde keşfetteki zombie filter 2dk sonra odayı "0 kişili zombie" sanıp gizler.
    await supabase.from('room_participants').insert({
      room_id: (data as Room).id,
      user_id: hostId,
      role: 'owner',
      is_muted: false,
    });

    // ★ 2026-04-23: listener_count = 1 (host) garantile (sadece canlı odalarda)
    if (initialIsLive) {
      await this.syncListenerCount((data as Room).id);
    }

    return data as Room;
  },

  /**
   * Planlı odayı canlıya al — sahibi manuel başlattığında çağrılır.
   * Diğer canlı odaları otomatik dondurur (single host kuralı).
   */
  async goLive(roomId: string, hostId: string): Promise<Room> {
    // Odayı çek
    const { data: room, error: fetchErr } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('id', roomId)
      .single();
    if (fetchErr || !room) throw new Error(i18n.t('auto.room.028'));
    if ((room as any).host_id !== hostId) throw new Error(i18n.t('auto.room.027'));
    if ((room as any).is_live) return room as Room; // Zaten canlı — no-op

    // Tek anda tek canlı oda kuralı
    await this._freezeOtherLiveRooms(hostId, roomId);

    // is_live=true + scheduled_at temizle (history için kalsın istiyorsa room_settings.scheduled_at silinmesin)
    const { data: updated, error: updErr } = await supabase
      .from('rooms')
      .update({ is_live: true })
      .eq('id', roomId)
      .select('*, host:profiles!host_id(*)')
      .single();
    if (updErr) throw updErr;

    // listener_count senkronize et
    await this.syncListenerCount(roomId);

    return updated as Room;
  },

  /**
   * Sahibinin planlı odalarını listele (henüz canlıya çıkmamış, scheduled_at gelecekte).
   * myrooms ekranında "Planlı Odalarım" bölümü için.
   */
  async listScheduledByHost(hostId: string): Promise<Room[]> {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('rooms')
      .select('*, host:profiles!host_id(*)')
      .eq('host_id', hostId)
      .eq('is_live', false)
      .gt('room_settings->>scheduled_at', nowIso)
      .order('room_settings->>scheduled_at', { ascending: true });
    if (error) {
      if (__DEV__) console.warn('[Room] listScheduledByHost hata:', error.message);
      return [];
    }
    return (data || []) as Room[];
  },

  /** Odaya katıl */
  async join(roomId: string, userId: string, roleHint?: string): Promise<RoomParticipant> {
    // ★ O2 FIX: 3 ayrı sorgu → tek sorgu (performans + race condition önleme)
    const { data: roomData } = await supabase
      .from('rooms')
      .select('host_id, room_settings, owner_tier')
      .eq('id', roomId)
      .single();

    // ★ v309 (18 May 2026) KRİTİK FIX: original_host_id varsa, host_id geçici host'tur.
    //   Bu kontrolü "isActualOwner" şeklinde belirginleştir: SADECE asıl sahibi
    //   owner olarak tanı. Eskiden isHost || isOriginalHost ile geçici host'u da
    //   owner sayıyordu → odaya girer girmez sahnede gözüküyordu (BUG).
    const _origHostId = (roomData?.room_settings as any)?.original_host_id as string | undefined;
    const isOriginalHost = _origHostId === userId;
    // isHost SADECE original_host_id yoksa (legacy oda) anlamlıdır
    const isHost = !_origHostId && roomData?.host_id === userId;
    // Asıl sahip mantığı: original_host varsa o, yoksa host_id
    const isActualOwner = _origHostId ? isOriginalHost : (roomData?.host_id === userId);

    // ── 1. Ban kontrolü ──
    if (!isHost && !isOriginalHost) {
      const banned = await this.isBanned(roomId, userId);
      if (banned) {
        throw new Error(i18n.t('auto.room.026'));
      }
    }

    // ── 2. Kilitli oda kontrolü ──
    const lockSettings = (roomData?.room_settings || {}) as any;
    if (lockSettings.is_locked && !isHost) {
      throw new Error(i18n.t('auto.room.025'));
    }

    // ── 3. Zaten katılımcı mı? ──
    const { data: existing } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // ★ v309 (18 May 2026): Geçici host owner row downgrade — host_id transfer
      //   tarihçesinden kalan stale "owner" kayıtları temizlenir. Asıl sahip
      //   olmayan kullanıcı odaya girdiğinde otomatik listener'a düşer.
      //   Memory kuralı: "başkasının odasında host olunmaz".
      if (existing.role === 'owner' && !isActualOwner) {
        await supabase
          .from('room_participants')
          .update({ role: 'listener' })
          .eq('room_id', roomId)
          .eq('user_id', userId);
        return { ...existing, role: 'listener' } as RoomParticipant;
      }

      // ★ 2026-04-30 FIX v2: Host minimize'dan dönünce mevcut rolü korunsun.
      //   Önceki fix her durumda owner'a yükseltiyordu — sahneden inmiş host
      //   minimize edip geri açınca zorla sahneye çıkıyordu.
      //
      //   Çözüm: last_seen_at son 2dk içindeyse kullanıcı "aktif" — minimize'dan
      //   dönüyor, rolüne dokunma. last_seen_at stale (>2dk) ise gerçekten ayrılmış
      //   ve geri geliyor → owner'a yükselt.
      // ★ v309: isActualOwner kullan (geçici host upgrade etmesin)
      if (isActualOwner && existing.role !== 'owner') {
        const lastSeen = existing.last_seen_at ? new Date(existing.last_seen_at).getTime() : 0;
        const isStale = Date.now() - lastSeen > 2 * 60 * 1000; // 2 dakikadan eski
        
        if (isStale) {
          // Gerçek rejoin — host ayrılmış ve geri gelmiş → owner'a yükselt
          const { data: updated } = await supabase
            .from('room_participants')
            .update({ role: 'owner', is_muted: false })
            .eq('room_id', roomId)
            .eq('user_id', userId)
            .select('*')
            .maybeSingle();
          // rooms.host_id de güncelle
          if (updated && roomData?.host_id !== userId) {
            await supabase.from('rooms').update({ host_id: userId }).eq('id', roomId);
            // Geçici host'u speaker'a düşür
            await supabase
              .from('room_participants')
              .update({ role: 'speaker' })
              .eq('room_id', roomId)
              .eq('role', 'owner')
              .neq('user_id', userId);
          }
          if (updated) return updated as RoomParticipant;
        }
        // Taze heartbeat — minimize'dan dönüş → mevcut rolü koru
      }
      return existing as RoomParticipant;
    }

    // ── 4. Rol belirleme (roomData zaten elimizde) ──
    // ★ BUG-R5 FIX: roleHint parametresini dikkate al
    // ★ v309 (18 May 2026): isActualOwner kullan — geçici host (host_id transfer
    //   edilmiş kişi) owner olarak girmez. Sadece asıl sahip (original_host_id)
    //   owner role alır. Memory: kullanıcı kuralı "başkasının odasında host olunmaz".
    let role: string = roleHint || 'listener';
    if (roomData) {
      // ★ v309 (18 May 2026) FIX: settings declaration restored — refactor sırasında
      //   yanlışlıkla silinmiş, L1187 entryFee referansı undefined → ReferenceError
      //   → join hang ("Oda hazırlanıyor" sonsuz).
      const settings = (roomData.room_settings || {}) as RoomSettings;
      if (isActualOwner) {
        role = 'owner';
        // Host geri dönüyorsa room'un host_id'sini güncelle
        if (roomData.host_id !== userId) {
          await supabase
            .from('rooms')
            .update({ host_id: userId })
            .eq('id', roomId);

          // Mevcut "geçici host"u speaker'a düşür
          await supabase
            .from('room_participants')
            .update({ role: 'speaker' })
            .eq('room_id', roomId)
            .eq('role', 'owner');
        }
      } else {
        // Dinleyici grid doluysa spectator olarak ekle
        const { count } = await supabase
          .from('room_participants')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .eq('role', 'listener');

        // ★ BUG FIX: Sabit 20 yerine tier bazlı maxListeners kullan
        const roomOwnerTier = migrateLegacyTier(roomData.owner_tier);
        const roomLimits = getRoomLimits(roomOwnerTier);
        if ((count || 0) >= roomLimits.maxListeners) {
          role = 'spectator';
        }
      }

      // ★ v92.11 (1 May 2026): Giriş ücreti — atomik RPC ile (sensitive column guard
      //   bypass'lı). Eski client-side UPDATE pattern'i guard tarafından engelleniyordu
      //   → "SP işlemi başarısız" → giriş kapalı kalıyordu.
      const entryFee = (settings as any).entry_fee_sp || 0;
      if (entryFee > 0 && role !== 'owner') {
        try {
          const { data: feeRes, error: feeErr } = await supabase.rpc('charge_room_entry_fee', {
            p_room_id: roomId,
            p_user_id: userId,
          });
          if (feeErr) throw new Error(feeErr.message || i18n.t('auto.room.024'));
          const r = feeRes as any;
          if (r && r.success === false) {
            throw new Error(r.error || i18n.t('auto.room.023', { 0: entryFee, 1: r.balance ?? 0 }));
          }
        } catch (e: any) {
          throw new Error(e?.message || i18n.t('auto.room.022'));
        }
      }
    }

    // ★ BUG FIX: is_muted default role'a göre.
    // Eskiden hepsi is_muted=true → owner/mod/speaker rejoin sonrası mic görsel
    // olarak "muted" görünüyordu (SpeakerSection dbMuted kontrolü UI'ı kapatıyor).
    // is_muted sadece "moderatör tarafından susturuldu" anlamı taşımalı.
    // Listener/spectator sahnede değil — mute badge gereksiz (ListenerGrid zaten
    // listener için mute badge göstermiyor), false başlat.
    const { data, error } = await supabase
      .from('room_participants')
      .insert({
        room_id: roomId,
        user_id: userId,
        role,
        is_muted: false,
        stage_expires_at: null,
      })
      .select('*, user:profiles!user_id(*)')
      .single();

    if (error) {
      // ★ SP Rollback: katılımcı eklenemezse ödenen giriş ücretini iade et
      const settings = (roomData?.room_settings || {}) as any;
      const paidFee = (settings.entry_fee_sp || 0);
      if (paidFee > 0 && role !== 'owner') {
        try {
          await supabase.rpc('grant_system_points', {
            p_user_id: userId,
            p_amount: paidFee,
            p_action: 'entry_fee_refund',
          });
        } catch { /* rollback başarısız — kritik: manuel inceleme gerekebilir */ }
      }
      // ★ O2 FIX: RLS tarafından reddedilen kayıtlar — genellikle ban (v13 policy).
      // Raw Postgres mesajı yerine kullanıcıya anlamlı metin.
      const rawMsg = String((error as any)?.message || '').toLowerCase();
      const rlsCode = String((error as any)?.code || '');
      if (rlsCode === '42501' || rawMsg.includes('row-level security') || rawMsg.includes('policy')) {
        throw new Error(i18n.t('auto.room.021'));
      }
      throw error;
    }

    // BUG-RD4 FIX: Sadece listener/spectator rollerinde sayacı artır (owner/speaker/mod hariç)
    if (role === 'listener' || role === 'spectator') {
      await supabase.rpc('increment_listener_count', { room_id_input: roomId });
    }

    return data as RoomParticipant;
  },

  /** Odadan ayrıl */
  /** ★ 2026-04-22: Heartbeat — kullanıcının odada aktif olduğunu göster (20sn'de 1 çağrılır).
   *  cleanup_stale_participants RPC son 45sn'dir heartbeat göndermeyenleri siler. */
  async updateLastSeen(roomId: string, userId: string): Promise<void> {
    try {
      await supabase.rpc('update_participant_last_seen', { p_room_id: roomId, p_user_id: userId });
    } catch { /* best-effort */ }
  },

  /** ★ 2026-04-22: App force-close edilmiş zombie participant'ları temizle. Oda içindeki
   *  herkes periodic çağırır, race-safe (DELETE idempotent). */
  async cleanupStaleParticipants(roomId: string): Promise<number> {
    try {
      const { data } = await supabase.rpc('cleanup_stale_participants', { p_room_id: roomId });
      return (data as number) || 0;
    } catch { return 0; }
  },

  async leave(roomId: string, userId: string): Promise<void> {
    // BUG-RD7 FIX: Önce rolü kontrol et, sadece listener/spectator ise sayacı azalt
    const { data: participant } = await supabase
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();

    // Katılımcıyı sil
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);

    // Sadece listener/spectator ise sayacı azalt (owner/speaker/mod azaltmaz)
    if (participant && (participant.role === 'listener' || participant.role === 'spectator')) {
      await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
    }

    // ★ FIX: Odada kimse kalmadıysa otomatik kapat
    await this._autoCloseIfEmpty(roomId);
  },

  /**
   * ★ Boş oda otomatik kapatma — katılımcı kalmadıysa is_live=false + listener_count=0
   * keep_alive policy olan odalar mušaftır (Plus/Pro).
   */
  async _autoCloseIfEmpty(roomId: string): Promise<void> {
    try {
      const { count } = await supabase
        .from('room_participants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId);
      if ((count || 0) === 0) {
        // Oda boş — keep_alive kontrolü
        const { data: roomInfo } = await supabase
          .from('rooms')
          .select('owner_tier, is_persistent')
          .eq('id', roomId)
          .single();
        const ownerTier = migrateLegacyTier(roomInfo?.owner_tier);
        const limits = getRoomLimits(ownerTier);
        // keep_alive odalar açık kalabilir ama listener_count sıfırlanmalı
        if (limits.ownerLeavePolicy === 'keep_alive' || roomInfo?.is_persistent) {
          await supabase.from('rooms').update({ listener_count: 0 }).eq('id', roomId);
        } else {
          // Free oda — tamamen kapat
          await supabase.from('rooms').update({ is_live: false, listener_count: 0 }).eq('id', roomId);
          if (__DEV__) console.log(`[AutoClose] Boş oda kapatıldı: ${roomId}`);
        }
      }
    } catch { /* sessiz */ }
  },

  /** Oda katılımcılarını getir — ★ B2 FIX: Ghost kullanıcılar filtrelenir (viewerId owner ise hariç) */
  async getParticipants(roomId: string, viewerId?: string): Promise<RoomParticipant[]> {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*, user:profiles!user_id(*)')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    if (error) throw error;

    let participants = (data || []).map((p: any) => ({
      ...p,
      role: normalizeRole(p.role), // Legacy 'host' → 'owner'
    })) as RoomParticipant[];

    // ★ v309 (18 May 2026) ZOMBI FILTER: Kullanıcı app'i force-close ederse veya
    //   leaveRoom çağrılamadan ölürse, DB'de eski kayıt kalır. Heartbeat 60sn,
    //   bu yüzden 90sn'den eski last_seen olanları "stale" sayıp UI'da gizliyoruz.
    //   Aynı kullanıcı tekrar girince yeni heartbeat ile fresh olur. last_seen_at NULL
    //   ise (just joined) dahil et.
    const STALE_THRESHOLD_MS = 90 * 1000;
    const now = Date.now();
    const staleCutoffIso = new Date(now - STALE_THRESHOLD_MS).toISOString();
    participants = participants.filter((p: any) => {
      const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : null;
      if (!lastSeen) return true; // null = yeni katılan, dahil et
      return now - lastSeen < STALE_THRESHOLD_MS;
    });

    // ★ v309: Fire-and-forget DB cleanup — stale kayıtları sil ki herkes için temizlensin.
    //   Sonraki polling round'unda cleanup yapılmış olur. Concurrent DELETE'ler güvenli.
    supabase.from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .lt('last_seen_at', staleCutoffIso)
      .then(() => {})
      .catch(() => {});

    // ★ B2 FIX: Ghost kullanıcıları gizle (owner/moderator hariç — onlar görebilir)
    if (viewerId) {
      const viewerRole = participants.find(p => p.user_id === viewerId)?.role;
      const canSeeGhosts = viewerRole === 'owner' || viewerRole === 'moderator';
      if (!canSeeGhosts) {
        participants = participants.filter(p => !p.is_ghost);
      }
    }

    return participants;
  },

  /** Oda ayarlarını güncelle — ★ SEC-8b: Input validation */
  async updateSettings(roomId: string, hostId: string, updates: Partial<Room & { room_settings?: Partial<RoomSettings> }>): Promise<void> {
    // Odanın gerçekten bu host'a ait olduğunu doğrula
    const { data: room } = await supabase.from('rooms').select('host_id, room_settings, owner_tier').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error(i18n.t('auto.room.020'));

    // ★ 2026-04-27: Geçici host koruması — devir olmuşsa (asıl sahip ≠ aktif host) ve
    // çağıran kişi asıl sahip değilse, kritik ayarları değiştiremez. DB trigger
    // (v58) backstop sağlar; burada ön-kontrol net hata mesajı için.
    const origHost = (room.room_settings as any)?.original_host_id as string | undefined;
    if (origHost && origHost !== room.host_id && hostId !== origHost) {
      throw new Error(i18n.t('auto.room.019'));
    }

    // ★ v1.7.13.132: Tier-gated update guard — owner_tier'a göre alan filtrele.
    //   Admin (is_admin) Pro yetkisi alır.
    const { data: hostProfile } = await supabase
      .from('profiles').select('is_admin, subscription_tier').eq('id', hostId).single();
    const effectiveTier: SubscriptionTier = hostProfile?.is_admin
      ? 'Pro'
      : migrateLegacyTier((room as any).owner_tier || hostProfile?.subscription_tier || 'Free');
    const tLimits = getRoomLimits(effectiveTier);

    if (updates.room_settings) {
      const s = updates.room_settings as any;
      if (s.card_image_url && !tLimits.canCustomizeImage) delete s.card_image_url;
      if (s.followers_only && !tLimits.canUseFollowersOnly) delete s.followers_only;
      if (s.age_restricted && !tLimits.canUseFilters) delete s.age_restricted;
      if (s.entry_fee_sp && !isTierAtLeast(effectiveTier, 'Pro')) delete s.entry_fee_sp;
      if (s.donations_enabled && !isTierAtLeast(effectiveTier, 'Pro')) delete s.donations_enabled;
      if (s.music_link && !tLimits.canUseRoomMusic) delete s.music_link;
      if (s.speaking_mode === 'free_for_all') s.speaking_mode = 'permission_only';
    }
    if ((updates as any).theme_id !== undefined && !tLimits.canCustomizeTheme) {
      delete (updates as any).theme_id;
    }
    if ((updates as any).room_image_url !== undefined && !tLimits.canCustomizeImage) {
      delete (updates as any).room_image_url;
    }

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '');
    const dbUpdates: any = {};
    if (updates.name !== undefined) {
      const sanitizedName = stripHtml((updates.name || '').trim()).slice(0, 60);
      if (sanitizedName.length < 1) throw new Error(i18n.t('auto.room.018'));
      dbUpdates.name = sanitizedName;
    }
    if (updates.description !== undefined) dbUpdates.description = stripHtml((updates.description || '').trim()).slice(0, 500);
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.max_listeners !== undefined) dbUpdates.max_listeners = updates.max_listeners;
    if (updates.max_speakers !== undefined) dbUpdates.max_speakers = updates.max_speakers;
    if (updates.max_cameras !== undefined) dbUpdates.max_cameras = updates.max_cameras;
    if (updates.max_moderators !== undefined) dbUpdates.max_moderators = updates.max_moderators;
    // ★ 2026-04-21: theme_id ve room_image_url top-level kolonları (yoksa DB'ye yazılmıyordu → MyRooms'tan değişim oda içine yansımıyordu)
    if ((updates as any).theme_id !== undefined) dbUpdates.theme_id = (updates as any).theme_id;
    if ((updates as any).room_image_url !== undefined) dbUpdates.room_image_url = (updates as any).room_image_url;

    // room_settings JSONB merge
    if (updates.room_settings) {
      const existingSettings = (room.room_settings || {}) as RoomSettings;
      const incoming = { ...updates.room_settings } as any;

      // ★ SEC-PWD: Şifre güncellendiyse hash'le (create'te olduğu gibi) — plaintext DB'ye yazma
      // Tersten erişim: aynı hash tekrar update edilmesin diye, incoming.room_password
      // zaten 64-char hex ise (SHA-256 hash) atla.
      if (typeof incoming.room_password === 'string' && incoming.room_password.length > 0) {
        const alreadyHashed = /^[a-f0-9]{64}$/i.test(incoming.room_password);
        if (!alreadyHashed) {
          incoming.room_password = await hashRoomPassword(incoming.room_password.trim().slice(0, 50));
        }
        // ★ Şifre ayarlandı → oda tipini 'closed' olarak normalize et (UI tutarlılığı)
        if (updates.type === undefined) dbUpdates.type = 'closed';
      } else if (incoming.room_password === '') {
        // Boş string → şifre kaldırılıyor
        incoming.room_password = null;
      }

      dbUpdates.room_settings = { ...existingSettings, ...incoming };
    }

    const { error } = await supabase.from('rooms').update(dbUpdates).eq('id', roomId);
    if (error) throw error;
  },

  /** Odayı sil (kalıcı oda) */
  async deleteRoom(roomId: string, hostId: string): Promise<void> {
    // ★ v1.7.13.140: Sistem odaları (Soprano Lobi) silinemez.
    if (isSystemRoom(roomId)) throw new Error('Sistem odası silinemez.');
    const { data: room } = await supabase.from('rooms').select('host_id, room_settings').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error(i18n.t('auto.room.017'));

    // ★ 2026-04-27: Geçici host odayı silemez. Asıl sahip dönüp claim etmeli.
    const origHost = (room.room_settings as any)?.original_host_id as string | undefined;
    if (origHost && origHost !== room.host_id && hostId !== origHost) {
      throw new Error(i18n.t('auto.room.016'));
    }

    // Katılımcıları temizle
    await supabase.from('room_participants').delete().eq('room_id', roomId);
    // Odayı sil
    await supabase.from('rooms').delete().eq('id', roomId);
  },

  /** Odayı kapat (geçici oda).
   *  ★ 2026-04-22: Kalan süreyi room_settings.remaining_ms olarak dondur — uyandırınca
   *  bu değer expires_at'e eklenir, "pasif haldeyken saat akmasın" davranışı için. */
  async close(roomId: string): Promise<void> {
    const { data: row } = await supabase
      .from('rooms')
      .select('expires_at, room_settings')
      .eq('id', roomId)
      .maybeSingle();
    const settings = { ...((row?.room_settings as any) || {}) };
    if (row?.expires_at) {
      const remainMs = new Date(row.expires_at as string).getTime() - Date.now();
      settings.remaining_ms = remainMs > 0 ? remainMs : 0;
    }
    await supabase
      .from('rooms')
      .update({ is_live: false, listener_count: 0, expires_at: null, room_settings: settings })
      .eq('id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
  },

  /**
   * ★ Manuel Oda Dondurma — Owner odayı dondurur.
   * Oda is_live=false olur ama silinmez. Katılımcılar temizlenir.
   * Daha sonra wakeUpRoom ile tekrar aktifleştirilebilir.
   * Sadece Plus+ kullanıcılar (persistent: true) için.
   */
  async freezeRoom(roomId: string, hostId: string): Promise<void> {
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id, room_settings, expires_at')
      .eq('id', roomId)
      .single();

    if (!room || room.host_id !== hostId) throw new Error(i18n.t('auto.room.015'));

    // ★ 2026-04-22: Kalan süreyi dondur — uyandırmada bu saniye eklenir, saat akmaz.
    const remainMs = (room as any).expires_at
      ? Math.max(0, new Date((room as any).expires_at).getTime() - Date.now())
      : undefined;

    const updatedSettings: any = {
      ...(room.room_settings || {}),
      original_host_id: hostId,
      frozen_at: new Date().toISOString(),
    };
    if (remainMs !== undefined) updatedSettings.remaining_ms = remainMs;

    // Odayı dondur — is_live: false, listener_count sıfırla, expires_at null (saat dursun)
    await supabase
      .from('rooms')
      .update({ is_live: false, listener_count: 0, expires_at: null, room_settings: updatedSettings })
      .eq('id', roomId);

    // Tüm katılımcıları temizle
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId);
  },

  /**
   * ★ 2026-04-23: Gün Sonu Temizliği — Gece yarısı donmuş odaların sayaçlarını sıfırla.
   *   - Free (persistent:false) → oda silinir (kalıcı oda hakkı yok)
   *   - Plus/Pro (persistent:true) → remaining_ms sıfırlanır, oda kalır ama süre biter
   *
   * Bu fonksiyon app açılışında veya periyodik olarak çağrılmalıdır.
   * Günlük oda açma hakkı zaten created_at >= todayStart ile sıfırlanıyor;
   * bu fonksiyon donmuş odaların süre sayaçlarını da aynı şekilde sıfırlar.
   */
  async cleanupFrozenRooms(): Promise<{ deleted: number; reset: number }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    let deleted = 0;
    let reset = 0;

    // 1) Dün veya daha önce donmuş, persistent olmayan (Free) odaları bul ve sil
    const { data: nonPersistent } = await supabase
      .from('rooms')
      .select('id, owner_tier')
      .eq('is_live', false)
      .not('room_settings->frozen_at', 'is', null)
      .lt('room_settings->frozen_at', todayIso);

    if (nonPersistent && nonPersistent.length > 0) {
      for (const room of nonPersistent) {
        const tier = migrateLegacyTier((room as any).owner_tier);
        const limits = getRoomLimits(tier);
        if (!limits.persistent) {
          // Free tier — oda silinir
          await supabase.from('room_participants').delete().eq('room_id', room.id);
          await supabase.from('rooms').delete().eq('id', room.id);
          deleted++;
        } else {
          // Plus/Pro — remaining_ms sıfırlanır (süre biter ama oda kalır)
          const { data: r } = await supabase
            .from('rooms')
            .select('room_settings')
            .eq('id', room.id)
            .single();
          if (r) {
            const settings = { ...((r.room_settings as any) || {}) };
            settings.remaining_ms = 0;
            delete settings.frozen_at;
            await supabase.from('rooms').update({ room_settings: settings }).eq('id', room.id);
            reset++;
          }
        }
      }
    }

    if (__DEV__) console.log(`[cleanupFrozenRooms] Deleted: ${deleted}, Reset: ${reset}`);
    return { deleted, reset };
  },

  /**
   * Oda süresi doldu mu? Tier-bazlı süre kontrolü
   * Hardcoded 3-saat fallback kaldırıldı.
   */
  isExpired(room: Partial<Room>): boolean {
    if (!room.expires_at) return false; // Sınırsız süre (Pro)
    return new Date(room.expires_at) < new Date();
  },

  /**
   * ★ Keşfet Boost — Odayı keşfette öne çıkar.
   * boost_expires_at ve boost_score günceller.
   * ★ SP kontrolü dahil — yeterli SP yoksa hata fırlatır.
   * @param durationHours 1 veya 6 saat
   */
  async activateBoost(roomId: string, hostId: string, durationHours: 1 | 6): Promise<void> {
    const { data: room } = await supabase.from('rooms').select('host_id').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error(i18n.t('auto.room.014'));

    // ★ BUG-A2 FIX: SP kontrolü — ücretsiz boost exploit önleme
    const spCost = durationHours === 6 ? 400 : 100;
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_points')
      .eq('id', hostId)
      .single();
    const currentSP = profile?.system_points || 0;
    if (currentSP < spCost) {
      throw new Error(`Yetersiz SP. Gerekli: ${spCost}, Mevcut: ${currentSP}`);
    }

    // SP düş (atomic RPC yoksa manuel)
    try {
      const { error: rpcError } = await supabase.rpc('grant_system_points', {
        p_user_id: hostId,
        p_amount: -spCost,
        p_action: 'room_boost',
      });
      if (rpcError) throw rpcError;
    } catch {
      await supabase.from('profiles')
        .update({ system_points: currentSP - spCost })
        .eq('id', hostId);
    }

    // SP işlem kaydı
    try {
      await supabase.from('sp_transactions').insert({
        user_id: hostId,
        amount: -spCost,
        type: 'room_boost',
        description: i18n.t('auto.room.013', { 0: durationHours }),
      });
    } catch { /* sp_transactions yoksa sessiz */ }

    const boostUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const boostScore = durationHours === 6 ? 100 : 50;
    try {
      await supabase.from('rooms').update({
        boost_expires_at: boostUntil,
        boost_score: boostScore,
      }).eq('id', roomId);
    } catch {
      // boost_expires_at / boost_score kolonu yoksa room_settings'e yaz
      const { data: r2 } = await supabase.from('rooms').select('room_settings').eq('id', roomId).single();
      const settings = (r2?.room_settings || {}) as any;
      settings.boost_expires_at = boostUntil;
      settings.boost_score = boostScore;
      await supabase.from('rooms').update({ room_settings: settings }).eq('id', roomId);
    }
  },

  /** ★ Oda temasını değiştir (host + Plus+ gerekli) */
  async setRoomTheme(roomId: string, hostId: string, themeId: string | null) {
    const { data: room } = await supabase.from('rooms').select('host_id, owner_tier').eq('id', roomId).single();
    if (!room || room.host_id !== hostId) throw new Error(i18n.t('auto.room.012'));
    // ★ Tier guard: Plus+ gerekli
    const tier = migrateLegacyTier(room.owner_tier);
    if (!isTierAtLeast(tier, 'Plus')) throw new Error(i18n.t('auto.room.011'));
    const { error } = await supabase.from('rooms').update({ theme_id: themeId }).eq('id', roomId);
    if (error) throw error;
  },

  /**
   * Konuşmacı olmak için el kaldır.
   * ★ B4 FIX: speaking_mode backend kontrolü eklendi.
   */
  async requestToSpeak(roomId: string, userId: string): Promise<void> {
    // Clubhouse modeli: dinleyici doğrudan sahneye çıkamaz; her zaman el kaldırır.
    await supabase
      .from('room_participants')
      .update({ role: 'pending_speaker', hand_raised_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /**
   * Host: Bekleyen konuşmacıları getir.
   * subscription_tier bazlı öncelik sıralaması
   * (ücretli aboneler öne alınır).
   */
  async getPendingSpeakers(roomId: string): Promise<RoomParticipant[]> {
    const { data, error } = await supabase
      .from('room_participants')
      .select('*, user:profiles!user_id(*)')
      .eq('room_id', roomId)
      .eq('role', 'pending_speaker')
      .order('hand_raised_at', { ascending: true, nullsFirst: false })
      .order('joined_at', { ascending: true });
    if (error) throw error;

    return (data || []) as (RoomParticipant & { user?: Profile })[];
  },

  /**
   * Host: Kullanıcıyı konuşmacıya yükselt.
   * Y9/Y11: v21 atomic RPC — slot kontrolü + rol update + listener_count tek transaction.
   */
  /**
   * ★ v32 Caretaker Stage — Sahipsiz odada süreli sahneye çıkma.
   * Owner+moderator yoksa listener 5 dk süreyle speaker olur, 60sn cooldown.
   * Returns: { expires_at, duration_sec } başarılıysa.
   */
  async claimStageSeat(roomId: string, userId: string): Promise<{ expires_at: string; duration_sec: number }> {
    // ★ v51 FIX 2026-04-22: Firebase auth → auth.uid() NULL → p_executor_id fallback
    const { data, error } = await supabase.rpc('claim_stage_seat', {
      p_room_id: roomId,
      p_user_id: userId,
      p_executor_id: userId,
    });
    if (error) throw new Error(error.message || i18n.t('auto.room.009'));
    const result = data as any;
    return {
      expires_at: result.expires_at,
      duration_sec: result.duration_sec,
    };
  },

  /** Süresi dolmuş caretaker'ları otomatik listener'a indir (cleanup). */
  async releaseExpiredCaretakers(): Promise<number> {
    const { data, error } = await supabase.rpc('release_expired_caretakers');
    if (error) return 0;
    return (data as number) || 0;
  },

  async promoteSpeaker(roomId: string, userId: string, executorId?: string): Promise<void> {
    // ★ 2026-04-29: RPC ZORUNLU. Fallback direct UPDATE v19 trigger'a yakalanıyor
    //   ("Role değişikliği reddedildi" hatası). RPC fail ederse net mesaj göster.
    try {
      const { error } = await supabase.rpc('promote_speaker_atomic', {
        p_room_id: roomId,
        p_user_id: userId,
        p_executor_id: executorId,
      });
      if (!error) return;
      if (__DEV__) console.warn('[promoteSpeaker] RPC error:', error.message);
      // ★ Self-promote denied (free_for_all RPC değişikliği uygulanmadıysa) — anlamlı mesaj
      if (/role değişikliği reddedildi|escalation|yetkiniz yok|prevent_role/i.test(error.message || '')) {
        throw new Error(i18n.t('auto.room.008'));
      }
      // ★ v1.7.13.161: UUID type mismatch — Firebase UID'leri UUID formatında değil.
      //   RPC parametresi uuid tipinde tanımlanmışsa bu hatayı verir.
      //   Direct UPDATE fallback kullan.
      if (/invalid input syntax for type uuid/i.test(error.message || '')) {
        if (__DEV__) console.warn('[promoteSpeaker] UUID type mismatch, using direct UPDATE fallback');
        const { error: updateErr } = await supabase
          .from('room_participants')
          .update({ role: 'speaker', is_muted: false })
          .eq('room_id', roomId)
          .eq('user_id', userId);
        if (updateErr) throw new Error(updateErr.message);
        // listener_count düşür
        try { await supabase.rpc('decrement_listener_count', { room_id_input: roomId }); } catch { /* sessiz */ }
        return;
      }
      throw new Error(error.message || i18n.t('auto.room.007'));
    } catch (rpcErr: any) {
      throw rpcErr;
    }

    // ★ 2026-04-29: Direct UPDATE fallback kaldırıldı — v19 trigger blokluyor.
    //   RPC yukarıda zorunlu hale getirildi.
  },

  /**
   * Host/Mod: Konuşmacıyı dinleyiciye düşür. Self-demote speaker→listener de desteklenir.
   * Y9: v21 atomic RPC — rol update + listener_count tek transaction.
   */
  async demoteSpeaker(roomId: string, userId: string, executorId?: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('demote_speaker_atomic', {
        p_room_id: roomId,
        p_user_id: userId,
      });
      if (!error) return;
      if (__DEV__) console.warn('[demoteSpeaker] RPC fallback:', error.message);
      if (/yetkiniz yok|owner demote/i.test(error.message || '')) throw new Error(error.message);
    } catch (rpcErr: any) {
      if (rpcErr?.message && /yetkiniz yok|owner demote/i.test(rpcErr.message)) throw rpcErr;
    }

    // Fallback — v21 migrate edilmediyse eski yol
    if (executorId) await _requireRole(roomId, executorId, ['owner', 'moderator']);
    const { data: currentPart } = await supabase
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    await supabase
      .from('room_participants')
      .update({ role: 'listener', is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (currentPart && (currentPart.role === 'speaker' || currentPart.role === 'moderator')) {
      try { await supabase.rpc('increment_listener_count', { room_id_input: roomId }); } catch { /* RPC yoksa sessiz */ }
    }
  },

  /**
   * ★ Owner sahneye geri dön — sahneden indikten sonra tekrar 'owner' olarak sahneye çıkar.
   * promoteSpeaker her zaman 'speaker' yapıyordu, bu yüzden owner geri dönemiyordu.
   * Bu metot doğrudan 'owner' rolü atar + host_id doğrulaması yapar.
   */
  async rejoinAsOwner(roomId: string, userId: string): Promise<void> {
    // Güvenlik: Sadece gerçek oda sahibi bu metodu kullanabilir
    const { data: roomInfo } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', roomId)
      .single();
    if (!roomInfo || roomInfo.host_id !== userId) {
      throw new Error(i18n.t('auto.room.006'));
    }
    const { error } = await supabase
      .from('room_participants')
      .update({ role: 'owner', is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (error) throw error;
  },

  /**
   * Host: Kullanıcıyı moderatör yap.
   * Y9: v21 atomic RPC — limit kontrolü + rol update + listener_count tek transaction.
   */
  async setModerator(roomId: string, userId: string, executorId?: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('set_moderator_atomic', {
        p_room_id: roomId,
        p_user_id: userId,
      });
      if (!error) return;
      if (__DEV__) console.warn('[setModerator] RPC fallback:', error.message);
      if (/limit|yetkiniz yok|tier/i.test(error.message || '')) throw new Error(error.message);
    } catch (rpcErr: any) {
      if (rpcErr?.message && /limit|yetkiniz yok|tier/i.test(rpcErr.message)) throw rpcErr;
    }

    // Fallback
    if (executorId) await _requireRole(roomId, executorId, ['owner']);
    const { data: roomInfo } = await supabase.from('rooms').select('owner_tier').eq('id', roomId).single();
    const ownerTier = migrateLegacyTier(roomInfo?.owner_tier);
    const limits = getRoomLimits(ownerTier);
    const currentModCount = await this.getModeratorCount(roomId);
    if (currentModCount >= limits.maxModerators) {
      throw new Error(i18n.t('auto.room.005', { 0: limits.maxModerators, 1: ownerTier }));
    }
    await supabase
      .from('room_participants')
      .update({ role: 'moderator', is_muted: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /**
   * Host: Kullanıcının moderatörlüğünü kaldır.
   * Y13: v21 atomic RPC — sadece owner veya mod kendisi demote edebilir, başka mod edemez.
   */
  async removeModerator(roomId: string, userId: string, executorId?: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('remove_moderator_atomic', {
        p_room_id: roomId,
        p_user_id: userId,
      });
      if (!error) return;
      if (__DEV__) console.warn('[removeModerator] RPC fallback:', error.message);
      if (/sadece oda sahibi|yetkiniz yok/i.test(error.message || '')) throw new Error(error.message);
    } catch (rpcErr: any) {
      if (rpcErr?.message && /sadece oda sahibi|yetkiniz yok/i.test(rpcErr.message)) throw rpcErr;
    }

    // Fallback
    if (executorId) await _requireRole(roomId, executorId, ['owner']);
    await supabase
      .from('room_participants')
      .update({ role: 'speaker' })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** Odadaki moderatör sayısını getir */
  async getModeratorCount(roomId: string): Promise<number> {
    const { count, error } = await supabase
      .from('room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('role', 'moderator');
    if (error) return 0;
    return count || 0;
  },

  /**
   * Host çıkınca: Yetki zinciri ile devret (Mod → Speaker → Tier-bazlı politika)
   */
  async transferHost(roomId: string, oldHostId: string): Promise<{ newHostId: string | null; keepAlive?: boolean }> {
    // ★ v1.7.13.140: Sistem odaları için host transfer yok — system_user kalıcı sahip.
    if (isSystemRoom(roomId)) return { newHostId: null, keepAlive: true };
    // ★ K2/K3 FIX: Atomic RPC (v18). Aday seçimi + 3 adımlı UPDATE/DELETE
    // tek transaction içinde. Eski 3-query flow arada kopunca sahipsiz oda
    // veya çift-owner bırakıyordu.
    try {
      // ★ v60: p_executor_id fallback — Firebase auth NULL iken client self-ID geçer
      const { data, error } = await supabase.rpc('transfer_host_atomic', {
        p_room_id: roomId,
        p_old_host_id: oldHostId,
        p_executor_id: oldHostId,
      });
      if (error) throw error;
      const result = (data || {}) as { newHostId: string | null; keepAlive: boolean | null; noop?: boolean };
      return {
        newHostId: result.newHostId ?? null,
        keepAlive: result.keepAlive ?? undefined,
      };
    } catch (rpcErr: any) {
      // RPC henüz migrate edilmediyse fallback — eski (atomic olmayan) akış.
      // Production'da bu dalla karşılaşılmamalı; v18 uygulandıktan sonra kalabilir.
      if (__DEV__) console.warn('[transferHost] RPC fallback:', rpcErr?.message);
      return this._transferHostLegacy(roomId, oldHostId);
    }
  },

  /** @internal v18 RPC yoksa fallback. Production'da kullanılmamalı. */
  async _transferHostLegacy(roomId: string, oldHostId: string): Promise<{ newHostId: string | null; keepAlive?: boolean }> {
    const { data: roomInfo } = await supabase
      .from('rooms')
      .select('is_persistent, owner_tier, room_settings, host_id')
      .eq('id', roomId)
      .single();

    let ownerTier = migrateLegacyTier(roomInfo?.owner_tier);
    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('is_admin, subscription_tier')
      .eq('id', oldHostId)
      .single();
    if (hostProfile?.is_admin) {
      ownerTier = 'Pro'; // ★ v1.7.13.132: GodMaster kaldırıldı
    }

    const limits = getRoomLimits(ownerTier);

    const { data: mods } = await supabase
      .from('room_participants')
      .select('user_id, joined_at')
      .eq('room_id', roomId)
      .eq('role', 'moderator')
      .order('joined_at', { ascending: true })
      .limit(1);

    let newHostId: string | null = null;

    if (mods && mods.length > 0) {
      newHostId = mods[0].user_id;
    } else {
      const { data: speakers } = await supabase
        .from('room_participants')
        .select('user_id, joined_at')
        .eq('room_id', roomId)
        .eq('role', 'speaker')
        .neq('user_id', oldHostId)
        .order('joined_at', { ascending: true })
        .limit(1);

      if (speakers && speakers.length > 0) {
        newHostId = speakers[0].user_id;
      }
    }

    if (newHostId) {
      await supabase
        .from('room_participants')
        .update({ role: 'owner' })
        .eq('room_id', roomId)
        .eq('user_id', newHostId);

      const updatedSettings = {
        ...(roomInfo?.room_settings || {}),
        original_host_id: oldHostId,
      };
      await supabase
        .from('rooms')
        .update({ host_id: newHostId, room_settings: updatedSettings })
        .eq('id', roomId);

      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', oldHostId);

      return { newHostId };
    }

    if (limits.ownerLeavePolicy === 'keep_alive') {
      const updatedSettings = {
        ...(roomInfo?.room_settings || {}),
        original_host_id: oldHostId,
      };
      await supabase
        .from('rooms')
        .update({ room_settings: updatedSettings })
        .eq('id', roomId);

      await supabase
        .from('room_participants')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', oldHostId);

      return { newHostId: null, keepAlive: true };
    }

    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', oldHostId);

    return { newHostId: null };
  },

  /**
   * ★ K1 FIX: Host Claim — Geri sayım sırasında kullanıcı host olur.
   * Backend guard: oda sahipsiz mi, kullanıcı uygun rolde mı kontrol eder.
   * Frontend'deki raw Supabase query'leri bu fonksiyona taşındı.
   */
  async claimHost(roomId: string, userId: string): Promise<void> {
    // 1. Oda mevcut mu?
    const { data: roomInfo, error: roomErr } = await supabase
      .from('rooms')
      .select('host_id, room_settings')
      .eq('id', roomId)
      .single();
    if (roomErr || !roomInfo) throw new Error(i18n.t('auto.room.004'));

    // 2. Kullanıcı katılımcı mı ve uygun rolde mi?
    const { data: myPart } = await supabase
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!myPart) throw new Error(i18n.t('auto.room.003'));
    const BANNED_ROLES = ['banned', 'spectator', 'guest'];
    if (BANNED_ROLES.includes(myPart.role)) {
      throw new Error(i18n.t('auto.room.002'));
    }

    // 3. Mevcut owner var mı kontrol et — sahipsiz değilse claim yapılamaz
    const { data: currentOwner } = await supabase
      .from('room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('role', 'owner')
      .maybeSingle();
    if (currentOwner) {
      throw new Error(i18n.t('auto.room.001'));
    }

    // 4. ★ 2026-04-24 KRİTİK FIX: Claim öncesinde original_host_id'yi kaydet —
    //   asıl sahibin geri dönüşünde otomatik reclaim yapabilmesi için.
    const currentSettings = (roomInfo.room_settings || {}) as any;
    if (!currentSettings.original_host_id) {
      currentSettings.original_host_id = roomInfo.host_id;
      await supabase
        .from('rooms')
        .update({ room_settings: currentSettings })
        .eq('id', roomId);
    }

    // 5. Güvenli: Atomic RPC (v19). UPDATE + host_id tek transaction'da,
    //    role escalation trigger'ı set_config ile yetkilendirilmiş şekilde geçer.
    const { error: rpcErr } = await supabase.rpc('claim_host', {
      p_room_id: roomId,
      p_user_id: userId,
    });
    if (rpcErr) {
      // Fallback: RPC henüz migrate edilmediyse eski yol (trigger yoksa çalışır).
      if (__DEV__) console.warn('[claimHost] RPC fallback:', rpcErr?.message);
      await supabase
        .from('room_participants')
        .update({ role: 'owner' })
        .eq('room_id', roomId)
        .eq('user_id', userId);
      await supabase
        .from('rooms')
        .update({ host_id: userId })
        .eq('id', roomId);
    }
  },

  /** Host/Mod: Kullanıcıyı metin sohbetinde sustur/aç */
  async setChatMute(roomId: string, userId: string, muted: boolean): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ is_chat_muted: muted })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  // ════════════════════════════════════════════════════════════
  // ODA TAKİP SİSTEMİ
  // ════════════════════════════════════════════════════════════

  /** Odayı takip et */
  async followRoom(roomId: string, userId: string): Promise<void> {
    await supabase.from('room_followers').upsert(
      { room_id: roomId, user_id: userId, followed_at: new Date().toISOString() },
      { onConflict: 'room_id,user_id' }
    );
  },

  /** Oda takibini bırak */
  async unfollowRoom(roomId: string, userId: string): Promise<void> {
    await supabase.from('room_followers').delete().eq('room_id', roomId).eq('user_id', userId);
  },

  /** Odayı takip ediyor mu? */
  async isFollowingRoom(roomId: string, userId: string): Promise<boolean> {
    const { data } = await supabase.from('room_followers').select('id').eq('room_id', roomId).eq('user_id', userId).maybeSingle();
    return !!data;
  },

  /** Oda takipçi sayısı */
  async getRoomFollowerCount(roomId: string): Promise<number> {
    const { count } = await supabase.from('room_followers').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
    return count || 0;
  },

  // ════════════════════════════════════════════════════════════
  // ODA DAVET SİSTEMİ
  // ════════════════════════════════════════════════════════════

  /** Davet linki oluştur (deep link) */
  generateInviteLink(roomId: string): string {
    return `https://sopranochat.com/room/${roomId}`;
  },

  /** Uygulama içi arkadaşlarını davete gönder */
  async sendRoomInvite(roomId: string, fromUserId: string, toUserIds: string[]): Promise<void> {
    const inserts = toUserIds.map(uid => ({
      room_id: roomId,
      user_id: uid,
      invited_by: fromUserId,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));
    await supabase.from('room_invites').insert(inserts);

    // Push bildirim (toplu)
    for (const uid of toUserIds) {
      try {
        await PushService.sendToUser(uid, 'Oda Daveti', 'Bir odaya davet edildiniz!', { type: 'room_invite' as any, route: `/room/${roomId}` });
      } catch { /* push başarısız olabilir */ }
    }
  },

  /** ★ v1.7.13.49 (20 May 2026): Planlı odalar — gelecek 7 gün için sıralı.
   *  scheduled_at JSONB içinde (room_settings.scheduled_at). is_live=false; başlamadan
   *  görünür, başladığında getLive() listesine geçer. UI Keşfet'te ayrı section gösterir. */
  async getUpcomingScheduled(limit = 10): Promise<Room[]> {
    try {
      const now = new Date().toISOString();
      const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('rooms')
        .select('*, host:profiles!host_id(*)')
        .eq('is_live', false)
        .gt('room_settings->>scheduled_at', now)
        .lt('room_settings->>scheduled_at', weekLater)
        .order('room_settings->>scheduled_at', { ascending: true })
        .limit(limit);
      if (error || !data) return [];
      return data as Room[];
    } catch {
      return [];
    }
  },

  /** ★ v1.7.13.58 (20 May 2026): Spam engeli — pending davet varsa true döner.
   *  Recipient kabul/red edene kadar tekrar davet gönderilemez. */
  async hasPendingRoomInvite(roomId: string, fromUserId: string, toUserId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('room_invites')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId)
      .eq('invited_by', fromUserId)
      .eq('user_id', toUserId)
      .eq('status', 'pending');
    if (error) return false;
    return (count ?? 0) > 0;
  },

  // ════════════════════════════════════════════════════════════
  // OWNER SÜPER GÜÇLERİ
  // ════════════════════════════════════════════════════════════

  /** 👻 Ghost Mode — Owner görünmez olur — ★ D1 FIX: Sadece owner kullanabilir
   *  ★ v1.7.13.134: Server-side Pro+ tier check (PostgREST bypass kapatma) */
  async setGhostMode(roomId: string, userId: string, isGhost: boolean): Promise<void> {
    await _requireRole(roomId, userId, ['owner']);
    const { data: prof } = await supabase
      .from('profiles').select('is_admin, subscription_tier').eq('id', userId).maybeSingle();
    const effTier = prof?.is_admin ? 'Pro' : migrateLegacyTier(prof?.subscription_tier);
    if (!isTierAtLeast(effTier, 'Pro')) {
      throw new Error('Ghost mode için Pro üyelik gerekiyor.');
    }
    await supabase
      .from('room_participants')
      .update({ is_ghost: isGhost })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /** 🎭 Kılık Değiştirme — Host kendi adı/avatarı geçici değişir
   *  ★ v1.7.13.134: Server-side Pro+ tier check */
  async setDisguise(
    roomId: string,
    targetUserId: string,
    disguise: { display_name: string; avatar_url: string; applied_by: string } | null,
  ): Promise<void> {
    const { data: prof } = await supabase
      .from('profiles').select('is_admin, subscription_tier').eq('id', targetUserId).maybeSingle();
    const effTier = prof?.is_admin ? 'Pro' : migrateLegacyTier(prof?.subscription_tier);
    if (!isTierAtLeast(effTier, 'Pro')) {
      throw new Error('Kılık değiştirme için Pro üyelik gerekiyor.');
    }
    await supabase
      .from('room_participants')
      .update({
        disguise: disguise
          ? { ...disguise, applied_at: new Date().toISOString() }
          : null,
      })
      .eq('room_id', roomId)
      .eq('user_id', targetUserId);
  },

  /** 🔒 Oda Kilidi — Yeni girişleri engelle/aç — ★ D1 FIX: Yetki kontrolü eklendi */
  async setRoomLock(roomId: string, locked: boolean, executorId?: string): Promise<void> {
    if (executorId) await _requireRole(roomId, executorId, ['owner', 'moderator']);
    const { data: room } = await supabase
      .from('rooms')
      .select('room_settings')
      .eq('id', roomId)
      .single();
    const existingSettings = (room?.room_settings || {}) as any;
    await supabase
      .from('rooms')
      .update({ room_settings: { ...existingSettings, is_locked: locked } })
      .eq('id', roomId);
  },

  /** 🚫 Kullanıcıyı odadan at — ★ D2+B5 FIX: Yetki kontrolü + doğru listener_count */
  async kickUser(roomId: string, userId: string, executorId?: string): Promise<void> {
    if (executorId) await _requireRole(roomId, executorId, ['owner', 'moderator']);
    // ★ B5 FIX: Rolü kontrol et, sadece listener/spectator ise count düşür
    const { data: participant } = await supabase
      .from('room_participants')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    await supabase
      .from('room_participants')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', userId);
    if (participant && (participant.role === 'listener' || participant.role === 'spectator')) {
      const { error: _rpcErr } = await supabase.rpc('decrement_listener_count', { room_id_input: roomId });
      if (_rpcErr && __DEV__) console.warn('[Room] decrement_listener_count hatası:', _rpcErr.message);
    }
  },

  /**
   * ⛔ Geçici ban (dakika cinsinden)
   */
  async banTemporary(roomId: string, userId: string, durationMinutes: number, executorId?: string): Promise<void> {
    if (executorId) await _requireRole(roomId, executorId, ['owner', 'moderator']);

    // ★ v43 + v44 (2026-04-20): Atomic RPC + executor_id fallback (Supabase JWKS
    //   Firebase'i doğrulamıyorsa client'ın söylediği ID trust edilir).
    const { error } = await supabase.rpc('ban_user_atomic', {
      p_room_id: roomId,
      p_user_id: userId,
      p_ban_type: 'temporary',
      p_duration_minutes: durationMinutes,
      p_executor_id: executorId || null,
    });
    if (error) {
      // RPC yoksa (deploy edilmedi) legacy flow fallback
      if (/function .* does not exist|42883/i.test(error.message || '')) {
        const banUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        const { error: banError } = await supabase.from('room_bans').upsert({
          room_id: roomId, user_id: userId, ban_type: 'temporary', expires_at: banUntil,
        }, { onConflict: 'room_id,user_id' });
        if (banError) throw new Error(`Ban kaydedilemedi: ${banError.message}`);
        await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', userId);
        return;
      }
      throw new Error(error.message);
    }
    // listener_count adjust RPC içinde yapılıyor
  },

  /**
   * ⛔ Kalıcı ban (sadece owner)
   */
  async banPermanent(roomId: string, userId: string, executorId?: string): Promise<void> {
    if (executorId) await _requireRole(roomId, executorId, ['owner', 'moderator']);

    // ★ v43 + v44 (2026-04-20): Atomic RPC + executor fallback.
    const { error } = await supabase.rpc('ban_user_atomic', {
      p_room_id: roomId,
      p_user_id: userId,
      p_ban_type: 'permanent',
      p_executor_id: executorId || null,
    });
    if (error) {
      if (/function .* does not exist|42883/i.test(error.message || '')) {
        const { error: banError } = await supabase.from('room_bans').upsert({
          room_id: roomId, user_id: userId, ban_type: 'permanent', expires_at: null,
        }, { onConflict: 'room_id,user_id' });
        if (banError) throw new Error(`Ban kaydedilemedi: ${banError.message}`);
        await supabase.from('room_participants').delete().eq('room_id', roomId).eq('user_id', userId);
        return;
      }
      throw new Error(error.message);
    }
  },

  /** Ban kontrolü — kullanıcı bu odada banlı mı? */
  async isBanned(roomId: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('room_bans')
        .select('id, ban_type, expires_at')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        if (__DEV__) console.warn('[Ban] isBanned kontrol hatası:', error.message);
        return false;
      }
      if (!data) return false;
      if (data.ban_type === 'permanent') return true;
      if (data.expires_at && new Date(data.expires_at) > new Date()) return true;
      return false;
    } catch { return false; }
  },

  /** Spectator → Listener yükseltme */
  async promoteToListener(roomId: string, userId: string): Promise<void> {
    await supabase
      .from('room_participants')
      .update({ role: 'listener' })
      .eq('room_id', roomId)
      .eq('user_id', userId);
  },

  /**
   * ★ v110 (6 May 2026): Üyelik planları ile hizalı otomatik temizlik.
   *   - Free (non-persistent) → expires_at hit ise klasik kapat
   *   - Plus (persistent)     → expires_at hit ise dondur (wakeUp için)
   *   - Pro (expires_at=null) → bu kontrol etkilemez
   *
   *   Server-side cron (v110 migration) zaten 7/24 çalışır — bu fonksiyon
   *   keşfet sekmesi açıldığında "anlık" temizlik için fallback.
   */
  async autoCloseExpired(): Promise<number> {
    const now = new Date().toISOString();
    let closedCount = 0;

    // ═══ 1. expires_at süresi dolmuş odalar (TÜM tier) ═══
    const { data: expired } = await supabase
      .from('rooms')
      .select('id, is_persistent, room_settings')
      .eq('is_live', true)
      .not('expires_at', 'is', null)
      .lte('expires_at', now);

    if (expired && expired.length > 0) {
      for (const room of expired) {
        const isPersistent = !!(room as any).is_persistent;
        if (isPersistent) {
          // Plus persistent → dondur (oda kaydı kalır, wakeUpRoom ile dönülebilir)
          const settings = { ...((room as any).room_settings || {}), frozen_at: new Date().toISOString(), remaining_ms: 0 };
          await supabase.from('rooms')
            .update({ is_live: false, listener_count: 0, expires_at: null, room_settings: settings })
            .eq('id', room.id);
          if (__DEV__) console.log(`[AutoClose] Süresi dolan persistent oda donduruldu: ${room.id}`);
        } else {
          // Free non-persistent → klasik kapat
          await supabase.from('rooms')
            .update({ is_live: false, listener_count: 0 })
            .eq('id', room.id);
          if (__DEV__) console.log(`[AutoClose] Süresi dolan Free oda kapatıldı: ${room.id}`);
        }
        await supabase.from('room_participants').delete().eq('room_id', room.id);
        closedCount++;
      }
    }

    // ═══ 2. 5+ dakika boş kalan odalar — SADECE Free non-persistent ═══
    // ★ 2026-05-10 FIX: Plus/Pro persistent odalar muaf — host minimize edip
    //   geri döndüğünde room_participants anlık boş olabiliyor (race), eski kod
    //   bu pencerede odayı öldürüp "Bağlantı kurulamadı" 403 hatasına yol açıyordu.
    //   SQL cron (close_expired_free_rooms) zaten Free + 30dk filtresi uyguluyor;
    //   client interval bu kadar agresif olmamalı.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: aliveRooms } = await supabase
      .from('rooms')
      .select('id, owner_tier, is_persistent')
      .eq('is_live', true)
      .lt('created_at', fiveMinAgo);

    if (aliveRooms && aliveRooms.length > 0) {
      // Sadece Free + non-persistent odaları aday al
      const candidates = (aliveRooms as any[]).filter(r =>
        !r.is_persistent &&
        !['Plus', 'Pro'].includes(r.owner_tier || 'Free')
      );
      if (candidates.length > 0) {
        const ids = candidates.map(r => r.id);
        const { data: activeParticipants } = await supabase
          .from('room_participants')
          .select('room_id')
          .in('room_id', ids);

        const roomsWithParticipants = new Set((activeParticipants || []).map((p: any) => p.room_id));

        for (const room of candidates) {
          if (!roomsWithParticipants.has(room.id)) {
            await supabase.from('rooms').update({ is_live: false, listener_count: 0 }).eq('id', room.id);
            await supabase.from('room_participants').delete().eq('room_id', room.id);
            closedCount++;
            if (__DEV__) console.log(`[AutoClose] 5dk+ boş Free oda kapatıldı: ${room.id}`);
          }
        }
      }
    }

    return closedCount;
  },

  // ════════════════════════════════════════════════════════════
  // ERİŞİM İSTEKLERİ (Davetli/Kapalı Odalar)
  // ════════════════════════════════════════════════════════════

  async sendAccessRequest(roomId: string, userId: string): Promise<{ sent: boolean; targetRole: string }> {
    const { data: participants } = await supabase
      .from('room_participants')
      .select('user_id, role')
      .eq('room_id', roomId)
      .in('role', ['owner', 'moderator', 'speaker'])
      .order('role', { ascending: true });

    const rolePriority: Record<string, number> = { owner: 0, moderator: 1, speaker: 2 };
    const sorted = (participants || []).sort((a, b) =>
      (rolePriority[a.role] ?? 9) - (rolePriority[b.role] ?? 9)
    );
    const target = sorted[0];
    const targetRole = target?.role || 'owner';

    await supabase.from('room_access_requests').insert({
      room_id: roomId,
      user_id: userId,
      status: 'pending',
      target_role: targetRole,
    });

    // ★ v92.14 (1 May 2026): FCM push KALDIRILDI — host odadayken realtime
    //   subscription zaten anlık güncelliyor (PlusMenu > Katılım İstekleri badge +
    //   accordion). Off-room push isteği duplikasyon ve sistem tepsisi spam'i.
    //   target değişkeni geriye uyumluluk için duruyor (ileride opt-in push için).
    void target;

    return { sent: true, targetRole };
  },

  async getRoomAccessRequests(roomId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('room_access_requests')
        .select('*, user:profiles!user_id(*)')
        .eq('room_id', roomId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) return [];
      return data || [];
    } catch { return []; }
  },

  async acceptRequest(requestId: string, handlerId: string): Promise<void> {
    const { data } = await supabase
      .from('room_access_requests')
      .update({ status: 'accepted', handled_by: handlerId })
      .eq('id', requestId)
      .select('room_id, user_id')
      .single();

    if (data) {
      await supabase.from('room_participants').insert({
        room_id: data.room_id,
        user_id: data.user_id,
        role: 'listener',
        is_muted: true,
      });
    }
  },

  async rejectRequest(requestId: string, handlerId: string): Promise<void> {
    await supabase
      .from('room_access_requests')
      .update({ status: 'rejected', handled_by: handlerId })
      .eq('id', requestId);
  },

  // ════════════════════════════════════════════════════════════
  // ODA KAPATMA
  // ════════════════════════════════════════════════════════════

  async closeRoom(roomId: string): Promise<void> {
    // ★ v1.7.13.140: Sistem odaları (Soprano Lobi) hiç kapanmaz — 7/24 açık.
    if (isSystemRoom(roomId)) return;
    await supabase.from('rooms').update({ is_live: false, listener_count: 0 }).eq('id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
  },
};
