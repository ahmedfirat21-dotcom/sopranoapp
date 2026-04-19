import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { RoomService, getRoomLimits, type TierName } from '../services/database';
import { GamificationService } from '../services/gamification';
import { Colors } from '../constants/theme';
import { showToast } from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './_layout';
import AppBackground from '../components/AppBackground';
import { UpsellService } from '../services/upsell';
import { supabase } from '../constants/supabase';
import InviteFriendsModal from '../components/room/InviteFriendsModal';
import { PushService } from '../services/push';
import { RoomAccessService } from '../services/roomAccess';
import type { FollowUser } from '../services/friendship';
import * as ImagePicker from 'expo-image-picker';

// ═══════════════════════════════════════════════════════════════════
// Tema & Kategori sabitleri
// ═══════════════════════════════════════════════════════════════════
const ROOM_THEMES: { id: string; name: string; colors: [string, string] }[] = [
  { id: 'ocean',   name: 'Okyanus',    colors: ['#0E4D6F', '#083344'] },
  { id: 'sunset',  name: 'Gün Batımı', colors: ['#7F1D1D', '#4C0519'] },
  { id: 'forest',  name: 'Orman',      colors: ['#14532D', '#052E16'] },
  { id: 'galaxy',  name: 'Galaksi',    colors: ['#312E81', '#1E1B4B'] },
  { id: 'aurora',  name: 'Aurora',     colors: ['#134E4A', '#042F2E'] },
  { id: 'cherry',  name: 'Kiraz',      colors: ['#831843', '#500724'] },
  { id: 'cyber',   name: 'Cyber',      colors: ['#1E3A8A', '#172554'] },
  { id: 'volcano', name: 'Volkan',     colors: ['#7C2D12', '#431407'] },
];

const CATEGORIES = [
  { id: 'chat',  label: 'Sohbet',     icon: 'chatbubbles',          color: '#14B8A6', desc: 'Günlük muhabbet, serbest konular' },
  { id: 'music', label: 'Müzik',      icon: 'musical-notes',        color: '#8B5CF6', desc: 'Sevdiğin parçaları paylaş' },
  { id: 'game',  label: 'Oyun',       icon: 'game-controller',      color: '#EF4444', desc: 'Oyuncularla strateji, skor' },
  { id: 'tech',  label: 'Teknoloji',  icon: 'code-slash',           color: '#3B82F6', desc: 'Yazılım, donanım, yeni araçlar' },
  { id: 'book',  label: 'Kitap',      icon: 'book',                 color: '#F59E0B', desc: 'Okuma deneyimleri, yazarlar' },
  { id: 'film',  label: 'Film',       icon: 'film',                 color: '#EC4899', desc: 'Sinema, dizi, tartışmalar' },
  { id: 'other', label: 'Diğer',      icon: 'ellipsis-horizontal',  color: '#64748B', desc: 'Kategorilere sığmayan her şey' },
];

const ROOM_TYPES = [
  { id: 'open',   label: 'Açık',    icon: 'globe-outline',      desc: 'Herkes serbestçe katılabilir',   minTier: 'Free' },
  { id: 'closed', label: 'Şifreli', icon: 'lock-closed-outline', desc: 'Sadece şifreyi bilenler girer',  minTier: 'Plus' },
  { id: 'invite', label: 'Davetli', icon: 'mail-outline',        desc: 'Sadece senin davet ettiklerin', minTier: 'Pro' },
] as const;

const SPEAKING_MODES = [
  { id: 'free_for_all',    label: 'Serbest',     icon: 'people',            desc: 'Herkes istediğinde konuşur',       minTier: 'Free' as const },
  { id: 'permission_only', label: 'İzinli',      icon: 'hand-left',         desc: 'El kaldırıp izin beklersin',        minTier: 'Free' as const },
  { id: 'selected_only',   label: 'Seçilmişler', icon: 'shield-checkmark',  desc: 'Sadece owner\'ın seçtikleri konuşur', minTier: 'Pro' as const },
];

// ═══════════════════════════════════════════════════════════════════
// Wizard adımları
// ═══════════════════════════════════════════════════════════════════
type WizardStep = 'basics' | 'category' | 'access' | 'speaking' | 'welcome' | 'visual' | 'monetization' | 'review';

// ★ Her adım için zengin metadata — gradient circle + icon + kendi tema rengi
interface StepMeta {
  id: WizardStep;
  title: string;
  subtitle: string;
  icon: string;
  iconLib?: 'ionicons' | 'mci'; // material community icons alternatif
  gradient: [string, string, string];
  accent: string;
  watermark?: string; // arka plan soluk ikon (büyük)
  skippable?: boolean;
}

const STEPS: StepMeta[] = [
  { id: 'basics',       title: 'Odana bir isim ver',       subtitle: 'Arkadaşlar seni bu isimle bulacak — akılda kalsın, karakterini yansıtsın.',
    icon: 'create-outline',        gradient: ['#0EA5E9', '#0284C7', '#075985'], accent: '#38BDF8', watermark: 'sparkles' },
  { id: 'category',     title: 'Ne konuşacaksınız?',       subtitle: 'Doğru kategori, doğru insanları çeker.',
    icon: 'pricetags',             gradient: ['#A855F7', '#7E22CE', '#581C87'], accent: '#C084FC', watermark: 'grid' },
  { id: 'access',       title: 'Kimler girebilir?',        subtitle: 'Kapıyı herkese mi açarsın, yoksa özel bir topluluk mu?',
    icon: 'key',                   gradient: ['#F59E0B', '#D97706', '#92400E'], accent: '#FBBF24', watermark: 'lock-closed' },
  { id: 'speaking',     title: 'Mikrofonu kim alır?',      subtitle: 'Sahnedeki düzen senin elinde.',
    icon: 'mic',                   gradient: ['#14B8A6', '#0D9488', '#065F56'], accent: '#5EEAD4', watermark: 'radio' },
  { id: 'welcome',      title: 'Karşılama zamanı',         subtitle: 'Gelenlerin ilk gördüğü şey — sıcak bir selam ve kurallar.',
    icon: 'hand-right',            gradient: ['#EC4899', '#BE185D', '#831843'], accent: '#F9A8D4', watermark: 'heart', skippable: true },
  { id: 'visual',       title: 'Görsel dokunuş',           subtitle: 'Tema seç, kapak koy — odana karakterini kat.',
    icon: 'color-palette',         gradient: ['#8B5CF6', '#6D28D9', '#4C1D95'], accent: '#A78BFA', watermark: 'image', skippable: true },
  { id: 'monetization', title: 'İster kazan, ister bedava',subtitle: 'Giriş ücreti veya bağış — tamamen sana kalmış.',
    icon: 'diamond',               gradient: ['#D4AF37', '#B45309', '#78350F'], accent: '#FBBF24', watermark: 'cash', skippable: true },
  { id: 'review',       title: 'Her şey hazır',             subtitle: 'Son bir kontrol, sonra canlıya alırız.',
    icon: 'rocket',                gradient: ['#14B8A6', '#0D9488', '#065F56'], accent: '#5EEAD4', watermark: 'checkmark-done' },
];

async function uploadRoomImage(userId: string, localUri: string, prefix: 'card' | 'bg'): Promise<string> {
  try {
    const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `room-images/${userId}/${prefix}_${Date.now()}.${ext}`;
    const response = await fetch(localUri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from('public').upload(fileName, blob, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: true });
    if (error) return '';
    const { data: urlData } = supabase.storage.from('public').getPublicUrl(fileName);
    return urlData?.publicUrl || '';
  } catch { return ''; }
}

function isTierEnough(userTier: TierName, required: string): boolean {
  const order = ['Free', 'Plus', 'Pro'];
  return order.indexOf(userTier) >= order.indexOf(required);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function CreateRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  const tier = (isAdmin ? 'Pro' : (profile?.subscription_tier || 'Free')) as TierName;
  const limits = useMemo(() => getRoomLimits(tier), [tier]);

  // ── Form state ──
  const [name, setName] = useState('');
  const [category, setCategory] = useState('chat');
  const [type, setType] = useState<'open' | 'closed' | 'invite'>('open');
  const [mode, setMode] = useState<'audio' | 'video'>('audio');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [speakingMode, setSpeakingMode] = useState<'free_for_all' | 'permission_only' | 'selected_only'>('permission_only');
  const [entryFee, setEntryFee] = useState(0);
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [cardImage, setCardImage] = useState('');
  // ★ YENİ: welcome_message + rules (agent raporu eksik tespit etti)
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [rules, setRules] = useState('');

  const [creating, setCreating] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomName, setCreatedRoomName] = useState('');

  // ── Wizard state ──
  const [step, setStep] = useState<WizardStep>('basics');
  const stepIndex = STEPS.findIndex(s => s.id === step);
  const currentStepMeta = STEPS[stepIndex];
  const totalSteps = STEPS.length;

  // ── Slide animasyonu (step geçişi) ──
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const goToStep = (newStep: WizardStep, direction: 'forward' | 'back' = 'forward') => {
    const fromX = direction === 'forward' ? -30 : 30;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: fromX, duration: 150, useNativeDriver: true, easing: Easing.in(Easing.cubic) }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(newStep);
      slideAnim.setValue(-fromX);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const nextStep = () => {
    if (stepIndex < STEPS.length - 1) goToStep(STEPS[stepIndex + 1].id, 'forward');
  };
  const prevStep = () => {
    if (stepIndex > 0) goToStep(STEPS[stepIndex - 1].id, 'back');
    else safeGoBack(router);
  };

  // ── Adım geçerlilik kontrolü (next butonu aktif mi?) ──
  const canProceed = useMemo(() => {
    switch (step) {
      case 'basics': return name.trim().length >= 2;
      case 'category': return !!category;
      case 'access': return type !== 'closed' || password.trim().length >= 4;
      case 'speaking': return !!speakingMode;
      case 'welcome': return true; // opsiyonel
      case 'visual': return true; // opsiyonel
      case 'monetization': return true; // opsiyonel
      case 'review': return true;
      default: return true;
    }
  }, [step, name, category, type, password, speakingMode]);

  // ── Bugünkü oda açma sayısı (göster özet ekranında) ──
  const [todayRoomCount, setTodayRoomCount] = useState(0);
  useEffect(() => {
    if (!firebaseUser?.uid || limits.dailyRooms >= 999) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    (async () => {
      try {
        const { count } = await supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('host_id', firebaseUser.uid).gte('created_at', todayStart.toISOString());
        setTodayRoomCount(count || 0);
      } catch {}
    })();
  }, [firebaseUser?.uid, limits.dailyRooms]);

  // ★ Günlük oda açma limiti dolu mu? (Pro/admin = 999, limitsiz)
  const dailyLimitReached = limits.dailyRooms < 999 && todayRoomCount >= limits.dailyRooms;

  // ═══════════════════════════════════════════════════════════════════
  // ODA YARATMA
  // ═══════════════════════════════════════════════════════════════════
  const handleCreate = async () => {
    if (!firebaseUser || creating) return;

    if (!limits.allowedTypes.includes(type)) {
      showToast({ title: 'Yetersiz Üyelik', message: 'Bu oda tipini açmak için üyeliğini yükselt.', type: 'warning' });
      return;
    }
    if (limits.dailyRooms < 999 && todayRoomCount >= limits.dailyRooms) {
      UpsellService.onDailyRoomLimit(tier);
      showToast({ title: 'Günlük Limit', message: `Bugün en fazla ${limits.dailyRooms} oda açabilirsin.`, type: 'warning' });
      return;
    }

    setCreating(true);
    try {
      let uploadedCardUrl = '';
      let uploadedBgUrl = '';
      if (cardImage && cardImage.startsWith('file://')) uploadedCardUrl = await uploadRoomImage(firebaseUser.uid, cardImage, 'card');
      if (backgroundImage && backgroundImage.startsWith('file://')) uploadedBgUrl = await uploadRoomImage(firebaseUser.uid, backgroundImage, 'bg');

      const room = await RoomService.create(
        firebaseUser.uid,
        {
          name: name.trim(), category, type,
          description: description.trim() || undefined,
          mode,
          speaking_mode: speakingMode,
          room_password: type === 'closed' ? password.trim() : undefined,
          entry_fee_sp: entryFee > 0 ? entryFee : undefined,
          donations_enabled: donationsEnabled || undefined,
          followers_only: followersOnly || undefined,
          theme_id: selectedTheme || undefined,
          room_image_url: uploadedBgUrl || undefined,
          card_image_url: uploadedCardUrl || undefined,
          welcome_message: welcomeMessage.trim() || undefined,
          rules: rules.trim() || undefined,
        },
        tier
      );
      showToast({ title: '🎉 Oda Hazır!', message: `"${name.trim()}" odası açıldı.`, type: 'success' });
      try { await GamificationService.onRoomCreate(firebaseUser.uid); } catch {}
      setCreatedRoomId(room.id);
      setCreatedRoomName(name.trim());
      setShowInviteModal(true);
    } catch (err: any) {
      showToast({ title: 'Hata', message: err.message || 'Oda oluşturulamadı.', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleInviteFriends = async (selectedUsers: FollowUser[]) => {
    if (!createdRoomId || !firebaseUser || !profile) return;
    const hostName = profile.display_name || 'Birisi';
    let successCount = 0;
    for (const user of selectedUsers) {
      try {
        const result = await RoomAccessService.inviteUser(createdRoomId, user.id, firebaseUser.uid);
        if (result.success) successCount++;
        PushService.sendRoomInvite(user.id, hostName, createdRoomName, createdRoomId).catch(() => {});
      } catch {}
    }
    showToast({ title: 'Davetler Gönderildi!', message: `${successCount} arkadaşına davet gönderildi.`, type: 'success' });
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP RENDER'LARI
  // ═══════════════════════════════════════════════════════════════════

  // 1. ODANIN ADI
  const renderBasics = () => (
    <View>
      <TextInput
        style={w.bigInput}
        placeholder="Mesela: Gece Geyik Sohbeti"
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={name}
        onChangeText={setName}
        maxLength={50}
        autoFocus
      />
      <Text style={w.charCount}>{name.length}/50</Text>

      {/* Opsiyonel kısa açıklama */}
      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>Açıklama (opsiyonel)</Text>
        <TextInput
          style={w.mediumInput}
          placeholder="Bu oda neden var? Kısa bir özet..."
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
        />
        <Text style={[w.charCount, { marginTop: 4 }]}>{description.length}/200</Text>
      </View>
    </View>
  );

  // 2. KATEGORİ
  const renderCategory = () => (
    <View>
      <View style={w.categoryGrid}>
        {CATEGORIES.map(c => {
          const active = category === c.id;
          return (
            <Pressable key={c.id} onPress={() => setCategory(c.id)} style={[w.catCard, active && { borderColor: c.color, backgroundColor: `${c.color}15` }]}>
              <View style={[w.catIcon, { backgroundColor: `${c.color}22` }]}>
                <Ionicons name={c.icon as any} size={22} color={c.color} />
              </View>
              <Text style={[w.catName, active && { color: '#FFF' }]}>{c.label}</Text>
              {active && (
                <View style={[w.catCheck, { backgroundColor: c.color }]}>
                  <Ionicons name="checkmark" size={10} color="#FFF" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {category && (
        <Text style={w.categoryHint}>{CATEGORIES.find(c => c.id === category)?.desc}</Text>
      )}
    </View>
  );

  // 3. ERİŞİM (tip + şifre)
  const renderAccess = () => (
    <View>
      {ROOM_TYPES.map(rt => {
        const locked = !isTierEnough(tier, rt.minTier);
        const active = type === rt.id;
        return (
          <Pressable
            key={rt.id}
            onPress={() => { if (!locked) setType(rt.id as any); else UpsellService.onRoomTypeLocked(tier, rt.minTier as any); }}
            style={[w.accessRow, active && w.accessRowActive, locked && { opacity: 0.5 }]}
          >
            <View style={[w.accessIcon, active && { backgroundColor: 'rgba(20,184,166,0.2)' }]}>
              <Ionicons name={rt.icon as any} size={22} color={active ? Colors.teal : '#94A3B8'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[w.accessLabel, active && { color: Colors.teal }]}>{rt.label}</Text>
                {locked && (
                  <View style={w.lockBadge}>
                    <Ionicons name="lock-closed" size={9} color="#F59E0B" />
                    <Text style={w.lockText}>{rt.minTier}+</Text>
                  </View>
                )}
              </View>
              <Text style={w.accessDesc}>{rt.desc}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={22} color={Colors.teal} />}
          </Pressable>
        );
      })}

      {type === 'closed' && (
        <View style={{ marginTop: 20 }}>
          <Text style={w.sublabel}>Şifre (min 4 karakter)</Text>
          <TextInput
            style={w.mediumInput}
            placeholder="Gizli şifren..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={password}
            onChangeText={setPassword}
            maxLength={20}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
      )}
    </View>
  );

  // 4. KONUŞMA MODU
  const renderSpeaking = () => (
    <View>
      {SPEAKING_MODES.map(sm => {
        const locked = !isTierEnough(tier, sm.minTier);
        const active = speakingMode === sm.id;
        return (
          <Pressable
            key={sm.id}
            onPress={() => { if (!locked) setSpeakingMode(sm.id as any); else UpsellService.onFeatureLocked(tier, sm.minTier as any); }}
            style={[w.accessRow, active && w.accessRowActive, locked && { opacity: 0.5 }]}
          >
            <View style={[w.accessIcon, active && { backgroundColor: 'rgba(20,184,166,0.2)' }]}>
              <Ionicons name={sm.icon as any} size={22} color={active ? Colors.teal : '#94A3B8'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[w.accessLabel, active && { color: Colors.teal }]}>{sm.label}</Text>
                {locked && (
                  <View style={w.lockBadge}>
                    <Ionicons name="lock-closed" size={9} color="#F59E0B" />
                    <Text style={w.lockText}>{sm.minTier}+</Text>
                  </View>
                )}
              </View>
              <Text style={w.accessDesc}>{sm.desc}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={22} color={Colors.teal} />}
          </Pressable>
        );
      })}
    </View>
  );

  // 5. KARŞILAMA (welcome + rules — opsiyonel)
  const renderWelcome = () => (
    <View>
      <Text style={w.sublabel}>Hoş geldin mesajı</Text>
      <TextInput
        style={w.mediumInput}
        placeholder="Herkese merhaba! Buyurun..."
        placeholderTextColor="rgba(255,255,255,0.2)"
        value={welcomeMessage}
        onChangeText={setWelcomeMessage}
        maxLength={200}
        multiline
      />
      <Text style={[w.charCount, { marginTop: 4 }]}>{welcomeMessage.length}/200</Text>

      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>Oda kuralları</Text>
        <TextInput
          style={[w.mediumInput, { height: 90 }]}
          placeholder="Herkese saygılı olun, küfür yasak..."
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={rules}
          onChangeText={setRules}
          maxLength={500}
          multiline
        />
        <Text style={[w.charCount, { marginTop: 4 }]}>{rules.length}/500</Text>
      </View>
    </View>
  );

  // 6. GÖRSEL
  const renderVisual = () => (
    <View>
      {/* Kapak görseli */}
      <Text style={w.sublabel}>Kapak görseli (opsiyonel)</Text>
      <Pressable
        style={[w.cardImageBox, cardImage ? { borderColor: Colors.teal, borderStyle: 'solid' } : {}]}
        onPress={async () => {
          try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.8 });
            if (!result.canceled && result.assets?.[0]) setCardImage(result.assets[0].uri);
          } catch { showToast({ title: 'Hata', type: 'error' }); }
        }}
      >
        {cardImage ? (
          <>
            <Image source={{ uri: cardImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <Pressable onPress={() => setCardImage('')} style={w.removeBtn}>
              <Ionicons name="trash" size={14} color="#FFF" />
            </Pressable>
          </>
        ) : (
          <View style={w.cardImagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>Keşfet'te görünecek</Text>
          </View>
        )}
      </Pressable>

      {/* Tema */}
      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>Oda teması (opsiyonel)</Text>
        <View style={w.themeGrid}>
          <Pressable onPress={() => setSelectedTheme(null)} style={[w.themeCircle, !selectedTheme && { borderColor: Colors.teal }]}>
            <LinearGradient colors={['#0E1420', '#070B14']} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
          {ROOM_THEMES.map(t => (
            <Pressable key={t.id} onPress={() => setSelectedTheme(t.id)} style={[w.themeCircle, selectedTheme === t.id && { borderColor: Colors.teal }]}>
              <LinearGradient colors={t.colors} style={StyleSheet.absoluteFillObject} />
              {selectedTheme === t.id && (
                <View style={w.themeCheck}><Ionicons name="checkmark" size={10} color="#FFF" /></View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  // 7. MONETİZASYON
  const renderMonetization = () => (
    <View>
      {/* Giriş ücreti */}
      <View>
        <Text style={w.sublabel}>Giriş ücreti (SP)</Text>
        <Text style={w.hint}>Odaya girmek için SP ödensin mi?</Text>
        <View style={w.feeRow}>
          {[0, 25, 50, 100, 250, 500].map(fee => {
            const active = entryFee === fee;
            const locked = fee > 0 && !isTierEnough(tier, 'Pro');
            return (
              <Pressable
                key={fee}
                onPress={() => { if (!locked) setEntryFee(fee); }}
                style={[w.feePill, active && w.feePillActive, locked && { opacity: 0.4 }]}
              >
                <Text style={[w.feePillText, active && { color: '#FFF' }]}>{fee === 0 ? 'Ücretsiz' : `${fee} SP`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Bağış */}
      <Pressable
        onPress={() => { if (isTierEnough(tier, 'Pro')) setDonationsEnabled(!donationsEnabled); else UpsellService.onFeatureLocked(tier, 'Pro'); }}
        style={[w.toggleRow, { marginTop: 24 }]}
      >
        <Ionicons name="heart" size={20} color={donationsEnabled ? '#EC4899' : '#94A3B8'} />
        <View style={{ flex: 1 }}>
          <Text style={w.toggleLabel}>Bağış aktif</Text>
          <Text style={w.toggleDesc}>Dinleyiciler sana SP bağışlayabilir</Text>
        </View>
        {!isTierEnough(tier, 'Pro') ? (
          <View style={w.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={w.lockText}>Pro+</Text></View>
        ) : (
          <View style={[w.switchTrack, donationsEnabled && w.switchTrackActive]}>
            <View style={[w.switchKnob, donationsEnabled && w.switchKnobActive]} />
          </View>
        )}
      </Pressable>

      {/* Sadece arkadaşlar */}
      <Pressable
        onPress={() => { if (isTierEnough(tier, 'Pro')) setFollowersOnly(!followersOnly); else UpsellService.onFeatureLocked(tier, 'Pro'); }}
        style={w.toggleRow}
      >
        <Ionicons name="people" size={20} color={followersOnly ? Colors.teal : '#94A3B8'} />
        <View style={{ flex: 1 }}>
          <Text style={w.toggleLabel}>Sadece arkadaşlarım</Text>
          <Text style={w.toggleDesc}>Sadece arkadaş listendekiler girebilir</Text>
        </View>
        {!isTierEnough(tier, 'Pro') ? (
          <View style={w.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={w.lockText}>Pro+</Text></View>
        ) : (
          <View style={[w.switchTrack, followersOnly && w.switchTrackActive]}>
            <View style={[w.switchKnob, followersOnly && w.switchKnobActive]} />
          </View>
        )}
      </Pressable>
    </View>
  );

  // 8. ÖZET
  const renderReview = () => {
    const themeObj = ROOM_THEMES.find(t => t.id === selectedTheme);
    const catObj = CATEGORIES.find(c => c.id === category);
    const typeObj = ROOM_TYPES.find(rt => rt.id === type);
    const smObj = SPEAKING_MODES.find(s => s.id === speakingMode);

    return (
      <View>
        {/* Büyük oda kartı önizleme */}
        <View style={w.reviewCard}>
          {cardImage ? (
            <>
              <Image source={{ uri: cardImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
            </>
          ) : (
            <LinearGradient
              colors={themeObj ? [...themeObj.colors, '#070B14'] : [catObj?.color + '30' || '#14B8A633', '#0F172A', '#070B14']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={w.reviewBadge}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' }} />
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF' }}>CANLI</Text>
          </View>
          <Text style={w.reviewTitle} numberOfLines={2}>{name || 'Oda adı'}</Text>
          {description ? <Text style={w.reviewDesc} numberOfLines={2}>{description}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {catObj && (
              <View style={[w.chipMini, { backgroundColor: `${catObj.color}22`, borderColor: `${catObj.color}55` }]}>
                <Ionicons name={catObj.icon as any} size={9} color={catObj.color} />
                <Text style={[w.chipMiniText, { color: catObj.color }]}>{catObj.label}</Text>
              </View>
            )}
            {typeObj && (
              <View style={w.chipMini}>
                <Ionicons name={typeObj.icon as any} size={9} color="#94A3B8" />
                <Text style={w.chipMiniText}>{typeObj.label}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Özet satırları */}
        <View style={w.summaryBlock}>
          <SummaryRow icon="mic" label="Konuşma" value={smObj?.label || ''} />
          {welcomeMessage && <SummaryRow icon="chatbubble-ellipses" label="Karşılama" value={welcomeMessage} />}
          {rules && <SummaryRow icon="document-text" label="Kurallar" value="Tanımlandı" />}
          {entryFee > 0 && <SummaryRow icon="diamond" label="Giriş" value={`${entryFee} SP`} />}
          {donationsEnabled && <SummaryRow icon="heart" label="Bağış" value="Aktif" />}
          {followersOnly && <SummaryRow icon="people" label="Erişim" value="Sadece arkadaşlar" />}
          {selectedTheme && <SummaryRow icon="color-palette" label="Tema" value={themeObj?.name || ''} />}
        </View>

        <View style={w.capInfo}>
          <Ionicons name="people-circle" size={14} color={Colors.teal} />
          <Text style={w.capText}>Sahne: {limits.maxSpeakers} • Dinleyici: {limits.maxListeners}</Text>
        </View>
      </View>
    );
  };

  // Adım adım içerik
  const renderStepContent = () => {
    switch (step) {
      case 'basics': return renderBasics();
      case 'category': return renderCategory();
      case 'access': return renderAccess();
      case 'speaking': return renderSpeaking();
      case 'welcome': return renderWelcome();
      case 'visual': return renderVisual();
      case 'monetization': return renderMonetization();
      case 'review': return renderReview();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <AppBackground>
      <View style={{ flex: 1 }}>
        {/* ── HEADER ── */}
        <View style={[w.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={prevStep} style={w.iconBtn} hitSlop={8}>
            <Ionicons name={stepIndex === 0 ? 'close' : 'chevron-back'} size={22} color="#F1F5F9" />
          </Pressable>
          <Text style={w.stepCounter}>{stepIndex + 1} / {totalSteps}</Text>
          <View style={[w.tierChip, isAdmin && { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
            <Text style={[w.tierChipText, isAdmin && { color: '#EF4444' }]}>{isAdmin ? '⚡' : tier}</Text>
          </View>
        </View>

        {/* ── PROGRESS DOTS ── */}
        <View style={w.progressRow}>
          {STEPS.map((s, i) => (
            <View
              key={s.id}
              style={[
                w.progressDot,
                i === stepIndex && w.progressDotActive,
                i < stepIndex && w.progressDotDone,
              ]}
            />
          ))}
        </View>

        {/* ── CONTENT ── */}
        {/* ★ Arka plan watermark — büyük soluk ikon (her step'e özel) */}
        {currentStepMeta.watermark ? (
          <View pointerEvents="none" style={w.watermarkWrap}>
            <Ionicons name={currentStepMeta.watermark as any} size={280} color={currentStepMeta.accent} style={{ opacity: 0.04 }} />
          </View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160, paddingTop: 12 }}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            {/* ★ Gradient circle + icon — alt tarafta koyu yumuşak gölge (ilk tasarım) */}
            <View style={w.heroIconWrap}>
              <LinearGradient
                colors={currentStepMeta.gradient}
                start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
                style={w.heroIconCircle}
              >
                {/* İç parıltı — üst beyaz, alt koyu → 3D derinlik */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.22)', 'transparent', 'rgba(0,0,0,0.15)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name={currentStepMeta.icon as any} size={36} color="#FFF" />
              </LinearGradient>
            </View>

            {/* Hero Title + Subtitle — text shadow yok, sade */}
            <Text style={w.heroTitle}>{currentStepMeta.title}</Text>
            <Text style={w.heroSubtitle}>{currentStepMeta.subtitle}</Text>

            {/* Step Content */}
            <View style={{ marginTop: 24 }}>
              {renderStepContent()}
            </View>
          </Animated.View>
        </ScrollView>

        {/* ── FOOTER (Back / Skip / Next) ── */}
        <View style={[w.footer, { paddingBottom: insets.bottom + 12 }]}>
          {currentStepMeta.skippable && step !== 'review' && (
            <Pressable onPress={nextStep} style={w.skipBtn}>
              <Text style={w.skipText}>Atla</Text>
            </Pressable>
          )}

          {step === 'review' ? (
            <Pressable
              onPress={() => { if (dailyLimitReached) UpsellService.onDailyRoomLimit(tier); else handleCreate(); }}
              disabled={creating}
              style={[w.primaryBtn, (creating || dailyLimitReached) && { opacity: 0.55 }]}
            >
              <LinearGradient
                colors={dailyLimitReached ? ['#475569', '#334155', '#1E293B'] : ['#14B8A6', '#0D9488', '#065F56']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={w.primaryBtnGrad}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : dailyLimitReached ? (
                  <>
                    <Ionicons name="lock-closed" size={16} color="#FFF" />
                    <Text style={w.primaryBtnText}>Günlük limit doldu ({todayRoomCount}/{limits.dailyRooms})</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="rocket" size={18} color="#FFF" />
                    <Text style={w.primaryBtnText}>Odayı Aç</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              onPress={nextStep}
              disabled={!canProceed}
              style={[w.primaryBtn, !canProceed && { opacity: 0.4 }]}
            >
              <LinearGradient
                colors={canProceed ? ['#14B8A6', '#0D9488', '#065F56'] : ['#334155', '#1E293B', '#0F172A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={w.primaryBtnGrad}
              >
                <Text style={w.primaryBtnText}>Devam</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* ── Davet Modalı (oda açıldıktan sonra) ── */}
        <InviteFriendsModal
          visible={showInviteModal}
          userId={firebaseUser?.uid || ''}
          roomId={createdRoomId || undefined}
          onClose={() => {
            setShowInviteModal(false);
            if (createdRoomId) router.replace(`/room/${createdRoomId}` as any);
          }}
          onInvite={async (selectedUsers) => {
            await handleInviteFriends(selectedUsers);
            setShowInviteModal(false);
            if (createdRoomId) router.replace(`/room/${createdRoomId}` as any);
          }}
        />
      </View>
    </AppBackground>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY ROW
// ═══════════════════════════════════════════════════════════════════
function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={w.summaryRow}>
      <Ionicons name={icon as any} size={14} color="#94A3B8" />
      <Text style={w.summaryLabel}>{label}</Text>
      <Text style={w.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES — Apple-like wizard
// ═══════════════════════════════════════════════════════════════════
const w = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(149,161,174,0.18)',
  },
  stepCounter: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  tierChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  tierChipText: { fontSize: 11, fontWeight: '800', color: Colors.teal },

  // Progress dots — aktif olan tema rengiyle glow
  progressRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: 14,
  },
  progressDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressDotActive: {
    width: 26, height: 6, borderRadius: 3,
    backgroundColor: Colors.teal,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 3,
  },
  progressDotDone: {
    backgroundColor: 'rgba(20,184,166,0.5)',
  },

  // ★ Hero — gradient circle + koyu yumuşak dağılmış gölge
  heroIconWrap: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, marginTop: 8,
  },
  heroIconCircle: {
    width: 84, height: 84, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    // ★ KOYU yumuşak dağılmış gölge — renkli değil
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
  },
  // Arka plan watermark — her step'e özel büyük soluk ikon
  watermarkWrap: {
    position: 'absolute',
    top: 80, right: -60,
    zIndex: 0,
  },
  heroTitle: {
    fontSize: 26, fontWeight: '800', color: '#F1F5F9',
    textAlign: 'center', letterSpacing: -0.4, lineHeight: 32,
    // Shadow kaldırıldı — temiz, keskin tipografi
  },
  heroSubtitle: {
    fontSize: 14, color: 'rgba(203,213,225,0.75)', // #CBD5E1 %75 — daha okunur
    textAlign: 'center', marginTop: 10, lineHeight: 21,
    paddingHorizontal: 8,
    fontWeight: '500',
  },

  // ★ Big input — step 1 oda adı (premium underline)
  bigInput: {
    fontSize: 26, fontWeight: '700', color: '#F1F5F9',
    paddingVertical: 16, paddingHorizontal: 8,
    borderBottomWidth: 2, borderBottomColor: 'rgba(20,184,166,0.4)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  mediumInput: {
    fontSize: 15, color: '#F1F5F9',
    backgroundColor: '#414E5F', borderWidth: 1, borderColor: 'rgba(149,161,174,0.2)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 52, textAlignVertical: 'top',
    fontWeight: '500', lineHeight: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  charCount: { fontSize: 10, color: 'rgba(148,163,184,0.7)', textAlign: 'right', marginTop: 6, fontWeight: '500' },
  sublabel: { fontSize: 11, fontWeight: '800', color: 'rgba(203,213,225,0.85)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  hint: { fontSize: 12, color: 'rgba(148,163,184,0.75)', marginBottom: 12, lineHeight: 17 },

  // Kategori grid — koyu yumuşak dağılmış gölge
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  catCard: {
    width: '30%', aspectRatio: 1,
    backgroundColor: '#414E5F', borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(149,161,174,0.2)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  catIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    // İkon arka dairesi — koyu hafif dağılmış gölge
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  catName: { fontSize: 12, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.2 },
  catCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 4,
  },
  categoryHint: {
    textAlign: 'center', fontSize: 12, color: 'rgba(203,213,225,0.65)',
    marginTop: 18, lineHeight: 18,
    fontWeight: '500',
  },

  // Erişim / speaking row — kart hissi derinlik
  accessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#414E5F', borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(149,161,174,0.2)',
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  accessRowActive: {
    borderColor: Colors.teal,
    backgroundColor: 'rgba(20,184,166,0.12)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  accessIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  accessLabel: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.2 },
  accessDesc: { fontSize: 12, color: 'rgba(203,213,225,0.75)', marginTop: 3, lineHeight: 16 },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  lockText: { fontSize: 9, fontWeight: '700', color: '#F59E0B' },

  // Görsel
  cardImageBox: {
    height: 140, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(149,161,174,0.25)', borderStyle: 'dashed',
    backgroundColor: '#414E5F',
    overflow: 'hidden',
  },
  cardImagePlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  removeBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  themeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  themeCircle: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: 'rgba(149,161,174,0.2)',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  themeCheck: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.teal,
    alignItems: 'center', justifyContent: 'center',
  },

  // Monetizasyon
  feeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feePill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#414E5F', borderWidth: 1.5, borderColor: 'rgba(149,161,174,0.18)',
  },
  feePillActive: {
    backgroundColor: 'rgba(212,175,55,0.25)',
    borderColor: '#D4AF37',
  },
  feePillText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#414E5F', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(149,161,174,0.2)',
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.15 },
  toggleDesc: { fontSize: 12, color: 'rgba(203,213,225,0.75)', marginTop: 3, lineHeight: 16 },
  switchTrack: {
    width: 40, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  switchTrackActive: { backgroundColor: 'rgba(20,184,166,0.4)' },
  switchKnob: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#475569',
  },
  switchKnobActive: { backgroundColor: Colors.teal, alignSelf: 'flex-end' },

  // Review — premium oda kartı önizleme
  reviewCard: {
    height: 180, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    padding: 18, justifyContent: 'flex-end',
    marginBottom: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45, shadowRadius: 18, elevation: 10,
  },
  reviewBadge: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(239,68,68,0.95)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  reviewTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  reviewDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 17 },
  chipMini: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(148,163,184,0.2)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.35)',
  },
  chipMiniText: { fontSize: 10, fontWeight: '700', color: '#E2E8F0' },

  summaryBlock: {
    backgroundColor: '#414E5F', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(149,161,174,0.2)',
    padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLabel: { fontSize: 12, color: 'rgba(203,213,225,0.7)', width: 90, fontWeight: '500' },
  summaryValue: { flex: 1, fontSize: 13, fontWeight: '700', color: '#F1F5F9' },

  capInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: 'rgba(20,184,166,0.1)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  capText: { fontSize: 12, fontWeight: '700', color: Colors.teal, letterSpacing: 0.2 },

  // Footer
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 24, paddingTop: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  skipBtn: {
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
  },
  skipText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  primaryBtn: {
    flex: 1, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  primaryBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});
