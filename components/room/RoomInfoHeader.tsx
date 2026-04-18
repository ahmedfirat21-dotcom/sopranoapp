import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';

interface Props {
  roomName: string;
  roomDescription?: string;
  isPremium?: boolean;
  viewerCount: number;
  connectionState: string;
  roomDuration: string;
  roomExpiry?: string;
  isFollowing?: boolean;
  onBack: () => void;
  onMinimize: () => void;
  onToggleFollow?: () => void;
  // ★ Oda ayar badge'leri
  roomLanguage?: string;
  ageRestricted?: boolean;
  entryFeeSp?: number;
  isLocked?: boolean;
  followersOnly?: boolean;
  donationsEnabled?: boolean;
  speakingMode?: 'free_for_all' | 'permission_only' | 'selected_only';
  roomType?: string;
  // ★ Host avatarı ve oda kuralları
  hostAvatarUrl?: string;
  roomRules?: string;
  followerCount?: number;
}

// Kalp atışı (Heartbeat) göstergesi
function ConnectionHeartbeat({ state, viewerCount }: { state: string, viewerCount: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [displayState, setDisplayState] = React.useState(state);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === 'connected') {
      // Bağlantı geldi — anında yeşile dön
      if (timerRef.current) clearTimeout(timerRef.current);
      setDisplayState('connected');
    } else {
      // Kopma — 5sn bekle, hâlâ kopuksa kırmızıya dön (kısa kesintilerde yanıp sönmez)
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDisplayState(state), 5000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(800),
      ])
    ).start();
  }, []);

  const isOk = displayState === 'connected';
  const dotColor = isOk ? '#22C55E' : (displayState === 'reconnecting' ? '#FBBF24' : '#EF4444');

  return (
    <View style={s.viewerPill}>
      <Animated.View style={[s.liveDot, { backgroundColor: dotColor, transform: [{ scale: pulseAnim }] }]} />
      <Text style={s.viewerText}>{viewerCount}</Text>
    </View>
  );
}

export default function RoomInfoHeader({
  roomName, roomDescription, isPremium, viewerCount,
  connectionState, roomDuration, roomExpiry,
  isFollowing, onBack, onMinimize, onToggleFollow,
  roomLanguage, ageRestricted, entryFeeSp, isLocked, followersOnly,
  donationsEnabled, speakingMode, roomType,
  hostAvatarUrl, roomRules, followerCount,
}: Props) {
  const langFlags: Record<string,string> = { tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', ar: '🇸🇦' };
  const [showRules, setShowRules] = useState(false);

  // Gösterilecek badge'ler — sadece önemli olanlar
  const badges: { icon?: string; text?: string; emoji?: string; color: string; bg: string; border: string }[] = [];
  if (ageRestricted) badges.push({ text: '+18', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' });
  if (roomType === 'closed') badges.push({ icon: 'lock-closed', text: 'Şifreli', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' });
  if (roomType === 'invite') badges.push({ icon: 'mail', text: 'Davetli', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' });
  if (isLocked) badges.push({ icon: 'lock-closed', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' });
  if ((entryFeeSp ?? 0) > 0) badges.push({ text: `${entryFeeSp} SP`, color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.25)' });
  if (followersOnly) badges.push({ icon: 'people', color: '#A78BFA', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)' });
  if (roomLanguage && roomLanguage !== 'tr') badges.push({ emoji: langFlags[roomLanguage] || roomLanguage, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)' });
  if (speakingMode === 'free_for_all') badges.push({ icon: 'chatbubbles', text: 'Serbest', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' });

  return (
    <View style={s.wrap}>
      {/* Satır 1 — Avatar + Süre + Oda İsmi + Aksiyonlar */}
      <View style={s.topNav}>
        <View style={s.topLeft}>
          {/* ★ Host avatar + süre göstergesi grubu */}
          <View style={s.hostAvatarGroup}>
            <Image source={getAvatarSource(hostAvatarUrl)} style={s.hostMiniAvatar} />
            {/* ★ Kalan süre — avatar altında kum saati */}
            {roomExpiry ? (
              <View style={[s.expiryBadge, roomExpiry.includes('doldu') && s.expiryBadgeExpired]}>
                <Ionicons
                  name={roomExpiry.includes('doldu') ? 'alarm' : 'hourglass-outline'}
                  size={7}
                  color={roomExpiry.includes('doldu') ? '#EF4444' : '#FBBF24'}
                />
              </View>
            ) : null}
          </View>
          {/* ★ Oda ismi + geçen süre tek satırda */}
          <View style={s.nameTimeCol}>
            <Text style={s.roomName} numberOfLines={1}>{roomName}</Text>
            {roomDuration ? (
              <View style={s.durationInline}>
                <Ionicons name="time-outline" size={8} color="rgba(20,184,166,0.6)" />
                <Text style={s.durationText}>{roomDuration}</Text>
                {roomExpiry ? (
                  <>
                    <Text style={s.durationSep}>·</Text>
                    <Ionicons name="hourglass-outline" size={7} color={roomExpiry.includes('doldu') ? '#EF4444' : 'rgba(251,191,36,0.7)'} />
                    <Text style={[s.durationText, { color: roomExpiry.includes('doldu') ? '#EF4444' : 'rgba(251,191,36,0.7)' }]}>{roomExpiry}</Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.topActions}>
          <ConnectionHeartbeat state={connectionState} viewerCount={viewerCount} />
          {(followerCount ?? 0) > 0 && (
            <View style={s.followerPill}>
              <Ionicons name="heart" size={10} color="#EF4444" />
              <Text style={s.followerText}>{followerCount}</Text>
            </View>
          )}
          {roomRules ? (
            <Pressable style={[s.actionBtn, showRules && s.followBtnActive]} onPress={() => setShowRules(!showRules)} hitSlop={6}>
              <Ionicons name="document-text-outline" size={14} color={showRules ? '#F59E0B' : '#E2E8F0'} />
            </Pressable>
          ) : null}
          {onToggleFollow && (
            <Pressable style={[s.actionBtn, isFollowing && s.followBtnActive]} onPress={onToggleFollow} hitSlop={6}>
              <Ionicons name={isFollowing ? 'bookmark' : 'bookmark-outline'} size={14} color={isFollowing ? '#14B8A6' : '#E2E8F0'} />
            </Pressable>
          )}
          <Pressable style={s.actionBtn} onPress={onMinimize}>
            <Ionicons name="chevron-down-outline" size={16} color="#E2E8F0" />
          </Pressable>
          <Pressable style={s.actionBtn} onPress={onBack}>
            <Ionicons name="close" size={16} color="#E2E8F0" />
          </Pressable>
        </View>
      </View>

      {/* Satır 2 — Özellik Badge'leri (süre buradan kaldırıldı) */}
      {badges.length > 0 && (
        <View style={s.badgeRow}>
          {badges.map((b, i) => (
            <View key={i} style={[s.tagBadge, { backgroundColor: b.bg, borderColor: b.border }]}>
              {b.emoji ? <Text style={{ fontSize: 10 }}>{b.emoji}</Text> : null}
              {b.icon ? <Ionicons name={b.icon as any} size={8} color={b.color} /> : null}
              {b.text ? <Text style={{ fontSize: 8, fontWeight: '700', color: b.color }}>{b.text}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* ★ Kurallar balonu — sadece tıklanınca görünür */}
      {showRules && roomRules ? (
        <Pressable onPress={() => setShowRules(false)}>
          <View style={s.rulesTooltip}>
            <View style={s.rulesTooltipArrow} />
            <Ionicons name="document-text" size={12} color="#F59E0B" />
            <Text style={s.rulesTooltipText} numberOfLines={4}>{roomRules}</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 2, // Boşluk azaltıldı
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4, // Boşluk azaltıldı
  },
  topLeft: {
    flex: 1,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostAvatarGroup: {
    position: 'relative',
  },
  expiryBadge: {
    position: 'absolute', bottom: -3, right: -3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  expiryBadgeExpired: {
    backgroundColor: 'rgba(239,68,68,0.25)',
  },
  nameTimeCol: {
    flex: 1,
    justifyContent: 'center',
  },
  durationInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  durationText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(20,184,166,0.6)',
  },
  durationSep: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.15)',
    marginHorizontal: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingLeft: 36, // host avatar genişliği kadar indent
    marginBottom: 2,
  },
  hostMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(20,184,166,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  premBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(218,165,32,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(218,165,32,0.3)',
  },
  premText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFDF00',
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20,184,166,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  viewerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6',
  },
  followerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  followerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.3)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  infoBlock: {
    marginTop: 2,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  infoText: {
    fontSize: 11,
    color: 'rgba(248, 250, 252, 0.6)',
  },
  // ★ Kurallar tooltip balonu
  rulesTooltip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 0.8,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  rulesTooltipArrow: {
    position: 'absolute',
    top: -5,
    right: 50,
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: 'rgba(245,158,11,0.2)',
  },
  rulesTooltipText: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(248,250,252,0.6)',
    lineHeight: 14,
  },
});
