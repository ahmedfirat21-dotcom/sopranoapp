import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Animated, Easing, Linking, ImageBackground } from 'react-native';
import PremiumAlert from '../../components/PremiumAlert';
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
import { auth, GOOGLE_WEB_CLIENT_ID } from '../../constants/firebase';
import { useAuth } from '../_layout';

const { height: SCREEN_HEIGHT, width: SCREEN_W } = Dimensions.get('window');

export default function LoginScreen() {
  const { } = useAuth();
  const [loading, setLoading] = useState(false);

  // ★ SEC-BF1: Brute force koruması — başarısız giriş denemesi takibi
  const failedAttemptsRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  // Email state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Live stats
  const [onlineCount, setOnlineCount] = useState(0);
  const [liveRoomCount, setLiveRoomCount] = useState(0);

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animations
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(30)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

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

    // Staggered entrance animations
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.timing(statsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 300);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(buttonsTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }, 500);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
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
    if (!email || !password) return;
    // ★ SEC-BF1: Cooldown kontrolü — 5 başarısız denemeden sonra 30sn bekleme
    if (Date.now() < cooldownUntilRef.current) {
      const remainSec = Math.ceil((cooldownUntilRef.current - Date.now()) / 1000);
      showToast({ title: 'Çok fazla deneme', message: `Lütfen ${remainSec} saniye bekleyin.`, type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      failedAttemptsRef.current = 0; // Başarılı — sayacı sıfırla
    } catch (error: any) {
      failedAttemptsRef.current++;
      // ★ SEC-BF1: 5 başarısız denemeden sonra 30sn cooldown
      if (failedAttemptsRef.current >= 5) {
        cooldownUntilRef.current = Date.now() + 30_000;
        showToast({ title: 'Çok fazla deneme', message: '30 saniye bekleyip tekrar deneyin.', type: 'error' });
      } else if (error?.code === 'auth/too-many-requests') {
        cooldownUntilRef.current = Date.now() + 60_000;
        showToast({ title: 'Hesap geçici kilitli', message: 'Çok fazla başarısız deneme. 1 dakika bekleyin.', type: 'error' });
      } else if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
        showToast({ title: 'Hata', message: 'Kullanıcı adı veya şifre yanlış.', type: 'error' });
      } else if (error?.code === 'auth/user-not-found') {
        showToast({ title: 'Hata', message: 'Böyle bir kullanıcı bulunamadı.', type: 'error' });
      } else {
        showToast({ title: 'Hata', message: 'Giriş yapılamadı. Tekrar deneyin.', type: 'error' });
      }
    }
    setLoading(false);
  };

  const handleEmailRegister = async () => {
    if (!email || !password || !passwordConfirm) {
      showToast({ title: 'Eksik Bilgi', message: 'Tüm alanları doldurun.', type: 'warning' });
      return;
    }
    if (password !== passwordConfirm) {
      showToast({ title: 'Hata', message: 'Şifreleriniz eşleşmiyor.', type: 'error' });
      return;
    }
    if (password.length < 6) {
      showToast({ title: 'Hata', message: 'Şifreniz en az 6 karakter olmalıdır.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // ★ E-posta doğrulama gönder — kayıt sonrası otomatik
      if (userCredential.user) {
        try {
          await sendEmailVerification(userCredential.user, {
            url: 'https://sopranochat.com/verified',
            handleCodeInApp: false,
          });
          showToast({ title: '✉️ Doğrulama E-postası Gönderildi', message: 'Lütfen e-posta kutunuzu kontrol edin.', type: 'success' });
        } catch { /* doğrulama gönderilemezse sessiz — kullanıcı yine de giriş yapabilir */ }
      }
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        showToast({ title: 'Hata', message: 'Bu e-posta zaten kullanılıyor.', type: 'error' });
      } else if (error?.code === 'auth/invalid-email') {
        showToast({ title: 'Hata', message: 'Geçersiz e-posta adresi.', type: 'error' });
      } else {
        showToast({ title: 'Hata', message: 'Kayıt olunamadı.', type: 'error' });
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (resetLoading) return; // ★ SEC-FP: Çift tıklama koruması
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      showToast({ title: 'Eksik Bilgi', message: 'Lütfen e-posta adresinizi yazın.', type: 'warning' });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      showToast({ title: 'Başarılı', message: 'Şifre sıfırlama bağlantısı gönderildi.', type: 'success' });
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') {
        showToast({ title: 'Hata', message: 'Bu e-posta ile hesap bulunamadı.', type: 'error' });
      } else {
        showToast({ title: 'Hata', message: 'Bir sorun oluştu.', type: 'error' });
      }
    } finally {
      setResetLoading(false);
    }
  };

  const formatStatNumber = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
    return String(n);
  };

  return (
    <ImageBackground
      source={require('../../assets/images/app_bg.jpg')}
      style={s.root}
      resizeMode="cover"
    >
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Vignette overlay for depth */}
        <LinearGradient
          colors={['rgba(15,25,38,0.6)', 'transparent', 'transparent', 'rgba(15,25,38,0.7)']}
          locations={[0, 0.25, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Ambient teal glow — top */}
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'rgba(20,184,166,0.03)', 'transparent']}
          style={s.ambientTop}
          pointerEvents="none"
        />

        <ScrollView contentContainerStyle={s.contentContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.content}>
            {/* ═══ LOGO ═══ */}
            <Animated.View style={[s.logoSection, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
              {/* logo.png içinde "Senin Sesin" var — overflow:hidden ile kırpıyoruz */}
              <View style={s.logoClip}>
                <Image source={require('../../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
              </View>
            </Animated.View>

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
              {loading ? (
                <ActivityIndicator size="large" color="#14B8A6" style={{ marginVertical: 36 }} />
              ) : showEmailForm ? (
                <View style={s.formArea}>
                  <View style={s.formHeader}>
                    <Pressable onPress={() => { setShowEmailForm(false); setIsRegisterMode(false); }} style={s.backBtn}>
                      <Ionicons name="arrow-back" size={18} color="#F1F5F9" />
                    </Pressable>
                    <Text style={s.formTitle}>{isRegisterMode ? 'Yeni Hesap Oluştur' : 'E-posta ile Giriş'}</Text>
                  </View>

                  {/* Email input */}
                  <View style={s.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color="#64748B" style={s.inputIcon} />
                    <TextInput
                      style={s.glassInput}
                      placeholder="E-posta adresiniz"
                      placeholderTextColor="#475569"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>

                  {/* Password input */}
                  <View style={s.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} />
                    <TextInput
                      style={s.glassInput}
                      placeholder="Şifreniz"
                      placeholderTextColor="#475569"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#64748B" />
                    </Pressable>
                  </View>

                  {isRegisterMode && (
                    <View style={s.inputWrap}>
                      <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} />
                      <TextInput
                        style={s.glassInput}
                        placeholder="Şifre (Tekrar)"
                        placeholderTextColor="#475569"
                        value={passwordConfirm}
                        onChangeText={setPasswordConfirm}
                        secureTextEntry
                      />
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
                <View style={s.buttonsContainer}>
                  {/* Google Button — Blue gradient */}
                  <Pressable
                    style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={handleGoogleLogin}
                  >
                    <LinearGradient
                      colors={['#4285F4', '#3367D6']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.socialGradient}
                    >
                      <View style={s.socialIconWrap}>
                        <Ionicons name="logo-google" size={20} color="#FFF" />
                      </View>
                      <Text style={s.socialBtnText}>Google ile Devam Et</Text>
                    </LinearGradient>
                  </Pressable>

                  {/* E-posta Button — Teal gradient */}
                  <Pressable
                    style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => setShowEmailForm(true)}
                  >
                    <LinearGradient
                      colors={Gradients.teal as [string, string]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={s.socialGradient}
                    >
                      <View style={s.socialIconWrap}>
                        <Ionicons name="mail-outline" size={20} color="#FFF" />
                      </View>
                      <Text style={s.socialBtnText}>E-posta ile Giriş</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
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
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1926' },
  container: { flex: 1 },
  contentContainer: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 30, paddingVertical: 40 },

  ambientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.4 },

  // ═══ LOGO ═══
  logoSection: { alignItems: 'center', marginBottom: 32, marginTop: SCREEN_HEIGHT * 0.02 },
  logoClip: { width: 260, height: 40, overflow: 'hidden' },
  logoImage: { width: 260, height: 60 },

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

  // ═══ BUTTONS ═══
  buttonsContainer: { width: '100%', gap: 14 },

  socialGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: Radius.default,
    overflow: 'hidden', // ★ FIX: Android'de elevation gölge dikdörtgenini önler
  },
  socialIconWrap: {
    position: 'absolute',
    left: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  socialBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5, ...Shadows.text },

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

  // Terms — pasif bilgilendirme
  terms: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', lineHeight: 20,
    paddingHorizontal: 16, marginTop: 28,
  },
  termsLink: { color: '#14B8A6', fontWeight: '600' },
});
