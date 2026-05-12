/**
 * SopranoChat — Web admin px <-> APK dp birim köprüsü.
 *
 * SORUN:
 *   Web admin tarayıcıda px ile çizim yapıyor. APK React Native'de dp kullanıyor.
 *   1 dp = ekran yoğunluğuna göre 1-4 fiziksel pixel. Aynı sayı iki platformda
 *   farklı görsel mesafeye denk geliyor → web admin'de 80px sola kaydırılan bir
 *   element APK'da 80dp kayıyor ve bu farklı bir konum oluyor.
 *
 *   Ayrıca borderWidth: 0.5 gibi sub-pixel değerler Android'de yuvarlanıyor —
 *   bazı cihazda 0 (çizgi yok), bazısında 1 (kalın). Hizalama tutmuyor.
 *
 * ÇÖZÜM:
 *   - px(value): web admin'in px değerini olduğu gibi dp olarak kabul et (1:1).
 *     Bu varsayım çoğu cihazda doğru (DPI'dan bağımsız tasarım = dp zaten px gibi
 *     davranır). Hizalama farkı 1 pixel altıysa snap() ile sabitle.
 *   - snap(value): değeri en yakın fiziksel pixel'e yuvarla (PixelRatio aware).
 *     borderWidth, divider, ince çizgi için ZORUNLU.
 *   - hairline(): en ince görünür çizgi (1 fiziksel pixel, dp cinsinden).
 *     StyleSheet.hairlineWidth ile aynı ama explicit ve test edilebilir.
 */

import { PixelRatio } from 'react-native';

/**
 * Web admin px değerini APK dp olarak döndürür.
 * Şu an 1:1 — gerekirse buraya kalibrasyon çarpanı eklenebilir.
 */
export function px(value: number): number {
  return value;
}

/**
 * Değeri en yakın fiziksel pixel'e yuvarla. Border, divider, hairline için.
 * Android'de sub-pixel rounding bug'larını engeller.
 */
export function snap(value: number): number {
  return PixelRatio.roundToNearestPixel(value);
}

/**
 * En ince görünür çizgi (1 fiziksel pixel, dp cinsinden).
 * Yüksek DPI ekranda gözle görülmeyecek kadar ince olabilir; UI için minimum 0.5dp önerilir.
 */
export function hairline(): number {
  return 1 / PixelRatio.get();
}

/**
 * Web admin'in css blur radius değerini Skia BlurMask sigma'sına çevirir.
 * CSS blur(Npx) ≈ Skia BlurMask(sigma = N/2). Bu birebir parite için kritik.
 */
export function cssBlurToSkiaSigma(cssBlurPx: number): number {
  return cssBlurPx / 2;
}
