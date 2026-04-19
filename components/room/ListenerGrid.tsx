import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import AvatarPenaltyFlash, { type FlashType } from './AvatarPenaltyFlash';
import type { RoomParticipant } from '../../services/database';

const { width: W } = Dimensions.get('window');

// ★ Dinamik boyutlandırma — modern platform grid sistemi (Clubhouse/Spaces pattern)
// Sayı arttıkça avatar küçülür, sütun artar
function getGridMetrics(listenerCount: number) {
  let cols: number, avatarGap: number;
  if (listenerCount <= 4) {
    cols = 4; avatarGap = 12;
  } else if (listenerCount <= 8) {
    cols = 4; avatarGap = 10;
  } else if (listenerCount <= 15) {
    cols = 5; avatarGap = 8;
  } else if (listenerCount <= 24) {
    cols = 6; avatarGap = 6;
  } else {
    cols = 7; avatarGap = 4; // 25+ compact
  }
  const cellW = Math.floor((W - 32 - avatarGap * (cols - 1)) / cols);
  const avatarSize = cellW - (listenerCount <= 8 ? 12 : listenerCount <= 15 ? 10 : 6);
  return { cols, avatarGap, cellW, avatarSize };
}

interface Props {
  listeners: RoomParticipant[];
  onSelectUser: (user: RoomParticipant) => void;
  selectedUserId?: string | null;
  onShowAllUsers?: () => void;
  /** Tier bazlı max dinleyici grid kapasitesi (Free=10, Plus=25, Pro=sınırsız) */
  maxListeners?: number;
  /** Seyirci sayısı — grid'de gösterilmez, sadece sayı badge'i */
  spectatorCount?: number;
  /** Oda sahibi user_id — dinleyiciye indiğinde taç gösterilir */
  roomOwnerId?: string;
  /** Per-user avatar flash state */
  avatarFlashes?: Record<string, FlashType | null>;
  onFlashDone?: (userId: string) => void;
  /** Mikrofon isteği gönderen kullanıcı ID'leri */
  micRequestUserIds?: string[];
}

// ★ O10 FIX: Cell bileşeni React.memo ile sarıldı — 100+ listener'da stable props'lu
// cell'ler re-render etmeyecek. Dependency'ler: avatar, role, is_muted, is_chat_muted,
// selected, flash, hasHandRaised.
type CellProps = {
  u: RoomParticipant;
  cellW: number;
  avatarSize: number;
  nameSize: number;
  isSelected: boolean;
  isOwner: boolean;
  showMuteIndicator: boolean;
  isChatMuted: boolean;
  flash: FlashType | null;
  hasHandRaised: boolean;
  onSelectUser: (u: RoomParticipant) => void;
  onFlashDone?: (userId: string) => void;
};
const ListenerCell = React.memo(function ListenerCell({
  u, cellW, avatarSize, nameSize, isSelected, isOwner, showMuteIndicator,
  isChatMuted, flash, hasHandRaised, onSelectUser, onFlashDone,
}: CellProps) {
  return (
    <Pressable style={[s.cell, { width: cellW }]} onPress={() => onSelectUser(u)}>
      {isOwner && <ListenerOwnerBadge />}
      <View style={[s.avatarWrap, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }, isSelected && s.avatarSelected, isOwner && s.avatarOwner, showMuteIndicator && s.avatarMuted]}>
        <Image source={getAvatarSource((u as any).disguise?.avatar_url || u.user?.avatar_url)} style={s.avatar} />
      </View>
      {showMuteIndicator && (
        <View style={[s.mutedBadge, { right: (cellW - avatarSize) / 2 - 6 }]}>
          <Ionicons name="volume-mute" size={9} color="#FFF" />
        </View>
      )}
      {isChatMuted && (
        <View style={[s.chatMutedBadge, { left: (cellW - avatarSize) / 2 - 6 }]}>
          <Ionicons name="chatbox-outline" size={8} color="#FFF" />
        </View>
      )}
      {flash && <View style={[s.flashWrap, { height: avatarSize }]}><AvatarPenaltyFlash flashType={flash} size={avatarSize} onFlashDone={() => onFlashDone?.(u.user_id)} /></View>}
      {hasHandRaised && <HandRaiseBadge />}
      <Text style={[s.name, { fontSize: nameSize, maxWidth: cellW }, isOwner && { color: '#FFD700', fontWeight: '700' }, showMuteIndicator && { color: 'rgba(239,68,68,0.6)' }]} numberOfLines={1}>
        {(u as any).disguise?.display_name || u.user?.display_name || 'Misafir'}
      </Text>
    </Pressable>
  );
});

export default function ListenerGrid({ listeners, onSelectUser, selectedUserId, onShowAllUsers, maxListeners = 20, spectatorCount = 0, roomOwnerId, avatarFlashes, onFlashDone, micRequestUserIds = [] }: Props) {
  if (listeners.length === 0 && spectatorCount === 0) return null;

  // ★ Hiyerarşik sıralama — modern platform pattern (Clubhouse/Spaces)
  // 1. Oda sahibi (owner) en başta
  // 2. El kaldıranlar (mic request) — aktif katılım göstergesi
  // 3. Moderatörler — yetki sırası
  // 4. Diğer dinleyiciler — katılış sırasına göre
  const sortedListeners = React.useMemo(() => {
    return [...listeners].sort((a, b) => {
      // Owner her zaman ilk
      if (a.user_id === roomOwnerId) return -1;
      if (b.user_id === roomOwnerId) return 1;
      // El kaldıranlar ikinci
      const aHand = micRequestUserIds.includes(a.user_id) ? 1 : 0;
      const bHand = micRequestUserIds.includes(b.user_id) ? 1 : 0;
      if (aHand !== bHand) return bHand - aHand;
      // Moderatörler üçüncü
      const aIsMod = a.role === 'moderator' ? 1 : 0;
      const bIsMod = b.role === 'moderator' ? 1 : 0;
      if (aIsMod !== bIsMod) return bIsMod - aIsMod;
      // Diğerleri — katılış sırasına göre (stabil sort)
      return 0;
    });
  }, [listeners, roomOwnerId, micRequestUserIds]);

  // ★ 2026-04-19: Grid'de gösterilen dinleyici sayısı estetik cap — tier kapasitesi
  // daha yüksek olsa da (Plus=25, Pro=999) belli bir sayıdan sonrası avatar/isim
  // okunamaz hale geliyor. Cap ekran genişliğine göre: küçük cihazlarda daha az.
  // Overflow "+N Seyirci" badge'e düşer, AudienceDrawer'dan tümüne erişilir.
  const GRID_VISIBLE_CAP = W < 360 ? 10 : W < 400 ? 14 : 18;
  const gridCap = Math.min(maxListeners, GRID_VISIBLE_CAP);
  const visibleListeners = sortedListeners.slice(0, gridCap);
  const overflowListeners = Math.max(0, listeners.length - gridCap);
  const overflowCount = overflowListeners + spectatorCount;

  // ★ Dinamik boyut hesapla
  const { avatarGap, cellW, avatarSize } = getGridMetrics(visibleListeners.length);
  const nameSize = visibleListeners.length > 12 ? 9 : visibleListeners.length > 8 ? 10 : 11;

  return (
    <View style={s.wrap}>
      {/* ★ 2026-04-19: "Dinleyiciler" pill başlığı kaldırıldı (SpeakerSection ile tutarlı).
          Sadece "Tümü" butonu sağda — gereksiz durumunda. Sayım avatarlar zaten gösterir. */}
      {onShowAllUsers && listeners.length > 0 && (
        <View style={s.headerRowMinimal}>
          <Text style={s.listenerCountText}>{listeners.length} dinleyici</Text>
          <Pressable style={s.allUsersBtn} onPress={onShowAllUsers} hitSlop={10}>
            <Ionicons name="people" size={14} color="#14B8A6" />
            <Text style={s.allUsersText}>Tümü</Text>
          </Pressable>
        </View>
      )}
      <View style={[s.grid, { gap: avatarGap }]}>
        {visibleListeners.map((u) => {
          const isSelected = selectedUserId === u.user_id;
          const isOwner = u.user_id === roomOwnerId;
          const isMuted = (u as any).is_muted || false;
          const isChatMuted = (u as any).is_chat_muted || false;
          const flash = avatarFlashes?.[u.user_id] || null;
          const showMuteIndicator = isMuted && u.role !== 'listener';
          const hasHandRaised = micRequestUserIds.includes(u.user_id);
          return (
            <ListenerCell
              key={u.id}
              u={u}
              cellW={cellW}
              avatarSize={avatarSize}
              nameSize={nameSize}
              isSelected={isSelected}
              isOwner={isOwner}
              showMuteIndicator={showMuteIndicator}
              isChatMuted={isChatMuted}
              flash={flash}
              hasHandRaised={hasHandRaised}
              onSelectUser={onSelectUser}
              onFlashDone={onFlashDone}
            />
          );
        })}
        {overflowCount > 0 && (
          <Pressable style={[s.cell, { width: cellW }]} onPress={onShowAllUsers}>
            <View style={[s.avatarWrap, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: 'rgba(20,184,166,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#14B8A6', fontSize: avatarSize > 50 ? 14 : 11, fontWeight: '700' }}>+{overflowCount}</Text>
            </View>
            <Text style={[s.name, { color: '#14B8A6', fontSize: nameSize }]}>Seyirci</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  // ★ 2026-04-19: Minimal header — sadece sayı + "Tümü" butonu
  headerRowMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listenerCountText: {
    fontSize: 11, fontWeight: '600', color: '#64748B',
    letterSpacing: 0.3,
  },
  headerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderWidth: 0.8,
    borderColor: 'rgba(20,184,166,0.12)',
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
  allUsersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20,184,166,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  allUsersText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#14B8A6',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'visible',
    paddingTop: 8,
  },
  avatarWrap: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.25)',
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  avatarSelected: {
    borderColor: '#14B8A6',
    borderWidth: 2.5,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarMuted: {
    borderColor: 'rgba(239,68,68,0.4)',
    opacity: 0.7,
  },
  mutedBadge: {
    position: 'absolute', top: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2, borderColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center', justifyContent: 'center', zIndex: 15,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 8,
  },
  chatMutedBadge: {
    // ★ 2026-04-19: Aynı rengi kullanıyoruz (kırmızı). Mute = mute, ikon ayırt ediyor.
    // Önceden turuncu (#F97316) idi — kullanıcılar "kırmızı mı turuncu mu, hangisi
    // daha kötü?" diye düşünüyordu. Semantik farkı ikon (mic vs chat) taşıyor.
    position: 'absolute', top: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2, borderColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center', justifyContent: 'center', zIndex: 15,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 8,
  },
  flashWrap: {
    position: 'absolute', top: 8, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 25,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  avatarOwner: {
    borderColor: 'rgba(255,215,0,0.45)',
  },
  listenerBadgeContainer: {
    position: 'absolute',
    top: -4, left: -4,
    zIndex: 20,
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  listenerGlowRing: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.45)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 6, elevation: 4,
  },
  listenerBadgeBody: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 6,
  },
  listenerSparkleOrbit: {
    position: 'absolute', width: 20, height: 20,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  listenerSparkleDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: '#FFFACD',
    shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 2, elevation: 3,
  },
  handRaiseBadge: {
    position: 'absolute',
    top: 4, left: 2,
    zIndex: 20,
  },
});

function ListenerOwnerBadge() {
  // ★ 2026-04-19 sadeleştirme: orbit sparkle kaldırıldı. Glow + float yeterli
  // premium his verir; 3 concurrent anim (glow+float+orbit) görsel gürültüydü.
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.5, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: -1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <Animated.View style={[s.listenerBadgeContainer, { transform: [{ translateY: floatAnim }] }]}>
      <Animated.View style={[s.listenerGlowRing, { opacity: glowAnim }]} />
      <LinearGradient
        colors={['#FFD700', '#F59E0B', '#D97706']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.listenerBadgeBody}
      >
        <Ionicons name="star" size={10} color="#FFF" />
      </LinearGradient>
    </Animated.View>
  );
}

// ★ El kaldırma animasyonlu badge — mikrofon isteği gönderen dinleyicilerde
function HandRaiseBadge() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animasyonu — dikkat çekici
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    // Yukarı-aşağı sallama
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[s.handRaiseBadge, { transform: [{ scale: pulseAnim }, { translateY: bounceAnim }] }]}>
      <Text style={{ fontSize: 14 }}>✋</Text>
    </Animated.View>
  );
}
