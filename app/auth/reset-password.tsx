/**
 * SopranoChat — Auth Action Code Ekranı (in-app)
 * ═══════════════════════════════════════════════════════════════════
 * v110.10 (7 May 2026) — Firebase'in 3 mail eyleminin tek noktası:
 *   • mode=resetPassword  → şifre sıfırlama formu
 *   • mode=verifyEmail    → e-posta doğrulama (otomatik applyActionCode)
 *   • mode=recoverEmail   → e-posta kurtarma (otomatik applyActionCode)
 *
 * Akış (resetPassword):
 *   1. Kullanıcı "Şifremi Unuttum" → mail gönderilir (login.tsx)
 *   2. Mail linki: https://sopranochat.com/auth/reset-password?oobCode=XXX&mode=resetPassword
 *      (Universal Link / App Links ile uygulama açılır)
 *   3. Bu ekran oobCode'u verifyPasswordResetCode ile kontrol eder
 *   4. Kullanıcı yeni şifresini girer → confirmPasswordReset → login ekranı
 *
 * Akış (verifyEmail / recoverEmail):
 *   1. Mail linki açılınca applyActionCode çağrılır
 *   2. Başarı: tebrik ekranı → "Devam Et" → tab/home
 *   3. Hata: red ekranı → "Tekrar Dene"
 */
import React, { useState, useEffect } from 'react';
import { i18n } from '../../services/i18n';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../constants/firebase';
import { showToast } from '../../components/Toast';
import { Colors } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import AppLoader from '../../components/AppLoader';

type FlowState =
  | 'verifying'                  // oobCode kontrol ediliyor
  | 'reset_form'                 // resetPassword formu göster
  | 'verify_success'             // verifyEmail / recoverEmail başarılı
  | 'invalid';                   // bağlantı geçersiz / süresi dolmuş

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ oobCode?: string; mode?: string }>();
  const router = useRouter();
  const oobCode = typeof params.oobCode === 'string' ? params.oobCode : undefined;
  const mode = typeof params.mode === 'string' ? params.mode : 'resetPassword';

  const [email, setEmail] = useState('');
  const [flow, setFlow] = useState<FlowState>('verifying');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setFlow('invalid');
      return;
    }

    if (mode === 'resetPassword') {
      // Şifre sıfırlama: kodu doğrula, formu göster
      verifyPasswordResetCode(auth, oobCode)
        .then((emailFromCode) => {
          setEmail(emailFromCode);
          setFlow('reset_form');
        })
        .catch(() => setFlow('invalid'));
      return;
    }

    if (mode === 'verifyEmail' || mode === 'recoverEmail') {
      // E-posta doğrulama / kurtarma: applyActionCode otomatik tamamlar
      applyActionCode(auth, oobCode)
        .then(() => setFlow('verify_success'))
        .catch(() => setFlow('invalid'));
      return;
    }

    // Bilinmeyen mode
    setFlow('invalid');
  }, [oobCode, mode]);

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '', color: 'transparent' };
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-ZÇĞİÖŞÜ]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(newPassword)) score++;
    if (newPassword.length >= 12) score++;
    if (score <= 1) return { score, label: i18n.t('auth.resetpassword.001'), color: '#EF4444' };
    if (score <= 2) return { score, label: 'Orta', color: '#F59E0B' };
    if (score <= 3) return { score, label: i18n.t('auth.resetpassword.002'), color: '#3B82F6' };
    return { score, label: i18n.t('auth.resetpassword.003'), color: '#10B981' };
  })();

  const handleSubmit = async () => {
    if (!oobCode || submitting) return;
    if (newPassword.length < 8) {
      showToast({ title: i18n.t('auth.resetpassword.004'), message: i18n.t('auth.resetpassword.005'), type: 'warning' });
      return;
    }
    if (!/[A-ZÇĞİÖŞÜ]/.test(newPassword)) {
      showToast({ title: i18n.t('auth.resetpassword.006'), message: i18n.t('auth.resetpassword.007'), type: 'warning' });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showToast({ title: 'Rakam Eksik', message: i18n.t('auth.resetpassword.008'), type: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ title: i18n.t('auth.resetpassword.009'), message: i18n.t('auth.resetpassword.010'), type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      showToast({ title: i18n.t('auth.resetpassword.011'), message: i18n.t('auth.resetpassword.012'), type: 'success' });
      router.replace('/(auth)/login');
    } catch (e: any) {
      if (e?.code === 'auth/expired-action-code') {
        showToast({ title: i18n.t('auth.resetpassword.013'), message: i18n.t('auth.resetpassword.014'), type: 'error' });
      } else if (e?.code === 'auth/invalid-action-code') {
        showToast({ title: i18n.t('auth.resetpassword.015'), message: i18n.t('auth.resetpassword.016'), type: 'error' });
      } else if (e?.code === 'auth/weak-password') {
        showToast({ title: i18n.t('auth.resetpassword.017'), message: i18n.t('auth.resetpassword.018'), type: 'warning' });
      } else {
        showToast({ title: 'Hata', message: i18n.t('auth.resetpassword.019'), type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Doğrulanıyor ────────────────────────────
  if (flow === 'verifying') {
    return (
      <AppBackground radialGlow>
        <View style={s.center}>
          <AppLoader size="md" />
          <Text style={s.loadingText}>{i18n.t('auth.resetpassword.001')}</Text>
        </View>
      </AppBackground>
    );
  }

  // ─── E-posta doğrulama/kurtarma BAŞARILI ─────
  if (flow === 'verify_success') {
    const isVerify = mode === 'verifyEmail';
    return (
      <AppBackground radialGlow>
        <View style={s.center}>
          <View style={[s.errorIcon, { borderColor: Colors.accentTeal }]}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.accentTeal} />
          </View>
          <Text style={s.errorTitle}>
            {isVerify ? i18n.t('auto.auth.reset_password.007') : i18n.t('auto.auth.reset_password.006')}
          </Text>
          <Text style={s.errorDesc}>
            {isVerify
              ? i18n.t('auto.auth.reset_password.005')
              : i18n.t('auto.auth.reset_password.004')}
          </Text>
          <Pressable style={s.primaryBtn} onPress={() => router.replace('/(tabs)/home')}>
            <LinearGradient
              colors={[Colors.accentTeal, '#0F766E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.primaryBtnGrad}
            >
              <Text style={s.primaryBtnText}>Devam Et</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  // ─── Geçersiz / süresi dolmuş ────────────────
  if (flow === 'invalid') {
    return (
      <AppBackground radialGlow>
        <View style={s.center}>
          <View style={s.errorIcon}>
            <Ionicons name="alert-circle" size={56} color="#EF4444" />
          </View>
          <Text style={s.errorTitle}>{i18n.t('auth.resetpassword.002')}</Text>
          <Text style={s.errorDesc}>
            {mode === 'verifyEmail'
              ? i18n.t('auto.auth.reset_password.003')
              : mode === 'recoverEmail'
              ? i18n.t('auto.auth.reset_password.002')
              : i18n.t('auto.auth.reset_password.001')}
          </Text>
          <Pressable style={s.primaryBtn} onPress={() => router.replace('/(auth)/login')}>
            <LinearGradient
              colors={[Colors.accentTeal, '#0F766E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.primaryBtnGrad}
            >
              <Text style={s.primaryBtnText}>{i18n.t('auth.resetpassword.003')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  // ─── Şifre değiştirme formu (flow === 'reset_form') ──
  return (
    <AppBackground radialGlow>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.iconWrap}>
            <LinearGradient
              colors={[Colors.accentTeal, '#0F766E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.iconCircle}
            >
              <Ionicons name="lock-open" size={32} color="#FFF" />
            </LinearGradient>
          </View>

          <Text style={s.title}>{i18n.t('auth.resetpassword.004')}</Text>
          <Text style={s.emailText}>{email}</Text>
          <Text style={s.desc}>{i18n.t('auth.resetpassword.005')}</Text>

          {/* Yeni şifre */}
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder={i18n.t('auth.resetpassword.010')}
              placeholderTextColor="#475569"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password-new"
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Güç göstergesi */}
          {newPassword.length > 0 && (
            <View style={s.strengthRow}>
              <View style={s.strengthTrack}>
                <View style={[s.strengthFill, { width: `${Math.min(passwordStrength.score * 25, 100)}%`, backgroundColor: passwordStrength.color }]} />
              </View>
              <Text style={[s.strengthLabel, { color: passwordStrength.color }]}>{passwordStrength.label}</Text>
            </View>
          )}

          {/* Tekrar */}
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder={i18n.t('auth.resetpassword.011')}
              placeholderTextColor="#475569"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowConfirm(!showConfirm)} style={s.eyeBtn} hitSlop={8}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Kurallar */}
          <View style={s.rulesBox}>
            <Text style={s.rulesTitle}>{i18n.t('auth.resetpassword.006')}</Text>
            <View style={s.ruleRow}>
              <Ionicons
                name={newPassword.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={newPassword.length >= 8 ? '#10B981' : '#64748B'}
              />
              <Text style={[s.ruleText, newPassword.length >= 8 && { color: '#10B981' }]}>En az 8 karakter</Text>
            </View>
            <View style={s.ruleRow}>
              <Ionicons
                name={/[A-ZÇĞİÖŞÜ]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={/[A-ZÇĞİÖŞÜ]/.test(newPassword) ? '#10B981' : '#64748B'}
              />
              <Text style={[s.ruleText, /[A-ZÇĞİÖŞÜ]/.test(newPassword) && { color: '#10B981' }]}>{i18n.t('auth.resetpassword.007')}</Text>
            </View>
            <View style={s.ruleRow}>
              <Ionicons
                name={/[0-9]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={/[0-9]/.test(newPassword) ? '#10B981' : '#64748B'}
              />
              <Text style={[s.ruleText, /[0-9]/.test(newPassword) && { color: '#10B981' }]}>1 rakam</Text>
            </View>
          </View>

          <Pressable
            style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <LinearGradient
              colors={[Colors.accentTeal, '#0F766E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.primaryBtnGrad}
            >
              {submitting ? (
                <AppLoader size="sm" />
              ) : (
                <Text style={s.primaryBtnText}>{i18n.t('auth.resetpassword.008')}</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.replace('/(auth)/login')} style={s.cancelBtn}>
            <Text style={s.cancelText}>{i18n.t('auth.resetpassword.009')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#94A3B8',
  },
  errorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F1F5F9',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentTeal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F1F5F9',
    textAlign: 'center',
    marginBottom: 6,
  },
  emailText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentTeal,
    textAlign: 'center',
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 28,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#F1F5F9',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  strengthTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(148,163,184,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 12,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  rulesBox: {
    backgroundColor: 'rgba(15,23,42,0.4)',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  rulesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  ruleText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  primaryBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: Colors.accentTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
