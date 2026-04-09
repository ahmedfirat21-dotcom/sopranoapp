/**
 * SopranoChat — Oda Geçmişi Servisi
 * Son girilen odaları AsyncStorage ile yerel olarak saklar.
 * "Son Girdiğin Odalar" kısayol kartları için kullanılır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@SopranoChat_room_history';
const MAX_HISTORY = 10;

export interface RoomHistoryItem {
  id: string;
  name: string;
  hostName: string;
  hostAvatar?: string;
  category?: string;
  lastVisited: string; // ISO timestamp
}

export const RoomHistoryService = {
  /** Son girilen odaları getir */
  async getRecent(limit: number = MAX_HISTORY): Promise<RoomHistoryItem[]> {
    try {
      const json = await AsyncStorage.getItem(HISTORY_KEY);
      if (!json) return [];
      const items: RoomHistoryItem[] = JSON.parse(json);
      return items.slice(0, limit);
    } catch {
      return [];
    }
  },

  /** Odaya giriş kaydı ekle (en son girilen en başa) */
  async addEntry(item: Omit<RoomHistoryItem, 'lastVisited'>): Promise<void> {
    try {
      const existing = await this.getRecent(MAX_HISTORY);
      // Aynı oda zaten varsa kaldır (tekrar en başa eklenecek)
      const filtered = existing.filter(r => r.id !== item.id);
      const newList: RoomHistoryItem[] = [
        { ...item, lastVisited: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_HISTORY);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newList));
    } catch (e) {
      if (__DEV__) console.warn('[RoomHistory] Kayıt hatası:', e);
    }
  },

  /** Geçmişi temizle */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch {}
  },
};
