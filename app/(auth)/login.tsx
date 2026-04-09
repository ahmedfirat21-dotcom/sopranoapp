import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Animated, Easing, Linking } from 'react-native';
import PremiumAlert, { type AlertButton } from '../../components/PremiumAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
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

import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

import { showToast } from '../../components/Toast';
import { auth, GOOGLE_WEB_CLIENT_ID } from '../../constants/firebase';
import { useAuth } from '../_layout';

const { height: SCREEN_HEIGHT, width: SCREEN_W } = Dimensions.get('window');

export default function LoginScreen() {
  const { } = useAuth();
  const [loading, setLoading] = useState(false);
  const [premAlert, setPremAlert] = useState<{visible:boolean;title:string;message:string;type?:any;buttons?:AlertButton[]}>({visible:false,title:'',message:''});

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
  const orbFloat = useRef(new Animated.Value(0)).current;

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

    Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloat, { toValue: 20, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(orbFloat, { toValue: -20, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
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
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error: any) {
      if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password') {
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
      await createUserWithEmailAndPassword(auth, email.trim(), password);
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
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Animated BG Orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[s.meshOrb, s.meshTeal, { transform: [{ translateY: orbFloat }] }]} />
        <Animated.View style={[s.meshOrb, s.meshPurple, { transform: [{ translateY: Animated.multiply(orbFloat, -1) }] }]} />
      </View>

      <LinearGradient
        colors={['rgba(20,184,166,0.12)', 'rgba(139,92,246,0.06)', 'transparent']}
        style={s.ambientTop}
        pointerEvents="none"
      />

      <ScrollView contentContainerStyle={s.contentContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.content}>
          {/* LOGO */}
          <View style={s.logoSection}>
            <Image source={require('../../assets/logo.png')} style={{ width: 240, height: 56, marginBottom: 6 }} resizeMode="contain" />
            <Text style={s.titleSub}>Senin Sesin</Text>
          </View>

          {/* Stat pills */}
          <View style={s.statsContainer}>
            <View style={s.statsRow}>
              <View style={s.statPill}>
                <View style={[s.statDot, { backgroundColor: '#4ADE80' }]} />
                <Text style={s.statText}>{formatStatNumber(onlineCount)} çevrimiçi</Text>
              </View>
              <View style={s.statPill}>
                <View style={[s.statDot, { backgroundColor: '#F43F5E' }]} />
                <Text style={s.statText}>{formatStatNumber(liveRoomCount)} canlı oda</Text>
              </View>
            </View>
          </View>

          {/* FORMS & BUTTONS */}
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

              <Pressable
                style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={isRegisterMode ? handleEmailRegister : handleEmailLogin}
              >
                <Text style={s.ctaBtnText}>{isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
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
              {/* Google */}
              <Pressable
                style={({ pressed }) => [s.socialBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={handleGoogleLogin}
              >
                <Ionicons name="logo-google" size={22} color="#FFF" style={s.socialIcon} />
                <Text style={s.socialBtnText}>Google ile Devam Et</Text>
              </Pressable>

              {/* E-posta */}
              <Pressable
                style={({ pressed }) => [s.socialBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => setShowEmailForm(true)}
              >
                <Ionicons name="mail-outline" size={22} color="#FFF" style={s.socialIcon} />
                <Text style={s.socialBtnText}>E-posta ile Giriş</Text>
              </Pressable>
            </View>
          )}

          {/* Terms */}
          <Text style={s.terms}>
            Devam ederek{' '}
            <Text style={s.termsLink} onPress={() => Linking.openURL('https://sopranochat.app/terms')}>Kullanım Koşulları</Text>{' '}ve{' '}
            <Text style={s.termsLink} onPress={() => Linking.openURL('https://sopranochat.app/privacy')}>Gizlilik Politikası</Text>'nı kabul edersiniz.
          </Text>
        </View>
      </ScrollView>

      <PremiumAlert visible={premAlert.visible} title={premAlert.title} message={premAlert.message} type={premAlert.type||'info'} buttons={premAlert.buttons} onDismiss={()=>setPremAlert(p=>({...p,visible:false}))} />

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
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2f404f' },
  contentContainer: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 30, paddingVertical: 40 },

  meshOrb: { position: 'absolute', width: SCREEN_W * 1.5, height: SCREEN_W * 1.5, borderRadius: SCREEN_W },
  meshTeal: { backgroundColor: '#14B8A6', top: -SCREEN_W * 0.6, left: -SCREEN_W * 0.4, opacity: 0.05 },
  meshPurple: { backgroundColor: '#8B5CF6', bottom: -SCREEN_W * 0.5, right: -SCREEN_W * 0.5, opacity: 0.04 },
  ambientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.45 },

  logoSection: { alignItems: 'center', marginBottom: 28, marginTop: SCREEN_HEIGHT * 0.02 },
  titleSub: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '500', letterSpacing: 2, fontStyle: 'italic' },

  statsContainer: { alignItems: 'center', marginBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    gap: 6,
  },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500' },

  buttonsContainer: { width: '100%', gap: 14 },

  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  socialIcon: { position: 'absolute', left: 24 },
  socialBtnText: { color: '#F1F5F9', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },

  // Form
  formArea: { width: '100%' },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.5 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  glassInput: {
    flex: 1,
    fontSize: 14,
    color: '#F1F5F9',
    letterSpacing: 0.3,
  },
  eyeBtn: { padding: 4 },

  // CTA
  ctaBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  ctaBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '500' },

  // Links
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 4 },
  linkText: { fontSize: 13, color: '#14B8A6', fontWeight: '600', letterSpacing: 0.3 },
  forgotText: { fontSize: 12, color: '#14B8A6', fontWeight: '500', letterSpacing: 0.3 },

  // Terms
  terms: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', lineHeight: 20,
    paddingHorizontal: 20, marginTop: 36,
  },
  termsLink: { color: '#14B8A6', fontWeight: '500' },
});
