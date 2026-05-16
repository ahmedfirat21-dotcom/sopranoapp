// ★ 2026-04-21 (v2): Modern immersive onboarding — Duolingo/Spotify tarzı full-screen.
//   4 slide: hero pulse rings + stagger text + animated progress bar + sparkles.
//   Slide 4: SP Kazanç tanıtımı — WebView ile altın hexagon mücevher animasyonu.
//   AsyncStorage ile bir kez gösterilir (`soprano_discover_welcome_seen=1`).
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, Modal, Pressable, Dimensions, Animated, Easing,
  PanResponder, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
// ★ 2026-04-29: PulseRing/Sparkle component'leri ve eski iconBadge artık kullanılmıyor —
//   tüm slide'lar buildGemHtml ile WebView render'a geçti. Function tanımları lint
//   noise yaratıyor ama post-launch temizlik için bekletildi (bundle impact minimal).

const { width: W, height: H } = Dimensions.get('window');
// ★ 2026-04-22 FIX: Storage key VERSION BUMP (v2). Eski buggy kayıtlar
// (legacy fallback set ettiği UID key'ler) geçersiz olsun — uninstall gerekmez.
// v1: 'soprano_discover_welcome_seen' (global) + 'soprano_discover_welcome_seen_${uid}' (buggy fallback)
// v2: 'swv2_${uid}' — yalnızca finalize/skip ile set edilir, otomatik migrasyon yok.
const STORAGE_KEY_PREFIX = 'swv2';
const buildKey = (uid?: string | null) => uid ? `${STORAGE_KEY_PREFIX}_${uid}` : STORAGE_KEY_PREFIX;

type GemColors = {
  /** Üst parlaklık (highlight) — beyaza yakın */
  lightest: string;
  /** Açık ton (crown facet) */
  light: string;
  /** Ana ton (gem body) */
  mid: string;
  /** Koyu ton (pavilion shadow) */
  deep: string;
};

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent: string;
  accentDeep: string;
  bgFrom: string;
  bgTo: string;
  /** ★ 2026-04-29: Hexagon gem renk paleti (tüm slide'lar için zorunlu — uyum) */
  gemColors: GemColors;
  /** ★ 2026-04-29: Hexagon içine yazılacak text (örn "SP"); yoksa <Ionicons> overlay gösterilir */
  gemText?: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'mic',
    title: i18n.t('discoverwelcomesheet.001'),
    body: 'SopranoChat, anlık sesli sohbet odaları platformudur.\nKonuş, dinle, keşfet — hepsi gerçek zamanlı.',
    accent: '#14B8A6',
    accentDeep: '#0D9488',
    bgFrom: '#042F2E',
    bgTo: '#0A0F1A',
    gemColors: { lightest: '#CCFBF1', light: '#5EEAD4', mid: '#14B8A6', deep: '#134E4A' },
  },
  {
    icon: 'add-circle',
    title: i18n.t('discoverwelcomesheet.002'),
    body: 'Odalarım sekmesindeki "Yeni Oda Oluştur" düğmesiyle istediğin konuda oda aç.\nArkadaşlarını davet et, topluluğunu kur.',
    accent: '#F59E0B',
    accentDeep: '#B45309',
    bgFrom: '#3B2507',
    bgTo: '#0A0F1A',
    gemColors: { lightest: '#FFE4B5', light: '#FCD34D', mid: '#F59E0B', deep: '#78350F' },
  },
  {
    icon: 'radio',
    title: i18n.t('discoverwelcomesheet.003'),
    body: 'Canlı odaları kategoriye göre gez, popüler kullanıcıları keşfet.\nKatıl butonuyla anında sohbete dahil ol.',
    accent: '#8B5CF6',
    accentDeep: '#6D28D9',
    bgFrom: '#2E1065',
    bgTo: '#0A0F1A',
    gemColors: { lightest: '#EDE9FE', light: '#C4B5FD', mid: '#8B5CF6', deep: '#4C1D95' },
  },
  {
    icon: 'diamond',
    title: 'SP Kazan & Harca',
    body: 'Soprano Points (SP) ile hediye gönder, profilini öne çıkar.\nOda aç, sohbet et, arkadaş edin — her etkileşim SP kazandırır.',
    accent: '#F59E0B',
    accentDeep: '#92400E',
    bgFrom: '#451A03',
    bgTo: '#0A0F1A',
    gemColors: { lightest: '#FFE082', light: '#FAC775', mid: '#EF9F27', deep: '#854F0B' },
    gemText: 'SP',
  },
];

// ★ 2026-04-29: Generic gem hero HTML factory — tüm slide'lar için aynı animasyon
//   paketi (gem-float, shine-march, halo-breathe, ring-expand, orbit, ray-rotate,
//   star-twinkle, bg-shimmer, facet-bright). Slide-spesifik renkler ve içeriği
//   parametre olarak alır. SP_HEXAGON_HTML ile birebir aynı yapı, sadece gradient
//   ve içerik dinamik.
function buildGemHtml(c: GemColors, gemText?: string): string {
  const innerContent = gemText
    ? `<text x="100" y="112" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="500" fill="#1A1A1A">${gemText}</text>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center}svg{width:100%;height:100%}@keyframes gem-float{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-3px) rotate(1.5deg)}}@keyframes shine-march{0%{transform:translateX(-160px)}100%{transform:translateX(160px)}}@keyframes facet-bright{0%,100%{opacity:0.15}50%{opacity:0.55}}@keyframes facet-bright-2{0%,100%{opacity:0.4}50%{opacity:0.85}}@keyframes halo-breathe{0%,100%{opacity:0.25}50%{opacity:0.7}}@keyframes orbit-cw{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes orbit-ccw{0%{transform:rotate(360deg)}100%{transform:rotate(0deg)}}@keyframes ray-rotate{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes ring-expand{0%{opacity:0.9;transform:scale(0.85)}100%{opacity:0;transform:scale(1.45)}}@keyframes bg-shimmer{0%,100%{opacity:0.05}50%{opacity:0.18}}@keyframes star-twinkle-pop{0%,100%{opacity:0;transform:scale(0)}35%,65%{opacity:1;transform:scale(1)}}.gem-float{animation:gem-float 3s ease-in-out infinite;transform-origin:100px 100px;transform-box:view-box}.shine-band{animation:shine-march 3.2s ease-in-out infinite}.facet-1{animation:facet-bright 2.4s ease-in-out infinite}.facet-2{animation:facet-bright-2 2.8s ease-in-out infinite;animation-delay:0.4s}.facet-3{animation:facet-bright 3.2s ease-in-out infinite;animation-delay:0.8s}.facet-4{animation:facet-bright-2 2.6s ease-in-out infinite;animation-delay:1.2s}.star-1{animation:star-twinkle-pop 2.4s ease-in-out infinite;transform-origin:75px 60px;transform-box:view-box}.star-2{animation:star-twinkle-pop 2.8s ease-in-out infinite;animation-delay:0.6s;transform-origin:130px 80px;transform-box:view-box}.star-3{animation:star-twinkle-pop 2.2s ease-in-out infinite;animation-delay:1.1s;transform-origin:60px 100px;transform-box:view-box}.star-4{animation:star-twinkle-pop 3s ease-in-out infinite;animation-delay:1.6s;transform-origin:115px 120px;transform-box:view-box}.star-5{animation:star-twinkle-pop 2.6s ease-in-out infinite;animation-delay:0.3s;transform-origin:90px 55px;transform-box:view-box}.halo{animation:halo-breathe 3s ease-in-out infinite}.orbiter-cw{animation:orbit-cw 7s linear infinite;transform-origin:100px 100px;transform-box:view-box}.orbiter-ccw{animation:orbit-ccw 9s linear infinite;transform-origin:100px 100px;transform-box:view-box}.rays{animation:ray-rotate 18s linear infinite;transform-origin:100px 100px;transform-box:view-box}.ring-A{animation:ring-expand 2.6s ease-out infinite;transform-origin:100px 100px;transform-box:view-box}.ring-B{animation:ring-expand 2.6s ease-out infinite;animation-delay:1.3s;transform-origin:100px 100px;transform-box:view-box}.bg-glow{animation:bg-shimmer 4s ease-in-out infinite}</style></head><body><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g1" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="${c.lightest}"/><stop offset="35%" stop-color="${c.light}"/><stop offset="70%" stop-color="${c.mid}"/><stop offset="100%" stop-color="${c.deep}"/></linearGradient><linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.3"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient><radialGradient id="g4" cx="50%" cy="50%"><stop offset="0%" stop-color="${c.light}" stop-opacity="0.5"/><stop offset="100%" stop-color="${c.light}" stop-opacity="0"/></radialGradient><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFF" stop-opacity="0.65"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><clipPath id="c1"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72"/></clipPath></defs><g class="bg-glow"><circle cx="100" cy="100" r="90" fill="url(#g4)"/></g><g class="rays" opacity="0.22"><line x1="100" y1="18" x2="100" y2="34" stroke="${c.light}" stroke-width="1.5" stroke-linecap="round"/><line x1="100" y1="166" x2="100" y2="182" stroke="${c.light}" stroke-width="1.5" stroke-linecap="round"/><line x1="18" y1="100" x2="34" y2="100" stroke="${c.light}" stroke-width="1.5" stroke-linecap="round"/><line x1="166" y1="100" x2="182" y2="100" stroke="${c.light}" stroke-width="1.5" stroke-linecap="round"/><line x1="42" y1="42" x2="54" y2="54" stroke="${c.light}" stroke-width="1.2" stroke-linecap="round"/><line x1="146" y1="54" x2="158" y2="42" stroke="${c.light}" stroke-width="1.2" stroke-linecap="round"/><line x1="42" y1="158" x2="54" y2="146" stroke="${c.light}" stroke-width="1.2" stroke-linecap="round"/><line x1="146" y1="146" x2="158" y2="158" stroke="${c.light}" stroke-width="1.2" stroke-linecap="round"/></g><g class="halo"><polygon points="100,28 168,68 168,132 100,172 32,132 32,68" fill="none" stroke="${c.light}" stroke-width="0.7"/></g><polygon class="ring-A" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="${c.lightest}" stroke-width="1.5"/><polygon class="ring-B" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="${c.mid}" stroke-width="1.5"/><g class="gem-float"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72" fill="url(#g1)" stroke="${c.lightest}" stroke-width="1"/><g clip-path="url(#c1)"><polygon points="100,40 156,72 100,104 44,72" fill="url(#g2)" opacity="0.6"/><polygon points="156,72 156,128 130,100" fill="url(#g3)" opacity="0.7"/></g><polygon class="facet-1" points="100,40 130,57 100,74 70,57" fill="#FFF"/><polygon class="facet-2" points="100,40 70,57 44,72" fill="${c.lightest}"/><polygon class="facet-3" points="100,40 130,57 156,72" fill="${c.lightest}"/><polygon class="facet-4" points="44,72 70,90 70,110 44,128" fill="#000" opacity="0.25"/><g class="star-1"><path d="M75 60L76.2 63.8 80 65 76.2 66.2 75 70 73.8 66.2 70 65 73.8 63.8Z" fill="#FFF"/></g><g class="star-2"><path d="M130 80L131 83 134 84 131 85 130 88 129 85 126 84 129 83Z" fill="#FFF"/></g><g class="star-3"><circle cx="60" cy="100" r="1.5" fill="#FFF"/></g><g class="star-4"><circle cx="115" cy="120" r="1.2" fill="#FFF"/></g><g class="star-5"><circle cx="90" cy="55" r="1" fill="#FFF"/></g><g clip-path="url(#c1)"><rect class="shine-band" x="-30" y="20" width="50" height="160" fill="url(#g5)" transform="skewX(-15)"/></g>${innerContent}</g><g class="orbiter-cw"><circle cx="185" cy="100" r="2.5" fill="${c.lightest}"/></g><g class="orbiter-ccw"><circle cx="15" cy="100" r="2" fill="${c.light}" opacity="0.7"/></g></svg></body></html>`;
}

// ★ 2026-04-29: SP_HEXAGON_HTML SPHexagonIcon bileşenine taşındı (DRY).

export async function hasSeenDiscoverWelcome(uid?: string | null): Promise<boolean> {
  // ★ 2026-05-09: AsyncStorage + DB iki katmanlı kontrol. Hesap silinip aynı Google ile
  //   yeniden girildiğinde AsyncStorage flag aynı UID için kalıyordu (cihaz bazlı kalıntı).
  //   Artık DB profile.preferences.discover_welcome_seen de set olmalı; yoksa AsyncStorage
  //   hayalet sayılır ve sheet yeniden gösterilir.
  if (!uid) {
    try {
      const v = await AsyncStorage.getItem(buildKey(uid));
      return v === '1';
    } catch { return true; }
  }
  try {
    const local = await AsyncStorage.getItem(buildKey(uid));
    if (local !== '1') return false;
    // AsyncStorage seen diyor — DB ile teyit
    try {
      const { supabase } = await import('../constants/supabase');
      const { data } = await supabase.from('profiles').select('preferences').eq('id', uid).maybeSingle();
      const dbSeen = (data as any)?.preferences?.discover_welcome_seen === true;
      if (!dbSeen) {
        // DB temiz → AsyncStorage kalıntı, flag'i temizle ve sheet'i göster
        try { await AsyncStorage.removeItem(buildKey(uid)); } catch {}
        return false;
      }
      return true;
    } catch { return true; /* DB fail — AsyncStorage'a güven */ }
  } catch {
    return true;
  }
}

export async function markDiscoverWelcomeSeen(uid?: string | null) {
  try { await AsyncStorage.setItem(buildKey(uid), '1'); } catch {}
  if (!uid) return;
  try {
    const { supabase } = await import('../constants/supabase');
    const { data } = await supabase.from('profiles').select('preferences').eq('id', uid).maybeSingle();
    const prefs = { ...((data as any)?.preferences || {}), discover_welcome_seen: true };
    await supabase.from('profiles').update({ preferences: prefs }).eq('id', uid);
  } catch {}
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** ★ 2026-04-21: UID-bazlı "seen" işaretlemesi için */
  uid?: string | null;
};

// ────────────────────────────────────────────────────────────────
// Pulse ring — concentric expanding glow
// ────────────────────────────────────────────────────────────────
function PulseRing({ color, delay, size }: { color: string; delay: number; size: number }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.6, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.6, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1700, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(scale, { toValue: 0.5, duration: 1, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          width: size, height: size, borderRadius: size / 2,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// Sparkle — radial floating particle (slide tematiği ile)
// ────────────────────────────────────────────────────────────────
function Sparkle({ accent, index, iconName, iconSize }: {
  accent: string;
  index: number;
  iconName: keyof typeof Ionicons.glyphMap;
  iconSize: number;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const angle = (index / 6) * Math.PI * 2 + (Math.random() * 0.5);
    const radius = 90 + Math.random() * 40;
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius;
    const delay = index * 220;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateX, { toValue: tx, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: ty, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.delay(1200),
            Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(translateX, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.sparkle, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}
    >
      <Ionicons name={iconName} size={iconSize} color={accent} />
    </Animated.View>
  );
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────
export default function DiscoverWelcomeSheet({ visible, onClose, uid }: Props) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  // ★ v92.14 FLASH FIX: visible false→true geçişinde, ilk render eski index ile
  //   çıkmasın diye SENKRON reset. Klasik React "props değişikliğinde state reset"
  //   pattern'i — useEffect'tense erken; aksi halde 1 frame boyunca eski slide görünür.
  const prevVisibleRef = useRef(visible);
  if (visible && !prevVisibleRef.current && index !== 0) {
    setIndex(0);
  }
  prevVisibleRef.current = visible;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  // ★ 2026-04-29: Hero gem'i her slide change'inde alttan-fade ile yeniden gelsin
  const heroAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;

  const animateSlideIn = useCallback(() => {
    titleAnim.setValue(0);
    bodyAnim.setValue(0);
    iconScale.setValue(0);
    iconRotate.setValue(0);
    heroAnim.setValue(0);

    Animated.parallel([
      // Hero gem — alttan kayarak fade-in (her slide geçişinde)
      Animated.timing(heroAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      Animated.timing(iconRotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(titleAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(bodyAnim, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // ★ v92.14 (1 May 2026) FLASHBACK FIX:
  //   - Önceki kodda iki useEffect ([visible] + [index]) ikisi de animateSlideIn() çağırıyordu.
  //     visible=true olunca setIndex(0) + animateSlideIn() çalışıyor, sonra [index] effect'i
  //     de tetiklenip aynı anda 2. animateSlideIn() patlatıyordu → ekran flash, çift animasyon.
  //   - justOpenedRef ile [index] effect'i ilk açılışta atlanır; sadece kullanıcı next/prev
  //     yapınca yeni slide animasyonunu çalıştırır.
  const justOpenedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      justOpenedRef.current = true;
      setIndex(0);
      animateSlideIn();
      Animated.timing(progressAnim, { toValue: 1 / SLIDES.length, duration: 400, useNativeDriver: false }).start();

      // CTA subtle pulse loop — ★ 2026-04-21: amplitude 1.05 → 1.025 azaltıldı
      // (yüksek scale'de button edge'i shadow ile birleşip "çizgi" etkisi yaratıyordu)
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaPulse, { toValue: 1.025, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ctaPulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (justOpenedRef.current) {
      // İlk açılış — visible effect'i animasyonu zaten başlattı, atla
      justOpenedRef.current = false;
      return;
    }
    animateSlideIn();
    Animated.timing(progressAnim, {
      toValue: (index + 1) / SLIDES.length,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [index]);

  // ★ v92.14: markSeen async — onClose'tan ÖNCE await edilmeli, yoksa parent'in
  //   hasSeenDiscoverWelcome effect'i AsyncStorage write tamamlanmadan tekrar okur,
  //   false döner ve sheet ANINDA tekrar açılır (kullanıcı şikâyet ettiği "flashback").
  const next = async () => {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      await markDiscoverWelcomeSeen(uid);
      onClose();
    }
  };

  const prev = () => {
    if (index > 0) setIndex(index - 1);
  };

  const skip = async () => {
    await markDiscoverWelcomeSeen(uid);
    onClose();
  };

  // Horizontal swipe between slides
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -60) { // swipe left → next
          setIndex(i => Math.min(i + 1, SLIDES.length - 1));
        } else if (g.dx > 60) { // swipe right → prev
          setIndex(i => Math.max(i - 1, 0));
        }
      },
    }),
  ).current;

  const current = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const rotate = iconRotate.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] });

  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent onRequestClose={skip}>
      <View style={styles.root} {...panResponder.panHandlers}>
        {/* Dinamik arkaplan — slide accent'e göre */}
        <LinearGradient
          colors={[current.bgFrom, current.bgTo, '#050811']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Üst bar — progress + skip */}
        <View style={styles.topBar}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: current.accent,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  shadowColor: current.accent,
                },
              ]}
            />
          </View>
          <Pressable onPress={skip} hitSlop={14} style={styles.skipBtn}>
            <Text style={styles.skipText}>{i18n.t('discoverwelcomesheet.001')}</Text>
          </Pressable>
        </View>

        {/* ★ 2026-04-22: Hero + text + dots dikey merkez, CTA alt sabit
         *  Tüm içerik (animasyon + metin) ekranın ortasında hizalı, düğmeler altta. */}
        <View style={styles.centerBlock}>

        {/* ★ 2026-04-29: Hero alanı — tüm slide'lar aynı gem dilinde (renk ve içerik tematik).
            heroAnim ile her slide change'de alttan + fade-in yumuşak geçiş. */}
        <View style={styles.heroWrap}>
          <Animated.View
            style={[
              styles.spWebViewWrap,
              {
                opacity: heroAnim,
                transform: [
                  { translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                  { scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                ],
              },
            ]}
          >
            <WebView
              source={{ html: buildGemHtml(current.gemColors, current.gemText) }}
              style={styles.spWebView}
              scrollEnabled={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              setBuiltInZoomControls={false}
              javaScriptEnabled={true}
              originWhitelist={['*']}
              androidLayerType="hardware"
            />
            {/* SP slide'ında "SP" text'i HTML içinde; diğer slide'larda Ionicons overlay */}
            {!current.gemText && (
              <View pointerEvents="none" style={styles.gemIconOverlay}>
                <Ionicons name={current.icon} size={56} color="#FFF" style={{
                  textShadowColor: 'rgba(0,0,0,0.7)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 6,
                }} />
              </View>
            )}
          </Animated.View>
        </View>

        {/* Metin alanı — stagger entrance */}
        <View style={styles.textWrap}>
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
          >
            {current.title}
          </Animated.Text>
          <Animated.Text
            style={[
              styles.body,
              {
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            {current.body}
          </Animated.Text>

          {/* Feature chips — slide'a özel mini detaylar */}
          <Animated.View
            style={[
              styles.chipsRow,
              {
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              },
            ]}
          >
            {getSlideChips(index).map(chip => (
              <View key={chip.label} style={[styles.chip, { borderColor: current.accent + '44', backgroundColor: current.accent + '10' }]}>
                <Ionicons name={chip.icon} size={12} color={current.accent} />
                <Text style={[styles.chipText, { color: current.accent }]}>{chip.label}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Dots pagination */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setIndex(i)}
              style={[
                styles.dot,
                i === index && { backgroundColor: current.accent, width: 22, shadowColor: current.accent },
                i !== index && { backgroundColor: 'rgba(255,255,255,0.18)' },
              ]}
            />
          ))}
        </View>

        </View>{/* /centerBlock */}

        {/* CTA — Login sayfası buton stili (socialGradient pattern)
         *  ★ 2026-04-29 v4: İki tam genişlik buton — Sonraki/Başlayalım + Geri.
         *  Login'deki "Google ile Devam Et" ve "E-posta ile Giriş" yapısı. */}
        {/* ★ 2026-04-30 FIX: paddingBottom artırıldı — Android nav bar'ın arkasında kalmıyordu */}
        <View style={[styles.ctaRow, { paddingBottom: Math.max(Platform.OS === 'android' ? 64 : 24, insets.bottom + 24) }]}>
          {/* Ana CTA — accent renkli gradient */}
          <Animated.View style={styles.cta}>
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={next}
            >
              <LinearGradient
                colors={[current.accent, current.accentDeep]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.socialGradient}
              >
                <View style={styles.socialIconWrap}>
                  <Ionicons
                    name={isLast ? 'checkmark-circle' : 'arrow-forward-circle'}
                    size={20}
                    color="#FFF"
                  />
                </View>
                <Text style={styles.socialBtnText}>
                  {isLast ? 'Başlayalım' : 'Sonraki'}
                </Text>
                <Ionicons
                  name={isLast ? 'sparkles' : 'arrow-forward'}
                  size={18}
                  color="rgba(255,255,255,0.5)"
                  style={{ position: 'absolute', right: 16 }}
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Geri butonu — slide 2+ için glassmorphic secondary */}
          {index > 0 && (
            <Pressable
              onPress={prev}
              style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.socialGradientSecondary}
              >
                <View style={styles.socialIconWrapSecondary}>
                  <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
                </View>
                <Text style={styles.socialBtnTextSecondary}>{i18n.t('discoverwelcomesheet.002')}</Text>
                <Ionicons
                  name="return-down-back"
                  size={18}
                  color="rgba(255,255,255,0.25)"
                  style={{ position: 'absolute', right: 16 }}
                />
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

function getSlideChips(idx: number): { icon: keyof typeof Ionicons.glyphMap; label: string }[] {
  switch (idx) {
    case 0: return [
      { icon: 'radio', label: i18n.t('discoverwelcomesheet.004') },
      { icon: 'flash', label: i18n.t('discoverwelcomesheet.005') },
      { icon: 'people', label: 'Topluluk' },
    ];
    case 1: return [
      { icon: 'mic-circle', label: i18n.t('discoverwelcomesheet.006') },
      { icon: 'lock-closed', label: i18n.t('discoverwelcomesheet.007') },
      { icon: 'musical-notes', label: i18n.t('discoverwelcomesheet.008') },
    ];
    case 2: return [
      { icon: 'trending-up', label: i18n.t('discoverwelcomesheet.009') },
      { icon: 'sparkles', label: 'Yeni' },
      { icon: 'flame', label: i18n.t('discoverwelcomesheet.010') },
    ];
    case 3: return [
      { icon: 'gift', label: 'Hediye' },
      { icon: 'trophy', label: 'Seviye' },
      { icon: 'diamond', label: i18n.t('discoverwelcomesheet.011') },
    ];
    default: return [];
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 40, // ★ 54 → 40: üst boşluk azaltıldı, içerik ekrana sığsın
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    // ★ v92.23 (1 May 2026): Android elevation eklendi (progress bar glow için)
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  /** ★ 2026-04-22 v3: Hero + text + dots sarmalayıcı — dikey ortalanır */
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  heroWrap: {
    height: H * 0.28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  sparkle: {
    position: 'absolute',
  },
  iconBadge: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 26,
    elevation: 18,
  },
  iconGrad: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  textWrap: {
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 28,   // ★ 2026-04-22: 4 → 28 — metinler hero'ya daha yakın olsun diye çok yukarıdaydı
    marginBottom: 14, // ★ 10 → 14
  },
  title: {
    fontSize: 27,        // ★ 26 → 27
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 10,    // ★ 8 → 10
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  body: {
    fontSize: 14.5,      // ★ 14 → 14.5
    color: 'rgba(248,250,252,0.72)',
    textAlign: 'center',
    lineHeight: 21,      // ★ 20 → 21
    marginBottom: 14,    // ★ 12 → 14
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 14, // ★ 24 → 14
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 4,
    elevation: 3, // ★ v92.23 (1 May 2026): Android pagination dot glow için
  },
  ctaRow: {
    paddingHorizontal: 18,
    gap: 10,
    // ★ 2026-04-29 v4: Login sayfası buton stili — dikey gap ile iki buton
  },
  cta: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  // ★ 2026-04-29: Login sayfası "Google ile Devam Et" buton stili
  socialGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  socialIconWrap: {
    position: 'absolute',
    left: 14,
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  socialBtnText: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  // Secondary (Geri) — glassmorphic
  socialGradientSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  socialIconWrapSecondary: {
    position: 'absolute',
    left: 14,
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  socialBtnTextSecondary: {
    color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', letterSpacing: 0.3,
  },
  // ★ 2026-04-29: SP hexagon WebView container
  spWebViewWrap: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spWebView: {
    width: 240,
    height: 240,
    backgroundColor: 'transparent',
  },
  // ★ 2026-04-29: Gem hexagon üzerine slide tematik Ionicons overlay
  gemIconOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
