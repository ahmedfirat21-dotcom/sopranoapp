/**
 * Sistem Ayarları Overlay — bakım modu / zorunlu güncelleme / banner.
 * ★ F-1 (16 May 2026)
 *
 * Root layout'ta mount edilir, fullscreen overlay olarak çalışır:
 *  - Bakım modu açıksa: tüm app'i kapatır + bakım ekranı
 *  - Force update + sürüm uyumsuz: Play Store yönlendirme ekranı
 *  - Banner aktifse: tüm sayfaların üstünde ince satır (Maintenance/ForceUpdate yokken)
 */
import React from 'react';
import { i18n } from '../services/i18n';
import { View, Text, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useSystemSettings, compareVersions } from '../services/systemSettings';

const STORE_URL = Platform.OS === 'ios'
  ? 'https://apps.apple.com/app/sopranochat'
  : 'https://play.google.com/store/apps/details?id=com.sopranochat';

function getAppVersion(): string {
  return (Constants?.expoConfig?.version as string) || '0.0.0';
}

/** Tam ekran bakım modu overlay */
function MaintenanceScreen({ message, eta }: { message: string; eta: string | null }) {
  return (
    <View style={s.fullscreen}>
      <View style={s.iconWrap}>
        <Ionicons name="construct" size={64} color="#FBBF24" />
      </View>
      <Text style={s.title}>{i18n.t('systemsettingsoverlay.001')}</Text>
      <Text style={s.message}>{message}</Text>
      {eta && (
        <View style={s.etaBox}>
          <Ionicons name="time-outline" size={14} color="#FBBF24" />
          <Text style={s.etaText}>Tahmini bitiş: {eta}</Text>
        </View>
      )}
    </View>
  );
}

/** Zorunlu güncelleme ekranı */
function ForceUpdateScreen({ message }: { message: string }) {
  const openStore = () => Linking.openURL(STORE_URL).catch(() => { /* sessiz */ });
  return (
    <View style={s.fullscreen}>
      <View style={[s.iconWrap, { backgroundColor: 'rgba(20,184,166,0.12)' }]}>
        <Ionicons name="cloud-download-outline" size={64} color="#14B8A6" />
      </View>
      <Text style={s.title}>{i18n.t('systemsettingsoverlay.002')}</Text>
      <Text style={s.message}>{message}</Text>
      <Pressable style={s.updateBtn} onPress={openStore}>
        <Ionicons name="open-outline" size={16} color="#FFF" />
        <Text style={s.updateBtnText}>
          {Platform.OS === 'ios' ? 'App Store\'a Git' : 'Play Store\'a Git'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Sayfa üstü banner — bakım/force-update YOKKEN gösterilir */
function TopBanner({ text, severity }: { text: string; severity: string }) {
  const insets = useSafeAreaInsets();
  const palette: Record<string, { bg: string; border: string; text: string; icon: any }> = {
    info:    { bg: 'rgba(14,165,233,0.15)', border: 'rgba(14,165,233,0.4)', text: '#7DD3FC', icon: 'information-circle' },
    warning: { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: '#FCD34D', icon: 'warning' },
    danger:  { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  text: '#FCA5A5', icon: 'alert-circle' },
    success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#6EE7B7', icon: 'checkmark-circle' },
  };
  const p = palette[severity] || palette.info;
  return (
    <View
      pointerEvents="none"
      style={[s.banner, { backgroundColor: p.bg, borderBottomColor: p.border, paddingTop: insets.top + 4 }]}
    >
      <Ionicons name={p.icon} size={13} color={p.text} />
      <Text style={[s.bannerText, { color: p.text }]} numberOfLines={2}>{text}</Text>
    </View>
  );
}

export default function SystemSettingsOverlay() {
  const settings = useSystemSettings();
  const appVersion = getAppVersion();

  // Bakım modu en yüksek öncelik
  if (settings.maintenance_mode) {
    return <MaintenanceScreen message={settings.maintenance_message} eta={settings.maintenance_eta} />;
  }

  // Zorunlu güncelleme
  if (settings.force_update && settings.min_supported_version) {
    if (compareVersions(appVersion, settings.min_supported_version) < 0) {
      return <ForceUpdateScreen message={settings.force_update_message} />;
    }
  }

  // Banner (overlay olarak değil, top'a yapışık ince satır)
  if (settings.banner_enabled && settings.banner_text) {
    return <TopBanner text={settings.banner_text} severity={settings.banner_severity} />;
  }

  return null;
}

const s = StyleSheet.create({
  fullscreen: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0A0F1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 9999,
    elevation: 99,
  },
  iconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24, fontWeight: '800', color: '#F1F5F9',
    marginBottom: 12, letterSpacing: 0.3,
  },
  message: {
    fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22,
    maxWidth: 320,
  },
  etaBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 18, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  etaText: { fontSize: 12, color: '#FCD34D', fontWeight: '600' },
  updateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 24, paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: '#14B8A6', borderRadius: 12,
  },
  updateBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    zIndex: 998,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerText: {
    fontSize: 11, fontWeight: '600', flex: 1,
  },
});
