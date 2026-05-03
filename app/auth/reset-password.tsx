/**
 * SopranoChat — Şifre Sıfırlama Ekranı (in-app)
 * ═══════════════════════════════════════════════════════════════════
 * v107.46 (2 May 2026) — Firebase'in default hosted sayfasını ezip uygulama
 * içinde profesyonel reset deneyimi. Email link kullanıcıyı buraya getirir.
 *
 * Akış:
 *   1. Kullanıcı "Şifremi Unuttum" → mail gönderilir (login.tsx)
 *   2. Mail linki: https://sopranochat.com/auth/reset-password?oobCode=XXX&mode=resetPassword
 *      (Universal Link / App Links ile uygulama açılır)
 *   3. Bu ekran oobCode'u verifyPasswordResetCode ile kontrol eder
 *   4. Kullanıcı yeni şifresini girer → confirmPasswordReset
 *   5. Login ekranına döner
 *
 * NOT: App Links autoVerify çalışması için sopranochat.com/.well-known/assetlinks.json
 * yüklenmiş olmalı (bir defalık DNS işi). Yoksa link tarayıcıda açılır.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../constants/firebase';
import { showToast } from '../../components/Toast';
import { Colors } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import AppLoader from '../../components/AppLoader';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ oobCode?: string; mode?: string }>();
  const router = useRouter();
  const oobCode = typeof params.oobCode === 'string' ? params.oobCode : undefined;
  const mode = typeof params.mode === 'string' ? params.mode : 'resetPassword';

  const [email, setEmail] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [validCode, setValidCode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!oobCode || mode !== 'resetPassword') {
      setValidCode(false);
      setVerifying(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((emailFromCode) => {
        setEmail(emailFromCode);
        setValidCode(true);
      })
      .catch(() => setValidCode(false))
      .finally(() => setVerifying(false));
  }, [oobCode, mode]);

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '', color: 'transparent' };
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-ZÇĞİÖŞÜ]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(newPassword)) score++;
    if (newPassword.length >= 12) score++;
    if (score <= 1) return { score, label: 'Zayıf', color: '#EF4444' };
    if (score <= 2) return { score, label: 'Orta', color: '#F59E0B' };
    if (score <= 3) return { score, label: 'İyi', color: '#3B82F6' };
    return { score, label: 'Güçlü', color: '#10B981' };
  })();

  const handleSubmit = async () => {
    if (!oobCode || submitting) return;
    if (newPassword.length < 8) {
      showToast({ title: 'Şifre Çok Kısa', message: 'En az 8 karakter olmalı.', type: 'warning' });
      return;
    }
    if (!/[A-ZÇĞİÖŞÜ]/.test(newPassword)) {
      showToast({ title: 'Büyük Harf Eksik', message: 'Şifrede en az 1 büyük harf olmalı.', type: 'warning' });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showToast({ title: 'Rakam Eksik', message: 'Şifrede en az 1 rakam olmalı.', type: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ title: 'Şifreler Eşleşmiyor', message: 'İki alan da aynı olmalı.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      showToast({ title: '✅ Şifre Değiştirildi', message: 'Yeni şifrenle giriş yapabilirsin.', type: 'success' });
      router.replace('/(auth)/login');
    } catch (e: any) {
      if (e?.code === 'auth/expired-action-code') {
        showToast({ title: 'Bağlantı Süresi Doldu', message: 'Yeni bir sıfırlama maili iste.', type: 'error' });
      } else if (e?.code === 'auth/invalid-action-code') {
        showToast({ title: 'Geçersiz Bağlantı', message: 'Bu link kullanılmış veya geçersiz.', type: 'error' });
      } else if (e?.code === 'auth/weak-password') {
        showToast({ title: 'Şifre Zayıf', message: 'Daha güçlü bir şifre seç.', type: 'warning' });
      } else {
        showToast({ title: 'Hata', message: 'Şifre değiştirilemedi, tekrar dene.', type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Doğrulanıyor ────────────────────────────
  if (verifying) {
    return (
      <AppBackground radialGlow>
        <View style={s.center}>
          <AppLoader size="md" />
          <Text style={s.loadingText}>Bağlantı doğrulanıyor...</Text>
        </View>
      </AppBackground>
    );
  }

  // ─── Geçersiz / süresi dolmuş ────────────────
  if (!validCode) {
    return (
      <AppBackground radialGlow>
        <View style={s.center}>
          <View style={s.errorIcon}>
            <Ionicons name="alert-circle" size={56} color="#EF4444" />
          </View>
          <Text style={s.errorTitle}>Bağlantı Geçersiz</Text>
          <Text style={s.errorDesc}>
            Bu şifre sıfırlama bağlantısı süresi dolmuş ya da daha önce kullanılmış.
            {'\n\n'}
            Lütfen giriş ekranından yeni bir sıfırlama maili iste.
          </Text>
          <Pressable style={s.primaryBtn} onPress={() => router.replace('/(auth)/login')}>
            <LinearGradient
              colors={[Colors.accentTeal, '#0F766E']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.primaryBtnGrad}
            >
              <Text style={s.primaryBtnText}>Giriş Ekranına Dön</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  // ─── Şifre değiştirme formu ──────────────────
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

          <Text style={s.title}>Şifreni Sıfırla</Text>
          <Text style={s.emailText}>{email}</Text>
          <Text style={s.desc}>Hesabın için yeni bir şifre belirle</Text>

          {/* Yeni şifre */}
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748B" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Yeni şifre"
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
              placeholder="Şifre (Tekrar)"
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
            <Text style={s.rulesTitle}>Şifre kuralları:</Text>
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
              <Text style={[s.ruleText, /[A-ZÇĞİÖŞÜ]/.test(newPassword) && { color: '#10B981' }]}>1 büyük harf</Text>
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
                <Text style={s.primaryBtnText}>Şifreyi Değiştir</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.replace('/(auth)/login')} style={s.cancelBtn}>
            <Text style={s.cancelText}>İptal et</Text>
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
