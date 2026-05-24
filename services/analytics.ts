/**
 * SopranoChat — Analytics Servis Katmanı
 * ═══════════════════════════════════════════════════
 * Firebase Analytics'in tek erişim noktası. Direkt firebase.analytics()
 * çağırma — yerine `Analytics.track('event_name', { ... })` kullan.
 *
 * Tasarım kuralları:
 *  - Native module yoksa silent (Expo Go gibi) — crash etmez
 *  - Dev'de console.log fallback (debugging için)
 *  - PII (kişisel veri) gönderme — KVKK güvenli
 *  - Event isimleri `constants/analytics.ts` Events sabitinden gelir
 */
import { Events, UserProperties, type AnalyticsEvent, type UserProperty } from '../constants/analytics';

// Lazy load — native module yoksa import patlamasın
let analytics: any = null;
try {
  analytics = require('@react-native-firebase/analytics').default;
} catch { /* native module yoksa sessiz */ }

const isAvailable = (): boolean => {
  return !!analytics;
};

// ═══════════════════════════════════════════════════════════
// EVENT PARAMS — typed parametreler
// ═══════════════════════════════════════════════════════════

type EventParams = Record<string, string | number | boolean | undefined>;

/**
 * Parametreleri Firebase Analytics formatına çevir.
 * - undefined değerleri ele
 * - boolean → string ('true'/'false')
 * - string max 100 char
 */
function sanitizeParams(params?: EventParams): Record<string, string | number> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean') out[k] = v ? 'true' : 'false';
    else if (typeof v === 'string') out[k] = v.slice(0, 100);
    else out[k] = v;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS API
// ═══════════════════════════════════════════════════════════

export const Analytics = {
  /**
   * Bir event tetikle.
   * @param event - constants/analytics.ts'teki Events sabitinden
   * @param params - opsiyonel event parametreleri
   */
  track(event: AnalyticsEvent, params?: EventParams): void {
    const clean = sanitizeParams(params);
    if (__DEV__) {
      // Dev'de console'a düşür ki debugging yapılabilsin
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Analytics] ${event}`, clean || '');
    }
    if (!isAvailable()) return;
    try {
      analytics().logEvent(event, clean).catch((e: unknown) => {
        if (__DEV__) console.warn(`[Analytics] logEvent rejected (${event}):`, e);
      });
    } catch (e) {
      if (__DEV__) console.warn(`[Analytics] logEvent threw (${event}):`, e);
    }
  },

  /**
   * User property set et (segmentation için).
   * Aynı user için bir kez set edilir, sonra Analytics dashboard'da
   * "Free kullanıcılar" gibi audience filtresi yapılabilir.
   */
  setUserProperty(prop: UserProperty, value: string): void {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Analytics] property: ${prop} = ${value}`);
    }
    if (!isAvailable()) return;
    try {
      analytics().setUserProperty(prop, value).catch((e: unknown) => {
        if (__DEV__) console.warn(`[Analytics] setUserProperty rejected (${prop}):`, e);
      });
    } catch (e) {
      if (__DEV__) console.warn(`[Analytics] setUserProperty threw (${prop}):`, e);
    }
  },

  /**
   * User ID ata (kullanıcı login olunca).
   * KVKK için: Firebase UID kullanılır, email yollanmaz.
   */
  setUserId(userId: string | null): void {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      if (__DEV__) console.log(`[Analytics] userId: ${userId || '(cleared)'}`);
    }
    if (!isAvailable()) return;
    try {
      analytics().setUserId(userId).catch((e: unknown) => {
        if (__DEV__) console.warn('[Analytics] setUserId rejected:', e);
      });
    } catch (e) {
      if (__DEV__) console.warn('[Analytics] setUserId threw:', e);
    }
  },

  /**
   * Ekran değişimi izle (manuel — auto tracking varsa gerek yok).
   * Tab bar veya stack navigation hook'larından çağrılabilir.
   */
  screen(screenName: string, screenClass?: string): void {
    if (!isAvailable()) return;
    try {
      analytics().logScreenView({
        screen_name: screenName,
        screen_class: screenClass || screenName,
      }).catch((e: unknown) => {
        if (__DEV__) console.warn(`[Analytics] logScreenView rejected (${screenName}):`, e);
      });
    } catch (e) {
      if (__DEV__) console.warn(`[Analytics] logScreenView threw (${screenName}):`, e);
    }
  },

  /**
   * Yaş aralığını exact yaştan hesapla (KVKK).
   * Doğum yılını GÖNDERMEZ — sadece bucket.
   */
  ageRangeFrom(birthDate?: string | null): string {
    if (!birthDate) return 'unknown';
    const year = new Date(birthDate).getFullYear();
    if (isNaN(year)) return 'unknown';
    const age = new Date().getFullYear() - year;
    if (age < 13) return 'under_13';
    if (age < 18) return '13_17';
    if (age < 25) return '18_24';
    if (age < 35) return '25_34';
    if (age < 45) return '35_44';
    if (age < 55) return '45_54';
    return '55_plus';
  },
};

// Re-export — caller'lar tek import ile her şeye ulaşır
export { Events, UserProperties };
