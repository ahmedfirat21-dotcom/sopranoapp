/**
 * SopranoChat — i18n Service (v79 Aktivasyon)
 * ═══════════════════════════════════════════════════
 * Hafif, dependency-free çeviri motoru.
 *
 * Kullanım:
 *   import { i18n } from '../services/i18n';
 *
 *   // Çeviri al
 *   i18n.t('settings.title')           → "Ayarlar" veya "Settings"
 *   i18n.t('sp.send')                  → "SP Gönder" veya "Send SP"
 *
 *   // Template parametreleri
 *   i18n.t('settings.restore_success', { tier: 'Plus' })
 *     → "Plus üyeliğin geri yüklendi"
 *
 *   // Dil değiştir
 *   await i18n.setLocale('en');
 *
 * Mimari:
 *   - Locale dosyaları: /locales/tr.ts, /locales/en.ts
 *   - Dil tercihi: AsyncStorage (SettingsService üzerinden)
 *   - Fallback: key bulunamazsa → TR → key string
 *   - Hiçbir 3. parti bağımlılık yok (react-i18next, expo-localization vb.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback } from 'react';

// Locale dosyaları — statik import (bundle'a dahil, network gerektirmez)
import tr from '../locales/tr';
import en from '../locales/en';

export type SupportedLocale = 'tr' | 'en';

const LOCALE_STORAGE_KEY = '@soprano_settings';

const locales: Record<SupportedLocale, Record<string, string>> = { tr, en };

// ★ Fallback sırası: seçilen dil → TR → key kendisi
const fallbackLocale: SupportedLocale = 'tr';

/** Mevcut aktif dil */
let currentLocale: SupportedLocale = 'tr';

/** Event listener'lar — dil değişikliğinde UI'ı güncellemek için */
type LocaleChangeHandler = (locale: SupportedLocale) => void;
const listeners: Set<LocaleChangeHandler> = new Set();

export const i18n = {
  /**
   * Başlatma — AsyncStorage'dan kayıtlı dili yükler.
   * _layout.tsx prepare() içinde çağrılır.
   */
  async init(): Promise<void> {
    try {
      const json = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      if (json) {
        const settings = JSON.parse(json);
        if (settings.language && locales[settings.language as SupportedLocale]) {
          currentLocale = settings.language as SupportedLocale;
        }
      }
    } catch {
      // Okunamazsa varsayılan (TR) ile devam
    }
  },

  /**
   * Çeviri al.
   * @param key - Çeviri anahtarı (ör. 'settings.title')
   * @param params - İsteğe bağlı template parametreleri (ör. { tier: 'Plus' })
   * @returns Çevrilen metin veya key kendisi (bulunamazsa)
   */
  t(key: string, params?: Record<string, string | number>): string {
    // 1. Mevcut dilde ara
    let text = locales[currentLocale]?.[key];

    // 2. Bulunamadıysa fallback dilde ara
    if (text === undefined && currentLocale !== fallbackLocale) {
      text = locales[fallbackLocale]?.[key];
    }

    // 3. Hiçbirinde yoksa key'i döndür
    if (text === undefined) {
      if (__DEV__) {
        // Dev'de eksik çeviri uyarısı — production'da sessiz
        console.warn(`[i18n] Missing key: "${key}" for locale "${currentLocale}"`);
      }
      return key;
    }

    // 4. Template parametreleri: {{param}} → değer
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }

    return text;
  },

  /**
   * Mevcut aktif dil kodu.
   */
  get locale(): SupportedLocale {
    return currentLocale;
  },

  /**
   * Dil değiştir — AsyncStorage'a kaydeder + listener'ları bilgilendirir.
   */
  async setLocale(locale: SupportedLocale): Promise<void> {
    if (!locales[locale]) return;
    currentLocale = locale;

    // SettingsService'in formatıyla uyumlu kaydet
    try {
      const json = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
      const settings = json ? JSON.parse(json) : {};
      settings.language = locale;
      await AsyncStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Kayıt başarısız olursa in-memory'de devam
    }

    // Listener'ları bilgilendir (UI re-render)
    for (const handler of listeners) {
      try { handler(locale); } catch {}
    }
  },

  /**
   * Dil değişikliği dinleyicisi ekle.
   * @returns Cleanup fonksiyonu (useEffect return'ünde çağır)
   */
  onLocaleChange(handler: LocaleChangeHandler): () => void {
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  },

  /**
   * Tüm desteklenen diller.
   */
  get supportedLocales(): { code: SupportedLocale; label: string; flag: string }[] {
    return [
      { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
      { code: 'en', label: 'English', flag: '🇬🇧' },
    ];
  },

  /**
   * Belirli bir key mevcut dilde tanımlı mı?
   */
  has(key: string): boolean {
    return locales[currentLocale]?.[key] !== undefined;
  },
};

/**
 * ★ v284 (16 May 2026): React hook — locale değişince component re-render olur.
 *
 * Kullanım:
 *   const { t, locale, setLocale } = useTranslation();
 *   <Text>{t('home.discover')}</Text>
 *   <Button onPress={() => setLocale('en')}>EN</Button>
 *
 * useTranslation() döndüğünde `t` her zaman güncel locale'i kullanır;
 * locale değişiminde subscriber listesi üzerinden re-render tetiklenir.
 */
export function useTranslation() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = i18n.onLocaleChange(() => {
      forceUpdate(v => v + 1);
    });
    return unsubscribe;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => i18n.t(key, params),
    // currentLocale değişikliği forceUpdate ile re-render yapacak; t referansı stable
    [],
  );

  return {
    t,
    locale: i18n.locale,
    setLocale: i18n.setLocale.bind(i18n),
  };
}
