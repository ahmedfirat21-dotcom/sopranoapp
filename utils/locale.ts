/**
 * SopranoChat — Cihaz Dili / Lokal Yardımcıları
 * Device locale tespiti — odaları kullanıcının diline göre filtrelemek için.
 */
import { Platform, NativeModules } from 'react-native';

/**
 * Cihaz dilini 2 harfli kod olarak döndürür ('tr', 'en', 'de'...).
 * Tespit edilemezse 'en' fallback.
 */
export function getDeviceLanguage(): string {
  try {
    let locale: string | undefined;
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
    } else {
      locale = NativeModules.I18nManager?.localeIdentifier;
    }
    if (!locale) return 'en';
    // tr_TR, tr-TR, tr → tr
    return locale.split(/[-_]/)[0].toLowerCase();
  } catch {
    return 'en';
  }
}

// ★ 2026-04-27: Dil etiket ve bayrak yardımcıları — info toast/banner için.
const LANGUAGE_META: Record<string, { label: string; flag: string }> = {
  tr: { label: 'Türkçe',     flag: '🇹🇷' },
  en: { label: 'English',    flag: '🇬🇧' },
  de: { label: 'Deutsch',    flag: '🇩🇪' },
  ar: { label: 'العربية',    flag: '🇸🇦' },
  fr: { label: 'Français',   flag: '🇫🇷' },
  es: { label: 'Español',    flag: '🇪🇸' },
  it: { label: 'Italiano',   flag: '🇮🇹' },
  ru: { label: 'Русский',    flag: '🇷🇺' },
  pt: { label: 'Português',  flag: '🇵🇹' },
  ja: { label: '日本語',      flag: '🇯🇵' },
};

export function getLanguageLabel(code?: string | null): string {
  if (!code) return '';
  return LANGUAGE_META[code.toLowerCase()]?.label || code.toUpperCase();
}

export function getLanguageFlag(code?: string | null): string {
  if (!code) return '🌐';
  return LANGUAGE_META[code.toLowerCase()]?.flag || '🌐';
}
