import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Dimensions, ScrollView, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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

import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, PhoneAuthProvider, signInWithPhoneNumber } from 'firebase/auth';
import { Colors, Gradients, Radius } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { auth, app, GOOGLE_WEB_CLIENT_ID } from '../../constants/firebase';
import { useAuth } from '../_layout';

const { height: SCREEN_HEIGHT, width: SCREEN_W } = Dimensions.get('window');

export default function LoginScreen() {
  const { setIsLoggedIn, setUser, setProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const recaptchaVerifier = useRef(null);

  // Email state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Phone OTP state
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const orbFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

    // Logo pulse ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    // Glow breathing
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    // Orb floating
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
      console.warn('Google login hatasi:', error);
      showToast({ title: 'Dikkat', message: error?.message || 'Google ile giriş iptal edildi veya bir hata oluştu.', type: 'warning' });
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
      showToast({ title: 'Eksik Bilgi', message: 'Yeni hesap oluşturmak için e-posta ve şifrenizi eksiksiz yazın.', type: 'warning' });
      return;
    }
    if (password !== passwordConfirm) {
      showToast({ title: 'Hata', message: 'Şifreleriniz eşleşmiyor, lütfen tekrar kontrol edin.', type: 'error' });
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
        showToast({ title: 'Hata', message: 'Bu e-posta adresi ile zaten bir hesap var.', type: 'error' });
      } else if (error?.code === 'auth/invalid-email') {
        showToast({ title: 'Hata', message: 'Geçersiz bir e-posta adresi yazdınız.', type: 'error' });
      } else {
        showToast({ title: 'Hata', message: 'Kayıt olunamadı. Tekrar deneyin.', type: 'error' });
      }
    }
    setLoading(false);
  };

  const handleSendOTP = async () => {
    const cleaned = phoneNumber.trim();
    if (!phoneNumber || phoneNumber.length < 10) {
      showToast({ title: 'Hata', message: 'Geçerli bir telefon numarası girin (Başına ülke kodu ile).', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = cleaned.startsWith('+') ? cleaned : `+90${cleaned}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier.current as any);
      if (confirmation?.verificationId) {
        setVerificationId(confirmation.verificationId);
        setOtpSent(true);
        showToast({ title: 'Kod Gönderildi', message: `${formattedPhone} numarasına SMS kodu gönderildi.`, type: 'success' });
      } else {
        Alert.alert('Bilgilendirme', 'SMS doğrulama şu an aktif değil. Lütfen Google veya E-posta ile giriş yapın.',
          [{ text: 'Tamam', onPress: () => setShowPhoneForm(false) }]);
      }
    } catch (error: any) {
      console.warn('OTP gönderim hatası:', error);
      if (error?.code === 'auth/invalid-phone-number') {
        showToast({ title: 'Hata', message: 'Geçersiz telefon numarası.', type: 'error' });
      } else if (error?.code === 'auth/too-many-requests') {
        showToast({ title: 'Hata', message: 'Çok fazla deneme yaptınız. Lütfen birkaç dakika bekleyin.', type: 'warning' });
      } else if (error?.code === 'auth/operation-not-allowed') {
        showToast({ title: 'Bilgi', message: 'Telefon ile giriş henüz aktif edilmemiş. Lütfen Google veya E-posta ile giriş yapın.', type: 'info' });
      } else {
        showToast({ title: 'Giriş Kullanılamıyor', message: 'Bu özellik şu an geliştirme aşamasındadır. Lütfen Google veya E-posta ile giriş yapın.', type: 'error' });
        setShowPhoneForm(false);
      }
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6 || !verificationId) {
      showToast({ title: 'Hata', message: '6 haneli doğrulama kodunu girin.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otpCode);
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      console.warn('OTP doğrulama hatası:', error);
      if (error?.code === 'auth/invalid-verification-code') {
        showToast({ title: 'Hata', message: 'Girdiğiniz kod hatalı.', type: 'error' });
      } else {
        showToast({ title: 'Hata', message: 'Doğrulama başarısız. Tekrar deneyin.', type: 'error' });
      }
    }
    setLoading(false);
  };

  const AnimatedButton = ({ onPress, children, style, disabled }: any) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.glassBtnWrap,
        style,
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      {children}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ANIMATED BACKGROUND ORBS */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.meshOrb, styles.meshTeal, { transform: [{ translateY: orbFloat }] }]} />
        <Animated.View style={[styles.meshOrb, styles.meshPurple, {
          transform: [{ translateY: Animated.multiply(orbFloat, -1) }]
        }]} />
      </View>

      {/* Ambient Top Gradient */}
      <LinearGradient
        colors={['rgba(20,184,166,0.15)', 'rgba(139,92,246,0.08)', 'transparent']}
        style={styles.ambientTop}
        pointerEvents="none"
      />

      <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* LOGO SECTION WITH ANIMATED PULSE RING */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircleContainer}>
              <Animated.View style={[styles.logoPulseRing, {
                transform: [{ scale: pulseAnim }],
                opacity: Animated.subtract(1.4, pulseAnim),
              }]} />
              <Animated.View style={[styles.logoGlowRing, { opacity: glowAnim }]} />
              <View style={styles.logoCircle}>
                <Image source={require('../../assets/ikonheadar.png')} style={styles.logoImage} resizeMode="contain" />
              </View>
            </View>
            <Image source={require('../../assets/logo.png')} style={{ width: 220, height: 50, marginBottom: 4 }} resizeMode="contain" />
            <Text style={styles.titleSub}>Dijital Sosyal Evrenine Hoş Geldin</Text>
          </View>

          {/* STAT PILLS */}
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <View style={[styles.statDot, { backgroundColor: '#4ADE80' }]} />
                <Text style={styles.statText}>3.2K çevrimiçi</Text>
              </View>
              <View style={styles.statPill}>
                <View style={[styles.statDot, { backgroundColor: '#F43F5E' }]} />
                <Text style={styles.statText}>248 canlı oda</Text>
              </View>
            </View>
          </View>

          {/* FORMS & BUTTONS */}
          {loading ? (
            <ActivityIndicator size="large" color="#14B8A6" style={{ marginVertical: 36 }} />
          ) : showEmailForm ? (
            <View style={styles.formArea}>
              <View style={styles.formHeader}>
                <Pressable onPress={() => { setShowEmailForm(false); setIsRegisterMode(false); }} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color="#FFF" />
                </Pressable>
                <Text style={styles.formTitle}>{isRegisterMode ? 'Yeni Hesap Oluştur' : 'E-posta ile Giriş'}</Text>
              </View>

              <TextInput style={styles.glassInput} placeholder="E-posta adresiniz" placeholderTextColor="rgba(255,255,255,0.35)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <TextInput style={styles.glassInput} placeholder="Şifreniz" placeholderTextColor="rgba(255,255,255,0.35)" value={password} onChangeText={setPassword} secureTextEntry />
              {isRegisterMode && (
                <TextInput style={styles.glassInput} placeholder="Şifre (Tekrar)" placeholderTextColor="rgba(255,255,255,0.35)" value={passwordConfirm} onChangeText={setPasswordConfirm} secureTextEntry />
              )}

              <AnimatedButton onPress={isRegisterMode ? handleEmailRegister : handleEmailLogin}>
                <LinearGradient colors={['#14B8A6', '#06B6D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.glassBtn}>
                  <Ionicons name={isRegisterMode ? 'person-add-outline' : 'log-in-outline'} size={22} color="#FFF" style={styles.btnIcon} />
                  <Text style={styles.btnText}>{isRegisterMode ? 'Kayıt Ol' : 'Giriş Yap'}</Text>
                </LinearGradient>
              </AnimatedButton>

              <Pressable style={styles.linkBtn} onPress={() => setIsRegisterMode(!isRegisterMode)}>
                <Text style={styles.linkText}>
                  {isRegisterMode ? 'Zaten hesabın var mı? Giriş Yap' : 'Hesabın yok mu? Yeni Hesap Oluştur'}
                </Text>
              </Pressable>
            </View>
          ) : showPhoneForm ? (
            <View style={styles.formArea}>
              <View style={styles.formHeader}>
                <Pressable onPress={() => { setShowPhoneForm(false); setOtpSent(false); setVerificationId(null); }} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={18} color="#FFF" />
                </Pressable>
                <Text style={styles.formTitle}>Telefon ile Giriş</Text>
              </View>

              {!otpSent ? (
                <>
                  <TextInput style={styles.glassInput} placeholder="+90 5XX XXX XX XX" placeholderTextColor="rgba(255,255,255,0.35)" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" autoComplete="tel" />
                  <AnimatedButton onPress={handleSendOTP}>
                    <View style={styles.glassBtn}>
                      <Ionicons name="send" size={20} color="#FFF" style={styles.btnIcon} />
                      <Text style={styles.btnText}>Doğrulama Kodu Gönder</Text>
                    </View>
                  </AnimatedButton>
                </>
              ) : (
                <>
                  <Text style={styles.otpLabel}>{phoneNumber} numarasına gönderilen 6 haneli kodu girin:</Text>
                  <TextInput style={[styles.glassInput, { textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: '700' }]} placeholder="------" placeholderTextColor="rgba(255,255,255,0.2)" value={otpCode} onChangeText={setOtpCode} keyboardType="number-pad" maxLength={6} />
                  <AnimatedButton onPress={handleVerifyOTP}>
                    <View style={styles.glassBtn}>
                      <Ionicons name="checkmark-circle" size={22} color="#FFF" style={styles.btnIcon} />
                      <Text style={styles.btnText}>Doğrula</Text>
                    </View>
                  </AnimatedButton>
                  <Pressable style={styles.linkBtn} onPress={() => { setOtpSent(false); setOtpCode(''); }}>
                    <Text style={styles.linkText}>Tekrar gönder</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              {/* Google */}
              <AnimatedButton onPress={handleGoogleLogin}>
                <View style={styles.glassBtn}>
                  <Ionicons name="logo-google" size={24} color="#FFF" style={styles.btnIcon} />
                  <Text style={styles.btnText}>Google ile Devam Et</Text>
                </View>
              </AnimatedButton>

              {/* E-posta — BUGFIX: Bu buton eksikti! */}
              <AnimatedButton onPress={() => { setShowEmailForm(true); setShowPhoneForm(false); }}>
                <View style={styles.glassBtn}>
                  <Ionicons name="mail-outline" size={24} color="#FFF" style={styles.btnIcon} />
                  <Text style={styles.btnText}>E-posta ile Giriş</Text>
                </View>
              </AnimatedButton>

              {/* Telefon */}
              <AnimatedButton onPress={() => { setShowPhoneForm(true); setShowEmailForm(false); }}>
                <View style={styles.glassBtn}>
                  <Ionicons name="call-outline" size={24} color="#FFF" style={styles.btnIcon} />
                  <Text style={styles.btnText}>Telefon ile Giriş</Text>
                </View>
              </AnimatedButton>
            </View>
          )}

          {/* Terms */}
          <Text style={styles.terms}>
            Devam ederek{' '}
            <Text style={styles.termsLink} onPress={() => Alert.alert(
              'Kullanım Koşulları',
              'SopranoChat Kullanım Koşulları\n\nSon Güncelleme: 31 Mart 2026\n\n1. Hizmet Tanımı\nSopranoChat, kullanıcıların sesli/görüntülü odalar oluşturup katılabildiği bir sosyal platform uygulamasıdır.\n\n2. Hesap Oluşturma\nHizmeti kullanabilmek için geçerli bir hesap oluşturmanız gerekmektedir. 13 yaşından küçük kişiler hesap oluşturamaz.\n\n3. Kullanıcı Davranışları\n• Nefret söylemi, taciz, tehdit ve şiddet içerikli paylaşımlar yasaktır.\n• Telif hakkı ihlali yapan içerikler paylaşılamaz.\n• Spam, dolandırıcılık ve yanıltıcı davranışlar yasaktır.\n• Diğer kullanıcıların mahremiyetini ihlal etmek yasaktır.\n\n4. Sanal Para (Soprano Coin)\n• SC satın alımları kesindir ve iade edilemez.\n• SC yalnızca uygulama içi hediye ve özellikler için kullanılabilir.\n• SC gerçek para karşılığı nakde çevrilemez.\n\n5. Abonelikler\n• Plus ve VIP abonelikleri otomatik olarak yenilenir.\n• İptal işlemi App Store/Google Play üzerinden yapılabilir.\n\n6. İçerik Moderasyonu\nSopranoChat, topluluk kurallarını ihlal eden içerikleri kaldırma ve hesapları askıya alma hakkını saklı tutar.\n\n7. Sorumluluk Sınırlaması\nSopranoChat, kullanıcılar arasındaki etkileşimlerden doğan zararlardan sorumlu tutulamaz.\n\n8. Değişiklikler\nBu koşullar önceden bildirilmeksizin güncellenebilir. Güncellemeler uygulama içinden duyurulur.\n\nİletişim: destek@sopranochat.com',
              [{ text: 'Tamam' }]
            )}>Kullanım Koşulları</Text>{' '}ve{' '}
            <Text style={styles.termsLink} onPress={() => Alert.alert(
              'Gizlilik Politikası',
              'SopranoChat Gizlilik Politikası\n\nSon Güncelleme: 31 Mart 2026\n\n1. Toplanan Veriler\n• Hesap bilgileri: E-posta, telefon numarası, profil adı ve fotoğrafı\n• Kullanım verileri: Oda katılımları, hediye gönderimleri, oturum süreleri\n• Cihaz bilgileri: İşletim sistemi, uygulama sürümü, cihaz modeli\n\n2. Verilerin Kullanımı\n• Hesap yönetimi ve kimlik doğrulama\n• Hizmet kalitesinin iyileştirilmesi\n• Güvenlik ve dolandırıcılık önleme\n• Yasal yükümlülüklerin yerine getirilmesi\n\n3. Veri Paylaşımı\n• Verileriniz üçüncü taraflarla pazarlama amacıyla paylaşılmaz.\n• Yasal zorunluluk halinde yetkili mercilerle paylaşılabilir.\n• Anonim istatistikler hizmet geliştirme amacıyla kullanılabilir.\n\n4. Veri Güvenliği\nVerileriniz SSL/TLS şifreleme ile korunmaktadır. Supabase ve Firebase altyapısı endüstri standardı güvenlik protokollerini kullanır.\n\n5. Çerezler ve Takip\nUygulama, oturum yönetimi için AsyncStorage ve Firebase Auth kullanır. Üçüncü taraf takip araçları kullanılmamaktadır.\n\n6. Kullanıcı Hakları\n• Verilerinize erişim talep edebilirsiniz.\n• Verilerinizin silinmesini isteyebilirsiniz.\n• Hesabınızı kalıcı olarak kapatabilirsiniz.\n\n7. KVKK Uyumu\nTürkiye Cumhuriyeti 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında haklarınız saklıdır.\n\n8. İletişim\nGizlilik ile ilgili sorularınız için: gizlilik@sopranochat.com',
              [{ text: 'Tamam' }]
            )}>Gizlilik Politikası</Text>'nı kabul edersiniz.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07060E' },
  contentContainer: { flexGrow: 1, justifyContent: 'center' },
  content: { paddingHorizontal: 30, paddingVertical: 40 },

  // ANIMATED BACKGROUND ORBS
  meshOrb: { position: 'absolute', width: SCREEN_W * 1.5, height: SCREEN_W * 1.5, borderRadius: SCREEN_W },
  meshTeal: { backgroundColor: '#14B8A6', top: -SCREEN_W * 0.6, left: -SCREEN_W * 0.4, opacity: 0.06 },
  meshPurple: { backgroundColor: '#8B5CF6', bottom: -SCREEN_W * 0.5, right: -SCREEN_W * 0.5, opacity: 0.05 },
  ambientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.45 },

  // LOGO & TITLE
  logoSection: { alignItems: 'center', marginBottom: 28, marginTop: SCREEN_HEIGHT * 0.02 },
  logoCircleContainer: { alignItems: 'center', justifyContent: 'center', width: 160, height: 160, marginBottom: 20 },
  logoPulseRing: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.4)',
  },
  logoGlowRing: {
    position: 'absolute', width: 155, height: 155, borderRadius: 78,
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
  logoCircle: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: '#12142A',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)',
    shadowColor: '#14B8A6', shadowOpacity: 0.3, shadowRadius: 25, elevation: 10,
  },
  logoImage: { width: 110, height: 110 },
  titleMain: { color: '#FFF', fontSize: 30, fontWeight: '700', letterSpacing: 0.5 },
  titleSub: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '500', letterSpacing: 0.5, marginTop: 10 },

  // STAT PILLS
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
  statText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500' },

  // BUTTONS
  buttonsContainer: { width: '100%', gap: 14 },
  glassBtnWrap: { overflow: 'hidden', borderRadius: 28 },
  glassBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 28,
  },

  btnIcon: { position: 'absolute', left: 24 },
  btnText: { color: '#F1F1F1', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },

  // DIVIDER
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '500' },

  // FORM AREA
  formArea: { width: '100%' },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: 0.5 },
  glassInput: {
    height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20, fontSize: 14, color: '#FFF',
    marginBottom: 14, letterSpacing: 0.3,
  },
  otpLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16, textAlign: 'center', letterSpacing: 0.5 },

  // LINK
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 4 },
  linkText: { fontSize: 13, color: '#14B8A6', fontWeight: '600', letterSpacing: 0.3 },

  // TERMS
  terms: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', lineHeight: 20,
    paddingHorizontal: 20, marginTop: 36,
  },
  termsLink: { color: '#14B8A6', fontWeight: '500' },
});
