import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, TextInput,
  ScrollView, Alert, ActivityIndicator, Switch,
  Platform, Keyboard, Dimensions, Share,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import * as AuthSession from 'expo-auth-session';
import {
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  reauthenticateWithCredential,
  updateProfile,
} from 'firebase/auth';
import { Colors, Gradients, Radius, Shadows } from '../constants/theme';
import AppBackground from '../components/AppBackground';
import { ProfileService } from '../services/database';
import { auth, GOOGLE_WEB_CLIENT_ID } from '../constants/firebase';
import { AVATAR_OPTIONS, getAvatarSource } from '../constants/avatars';
import { useAuth } from './_layout';
import { showToast } from '../components/Toast';
import { ReferralService } from '../services/referral';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoClipboard from 'expo-clipboard';
import { StorageService } from '../services/storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, firebaseUser, setProfile, setUser, refreshProfile } = useAuth();

  // === Profile fields ===
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || AVATAR_OPTIONS[0]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // === Privacy toggles ===
  const [hideOwnedRooms, setHideOwnedRooms] = useState((profile as any)?.hide_owned_rooms || false);
  const [privacyMode, setPrivacyMode] = useState<'public' | 'followers_only' | 'private'>((profile as any)?.privacy_mode || 'public');

  // === Account linking (anonymous upgrade) ===
  const [showEmailRegister, setShowEmailRegister] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [linking, setLinking] = useState(false);

  // === Password change ===
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // === Referral System ===
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);

  // === Keyboard ===
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const formContainerY = useRef(0);
  const fieldPositions = useRef<Record<string, number>>({});

  const userId = firebaseUser?.uid || profile?.id;

  const isGoogleUser = firebaseUser?.providerData?.some(p => p.providerId === 'google.com') ?? false;
  const isEmailUser = firebaseUser?.providerData?.some(p => p.providerId === 'password') ?? false;
  const userEmail = firebaseUser?.email || firebaseUser?.providerData?.[0]?.email || null;

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Fetch Referral Data
  useEffect(() => {
    if (userId) {
      ReferralService.getMyCode(userId).then(setMyReferralCode);
      ReferralService.getReferralCount(userId).then(setReferralCount);
    }
  }, [userId]);

  const scrollToField = useCallback((fieldName: string) => {
    const fieldY = fieldPositions.current[fieldName];
    if (fieldY !== undefined && scrollRef.current) {
      const targetY = formContainerY.current + fieldY;
      const visibleArea = SCREEN_HEIGHT - 66 - (keyboardHeight || 300);
      const scrollTarget = Math.max(0, targetY - visibleArea + 120);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollTarget, animated: true });
      }, 150);
    }
  }, [keyboardHeight]);

  // === Actions ===
  const handlePickAvatar = async () => {
    if (!firebaseUser) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setShowAvatarPicker(false);
        setUploadingAvatar(true);
        const uploadUrl = await StorageService.uploadAvatar(firebaseUser.uid, result.assets[0].uri);
        setAvatarUrl(uploadUrl);
        showToast({ title: 'Başarılı', message: 'Profil fotoğrafınız yüklendi.', type: 'success' });
      }
    } catch (err: any) {
      showToast({ title: 'Hata', message: err.message || 'Fotoğraf yüklenemedi.', type: 'error' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // === SAVE PROFILE ===
  const handleSave = async () => {
    if (!displayName.trim()) {
      showToast({ type: 'warning', title: 'Uyarı', message: 'Görünen ad boş olamaz.' });
      return;
    }
    if (!userId) {
      showToast({ type: 'error', title: 'Hata', message: 'Kullanıcı bulunamadı.' });
      return;
    }

    Keyboard.dismiss();
    setSaving(true);
    try {
      // ★ B1 FIX: privacy_mode'dan is_private türet — tek kaynak
      const derivedIsPrivate = privacyMode !== 'public';

      await ProfileService.update(userId, {
        display_name: displayName.trim(),
        username: username.trim() || null,
        bio: bio.trim(),
        avatar_url: avatarUrl,
        hide_owned_rooms: hideOwnedRooms,
        privacy_mode: privacyMode,
        is_private: derivedIsPrivate,
      });

      // Firebase profile da güncelle
      if (firebaseUser) {
        await updateProfile(firebaseUser, {
          displayName: displayName.trim(),
          photoURL: avatarUrl,
        }).catch(() => {});
      }

      // ★ B2 FIX: Lokal state — tüm güncellenen alanları kapsayan güncellenme
      const updatedProfile = {
        ...profile!,
        display_name: displayName.trim(),
        username: username.trim() || null,
        bio: bio.trim(),
        avatar_url: avatarUrl,
        hide_owned_rooms: hideOwnedRooms,
        privacy_mode: privacyMode,
        is_private: derivedIsPrivate,
      };
      setProfile(updatedProfile);
      setUser({ name: updatedProfile.display_name, avatar: updatedProfile.avatar_url });

      // ★ U3 FIX: Profil tab'ı dönüşte güncel veriyi görsün
      refreshProfile().catch(() => {});

      showToast({ title: 'Başarılı ✓', message: 'Profil güncellendi!', type: 'success' });
      safeGoBack(router);
    } catch (error: any) {
      if (error?.message?.includes('duplicate') || error?.code === '23505') {
        showToast({ type: 'error', title: 'Hata', message: 'Bu kullanıcı adı zaten alınmış.' });
      } else {
        showToast({ type: 'error', title: 'Hata', message: 'Profil güncellenirken sorun oluştu.' });
      }
    } finally {
      setSaving(false);
    }
  };

  // === LINK GOOGLE ===
  const handleLinkGoogle = async () => {
    if (!firebaseUser) return;
    setLinking(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'sopranochat' });
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_WEB_CLIENT_ID,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.IdToken,
        usePKCE: false,
      });

      const result = await request.promptAsync(discovery);
      if (result.type === 'success' && result.params?.id_token) {
        const credential = GoogleAuthProvider.credential(result.params.id_token);
        await linkWithCredential(firebaseUser, credential);
        showToast({ type: 'success', title: 'Başarılı ✓', message: 'Google hesabınız başarıyla bağlandı! Artık Google ile giriş yapabilirsiniz.' });
      }
    } catch (error: any) {
      if (__DEV__) console.error('Google link error:', error);
      if (error?.code === 'auth/credential-already-in-use') {
        showToast({ type: 'warning', title: 'Uyarı', message: 'Bu Google hesabı zaten başka bir kullanıcıya bağlı.' });
      } else if (error?.code === 'auth/provider-already-linked') {
        showToast({ type: 'info', title: 'Bilgi', message: 'Google hesabınız zaten bağlı.' });
      } else {
        showToast({ type: 'error', title: 'Hata', message: 'Google bağlantısı kurulamadı. Lütfen tekrar deneyin.' });
      }
    } finally {
      setLinking(false);
    }
  };

  // === LINK EMAIL/PASSWORD ===
  const handleLinkEmail = async () => {
    if (!firebaseUser) return;

    if (!regEmail.trim()) {
      showToast({ type: 'warning', title: 'Hata', message: 'E-posta adresi gerekli.' });
      return;
    }
    if (regPassword.length < 6) {
      showToast({ type: 'warning', title: 'Hata', message: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      showToast({ type: 'warning', title: 'Hata', message: 'Şifreler uyuşmuyor.' });
      return;
    }

    Keyboard.dismiss();
    setLinking(true);
    try {
      const credential = EmailAuthProvider.credential(regEmail.trim(), regPassword);
      await linkWithCredential(firebaseUser, credential);
      showToast({ title: 'Başarılı ✓', message: 'E-posta hesabınız başarıyla oluşturuldu! Artık e-posta ve şifre ile giriş yapabilirsiniz.', type: 'success' });
      setShowEmailRegister(false);
      setRegEmail('');
      setRegPassword('');
      setRegPasswordConfirm('');
    } catch (error: any) {
      if (__DEV__) console.error('Email link error:', error);
      if (error?.code === 'auth/email-already-in-use') {
        showToast({ type: 'error', title: 'Hata', message: 'Bu e-posta adresi zaten kullanılıyor.' });
      } else if (error?.code === 'auth/invalid-email') {
        showToast({ type: 'error', title: 'Hata', message: 'Geçersiz e-posta adresi.' });
      } else if (error?.code === 'auth/provider-already-linked') {
        showToast({ type: 'info', title: 'Bilgi', message: 'E-posta hesabı zaten bağlı.' });
      } else {
        showToast({ type: 'error', title: 'Hata', message: 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.' });
      }
    } finally {
      setLinking(false);
    }
  };

  // === CHANGE PASSWORD ===
  const handleChangePassword = async () => {
    if (!firebaseUser || !firebaseUser.email) return;

    if (!currentPassword) {
      showToast({ type: 'warning', title: 'Uyarı', message: 'Mevcut şifrenizi girin.' });
      return;
    }
    if (newPassword.length < 6) {
      showToast({ type: 'warning', title: 'Uyarı', message: 'Yeni şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showToast({ type: 'warning', title: 'Uyarı', message: 'Yeni şifreler uyuşmuyor.' });
      return;
    }

    Keyboard.dismiss();
    setChangingPassword(true);
    try {
      // Önce yeniden kimlik doğrula
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      // Sonra şifreyi güncelle
      await updatePassword(firebaseUser, newPassword);
      showToast({ title: 'Başarılı ✓', message: 'Şifreniz güncellendi!', type: 'success' });
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (error: any) {
      if (__DEV__) console.error('Password change error:', error);
      if (error?.code === 'auth/wrong-password') {
        showToast({ type: 'error', title: 'Hata', message: 'Mevcut şifreniz yanlış.' });
      } else if (error?.code === 'auth/requires-recent-login') {
        showToast({ type: 'error', title: 'Hata', message: 'Bu işlem için yeniden giriş yapmanız gerekiyor.' });
      } else {
        showToast({ type: 'error', title: 'Hata', message: 'Şifre değiştirilemedi. Lütfen tekrar deneyin.' });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const hasChanges =
    displayName !== (profile?.display_name || '') ||
    username !== (profile?.username || '') ||
    bio !== (profile?.bio || '') ||
    avatarUrl !== (profile?.avatar_url || '') ||
    hideOwnedRooms !== ((profile as any)?.hide_owned_rooms || false) ||
    privacyMode !== ((profile as any)?.privacy_mode || 'public');

  // Auth type label
  const getAuthTypeInfo = () => {
    if (isGoogleUser) return { label: 'Google Hesabı', icon: 'logo-google' as const, color: Colors.sapphire };
    if (isEmailUser) return { label: 'E-posta Hesabı', icon: 'mail-outline' as const, color: Colors.teal };
    return { label: 'Hesap', icon: 'person-outline' as const, color: Colors.text3 };
  };
  const authInfo = getAuthTypeInfo();

  return (
    <AppBackground>
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profili Düzenle</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || !hasChanges}
          style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.saveBtnText, !hasChanges && styles.saveBtnTextDisabled]}>Kaydet</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingBottom: keyboardHeight > 0 ? keyboardHeight + 60 : 120,
        }}
      >
        {/* ===== AVATAR SECTION ===== */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <Image source={getAvatarSource(avatarUrl)} style={styles.avatarImage} />
            <Pressable style={styles.cameraBtn} onPress={() => setShowAvatarPicker(!showAvatarPicker)}>
              <Ionicons name="camera" size={16} color="#fff" />
            </Pressable>
          </View>
          <Pressable onPress={() => setShowAvatarPicker(!showAvatarPicker)}>
            <Text style={styles.changeAvatarText}>
              {showAvatarPicker ? 'Kapat' : 'Fotoğrafı Değiştir'}
            </Text>
          </Pressable>
        </View>

        {showAvatarPicker && (
          <View style={styles.avatarPicker}>
            <Text style={styles.pickerTitle}>Avatar Seç</Text>
            
            <Pressable style={styles.ctaWrap} onPress={handlePickAvatar} disabled={uploadingAvatar}>
              <LinearGradient colors={['#14B8A6', '#0D9488', '#065F56']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGradient}>
                {uploadingAvatar ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <View style={styles.ctaIconWrap}><Ionicons name="images" size={16} color="#FFF" /></View>
                    <Text style={styles.ctaTitle}>Galeriden Yükle</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((url: string, i: number) => (
                <Pressable
                  key={i}
                  style={[styles.avatarOption, avatarUrl === url && styles.avatarOptionSelected]}
                  onPress={() => { setAvatarUrl(url); setShowAvatarPicker(false); }}
                >
                  <Image source={getAvatarSource(url)} style={styles.avatarOptionImg} />
                  {avatarUrl === url && (
                    <View style={styles.selectedCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ===== BASIC FORM FIELDS ===== */}
        <View
          style={styles.form}
          onLayout={(e) => { formContainerY.current = e.nativeEvent.layout.y; }}
        >
          <View
            style={styles.field}
            onLayout={(e) => { fieldPositions.current['displayName'] = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.fieldLabel}>Görünen Ad</Text>
            <TextInput
              style={styles.textInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Adınız"
              placeholderTextColor={Colors.text3}
              maxLength={30}
              returnKeyType="next"
              onFocus={() => scrollToField('displayName')}
            />
            <Text style={styles.charCount}>{displayName.length}/30</Text>
          </View>

          <View
            style={styles.field}
            onLayout={(e) => { fieldPositions.current['username'] = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.fieldLabel}>Kullanıcı Adı</Text>
            <View style={styles.usernameWrap}>
              <Text style={styles.usernameAt}>@</Text>
              <TextInput
                style={[styles.textInput, styles.usernameInput]}
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="kullanici_adi"
                placeholderTextColor={Colors.text3}
                maxLength={20}
                autoCapitalize="none"
                returnKeyType="next"
                onFocus={() => scrollToField('username')}
              />
            </View>
            <Text style={styles.fieldHint}>Sadece küçük harfler, rakamlar ve alt çizgi</Text>
          </View>

          <View
            style={styles.field}
            onLayout={(e) => { fieldPositions.current['bio'] = e.nativeEvent.layout.y; }}
          >
            <Text style={styles.fieldLabel}>Biyografi</Text>
            <TextInput
              style={[styles.textInput, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Kendinizden bahsedin..."
              placeholderTextColor={Colors.text3}
              multiline
              numberOfLines={3}
              maxLength={150}
              returnKeyType="done"
              blurOnSubmit
              onFocus={() => scrollToField('bio')}
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
          </View>
        </View>

        {/* ===== DAVET SİSTEMİ ===== */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>DAVET KAZANÇLARI</Text>
        </View>

        <View style={styles.accountInfoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Davet Kodun</Text>
              <Text style={styles.fieldHint}>Paylaş, kayıt olunca 50'şer SP kazanın.</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="people" size={14} color={Colors.teal} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.teal }}>{referralCount} Kişi</Text>
            </View>
          </View>

          {myReferralCode ? (
            <View style={styles.referralBox}>
              <Text style={styles.referralCodeText}>{myReferralCode}</Text>
              <Pressable 
                style={styles.copyBtn} 
                onPress={async () => {
                  // ★ B4 FIX: Deprecated RN Clipboard → expo-clipboard
                  await ExpoClipboard.setStringAsync(myReferralCode);
                  showToast({ title: 'Kopyalandı', type: 'success' });
                }}
              >
                <Ionicons name="copy-outline" size={20} color={Colors.teal} />
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator size="small" color={Colors.teal} style={{ marginVertical: 10 }} />
          )}

          <Pressable style={styles.ctaWrap} onPress={async () => {
              if (!myReferralCode) return;
              try { await Share.share({ message: `SopranoChat'e katıl!\nDavet kodum: ${myReferralCode}\nhttps://sopranochat.com/`, title: 'Ödüllü Davet Kodu' }); } catch (e) { if (__DEV__) console.error('[EditProfile] İşlem hatası:', e); }
            }}>
            <LinearGradient colors={['#14B8A6', '#0D9488', '#065F56']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGradient}>
              <View style={styles.ctaIconWrap}><Ionicons name="share-social" size={16} color="#FFF" /></View>
              <Text style={styles.ctaTitle}>Kodu Paylaş</Text>
              <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* ===== HESAP BİLGİLERİ ===== */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>HESAP BİLGİLERİ</Text>
        </View>

        {/* Account Type */}
        <View style={styles.accountInfoCard}>
          <View style={styles.accountRow}>
            <View style={[styles.accountIcon, { backgroundColor: `${authInfo.color}18` }]}>
              <Ionicons name={authInfo.icon} size={18} color={authInfo.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountLabel}>Hesap Türü</Text>
              <Text style={styles.accountValue}>{authInfo.label}</Text>
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.emerald} />
              <Text style={styles.verifiedText}>Doğrulanmış</Text>
            </View>
          </View>

          {userEmail && (
            <View style={[styles.accountRow, { marginTop: 8 }]}>
              <View style={[styles.accountIcon, { backgroundColor: `${Colors.ice}18` }]}>
                <Ionicons name="mail-outline" size={18} color={Colors.ice} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountLabel}>E-posta</Text>
                <Text style={styles.accountValue}>{userEmail}</Text>
              </View>
            </View>
          )}
        </View>


        {/* ===== GOOGLE KULLANICISI — BİLGİ ===== */}
        {isGoogleUser && !isEmailUser && (
          <View style={styles.infoCard}>
            <Ionicons name="logo-google" size={18} color={Colors.sapphire} />
            <Text style={styles.infoText}>
              Şifreniz Google hesabınız üzerinden yönetilmektedir. Şifre değişikliği için Google Hesap Ayarları → Güvenlik bölümünü kullanın.
            </Text>
          </View>
        )}

        {/* ===== E-POSTA KULLANICISI — ŞİFRE DEĞİŞTİR ===== */}
        {isEmailUser && (
          <View style={styles.passwordSection}>
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPasswordChange(!showPasswordChange)}
            >
              <View style={[styles.accountIcon, { backgroundColor: `${Colors.amber}18` }]}>
                <Ionicons name="key-outline" size={18} color={Colors.amber} />
              </View>
              <Text style={[styles.menuLabel, { flex: 1 }]}>Şifre Değiştir</Text>
              <Ionicons
                name={showPasswordChange ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.text3}
              />
            </Pressable>

            {showPasswordChange && (
              <View style={styles.passwordForm}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Mevcut Şifre</Text>
                  <TextInput
                    style={styles.textInput}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Mevcut şifreniz"
                    placeholderTextColor={Colors.text3}
                    secureTextEntry
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Yeni Şifre</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="En az 6 karakter"
                    placeholderTextColor={Colors.text3}
                    secureTextEntry
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Yeni Şifre Tekrar</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPasswordConfirm}
                    onChangeText={setNewPasswordConfirm}
                    placeholder="Yeni şifrenizi tekrar girin"
                    placeholderTextColor={Colors.text3}
                    secureTextEntry
                  />
                </View>

                <Pressable style={[styles.ctaWrap, changingPassword && { opacity: 0.6 }]} onPress={handleChangePassword} disabled={changingPassword}>
                  <LinearGradient colors={['#F59E0B', '#D97706', '#92400E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGradient}>
                    {changingPassword ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <View style={styles.ctaIconWrap}><Ionicons name="checkmark-circle" size={16} color="#FFF" /></View>
                        <Text style={styles.ctaTitle}>Şifreyi Güncelle</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ===== BİLGİ KARTI ===== */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={18} color={Colors.teal} />
          <Text style={styles.infoText}>
            Tier seviyeniz ve SP bakiyeniz profil düzenleme ile değiştirilemez.{' '}
            SP kazanmak için platformu aktif kullanın.
          </Text>
        </View>

        {/* ===== GİZLİLİK AYARLARI ===== */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionLabel}>GİZLİLİK</Text>
        </View>

        <View style={styles.accountInfoCard}>
          {/* Odalarımı Gizle */}
          <View style={[styles.accountRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
              <View style={[styles.accountIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                <Ionicons name="eye-off-outline" size={18} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountLabel}>Odalarımı Gizle</Text>
                <Text style={styles.fieldHint}>Profilinde odaların görünmez</Text>
              </View>
            </View>
            <Switch
              value={hideOwnedRooms}
              onValueChange={setHideOwnedRooms}
              trackColor={{ false: 'rgba(255,255,255,0.08)', true: 'rgba(168,85,247,0.4)' }}
              thumbColor={hideOwnedRooms ? '#A855F7' : '#64748B'}
            />
          </View>

          {/* Profil Gizliliği */}
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <View style={[styles.accountIcon, { backgroundColor: 'rgba(20,184,166,0.12)' }]}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountLabel}>Profil Gizliliği</Text>
                <Text style={styles.fieldHint}>Profilini kimler görebilir?</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['public', 'Herkes', 'globe-outline'], ['followers_only', 'Takipçiler', 'people-outline'], ['private', 'Gizli', 'lock-closed']] as const).map(([mode, label, icon]) => (
                <Pressable
                  key={mode}
                  style={[{
                    flex: 1, paddingVertical: 10, borderRadius: 10,
                    backgroundColor: privacyMode === mode ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1,
                    borderColor: privacyMode === mode ? 'rgba(20,184,166,0.4)' : 'rgba(255,255,255,0.08)',
                    alignItems: 'center', gap: 4,
                  }]}
                  onPress={() => setPrivacyMode(mode)}
                >
                  <Ionicons name={icon as any} size={16} color={privacyMode === mode ? Colors.teal : 'rgba(255,255,255,0.4)'} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: privacyMode === mode ? Colors.teal : 'rgba(255,255,255,0.5)' }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'transparent', zIndex: 10,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, ...Shadows.textLight },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: '#14B8A6', ...Shadows.icon },
  saveBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.1)', shadowOpacity: 0 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff', ...Shadows.textLight },
  saveBtnTextDisabled: { color: 'rgba(255,255,255,0.4)' },

  // CTA
  ctaWrap: {
    borderRadius: 12, overflow: 'hidden', marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12, gap: 8,
  },
  ctaIconWrap: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaTitle: {
    flex: 1, fontSize: 12, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // Avatar
  avatarSection: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  avatarWrap: { position: 'relative', marginBottom: 6 },
  avatarImage: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: Colors.teal },
  cameraBtn: {
    position: 'absolute', bottom: -2, right: -4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  changeAvatarText: { fontSize: 11, fontWeight: '600', color: Colors.teal },
  avatarPicker: { marginHorizontal: 16, marginTop: 6, padding: 10, backgroundColor: '#414e5f', borderRadius: 12, borderWidth: 1, borderColor: '#95a1ae' },
  pickerTitle: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8, ...Shadows.textLight },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.teal, paddingVertical: 8, borderRadius: Radius.full, marginBottom: 8 },
  uploadBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  avatarOption: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  avatarOptionSelected: { borderColor: Colors.teal },
  avatarOptionImg: { width: '100%', height: '100%', borderRadius: 24 },
  selectedCheck: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.bg3,
  },

  // Form
  form: {
    marginHorizontal: 16, padding: 10, paddingTop: 12,
    backgroundColor: '#414e5f', borderRadius: 12,
    borderWidth: 1, borderColor: '#95a1ae',
    ...Shadows.card, marginBottom: 4,
  },
  field: { marginBottom: 8 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: '#F1F5F9', marginBottom: 3, ...Shadows.textLight },
  textInput: {
    height: 34, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10, fontSize: 12, color: '#E2E8F0',
  },
  usernameWrap: { flexDirection: 'row', alignItems: 'center' },
  usernameAt: {
    height: 34, lineHeight: 34, paddingLeft: 10, paddingRight: 0,
    borderRadius: 8, borderTopRightRadius: 0, borderBottomRightRadius: 0,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRightWidth: 0, fontSize: 12, fontWeight: '700', color: '#14B8A6',
  },
  usernameInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: 4 },
  bioInput: { height: 44, paddingTop: 8, textAlignVertical: 'top' },
  charCount: { fontSize: 9, color: '#94A3B8', textAlign: 'right', marginTop: 2 },
  fieldHint: { fontSize: 9, color: '#94A3B8', marginTop: 1 },

  // Section divider
  sectionDivider: {
    paddingHorizontal: 20, marginTop: 4, marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 1, ...Shadows.textLight,
  },

  // Account info
  accountInfoCard: {
    marginHorizontal: 16, padding: 10,
    borderRadius: 12, backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: '#95a1ae', marginBottom: 4,
    ...Shadows.card,
  },
  accountRow: { flexDirection: 'row', alignItems: 'center' },
  accountIcon: {
    width: 20, height: 20, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  accountLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  accountValue: { fontSize: 11, fontWeight: '600', color: '#F1F5F9', marginTop: 0 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 10, fontWeight: '600', color: Colors.emerald },

  referralBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  referralCodeText: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.text, letterSpacing: 2, textAlign: 'center', paddingVertical: 8 },
  copyBtn: { padding: 8, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.05)' },

  // Upgrade section
  upgradeSection: { marginHorizontal: 20, marginBottom: 16 },
  upgradeBanner: { borderRadius: Radius.default, padding: 20, borderWidth: 1, borderColor: Colors.teal + '25' },
  upgradeBannerHeader: { flexDirection: 'row', marginBottom: 20 },
  upgradeTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  upgradeDesc: { fontSize: 12, lineHeight: 18, color: Colors.text2 },

  // Link buttons
  linkBtn: { marginBottom: 10 },
  linkBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: Radius.default },
  linkBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  emailToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: Radius.default, backgroundColor: Colors.bg4, borderWidth: 1, borderColor: Colors.glassBorder },
  emailToggleBtnText: { fontSize: 14, fontWeight: '600', color: Colors.teal },

  // Email form
  emailForm: { marginTop: 16 },
  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.default, backgroundColor: Colors.teal, marginTop: 4 },
  registerBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Password section
  passwordSection: { marginHorizontal: 16, marginBottom: 6 },
  passwordToggle: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderRadius: 12, backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: '#95a1ae', ...Shadows.card,
  },
  passwordForm: {
    marginTop: 4, padding: 10, borderRadius: 12,
    backgroundColor: '#414e5f', borderWidth: 1, borderColor: '#95a1ae', ...Shadows.card,
  },
  menuLabel: { fontSize: 12, fontWeight: '600', color: '#F1F5F9', ...Shadows.textLight },

  // Info
  infoCard: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginTop: 2, marginBottom: 6, padding: 10,
    borderRadius: 10, backgroundColor: 'rgba(20,184,166,0.15)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
  },
  infoText: { flex: 1, fontSize: 10, lineHeight: 14, color: '#E2E8F0', ...Shadows.textLight },
});
