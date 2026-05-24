/**
 * SopranoChat — Haptic Feedback Utility
 * ═══════════════════════════════════════════════════
 * Merkezi haptic API — uygulamanın her yerinden çağırılır.
 * 
 * Kullanım:
 *   import { Haptics } from '../utils/haptics';
 *   Haptics.tap();        // Hafif dokunma (buton, chip)
 *   Haptics.success();    // Başarı (gönderim, kayıt)
 *   Haptics.warning();    // Uyarı (silme onayı, hata)
 *   Haptics.heavy();      // Ağır etki (long press, swipe threshold)
 *   Haptics.selection();  // Seçim değişimi (switch, radio, picker)
 *
 * Platform desteği:
 *   - iOS: Taptic Engine
 *   - Android: Vibration (API 26+)
 *   - Web: sessiz (no-op)
 */
import { Platform } from 'react-native';

let HapticsModule: typeof import('expo-haptics') | null = null;
try {
  if (Platform.OS !== 'web') {
    HapticsModule = require('expo-haptics');
  }
} catch {
  HapticsModule = null;
}

export const Haptics = {
  /** Hafif dokunma — buton basımı, chip tıklama, tab değişimi */
  tap() {
    try {
      HapticsModule?.impactAsync(HapticsModule.ImpactFeedbackStyle.Light);
    } catch {}
  },

  /** Başarı geri bildirimi — mesaj gönderildi, kayıt tamamlandı */
  success() {
    try {
      HapticsModule?.notificationAsync(HapticsModule.NotificationFeedbackType.Success);
    } catch {}
  },

  /** Uyarı geri bildirimi — silme, hata, dikkat */
  warning() {
    try {
      HapticsModule?.notificationAsync(HapticsModule.NotificationFeedbackType.Warning);
    } catch {}
  },

  /** Ağır etki — long press, swipe threshold aşımı */
  heavy() {
    try {
      HapticsModule?.impactAsync(HapticsModule.ImpactFeedbackStyle.Heavy);
    } catch {}
  },

  /** Seçim değişimi — switch toggle, picker scroll */
  selection() {
    try {
      HapticsModule?.selectionAsync();
    } catch {}
  },
};
