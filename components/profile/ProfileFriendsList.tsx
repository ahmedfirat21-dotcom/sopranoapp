// SopranoChat — Profil Arkadaşlar Bölümü
// Kendi profil sayfasında "Arkadaşlarım" kartı.
// ★ "Ayarlar ve Yönetim" kartı ile aynı premium tasarım dili:
//   - premiumSectionHeader (accent bar + ikon + label)
//   - Diagonal gradient arka plan (parlak üst-sol → koyu alt-sağ)
//   - PremiumListItem tarzı satırlar
// Birleşik friends listesinden ilk 8 kişiyi gösterir, "Tümünü Gör" modala gider.

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';
import StatusAvatar from '../StatusAvatar';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

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
      {/* ★ Section header — "Ayarlar ve Yönetim" ile aynı format */}
      <View style={s.premiumSectionHeader}>
        <View style={s.sectionAccent} />
        <Ionicons name="people" size={13} color={Colors.teal} style={iconShadow} />
        <Text style={s.premiumSectionText}>ARKADAŞLARIM</Text>
        {/* Arkadaş sayısı rozeti — section header'da */}
        <View style={s.countBadge}>
          <Text style={s.countText}>{friends.length}</Text>
        </View>
      </View>

      {/* ★ Kart — diagonal gradient (Ayarlar ve Yönetim ile aynı) */}
      <View style={s.card}>
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {friends.slice(0, 8).map((friend, idx) => (
          <Pressable
            key={friend.id}
            style={({ pressed }) => [
              s.row,
              idx === previewCount - 1 && !friends.length && { borderBottomWidth: 0 },
              idx === previewCount - 1 && friends.length <= 8 && { borderBottomWidth: 0 },
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
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.25)" />
          </Pressable>
        ))}

        {friends.length > 8 && (
          <Pressable
            style={({ pressed }) => [s.showAllBtn, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
            onPress={onShowAll}
          >
            <Text style={s.showAllText}>Tümünü Gör ({friends.length})</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.teal} />
          </Pressable>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  // ★ Section header — "Ayarlar ve Yönetim" tarzı premium header
  premiumSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 8,
  },
  sectionAccent: { width: 3, height: 14, borderRadius: 2, backgroundColor: Colors.teal },
  premiumSectionText: {
    flex: 1, fontSize: 11, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1, ..._textGlow,
  },
  countBadge: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  countText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },

  // ★ Kart — diagonal gradient + cardBorder (Ayarlar kartıyla aynı)
  card: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.cardBorder,
    ..._cardShadow,
  },

  // Satır — PremiumListItem tarzı padding'ler
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  name: { fontSize: 14, fontWeight: '600', color: '#E2E8F0', letterSpacing: 0.15, ..._textGlow },
  status: { fontSize: 10, color: '#64748B', marginTop: 1 },

  // "Tümünü Gör" butonu
  showAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  showAllText: { fontSize: 12, fontWeight: '700', color: Colors.teal, letterSpacing: 0.3, ..._textGlow },
});
