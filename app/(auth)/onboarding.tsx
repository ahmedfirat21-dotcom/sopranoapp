import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Dimensions, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius } from '../../constants/theme';
import { useAuth } from '../_layout';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { showToast } from '../../components/Toast';

const { width, height } = Dimensions.get('window');

import { AVATAR_OPTIONS, getAvatarSource } from '../../constants/avatars';

type Gender = 'male' | 'female' | 'other' | 'unspecified';

export default function OnboardingScreen() {
  const router = useRouter();
  const { firebaseUser, setProfile, setUser } = useAuth();
  
  const [step, setStep] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState(firebaseUser?.photoURL || AVATAR_OPTIONS[0]);
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [gender, setGender] = useState<Gender>('unspecified');
  
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [tempProfile, setTempProfile] = useState<any>(null);

  // Auto focus refs for birth date
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  useEffect(() => {
    // Eger Firebase uzerinde gercekten bir user yoksa, demek ki yanlislikla buraya dustu
    if (!firebaseUser) {
      router.replace('/(auth)/login');
    }
  }, [firebaseUser]);

  const handleNext = () => {
    if (step === 1) {
      if (!displayName.trim()) {
        showToast({ title: 'Hata', message: 'Lütfen geçerli bir isim girin.', type: 'error' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const finalizeOnboarding = () => {
    if (tempProfile) {
      setProfile(tempProfile);
      setUser({ name: tempProfile.display_name, avatar: tempProfile.avatar_url });
    }
  };

  const handeApplyCode = async () => {
    if (!inviteCode || inviteCode.length < 3) {
      showToast({ title: 'Hata', message: 'Lütfen geçerli bir kod girin.', type: 'error' });
      return;
    }
    setSaving(true);
    const result = await ReferralService.applyCode(inviteCode, firebaseUser!.uid);
    setSaving(false);
    if (result.success) {
      showToast({ title: 'Tebrikler!', message: 'SopranoChat topluluğuna hoş geldin! Hesaplarına 50 Coin yüklendi.', type: 'success' });
      finalizeOnboarding();
    } else {
      showToast({ title: 'Hata', message: result.message, type: 'error' });
    }
  };

  const handleSaveProfile = async () => {
    Keyboard.dismiss();

    let bDateStr = '2000-01-01';

    const d = parseInt(day);
    const m = parseInt(month);
    const y = parseInt(year);

    if (!day || !month || !year || isNaN(d) || isNaN(m) || isNaN(y)) {
      showToast({ title: 'Hata', message: 'Lütfen geçerli bir tarih girin.', type: 'error' });
      return;
    }
    
    const birthDate = new Date(y, m - 1, d);
    if (birthDate.getFullYear() !== y || birthDate.getMonth() !== (m - 1) || birthDate.getDate() !== d) {
      showToast({ title: 'Hata', message: 'Geçersiz bir tarih girdiniz.', type: 'error' });
      return;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const mDiff = today.getMonth() - birthDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 13) {
      showToast({ title: 'Kısıtlama', message: 'SopranoChat platformuna katılabilmek için en az 13 yaşında olmalısınız.', type: 'warning' });
      return;
    }

    if (age > 100) {
      showToast({ title: 'Hata', message: 'Geçerli bir doğum yılı giriniz.', type: 'error' });
      return;
    }
    
    bDateStr = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

    if (!firebaseUser) return;
    setSaving(true);

    try {
      const newProfileInfo = {
        id: firebaseUser.uid,
        display_name: displayName.trim() || 'Misafir',
        avatar_url: avatarUrl,
        username: firebaseUser.email ? firebaseUser.email.split('@')[0] : `user_${firebaseUser.uid.substring(0,6)}`,
        gender,
        birth_date: bDateStr,
        is_online: true
      };

      const savedProfile = await ProfileService.create(firebaseUser.uid, newProfileInfo);
      setTempProfile(savedProfile);
      setStep(4);
      
    } catch (error: any) {
      console.error('Onboarding kaydetme hatasi:', error);
      showToast({ title: 'Hata', message: 'Profil oluşturulurken sorun yaşandı.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderStepIndicator = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={[styles.stepDot, step >= 1 && styles.stepActive]} />
        <View style={[styles.stepLine, step >= 2 && styles.lineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepActive]} />
        <View style={[styles.stepLine, step >= 3 && styles.lineActive]} />
        <View style={[styles.stepDot, step >= 3 && styles.stepActive]} />
        <View style={[styles.stepLine, step >= 4 && styles.lineActive]} />
        <View style={[styles.stepDot, step >= 4 && styles.stepActive]} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Background glow effects */}
      <View style={styles.goldGlow1} />
      <View style={styles.goldGlow2} />

      <View style={styles.header}>
        <Text style={styles.title}>Kendinden Bahset</Text>
        <Text style={styles.subtitle}>En iyi deneyim için profili tamamla</Text>
        {renderStepIndicator()}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* ================= STEP 1: AVATAR ================= */}
        {step === 1 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Nasıl Görünmek İstersin?</Text>
            <View style={styles.avatarPreviewWrap}>
              <Image source={getAvatarSource(avatarUrl)} style={styles.avatarPreview} />
              <View style={styles.avatarPreviewRing} />
            </View>

            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((url, i) => (
                <Pressable
                  key={i}
                  style={[styles.avatarOption, avatarUrl === url && styles.avatarOptionSelected]}
                  onPress={() => setAvatarUrl(url)}
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

            <View style={{ marginTop: 32 }}>
              <Text style={styles.dateLabel}>İSMİN VEYA LAKABIN</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: Soprano, John..."
                placeholderTextColor={Colors.text3}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                maxLength={30}
              />
            </View>
          </View>
        )}

        {/* ================= STEP 2: GENDER ================= */}
        {step === 2 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Cinsiyetin Nedir?</Text>
            
            <View style={styles.genderOptions}>
              <Pressable 
                style={[styles.genderCard, gender === 'male' && styles.genderCardActive]}
                onPress={() => setGender('male')}
              >
                <Ionicons name="male" size={28} color={gender === 'male' ? Colors.teal : Colors.text3} />
                <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Erkek</Text>
              </Pressable>

              <Pressable 
                style={[styles.genderCard, gender === 'female' && styles.genderCardActive]}
                onPress={() => setGender('female')}
              >
                <Ionicons name="female" size={28} color={gender === 'female' ? '#ec4899' : Colors.text3} />
                <Text style={[styles.genderText, gender === 'female' && { color: '#ec4899' }]}>Kadın</Text>
              </Pressable>

              <Pressable 
                style={[styles.genderCard, gender === 'other' && styles.genderCardActive]}
                onPress={() => setGender('other')}
              >
                <Ionicons name="male-female" size={28} color={gender === 'other' ? Colors.amber : Colors.text3} />
                <Text style={[styles.genderText, gender === 'other' && { color: Colors.amber }]}>Diğer</Text>
              </Pressable>

              <Pressable 
                style={[styles.genderCard, gender === 'unspecified' && styles.genderCardActive]}
                onPress={() => setGender('unspecified')}
              >
                <Ionicons name="eye-off" size={28} color={gender === 'unspecified' ? Colors.text : Colors.text3} />
                <Text style={[styles.genderText, gender === 'unspecified' && { color: Colors.text }]}>Belirtmek İstemiyorum</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ================= STEP 3: DATE OF BIRTH ================= */}
        {step === 3 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Doğum Tarihin</Text>
            <Text style={styles.stepDesc}>Cana yakın ve güvenli bir ortam için (En az 13 yaşında olmasın).</Text>
            
            <View style={styles.dateInputsWrap}>
              <View style={styles.dateInputBox}>
                <Text style={styles.dateLabel}>GÜN</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="GG"
                  placeholderTextColor={Colors.text3}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={day}
                  onChangeText={(t) => {
                    setDay(t);
                    if (t.length === 2 && monthRef.current) monthRef.current.focus();
                  }}
                />
              </View>

              <Text style={styles.dateSeparator}>/</Text>

              <View style={styles.dateInputBox}>
                <Text style={styles.dateLabel}>AY</Text>
                <TextInput
                  ref={monthRef}
                  style={styles.textInput}
                  placeholder="AA"
                  placeholderTextColor={Colors.text3}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={month}
                  onChangeText={(t) => {
                    setMonth(t);
                    if (t.length === 2 && yearRef.current) yearRef.current.focus();
                  }}
                />
              </View>

              <Text style={styles.dateSeparator}>/</Text>

              <View style={[styles.dateInputBox, { flex: 1.5 }]}>
                <Text style={styles.dateLabel}>YIL</Text>
                <TextInput
                  ref={yearRef}
                  style={styles.textInput}
                  placeholder="YYYY"
                  placeholderTextColor={Colors.text3}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={setYear}
                />
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 4: REFERRAL CODE (INVITE) ================= */}
        {step === 4 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Davet Kodun Var Mı?</Text>
            <Text style={styles.stepDesc}>Arkadaşının davet kodunu girerek hemen 50 Soprano Coin kazan!</Text>
            
            <View style={{ alignItems: 'center', marginTop: 20 }}>
              <TextInput
                style={styles.inviteInput}
                placeholder="Örn: A7F2B9"
                placeholderTextColor={Colors.text3}
                autoCapitalize="characters"
                maxLength={8}
                value={inviteCode}
                onChangeText={setInviteCode}
              />
            </View>
          </View>
        )}

      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        {step > 1 && step < 4 && (
          <Pressable style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
        )}
        
        {step === 4 ? (
          <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
            <Pressable 
              style={[styles.backBtn, { flex: 0.5, marginRight: 0 }]} 
              onPress={finalizeOnboarding}
            >
              <Text style={{ color: Colors.text2, fontSize: 13, fontWeight: '600' }}>Atla</Text>
            </Pressable>
            <Pressable 
              style={[styles.nextBtn, { flex: 1.5 }]} 
              onPress={handeApplyCode}
              disabled={saving}
            >
              <LinearGradient
                colors={Gradients.teal as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.nextBtnInner}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.nextBtnText}>Kodu Uygula</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Pressable 
            style={[styles.nextBtn, step === 1 && { flex: 1 }]} 
            onPress={step === 3 ? handleSaveProfile : handleNext}
            disabled={saving}
          >
            <LinearGradient
              colors={Gradients.teal as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.nextBtnInner}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.nextBtnText}>{step === 3 ? 'Kayıt Ol' : 'Devam Et'}</Text>
              )}
              {!saving && step < 4 && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />}
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  goldGlow1: {
    position: 'absolute', top: 50, right: -50, width: 200, height: 200,
    borderRadius: 100, backgroundColor: 'rgba(20,184,166,0.1)', shadowColor: Colors.teal, shadowOffset: {width: 0, height: 0}, shadowRadius: 30, shadowOpacity: 0.5,
  },
  goldGlow2: {
    position: 'absolute', bottom: -50, left: -50, width: 200, height: 200,
    borderRadius: 100, backgroundColor: 'rgba(251,191,36,0.05)', shadowColor: '#FBBF24', shadowOffset: {width: 0, height: 0}, shadowRadius: 30, shadowOpacity: 0.5,
  },
  header: {
    paddingTop: 80, paddingHorizontal: 24, paddingBottom: 20,
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.text3, marginBottom: 24 },
  
  // Steps Indicator
  stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 140 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.glass3 },
  stepActive: { backgroundColor: Colors.teal, shadowColor: Colors.teal, shadowOffset: {width:0, height:0}, shadowRadius: 6, shadowOpacity: 0.8 },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.glass3, marginHorizontal: 4 },
  lineActive: { backgroundColor: Colors.teal },

  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  stepBlock: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 20, textAlign: 'center' },
  stepDesc: { fontSize: 13, color: Colors.text2, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },

  // Avatar
  avatarPreviewWrap: { alignItems: 'center', marginBottom: 30, position: 'relative' },
  avatarPreview: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: Colors.bg3, zIndex: 2 },
  avatarPreviewRing: { position: 'absolute', top: -4, width: 118, height: 118, borderRadius: 59, borderWidth: 2, borderColor: Colors.teal, opacity: 0.5 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  avatarOption: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: Colors.teal, transform: [{ scale: 1.05 }] },
  avatarOptionImg: { width: '100%', height: '100%', borderRadius: 26 },
  selectedCheck: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.bg },

  // Gender
  genderOptions: { gap: 12 },
  genderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg3, padding: 18, borderRadius: Radius.default, borderWidth: 1, borderColor: Colors.glassBorder },
  genderCardActive: { borderColor: Colors.teal, backgroundColor: 'rgba(20,184,166,0.08)' },
  genderText: { fontSize: 16, fontWeight: '600', color: Colors.text, marginLeft: 16 },
  genderTextActive: { color: Colors.teal },

  // DOB
  dateInputsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  dateInputBox: { flex: 1 },
  dateLabel: { fontSize: 11, fontWeight: '700', color: Colors.text3, marginBottom: 8, textAlign: 'center' },
  textInput: { height: 58, backgroundColor: Colors.bg3, borderRadius: Radius.default, borderWidth: 1, borderColor: Colors.glassBorder, fontSize: 18, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  dateSeparator: { fontSize: 24, fontWeight: '300', color: Colors.text3, marginTop: 24 },

  inviteInput: { width: '80%', height: 60, backgroundColor: Colors.bg3, borderRadius: Radius.default, borderWidth: 2, borderColor: Colors.glassBorder, fontSize: 24, fontWeight: '800', color: Colors.text, textAlign: 'center', letterSpacing: 4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, paddingTop: 10, backgroundColor: 'rgba(10,12,16,0.9)', borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  backBtn: { width: 56, height: 56, borderRadius: Radius.default, backgroundColor: Colors.bg3, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.glassBorder, marginRight: 12 },
  nextBtn: { flex: 1, height: 56 },
  nextBtnInner: { flex: 1, flexDirection: 'row', borderRadius: Radius.default, justifyContent: 'center', alignItems: 'center' },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
