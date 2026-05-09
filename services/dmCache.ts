/**
 * SopranoChat — DM Mesaj Cache (lokal)
 * v110.5.15 (6 May 2026)
 *
 * WhatsApp/Telegram pattern: chat ekranı açılınca son N mesaj AsyncStorage'dan
 * INSTANT yüklenir. Loading flash yok. Network fetch arka planda freshleşir.
 *
 * Stale-while-revalidate:
 *   1. Mount → loadCached → instant render
 *   2. Network fetch paralel → fresh data
 *   3. Fresh data ile cache UPDATE + UI update
 *   4. Realtime/send mesajları → appendCache + UI update
 *
 * Cache key: `dmcache:${currentUid}:${otherUid}` (kullanıcı izolasyonu için
 *   currentUid de key'de — multi-account cihazda crosstalk önler).
 *
 * Limit: Conversation başına son 100 mesaj. AsyncStorage hızlı kalsın.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'dmcache:';
const MAX_CACHED_MESSAGES = 100;

function getKey(currentUid: string, otherUid: string): string {
  return `${CACHE_PREFIX}${currentUid}:${otherUid}`;
}

export const DMCacheService = {
  /** Cache'ten mesaj listesi yükle. Yoksa null döner. */
  async load(currentUid: string, otherUid: string): Promise<any[] | null> {
    if (!currentUid || !otherUid) return null;
    try {
      const raw = await AsyncStorage.getItem(getKey(currentUid, otherUid));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  /** Tüm conversation'ı cache'e yaz (network fetch sonrası). */
  async save(currentUid: string, otherUid: string, messages: any[]): Promise<void> {
    if (!currentUid || !otherUid) return;
    try {
      // Son MAX_CACHED_MESSAGES kadar tut (eski mesajlar gerekirse network'ten)
      const trimmed = messages.slice(-MAX_CACHED_MESSAGES);
      await AsyncStorage.setItem(getKey(currentUid, otherUid), JSON.stringify(trimmed));
    } catch {
      // Sessiz — cache failure kullanıcıyı engellemez
    }
  },

  /** Tek bir mesajı cache'e ekle (gönderilen veya realtime gelen). */
  async append(currentUid: string, otherUid: string, message: any): Promise<void> {
    if (!currentUid || !otherUid || !message) return;
    try {
      const cached = await this.load(currentUid, otherUid);
      const existing = cached || [];
      // Duplicate guard (id ile)
      if (message.id && existing.find(m => m.id === message.id)) return;
      const updated = [...existing, message].slice(-MAX_CACHED_MESSAGES);
      await this.save(currentUid, otherUid, updated);
    } catch { /* sessiz */ }
  },

  /** Mesaj güncelle (edit veya delete sonrası). */
  async update(currentUid: string, otherUid: string, messageId: string, patch: any): Promise<void> {
    if (!currentUid || !otherUid || !messageId) return;
    try {
      const cached = await this.load(currentUid, otherUid);
      if (!cached) return;
      const updated = cached.map(m => m.id === messageId ? { ...m, ...patch } : m);
      await this.save(currentUid, otherUid, updated);
    } catch { /* sessiz */ }
  },

  /** Mesajı cache'ten sil (hard delete sonrası). */
  async remove(currentUid: string, otherUid: string, messageId: string): Promise<void> {
    if (!currentUid || !otherUid || !messageId) return;
    try {
      const cached = await this.load(currentUid, otherUid);
      if (!cached) return;
      const updated = cached.filter(m => m.id !== messageId);
      await this.save(currentUid, otherUid, updated);
    } catch { /* sessiz */ }
  },

  /** Conversation'ın tüm cache'ini temizle (kullanıcı clear chat yaptığında). */
  async clear(currentUid: string, otherUid: string): Promise<void> {
    if (!currentUid || !otherUid) return;
    try {
      await AsyncStorage.removeItem(getKey(currentUid, otherUid));
    } catch { /* sessiz */ }
  },

  /** Tüm DM cache'lerini temizle (logout sonrası vs). */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const dmKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      if (dmKeys.length > 0) await AsyncStorage.multiRemove(dmKeys);
    } catch { /* sessiz */ }
  },
};
