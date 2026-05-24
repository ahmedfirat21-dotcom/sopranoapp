// SopranoChat — Profil Hero Kartı
// Avatar + isim + tier + bio + düzenleme butonu + arkadaş/oda sayıları
// Kendi profilim için (tabs/profile.tsx) kullanılır.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { i18n } from '../../services/i18n';

const _cardShadow = Shadows.card;
const _textGlow = Shadows.text;

interface Props {
  displayName: string;
  username?: string | null;
  bio: string;
  avatarUrl: string;
  subscriptionTier: SubscriptionTier;
  isAdmin: boolean;
  /** ★ v1.7.13.46: 'verified' rozeti pilot perk — isim yanında mavi tik. */
  isVerified?: boolean;
  userTitle: UserTitle | null;
  stats: { followers: number; rooms: number; badges?: number; gifts?: number };
  /** ★ v110: true ise sayılar yerine "—" gösterilir (Phase 2 fetch tamamlanana kadar) */
  statsLoading?: boolean;
  /** Varsa edit butonunu göster; yoksa başka bir kullanıcının profili */
  onEdit?: () => void;
  /** ★ 2026-04-21: Bio'ya tap ile inline edit — kendi profilde (callback varsa)
   *  ★ v1.7.13.57 (20 May 2026): Modal yerine TextInput'a dönüşür — kalem ikonu
   *  ile yazılabilir olduğu belli. onBioPress legacy (artık kullanılmıyor). */
  onBioPress?: () => void;
  /** ★ v1.7.13.57: Inline bio save — TextInput submit/blur'da çağrılır. */
  onBioSave?: (newBio: string) => Promise<void>;
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
  /** ★ v120: profiles.active_badge_id — Web admin Rozet ürünü (Skia render). */
  activeBadgeId?: string | null;
  /** ★ v289 (16 May 2026): Profili paylaş — kendi profilinde share butonu açar. */
  onSharePress?: () => void;
  /** ★ v1.7.13.53 (20 May 2026): FB-tarzı durum balonu (avatar üzerinde).
   *  null/boş + kendi profil = "Şu anki hissim..." placeholder; başkasındaysa hiç gösterilmez.
   *  Doluysa her zaman gösterilir. */
  moodStatus?: string | null;
  /** ★ Kendi profilinde mood'a tıklayınca tetikler (editor sheet açar). */
  onMoodPress?: () => void;
  /** ★ v1.7.13.111 (20 May 2026): Gün serisi (streak). 0 ise gizlenir. */
  streakDays?: number;
}

export default function ProfileHero({
  displayName, username, bio, avatarUrl, subscriptionTier, isAdmin, isVerified, userTitle,
  stats, statsLoading, onEdit, onBioPress, onBioSave, onFollowersPress, onRoomsPress, onBadgesPress, onGiftsPress, onAvatarPress,
  memberSince, boostExpiresAt, isOnline, lastSeen, activeFrame, onFramePress, hasUnequippedFrame,
  showTierBadge = true, activeBadgeId, onSharePress, moodStatus, onMoodPress, streakDays = 0,
}: Props) {
  // ★ v1.7.13.57 (20 May 2026): Inline bio edit state.
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(bio || '');
  const [savingBio, setSavingBio] = useState(false);
  useEffect(() => { setBioDraft(bio || ''); }, [bio]);
  const handleBioCommit = async () => {
    if (!onBioSave) { setEditingBio(false); return; }
    const trimmed = bioDraft.trim().slice(0, 150);
    if (trimmed === (bio || '').trim()) { setEditingBio(false); return; }
    setSavingBio(true);
    try {
      await onBioSave(trimmed);
    } catch { /* parent handles toast */ }
    setSavingBio(false);
    setEditingBio(false);
  };
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
  // ★ v289 (16 May 2026): memberSinceText (eski "3 ay önce" formatı) dead idi —
  //   sadece memberSinceJoinedText ("Mart 2026'da katıldı") kullanılıyor (Twitter/X tarzı).
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
        {/* ★ v1.7.13.54 (20 May 2026): Köşeye yapışık floating Çerçeve + Paylaş
            butonları KALDIRILDI — bio altındaki "Aksiyon Satırı"na taşındı (FB tarzı). */}

        {/* ★ v1.7.13.55 (20 May 2026): YATAY HERO — avatar sola, metinler sağa.
            v1.7.13.56: Mood bubble avatarın HEMEN ÜSTÜNDE (sol kolonda), damlalar
            avatara dik düşer. Avatar bubble yüksekliğine göre aşağıda. */}
        <View style={s.heroHeadRow}>
          {/* Sol: Mood bubble + 2 damla + Avatar (dikey stack)
              ★ v1.7.13.106 (20 May 2026): Balon SADECE kendi profilimde gösterilir
              (onMoodPress var = düzenlenebilir). Başkasının profilinde mood küçük
              subtitle olarak alt kısımda (göze batmaz) render edilir. */}
          <View style={s.heroLeft}>
            {onMoodPress && (
              <Pressable
                style={s.moodBubbleWrap}
                onPress={onMoodPress}
                hitSlop={6}
              >
                <View style={s.moodBubble}>
                  <LinearGradient
                    colors={['#FEF3C7', '#FCD34D']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text
                    style={[
                      s.moodBubbleText,
                      (!moodStatus || !moodStatus.trim()) && { color: 'rgba(15,23,42,0.55)', fontStyle: 'italic' },
                    ]}
                    numberOfLines={1}
                  >
                    {moodStatus && moodStatus.trim() ? moodStatus : i18n.t('profile.mood_placeholder')}
                  </Text>
                </View>
                <View style={s.moodBubbleTailBig} />
                <View style={s.moodBubbleTailSmall} />
              </Pressable>
            )}
            <View style={s.avatarStack}>
              <Pressable
                style={s.avatarBox}
                onPress={onAvatarPress}
                hitSlop={4}
                accessibilityLabel={i18n.t('auto.profile.ProfileHero.006')}
              >
                <StatusAvatar uri={avatarUrl} size={108} tier={subscriptionTier} isAdmin={isAdmin} isOnline={isOnline} isSelf={!!onEdit} showTierBadge={showTierBadge} tierBadgeSize="sm" frameId={activeFrame} displayName={displayName} contextKey="profile" customBadgeId={activeBadgeId} />
              </Pressable>
            </View>
          </View>

          {/* Sağ: isim + chip'ler (avatar hizasından başlar) */}
          <View style={s.heroRightCol}>
            {/* İsim — sol hizalı */}
            <View style={[s.nameRow, { justifyContent: 'flex-start' }]}>
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
              {isVerified && !isAdmin && (
                <Ionicons name="checkmark-circle" size={16} color="#3B82F6" style={[{ marginLeft: 6 }, iconShadow]} />
              )}
            </View>
            {username && <Text style={[s.username, { textAlign: 'left' }]} numberOfLines={1}>@{username.replace(/_[a-zA-Z0-9]{4}$/, "")}</Text>}

            {/* ★ v1.7.13.72 (20 May 2026): BOOST inline chip kaldırıldı — profile.tsx'teki
                "Boost Aktif + kalan süre" aksiyon kartı zaten bilgiyi gösteriyor, dublikat. */}
            {userTitle && (
              <View style={[s.identityInlineRow, { justifyContent: 'flex-start', paddingHorizontal: 0 }]}>
                <View style={s.identityInlineItem}>
                  <Ionicons name="star" size={11} color="#FBBF24" style={iconShadow} />
                  <Text style={[s.identityInlineText, { color: '#FBBF24' }]}>{userTitle.name}</Text>
                </View>
              </View>
            )}
            {(memberSinceJoinedText || lastSeenText) && (
              <Text style={[s.metaFootnote, { textAlign: 'left' }]} numberOfLines={1}>
                {memberSinceJoinedText}
                {memberSinceJoinedText && lastSeenText ? '  ·  ' : ''}
                {lastSeenText}
              </Text>
            )}
            {/* ★ v1.7.13.111 (20 May 2026): Streak chip — gün serisi, sıcak amber renk.
                Sadece streak >= 2 ise gösterilir (1 gün serisi henüz "seri" değil). */}
            {streakDays >= 2 && (
              <View style={s.streakChip}>
                <Text style={s.streakEmoji}>🔥</Text>
                <Text style={s.streakText}>{i18n.t('profile.streak_days', { 0: streakDays })}</Text>
              </View>
            )}
            {/* ★ v1.7.13.106 (20 May 2026): Başkasının profilinde mood küçük subtle
                subtitle — kendi profilim balonda göstermiyor (balon kendi profilim için
                tıklanabilir editor). Göze batmaz, italic + amber. */}
            {!onMoodPress && moodStatus && moodStatus.trim().length > 0 && (
              <Text style={s.moodSubtle} numberOfLines={1}>
                💭 {moodStatus.trim()}
              </Text>
            )}
          </View>
        </View>

        {/* ★ v1.7.13.57 (20 May 2026): Inline bio edit — modal yok, satır TextInput'a dönüşür.
            Kalem ikonu yazılabilir olduğunu gösterir. Kendi profilde editable, başkasınkinde read-only. */}
        {onBioSave ? (
          editingBio ? (
            <View style={s.bioEditRow}>
              <TextInput
                value={bioDraft}
                onChangeText={(t) => setBioDraft(t.slice(0, 150))}
                placeholder={i18n.t('profile.bio_placeholder')}
                placeholderTextColor="rgba(148,163,184,0.55)"
                style={s.bioInput}
                multiline
                maxLength={150}
                autoFocus
                onBlur={handleBioCommit}
                onSubmitEditing={handleBioCommit}
                blurOnSubmit
                editable={!savingBio}
              />
              <Pressable onPress={handleBioCommit} hitSlop={8} style={s.bioCheckBtn}>
                <Ionicons name={savingBio ? 'hourglass-outline' : 'checkmark'} size={16} color="#5EEAD4" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => { setBioDraft(bio || ''); setEditingBio(true); }} hitSlop={6} style={s.bioPressRow}>
              <Text style={[s.bio, { textAlign: 'left', marginTop: 0, flex: 1 }]} numberOfLines={3}>
                {bio && bio.trim() ? bio : (
                  <Text style={{ color: 'rgba(20,184,166,0.7)', fontStyle: 'italic' }}>
                    {i18n.t('profile.bio_placeholder')}
                  </Text>
                )}
              </Text>
              <Ionicons name="create-outline" size={13} color="rgba(94,234,212,0.65)" style={[{ marginLeft: 6, marginTop: 2 }, iconShadow]} />
            </Pressable>
          )
        ) : bio ? (
          <Text style={[s.bio, { textAlign: 'left', marginTop: 10 }]} numberOfLines={3}>{bio}</Text>
        ) : null}

        {/* ★ v1.7.13.54 (20 May 2026): Aksiyon satırı — Çerçeve · Düzenle · Paylaş.
            Eski köşe floating butonların yerini alıyor. Hepsi flat link tarzı,
            ikon + yazı, ortak dil. FB'nin "Hikayeye ekle / Profili düzenle" satırı
            paritesi (ama bizimki 3 sütun). */}
        {(onFramePress || onEdit || onSharePress) && (
          <View style={s.heroActionRow}>
            {onFramePress && (
              <Pressable style={s.heroActionItem} onPress={onFramePress} hitSlop={6}>
                <View>
                  <Ionicons name="ribbon-outline" size={15} color={hasUnequippedFrame ? '#22C55E' : '#5EEAD4'} style={iconShadow} />
                  {hasUnequippedFrame && <View style={s.heroActionDot} />}
                </View>
                <Text style={[s.heroActionText, hasUnequippedFrame && { color: '#22C55E' }]}>{i18n.t('profile.action.frame')}</Text>
              </Pressable>
            )}
            {onEdit && (
              <Pressable style={s.heroActionItem} onPress={onEdit} hitSlop={6}>
                <Ionicons name="create-outline" size={15} color="#5EEAD4" style={iconShadow} />
                <Text style={s.heroActionText}>{i18n.t('profile.action.edit')}</Text>
              </Pressable>
            )}
            {onSharePress && (
              <Pressable style={s.heroActionItem} onPress={onSharePress} hitSlop={6}>
                <Ionicons name="share-outline" size={15} color="#5EEAD4" style={iconShadow} />
                <Text style={s.heroActionText}>{i18n.t('profile.action.share')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Stats satırı — ★ v289 (16 May 2026): Modern outline ikon + sayı + etiket dikey.
          Arkadaş / Oda / Rozet / Hediye (4 stat) — her birinin üstünde ince outline ikon. */}
      <View style={s.statsRow}>
        <Pressable
          style={s.statItem}
          onPress={onFollowersPress}
          hitSlop={8}
          accessibilityLabel={i18n.t('auto.profile.ProfileHero.005', { 0: stats.followers })}
        >
          <Ionicons name="people-outline" size={18} color="#5EEAD4" style={s.statIcon} />
          <Text style={s.statNum}>{fmtStat(stats.followers)}</Text>
          <Text style={s.statLabelClickable}>{i18n.t('profile.stat_friend')}</Text>
        </Pressable>
        <View style={s.statDiv} />
        <Pressable
          style={s.statItem}
          onPress={onRoomsPress}
          hitSlop={8}
          accessibilityLabel={`${stats.rooms} ${i18n.t('profile.stat_room')}`}
        >
          <Ionicons name="mic-outline" size={18} color="#5EEAD4" style={s.statIcon} />
          <Text style={s.statNum}>{fmtStat(stats.rooms)}</Text>
          <Text style={s.statLabelClickable}>{i18n.t('profile.stat_room')}</Text>
        </Pressable>
        {onBadgesPress && (
          <>
            <View style={s.statDiv} />
            <Pressable
              style={s.statItem}
              onPress={onBadgesPress}
              hitSlop={8}
              accessibilityLabel={`${stats.badges || 0} ${i18n.t('profile.stat_badge')}`}
            >
              <MaterialCommunityIcons name="medal-outline" size={18} color="#A78BFA" style={s.statIcon} />
              <Text style={s.statNum}>{fmtStat(stats.badges)}</Text>
              <Text style={[s.statLabelClickable, { color: '#A78BFA' }]}>{i18n.t('profile.stat_badge')}</Text>
            </Pressable>
          </>
        )}
        {onGiftsPress && (
          <>
            <View style={s.statDiv} />
            <Pressable
              style={s.statItem}
              onPress={onGiftsPress}
              hitSlop={8}
              accessibilityLabel={`${stats.gifts || 0} ${i18n.t('profile.stat_gift')}`}
            >
              <Ionicons name="gift-outline" size={18} color="#FBBF24" style={s.statIcon} />
              <Text style={s.statNum}>{fmtStat(stats.gifts)}</Text>
              <Text style={[s.statLabelClickable, { color: '#FBBF24' }]}>{i18n.t('profile.stat_gift')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ★ v289 (16 May 2026): formatMemberSince ("3 ay önce" eski format) KALDIRILDI —
//   formatJoinedDate ("Mart 2026'da katıldı") tek kaynak. memberSinceText dead idi.

// ★ v110.3: "Mart 2026'da katıldı" — modern platform standardı (Twitter/X tarzı kesin tarih)
// v284: i18n key'lere bağlandı (date.month.* + date.month_year_joined)
function formatJoinedDate(iso: string): string {
  try {
    const d = new Date(iso);
    const m = i18n.t(`date.month.${d.getMonth() + 1}`);
    return i18n.t('date.month_year_joined', { month: m, year: d.getFullYear() });
  } catch { return ''; }
}

// ★ v110.3: "5 dk önce", "2 saat önce", "3 gün önce" — son aktif zaman
function formatLastSeen(iso: string): string {
  try {
    const now = new Date();
    const then = new Date(iso);
    const diffSec = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (diffSec < 60) return i18n.t('date.last_seen.just_now');
    const min = Math.floor(diffSec / 60);
    if (min < 60) return i18n.t('date.last_seen.minutes', { count: min });
    const hr = Math.floor(min / 60);
    if (hr < 24) return i18n.t('date.last_seen.hours', { count: hr });
    const day = Math.floor(hr / 24);
    if (day < 7) return i18n.t('date.last_seen.days', { count: day });
    const week = Math.floor(day / 7);
    if (week < 5) return i18n.t('date.last_seen.weeks', { count: week });
    const month = Math.floor(day / 30);
    if (month < 12) return i18n.t('date.last_seen.months', { count: month });
    return i18n.t('date.last_seen.long_ago');
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
  // ★ v108.17: Dikey ortalanmış hero — modern Clubhouse/X tarzı, kompakt
  // ★ v289 (16 May 2026): identityRow + editBtnAbs styles KALDIRILDI (dead).
  identityCenter: {
    alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12,
    position: 'relative',
  },
  // ★ v289 (16 May 2026): Paylaş butonu — Edit pill'e taşınınca tek başına sağ üst köşeye geçti.
  shareBtnAbs: {
    position: 'absolute', top: 12, right: 12, zIndex: 5,
  },
  // ★ v289: Geniş "Profili Düzenle" pill — bio altında, modern wide CTA.
  editPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, marginHorizontal: 8,
    height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.35)',
    overflow: 'hidden',
    gap: 6,
  },
  editPillText: {
    fontSize: 13, fontWeight: '700', color: '#5EEAD4',
    letterSpacing: 0.3,
    ..._textGlow,
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
  // ★ v1.7.13.52 (20 May 2026): 2 chip max kimlik satırı — üye/aktif chip'leri artık burada DEĞİL.
  identityChipRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8, paddingHorizontal: 16,
  },
  // ★ v1.7.13.53 (20 May 2026): Flat inline (pill yok) kimlik satırı.
  identityInlineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 8, paddingHorizontal: 16, flexWrap: 'wrap',
  },
  identityInlineItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  identityInlineText: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.3,
    ..._textGlow,
  },
  metaFootnote: {
    fontSize: 11, color: 'rgba(148,163,184,0.7)',
    marginTop: 6, textAlign: 'center', letterSpacing: 0.2,
    ..._textGlow,
  },
  // ★ v1.7.13.106 (20 May 2026): Başkasının profilinde mood subtle subtitle
  moodSubtle: {
    fontSize: 11, color: 'rgba(251,191,36,0.75)',
    marginTop: 4, fontStyle: 'italic', letterSpacing: 0.2,
    ..._textGlow,
  },
  // ★ v1.7.13.111 (20 May 2026): Streak chip — sıcak amber, alt etiket olarak küçük
  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(251,113,36,0.12)',
    borderWidth: 1, borderColor: 'rgba(251,113,36,0.3)',
  },
  streakEmoji: { fontSize: 11 },
  streakText: {
    fontSize: 10, fontWeight: '800', color: '#FB923C',
    letterSpacing: 0.2,
    ..._textGlow,
  },
  // ★ v1.7.13.55 (20 May 2026): Yatay düzen — avatar sola, metin sağa.
  //   v1.7.13.58: alignItems CENTER — metin avatar yüksekliğinin ORTASINDA
  //   konumlanır; mood bubble varsa da (own) yoksa da (başkası) görsel denge oluşur.
  heroHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 14,
  },
  heroLeft: {
    alignItems: 'center',
    minWidth: 112,
    overflow: 'visible',
  },
  heroRightCol: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  // ★ v1.7.13.53 (20 May 2026): FB-tarzı durum balonu (Şu anki hissim...) — avatar üzerinde.
  //   Kuyruk = 2 damla (üçgen DEĞİL), FB messenger paritesi.
  //   v1.7.13.54: Renk SopranoChat temasına uyduruldu — koyu slate + teal kenarlık.
  //   v1.7.13.56: Mood bubble avatarın HEMEN üstünde (sol kolonda), damlalar dik düşer.
  moodBubbleWrap: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 4,
    zIndex: 6,
    overflow: 'visible',
  },
  moodBubble: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#FCD34D', // gradient fallback
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.55)',
    maxWidth: 160,
    overflow: 'hidden',
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.40, shadowRadius: 10, elevation: 5,
  },
  moodBubbleText: {
    fontSize: 11, fontWeight: '600', color: '#0F172A',
    letterSpacing: 0.1,
  },
  // ★ FB tarzı 2 damla — DİKEY: bubble altında, avatara doğru ufalır.
  //   v1.7.13.56: Warm amber temalı bubble ile aynı renk paleti.
  moodBubbleTailBig: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#FCD34D',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.55)',
    marginTop: 3,
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
  moodBubbleTailSmall: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#FCD34D',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.55)',
    marginTop: 2,
    shadowColor: '#FBBF24', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.30, shadowRadius: 3, elevation: 3,
  },
  // ★ v1.7.13.53 (20 May 2026): Flat "Profili düzenle" — pill yerine ikon+text link.
  editLinkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: 12, paddingVertical: 6,
  },
  editLinkText: {
    fontSize: 13, fontWeight: '600', color: '#5EEAD4',
    letterSpacing: 0.2,
    ..._textGlow,
  },
  // ★ v1.7.13.54 (20 May 2026): Aksiyon satırı — Çerçeve · Düzenle · Paylaş yan yana.
  heroActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 12, marginBottom: 2,
    paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
    alignSelf: 'stretch',
  },
  heroActionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  heroActionText: {
    fontSize: 12, fontWeight: '600', color: '#5EEAD4',
    letterSpacing: 0.2,
    ..._textGlow,
  },
  // Çerçeve'nin yanına yeşil "hazır" işareti
  heroActionDot: {
    position: 'absolute',
    top: -2, right: -3,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1, borderColor: '#0B1829',
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
  // ★ v1.7.13.57 (20 May 2026): Inline bio edit — kalem ikonu + TextInput
  bioPressRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: 10, alignSelf: 'stretch',
    paddingHorizontal: 4, paddingVertical: 4,
  },
  bioEditRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, alignSelf: 'stretch',
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.30)',
    paddingHorizontal: 10, paddingVertical: 6,
  },
  bioInput: {
    flex: 1,
    fontSize: 12, color: '#F1F5F9',
    lineHeight: 17,
    paddingVertical: 2,
    minHeight: 32,
    maxHeight: 80,
  },
  bioCheckBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(20,184,166,0.14)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },
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
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, paddingVertical: 4 },
  // ★ v289: stat ikonu — sayının üstünde, outline stil, hafif aşağı margin.
  statIcon: { marginBottom: 3, opacity: 0.9 },
  statNum: { fontSize: 17, fontWeight: '800', color: '#F1F5F9', ..._textGlow },
  // ★ v1.7.13.38: textTransform UPPERCASE -> none, letter-spacing düştü.
  //   UPPERCASE etiketler boş profilde "0 ARKADAŞ" ferah hissi yaratıyordu;
  //   sentence case daha kompakt + modern.
  statLabelClickable: { fontSize: 11, fontWeight: '600', color: '#5CBFB5', letterSpacing: 0.1, marginTop: 2 },
  statDiv: { width: 0.5, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
});
