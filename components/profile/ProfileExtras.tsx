/**
 * SopranoChat — Profil ekstra render component'leri
 * v110.5 (6 May 2026)
 *
 * VoiceBioPlayer, TopSupportersStrip, MutualRoomsStrip, FeaturedBadgesShowcase,
 * SocialLinksRow, InvitedByRow, SpeakingRhythmHint, VerifiedTick.
 *
 * Hepsi pasif render — data hazır gelir, hiçbir ek fetch yapmaz (parent
 * loadProfile içinde toplanır → "hepsi birlikte yüklen" mantığı korunur).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Linking, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Shadows, Colors } from '../../constants/theme';
import StatusAvatar from '../StatusAvatar';
import SPIcon from '../SPIcon';
import { BADGES } from '../../constants/badges';
import type { Supporter, MutualRoom } from '../../services/profileExtras';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

// ═══════════════════════════════════════════════════════════════════
// VoiceBioPlayer — Sesli tanıtım çalar
// ═══════════════════════════════════════════════════════════════════
type VoiceBioPlayerProps = {
  url: string;
  durationMs?: number | null;
};

export function VoiceBioPlayer({ url, durationMs }: VoiceBioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [loading, setLoading] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const wavePulse = useRef(new Animated.Value(1)).current;

  // Playback durumunda hafif pulse animasyonu
  useEffect(() => {
    if (!isPlaying) { wavePulse.stopAnimation(); wavePulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wavePulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(wavePulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPlaying]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const togglePlay = async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        return;
      }
      // İlk kez yükle
      setLoading(true);
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setIsPlaying(false);
            setProgress(0);
            soundRef.current?.setPositionAsync(0).catch(() => {});
          } else if (status.durationMillis && status.durationMillis > 0) {
            setProgress(Math.min(1, (status.positionMillis || 0) / status.durationMillis));
          }
        },
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (e) {
      // Playback başarısız — sessizce yutsuz
      setIsPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const durationLabel = durationMs ? `${Math.ceil(durationMs / 1000)}s` : '';

  return (
    <Pressable
      onPress={togglePlay}
      style={({ pressed }) => [vbp.wrap, pressed && { opacity: 0.85 }]}
      hitSlop={4}
    >
      <LinearGradient
        colors={['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.05)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[vbp.iconCircle, { transform: [{ scale: wavePulse }] }]}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={14}
          color="#FFF"
          style={iconShadow}
        />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={vbp.label}>SESLİ TANITIM</Text>
        <View style={vbp.progressBg}>
          <View style={[vbp.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <Text style={vbp.duration}>{durationLabel}</Text>
    </Pressable>
  );
}

const vbp = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
  },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6,
  },
  label: {
    fontSize: 9, fontWeight: '900' as const, color: '#FBBF24',
    letterSpacing: 1.2, marginBottom: 4,
    ...Shadows.text,
  },
  progressBg: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: '#FBBF24',
  },
  duration: {
    fontSize: 11, fontWeight: '800' as const, color: '#CBD5E1',
    letterSpacing: 0.3,
    minWidth: 26, textAlign: 'right' as const,
  },
});

// ═══════════════════════════════════════════════════════════════════
// TopSupportersStrip — En büyük destekçiler (3 avatar)
// ═══════════════════════════════════════════════════════════════════
type TopSupportersStripProps = {
  supporters: Supporter[];
  onSelectUser?: (userId: string) => void;
};

export function TopSupportersStrip({ supporters, onSelectUser }: TopSupportersStripProps) {
  if (!supporters || supporters.length === 0) return null;
  const total = supporters.reduce((s, x) => s + x.total_amount, 0);
  return (
    <View style={tss.wrap}>
      <LinearGradient
        colors={['#3a4658', '#2a3344', '#1a2030']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(251,191,36,0.6)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={tss.topEdge}
      />
      <View style={tss.header}>
        <Ionicons name="diamond" size={13} color="#FBBF24" style={iconShadow} />
        <Text style={tss.headerLabel}>TOP DESTEKÇİLER</Text>
        <View style={{ flex: 1 }} />
        <View style={tss.totalChip}>
          <SPIcon size={11} />
          <Text style={tss.totalText}>{total.toLocaleString('tr-TR')}</Text>
        </View>
      </View>
      <View style={tss.row}>
        {supporters.map((s, idx) => (
          <Pressable
            key={s.supporter_id}
            onPress={() => onSelectUser?.(s.supporter_id)}
            style={({ pressed }) => [tss.cell, pressed && { opacity: 0.7 }]}
          >
            {/* Sıralama madalyası */}
            <View style={[tss.medalAbs, idx === 0 ? tss.gold : idx === 1 ? tss.silver : tss.bronze]}>
              <Text style={tss.medalText}>{idx + 1}</Text>
            </View>
            <StatusAvatar
              uri={s.avatar_url || undefined}
              size={48}
              tier={s.subscription_tier as any}
              frameId={(s as any).active_frame}
            />
            <Text style={tss.name} numberOfLines={1}>
              {s.display_name}
            </Text>
            <View style={tss.amountChip}>
              <SPIcon size={9} />
              <Text style={tss.amountText}>
                {s.total_amount >= 1000
                  ? `${(s.total_amount / 1000).toFixed(1)}k`
                  : s.total_amount.toLocaleString('tr-TR')}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const tss = StyleSheet.create({
  wrap: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    paddingTop: 10, paddingBottom: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    ...Shadows.card,
  },
  topEdge: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  headerLabel: {
    fontSize: 10, fontWeight: '900' as const, color: '#FBBF24',
    letterSpacing: 1, ...Shadows.text,
  },
  totalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  totalText: {
    fontSize: 10, fontWeight: '800' as const, color: '#FBBF24', letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start',
  },
  cell: {
    alignItems: 'center', gap: 6, position: 'relative' as const,
    flex: 1,
  },
  medalAbs: {
    position: 'absolute' as const, top: -4, right: 8, zIndex: 3,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#1a2030',
  },
  gold:   { backgroundColor: '#FBBF24' },
  silver: { backgroundColor: '#94A3B8' },
  bronze: { backgroundColor: '#B45309' },
  medalText: {
    fontSize: 10, fontWeight: '900' as const, color: '#FFF', ...Shadows.text,
  },
  name: {
    fontSize: 11, fontWeight: '700' as const, color: '#E2E8F0',
    maxWidth: 90, textAlign: 'center' as const,
    ...Shadows.text,
  },
  amountChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  amountText: {
    fontSize: 9, fontWeight: '800' as const, color: '#FBBF24',
  },
});

// ═══════════════════════════════════════════════════════════════════
// MutualRoomsStrip — Ortak odalar (yatay scroll)
// ═══════════════════════════════════════════════════════════════════
type MutualRoomsStripProps = {
  rooms: MutualRoom[];
  onSelectRoom?: (roomId: string) => void;
};

export function MutualRoomsStrip({ rooms, onSelectRoom }: MutualRoomsStripProps) {
  if (!rooms || rooms.length === 0) return null;
  return (
    <View style={mrs.wrap}>
      <View style={mrs.header}>
        <Ionicons name="people-circle" size={14} color="#A78BFA" style={iconShadow} />
        <Text style={mrs.headerLabel}>
          {rooms.length === 1 ? 'Ortak oda' : `${rooms.length} ortak oda`}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mrs.scrollContent}
      >
        {rooms.map(r => (
          <Pressable
            key={r.room_id}
            onPress={() => onSelectRoom?.(r.room_id)}
            style={({ pressed }) => [mrs.chip, pressed && { opacity: 0.75 }]}
          >
            {r.is_live && <View style={mrs.liveDot} />}
            <Text style={mrs.chipText} numberOfLines={1}>{r.room_name}</Text>
            {r.is_persistent && <Ionicons name="trophy" size={10} color="#FBBF24" />}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const mrs = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 4, marginBottom: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 6,
  },
  headerLabel: {
    fontSize: 10, fontWeight: '700' as const, color: '#A78BFA',
    letterSpacing: 0.5, ...Shadows.text,
  },
  scrollContent: { gap: 6, paddingRight: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5.5,
    borderRadius: 999,
    backgroundColor: 'rgba(167,139,250,0.10)',
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
    maxWidth: 200,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 3,
  },
  chipText: {
    fontSize: 11, fontWeight: '700' as const, color: '#C4B5FD', letterSpacing: 0.2,
    flexShrink: 1,
  },
});

// ═══════════════════════════════════════════════════════════════════
// FeaturedBadgesShowcase — 3 öne çıkan rozet (büyük)
// ═══════════════════════════════════════════════════════════════════
type FeaturedBadgesShowcaseProps = {
  featuredIds: string[];
  onPress?: (badgeId: string) => void;
};

export function FeaturedBadgesShowcase({ featuredIds, onPress }: FeaturedBadgesShowcaseProps) {
  const defs = featuredIds.map(id => BADGES[id]).filter(Boolean);
  if (defs.length === 0) return null;
  return (
    <View style={fbs.wrap}>
      <View style={fbs.header}>
        <Ionicons name="ribbon" size={13} color="#FBBF24" style={iconShadow} />
        <Text style={fbs.headerLabel}>ÖNE ÇIKAN ROZETLER</Text>
      </View>
      <View style={fbs.row}>
        {defs.map(d => (
          <Pressable
            key={d.id}
            onPress={() => onPress?.(d.id)}
            style={({ pressed }) => [fbs.cell, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
          >
            <LinearGradient
              colors={[d.color + 'CC', d.color + '55']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={fbs.iconCircle}
            >
              <Ionicons name={d.icon as any} size={26} color="#FFF" style={iconShadow} />
            </LinearGradient>
            <Text style={[fbs.label, { color: d.color }]} numberOfLines={1}>{d.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const fbs = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 4, marginBottom: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 10, fontWeight: '900' as const, color: '#FBBF24',
    letterSpacing: 1, ...Shadows.text,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-around', gap: 10,
  },
  cell: {
    alignItems: 'center', gap: 6, flex: 1,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)',
    ...Shadows.card,
  },
  label: {
    fontSize: 10, fontWeight: '800' as const,
    letterSpacing: 0.3, textAlign: 'center' as const,
    maxWidth: 100,
    ...Shadows.text,
  },
});

// ═══════════════════════════════════════════════════════════════════
// SocialLinksRow — IG/X/web küçük butonlar
// ═══════════════════════════════════════════════════════════════════
type SocialLinksRowProps = {
  links: { instagram?: string; twitter?: string; website?: string } | null | undefined;
};

const _normalizeUrl = (raw: string, prefix: string) => {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  // @username -> prefix + username
  return prefix + s.replace(/^@/, '');
};

export function SocialLinksRow({ links }: SocialLinksRowProps) {
  if (!links) return null;
  const ig = links.instagram ? _normalizeUrl(links.instagram, 'https://instagram.com/') : null;
  const tw = links.twitter ? _normalizeUrl(links.twitter, 'https://x.com/') : null;
  const web = links.website ? _normalizeUrl(links.website, 'https://') : null;
  if (!ig && !tw && !web) return null;

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={sls.wrap}>
      {ig && (
        <Pressable onPress={() => open(ig)} style={({ pressed }) => [sls.btn, sls.igBg, pressed && { opacity: 0.7 }]} hitSlop={6}>
          <Ionicons name="logo-instagram" size={16} color="#E1306C" style={iconShadow} />
        </Pressable>
      )}
      {tw && (
        <Pressable onPress={() => open(tw)} style={({ pressed }) => [sls.btn, sls.twBg, pressed && { opacity: 0.7 }]} hitSlop={6}>
          {/* ★ v110.5.2: X (Twitter) — Ionicons'ta logo-x yok, custom Text glyph */}
          <Text style={sls.xGlyph}>𝕏</Text>
        </Pressable>
      )}
      {web && (
        <Pressable onPress={() => open(web)} style={({ pressed }) => [sls.btn, sls.webBg, pressed && { opacity: 0.7 }]} hitSlop={6}>
          <Ionicons name="globe-outline" size={16} color="#14B8A6" style={iconShadow} />
        </Pressable>
      )}
    </View>
  );
}

const sls = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 6, marginBottom: 4,
  },
  btn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  igBg: { backgroundColor: 'rgba(225,48,108,0.10)' },
  // ★ v110.5.2: X — siyah/beyaz, modern Twitter rebrand
  twBg: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.18)' },
  webBg: { backgroundColor: 'rgba(20,184,166,0.10)' },
  xGlyph: {
    fontSize: 14, fontWeight: '900' as const, color: '#F1F5F9',
    letterSpacing: 0.3,
    ...iconShadow,
  },
});

// ═══════════════════════════════════════════════════════════════════
// InvitedByRow — Davet eden bilgisi
// ═══════════════════════════════════════════════════════════════════
type InvitedByRowProps = {
  inviterName: string;
  inviterAvatar?: string | null;
  inviterId: string;
  onPress?: (userId: string) => void;
};

export function InvitedByRow({ inviterName, inviterAvatar, inviterId, onPress }: InvitedByRowProps) {
  return (
    <Pressable
      onPress={() => onPress?.(inviterId)}
      style={({ pressed }) => [ibr.wrap, pressed && { opacity: 0.75 }]}
      hitSlop={4}
    >
      <Ionicons name="person-add-outline" size={12} color="#94A3B8" style={iconShadow} />
      <Text style={ibr.text}>
        <Text style={ibr.dim}>Davet eden: </Text>
        <Text style={ibr.bold}>{inviterName}</Text>
      </Text>
      <Ionicons name="chevron-forward" size={12} color="rgba(148,163,184,0.6)" />
    </Pressable>
  );
}

const ibr = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-start' as const,
  },
  text: {
    fontSize: 11, color: '#CBD5E1', letterSpacing: 0.2,
    ...Shadows.text,
  },
  dim: { color: '#94A3B8' },
  bold: { fontWeight: '800' as const, color: '#E2E8F0' },
});

// ═══════════════════════════════════════════════════════════════════
// SpeakingRhythmHint — "Genelde 21:00 - 00:00 arası aktif"
// ═══════════════════════════════════════════════════════════════════
export function SpeakingRhythmHint({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <View style={srh.wrap}>
      <Ionicons name="time-outline" size={11} color="#94A3B8" style={iconShadow} />
      <Text style={srh.text}>{text}</Text>
    </View>
  );
}

const srh = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginHorizontal: 16, marginTop: 2, marginBottom: 2,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
  },
  text: {
    fontSize: 11, fontWeight: '600' as const, color: '#94A3B8', letterSpacing: 0.2,
    ...Shadows.text,
  },
});
