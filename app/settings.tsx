/**
 * SopranoChat — Ayarlar Sayfası
 * DNA: koyu glassmorphism, teal aksan, slate-blue palette
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  icon: string; // MCI name
  label: string;
  desc?: string;
  type: 'toggle' | 'select' | 'action' | 'link';
  color?: string;
  danger?: boolean;
  /** Ana toggle kapalıyken bu satır disabled olsun */
  parentKey?: string;
};

const SETTING_GROUPS: { title: string; icon: string; color: string; items: SettingItem[] }[] = [
  {
    title: 'Bildirimler', icon: 'bell-ring', color: '#14B8A6',
    items: [
      { key: 'notifications_enabled', icon: 'bell', label: 'Bildirimler', desc: 'Push bildirimleri aç/kapat', type: 'toggle', color: '#14B8A6' },
      { key: 'notification_sound', icon: 'music-note', label: 'Bildirim Sesi', desc: 'Bildirim gelince ses çal', type: 'toggle', parentKey: 'notifications_enabled', color: '#A78BFA' },
      { key: 'notification_vibration', icon: 'vibrate', label: 'Titreşim', desc: 'Bildirimde titreşim', type: 'toggle', parentKey: 'notifications_enabled', color: '#60A5FA' },
    ],
  },
  {
    title: 'Görünüm', icon: 'palette', color: '#FBBF24',
    items: [
      { key: 'theme', icon: 'palette-swatch', label: 'Tema', desc: 'Uygulama teması seç', type: 'select', color: '#FBBF24' },
      { key: 'language', icon: 'translate', label: 'Dil', desc: 'Türkçe (Yakında: English)', type: 'action', color: '#34D399' },
    ],
  },
  {
    title: 'Gizlilik', icon: 'shield-check', color: '#22C55E',
    items: [
      { key: 'show_online_status', icon: 'eye', label: 'Çevrimiçi Durumu', desc: 'Diğerleri seni çevrimiçi görsün', type: 'toggle', color: '#22C55E' },
      { key: 'profile_private', icon: 'lock', label: 'Gizli Profil', desc: 'Sadece takipçiler', type: 'toggle', color: '#F59E0B' },
    ],
  },
  {
    title: 'Hesap', icon: 'account-circle', color: '#38BDF8',
    items: [
      { key: 'edit_profile', icon: 'account-edit', label: 'Profili Düzenle', type: 'action', color: '#38BDF8' },
      { key: 'blocked_users', icon: 'account-cancel', label: 'Engellenen Kullanıcılar', desc: 'Engellediğin kişileri yönet', type: 'action', color: '#FB923C' },
    ],
  },
  {
    title: 'Hakkında', icon: 'information', color: '#818CF8',
    items: [
      { key: 'terms', icon: 'file-document', label: 'Kullanım Koşulları', type: 'link', color: '#94A3B8' },
      { key: 'privacy', icon: 'shield-lock', label: 'Gizlilik Politikası', type: 'link', color: '#14B8A6' },
      { key: 'version', icon: 'code-tags', label: 'Versiyon', desc: 'v2.0.0', type: 'action', color: '#818CF8' },
    ],
  },
  {
    title: 'Abonelik', icon: 'credit-card', color: '#D4AF37',
    items: [
      { key: 'restore_purchases', icon: 'refresh', label: 'Satın Almaları Geri Yükle', desc: 'Cihaz değişikliği sonrası premium\'u geri yükle', type: 'action', color: '#D4AF37' },
    ],
  },
  {
    title: 'Oturum', icon: 'logout-variant', color: '#EF4444',
    items: [
      { key: 'logout', icon: 'logout-variant', label: 'Çıkış Yap', type: 'action', danger: true, color: '#FBBF24' },
      { key: 'delete_account', icon: 'trash-can', label: 'Hesabı Sil', desc: 'Tüm veriler kalıcı olarak silinir', type: 'action', danger: true, color: '#EF4444' },
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

                  // ★ Y2: Storage avatar/post-image orphan cleanup — user klasörünü sil.
                  // RLS v26 sadece kendi klasörünü sildirir; cleanup başarısız olsa bile
                  // profil silme devam eder (kritik olan DB).
                  try {
                    const { StorageService } = require('../services/storage');
                    await StorageService.deleteUserFiles?.(uid).catch(() => {});
                  } catch { /* modül yoksa atla */ }
                  // Avatar + post-images bucket'larında user klasörünü paraleL temizle
                  try {
                    const buckets = ['avatars', 'post-images', 'voice-notes'] as const;
                    await Promise.all(buckets.map(async (bucket) => {
                      const { data: files } = await supabase.storage.from(bucket).list(uid, { limit: 1000 });
                      if (files && files.length > 0) {
                        const paths = files.map(f => `${uid}/${f.name}`);
                        await supabase.storage.from(bucket).remove(paths);
                      }
                    }));
                  } catch { /* orphan dosyalar için manuel admin cleanup RPC var */ }

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
            {/* Group Header — teal accent + MCI icon */}
            <View style={s.groupHeader}>
              <View style={[s.groupAccent, { backgroundColor: group.color }]} />
              <MaterialCommunityIcons name={group.icon as any} size={14} color={group.color} style={{
                textShadowColor: `${group.color}cc`,
                textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
              }} />
              <Text style={s.groupTitle}>{group.title}</Text>
            </View>

            {/* Items card — wallet ile aynı 3 katmanlı derinlik */}
            <View style={s.groupCard}>
              <LinearGradient
                colors={['#1a2334', '#0D1220', '#050912']}
                start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <LinearGradient
                colors={[`${group.color}33`, `${group.color}0d`, 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <LinearGradient
                colors={['transparent', `${group.color}dd`, 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.groupTopEdge}
              />

              {group.items.map((item, ii) => {
                const isLast = ii === group.items.length - 1;
                const settingValue = (settings as any)[item.key];
                const isDisabledByParent = item.parentKey ? !(settings as any)[item.parentKey] : false;

                return (
                  <Pressable
                    key={item.key}
                    style={({ pressed }) => [
                      s.row,
                      !isLast && s.rowBorder,
                      isDisabledByParent && { opacity: 0.4 },
                      pressed && { backgroundColor: 'rgba(255,255,255,0.04)' },
                    ]}
                    disabled={isDisabledByParent}
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
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={22}
                      color={item.color || '#94A3B8'}
                      style={[s.rowIcon, {
                        textShadowColor: `${item.color || '#94A3B8'}cc`,
                        textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 9,
                      }]}
                    />
                    <View style={s.rowText}>
                      <Text style={[s.rowLabel, item.danger && { color: item.color || '#EF4444' }]}>
                        {item.label}
                      </Text>
                      {item.desc && (
                        <Text style={s.rowDesc}>{item.desc}</Text>
                      )}
                    </View>

                    {item.type === 'toggle' && (
                      <Switch
                        value={!!settingValue}
                        onValueChange={(v) => {
                          if (isDisabledByParent) return;
                          updateSetting(item.key as keyof UserSettings, v);
                        }}
                        trackColor={{ false: '#1E293B', true: item.color || '#14B8A6' }}
                        thumbColor="#FFFFFF"
                        ios_backgroundColor="#1E293B"
                        disabled={isDisabledByParent}
                        style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                      />
                    )}
                    {item.type === 'select' && (
                      <View style={s.selectRow}>
                        {item.key === 'theme' ? (
                          <MaterialCommunityIcons
                            name={settingValue === 'light' ? 'weather-sunny' : 'weather-night'}
                            size={22}
                            color={settingValue === 'light' ? '#FBBF24' : '#94A3B8'}
                            style={{
                              textShadowColor: settingValue === 'light' ? 'rgba(251,191,36,0.7)' : 'rgba(148,163,184,0.4)',
                              textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
                            }}
                          />
                        ) : item.key === 'language' ? (
                          <View style={s.langPill}>
                            <Text style={{ fontSize: 13 }}>{settingValue === 'en' ? '🇬🇧' : '🇹🇷'}</Text>
                            <Text style={s.selectValue}>
                              {settingValue === 'en' ? 'EN' : 'TR'}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                    {(item.type === 'action' || item.type === 'link') && (
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={item.danger ? `${item.color || '#EF4444'}80` : 'rgba(255,255,255,0.22)'}
                      />
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
    fontSize: 20, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.3,
    ...Shadows.text,
  },

  // Groups
  group: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  groupAccent: {
    width: 3, height: 14, borderRadius: 2,
  },
  groupTitle: {
    fontSize: 11, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.2, textTransform: 'uppercase',
    ...Shadows.text,
  },

  // Card container — premium 3 katmanlı (wallet ile tutarlı)
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  groupTopEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowIcon: {
    width: 26, textAlign: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14, fontWeight: '600', color: '#E2E8F0',
    letterSpacing: 0.15,
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  rowDesc: {
    fontSize: 11, color: 'rgba(148,163,184,0.75)', marginTop: 2, fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // Select
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectValue: {
    fontSize: 13, fontWeight: '700', color: '#E2E8F0', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(52,211,153,0.1)',
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
});
