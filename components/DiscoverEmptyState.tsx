/**
 * SopranoChat — Keşfet Boş Durum Ekranı
 * ═══════════════════════════════════════════════════════════════
 * v298 (17 May 2026) — Keşfet'te hiç oda yokken görünen "vasat" eski
 * empty state'in yerine premium tasarım:
 *
 *   1. Skia animated ses dalgası (yatay sinüs, fade-out kenarlar)
 *      — DiscoverWelcomeSheet'in gem hero'su ile ÇAKIŞMAZ (farklı motif).
 *   2. Kişiselleştirilmiş başlık (saat + online arkadaş sayısına göre).
 *   3. 4 "fikir kartı" — kategori değil, konsepsel hızlı başlangıç:
 *      🎬 Film / 🎵 Müzik / 🌶️ Yemek / 💭 Felsefi.
 *   4. Online arkadaş hint + gizlenen odalar restore link.
 *
 * Tasarım ilkesi: Tanıtım DEĞİL, AKSIYON. Kullanıcı uygulamayı biliyor
 * (DiscoverWelcomeSheet tarafında öğretildi); empty state "şimdi sen
 * başlat" davetini taşır.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { i18n } from '../services/i18n';

let SkiaMod: any = null;
try { SkiaMod = require('@shopify/react-native-skia'); } catch {}

const { width: SCREEN_W } = Dimensions.get('window');
const WAVE_W = Math.min(SCREEN_W - 32, 360);
const WAVE_H = 100;

interface Props {
  firebaseUser: any;
  onlineFriendsCount: number;
  ignoredCount: number;
  creatingRoom: boolean;
  onIdea: (categoryId: string) => void;
  onDetailedSetup: () => void;
  onRestoreHidden: () => void;
  onMessages: () => void;
  userName?: string;
}

// ═══════════════════════════════════════════════════════════════
// Saate göre selamlama (DiscoverWelcomeSheet'ten farklı, kısa + davet)
// ═══════════════════════════════════════════════════════════════
function getContextualHeadline(onlineFriends: number, userName?: string): { title: string; sub: string } {
  const hour = new Date().getHours();
  const name = userName ? `, ${userName.split(' ')[0]}` : '';

  // Önce sosyal kanıt (online arkadaş varsa)
  if (onlineFriends >= 5) {
    return {
      title: `${onlineFriends} arkadaşın online${name}`,
      sub: 'Sahne sessiz — onlar seni duymak ister.',
    };
  }
  if (onlineFriends >= 1) {
    return {
      title: `Arkadaşların burada${name}`,
      sub: 'İlk konuşan sen ol, sohbeti başlat.',
    };
  }

  // Zaman bazlı
  if (hour >= 5 && hour < 12) {
    return { title: `Günaydın${name}`, sub: 'Sabah enerjisi seninle başlasın.' };
  }
  if (hour >= 12 && hour < 18) {
    return { title: `Öğle molası${name}`, sub: 'Bir fincan sohbet ister misin?' };
  }
  if (hour >= 18 && hour < 22) {
    return { title: `İyi akşamlar${name}`, sub: 'Günü konuşarak kapat.' };
  }
  return { title: `Geceyi şenlendir${name}`, sub: 'Sahne boş, sen başla.' };
}

// ═══════════════════════════════════════════════════════════════
// SKIA SES DALGASI — Yatay sinüs, Reanimated UI thread (perf-safe)
// ═══════════════════════════════════════════════════════════════
let ReanimatedMod: any = null;
try { ReanimatedMod = require('react-native-reanimated'); } catch {}

function SoundWave() {
  // ★ v298.1 (17 May 2026): Önceki versiyonda phase.addListener + setState ile her
  //   tick'te (60fps) React re-render tetikleniyordu — ciddi CPU yükü. Şimdi
  //   Reanimated useSharedValue + useDerivedValue ile path UI thread'de hesaplanır,
  //   React state hiç değişmez. Skia'nın resmi pattern'i.
  const Reanimated = ReanimatedMod;
  const Skia = SkiaMod;

  // Skia yoksa fallback (3 paralel gradient çizgi — animsız)
  if (!Skia?.Skia) {
    return (
      <View style={{ width: WAVE_W, height: WAVE_H, alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map(i => (
          <LinearGradient
            key={i}
            colors={['transparent', 'rgba(20,184,166,0.5)', 'rgba(94,234,212,0.7)', 'rgba(20,184,166,0.5)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 2, width: WAVE_W - 40, marginVertical: 8, opacity: 0.4 + i * 0.2 }}
          />
        ))}
      </View>
    );
  }

  const SkiaNS = Skia.Skia;
  const { Canvas, Path, BlurMask, LinearGradient: SkLinearGradient, vec, Group } = Skia;

  // Reanimated yoksa Animated fallback (basitleştirilmiş, performance OK için Skia yok)
  if (!Reanimated?.useSharedValue) {
    return (
      <View style={{ width: WAVE_W, height: WAVE_H, alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map(i => (
          <LinearGradient
            key={i}
            colors={['transparent', 'rgba(20,184,166,0.5)', 'rgba(94,234,212,0.8)', 'rgba(20,184,166,0.5)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 2, width: WAVE_W - 40, marginVertical: 7, opacity: 0.4 + i * 0.2 }}
          />
        ))}
      </View>
    );
  }

  const { useSharedValue, withRepeat, withTiming, Easing: REasing } = Reanimated;
  const { usePathValue } = Skia; // ★ Skia 2.x resmi worklet-safe path hook
  const phase = useSharedValue(0);
  // ★ v1.7.13.127 (21 May 2026): Sürekli akıcı zaman — gif loop hissi yok.
  //   "time" tek bir uzun linear ramp, worklet içinde sin kombinasyonlarıyla
  //   modüle edilir. Sequence/withRepeat-restart yok → her döngü başlangıcı
  //   görünmez, dalgalar nefes alır gibi sürekli akar.
  const time = useSharedValue(0);

  useEffect(() => {
    // ★ Yumuşak akış hızı — burst zaten titreşim ekliyor, phase yavaş kalsın
    phase.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 2400, easing: REasing.linear }),
      -1,
      false,
    );
    // ★ Sürekli zaman — uzun linear, görünür restart yok
    time.value = withRepeat(
      withTiming(60, { duration: 60000, easing: REasing.linear }),
      -1,
      false,
    );
  }, []);

  // ★ Skia 2.x `usePathValue` — worklet-safe pattern.
  //   • Path objesi Skia internal olarak useMemo ile JS thread'de oluşturulur
  //   • Worklet callback'inde path.moveTo/lineTo ile mutate edilir (Path.Make worklet'te ÇAĞRILMAZ)
  //   • notifyChange Skia internal olarak çağrılır
  //   ESKİ KOD: worklet içinde `Skia.Path.Make()` → Skia 2.x'te crash ("animation.onStart undefined")
  // ★ v1.7.13.135 (21 May 2026): GERİ v298 — 3 teal/cyan ton, blur halo, sade akıcı.
  //   Kullanıcı: "sağdaki gibi (eski telefondaki) hali geri getir". 3 farklı renk
  //   (mor/pembe/teal) ABANDON edildi; tek aile (teal→cyan→beyaz) ton geçişi.
  const wave1 = usePathValue((path: any) => {
    'worklet';
    const cy = WAVE_H / 2;
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * WAVE_W;
      const y = cy + Math.sin((i / 40) * 2.5 * Math.PI * 2 + phase.value) * 16;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
  });
  const wave2 = usePathValue((path: any) => {
    'worklet';
    const cy = WAVE_H / 2 + 4;
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * WAVE_W;
      const y = cy + Math.sin((i / 40) * 3.2 * Math.PI * 2 + phase.value + Math.PI / 2) * 10;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
  });
  const wave3 = usePathValue((path: any) => {
    'worklet';
    const cy = WAVE_H / 2 - 6;
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * WAVE_W;
      const y = cy + Math.sin((i / 40) * 4.0 * Math.PI * 2 + phase.value + Math.PI) * 6;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
  });

  return (
    <View style={{ width: WAVE_W, height: WAVE_H, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={{ width: WAVE_W, height: WAVE_H }}>
        {/* ★ v1.7.13.135 (eski v298 hali): Tüm dalgalar teal/cyan ton ailesi + halo blur. */}
        {/* Arka katman — geniş yumuşak halo (fade edges) */}
        <Path path={wave1} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round">
          <SkLinearGradient
            start={vec(0, 0)} end={vec(WAVE_W, 0)}
            colors={['transparent', 'rgba(20,184,166,0.7)', 'rgba(20,184,166,0.85)', 'rgba(20,184,166,0.7)', 'transparent']}
            positions={[0, 0.18, 0.5, 0.82, 1]}
          />
          <BlurMask blur={12} style="normal" />
        </Path>
        {/* Orta katman — net dalga (fade edges agresif) */}
        <Group>
          <Path path={wave2} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round">
            <SkLinearGradient
              start={vec(0, 0)} end={vec(WAVE_W, 0)}
              colors={['transparent', 'rgba(20,184,166,0.85)', 'rgba(94,234,212,1)', 'rgba(20,184,166,0.85)', 'transparent']}
              positions={[0, 0.15, 0.5, 0.85, 1]}
            />
          </Path>
        </Group>
        {/* Üst katman — ince parlak beyaz parıltı (fade edges) */}
        <Group>
          <Path path={wave3} style="stroke" strokeWidth={1.5} strokeCap="round" strokeJoin="round">
            <SkLinearGradient
              start={vec(0, 0)} end={vec(WAVE_W, 0)}
              colors={['transparent', 'rgba(207,250,254,0.8)', 'transparent']}
              positions={[0, 0.5, 1]}
            />
          </Path>
        </Group>
      </Canvas>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// İDEA CARDS — Kategori değil, konsepsel hızlı başlangıç
// ═══════════════════════════════════════════════════════════════
const IDEAS: Array<{
  id: string;
  icon: any;
  title: string;
  prompt: string;
  color: string;
  bgFrom: string;
  bgTo: string;
  category: string;
}> = [
  {
    id: 'film',  icon: 'film-outline', title: 'Film & Dizi',
    prompt: 'Hangi diziyi bitirmeli?', color: '#A78BFA',
    bgFrom: 'rgba(167,139,250,0.18)', bgTo: 'rgba(167,139,250,0.05)',
    category: 'film',
  },
  {
    id: 'music', icon: 'musical-notes-outline', title: 'Müzik',
    prompt: 'Şu an dinlediğin?', color: '#EC4899',
    bgFrom: 'rgba(236,72,153,0.18)', bgTo: 'rgba(236,72,153,0.05)',
    category: 'music',
  },
  {
    id: 'chat', icon: 'chatbubbles-outline', title: 'Sohbet',
    prompt: 'Bugün moralın nasıl?', color: '#14B8A6',
    bgFrom: 'rgba(20,184,166,0.18)', bgTo: 'rgba(20,184,166,0.05)',
    category: 'chat',
  },
  {
    id: 'tech', icon: 'code-slash-outline', title: 'Teknoloji',
    prompt: 'Yeni keşif ne?', color: '#3B82F6',
    bgFrom: 'rgba(59,130,246,0.18)', bgTo: 'rgba(59,130,246,0.05)',
    category: 'tech',
  },
];

// ═══════════════════════════════════════════════════════════════
// ANA COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DiscoverEmptyState({
  firebaseUser, onlineFriendsCount, ignoredCount, creatingRoom,
  onIdea, onDetailedSetup, onRestoreHidden, onMessages, userName,
}: Props) {
  const headline = getContextualHeadline(onlineFriendsCount, userName);
  // Mount fade-in (premium hissi)
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.wrap, { opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      {/* Soft background halo (slate gradient — DiscoverWelcomeSheet gem'i ile çakışmaz) */}
      <LinearGradient
        colors={['rgba(20,184,166,0.10)', 'rgba(15,23,42,0.02)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Skia ses dalgası */}
      <View style={styles.waveSlot}>
        <SoundWave />
      </View>

      {/* Kişiselleştirilmiş başlık */}
      <Text style={styles.title} numberOfLines={2}>{headline.title}</Text>
      <Text style={styles.sub} numberOfLines={2}>{headline.sub}</Text>

      {/* Online arkadaş hint — sosyal kanıt + mesajlara link */}
      {onlineFriendsCount > 0 && (
        <Pressable onPress={onMessages} style={({ pressed }) => [styles.onlineHint, pressed && { opacity: 0.7 }]} hitSlop={6}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineHintText}>
            {onlineFriendsCount === 1
              ? '1 arkadaşın online · Mesaj at'
              : `${onlineFriendsCount} arkadaşın online · Mesaj at`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#5EEAD4" />
        </Pressable>
      )}

      {/* 4 fikir kartı */}
      {firebaseUser && (
        <View style={styles.ideaGrid}>
          {IDEAS.map(idea => (
            <Pressable
              key={idea.id}
              onPress={() => onIdea(idea.category)}
              disabled={creatingRoom}
              style={({ pressed }) => [
                styles.ideaCard,
                { borderColor: `${idea.color}55` },
                pressed && { transform: [{ scale: 0.97 }], borderColor: `${idea.color}99` },
                creatingRoom && { opacity: 0.5 },
              ]}
            >
              <LinearGradient
                colors={[idea.bgFrom, idea.bgTo]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name={idea.icon} size={20} color={idea.color} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.ideaTitle, { color: idea.color }]} numberOfLines={1}>{idea.title}</Text>
                <Text style={styles.ideaPrompt} numberOfLines={1}>{idea.prompt}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Detaylı kurulum linki */}
      <Pressable onPress={onDetailedSetup} style={({ pressed }) => [styles.detailedLink, pressed && { opacity: 0.6 }]} hitSlop={8}>
        <Ionicons name="options-outline" size={14} color="#94A3B8" />
        <Text style={styles.detailedLinkText}>Detaylı oda kurulumu</Text>
        <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
      </Pressable>

      {/* Gizlenen odalar — varsa restore link */}
      {ignoredCount > 0 && (
        <Pressable onPress={onRestoreHidden} style={({ pressed }) => [styles.hiddenHint, pressed && { opacity: 0.6 }]} hitSlop={8}>
          <Ionicons name="eye-outline" size={13} color="#FBBF24" />
          <Text style={styles.hiddenHintText}>
            {ignoredCount} gizli oda var · Geri getir
          </Text>
          <Ionicons name="refresh" size={11} color="#FBBF24" />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16, marginTop: 4,
    paddingTop: 14, paddingBottom: 16, paddingHorizontal: 14,
    borderRadius: 22, overflow: 'hidden',
    alignItems: 'center',
  },
  waveSlot: {
    height: WAVE_H,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 19, fontWeight: '800', color: '#F1F5F9',
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sub: {
    fontSize: 13, lineHeight: 18, color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4, marginBottom: 14,
    paddingHorizontal: 8,
  },
  onlineHint: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)',
    marginBottom: 14,
  },
  onlineDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
  },
  onlineHintText: {
    fontSize: 12, fontWeight: '700', color: '#86EFAC',
    letterSpacing: 0.2,
  },
  ideaGrid: {
    width: '100%',
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  ideaCard: {
    flexBasis: '48%',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1,
    minHeight: 56,
  },
  ideaTitle: {
    fontSize: 12, fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ideaPrompt: {
    fontSize: 10, color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  detailedLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 10,
    marginTop: 2,
  },
  detailedLinkText: {
    fontSize: 12, color: '#94A3B8', fontWeight: '600',
  },
  hiddenHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
    marginTop: 10,
  },
  hiddenHintText: {
    fontSize: 11, fontWeight: '700', color: '#FBBF24',
  },
});
