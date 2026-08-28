import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, ImageStyle, Pressable, ScrollView,
  RefreshControl, Animated, Easing, FlatList, TextInput, InteractionManager, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlowView, CosmeticBackground } from '../../components/skia';
import AppBackground from '../../components/AppBackground';
import AnimatedHeaderIconBtn from '../../components/AnimatedHeaderIconBtn';
// �?? 2026-04-28: AnimatedLogo kaldırıldı �?? SopranoHome branding için inline component.
import { bannerIntroPlayed, markBannerIntroPlayed } from '../../utils/bannerIntro';
import TabBarFadeOut from '../../components/TabBarFadeOut';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Shadows } from '../../constants/theme';
import { RoomService, type Room } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { useAuth, useTheme, useBadges, useOnlineFriends as useOnlineFriendsLayout, useUserProfileSheet } from '../_layout';
import { i18n, useTranslation } from '../../services/i18n';

import StatusAvatar from '../../components/StatusAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showToast } from '../../components/Toast';
import { RoomHistoryService, type RoomHistoryItem } from '../../services/roomHistory';
import { isSystemRoom } from '../../services/showcaseRooms';
import { useOnlineFriends } from '../../providers/OnlineFriendsProvider';
import { SPService } from '../../services/sp';
import { PlusMenu } from '../../components/room/RoomOverlays';
import HostAccessPanel from '../../components/room/HostAccessPanel';
import { RoomFollowService } from '../../services/roomFollow';
import { ModerationService } from '../../services/moderation';
import { isTierAtLeast } from '../../constants/tiers';
import InviteFriendsModal from '../../components/room/InviteFriendsModal';
import { RoomAccessService } from '../../services/roomAccess';
import { PushService } from '../../services/push';
import type { FollowUser } from '../../services/friendship';
import { UpsellService } from '../../services/upsell';
import type { SubscriptionTier } from '../../types';
import { getCategoryTheme, ROOM_THEME_GRADIENTS } from '../../constants/categoryTheme';
import NotificationBell from '../../components/NotificationBell';
import FriendsDrawer from '../../components/FriendsDrawer';
import QuickCreateSheet from '../../components/QuickCreateSheet';
import CreateRoomCoachmark, { shouldShowCreateRoomCoachmark, markCreateRoomCoachmarkSeen } from '../../components/CreateRoomCoachmark';

// �?? 2026-05-09: Lottie animasyonu (Microphone.json) �?? odası yokken empty state için.
//   Yüklenemezse fallback olarak PNG gösterilir.
let LottieView: any = null;
try { LottieView = require('lottie-react-native').default; } catch { /* fallback */ }
const MIC_LOTTIE = require('../../assets/Microphone.json');

// �?? 2026-04-28: Odalarım header logosu �?? SopranoHome (soprano_part + home_part mavi)
const HOME_SOP_W = 110;
const HOME_PART_W = 75;
const HOME_H = 30;

function AnimatedHomeLogo() {
  const played = bannerIntroPlayed();
  // �?? 2026-04-29: Soprano sabit (kullanıcı iste�?i) �?? sadece Home partner kelime animasyonlu
  const homeX = useRef(new Animated.Value(played ? 0 : 120)).current;
  const homeOp = useRef(new Animated.Value(played ? 1 : 0)).current;
  const homeY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (played) return;
    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(homeOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(homeX, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 650);
    return () => { clearTimeout(t2); };
  }, []);

  // �?? 2026-04-29: Tab focus'ta �?? sadece Home çizgiden yukarı do�?ar (Soprano sabit)
  useFocusEffect(
    useCallback(() => {
      if (!bannerIntroPlayed()) return;
      homeY.setValue(HOME_H);
      homeOp.setValue(0);
      Animated.sequence([
        Animated.delay(60),
        Animated.parallel([
          Animated.spring(homeY, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
          Animated.timing(homeOp, { toValue: 1, duration: 320, useNativeDriver: true }),
        ]),
      ]).start();
    }, [])
  );

  return (
    <View style={homeLogoS.row}>
      <Image
        source={require('../../assets/soprano_part.png')}
        style={homeLogoS.sop}
        resizeMode="contain"
      />
      <View style={homeLogoS.partnerWrap}>
        <Animated.Image
          source={require('../../assets/home_part.png')}
          style={[homeLogoS.home, { opacity: homeOp, transform: [{ translateX: homeX }, { translateY: homeY }] }]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const homeLogoS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: -6 } as any,
  sop: { width: HOME_SOP_W, height: HOME_H } as ImageStyle,
  partnerWrap: { width: HOME_PART_W, height: HOME_H, marginLeft: -4, overflow: 'hidden' },
  home: { width: HOME_PART_W, height: HOME_H } as ImageStyle,
});

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// Y�?NETİLEN ODA KARTI �?? Yönet/Ba�?lat butonları (React.memo ile re-render izole)
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
const ManagedRoomCard = React.memo(function ManagedRoomCard({ room, onManage, onStart, onSettings, currentUserId, followerCount }: {
  room: Room;
  onManage: (room: Room) => void;
  onStart: (room: Room) => void;
  onSettings: (room: Room) => void;
  currentUserId?: string;
  followerCount?: number;
}) {
  // �?? 2026-04-21: Defansif kontrol �?? sadece oda sahibi ayarlar dü�?mesini görür.
  //   �?u an Odalarım listData'sı zaten yalnızca sahip olunan odaları filtreliyor;
  //   yine de prop bazında enforce etmek gelecekte regression'a kar�?ı güvence.
  const isOwner = !!currentUserId && room.host_id === currentUserId;
  const listeners = room.participant_count || room.listener_count || 0;
  const isLive = room.is_live;
  const isPersistent = !!room.is_persistent;
  const settings = (room.room_settings || {}) as any;
  const theme = getCategoryTheme(room.category);
  const cardImage = settings.card_image_url;
  const themeGrad = room.theme_id ? ROOM_THEME_GRADIENTS[room.theme_id] : null;

  // �?? CANLI badge pulse �?? ke�?fetteki ile aynı animasyon
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive]);

  // �?? Kart gövdesi tıklanınca primary aksiyon: canlıysa odaya gir, de�?ilse uyandır
  const handleCardPress = () => { isLive ? onManage(room) : onStart(room); };

  return (
    <Pressable
      onPress={handleCardPress}
      style={({ pressed }) => [
        mS.card,
        isPersistent && mS.cardPersistent,
        pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
      ]}
    >
      {/* Katman 1: premium diagonal (parlak üst-sol �?? koyu alt-sa�?) */}
      <LinearGradient
        colors={['#4a5668', '#37414f', '#232a35']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Katman 2: kategori warmth (canlı: belirgin, pasif: yumu�?ak) */}
      <LinearGradient
        colors={themeGrad ? [themeGrad[0], themeGrad[1]] as any : theme.colors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { opacity: isLive ? 0.18 : 0.09, borderRadius: 16 }]}
      />
      <View style={[mS.accentStripe, { backgroundColor: isLive ? '#14B8A6' : theme.accent, opacity: isLive ? 1 : 0.6 }]} />
      <View style={mS.cardLeft}>
        {/* Thumbnail veya avatar �?? card_image_url varsa önceliklendir */}
        {cardImage ? (
          <View style={mS.thumbWrap}>
            <Image source={{ uri: cardImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
            <Ionicons name={theme.icon as any} size={18} color="rgba(255,255,255,0.85)" />
          </View>
        ) : (
          <StatusAvatar uri={room.host?.avatar_url} size={48} tier={(room.host as any)?.subscription_tier} frameId={(room.host as any)?.active_frame} customBadgeId={(room.host as any)?.active_badge_id ?? null} />
        )}
        <View style={mS.cardInfo}>
          <Text style={mS.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={mS.metaRow}>
            {isLive ? (
              <View style={mS.liveBadge}>
                <Animated.View style={[mS.liveDot, { opacity: livePulse }]} />
                <Text style={mS.liveText}>{i18n.t('rooms.live')}</Text>
                {listeners > 0 && <Text style={mS.listenerCount}>· {listeners}</Text>}
              </View>
            ) : isPersistent ? (
              // �?? v1.7.13.110 (20 May 2026): Pasif vs Henüz Açılmadı ayrımı (frozen_at kontrolü)
              (() => {
                const hasFrozen = !!(settings as any)?.frozen_at;
                if (hasFrozen) {
                  return (
                    <View style={mS.sleepBadge}>
                      <Ionicons name="moon" size={9} color="#A78BFA" />
                      <Text style={mS.sleepText}>{i18n.t('rooms.passive')}</Text>
                    </View>
                  );
                }
                return (
                  <View style={[mS.sleepBadge, mS.pendingBadge]}>
                    <Ionicons name="hourglass-outline" size={9} color="#FBBF24" />
                    <Text style={[mS.sleepText, mS.pendingText]}>{i18n.t('rooms.not_started')}</Text>
                  </View>
                );
              })()
            ) : (
              <Text style={mS.offlineText}>❄️ {i18n.t('rooms.closed')}</Text>
            )}
            {/* �?? v1.7.13.139 TUTARSIZ-1: isPersistent = "Kalıcı" (oda özelli�?i), Premium tier ile karı�?tırılmasın. */}
            {isPersistent && (
              <View style={mS.premiumBadge}>
                <Ionicons name="trophy" size={9} color={Colors.premiumGold} />
                <Text style={mS.premiumText}>{i18n.t('rooms.persistent')}</Text>
              </View>
            )}
            {/* �?? v1.7.13.139 BUG-4 fix: "�?ifreli" sadece gerçekten �?ifre varsa.
                �?nceden type==='closed' yetiyordu, password=NULL closed odası da "�?ifreli" görünüyordu. */}
            {room.type === 'closed' && !!((room.room_settings as any)?.password || (room as any).room_password) && (
              <View style={mS.typeBadge}>
                <Ionicons name="lock-closed" size={8} color="#F59E0B" />
                <Text style={[mS.typeBadgeText, { color: '#F59E0B' }]}>{i18n.t('rooms.encrypted')}</Text>
              </View>
            )}
            {room.type === 'invite' && (
              <View style={[mS.typeBadge, mS.inviteBadge]}>
                <Ionicons name="mail" size={8} color="#8B5CF6" />
                <Text style={[mS.typeBadgeText, mS.inviteText]}>{i18n.t('rooms.invite_only')}</Text>
              </View>
            )}
            {settings.entry_fee_sp > 0 && (
              <View style={[mS.typeBadge, mS.feeBadge]}>
                <Ionicons name="cash" size={8} color="#D4AF37" />
                <Text style={[mS.typeBadgeText, mS.feeText]}>{settings.entry_fee_sp} SP</Text>
              </View>
            )}
            {settings.followers_only && (
              <Ionicons name="people" size={9} color="#A78BFA" style={{ marginLeft: 2 }} />
            )}
            {settings.donations_enabled && (
              <Ionicons name="heart" size={9} color="#EF4444" style={{ marginLeft: 2 }} />
            )}
            {/* �?? v1.7.13.141: Takipçi sayısı �?? host'a �??insanlar bekliyor�?� motivasyonu */}
            {!!followerCount && followerCount > 0 && !isLive && (
              <View style={[mS.typeBadge, mS.followerBadge]}>
                <Ionicons name="heart" size={8} color="#EC4899" />
                <Text style={[mS.typeBadgeText, mS.followerText]}>{followerCount} {i18n.t('rooms.follower_short')}</Text>
              </View>
            )}
            {/* �?? v1.7.13.110 (20 May 2026): Süre etiketi label'ı duruma göre de�?i�?ir.
                - Canlı: "X kaldı" (expires_at - now)
                - Pasif (frozen_at var): "Wake-up için X" (donduruldu)
                - Henüz Açılmadı (frozen_at null): "Süresi: X" (canlıda harcanacak)
                - Kapalı (free zombie): "Silinecek: X" (cleanup için) */}
            {isOwner && (() => {
              let remainMs: number | null = null;
              let label: string = '';
              let color = '#5EEAD4';
              let bg = 'rgba(20,184,166,0.12)';
              let border = 'rgba(20,184,166,0.25)';
              const hasFrozen = !!(settings as any)?.frozen_at;
              if (isLive && (room as any).expires_at) {
                remainMs = new Date((room as any).expires_at).getTime() - Date.now();
              } else if (!isLive && typeof settings.remaining_ms === 'number') {
                remainMs = settings.remaining_ms;
              }
              if (remainMs === null || remainMs <= 0) return null;
              const h = Math.floor(remainMs / 3600000);
              const m = Math.floor((remainMs % 3600000) / 60000);
              const t = h > 0 ? i18n.t('tabs.myrooms.043', { 0: h, 1: m }) : i18n.t('tabs.myrooms.044', { 0: m });
              if (isLive) {
                label = i18n.t('tabs.myrooms.039', { 0: t });
              } else if (isPersistent && hasFrozen) {
                label = i18n.t('tabs.myrooms.040', { 0: t });
                color = '#A78BFA'; bg = 'rgba(167,139,250,0.10)'; border = 'rgba(167,139,250,0.25)';
              } else if (isPersistent) {
                label = i18n.t('tabs.myrooms.041', { 0: t });
                color = '#FBBF24'; bg = 'rgba(251,191,36,0.10)'; border = 'rgba(251,191,36,0.25)';
              } else {
                label = i18n.t('tabs.myrooms.042', { 0: t });
                color = '#94A3B8'; bg = 'rgba(148,163,184,0.10)'; border = 'rgba(148,163,184,0.25)';
              }
              return (
                <View style={[mS.typeBadge, { backgroundColor: bg, borderColor: border }]}>
                  <Ionicons name="hourglass-outline" size={8} color={color} />
                  <Text style={[mS.typeBadgeText, { color }]}>{label}</Text>
                </View>
              );
            })()}
          </View>
        </View>
      </View>
      <View style={mS.cardRight}>
        {/* Inner butonlar: kendi onPress'leri kart onPress'ine baloncuk etmesin */}
        {isOwner && (
          <Pressable style={mS.settingsBtn} onPress={(e) => { e.stopPropagation(); onSettings(room); }}>
            <Ionicons name="settings-outline" size={18} color="#94A3B8" />
          </Pressable>
        )}
        {/* �?? v1.7.13.136: Free kapalı oda (is_persistent=false) �?? "�?öz" butonu YOK.
            Free oda persistent de�?ildir; kapanan kayıt cleanup ile silinir. Onun yerine
            "Yeni Oda Aç" CTA �?? kullanıcı günlük limiti içinde yeni açar. */}
        {(isLive || isPersistent) ? (
          <Pressable
            onPress={(e) => { e.stopPropagation(); isLive ? onManage(room) : onStart(room); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={['#14B8A6', '#0D9488']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={mS.gradBtn}
            >
              <Ionicons name={isLive ? 'enter' : 'sunny'} size={14} color="#FFF" />
              <Text style={mS.gradBtnText}>{isLive ? i18n.t('myrooms.go_to_room') : i18n.t('myrooms.activate')}</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <View style={[mS.gradBtn, mS.closedBtn]}>
            <Ionicons name="archive-outline" size={12} color="#94A3B8" />
            <Text style={[mS.gradBtnText, mS.closedBtnText]}>{i18n.t('rooms.closed_state')}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// �?? ManagedRoomsSection �?? temporal gruplu yöneten odalar
//   Canlı �?? Uyuyan (kalıcı) �?? Dondurulmu�? (kapalı) sırası
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// �?? SkeletonCard �?? Initial load sırasında kart iskeleti
//   Kullanıcı blank screen yerine "yükleniyor" hissi alır
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
function SkeletonCard() {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[skS.card, { opacity: pulseAnim }]}>
      <View style={skS.stripe} />
      <View style={skS.avatar} />
      <View style={skS.lines}>
        <View style={skS.lineLong} />
        <View style={skS.lineShort} />
      </View>
      <View style={skS.btn} />
    </Animated.View>
  );
}

function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      <View style={skS.sectionHead}>
        <View style={[skS.lineShort, { width: 100, height: 12, marginLeft: 16 }]} />
      </View>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </>
  );
}

const skS = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    padding: 12, paddingLeft: 16, borderRadius: 16,
    backgroundColor: Colors.cardBg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    gap: 10,
  },
  stripe: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lines: { flex: 1, gap: 6 },
  lineLong: { height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', width: '70%' },
  lineShort: { height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', width: '40%' },
  btn: {
    width: 80, height: 30, borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.2)',
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14,
  },
});

// �?? Sadece bo�? durumu temsil eder �?? non-empty render'ı FlatList yapıyor.
//   �?st CTA "Yeni Oda Olu�?tur" zaten quick-create sheet açıyor, bu kart sadece
//   bilgilendirici statik empty state (mic resmi + "Henüz odanız yok" mesajı).
function ManagedRoomsEmptyCard() {
  return (
    <>
      <View style={mrS.sectionRow}>
        <View style={[mrS.sectionAccent, { backgroundColor: '#14B8A6' }]} />
        <Ionicons name="headset" size={14} color="#14B8A6" style={{ opacity: 0.7 }} />
        <Text style={mrS.sectionTitle}>{i18n.t('rooms.managed_rooms')}</Text>
      </View>
      <View style={mrS.emptyCard}>
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={mrS.emptyTitle}>{i18n.t('auto.tabs.myrooms.021')}{'\n'}{i18n.t('auto.tabs.myrooms.020')}</Text>
        {/* �?? v255 (13 May 2026): GlowView wrap kaldırıldı �?? Lottie mikrofon zaten kendi
            glow'unu içeriyor, üstüne Skia BlurMask binince "teal kare gölge" olu�?uyordu.
            Sade Lottie ile temiz görünüm. */}
        <View style={mrS.emptyImageWrap}>
          {LottieView ? (
            <LottieView
              source={MIC_LOTTIE}
              autoPlay
              loop
              style={mrS.emptyImage}
              cacheComposition
              renderMode="HARDWARE"
              resizeMode="cover"
              speed={0.8}
            />
          ) : (
            <Image source={require('../../assets/images/mock/empty_room_mic.png')} style={mrS.emptyImage} resizeMode="contain" />
          )}
        </View>
        <Text style={mrS.emptySub}>{i18n.t('tabs.myrooms.001')}</Text>
      </View>
    </>
  );
}

const mrS = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginTop: 18, marginBottom: 10,
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3, flex: 1 },
  groupCount: {
    fontSize: 10, fontWeight: '800', color: '#94A3B8',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  emptyCard: {
    marginHorizontal: 16, padding: 20, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.cardBorder,
    overflow: 'hidden',
    alignItems: 'center', gap: 10,
    ...Shadows.card,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#F1F5F9', textAlign: 'center', lineHeight: 20 },
  emptyImageWrap: {
    width: 180, height: 180,
    alignItems: 'center', justifyContent: 'center',
    // �?? 2026-05-09: Yumu�?ak teal gölge (Soprano kimli�?i) �?? mikrofon ekranda öne çıksın
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  emptyImage: { width: '100%', height: '100%' },
  emptySub: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
});

const mS = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    paddingLeft: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Shadows.card,
  },
  cardPersistent: {
    borderColor: Colors.premiumGold,
    borderWidth: 1.5,
    shadowColor: Colors.premiumGold,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  accentStripe: {
    position: 'absolute', left: 0, top: 8, bottom: 8,
    width: 3, borderRadius: 2,
  },
  thumbWrap: {
    width: 48, height: 48, borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  gradBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  gradBtnText: { fontSize: 11, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(212,175,55,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  premiumText: { fontSize: 8, fontWeight: '800', color: Colors.premiumGold, letterSpacing: 0.3 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },

  cardInfo: { flex: 1 },
  roomName: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9',
    ...Shadows.text,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  listenerCount: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginLeft: 2 },
  offlineText: { fontSize: 11, color: '#94A3B8' },
  sleepBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(167,139,250,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
  },
  sleepText: { fontSize: 10, fontWeight: '700', color: '#A78BFA' },

  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  typeBadgeText: { fontSize: 8, fontWeight: '700' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  settingsBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(149,161,174,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  pendingBadge: {
    backgroundColor: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.30)',
  },
  pendingText: { color: '#FBBF24' },
  inviteBadge: {
    backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)',
  },
  inviteText: { color: '#8B5CF6' },
  feeBadge: {
    backgroundColor: 'rgba(212,175,55,0.12)', borderColor: 'rgba(212,175,55,0.25)',
  },
  feeText: { color: '#D4AF37' },
  followerBadge: {
    backgroundColor: 'rgba(236,72,153,0.10)', borderColor: 'rgba(236,72,153,0.25)',
  },
  followerText: { color: '#EC4899' },
  closedBtn: {
    backgroundColor: 'rgba(148,163,184,0.18)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.30)',
  },
  closedBtnText: { color: '#94A3B8' },

});

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// SON GİRDİ�?İN ODALAR �?? Kısayol Kartı
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// ★ v1.7.13.146 (24 May 2026): RecentRoomCard skeleton — yatay scroll içinde pulse'lu placeholder.
function RecentRoomCardSkeleton({ delay = 0 }: { delay?: number }) {
  const pulse = React.useRef(new Animated.Value(0.4)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true, delay }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[rcS.card, { opacity: pulse, backgroundColor: 'rgba(99,118,144,0.18)', borderColor: 'rgba(149,161,174,0.12)' }]}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(149,161,174,0.25)' }} />
      <View style={{ width: 56, height: 9, borderRadius: 4, backgroundColor: 'rgba(149,161,174,0.25)', marginTop: 8 }} />
      <View style={{ width: 38, height: 7, borderRadius: 4, backgroundColor: 'rgba(149,161,174,0.18)', marginTop: 4 }} />
    </Animated.View>
  );
}

function RecentRoomCard({ item, onPress }: { item: RoomHistoryItem & { _isLive?: boolean }; onPress: () => void }) {
  const isLive = item._isLive !== false; // undefined = backward-compat (canlı varsay)
  return (
    <Pressable
      style={({ pressed }) => [rcS.card, !isLive && rcS.cardDim, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      {isLive && (
        <LinearGradient
          colors={['#4a5668', '#37414f', '#232a35']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <View style={isLive ? undefined : rcS.dimOpacity}>
        {/* ★ v1.7.13.47: Sistem odası (Soprano Lobi) — oda içiyle tutarlı çerçevesiz logo */}
        {isSystemRoom(item.id) ? (
          <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Image
              source={require('../../assets/app_icon.png')}
              style={{ width: 56, height: 56 }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <StatusAvatar uri={item.hostAvatar} size={44} />
        )}
      </View>
      <Text style={[rcS.name, !isLive && rcS.nameDim]} numberOfLines={1}>{item.name}</Text>
      {isLive ? (
        <Text style={rcS.host} numberOfLines={1}>{item.hostName}</Text>
      ) : (
        <Text style={rcS.closedBadge} numberOfLines={1}>{i18n.t('rooms.closed')}</Text>
      )}
    </Pressable>
  );
}

const rcS = StyleSheet.create({
  card: {
    width: 80, alignItems: 'center', marginRight: 12,
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Shadows.card,
  },
  cardDim: {
    backgroundColor: 'rgba(65,78,95,0.5)',
    borderColor: 'rgba(149,161,174,0.15)',
  },
  name: {
    fontSize: 10, fontWeight: '700', color: '#F1F5F9', textAlign: 'center',
    ...Shadows.text,
  },
  host: { fontSize: 9, color: '#FFFFFF', textAlign: 'center', marginTop: 1, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  closedBadge: { fontSize: 9, fontWeight: '700', color: '#64748B', textAlign: 'center', marginTop: 1, letterSpacing: 0.3 },
  dimOpacity: { opacity: 0.55 },
  nameDim: { color: '#94A3B8' },
});

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// ARKADA�?LARIN CANLI �?? Sosyal FOMO Kartı
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
type FriendInRoom = {
  friendId: string;
  friendName: string;
  friendAvatar: string;
  roomId: string;
  roomName: string;
};

function FriendLiveCard({ item, onPress }: { item: FriendInRoom; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [flcS.card, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <LinearGradient
        colors={['#4a5668', '#37414f', '#232a35']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <StatusAvatar uri={item.friendAvatar} size={36} isOnline={true} />
      <Text style={flcS.friendName} numberOfLines={1}>{item.friendName}</Text>
      <Text style={flcS.roomName} numberOfLines={1}>{item.roomName}</Text>
      <View style={flcS.joinBtn}>
        <Ionicons name="enter-outline" size={10} color="#22C55E" />
        <Text style={flcS.joinText}>{i18n.t('rooms.join')}</Text>
      </View>
    </Pressable>
  );
}

const flcS = StyleSheet.create({
  card: {
    width: 88, alignItems: 'center', marginRight: 12,
    paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Shadows.card, position: 'relative',
  },

  friendName: {
    fontSize: 10, fontWeight: '700', color: '#F1F5F9', textAlign: 'center',
    ...Shadows.text,
  },
  roomName: {
    fontSize: 8, color: '#94A3B8', textAlign: 'center', marginTop: 2,
    lineHeight: 11,
  },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    marginTop: 5, backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  joinText: { fontSize: 9, fontWeight: '800', color: '#22C55E' },
});

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// ODA İSTATİSTİKLERİ �?? Kompakt Bar
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
type RoomStats = {
  totalRooms: number;
  liveRooms: number;
  totalListeners: number;
  weeklySP: number;
};

function StatsBar({ stats }: { stats: RoomStats }) {
  const items = [
    { value: stats.totalRooms, label: i18n.t('myrooms.stat_room'), color: '#38BDF8', icon: 'home' as const },
    { value: stats.liveRooms, label: i18n.t('myrooms.stat_live'), color: '#EF4444', icon: 'radio' as const },
    { value: stats.totalListeners, label: i18n.t('myrooms.stat_listener'), color: '#22C55E', icon: 'people' as const },
    { value: stats.weeklySP, label: i18n.t('myrooms.stat_sp_week'), color: '#A78BFA', icon: 'diamond' as const },
  ];

  return (
    <View style={dashS.bar}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={dashS.sep} />}
          <View style={dashS.cell}>
            <View style={dashS.valueRow}>
              <Ionicons name={item.icon} size={11} color={item.color} />
              <Text style={[dashS.value, { color: item.color }]}>
                {item.value > 999 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
              </Text>
            </View>
            <Text style={dashS.label}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const dashS = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 8, paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(51,59,69,0.7)',
    borderWidth: 1, borderColor: 'rgba(149,161,174,0.15)',
  },
  sep: {
    width: 1, height: 22, backgroundColor: 'rgba(148,163,184,0.15)',
  },
  cell: {
    flex: 1, alignItems: 'center',
  },
  valueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  value: {
    fontSize: 14, fontWeight: '800',
  },
  label: {
    fontSize: 8, fontWeight: '600', color: '#64748B',
    marginTop: 1, letterSpacing: 0.2,
  },
});

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// HIZLI ODA �?ABLONLARI
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// �?? v1.7.13.141: ROOM_TEMPLATES fonksiyon olarak �?? i18n runtime'da çözülsün
function getRoomTemplates() {
  return [
    { id: 'chat', emoji: '💬', label: i18n.t('tabs.myrooms.034'), name: '', category: 'chat', type: 'open', mode: 'audio', speaking: 'permission_only', colors: ['#14B8A6', '#065F56'] as [string, string] },
    { id: 'music', emoji: '🎵', label: i18n.t('tabs.myrooms.001'), name: '', category: 'music', type: 'open', mode: 'audio', speaking: 'permission_only', colors: ['#8B5CF6', '#4C1D95'] as [string, string] },
    { id: 'game', emoji: '🎮', label: i18n.t('tabs.myrooms.035'), name: '', category: 'game', type: 'open', mode: 'audio', speaking: 'permission_only', colors: ['#EF4444', '#7F1D1D'] as [string, string] },
    { id: 'private', emoji: '🔒', label: i18n.t('tabs.myrooms.002'), name: '', category: 'chat', type: 'closed', mode: 'audio', speaking: 'permission_only', colors: ['#F59E0B', '#78350F'] as [string, string] },
    { id: 'podcast', emoji: '🎤', label: i18n.t('tabs.myrooms.036'), name: '', category: 'tech', type: 'open', mode: 'audio', speaking: 'selected_only', colors: ['#3B82F6', '#1E3A8A'] as [string, string] },
  ];
}

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// ODALARIM EKRANI
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
export default function MyRoomsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { firebaseUser, profile, setShowNotifDrawer, setNotifDrawerAnchorRight } = useAuth();
  const { openUserProfile } = useUserProfileSheet();
  const insets = useSafeAreaInsets();
  // �?? 2026-04-24: Banner slide-down �?? sadece uygulama ilk açılı�?ında
  const bannerTranslateY = useRef(new Animated.Value(bannerIntroPlayed() ? 0 : -140)).current;
  useEffect(() => {
    if (!bannerIntroPlayed()) {
      Animated.timing(bannerTranslateY, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      markBannerIntroPlayed();
    }
  }, []);
  useTheme();

  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [recentRooms, setRecentRooms] = useState<RoomHistoryItem[]>([]);
  const [friendsLive, setFriendsLive] = useState<FriendInRoom[]>([]);
  // �?? 2026-04-21: followedRooms state kaldırıldı �?? Takip Etti�?in Odalar bölümü
  //   Odalarım'dan kaldırıldı�?ı için gereksiz. Ke�?fet footer'ında zaten gösteriliyor.
  const [weeklySP, setWeeklySP] = useState(0);
  const [roomStats, setRoomStats] = useState<RoomStats>({ totalRooms: 0, liveRooms: 0, totalListeners: 0, weeklySP: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [showInviteFriends, setShowInviteFriends] = useState(false);
  // �?? Günlük oda açma kotası �?? CTA altında "2/3 bugün" gösterimi için
  const [dailyQuota, setDailyQuota] = useState<{ count: number; limit: number } | null>(null);
  // �?? 2026-04-23: Quick-create �?? Ke�?fet'teki ile aynı pattern, CTA ve empty state'te kullanılır
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  // �?? v1.7.13.141: Double-tap uyandırma guard �?? SENARYO-5 fix
  const wakingRef = useRef(false);
  // �?? v1.7.13.141: Oda takipçi sayıları (toplu) �?? kart badge için
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  // �?? v92 (1 May 2026): Yeni kullanıcı yönlendirmesi �?? RoomCreateHintSheet'ten
  //   "Odalarım'a Git" tıklayınca AsyncStorage flag'lenir, myrooms mount'ta
  //   bu state true olur ve "+ Yeni Oda" butonunu i�?aret eden premium
  //   coachmark görünür. Buton tıklanırsa veya backdrop'a dokunulursa kapanır.
  const [showCreateCoachmark, setShowCreateCoachmark] = useState(false);

  const { unreadNotifs: unreadCount, pendingFollows: pendingFollowCount } = useBadges();
  const { allFriends } = useOnlineFriends();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFriends, setShowFriends] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // �?? Realtime kanal ba�?ımlılık fix: ref pattern
  const loadDataRef = useRef<(() => Promise<void>) | null>(null);
  const refreshFriendsLiveRef = useRef<(() => Promise<void>) | null>(null);

  // �?? Profile ba�?ımlılı�?ını daralt �?? sadece ihtiyaç duyulan alanlar
  const subscriptionTier = (profile?.subscription_tier || 'Free') as SubscriptionTier;
  const isAdmin = (profile as any)?.is_admin === true;
  // �?? v1.7.13.132: GodMaster kaldırıldı �?? admin yetkisi �?? Pro
  const effectiveTier: SubscriptionTier = isAdmin ? 'Pro' : subscriptionTier;

  const loadData = useCallback(async () => {
    if (!firebaseUser) return;
    const uid = firebaseUser.uid;
    try {
      // 1) Yönetilen odalar (di�?er hesaplamalar için gerekli) �?? sıralı
      const managed = await RoomService.getMyRooms(uid);
      const liveRoomIds = managed.filter(r => r.is_live).map(r => r.id);

      // 2) Geri kalan 4 i�?i PARALEL çalı�?tır �?? toplam süre 4�? azalır
      const friendIds = allFriends.map(f => f.id).slice(0, 50);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const userTier: SubscriptionTier = effectiveTier;

      const [participantsRes, historyRes, friendsRes, spRes, quotaRes] = await Promise.allSettled([
        // 2a) Gerçek katılımcı sayıları
        liveRoomIds.length > 0
          ? supabase.from('room_participants').select('room_id').in('room_id', liveRoomIds)
          : Promise.resolve({ data: [] as any[] }),
        // 2b) Geçmi�? + canlı durum
        (async () => {
          const history = await RoomHistoryService.getRecent(6);
          if (history.length === 0) return { history, liveMap: new Map<string, boolean>() };
          const { data: liveCheck } = await supabase
            .from('rooms').select('id, is_live').in('id', history.map(h => h.id));
          const liveMap = new Map<string, boolean>(
            (liveCheck || []).map((r: any) => [r.id, !!r.is_live])
          );
          return { history, liveMap };
        })(),
        // 2c) Arkada�?ların canlı
        friendIds.length > 0
          ? supabase.from('room_participants')
              .select('user_id, room_id, rooms:rooms!room_id(id, name, is_live), profiles:profiles!user_id(display_name, avatar_url)')
              .in('user_id', friendIds)
          : Promise.resolve({ data: [] as any[] }),
        // 2d) Haftalık SP
        supabase.from('sp_transactions')
          .select('amount')
          .eq('user_id', uid).gt('amount', 0).gte('created_at', weekAgo.toISOString()),
        // 2e) Günlük kota
        RoomService.canCreateToday(uid, userTier),
        // �?? 2026-04-21: Takip edilen odalar fetch'i kaldırıldı �?? bölüm Ke�?fet'e ta�?ındı.
      ]);

      // 2a) Katılımcı sayılarını odalara yaz
      let totalListeners = 0;
      if (participantsRes.status === 'fulfilled') {
        const rows = (participantsRes.value as any)?.data || [];
        const countMap = new Map<string, number>();
        rows.forEach((row: any) => countMap.set(row.room_id, (countMap.get(row.room_id) || 0) + 1));
        managed.forEach(r => {
          if (countMap.has(r.id)) r.participant_count = countMap.get(r.id) || 0;
        });
        totalListeners = Array.from(countMap.values()).reduce((sum, c) => sum + c, 0);
      } else {
        totalListeners = managed.reduce((sum, r) => sum + (r.listener_count || 0), 0);
      }
      setMyRooms(managed);

      // �?? v1.7.13.141: Toplu takipçi sayısı �?? tek sorguda tüm odaların follower count'u
      if (managed.length > 0) {
        const roomIds = managed.map(r => r.id);
        Promise.resolve(supabase.from('room_follows').select('room_id').in('room_id', roomIds)
          .then(({ data: follows }) => {
            const counts: Record<string, number> = {};
            (follows || []).forEach((f: any) => {
              counts[f.room_id] = (counts[f.room_id] || 0) + 1;
            });
            setFollowerCounts(counts);
          })).catch(() => {});
      }

      // 2b) Recent rooms
      // �?? 2026-04-21: İki filtre:
      //   (a) Sadece CANLI (is_live=true) olanlar göster (kapalı odaların moralsiz görünmemesi için)
      //   (b) Kullanıcının KENDİ odaları "Son Girdi�?in Odalar"da gösterilmesin �??
      //       yukarıdaki "Canlı Odalarım" bölümünde zaten var, duplike olmasın.
      if (historyRes.status === 'fulfilled') {
        const { history, liveMap } = historyRes.value as { history: RoomHistoryItem[]; liveMap: Map<string, boolean> };
        const ownIds = new Set(managed.map(r => r.id));
        const enriched = history
          .filter(h => liveMap.get(h.id) === true && !ownIds.has(h.id))
          .map(h => ({ ...h, _isLive: true }));
        setRecentRooms(enriched as any);
      } else {
        setRecentRooms([]);
      }

      // 2c) Friends live
      if (friendsRes.status === 'fulfilled') {
        const liveItems: FriendInRoom[] = (((friendsRes.value as any)?.data) || [])
          .filter((p: any) => p.rooms?.is_live)
          .map((p: any) => ({
            friendId: p.user_id,
            friendName: p.profiles?.display_name || i18n.t('auto.tabs.myrooms.019'),
            friendAvatar: p.profiles?.avatar_url || '',
            roomId: p.rooms?.id || p.room_id,
            roomName: p.rooms?.name || i18n.t('tabs.myrooms.037'),
          }));
        const seen = new Set<string>();
        const unique = liveItems.filter(i => { if (seen.has(i.friendId)) return false; seen.add(i.friendId); return true; });
        setFriendsLive(unique.slice(0, 10));
      } else {
        setFriendsLive([]);
      }

      // 2d) Haftalık SP
      let weeklyTotal = 0;
      if (spRes.status === 'fulfilled') {
        weeklyTotal = (((spRes.value as any)?.data) || []).reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
        setWeeklySP(weeklyTotal);
      }

      // 2e) Kota
      if (quotaRes.status === 'fulfilled') {
        const gate = quotaRes.value;
        setDailyQuota(gate.limit >= 999 ? null : { count: gate.count, limit: gate.limit });
      }

      // �?? 2026-04-21: Takip edilen odalar burada artık fetch/sync edilmiyor �??
      //   bölüm Odalarım'dan kaldırıldı, Ke�?fet footer'ı aynı veriyi gösteriyor.

      // Stats �?? tek yerden hesapla (3 yerde da�?ılmı�?tı)
      setRoomStats({
        totalRooms: managed.length,
        liveRooms: liveRoomIds.length,
        totalListeners,
        weeklySP: weeklyTotal,
      });
    } catch (err) {
      if (__DEV__) console.warn('[MyRooms] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser, allFriends, subscriptionTier, isAdmin]);

  // �?? Ref'leri güncel tut �?? realtime handler'ları için
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  // �?? v1.7.13.34 (19 May 2026): InteractionManager wrap KALDIRILDI �??
  //   kullanıcı 'odalar listesi çok geç listeleniyor' raporu. Eski yapı
  //   tab animasyonu (~300ms) bitince loadData ba�?latıyordu; toplam
  //   1-1.5sn algılanan gecikme. �?imdi loadData ANINDA fire eder; native
  //   thread'i bloklamıyor zaten (Promise.allSettled paralel sorgular).
  useFocusEffect(useCallback(() => {
    loadData();
    // �?? v92 (1 May 2026): RoomCreateHintSheet'ten yönlendirme bayra�?ı varsa
    //   premium "+ Yeni Oda" coachmark'ını tetikle (bir kez gösterilir).
    (async () => {
      const should = await shouldShowCreateRoomCoachmark(firebaseUser?.uid);
      if (should) {
        // Animasyonların tab geçi�?iyle çakı�?maması için kısa gecikme
        setTimeout(() => setShowCreateCoachmark(true), 500);
      }
    })();
    // �?? 2026-04-23: Tab'dan çıkınca açık modalı kapat
    return () => { setSelectedRoom(null); };
  }, [loadData, firebaseUser?.uid]));

  // �?? Yardımcı: Sadece arkada�?ların canlı oldu�?u odaları yenile (hafif sorgu)
  const refreshFriendsLive = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const friendIds = allFriends.map(f => f.id);
      if (friendIds.length === 0) { setFriendsLive([]); return; }
      const { data: participantData } = await supabase
        .from('room_participants')
        .select('user_id, room_id, rooms:rooms!room_id(id, name, is_live), profiles:profiles!user_id(display_name, avatar_url)')
        .in('user_id', friendIds.slice(0, 50));

      const liveItems: FriendInRoom[] = (participantData || [])
        .filter((p: any) => p.rooms?.is_live)
        .map((p: any) => ({
          friendId: p.user_id,
          friendName: p.profiles?.display_name || i18n.t('auto.tabs.myrooms.018'),
          friendAvatar: p.profiles?.avatar_url || '',
          roomId: p.rooms?.id || p.room_id,
          roomName: p.rooms?.name || i18n.t('tabs.myrooms.037'),
        }));
      const seen = new Set<string>();
      const unique = liveItems.filter(item => {
        if (seen.has(item.friendId)) return false;
        seen.add(item.friendId);
        return true;
      });
      setFriendsLive(unique.slice(0, 10));
    } catch (e) {
      if (__DEV__) console.warn('[MyRooms] Friends live refresh error:', e);
    }
  }, [firebaseUser, allFriends]);

  useEffect(() => { refreshFriendsLiveRef.current = refreshFriendsLive; }, [refreshFriendsLive]);

  // �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  // REALTIME MOTOR �?? 3 kanal
  // �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  // �?? BUG FIX: Realtime kanal �?? ref pattern ile dependency döngüsü engellendi
  useEffect(() => {
    if (!firebaseUser) return;

    // �??�?? Kanal 1: Yönetti�?im Odalar (rooms tablosu) �??�??
    const roomsChannel = supabase
      .channel('myrooms-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rooms',
        filter: `host_id=eq.${firebaseUser.uid}`,
      }, (payload) => {
        if (payload.eventType !== 'UPDATE') { loadDataRef.current?.(); return; }
        const updated = payload.new as any;
        const old = payload.old as any;
        // �?? Yapısal de�?i�?iklikler (Uyandır�??Canlı geçi�?i, kalıcılık, isim, tip) �?? tam reload
        if (
          updated.is_live !== old?.is_live ||
          updated.is_persistent !== old?.is_persistent ||
          updated.name !== old?.name ||
          updated.type !== old?.type
        ) {
          loadDataRef.current?.();
        } else {
          // �?? Kozmetik de�?i�?iklik (listener_count, room_settings vb.) �?? inline güncelle + stats barı
          const mergedFields: Record<string, any> = {
            listener_count: updated.listener_count,
            ...(updated.room_settings ? { room_settings: updated.room_settings } : {}),
            ...(updated.theme_id !== undefined ? { theme_id: updated.theme_id } : {}),
            ...(updated.name ? { name: updated.name } : {}),
            ...(updated.type ? { type: updated.type } : {}),
          };
          setMyRooms(prev => {
            const next = prev.map(r =>
              r.id === updated.id ? { ...r, ...mergedFields } : r
            );
            // Stats barını da güncelle
            const liveCount = next.filter(r => r.is_live).length;
            const totalListeners = next.reduce((sum, r) => sum + (r.participant_count || r.listener_count || 0), 0);
            setRoomStats(prev2 => ({ ...prev2, totalRooms: next.length, liveRooms: liveCount, totalListeners }));
            return next;
          });
          // �?? SYNC FIX v2: Açık olan RoomManageSheet'i güncelle �?? room_settings
          // de�?i�?ti�?inde rm* state'lerini de senkronize et (oda içinden gelen de�?i�?iklikler)
          setSelectedRoom(prev => {
            if (!prev || prev.id !== updated.id) return prev;
            const merged = { ...prev, listener_count: updated.listener_count };
            if (updated.room_settings) merged.room_settings = updated.room_settings;
            if (updated.theme_id !== undefined) merged.theme_id = updated.theme_id;
            if (updated.name) merged.name = updated.name;
            if (updated.type) merged.type = updated.type;
            // �?? rm* state'lerini de güncelle (sheet açıkken stale kalmasın)
            if (updated.room_settings) {
              const rs = updated.room_settings as any;
              if (rs.speaking_mode !== undefined) setRmSpeakingMode(rs.speaking_mode);
              if (rs.slow_mode_seconds !== undefined) setRmSlowMode(rs.slow_mode_seconds);
              if (rs.age_restricted !== undefined) setRmAgeRestricted(rs.age_restricted);
              if (rs.followers_only !== undefined) setRmFollowersOnly(rs.followers_only);
              if (rs.donations_enabled !== undefined) setRmDonations(rs.donations_enabled);
              if (rs.entry_fee_sp !== undefined) setRmEntryFee(rs.entry_fee_sp);
              if (rs.room_language !== undefined) setRmLang(rs.room_language);
              if (rs.welcome_message !== undefined) setRmWelcome(rs.welcome_message);
              if (rs.music_link !== undefined) setRmMusicLink(rs.music_link || '');
              if (rs.password !== undefined) setRmPassword(rs.password);
              if (rs.is_locked !== undefined) setRmIsLocked(rs.is_locked);
            }
            if (updated.name) setRmName(updated.name);
            if (updated.type) setRmType(updated.type);
            if (updated.theme_id !== undefined) setRmThemeId(updated.theme_id);
            return merged;
          });
        }
      })
      .subscribe();

    // �??�?? Kanal 2: Arkada�?ların Canlı (room_participants tablosu) �??�??
    // �?? v1.7.13.141 BUG-2 FIX: Debounce ekle �?? filtresiz kanal her event'te
    //   tam Supabase sorgusu tetikliyordu. 800ms debounce ile toplu i�?lem.
    let friendsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefreshFriends = () => {
      if (friendsDebounceTimer) clearTimeout(friendsDebounceTimer);
      friendsDebounceTimer = setTimeout(() => {
        refreshFriendsLiveRef.current?.();
      }, 800);
    };
    const friendsChannel = supabase
      .channel('friends-live-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'room_participants',
      }, debouncedRefreshFriends)
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'room_participants',
      }, debouncedRefreshFriends)
      .subscribe();

    // �??�?? Kanal 3: SP Kazancı (sp_transactions tablosu) �??�??
    const spChannel = supabase
      .channel('sp-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sp_transactions',
        filter: `user_id=eq.${firebaseUser.uid}`,
      }, (payload) => {
        const newAmount = (payload.new as any)?.amount || 0;
        if (newAmount > 0) {
          // �?? İnkremental güncelleme �?? tam yenileme gerekmez
          setWeeklySP(prev => prev + newAmount);
          setRoomStats(prev => ({ ...prev, weeklySP: prev.weeklySP + newAmount }));
        }
      })
      .subscribe();

    return () => {
      if (friendsDebounceTimer) clearTimeout(friendsDebounceTimer);
      supabase.removeChannel(roomsChannel);
      supabase.removeChannel(friendsChannel);
      supabase.removeChannel(spChannel);
    };
  }, [firebaseUser]); // �?? Sadece firebaseUser �?? ref pattern sayesinde di�?erleri gerekmiyor

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Uyuyan odayı uyandır VEYA planlı odayı ba�?lat �?? DB'de is_live=true yap, süre sıfırla, sonra odaya git
  // �?? useCallback ile memoize + do�?ru deps �?? stale profile/firebaseUser yakalama engellendi
  const handleWakeUp = useCallback(async (room: Room) => {
    if (!firebaseUser || wakingRef.current) return;
    // �?? v1.7.13.141 SENARYO-5: Double-tap guard
    wakingRef.current = true;
    try {
      const tier = effectiveTier;
      // �?? 2026-04-26: Planlı oda mı kontrol et �?? e�?er scheduled_at gelecekte ise
      //   kullanıcıya "henüz erken" uyarısı, ama yine de manuel ba�?latmaya izin ver.
      const scheduledIso = (room.room_settings as any)?.scheduled_at;
      const scheduledTime = scheduledIso ? new Date(scheduledIso) : null;
      const isScheduledFuture = !!(scheduledTime && scheduledTime.getTime() > Date.now());
      if (isScheduledFuture && scheduledTime) {
        const dateStr = scheduledTime.toLocaleString(i18n.locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        showToast({
          title: i18n.t('tabs.myrooms.003'),
          message: i18n.t('auto.tabs.myrooms.017', { 0: dateStr }),
          type: 'info',
        });
      }
      // �?? v1.7.13.141 SENARYO-2: Di�?er canlı oda varsa uyarı ver
      const otherLive = myRooms.filter(r => r.is_live && r.id !== room.id);
      if (otherLive.length > 0) {
        const proceed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            i18n.t('tabs.myrooms.046'),
            i18n.t('tabs.myrooms.045'),
            [
              { text: i18n.t('tabs.myrooms.048'), style: 'cancel', onPress: () => resolve(false) },
              { text: i18n.t('tabs.myrooms.047'), style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          );
        });
        if (!proceed) return;
      }
      await RoomService.wakeUpRoom(room.id, firebaseUser.uid, tier);
      try {
        const { Analytics, Events } = require('../../services/analytics');
        Analytics.track(Events.ROOM_REACTIVATED, { tier });
      } catch {}
      router.push(`/room/${room.id}`);
    } catch (err: any) {
      showToast({ title: i18n.t('tabs.myrooms.004'), message: err.message || i18n.t('auto.tabs.myrooms.016'), type: 'error' });
    } finally {
      wakingRef.current = false;
    }
  }, [firebaseUser, effectiveTier, myRooms, router]);

  // Canlı odayı yönet �?? direkt odaya git, de�?ilse uyandır
  const handleManage = useCallback((room: Room) => {
    if (room.is_live) router.push(`/room/${room.id}`);
    else handleWakeUp(room);
  }, [router, handleWakeUp]);

  // �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  // �?? FlatList data + renderItem �?? flattened group headers + rooms
  // �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  type ListItem =
    | { type: 'group'; id: string; title: string; icon: string; color: string; count: number }
    | { type: 'room'; id: string; room: Room };

  // �?? Arama filtresi fonksiyonu
  const matchesSearch = useCallback((name: string) => {
    if (!searchQuery.trim()) return true;
    return name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  }, [searchQuery]);

  const listData = useMemo<ListItem[]>(() => {
    if (myRooms.length === 0) return []; // ListEmptyComponent devreye girer
    const q = searchQuery.toLowerCase().trim();
    const filter = (rooms: Room[]) => q ? rooms.filter(r => r.name.toLowerCase().includes(q)) : rooms;

    // �?? v1.7.13.110 (20 May 2026): Kategorizasyon yeniden �?? frozen_at gerçek kontrolü.
    //   Eski: persistent+!live = Pasif, !persistent+!live = Donuk (yanıltıcı).
    //   Yeni: 4 grup ayrımı �?? frozen_at NULL ise "Henüz Açılmadı", varsa "Pasif Kalıcı",
    //   Free tier zombie = "Kapalı Odalar". Süre etiketi label'ı da duruma göre.
    const live = filter(myRooms.filter(r => r.is_live));
    const pending = filter(myRooms.filter(r => !r.is_live && !!r.is_persistent && !(r.room_settings as any)?.frozen_at));
    const frozenPersistent = filter(myRooms.filter(r => !r.is_live && !!r.is_persistent && !!(r.room_settings as any)?.frozen_at));
    const closed = filter(myRooms.filter(r => !r.is_live && !r.is_persistent));
    const items: ListItem[] = [];
    const groups = [
      { title: i18n.t('tabs.myrooms.005'), icon: 'radio', color: '#EF4444', data: live },
      { title: i18n.t('myrooms.section.not_started'), icon: 'hourglass', color: '#FBBF24', data: pending },
      { title: i18n.t('myrooms.section.passive_persistent'), icon: 'moon', color: '#A78BFA', data: frozenPersistent },
      { title: i18n.t('myrooms.section.closed'), icon: 'archive', color: '#64748B', data: closed },
    ];
    for (const g of groups) {
      if (g.data.length === 0) continue;
      items.push({ type: 'group', id: `g-${g.title}`, title: g.title, icon: g.icon, color: g.color, count: g.data.length });
      g.data.forEach(room => items.push({ type: 'room', id: `r-${room.id}`, room }));
    }

    // �?? 2026-04-21: "Takip Etti�?in Odalar" Odalarım'dan kaldırıldı �?? Ke�?fet footer'ında
    //   zaten var. Odalarım artık yalnızca kullanıcının kendi yönetim ba�?lamına odaklı.

    return items;
  }, [myRooms, searchQuery]);

  // �?? Stable callback refs �?? React.memo bozulmasın diye inline sarmalama yok
  const handleOpenSettings = useCallback((room: Room) => setSelectedRoom(room), []);

  const renderListItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'group') {
      return (
        <View style={mrS.sectionRow}>
          <View style={[mrS.sectionAccent, { backgroundColor: item.color }]} />
          <Ionicons name={item.icon as any} size={14} color={item.color} style={{ opacity: 0.85 }} />
          <Text style={mrS.sectionTitle}>{item.title}</Text>
          <Text style={mrS.groupCount}>{item.count}</Text>
        </View>
      );
    }
    return (
      <ManagedRoomCard
        room={item.room}
        onManage={handleManage}
        onStart={handleWakeUp}
        onSettings={handleOpenSettings}
        currentUserId={firebaseUser?.uid}
        followerCount={followerCounts[item.room.id]}
      />
    );
  }, [handleManage, handleWakeUp, handleOpenSettings, firebaseUser?.uid, followerCounts]);

  // �?? PlusMenu için settings state + DB handlers
  const [rmName, setRmName] = useState('');
  const [rmType, setRmType] = useState('open');
  const [rmSpeakingMode, setRmSpeakingMode] = useState('permission_only');
  const [rmSlowMode, setRmSlowMode] = useState(0);
  const [rmAgeRestricted, setRmAgeRestricted] = useState(false);
  const [rmFollowersOnly, setRmFollowersOnly] = useState(false);
  const [rmDonations, setRmDonations] = useState(false);
  const [rmEntryFee, setRmEntryFee] = useState(0);
  const [rmLang, setRmLang] = useState('tr');
  const [rmWelcome, setRmWelcome] = useState('');
  const [rmRules, setRmRules] = useState('');
  const [rmThemeId, setRmThemeId] = useState<string | null>(null);
  const [rmMusicLink, setRmMusicLink] = useState<string>('');
  const [rmBgImage, setRmBgImage] = useState<string | null>(null);
  const [rmCoverImage, setRmCoverImage] = useState<string | null>(null);
  const [rmPassword, setRmPassword] = useState('');
  const [rmIsLocked, setRmIsLocked] = useState(false);
  const [rmFollowerCount, setRmFollowerCount] = useState(0);

  // selectedRoom de�?i�?ti�?inde state'leri yükle
  useEffect(() => {
    if (!selectedRoom) return;
    const rs = (selectedRoom.room_settings || {}) as any;
    setRmName(selectedRoom.name || '');
    setRmType(selectedRoom.type || 'open');
    setRmSpeakingMode(rs.speaking_mode || 'permission_only');
    setRmSlowMode(rs.slow_mode_seconds || 0);
    setRmAgeRestricted(rs.age_restricted || false);
    setRmFollowersOnly(rs.followers_only || false);
    setRmDonations(rs.donations_enabled || false);
    setRmEntryFee(rs.entry_fee_sp || 0);
    setRmLang(rs.room_language || 'tr');
    setRmWelcome(rs.welcome_message || '');
    setRmRules(typeof rs.rules === 'string' ? rs.rules : Array.isArray(rs.rules) ? rs.rules.join('\n') : '');
    setRmThemeId(selectedRoom.theme_id || null);
    setRmMusicLink(rs.music_link || '');
    setRmBgImage(rs.room_image_url || selectedRoom.room_image_url || null);
    setRmCoverImage(rs.card_image_url || rs.cover_image_url || null);
    setRmPassword(rs.password || '');
    setRmIsLocked(rs.is_locked || false);
    // Takipçi sayısı
    RoomFollowService.getFollowerCount(selectedRoom.id).then(c => setRmFollowerCount(c)).catch(() => {});
  }, [selectedRoom?.id]);

  // �?? Realtime broadcast �?? odadaki kullanıcılara ayar de�?i�?ikli�?ini bildir
  const broadcast = useCallback((roomId: string, payload: Record<string, any>) => {
    const ch = supabase.channel(`mod_action:${roomId}`);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'settings_changed', payload }).then(() => {
          setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 1000);
        });
      }
    });
  }, []);

  // DB güncelleme helpers
  const updateRoomSetting = useCallback(async (field: string, value: any) => {
    if (!selectedRoom || !firebaseUser) return;
    try {
      await RoomService.updateSettings(selectedRoom.id, firebaseUser.uid, { room_settings: { [field]: value } });
      broadcast(selectedRoom.id, { room_settings: { [field]: value } });
    } catch (e: any) { showToast({ title: i18n.t('tabs.myrooms.029'), message: e.message || i18n.t('auto.tabs.myrooms.015'), type: 'error' }); }
  }, [selectedRoom, firebaseUser, broadcast]);

  const handleRoomRename = useCallback(async (name: string) => {
    if (!selectedRoom || !firebaseUser || !name.trim()) return;
    setRmName(name.trim());
    try {
      await ModerationService.editRoomName(selectedRoom.id, name.trim());
      broadcast(selectedRoom.id, { name: name.trim() });
    } catch { showToast({ title: i18n.t('tabs.myrooms.006'), message: i18n.t('tabs.myrooms.007'), type: 'error' }); }
  }, [selectedRoom, firebaseUser, broadcast]);

  const handleRoomTypeChange = useCallback(async (newType: string) => {
    if (!selectedRoom || !firebaseUser) return;
    setRmType(newType);
    try {
      await RoomService.updateSettings(selectedRoom.id, firebaseUser.uid, { type: newType as any });
      broadcast(selectedRoom.id, { type: newType });
    } catch { showToast({ title: i18n.t('tabs.myrooms.008'), message: i18n.t('tabs.myrooms.009'), type: 'error' }); setRmType(selectedRoom.type || 'open'); }
  }, [selectedRoom, firebaseUser, broadcast]);

  const handleRoomThemeChange = useCallback(async (id: string | null) => {
    if (!selectedRoom || !firebaseUser) return;
    setRmThemeId(id);
    try {
      await RoomService.updateSettings(selectedRoom.id, firebaseUser.uid, { theme_id: id });
      broadcast(selectedRoom.id, { theme_id: id });
    } catch { showToast({ title: i18n.t('tabs.myrooms.010'), message: i18n.t('tabs.myrooms.011'), type: 'error' }); }
  }, [selectedRoom, firebaseUser, broadcast]);

  // �?? v1.7.13.141 SEC-1: Silme onay dialogu eklendi
  const handleRoomDelete = useCallback(async () => {
    if (!selectedRoom || !firebaseUser) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        i18n.t('tabs.myrooms.050'),
        i18n.t('tabs.myrooms.049'),
        [
          { text: i18n.t('tabs.myrooms.048'), style: 'cancel', onPress: () => resolve(false) },
          { text: i18n.t('tabs.myrooms.050'), style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!confirmed) return;
    try {
      await RoomService.deleteRoom(selectedRoom.id, firebaseUser.uid);
      showToast({ title: i18n.t('tabs.myrooms.030'), message: i18n.t('tabs.myrooms.012'), type: 'success' });
      setSelectedRoom(null);
      loadData();
    } catch (e: any) { showToast({ title: i18n.t('tabs.myrooms.031'), message: e.message || i18n.t('auto.tabs.myrooms.014'), type: 'error' }); }
  }, [selectedRoom, firebaseUser, loadData]);

  // �?? 2026-04-23: Hızlı oda olu�?turma �?? CTA ve empty state chip'lerinden tetiklenir.
  //   Limit dolu �?? toast + direkt /plus (satın alma). Detaylı akı�?tan farklı kısa yol.
  const handleQuickCreate = useCallback(async (category?: string) => {
    if (!firebaseUser || creatingRoom) return;
    setCreatingRoom(true);
    try {
      const userTier = effectiveTier;
      const gate = await RoomService.canCreateToday(firebaseUser.uid, userTier);
      if (!gate.ok) {
        showToast({ title: i18n.t('tabs.myrooms.013'), message: i18n.t('tabs.myrooms.014'), type: 'warning' });
        return;
      }
      const displayName = profile?.display_name || firebaseUser.displayName || i18n.t('auto.tabs.myrooms.013');
      const room = await RoomService.quickCreate(firebaseUser.uid, displayName, category, userTier);
      try {
        const { Analytics, Events } = require('../../services/analytics');
        Analytics.track(Events.ROOM_CREATED, { tier: userTier, category, source: 'quick_create' });
      } catch {}
      router.push(`/room/${room.id}` as any);
    } catch (err: any) {
      showToast({ title: i18n.t('tabs.myrooms.015'), message: err?.message || 'Beklenmedik hata', type: 'error' });
    } finally {
      setCreatingRoom(false);
    }
  }, [firebaseUser, creatingRoom, effectiveTier, profile, router]);

  const handleRoomFreeze = useCallback(async () => {
    if (!selectedRoom || !firebaseUser) return;
    try {
      await RoomService.freezeRoom(selectedRoom.id, firebaseUser.uid);
      showToast({ title: i18n.t('tabs.myrooms.032'), message: i18n.t('tabs.myrooms.016'), type: 'success' });
      setSelectedRoom(null);
      loadData();
    } catch (e: any) { showToast({ title: i18n.t('tabs.myrooms.017'), message: e.message || i18n.t('auto.tabs.myrooms.012'), type: 'error' }); }
  }, [selectedRoom, firebaseUser, loadData]);

  // settingsConfig objesi �?? PlusMenu'ye geçirilir
  const settingsConfig = selectedRoom ? {
    speakingMode: rmSpeakingMode,
    onSpeakingModeChange: (m: string) => { setRmSpeakingMode(m); updateRoomSetting('speaking_mode', m); },
    slowModeSeconds: rmSlowMode,
    onSlowModeChange: (s: number) => { setRmSlowMode(s); updateRoomSetting('slow_mode_seconds', s); },
    ageRestricted: rmAgeRestricted,
    onAgeRestrictedChange: (v: boolean) => { setRmAgeRestricted(v); updateRoomSetting('age_restricted', v); },
    followersOnly: rmFollowersOnly,
    onToggleFollowersOnly: (v: boolean) => { setRmFollowersOnly(v); updateRoomSetting('followers_only', v); },
    donationsEnabled: rmDonations,
    onDonationsToggle: (v: boolean) => { setRmDonations(v); updateRoomSetting('donations_enabled', v); },
    roomLanguage: rmLang,
    onLanguageChange: (l: string) => { setRmLang(l); updateRoomSetting('room_language', l); },
    roomName: rmName,
    onRenameRoom: handleRoomRename,
    welcomeMessage: rmWelcome,
    onWelcomeMessageChange: (msg: string) => { setRmWelcome(msg); updateRoomSetting('welcome_message', msg); },
    roomRules: rmRules,
    onRulesChange: (r: string) => { setRmRules(r); updateRoomSetting('rules', r); },
    // �?? 2026-04-20: description edit parite
    description: (selectedRoom as any)?.description || '',
    onDescriptionChange: (d: string) => { updateRoomSetting('description', d); },
    roomType: rmType,
    onRoomTypeChange: handleRoomTypeChange,
    roomPassword: rmPassword,
    onPasswordChange: (pw: string) => { setRmPassword(pw); updateRoomSetting('password', pw); },
    themeId: rmThemeId,
    onThemeChange: handleRoomThemeChange,
    // �?? Donuk oda için Dondur gösterme (zaten donuk). is_live=false & is_persistent=false �?? donuk.
    onFreezeRoom: (selectedRoom.is_live || (selectedRoom as any).is_persistent) ? handleRoomFreeze : undefined,
    entryFee: rmEntryFee,
    onEntryFeeChange: (f: number) => { setRmEntryFee(f); updateRoomSetting('entry_fee_sp', f); },
    musicLink: rmMusicLink || null,
    onMusicLinkChange: (link: string | null) => { const v = link && link.trim() ? link.trim() : ''; setRmMusicLink(v); updateRoomSetting('music_link', v || null); },
    backgroundImage: rmBgImage,
    onPickBackgroundImage: async () => {
      if (!selectedRoom || !firebaseUser) return;
      try {
        const ImagePicker = require('expo-image-picker');
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { showToast({ title: i18n.t('tabs.myrooms.018'), message: i18n.t('tabs.myrooms.019'), type: 'warning' }); return; }
        // �?? 2026-04-21: Arka plan DİKEY (9:16) �?? oda içi dikey layout; kapak yatay kalır.
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [9, 16], quality: 0.7 });
        if (result.canceled) return;
        const { StorageService } = require('../../services/storage');
        const fileName = `room_bg/${selectedRoom.id}_${Date.now()}.jpg`;
        const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
        setRmBgImage(url);
        updateRoomSetting('room_image_url', url);
        showToast({ title: i18n.t('tabs.myrooms.020'), type: 'success' });
      } catch (e: any) { showToast({ title: i18n.t('tabs.myrooms.021'), message: e.message || i18n.t('auto.tabs.myrooms.011'), type: 'error' }); }
    },
    onRemoveBackgroundImage: () => { setRmBgImage(null); updateRoomSetting('room_image_url', null); },
    coverImage: rmCoverImage,
    onPickCoverImage: async () => {
      if (!selectedRoom || !firebaseUser) return;
      try {
        const ImagePicker = require('expo-image-picker');
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { showToast({ title: i18n.t('tabs.myrooms.022'), message: i18n.t('tabs.myrooms.023'), type: 'warning' }); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7 });
        if (result.canceled) return;
        const { StorageService } = require('../../services/storage');
        const fileName = `room_card/${selectedRoom.id}_${Date.now()}.jpg`;
        const url = await StorageService.uploadFile('post-images', fileName, result.assets[0].uri);
        setRmCoverImage(url);
        updateRoomSetting('card_image_url', url);
        showToast({ title: i18n.t('tabs.myrooms.024'), type: 'success' });
      } catch (e: any) { showToast({ title: i18n.t('tabs.myrooms.025'), message: e.message || i18n.t('auto.tabs.myrooms.010'), type: 'error' }); }
    },
    onRemoveCoverImage: () => { setRmCoverImage(null); updateRoomSetting('card_image_url', null); },
  } : undefined;

  return (
    <AppBackground variant="myrooms" radialGlow>
    {/* �?? v270 (14 May 2026): Kullanıcı kozmetik arkaplan �?? varsa AppBackground üstüne Skia katman */}
    <CosmeticBackground bgItemId={(profile as any)?.active_bg_id} context="myrooms" style={{ flex: 1 }}>
    <View style={s.container}>
      {/* �?��?��?� Premium Header �?? Ke�?fet ile aynı Glassmorphic topBar �?��?��?� */}
      <Animated.View style={[s.topBarWrap, { paddingTop: insets.top, transform: [{ translateY: bannerTranslateY }] }]}>
        {/* �?? 2026-04-24 v4: Bulutsu banner �?? çerçeve yok, kenarlar bg'ye feather ile karı�?ır.
            Merkez yo�?un, kenarlar yumu�?ak geçi�?. */}
        <LinearGradient
          colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.82)', 'rgba(12,22,40,0.6)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.topBarGlass}
          pointerEvents="none"
        />
        <View style={s.topBar}>
          <AnimatedHomeLogo />
          <View style={s.headerRight}>
            {/* �?? 2026-04-21: SP pill Odalarım header'ından kaldırıldı �?? Ke�?fet ile tutarlı.
               SP cüzdanı artık Profil sayfasında ve SP store sayfasında prominent. */}
            <AnimatedHeaderIconBtn
              index={0}
              style={s.headerIconBtn}
              onPress={() => {
                const next = !showSearch;
                setShowSearch(next);
                if (!next) setSearchQuery('');
                else setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
              accessibilityLabel={showSearch ? i18n.t('auto.tabs.myrooms.009') : 'Ara'}
            >
              <Ionicons name={showSearch ? 'close' : 'search-outline'} size={22} color={showSearch ? '#14B8A6' : '#F1F5F9'} style={s.headerIcon} />
            </AnimatedHeaderIconBtn>
            <AnimatedHeaderIconBtn staticIcon>
              <NotificationBell unreadCount={unreadCount} onPress={() => { setNotifDrawerAnchorRight(60); setShowNotifDrawer(true); }} />
            </AnimatedHeaderIconBtn>
            <AnimatedHeaderIconBtn
              staticIcon
              style={s.headerIconBtn}
              onPress={() => setShowFriends(true)}
              accessibilityLabel={pendingFollowCount > 0 ? i18n.t('auto.tabs.myrooms.008', { 0: pendingFollowCount }) : i18n.t('auto.tabs.myrooms.007')}
            >
              <Ionicons name="people-outline" size={22} color="#F1F5F9" style={s.headerIcon} />
              {pendingFollowCount > 0 && (
                <View style={s.notifBadge}>
                  <Text style={s.notifBadgeText}>{pendingFollowCount > 99 ? '99+' : pendingFollowCount}</Text>
                </View>
              )}
            </AnimatedHeaderIconBtn>
          </View>
        </View>
        {/* �?? Premium separator �?? teal�??transparent hairline */}
        <LinearGradient
          colors={['transparent', 'rgba(59,130,246,0.55)', 'rgba(59,130,246,0.55)', 'transparent']}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.topBarSeparator}
        />
      </Animated.View>


      {/* �?? Arama Barı �?? toggle ile açılır/kapanır */}
      {showSearch && (
        <View style={s.searchBarWrap}>
          <Ionicons name="search" size={16} color="#64748B" />
          <TextInput
            ref={searchInputRef}
            style={s.searchInput}
            placeholder={i18n.t('tabs.myrooms.033')}
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#64748B" />
            </Pressable>
          )}
        </View>
      )}

      {/* Yeni Oda Olu�?tur �?? Premium Gradient
          �?? 2026-04-23: Artık sheet açılır (Hızlı/Detaylı/Planla); long-press �?? direkt detaylı. */}
      <Pressable
        style={s.ctaWrap}
        onPress={() => {
          if (!firebaseUser) return;
          // �?? v92: Coachmark görünüyorsa kapat + "seen" flag'i (CTA'ya basıldı = yönlendirme tamamlandı)
          if (showCreateCoachmark) {
            setShowCreateCoachmark(false);
            markCreateRoomCoachmarkSeen(firebaseUser.uid).catch(() => {});
          }
          setShowQuickCreate(true);
        }}
        onLongPress={() => {
          if (!firebaseUser) return;
          if (showCreateCoachmark) {
            setShowCreateCoachmark(false);
            markCreateRoomCoachmarkSeen(firebaseUser.uid).catch(() => {});
          }
          router.push('/create-room');
        }}
      >
        <LinearGradient
          colors={['#14B8A6', '#0D9488', '#065F56']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.ctaGradient}
        >
          <View style={s.ctaIconWrap}>
            <Ionicons name="add-circle" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>{t('home.create_new_room')}</Text>
            <Text style={s.ctaSub}>
              {/* �?? v1.7.13.132: admin için �?? açık gösterimi (GodMaster kaldırıldı) */}
              {dailyQuota
                ? i18n.t('auto.tabs.myrooms.006', { 0: dailyQuota.count, 1: dailyQuota.limit })
                : isAdmin
                  ? i18n.t('auto.tabs.myrooms.005')
                  : i18n.t('auto.tabs.myrooms.004')}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </Pressable>


      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderListItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accentTeal} colors={[Colors.accentTeal]} />
        }
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={10}
        ListHeaderComponent={
          <>
            {/* �?? 2026-04-21: Stats bar üste ta�?ındı �?? CTA'nın hemen altı, oda listelerinin üstü.
               �?nceden en altta yer alıyor ve altta bo�?luk bırakıyordu. */}
            {myRooms.length > 0 && <StatsBar stats={roomStats} />}

            {/* g??� Arkada�?ların Canlı �?? sosyal FOMO üstte
                �?? v1.7.13.141 SENARYO-1 FIX: Bo�?sa bölümü tamamen gizle (cold start moralsizli�?i) */}
            {friendsLive.length > 0 && (
              <>
                <View style={s.sectionRow}>
                  <View style={[s.sectionAccent, { backgroundColor: '#22C55E' }]} />
                  <Ionicons name="people" size={14} color="#22C55E" style={{ opacity: 0.7 }} />
                  <Text style={s.sectionTitle}>{t('home.friends_live')}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  style={{ marginBottom: 4 }}
                >
                  {friendsLive.map((item) => (
                    <FriendLiveCard
                      key={item.friendId}
                      item={item}
                      onPress={() => router.push(`/room/${item.roomId}`)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </>
        }
        ListEmptyComponent={loading ? <SkeletonList count={3} /> : <ManagedRoomsEmptyCard />}
        ListFooterComponent={
          <>
            {/* Son Girdi�?in Odalar */}
            <View style={s.sectionRow}>
              <View style={[s.sectionAccent, { backgroundColor: '#3B82F6' }]} />
              <Ionicons name="time" size={14} color="#3B82F6" style={{ opacity: 0.7 }} />
              <Text style={s.sectionTitle}>{t('home.recent_rooms')}</Text>
            </View>
            {recentRooms.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                style={{ marginBottom: 4 }}
              >
                {recentRooms.map((item) => (
                  <RecentRoomCard
                    key={item.id}
                    item={item}
                    onPress={() => {
                      if ((item as any)._isLive === false) {
                        showToast({ title: i18n.t('tabs.myrooms.026'), message: i18n.t('tabs.myrooms.027'), type: 'info' });
                        return;
                      }
                      router.push(`/room/${item.id}`);
                    }}
                  />
                ))}
              </ScrollView>
            ) : loading ? (
              // ★ v1.7.13.146 (24 May 2026): İlk yüklemede skeleton kartlar — boş state
              //   yerine "yükleniyor" hissi (kullanıcı isteği).
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                style={{ marginBottom: 4 }}
                scrollEnabled={false}
              >
                {[0, 1, 2, 3].map((i) => <RecentRoomCardSkeleton key={i} delay={i * 90} />)}
              </ScrollView>
            ) : (
              <View style={s.emptyFollowed}>
                <Text style={s.emptyFollowedText}>
                  💤 {t('myrooms.recent_empty_title')}{`\n`}{t('myrooms.recent_empty_sub')}
                </Text>
              </View>
            )}
            {/* �?? 2026-04-21: StatsBar ListHeaderComponent'e ta�?ındı �?? burada yer almıyor. */}
          </>
        }
      />

      {/* �?? PlusMenu �?? Oda Yönetim Paneli (sa�?dan slide) */}
      <PlusMenu
        visible={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        onInviteFriends={() => setShowInviteFriends(true)}
        onShareLink={async () => {
          if (!selectedRoom) return;
          try {
            const { Share } = require('react-native');
            await Share.share({
              message: i18n.t('auto.tabs.myrooms.003', { 0: selectedRoom.name || i18n.t('tabs.myrooms.037'), 1: selectedRoom.id }),
              title: selectedRoom.name || i18n.t('auto.tabs.myrooms.002'),
            });
          } catch {}
        }}
        // �?? v1.7.13.141 SENARYO-4: Geçici host ise moderator rolü ver �?? "Sil" butonu gizlenir
        userRole={selectedRoom && (selectedRoom.room_settings as any)?.original_host_id && (selectedRoom.room_settings as any)?.original_host_id !== firebaseUser?.uid ? 'moderator' : 'owner'}
        ownerTier={effectiveTier}
        onDeleteRoom={handleRoomDelete}
        isFollowingRoom={false}
        isRoomLocked={rmIsLocked}
        onRoomLock={isTierAtLeast(effectiveTier, 'Plus') ? () => {
          const newLocked = !rmIsLocked;
          setRmIsLocked(newLocked);
          updateRoomSetting('is_locked', newLocked);
        } : undefined}
        settingsConfig={settingsConfig}
        followerCount={rmFollowerCount}
        micRequestCount={0}
        // �?? 2026-04-20: Inline Banlılar & İstekler �?? ayrı modal kaldırıldı
        roomId={selectedRoom?.id}
        hostId={firebaseUser?.uid}
        roomType={selectedRoom?.type || 'open'}
      />

      {/* �?? Arkada�? Davet Modalı �?? Odalarım sayfası */}
      {firebaseUser && selectedRoom && (
        <InviteFriendsModal
          visible={showInviteFriends}
          userId={firebaseUser.uid}
          onClose={() => setShowInviteFriends(false)}
          onInvite={async (selectedUsers: FollowUser[]) => {
            if (!selectedRoom || !firebaseUser || !profile) {
              setShowInviteFriends(false);
              return;
            }
            const hostName = profile.display_name || i18n.t('tabs.myrooms.038');
            let successCount = 0;
            for (const user of selectedUsers) {
              try {
                const result = await RoomAccessService.inviteUser(selectedRoom.id, user.id, firebaseUser.uid);
                if (result.success) successCount++;
                PushService.sendRoomInvite(user.id, hostName, selectedRoom.name || i18n.t('tabs.myrooms.037'), selectedRoom.id).catch(() => {});
              } catch {}
            }
            if (successCount > 0) {
              showToast({ title: i18n.t('tabs.myrooms.028'), message: i18n.t('auto.tabs.myrooms.001', { 0: successCount }), type: 'success' });
            }
            setShowInviteFriends(false);
          }}
        />
      )}

      {/* �?? Arkada�? Listesi Drawer */}
      <FriendsDrawer
        visible={showFriends}
        friends={allFriends}
        onClose={() => setShowFriends(false)}
        onSelect={(userId) => { setShowFriends(false); openUserProfile(userId); }}
        currentUserId={firebaseUser?.uid}
      />

      {/* �?? 2026-04-23: Quick-create sheet �?? CTA press ve empty state'teki detay linki aynı sheet'i açar
           bottomOffset=84: CurvedTabBar yüksekli�?ine denk �?? panel tab bar'ın üstünde durur, son seçenek kırpılmaz. */}
      <QuickCreateSheet
        visible={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onQuickCreate={(category) => handleQuickCreate(category)}
        onDetailedCreate={() => router.push('/create-room')}
        bottomInset={insets.bottom}
        bottomOffset={84}
        templates={getRoomTemplates().map(t => ({
          id: t.id, emoji: t.emoji, label: t.label, category: t.category, colors: t.colors,
        }))}
      />

      {/* �?? v92 (1 May 2026): Yeni kullanıcı yönlendirici coachmark �?? "+ Yeni Oda Olu�?tur"
           CTA butonunun ALTINA tooltip yerle�?ir, ok yukarı bakar (CTA üstte konumlanmı�?).
           ctaTopOffset = insets.top + header (~56) + CTA marginTop + CTA height (~64) + 4 bo�?luk */}
      <CreateRoomCoachmark
        visible={showCreateCoachmark}
        ctaTopOffset={insets.top + 56 + 70}
        onDismiss={() => {
          setShowCreateCoachmark(false);
          if (firebaseUser?.uid) markCreateRoomCoachmarkSeen(firebaseUser.uid).catch(() => {});
        }}
      />

      {/* �?? 2026-04-21: Tab bar scroll fade �?? tüm tab sayfalarında tutarlı */}
      <TabBarFadeOut />
    </View></CosmeticBackground></AppBackground>
  );
}

// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
// ANA STİLLER
// �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  /* �?? Premium Header �?? Ke�?fet ile aynı Glassmorphic topBar */
  topBarWrap: {
    position: 'relative',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  topBarGlass: {
    ...StyleSheet.absoluteFillObject,
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 4,
  },
  topBarSeparator: {
    height: 1.5,
    width: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center', overflow: 'visible',
  },
  headerIcon: {
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },

  notifBadge: {
    position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Colors.bg
  },
  notifBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },



  /* CTA �?? Premium Gradient */
  // �?? 2026-04-21: Arama barı �?? eksik stil eklendi (input görünmüyordu, placeholder da soluk siyahtı)
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(30,41,59,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  ctaWrap: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, gap: 10,
  },
  ctaIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaTitle: {
    fontSize: 14, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  ctaSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1,
  },

  /* Section Title �?? gradient accent çizgisi */
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, marginTop: 14, marginBottom: 8,
  },
  sectionAccent: {
    width: 3, height: 16, borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },



  /* Empty �?? Takip Etti�?im Odalar */
  emptyFollowed: {
    marginHorizontal: 16, padding: 14, borderRadius: 14,
    backgroundColor: '#414e5f', borderWidth: 1, borderColor: Colors.cardBorder,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  emptyFollowedText: {
    fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
