/**
 * SopranoChat — Analytics Event Sabitleri
 * ═══════════════════════════════════════════════════
 * TÜM analytics event isimleri burada tanımlı. Magic string YASAK.
 *
 * Firebase Analytics kuralları:
 *  - max 40 karakter
 *  - sadece a-z, 0-9, _ — büyük harf, tire, boşluk yok
 *  - reserved prefix'ler: firebase_, google_, ga_
 *  - parametre value max 100 char
 */

// ═══════════════════════════════════════════════════════════
// TEMEL OLAYLAR
// ═══════════════════════════════════════════════════════════

export const Events = {
  // ─── Authentication ───────────────────────────────────────
  /** Kayıt formu açıldı */
  SIGNUP_STARTED: 'signup_started',
  /** Kayıt başarılı tamamlandı (onboarding bittikten sonra) */
  SIGNUP_COMPLETED: 'signup_completed',
  /** Kayıt yarıda bırakıldı (hangi adımda) */
  SIGNUP_DROPPED: 'signup_dropped',
  /** Login başarılı */
  LOGIN_SUCCESS: 'login_success',
  /** Logout */
  LOGOUT: 'logout',

  // ─── Room Lifecycle ───────────────────────────────────────
  /** Oda oluşturma sheet açıldı */
  ROOM_CREATE_STARTED: 'room_create_started',
  /** Oda başarılı oluşturuldu */
  ROOM_CREATED: 'room_created',
  /** Odaya katıldı (host veya dinleyici) */
  ROOM_JOINED: 'room_joined',
  /** Odadan ayrıldı */
  ROOM_LEFT: 'room_left',
  /** Oda donduruldu */
  ROOM_FROZEN: 'room_frozen',
  /** Oda silindi */
  ROOM_DELETED: 'room_deleted',
  /** Pasif odadan tekrar aktifleştirildi */
  ROOM_REACTIVATED: 'room_reactivated',

  // ─── Speaker / Stage ──────────────────────────────────────
  /** El kaldırıldı */
  HAND_RAISED: 'hand_raised',
  /** Sahneye davet kabul edildi */
  STAGE_INVITE_ACCEPTED: 'stage_invite_accepted',
  /** Sahneden indirildi */
  REMOVED_FROM_STAGE: 'removed_from_stage',

  // ─── DM / Messaging ───────────────────────────────────────
  /** DM gönderildi */
  DM_SENT: 'dm_sent',
  /** DM açıldı (read) */
  DM_OPENED: 'dm_opened',
  /** Sesli mesaj gönderildi (Faz 3) */
  VOICE_MSG_SENT: 'voice_msg_sent',
  /** Sesli mesaj dinlendi (Faz 3) */
  VOICE_MSG_PLAYED: 'voice_msg_played',

  // ─── SP Economy ───────────────────────────────────────────
  /** SP gönderme sheet açıldı */
  SP_DONATE_STARTED: 'sp_donate_started',
  /** SP başarılı gönderildi */
  SP_DONATED: 'sp_donated',
  /** SP alındı */
  SP_RECEIVED: 'sp_received',
  /** Hediye animasyonu kullanıldı (Faz 7) */
  GIFT_SENT: 'gift_sent',

  // ─── Social ───────────────────────────────────────────────
  /** Arkadaşlık isteği gönderildi */
  FRIEND_REQUEST_SENT: 'friend_request_sent',
  /** Arkadaşlık kabul edildi */
  FRIEND_ACCEPTED: 'friend_accepted',
  /** Takip edildi (Faz 4) */
  FOLLOW_ADDED: 'follow_added',
  /** Engellenme */
  USER_BLOCKED: 'user_blocked',
  /** Engelleme kaldırıldı */
  USER_UNBLOCKED: 'user_unblocked',

  // ─── Premium / Monetization ───────────────────────────────
  /** Premium ekranı açıldı */
  PREMIUM_VIEWED: 'premium_viewed',
  /** Premium yükseltme tetiklendi */
  PREMIUM_UPGRADE_STARTED: 'premium_upgrade_started',
  /** Premium başarılı satın alındı */
  PREMIUM_UPGRADED: 'premium_upgraded',
  /** Plan iptal edildi */
  PREMIUM_CANCELED: 'premium_canceled',

  // ─── Navigation / Engagement ─────────────────────────────
  /** Tab değişimi */
  TAB_CHANGED: 'tab_changed',
  /** Profil görüntülendi (kim?) */
  PROFILE_VIEWED: 'profile_viewed',
  /** Bildirim tıklandı (deep link) */
  NOTIFICATION_OPENED: 'notification_opened',
  /** Davet kodu kullanıldı */
  REFERRAL_REDEEMED: 'referral_redeemed',

  // ─── Content / Moderation ────────────────────────────────
  /** Şikayet gönderildi */
  REPORT_SUBMITTED: 'report_submitted',
  /** Reaksiyon emoji kullanıldı */
  REACTION_SENT: 'reaction_sent',
  /** Sesli reaksiyon (Faz 3) */
  VOICE_REACTION_SENT: 'voice_reaction_sent',
} as const;

export type AnalyticsEvent = typeof Events[keyof typeof Events];

// ═══════════════════════════════════════════════════════════
// USER PROPERTIES (kullanıcı bazlı, segmentation için)
// ═══════════════════════════════════════════════════════════

export const UserProperties = {
  /** Free / Plus / Pro */
  TIER: 'tier',
  /** Kayıt tarihi (ISO date) */
  SIGNUP_DATE: 'signup_date',
  /** Toplam SP (snapshot) */
  TOTAL_SP: 'total_sp',
  /** Cinsiyet (analytics için) */
  GENDER: 'gender',
  /** Yaş aralığı (KVKK için 18-24, 25-34 vb. — exact age değil) */
  AGE_RANGE: 'age_range',
  /** Doğrulanmış email mi */
  EMAIL_VERIFIED: 'email_verified',
} as const;

export type UserProperty = typeof UserProperties[keyof typeof UserProperties];
