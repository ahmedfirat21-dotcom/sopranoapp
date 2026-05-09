import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, TextInput,
  ScrollView, Alert, Switch,
  Platform, Keyboard, Dimensions, Share, KeyboardAvoidingView,
} from 'react-native';
import AppLoader from '../components/AppLoader';

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
// ★ 2026-04-28: ReferralService + ExpoClipboard kaldırıldı — davet kodu profile.tsx'te
import * as ImagePicker from 'expo-image-picker';
import { StorageService } from '../services/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LanguageInterestPicker from '../components/profile/LanguageInterestPicker';
import { getLanguage, getInterest, INTEREST_CATEGORY_COLOR } from '../constants/profileTags';
import VoiceBioRecorder from '../components/profile/VoiceBioRecorder';
import FeaturedBadgesPicker from '../components/profile/FeaturedBadgesPicker';
import SocialLinksEditor, { type SocialLinks } from '../components/profile/SocialLinksEditor';
import { BADGES } from '../constants/badges';
import { FeaturedBadgesService } from '../services/profileExtras';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ★ 2026-04-29: Header ikonlarına derinlik veren ortak shadow (Keşfet/Odalarım pattern).
const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 5,
} as const;

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, firebaseUser, setProfile, setUser, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // === Profile fields ===
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || AVATAR_OPTIONS[0]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // ★ Username uniqueness check — debounced, inline feedback
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'current'>('idle');
  useEffect(() => {
    const u = username.trim();
    const originalUsername = profile?.username || '';
    // Kendi mevcut kullanıcı adı — check yok
    if (u === originalUsername) { setUsernameStatus('current'); return; }
    if (u.length === 0) { setUsernameStatus('idle'); return; }
    if (u.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const available = await ProfileService.isUsernameAvailable(u);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 450);
    return () => clearTimeout(t);
  }, [username, profile?.username]);

  // === Privacy toggles ===
  const [hideOwnedRooms, setHideOwnedRooms] = useState((profile as any)?.hide_owned_rooms || false);
  // ★ 2026-04-26: "Gizli" kaldırıldı — Instagram private account "followers_only" ile zaten karşılanıyor.
  //   Eski DB'de 'private' kayıtlıysa otomatik 'followers_only' say.
  const [privacyMode, setPrivacyMode] = useState<'public' | 'followers_only'>(
    (profile as any)?.privacy_mode === 'private' ? 'followers_only' : ((profile as any)?.privacy_mode || 'public')
  );

  // === v110.5: Diller + İlgi Alanları ===
  const [languages, setLanguages] = useState<string[]>(
    Array.isArray((profile as any)?.languages) ? (profile as any).languages : []
  );
  const [interests, setInterests] = useState<string[]>(
    Array.isArray((profile as any)?.interests) ? (profile as any).interests : []
  );
  const [showLangIntPicker, setShowLangIntPicker] = useState(false);

  // === v110.5: Voice Bio + Featured Badges + Social Links ===
  const [voiceBioUrl, setVoiceBioUrl] = useState<string | null>((profile as any)?.voice_bio_url || null);
  const [voiceBioDurationMs, setVoiceBioDurationMs] = useState<number | null>((profile as any)?.voice_bio_duration_ms || null);
  const [showVoiceBioRecorder, setShowVoiceBioRecorder] = useState(false);

  const [featuredBadgeIds, setFeaturedBadgeIds] = useState<string[]>([]);
  const [showFeaturedBadgesPicker, setShowFeaturedBadgesPicker] = useState(false);

  // ★ v110.5: Sosyal linkler — local state, save'de profiles.social_links jsonb'a yazılır
  const [socialLinks, setSocialLinks] = useState<SocialLinks>((profile as any)?.social_links || {});
  const [showSocialLinksEditor, setShowSocialLinksEditor] = useState(false);

  // Featured badges'i mount'ta yükle
  useEffect(() => {
    if (!userId) return;
    FeaturedBadgesService.getFeatured(userId).then((ids) => setFeaturedBadgeIds(ids)).catch(() => {});
  }, [userId]);

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

  // ★ 2026-04-28: Referral state'leri kaldırıldı — davet kodu profile.tsx'te
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

  // ★ 2026-04-28: Referral fetch effect kaldırıldı — davet kodu profile.tsx'te

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
        const uploadUrl = await StorageService.uploadAvatar(firebaseUser.uid, result.assets[0].uri, avatarUrl);
        setAvatarUrl(uploadUrl);
        showToast({ title: '📸 Fotoğraf Yüklendi', message: 'Profil fotoğrafın güncellendi.', type: 'success' });
      }
    } catch (err: any) {
      showToast({ title: 'Fotoğraf Yüklenemedi', message: err.message || 'Görsel yüklenirken sorun oluştu.', type: 'error' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ★ SEC-EDIT: Unicode sanitizasyon — onboarding ile tutarlı
  const sanitizeText = (text: string): string =>
    text.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD\u034F\u061C\u180E]/g, '').trim();

  // === SAVE PROFILE ===
  // ★ ORTA-B: Çift tıklama koruması — setSaving async, yetişmediği pencerede
  // ikinci çağrı aynı anda gidiyordu. Ref sync, hemen bloke.
  const savingLockRef = useRef(false);
  const handleSave = async () => {
    if (savingLockRef.current) return;
    const cleanName = sanitizeText(displayName);
    if (!cleanName) {
      showToast({ type: 'warning', title: 'Uyarı', message: 'Görünen ad boş olamaz.' });
      return;
    }
    if (!userId) {
      showToast({ type: 'error', title: 'Oturum Kapalı', message: 'Giriş bilgin bulunamadı, yeniden giriş yap.' });
      return;
    }
    // ★ Username taken — kaydetmeye izin verme
    if (usernameStatus === 'taken') {
      showToast({ type: 'warning', title: 'Kullanıcı adı alınmış', message: 'Başka bir kullanıcı adı dene.' });
      return;
    }
    if (usernameStatus === 'checking') {
      showToast({ type: 'info', title: 'Kontrol ediliyor', message: 'Kullanıcı adı müsaitliği kontrol ediliyor...' });
      return;
    }

    savingLockRef.current = true;
    Keyboard.dismiss();
    setSaving(true);
    try {
      // ★ B1 FIX: privacy_mode'dan is_private türet — tek kaynak
      const derivedIsPrivate = privacyMode !== 'public';
      // ★ SEC-EDIT: Sanitize name + bio (Unicode junk removal)
      const cleanBio = sanitizeText(bio);

      await ProfileService.update(userId, {
        display_name: cleanName,
        username: username.trim() || null,
        bio: cleanBio,
        avatar_url: avatarUrl,
        hide_owned_rooms: hideOwnedRooms,
        privacy_mode: privacyMode,
        is_private: derivedIsPrivate,
        // ★ v110.5: Diller + İlgi alanları + Sosyal linkler
        languages,
        interests,
        social_links: socialLinks,
      } as any);

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
        display_name: cleanName,
        username: username.trim() || null,
        bio: cleanBio,
        avatar_url: avatarUrl,
        hide_owned_rooms: hideOwnedRooms,
        privacy_mode: privacyMode,
        is_private: derivedIsPrivate,
        // ★ v110.5
        languages,
        interests,
      } as any;
      setProfile(updatedProfile);
      setUser({ name: updatedProfile.display_name, avatar: updatedProfile.avatar_url });

      // ★ U3 FIX: Profil tab'ı dönüşte güncel veriyi görsün
      refreshProfile().catch(() => {});

      showToast({ title: 'Başarılı ✓', message: 'Profil güncellendi!', type: 'success' });
      safeGoBack(router);
    } catch (error: any) {
      if (error?.message?.includes('duplicate') || error?.code === '23505') {
        showToast({ type: 'warning', title: 'Kullanıcı Adı Alınmış', message: 'Bu kullanıcı adı başkası tarafından kullanılıyor.' });
      } else {
        showToast({ type: 'error', title: 'Profil Güncellenmedi', message: 'Değişiklikler kaydedilemedi. Tekrar dene.' });
      }
    } finally {
      setSaving(false);
      savingLockRef.current = false;
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
        showToast({ type: 'error', title: 'Google Bağlanamadı', message: 'Google hesabı eklenemedi, tekrar dene.' });
      }
    } finally {
      setLinking(false);
    }
  };

  // === LINK EMAIL/PASSWORD ===
  const handleLinkEmail = async () => {
    if (!firebaseUser) return;

    if (!regEmail.trim()) {
      showToast({ type: 'warning', title: 'E-posta Gerekli', message: 'Lütfen e-posta adresini gir.' });
      return;
    }
    if (regPassword.length < 6) {
      showToast({ type: 'warning', title: 'Şifre Çok Kısa', message: 'Şifre en az 6 karakter olmalı.' });
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      showToast({ type: 'warning', title: 'Şifreler Eşleşmiyor', message: 'İki şifre alanı aynı olmalı.' });
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
        showToast({ type: 'warning', title: 'E-posta Kullanımda', message: 'Bu e-posta başka bir hesaba bağlı.' });
      } else if (error?.code === 'auth/invalid-email') {
        showToast({ type: 'warning', title: 'Geçersiz E-posta', message: 'Geçerli bir e-posta adresi gir.' });
      } else if (error?.code === 'auth/provider-already-linked') {
        showToast({ type: 'info', title: 'Bilgi', message: 'E-posta hesabı zaten bağlı.' });
      } else {
        showToast({ type: 'error', title: 'E-posta Eklenemedi', message: 'E-posta hesabın güncellenemedi, tekrar dene.' });
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
        showToast({ type: 'error', title: 'Şifre Yanlış', message: 'Mevcut şifren doğru değil.' });
      } else if (error?.code === 'auth/requires-recent-login') {
        showToast({ type: 'warning', title: 'Yeniden Giriş Gerekli', message: 'Güvenlik için çıkış yapıp tekrar gir.' });
      } else {
        showToast({ type: 'error', title: 'Şifre Değiştirilemedi', message: 'İşlem tamamlanamadı, tekrar dene.' });
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
    privacyMode !== ((profile as any)?.privacy_mode || 'public') ||
    JSON.stringify(languages) !== JSON.stringify((profile as any)?.languages || []) ||
    JSON.stringify(interests) !== JSON.stringify((profile as any)?.interests || []) ||
    JSON.stringify(socialLinks) !== JSON.stringify((profile as any)?.social_links || {});

  // Auth type label
  const getAuthTypeInfo = () => {
    if (isGoogleUser) return { label: 'Google Hesabı', icon: 'logo-google' as const, color: Colors.sapphire };
    if (isEmailUser) return { label: 'E-posta Hesabı', icon: 'mail-outline' as const, color: Colors.teal };
    return { label: 'Hesap', icon: 'person-outline' as const, color: Colors.text3 };
  };
  const authInfo = getAuthTypeInfo();

  return (
    <AppBackground variant="profile" radialGlow>
    <View style={styles.container}>
      {/* ★ 2026-04-29: Glassmorphic header — Keşfet/Odalarım/Profil pattern */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        {/* ★ 2026-05-05: NotificationDrawer aile dili — slate diagonal + amber halo */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.7 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.headerContent}>
          <Pressable onPress={() => safeGoBack(router)} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="close" size={22} color="#F1F5F9" style={iconShadow} />
          </Pressable>
          <Text style={styles.headerTitle}>Profili Düzenle</Text>
          <Pressable
            onPress={handleSave}
            disabled={saving || !hasChanges}
            style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
          >
            {saving ? (
              <AppLoader size="small" color="#fff" />
            ) : (
              <Text style={[styles.saveBtnText, !hasChanges && styles.saveBtnTextDisabled]}>Kaydet</Text>
            )}
          </Pressable>
        </View>
        {/* Alt amber separator — profil tab accent ile uyumlu */}
        <LinearGradient
          colors={['transparent', 'rgba(245,158,11,0.55)', 'rgba(245,158,11,0.55)', 'transparent']}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.headerSeparator}
        />
      </View>

      {/* ★ v110.5.3: Klavye yönetimi — TextInput odaklanınca scroll otomatik */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
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
                  <AppLoader color="#fff" size="small" />
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
              {/* ★ Inline availability feedback — debounced */}
              {usernameStatus === 'checking' && (
                <AppLoader size="small" color="#94A3B8" style={{ marginLeft: 8 }} />
              )}
              {usernameStatus === 'available' && (
                <Ionicons name="checkmark-circle" size={18} color="#22C55E" style={{ marginLeft: 8 }} />
              )}
              {usernameStatus === 'taken' && (
                <Ionicons name="close-circle" size={18} color="#EF4444" style={{ marginLeft: 8 }} />
              )}
            </View>
            {usernameStatus === 'taken' ? (
              <Text style={[styles.fieldHint, { color: '#EF4444' }]}>Bu kullanıcı adı zaten alınmış.</Text>
            ) : usernameStatus === 'available' ? (
              <Text style={[styles.fieldHint, { color: '#22C55E' }]}>Müsait ✓</Text>
            ) : (
              <Text style={styles.fieldHint}>Sadece küçük harfler, rakamlar ve alt çizgi</Text>
            )}
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

        {/* ★ 2026-04-28: DAVET KAZANÇLARI bölümü KALDIRILDI — Davet kodu profil sayfasında zaten var.
             Edit-profile = veri düzenleme; davet = paylaşım/sosyal — profile'da kalsın. */}

        {/* ===== HESAP BİLGİLERİ ===== */}
        <View style={styles.sectionDivider}>
          <View style={styles.sectionAccent} />
          <Ionicons name="person-circle-outline" size={13} color={Colors.teal} />
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
                      <AppLoader size="small" color="#fff" />
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

        {/* ===== KİMLİĞİN — v110.5: Diller + İlgi Alanları ===== */}
        <View style={styles.sectionDivider}>
          <View style={styles.sectionAccent} />
          <Ionicons name="sparkles-outline" size={13} color="#FBBF24" />
          <Text style={styles.sectionLabel}>KİMLİĞİN</Text>
        </View>

        <Pressable
          onPress={() => setShowLangIntPicker(true)}
          style={({ pressed }) => [
            styles.accountInfoCard,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.accountRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
              <View style={[styles.accountIcon, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
                <Ionicons name="language" size={18} color="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountLabel}>Diller & İlgi Alanları</Text>
                <Text style={styles.fieldHint}>
                  {languages.length === 0 && interests.length === 0
                    ? 'Konuştuğun dilleri ve ilgi alanlarını ekle'
                    : `${languages.length} dil · ${interests.length} ilgi alanı`}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>

          {/* Mini önizleme — seçilenleri chip olarak göster */}
          {(languages.length > 0 || interests.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
              {languages.slice(0, 3).map(code => {
                const l = getLanguage(code);
                if (!l) return null;
                return (
                  <View key={code} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 3.5,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                  }}>
                    <Text style={{ fontSize: 11 }}>{l.flag}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#E2E8F0' }}>{l.label}</Text>
                  </View>
                );
              })}
              {languages.length > 3 && (
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3.5,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>+{languages.length - 3}</Text>
                </View>
              )}
              {interests.slice(0, 3).map(id => {
                const t = getInterest(id);
                if (!t) return null;
                const color = INTEREST_CATEGORY_COLOR[t.category];
                return (
                  <View key={id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 3.5,
                    borderRadius: 999,
                    borderWidth: 1, borderColor: color + '55',
                    backgroundColor: color + '14',
                  }}>
                    <Ionicons name={t.icon as any} size={10} color={color} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color }}>{t.label}</Text>
                  </View>
                );
              })}
              {interests.length > 3 && (
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3.5,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>+{interests.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </Pressable>

        {/* ===== v110.5: PROFİL ANLATIMI — Voice Bio + Featured Badges + Social Links ===== */}
        <View style={styles.sectionDivider}>
          <View style={styles.sectionAccent} />
          <Ionicons name="megaphone-outline" size={13} color="#A855F7" />
          <Text style={styles.sectionLabel}>PROFİL ANLATIMI</Text>
        </View>

        {/* Voice Bio satırı */}
        <Pressable
          onPress={() => setShowVoiceBioRecorder(true)}
          style={({ pressed }) => [styles.accountInfoCard, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.accountRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
              <View style={[styles.accountIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Ionicons name="mic" size={18} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountLabel}>Sesli Tanıtım</Text>
                <Text style={styles.fieldHint}>
                  {voiceBioUrl
                    ? `${Math.ceil((voiceBioDurationMs || 0) / 1000)}sn kayıt mevcut · değiştirmek için bas`
                    : '15-30sn kendini tanıt — yabancı kullanıcılar dinlesin'}
                </Text>
              </View>
            </View>
            {voiceBioUrl && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 8 }} />
            )}
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </Pressable>

        {/* Featured Badges satırı */}
        <Pressable
          onPress={() => setShowFeaturedBadgesPicker(true)}
          style={({ pressed }) => [styles.accountInfoCard, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.accountRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
              <View style={[styles.accountIcon, { backgroundColor: 'rgba(251,191,36,0.12)' }]}>
                <Ionicons name="ribbon" size={18} color="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountLabel}>Öne Çıkan Rozetler</Text>
                <Text style={styles.fieldHint}>
                  {featuredBadgeIds.length > 0
                    ? `${featuredBadgeIds.length} rozet seçili — profilde büyük gösterilir`
                    : 'En değer verdiğin 3 rozeti öne çıkar'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
          {featuredBadgeIds.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              {featuredBadgeIds.map(id => {
                const b = BADGES[id];
                if (!b) return null;
                return (
                  <View key={id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: b.color + '22',
                    borderWidth: 1, borderColor: b.color + '55',
                  }}>
                    <Ionicons name={b.icon as any} size={11} color={b.color} />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: b.color }}>{b.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Pressable>

        {/* Social Links satırı */}
        <Pressable
          onPress={() => setShowSocialLinksEditor(true)}
          style={({ pressed }) => [styles.accountInfoCard, pressed && { opacity: 0.85 }]}
        >
          <View style={[styles.accountRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
              <View style={[styles.accountIcon, { backgroundColor: 'rgba(20,184,166,0.12)' }]}>
                <Ionicons name="link" size={18} color="#14B8A6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountLabel}>Sosyal Linkler</Text>
                <Text style={styles.fieldHint}>
                  {(() => {
                    const count = [socialLinks.instagram, socialLinks.twitter, socialLinks.website].filter(Boolean).length;
                    return count > 0 ? `${count} link bağlı` : 'Instagram · X · Web sitesi';
                  })()}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </Pressable>

        {/* ===== GİZLİLİK AYARLARI ===== */}
        <View style={styles.sectionDivider}>
          <View style={styles.sectionAccent} />
          <Ionicons name="shield-checkmark-outline" size={13} color={Colors.teal} />
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
                <Text style={styles.fieldHint}>Yabancılar odalarını göremez (arkadaşların görür)</Text>
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
                <Text style={styles.fieldHint}>{privacyMode === 'public' ? 'Profilini herkes görebilir' : 'Profilini sadece arkadaşların görebilir'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([['public', 'Herkes', 'globe-outline'], ['followers_only', 'Arkadaşlar', 'people-outline']] as const).map(([mode, label, icon]) => (
                <Pressable
                  key={mode}
                  style={[{
                    flex: 1, paddingVertical: 12, borderRadius: 10,
                    backgroundColor: privacyMode === mode ? 'rgba(20,184,166,0.15)' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1,
                    borderColor: privacyMode === mode ? 'rgba(20,184,166,0.4)' : 'rgba(255,255,255,0.08)',
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }]}
                  onPress={() => setPrivacyMode(mode)}
                >
                  <Ionicons name={icon as any} size={16} color={privacyMode === mode ? Colors.teal : 'rgba(255,255,255,0.4)'} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: privacyMode === mode ? Colors.teal : 'rgba(255,255,255,0.5)' }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ★ v110.5: Diller + İlgi Alanları seçici sheet — absolute mount */}
      <LanguageInterestPicker
        visible={showLangIntPicker}
        initialLanguages={languages}
        initialInterests={interests}
        onSave={(newLangs, newInts) => {
          setLanguages(newLangs);
          setInterests(newInts);
        }}
        onClose={() => setShowLangIntPicker(false)}
      />

      {/* ★ v110.5: Sesli tanıtım kayıt modal */}
      {userId && (
        <VoiceBioRecorder
          visible={showVoiceBioRecorder}
          userId={userId}
          currentUrl={voiceBioUrl}
          currentDurationMs={voiceBioDurationMs}
          onClose={() => setShowVoiceBioRecorder(false)}
          onSaved={(url, ms) => {
            setVoiceBioUrl(url);
            setVoiceBioDurationMs(ms);
          }}
          onRemoved={() => {
            setVoiceBioUrl(null);
            setVoiceBioDurationMs(null);
          }}
        />
      )}

      {/* ★ v110.5: Öne çıkan rozet seçici */}
      {userId && (
        <FeaturedBadgesPicker
          visible={showFeaturedBadgesPicker}
          userId={userId}
          onSaved={(ids) => setFeaturedBadgeIds(ids)}
          onClose={() => setShowFeaturedBadgesPicker(false)}
        />
      )}

      {/* ★ v110.5: Sosyal linkler editör */}
      <SocialLinksEditor
        visible={showSocialLinksEditor}
        initial={socialLinks}
        onSave={(links) => setSocialLinks(links)}
        onClose={() => setShowSocialLinksEditor(false)}
      />
    </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // ★ 2026-04-29: Glassmorphic header — Keşfet/Odalarım pattern.
  headerBar: {
    position: 'relative',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 8,
  },
  headerSeparator: {
    height: 1.5,
    width: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    fontSize: 15, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: 0.3, ...Shadows.textLight,
  },
  saveBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: '#F59E0B',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.55)',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)', shadowOpacity: 0 },
  saveBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF', letterSpacing: 0.4, ...Shadows.textLight },
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

  // ★ 2026-04-29: Avatar — premium amber ring (profil tab accent ile uyumlu)
  avatarSection: { alignItems: 'center', paddingTop: 14, paddingBottom: 6 },
  avatarWrap: {
    position: 'relative', marginBottom: 8,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2.5, borderColor: 'rgba(245,158,11,0.65)',
  },
  cameraBtn: {
    position: 'absolute', bottom: -2, right: -4,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0E1A2E',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  changeAvatarText: { fontSize: 12, fontWeight: '700', color: '#F59E0B', letterSpacing: 0.3 },
  avatarPicker: {
    marginHorizontal: 16, marginTop: 8, padding: 12,
    backgroundColor: '#1a2030', borderRadius: 22,
  },
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

  // ★ 2026-04-29: Form kartı — glassmorphic dark navy (Keşfet/Odalarım kart pattern)
  form: {
    marginHorizontal: 16, padding: 14, paddingTop: 14,
    backgroundColor: '#1a2030', borderRadius: 22,
    ...Shadows.card, marginBottom: 8,
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

  // ★ 2026-04-28: Section header — profile.tsx premium pattern ile birleştirildi.
  //   Eskiden flat sectionDivider + sectionLabel idi; tutarsızdı.
  //   Yeni: 3px teal accent bar + Ionicons + uppercase metin (profile/clubs/settings ile aynı).
  sectionDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 8,
  },
  sectionAccent: {
    width: 3, height: 14, borderRadius: 2,
    backgroundColor: Colors.teal,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: 1, ...Shadows.textLight,
  },

  // ★ 2026-04-29: Account info kartı — glassmorphic dark navy
  accountInfoCard: {
    marginHorizontal: 16, padding: 14,
    borderRadius: 22, backgroundColor: '#1a2030', marginBottom: 8,
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

  // ★ 2026-04-29: Password section — glassmorphic dark navy
  passwordSection: { marginHorizontal: 16, marginBottom: 8 },
  passwordToggle: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10,
    borderRadius: 22, backgroundColor: '#1a2030', ...Shadows.card,
  },
  passwordForm: {
    marginTop: 6, padding: 14, borderRadius: 22,
    backgroundColor: '#1a2030',
    ...Shadows.card,
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
