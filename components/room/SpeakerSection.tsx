import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import type { RoomParticipant } from '../../services/database';

const { width: W } = Dimensions.get('window');
const CARD_GAP = 10;

interface MicStatus {
  mic: boolean;
  speaking: boolean;
  audioLevel: number;
  cameraOn: boolean;
  videoTrack: any;
}

interface Props {
  stageUsers: RoomParticipant[];
  getMicStatus: (uid: string) => MicStatus;
  onSelectUser: (user: RoomParticipant) => void;
  currentUserId?: string;
  VideoView?: any;
  /** Boş sahnedeki ghost koltuk tıklandığında çağrılır */
  onGhostSeatPress?: () => void;
  /** Ghost koltuk üzerindeki tooltip'i göster (3sn sonra otomatik) */
  showSeatTooltip?: boolean;
}

// ═══════════════════════════════════════════════════════════
// KONUŞMA ANİMASYONU — GLASSMORPHISM KART ÇEVRESİNDE GLOW
// ═══════════════════════════════════════════════════════════
function SpeakingGlow({ speaking, borderRadius = 16 }: { speaking: boolean; borderRadius?: number }) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (speaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [speaking]);

  if (!speaking) return null;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius,
          borderWidth: 2,
          borderColor: '#14B8A6',
          transform: [{ scale: pulseAnim }],
          shadowColor: '#14B8A6',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 16,
        },
      ]}
      pointerEvents="none"
    />
  );
}

// ═══════════════════════════════════════════════════════════
// SES DALGASI BARLARI — konuşurken mikrofon yanında
// ═══════════════════════════════════════════════════════════
function AudioWaveBars({ speaking, mic }: { speaking: boolean; mic: boolean }) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.5)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (speaking && mic) {
      const animate = (anim: Animated.Value, min: number, max: number, dur: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: max, duration: dur, useNativeDriver: true }),
            Animated.timing(anim, { toValue: min, duration: dur * 0.8, useNativeDriver: true }),
          ])
        );
      const a1 = animate(bar1, 0.3, 1, 300);
      const a2 = animate(bar2, 0.2, 1, 450);
      const a3 = animate(bar3, 0.35, 1, 350);
      a1.start(); a2.start(); a3.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); };
    } else {
      bar1.setValue(0.3); bar2.setValue(0.3); bar3.setValue(0.3);
    }
  }, [speaking, mic]);

  if (!speaking || !mic) return null;

  const barStyle = (anim: Animated.Value, h: number) => ({
    width: 3,
    height: h,
    borderRadius: 1.5,
    backgroundColor: '#14B8A6',
    transform: [{ scaleY: anim }],
  });

  return (
    <View style={{ position: 'absolute', bottom: 10, left: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 }}>
      <Animated.View style={barStyle(bar1, 10)} />
      <Animated.View style={barStyle(bar2, 14)} />
      <Animated.View style={barStyle(bar3, 8)} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// OWNER TAÇ ANİMASYONU — Büyük, 3D, kartın dışına taşan
// ═══════════════════════════════════════════════════════════
function OwnerCrown({ size = 28 }: { size?: number }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-18deg', '-15deg', '-12deg'],
  });

  return (
    <Animated.View style={[
      s.crownWrap,
      { transform: [{ rotate }], width: size * 1.5, height: size * 1.5 },
    ]}>
      <MaterialCommunityIcons name="crown" size={size} color="#FFD700" />
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════
// BÜYÜK KONUŞMACI KARTI — Glassmorphism Tasarım
// Referans: Kare kartlar, yuvarlak köşeler, avatar tam kaplama,
// teal mikrofon badge sağ alt, isim + @username kart altında
// ═══════════════════════════════════════════════════════════
function SpeakerCard({
  user,
  micStatus,
  onPress,
  isMe,
  cardWidth,
  cardHeight,
  VideoView,
}: {
  user: RoomParticipant;
  micStatus: MicStatus;
  onPress: () => void;
  isMe: boolean;
  cardWidth: number;
  cardHeight: number;
  VideoView?: any;
}) {
  const isHost = user.role === 'owner';
  const isMod = user.role === 'moderator';
  const displayName = (user as any).disguise?.display_name || user.user?.display_name || 'Misafir';
  const username = (user as any).disguise ? null : (user.user as any)?.username;
  const avatarUrl = (user as any).disguise?.avatar_url || user.user?.avatar_url;
  const { mic, speaking, videoTrack, cameraOn } = micStatus;
  const isGhost = (user as any).is_ghost;

  return (
    <Pressable
      style={({ pressed }) => [
        s.speakerCard,
        { width: cardWidth },
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
      ]}
      onPress={onPress}
    >
      {/* ★ Owner Taç — kartın dışına taşar */}
      {isHost && <OwnerCrown />}

      {/* Glassmorphism kart container */}
      <View style={[s.speakerCardInner, { height: cardHeight }]}>
        {/* Arka plan gradient */}
        <LinearGradient
          colors={['rgba(30,41,59,0.7)', 'rgba(15,23,42,0.85)']}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />

        {/* Video veya Avatar — tam kaplama */}
        {cameraOn && videoTrack && VideoView ? (
          <VideoView
            videoTrack={videoTrack}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={isMe}
          />
        ) : (
          <Image
            source={getAvatarSource(avatarUrl)}
            style={s.speakerAvatar}
          />
        )}

        {/* Konuşma glow animasyonu */}
        <SpeakingGlow speaking={speaking && mic} borderRadius={16} />

        {/* Üst sol — Moderatör badge */}
        {isMod && !isHost && (
          <View style={[s.roleBadge, s.roleBadgeMod]}>
            <Ionicons name="shield-checkmark" size={10} color="#A78BFA" />
          </View>
        )}

        {/* Ghost badge */}
        {isGhost && (
          <View style={[s.roleBadge, { top: isHost || isMod ? 30 : 8, backgroundColor: 'rgba(168,85,247,0.4)' }]}>
            <Ionicons name="eye-off" size={10} color="#A855F7" />
          </View>
        )}

        {/* ★ Ses dalgası barları — konuşurken sol altta */}
        <AudioWaveBars speaking={speaking} mic={mic} />

        {/* Sağ alt — Mikrofon badge (teal daire) */}
        <View style={[s.micBadge, mic ? s.micBadgeOn : s.micBadgeOff]}>
          <Ionicons name={mic ? 'mic' : 'mic-off'} size={14} color="#fff" />
        </View>
      </View>

      {/* İsim + Username — kart altında */}
      <Text style={[s.speakerName, isHost && s.speakerNameHost]} numberOfLines={1}>
        {displayName}
      </Text>
      {username && (
        <Text style={s.speakerUsername} numberOfLines={1}>@{username}</Text>
      )}
      {/* ★ UX: Kendi kartında "Sahneden İn" yönergesi — tüm sahne kullanıcıları */}
      {isMe && (
        <View style={s.selfDemoteHint}>
          <Ionicons name="arrow-down-circle-outline" size={11} color="rgba(251,191,36,0.7)" />
          <Text style={s.selfDemoteText}>Sahneden İn</Text>
        </View>
      )}
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════
// SPEAKER SECTION — Referans Görsele Uyumlu Tasarım
// ═══════════════════════════════════════════════════════════
export default function SpeakerSection({ stageUsers, getMicStatus, onSelectUser, currentUserId, VideoView, onGhostSeatPress, showSeatTooltip }: Props) {
  const sortedUsers = useMemo(() => {
    if (stageUsers.length === 0) return [];

    const roleOrder: Record<string, number> = { owner: 0, host: 0, moderator: 1, speaker: 2 };
    return [...stageUsers].sort((a, b) => {
      const ra = roleOrder[a.role] ?? 3;
      const rb = roleOrder[b.role] ?? 3;
      if (ra !== rb) return ra - rb;
      return a.user_id.localeCompare(b.user_id);
    });
  }, [stageUsers]);

  // ★ Ghost seat pulse animasyonu
  const ghostPulse = useRef(new Animated.Value(0.4)).current;
  const tooltipFade = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    // Ghost koltuk breathing efekti
    Animated.loop(
      Animated.sequence([
        Animated.timing(ghostPulse, { toValue: 0.7, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(ghostPulse, { toValue: 0.4, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (showSeatTooltip) {
      Animated.parallel([
        Animated.timing(tooltipFade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tooltipSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();
    } else {
      tooltipFade.setValue(0);
      tooltipSlide.setValue(-8);
    }
  }, [showSeatTooltip]);

  if (sortedUsers.length === 0) {
    return (
      <View style={s.empty}>
        {/* ★ Tooltip balonu — koltuk ikonunun üzerinde, ok işareti ile */}
        {showSeatTooltip && (
          <Animated.View style={[s.tooltipWrap, { opacity: tooltipFade, transform: [{ translateY: tooltipSlide }] }]}>
            <View style={s.tooltipBubble}>
              <Ionicons name="sparkles" size={13} color="#14B8A6" style={{ marginRight: 5 }} />
              <Text style={s.tooltipText}>Sahne seni bekliyor!</Text>
            </View>
            {/* Ok işareti — aşağı bakan üçgen */}
            <View style={s.tooltipArrow} />
          </Animated.View>
        )}

        {/* ★ Ghost koltuk — soluk, tıklanabilir */}
        <Pressable
          onPress={onGhostSeatPress}
          style={({ pressed }) => [
            s.ghostSeat,
            pressed && { transform: [{ scale: 0.93 }] },
          ]}
        >
          <Animated.View style={[s.ghostSeatInner, { opacity: ghostPulse }]}>
            <View style={s.ghostSeatIcon}>
              <Ionicons name="person-add-outline" size={28} color="rgba(20,184,166,0.6)" />
            </View>
          </Animated.View>
          <Text style={s.ghostSeatLabel}>Sahneye Çık</Text>
        </Pressable>

        <Text style={s.emptyText}>Koltuğa dokun ve sahneye katıl</Text>
      </View>
    );
  }

  // ★ Kart boyut hesaplama — kullanıcı sayısına göre adaptif
  const availableW = W - 32; // 16px padding * 2
  const count = sortedUsers.length;

  let cardWidth: number;
  let cardHeight: number;

  if (count === 1) {
    // Tek kişi — büyük kart, ortada
    cardWidth = availableW * 0.55;
    cardHeight = cardWidth * 1.0;
  } else if (count === 2) {
    // 2 kişi — yan yana, eşit büyüklükte
    cardWidth = (availableW - CARD_GAP) / 2;
    cardHeight = cardWidth * 1.05;
  } else if (count <= 4) {
    // 3-4 kişi — 2 sütunlu grid
    cardWidth = (availableW - CARD_GAP) / 2;
    cardHeight = cardWidth * 0.95;
  } else if (count <= 6) {
    // 5-6 kişi — 3 sütunlu grid, biraz küçük
    cardWidth = (availableW - CARD_GAP * 2) / 3;
    cardHeight = cardWidth * 1.0;
  } else {
    // 7+ kişi — 4 sütunlu grid, kompakt
    cardWidth = (availableW - CARD_GAP * 3) / 4;
    cardHeight = cardWidth * 1.0;
  }

  return (
    <View style={s.wrap}>
      {/* Başlık */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.liveDot} />
          <Text style={s.headerTitle}>Konuşmacılar</Text>
        </View>
        <View style={s.headerCountBadge}>
          <Text style={s.headerCount}>{count}</Text>
        </View>
      </View>

      {/* Konuşmacı Grid */}
      <View style={s.speakerGrid}>
        {sortedUsers.map((u) => {
          const st = getMicStatus(u.user_id);
          const isMe = u.user_id === currentUserId;

          return (
            <SpeakerCard
              key={u.id}
              user={u}
              micStatus={st}
              onPress={() => onSelectUser(u)}
              isMe={isMe}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              VideoView={VideoView}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 8 },

  // ═══ Header ═══
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  headerTitle: {
    fontSize: 16, fontWeight: '700', color: '#F1F5F9',
    letterSpacing: 0.3,
  },
  headerCountBadge: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  headerCount: {
    fontSize: 12, fontWeight: '700', color: '#14B8A6',
  },

  // ═══ Empty State — Ghost Seat ═══
  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 32, gap: 6,
  },

  // ★ Tooltip balonu
  tooltipWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tooltipText: {
    fontSize: 13, fontWeight: '600', color: '#5EEAD4',
    letterSpacing: 0.2,
  },
  tooltipArrow: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: 'rgba(20,184,166,0.25)',
    marginTop: -1,
  },

  // ★ Ghost koltuk
  ghostSeat: {
    alignItems: 'center',
    marginTop: 4,
  },
  ghostSeatInner: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  ghostSeatIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(20,184,166,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  ghostSeatLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(20,184,166,0.5)',
    marginTop: 6,
    letterSpacing: 0.3,
  },

  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 },

  // ═══ Speaker Grid ═══
  speakerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: CARD_GAP,
  },

  // ═══ Speaker Card — Glassmorphism ═══
  speakerCard: {
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'visible',
  },
  speakerCardInner: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    // Glassmorphism shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  speakerAvatar: {
    width: '100%', height: '100%',
    resizeMode: 'cover',
  },

  // ═══ Rol Badge — Sol Üst ═══
  roleBadge: {
    position: 'absolute',
    top: 8, left: 8,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(15,23,42,0.8)',
  },
  roleBadgeMod: {
    backgroundColor: 'rgba(139,92,246,0.35)',
  },

  // ═══ Owner Taç — Büyük, 3D, kartın dışına taşan ═══
  crownWrap: {
    position: 'absolute',
    top: -10, left: -8,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 20,
    // Altın gölge
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
  },

  // ═══ Mikrofon Badge — Sağ Alt (Teal Daire) ═══
  micBadge: {
    position: 'absolute',
    bottom: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(15,23,42,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  micBadgeOn: {
    backgroundColor: '#14B8A6',
  },
  micBadgeOff: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },

  // ═══ İsim + Username ═══
  speakerName: {
    fontSize: 13, fontWeight: '700', color: '#F1F5F9',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 140,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  speakerNameHost: {
    color: '#FFD700',
  },
  speakerUsername: {
    fontSize: 10, fontWeight: '500', color: '#64748B',
    marginTop: 1,
    textAlign: 'center',
    maxWidth: 140,
  },

  // ★ Self-demote ipucu
  selfDemoteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.15)',
  },
  selfDemoteText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.7)',
    letterSpacing: 0.3,
  },
});
