/**
 * SopranoChat — Ayarlar Sayfası
 * DNA: koyu glassmorphism, teal aksan, slate-blue palette
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert,
  Dimensions, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';

import { Colors, Shadows, Typography } from '../constants/theme';
import { SettingsService, type UserSettings, THEME_OPTIONS, LANGUAGE_OPTIONS } from '../services/settings';
import { auth } from '../constants/firebase';
import { useAuth, useTheme } from './_layout';
import { ProfileService } from '../services/database';
import { setActiveTheme, type ThemeKey } from '../constants/themeEngine';
import { showToast } from '../components/Toast';
import AppBackground from '../components/AppBackground';

const { width: W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════
// AYAR GRUPLARI
// ═══════════════════════════════════════════════════════════
type SettingItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc?: string;
  type: 'toggle' | 'select' | 'action' | 'link';
  color?: string;
  danger?: boolean;
};

const SETTING_GROUPS: { title: string; icon: keyof typeof Ionicons.glyphMap; items: SettingItem[] }[] = [
  {
    title: 'Bildirimler', icon: 'notifications-outline',
    items: [
      { key: 'notifications_enabled', icon: 'notifications', label: 'Bildirimler', desc: 'Push bildirimleri aç/kapat', type: 'toggle' },
    ],
  },
  {
    title: 'Görünüm', icon: 'color-palette-outline',
    items: [
      { key: 'theme', icon: 'moon', label: 'Tema', desc: 'Uygulama teması seç', type: 'select' },
      { key: 'language', icon: 'language', label: 'Dil', desc: 'Uygulama dili', type: 'select' },
    ],
  },
  {
    title: 'Gizlilik', icon: 'shield-checkmark-outline',
    items: [
      { key: 'show_online_status', icon: 'ellipse', label: 'Çevrimiçi Durumu', desc: 'Diğerleri seni çevrimiçi görsün', type: 'toggle', color: '#4ADE80' },
      { key: 'profile_private', icon: 'lock-closed', label: 'Gizli Profil', desc: 'Profilini sadece takipçiler görsün', type: 'toggle' },
    ],
  },
  {
    title: 'Hesap', icon: 'person-circle-outline',
    items: [
      { key: 'edit_profile', icon: 'create', label: 'Profili Düzenle', type: 'action' },
    ],
  },
  {
    title: 'Hakkında', icon: 'information-circle-outline',
    items: [
      { key: 'terms', icon: 'document-text', label: 'Kullanım Koşulları', type: 'link' },
      { key: 'privacy', icon: 'shield', label: 'Gizlilik Politikası', type: 'link' },
      { key: 'version', icon: 'code-slash', label: 'Versiyon', desc: 'v2.0.0', type: 'action' },
    ],
  },
  {
    title: 'Oturum', icon: 'log-out-outline',
    items: [
      { key: 'logout', icon: 'log-out', label: 'Çıkış Yap', type: 'action', danger: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, setIsLoggedIn, setUser } = useAuth();
  const { applyTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    SettingsService.get().then(setSettings);
  }, []);

  const updateSetting = useCallback(async (key: keyof UserSettings, value: any) => {
    const updated = await SettingsService.update({ [key]: value });
    setSettings(updated);

    // Özel aksiyonlar
    if (key === 'theme') {
      setActiveTheme(value as ThemeKey);
      applyTheme(value as ThemeKey);
    }
    if (key === 'show_online_status' && firebaseUser) {
      ProfileService.setOnline(firebaseUser.uid, value).catch(() => {});
    }
    // Gizli profil toggle — DB'de is_private güncelle
    if (key === 'profile_private' && firebaseUser) {
      ProfileService.update(firebaseUser.uid, { is_private: value } as any).catch(() => {});
    }
  }, [firebaseUser, applyTheme]);

  const handleAction = useCallback((key: string) => {
    switch (key) {
      case 'edit_profile':
        router.push('/edit-profile' as any);
        break;
      case 'blocked_users':
        showToast({ title: 'Yakında', message: 'Bu özellik yakında eklenecek', type: 'info' });
        break;
      case 'terms':
        Linking.openURL('https://sopranochat.com/terms');
        break;
      case 'privacy':
        Linking.openURL('https://sopranochat.com/privacy');
        break;
      case 'logout':
        Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğine emin misin?', [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Çıkış Yap', style: 'destructive',
            onPress: async () => {
              try {
                if (firebaseUser) {
                  await ProfileService.setOnline(firebaseUser.uid, false).catch(() => {});
                }
                await signOut(auth);
                setIsLoggedIn(false);
                setUser(null);
                router.replace('/(auth)/login');
              } catch (e) {
                showToast({ title: 'Hata', message: 'Çıkış yapılamadı', type: 'error' });
              }
            },
          },
        ]);
        break;
      case 'version':
        showToast({ title: 'SopranoChat', message: 'v2.0.0 · Senin Sesin', type: 'info' });
        break;
    }
  }, [firebaseUser, router]);

  if (!settings) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;

  return (
    <AppBackground>
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#F1F5F9" />
        </Pressable>
        <Text style={s.headerTitle}>Ayarlar</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 20 }}
      >
        {SETTING_GROUPS.map((group, gi) => (
          <View key={gi} style={s.group}>
            {/* Group Header */}
            <View style={s.groupHeader}>
              <Ionicons name={group.icon} size={16} color={Colors.accentTeal} />
              <Text style={s.groupTitle}>{group.title}</Text>
            </View>

            {/* Items */}
            <View style={s.groupCard}>
              {group.items.map((item, ii) => {
                const isLast = ii === group.items.length - 1;
                const settingValue = (settings as any)[item.key];

                return (
                  <Pressable
                    key={item.key}
                    style={[s.row, !isLast && s.rowBorder]}
                    onPress={() => {
                      if (item.type === 'action' || item.type === 'link') {
                        handleAction(item.key);
                      } else if (item.type === 'select') {
                        // Tema/Dil seçimi
                        if (item.key === 'theme') {
                          const options = THEME_OPTIONS;
                          const nextIdx = (options.findIndex(o => o.key === settingValue) + 1) % options.length;
                          updateSetting('theme', options[nextIdx].key);
                        } else if (item.key === 'language') {
                          const options = LANGUAGE_OPTIONS;
                          const nextIdx = (options.findIndex(o => o.key === settingValue) + 1) % options.length;
                          updateSetting('language', options[nextIdx].key);
                        }
                      }
                    }}
                  >
                    {/* Sol: ikon + label */}
                    <View style={[s.rowIcon, item.danger && { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={item.danger ? '#EF4444' : item.color || Colors.accentTeal}
                      />
                    </View>
                    <View style={s.rowText}>
                      <Text style={[s.rowLabel, item.danger && { color: '#EF4444' }]}>
                        {item.label}
                      </Text>
                      {item.desc && (
                        <Text style={s.rowDesc}>{item.desc}</Text>
                      )}
                    </View>

                    {/* Sağ: toggle / select value / chevron */}
                    {item.type === 'toggle' && (
                      <Switch
                        value={!!settingValue}
                        onValueChange={(v) => updateSetting(item.key as keyof UserSettings, v)}
                        trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(20,184,166,0.35)' }}
                        thumbColor={settingValue ? '#14B8A6' : '#64748B'}
                      />
                    )}
                    {item.type === 'select' && (
                      <View style={s.selectRow}>
                        <Text style={s.selectValue}>
                          {item.key === 'theme'
                            ? THEME_OPTIONS.find(o => o.key === settingValue)?.label || 'Koyu'
                            : LANGUAGE_OPTIONS.find(o => o.key === settingValue)?.label || 'Türkçe'
                          }
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#64748B" />
                      </View>
                    )}
                    {(item.type === 'action' || item.type === 'link') && !item.danger && (
                      <Ionicons name="chevron-forward" size={16} color="#475569" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
    </AppBackground>
  );
}

// ═══════════════════════════════════════════════════════════
// STILLER — DNA uyumlu glassmorphism
// ═══════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '700', color: '#F1F5F9',
    letterSpacing: 0.3,
  },

  // Groups
  group: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingLeft: 4,
  },
  groupTitle: {
    fontSize: 13, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Card container
  groupCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Shadows.card,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15, fontWeight: '600', color: '#F1F5F9',
  },
  rowDesc: {
    fontSize: 11, color: '#64748B', marginTop: 1,
  },

  // Select
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectValue: {
    fontSize: 13, fontWeight: '600', color: Colors.accentTeal,
  },
});
