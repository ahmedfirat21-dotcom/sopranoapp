// SopranoChat — Profil Hero Kartı
// Avatar + isim + tier + bio + düzenleme butonu + arkadaş/oda sayıları
// Kendi profilim için (tabs/profile.tsx) kullanılır.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;
import StatusAvatar from '../StatusAvatar';
import type { UserTitle } from '../../services/userTitles';
import type { SubscriptionTier } from '../../types';
import { useFrameConfig } from '../../services/cosmeticConfigCache';

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
  stats: { followers: number; rooms: number; badges?: number; gifts?: number };
  /** ★ v110: true ise sayılar yerine "—" gösterilir (Phase 2 fetch tamamlanana kadar) */
  statsLoading?: boolean;
  /** Varsa edit butonunu göster; yoksa başka bir kullanıcının profili */
  onEdit?: () => void;
  /** ★ 2026-04-21: Bio'ya tap ile inline edit — kendi profilde (callback varsa) */
  onBioPress?: () => void;
  onFollowersPress: () => void;
  onRoomsPress: () => void;
  onBadgesPress?: () => void;
  /** ★ 2026-05-05: Hediye sayısına tıklayınca açılır — tab'lı detay modal */
  onGiftsPress?: () => void;
  onAvatarPress?: () => void; // ★ Avatar preview modal
  /** Üyelik başlangıç tarihi (ISO) */
  memberSince?: string;
  /** Boost aktifse bitiş zamanı (ISO); yoksa null */
  boostExpiresAt?: string | null;
  /** Çevrimiçi gösterimi (owner'a gerek yok — kendi sayfası) */
  isOnline?: boolean;
  /** ★ v110.3: Son aktif zamanı (ISO) — online değilse "X dk önce aktifti" gösterir.
   *  Privacy: settings.show_online_status kapalıysa backend null döner, hiç gösterilmez. */
  lastSeen?: string | null;
  /** Kullanıcının seviyesi (level system) */
  userLevel?: number;
  /** ★ v107: Mağazadan satın alınmış aktif çerçeve (atelier item id) — avatar etrafında render */
  activeFrame?: string | null;
  /** ★ v107: Çerçeve seç butonuna tıklayınca tetiklenir (kendi profilinde) */
  onFramePress?: () => void;
  /** ★ v108.16: Kullanıcının envanterinde frame var ama henüz equip etmemiş —
   *  ribbon butonu üstüne "hazır" hint'i (yeşil ✓ + pulse) göstermek için. */
  hasUnequippedFrame?: boolean;
  /** ★ v1.3.54: profiles.show_tier_badge — false ise tier rozeti gizlenir. Default true. */
  showTierBadge?: boolean;
}

export default function ProfileHero({
  displayName, username, bio, avatarUrl, subscriptionTier, isAdmin, userTitle,
  stats, statsLoading, onEdit, onBioPress, onFollowersPress, onRoomsPress, onGiftsPress, onAvatarPress,
  memberSince, boostExpiresAt, isOnline, lastSeen, activeFrame, onFramePress, hasUnequippedFrame,
  showTierBadge = true,
}: Props) {
  // ★ v110: Phase 2 fetch tamamlanana kadar sayı yerine "—" — yanıltıcı 0 flash önlenir.
  const fmtStat = (n: number | undefined) => statsLoading ? '—' : String(n ?? 0);
  // ★ v1.3.54: Frame'in name_enabled aktifse, çerçeve etrafında isim render edilir;
  //   bu yüzden hero altındaki ayrı isim Text'i gizlenir → çift isim çakışması yok.
  const frameCfg = useFrameConfig(activeFrame, 'profile');
  const frameRendersName = !!frameCfg?.name_enabled;
  // Hint pulse animasyonu (sadece hasUnequippedFrame durumunda)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!hasUnequippedFrame) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasUnequippedFrame]);
  // ★ Uzun isimde fontSize otomatik küçülsün (adjustsFontSizeToFit)
  const isBoostActive = !!(boostExpiresAt && new Date(boostExpiresAt) > new Date());
  const memberSinceText = memberSince ? formatMemberSince(memberSince) : null;
  const memberSinceJoinedText = memberSince ? formatJoinedDate(memberSince) : null;
  // ★ v110.3: Son aktif metni — sadece online değilken gösterilir (online ise yeşil nokta yeterli).
  const lastSeenText = (!isOnline && lastSeen) ? formatLastSeen(lastSeen) : null;

  return (
    <View style={s.card}>
      {/* ★ 2026-05-05: NotificationDrawer aile dili — slate diagonal + amber halo + soft glow.
          Karakter: amber (profil). 3 katman, diğer modal/sheet ailesiyle birebir. */}
      <LinearGradient
        colors={['#3a4658', '#2a3344', '#1a2030']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.cardGlow}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(245,158,11,0.20)', 'rgba(245,158,11,0.05)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
        style={s.cardGlow}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(245,158,11,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
        style={s.cardGlow}
        pointerEvents="none"
      />
      {/* ★ v108.18: Frame ikon sol üst, edit sağ üst — simetrik */}
      <View style={s.identityCenter}>
        {/* Frame seç — sol üst köşe (edit ile simetrik) */}
        {onFramePress && (
          <Animated.View
            style={[
              s.frameIconAbsLeft,
              { transform: [{ scale: hasUnequippedFrame ? pulseAnim : 1 }] },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                s.frameIconOnly,
                hasUnequippedFrame && { borderColor: '#22C55E' },
                pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
              ]}
              onPress={onFramePress}
              hitSlop={10}
              accessibilityLabel="Çerçeve seç"
            >
              <LinearGradient
                colors={hasUnequippedFrame
                  ? ['rgba(34,197,94,0.32)', 'rgba(34,197,94,0.08)']
                  : ['rgba(251,191,36,0.32)', 'rgba(251,191,36,0.10)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons
                name={hasUnequippedFrame ? 'gift' : 'ribbon'}
                size={15}
                color={hasUnequippedFrame ? '#FFFFFF' : '#FBBF24'}
                style={iconShadow}
              />
              {/* ★ v110.14: frameReadyBadge (üst sağ check daire) kaldırıldı —
                   tek katman olunca "yeni çerçeven hazır" hint'i daha sade. Pulse
                   animasyonu (frameIconAbsLeft scale) zaten dikkat çekiyor. */}
            </Pressable>
          </Animated.View>
        )}
        {/* Edit butonu — sağ üst absolute */}
        {onEdit && (
          <Pressable
            style={[s.editBtn, s.editBtnAbs]}
            onPress={onEdit}
            hitSlop={10}
            accessibilityLabel="Profili düzenle"
          >
            <Ionicons name="create-outline" size={16} color="#14B8A6" style={iconShadow} />
          </Pressable>
        )}

        {/* Avatar */}
        <View style={s.avatarStack}>
          <Pressable
            style={s.avatarBox}
            onPress={onAvatarPress}
            hitSlop={4}
            accessibilityLabel="Avatarı büyüt"
          >
            <StatusAvatar uri={avatarUrl} size={160} tier={subscriptionTier} isAdmin={isAdmin} isOnline={isOnline} isSelf={!!onEdit} showTierBadge={showTierBadge} tierBadgeSize="md" frameId={activeFrame} displayName={displayName} contextKey="profile" />
          </Pressable>
        </View>

        {/* İsim ortalanmış — frame name_enabled true ise gizli (çerçeve etrafında render edilir) */}
        <View style={s.nameRow}>
          {!frameRendersName && (
            <Text
              style={[s.displayName, isAdmin && { color: '#F87171' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {displayName}
            </Text>
          )}
          {isAdmin && (
            <Ionicons name="shield-checkmark" size={16} color="#DC2626" style={[{ marginLeft: 6 }, iconShadow]} />
          )}
        </View>
        {username && <Text style={[s.username, { textAlign: 'center' }]} numberOfLines={1}>@{username}</Text>}

        {/* ★ 2026-05-05: Tek görsel dil — outline pill + Ionicons (emoji yok).
            Title öne, BOOST + üyelik küçük subtle chip. Profesyonel sade görünüm. */}
        {userTitle && (
          <View style={[s.titlePill, { borderColor: (userTitle.color || '#FBBF24') + '60', backgroundColor: (userTitle.color || '#FBBF24') + '14' }]}>
            <Ionicons name="star" size={11} color={userTitle.color || '#FBBF24'} style={iconShadow} />
            <Text style={[s.titlePillText, { color: userTitle.color || '#FBBF24' }]}>{userTitle.name}</Text>
          </View>
        )}
        {(isBoostActive || memberSinceJoinedText || lastSeenText) && (
          <View style={[s.metaRow, { marginTop: userTitle ? 6 : 8 }]}>
            {isBoostActive && (
              <View style={s.metaPill}>
                <Ionicons name="rocket-outline" size={10} color="#F472B6" style={iconShadow} />
                <Text style={[s.metaPillText, { color: '#F472B6' }]}>BOOST</Text>
              </View>
            )}
            {isBoostActive && (memberSinceJoinedText || lastSeenText) && <View style={s.metaDot} />}
            {/* ★ v110.3: "Mart 2026'da katıldı" net format — eski "3 aydır" yerine */}
            {memberSinceJoinedText && (
              <View style={s.metaPill}>
                <Ionicons name="calendar-outline" size={10} color="rgba(148,163,184,0.85)" style={iconShadow} />
                <Text style={s.metaPillText}>{memberSinceJoinedText}</Text>
              </View>
            )}
            {memberSinceJoinedText && lastSeenText && <View style={s.metaDot} />}
            {/* ★ v110.3: Son aktif zamanı — yeşil nokta yokken (offline) bilgi verir */}
            {lastSeenText && (
              <View style={s.metaPill}>
                <Ionicons name="ellipse-outline" size={10} color="rgba(148,163,184,0.85)" style={iconShadow} />
                <Text style={s.metaPillText}>{lastSeenText}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bio ortalanmış */}
        {onBioPress ? (
          <Pressable onPress={onBioPress} hitSlop={6} style={{ marginTop: 8, alignSelf: 'stretch' }}>
            <Text style={[s.bio, { textAlign: 'center', marginTop: 0 }]} numberOfLines={3}>
              {bio || (
                <Text style={{ color: 'rgba(20,184,166,0.7)', fontStyle: 'italic' }}>
                  + Bio ekle
                </Text>
              )}
            </Text>
          </Pressable>
        ) : bio ? (
          <Text style={[s.bio, { textAlign: 'center', marginTop: 8 }]} numberOfLines={3}>{bio}</Text>
        ) : null}
      </View>

      {/* Stats satırı — Arkadaş / Oda / Hediye (3 stat, touch target min 48px) */}
      <View style={s.statsRow}>
        <Pressable
          style={s.statItem}
          onPress={onFollowersPress}
          hitSlop={8}
          accessibilityLabel={`${stats.followers} arkadaş`}
        >
          <Text style={s.statNum}>{fmtStat(stats.followers)}</Text>
          <Text style={s.statLabelClickable}>Arkadaş</Text>
        </Pressable>
        <View style={s.statDiv} />
        <Pressable
          style={s.statItem}
          onPress={onRoomsPress}
          hitSlop={8}
          accessibilityLabel={`${stats.rooms} oda`}
        >
          <Text style={s.statNum}>{fmtStat(stats.rooms)}</Text>
          <Text style={s.statLabelClickable}>Oda</Text>
        </Pressable>
        {/* ★ 2026-05-05: 3. stat — Hediye (tıklayınca tab'lı detay modal) */}
        {onGiftsPress && (
          <>
            <View style={s.statDiv} />
            <Pressable
              style={s.statItem}
              onPress={onGiftsPress}
              hitSlop={8}
              accessibilityLabel={`${stats.gifts || 0} hediye`}
            >
              <Text style={s.statNum}>{fmtStat(stats.gifts)}</Text>
              <Text style={[s.statLabelClickable, { color: '#FBBF24' }]}>Hediye</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ★ "Üyelik 3 ay önce" formatter (eski rölatif format — geri uyumluluk için tutuldu)
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

// ★ v110.3: "Mart 2026'da katıldı" — modern platform standardı (Twitter/X tarzı kesin tarih)
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function formatJoinedDate(iso: string): string {
  try {
    const d = new Date(iso);
    const m = MONTHS_TR[d.getMonth()];
    return `${m} ${d.getFullYear()}'da katıldı`;
  } catch { return ''; }
}

// ★ v110.3: "5 dk önce", "2 saat önce", "3 gün önce" — son aktif zaman
function formatLastSeen(iso: string): string {
  try {
    const now = new Date();
    const then = new Date(iso);
    const diffSec = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diffSec < 60) return 'Az önce aktifti';
    const min = Math.floor(diffSec / 60);
    if (min < 60) return `${min} dk önce aktifti`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} saat önce aktifti`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} gün önce aktifti`;
    const week = Math.floor(day / 7);
    if (week < 5) return `${week} hafta önce aktifti`;
    const month = Math.floor(day / 30);
    if (month < 12) return `${month} ay önce aktifti`;
    return 'Uzun süredir aktif değil';
  } catch { return ''; }
}

const s = StyleSheet.create({
  // ★ 2026-04-29: Premium gradient kart — dark navy diagonal + amber hairline + sol-üst amber accent
  // ★ v108.15.4: overflow:visible — frame kanatları kart sınırına taşabilsin.
  //   Gradient'lerin kendi borderRadius'u var, taşma sorun değil.
  card: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 10,
    borderRadius: 26, overflow: 'visible',
    backgroundColor: '#1a2030',
    // ★ 2026-05-05: Aile dili — amber border kaldırıldı (halo gradient yeterli),
    //   borderRadius 14→26 (NotificationDrawer aile standardı).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  cardGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 26,
  },
  identityRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
    paddingRight: 12,
  },
  // ★ v108.17: Dikey ortalanmış hero — modern Clubhouse/X tarzı, kompakt
  identityCenter: {
    alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
    position: 'relative',
  },
  editBtnAbs: {
    position: 'absolute', top: 12, right: 12, zIndex: 5,
  },
  // ★ v108.18: Frame ikon sol üst — edit ile simetrik
  frameIconAbsLeft: {
    position: 'absolute', top: 12, left: 12, zIndex: 5,
  },
  avatarStack: {
    position: 'relative',
    marginBottom: 8,
  },
  frameIconCorner: {
    position: 'absolute', bottom: -6, right: -6, zIndex: 6,
  },
  nameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  avatarBox: { position: 'relative' as const },
  displayName: {
    fontSize: 16, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.2,
    flexShrink: 1,
    ..._textGlow,
  },
  username: { fontSize: 11, color: '#94A3B8', marginTop: 1, ..._textGlow },
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
  // ★ 2026-05-05: Yeni profesyonel tek görsel dil — outline pill + Ionicons
  titlePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  titlePillText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
    ..._textGlow,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  metaPillText: {
    fontSize: 9, fontWeight: '700',
    color: 'rgba(148,163,184,0.85)',
    letterSpacing: 0.3,
  },
  metaDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
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
  // ★ v107 hotfix: Çerçeve butonu — daha büyük + ikon + yazı (keşfedilebilirlik için)
  frameBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.55)',
  },
  frameBtnText: { color: '#FFE082', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  // ★ v108.18: 28→36 — daha okunabilir, edit butonu boyutuyla uyumlu
  frameIconOnly: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.55)',
  },
  frameReadyBadge: {
    position: 'absolute', top: -3, right: -3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#0F1A2E',
  },
  frameReadyHint: {
    color: '#22C55E', fontSize: 8, fontWeight: '900',
    letterSpacing: 1.2, textAlign: 'center', marginTop: 2,
  },
  // ★ v108.17: Stats kompakt — 36px tek satır, hairline divider
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  statNum: { fontSize: 14, fontWeight: '700', color: '#F1F5F9', ..._textGlow },
  statLabelClickable: { fontSize: 9, fontWeight: '600', color: '#5CBFB5', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  statDiv: { width: 0.5, height: 18, backgroundColor: 'rgba(255,255,255,0.08)' },
});
