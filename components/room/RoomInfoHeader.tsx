import React, { useRef, useEffect } from 'react';
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
}

// Kalp atışı (Heartbeat) göstergesi
function ConnectionHeartbeat({ state, viewerCount }: { state: string, viewerCount: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(800),
      ])
    ).start();
  }, []);

  const isOk = state === 'connected';
  const dotColor = isOk ? '#22C55E' : (state === 'reconnecting' ? '#FBBF24' : '#EF4444');

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
  hostAvatarUrl, roomRules,
}: Props) {
  const langFlags: Record<string,string> = { tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', ar: '🇸🇦' };

  return (
    <View style={s.wrap}>
      {/* Üst Satır - Oda İsmi ve Kontroller */}
      <View style={s.topNav}>
        {/* Sol Üst - Oda İsmi & Premium Badge */}
        <View style={s.topLeft}>
          {/* ★ Host Avatarı */}
          <Image source={getAvatarSource(hostAvatarUrl)} style={s.hostMiniAvatar} />
          <Text style={s.roomName} numberOfLines={1}>{roomName}</Text>
          {isPremium && (
            <View style={s.premBadge}>
              <MaterialCommunityIcons name="crown" size={12} color="#FFDF00" />
              <Text style={s.premText}>Premium</Text>
            </View>
          )}
          {/* ★ Oda ayar badge'leri */}
          {ageRestricted && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)' }]}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#EF4444' }}>🔞 +18</Text>
            </View>
          )}
          {roomLanguage && roomLanguage !== 'tr' && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.25)' }]}>
              <Text style={{ fontSize: 10 }}>{langFlags[roomLanguage] || roomLanguage}</Text>
            </View>
          )}
          {isLocked && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }]}>
              <Ionicons name="lock-closed" size={9} color="#F59E0B" />
            </View>
          )}
          {(entryFeeSp ?? 0) > 0 && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(212,175,55,0.12)', borderColor: 'rgba(212,175,55,0.25)' }]}>
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#D4AF37' }}>{entryFeeSp} SP</Text>
            </View>
          )}
          {followersOnly && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)' }]}>
              <Ionicons name="people" size={9} color="#A78BFA" />
            </View>
          )}
          {/* Oda tipi badge'leri */}
          {roomType === 'closed' && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }]}>
              <Ionicons name="lock-closed" size={8} color="#F59E0B" />
              <Text style={{ fontSize: 8, fontWeight: '700', color: '#F59E0B' }}>Şifreli</Text>
            </View>
          )}
          {roomType === 'invite' && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)' }]}>
              <Ionicons name="mail" size={8} color="#8B5CF6" />
              <Text style={{ fontSize: 8, fontWeight: '700', color: '#8B5CF6' }}>Davetli</Text>
            </View>
          )}
          {/* Bağış açık */}
          {donationsEnabled && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
              <Ionicons name="heart" size={8} color="#EF4444" />
            </View>
          )}
          {/* Konuşma modu — sadece varsayılandan (permission_only) farklıysa göster */}
          {speakingMode === 'free_for_all' && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.25)' }]}>
              <Ionicons name="chatbubbles" size={8} color="#22C55E" />
              <Text style={{ fontSize: 8, fontWeight: '600', color: '#22C55E' }}>Serbest</Text>
            </View>
          )}
          {speakingMode === 'selected_only' && (
            <View style={[s.tagBadge, { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.25)' }]}>
              <Ionicons name="shield-checkmark" size={8} color="#3B82F6" />
              <Text style={{ fontSize: 8, fontWeight: '600', color: '#3B82F6' }}>Seçili</Text>
            </View>
          )}
        </View>

        {/* Sağ Üst - Aksiyonlar ve Kalp Atışı */}
        <View style={s.topActions}>
          <ConnectionHeartbeat state={connectionState} viewerCount={viewerCount} />
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

      {/* Alt Satır - Sadece Oda Kuralları */}
      {roomRules ? (
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.infoText} numberOfLines={2}>
              📋 {roomRules}
            </Text>
          </View>
        </View>
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
    gap: 6,
  },
  hostMiniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(20,184,166,0.35)',
  },
  roomName: {
    fontSize: 20, // Biraz daha kompakt ama vurgulu
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    flexShrink: 1,
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
});
