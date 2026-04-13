/**
 * SopranoChat — Upsell Tetikleyici Servisi
 * ═══════════════════════════════════════════════════
 *
 * Kullanıcı bir tier sınırına ulaştığında otomatik olarak
 * upgrade önerisi oluşturur. UI bileşenleri (PremiumAlert, toast)
 * bu servisten event alarak gösterim yapar.
 */
import { TIER_ORDER } from '../constants/tiers';
import type { SubscriptionTier, UpsellTrigger, UpsellEvent } from '../types';

// ════════════════════════════════════════════════════════════
// UPSELL MESAJLARI
// ════════════════════════════════════════════════════════════

const UPSELL_MESSAGES: Record<UpsellTrigger, (requiredTier: SubscriptionTier) => string> = {
  daily_room_limit:      (t) => `Günlük oda limitine ulaştınız. ${t} ile daha fazla oda açın!`,
  room_duration_expired: (t) => `Oda süreniz doldu. ${t} ile daha uzun yayın yapın!`,
  room_type_locked:      (t) => `Bu oda tipi ${t}+ üyelere özel.`,
  customization_locked:  (t) => `Kişiselleştirme özellikleri ${t}+ ile açılır.`,
  stage_capacity_full:   (t) => `Sahne kapasitesi dolu. ${t} ile daha fazla kişiyi sahneye çıkarın!`,
  system_room_prompt:    ()  => `Kendi kişisel odanı açmak ister misin?`,
  moderator_limit:       (t) => `Moderatör limiti doldu. ${t} ile daha fazla moderatör atayın!`,
  camera_limit:          (t) => `Kamera limiti doldu. ${t} ile daha fazla kamera açın!`,
  listener_grid_full:    (t) => `Dinleyici grid'i dolu. ${t} ile daha geniş bir dinleyici alanına sahip olun!`,
  feature_locked:        (t) => `Bu özellik ${t}+ abonelik gerektirir.`,
};

/**
 * Bir sonraki tier'ı döndürür. Zaten en üstteyse null.
 */
function getNextTier(currentTier: SubscriptionTier): SubscriptionTier | null {
  const idx = TIER_ORDER.indexOf(currentTier);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

// ════════════════════════════════════════════════════════════
// UPSELL EVENT LİSTENER SİSTEMİ
// ════════════════════════════════════════════════════════════

type UpsellListener = (event: UpsellEvent) => void;
const listeners: Set<UpsellListener> = new Set();

export const UpsellService = {
  /**
   * Upsell event dinleyicisi ekle.
   * UI bileşenleri (PremiumAlert, toast) bu listener'ı kullanır.
   * @returns Unsubscribe fonksiyonu
   */
  onUpsell(listener: UpsellListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Upsell event yayınla.
   * Tüm listener'lara gönderilir.
   */
  emit(event: UpsellEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (e) {
        if (__DEV__) console.warn('[UpsellService] Listener hatası:', e);
      }
    }
  },

  /**
   * Upsell tetikle — trigger ve current tier verilir,
   * gerekli tier otomatik hesaplanır.
   */
  trigger(triggerType: UpsellTrigger, currentTier: SubscriptionTier, requiredTier?: SubscriptionTier): void {
    const targetTier = requiredTier || getNextTier(currentTier) || 'Plus';
    const msgFn = UPSELL_MESSAGES[triggerType];
    const message = msgFn ? msgFn(targetTier) : `${targetTier} üyelik ile bu özelliği açın.`;

    this.emit({
      trigger: triggerType,
      current_tier: currentTier,
      required_tier: targetTier,
      message,
    });
  },

  // ════════════════════════════════════════════════════════════
  // YARDIMCI — DURUM BAZLI TETİKLEYİCİLER
  // ════════════════════════════════════════════════════════════

  /** Günlük oda limiti dolduğunda */
  onDailyRoomLimit(currentTier: SubscriptionTier): void {
    this.trigger('daily_room_limit', currentTier);
  },

  /** Oda süresi bittiğinde */
  onRoomDurationExpired(currentTier: SubscriptionTier): void {
    this.trigger('room_duration_expired', currentTier);
  },

  /** Oda tipi kilitli olduğunda */
  onRoomTypeLocked(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): void {
    this.trigger('room_type_locked', currentTier, requiredTier);
  },

  /** Kişiselleştirme kilitli olduğunda */
  onCustomizationLocked(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): void {
    this.trigger('customization_locked', currentTier, requiredTier);
  },

  /** Sahne kapasitesi dolduğunda */
  onStageCapacityFull(currentTier: SubscriptionTier): void {
    this.trigger('stage_capacity_full', currentTier);
  },

  /** Sistem odasında 5dk sonra gösterilecek prompt */
  onSystemRoomPrompt(currentTier: SubscriptionTier): void {
    this.trigger('system_room_prompt', currentTier);
  },

  /** Moderatör limiti dolduğunda */
  onModeratorLimit(currentTier: SubscriptionTier): void {
    this.trigger('moderator_limit', currentTier);
  },

  /** Kamera limiti dolduğunda */
  onCameraLimit(currentTier: SubscriptionTier): void {
    this.trigger('camera_limit', currentTier);
  },

  /** Dinleyici grid'i dolduğunda */
  onListenerGridFull(currentTier: SubscriptionTier): void {
    this.trigger('listener_grid_full', currentTier);
  },

  /** Genel özellik kilitli olduğunda */
  onFeatureLocked(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): void {
    this.trigger('feature_locked', currentTier, requiredTier);
  },
};
