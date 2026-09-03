import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth, GOOGLE_WEB_CLIENT_ID } from '../../constants/firebase';

let GoogleSignin: any;
try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin || mod.default?.GoogleSignin || mod.default || mod;
  GoogleSignin?.configure?.({ webClientId: GOOGLE_WEB_CLIENT_ID });
} catch {
  GoogleSignin = null;
}

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'error' | 'ok'>('error');

  const canSubmit = useMemo(() => {
    if (!email.trim() || password.length < 6) return false;
    if (mode === 'register' && password !== confirm) return false;
    return true;
  }, [email, password, confirm, mode]);

  const say = (text: string, kind: 'error' | 'ok' = 'error') => {
    setMessage(text);
    setMessageKind(kind);
  };

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        try { await sendEmailVerification(credential.user); } catch {}
        say('Hesap oluşturuldu. E-posta doğrulama bağlantısını da gönderdik.', 'ok');
      }
    } catch (error: any) {
      const code = String(error?.code || '');
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        say('E-posta veya şifre yanlış.');
      } else if (code.includes('email-already-in-use')) {
        say('Bu e-posta zaten kayıtlı. Üye girişi sekmesini kullan.');
      } else if (code.includes('weak-password')) {
        say('Şifre biraz daha güçlü olmalı.');
      } else {
        say(error?.message || 'Giriş tamamlanamadı.');
      }
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    if (busy) return;
    if (!GoogleSignin?.signIn) {
      say('Google girişi bu yapıda kullanılamıyor. E-posta ile giriş yapabilirsin.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await GoogleSignin.hasPlayServices?.();
      try { await GoogleSignin.signOut?.(); } catch {}
      const result = await GoogleSignin.signIn();
      const idToken = result?.data?.idToken || result?.idToken;
      if (!idToken) throw new Error('Google kimlik anahtarı alınamadı.');
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      say(error?.message || 'Google ile giriş tamamlanamadı.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || busy) {
      say('Önce e-posta adresini yaz.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      say('Şifre yenileme bağlantısı e-posta adresine gönderildi.', 'ok');
    } catch (error: any) {
      say(error?.message || 'Şifre yenileme bağlantısı gönderilemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient colors={['#70717A', '#35363D', '#15161A']} style={styles.chrome}>
            <View style={styles.logoMark}>
              <Ionicons name="mic" size={24} color="#EEF0FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logo}>SopranoChat</Text>
              <Text style={styles.logoSub}>hear my voice</Text>
            </View>
            <View style={styles.versionPill}>
              <Text style={styles.versionText}>MOBILE</Text>
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['rgba(255,255,255,.28)', 'rgba(255,255,255,.08)']}
            style={styles.welcomeCard}
          >
            <Text style={styles.kicker}>SOPRANOCHAT'E HOŞ GELDİN</Text>
            <Text style={styles.title}>Sesinle içeri gir.</Text>
            <Text style={styles.copy}>
              Webdeki klasik SopranoChat hissi, telefona özel daha temiz ve dokunmatik bir arayüzle burada.
            </Text>

            <View style={styles.modeRow}>
              <Pressable onPress={() => { setMode('login'); setMessage(''); }} style={styles.modeButton}>
                {mode === 'login' ? (
                  <LinearGradient colors={['#FFFFFF', '#D8DAE6', '#A8AABD']} style={styles.modeActive}>
                    <Text style={styles.modeActiveText}>Üye Girişi</Text>
                  </LinearGradient>
                ) : <Text style={styles.modeText}>Üye Girişi</Text>}
              </Pressable>
              <Pressable onPress={() => { setMode('register'); setMessage(''); }} style={styles.modeButton}>
                {mode === 'register' ? (
                  <LinearGradient colors={['#FFFFFF', '#D8DAE6', '#A8AABD']} style={styles.modeActive}>
                    <Text style={styles.modeActiveText}>Yeni Hesap</Text>
                  </LinearGradient>
                ) : <Text style={styles.modeText}>Yeni Hesap</Text>}
              </Pressable>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.label}>E-posta</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color="#65677B" />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ornek@sopranochat.com"
                  placeholderTextColor="#9B9DAF"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={styles.input}
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Şifre</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color="#65677B" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="En az 6 karakter"
                  placeholderTextColor="#9B9DAF"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textContentType="password"
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#696B7E" />
                </Pressable>
              </View>

              {mode === 'register' && (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>Şifre tekrar</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#65677B" />
                    <TextInput
                      value={confirm}
                      onChangeText={setConfirm}
                      placeholder="Şifreyi tekrar yaz"
                      placeholderTextColor="#9B9DAF"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  </View>
                </>
              )}

              {!!message && (
                <View style={[styles.messageBox, messageKind === 'ok' ? styles.messageOk : styles.messageError]}>
                  <Ionicons
                    name={messageKind === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={messageKind === 'ok' ? '#23723A' : '#9A2639'}
                  />
                  <Text style={[styles.messageText, messageKind === 'ok' ? { color: '#23723A' } : { color: '#9A2639' }]}>
                    {message}
                  </Text>
                </View>
              )}

              <Pressable disabled={!canSubmit || busy} onPress={submit} style={{ marginTop: 16 }}>
                <LinearGradient
                  colors={canSubmit ? ['#6F718E', '#4B4D66', '#2B2D3A'] : ['#B7B8C5', '#9B9CAA']}
                  style={[styles.primaryButton, (!canSubmit || busy) && { opacity: .65 }]}
                >
                  {busy ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Ionicons name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'} size={18} color="#FFF" />
                      <Text style={styles.primaryText}>{mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              {mode === 'login' && (
                <Pressable onPress={resetPassword} style={styles.forgotButton}>
                  <Text style={styles.forgotText}>Şifremi unuttum</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>VEYA</Text>
              <View style={styles.divider} />
            </View>

            <Pressable onPress={googleLogin} disabled={busy} style={styles.googleButton}>
              <Ionicons name="logo-google" size={19} color="#454759" />
              <Text style={styles.googleText}>Google ile devam et</Text>
            </Pressable>
          </LinearGradient>

          <View style={styles.footerRow}>
            <View style={styles.statusDot} />
            <Text style={styles.footerText}>SopranoChat ses odaları hazır</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#727493' },
  content: { flexGrow: 1, padding: 14, justifyContent: 'center' },
  chrome: {
    minHeight: 78,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.45)',
    shadowColor: '#1E1F29', shadowOpacity: .4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  logoMark: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,.28)',
  },
  logo: { color: '#F6F7FF', fontSize: 23, fontWeight: '900', letterSpacing: -0.7 },
  logoSub: { color: '#BEC1D1', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginTop: -2 },
  versionPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,.20)' },
  versionText: { color: '#D8DAE6', fontSize: 7.5, fontWeight: '900', letterSpacing: 1 },
  welcomeCard: {
    marginTop: 12,
    borderRadius: 24,
    padding: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.45)',
  },
  kicker: { color: '#ECEEF9', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginTop: 5, letterSpacing: -0.6 },
  copy: { color: '#E3E5F0', fontSize: 12, lineHeight: 18, marginTop: 7 },
  modeRow: {
    height: 48, flexDirection: 'row', marginTop: 17, padding: 4, borderRadius: 14,
    backgroundColor: 'rgba(43,44,57,.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)',
  },
  modeButton: { flex: 1, padding: 2 },
  modeActive: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.7)' },
  modeActiveText: { color: '#44465A', fontWeight: '900', fontSize: 11 },
  modeText: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: '#E4E6F1', fontWeight: '800', fontSize: 11, paddingTop: 10 },
  formCard: {
    marginTop: 12, padding: 14, borderRadius: 19, backgroundColor: 'rgba(244,245,251,.96)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,.90)',
  },
  label: { color: '#56586B', fontSize: 10, fontWeight: '900', letterSpacing: .35 },
  inputWrap: {
    minHeight: 48, borderRadius: 13, marginTop: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C8CAD8',
  },
  input: { flex: 1, color: '#414355', fontSize: 13, paddingVertical: 10 },
  primaryButton: {
    minHeight: 50, borderRadius: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,.35)',
  },
  primaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  forgotButton: { alignSelf: 'center', paddingVertical: 11, paddingHorizontal: 16 },
  forgotText: { color: '#66687C', fontSize: 10.5, fontWeight: '800', textDecorationLine: 'underline' },
  messageBox: { marginTop: 12, borderRadius: 11, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1 },
  messageError: { backgroundColor: '#FFE7EB', borderColor: '#F2A9B4' },
  messageOk: { backgroundColor: '#E5F7E9', borderColor: '#A5D8AF' },
  messageText: { flex: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 13 },
  divider: { height: 1, flex: 1, backgroundColor: 'rgba(255,255,255,.30)' },
  dividerText: { color: '#E1E3EF', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  googleButton: {
    minHeight: 49, borderRadius: 14, backgroundColor: '#F5F5FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderWidth: 1, borderColor: '#D4D5E0',
  },
  googleText: { color: '#4B4D60', fontSize: 12, fontWeight: '900' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 13 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#75D77D' },
  footerText: { color: '#DDE0EC', fontSize: 9.5, fontWeight: '700' },
});
