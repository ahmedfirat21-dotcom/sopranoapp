/**
 * SopranoChat — Ayarlar Servis Katmanı
 * Kullanıcı tercihlerini AsyncStorage ile yerel olarak saklar.
 * Gizlilik ayarları ayrıca Supabase'e de senkronize edilir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@soprano_settings';

export type UserSettings = {
  // Bildirimler
  notifications_enabled: boolean;
  notification_sound: boolean;
  notification_vibration: boolean;

  // Görünüm
  theme: 'oled' | 'dark' | 'midnight';

  // Dil
  language: 'tr' | 'en';

  // Gizlilik
  profile_private: boolean;
  show_online_status: boolean;

  // Güvenlik
  two_factor_enabled: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  notifications_enabled: true,
  notification_sound: true,
  notification_vibration: true,
  theme: 'oled',
  language: 'tr',
  profile_private: false,
  show_online_status: true,
  two_factor_enabled: false,
};

export const THEME_OPTIONS = [
  { key: 'oled' as const, label: 'OLED Siyah', desc: 'Derin siyah arka plan, AMOLED ekranlar için ideal' },
  { key: 'dark' as const, label: 'Koyu', desc: 'Yumuşak koyu gri tonlar' },
  { key: 'midnight' as const, label: 'Gece Mavisi', desc: 'Koyu mavi tonlarında gece teması' },
];

export const LANGUAGE_OPTIONS = [
  { key: 'tr' as const, label: 'Türkçe', flag: '🇹🇷' },
  { key: 'en' as const, label: 'English', flag: '🇬🇧' },
];

export const SettingsService = {
  /** Tüm ayarları yükle */
  async get(): Promise<UserSettings> {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (json) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
      }
    } catch (e) {
      console.warn('Ayarlar yüklenemedi:', e);
    }
    return { ...DEFAULT_SETTINGS };
  },

  /** Belirli ayarları güncelle */
  async update(partial: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Ayarlar kaydedilemedi:', e);
    }
    return updated;
  },

  /** Tüm ayarları sıfırla */
  async reset(): Promise<UserSettings> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.warn('Ayarlar sıfırlanamadı:', e);
    }
    return { ...DEFAULT_SETTINGS };
  },
};
