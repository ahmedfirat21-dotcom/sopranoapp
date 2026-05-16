/**
 * Sistem Ayarları servisi — web admin'den DB'ye yazılan ayarları APK tarafında dinler.
 * ★ F-1 (16 May 2026)
 *
 * Kullanım:
 *   - useSystemSettings() hook → React component'lerde
 *   - subscribeSystemSettings(cb) → imperative listener
 *   - getSystemSettings() → sync cache getter
 *
 * Realtime: app_system_settings (id='default') UPDATE event'ini dinler.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';
import { i18n } from '../../services/i18n';

export interface SystemSettings {
  maintenance_mode: boolean;
  maintenance_message: string;
  maintenance_eta: string | null;
  min_supported_version: string | null;
  force_update: boolean;
  force_update_message: string;
  feature_flags: Record<string, any>;
  banner_enabled: boolean;
  banner_text: string;
  banner_severity: 'info' | 'warning' | 'danger' | 'success';
  updated_at: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  maintenance_mode: false,
  maintenance_message: i18n.t('auto.systemSettings.002'),
  maintenance_eta: null,
  min_supported_version: null,
  force_update: false,
  force_update_message: i18n.t('auto.systemSettings.001'),
  feature_flags: {},
  banner_enabled: false,
  banner_text: '',
  banner_severity: 'info',
  updated_at: new Date().toISOString(),
};

let cache: SystemSettings = DEFAULT_SETTINGS;
let initialized = false;
const listeners = new Set<(s: SystemSettings) => void>();

function notify() {
  listeners.forEach(fn => { try { fn(cache); } catch (e) { logger.warn('[SystemSettings] listener err', e); } });
}

export async function fetchSystemSettings(): Promise<SystemSettings> {
  try {
    const { data, error } = await supabase
      .from('app_system_settings')
      .select('*')
      .eq('id', 'default')
      .single();
    if (error) {
      if (__DEV__) logger.warn('[SystemSettings] fetch error:', error.message);
      return cache;
    }
    if (data) {
      cache = { ...DEFAULT_SETTINGS, ...data };
      notify();
    }
    return cache;
  } catch (e: any) {
    if (__DEV__) logger.warn('[SystemSettings] exception:', e?.message);
    return cache;
  }
}

export function getSystemSettings(): SystemSettings {
  return cache;
}

export function subscribeSystemSettings(cb: (s: SystemSettings) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Realtime subscribe — app_system_settings UPDATE eventlerini dinler */
let _sub: any = null;
export function startSystemSettingsSync() {
  if (_sub) return;
  if (!initialized) {
    fetchSystemSettings();
    initialized = true;
  }
  _sub = supabase
    .channel('app_system_settings')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'app_system_settings' },
      (payload: any) => {
        if (payload?.new?.id !== 'default') return;
        cache = { ...DEFAULT_SETTINGS, ...payload.new };
        notify();
        if (__DEV__) logger.log('[SystemSettings] realtime update', cache);
      },
    )
    .subscribe();
}

export function stopSystemSettingsSync() {
  if (_sub) {
    try { supabase.removeChannel(_sub); } catch { /* */ }
    _sub = null;
  }
}

/** React hook — UI component'lerinde kullan */
export function useSystemSettings(): SystemSettings {
  const [s, setS] = useState<SystemSettings>(() => cache);
  useEffect(() => {
    if (!initialized) fetchSystemSettings();
    const unsub = subscribeSystemSettings(setS);
    return unsub;
  }, []);
  return s;
}

/** Versiyon karşılaştırma (semver-like). "1.3.97" vs "1.3.96" → +1 (current newer) */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/** Feature flag yardımcısı — APK genelinde kullanım: featureFlag('SHOW_GIF_TAB') */
export function featureFlag(key: string, defaultValue: boolean = false): boolean {
  const v = cache.feature_flags?.[key];
  if (typeof v === 'boolean') return v;
  return defaultValue;
}
