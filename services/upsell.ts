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
import { i18n } from './i18n';

// ════════════════════════════════════════════════════════════
// UPSELL MESAJLARI
// ════════════════════════════════════════════════════════════

const UPSELL_MESSAGES: Record<UpsellTrigger, (requiredTier: SubscriptionTier) => string> = {
  daily_room_limit:      (t) => i18n.t('auto.upsell.011', { 0: t }),
  room_duration_expired: (t) => i18n.t('auto.upsell.010', { 0: t }),
  room_type_locked:      (t) => i18n.t('auto.upsell.009', { 0: t }),
  customization_locked:  (t) => i18n.t('auto.upsell.008', { 0: t }),
  stage_capacity_full:   (t) => i18n.t('auto.upsell.007', { 0: t }),
  system_room_prompt:    ()  => i18n.t('auto.upsell.006'),
  moderator_limit:       (t) => i18n.t('auto.upsell.005', { 0: t }),
  camera_limit:          (t) => i18n.t('auto.upsell.004', { 0: t }),
  listener_grid_full:    (t) => i18n.t('auto.upsell.003', { 0: t }),
  feature_locked:        (t) => i18n.t('auto.upsell.002', { 0: t }),
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
    const message = msgFn ? msgFn(targetTier) : i18n.t('auto.upsell.001', { 0: targetTier });

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
