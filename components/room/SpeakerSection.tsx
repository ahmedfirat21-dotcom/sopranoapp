import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions, Animated, Easing, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import { RoleColors } from '../../constants/theme';
import AvatarPenaltyFlash, { type FlashType } from './AvatarPenaltyFlash';
import type { RoomParticipant } from '../../services/database';

const { width: W } = Dimensions.get('window');

// ★ Dinamik sahne boyutlandırma — modern platform grid sistemi (Clubhouse/Spaces pattern)
function getSpeakerMetrics(count: number) {
  const availableW = W - 32;
  let cols: number, gap: number;
  if (count <= 2) { cols = 2; gap = 12; }
  else if (count <= 6) { cols = 3; gap = 10; }
  else if (count <= 9) { cols = 3; gap = 8; }
  else { cols = 4; gap = 6; } // 10-13 compact
  const cardWidth = Math.floor((availableW - gap * (cols - 1)) / cols);
  const cardHeight = cardWidth;
  return { cols, cardWidth, cardHeight, gap };
}

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
  onSelfDemote?: () => void;
  currentUserId?: string;
  VideoView?: any;
  onGhostSeatPress?: () => void;
  showSeatTooltip?: boolean;
  /** Per-user avatar flash state */
  avatarFlashes?: Record<string, FlashType | null>;
  onFlashDone?: (userId: string) => void;
}

function SpeakingGlow({ speaking, borderRadius = 16 }: { speaking: boolean; borderRadius?: number }) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (speaking) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 400, useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.setValue(1); }
  }, [speaking]);
  if (!speaking) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, {
      borderRadius, borderWidth: 2, borderColor: '#14B8A6',
      transform: [{ scale: pulseAnim }],
      shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16,
    }]} pointerEvents="none" />
  );
}

function AudioWaveBars({ speaking, mic }: { speaking: boolean; mic: boolean }) {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.5)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (speaking && mic) {
      const animate = (anim: Animated.Value, min: number, max: number, dur: number) =>
        Animated.loop(Animated.sequence([
          Animated.timing(anim, { toValue: max, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: min, duration: dur * 0.8, useNativeDriver: true }),
        ]));
      const a1 = animate(bar1, 0.3, 1, 300);
      const a2 = animate(bar2, 0.2, 1, 450);
      const a3 = animate(bar3, 0.35, 1, 350);
      a1.start(); a2.start(); a3.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); };
    } else { bar1.setValue(0.3); bar2.setValue(0.3); bar3.setValue(0.3); }
  }, [speaking, mic]);
  if (!speaking || !mic) return null;
  const barStyle = (anim: Animated.Value, h: number) => ({
    width: 3, height: h, borderRadius: 1.5, backgroundColor: '#14B8A6', transform: [{ scaleY: anim }],
  });
  return (
    <View style={{ position: 'absolute', bottom: 10, left: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 }}>
      <Animated.View style={barStyle(bar1, 10)} />
      <Animated.View style={barStyle(bar2, 14)} />
      <Animated.View style={barStyle(bar3, 8)} />
    </View>
  );
}

function OwnerBadge() {
  // ★ Premium animated golden glow pulse
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  // ★ Subtle float
  const floatAnim = useRef(new Animated.Value(0)).current;
  // ★ Rotating sparkle orbit
  const orbitAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Golden glow pulse — breathe effect
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.6, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Subtle float up/down
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: -1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 1.5, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Orbit rotation for sparkle
    Animated.loop(Animated.timing(orbitAnim, {
      toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true,
    })).start();
  }, []);

  const rotateSparkle = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[s.ownerBadgeContainer, { transform: [{ translateY: floatAnim }] }]}>
      {/* ★ Outer glow ring */}
      <Animated.View style={[s.ownerGlowRing, { opacity: glowAnim }]} />
      {/* ★ Badge body */}
      <LinearGradient
        colors={['#FFD700', '#F59E0B', '#D97706']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.ownerBadgeBody}
      >
        <Ionicons name="star" size={14} color="#FFF" />
      </LinearGradient>
      {/* ★ Orbiting sparkle particle */}
      <Animated.View style={[s.ownerSparkleOrbit, { transform: [{ rotate: rotateSparkle }] }]}>
        <View style={s.ownerSparkleDot} />
      </Animated.View>
    </Animated.View>
  );
}

// ★ v32 Caretaker timer badge — süreli sahnedeki konuşmacıların kalan süresini gösterir
function CaretakerTimerBadge({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = React.useState(() => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  React.useEffect(() => {
    const interval = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      const sec = Math.max(0, Math.floor(ms / 1000));
      setRemaining(sec);
      if (sec <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const label = `${min}:${sec.toString().padStart(2, '0')}`;
  const isUrgent = remaining <= 30; // Son 30 saniyede kırmızı/pulsing
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isUrgent) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 500, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isUrgent]);

  return (
    <Animated.View style={[
      s.caretakerTimer,
      isUrgent && s.caretakerTimerUrgent,
      { transform: [{ scale: pulseAnim }] },
    ]}>
      <Ionicons name="time" size={8} color={isUrgent ? '#FEE2E2' : '#CFFAFE'} />
      <Text style={[s.caretakerTimerText, isUrgent && { color: '#FEE2E2' }]}>{label}</Text>
    </Animated.View>
  );
}

function SpeakerCard({ user, micStatus, onPress, onSelfDemote, isMe, cardWidth, cardHeight, VideoView }: {
  user: RoomParticipant; micStatus: MicStatus; onPress: () => void;
  onSelfDemote?: () => void;
  isMe: boolean; cardWidth: number; cardHeight: number; VideoView?: any;
}) {
  const isHost = user.role === 'owner';
  const isMod = user.role === 'moderator';
  const displayName = (user as any).disguise?.display_name || user.user?.display_name || 'Misafir';
  const avatarUrl = (user as any).disguise?.avatar_url || user.user?.avatar_url;
  const { mic: rawMic, speaking, videoTrack, cameraOn } = micStatus;
  const isGhost = (user as any).is_ghost;
  // ★ D3: DB'de is_muted=true ise UI'da kesinlikle "muted" olarak göster — LiveKit
  // track state'i gecikmeli olabilir; DB kaydı mod aksiyonunu yansıtır.
  const dbMuted = (user as any).is_muted === true && user.role !== 'listener';
  const mic = rawMic && !dbMuted;
  // ★ v32 Caretaker: speaker + stage_expires_at varsa geçici caretaker
  const caretakerExpiresAt = user.role === 'speaker' && (user as any).stage_expires_at
    ? (user as any).stage_expires_at as string
    : null;
  const isCaretakerActive = caretakerExpiresAt && new Date(caretakerExpiresAt).getTime() > Date.now();

  // ★ 2026-04-19 EKSİLTME ŞABLONu — rol rengiyle ring, badge minimal
  // Her rol için ayrı badge yerine tek sistem: avatar ring'in rengi rol'ü belirtir.
  // Owner: altın / Moderator: mor / Speaker (+caretaker): teal / Caretaker urgent: amber
  // ★ Tek ring sistemi: RoleColors constant (tüm projede tutarlı — constants/theme.ts)
  const ringColor = isHost
    ? RoleColors.owner
    : isMod
    ? RoleColors.moderator
    : RoleColors.speaker;

  return (
    <Pressable style={({ pressed }) => [s.speakerCard, { width: cardWidth }, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]} onPress={onPress}>
      <View style={[
        s.speakerCardInner,
        { height: cardHeight, borderColor: ringColor, borderWidth: isHost || isMod ? 2 : 1.5 },
      ]}>
        <LinearGradient colors={['rgba(30,41,59,0.7)', 'rgba(15,23,42,0.85)']} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />
        {cameraOn && videoTrack && VideoView ? (
          <VideoView videoTrack={videoTrack} style={StyleSheet.absoluteFill} objectFit="cover" mirror={isMe} />
        ) : (
          <Image source={getAvatarSource(avatarUrl)} style={s.speakerAvatar} />
        )}
        <SpeakingGlow speaking={speaking && mic} borderRadius={16} />
        {isGhost && (
          <View style={s.ghostOverlay}>
            <Ionicons name="eye-off" size={18} color="rgba(255,255,255,0.55)" />
          </View>
        )}
        {isCaretakerActive && <CaretakerTimerBadge expiresAt={caretakerExpiresAt!} />}
        {/* ★ 2026-04-19: Caretaker aktifken wave bars gizli — timer zaten urgency
            sinyalidir, wave bars ek görsel yük yaratıyor. Normal speaker'larda görünür. */}
        {!isCaretakerActive && <AudioWaveBars speaking={speaking} mic={mic} />}
        <View style={[s.micBadge, mic ? s.micBadgeOn : s.micBadgeOff]}>
          <Ionicons name={mic ? 'mic' : 'mic-off'} size={14} color="#fff" />
        </View>
      </View>
      <Text style={[s.speakerName, isHost && { color: '#FFD700' }, isMod && !isHost && { color: '#C4B5FD' }]} numberOfLines={1}>{displayName}</Text>
      {isMe && (
        <Pressable style={({ pressed }) => [s.selfDemoteHint, pressed && { opacity: 0.6 }]} onPress={onSelfDemote}>
          <Ionicons name="arrow-down-circle-outline" size={11} color="rgba(251,191,36,0.7)" />
          <Text style={s.selfDemoteText}>Sahneden İn</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function SpeakerSection({ stageUsers, getMicStatus, onSelectUser, onSelfDemote, currentUserId, VideoView, onGhostSeatPress, showSeatTooltip, avatarFlashes, onFlashDone }: Props) {
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

  const ghostPulse = useRef(new Animated.Value(0.4)).current;
  const tooltipFade = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(ghostPulse, { toValue: 0.7, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(ghostPulse, { toValue: 0.4, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    if (showSeatTooltip) {
      Animated.parallel([
        Animated.timing(tooltipFade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tooltipSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      ]).start();
    } else { tooltipFade.setValue(0); tooltipSlide.setValue(-8); }
  }, [showSeatTooltip]);

  if (sortedUsers.length === 0) {
    // ★ 2026-04-19 EKSİLTME — 3 aynı mesaj yerine tek koltuk + küçük etiket.
    // Eskiden: tooltip "Sahne seni bekliyor!" + koltuk "Sahneye Çık" + subtitle
    //           "Koltuğa dokun ve sahneye katıl" — üç satır aynı şeyi söylüyordu.
    // Şimdi: sadece koltuk + "Sahneye Çık" label. Sessizlik güçtür.
    return (
      <View style={s.empty}>
        <Pressable onPress={onGhostSeatPress} style={({ pressed }) => [s.ghostSeat, pressed && { transform: [{ scale: 0.93 }] }]}>
          <Animated.View style={[s.ghostSeatInner, { opacity: ghostPulse }]}>
            <View style={s.ghostSeatIcon}>
              <Ionicons name="person-add-outline" size={28} color="rgba(20,184,166,0.6)" />
            </View>
          </Animated.View>
          <Text style={s.ghostSeatLabel}>Sahneye Çık</Text>
        </Pressable>
      </View>
    );
  }

  const count = sortedUsers.length;
  const { cardWidth, cardHeight, gap } = getSpeakerMetrics(count);

  // ★ Kamera açık kullanıcıları ayır — spotlight bölümü
  const cameraUsers = sortedUsers.filter(u => {
    const st = getMicStatus(u.user_id);
    return st.cameraOn && st.videoTrack;
  });
  const audioOnlyUsers = sortedUsers.filter(u => {
    const st = getMicStatus(u.user_id);
    return !(st.cameraOn && st.videoTrack);
  });

  // ★ Spotlight: 1-2 kamera açık → geniş üst alan, 3+ → normal grid'e düşür
  const showSpotlight = cameraUsers.length > 0 && cameraUsers.length <= 2 && VideoView;
  const spotlightW = cameraUsers.length === 1 ? W - 32 : (W - 32 - gap) / 2;
  const spotlightH = Math.round(spotlightW * 0.75); // 4:3 aspect

  return (
    <View style={s.wrap}>
      {/* ★ 2026-04-19: "Sahnedekiler" başlık pill'i kaldırıldı — kartlar zaten sahneyi gösterir,
          başlık semantik tekrar. Görsel gürültü azaltıldı. */}

      {/* ★ SPOTLIGHT — Kamera açık kullanıcılar üstte geniş gösterim */}
      {showSpotlight && (
        <View style={[s.spotlightRow, { gap, marginBottom: gap }]}>
          {cameraUsers.map((u) => {
            const st = getMicStatus(u.user_id);
            const isMe = u.user_id === currentUserId;
            return (
              <SpeakerCard key={u.id} user={u} micStatus={st} onPress={() => onSelectUser(u)}
                onSelfDemote={onSelfDemote}
                isMe={isMe} cardWidth={spotlightW} cardHeight={spotlightH} VideoView={VideoView} />
            );
          })}
        </View>
      )}

      {/* ★ Normal grid — kamera kapalılar veya spotlight yoksa herkes */}
      <View style={[s.mainSpeakerGrid, { gap }]}>
        {(showSpotlight ? audioOnlyUsers : sortedUsers).map((u) => {
          const st = getMicStatus(u.user_id);
          const isMe = u.user_id === currentUserId;
          const isHost = u.role === 'owner';
          // ★ Owner %15 büyük kart
          const ownerScale = isHost ? 1.15 : 1;
          const w = Math.floor(cardWidth * ownerScale);
          const h = Math.floor(cardHeight * ownerScale);
          return (
            <SpeakerCard key={u.id} user={u} micStatus={st} onPress={() => onSelectUser(u)}
              onSelfDemote={onSelfDemote}
              isMe={isMe} cardWidth={w} cardHeight={h} VideoView={VideoView} />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: -4 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  headerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderWidth: 0.8, borderColor: 'rgba(20,184,166,0.12)',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 12, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  headerCount: {
    backgroundColor: 'rgba(20,184,166,0.15)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  headerCountText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  spotlightRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start',
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 6 },
  tooltipWrap: { alignItems: 'center', marginBottom: 4 },
  tooltipBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  tooltipText: { fontSize: 13, fontWeight: '600', color: '#5EEAD4', letterSpacing: 0.2 },
  tooltipArrow: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'rgba(20,184,166,0.25)', marginTop: -1 },
  ghostSeat: { alignItems: 'center', marginTop: 4 },
  ghostSeatInner: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(20,184,166,0.25)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,184,166,0.05)' },
  ghostSeatIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,184,166,0.08)', alignItems: 'center', justifyContent: 'center' },
  ghostSeatLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(20,184,166,0.5)', marginTop: 6, letterSpacing: 0.3 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 },
  mainSpeakerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  speakerCard: { alignItems: 'center', marginBottom: 4, overflow: 'visible' },
  speakerCardInner: { width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(30,41,59,0.6)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  speakerAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },
  roleBadge: { position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(15,23,42,0.8)' },
  roleBadgeMod: { backgroundColor: 'rgba(139,92,246,0.35)' },
  ownerBadgeContainer: {
    position: 'absolute', top: -10, left: -8, zIndex: 20,
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },
  ownerGlowRing: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.5)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 6,
  },
  ownerBadgeBody: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7, shadowRadius: 6, elevation: 8,
  },
  ownerSparkleOrbit: {
    position: 'absolute', width: 28, height: 28,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  ownerSparkleDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#FFFACD',
    shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 3, elevation: 4,
  },
  micBadge: { position: 'absolute', bottom: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(15,23,42,0.8)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  micBadgeOn: { backgroundColor: '#14B8A6' },
  micBadgeOff: { backgroundColor: 'rgba(239,68,68,0.85)' },
  // ★ Ghost overlay — "gizli" modunda hafif bir tonda üstüne bindirilir (badge yerine)
  ghostOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 16,
  },
  // ★ v32 Caretaker timer — avatar sol-üst köşede
  caretakerTimer: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(20,184,166,0.85)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.35)',
    shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 3,
  },
  caretakerTimerUrgent: {
    backgroundColor: 'rgba(239,68,68,0.9)',
    borderColor: 'rgba(239,68,68,0.5)',
    shadowColor: '#EF4444',
  },
  caretakerTimerText: {
    fontSize: 9, fontWeight: '800', color: '#CFFAFE',
    letterSpacing: 0.3, fontVariant: ['tabular-nums'],
  },
  speakerName: { fontSize: 11, fontWeight: '700', color: '#F1F5F9', marginTop: 5, textAlign: 'center', maxWidth: 140, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  speakerNameHost: { color: '#FFD700' },
  selfDemoteHint: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(251,191,36,0.15)' },
  selfDemoteText: { fontSize: 9, fontWeight: '700', color: 'rgba(251,191,36,0.7)', letterSpacing: 0.3 },
});