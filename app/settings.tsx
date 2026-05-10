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
import { SettingsService, type UserSettings } from '../services/settings';
import { auth } from '../constants/firebase';
import { useAuth, useTheme } from './_layout';
import { ProfileService } from '../services/database';
import { ModerationService } from '../services/moderation';
import { supabase } from '../constants/supabase';
import { setActiveTheme, type ThemeKey } from '../constants/themeEngine';
import { showToast } from '../components/Toast';
import AppBackground from '../components/AppBackground';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import BlockedUsersSheet from '../components/BlockedUsersSheet';
import NotifPreferencesSheet from '../components/NotifPreferencesSheet';
// ★ Version — app.json'dan dinamik okunur, hardcode kaldırıldı (v86 fix)
//   Eski hardcode "v1.2.4" yüzünden her APK'da aynı görünüyordu, kullanıcı güncellemediğini sanıyordu.
let APP_VERSION = 'unknown';
try {
  const Constants = require('expo-constants').default;
  APP_VERSION = `v${Constants?.expoConfig?.version || Constants?.manifest?.version || 'unknown'}`;
} catch {
  try {
    const pkg = require('../app.json');
    APP_VERSION = `v${pkg?.expo?.version || 'unknown'}`;
  } catch { /* silent */ }
}

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

// ★ 2026-04-24: Unified theme — tüm gruplar teal aksan, sadece Oturum grubu kırmızı (danger semantik).
//   Renk kaldırılan yerler slate palette + teal vurgu; proje DNA'sı ile tutarlı.
const ACCENT = '#14B8A6';
const ACCENT_DANGER = '#EF4444';
const ICON_COLOR = '#94A3B8';

const SETTING_GROUPS: { title: string; icon: string; color: string; items: SettingItem[] }[] = [
  {
    title: 'Bildirimler', icon: 'bell-ring', color: ACCENT,
    items: [
      { key: 'notifications_enabled', icon: 'bell', label: 'Bildirimler', desc: 'Push bildirimleri aç/kapat', type: 'toggle' },
      { key: 'notification_sound', icon: 'music-note', label: 'Bildirim Sesi', desc: 'Bildirim gelince ses çal', type: 'toggle', parentKey: 'notifications_enabled' },
      { key: 'notification_vibration', icon: 'vibrate', label: 'Titreşim', desc: 'Bildirimde titreşim', type: 'toggle', parentKey: 'notifications_enabled' },
      { key: 'notification_prefs', icon: 'tune-vertical', label: 'Bildirim Tercihleri', desc: 'DND saati, kategori filtreleme, sadece arkadaşlar', type: 'action' },
    ],
  },
  {
    title: 'Görünüm', icon: 'palette', color: ACCENT,
    items: [
      { key: 'theme', icon: 'palette-swatch', label: 'Tema', desc: 'Koyu tema (aydınlık yakında)', type: 'action' },
      { key: 'language', icon: 'translate', label: 'Dil', desc: 'Türkçe (İngilizce yakında)', type: 'action' },
    ],
  },
  // ★ 2026-04-25: Faz 3.4 — Ses & Mikrofon ayarları (LiveKit publish options)
  {
    title: 'Ses & Mikrofon', icon: 'microphone', color: ACCENT,
    items: [
      { key: 'echo_cancellation', icon: 'volume-off', label: 'Yankı Engelleme', desc: 'Yansıyan sesleri filtrele (önerilen)', type: 'toggle' },
      { key: 'noise_suppression', icon: 'waveform', label: 'Gürültü Bastırma', desc: 'Arka plan gürültüsünü azalt', type: 'toggle' },
      { key: 'auto_gain', icon: 'tune-vertical', label: 'Otomatik Ses Seviyesi', desc: 'Mikrofonu otomatik dengele', type: 'toggle' },
    ],
  },
  {
    title: 'Gizlilik', icon: 'shield-check', color: ACCENT,
    items: [
      { key: 'show_online_status', icon: 'eye', label: 'Çevrimiçi Durumu', desc: 'Diğerleri seni çevrimiçi görsün', type: 'toggle' },
      { key: 'profile_private', icon: 'lock', label: 'Gizli Profil', desc: 'Sadece takipçiler', type: 'toggle' },
    ],
  },
  {
    title: 'Hesap', icon: 'account-circle', color: ACCENT,
    items: [
      { key: 'edit_profile', icon: 'account-edit', label: 'Profili Düzenle', type: 'action' },
      { key: 'blocked_users', icon: 'account-cancel', label: 'Engellenen Kullanıcılar', desc: 'Engellediğin kişileri yönet', type: 'action' },
      { key: 'hidden_rooms', icon: 'eye-off', label: 'Gizlenen Odalar', desc: 'Gizlediğin odaları geri getir', type: 'action' },
    ],
  },
  {
    title: 'Hakkında', icon: 'information', color: ACCENT,
    items: [
      { key: 'terms', icon: 'file-document', label: 'Kullanım Koşulları', type: 'link' },
      { key: 'privacy', icon: 'shield-lock', label: 'Gizlilik Politikası', type: 'link' },
      { key: 'version', icon: 'code-tags', label: 'Versiyon', desc: APP_VERSION, type: 'action' },
    ],
  },
  {
    title: 'Abonelik', icon: 'credit-card', color: ACCENT,
    items: [
      { key: 'restore_purchases', icon: 'refresh', label: 'Satın Almaları Geri Yükle', desc: 'Cihaz değişikliği sonrası premium\'u geri yükle', type: 'action' },
    ],
  },
  {
    title: 'Oturum', icon: 'logout-variant', color: ACCENT_DANGER,
    items: [
      { key: 'logout', icon: 'logout-variant', label: 'Çıkış Yap', type: 'action', danger: true },
      { key: 'delete_account', icon: 'trash-can', label: 'Hesabı Sil', desc: 'Tüm veriler kalıcı olarak silinir', type: 'action', danger: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ═══════════════════════════════════════════════════════════
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, setIsLoggedIn, setUser, profile, refreshProfile } = useAuth();
  const { applyTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [cAlert, setCAlert] = useState<{ visible: boolean; title: string; message: string; type?: 'info' | 'warning' | 'error' | 'success'; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });
  const [showBlockedSheet, setShowBlockedSheet] = useState(false);
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);

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

      // ★ Faz 3.4 — Mic ayarları değişirse LiveKit'e anında geçir (sonraki publish için aktif)
      if (key === 'echo_cancellation' || key === 'noise_suppression' || key === 'auto_gain') {
        try {
          const { liveKitService } = await import('../services/livekit');
          const opts: any = {};
          if (key === 'echo_cancellation') opts.echoCancellation = value;
          if (key === 'noise_suppression') opts.noiseSuppression = value;
          if (key === 'auto_gain') opts.autoGainControl = value;
          liveKitService.setAudioProcessing(opts);
        } catch {}
      }

      // Özel aksiyonlar
      if (key === 'theme') {
        setActiveTheme(value as ThemeKey);
        applyTheme(value as ThemeKey);
      }
      if (key === 'show_online_status' && firebaseUser) {
        ProfileService.setOnline(firebaseUser.uid, value).catch(() => {});
      }
      // ★ Gizli profil toggle — v110 (6 May 2026): hata yutulmuyor + cache refresh.
      //   Önceden silent catch + refreshProfile yoktu → useAuth().profile stale kalıyor,
      //   ekran kapanınca sync mantığı toggle'ı geri çeviriyordu ("çalışmıyor" hissi).
      if (key === 'profile_private' && firebaseUser) {
        const newPrivacyMode = value ? 'followers_only' : 'public';
        try {
          await ProfileService.update(firebaseUser.uid, {
            is_private: value,
            privacy_mode: newPrivacyMode,
          } as any);
          await refreshProfile(); // useAuth().profile'ı tazele — sonraki açılışta tutarlı
        } catch (err: any) {
          // DB yazımı başarısızsa toggle'ı eski haline döndür + kullanıcıyı bilgilendir
          setSettings(prev => prev ? { ...prev, profile_private: !value } : prev);
          await SettingsService.update({ profile_private: !value });
          showToast({
            title: 'Kaydedilemedi',
            message: 'Gizli profil ayarı sunucuya iletilemedi. Bağlantını kontrol et.',
            type: 'error',
          });
        }
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
                    // ★ v92.16: Logout'ta push token'ı sil — eski cihaz bildirim almasın
                    try {
                      const { PushNotificationService } = require('../services/pushNotifications');
                      const Notifications = require('expo-notifications');
                      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: 'bbd97aec-9d58-426f-8acc-215b24ff286a' });
                      if (tokenData?.data) {
                        await PushNotificationService.removePushToken(firebaseUser.uid, tokenData.data);
                      }
                    } catch { /* token alınamazsa sessiz — signOut yine devam eder */ }
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
                  showToast({ title: 'Çıkış Yapılamadı', message: 'Oturum kapatılamadı, tekrar dene.', type: 'error' });
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
            showToast({ title: 'Geri Yükleme Başarısız', message: 'Satın almalar kontrol edilemedi.', type: 'error' });
          }
        })();
        break;
      case 'version':
        // ★ 2026-04-27 GEÇİCİ: Versiyon + JWT teşhisi (Firebase Third-Party Auth doğrulama)
        (async () => {
          try {
            // ★ Önce Firebase tarafından bilgi al
            const fbUser = auth.currentUser;
            const fbUid = fbUser?.uid || '(currentUser NULL)';
            let tokenPreview = '(token alınamadı)';
            try {
              const tk = fbUser ? await fbUser.getIdToken(true) : null;
              tokenPreview = tk ? `${tk.slice(0, 20)}...${tk.slice(-10)}` : '(null)';
            } catch (te: any) {
              tokenPreview = `(hata: ${te?.message?.slice(0, 30)})`;
            }

            // ★ Sonra whoami RPC
            const { data, error } = await supabase.rpc('whoami');
            const r = data?.[0] || {};
            // ★ Firebase 3PA: role daima 'anon' — önemli olan app_uid() çalışması
            const ok = !!r.jwt_present && !!r.app_uid_result && r.app_uid_result !== '(NULL)';

            setCAlert({
              visible: true,
              title: ok ? '✅ JWT Doğrulanıyor' : '❌ JWT Sorunu',
              message:
                `Versiyon: ${APP_VERSION}\n\n` +
                `--- FIREBASE ---\n` +
                `currentUser.uid: ${fbUid}\n` +
                `Token: ${tokenPreview}\n\n` +
                `--- SUPABASE whoami ---\n` +
                `app_uid: ${r.app_uid_result || '(NULL)'}\n` +
                `jwt.sub: ${r.jwt_sub || '(NULL)'}\n` +
                `role: ${r.jwt_role || '(NULL)'}\n` +
                `JWT var: ${r.jwt_present ? 'EVET' : 'HAYIR'}` +
                (error ? `\n\nRPC HATA: ${error.message?.slice(0, 60)}` : ''),
              type: ok ? 'success' : 'warning',
              buttons: [{ text: 'Tamam' }],
            });
          } catch (e: any) {
            showToast({ title: 'Teşhis hatası', message: e?.message || 'whoami() çağrılamadı', type: 'error' });
          }
        })();
        break;
      case 'theme':
        showToast({ title: 'Çok Yakında', message: 'Aydınlık tema üzerinde çalışıyoruz.', type: 'info' });
        break;
      case 'language':
        showToast({ title: 'Çok Yakında', message: 'İngilizce dil desteği üzerinde çalışıyoruz.', type: 'info' });
        break;
      case 'blocked_users':
        setShowBlockedSheet(true);
        break;
      case 'hidden_rooms':
        router.push('/hidden-rooms' as any);
        break;
      case 'notification_prefs':
        setShowNotifPrefs(true);
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
                const userToDelete = firebaseUser;
                try {
                  // ★ 2026-05-09 v211: Module variable flag — AsyncStorage stale problemi yok.
                  //   Sıra: flag set → optimistic redirect → background delete.
                  const { performDeleteAccount, markAccountJustDeleted } = require('../services/account');
                  markAccountJustDeleted();
                  setIsLoggedIn(false);
                  setUser(null);
                  router.replace('/(auth)/login' as any);
                  performDeleteAccount(userToDelete).catch((e: any) => {
                    showToast({ title: 'Hesap Silinemedi', message: e?.message || 'İşlem tamamlanamadı.', type: 'error' });
                  });
                } catch (e: any) {
                  showToast({ title: 'Hesap Silinemedi', message: e?.message || 'İşlem tamamlanamadı.', type: 'error' });
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
    <AppBackground radialGlow>
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

            {/* ★ 2026-05-05: NotificationDrawer aile dili — slate diagonal + group color halo + soft glow */}
            <View style={s.groupCard}>
              <LinearGradient
                colors={['#3a4658', '#2a3344', '#1a2030']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <LinearGradient
                colors={[`${group.color}20`, `${group.color}06`, 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <LinearGradient
                colors={[`${group.color}0D`, 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              {/* Üst hairline — ince aksan korundu */}
              <LinearGradient
                colors={['transparent', `${group.color}99`, 'transparent']}
                locations={[0, 0.5, 1]}
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
                      color={item.danger ? ACCENT_DANGER : ICON_COLOR}
                      style={[s.rowIcon, {
                        textShadowColor: 'rgba(0,0,0,0.55)',
                        textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
                      }]}
                    />
                    <View style={s.rowText}>
                      <Text style={[s.rowLabel, item.danger && { color: ACCENT_DANGER }]}>
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
                        trackColor={{ false: '#1E293B', true: ACCENT }}
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
                        color={item.danger ? `${ACCENT_DANGER}80` : 'rgba(255,255,255,0.3)'}
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
    {firebaseUser && (
      <BlockedUsersSheet
        visible={showBlockedSheet}
        onClose={() => setShowBlockedSheet(false)}
        currentUserId={firebaseUser.uid}
      />
    )}
    {firebaseUser && (
      <NotifPreferencesSheet
        visible={showNotifPrefs}
        onClose={() => setShowNotifPrefs(false)}
        userId={firebaseUser.uid}
      />
    )}
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

  // ★ 2026-05-05: NotificationDrawer aile standardı — radius 16→22, slate bg
  groupCard: {
    borderRadius: 22,
    backgroundColor: '#1a2030',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
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
