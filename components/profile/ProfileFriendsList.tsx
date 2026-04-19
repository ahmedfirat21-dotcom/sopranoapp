// SopranoChat — Profil Arkadaşlar Bölümü
// Kendi profil sayfasında "Tüm Arkadaşlar" kartı.
// Birleşik friends listesinden ilk 8 kişiyi gösterir, "Tümünü Gör" modala gider.

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/theme';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;
import StatusAvatar from '../StatusAvatar';

const _cardShadow = Shadows.card;
const _textGlow = Shadows.text;

interface Friend {
  id: string;
  display_name: string;
  avatar_url?: string;
  is_online?: boolean;
  subscription_tier?: string;
}

interface Props {
  friends: Friend[];
  onFriendPress: (friendId: string) => void;
  onShowAll: () => void;
}

export default function ProfileFriendsList({ friends, onFriendPress, onShowAll }: Props) {
  if (friends.length === 0) return null;
  const previewCount = Math.min(friends.length, 8);

  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionHeaderText}>TÜM ARKADAŞLAR</Text>
      </View>
      <View style={s.card}>
        <LinearGradient colors={['rgba(20,184,166,0.06)', 'transparent']} style={s.cardGlow} />
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="people" size={14} color="#14B8A6" style={iconShadow} />
            <Text style={s.headerTitle}>Arkadaşlarım</Text>
          </View>
          <View style={s.countBadge}>
            <Text style={s.countText}>{friends.length}</Text>
          </View>
        </View>
        {friends.slice(0, 8).map((friend, idx) => (
          <Pressable
            key={friend.id}
            style={({ pressed }) => [
              s.row,
              idx === previewCount - 1 && { borderBottomWidth: 0 },
              pressed && { backgroundColor: 'rgba(255,255,255,0.04)' },
            ]}
            onPress={() => onFriendPress(friend.id)}
          >
            <StatusAvatar
              uri={friend.avatar_url}
              size={36}
              isOnline={friend.is_online}
              tier={friend.subscription_tier as any}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{friend.display_name}</Text>
              <Text style={[s.status, friend.is_online && { color: '#22C55E' }]}>
                {friend.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.1)" />
          </Pressable>
        ))}
        {friends.length > 8 && (
          <Pressable style={s.showAllBtn} onPress={onShowAll}>
            <Text style={s.showAllText}>Tümünü Gör ({friends.length})</Text>
            <Ionicons name="chevron-forward" size={14} color="#14B8A6" />
          </Pressable>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  sectionHeader: { marginHorizontal: 16, marginTop: 10, marginBottom: 6 },
  sectionHeaderText: { fontSize: 11, fontWeight: '800' as const, color: '#94A3B8', letterSpacing: 1, ..._textGlow },
  card: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#414e5f',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)',
    ..._cardShadow,
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 50,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { fontSize: 13, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3, ..._textGlow },
  countBadge: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  countText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  name: { fontSize: 13, fontWeight: '600', color: '#F1F5F9', ..._textGlow },
  status: { fontSize: 10, color: '#64748B', marginTop: 1 },
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  showAllText: { fontSize: 12, fontWeight: '600', color: '#14B8A6', ..._textGlow },
});
