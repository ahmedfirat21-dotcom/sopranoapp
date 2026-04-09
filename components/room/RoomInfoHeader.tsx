import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
  onMenu: () => void;
  onToggleFollow?: () => void;
}

export default function RoomInfoHeader({
  roomName, roomDescription, isPremium, viewerCount,
  connectionState, roomDuration, roomExpiry,
  isFollowing, onBack, onMinimize, onMenu, onToggleFollow,
}: Props) {
  return (
    <View style={s.wrap}>
      {/* Sol: Oda adı + durum */}
      <View style={s.left}>
        <Text style={s.roomName} numberOfLines={2}>{roomName}</Text>
        {isPremium && (
          <View style={s.premBadge}>
            <MaterialCommunityIcons name="crown" size={12} color="#FFD700" />
            <Text style={s.premText}>Premium Oda</Text>
          </View>
        )}
        <View style={s.metaRow}>
          <View style={[s.liveDot, { backgroundColor: connectionState === 'connected' ? '#22C55E' : connectionState === 'reconnecting' ? '#FBBF24' : '#EF4444' }]} />
          <Text style={s.metaText}>
            {connectionState === 'connected' ? 'Canlı' : connectionState === 'reconnecting' ? 'Bağlanıyor...' : 'Çevrimdışı'}
          </Text>
          <Ionicons name="time-outline" size={10} color="rgba(255,255,255,0.35)" />
          <Text style={s.metaText}>{roomDuration}</Text>
          {!!roomExpiry && (
            <>
              <Text style={[s.metaText, { color: 'rgba(255,255,255,0.15)' }]}>|</Text>
              <Ionicons name="hourglass-outline" size={9} color={roomExpiry.includes('doldu') ? '#EF4444' : 'rgba(255,255,255,0.35)'} />
              <Text style={[s.metaText, roomExpiry.includes('doldu') && { color: '#EF4444', fontWeight: '700' }]}>{roomExpiry}</Text>
            </>
          )}
        </View>
      </View>

      {/* Sağ: Takip + Kişi + minimize + kapatma */}
      <View style={s.right}>
        {onToggleFollow && (
          <Pressable
            style={[s.followBtn, isFollowing && s.followBtnActive]}
            onPress={onToggleFollow}
            hitSlop={6}
          >
            <Ionicons
              name={isFollowing ? 'bookmark' : 'bookmark-outline'}
              size={14}
              color={isFollowing ? '#14B8A6' : 'rgba(255,255,255,0.45)'}
            />
          </Pressable>
        )}
        <View style={s.viewerPill}>
          <Ionicons name="people" size={11} color="#14B8A6" />
          <Text style={s.viewerText}>{viewerCount}</Text>
        </View>
        <Pressable style={s.actionBtn} onPress={onMinimize}>
          <Ionicons name="remove-outline" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>
        <Pressable style={s.actionBtn} onPress={onBack}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  left: { flex: 1 },
  roomName: {
    fontSize: 20, fontWeight: '800', color: '#F1F5F9',
    lineHeight: 26, letterSpacing: -0.3,
  },
  premBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    marginTop: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
  },
  premText: { fontSize: 11, fontWeight: '700', color: '#FFD700' },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  metaText: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  right: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  followBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.3)',
  },
  actionBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(20,184,166,0.1)',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
  },
  viewerText: { fontSize: 11, fontWeight: '700', color: '#14B8A6' },
});
