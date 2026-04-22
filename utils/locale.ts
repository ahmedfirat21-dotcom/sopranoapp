/**
 * SopranoChat — Locale / Language Utilities
 * ★ 2026-04-20: Kullanıcı cihaz dilini tespit eder. Expo-localization yerine
 *   Intl API kullanılır (Hermes'te çalışır, extra package gerektirmez).
 */

import type { RoomLanguage } from '../types';

const SUPPORTED: RoomLanguage[] = ['tr', 'en', 'ar', 'de'];

/**
 * Kullanıcının cihaz dilini al (örn: 'tr-TR' → 'tr').
 * Desteklenmeyen diller 'tr' (default) olarak düşer.
 */
export function getDeviceLanguage(): RoomLanguage {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'tr';
    const lang = locale.split('-')[0].toLowerCase() as RoomLanguage;
    return SUPPORTED.includes(lang) ? lang : 'tr';
  } catch {
    return 'tr';
  }
}

/** Dil kodundan TR etiketi */
export function getLanguageLabel(lang: string | null | undefined): string {
  const labels: Record<string, string> = {
    tr: 'Türkçe', en: 'English', ar: 'العربية', de: 'Deutsch',
  };
  return labels[lang || ''] || '—';
}

/** Dil kodundan bayrak emojisi */
export function getLanguageFlag(lang: string | null | undefined): string {
  const flags: Record<string, string> = {
    tr: '🇹🇷', en: '🇬🇧', ar: '🇸🇦', de: '🇩🇪',
  };
  return flags[lang || ''] || '🌐';
}
