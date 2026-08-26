import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Image, Animated, Easing, Dimensions, PanResponder, InteractionManager, Platform, KeyboardAvoidingView } from 'react-native';
import AppLoader from '../components/AppLoader';

const { height: SCREEN_H } = Dimensions.get('window');
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GlowView, SkiaShadow } from '../components/skia';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { RoomService } from '../services/database';
import { getRoomLimits } from '../constants/tiers';
import type { TierName } from '../types';
import { GamificationService } from '../services/gamification';
import { Colors, Shadows } from '../constants/theme';
import { showToast } from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './_layout';
import { i18n, useTranslation } from '../services/i18n';
import { UpsellService } from '../services/upsell';
import { supabase } from '../constants/supabase';
import InviteFriendsModal from '../components/room/InviteFriendsModal';
import { PushService } from '../services/push';
import { RoomAccessService } from '../services/roomAccess';
import type { FollowUser } from '../services/friendship';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { containsBadWords } from '../constants/badwords';
import { AUDIENCE_OPTIONS, audienceModeToFields, getAudienceMode, type AudienceMode } from '../constants/audience';
import { TagService, normalizeTag, MAX_TAGS_PER_ROOM, SUGGESTED_TAGS } from '../services/tags';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

// ? 2026-04-21: Oda ad� sanitization � whitespace normalize, HTML strip, length cap.
//   K�f�r kontrol� ayr� (canProceed'de �al���yor).
function sanitizeRoomName(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')         // HTML taglar�n� kald�r
    .replace(/\s+/g, ' ')            // Ard���k whitespace'i tek bo�lu�a indir
    .trim()
    .slice(0, 60);                   // Max 60 karakter
}

// ? 2026-04-21: Draft save/restore � kullan�c� geri gidip kayboldu ya da crash olduysa
//   form kaybolmas�n. Ba�ar�l� olu�turmadan sonra draft temizlenir.
const DRAFT_KEY = 'soprano_create_room_draft_v1';

// ===================================================================
// Tema & Kategori sabitleri
// ===================================================================
const ROOM_THEMES: { id: string; name: string; colors: [string, string] }[] = [
  { id: 'ocean',   name: 'Okyanus',    colors: ['#0E4D6F', '#083344'] },
  { id: 'sunset',  name: i18n.t('createroom.004'), colors: ['#7F1D1D', '#4C0519'] },
  { id: 'forest',  name: 'Orman',      colors: ['#14532D', '#052E16'] },
  { id: 'galaxy',  name: 'Galaksi',    colors: ['#312E81', '#1E1B4B'] },
  { id: 'aurora',  name: 'Aurora',     colors: ['#134E4A', '#042F2E'] },
  { id: 'cherry',  name: 'Kiraz',      colors: ['#831843', '#500724'] },
  { id: 'cyber',   name: 'Cyber',      colors: ['#1E3A8A', '#172554'] },
  { id: 'volcano', name: 'Volkan',     colors: ['#7C2D12', '#431407'] },
];

// ? v1.7.13.116 (20 May 2026): TR k�lt�r paketi � yerel kategoriler eklendi.
//   T�rk Sanat M�zi�i, Arabesk, Halk M�zi�i, Pop & Rap; ek olarak Magazin, Spor,
//   Edebiyat, Tarih, Yemek, Sanat, Seyahat. Eski sade kategoriler korundu.
const CATEGORIES = [
  { id: 'chat',     labelKey: 'category.chat',           icon: 'chatbubbles',          color: '#14B8A6', descKey: 'create.cat.chat.desc' },
  { id: 'music',    labelKey: 'category.music',          icon: 'musical-notes',        color: '#8B5CF6', descKey: 'create.cat.music.desc' },
  { id: 'tsm',      labelKey: 'category.tsm',            icon: 'musical-note',         color: '#A78BFA', descKey: 'create.cat.tsm.desc' },
  { id: 'arabesk',  labelKey: 'category.arabesk',        icon: 'flame',                color: '#D97706', descKey: 'create.cat.arabesk.desc' },
  { id: 'halk',     labelKey: 'category.halk',           icon: 'musical-notes',        color: '#B45309', descKey: 'create.cat.halk.desc' },
  { id: 'pop',      labelKey: 'category.pop',            icon: 'mic',                  color: '#EC4899', descKey: 'create.cat.pop.desc' },
  { id: 'film',     labelKey: 'category.film',           icon: 'film',                 color: '#EC4899', descKey: 'create.cat.film.desc' },
  { id: 'magazin',  labelKey: 'category.magazin',        icon: 'star',                 color: '#FB7185', descKey: 'create.cat.magazin.desc' },
  { id: 'spor',     labelKey: 'category.spor',           icon: 'football',             color: '#10B981', descKey: 'create.cat.spor.desc' },
  { id: 'edebiyat', labelKey: 'category.edebiyat',       icon: 'book',                 color: '#F59E0B', descKey: 'create.cat.edebiyat.desc' },
  { id: 'tarih',    labelKey: 'category.tarih',          icon: 'library',              color: '#92400E', descKey: 'create.cat.tarih.desc' },
  { id: 'yemek',    labelKey: 'category.yemek',          icon: 'restaurant',           color: '#DC2626', descKey: 'create.cat.yemek.desc' },
  { id: 'game',     labelKey: 'category.game',           icon: 'game-controller',      color: '#EF4444', descKey: 'create.cat.game.desc' },
  { id: 'tech',     labelKey: 'create.cat.tech.label',   icon: 'code-slash',           color: '#3B82F6', descKey: 'create.cat.tech.desc' },
  { id: 'book',     labelKey: 'category.book',           icon: 'book',                 color: '#F59E0B', descKey: 'create.cat.book.desc' },
  { id: 'sanat',    labelKey: 'category.sanat',          icon: 'color-palette',        color: '#F97316', descKey: 'create.cat.sanat.desc' },
  { id: 'seyahat',  labelKey: 'category.seyahat',        icon: 'airplane',             color: '#0EA5E9', descKey: 'create.cat.seyahat.desc' },
  { id: 'other',    labelKey: 'create.cat.other.label',  icon: 'ellipsis-horizontal',  color: '#64748B', descKey: 'create.cat.other.desc' },
];

// ? 2026-04-25: ROOM_TYPES kald�r�ld� � constants/audience.ts AUDIENCE_OPTIONS

const SPEAKING_MODES = [
  { id: 'permission_only', labelKey: 'create.speak.permission.label', icon: 'hand-left',         descKey: 'create.speak.permission.desc', minTier: 'Free' as const },
  { id: 'selected_only',   labelKey: 'create.speak.selected.label',   icon: 'shield-checkmark',  descKey: 'create.speak.selected.desc',   minTier: 'Free' as const },
];

// ===================================================================
// Wizard ad�mlar�
// ===================================================================
type WizardStep = 'basics' | 'category' | 'access' | 'speaking' | 'welcome' | 'visual' | 'monetization' | 'review';

// ? Her ad�m i�in zengin metadata � gradient circle + icon + kendi tema rengi
interface StepMeta {
  id: WizardStep;
  /** i18n key � runtime'da t() ile �evrilir */
  titleKey: string;
  subtitleKey: string;
  icon: string;
  iconLib?: 'ionicons' | 'mci'; // material community icons alternatif
  gradient: [string, string, string];
  accent: string;
  watermark?: string; // arka plan soluk ikon (b�y�k)
  skippable?: boolean;
}

// ? 2026-05-05: Aile dili refactor � her step'in vibrant gradient'i KALDIRILDI.
//   T�m hero ikonlar profil sayfas� slate paleti ile (3a4658�2a3344�1a2030),
//   sadece accent rengi halo ring + icon tint olarak kal�yor. Rainbow � kohezyon.
const FAMILY_GRADIENT: [string, string, string] = ['#3a4658', '#2a3344', '#1a2030'];
const STEPS: StepMeta[] = [
  { id: 'basics',       titleKey: 'create.step.basics.title',       subtitleKey: 'create.step.basics.subtitle',
    icon: 'create-outline',        gradient: FAMILY_GRADIENT, accent: '#5EEAD4', watermark: 'sparkles' },
  { id: 'category',     titleKey: 'create.step.category.title',     subtitleKey: 'create.step.category.subtitle',
    icon: 'pricetags',             gradient: FAMILY_GRADIENT, accent: '#C084FC', watermark: 'grid' },
  { id: 'access',       titleKey: 'create.step.access.title',       subtitleKey: 'create.step.access.subtitle',
    icon: 'key',                   gradient: FAMILY_GRADIENT, accent: '#FBBF24', watermark: 'lock-closed' },
  { id: 'speaking',     titleKey: 'create.step.speaking.title',     subtitleKey: 'create.step.speaking.subtitle',
    icon: 'mic',                   gradient: FAMILY_GRADIENT, accent: '#5EEAD4', watermark: 'radio' },
  { id: 'welcome',      titleKey: 'create.step.welcome.title',      subtitleKey: 'create.step.welcome.subtitle',
    icon: 'hand-right',            gradient: FAMILY_GRADIENT, accent: '#F9A8D4', watermark: 'heart', skippable: true },
  { id: 'visual',       titleKey: 'create.step.visual.title',       subtitleKey: 'create.step.visual.subtitle',
    icon: 'color-palette',         gradient: FAMILY_GRADIENT, accent: '#A78BFA', watermark: 'image', skippable: true },
  { id: 'monetization', titleKey: 'create.step.monetization.title', subtitleKey: 'create.step.monetization.subtitle',
    icon: 'diamond',               gradient: FAMILY_GRADIENT, accent: '#FBBF24', watermark: 'cash', skippable: true },
  { id: 'review',       titleKey: 'create.step.review.title',       subtitleKey: 'create.step.review.subtitle',
    icon: 'rocket',                gradient: FAMILY_GRADIENT, accent: '#5EEAD4', watermark: 'checkmark-done' },
];

async function uploadRoomImage(userId: string, localUri: string, prefix: 'card' | 'bg'): Promise<string> {
  // ? 2026-04-21: fetch(file://) Android'de "Network request failed" veriyordu.
  //   StorageService.uploadFile do�ru y�ntemi kullan�r: ImageManipulator resize +
  //   FileSystem base64 read + ArrayBuffer decode + supabase upload.
  const { StorageService } = require('../services/storage');
  const path = `room-images/${userId}/${prefix}_${Date.now()}.jpg`;
  return await StorageService.uploadFile('post-images', path, localUri);
}

function isTierEnough(userTier: TierName, required: string): boolean {
  // ? v1.7.13.132: GodMaster kald�r�ld� � 3 tier
  const order = ['Free', 'Plus', 'Pro'];
  return order.indexOf(userTier) >= order.indexOf(required);
}

// ? 2026-04-21: M�zik linki validation � yaln�zca YouTube/Spotify/SoundCloud/YouTube Music.
//   Di�er URL'ler DB'ye yaz�lmas�n, hatal� yap��t�rmalar erkende yakalans�n.
const MUSIC_URL_REGEX = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com|open\.spotify\.com|spotify\.com|soundcloud\.com|m\.soundcloud\.com)\//i;
function isValidMusicUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true; // Bo� OK � opsiyonel alan
  return MUSIC_URL_REGEX.test(trimmed);
}

// ===================================================================
// MAIN COMPONENT
// ===================================================================
export default function CreateRoomScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { firebaseUser, profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  // ? v1.7.13.132: GodMaster kald�r�ld� � admin yetkisi Pro'ya y�kseltir
  const tier = (isAdmin ? 'Pro' : (profile?.subscription_tier || 'Free')) as TierName;
  const limits = useMemo(() => getRoomLimits(tier), [tier]);

  // �� Form state ��
  const [name, setName] = useState('');
  const [category, setCategory] = useState('chat');
  // ? 2026-04-25: Faz 4.3 � kategori alt� serbest etiketler (max 3, optional)
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  // ? 2026-04-25: Unified audience mode (public/followers/password/invite).
  //   Eski type + followersOnly state'leri tek select'e indi. Submit'te
  //   audienceModeToFields() ile backend kolonlar�na d�n��t�r�l�r.
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('public');
  const [mode, setMode] = useState<'audio' | 'video'>('audio');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [speakingMode, setSpeakingMode] = useState<'permission_only' | 'selected_only'>('permission_only');
  const [entryFee, setEntryFee] = useState(0);
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  // ? 2026-04-20: +18 oda kurulumda set edilebilsin (eskiden sonradan PlusMenu'den yapmak gerekiyordu)
  const [ageRestricted, setAgeRestricted] = useState(false);
  // ? 2026-04-20: Dil filtresi � Plus+ (PlusMenu ile parite)
  const [roomLanguage, setRoomLanguage] = useState<string>('tr');
  // ? 2026-04-20: Yava� mod � Plus+ moderasyon arac� (saniye cinsinden, 0 = kapal�)
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  // ? 2026-04-20: M�zik linki (Pro) � YouTube/Spotify/SoundCloud; herkes kendi platformunda dinler
  const [musicLink, setMusicLink] = useState<string>('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [cardImage, setCardImage] = useState('');
  // ? YEN�: welcome_message + rules (agent raporu eksik tespit etti)
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [rules, setRules] = useState('');

  // ? 2026-04-26: Planl� oda � opsiyonel ba�lang�� zaman�.
  //   null = hemen ba�lat (default). Date = belirtilen zamanda canl�ya ��k.
  //   ?schedule=1 query param'i varsa default 1 saat sonra setlenir (QuickCreateSheet "Planla" ak���).
  const searchParams = useLocalSearchParams<{ schedule?: string }>();
  const [scheduledAt, setScheduledAt] = useState<Date | null>(() => {
    if (searchParams?.schedule === '1') {
      const t = new Date();
      t.setHours(t.getHours() + 1, 0, 0, 0);
      return t;
    }
    return null;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [creating, setCreating] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomName, setCreatedRoomName] = useState('');
  // ? 2026-05-05: Caption odaya y�nlendirme param'�nda ge�iyor (oda i�inde g�sterilir)
  const [roomSuccessCaption, setRoomSuccessCaption] = useState(i18n.t('auto.create_room.027'));

  // �� Wizard state ��
  const [step, setStep] = useState<WizardStep>('basics');
  const stepIndex = STEPS.findIndex(s => s.id === step);
  const currentStepMeta = STEPS[stepIndex];
  const totalSteps = STEPS.length;

  // ============================================================
  // ? 2026-04-23: SHEET presentation � RoomChatDrawer pattern
  //   - Mount: translateY SCREEN_H � 0 (alt'tan yukar� kayar) + backdrop fade-in
  //   - Unmount: reverse, bitince router.back()
  //   - Handle drag: yukar�daki handle bar�ndan a�a�� s�r�kle � kapat
  //   - Minimize btn: header'daki chevron-down � kapat
  // ============================================================
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);

  // Router'a ba��ml� closeSheet � ref pattern ile panResponder stable kal�r
  const closeSheetRef = useRef<() => void>(() => {});
  closeSheetRef.current = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => safeGoBack(router));
  };

  // ? 2026-04-28: Clubhouse pattern � pan t�m wizard sheet'e ba�l�.
  //   Wizard i�eri�i de�i�ken (ScrollView/TextInput/...); capture e�i�i y�ksek (>25)
  //   tutularak k���k scroll/tap'ler engellenmez, belirgin a�a�� swipe sheet'i kapat�r.
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 25 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2,
    onPanResponderTerminationRequest: () => false,
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

  // ? 2026-04-21: Draft restore � wizard a��l���nda �nceki state varsa y�kle.
  //   file:// uri'leri AsyncStorage'a kaydetmiyoruz (cihaz-spesifik, crash olmu� olabilir).
  //   Yaln�zca form de�erleri.
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
        if (Array.isArray(d?.tags)) setTags(d.tags.slice(0, MAX_TAGS_PER_ROOM));
        // ? 2026-04-25: Unified audience � yeni draft `audienceMode`, eski draft `type+followersOnly`
        if (d?.audienceMode) {
          setAudienceMode(d.audienceMode);
        } else if (d?.type || typeof d?.followersOnly === 'boolean') {
          // Eski draft � unified mode'a d�n��t�r
          setAudienceMode(getAudienceMode({ type: d.type, followers_only: d.followersOnly, has_password: !!d.password }));
        }
        if (d?.description) setDescription(d.description);
        if (d?.speakingMode) setSpeakingMode(d.speakingMode);
        if (typeof d?.entryFee === 'number') setEntryFee(d.entryFee);
        if (typeof d?.donationsEnabled === 'boolean') setDonationsEnabled(d.donationsEnabled);
        if (typeof d?.ageRestricted === 'boolean') setAgeRestricted(d.ageRestricted);
        if (d?.roomLanguage) setRoomLanguage(d.roomLanguage);
        if (typeof d?.slowModeSeconds === 'number') setSlowModeSeconds(d.slowModeSeconds);
        if (d?.selectedTheme) setSelectedTheme(d.selectedTheme);
        if (d?.musicLink) setMusicLink(d.musicLink);
        if (d?.welcomeMessage) setWelcomeMessage(d.welcomeMessage);
        if (d?.rules) setRules(d.rules);
        // �ifre g�venlik sebebiyle restore edilmiyor
      } catch {}
      draftRestoredRef.current = true;
    })();
  }, []);

  // ? Draft save � form de�i�tik�e (restore sonras�) yaz. Debounce ile spam �nlenir.
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const t = setTimeout(() => {
      const draft = {
        name, category, tags, audienceMode, description, speakingMode, entryFee,
        donationsEnabled, ageRestricted, roomLanguage,
        slowModeSeconds, selectedTheme, musicLink, welcomeMessage, rules,
      };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [name, category, tags, audienceMode, description, speakingMode, entryFee, donationsEnabled,
      ageRestricted, roomLanguage, slowModeSeconds, selectedTheme,
      musicLink, welcomeMessage, rules]);

  // �� Slide animasyonu (step ge�i�i) ��
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
    else closeSheetRef.current(); // ? 2026-04-23: �lk step'te animasyonlu kapan��
  };

  // ? 2026-04-21: Oda ad� canl� validation � k�f�r + uzunluk check'i.
  const nameValidation = useMemo(() => {
    const sanitized = sanitizeRoomName(name);
    if (sanitized.length < 2) return { ok: false, reason: 'En az 2 karakter' };
    if (sanitized.length > 60) return { ok: false, reason: 'En fazla 60 karakter' };
    if (containsBadWords(sanitized)) return { ok: false, reason: i18n.t('auto.create_room.026') };
    return { ok: true, reason: null as string | null };
  }, [name]);

  // �� Ad�m ge�erlilik kontrol� (next butonu aktif mi?) ��
  const canProceed = useMemo(() => {
    switch (step) {
      case 'basics': return nameValidation.ok;
      case 'category': return !!category;
      case 'access': return audienceMode !== 'password' || password.trim().length >= 4;
      case 'speaking': return !!speakingMode;
      case 'welcome': return !containsBadWords(welcomeMessage) && !containsBadWords(rules);
      case 'visual': return isValidMusicUrl(musicLink);
      case 'monetization': return true; // opsiyonel
      case 'review': return true;
      default: return true;
    }
  }, [step, nameValidation.ok, category, audienceMode, password, speakingMode, welcomeMessage, rules, musicLink]);

  // �� Bug�nk� oda a�ma say�s� (g�ster �zet ekran�nda) ��
  const [todayRoomCount, setTodayRoomCount] = useState(0);
  useEffect(() => {
    if (!firebaseUser?.uid || limits.dailyRooms >= 999) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    (async () => {
      try {
        // ? v110.14: room_creation_log'tan say (oda silinince limit yenilenmesin)
        const { count } = await supabase.from('room_creation_log').select('id', { count: 'exact', head: true }).eq('user_id', firebaseUser.uid).gte('created_at', todayStart.toISOString());
        setTodayRoomCount(count || 0);
      } catch {}
    })();
  }, [firebaseUser?.uid, limits.dailyRooms]);

  // ? G�nl�k oda a�ma limiti dolu mu? (Pro/admin = 999, limitsiz)
  const dailyLimitReached = limits.dailyRooms < 999 && todayRoomCount >= limits.dailyRooms;

  // ===================================================================
  // ODA YARATMA
  // ===================================================================
  const handleCreate = async () => {
    if (!firebaseUser || creating) return;

    // ? 2026-04-25: audienceMode � backend type ile tier limit kontrol�
    const _audienceFields = audienceModeToFields(audienceMode, password);
    if (!limits.allowedTypes.includes(_audienceFields.type)) {
      showToast({ title: i18n.t('createroom.005'), message: i18n.t('createroom.006'), type: 'warning' });
      return;
    }
    if (limits.dailyRooms < 999 && todayRoomCount >= limits.dailyRooms) {
      UpsellService.onDailyRoomLimit(tier);
      showToast({ title: i18n.t('createroom.007'), message: i18n.t('auto.create_room.025', { 0: limits.dailyRooms }), type: 'warning' });
      return;
    }

    // ? 2026-04-21: M�zik linki son bir kontrol � canProceed'te yakalan�yor ama
    //   submit'e kadar geldiyse bir daha do�rula.
    if (musicLink.trim() && !isValidMusicUrl(musicLink)) {
      showToast({ title: i18n.t('createroom.008'), message: 'Sadece YouTube, Spotify veya SoundCloud linki kabul edilir.', type: 'error' });
      return;
    }

    setCreating(true);
    try {
      let uploadedCardUrl = '';
      let uploadedBgUrl = '';
      // ? 2026-04-21: Image upload error'lar� ayr� ayr� yakala � user net hata g�rs�n
      if (cardImage && cardImage.startsWith('file://')) {
        try {
          uploadedCardUrl = await uploadRoomImage(firebaseUser.uid, cardImage, 'card');
        } catch (e: any) {
          throw new Error(`Kart görseli yüklenemedi: ${e?.message || i18n.t('auto.create_room.024')}`);
        }
      }
      if (backgroundImage && backgroundImage.startsWith('file://')) {
        try {
          uploadedBgUrl = await uploadRoomImage(firebaseUser.uid, backgroundImage, 'bg');
        } catch (e: any) {
          throw new Error(`Arka plan görseli yüklenemedi: ${e?.message || i18n.t('auto.create_room.023')}`);
        }
      }

      // ? 2026-04-21: Sanitize + k�f�r kontrol� son bir defa
      const cleanName = sanitizeRoomName(name);
      if (cleanName.length < 2 || containsBadWords(cleanName)) {
        throw new Error(i18n.t('auto.create_room.022'));
      }

      // ? 2026-04-25: Unified audience � backend kolonlar�na d�n��t�r
      const audienceFields = audienceModeToFields(audienceMode, password);

      const room = await RoomService.create(
        firebaseUser.uid,
        {
          name: cleanName, category,
          type: audienceFields.type,
          description: description.trim() || undefined,
          mode,
          speaking_mode: speakingMode,
          room_password: audienceFields.room_password || undefined,
          entry_fee_sp: entryFee > 0 ? entryFee : undefined,
          donations_enabled: donationsEnabled || undefined,
          followers_only: audienceFields.followers_only || undefined,
          age_restricted: ageRestricted || undefined,
          room_language: roomLanguage !== 'tr' ? roomLanguage : undefined,
          slow_mode_seconds: slowModeSeconds > 0 ? slowModeSeconds : undefined,
          theme_id: selectedTheme || undefined,
          music_link: musicLink.trim() || undefined,
          room_image_url: uploadedBgUrl || undefined,
          card_image_url: uploadedCardUrl || undefined,
          welcome_message: welcomeMessage.trim() || undefined,
          rules: rules.trim() || undefined,
          scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
        },
        tier
      );
      // ? Faz 4.3 � etiketleri ayr� tabloda kaydet (best-effort, fire-and-forget)
      if (tags.length > 0) {
        TagService.setRoomTags(room.id, tags).catch(() => {});
      }
      const isScheduled = !!(scheduledAt && scheduledAt.getTime() > Date.now());
      // ? PERF FIX: fire-and-forget � SP hesaplama navigasyonu bloklamamal�
      GamificationService.onRoomCreate(firebaseUser.uid).catch(() => {});
      // ? 2026-04-21: Ba�ar�l� olu�turma � draft temizle (tekrar a��l��ta eski state gelmesin)
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      setCreatedRoomId(room.id);
      setCreatedRoomName(cleanName);
      // ? 2026-05-05: Overlay art�k oda i�inde g�steriliyor (kullan�c� yaz�y� g�rs�n diye).
      //   Davet modal� �nce a��l�r, oraya y�nlendirme room/[id]?justCreated=1 ile ge�er.
      setRoomSuccessCaption(isScheduled ? i18n.t('auto.create_room.021') : i18n.t('auto.create_room.020'));
      // ? PERF FIX: Modal a��l���n� bir sonraki frame'e erte
      requestAnimationFrame(() => setShowInviteModal(true));
    } catch (err: any) {
      // ? 2026-04-21: Detayl� hata g�sterimi � "Hata" yerine kullan�c�ya net neden bildir.
      const rawMsg = err?.message || i18n.t('auto.create_room.019');
      const friendly =
        /network|fetch|timeout/i.test(rawMsg) ? i18n.t('auto.create_room.018') :
        /permission|denied|rls/i.test(rawMsg) ? i18n.t('auto.create_room.017') :
        /storage|bucket/i.test(rawMsg) ? i18n.t('auto.create_room.016') :
        rawMsg;
      showToast({ title: i18n.t('createroom.009'), message: friendly, type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleInviteFriends = async (selectedUsers: FollowUser[]) => {
    if (!createdRoomId || !firebaseUser || !profile) return;
    const hostName = profile.display_name || 'Birisi';
    // ? PERF FIX: S�ral� (sequential) yerine paralel davet g�nderimi.
    // Eski kod: for-of + await � N ki�i � 4 DB sorgusu = s�ral� bekleme, FPS drop.
    // Yeni kod: Promise.allSettled ile t�m�n� ayn� anda g�nder.
    // ? Cache: inviterName + roomName bir kez hesaplan�p t�m �a�r�lara ge�irilir.
    const inviteCache = { inviterName: hostName, roomName: createdRoomName };
    const results = await Promise.allSettled(
      selectedUsers.map(async (user) => {
        const result = await RoomAccessService.inviteUser(createdRoomId, user.id, firebaseUser.uid, inviteCache);
        // Push notification fire-and-forget � sonucunu beklemeye gerek yok
        PushService.sendRoomInvite(user.id, hostName, createdRoomName, createdRoomId).catch(() => {});
        return result.success;
      })
    );
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    showToast({ title: i18n.t('createroom.010'), message: i18n.t('auto.create_room.015', { 0: successCount }), type: 'success' });
  };

  // ===================================================================
  // STEP RENDER'LARI
  // ===================================================================

  // 1. ODANIN ADI
  const renderBasics = () => (
    <View>
      {/* ? Oda ad� � b�y�k, minimal, underline-only */}
      <View style={w.heroInputWrap}>
        <TextInput
          style={w.bigInput}
          placeholder={t('create.room_name_placeholder')}
          placeholderTextColor="rgba(148,163,184,0.5)"
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoFocus
        />
        <View style={[w.heroInputLine, name.length > 0 && !nameValidation.ok && { backgroundColor: 'rgba(239,68,68,0.5)' }]} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* ? 2026-04-21: Canl� hata geri bildirimi � k�f�r/uzunluk uyar�s� */}
          {name.length > 0 && !nameValidation.ok && nameValidation.reason ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="alert-circle" size={11} color="#EF4444" />
              <Text style={{ fontSize: 11, color: '#EF4444' }}>{nameValidation.reason}</Text>
            </View>
          ) : <View />}
          <Text style={w.charCount}>{name.length}/60</Text>
        </View>
      </View>

      {/* ? A��klama � ince kenarl�kl�, �effaf */}
      <View style={{ marginTop: 32 }}>
        <Text style={w.sublabel}>{t('create.desc_label')}</Text>
        <TextInput
          style={w.mediumInput}
          placeholder={t('create.desc_placeholder')}
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

  // 2. KATEGOR� + ET�KETLER (Faz 4.3)
  const addTag = (raw: string) => {
    const norm = normalizeTag(raw);
    if (!norm) return;
    if (tags.includes(norm)) return;
    if (tags.length >= MAX_TAGS_PER_ROOM) {
      showToast({ title: `En fazla ${MAX_TAGS_PER_ROOM} etiket`, type: 'warning' });
      return;
    }
    setTags(prev => [...prev, norm]);
    setTagDraft('');
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

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
              <Text style={[w.catName, active && { color: '#FFF' }]}>{t(c.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>
      {category && (
        <Text style={w.categoryHint}>{(() => { const c = CATEGORIES.find(c => c.id === category); return c ? t(c.descKey) : ''; })()}</Text>
      )}

      {/* ? Faz 4.3 � Etiket chip input (max 3) */}
      <View style={w.tagSection}>
        <Text style={w.tagSectionLabel}>{i18n.t('createroom.001')}</Text>
        <Text style={w.tagSectionHint}>
          Odanı 2-30 karakterlik en fazla {MAX_TAGS_PER_ROOM} etiketle tarif et — keşfette aramayı kolaylaştırır.
        </Text>
        <View style={w.tagChipsRow}>
          {tags.map(t => (
            <Pressable key={t} onPress={() => removeTag(t)} style={w.tagChipActive}>
              <Text style={w.tagChipActiveText}>#{t}</Text>
              <Ionicons name="close" size={12} color="#F1F5F9" style={{ marginLeft: 4 }} />
            </Pressable>
          ))}
          {tags.length < MAX_TAGS_PER_ROOM && (
            <View style={w.tagInputWrap}>
              <Text style={w.tagInputHash}>#</Text>
              <TextInput
                value={tagDraft}
                onChangeText={setTagDraft}
                onSubmitEditing={() => addTag(tagDraft)}
                placeholder={t('create.tag_placeholder')}
                placeholderTextColor="rgba(148,163,184,0.5)"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                style={w.tagInput}
                returnKeyType="done"
              />
            </View>
          )}
        </View>
        {/* Suggestion chips */}
        {tags.length < MAX_TAGS_PER_ROOM && (
          <View style={w.tagSuggestRow}>
            {SUGGESTED_TAGS.filter(s => !tags.includes(s)).slice(0, 8).map(s => (
              <Pressable key={s} onPress={() => addTag(s)} style={w.tagChipSuggest}>
                <Text style={w.tagChipSuggestText}>+ {s}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  // 3. ER���M � unified audience select
  // ? 2026-04-25: 3 mod (open/closed/invite) + ayr� followers_only toggle yerine
  //   tek 4-modlu select. invite Plus+, di�erleri Free.
  const renderAccess = () => (
    <View>
      {AUDIENCE_OPTIONS.map(opt => {
        // ? 2026-04-27: 'invite' VE 'followers' modu Plus+ tier gerektiriyor.
        //   followers = "Sadece Arkada�lar" � premium oda y�netim arac�.
        const requiredTier: TierName | null = null;
        const locked = requiredTier ? !isTierEnough(tier, requiredTier) : false;
        const active = audienceMode === opt.mode;
        return (
          <Pressable
            key={opt.mode}
            onPress={() => {
              if (locked) {
                if (requiredTier) UpsellService.onRoomTypeLocked(tier, requiredTier as any);
                return;
              }
              setAudienceMode(opt.mode);
              // ? 2026-04-27: Audience moduna g�re yava� mod �ner � sadece kullan�c� default'taysa.
              //   �ifreli oda: 5sn (spam korumas�). Di�er modlar: 0sn (gerek yok).
              if (slowModeSeconds === 0 && opt.mode === 'password') {
                setSlowModeSeconds(5);
                showToast({ title: i18n.t('createroom.011'), message: i18n.t('createroom.012'), type: 'info' });
              }
            }}
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
            <Ionicons name={opt.icon} size={22} color={active ? Colors.teal : '#94A3B8'} style={{ marginRight: 2 }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[w.accessLabel, active && { color: Colors.teal }]}>{opt.label}</Text>
                {locked && requiredTier && (
                  <View style={w.lockBadge}>
                    <Ionicons name="lock-closed" size={9} color="#F59E0B" />
                    <Text style={w.lockText}>{requiredTier}+</Text>
                  </View>
                )}
              </View>
              <Text style={w.accessDesc}>{opt.description}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={22} color={Colors.teal} />}
          </Pressable>
        );
      })}

      {audienceMode === 'password' && (
        <View style={{ marginTop: 20 }}>
          <Text style={w.sublabel}>{i18n.t('createroom.002')}</Text>
          <TextInput
            style={w.mediumInput}
            placeholder={t('create.password_placeholder')}
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={password}
            onChangeText={setPassword}
            maxLength={20}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
      )}

      {/* ? 2026-04-20: Dil filtresi (Plus+) � PlusMenu ile parite */}
      <View style={{ marginTop: 14 }}>
        <Text style={w.sublabel}>Dil filtresi</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'tr', label: '???? TR' },
            { id: 'en', label: '???? EN' },
            { id: 'ar', label: '???? AR' },
            { id: 'de', label: '???? DE' },
          ].map(lang => {
            const active = roomLanguage === lang.id;
            // ? 2026-04-24: Dil filtresi Free'ye a��ld� � temel demografik tercih, tier-lock olmamal�
            const locked = false;
            return (
              <Pressable
                key={lang.id}
                onPress={() => { if (!locked) setRoomLanguage(lang.id); else UpsellService.onFeatureLocked(tier, 'Plus'); }}
                style={[{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: active ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 }, locked && { opacity: 0.5 }]}
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

      {/* ? 2026-04-24: Yava� Mod � Free'ye a��ld� (moderasyon herkese laz�m, spam'den korur) */}
      <View style={{ marginTop: 14 }}>
        <Text style={w.sublabel}>{i18n.t('createroom.003')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[0, 5, 15, 30, 60].map(s => {
            const active = slowModeSeconds === s;
            const locked = false;
            return (
              <Pressable
                key={s}
                onPress={() => { if (!locked) setSlowModeSeconds(s); else UpsellService.onFeatureLocked(tier, 'Plus'); }}
                style={[{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: active ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 }, locked && { opacity: 0.5 }]}
              >
                {active ? (
                  <LinearGradient
                    colors={['#14B8A6', '#0D9488', '#065F56']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>{s === 0 ? i18n.t('auto.create_room.014') : `${s}s`}</Text>
                  </LinearGradient>
                ) : (
                  <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8' }}>{s === 0 ? i18n.t('auto.create_room.013') : `${s}s`}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  // 4. KONU�MA MODU
  const renderSpeaking = () => {
    // Se�ilen moda g�re "dinleyicinin ekranda ne g�rece�i" preview'u
    const preview = (() => {
      switch (speakingMode) {
        case 'permission_only':
          return {
            icon: 'hand-left' as const, color: '#F59E0B',
            title: i18n.t('createroom.014'),
            body: i18n.t('auto.create_room.011'),
          };
        case 'selected_only':
          return {
            icon: 'lock-closed' as const, color: '#64748B',
            title: i18n.t('createroom.015'),
            body: i18n.t('auto.create_room.010'),
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
                  <Text style={[w.accessLabel, active && { color: Colors.teal }]}>{t(sm.labelKey)}</Text>
                  {locked && (
                    <View style={w.lockBadge}>
                      <Ionicons name="lock-closed" size={9} color="#F59E0B" />
                      <Text style={w.lockText}>{sm.minTier}+</Text>
                    </View>
                  )}
                </View>
                <Text style={w.accessDesc}>{t(sm.descKey)}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={22} color={Colors.teal} />}
            </Pressable>
          );
        })}
        {/* ? Se�ilen moda g�re "gelen kullan�c� ne g�r�r?" preview � UX bo�lu�unu kapat�r */}
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

  // 5. KAR�ILAMA (welcome + rules � opsiyonel)
  const renderWelcome = () => (
    <View>
      <Text style={w.sublabel}>{i18n.t('createroom.004')}</Text>
      <TextInput
        style={w.mediumInput}
        placeholder={t('create.welcome_placeholder')}
        placeholderTextColor="rgba(255,255,255,0.2)"
        value={welcomeMessage}
        onChangeText={setWelcomeMessage}
        maxLength={200}
        multiline
      />
      <Text style={[w.charCount, { marginTop: 4 }]}>{welcomeMessage.length}/200</Text>

      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>{i18n.t('createroom.005')}</Text>
        <TextInput
          style={[w.mediumInput, { height: 90 }]}
          placeholder={t('create.rules_placeholder')}
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

  // 6. G�RSEL
  const renderVisual = () => (
    <View>
      {/* Kapak g�rseli (Kart) � 16:9 yatay, ke�fet kart�nda g�sterilir
          ? v1.7.13.132: canCustomizeImage tier-gate eklendi (Plus+ gerek) */}
      <Text style={w.sublabel}>{i18n.t('createroom.006')}</Text>
      <Text style={w.hint}>{i18n.t('createroom.007')}</Text>
      {(() => { const cardLocked = !limits.canCustomizeImage; return (
      <Pressable
        style={[w.cardImageBox, cardImage ? { borderColor: Colors.teal, borderStyle: 'solid' } : {}, cardLocked && { opacity: 0.5 }]}
        onPress={async () => {
          if (cardLocked) { UpsellService.onFeatureLocked(tier, 'Plus'); return; }
          try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              showToast({ title: i18n.t('createroom.016'), message: i18n.t('createroom.017'), type: 'warning' });
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.8 });
            if (!result.canceled && result.assets?.[0]) setCardImage(result.assets[0].uri);
          } catch (e: any) {
            showToast({ title: i18n.t('createroom.018'), message: e?.message || i18n.t('auto.create_room.009'), type: 'error' });
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
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>{i18n.t('createroom.008')}</Text>
            {cardLocked && (
              <View style={[w.lockBadge, { marginTop: 8 }]}>
                <Ionicons name="lock-closed" size={9} color="#F59E0B" />
                <Text style={w.lockText}>Plus+</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
      ); })()}

      {/* ? 2026-04-21: Oda i�i ARKA PLAN g�rseli � 9:16 dikey, Plus+ �yelere a��k.
         �nceden sadece state vard� UI yoktu � arka plan g�rseli hi� kay�t edilemiyordu.
         Oda i�inde (SeatCard/ListenerGrid arkas�nda) g�sterilir. */}
      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>{i18n.t('createroom.009')}</Text>
        <Text style={w.hint}>{i18n.t('createroom.010')}</Text>
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
                    showToast({ title: i18n.t('createroom.019'), message: i18n.t('createroom.020'), type: 'warning' });
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [9, 16], quality: 0.8 });
                  if (!result.canceled && result.assets?.[0]) setBackgroundImage(result.assets[0].uri);
                } catch (e: any) {
                  showToast({ title: i18n.t('createroom.021'), message: e?.message || i18n.t('auto.create_room.008'), type: 'error' });
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
                    {locked ? i18n.t('auto.create_room.007') : i18n.t('auto.create_room.006')}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })()}
      </View>

      {/* Tema � ? v1.7.13.132: canCustomizeTheme tier-gate (Plus+ gerek) */}
      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={w.sublabel}>{i18n.t('createroom.011')}</Text>
          {!limits.canCustomizeTheme && (
            <View style={w.lockBadge}>
              <Ionicons name="lock-closed" size={9} color="#F59E0B" />
              <Text style={w.lockText}>Plus+</Text>
            </View>
          )}
        </View>
        <View style={[w.themeGrid, !limits.canCustomizeTheme && { opacity: 0.5 }]}>
          <Pressable
            onPress={() => { if (!limits.canCustomizeTheme) { UpsellService.onFeatureLocked(tier, 'Plus'); return; } setSelectedTheme(null); }}
            style={[w.themeCircle, !selectedTheme && { borderColor: Colors.teal }]}
          >
            <LinearGradient colors={['#0E1420', '#070B14']} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
          {ROOM_THEMES.map(t => (
            <Pressable
              key={t.id}
              onPress={() => { if (!limits.canCustomizeTheme) { UpsellService.onFeatureLocked(tier, 'Plus'); return; } setSelectedTheme(t.id); }}
              style={[w.themeCircle, selectedTheme === t.id && { borderColor: Colors.teal }]}
            >
              <LinearGradient colors={t.colors} style={StyleSheet.absoluteFillObject} />
              {selectedTheme === t.id && (
                <View style={w.themeCheck}><Ionicons name="checkmark" size={10} color="#FFF" /></View>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {/* ? 2026-04-20: M�zik linki (Pro) � YouTube/Spotify/SoundCloud
         ? 2026-04-21: URL regex validation eklendi; ge�ersiz linkte uyar�. */}
      <View style={{ marginTop: 24 }}>
        <Text style={w.sublabel}>{i18n.t('createroom.012')}</Text>
        <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>{i18n.t('createroom.001')}</Text>
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
                placeholder={t('create.music_link_placeholder')}
                placeholderTextColor="#475569"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 1,
                  borderColor: musicInvalid ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.10)',
                  paddingHorizontal: 14, paddingVertical: 12, color: '#E5E7EB', fontSize: 13,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {locked && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Ionicons name="lock-closed" size={11} color="#F59E0B" />
                  <Text style={{ fontSize: 11, color: '#F59E0B' }}>{i18n.t('createroom.013')}</Text>
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

  // 7. MONET�ZASYON
  const renderMonetization = () => (
    <View>
      {/* Giri� �creti */}
      <View>
        <Text style={w.sublabel}>{i18n.t('createroom.014')}</Text>
        <Text style={w.hint}>{i18n.t('createroom.015')}</Text>
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
                <Text style={[w.feePillText, active && { color: '#FFF' }]}>{fee === 0 ? i18n.t('auto.create_room.005') : `${fee} SP`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Ba��� */}
      <Pressable
        onPress={() => { if (isTierEnough(tier, 'Pro')) setDonationsEnabled(!donationsEnabled); else UpsellService.onFeatureLocked(tier, 'Pro'); }}
        style={[w.toggleRow, { marginTop: 24 }]}
        android_ripple={{ color: 'transparent' }}
      >
        <Ionicons name="heart" size={20} color={donationsEnabled ? '#EC4899' : '#94A3B8'} />
        <View style={{ flex: 1 }}>
          <Text style={w.toggleLabel}>{i18n.t('createroom.016')}</Text>
          <Text style={w.toggleDesc}>{i18n.t('createroom.017')}</Text>
        </View>
        {!isTierEnough(tier, 'Pro') ? (
          <View style={w.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={w.lockText}>Pro+</Text></View>
        ) : (
          <View style={[w.switchTrack, donationsEnabled && w.switchTrackActive]}>
            <View style={[w.switchKnob, donationsEnabled && w.switchKnobActive]} />
          </View>
        )}
      </Pressable>

      {/* ? 2026-04-25: "Sadece arkada�lar�m" toggle'� kald�r�ld� �
           audienceMode='followers' ile birle�tirildi (Eri�im ad�m�nda). */}

      {/* ? 2026-04-20: +18 ��erik (Plus+) */}
      <Pressable
        onPress={() => { if (isTierEnough(tier, 'Plus')) setAgeRestricted(!ageRestricted); else UpsellService.onFeatureLocked(tier, 'Plus'); }}
        style={w.toggleRow}
        android_ripple={{ color: 'transparent' }}
      >
        <Ionicons name="warning" size={20} color={ageRestricted ? '#EF4444' : '#94A3B8'} />
        <View style={{ flex: 1 }}>
          <Text style={w.toggleLabel}>{i18n.t('createroom.018')}</Text>
          <Text style={w.toggleDesc}>{i18n.t('createroom.019')}</Text>
        </View>
        {!isTierEnough(tier, 'Plus') ? (
          <View style={w.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={w.lockText}>Plus</Text></View>
        ) : (
          <View style={[w.switchTrack, ageRestricted && w.switchTrackActive]}>
            <View style={[w.switchKnob, ageRestricted && w.switchKnobActive]} />
          </View>
        )}
      </Pressable>
    </View>
  );

  // 8. �ZET
  const renderReview = () => {
    const themeObj = ROOM_THEMES.find(t => t.id === selectedTheme);
    const catObj = CATEGORIES.find(c => c.id === category);
    // ? 2026-04-25: typeObj � audienceObj (unified mode'dan label/icon)
    const audienceObj = AUDIENCE_OPTIONS.find(o => o.mode === audienceMode);
    const smObj = SPEAKING_MODES.find(s => s.id === speakingMode);

    return (
      <View>
        {/* B�y�k oda kart� �nizleme */}
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
          <Text style={w.reviewTitle} numberOfLines={2}>{name || i18n.t('auto.create_room.004')}</Text>
          {description ? <Text style={w.reviewDesc} numberOfLines={2}>{description}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {catObj && (
              <View style={[w.chipMini, { backgroundColor: `${catObj.color}22`, borderColor: `${catObj.color}55` }]}>
                <Ionicons name={catObj.icon as any} size={9} color={catObj.color} />
                <Text style={[w.chipMiniText, { color: catObj.color }]}>{t(catObj.labelKey)}</Text>
              </View>
            )}
            {audienceObj && audienceObj.mode !== 'public' && (
              <View style={w.chipMini}>
                <Ionicons name={audienceObj.icon} size={9} color="#94A3B8" />
                <Text style={w.chipMiniText}>{audienceObj.label}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ? 2026-04-21: Oda i�i arka plan preview � Plus+ kullan�c�lar�n y�kledi�i g�rsel
           review ekran�nda da g�r�ns�n (�nceden hi� render edilmiyordu). */}
        {backgroundImage ? (
          <View style={{ marginTop: 12, borderRadius: 14, overflow: 'hidden', height: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Image source={{ uri: backgroundImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ position: 'absolute', left: 10, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="image" size={13} color="#FFF" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>{i18n.t('createroom.020')}</Text>
            </View>
          </View>
        ) : null}

        {/* �zet sat�rlar� � profil arkada�lar kart� ile ayn� diagonal gradient stil */}
        <View style={w.summaryBlock}>
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* ? 2026-04-25: Audience �zeti � public d��� modlar g�ster */}
          {audienceMode !== 'public' && (
            <SummaryRow
              icon="lock-closed"
              label={i18n.t('createroom.022')}
              value={AUDIENCE_OPTIONS.find(o => o.mode === audienceMode)?.label || ''}
            />
          )}
          <SummaryRow icon="mic" label={t('create.step.speaking.title')} value={smObj ? t(smObj.labelKey) : ''} />
          {welcomeMessage && <SummaryRow icon="chatbubble-ellipses" label={i18n.t('createroom.023')} value={welcomeMessage} />}
          {rules && <SummaryRow icon="document-text" label="Kurallar" value={i18n.t('auto.create_room.003')} />}
          {entryFee > 0 && <SummaryRow icon="diamond" label={i18n.t('createroom.024')} value={`${entryFee} SP`} />}
          {donationsEnabled && <SummaryRow icon="heart" label={i18n.t('createroom.025')} value="Aktif" />}
          {ageRestricted && <SummaryRow icon="warning" label={i18n.t('createroom.026')} value="+18" />}
          {roomLanguage !== 'tr' && <SummaryRow icon="language" label="Dil" value={roomLanguage.toUpperCase()} />}
          {slowModeSeconds > 0 && <SummaryRow icon="timer" label={i18n.t('createroom.027')} value={`${slowModeSeconds}s`} />}
          {selectedTheme && <SummaryRow icon="color-palette" label="Tema" value={themeObj?.name || ''} />}
          {musicLink.trim() !== '' && <SummaryRow icon="musical-notes" label={i18n.t('createroom.028')} value="Ekli" />}
          {backgroundImage && <SummaryRow icon="image" label="Arka Plan" value={i18n.t('auto.create_room.002')} />}
        </View>

        {/* ? 2026-04-26: Planl� oda � hemen vs sonra ba�lat */}
        <View style={w.scheduleBlock}>
          <Text style={w.scheduleTitle}>{i18n.t('createroom.021')}</Text>
          <View style={w.scheduleToggleRow}>
            <Pressable
              onPress={() => setScheduledAt(null)}
              style={[w.scheduleToggle, !scheduledAt && w.scheduleToggleActive]}
            >
              <Ionicons name="flash" size={14} color={!scheduledAt ? Colors.teal : '#94A3B8'} />
              <Text style={[w.scheduleToggleText, !scheduledAt && { color: Colors.teal }]}>Hemen</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!scheduledAt) {
                  // Default: 1 saat sonra
                  const t = new Date();
                  t.setHours(t.getHours() + 1, 0, 0, 0);
                  setScheduledAt(t);
                }
              }}
              style={[w.scheduleToggle, !!scheduledAt && w.scheduleToggleActive]}
            >
              <Ionicons name="calendar" size={14} color={scheduledAt ? Colors.teal : '#94A3B8'} />
              <Text style={[w.scheduleToggleText, !!scheduledAt && { color: Colors.teal }]}>Sonra</Text>
            </Pressable>
          </View>
          {scheduledAt && (
            <View style={w.scheduleDateRow}>
              <Pressable onPress={() => setShowDatePicker(true)} style={w.scheduleDateBtn}>
                <Ionicons name="calendar-outline" size={14} color="#F1F5F9" />
                <Text style={w.scheduleDateText}>
                  {scheduledAt.toLocaleDateString(i18n.locale, { day: 'numeric', month: 'long', weekday: 'short' })}
                </Text>
              </Pressable>
              <Pressable onPress={() => setShowTimePicker(true)} style={w.scheduleDateBtn}>
                <Ionicons name="time-outline" size={14} color="#F1F5F9" />
                <Text style={w.scheduleDateText}>
                  {scheduledAt.toLocaleTimeString(i18n.locale, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </Pressable>
            </View>
          )}
          {scheduledAt && (
            <Text style={w.scheduleHint}>{i18n.t('createroom.002')}</Text>
          )}
          {showDatePicker && (
            <DateTimePicker
              value={scheduledAt || new Date()}
              mode="date"
              minimumDate={new Date()}
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowDatePicker(false);
                if (event.type === 'set' && date && scheduledAt) {
                  const merged = new Date(scheduledAt);
                  merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                  setScheduledAt(merged);
                }
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={scheduledAt || new Date()}
              mode="time"
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                setShowTimePicker(false);
                if (event.type === 'set' && date && scheduledAt) {
                  const merged = new Date(scheduledAt);
                  merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
                  setScheduledAt(merged);
                }
              }}
            />
          )}
        </View>

        <View style={w.capInfo}>
          <Ionicons name="people-circle" size={14} color={Colors.teal} />
          <Text style={w.capText}>Sahne: {limits.maxSpeakers} • Dinleyici: {limits.maxListeners}</Text>
        </View>
      </View>
    );
  };

  // Ad�m ad�m i�erik
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

  // ===================================================================
  // MAIN RENDER
  // ===================================================================

  // ? 2026-04-21: G�nl�k limit dolu ise wizard'� hi� a�ma � kullan�c�y� 8 ad�m sonra
  //   "limit doldu" ile hayal k�r�kl���na u�ratmayal�m. Ba�ta net upsell ekran� g�ster.
  if (dailyLimitReached) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.45)', opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={{ flex: 1 }} onPress={() => closeSheetRef.current()} />
        </Animated.View>
        <Animated.View
          style={[w.sheetPanel, { top: Math.max(insets.top, 20) + 10, transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          {/* ? 2026-05-05: Aile dili � slate + amber halo (limit semantik) */}
          <LinearGradient
            colors={['#3a4658', '#2a3344', '#1a2030']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.45 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={{ flex: 1 }}>
              {/* ? 2026-04-28: Handle art�k g�rsel � pan t�m sheet'te (Clubhouse). */}
              <View style={w.sheetHandleWrap}>
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
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#F1F5F9', marginBottom: 8, textAlign: 'center' }}>{i18n.t('createroom.003')}</Text>
                <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                  Oda oluşturma şu anda tamamlanamadı. Lütfen kısa süre sonra yeniden dene.
                </Text>
                <Pressable
                  onPress={() => {
                    Animated.parallel([
                      Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
                      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                    ]).start(() => closeSheetRef.current());
                  }}
                  style={({ pressed }) => [{ width: '100%', borderRadius: 14, overflow: 'hidden' }, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient
                    colors={['#D4AF37', '#B45309']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    <Ionicons name="refresh" size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>Daha Sonra Tekrar Dene</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => closeSheetRef.current()} style={{ marginTop: 12, paddingVertical: 12 }}>
                  <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '600' }}>{i18n.t('createroom.023')}</Text>
                </Pressable>
              </View>
            </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      {/* ? Backdrop � tap to close, fade animation (aile dim) */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.45)', opacity: backdropOpacity }]}
        pointerEvents="box-none"
      >
        <Pressable style={{ flex: 1 }} onPress={() => closeSheetRef.current()} />
      </Animated.View>

      {/* ? 2026-05-05: NotificationDrawer aile dili � slate diagonal + teal halo + soft glow */}
      <Animated.View
        style={[w.sheetPanel, { top: Math.max(insets.top, 20) + 10, transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={{ flex: 1 }}>
          {/* ? 2026-04-28: Handle art�k g�rsel � pan t�m sheet'te (Clubhouse). */}
          <View style={w.sheetHandleWrap}>
            <View style={w.sheetHandleBar} />
          </View>

          {/* �� HEADER �� subtle teal tint (DM drawer ile ayn�) */}
          <View style={[w.header, w.sheetHeader]}>
            <Pressable onPress={prevStep} style={w.iconBtn} hitSlop={8}>
              <Ionicons name={stepIndex === 0 ? 'chevron-down' : 'chevron-back'} size={22} color="#F1F5F9" />
            </Pressable>
            <Text style={w.stepCounter}>{stepIndex + 1} / {totalSteps}</Text>
            <View style={[w.tierChip, isAdmin && { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
              <Text style={[w.tierChipText, isAdmin && { color: '#EF4444' }]}>{isAdmin ? '?' : tier}</Text>
            </View>
          </View>

        {/* �� PROGRESS DOTS �� */}
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

        {/* �� CONTENT �� */}
        {/* ? Arka plan watermark � b�y�k soluk ikon (her step'e �zel) */}
        {currentStepMeta.watermark ? (
          <View pointerEvents="none" style={w.watermarkWrap}>
            <Ionicons name={currentStepMeta.watermark as any} size={280} color={currentStepMeta.accent} style={{ opacity: 0.04 }} />
          </View>
        ) : null}

        {/* ? v110.5.3: Klavye y�netimi � TextInput odaklan�nca scroll otomatik */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 160, paddingTop: 12 }}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
            {/* ? 2026-05-05: Hero icon � family slate base + accent halo ring (vibrant gradient yerine).
                 Step renkleri art�k SADECE accent ring + ikon tint olarak g�r�n�r (sade fark i�areti). */}
            <View style={w.heroIconWrap}>
              {/* ? v298.4 (17 May 2026): GlowView wrapper KALDIRILDI � position:absolute
                  inner View'a d���nce normal flow'a girip iconCircle'� kayd�r�yordu
                  (kullan�c� feedback: "duplicate icon g�r�nt�s�").
                  ��z�m: plain absolute View, sadece border ile accent vurgu (renkli
                  glow YOK � accent rengi border'�nda g�r�n�r, yeterince premium). */}
              <View style={[w.heroAccentRing, {
                borderColor: currentStepMeta.accent + '70',
              }]} pointerEvents="none" />
              <LinearGradient
                colors={currentStepMeta.gradient}
                start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
                style={[w.heroIconCircle, { borderColor: currentStepMeta.accent + '40' }]}
              >
                {/* �� par�lt� � �st beyaz, alt koyu � 3D derinlik (slate'te de i�e yarar) */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.10)', 'transparent', 'rgba(0,0,0,0.20)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name={currentStepMeta.icon as any} size={36} color={currentStepMeta.accent} />
              </LinearGradient>
            </View>

            {/* Hero Title + Subtitle � text shadow yok, sade */}
            <Text style={w.heroTitle}>{t(currentStepMeta.titleKey)}</Text>
            <Text style={w.heroSubtitle}>{t(currentStepMeta.subtitleKey)}</Text>

            {/* Step Content */}
            <View style={{ marginTop: 24 }}>
              {renderStepContent()}
            </View>
          </Animated.View>
        </ScrollView>
        </KeyboardAvoidingView>

        {/* �� FOOTER (Back / Skip / Next) �� */}
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
                  Animated.parallel([
                    Animated.timing(translateY, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
                    Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                  ]).start(() => closeSheetRef.current());
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
                  <AppLoader size="small" color="#FFF" />
                ) : dailyLimitReached ? (
                  <>
                    <Ionicons name="lock-closed" size={16} color="#FFF" />
                    <Text style={w.primaryBtnText}>{i18n.t('auto.create_room.001')}{todayRoomCount}/{limits.dailyRooms})</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="rocket" size={18} color="#FFF" />
                    <Text style={w.primaryBtnText}>{i18n.t('createroom.024')}</Text>
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
                <Text style={w.primaryBtnText}>{t('create.continue')}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* �� Davet Modal� (oda a��ld�ktan sonra) �� */}
        <InviteFriendsModal
          visible={showInviteModal}
          userId={firebaseUser?.uid || ''}
          roomId={createdRoomId || undefined}
          onClose={() => {
            setShowInviteModal(false);
            // ? PERF FIX: Modal kapan�� animasyonu bitene kadar navigasyonu ertele
            // Aksi halde room ekran� mount olurken modal fade-out �ak���r � FPS drop
            if (createdRoomId) {
              const cap = encodeURIComponent(roomSuccessCaption);
              InteractionManager.runAfterInteractions(() => {
                router.replace(`/room/${createdRoomId}?justCreated=1&caption=${cap}` as any);
              });
            }
          }}
          onInvite={async (selectedUsers) => {
            await handleInviteFriends(selectedUsers);
            setShowInviteModal(false);
            if (createdRoomId) {
              const cap = encodeURIComponent(roomSuccessCaption);
              InteractionManager.runAfterInteractions(() => {
                router.replace(`/room/${createdRoomId}?justCreated=1&caption=${cap}` as any);
              });
            }
          }}
        />
        </View>
      </Animated.View>

    </View>
  );
}

// ===================================================================
// SUMMARY ROW
// ===================================================================
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

// ===================================================================
// STYLES � Apple-like wizard
// ===================================================================
const w = StyleSheet.create({
  // ? 2026-05-05: NotificationDrawer aile standard� � radius 20�26, slate bg, gri border kald�r�ld�
  sheetPanel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetHandleBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // ? 2026-05-05: Aile dili � gradient halo zaten var, ekstra teal bg + border kald�r�ld�
  sheetHeader: {
    paddingTop: 4, paddingBottom: 12,
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

  // Progress dots � aktif olan tema rengiyle glow
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
    shadowOpacity: 0.35, shadowRadius: 6,
  },
  progressDotDone: {
    backgroundColor: 'rgba(20,184,166,0.5)',
  },

  // ? Hero � gradient circle + koyu yumu�ak da��lm�� g�lge
  heroIconWrap: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, marginTop: 8,
  },
  heroIconCircle: {
    width: 84, height: 84, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    // ? Ionicons optik kaymas�n� telafi � ikon tam merkeze oturur
    paddingLeft: 2, paddingTop: 1,
    // ? v298.2 (17 May 2026): RN shadow +  KALDIRILDI � Android'de
    //   dikd�rtgen native shadow �iziyordu. Cross-platform g�lge art�k parent
    //   SkiaShadow wrapper taraf�ndan y�netiliyor (BlurMask, hem iOS hem Android
    //   yumu�ak yuvarlak halo).
  },
  // ? 2026-05-05: Hero accent halo � slate dairenin etraf�nda step accent rengi soft glow.
  //   Family slate'i taban, accent ring step renk i�areti � rainbow yerine kohezyon.
  heroAccentRing: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 30,
    borderWidth: 1.2,
    // ? v298.2 (17 May 2026): Android  KALDIRILDI � GlowView wrapper
    //   colored shadow i�in Skia BlurMask kullan�r (RN elevation dikd�rtgen
    //   �iziyordu, halo ring'in rounded esteti�ini bozuyordu).
  },
  // Arka plan watermark � her step'e �zel b�y�k soluk ikon
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

  // ? Hero input wrapper � oda ad� alan�
  // ? 2026-05-05: Belirgin glass-pill � underline-only �ok soluktu, kullan�c� g�rm�yordu
  heroInputWrap: {
    alignItems: 'stretch',
  },
  bigInput: {
    fontSize: 22, fontWeight: '700', color: '#F1F5F9',
    paddingVertical: 18, paddingHorizontal: 20,
    textAlign: 'center',
    letterSpacing: 0.3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.45)',
    borderRadius: 22,
  } as any,
  // ? Gradient underline kald�r�ld� � pill kabuk yeterli g�rsel
  heroInputLine: {
    height: 0,
  } as any,
  mediumInput: {
    fontSize: 14, color: '#E2E8F0',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 80, textAlignVertical: 'top',
    fontWeight: '500', lineHeight: 20,
  },
  charCount: { fontSize: 10, color: 'rgba(148,163,184,0.5)', textAlign: 'right', marginTop: 6, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  sublabel: { fontSize: 11, fontWeight: '800', color: 'rgba(203,213,225,0.85)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  hint: { fontSize: 12, color: 'rgba(148,163,184,0.75)', marginBottom: 12, lineHeight: 17, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  // Kategori grid � koyu yumu�ak da��lm�� g�lge
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
    shadowOpacity: 0.4, shadowRadius: 14,
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
  // ? Faz 4.3 tag input
  tagSection: { marginTop: 22, paddingHorizontal: 8 },
  tagSectionLabel: {
    fontSize: 10, fontWeight: '900', color: '#5CBFB5',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
  },
  tagSectionHint: {
    fontSize: 11, color: 'rgba(148,163,184,0.7)',
    lineHeight: 15, marginBottom: 10,
  },
  tagChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center',
  },
  tagChipActive: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.4)',
  },
  tagChipActiveText: {
    fontSize: 12, fontWeight: '700', color: '#F1F5F9',
  },
  tagInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, minWidth: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  tagInputHash: { fontSize: 13, color: 'rgba(148,163,184,0.7)', marginRight: 2 },
  tagInput: {
    flex: 1, color: '#F1F5F9', fontSize: 12.5, fontWeight: '600',
    paddingVertical: 4, minHeight: 28,
  },
  tagSuggestRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10,
  },
  tagChipSuggest: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.8, borderColor: 'rgba(255,255,255,0.1)',
  },
  tagChipSuggestText: {
    fontSize: 10.5, fontWeight: '600', color: 'rgba(203,213,225,0.7)',
  },

  // Eri�im / speaking row � kart hissi derinlik
  accessRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#414E5F', borderRadius: 18,
    borderWidth: 1.5, borderColor: 'rgba(149,161,174,0.2)',
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6,
  },
  accessRowActive: {
    borderColor: Colors.teal,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14,
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

  // G�rsel
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
    shadowOpacity: 0.2, shadowRadius: 6,
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

  // Review � premium oda kart� �nizleme
  reviewCard: {
    height: 180, borderRadius: 22, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    padding: 18, justifyContent: 'flex-end',
    marginBottom: 18,
    // ? v298.3 (17 May 2026): RN shadow +  KALDIRILDI � Android'de
    //   dikd�rtgen native shadow oluyordu, fade transition'da iz b�rak�yordu.
    //   Border + inner gradient zaten yeterli derinlik veriyor.
  },
  reviewBadge: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(239,68,68,0.95)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    // ? v298.3: elevation kald�r�ld� (Android dikd�rtgen shadow iz b�rak�yordu).
  },
  reviewTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },
  reviewDesc: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 17 },
  chipMini: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(148,163,184,0.2)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.35)',
  },
  chipMiniText: { fontSize: 10, fontWeight: '700', color: '#E2E8F0' },

  // ? 2026-04-21: Profil arkada�lar kart� ile ayn� diagonal gradient stil.
  //   backgroundColor kald�r�ld� � LinearGradient absoluteFill ile zemin veriyor.
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

  // ? 2026-04-26: Planl� oda � Hemen / Sonra ba�lat
  scheduleBlock: {
    marginTop: 14, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  scheduleTitle: {
    fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase',
    color: '#94A3B8', marginBottom: 10,
  },
  scheduleToggleRow: { flexDirection: 'row', gap: 8 },
  scheduleToggle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  scheduleToggleActive: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: 'rgba(20,184,166,0.45)',
  },
  scheduleToggleText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  scheduleDateRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  scheduleDateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  scheduleDateText: { fontSize: 13, fontWeight: '700', color: '#F1F5F9' },
  scheduleHint: { fontSize: 11, color: '#94A3B8', marginTop: 8, lineHeight: 16 },

  // ? 2026-05-05: Aile dili � slate solid + ince �st separator
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 24, paddingTop: 12,
    backgroundColor: 'rgba(26,32,48,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  skipBtn: {
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
  },
  skipText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  // ? 2026-05-05: Aile dili � radius 14�999 (full pill, NotificationDrawer pattern)
  primaryBtn: {
    flex: 1, borderRadius: 999, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40, shadowRadius: 12,
  },
  primaryBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});
