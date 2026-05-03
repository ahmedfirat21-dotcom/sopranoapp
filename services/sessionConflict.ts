// ★ v107 (3 May 2026): Çift oturum uyarısı — device tracking + realtime takeover.
//
// Akış:
//   1) İlk açılışta AsyncStorage'a UUID device_id yaz (kalıcı)
//   2) Login + foreground tetikleyicisinde mark_session_active RPC çağır
//   3) Realtime subscribe profiles row → last_active_device_id != my_device_id ise
//      onConflict callback (UI modal'ı tetikler)
//
// Kullanıcı modal'da "Devam Et" derse → markActive tekrar çağrılır → diğer cihaz aynı
// modal'ı görür (zincir devam). "Çık" → caller signOut tetikler.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';

const DEVICE_ID_KEY = 'sopranochat_device_id';

let _cachedDeviceId: string | null = null;
let _activeChannel: ReturnType<typeof supabase.channel> | null = null;

/** Cihaz başına kalıcı UUID — ilk açılışta üretilir, AsyncStorage'da saklanır */
export async function getDeviceId(): Promise<string> {
  if (_cachedDeviceId) return _cachedDeviceId;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored && stored.length > 8) {
      _cachedDeviceId = stored;
      return stored;
    }
  } catch { /* AsyncStorage read fail — yeni üret */ }

  const fresh = Crypto.randomUUID();
  try { await AsyncStorage.setItem(DEVICE_ID_KEY, fresh); } catch { /* sessiz */ }
  _cachedDeviceId = fresh;
  return fresh;
}

/** Login/foreground anında çağrılır. Önceki cihaz farklıysa takeover bilgisi döner. */
export async function markSessionActive(userId: string): Promise<{
  success: boolean;
  isTakeover: boolean;
  previousDeviceId?: string | null;
}> {
  if (!userId) return { success: false, isTakeover: false };
  const deviceId = await getDeviceId();
  try {
    const { data, error } = await supabase.rpc('mark_session_active', {
      p_user_id: userId,
      p_device_id: deviceId,
    });
    if (error) {
      if (__DEV__) logger.warn('[Session] mark_session_active hata:', error.message);
      return { success: false, isTakeover: false };
    }
    const r = data as any;
    return {
      success: !!r?.success,
      isTakeover: !!r?.is_takeover,
      previousDeviceId: r?.previous_device_id ?? null,
    };
  } catch (e: any) {
    if (__DEV__) logger.warn('[Session] mark_session_active exception:', e?.message);
    return { success: false, isTakeover: false };
  }
}

/**
 * Realtime profil değişikliğini dinler — başka cihaz devraldığında onConflict callback tetikler.
 * Caller cleanup için döndürdüğümüz unsubscribe fonksiyonunu çağırmalıdır.
 */
export async function subscribeSessionConflict(
  userId: string,
  onConflict: (payload: { newDeviceId: string; at: string }) => void,
): Promise<() => void> {
  // Önceki kanal varsa kapat
  if (_activeChannel) {
    try { supabase.removeChannel(_activeChannel); } catch {}
    _activeChannel = null;
  }
  const myDeviceId = await getDeviceId();

  const channel = supabase
    .channel(`session_conflict:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      (payload: any) => {
        const newRow = payload?.new || {};
        const otherDeviceId = newRow.last_active_device_id;
        if (!otherDeviceId || otherDeviceId === myDeviceId) return;
        if (__DEV__) logger.warn('[Session] Takeover algılandı, başka cihaz aktif:', otherDeviceId);
        onConflict({ newDeviceId: otherDeviceId, at: newRow.last_active_at });
      },
    )
    .subscribe((status: string) => {
      if (__DEV__) logger.log('[Session] Conflict kanalı:', status);
    });

  _activeChannel = channel;

  return () => {
    try { supabase.removeChannel(channel); } catch {}
    if (_activeChannel === channel) _activeChannel = null;
  };
}
