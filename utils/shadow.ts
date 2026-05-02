/**
 * SopranoChat — Cross-platform shadow & glow utility
 * ════════════════════════════════════════════════════════════════
 *
 * SORUN:
 *   RN'de shadowColor/shadowOpacity/shadowRadius SADECE iOS'ta render olur.
 *   Android için elevation kullanılır AMA elevation:
 *     - sadece backgroundColor opaque ise gölge gösterir
 *     - shadowColor (Android API 28+) sınırlı destekli
 *     - elevation glow değil, sade box-shadow gibi davranır
 *
 *   Sonuç: Tüm projede `shadowColor: '#FBBF24', shadowRadius: 22, shadowOpacity: 0.8`
 *   tarzı kodlar Android'de HIÇBİR ŞEY göstermiyor — kullanıcı 'iOS'ta var Android'de yok'
 *   şikâyet ediyor.
 *
 * KULLANIM:
 *   import { shadow, glow } from '../utils/shadow';
 *
 *   // Düz drop shadow (kart, modal):
 *   <View style={[styles.card, shadow({ size: 'md' })]} />
 *
 *   // Renkli glow (badge, parlayan ikon, pulse animasyon):
 *   <View style={[styles.badge, glow('#FBBF24', { intensity: 'high' })]} />
 *
 *   // Inline override:
 *   shadow({ size: 'lg', color: '#000' })
 *   glow('#14B8A6', { intensity: 'med' })
 *
 * NOTLAR:
 *   - Android'de gerçek glow için en sağlam yol layered LinearGradient'tir
 *     (örn. components/room/SpeakerSection StageLightHalo). Bu helper en azından
 *     basit gölge/halo durumlarını uniform yapıyor.
 *   - Animated.View içinde elevation animation jitter yapabilir — animation'da
 *     elevation'ı SABİT tut, sadece opacity/scale animate et.
 */

import { Platform } from 'react-native';

type ShadowSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Cross-platform drop shadow (kart, modal, bottom sheet için).
 * iOS'ta gerçek shadow, Android'de elevation.
 */
export function shadow(opts?: { size?: ShadowSize; color?: string; opacity?: number }) {
  const size: ShadowSize = opts?.size ?? 'md';
  const color = opts?.color ?? '#000';
  const opacity = opts?.opacity;

  // Boyut tablosu — RN'in tasarım sistemleri (Material 3, Apple HIG) referansıyla
  const map: Record<ShadowSize, { radius: number; offsetY: number; opacity: number; elevation: number }> = {
    xs: { radius: 2, offsetY: 1, opacity: 0.20, elevation: 1 },
    sm: { radius: 4, offsetY: 2, opacity: 0.25, elevation: 2 },
    md: { radius: 8, offsetY: 3, opacity: 0.30, elevation: 4 },
    lg: { radius: 14, offsetY: 5, opacity: 0.35, elevation: 8 },
    xl: { radius: 22, offsetY: 8, opacity: 0.40, elevation: 14 },
  };
  const s = map[size];
  const finalOpacity = opacity ?? s.opacity;

  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: s.offsetY },
      shadowOpacity: finalOpacity,
      shadowRadius: s.radius,
    },
    android: {
      // ★ Android'de elevation görünür olması için backgroundColor opaque olmalı.
      //   Eğer parent transparent ise gölge çıkmaz; bu durumda glow() helper'ı kullanılmalı.
      elevation: s.elevation,
      // API 28+ shadowColor desteği — pek çok cihazda etkili
      shadowColor: color,
    },
  }) as any;
}

/**
 * Renkli glow efekti — pulse, halo, accent ring için.
 *
 * ÖNEMLİ:
 *   Bu helper shadowColor + elevation ile makul bir glow simulasyonu sağlar AMA
 *   "büyük dramatic glow" istiyorsan layered LinearGradient + multi-border yaklaşımını
 *   kullan (örn. StageLightHalo, GlowMessageOverlay). elevation tek başına glow değil.
 */
export function glow(color: string, opts?: { intensity?: 'low' | 'med' | 'high' }) {
  const intensity = opts?.intensity ?? 'med';
  const map: Record<string, { radius: number; opacity: number; elevation: number }> = {
    low: { radius: 4, opacity: 0.4, elevation: 3 },
    med: { radius: 8, opacity: 0.6, elevation: 6 },
    high: { radius: 14, opacity: 0.8, elevation: 10 },
  };
  const g = map[intensity];

  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: g.opacity,
      shadowRadius: g.radius,
    },
    android: {
      shadowColor: color,
      elevation: g.elevation,
    },
  }) as any;
}

/**
 * iOS-only shadow (Android'de hiç render edilmesin istendiğinde).
 * Bazı durumlarda Android'de elevation korkunç görünüyor (yuvarlak kenar kesintisi)
 * — o zaman bu kullanılır.
 */
export function shadowIOSOnly(color: string, radius = 8, opacity = 0.3) {
  return Platform.OS === 'ios' ? {
    shadowColor: color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: opacity,
    shadowRadius: radius,
  } : {};
}
