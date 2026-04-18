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
  bg?: string;
  danger?: boolean;
  /** Ana toggle kapalıyken bu satır disabled olsun */
  parentKey?: string;
};

const SETTING_GROUPS: { title: string; icon: keyof typeof Ionicons.glyphMap; items: SettingItem[] }[] = [
  {
    title: 'Bildirimler', icon: 'notifications-outline',
    items: [
      { key: 'notifications_enabled', icon: 'notifications', label: 'Bildirimler', desc: 'Push bildirimleri aç/kapat', type: 'toggle', color: '#14B8A6', bg: 'rgba(20,184,166,0.18)' },
      { key: 'notification_sound', icon: 'musical-notes', label: 'Bildirim Sesi', desc: 'Bildirim gelince ses çal', type: 'toggle', parentKey: 'notifications_enabled', color: '#A78BFA', bg: 'rgba(167,139,250,0.18)' },
      { key: 'notification_vibration', icon: 'phone-portrait', label: 'Titreşim', desc: 'Bildirimde titreşim', type: 'toggle', parentKey: 'notifications_enabled', color: '#60A5FA', bg: 'rgba(96,165,250,0.18)' },
    ],
  },
  {
    title: 'Görünüm', icon: 'color-palette-outline',
    items: [
      { key: 'theme', icon: 'color-fill', label: 'Tema', desc: 'Uygulama teması seç', type: 'select', color: '#FBBF24', bg: 'rgba(251,191,36,0.18)' },
      { key: 'language', icon: 'language', label: 'Dil', desc: 'Türkçe (Yakında: English)', type: 'action', color: '#34D399', bg: 'rgba(52,211,153,0.18)' },
    ],
  },
  {
    title: 'Gizlilik', icon: 'shield-checkmark-outline',
    items: [
      { key: 'show_online_status', icon: 'logo-designernews', label: 'Çevrimiçi Durumu', desc: 'Diğerleri seni çevrimiçi görsün', type: 'toggle', color: '#22C55E', bg: 'rgba(34,197,94,0.18)' },
      { key: 'profile_private', icon: 'lock-closed', label: 'Gizli Profil', desc: 'Sadece takipçiler', type: 'toggle', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)' },
    ],
  },
  {
    title: 'Hesap', icon: 'person-circle-outline',
    items: [
      { key: 'edit_profile', icon: 'create', label: 'Profili Düzenle', type: 'action', color: '#38BDF8', bg: 'rgba(56,189,248,0.18)' },
      { key: 'blocked_users', icon: 'ban', label: 'Engellenen Kullanıcılar', desc: 'Engellediğin kişileri yönet', type: 'action', color: '#FB923C', bg: 'rgba(251,146,60,0.18)' },
    ],
  },
  {
    title: 'Hakkında', icon: 'information-circle-outline',
    items: [
      { key: 'terms', icon: 'document-text', label: 'Kullanım Koşulları', type: 'link', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
      { key: 'privacy', icon: 'shield-checkmark', label: 'Gizlilik Politikası', type: 'link', color: '#14B8A6', bg: 'rgba(20,184,166,0.18)' },
      { key: 'version', icon: 'code-slash', label: 'Versiyon', desc: 'v2.0.0', type: 'action', color: '#818CF8', bg: 'rgba(129,140,248,0.18)' },
    ],
  },
  {
    title: 'Abonelik', icon: 'card-outline',
    items: [
      { key: 'restore_purchases', icon: 'refresh-circle', label: 'Satın Almaları Geri Yükle', desc: 'Cihaz değişikliği sonrası premium\'u geri yükle', type: 'action', color: '#D4AF37', bg: 'rgba(212,175,55,0.18)' },
    ],
  },
  {
    title: 'Oturum', icon: 'log-out-outline',
    items: [
      { key: 'logout', icon: 'log-out', label: 'Çıkış Yap', type: 'action', danger: true, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
      { key: 'delete_account', icon: 'trash', label: 'Hesabı Sil', desc: 'Tüm veriler kalıcı olarak silinir', type: 'action', danger: true, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
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

  const updateSetting = useCallback((key: keyof UserSettings, value: any) => {
    // 🔥 ÖNEMLİ: Optimistic UI (Eşzamanlı Güncelleme)
    // Switch bileşeni asenkron işlem beklerse git-gel "bug"ına girer. 
    // Önce UI'ı anında güncelliyoruz, kaydetme işlemini arkada bırakıyoruz.
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);

    (async () => {
      await SettingsService.update({ [key]: value });

      // Özel aksiyonlar
      if (key === 'theme') {
        setActiveTheme(value as ThemeKey);
        applyTheme(value as ThemeKey);
      }
      if (key === 'show_online_status' && firebaseUser) {
        ProfileService.setOnline(firebaseUser.uid, value).catch(() => {});
      }
      // ★ Gizli profil toggle
      if (key === 'profile_private' && firebaseUser) {
        const currentMode = (profile as any)?.privacy_mode || 'public';
        const newPrivacyMode = value
          ? (currentMode === 'followers_only' ? 'followers_only' : 'private')
          : 'public';
        ProfileService.update(firebaseUser.uid, {
          is_private: value,
          privacy_mode: newPrivacyMode,
        } as any).catch(() => {});
      }
    })();
  }, [firebaseUser, applyTheme, profile]);

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
                    // ★ FIX: revokeAccess() hesap cache'ini temizler — tekrar girişte hesap seçici açılır
                    await GoogleSignin.revokeAccess();
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
      case 'restore_purchases':
        (async () => {
          if (!firebaseUser) return;
          showToast({ title: 'Geri Yükleniyor...', message: 'Satın almalar kontrol ediliyor', type: 'info' });
          try {
            const { restoredTier } = await RevenueCatService.restorePurchases(firebaseUser.uid);
            if (restoredTier && restoredTier !== 'Free') {
              showToast({ title: 'Başarılı!', message: `${restoredTier} üyeliğin geri yüklendi`, type: 'success' });
            } else {
              showToast({ title: 'Bulunamadı', message: 'Bu hesaba ait aktif abonelik yok', type: 'info' });
            }
          } catch {
            showToast({ title: 'Hata', message: 'Geri yükleme başarısız', type: 'error' });
          }
        })();
        break;
      case 'version':
        showToast({ title: 'SopranoChat', message: 'v2.0.0', type: 'info' });
        break;
      case 'language':
        showToast({ title: 'Çok Yakında', message: 'İngilizce dil desteği üzerinde çalışıyoruz.', type: 'info' });
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
                    await supabase.from('blocked_users').delete().or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
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
                  try { await GoogleSignin.revokeAccess(); } catch {}
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
                    disabled={isDisabledByParent}
                    android_ripple={{ color: 'rgba(255,255,255,0.05)' }}
                    onPress={() => {
                      if (isDisabledByParent) return;
                      if (item.type === 'action' || item.type === 'link') {
                        handleAction(item.key);
                      } else if (item.type === 'select') {
                        if (item.key === 'theme') {
                          updateSetting('theme', settingValue === 'dark' ? 'light' : 'dark');
                        } else if (item.key === 'language') {
                          updateSetting('language', settingValue === 'tr' ? 'en' : 'tr');
                        }
                      } else if (item.type === 'toggle') {
                        updateSetting(item.key as keyof UserSettings, !settingValue);
                      }
                    }}
                  >
                    {/* Sol: ikon + label */}
                    <View style={[s.rowIcon, item.bg && { backgroundColor: item.bg, borderRadius: 9 }]}>
                      <Ionicons
                        name={item.icon}
                        size={17}
                        color={item.color || '#94A3B8'}
                        style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
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
                        trackColor={{ false: '#475569', true: '#14B8A6' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#475569"
                        disabled={isDisabledByParent}
                        style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                      />
                    )}
                    {item.type === 'select' && (
                      <View style={s.selectRow}>
                        {item.key === 'theme' ? (
                          <Ionicons 
                            name={settingValue === 'light' ? 'sunny' : 'moon'} 
                            size={22} 
                            color={settingValue === 'light' ? '#FBBF24' : '#94A3B8'} 
                            style={{ textShadowColor: settingValue === 'light' ? 'rgba(251,191,36,0.4)' : 'rgba(148,163,184,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
                          />
                        ) : item.key === 'language' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 13 }}>{settingValue === 'en' ? '🇬🇧' : '🇹🇷'}</Text>
                            <Text style={[s.selectValue, { color: '#E2E8F0', letterSpacing: 1 }]}>
                              {settingValue === 'en' ? 'EN' : 'TR'}
                            </Text>
                          </View>
                        ) : null}
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
    marginTop: 14,
    paddingHorizontal: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingLeft: 4,
  },
  groupTitle: {
    fontSize: 11, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1, textTransform: 'uppercase',
    ...Shadows.textLight,
  },

  // Card container
  groupCard: {
    backgroundColor: '#414e5f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#95a1ae',
    overflow: 'hidden',
    ...Shadows.card,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowIcon: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14, fontWeight: '600', color: '#F1F5F9',
    ...Shadows.textLight,
  },
  rowDesc: {
    fontSize: 11, color: '#64748B', marginTop: 1,
    ...Shadows.textLight,
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
