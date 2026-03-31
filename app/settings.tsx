import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Alert, Switch, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../constants/firebase';

let GoogleSignin: any;
try {
  const gsignin = require('@react-native-google-signin/google-signin');
  GoogleSignin = gsignin.GoogleSignin;
} catch (e) {
  GoogleSignin = {
    revokeAccess: async () => {},
    signOut: async () => {},
  };
}
import { Colors, Radius } from '../constants/theme';
import { useAuth } from './_layout';
import { ProfileService } from '../services/database';
import { supabase } from '../constants/supabase';
import {
  SettingsService,
  type UserSettings,
  DEFAULT_SETTINGS,
  THEME_OPTIONS,
  LANGUAGE_OPTIONS,
} from '../services/settings';
import { setActiveTheme, type ThemeKey } from '../constants/themeEngine';

export default function SettingsScreen() {
  const router = useRouter();
  const { setIsLoggedIn, setUser, firebaseUser, setProfile } = useAuth();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; content: string }>({ visible: false, title: '', content: '' });
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; title: string; content: string; confirmText: string; danger: boolean; onConfirm: () => void }>({ visible: false, title: '', content: '', confirmText: 'Onayla', danger: false, onConfirm: () => {} });

  // Ayarları yükle
  useEffect(() => {
    (async () => {
      const s = await SettingsService.get();
      setSettings(s);
      setLoading(false);
    })();
  }, []);

  // Ayar güncelle ve kaydet
  const updateSetting = useCallback(async (key: keyof UserSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await SettingsService.update({ [key]: value });

    // Tema değişikliğini anında uygula
    if (key === 'theme') {
      setActiveTheme(value as ThemeKey);
    }

    // Gizlilik ayarları Supabase'e de senkronize
    if (key === 'show_online_status' && firebaseUser) {
      await ProfileService.setOnline(firebaseUser.uid, value as boolean).catch(() => {});
    }
  }, [settings, firebaseUser]);

  // Engellenen kullanıcıları yükle
  const loadBlockedUsers = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingBlocked(true);
    try {
      const { data } = await supabase
        .from('friendships')
        .select('*, friend:profiles!friend_id(*)')
        .eq('user_id', firebaseUser.uid)
        .eq('status', 'blocked');
      setBlockedUsers(data || []);
    } catch (err) {
      console.warn('Engellenenler yüklenemedi:', err);
    } finally {
      setLoadingBlocked(false);
    }
  }, [firebaseUser]);

  // Engelleme kaldır
  const unblockUser = useCallback(async (friendshipId: string, userName: string) => {
    setConfirmModal({
      visible: true,
      title: 'Engeli Kaldır',
      content: `${userName} kullanıcısının engelini kaldırmak istiyor musunuz?`,
      confirmText: 'Kaldır',
      danger: false,
      onConfirm: async () => {
        await supabase.from('friendships').delete().eq('id', friendshipId);
        setBlockedUsers(prev => prev.filter(b => b.id !== friendshipId));
      }
    });
  }, []);

  // Çıkış yap
  const handleLogout = () => {
    setConfirmModal({
      visible: true,
      title: 'Çıkış Yap',
      content: 'Hesabınızdan çıkış yapmak istediğinize emin misiniz? Oturumunuz anında sonlandırılacak.',
      confirmText: 'Çıkış Yap',
      danger: true,
      onConfirm: async () => {
        if (firebaseUser) {
          await ProfileService.setOnline(firebaseUser.uid, false).catch(() => {});
        }
        // Google oturumunu tamamen temizle (başka hesapla giriş için)
        try {
          await GoogleSignin.revokeAccess();
          await GoogleSignin.signOut();
        } catch (_) { /* Google ile giriş yapılmamışsa ignore et */ }
        
        await signOut(auth);
        setProfile(null);
        setUser(null);
        setIsLoggedIn(false);
      }
    });
  };

  // Veri indirme
  const handleDataExport = () => {
    setConfirmModal({
      visible: true,
      title: 'Veri İndirme',
      content: 'Tüm verilerinizi içeren bir dosya hazırlanacak ve e-posta adresinize gönderilecektir. İşlem sunucunun yoğunluğuna bağlı olarak birkaç dakika sürebilir.',
      confirmText: 'İndir',
      danger: false,
      onConfirm: () => {
        setInfoModal({ visible: true, title: 'İstek Alındı', content: 'Veri dışa aktarma isteğiniz başarıyla oluşturuldu. Hazır olduğunda bilgilendirileceksiniz.' });
      }
    });
  };

  // Ayarları sıfırla
  const handleResetSettings = () => {
    setConfirmModal({
      visible: true,
      title: 'Ayarları Sıfırla',
      content: 'Tüm kişisel yapılandırmalarınız ve bildirim ayarlarınız varsayılan değerlerine döndürülecek. Devam etmek istiyor musunuz?',
      confirmText: 'Sıfırla',
      danger: true,
      onConfirm: async () => {
        const reset = await SettingsService.reset();
        setSettings(reset);
        setInfoModal({ visible: true, title: 'Başarılı', content: 'Tüm ayarlarınız varsayılana döndürüldü.' });
      }
    });
  };

  const handlePasswordInfo = () => {
    setInfoModal({
      visible: true,
      title: 'Şifre ve Güvenlik',
      content: 'Google hesabınızla giriş yaptığınız için şifre yönetimi Google hesabınız üzerinden yapılmaktadır.\n\nGoogle Hesap Ayarları → Güvenlik → Şifre bölümünden değiştirebilirsiniz.'
    });
  };

  const themeLabel = THEME_OPTIONS.find(t => t.key === settings.theme)?.label || 'OLED Siyah';
  const languageLabel = LANGUAGE_OPTIONS.find(l => l.key === settings.language)?.label || 'Türkçe';

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ===== HESAP ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>

          {/* Profili Düzenle */}
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.teal}18` }]}>
              <Ionicons name="person-outline" size={20} color={Colors.teal} />
            </View>
            <Text style={styles.menuLabel}>Profili Düzenle</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </Pressable>

          {/* Şifre ve Güvenlik */}
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handlePasswordInfo}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.sapphire}18` }]}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.sapphire} />
            </View>
            <Text style={styles.menuLabel}>Şifre ve Güvenlik</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </Pressable>

          {/* İki Faktörlü Doğrulama */}
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.emerald}18` }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.emerald} />
            </View>
            <Text style={styles.menuLabel}>İki Faktörlü Doğrulama</Text>
            <Switch
              value={settings.two_factor_enabled}
              onValueChange={(v) => updateSetting('two_factor_enabled', v)}
              trackColor={{ false: Colors.bg5, true: Colors.emerald + '60' }}
              thumbColor={settings.two_factor_enabled ? Colors.emerald : Colors.text3}
            />
          </View>
        </View>

        {/* ===== TERCİHLER ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tercihler</Text>

          {/* Bildirimler */}
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.amber}18` }]}>
              <Ionicons name="notifications-outline" size={20} color={Colors.amber} />
            </View>
            <Text style={styles.menuLabel}>Bildirimler</Text>
            <Switch
              value={settings.notifications_enabled}
              onValueChange={(v) => updateSetting('notifications_enabled', v)}
              trackColor={{ false: Colors.bg5, true: Colors.amber + '60' }}
              thumbColor={settings.notifications_enabled ? Colors.amber : Colors.text3}
            />
          </View>

          {/* Bildirim Sesi — sadece bildirimler açıksa */}
          {settings.notifications_enabled && (
            <View style={[styles.menuItem, styles.subMenuItem]}>
              <View style={[styles.menuIcon, styles.subMenuIcon, { backgroundColor: `${Colors.amber}10` }]}>
                <Ionicons name="volume-medium-outline" size={18} color={Colors.amber} />
              </View>
              <Text style={[styles.menuLabel, styles.subMenuLabel]}>Bildirim Sesi</Text>
              <Switch
                value={settings.notification_sound}
                onValueChange={(v) => updateSetting('notification_sound', v)}
                trackColor={{ false: Colors.bg5, true: Colors.amber + '40' }}
                thumbColor={settings.notification_sound ? Colors.amber : Colors.text3}
              />
            </View>
          )}

          {/* Titreşim — sadece bildirimler açıksa */}
          {settings.notifications_enabled && (
            <View style={[styles.menuItem, styles.subMenuItem]}>
              <View style={[styles.menuIcon, styles.subMenuIcon, { backgroundColor: `${Colors.amber}10` }]}>
                <Ionicons name="phone-portrait-outline" size={18} color={Colors.amber} />
              </View>
              <Text style={[styles.menuLabel, styles.subMenuLabel]}>Titreşim</Text>
              <Switch
                value={settings.notification_vibration}
                onValueChange={(v) => updateSetting('notification_vibration', v)}
                trackColor={{ false: Colors.bg5, true: Colors.amber + '40' }}
                thumbColor={settings.notification_vibration ? Colors.amber : Colors.text3}
              />
            </View>
          )}

          {/* Tema & Görünüm */}
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => setShowThemePicker(true)}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.ice}18` }]}>
              <Ionicons name="color-palette-outline" size={20} color={Colors.ice} />
            </View>
            <Text style={styles.menuLabel}>Tema & Görünüm</Text>
            <View style={styles.menuRight}>
              <Text style={styles.menuValue}>{themeLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
            </View>
          </Pressable>

          {/* Dil */}
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => setShowLanguagePicker(true)}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.steel}18` }]}>
              <Ionicons name="language-outline" size={20} color={Colors.steel} />
            </View>
            <Text style={styles.menuLabel}>Dil</Text>
            <View style={styles.menuRight}>
              <Text style={styles.menuValue}>{languageLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
            </View>
          </Pressable>
        </View>

        {/* ===== GİZLİLİK ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gizlilik</Text>

          {/* Gizli Profil */}
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.teal}18` }]}>
              <Ionicons name="eye-off-outline" size={20} color={Colors.teal} />
            </View>
            <View style={styles.menuLabelWrap}>
              <Text style={styles.menuLabel}>Gizli Profil</Text>
              <Text style={styles.menuDesc}>Profiliniz keşfet'te görünmez</Text>
            </View>
            <Switch
              value={settings.profile_private}
              onValueChange={(v) => updateSetting('profile_private', v)}
              trackColor={{ false: Colors.bg5, true: Colors.teal + '60' }}
              thumbColor={settings.profile_private ? Colors.teal : Colors.text3}
            />
          </View>

          {/* Çevrimiçi Durumu */}
          <View style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.emerald}18` }]}>
              <Ionicons name="radio-outline" size={20} color={Colors.emerald} />
            </View>
            <View style={styles.menuLabelWrap}>
              <Text style={styles.menuLabel}>Çevrimiçi Durumu</Text>
              <Text style={styles.menuDesc}>Diğerleri seni çevrimiçi görsün</Text>
            </View>
            <Switch
              value={settings.show_online_status}
              onValueChange={(v) => updateSetting('show_online_status', v)}
              trackColor={{ false: Colors.bg5, true: Colors.emerald + '60' }}
              thumbColor={settings.show_online_status ? Colors.emerald : Colors.text3}
            />
          </View>

          {/* Engellenen Kullanıcılar */}
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => {
              setShowBlockedUsers(true);
              loadBlockedUsers();
            }}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.red}18` }]}>
              <Ionicons name="people-outline" size={20} color={Colors.red} />
            </View>
            <Text style={styles.menuLabel}>Engellenen Kullanıcılar</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </Pressable>

          {/* Veri İndirme */}
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleDataExport}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.gold}18` }]}>
              <Ionicons name="document-text-outline" size={20} color={Colors.gold} />
            </View>
            <Text style={styles.menuLabel}>Veri İndirme</Text>
            <Ionicons name="download-outline" size={16} color={Colors.text3} />
          </Pressable>
        </View>

        {/* ===== DESTEK ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Destek</Text>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => setInfoModal({
              visible: true,
              title: 'Yardım & SSS',
              content: '📌 Sık Sorulan Sorular\n\n' +
              '❓ Soprano Coin nasıl kazanılır?\n→ Oda oluşturarak, etkinliklere katılarak ve günlük ödüllerle.\n\n' +
              '❓ Plus üyelik ne sağlar?\n→ Özel odalar, premium avatarlar ve öncelikli erişim.\n\n' +
              '❓ Profil tier sistemi nedir?\n→ Silver → Plat → VIP. Coin harcayarak yükselebilirsiniz.\n\n' +
              '❓ Odada nasıl konuşmacı olunur?\n→ Oda sahibi sizi konuşmacı olarak atayabilir.\n\n' +
              '📧 Daha fazla yardım: destek@sopranochat.com'
            })}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.ice}18` }]}>
              <Ionicons name="help-circle-outline" size={20} color={Colors.ice} />
            </View>
            <Text style={styles.menuLabel}>Yardım & SSS</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => setInfoModal({
              visible: true,
              title: 'Bize Ulaşın',
              content: '📧 E-posta: destek@sopranochat.com\n\n' +
              '🐦 Twitter: @SopranoChatTR\n\n' +
              '📱 Instagram: @sopranochat\n\n' +
              'Yanıt süresi: Maksimum 24 saat içinde dönüş sağlanır.'
            })}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.emerald}18` }]}>
              <Ionicons name="chatbubble-outline" size={20} color={Colors.emerald} />
            </View>
            <Text style={styles.menuLabel}>Bize Ulaşın</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => setInfoModal({
              visible: true,
              title: 'İçerik Bildirimi',
              content: 'Uygunsuz bir içerik bildirmek için lütfen ilgili profil, mesaj veya odada eleman üzerine uzun basarak "Bildir" seçeneğini kullanın.\n\n' +
              'Tehlikeli ve acil durumlar için: abuse@sopranochat.com'
            })}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.amber}18` }]}>
              <Ionicons name="flag-outline" size={20} color={Colors.amber} />
            </View>
            <Text style={styles.menuLabel}>İçerik Bildirimi</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => setInfoModal({
              visible: true,
              title: 'SopranoChat',
              content: 'Versiyon 1.0.0\n\n© 2026 SopranoChat\nTüm hakları saklıdır.\n\nWalid Inc. tarafından özenle geliştirilmiştir.\n\n"Senin Sesin, Senin Mahallen"'
            })}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${Colors.silver}18` }]}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.silver} />
            </View>
            <Text style={styles.menuLabel}>Hakkında</Text>
            <View style={styles.menuRight}>
              <Text style={styles.menuValue}>v1.0.0</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
            </View>
          </Pressable>
        </View>

        {/* Ayarları Sıfırla */}
        <Pressable style={styles.resetBtn} onPress={handleResetSettings}>
          <Ionicons name="refresh-outline" size={18} color={Colors.text3} />
          <Text style={styles.resetText}>Ayarları Sıfırla</Text>
        </Pressable>

        {/* Çıkış Yap */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.red} />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>

        <Text style={styles.version}>SopranoChat v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ===== TEMA PICKER MODAL ===== */}
      <Modal
        visible={showThemePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowThemePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemePicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Tema Seçin</Text>

            {THEME_OPTIONS.map((theme) => (
              <Pressable
                key={theme.key}
                style={[
                  styles.optionItem,
                  settings.theme === theme.key && styles.optionItemSelected,
                ]}
                onPress={() => {
                  updateSetting('theme', theme.key);
                  setShowThemePicker(false);
                }}
              >
                <View style={styles.optionLeft}>
                  <View style={[
                    styles.themePreview,
                    theme.key === 'oled' && { backgroundColor: '#07080A' },
                    theme.key === 'dark' && { backgroundColor: '#1A1D22' },
                    theme.key === 'midnight' && { backgroundColor: '#0F172A' },
                  ]} />
                  <View>
                    <Text style={styles.optionLabel}>{theme.label}</Text>
                    <Text style={styles.optionDesc}>{theme.desc}</Text>
                  </View>
                </View>
                {settings.theme === theme.key && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.teal} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ===== DİL PICKER MODAL ===== */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguagePicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Dil Seçin</Text>

            {LANGUAGE_OPTIONS.map((lang) => (
              <Pressable
                key={lang.key}
                style={[
                  styles.optionItem,
                  settings.language === lang.key && styles.optionItemSelected,
                ]}
                onPress={() => {
                  updateSetting('language', lang.key);
                  setShowLanguagePicker(false);
                }}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.flagEmoji}>{lang.flag}</Text>
                  <Text style={styles.optionLabel}>{lang.label}</Text>
                </View>
                {settings.language === lang.key && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.teal} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ===== ENGELLENEN KULLANICILAR MODAL ===== */}
      <Modal
        visible={showBlockedUsers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBlockedUsers(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowBlockedUsers(false)}>
          <View style={[styles.modalSheet, { maxHeight: '60%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Engellenen Kullanıcılar</Text>

            {loadingBlocked ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={Colors.teal} />
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="happy-outline" size={48} color={Colors.text3} />
                <Text style={styles.emptyText}>Engellenen kullanıcı yok</Text>
                <Text style={styles.emptySubtext}>
                  Bir kullanıcıyı engellemek için profilinde veya mesajında uzun basın.
                </Text>
              </View>
            ) : (
              <ScrollView>
                {blockedUsers.map((item) => (
                  <View key={item.id} style={styles.blockedItem}>
                    <View style={styles.blockedLeft}>
                      <View style={styles.blockedAvatar}>
                        <Ionicons name="person" size={18} color={Colors.text3} />
                      </View>
                      <Text style={styles.blockedName}>
                        {item.friend?.display_name || 'Kullanıcı'}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.unblockBtn}
                      onPress={() => unblockUser(item.id, item.friend?.display_name || 'Kullanıcı')}
                    >
                      <Text style={styles.unblockText}>Kaldır</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
      {/* ===== INFO MODAL ===== */}
      <Modal
        visible={infoModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModal({ ...infoModal, visible: false })}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setInfoModal({ ...infoModal, visible: false })}>
          <View style={[styles.modalSheet, { paddingBottom: 30 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{infoModal.title}</Text>
            <Text style={{ fontSize: 13, color: Colors.text2, lineHeight: 22 }}>{infoModal.content}</Text>
            <Pressable 
              style={{ marginTop: 24, paddingVertical: 12, backgroundColor: Colors.teal, borderRadius: Radius.default, alignItems: 'center' }}
              onPress={() => setInfoModal({ ...infoModal, visible: false })}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Anladım</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      {/* ===== CONFIRM MODAL ===== */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal({ ...confirmModal, visible: false })}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setConfirmModal({ ...confirmModal, visible: false })}>
          <View style={[styles.modalSheet, { paddingBottom: 30 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{confirmModal.title}</Text>
            <Text style={{ fontSize: 13, color: Colors.text2, lineHeight: 22, marginBottom: 24 }}>{confirmModal.content}</Text>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable 
                style={{ flex: 1, paddingVertical: 12, backgroundColor: Colors.glass2, borderRadius: Radius.default, alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder }}
                onPress={() => setConfirmModal({ ...confirmModal, visible: false })}
              >
                <Text style={{ color: Colors.text, fontWeight: '600', fontSize: 15 }}>İptal</Text>
              </Pressable>
              <Pressable 
                style={{ flex: 1, paddingVertical: 12, backgroundColor: confirmModal.danger ? Colors.red : Colors.teal, borderRadius: Radius.default, alignItems: 'center' }}
                onPress={() => {
                  setConfirmModal({ ...confirmModal, visible: false });
                  confirmModal.onConfirm();
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{confirmModal.confirmText}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  // Sections
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: Colors.text3,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 20, marginBottom: 6, marginTop: 8,
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 13,
  },
  menuItemPressed: { backgroundColor: Colors.glass2 },
  subMenuItem: { paddingLeft: 40 },
  menuIcon: {
    width: 36, height: 36, borderRadius: Radius.xs,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  subMenuIcon: { width: 30, height: 30 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text },
  subMenuLabel: { fontSize: 13, color: Colors.text2 },
  menuLabelWrap: { flex: 1 },
  menuDesc: { fontSize: 11, color: Colors.text3, marginTop: 2 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuValue: { fontSize: 12, color: Colors.text3 },

  // Buttons
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 20, marginTop: 24, paddingVertical: 12,
    borderRadius: Radius.default, backgroundColor: Colors.glass2,
    borderWidth: 1, borderColor: Colors.glassBorder,
  },
  resetText: { fontSize: 13, fontWeight: '500', color: Colors.text3 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 20, marginTop: 10, paddingVertical: 14,
    borderRadius: Radius.default, backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutText: { fontSize: 14, fontWeight: '600', color: Colors.red },
  version: { fontSize: 11, color: Colors.text3, textAlign: 'center', marginTop: 20 },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: Colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.text3, alignSelf: 'center',
    marginTop: 12, marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.text,
    marginBottom: 16,
  },

  // Option Items
  optionItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: Radius.default, marginBottom: 8,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  optionItemSelected: { borderColor: Colors.teal + '50' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  optionDesc: { fontSize: 11, color: Colors.text3, marginTop: 2 },
  flagEmoji: { fontSize: 24 },
  themePreview: {
    width: 36, height: 36, borderRadius: 8,
    borderWidth: 2, borderColor: Colors.glassBorder2,
  },

  // Blocked Users
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.text2 },
  emptySubtext: { fontSize: 12, color: Colors.text3, textAlign: 'center', paddingHorizontal: 20 },
  blockedItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  blockedLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockedAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bg4, justifyContent: 'center', alignItems: 'center',
  },
  blockedName: { fontSize: 14, fontWeight: '500', color: Colors.text },
  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.red + '15', borderWidth: 1, borderColor: Colors.red + '30',
  },
  unblockText: { fontSize: 12, fontWeight: '600', color: Colors.red },
});
