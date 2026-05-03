// SopranoChat — Profil Hero Kartı
// Avatar + isim + tier + bio + düzenleme butonu + arkadaş/oda sayıları
// Kendi profilim için (tabs/profile.tsx) kullanılır.

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;
import StatusAvatar from '../StatusAvatar';
import AvatarFrame from './AvatarFrame';
import type { UserTitle } from '../../services/userTitles';
import type { SubscriptionTier } from '../../types';

const _cardShadow = Shadows.card;
const _textGlow = Shadows.text;

interface Props {
  displayName: string;
  username?: string | null;
  bio: string;
  avatarUrl: string;
  subscriptionTier: SubscriptionTier;
  isAdmin: boolean;
  userTitle: UserTitle | null;
  stats: { followers: number; rooms: number; badges?: number };
  /** Varsa edit butonunu göster; yoksa başka bir kullanıcının profili */
  onEdit?: () => void;
  /** ★ 2026-04-21: Bio'ya tap ile inline edit — kendi profilde (callback varsa) */
  onBioPress?: () => void;
  onFollowersPress: () => void;
  onRoomsPress: () => void;
  onBadgesPress?: () => void;
  onAvatarPress?: () => void; // ★ Avatar preview modal
  /** Üyelik başlangıç tarihi (ISO) */
  memberSince?: string;
  /** Boost aktifse bitiş zamanı (ISO); yoksa null */
  boostExpiresAt?: string | null;
  /** Çevrimiçi gösterimi (owner'a gerek yok — kendi sayfası) */
  isOnline?: boolean;
  /** Kullanıcının seviyesi (level system) */
  userLevel?: number;
  /** ★ v107: Mağazadan satın alınmış aktif çerçeve (atelier item id) — avatar etrafında render */
  activeFrame?: string | null;
  /** ★ v107: Çerçeve seç butonuna tıklayınca tetiklenir (kendi profilinde) */
  onFramePress?: () => void;
}

export default function ProfileHero({
  displayName, username, bio, avatarUrl, subscriptionTier, isAdmin, userTitle,
  stats, onEdit, onBioPress, onFollowersPress, onRoomsPress, onAvatarPress,
  memberSince, boostExpiresAt, isOnline, activeFrame, onFramePress,
}: Props) {
  // ★ Uzun isimde fontSize otomatik küçülsün (adjustsFontSizeToFit)
  const isBoostActive = !!(boostExpiresAt && new Date(boostExpiresAt) > new Date());
  const memberSinceText = memberSince ? formatMemberSince(memberSince) : null;

  return (
    <View style={s.card}>
      {/* ★ 2026-04-29: Vertical gradient — üst parlak slate → alt koyu navy */}
      <LinearGradient
        colors={['#2D3F5F', '#1E2D4A', '#152238', '#0E1A2E']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={s.cardGlow}
      />
      <LinearGradient
        colors={['rgba(245,158,11,0.12)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.7 }}
        style={s.cardGlow}
        pointerEvents="none"
      />
      <View style={s.identityRow}>
        {/* Avatar — tıklanınca preview modal; ★ v107: aktif çerçeve etrafında AvatarFrame */}
        <Pressable
          style={s.avatarBox}
          onPress={onAvatarPress}
          hitSlop={4}
          accessibilityLabel="Avatarı büyüt"
        >
          <StatusAvatar uri={avatarUrl} size={84} tier={subscriptionTier} isAdmin={isAdmin} isOnline={isOnline} isSelf={!!onEdit} showTierBadge />
          <AvatarFrame frameId={activeFrame} size={84} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={[s.displayName, isAdmin && { color: '#F87171' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {displayName}
            </Text>
            {isAdmin && (
              <Ionicons name="shield-checkmark" size={16} color="#DC2626" style={[{ marginLeft: 6 }, iconShadow]} />
            )}
          </View>
          {username && <Text style={s.username} numberOfLines={1}>@{username}</Text>}
          {/* ★ Rozet satırı — unvan + boost + üyelik süresi */}
          <View style={s.badgeRow}>
            {userTitle && (
              <View style={[s.titleBadge, { backgroundColor: userTitle.bgColor }]}>
                <Text style={{ fontSize: 10 }}>{userTitle.emoji}</Text>
                <Text style={[s.titleText, { color: userTitle.color }]}>{userTitle.name}</Text>
              </View>
            )}
            {isBoostActive && (
              <View style={s.boostBadge}>
                <Ionicons name="rocket" size={10} color="#F472B6" style={iconShadow} />
                <Text style={s.boostText}>BOOST</Text>
              </View>
            )}
            {memberSinceText && (
              <Text style={s.memberSince}>📅 {memberSinceText}</Text>
            )}
          </View>
          {onBioPress ? (
            <Pressable onPress={onBioPress} hitSlop={6} style={{ marginTop: 4 }}>
              <Text style={[s.bio, { marginTop: 0 }]} numberOfLines={3}>
                {bio || (
                  <Text style={{ color: 'rgba(20,184,166,0.7)', fontStyle: 'italic' }}>
                    + Bio ekle
                  </Text>
                )}
              </Text>
            </Pressable>
          ) : (
            <Text style={s.bio} numberOfLines={3}>{bio}</Text>
          )}
        </View>
        {/* ★ v107: Çerçeve seç — sadece kendi profilinde, edit butonunun üstünde */}
        <View style={{ alignItems: 'center', gap: 6 }}>
          {onFramePress && (
            <Pressable
              style={[s.editBtn, { backgroundColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.45)' }]}
              onPress={onFramePress}
              hitSlop={10}
              accessibilityLabel="Çerçeve seç"
            >
              <Ionicons name="ribbon" size={16} color="#FBBF24" style={iconShadow} />
            </Pressable>
          )}
          {onEdit && (
            <Pressable
              style={s.editBtn}
              onPress={onEdit}
              hitSlop={10}
              accessibilityLabel="Profili düzenle"
            >
              <Ionicons name="create-outline" size={16} color="#14B8A6" style={iconShadow} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats satırı — touch target min 48px */}
      <View style={s.statsRow}>
        <Pressable
          style={s.statItem}
          onPress={onFollowersPress}
          hitSlop={8}
          accessibilityLabel={`${stats.followers} arkadaş`}
        >
          <Text style={s.statNum}>{stats.followers}</Text>
          <Text style={s.statLabelClickable}>Arkadaş</Text>
        </Pressable>
        <View style={s.statDiv} />
        <Pressable
          style={s.statItem}
          onPress={onRoomsPress}
          hitSlop={8}
          accessibilityLabel={`${stats.rooms} oda`}
        >
          <Text style={s.statNum}>{stats.rooms}</Text>
          <Text style={s.statLabelClickable}>Oda</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ★ "Üyelik 3 ay önce" formatter
function formatMemberSince(iso: string): string {
  try {
    const now = new Date();
    const then = new Date(iso);
    const diffMs = now.getTime() - then.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return 'Yeni üye';
    if (days < 30) return `${days} gündür`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} aydır`;
    const years = Math.floor(months / 12);
    return `${years} yıldır`;
  } catch { return ''; }
}

const s = StyleSheet.create({
  // ★ 2026-04-29: Premium gradient kart — dark navy diagonal + amber hairline + sol-üst amber accent
  card: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14,
  },
  identityRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
    paddingRight: 12, // edit butonu için daha az sağ padding
  },
  avatarBox: { position: 'relative' as const },
  displayName: {
    fontSize: 17, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2,
    flexShrink: 1,
    ..._textGlow,
  },
  username: { fontSize: 11, color: '#94A3B8', marginTop: 2, ..._textGlow },
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5,
    marginTop: 5,
  },
  titleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: 8,
  },
  titleText: { fontSize: 10, fontWeight: '700' },
  boostBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(244,114,182,0.15)',
    paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(244,114,182,0.3)',
  },
  boostText: {
    fontSize: 9, fontWeight: '900', color: '#F472B6', letterSpacing: 0.6,
    textShadowColor: 'rgba(244,114,182,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },
  memberSince: {
    fontSize: 10, color: 'rgba(148,163,184,0.7)', fontWeight: '500',
  },
  bio: { fontSize: 12, color: '#94A3B8', marginTop: 4, lineHeight: 17, ..._textGlow },
  editBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  // ★ 2026-04-29: Inline stat satırı — kart-içi-kart görünümü kaldırıldı, üstüne hairline divider eklendi
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  statNum: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', marginBottom: 1, ..._textGlow },
  statLabelClickable: { fontSize: 9, fontWeight: '600', color: '#5CBFB5', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDiv: { width: 0.5, height: 22, backgroundColor: 'rgba(255,255,255,0.08)' },
});
