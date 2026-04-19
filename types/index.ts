/**
 * SopranoChat — Merkezi Tip Tanımları
 * ═══════════════════════════════════════════════════
 * Tüm uygulama genelinde kullanılan tipler burada tanımlanır.
 *
 * Mimari:
 *   - Tier sistemi: Free/Plus/Pro (3 katman)
 *   - Rol hiyerarşisi: owner/moderator/speaker/listener/spectator/guest/banned (7 katman)
 *   - 3 katmanlı katılımcı modeli: Sahne / Dinleyici Grid / Seyirci
 *   - 35 owner permission tanımı
 *   - SP (Sistem Puanları) tek ekonomi birimi
 */

// ============================================
// ABONELİK TIER SİSTEMİ (3 Katman)
// ============================================

/**
 * Abonelik bazlı 3 katmanlı tier sistemi.
 * Oda limitleri, yetki hiyerarşisi ve kişiselleştirme
 * tamamen bu tier'a bağlıdır.
 *
 * Free → Ücretsiz temel deneyim
 * Plus → Gelişmiş özellikler, daha yüksek limitler
 * Pro  → Sınırsız güç, maksimum prestij
 */
export type SubscriptionTier = 'Free' | 'Plus' | 'Pro';

/** Alias — tüm kod tabanında uyumluluk */
export type TierName = SubscriptionTier;

/**
 * Bilinmeyen veya eski tier isimlerini güncel sisteme map eder.
 * Legacy 5-tier → 3-tier dönüşümü:
 *   Bronze/Silver → Plus
 *   Gold/VIP      → Pro
 * Bilinmeyen tier → Free.
 */
export function migrateLegacyTier(oldTier: string | null | undefined): SubscriptionTier {
  if (!oldTier) return 'Free';
  const mapping: Record<string, SubscriptionTier> = {
    // Yeni sistem
    'Free': 'Free',
    'Plus': 'Plus',
    'Pro': 'Pro',
    // Legacy 5-tier → 3-tier
    'Bronze': 'Plus',
    'Silver': 'Plus',
    'Gold': 'Pro',
    'VIP': 'Pro',
    // Çok eski eşleşmeler
    'Premium': 'Pro',
    'Newcomer': 'Free',
    'Plat': 'Pro',
    'Diamond': 'Pro',
  };
  return mapping[oldTier] || 'Free';
}

// ============================================
// PROFİL
// ============================================
export type PrivacyMode = 'public' | 'followers_only' | 'private';

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string;
  bio: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  birth_date?: string | null;

  // ── Abonelik ──
  /** Aktif abonelik tier'ı (RevenueCat tarafından yönetilir) */
  subscription_tier: SubscriptionTier;
  /** Abonelik bitiş tarihi (null = süresiz / Free) */
  subscription_expires_at?: string | null;

  // ── Ekonomi (SP-Only) ──
  /** Sistem Puanları — tek ekonomi birimi. Boost, kozmetik, keşfet öne çıkarma için harcanır */
  system_points: number;

  // ── Gizlilik ──
  /** Instagram tarzı gizlilik modu */
  is_private: boolean;
  privacy_mode: PrivacyMode;
  /** Sahip olduğu odaları profilinde gizle */
  hide_owned_rooms?: boolean;

  // ── Durum ──
  is_online: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  last_seen: string;
  created_at: string;

  // ── Kozmetik ──
  active_frame?: string | null;
  /** Avatar çerçevesi */
  avatar_frame?: string | null;
  active_chat_color?: string | null;
  active_entry_effect?: string | null;
  profile_boost_expires_at?: string | null;
  /** Pro+ banner resmi URL'i */
  banner_url?: string | null;
};

// ============================================
// ODA
// ============================================
export type RoomCategory = 'chat' | 'music' | 'game' | 'book' | 'film' | 'tech' | 'sport' | 'other';
export type RoomType = 'open' | 'closed' | 'invite';
export type RoomLanguage = 'tr' | 'en' | 'ar' | 'ku' | 'de' | 'fr' | 'ru' | 'other';

/** Sahne düzeni seçenekleri */
export type StageLayout = 'grid' | 'spotlight' | 'theater';

/** Oda müziği yapılandırması */
export type RoomMusicConfig = {
  mode: 'url' | 'preset';
  /** Kullanıcının girdiği stream URL */
  url?: string;
  /** Hazır listeden seçilen müzik ID'si */
  preset_id?: string;
  /** Ses seviyesi (0–100) */
  volume: number;
  /** Döngü modu */
  loop: boolean;
};

export type Room = {
  id: string;
  name: string;
  description: string;
  category: RoomCategory;
  type: RoomType;
  host_id: string;
  is_live: boolean;
  listener_count: number;
  /** Runtime alan — room_participants tablosundan türetilen gerçek katılımcı sayısı.
   *  DB'de tutulmaz; myrooms/home yükleme sırasında doldurur. */
  participant_count?: number;
  max_speakers: number;
  created_at: string;
  expires_at?: string | null;
  theme_id?: string | null;
  host?: Profile;

  // ── Kalıcılık & Kapasite ──
  is_persistent?: boolean;
  /** Dinleyici grid kapasitesi (her tier'da max 20) */
  max_listeners?: number;
  /** Seyirci kapasitesi (grid'de görünmez). 999 = sınırsız */
  max_spectators?: number;
  max_cameras?: number;
  max_moderators?: number;
  /** Oda sahibinin abonelik tier'ı (oda oluşturulduğundaki anlık değer) */
  owner_tier?: SubscriptionTier;

  // ── Etiket & Dil ──
  tags?: string[];
  language?: RoomLanguage;
  room_settings?: RoomSettings;

  // ── Keşfet & Boost ──
  boost_expires_at?: string | null;
  /** SP ile biriken boost puanı — keşfet sıralama ağırlığı */
  boost_score?: number;
  total_gifts?: number;

  // ── Kişiselleştirme ──
  /** Oda kart resmi (Pro+) */
  room_image_url?: string | null;
  /** Oda iç renk teması (Plus+) — JSON { primary, secondary, accent } */
  room_color_theme?: RoomColorTheme | null;
  /** Şifreli oda parolası (Plus+) */
  room_password?: string | null;

  // ── Sistem Odaları ──
  /** Bu oda SopranoChat tarafından oluşturulmuş bir sistem odası mı? */
  is_system_room?: boolean;
  /** Yapay zeka moderasyonlu mu? (sistem odaları için true) */
  ai_moderated?: boolean;
};

export type RoomColorTheme = {
  primary: string;
  secondary: string;
  accent: string;
};

export type RoomSettings = {
  welcome_message?: string;
  rules?: string | string[];
  auto_mute_on_join?: boolean;
  allow_hand_raise?: boolean;
  /** Asıl oda sahibi ID'si — host devri sırasında kullanılır */
  original_host_id?: string;
  /** Slow mode: mesaj aralığı (saniye). 0 = kapalı */
  slow_mode_seconds?: number;
  /** Oda kilitli mi? (yeni katılımcı giriş engeli) */
  is_locked?: boolean;
  /** Sahne kapasitesi (owner dahil) — Pro: max 13 */
  max_stage_capacity?: number;
  /** Konuşma modu: free_for_all | permission_only | selected_only (Pro) */
  speaking_mode?: 'free_for_all' | 'permission_only' | 'selected_only';

  // ── Gelişmiş Alanlar ──
  /** Sahne düzeni (Plus+) */
  stage_layout?: StageLayout;
  /** Oda müziği yapılandırması (Pro+) */
  room_music?: RoomMusicConfig | null;
  /** Yalnızca takipçilere açık mod (Pro+) */
  followers_only?: boolean;
  /** Minimum yaş filtresi (Plus+). 0 = kapalı */
  age_filter_min?: number;
  /** Dil filtresi (Plus+). Boş dizi = filtre yok */
  language_filter?: RoomLanguage[];

  // ── Pro Alanlar ──
  /** Planlı oda başlangıç zamanı (ISO string) */
  scheduled_at?: string;
  /** Kayıt aktif mi (Pro) */
  is_recording?: boolean;
  /** Kayıt dosyası URL'si */
  recording_url?: string;
  /** Önemli anlar / clip işaretleri */
  highlights?: RoomHighlight[];
  /** SP cinsinden giriş ücreti. 0 = ücretsiz (Pro) */
  entry_fee_sp?: number;
  /** Bağış kabul aktif mi (Pro+) */
  donations_enabled?: boolean;

  // ── Kart & Görsel Alanlar ──
  /** Oda kart resmi (keşfet ekranı) */
  card_image_url?: string | null;
  /** Oda kapak resmi (oda içi) */
  room_image_url?: string | null;
  /** Oda kapak resmi (alternatif alan) */
  cover_image_url?: string | null;
  /** Oda dili (tek dil seçimi) */
  room_language?: RoomLanguage;
  /** Yaş kısıtlaması (+18) */
  age_restricted?: boolean;
  /** Oda müzik parçası URL'si (basit mod) */
  music_track?: string | null;
};

/** Oda içi önemli an işareti (Pro) */
export type RoomHighlight = {
  id: string;
  /** Kayıt başlangıcından itibaren saniye */
  timestamp: number;
  label: string;
  created_by: string;
  created_at: string;
};

// ============================================
// ODA KATILIMCISI & YETKİ SİSTEMİ
// ============================================

/**
 * Oda içi rol hiyerarşisi (yüksekten düşüğe):
 *   owner > moderator > speaker > listener > spectator > guest > banned
 *
 * Owner: Mutlak güç — her şeyi yapabilir, hiç kimse onu alt edemez.
 * Moderator: Owner tarafından atanır — mute, kick, chat_block.
 * Speaker: Sahne erişimi — mikrofon/kamera.
 * Listener: Dinleyici grid (max 20) — chat var, mic/cam yok.
 * Spectator: Seyirci (sınırsız) — sadece izler/yazar, grid'de gösterilmez.
 * Guest: Giriş yapmamış / doğrulanmamış kullanıcı.
 * Banned: Odadan atılmış (geçici/kalıcı).
 *
 * NOT: Tüm oda sahipleri 'owner' rolündedir.
 * DB kayıtlarındaki 'host' değeri normalizeRole() ile 'owner'a çevrilir.
 */
export type ParticipantRole = 'owner' | 'moderator' | 'speaker' | 'listener' | 'spectator' | 'guest' | 'banned';

/**
 * Rol seviye numarası — yetki karşılaştırması için.
 * Daha yüksek = daha yetkili. Bir kullanıcı yalnızca
 * kendinden düşük seviyedeki kullanıcıları yönetebilir.
 */
export const ROLE_LEVEL: Record<string, number> = {
  banned: 0,
  guest: 1,
  spectator: 2,
  listener: 3,
  speaker: 4,
  moderator: 5,
  owner: 6,
};

/**
 * 'host' rolünü 'owner'a çevirir.
 * Mevcut DB kayıtlarında 'host' olarak kaydedilmiş rolleri normalize eder.
 */
export function normalizeRole(role: string): ParticipantRole {
  if (role === 'host') return 'owner';
  if (role === 'pending_speaker') return 'listener'; // el kaldıranlar listener olarak görünür
  if (Object.keys(ROLE_LEVEL).includes(role)) return role as ParticipantRole;
  return 'spectator'; // Bilinmeyen rol → spectator
}

export type RoomParticipant = {
  id: string;
  room_id: string;
  user_id: string;
  role: ParticipantRole;
  is_muted: boolean;
  muted_until?: string | null;
  is_chat_muted?: boolean;
  /** Görünmezlik modu (sadece owner) — katılımcı listesinde gizlenir */
  is_ghost?: boolean;
  /** Kılık değiştirme (owner tarafından uygulanan geçici avatar/isim) */
  disguise?: ParticipantDisguise | null;
  joined_at: string;
  /** El kaldırma zamanı (sahneye çıkma isteği sıralaması için) */
  hand_raised_at?: string | null;
  /** ★ v32 Caretaker: Sahipsiz odada süreli sahne bitiş zamanı.
   *  Aktif caretaker: rol='speaker' AND stage_expires_at > now()
   *  Cooldown: rol='listener' AND stage_expires_at < now() + 60sn
   *  Normal speaker: stage_expires_at = NULL (owner tarafından davet edilmiş) */
  stage_expires_at?: string | null;
  user?: Profile;
};

export type ParticipantDisguise = {
  display_name: string;
  avatar_url: string;
  /** Kılık değiştirmeyi uygulayan owner'ın ID'si */
  applied_by: string;
  applied_at: string;
};

// ============================================
// ODA SAHİBİ YETKİLERİ (35 Permission)
// ============================================

/**
 * Oda sahibinin (ve moderatörün) kullanabileceği aksiyonlar.
 * Her aksiyon, minimum rol seviyesi ve hedef gereklilikleriyle tanımlanır.
 * 35 permission merkezi kaynağı.
 */
export type OwnerPermission =
  // ── Ses/Görüntü Kontrolü ──
  | 'mute_mic'              // Kullanıcının mikrofonunu kapat
  | 'mute_camera'           // Kullanıcının kamerasını kapat
  // ── Moderasyon ──
  | 'kick'                  // Odadan at (yeniden katılabilir)
  | 'ban_temporary'         // Geçici ban (15dk / 1saat / 24saat)
  | 'ban_permanent'         // Kalıcı ban (sadece owner)
  | 'chat_block'            // Yazı sohbetini engelle
  | 'slow_mode'             // Chat hız limiti aç/kapat
  | 'timed_mute'            // Zamanlı susturma (5dk/15dk/1saat)
  | 'pin_chat_message'      // Chat mesajını sabitle
  | 'clear_chat'            // Tüm chat geçmişini temizle
  // ── Rol Yönetimi ──
  | 'promote_speaker'       // Dinleyiciyi sahneye çıkar
  | 'demote_speaker'        // Konuşmacıyı sahneden indir
  | 'promote_listener'      // Seyirciyi dinleyici grid'e çıkar
  | 'set_moderator'         // Moderatör ata
  | 'remove_moderator'      // Moderatörlüğü kaldır
  | 'spotlight_user'        // Kullanıcıyı sahne spot ışığına al
  | 'transfer_ownership'    // Oda sahipliğini devret
  // ── Oda Düzenleme ──
  | 'edit_room_name'        // Oda ismini düzenle
  | 'edit_welcome_message'  // Hoş geldin mesajını düzenle
  | 'room_announce'         // Oda geneline duyuru gönder
  | 'invite_user'           // Kullanıcıyı odaya davet et
  | 'set_room_password'     // Odaya şifre koy
  | 'share_room_link'       // Oda davet linki paylaş
  // ── Katılımcı Aksiyonları ──
  | 'request_stage'         // Sahneye çıkma isteği gönder (listener)
  // ── Plus+ Özellikler ──
  | 'lock_room'             // Odayı anlık kilitle (yeni giriş engeli)
  | 'change_theme'          // Oda temasını değiştir
  | 'select_avatar_frame'   // Avatar çerçevesi seç
  | 'set_stage_layout'      // Sahne düzeni değiştir (grid/spotlight/theater)
  | 'set_age_filter'        // Yaş filtresi uygula
  | 'set_language_filter'   // Dil filtresi uygula
  // ── Pro+ Özellikler ──
  | 'change_room_image'     // Oda kapak fotoğrafı değiştir
  | 'set_room_music'        // Oda müziği aç/kapat
  | 'set_followers_only'    // Yalnızca takipçilere açık mod
  // ── Pro Özellikler ──
  | 'ghost_mode'            // Görünmez olarak odada bulun
  | 'disguise_user'         // Kullanıcının görüntüsünü/adını geçici değiştir
  | 'mute_all'              // Tüm sahnedeki konuşmacıları toplu sustur
  | 'record_room'           // Oda ses kaydı başlat/durdur
  | 'set_entry_fee'         // SP giriş ücreti belirle
  | 'room_analytics'        // Canlı oda istatistikleri görüntüle
  ;

/**
 * Yetki tanımı — her permission için minimum rol ve kısıtlamalar.
 */
export interface PermissionDefinition {
  /** Bu aksiyonu gerçekleştirmek için minimum rol seviyesi */
  minRole: ParticipantRole;
  /** Hedef kullanıcı gerekli mi? (yoksa oda geneli aksiyon) */
  requiresTarget: boolean;
  /** Hedef kullanıcının rolü aktörden düşük mü olmalı? */
  requiresLowerTarget: boolean;
  /** Bu aksiyon UI'da kendine uygulanabilir mi? */
  hiddenOnSelf: boolean;
  /** Sadece belirli tier'lara açık mı? (null = herkese) */
  minTier?: SubscriptionTier | null;
}

/**
 * Tüm yetki tanımları — 35 permission merkezi kaynağı.
 * UI context menüleri ve backend guard'ları bunu kullanır.
 */
export const ALL_PERMISSIONS: Record<OwnerPermission, PermissionDefinition> = {
  // ── Ses/Görüntü ──
  mute_mic:             { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: false },
  mute_camera:          { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: false },
  // ── Moderasyon ──
  kick:                 { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true },
  ban_temporary:        { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true, minTier: 'Plus' },
  ban_permanent:        { minRole: 'owner',     requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true, minTier: 'Pro' },
  chat_block:           { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true, minTier: 'Plus' },
  slow_mode:            { minRole: 'moderator', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  timed_mute:           { minRole: 'owner',     requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true },  // T-3: Free oda sahibi de temel mute yapabilir (moderatörler Plus+ odada)
  pin_chat_message:     { minRole: 'moderator', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  clear_chat:           { minRole: 'owner',     requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  // ── Rol Yönetimi ──
  promote_speaker:      { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: false, hiddenOnSelf: true },
  demote_speaker:       { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true },
  promote_listener:     { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: false, hiddenOnSelf: true },
  set_moderator:        { minRole: 'owner',     requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true, minTier: 'Plus' },
  remove_moderator:     { minRole: 'owner',     requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true, minTier: 'Plus' },
  spotlight_user:       { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  transfer_ownership:   { minRole: 'owner',     requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true, minTier: 'Plus' },
  // ── Oda Düzenleme ──
  edit_room_name:       { minRole: 'owner',     requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false },
  edit_welcome_message: { minRole: 'owner',     requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  room_announce:        { minRole: 'owner',     requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  invite_user:          { minRole: 'moderator', requiresTarget: true,  requiresLowerTarget: false, hiddenOnSelf: true },
  set_room_password:    { minRole: 'owner',     requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  share_room_link:      { minRole: 'speaker',   requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false },
  // ── Katılımcı ──
  request_stage:        { minRole: 'listener',  requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false },
  // ── Plus+ ──
  lock_room:            { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  change_theme:         { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  select_avatar_frame:  { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  set_stage_layout:     { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  set_age_filter:       { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  set_language_filter:  { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Plus' },
  // ── Pro ──
  change_room_image:    { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  set_room_music:       { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  set_followers_only:   { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  ghost_mode:           { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  disguise_user:        { minRole: 'owner', requiresTarget: true,  requiresLowerTarget: true,  hiddenOnSelf: true,  minTier: 'Pro' },
  mute_all:             { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  record_room:          { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  set_entry_fee:        { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
  room_analytics:       { minRole: 'owner', requiresTarget: false, requiresLowerTarget: false, hiddenOnSelf: false, minTier: 'Pro' },
};

// ============================================
// MESAJLAŞMA
// ============================================
export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string | null;
  voice_url?: string | null;
  voice_duration?: number | null;
  is_read: boolean;
  /** Soft-delete flag — true ise gönderen tarafça silinmiş (UI'da gösterme). */
  is_deleted?: boolean;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
};

export type InboxItem = {
  partner_id: string;
  partner_name: string;
  partner_avatar: string;
  partner_is_online: boolean;
  /** ★ Tier ring tutarlılığı — mesajlar sayfasında doğru çerçeve rengi */
  partner_tier?: string;
  /** Karşı tarafın son görülme zamanı (ISO) — offline iken "2s önce" göstermek için */
  partner_last_seen?: string;
  last_message_content: string;
  last_message_time: string;
  unread_count: number;
  /** ★ WhatsApp tik göstergesi: son mesaj benim mi? */
  is_last_msg_mine?: boolean;
  /** ★ WhatsApp tik göstergesi: son mesaj okundu mu? */
  is_last_msg_read?: boolean;
  /** ★ v33: conversation_state entegrasyonu */
  is_pinned?: boolean;
  is_archived?: boolean;
  is_muted?: boolean;
};

// ============================================
// EKONOMİ — TEK PARA BİRİMİ (SP)
// ============================================

/** Sistem Puanları (SP) işlem tipleri */
export type SystemPointsTransactionType =
  | 'daily_login'           // Günlük giriş
  | 'prime_time_return'     // Prime-time (19-22) geri dönüş
  | 'stage_time'            // Sahnede vakit geçirme
  | 'camera_time'           // Kamera açık vakit
  | 'message_sent'          // Mesaj gönderme
  | 'room_create'           // Oda oluşturma
  | 'follower_gain'         // Yeni oda takipçisi
  | 'ccu_milestone'         // CCU milestone (10/25/50)
  | 'subscription_purchase' // Üyelik satın alma
  | 'store_purchase'        // Mağaza alışverişi (bonus)
  | 'referral'              // Referral bonus
  | 'owner_bonus'           // Oda sahibi CCU/takipçi bonusu
  | 'room_boost'            // Oda boost harcaması (negatif)
  | 'profile_boost'         // Profil boost harcaması (negatif)
  | 'frame_unlock'          // Çerçeve kilit açma (negatif)
  | 'effect_unlock'         // Efekt kilit açma (negatif)
  | 'daily_checkin';        // Günlük check-in ödülü

export type SystemPointsTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: SystemPointsTransactionType;
  description: string;
  created_at: string;
};

// ============================================
// MAĞAZA (SP-Only)
// ============================================
export type ItemType = 'profile_frame' | 'room_theme' | 'entry_effect' | 'chat_bubble' | 'avatar_frame';
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type StoreItem = {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  /** SP cinsinden fiyat */
  price: number;
  image_url: string;
  rarity: ItemRarity;
  is_limited: boolean;
  is_active: boolean;
  /** Minimum abonelik tier'ı gereksinimi (null = herkese açık) */
  min_tier?: SubscriptionTier | null;
  created_at: string;
};

export type UserPurchase = {
  id: string;
  user_id: string;
  item_id: string;
  purchased_at: string;
  item?: StoreItem;
};



// ============================================
// BİLDİRİMLER
// ============================================
export type NotificationType =
  | 'room_live'
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'tier_up'
  | 'room_invite'
  | 'room_invite_accepted'
  | 'room_invite_rejected'
  | 'room_request'
  | 'upsell'
  | 'system';

export type Notification = {
  id: string;
  user_id: string;
  sender_id?: string;
  type: NotificationType;
  reference_id?: string;
  body?: string;
  is_read: boolean;
  created_at: string;
};

// ============================================
// ODA BAN SİSTEMİ
// ============================================
export type RoomBanDuration = '15m' | '1h' | '24h' | 'permanent';

export type RoomBan = {
  id: string;
  room_id: string;
  user_id: string;
  banned_by: string;
  reason?: string;
  duration: RoomBanDuration;
  expires_at?: string | null; // null = kalıcı
  created_at: string;
};

// ============================================
// ERİŞİM İSTEĞİ ZİNCİRİ
// ============================================

/**
 * Davetli/kapalı odalara giriş isteği.
 * Hiyerarşik sıralama: Owner → Moderator → Speaker
 */
export type AccessRequestTarget = 'owner' | 'moderator' | 'speaker';

export type RoomAccessRequest = {
  id: string;
  room_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  /** İsteğin yönlendirildiği hedef rol */
  target_role: AccessRequestTarget;
  /** İsteği işleyen kişinin ID'si (kabul/red eden) */
  handled_by?: string | null;
  created_at: string;
};

// ============================================
// UPSELL TETİKLEYİCİLERİ
// ============================================
export type UpsellTrigger =
  | 'daily_room_limit'
  | 'room_duration_expired'
  | 'room_type_locked'
  | 'customization_locked'
  | 'stage_capacity_full'
  | 'system_room_prompt'
  | 'moderator_limit'
  | 'camera_limit'
  | 'listener_grid_full'
  | 'feature_locked';

export type UpsellEvent = {
  trigger: UpsellTrigger;
  current_tier: SubscriptionTier;
  required_tier: SubscriptionTier;
  message: string;
};

// ============================================
// SUPABASE REALTİME PAYLOAD TİPLERİ
// ============================================

/** Supabase postgres_changes payload — `payload: any` yerine kullan */
export type RealtimePayload<T> = {
  new: T;
  old: Partial<T>;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  commit_timestamp: string;
};
