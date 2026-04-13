import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius } from '../../constants/theme';
import { useAuth } from '../_layout';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { showToast } from '../../components/Toast';
import { supabase } from '../../constants/supabase';

const { width, height } = Dimensions.get('window');

import { AVATAR_OPTIONS, getAvatarSource } from '../../constants/avatars';

export default function OnboardingScreen() {
  const router = useRouter();
  const { firebaseUser, setProfile, setUser } = useAuth();
  
  // ═══ 3 adım: Profil → İlgi Alanları → Davet Kodu ═══
  const [step, setStep] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState(firebaseUser?.photoURL || AVATAR_OPTIONS[0]);
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [interests, setInterests] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [tempProfile, setTempProfile] = useState<any>(null);

  const INTEREST_OPTIONS = [
    { id: 'chat', label: 'Sohbet', icon: 'chatbubbles', color: '#14B8A6' },
    { id: 'music', label: 'Müzik', icon: 'musical-notes', color: '#8B5CF6' },
    { id: 'game', label: 'Oyun', icon: 'game-controller', color: '#EF4444' },
    { id: 'tech', label: 'Teknoloji', icon: 'code-slash', color: '#3B82F6' },
    { id: 'book', label: 'Kitap', icon: 'book', color: '#F59E0B' },
    { id: 'film', label: 'Film', icon: 'film', color: '#EC4899' },
  ];

  useEffect(() => {
    if (!firebaseUser) {
      router.replace('/(auth)/login');
    }
  }, [firebaseUser]);

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
      showToast({ title: 'Tebrikler!', message: 'Topluluğa hoş geldin! Hesabına 50 SP yüklendi.', type: 'success' });
      finalizeOnboarding();
    } else {
      showToast({ title: 'Hata', message: result.message, type: 'error' });
    }
  };

  const handleSaveProfile = async () => {
    Keyboard.dismiss();

    if (!displayName.trim()) {
      showToast({ title: 'Hata', message: 'Lütfen bir isim veya lakap gir.', type: 'error' });
      return;
    }

    if (!firebaseUser) return;
    setSaving(true);

    try {
      const baseUsername = (firebaseUser.email ? firebaseUser.email.split('@')[0] : `user_${firebaseUser.uid.substring(0,6)}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
      const username = `${baseUsername}_${firebaseUser.uid.substring(0, 4)}`;

      // Temel alanlar — her fazda gönderilmeli (DB constraint'leri karşılamak için)
      // NOT: Eski 'tier' kolonu da gönderilmeli — profiles_tier_check constraint'i NULL kabul etmiyor
      const baseData = {
        id: firebaseUser.uid,
        display_name: displayName.trim() || 'Misafir',
        avatar_url: avatarUrl,
        username,
        is_online: true,
        tier: 'free',
        subscription_tier: 'Free',
        system_points: 0,
      };

      // Faz 1: Tüm alanlarla dene (gender + birth_date dahil)
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          { ...baseData, gender: 'unspecified', birth_date: '2000-01-01' },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (!error && data) {
        setTempProfile(data);
        setStep(2);
        return;
      }

      // Faz 2: gender/birth_date kolonu yoksa sadece temel alanlarla yeniden dene
      if (__DEV__) console.warn('[Onboarding] Faz 1 hata:', error?.message, error?.code);

      const { data: data2, error: error2 } = await supabase
        .from('profiles')
        .upsert(baseData, { onConflict: 'id' })
        .select()
        .single();

      if (error2) {
        console.error('[Onboarding] Faz 2 de başarısız:', error2.message, error2.code, error2.details);
        throw error2;
      }

      setTempProfile(data2);
      setStep(2);
      
    } catch (error: any) {
      console.error('Onboarding kaydetme hatasi:', error?.message || error, error?.code, error?.details);
      showToast({ title: 'Hata', message: error?.message || 'Profil oluşturulurken sorun yaşandı.', type: 'error' });
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
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Background glow effects */}
      <View style={styles.goldGlow1} />
      <View style={styles.goldGlow2} />

      <View style={styles.header}>
        <Text style={styles.title}>
          {step === 1 ? 'Hızlıca Başla 🎙️' : step === 2 ? 'Nelerden Hoşlanırsın? 🎯' : 'Son Adım!'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 1
            ? 'Sesli sohbet dünyasına katılmak için sadece ismini ve avatarını seç'
            : step === 2
            ? 'İlgi alanlarını seç — sana uygun odaları önerelim'
            : 'Davet kodun varsa hemen ödülünü al'}
        </Text>
        {renderStepIndicator()}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* ================= STEP 1: AVATAR + İSİM (TEK ADIM) ================= */}
        {step === 1 && (
          <View style={styles.stepBlock}>
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

            <View style={{ marginTop: 28 }}>
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

            {/* Platformun ne olduğunu anlatan mini banner */}
            <View style={styles.valueBanner}>
              <View style={styles.valueBannerRow}>
                <Ionicons name="mic" size={16} color={Colors.teal} />
                <Text style={styles.valueBannerText}>Canlı sesli odalar kur & keşfet</Text>
              </View>
              <View style={styles.valueBannerRow}>
                <Ionicons name="people" size={16} color={Colors.teal} />
                <Text style={styles.valueBannerText}>Yeni insanlarla tanış & konuş</Text>
              </View>
              <View style={styles.valueBannerRow}>
                <Ionicons name="trophy" size={16} color="#FBBF24" />
                <Text style={styles.valueBannerText}>SP kazan, rozetler topla, yüksel</Text>
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 2: İLGİ ALANLARI ================= */}
        {step === 2 && (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Neler ilgini çekiyor?</Text>
            <Text style={styles.stepDesc}>En az 1 seç — sana özel odalar önerelim</Text>
            <View style={styles.interestGrid}>
              {INTEREST_OPTIONS.map((item) => {
                const selected = interests.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    style={[styles.interestChip, selected && { backgroundColor: item.color, borderColor: item.color }]}
                    onPress={() => {
                      if (selected) {
                        setInterests(interests.filter(i => i !== item.id));
                      } else {
                        setInterests([...interests, item.id]);
                      }
                    }}
                  >
                    <Ionicons name={item.icon as any} size={22} color={selected ? '#FFF' : '#94A3B8'} />
                    <Text style={[styles.interestLabel, selected && { color: '#FFF' }]}>{item.label}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.8)" />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ================= STEP 3: REFERRAL CODE (INVITE) ================= */}
        {step === 3 && (
          <View style={styles.stepBlock}>
            <View style={styles.celebrationWrap}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <Text style={styles.stepTitle}>Profilin Hazır!</Text>
              <Text style={styles.stepDesc}>Bir arkadaşının davet kodu varsa girerek 50 SP kazan!</Text>
            </View>
            
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
        {step === 3 ? (
          <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>
            <Pressable 
              style={[styles.skipBtn, { flex: 0.7 }]} 
              onPress={finalizeOnboarding}
            >
              <Text style={styles.skipBtnText}>Atla, Keşfetmeye Başla</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.text2} />
            </Pressable>
            <Pressable 
              style={[styles.nextBtn, { flex: 1 }]} 
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
        ) : step === 2 ? (
          <Pressable 
            style={[styles.nextBtn, { flex: 1, opacity: interests.length === 0 ? 0.4 : 1 }]} 
            onPress={() => {
              if (interests.length === 0) {
                showToast({ title: 'Seçim Yap', message: 'En az 1 ilgi alanı seç', type: 'warning' });
                return;
              }
              // İlgi alanlarını profile'a kaydet (sütun yoksa metadata'ya)
              if (tempProfile) {
                (async () => {
                  const { error } = await supabase.from('profiles').update({ interests }).eq('id', firebaseUser!.uid);
                  if (error) {
                    // Sütun yoksa room_settings benzeri metadata alanına yaz
                    const res = await supabase.from('profiles').update({ 
                      metadata: { ...(tempProfile as any).metadata, interests } 
                    }).eq('id', firebaseUser!.uid);
                  }
                })();
              }
              setStep(3);
            }}
          >
            <LinearGradient
              colors={Gradients.teal as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.nextBtnInner}
            >
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.nextBtnText}>Devam</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable 
            style={[styles.nextBtn, { flex: 1 }]} 
            onPress={handleSaveProfile}
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
                <>
                  <Ionicons name="headset" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.nextBtnText}>Keşfetmeye Başla</Text>
                </>
              )}
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
    paddingTop: 80, paddingHorizontal: 24, paddingBottom: 16,
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: 13, color: Colors.text3, marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 },
  
  // Steps Indicator — 3 nokta (profil → ilgi alanları → davet kodu)
  stepContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 80 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.glass3 },
  stepActive: { backgroundColor: Colors.teal, shadowColor: Colors.teal, shadowOffset: {width:0, height:0}, shadowRadius: 6, shadowOpacity: 0.8 },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.glass3, marginHorizontal: 4 },
  lineActive: { backgroundColor: Colors.teal },

  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },
  stepBlock: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  stepDesc: { fontSize: 13, color: Colors.text2, textAlign: 'center', marginBottom: 10, paddingHorizontal: 20 },

  // Avatar
  avatarPreviewWrap: { alignItems: 'center', marginBottom: 24, position: 'relative' },
  avatarPreview: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: Colors.bg3, zIndex: 2 },
  avatarPreviewRing: { position: 'absolute', top: -4, width: 108, height: 108, borderRadius: 54, borderWidth: 2, borderColor: Colors.teal, opacity: 0.5 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  avatarOption: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: Colors.teal, transform: [{ scale: 1.05 }] },
  avatarOptionImg: { width: '100%', height: '100%', borderRadius: 24 },
  selectedCheck: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.bg },

  // Value Banner — platformun ne yaptığını anlatan mini alan
  valueBanner: {
    marginTop: 24,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderRadius: Radius.default,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  valueBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  valueBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text2,
  },

  // Interest Selection (Step 2)
  interestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
    justifyContent: 'center',
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: '45%',
  },
  interestLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
    flex: 1,
  },

  // Celebration (Step 3)
  celebrationWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  celebrationEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },

  // DOB / Labels
  dateLabel: { fontSize: 11, fontWeight: '700', color: Colors.text3, marginBottom: 8, textAlign: 'center' },
  textInput: { height: 58, backgroundColor: Colors.bg3, borderRadius: Radius.default, borderWidth: 1, borderColor: Colors.glassBorder, fontSize: 18, fontWeight: '600', color: Colors.text, textAlign: 'center' },

  inviteInput: { width: '80%', height: 60, backgroundColor: Colors.bg3, borderRadius: Radius.default, borderWidth: 2, borderColor: Colors.glassBorder, fontSize: 24, fontWeight: '800', color: Colors.text, textAlign: 'center', letterSpacing: 4 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, paddingTop: 10, backgroundColor: 'rgba(10,12,16,0.9)', borderTopWidth: 1, borderTopColor: Colors.glassBorder },
  skipBtn: { 
    height: 56, borderRadius: Radius.default, backgroundColor: Colors.bg3, 
    justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1, borderColor: Colors.glassBorder,
    flexDirection: 'row', gap: 6,
  },
  skipBtnText: { color: Colors.text2, fontSize: 12, fontWeight: '600' },
  nextBtn: { flex: 1, height: 56 },
  nextBtnInner: { flex: 1, flexDirection: 'row', borderRadius: Radius.default, justifyContent: 'center', alignItems: 'center' },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
