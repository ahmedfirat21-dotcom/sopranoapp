// SopranoChat — Profil Arkadaşlar Bölümü
// Kendi profil sayfasında "Arkadaşlarım" kartı.
// ★ 2026-05-05: Dikey liste → yatay scroll story-tile pattern.
//   Avatar + isim (kompakt). Çevrimiçi olanlar başta. "Tümünü Gör" hem
//   section header sağında hem scroll sonunda son tile olarak.

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';
import StatusAvatar from '../StatusAvatar';
import ProfileSectionHeader from './ProfileSectionHeader';
import { i18n } from '../../services/i18n';

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
  /** İleride backend DM count ile beslenecek (en sık konuşulan sıralaması) */
  recent_dm_at?: string | null;
}

interface Props {
  friends: Friend[];
  onFriendPress: (friendId: string) => void;
  onShowAll: () => void;
}

// ★ Yatay tile sayısı limiti — fazlası scroll'da kalır, son tile "Tümü"
const PREVIEW_LIMIT = 12;

export default function ProfileFriendsList({ friends, onFriendPress, onShowAll }: Props) {
  if (friends.length === 0) return null;

  // ★ Sıralama: önce son DM (varsa), sonra çevrimiçi olanlar, sonra geri kalan
  //   recent_dm_at backend'den gelirse "en sık konuşulan" gerçek sıralama olur.
  //   Şu an çevrimiçi-öncelikli sıralama ile başlıyor.
  const sorted = [...friends].sort((a, b) => {
    const aRecent = a.recent_dm_at ? new Date(a.recent_dm_at).getTime() : 0;
    const bRecent = b.recent_dm_at ? new Date(b.recent_dm_at).getTime() : 0;
    if (aRecent !== bRecent) return bRecent - aRecent;
    const aOn = a.is_online ? 1 : 0;
    const bOn = b.is_online ? 1 : 0;
    if (aOn !== bOn) return bOn - aOn;
    return 0;
  });
  const previewList = sorted.slice(0, PREVIEW_LIMIT);
  const hasMore = friends.length > PREVIEW_LIMIT;

  return (
    <>
      {/* ★ 2026-05-05: Paylaşılan ProfileSectionHeader — 4 yerdeki duplike kod tek bileşende */}
      <ProfileSectionHeader
        label={i18n.t('profile.friends_label')}
        icon="people"
        accentColor={Colors.teal}
        count={friends.length}
        actionLabel={i18n.t('profile.see_all')}
        onActionPress={onShowAll}
      />

      {/* ★ 2026-05-05: NotificationDrawer aile dili — slate diagonal + teal halo + soft glow.
          Karakter: teal (sosyal/arkadaş). */}
      <View style={s.card}>
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.20)', 'rgba(20,184,166,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(20,184,166,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
        >
          {previewList.map((friend) => (
            <Pressable
              key={friend.id}
              style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}
              onPress={() => onFriendPress(friend.id)}
            >
              <View style={s.avatarWrap}>
                <StatusAvatar
                  uri={friend.avatar_url}
                  size={54}
                  isOnline={friend.is_online}
                  tier={friend.subscription_tier as any}
                  frameId={(friend as any).active_frame || null}
                  customBadgeId={(friend as any).active_badge_id ?? null}
                />
              </View>
              <Text style={s.tileName} numberOfLines={1}>
                {friend.display_name}
              </Text>
              {friend.is_online ? (
                <Text style={s.tileStatus}>{i18n.t('profile.online_status')}</Text>
              ) : (
                <Text style={s.tileStatusOff}>{i18n.t('profile.offline_status')}</Text>
              )}
            </Pressable>
          ))}

          {/* Son tile — "Tümü" geçişi (12'den fazlası varsa veya her zaman) */}
          {hasMore && (
            <Pressable
              style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}
              onPress={onShowAll}
            >
              <View style={s.allTileCircle}>
                <Ionicons name="people" size={22} color={Colors.teal} style={iconShadow} />
              </View>
              <Text style={[s.tileName, { color: Colors.teal }]} numberOfLines={1}>
                {i18n.t('profile.see_all')}
              </Text>
              <Text style={s.tileStatus}>+{friends.length - PREVIEW_LIMIT}</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  // ★ Yatay scroll kart — aile standardı (radius 26, amber border kaldırıldı)
  card: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 26, overflow: 'hidden',
    backgroundColor: '#1a2030',
    ..._cardShadow,
  },
  scrollContent: {
    paddingHorizontal: 12, paddingVertical: 14,
    gap: 12,
  },

  // ★ Tile (avatar + isim) — story-tile pattern
  tile: {
    width: 70,
    alignItems: 'center',
    gap: 4,
  },
  avatarWrap: {
    width: 56, height: 56,
    alignItems: 'center', justifyContent: 'center',
  },
  tileName: {
    fontSize: 11, fontWeight: '700', color: '#E2E8F0',
    letterSpacing: 0.15, textAlign: 'center',
    maxWidth: 70,
    ..._textGlow,
  },
  tileStatus: {
    fontSize: 9, fontWeight: '600', color: '#22C55E',
  },
  tileStatusOff: {
    fontSize: 9, fontWeight: '500', color: '#64748B',
  },

  // ★ "Tümü" tile sonda — daire içinde ikon
  allTileCircle: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,184,166,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.35)',
  },
});
