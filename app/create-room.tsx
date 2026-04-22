import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Image, Animated, Easing, Dimensions, PanResponder } from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { RoomService, getRoomLimits, type TierName } from '../services/database';
import { GamificationService } from '../services/gamification';
import { Colors, Shadows } from '../constants/theme';
import { showToast } from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './_layout';
import { UpsellService } from '../services/upsell';
import { supabase } from '../constants/supabase';
import InviteFriendsModal from '../components/room/InviteFriendsModal';
import { PushService } from '../services/push';
import { RoomAccessService } from '../services/roomAccess';
import type { FollowUser } from '../services/friendship';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { containsBadWords } from '../constants/badwords';

// ★ 2026-04-21: Oda adı sanitization — whitespace normalize, HTML strip, length cap.
//   Küfür kontrolü ayrı (canProceed'de çalışıyor).
function sanitizeRoomName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')         // HTML taglarını kaldır
    .replace(/\s+/g, ' ')            // Ardışık whitespace'i tek boşluğa indir
    .trim()
    .slice(0, 60);                   // Max 60 karakter
}

// ★ 2026-04-21: Draft save/restore — kullanıcı geri gidip kayboldu ya da crash olduysa
//   form kaybolmasın. Başarılı oluşturmadan sonra draft temizlenir.
const DRAFT_KEY = 'soprano_create_room_draft_v1';

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
  { id: 'closed', label: 'Şifreli', icon: 'lock-closed-outline', desc: 'Sadece şifreyi bilenler girer',  minTier: 'Free' },
  { id: 'invite', label: 'Davetli', icon: 'mail-outline',        desc: 'Sadece senin davet ettiklerin', minTier: 'Plus' },
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
  // ★ 2026-04-21: fetch(file://) Android'de "Network request failed" veriyordu.
  //   StorageService.uploadFile doğru yöntemi kullanır: ImageManipulator resize +
  //   FileSystem base64 read + ArrayBuffer decode + supabase upload.
  const { StorageService } = require('../services/storage');
  const path = `room-images/${userId}/${prefix}_${Date.now()}.jpg`;
  return await StorageService.uploadFile('post-images', path, localUri);
}

function isTierEnough(userTier: TierName, required: string): boolean {
  const order = ['Free', 'Plus', 'Pro', 'GodMaster'];
  return order.indexOf(userTier) >= order.indexOf(required);
}

// ★ 2026-04-21: Müzik linki validation — yalnızca YouTube/Spotify/SoundCloud/YouTube Music.
//   Diğer URL'ler DB'ye yazılmasın, hatalı yapıştırmalar erkende yakalansın.
const MUSIC_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com|open\.spotify\.com|spotify\.com|soundcloud\.com|m\.soundcloud\.com)\//i;
function isValidMusicUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true; // Boş OK — opsiyonel alan
  return MUSIC_URL_REGEX.test(trimmed);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function CreateRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  // ★ GodMaster FIX: GodMaster tier'ı koruyarak kullan, admin ise Pro'ya yükselt
  const tier = (profile?.subscription_tier === 'GodMaster' ? 'GodMaster' : (isAdmin ? 'Pro' : (profile?.subscription_tier || 'Free'))) as TierName;
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
  // ★ 2026-04-20: +18 oda kurulumda set edilebilsin (eskiden sonradan PlusMenu'den yapmak gerekiyordu)
  const [ageRestricted, setAgeRestricted] = useState(false);
  // ★ 2026-04-20: Dil filtresi — Plus+ (PlusMenu ile parite)
  const [roomLanguage, setRoomLanguage] = useState<string>('tr');
  // ★ 2026-04-20: Yavaş mod — Plus+ moderasyon aracı (saniye cinsinden, 0 = kapalı)
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  // ★ 2026-04-20: Müzik linki (Pro) — YouTube/Spotify/SoundCloud; herkes kendi platformunda dinler
  const [musicLink, setMusicLink] = useState<string>('');
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

  // ════════════════════════════════════════════════════════════
  // ★ 2026-04-23: SHEET presentation — RoomChatDrawer pattern
  //   - Mount: translateY SCREEN_H → 0 (alt'tan yukarı kayar) + backdrop fade-in
  //   - Unmount: reverse, bitince router.back()
  //   - Handle drag: yukarıdaki handle barından aşağı sürükle → kapat
  //   - Minimize btn: header'daki chevron-down → kapat
  // ════════════════════════════════════════════════════════════
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);

  // Router'a bağımlı closeSheet — ref pattern ile panResponder stable kalır
  const closeSheetRef = useRef<() => void>(() => {});
  closeSheetRef.current = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => safeGoBack(router));
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // ★ 2026-04-23: Yalnızca aşağı yönde drag — yukarı rubber-band panel altında
    //   boş alan açıyordu (panel top:insets.top+30'da zaten olabildiğince yukarıda).
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderMove: (_, gs) => {
      translateY.setValue(Math.max(0, gs.dy));
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 90 || gs.vy > 0.5) {
        closeSheetRef.current();
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }).start();
      }
    },
  })).current;

  // ★ 2026-04-21: Draft restore — wizard açılışında önceki state varsa yükle.
  //   file:// uri'leri AsyncStorage'a kaydetmiyoruz (cihaz-spesifik, crash olmuş olabilir).
  //   Yalnızca form değerleri.
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!raw) { draftRestoredRef.current = true; return; }
        const d = JSON.parse(raw);
        if (d?.name) setName(d.name);
        if (d?.category) setCategory(d.category);
        if (d?.type) setType(d.type);
        if (d?.description) setDescription(d.description);
        if (d?.speakingMode) setSpeakingMode(d.speakingMode);
        if (typeof d?.entryFee === 'number') setEntryFee(d.entryFee);
        if (typeof d?.donationsEnabled === 'boolean') setDonationsEnabled(d.donationsEnabled);
        if (typeof d?.followersOnly === 'boolean') setFollowersOnly(d.followersOnly);
        if (typeof d?.ageRestricted === 'boolean') setAgeRestricted(d.ageRestricted);
        if (d?.roomLanguage) setRoomLanguage(d.roomLanguage);
        if (typeof d?.slowModeSeconds === 'number') setSlowModeSeconds(d.slowModeSeconds);
        if (d?.selectedTheme) setSelectedTheme(d.selectedTheme);
        if (d?.musicLink) setMusicLink(d.musicLink);
        if (d?.welcomeMessage) setWelcomeMessage(d.welcomeMessage);
        if (d?.rules) setRules(d.rules);
        // Şifre güvenlik sebebiyle restore edilmiyor
      } catch {}
      draftRestoredRef.current = true;
    })();
  }, []);

  // ★ Draft save — form değiştikçe (restore sonrası) yaz. Debounce ile spam önlenir.
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const t = setTimeout(() => {
      const draft = {
        name, category, type, description, speakingMode, entryFee,
        donationsEnabled, followersOnly, ageRestricted, roomLanguage,
        slowModeSeconds, selectedTheme, musicLink, welcomeMessage, rules,
      };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [name, category, type, description, speakingMode, entryFee, donationsEnabled,
      followersOnly, ageRestricted, roomLanguage, slowModeSeconds, selectedTheme,
      musicLink, welcomeMessage, rules]);

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
    else closeSheetRef.current(); // ★ 2026-04-23: İlk step'te animasyonlu kapanış
  };

  // ★ 2026-04-21: Oda adı canlı validation — küfür + uzunluk check'i.
  const nameValidation = useMemo(() => {
    const sanitized = sanitizeRoomName(name);
    if (sanitized.length < 2) return { ok: false, reason: 'En az 2 karakter' };
    if (sanitized.length > 60) return { ok: false, reason: 'En fazla 60 karakter' };
    if (containsBadWords(sanitized)) return { ok: false, reason: 'Uygunsuz kelime içeriyor' };
    return { ok: true, reason: null as string | null };
  }, [name]);

  // ── Adım geçerlilik kontrolü (next butonu aktif mi?) ──
  const canProceed = useMemo(() => {
    switch (step) {
      case 'basics': return nameValidation.ok;
      case 'category': return !!category;
      case 'access': return type !== 'closed' || password.trim().length >= 4;
      case 'speaking': return !!speakingMode;
      case 'welcome': return !containsBadWords(welcomeMessage) && !containsBadWords(rules);
      case 'visual': return isValidMusicUrl(musicLink);
      case 'monetization': return true; // opsiyonel
      case 'review': return true;
      default: return true;
    }
  }, [step, nameValidation.ok, category, type, password, speakingMode, welcomeMessage, rules, musicLink]);

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

    // ★ 2026-04-21: Müzik linki son bir kontrol — canProceed'te yakalanıyor ama
    //   submit'e kadar geldiyse bir daha doğrula.
    if (musicLink.trim() && !isValidMusicUrl(musicLink)) {
      showToast({ title: 'Geçersiz Müzik Linki', message: 'Sadece YouTube, Spotify veya SoundCloud linki kabul edilir.', type: 'error' });
      return;
    }

    setCreating(true);
    try {
      let uploadedCardUrl = '';
      let uploadedBgUrl = '';
      // ★ 2026-04-21: Image upload error'ları ayrı ayrı yakala → user net hata görsün
      if (cardImage && cardImage.startsWith('file://')) {
        try {
          uploadedCardUrl = await uploadRoomImage(firebaseUser.uid, cardImage, 'card');
        } catch (e: any) {
          throw new Error(`Kart görseli yüklenemedi: ${e?.message || 'İnternet bağlantını kontrol et'}`);
        }
      }
      if (backgroundImage && backgroundImage.startsWith('file://')) {
        try {
          uploadedBgUrl = await uploadRoomImage(firebaseUser.uid, backgroundImage, 'bg');
        } catch (e: any) {
          throw new Error(`Arka plan görseli yüklenemedi: ${e?.message || 'İnternet bağlantını kontrol et'}`);
        }
      }

      // ★ 2026-04-21: Sanitize + küfür kontrolü son bir defa
      const cleanName = sanitizeRoomName(name);
      if (cleanName.length < 2 || containsBadWords(cleanName)) {
        throw new Error('Oda adı uygun değil — 2-60 karakter ve uygunsuz kelime içermemeli.');
      }

      const room = await RoomService.create(
        firebaseUser.uid,
        {
          name: cleanName, category, type,
          description: description.trim() || undefined,
          mode,
          speaking_mode: speakingMode,
          room_password: type === 'closed' ? password.trim() : undefined,
          entry_fee_sp: entryFee > 0 ? entryFee : undefined,
          donations_enabled: donationsEnabled || undefined,
          followers_only: followersOnly || undefined,
          age_restricted: ageRestricted || undefined,
          room_language: roomLanguage !== 'tr' ? roomLanguage : undefined,
          slow_mode_seconds: slowModeSeconds > 0 ? slowModeSeconds : undefined,
          theme_id: selectedTheme || undefined,
          music_link: musicLink.trim() || undefined,
          room_image_url: uploadedBgUrl || undefined,
          card_image_url: uploadedCardUrl || undefined,
          welcome_message: welcomeMessage.trim() || undefined,
          rules: rules.trim() || undefined,
        },
        tier
      );
      showToast({ title: '🎉 Oda Hazır!', message: `"${cleanName}" odası açıldı.`, type: 'success' });
      try { await GamificationService.onRoomCreate(firebaseUser.uid); } catch {}
      // ★ 2026-04-21: Başarılı oluşturma → draft temizle (tekrar açılışta eski state gelmesin)
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      setCreatedRoomId(room.id);
      setCreatedRoomName(cleanName);
      setShowInviteModal(true);
    } catch (err: any) {
      // ★ 2026-04-21: Detaylı hata gösterimi — "Hata" yerine kullanıcıya net neden bildir.
      const rawMsg = err?.message || 'Oda oluşturulamadı.';
      const friendly =
        /network|fetch|timeout/i.test(rawMsg) ? 'İnternet bağlantın yavaş veya yok. Tekrar dene.' :
        /permission|denied|rls/i.test(rawMsg) ? 'Yetki hatası. Lütfen tekrar giriş yap.' :
        /storage|bucket/i.test(rawMsg) ? 'Görsel yüklenemedi. Farklı bir resim seç veya internetini kontrol et.' :
        rawMsg;
      showToast({ title: 'Oda Açılamadı', message: friendly, type: 'error' });
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
      {/* ★ Oda adı — büyük, minimal, underline-only */}
      <View style={w.heroInputWrap}>
        <TextInput
          style={w.bigInput}
          placeholder="Odanın adını yaz..."
          placeholderTextColor="rgba(148,163,184,0.5)"
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoFocus
        />
        <View style={[w.heroInputLine, name.length > 0 && !nameValidation.ok && { backgroundColor: 'rgba(239,68,68,0.5)' }]} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* ★ 2026-04-21: Canlı hata geri bildirimi — küfür/uzunluk uyarısı */}
          {name.length > 0 && !nameValidation.ok && nameValidation.reason ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="alert-circle" size={11} color="#EF4444" />
              <Text style={{ fontSize: 11, color: '#EF4444' }}>{nameValidation.reason}</Text>
            </View>
          ) : <View />}
          <Text style={w.charCount}>{name.length}/60</Text>
        </View>
      </View>

      {/* ★ Açıklama — ince kenarlıklı, şeffaf */}
      <View style={{ marginTop: 32 }}>
        <Text style={w.sublabel}>Açıklama (opsiyonel)</Text>
        <TextInput
          style={w.mediumInput}
          placeholder="Bu oda neden var? Kısa bir özet..."
          placeholderTextColor="rgba(148,163,184,0.35)"
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
            <Pressable key={c.id} onPress={() => setCategory(c.id)} style={w.catCardWrap} android_ripple={{ color: 'transparent' }}>
              <View style={[w.catCard, active && { borderColor: c.color, borderWidth: 2 }]}>
                <Ionicons name={c.icon as any} size={30} color={c.color} style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }} />
              </View>
              <Text style={[w.catName, active && { color: '#FFF' }]}>{c.label}</Text>
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
            android_ripple={{ color: 'transparent' }}
          >
            {active && (
              <LinearGradient
                colors={['rgba(20,184,166,0.18)', 'rgba(6,95,86,0.08)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <Ionicons name={rt.icon as any} size={22} color={active ? Colors.teal : '#94A3B8'} style={{ marginRight: 2 }} />
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

      {/* ★ 2026-04-20: Dil filtresi (Plus+) — PlusMenu ile parite */}
      <View style={{ marginTop: 14 }}>
        <Text style={w.sublabel}>Dil filtresi</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'tr', label: '🇹🇷 TR' },
            { id: 'en', label: '🇬🇧 EN' },
            { id: 'ar', label: '🇸🇦 AR' },
            { id: 'de', label: '🇩🇪 DE' },
          ].map(lang => {
            const active = roomLanguage === lang.id;
            const locked = lang.id !== 'tr' && !isTierEnough(tier, 'Plus');
            return (
              <Pressable
                key={lang.id}
                onPress={() => { if (!locked) setRoomLanguage(lang.id); else UpsellService.onFeatureLocked(tier, 'Plus'); }}
                style={[{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: active ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 }, locked && { opacity: 0.5 }]}
              >
                {active ? (
                  <LinearGradient
                    colors={['#14B8A6', '#0D9488', '#065F56']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>{lang.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8' }}>{lang.label}</Text>
                    {locked && <Ionicons name="lock-closed" size={9} color="#F59E0B" />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ★ 2026-04-20: Yavaş Mod (Plus+) — mesajlar arası minimum saniye */}
      <View style={{ marginTop: 14 }}>
        <Text style={w.sublabel}>Yavaş mod (Plus+)</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[0, 5, 15, 30, 60].map(s => {
            const active = slowModeSeconds === s;
            const locked = s > 0 && !isTierEnough(tier, 'Plus');
            return (
              <Pressable
                key={s}
                onPress={() => { if (!locked) setSlowModeSeconds(s); else UpsellService.onFeatureLocked(tier, 'Plus'); }}
                style={[{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: active ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 }, locked && { opacity: 0.5 }]}
              >
                {active ? (
                  <LinearGradient
                    colors={['#14B8A6', '#0D9488', '#065F56']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>{s === 0 ? 'Kapalı' : `${s}s`}</Text>
                  </LinearGradient>
                ) : (
                  <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8' }}>{s === 0 ? 'Kapalı' : `${s}s`}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  // 4. KONUŞMA MODU
  const renderSpeaking = () => {
    // Seçilen moda göre "dinleyicinin ekranda ne göreceği" preview'u
    const preview = (() => {
      switch (speakingMode) {
        case 'free_for_all':
          return {
            icon: 'mic' as const, color: '#14B8A6',
            title: 'Dinleyici: 🎙️ Sahneye Çık butonu görür',
            body: 'Tek tıkla mikrofonu açar, onay gerekmez. Sen veya bir moderatör sahnedeyken otomatik olarak "el kaldırma" akışına döner — hiyerarşi korunur.',
          };
        case 'permission_only':
          return {
            icon: 'hand-left' as const, color: '#F59E0B',
            title: 'Dinleyici: ✋ El Kaldır butonu görür',
            body: 'İstek kuyruğa düşer, sen veya moderatörlerin onayıyla sahneye çıkar. Dinleyici sırasını ve kaç kişi olduğunu görebilir.',
          };
        case 'selected_only':
          return {
            icon: 'lock-closed' as const, color: '#64748B',
            title: 'Dinleyici: 🔒 Kilitli buton görür',
            body: 'Sadece sen "Sahneye Davet Et"le konuşmacı ekleyebilirsin. Dinleyiciler el kaldıramaz, "sahne kilitli" uyarısı görürler.',
          };
      }
    })();

    return (
      <View>
        {SPEAKING_MODES.map(sm => {
          const locked = !isTierEnough(tier, sm.minTier);
          const active = speakingMode === sm.id;
          return (
            <Pressable
              key={sm.id}
              onPress={() => { if (!locked) setSpeakingMode(sm.id as any); else UpsellService.onFeatureLocked(tier, sm.minTier as any); }}
              style={[w.accessRow, active && w.accessRowActive, locked && { opacity: 0.5 }]}
              android_ripple={{ color: 'transparent' }}
            >
              <Ionicons name={sm.icon as any} size={22} color={active ? Colors.teal : '#94A3B8'} style={{ marginRight: 2 }} />
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
        {/* ★ Seçilen moda göre "gelen kullanıcı ne görür?" preview — UX boşluğunu kapatır */}
        {preview && (
          <View style={{
            marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
            backgroundColor: `${preview.color}15`, borderWidth: 1, borderColor: `${preview.color}35`,
            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          }}>
            <View style={{
              width: 32, height: 32, borderRadius: 16, backgroundColor: `${preview.color}25`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={preview.icon} size={16} color={preview.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: preview.color, marginBottom: 3 }}>{preview.title}</Text>
              <Text style={{ fontSize: 11.5, color: 'rgba(226,232,240,0.75)', lineHeight: 16 }}>{preview.body}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

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
      {/* Kapak görseli (Kart) — 16:9 yatay, keşfet kartında gösterilir */}
      <Text style={w.sublabel}>Kart görseli (opsiyonel)</Text>
      <Text style={w.hint}>Keşfet akışında oda kartında görünür · 16:9 yatay</Text>
      <Pressable
        style={[w.cardImageBox, cardImage ? { borderColor: Colors.teal, borderStyle: 'solid' } : {}]}
        onPress={async () => {
          try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              showToast({ title: 'İzin Gerekli', message: 'Galeriye erişim izni verilmedi. Ayarlardan izin verebilirsin.', type: 'warning' });
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.8 });
            if (!result.canceled && result.assets?.[0]) setCardImage(result.assets[0].uri);
          } catch (e: any) {
            showToast({ title: 'Görsel seçilemedi', message: e?.message || 'Lütfen tekrar dene.', type: 'error' });
          }
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

      {/* ★ 2026-04-21: Oda içi ARKA PLAN görseli — 9:16 dikey, Plus+ üyelere açık.
         Önceden sadece state vardı UI yoktu → arka plan görseli hiç kayıt edilemiyordu.
         Oda içinde (SeatCard/ListenerGrid arkasında) gösterilir. */}
      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>Oda içi arka plan (opsiyonel · Plus)</Text>
        <Text style={w.hint}>Oda içinde dikey arka plan · 9:16 portrait</Text>
        {(() => {
          const locked = !isTierEnough(tier, 'Plus');
          return (
            <Pressable
              style={[w.cardImageBox, backgroundImage ? { borderColor: Colors.teal, borderStyle: 'solid' } : {}, locked && { opacity: 0.5 }]}
              onPress={async () => {
                if (locked) { UpsellService.onFeatureLocked(tier, 'Plus'); return; }
                try {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!perm.granted) {
                    showToast({ title: 'İzin Gerekli', message: 'Galeriye erişim izni verilmedi.', type: 'warning' });
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [9, 16], quality: 0.8 });
                  if (!result.canceled && result.assets?.[0]) setBackgroundImage(result.assets[0].uri);
                } catch (e: any) {
                  showToast({ title: 'Görsel seçilemedi', message: e?.message || 'Lütfen tekrar dene.', type: 'error' });
                }
              }}
            >
              {backgroundImage ? (
                <>
                  <Image source={{ uri: backgroundImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <Pressable onPress={() => setBackgroundImage('')} style={w.removeBtn}>
                    <Ionicons name="trash" size={14} color="#FFF" />
                  </Pressable>
                </>
              ) : (
                <View style={w.cardImagePlaceholder}>
                  <Ionicons name={locked ? 'lock-closed' : 'image-outline'} size={32} color={locked ? '#F59E0B' : 'rgba(255,255,255,0.3)'} />
                  <Text style={{ color: locked ? '#F59E0B' : 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>
                    {locked ? 'Plus üyelik gerekli' : 'Oda içinde arkada gösterilir'}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })()}
      </View>

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

      {/* ★ 2026-04-20: Müzik linki (Pro) — YouTube/Spotify/SoundCloud
         ★ 2026-04-21: URL regex validation eklendi; geçersiz linkte uyarı. */}
      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>Oda müzik linki (Pro)</Text>
        <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>
          YouTube / Spotify / SoundCloud linki yapıştır — odadakiler kendi platformlarında dinler.
        </Text>
        {(() => {
          const locked = !isTierEnough(tier, 'Pro');
          const musicInvalid = !!musicLink.trim() && !isValidMusicUrl(musicLink);
          return (
            <Pressable
              onPress={() => { if (locked) UpsellService.onFeatureLocked(tier, 'Pro'); }}
              style={{ opacity: locked ? 0.6 : 1 }}
            >
              <TextInput
                value={musicLink}
                onChangeText={(v) => { if (!locked) setMusicLink(v); }}
                editable={!locked}
                placeholder="https://youtube.com/... veya https://open.spotify.com/..."
                placeholderTextColor="#475569"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1,
                  borderColor: musicInvalid ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)',
                  paddingHorizontal: 12, paddingVertical: 10, color: '#E5E7EB', fontSize: 13,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {locked && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Ionicons name="lock-closed" size={11} color="#F59E0B" />
                  <Text style={{ fontSize: 11, color: '#F59E0B' }}>Pro üyelik gerekli</Text>
                </View>
              )}
              {!locked && musicInvalid && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Ionicons name="alert-circle" size={11} color="#EF4444" />
                  <Text style={{ fontSize: 11, color: '#EF4444' }}>Sadece YouTube, Spotify veya SoundCloud linki</Text>
                </View>
              )}
            </Pressable>
          );
        })()}
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
                android_ripple={{ color: 'transparent' }}
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
        android_ripple={{ color: 'transparent' }}
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
        android_ripple={{ color: 'transparent' }}
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

      {/* ★ 2026-04-20: +18 İçerik (Plus+) */}
      <Pressable
        onPress={() => { if (isTierEnough(tier, 'Plus')) setAgeRestricted(!ageRestricted); else UpsellService.onFeatureLocked(tier, 'Plus'); }}
        style={w.toggleRow}
        android_ripple={{ color: 'transparent' }}
      >
        <Ionicons name="warning" size={20} color={ageRestricted ? '#EF4444' : '#94A3B8'} />
        <View style={{ flex: 1 }}>
          <Text style={w.toggleLabel}>+18 İçerik</Text>
          <Text style={w.toggleDesc}>Yetişkinlere özel oda — 18 yaş altı giremez</Text>
        </View>
        {!isTierEnough(tier, 'Plus') ? (
          <View style={w.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={w.lockText}>Plus+</Text></View>
        ) : (
          <View style={[w.switchTrack, ageRestricted && w.switchTrackActive]}>
            <View style={[w.switchKnob, ageRestricted && w.switchKnobActive]} />
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

        {/* ★ 2026-04-21: Oda içi arka plan preview — Plus+ kullanıcıların yüklediği görsel
           review ekranında da görünsün (önceden hiç render edilmiyordu). */}
        {backgroundImage ? (
          <View style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', height: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Image source={{ uri: backgroundImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ position: 'absolute', left: 10, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="image" size={13} color="#FFF" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>Oda içi arka plan</Text>
            </View>
          </View>
        ) : null}

        {/* Özet satırları — profil arkadaşlar kartı ile aynı diagonal gradient stil */}
        <View style={w.summaryBlock}>
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <SummaryRow icon="mic" label="Konuşma" value={smObj?.label || ''} />
          {welcomeMessage && <SummaryRow icon="chatbubble-ellipses" label="Karşılama" value={welcomeMessage} />}
          {rules && <SummaryRow icon="document-text" label="Kurallar" value="Tanımlandı" />}
          {entryFee > 0 && <SummaryRow icon="diamond" label="Giriş" value={`${entryFee} SP`} />}
          {donationsEnabled && <SummaryRow icon="heart" label="Bağış" value="Aktif" />}
          {followersOnly && <SummaryRow icon="people" label="Erişim" value="Sadece arkadaşlar" />}
          {ageRestricted && <SummaryRow icon="warning" label="Yaş Sınırı" value="+18" />}
          {roomLanguage !== 'tr' && <SummaryRow icon="language" label="Dil" value={roomLanguage.toUpperCase()} />}
          {slowModeSeconds > 0 && <SummaryRow icon="timer" label="Yavaş Mod" value={`${slowModeSeconds}s`} />}
          {selectedTheme && <SummaryRow icon="color-palette" label="Tema" value={themeObj?.name || ''} />}
          {musicLink.trim() !== '' && <SummaryRow icon="musical-notes" label="Müzik Linki" value="Ekli" />}
          {backgroundImage && <SummaryRow icon="image" label="Arka Plan" value="Yüklendi" />}
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

  // ★ 2026-04-21: Günlük limit dolu ise wizard'ı hiç açma — kullanıcıyı 8 adım sonra
  //   "limit doldu" ile hayal kırıklığına uğratmayalım. Başta net upsell ekranı göster.
  if (dailyLimitReached) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={{ flex: 1 }} onPress={() => closeSheetRef.current()} />
        </Animated.View>
        <Animated.View style={[w.sheetPanel, { top: Math.max(insets.top, 20) + 10, transform: [{ translateY }] }]}>
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            locations={[0, 0.35, 1]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={{ flex: 1 }}>
              <View {...panResponder.panHandlers} style={w.sheetHandleWrap}>
                <View style={w.sheetHandleBar} />
              </View>
              <View style={[w.header, w.sheetHeader]}>
                <Pressable onPress={() => closeSheetRef.current()} style={w.iconBtn} hitSlop={8}>
                  <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
                </Pressable>
                <Text style={w.stepCounter}>Limit</Text>
                <View style={w.tierChip}><Text style={w.tierChipText}>{tier}</Text></View>
              </View>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
                <View style={{
                  width: 100, height: 100, borderRadius: 50,
                  backgroundColor: 'rgba(245,158,11,0.12)',
                  borderWidth: 2, borderColor: 'rgba(245,158,11,0.35)',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                }}>
                  <Ionicons name="hourglass" size={44} color="#F59E0B" />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#F1F5F9', marginBottom: 8, textAlign: 'center' }}>
                  Günlük Oda Limitin Doldu
                </Text>
                <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                  Bugün {limits.dailyRooms}/{limits.dailyRooms} oda açtın. Yarın sıfırlanacak — ya da üyeliğini yükselterek daha fazla oda aç.
                </Text>
                <Pressable
                  onPress={() => {
                    // ★ 2026-04-23: Önce sheet'i kapat, sonra /plus'a yönlendir.
                    //   UpsellService tetiklemeye gerek yok — kullanıcı zaten upgrade sayfasına gidiyor.
                    Animated.parallel([
                      Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
                      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                    ]).start(() => {
                      router.replace('/plus' as any);
                    });
                  }}
                  style={({ pressed }) => [{ width: '100%', borderRadius: 14, overflow: 'hidden' }, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient
                    colors={['#D4AF37', '#B45309']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="rocket" size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Üyeliğimi Yükselt</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => closeSheetRef.current()} style={{ marginTop: 12, paddingVertical: 12 }}>
                  <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>Geri Dön</Text>
                </Pressable>
              </View>
            </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* ★ Backdrop — tap to close, fade animation */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: backdropOpacity }]}
        pointerEvents="box-none"
      >
        <Pressable style={{ flex: 1 }} onPress={() => closeSheetRef.current()} />
      </Animated.View>

      {/* ★ Sheet panel — slides up, drag-to-close
           Tema: RoomChatDrawer ile bire bir — gri-gradient + #95a1ae border + subtle top shadow */}
      <Animated.View style={[w.sheetPanel, { top: Math.max(insets.top, 20) + 10, transform: [{ translateY }] }]}>
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          locations={[0, 0.35, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ flex: 1 }}>
          {/* ★ Drag handle — RoomChatDrawer stili (36x4, rgba(255,255,255,0.2)) */}
          <View {...panResponder.panHandlers} style={w.sheetHandleWrap}>
            <View style={w.sheetHandleBar} />
          </View>

          {/* ── HEADER ── subtle teal tint (DM drawer ile aynı) */}
          <View style={[w.header, w.sheetHeader]}>
            <Pressable onPress={prevStep} style={w.iconBtn} hitSlop={8}>
              <Ionicons name={stepIndex === 0 ? 'chevron-down' : 'chevron-back'} size={22} color="#F1F5F9" />
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
              onPress={() => {
                if (dailyLimitReached) {
                  // ★ 2026-04-23: Limit dolu → sheet kapan + /plus'a git
                  Animated.parallel([
                    Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
                    Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                  ]).start(() => router.replace('/plus' as any));
                } else {
                  handleCreate();
                }
              }}
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
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY ROW
// ═══════════════════════════════════════════════════════════════════
function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={w.summaryRow}>
      <Ionicons
        name={icon as any} size={14} color="#94A3B8"
        style={{ textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
      />
      <Text style={w.summaryLabel}>{label}</Text>
      <Text style={w.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STYLES — Apple-like wizard
// ═══════════════════════════════════════════════════════════════════
const w = StyleSheet.create({
  // ★ 2026-04-23: Sheet panel — RoomChatDrawer ile birebir görsel dil
  //   gri gradient LinearGradient dışarıdan; panel container'ı border/radius/shadow taşır.
  sheetPanel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#95a1ae',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetHandleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // Drawer header — subtle teal tint + bottom border (chat drawer ile aynı)
  sheetHeader: {
    paddingTop: 4, paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(20,184,166,0.06)',
  },
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
  stepCounter: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  tierChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  tierChipText: { fontSize: 11, fontWeight: '800', color: Colors.teal, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

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
    // ★ Ionicons optik kaymasını telafi — ikon tam merkeze oturur
    paddingLeft: 2, paddingTop: 1,
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
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroSubtitle: {
    fontSize: 14, color: 'rgba(203,213,225,0.75)',
    textAlign: 'center', marginTop: 10, lineHeight: 21,
    paddingHorizontal: 8,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ★ Hero input wrapper — oda adı alanı
  heroInputWrap: {
    alignItems: 'center',
  },
  // ★ Big input — step 1 oda adı (minimal underline, premium)
  bigInput: {
    fontSize: 22, fontWeight: '700', color: '#F1F5F9',
    paddingVertical: 14, paddingHorizontal: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
    width: '100%',
  } as any,
  // ★ Gradient underline efekti — teal glow
  heroInputLine: {
    width: '80%', height: 2, borderRadius: 1,
    backgroundColor: 'rgba(20,184,166,0.45)',
    marginTop: 2,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 2,
  } as any,
  mediumInput: {
    fontSize: 14, color: '#E2E8F0',
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 52, textAlignVertical: 'top',
    fontWeight: '500', lineHeight: 20,
  },
  charCount: { fontSize: 10, color: 'rgba(148,163,184,0.5)', textAlign: 'right', marginTop: 6, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  sublabel: { fontSize: 11, fontWeight: '800', color: 'rgba(203,213,225,0.85)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hint: { fontSize: 12, color: 'rgba(148,163,184,0.75)', marginBottom: 12, lineHeight: 17, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  // Kategori grid — koyu yumuşak dağılmış gölge
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  catCardWrap: {
    width: '26%',
    alignItems: 'center',
  },
  catCard: {
    width: '100%', aspectRatio: 1,
    backgroundColor: '#414E5F', borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(149,161,174,0.2)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  catName: {
    fontSize: 12, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.2,
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  categoryHint: {
    textAlign: 'center', fontSize: 12, color: 'rgba(203,213,225,0.65)',
    marginTop: 18, lineHeight: 18,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Erişim / speaking row — kart hissi derinlik
  accessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#414E5F', borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(149,161,174,0.2)',
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  accessRowActive: {
    borderColor: Colors.teal,
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

  // ★ 2026-04-21: Profil arkadaşlar kartı ile aynı diagonal gradient stil.
  //   backgroundColor kaldırıldı — LinearGradient absoluteFill ile zemin veriyor.
  summaryBlock: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: 16, gap: 12,
    ...Shadows.card,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryLabel: {
    fontSize: 12, color: 'rgba(203,213,225,0.75)', width: 90, fontWeight: '500',
    ...Shadows.text,
  },
  summaryValue: {
    flex: 1, fontSize: 13, fontWeight: '700', color: '#F1F5F9',
    ...Shadows.text,
  },

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
