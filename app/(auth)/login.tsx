import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, TextInput, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Animated, Easing, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PremiumAlert from '../../components/PremiumAlert';
import AppLoader from '../../components/AppLoader';
import type { AlertButton } from '../../components/PremiumAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows, Gradients, Radius } from '../../constants/theme';
import { supabase } from '../../constants/supabase';

let GoogleSignin: any;
try {
  const gsignin = require('@react-native-google-signin/google-signin');
  GoogleSignin = gsignin.GoogleSignin;
} catch (e) {
  GoogleSignin = {
    configure: () => {},
    hasPlayServices: async () => true,
    signIn: async () => { throw new Error('Google Girişi Expo Go sürümünde çalışmaz. Lütfen apk/dev derlemesi kullanın.'); }
  };
}

import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';

import { showToast } from '../../components/Toast';
import AppBackground from '../../components/AppBackground';
import { auth, GOOGLE_WEB_CLIENT_ID } from '../../constants/firebase';
import { useAuth } from '../_layout';

const { height: SCREEN_HEIGHT, width: SCREEN_W } = Dimensions.get('window');

// ★ SEC-BF2: E-posta format doğrulama
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ★ SEC-PW: Şifre gücü kontrolü
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-ZÇĞİÖŞÜ]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  if (score <= 1) return { score, label: 'Zayıf', color: '#EF4444' };
  if (score <= 2) return { score, label: 'Orta', color: '#F59E0B' };
  if (score <= 3) return { score, label: 'İyi', color: '#3B82F6' };
  return { score, label: 'Güçlü', color: '#10B981' };
}

// ★ SEC-BF2: AsyncStorage tabanlı kalıcı cooldown anahtarları
const BF_ATTEMPTS_KEY = '@soprano_bf_attempts';
const BF_COOLDOWN_KEY = '@soprano_bf_cooldown';

export default function LoginScreen() {
  const { firebaseUser, refreshAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // ★ SEC-BF2: Brute force koruması — kalıcı (AsyncStorage tabanlı)
  const failedAttemptsRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  // Email state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Live stats
  const [onlineCount, setOnlineCount] = useState(0);
  const [liveRoomCount, setLiveRoomCount] = useState(0);

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animations
  // ★ İki parçalı logo animasyonu: Soprano soldan ← Chat sağdan → ortada buluşur
  const sopranoOpacity = useRef(new Animated.Value(0)).current;
  const sopranoTranslateX = useRef(new Animated.Value(-120)).current;  // Çok soldan gelir
  const chatOpacity = useRef(new Animated.Value(0)).current;
  const chatTranslateX = useRef(new Animated.Value(120)).current;     // Çok sağdan gelir
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

    // ★ SEC-BF2: Kalıcı cooldown/attempt değerlerini AsyncStorage'dan yükle
    (async () => {
      try {
        const [storedAttempts, storedCooldown] = await Promise.all([
          AsyncStorage.getItem(BF_ATTEMPTS_KEY),
          AsyncStorage.getItem(BF_COOLDOWN_KEY),
        ]);
        if (storedAttempts) failedAttemptsRef.current = parseInt(storedAttempts, 10) || 0;
        if (storedCooldown) cooldownUntilRef.current = parseInt(storedCooldown, 10) || 0;
      } catch {}
    })();

    (async () => {
      try {
        const [{ count: online }, { count: rooms }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_online', true),
          supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('is_live', true),
        ]);
        setOnlineCount(online || 0);
        setLiveRoomCount(rooms || 0);
      } catch (e) {
        if (__DEV__) console.warn('Stat fetch error:', e);
      }
    })();

    // ★ Staggered entrance: Soprano ← … → Chat (coming together efekti)
    // Adım 1: "Soprano" soldan süzülerek gelir (300ms bekleme sonrası)
    const sopranoTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(sopranoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(sopranoTranslateX, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]).start();
    }, 300);

    // Adım 2: "Chat" sağdan bounce ederek gelir (900ms bekleme — Soprano yarıda iken)
    const chatTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(chatOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(chatTranslateX, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 900);

    // Adım 3: Stats (1600ms — logo yerleştikten sonra)
    const statsTimer = setTimeout(() => {
      Animated.timing(statsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 1600);

    // Adım 4: Buttons (2000ms — her şey hazır)
    const buttonsTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonsTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }, 1000);

    // ★ Cleanup — unmount'ta timer'ları iptal et
    return () => {
      clearTimeout(sopranoTimer);
      clearTimeout(chatTimer);
      clearTimeout(statsTimer);
      clearTimeout(buttonsTimer);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      // ★ Hesap seçici her zaman görünsün — önceden signOut + revokeAccess yap.
      // Aksi halde son giriş yapılan Google hesabı otomatik seçilir, kullanıcı başka
      // hesap seçme şansı bulamaz.
      try { await GoogleSignin.signOut(); } catch {}
      try { await GoogleSignin.revokeAccess(); } catch {}
      const userInfo = await GoogleSignin.signIn() as any;
      const idToken = userInfo?.data?.idToken || userInfo?.idToken;
      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
      } else {
        throw new Error('No ID token present!');
      }
    } catch (error: any) {
      if (__DEV__) console.warn('Google login hatasi:', error);
      showToast({ title: 'Dikkat', message: error?.message || 'Google ile giriş iptal edildi.', type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showToast({ title: 'Eksik Bilgi', message: 'E-posta ve şifre alanlarını doldurun.', type: 'warning' });
      return;
    }
    // ★ SEC-BF2: Email format kontrolü
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      showToast({ title: 'Geçersiz E-posta', message: 'Geçerli bir e-posta adresi gir.', type: 'error' });
      return;
    }
    // ★ SEC-BF2: Kalıcı cooldown kontrolü — 5 başarısız denemeden sonra 60sn bekleme
    if (Date.now() < cooldownUntilRef.current) {
      const remainSec = Math.ceil((cooldownUntilRef.current - Date.now()) / 1000);
      showToast({ title: 'Çok Fazla Deneme', message: `${remainSec} saniye bekleyip tekrar dene.`, type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      // Başarılı — sayacı sıfırla ve kalıcı depolamadan temizle
      failedAttemptsRef.current = 0;
      cooldownUntilRef.current = 0;
      AsyncStorage.multiRemove([BF_ATTEMPTS_KEY, BF_COOLDOWN_KEY]).catch(() => {});
    } catch (error: any) {
      failedAttemptsRef.current++;
      // ★ SEC-BF2: Kalıcı cooldown — uygulama yeniden başlatılsa bile korunur
      if (failedAttemptsRef.current >= 5) {
        const cooldownMs = Math.min(30_000 * Math.pow(2, Math.floor(failedAttemptsRef.current / 5) - 1), 300_000); // Kademeli: 30s→60s→120s→max 5dk
        cooldownUntilRef.current = Date.now() + cooldownMs;
        const cooldownSec = Math.ceil(cooldownMs / 1000);
        showToast({ title: 'Hesap Geçici Kilitli', message: `${cooldownSec} saniye bekleyip tekrar dene.`, type: 'warning' });
      } else if (error?.code === 'auth/too-many-requests') {
        cooldownUntilRef.current = Date.now() + 60_000;
        showToast({ title: 'Hesap Geçici Kilitli', message: '1 dakika sonra tekrar dene.', type: 'warning' });
      } else {
        // ★ SEC-ENUM: Tüm kimlik doğrulama hatalarında aynı mesaj — e-posta enumeration engeli
        showToast({ title: 'Giriş Başarısız', message: 'E-posta veya şifre hatalı.', type: 'error' });
      }
      // ★ SEC-BF2: Kalıcı kayıt
      AsyncStorage.setItem(BF_ATTEMPTS_KEY, String(failedAttemptsRef.current)).catch(() => {});
      if (cooldownUntilRef.current > 0) {
        AsyncStorage.setItem(BF_COOLDOWN_KEY, String(cooldownUntilRef.current)).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !passwordConfirm) {
      showToast({ title: 'Eksik Bilgi', message: 'Tüm alanları doldurun.', type: 'warning' });
      return;
    }
    // ★ SEC-BF2: Email format kontrolü
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      showToast({ title: 'Geçersiz E-posta', message: 'Geçerli bir e-posta adresi gir.', type: 'error' });
      return;
    }
    if (password !== passwordConfirm) {
      showToast({ title: 'Şifreler Eşleşmiyor', message: 'İki şifre alanı aynı olmalı.', type: 'error' });
      return;
    }
    // ★ SEC-PW: Güçlü şifre gereksinimleri — min 8 karakter, 1 büyük harf, 1 rakam
    if (password.length < 8) {
      showToast({ title: 'Şifre Çok Kısa', message: 'En az 8 karakter olmalı.', type: 'warning' });
      return;
    }
    if (!/[A-ZÇĞİÖŞÜ]/.test(password)) {
      showToast({ title: 'Büyük Harf Eksik', message: 'Şifrede en az 1 büyük harf olmalı.', type: 'warning' });
      return;
    }
    if (!/[0-9]/.test(password)) {
      showToast({ title: 'Rakam Eksik', message: 'Şifrede en az 1 rakam olmalı.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      // ★ E-posta doğrulama gönder — kayıt sonrası otomatik
      if (userCredential.user) {
        try {
          await sendEmailVerification(userCredential.user, {
            url: 'https://sopranochat.com/verified',
            handleCodeInApp: false,
          });
          showToast({ title: '✉️ Doğrulama E-postası Gönderildi', message: 'Lütfen e-posta kutunuzu kontrol edip doğrulayın.', type: 'success' });
        } catch { /* doğrulama gönderilemezse sessiz */ }
      }
    } catch (error: any) {
      // ★ SEC-ENUM: Kayıt hatalarında spesifik bilgi verme — enumeration engeli
      if (error?.code === 'auth/email-already-in-use') {
        showToast({ title: 'Kayıt Olunamadı', message: 'Bu e-posta ile işlem yapılamadı. Giriş yapmayı dene.', type: 'error' });
      } else if (error?.code === 'auth/invalid-email') {
        showToast({ title: 'Geçersiz E-posta', message: 'Lütfen geçerli bir e-posta gir.', type: 'error' });
      } else {
        showToast({ title: 'Kayıt Olunamadı', message: 'Bir sorun oluştu, tekrar dene.', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (resetLoading) return; // ★ SEC-FP: Çift tıklama koruması
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      showToast({ title: 'Eksik Bilgi', message: 'Lütfen e-posta adresinizi yazın.', type: 'warning' });
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      showToast({ title: 'Geçersiz E-posta', message: 'Geçerli bir e-posta adresi gir.', type: 'error' });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
    } catch (error: any) {
      // ★ SEC-ENUM: Hata olsa bile aynı mesajı göster — e-posta enumeration engeli
      if (__DEV__) console.warn('[ForgotPassword] Error:', error?.code);
    } finally {
      // ★ SEC-ENUM: Her durumda aynı başarı mesajını göster
      showToast({ title: 'İşlem Tamamlandı', message: 'Hesap varsa sıfırlama bağlantısı e-postanıza gönderildi.', type: 'success' });
      setShowForgotPassword(false);
      setResetEmail('');
      setResetLoading(false);
    }
  };

  // ★ SEC-EV: Doğrulama e-postasını yeniden gönder
  const handleResendVerification = async () => {
    if (resendLoading || !firebaseUser) return;
    setResendLoading(true);
    try {
      await sendEmailVerification(firebaseUser, {
        url: 'https://sopranochat.com/verified',
        handleCodeInApp: false,
      });
      showToast({ title: '✉️ Gönderildi', message: 'Doğrulama e-postası tekrar gönderildi.', type: 'success' });
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests') {
        showToast({ title: 'Çok Fazla İstek', message: 'Birkaç dakika bekleyip tekrar dene.', type: 'warning' });
      } else {
        showToast({ title: 'E-posta Gönderilemedi', message: 'Doğrulama e-postası iletilemedi.', type: 'error' });
      }
    } finally {
      setResendLoading(false);
    }
  };

  // ★ SEC-EV: Doğrulamadan sonra Firebase token'ı yenile
  // ★ BUG-EV 2026-04-21: reload() Firebase User objesini in-place mutate eder ama React
  // re-render tetiklenmez (aynı referans). AuthGuard effect'i yeniden çalışmaz → kullanıcı
  // "✅ Doğrulandı" toast'unu görür ama home'a yönlendirilmez. refreshAuth() counter bump'layarak
  // AuthGuard'ı zorla tetikliyor.
  const handleCheckVerification = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      await firebaseUser.reload();
      if (firebaseUser.emailVerified) {
        showToast({ title: '✅ Doğrulandı', message: 'E-postanız doğrulandı! Giriş yapılıyor...', type: 'success' });
        refreshAuth(); // AuthGuard'ı tetikle → otomatik yönlendirme
      } else {
        showToast({ title: 'Henüz Doğrulanmadı', message: 'Lütfen e-posta kutunuzu kontrol edin.', type: 'warning' });
      }
    } catch {
      showToast({ title: 'Kontrol Edilemedi', message: 'Doğrulama durumu alınamadı. Tekrar dene.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const formatStatNumber = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
    return String(n);
  };

  return (
    <AppBackground radialGlow>
      <KeyboardAvoidingView style={s.container} behavior={'padding'}>

        <ScrollView contentContainerStyle={s.contentContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.content}>
            {/* ═══ LOGO — İki parçalı animasyonlu giriş ═══ */}
            <View style={s.logoSection}>
              <View style={s.logoRow}>
                {/* Soprano — soldan süzülerek gelir */}
                <Animated.Image
                  source={require('../../assets/soprano_part.png')}
                  style={[
                    s.logoPart,
                    s.sopranoImg,
                    {
                      opacity: sopranoOpacity,
                      transform: [{ translateX: sopranoTranslateX }],
                    },
                  ]}
                  resizeMode="contain"
                />
                {/* Chat — sağdan bounce ederek gelir */}
                <Animated.Image
                  source={require('../../assets/chat_part.png')}
                  style={[
                    s.logoPart,
                    s.chatImg,
                    {
                      opacity: chatOpacity,
                      transform: [{ translateX: chatTranslateX }],
                    },
                  ]}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* ═══ STAT PILLS ═══ */}
            <Animated.View style={[s.statsContainer, { opacity: statsOpacity }]}>
              <View style={s.statsRow}>
                <View style={s.statPill}>
                  <View style={[s.statDot, { backgroundColor: '#4ADE80' }]} />
                  <Text style={s.statText}>{formatStatNumber(onlineCount)} çevrimiçi</Text>
                </View>
                <View style={s.statPill}>
                  <View style={[s.statDot, s.statDotLive]} />
                  <Text style={s.statText}>{formatStatNumber(liveRoomCount)} canlı oda</Text>
                </View>
              </View>
            </Animated.View>

            {/* ═══ FORMS & BUTTONS ═══ */}
            <Animated.View style={{ opacity: buttonsOpacity, transform: [{ translateY: buttonsTranslateY }] }}>
              {/* ★ SEC-EV: Doğrulanmamış e-posta uyarı banner'ı */}
              {firebaseUser && !firebaseUser.emailVerified && firebaseUser.providerData?.some(p => p.providerId === 'password') && (
                <View style={s.verifyBanner}>
                  <Ionicons name="mail-unread-outline" size={22} color="#F59E0B" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.verifyTitle}>E-posta Doğrulanmadı</Text>
                    <Text style={s.verifyDesc}>Devam etmek için e-postanızı doğrulayın. Spam klasörünü de kontrol edin.</Text>
                  </View>
                  <View style={s.verifyActions}>
                    <Pressable onPress={handleResendVerification} disabled={resendLoading} style={s.verifyBtn}>
                      <Text style={s.verifyBtnText}>{resendLoading ? 'Gönderiliyor...' : 'Tekrar Gönder'}</Text>
                    </Pressable>
                    <Pressable onPress={handleCheckVerification} style={[s.verifyBtn, s.verifyBtnPrimary]}>
                      <Text style={[s.verifyBtnText, { color: '#FFF' }]}>Doğruladım</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              {loading ? (
                <View style={{ marginVertical: 36, alignItems: 'center' }}><AppLoader size="md" /></View>
              ) : showEmailForm ? (
                <View style={s.formArea}>
                  <View style={s.formHeader}>
                    <Pressable onPress={() => { setShowEmailForm(false); setIsRegisterMode(false); setPassword(''); setPasswordConfirm(''); setShowPassword(false); setShowPasswordConfirm(false); }} style={s.backBtn}>
                      <Ionicons name="arrow-back" size={18} color="#F1F5F9" />
                    </Pressable>
                    <Text style={s.formTitle}>{isRegisterMode ? 'Yeni Hesap Oluştur' : 'E-posta ile Giriş'}</Text>
                  </View>

                  {/* Email input */}
                  <View style={s.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color="#64748B" style={s.inputIcon} accessibilityElementsHidden importantForAccessibility="no" />
                    <TextInput
                      style={s.glassInput}
                      placeholder="E-posta adresiniz"
                      placeholderTextColor="#475569"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      accessibilityLabel="E-posta adresi"
                    />
                  </View>

                  {/* Password input */}
                  <View style={s.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} accessibilityElementsHidden importantForAccessibility="no" />
                    <TextInput
                      style={s.glassInput}
                      placeholder="Şifreniz"
                      placeholderTextColor="#475569"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      accessibilityLabel="Şifre"
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={s.eyeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      accessibilityState={{ checked: showPassword }}
                      hitSlop={8}
                    >
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#64748B" />
                    </Pressable>
                  </View>

                  {/* ★ SEC-PW: Kayıt modunda şifre gücü göstergesi */}
                  {isRegisterMode && password.length > 0 && (
                    <View style={s.strengthRow}>
                      <View style={s.strengthTrack}>
                        <View style={[s.strengthFill, { width: `${Math.min(getPasswordStrength(password).score * 25, 100)}%`, backgroundColor: getPasswordStrength(password).color }]} />
                      </View>
                      <Text style={[s.strengthLabel, { color: getPasswordStrength(password).color }]}>{getPasswordStrength(password).label}</Text>
                    </View>
                  )}

                  {isRegisterMode && (
                    <View style={s.inputWrap}>
                      <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} />
                      <TextInput
                        style={s.glassInput}
                        placeholder="Şifre (Tekrar)"
                        placeholderTextColor="#475569"
                        value={passwordConfirm}
                        onChangeText={setPasswordConfirm}
                        secureTextEntry={!showPasswordConfirm}
                      />
                      <Pressable onPress={() => setShowPasswordConfirm(!showPasswordConfirm)} style={s.eyeBtn}>
                        <Ionicons name={showPasswordConfirm ? "eye-off-outline" : "eye-outline"} size={18} color="#64748B" />
                      </Pressable>
                    </View>
                  )}

                  {/* CTA Button */}
                  <Pressable
                    style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={isRegisterMode ? handleEmailRegister : handleEmailLogin}
                  >
                    <LinearGradient
                      colors={Gradients.teal as [string, string]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.ctaGradient}
                    >
                      <Text style={s.ctaBtnText}>{isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
                    </LinearGradient>
                  </Pressable>

                  {/* Şifremi Unuttum */}
                  {!isRegisterMode && (
                    <Pressable style={s.linkBtn} onPress={() => { setShowForgotPassword(true); setResetEmail(email); }}>
                      <Text style={s.forgotText}>Şifremi Unuttum?</Text>
                    </Pressable>
                  )}

                  {/* veya ayırıcı */}
                  <View style={s.dividerRow}>
                    <View style={s.dividerLine} />
                    <Text style={s.dividerText}>veya</Text>
                    <View style={s.dividerLine} />
                  </View>

                  <Pressable style={s.linkBtn} onPress={() => setIsRegisterMode(!isRegisterMode)}>
                    <Text style={s.linkText}>
                      {isRegisterMode ? 'Zaten hesabın var mı? Giriş Yap' : 'Hesabın yok mu? Kayıt Ol'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                <View style={s.buttonsContainer}>
                  {/* Google Button — Odalarım CTA benzeri glassmorphic */}
                  <Pressable
                    style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={handleGoogleLogin}
                  >
                    <LinearGradient
                      colors={['#2E5A8F', '#254A78', '#1C3A60']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.socialGradient}
                    >
                      <View style={s.socialIconWrap}>
                        <Ionicons name="logo-google" size={20} color="#FFF" />
                      </View>
                      <Text style={s.socialBtnText}>Google ile Devam Et</Text>
                      <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', right: 16 }} />
                    </LinearGradient>
                  </Pressable>

                  {/* E-posta Button — Odalarım "Oda Oluştur" CTA ile aynı teal gradient */}
                  <Pressable
                    style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => setShowEmailForm(true)}
                  >
                    <LinearGradient
                      colors={['#14B8A6', '#0D9488', '#065F56']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.socialGradient}
                    >
                      <View style={s.socialIconWrap}>
                        <Ionicons name="mail-outline" size={20} color="#FFF" />
                      </View>
                      <Text style={s.socialBtnText}>E-posta ile Giriş</Text>
                      <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.5)" style={{ position: 'absolute', right: 16 }} />
                    </LinearGradient>
                  </Pressable>
                </View>

                  {/* ★ v92.28 (2 May 2026): "Dev Hızlı Giriş" butonu TAMAMEN KALDIRILDI.
                      __DEV__ flag dev bundle'da true olduğu için Metro'ya bağlı release
                      APK'da da görünüyordu — production credentials sızıntısı riski. */}
                </>
              )}
            </Animated.View>

            {/* Terms — pasif bilgilendirme */}
            <Text style={s.terms}>
              Devam ederek{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL('https://sopranochat.com/terms')}>Kullanım Koşulları</Text>{' '}ve{' '}
              <Text style={s.termsLink} onPress={() => Linking.openURL('https://sopranochat.com/privacy')}>Gizlilik Politikası</Text>'nı kabul edersiniz.
            </Text>
          </View>
        </ScrollView>

        {/* ★ Dead code kaldırıldı — premAlert state'i bu ekranda yok */}

        {/* Şifre Sıfırlama Modal */}
        <PremiumAlert
          visible={showForgotPassword}
          title="Şifre Sıfırlama"
          type="info"
          onDismiss={() => setShowForgotPassword(false)}
          message=""
          customContent={
            <View style={{ width: '100%', paddingHorizontal: 4 }}>
              <Text style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
                E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
              </Text>
              <View style={s.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#64748B" style={s.inputIcon} />
                <TextInput
                  style={s.glassInput}
                  placeholder="E-posta adresiniz"
                  placeholderTextColor="#475569"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>
          }
          buttons={[
            { text: 'İptal', onPress: () => setShowForgotPassword(false) },
            { text: resetLoading ? 'Gönderiliyor...' : 'Gönder', onPress: handleForgotPassword },
          ]}
        />
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0F1A' },
  container: { flex: 1 },
  contentContainer: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 30, paddingVertical: 40 },

  ambientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.4 },

  // ═══ LOGO — İki parçalı ═══
  logoSection: { alignItems: 'center', marginBottom: 32, marginTop: SCREEN_HEIGHT * 0.02 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  logoPart: { },
  // ★ 2026-04-29 v4: chat_part.png ölçümü — 1422x570, content 0..1192,
  //   yani sağ taraf **229 px transparent padding** içeriyor (~%16).
  //   126 dp render'da bu ~20 dp saydam alan → Chat'e marginRight: -20
  //   ile absorb edip container'ı daraltıyoruz → centered.
  sopranoImg: { width: 220, height: 60 },
  chatImg: { width: 126, height: 60, marginRight: -20 },

  // ═══ STAT PILLS ═══
  statsContainer: { alignItems: 'center', marginBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24,
    gap: 8,
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  statDot: { width: 8, height: 8, borderRadius: 4, shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 3 },
  statDotLive: { backgroundColor: '#F43F5E', shadowColor: '#F43F5E' },
  statText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 0.3, ...Shadows.textLight },

  // ═══ BUTTONS — Odalarım CTA benzeri ═══
  buttonsContainer: { width: '100%', gap: 14 },

  socialGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    // ★ Odalarım CTA shadow pattern
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  socialIconWrap: {
    position: 'absolute',
    left: 14,
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  socialBtnText: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // ═══ FORM ═══
  formArea: { width: '100%' },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.5, ...Shadows.text },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: Radius.default,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  glassInput: {
    flex: 1,
    fontSize: 15,
    color: '#F1F5F9',
    letterSpacing: 0.3,
  },
  eyeBtn: { padding: 4 },

  // CTA gradient button
  ctaGradient: {
    height: 54,
    borderRadius: Radius.default,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    overflow: 'hidden', // ★ FIX: Android gradient dikdörtgen gölge bugı
  },
  ctaBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5, ...Shadows.text },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '500' },

  // Links
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 4 },
  linkText: { fontSize: 13, color: '#14B8A6', fontWeight: '600', letterSpacing: 0.3, ...Shadows.textLight },
  forgotText: { fontSize: 12, color: '#14B8A6', fontWeight: '500', letterSpacing: 0.3, ...Shadows.textLight },

  // ★ SEC-PW: Şifre gücü göstergesi
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: -6, paddingHorizontal: 2 },
  strengthTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, minWidth: 40, textAlign: 'right' },

  // Terms — pasif bilgilendirme
  terms: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', lineHeight: 20,
    paddingHorizontal: 16, marginTop: 28,
  },
  termsLink: { color: '#14B8A6', fontWeight: '600' },

  // ★ SEC-EV: E-posta doğrulama banner'ı
  verifyBanner: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: Radius.default,
    padding: 16,
    marginBottom: 20,
  },
  verifyTitle: { color: '#F59E0B', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  verifyDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 },
  verifyActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  verifyBtn: {
    flex: 1, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  verifyBtnPrimary: { backgroundColor: '#14B8A6', borderColor: '#14B8A6' },
  verifyBtnText: { fontSize: 12, fontWeight: '700', color: '#F59E0B', letterSpacing: 0.3 },
});
