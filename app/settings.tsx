/**
 * SopranoChat — Ayarlar Sayfası
 * DNA: koyu glassmorphism, teal aksan, slate-blue palette
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { signOut } from 'firebase/auth';
import { RevenueCatService } from '../services/revenuecat';

import { Colors, Shadows } from '../constants/theme';
import { SettingsService, type UserSettings, THEME_OPTIONS, LANGUAGE_OPTIONS } from '../services/settings';
import { auth } from '../constants/firebase';
import { useAuth, useTheme } from './_layout';
import { ProfileService } from '../services/database';
import { ModerationService } from '../services/moderation';
import { setActiveTheme, type ThemeKey } from '../constants/themeEngine';
import { showToast } from '../components/Toast';
import AppBackground from '../components/AppBackground';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import { supabase } from '../constants/supabase';

// Google Sign-In — sign out sırasında cache temizleme için
let GoogleSignin: any;
try {
  const gsignin = require('@react-native-google-signin/google-signin');
  GoogleSignin = gsignin.GoogleSignin;
} catch (e) {
  GoogleSignin = { signOut: async () => {} };
}

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
  /** Ana toggle kapalıyken bu satır disabled olsun */
  parentKey?: string;
};

const SETTING_GROUPS: { title: string; icon: keyof typeof Ionicons.glyphMap; items: SettingItem[] }[] = [
  {
    title: 'Bildirimler', icon: 'notifications-outline',
    items: [
      { key: 'notifications_enabled', icon: 'notifications', label: 'Bildirimler', desc: 'Push bildirimleri aç/kapat', type: 'toggle' },
      { key: 'notification_sound', icon: 'volume-medium', label: 'Bildirim Sesi', desc: 'Bildirim gelince ses çal', type: 'toggle', parentKey: 'notifications_enabled' },
      { key: 'notification_vibration', icon: 'phone-portrait', label: 'Titreşim', desc: 'Bildirimde titreşim', type: 'toggle', parentKey: 'notifications_enabled' },
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
      { key: 'blocked_users', icon: 'ban', label: 'Engellenen Kullanıcılar', desc: 'Engellediğin kişileri yönet', type: 'action' },
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
      { key: 'delete_account', icon: 'trash', label: 'Hesabı Sil', desc: 'Tüm veriler kalıcı olarak silinir', type: 'action', danger: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, setIsLoggedIn, setUser, profile } = useAuth();
  const { applyTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });

  // Ayarları yükle + DB'den gizlilik ayarlarını senkronize et
  useEffect(() => {
    (async () => {
      const savedSettings = await SettingsService.get();

      // ★ B3 FIX: DB'den gerçek gizlilik durumlarını oku — privacy_mode tek kaynak
      if (profile) {
        const dbOnlineStatus = profile.is_online !== false; // default true
        // privacy_mode 3 modlu: public/followers_only/private
        const dbPrivacyMode = (profile as any).privacy_mode || 'public';
        const dbIsPrivate = dbPrivacyMode !== 'public';

        if (savedSettings.show_online_status !== dbOnlineStatus || savedSettings.profile_private !== dbIsPrivate) {
          const synced = await SettingsService.update({
            show_online_status: dbOnlineStatus,
            profile_private: dbIsPrivate,
          });
          setSettings({ ...savedSettings, ...synced });
          return;
        }
      }
      setSettings(savedSettings);
    })();
  }, [profile]);

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
    // ★ B3 FIX: Gizli profil toggle — privacy_mode ve is_private birlikte güncellenir
    if (key === 'profile_private' && firebaseUser) {
      const newPrivacyMode = value ? 'private' : 'public';
      ProfileService.update(firebaseUser.uid, {
        is_private: value,
        privacy_mode: newPrivacyMode,
      } as any).catch(() => {});
    }
  }, [firebaseUser, applyTheme]);

  const handleAction = useCallback((key: string) => {
    switch (key) {
      case 'edit_profile':
        router.push('/edit-profile' as any);
        break;
      case 'terms':
        Linking.openURL('https://sopranochat.com/terms');
        break;
      case 'privacy':
        Linking.openURL('https://sopranochat.com/privacy');
        break;
      case 'logout':
        setCAlert({
          visible: true,
          title: 'Çıkış Yap',
          message: 'Hesabından çıkmak istediğine emin misin?',
          type: 'warning',
          buttons: [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Çıkış Yap', style: 'destructive',
              onPress: async () => {
                try {
                  if (firebaseUser) {
                    await ProfileService.setOnline(firebaseUser.uid, false).catch(() => {});
                  }
                  try {
                    await GoogleSignin.signOut();
                  } catch { /* Google sign-in yoksa sessiz geç */ }
                  await RevenueCatService.logout().catch(() => {});
                  await signOut(auth);
                  setIsLoggedIn(false);
                  setUser(null);
                  router.replace('/(auth)/login');
                } catch (e) {
                  showToast({ title: 'Hata', message: 'Çıkış yapılamadı', type: 'error' });
                }
              },
            },
          ],
        });
        break;
      case 'version':
        showToast({ title: 'SopranoChat', message: 'v2.0.0 · Senin Sesin', type: 'info' });
        break;
      case 'blocked_users':
        (async () => {
          if (!firebaseUser) return;
          try {
            const blocked = await ModerationService.getBlockedUsers(firebaseUser.uid);
            if (blocked.length === 0) {
              showToast({ title: 'Engellenen Yok', message: 'Hiç engellediğin kullanıcı yok.', type: 'info' });
              return;
            }
            // Profilleri çek
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, display_name')
              .in('id', blocked);
            const buttons: AlertButton[] = (profiles || []).map((p: any) => ({
              text: `❌ ${p.display_name || 'Kullanıcı'}`,
              onPress: async () => {
                try {
                  await ModerationService.unblockUser(firebaseUser.uid, p.id);
                  showToast({ title: 'Engel Kaldırıldı', message: `${p.display_name} artık engelli değil.`, type: 'success' });
                } catch {
                  showToast({ title: 'Hata', type: 'error' });
                }
              },
            }));
            buttons.push({ text: 'Kapat', style: 'cancel' });
            setCAlert({
              visible: true,
              title: `Engellenen Kullanıcılar (${blocked.length})`,
              message: 'Engeli kaldırmak için isme dokun:',
              type: 'info',
              buttons,
            });
          } catch {
            showToast({ title: 'Hata', message: 'Liste yüklenemedi', type: 'error' });
          }
        })();
        break;
      case 'delete_account':
        setCAlert({
          visible: true,
          title: '⚠️ Hesabını Sil',
          message: 'Bu işlem GERİ ALINAMAZ. Tüm verilerin, mesajların, odaların ve rozetlerin kalıcı olarak silinecek.',
          type: 'error',
          buttons: [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Hesabımı Kalıcı Olarak Sil',
              style: 'destructive',
              onPress: async () => {
                if (!firebaseUser) return;
                try {
                  const uid = firebaseUser.uid;

                  // 1. Kullanıcının odalarını kapat ve katılımcılarını temizle
                  const { data: ownedRooms } = await supabase
                    .from('rooms')
                    .select('id')
                    .eq('host_id', uid);
                  if (ownedRooms && ownedRooms.length > 0) {
                    const roomIds = ownedRooms.map(r => r.id);
                    await supabase.from('room_participants').delete().in('room_id', roomIds);
                    await supabase.from('rooms').delete().in('id', roomIds);
                  }

                  // 2. Katılımcı olduğu odalardan çık
                  await supabase.from('room_participants').delete().eq('user_id', uid);

                  // 3. Friendships ve banları temizle
                  await supabase.from('friendships').delete().or(`user_id.eq.${uid},friend_id.eq.${uid}`);
                  await supabase.from('room_bans').delete().eq('user_id', uid);

                  // 4. Mesajları sil
                  await supabase.from('messages').delete().or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);

                  // 5. SP transaction geçmişini sil
                  try {
                    await supabase.from('sp_transactions').delete().eq('user_id', uid);
                  } catch { /* tablo yoksa sessiz */ }

                  // 6. Raporları sil
                  try {
                    await supabase.from('reports').delete().eq('reporter_id', uid);
                  } catch { /* tablo yoksa sessiz */ }

                  // 7. Block listesini sil
                  try {
                    await supabase.from('block_list').delete().or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
                  } catch { /* tablo yoksa sessiz */ }

                  // 7b. Bildirimleri sil
                  try {
                    await supabase.from('notifications').delete().or(`user_id.eq.${uid},sender_id.eq.${uid}`);
                  } catch { /* tablo yoksa sessiz */ }

                  // 7c. Oda takiplerini sil
                  try {
                    await supabase.from('room_follows').delete().eq('user_id', uid);
                  } catch { /* tablo yoksa sessiz */ }

                  // 7d. Oda sohbet mesajlarını sil
                  try {
                    await supabase.from('room_chat_messages').delete().eq('user_id', uid);
                  } catch { /* tablo yoksa sessiz */ }

                  // 7e. Rozetleri sil
                  try {
                    await supabase.from('user_badges').delete().eq('user_id', uid);
                  } catch { /* tablo yoksa sessiz */ }

                  // 7f. Davet kodlarını sil
                  try {
                    await supabase.from('referral_codes').delete().eq('owner_id', uid);
                  } catch { /* tablo yoksa sessiz */ }

                  // 8. Profili sil
                  await supabase.from('profiles').delete().eq('id', uid);

                  // 9. Firebase hesabını sil
                  try {
                    await firebaseUser.delete();
                  } catch (e: any) {
                    // Re-auth gerekebilir — en azından DB verileri silindi
                    if (__DEV__) console.warn('[DeleteAccount] Firebase delete error (may need re-auth):', e.message);
                  }

                  // 10. Çıkış yap
                  try { await GoogleSignin.signOut(); } catch {}
                  await RevenueCatService.logout().catch(() => {});
                  setIsLoggedIn(false);
                  setUser(null);
                  router.replace('/(auth)/login');
                  showToast({ title: 'Hesap Silindi', message: 'Tüm verileriniz silindi.', type: 'info' });
                } catch (e: any) {
                  showToast({ title: 'Hata', message: e?.message || 'Hesap silinemedi', type: 'error' });
                }
              },
            },
          ],
        });
        break;
    }
  }, [firebaseUser, router]);

  if (!settings) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;

  return (
    <AppBackground>
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => safeGoBack(router)} hitSlop={12}>
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
                // Parent toggle kontrolü — parent kapalıysa bu satır disabled
                const isDisabledByParent = item.parentKey ? !(settings as any)[item.parentKey] : false;

                return (
                  <Pressable
                    key={item.key}
                    style={[s.row, !isLast && s.rowBorder, isDisabledByParent && { opacity: 0.4 }]}
                    disabled={isDisabledByParent && item.type === 'toggle'}
                    onPress={() => {
                      if (isDisabledByParent) return;
                      if (item.type === 'action' || item.type === 'link') {
                        handleAction(item.key);
                      } else if (item.type === 'select') {
                        if (item.key === 'theme') {
                          setCAlert({
                            visible: true,
                            title: '🎨 Tema Seç',
                            message: 'Uygulama temasını seç:',
                            type: 'info',
                            buttons: [
                              ...THEME_OPTIONS.map(opt => ({
                                text: `${opt.key === settingValue ? '✓ ' : ''}${opt.label}`,
                                onPress: () => updateSetting('theme', opt.key),
                              })),
                              { text: 'Kapat', style: 'cancel' as const },
                            ],
                          });
                        } else if (item.key === 'language') {
                          setCAlert({
                            visible: true,
                            title: '🌍 Dil Seç',
                            message: 'Uygulama dilini seç:',
                            type: 'info',
                            buttons: [
                              ...LANGUAGE_OPTIONS.map(opt => ({
                                text: `${opt.key === settingValue ? '✓ ' : ''}${opt.flag} ${opt.label}`,
                                onPress: () => updateSetting('language', opt.key),
                              })),
                              { text: 'Kapat', style: 'cancel' as const },
                            ],
                          });
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
                        onValueChange={(v) => {
                          if (isDisabledByParent) return;
                          updateSetting(item.key as keyof UserSettings, v);
                        }}
                        trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(20,184,166,0.35)' }}
                        thumbColor={settingValue ? '#14B8A6' : '#64748B'}
                        disabled={isDisabledByParent}
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
      <PremiumAlert {...cAlert} onDismiss={() => setCAlert(prev => ({ ...prev, visible: false }))} />
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
