import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, Dimensions, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Keyboard, ImageBackground, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius, Shadows } from '../../constants/theme';
import { useAuth } from '../_layout';
import { ReferralService } from '../../services/referral';
import { ProfileService } from '../../services/database';
import { StorageService } from '../../services/storage';
import { showToast } from '../../components/Toast';
import { supabase } from '../../constants/supabase';
import * as ImagePicker from 'expo-image-picker';
import { containsBadWords } from '../../constants/badwords';

const { width: W, height: H } = Dimensions.get('window');

import { AVATAR_OPTIONS, getAvatarSource } from '../../constants/avatars';

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { firebaseUser, setProfile, setUser, refreshProfile, setJustCompletedOnboarding } = useAuth();
  
  // ═══ Step 1: Avatar+İsim  |  Step 2: Cinsiyet+Yaş  |  Step 3: İlgi Alanları  |  Step 4: Davet Kodu ═══
  const [step, setStep] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState(firebaseUser?.photoURL || AVATAR_OPTIONS[0]);
  const [isCustomAvatar, setIsCustomAvatar] = useState(false);
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>('unspecified');
  const [birthYear, setBirthYear] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tempProfile, setTempProfile] = useState<any>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const GENDER_OPTIONS = [
    { id: 'male' as const, label: 'Erkek', icon: 'male' as const, color: '#3B82F6' },
    { id: 'female' as const, label: 'Kadın', icon: 'female' as const, color: '#EC4899' },
    { id: 'unspecified' as const, label: 'Belirtmiyorum', icon: 'person-outline' as const, color: '#64748B' },
  ];

  const INTEREST_OPTIONS = [
    { id: 'chat', label: 'Sohbet', icon: 'chatbubbles', color: '#14B8A6', emoji: '💬' },
    { id: 'music', label: 'Müzik', icon: 'musical-notes', color: '#8B5CF6', emoji: '🎵' },
    { id: 'game', label: 'Oyun', icon: 'game-controller', color: '#EF4444', emoji: '🎮' },
    { id: 'tech', label: 'Teknoloji', icon: 'code-slash', color: '#3B82F6', emoji: '💻' },
    { id: 'book', label: 'Kitap', icon: 'book', color: '#F59E0B', emoji: '📚' },
    { id: 'film', label: 'Film & Dizi', icon: 'film', color: '#EC4899', emoji: '🎬' },
    { id: 'sport', label: 'Spor', icon: 'football', color: '#10B981', emoji: '⚽' },
    { id: 'art', label: 'Sanat', icon: 'color-palette', color: '#F97316', emoji: '🎨' },
  ];

  useEffect(() => {
    if (!firebaseUser) {
      router.replace('/(auth)/login');
      return;
    }
    // ★ 2026-04-21 FIX v2: Auto-skip mantığı KALDIRILDI. Eski profile verisi
    // (silinmiş hesap kalıntısı vs.) yüzünden Step 3/4 atlanıyordu. Artık form
    // alanları pre-fill edilir ama Step 1'den başlanır — kullanıcı tüm 4 adımı görür.
    (async () => {
      try {
        const { data: existing } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, gender, birth_date, interests, preferences')
          .eq('id', firebaseUser.uid)
          .maybeSingle();
        if (!existing) return;

        // Pre-fill form state'leri — her adımda hızlı tamamlama için
        setTempProfile(existing);
        if (existing.display_name) setDisplayName(existing.display_name);
        if (existing.avatar_url) setAvatarUrl(existing.avatar_url);
        if (existing.gender && existing.gender !== 'unspecified') setGender(existing.gender);
        if (existing.birth_date) {
          const year = existing.birth_date.split('-')[0];
          if (year) setBirthYear(year);
        }
        if (existing.interests?.length) setInterests(existing.interests);
        // Step her zaman 1'den başlar — auto-jump yok
      } catch {
        // Sessizce geç — Step 1'den başla
      }
    })();
  }, [firebaseUser]);

  const animateStep = (nextStep: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  // ★ UX-OB: Geri adım — bir önceki step'e dön
  const goBack = () => {
    if (step > 1) animateStep(step - 1);
  };

  const finalizeOnboarding = async () => {
    // ★ FIX-OB 2026-04-18: Race condition fix — önceki versiyonda setProfile sonrası
    // hemen router.replace('/(tabs)/home') çağrılıyordu; AuthGuard useEffect segments
    // yeni (tabs) ama profile eski (onboarding_completed=false) görüp "Atla" sonrası
    // kullanıcıyı onboarding'e geri sarıyordu. Düzeltme: profile güncellenmeden önce
    // DB write'ı garantile, sonra setProfile'ı YENİ onboarding_completed=true ile
    // yap, SONRA router.replace. Race'i kapatmak için setTimeout süresi 300ms'e çıkardı.
    if (firebaseUser) {
      try {
        // 1. Güncel profili çek
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', firebaseUser.uid)
          .single();

        const currentPrefs = (currentProfile as any)?.preferences || {};
        const needsFlagWrite = !currentPrefs.onboarding_completed;
        const mergedPrefs = {
          ...currentPrefs,
          onboarding_completed: true,
          onboarding_date: currentPrefs.onboarding_date || new Date().toISOString(),
        };

        if (needsFlagWrite) {
          // ★ 2026-04-22 FIX: Error check — preferences kolonu eksikse veya başka
          //   DB hatası olursa kullanıcıya bildir, home'a yönlendirme YAPMA.
          //   Eski versiyon error'u sessizce yutuyordu → uygulamadan çıkınca
          //   flag olmadığı için tekrar onboarding açılıyordu.
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ preferences: mergedPrefs })
            .eq('id', firebaseUser.uid);
          if (updErr) {
            if (__DEV__) console.warn('[Onboarding] preferences update hata:', updErr.message);
            showToast({
              title: 'Kaydedilemedi',
              message: 'Onboarding tamamlanamadı — DB hatası. Tekrar deneyin.',
              type: 'error',
            });
            return; // router.replace tetiklenmesin → kullanıcı onboarding'de kalsın
          }
        }

        // 2. Context'e set et — hem freshProfile'ı hem de guaranteed onboarding flag'i
        const profileToSet = {
          ...(currentProfile || tempProfile || {}),
          preferences: mergedPrefs,
        } as any;

        if (profileToSet.id && profileToSet.display_name) {
          setProfile(profileToSet);
          setUser({ name: profileToSet.display_name, avatar: profileToSet.avatar_url });
        }
      } catch (err) {
        if (__DEV__) console.warn('[Onboarding] finalizeOnboarding hata:', err);
        // ★ 2026-04-22 FIX: Hata durumunda artık sessizce devam etmiyoruz — flag DB'ye
        //   yazılmadığı için home'a atsak bile AuthGuard bir sonraki açılışta
        //   tekrar onboarding'e yollayacak. Kullanıcıyı uyar, onboarding'de tut.
        showToast({
          title: 'Bağlantı Hatası',
          message: 'Onboarding kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.',
          type: 'error',
        });
        return;
      }
    }
    // ★ 2026-04-22: Intro sheet'i garantili tetikle — home.tsx bu flag'i izliyor.
    //   AsyncStorage'a bağımlı değil → ilk home mount'unda kesin görünür.
    setJustCompletedOnboarding(true);

    // 3. AuthGuard zaten profile değişimini yakalayıp hasCompleteProfile=true → home'a
    //    yönlendirir. Yine de manuel replace ekliyoruz ki yavaş dep propagate olsa da
    //    geçiş anında takılma olmasın. 300ms = React render + Supabase fetch tamponu.
    setTimeout(() => {
      router.replace('/(tabs)/home');
    }, 300);
  };

  const handeApplyCode = async () => {
    if (!inviteCode || inviteCode.length < 3) {
      showToast({ title: 'Hata', message: 'Lütfen geçerli bir kod girin.', type: 'error' });
      return;
    }
    setSaving(true);
    // ★ SEC-REF: Onboarding'den gelen referral — isOnboarding flag'i ile 24h kuralını bypass et
    const result = await ReferralService.applyCode(inviteCode, firebaseUser!.uid, true);
    setSaving(false);
    if (result.success) {
      showToast({ title: 'Tebrikler!', message: 'Topluluğa hoş geldin! Hesabına 50 SP yüklendi.', type: 'success' });
      finalizeOnboarding();
    } else {
      showToast({ title: 'Hata', message: result.message, type: 'error' });
    }
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (!firebaseUser) return;
        setUploading(true);
        try {
          const publicUrl = await StorageService.uploadAvatar(firebaseUser.uid, uri);
          setAvatarUrl(publicUrl);
          setIsCustomAvatar(true);
          showToast({ title: 'Başarılı', message: 'Profil fotoğrafın yüklendi!', type: 'success' });
        } catch {
          setAvatarUrl(uri);
          setIsCustomAvatar(true);
        } finally {
          setUploading(false);
        }
      }
    } catch {}
  };

  const handleSaveProfile = async () => {
    Keyboard.dismiss();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      showToast({ title: 'Hata', message: 'Lütfen bir isim veya lakap gir.', type: 'error' });
      return;
    }
    // ★ SEC-OB1: Min 2 karakter kontrolü
    if (trimmedName.length < 2) {
      showToast({ title: 'Hata', message: 'İsim en az 2 karakter olmalıdır.', type: 'error' });
      return;
    }
    // ★ SEC-OB2: Küfür / hakaret filtresi
    if (containsBadWords(trimmedName)) {
      showToast({ title: 'Uygunsuz İsim', message: 'Lütfen uygun bir isim seçin.', type: 'error' });
      return;
    }
    // ★ SEC-OB4: Unicode sanitizasyonu — sıfır genişlikli karakterler, RTL override, aşırı emoji
    const sanitizedName = trimmedName
      .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '') // Zero-width chars
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, '');    // RTL/LTR override
    if (sanitizedName.length < 2) {
      showToast({ title: 'Hata', message: 'İsim geçerli karakterler içermelidir.', type: 'error' });
      return;
    }
    // ★ SEC-OB5: Aşırı emoji kontrolü (10'dan fazla emoji = spam)
    const emojiCount = (sanitizedName.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
    if (emojiCount > 10) {
      showToast({ title: 'Hata', message: 'En fazla 10 emoji kullanabilirsiniz.', type: 'error' });
      return;
    }
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const baseUsername = (firebaseUser.email ? firebaseUser.email.split('@')[0] : `user_${firebaseUser.uid.substring(0,6)}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
      const username = `${baseUsername}_${firebaseUser.uid.substring(0, 4)}`;
      const baseData = {
        id: firebaseUser.uid,
        display_name: sanitizedName || 'Misafir',
        avatar_url: avatarUrl,
        username,
        is_online: true,
        tier: 'free',
        subscription_tier: 'Free',
        system_points: 0,
        gender: 'unspecified' as const,
        // ★ 2026-04-18 FIX: birth_date null — Step 2'de zorunlu olarak girilir.
        // Önceki default '2000-01-01' idi ve Step 2 tamamlanmasa bile user 26
        // yaşında görünüyordu → +18 oda filtresi hiç tetiklenmiyordu.
        birth_date: null,
      };

      // Step 1 isim + avatar + varsayılan cinsiyet/yaş kaydeder
      const { data, error } = await supabase
        .from('profiles')
        .upsert(baseData, { onConflict: 'id' })
        .select().single();
      if (!error && data) { setTempProfile(data); animateStep(2); return; }
      if (__DEV__) console.warn('[Onboarding] Faz 1 hata:', error?.message);
      // ★ FIX: Fallback kaldırıldı — hata varsa kullanıcıya bildir
      throw new Error(error?.message || 'Profil oluşturulamadı.');
    } catch (error: any) {
      showToast({ title: 'Hata', message: error?.message || 'Profil oluşturulurken sorun yaşandı.', type: 'error' });
    } finally { setSaving(false); }
  };

  const handleSaveGenderAge = async () => {
    // ★ Yaş zorunlu — boş bırakılamaz
    if (!birthYear || birthYear.length < 4) {
      showToast({ title: 'Zorunlu Alan', message: 'Lütfen doğum yılınızı girin.', type: 'error' });
      return;
    }
    const y = parseInt(birthYear, 10);
    const cur = new Date().getFullYear();
    if (isNaN(y) || y < 1920 || y > cur - 13) {
      showToast({ title: 'Hata', message: 'En az 13 yaşında olmalısınız.', type: 'error' });
      return;
    }
    // Gender + birth date güncelle
    if (firebaseUser) {
      const birthDate = `${birthYear}-01-01`;
      try {
        await supabase.from('profiles').update({ gender, birth_date: birthDate }).eq('id', firebaseUser.uid);
      } catch (e: any) {
        // ★ SEC-OB3: Hata sessizce yutulmasın — kullanıcıya bildir
        if (__DEV__) console.warn('[Onboarding] Step 2 DB hatası:', e?.message);
        showToast({ title: 'Uyarı', message: 'Bilgiler kaydedilemedi, daha sonra güncelleyebilirsin.', type: 'warning' });
      }
    }
    animateStep(3);
  };

  const handleSaveInterests = async () => {
    if (interests.length === 0) {
      showToast({ title: 'Seçim Yap', message: 'En az 1 ilgi alanı seç', type: 'warning' });
      return;
    }
    if (tempProfile && firebaseUser) {
      // ★ FIX-OB3 2026-04-21: onboarding_completed flag'ini burada YAZMA — Step 4 (davet kodu)
      // henüz gelmedi. Flag yalnızca finalizeOnboarding() içinde yazılır.
      const preferences = {
        ...(tempProfile as any).preferences,
        interests,
      };
      const { error } = await supabase.from('profiles').update({ interests, preferences }).eq('id', firebaseUser.uid);
      if (error) {
        // ★ 2026-04-22 FIX: Fallback + error surfacing. Eski kod fallback hatası sessizce
        //   yutuyordu → kullanıcı Step 4'e geçiyor, sonra finalizeOnboarding da başarısız
        //   olunca bug görünmez kalıyordu.
        const { error: prefErr } = await supabase.from('profiles').update({ preferences }).eq('id', firebaseUser.uid);
        if (prefErr) {
          if (__DEV__) console.warn('[Onboarding] Step 3 interests update hata:', error.message, prefErr.message);
          showToast({
            title: 'Kaydedilemedi',
            message: 'İlgi alanları yazılamadı. İnternet / DB sorunu olabilir.',
            type: 'error',
          });
          return; // Step 4'e geçme — kullanıcı tekrar denesin
        }
      }
    }
    animateStep(4);
  };

  // ═══════════════════════ RENDER ═══════════════════════
  return (
    <ImageBackground
      source={require('../../assets/images/app_bg.jpg')}
      style={s.root}
      resizeMode="cover"
    >
      {/* Vignette */}
      <LinearGradient
        colors={['rgba(15,25,38,0.55)', 'transparent', 'transparent', 'rgba(15,25,38,0.65)']}
        locations={[0, 0.2, 0.75, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={s.flex} behavior={'padding'}>
        {/* ═══ Top: Progress Bar + Geri Butonu ═══ */}
        <View style={s.topBar}>
          {step > 1 ? (
            <Pressable onPress={goBack} style={s.topBackBtn}>
              <Ionicons name="arrow-back" size={18} color="#F1F5F9" />
            </Pressable>
          ) : (
            <View style={{ width: 34 }} />
          )}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
          </View>
          <Text style={s.stepLabel}>
            {step}/{TOTAL_STEPS}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* =================== STEP 1: AVATAR + İSİM =================== */}
            {step === 1 && (
              <View style={s.stepContainer}>
                <Text style={s.heading}>Merhaba! 👋</Text>
                <Text style={s.desc}>Sesli sohbet dünyasına katıl. Fotoğrafını ve ismini ayarla.</Text>

                {/* Big Avatar */}
                <Pressable style={s.bigAvatarWrap} onPress={handlePickPhoto}>
                  {uploading ? (
                    <View style={[s.bigAvatar, { justifyContent: 'center', alignItems: 'center' }]}>
                      <ActivityIndicator size="large" color={Colors.teal} />
                    </View>
                  ) : (
                    <Image
                      source={isCustomAvatar ? { uri: avatarUrl } : getAvatarSource(avatarUrl)}
                      style={s.bigAvatar}
                    />
                  )}
                  <View style={s.cameraBadge}>
                    <Ionicons name="camera" size={18} color="#FFF" />
                  </View>
                </Pressable>

                {/* Avatar strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.avatarStrip} contentContainerStyle={s.avatarStripContent}>
                  {AVATAR_OPTIONS.map((url, i) => {
                    const sel = avatarUrl === url && !isCustomAvatar;
                    return (
                      <Pressable
                        key={i}
                        style={[s.stripAvatar, sel && s.stripAvatarActive]}
                        onPress={() => { setAvatarUrl(url); setIsCustomAvatar(false); }}
                      >
                        <Image source={getAvatarSource(url)} style={s.stripAvatarImg} />
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Name */}
                <Text style={s.label}>İsim veya lakap</Text>
                <View style={s.inputWrap}>
                  <TextInput
                    style={s.input}
                    placeholder="Nasıl çağıralım?"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    maxLength={30}
                  />
                  {displayName.length > 0 && (
                    <Pressable onPress={() => setDisplayName('')} style={s.clearBtn}>
                      <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* =================== STEP 2: CİNSİYET + YAŞ =================== */}
            {step === 2 && (
              <View style={s.stepContainer}>
                <Text style={s.heading}>Biraz kendinden bahset</Text>
                <Text style={s.desc}>Bu bilgiler profilinde gösterilmez, güvenlik ve öneri amaçlıdır.</Text>

                <Text style={s.label}>Cinsiyet</Text>
                <View style={s.genderGrid}>
                  {GENDER_OPTIONS.map((opt) => {
                    const sel = gender === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[s.genderCard, sel && { borderColor: opt.color, backgroundColor: `${opt.color}15` }]}
                        onPress={() => setGender(opt.id)}
                      >
                        <View style={[s.genderIconWrap, sel && { backgroundColor: `${opt.color}25` }]}>
                          <Ionicons name={opt.icon} size={24} color={sel ? opt.color : 'rgba(255,255,255,0.3)'} />
                        </View>
                        <Text style={[s.genderLabel, sel && { color: '#F1F5F9' }]}>{opt.label}</Text>
                        {sel && (
                          <View style={[s.genderCheck, { backgroundColor: opt.color }]}>
                            <Ionicons name="checkmark" size={12} color="#FFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[s.label, { marginTop: 28 }]}>Doğum Yılı <Text style={{ color: '#EF4444' }}>*</Text></Text>
                <View style={[s.inputWrap, !birthYear && { borderColor: 'rgba(239,68,68,0.3)' }]}>
                  <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.3)" style={{ marginRight: 12 }} />
                  <TextInput
                    style={s.input}
                    placeholder="Örn: 2000 (zorunlu)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={birthYear}
                    onChangeText={(t) => setBirthYear(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>
            )}

            {/* =================== STEP 3: İLGİ ALANLARI =================== */}
            {step === 3 && (
              <View style={s.stepContainer}>
                <Text style={s.heading}>Nelerden hoşlanırsın? 🎯</Text>
                <Text style={s.desc}>Seçimlerine göre sana özel odalar önereceğiz.</Text>

                <View style={s.interestGrid}>
                  {INTEREST_OPTIONS.map((item) => {
                    const sel = interests.includes(item.id);
                    return (
                      <Pressable
                        key={item.id}
                        style={[s.interestCard, sel && { borderColor: item.color, backgroundColor: `${item.color}18` }]}
                        onPress={() => {
                          if (sel) setInterests(interests.filter(i => i !== item.id));
                          else setInterests([...interests, item.id]);
                        }}
                      >
                        <Text style={s.interestEmoji}>{item.emoji}</Text>
                        <Text style={[s.interestLabel, sel && { color: '#F1F5F9' }]}>{item.label}</Text>
                        {sel && (
                          <Ionicons name="checkmark-circle" size={18} color={item.color} style={{ position: 'absolute', top: 8, right: 8 }} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* =================== STEP 4: DAVET KODU =================== */}
            {step === 4 && (
              <View style={s.stepContainer}>
                <View style={s.giftWrap}>
                  <LinearGradient
                    colors={['rgba(20,184,166,0.15)', 'rgba(20,184,166,0.05)']}
                    style={s.giftCircle}
                  >
                    <Ionicons name="gift" size={40} color={Colors.teal} />
                  </LinearGradient>
                </View>
                <Text style={s.heading}>Profilin hazır! 🎉</Text>
                <Text style={s.desc}>Bir arkadaşının davet kodu varsa girerek 50 SP kazan.</Text>

                <View style={[s.inputWrap, { marginTop: 24 }]}>
                  <Ionicons name="key-outline" size={18} color="rgba(255,255,255,0.3)" style={{ marginRight: 12 }} />
                  <TextInput
                    style={[s.input, { fontSize: 20, fontWeight: '800', letterSpacing: 3 }]}
                    placeholder="KODU GİR"
                    placeholderTextColor="rgba(255,255,255,0.15)"
                    autoCapitalize="characters"
                    maxLength={8}
                    value={inviteCode}
                    onChangeText={setInviteCode}
                  />
                </View>
              </View>
            )}

          </Animated.View>
        </ScrollView>

        {/* ═══ Footer CTA ═══ */}
        <View style={s.footer}>
          {step === 4 ? (
            <View style={s.footerRow}>
              <Pressable
                style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.7 }]}
                onPress={finalizeOnboarding}
              >
                <Text style={s.secondaryBtnText}>Atla</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.primaryBtn, { flex: 1 }, pressed && { opacity: 0.9 }]}
                onPress={handeApplyCode}
                disabled={saving}
              >
                <LinearGradient colors={Gradients.teal as [string, string]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.primaryInner}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryText}>Kodu Uygula</Text>}
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [s.primaryBtn, { flex: 1 }, pressed && { opacity: 0.9 }]}
              onPress={step === 1 ? handleSaveProfile : step === 2 ? handleSaveGenderAge : handleSaveInterests}
              disabled={saving}
            >
              <LinearGradient colors={Gradients.teal as [string, string]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.primaryInner}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={s.primaryText}>{step === 1 ? 'Profili Kaydet' : step === 2 ? 'Devam Et' : 'Seçimleri Kaydet'}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1926' },
  flex: { flex: 1 },

  // ═══ Progress ═══
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 58 : 44,
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 12,
  },
  topBackBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  progressTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: Colors.teal,
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6, shadowOpacity: 0.6,
  },
  stepLabel: {
    fontSize: 12, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    minWidth: 28, textAlign: 'right',
  },

  // ═══ Scroll ═══
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 110,
  },

  // ═══ Step Container ═══
  stepContainer: {},

  heading: {
    fontSize: 26, fontWeight: '800',
    color: '#FFFFFF', letterSpacing: -0.3,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  desc: {
    fontSize: 14, color: 'rgba(255,255,255,0.6)',
    lineHeight: 21, marginBottom: 28,
  },

  // ═══ Step 1: Avatar ═══
  bigAvatarWrap: {
    alignSelf: 'center', marginBottom: 20,
    position: 'relative',
    // Avatar shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  bigAvatar: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.teal,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#0F1926',
    shadowColor: Colors.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10, shadowOpacity: 0.4,
    elevation: 8,
  },
  avatarStrip: { marginBottom: 28 },
  avatarStripContent: { gap: 10, paddingHorizontal: 4, justifyContent: 'center', flexGrow: 1 },
  stripAvatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden', opacity: 0.8,
    // Mini avatar shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  stripAvatarActive: {
    borderColor: Colors.teal, opacity: 1,
    transform: [{ scale: 1.1 }],
    shadowColor: Colors.teal,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  stripAvatarImg: { width: '100%', height: '100%', borderRadius: 20 },

  // ═══ Inputs ═══
  label: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 10, marginLeft: 2,
    letterSpacing: 0.3,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 54, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  input: {
    flex: 1, fontSize: 16, color: '#FFFFFF',
    fontWeight: '500',
  },
  clearBtn: { padding: 4 },

  // ═══ Step 2: Gender ═══
  genderGrid: { gap: 10 },
  genderCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    gap: 14, position: 'relative',
  },
  genderIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  genderLabel: {
    fontSize: 15, fontWeight: '600',
    color: 'rgba(255,255,255,0.6)', flex: 1,
  },
  genderCheck: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },

  // ═══ Step 3: Interests ═══
  interestGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10,
  },
  interestCard: {
    width: (W - 48 - 10) / 2,
    paddingVertical: 18, paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', position: 'relative',
  },
  interestEmoji: { fontSize: 28, marginBottom: 8 },
  interestLabel: {
    fontSize: 13, fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
  },

  // ═══ Step 4: Gift ═══
  giftWrap: { alignItems: 'center', marginBottom: 20 },
  giftCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },

  // ═══ Footer ═══
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingTop: 14,
  },
  footerRow: { flexDirection: 'row', gap: 12 },
  secondaryBtn: {
    height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },
  secondaryBtnText: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600' },
  primaryBtn: { height: 52 },
  primaryInner: {
    flex: 1, flexDirection: 'row', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', // ★ FIX: Android gradient dikdörtgen gölge bugı
  },
  primaryText: {
    fontSize: 16, fontWeight: '700', color: '#FFF',
    letterSpacing: 0.3,
  },
});
