/**
 * SopranoChat — Koro Detay (Faz 6.1)
 * ═══════════════════════════════════════════════════
 * Banner + avatar + isim + üye sayısı + açıklama.
 * Aksiyonlar: Katıl/Ayrıl, üye listesi (sheet), Koro odaları.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  Modal, Animated, PanResponder, Dimensions,
  TextInput, Switch, Alert, Share,
} from 'react-native';
import AppLoader from '../../components/AppLoader';
import * as ExpoClipboard from 'expo-clipboard';

const SCREEN_H = Dimensions.get('window').height;
import { Ionicons } from '@expo/vector-icons';
import SPIcon from '../../components/SPIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeGoBack } from '../../constants/navigation';
import AppBackground from '../../components/AppBackground';
import StatusAvatar from '../../components/StatusAvatar';
import { Colors, Shadows } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { useAuth, useUserProfileSheet } from '../_layout';
import { ClubService, type Club, type ClubMember } from '../../services/clubs';
import { StorageService } from '../../services/storage';
import * as ImagePicker from 'expo-image-picker';
// ★ v107.6: Koro hazinesi bağışı SPDonateSheet → TreasurySheet (treasury bilgisi + 💰 watermark + "Hazineye Katkı")
import TreasurySheet from '../../components/club/TreasurySheet';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, profile } = useAuth();
  const userId = firebaseUser?.uid;
  const userSP = (profile as any)?.system_points || 0;

  const [club, setClub] = useState<Club | null>(null);
  const [membership, setMembership] = useState<ClubMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const [clubRooms, setClubRooms] = useState<any[]>([]);
  const [onlineMembers, setOnlineMembers] = useState(0);
  const [rotatingCode, setRotatingCode] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [c, m, realMembers, rooms] = await Promise.all([
      ClubService.getClub(id),
      userId ? ClubService.getMyMembership(id, userId) : Promise.resolve(null),
      ClubService.getMembers(id, 200),
      ClubService.listClubRoomsWithDetails(id),
    ]);
    // ★ DB'deki stale member_count yerine gerçek count kullan
    if (c) c.member_count = realMembers.length;
    // ★ Canlı nabız: online üye sayısı
    // ★ 2026-04-30: last_seen tabanlı online — stale DB is_online yerine.
    //   last_seen son 5dk içindeyse online kabul et.
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    setOnlineMembers(realMembers.filter(m => {
      const ls = m.profile?.last_seen;
      return ls && new Date(ls).getTime() > fiveMinAgo;
    }).length);
    setClub(c);
    setMembership(m);
    setClubRooms(rooms);
    setLoading(false);
  }, [id, userId]);

  useEffect(() => { load(); }, [load]);

  // ★ 2026-04-27: Realtime — Koro üye değişimi (katıl/ayrıl) anlık yansır.
  //   member_count ve online sayacı otomatik refresh.
  useEffect(() => {
    if (!id) return;
    const { supabase } = require('../../constants/supabase');
    const channel = supabase
      .channel(`club_members:${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'club_members', filter: `club_id=eq.${id}` },
        () => { load(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clubs', filter: `id=eq.${id}` },
        (payload: any) => {
          // Treasury balance, invite_code gibi anlık DB güncellemeleri yansısın
          if (payload?.new) setClub(prev => prev ? { ...prev, ...payload.new } : prev);
        }
      )
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [id, load]);

  const isMember = !!membership;
  const isOwner = membership?.role === 'owner';
  const isPrivate = club && !club.is_public;

  const handleJoin = async () => {
    if (!userId || !id) return;
    setActing(true);
    const r = await ClubService.joinClub(id, userId);
    setActing(false);
    if (!r.success) {
      showToast({ title: 'Katılım başarısız', message: r.error || '', type: 'error' });
      return;
    }
    showToast({ title: 'Koroya katıldın', type: 'success' });
    load();
  };

  const handleLeave = async () => {
    if (!userId || !id) return;
    setActing(true);
    const r = await ClubService.leaveClub(id, userId);
    setActing(false);
    if (!r.success) {
      showToast({ title: 'Ayrılma başarısız', message: r.error || '', type: 'error' });
      return;
    }
    showToast({ title: 'Korodan ayrıldın', type: 'info' });
    setMembership(null);
    if (club) setClub({ ...club, member_count: Math.max(0, club.member_count - 1) });
  };

  if (loading) {
    return (
      <AppBackground variant="profile">
        <View style={s.loading}>
          <AppLoader size="large" color="#14B8A6" />
        </View>
      </AppBackground>
    );
  }

  if (!club) {
    return (
      <AppBackground variant="profile">
        <View style={s.loading}>
          <Ionicons name="alert-circle-outline" size={42} color="#EF4444" />
          <Text style={s.errorText}>Koro bulunamadı.</Text>
          <Pressable onPress={() => safeGoBack(router)} style={s.backBtnLg}>
            <Text style={s.backBtnText}>Geri</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground variant="profile">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={s.bannerWrap}>
          {club.banner_url ? (
            <Image source={{ uri: club.banner_url }} style={s.banner} resizeMode="cover" />
          ) : (
            // ★ 2026-04-26: Yeşilimsi tek-ton banner kaldırıldı — proje DNA'sı çoklu ton (mor accent + slate koyu).
            <LinearGradient
              colors={['#3B2A4F', '#1E1B3A', '#0F0F1F']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.banner}
            />
          )}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />

          <Pressable
            onPress={() => safeGoBack(router)}
            style={[s.iconBtn, { top: insets.top + 8, left: 14 }]}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={20} color="#F1F5F9" style={iconShadow} />
          </Pressable>

          {/* ★ 2026-04-26: Settings gear — sadece sahip için */}
          {isOwner && (
            <Pressable
              onPress={() => setShowEdit(true)}
              style={[s.iconBtn, { top: insets.top + 8, right: 14 }]}
              hitSlop={10}
            >
              <Ionicons name="settings-outline" size={18} color="#F1F5F9" style={iconShadow} />
            </Pressable>
          )}

          {/* Avatar */}
          <View style={s.avatarFloat}>
            {club.avatar_url ? (
              <Image source={{ uri: club.avatar_url }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Ionicons name="musical-notes" size={36} color="#EC4899" style={iconShadow} />
              </View>
            )}
          </View>
        </View>

        {/* Title row */}
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.name} numberOfLines={1}>{club.name}</Text>
              {club.is_premium && <Ionicons name="star" size={15} color="#FBBF24" style={iconShadow} />}
              {isPrivate && <Ionicons name="lock-closed" size={13} color="#F59E0B" style={iconShadow} />}
            </View>
            <Text style={s.slug}>@{club.slug}</Text>
            <View style={s.metaRow}>
              <Pressable onPress={() => setShowMembers(true)} style={s.memberPill} hitSlop={6}>
                <Ionicons name="people" size={12} color="#5EEAD4" style={iconShadow} />
                <Text style={s.memberPillText}>{club.member_count} üye</Text>
              </Pressable>
            </View>
          </View>

          {/* Action button */}
          {userId && (
            isOwner ? (
              <View style={[s.actionBtn, { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: 'rgba(245,158,11,0.4)' }]}>
                <Ionicons name="ribbon" size={13} color="#F59E0B" />
                <Text style={[s.actionText, { color: '#F59E0B' }]}>Sahip</Text>
              </View>
            ) : isMember ? (
              <Pressable
                onPress={handleLeave}
                disabled={acting}
                style={[s.actionBtn, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' }]}
              >
                {acting ? <AppLoader size="small" color="#94A3B8" /> : (
                  <>
                    <Ionicons name="checkmark" size={13} color="#94A3B8" />
                    <Text style={[s.actionText, { color: '#94A3B8' }]}>Üyesin</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                onPress={handleJoin}
                disabled={acting || isPrivate}
                style={[s.actionBtn, { backgroundColor: '#EC4899', borderColor: '#EC4899', opacity: isPrivate ? 0.5 : 1 }]}
              >
                {acting ? <AppLoader size="small" color="#FFF" /> : (
                  <>
                    <Ionicons name="add" size={14} color="#FFF" />
                    <Text style={[s.actionText, { color: '#FFF' }]}>Katıl</Text>
                  </>
                )}
              </Pressable>
            )
          )}
        </View>

        {/* ★ 2026-04-26: Canlı Nabız — Koro aktivitesi anlık göstergesi */}
        <View style={s.pulseCard}>
          <LinearGradient
            colors={['rgba(20,184,166,0.18)', 'rgba(20,184,166,0.04)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={s.pulseStat}>
            <View style={[s.pulseDot, clubRooms.filter(r => r.room?.is_live).length > 0 && s.pulseDotLive]} />
            <Text style={s.pulseValue}>{clubRooms.filter(r => r.room?.is_live).length}</Text>
            <Text style={s.pulseLabel}>canlı oda</Text>
          </View>
          <View style={s.pulseDivider} />
          <View style={s.pulseStat}>
            <Ionicons name="people" size={16} color="#5EEAD4" style={iconShadow} />
            <Text style={s.pulseValue}>{onlineMembers}</Text>
            <Text style={s.pulseLabel}>çevrimiçi</Text>
          </View>
          <View style={s.pulseDivider} />
          <View style={s.pulseStat}>
            <SPIcon size={18} />
            <Text style={[s.pulseValue, { color: '#FBBF24' }]}>{club.treasury_balance.toLocaleString()}</Text>
            <Text style={s.pulseLabel}>hazine SP</Text>
          </View>
        </View>

        {/* Description — Koro markası, pink accent */}
        {club.description && (
          <View style={s.descCard}>
            <View style={s.sectionHeader}>
              <View style={[s.accent, { backgroundColor: '#EC4899' }]} />
              <Ionicons name="document-text" size={12} color="#EC4899" style={iconShadow} />
              <Text style={s.sectionTitle}>HAKKINDA</Text>
            </View>
            <Text style={s.descText}>{club.description}</Text>
          </View>
        )}

        {/* ★ 2026-04-26: Hazine — bağış + kolektif boost */}
        {isMember && (
          <View style={s.descCard}>
            <View style={s.sectionHeader}>
              <View style={s.accent} />
              <SPIcon size={16} />
              <Text style={s.sectionTitle}>KORO HAZİNESİ</Text>
              <Text style={s.treasuryBalance}>{club.treasury_balance.toLocaleString()} SP</Text>
            </View>
            <Text style={s.treasuryDesc}>
              Üyelerin SP bağışlarıyla biriken ortak hazinedir. Sahip ya da moderatörler bu SP ile Koro odalarını öne çıkarabilir.
            </Text>
            <View style={s.treasuryActions}>
              <Pressable
                onPress={() => setShowDonate(true)}
                style={({ pressed }) => [s.treasuryBtn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="heart" size={13} color="#EC4899" />
                <Text style={s.treasuryBtnText}>Bağış Yap</Text>
              </Pressable>
              {(isOwner || membership?.role === 'moderator') && clubRooms.some(r => r.room?.is_live) && (
                <Pressable
                  onPress={() => setShowBoost(true)}
                  style={({ pressed }) => [s.treasuryBtnBoost, pressed && { opacity: 0.85 }]}
                  disabled={club.treasury_balance < 100}
                >
                  <Ionicons name="rocket" size={13} color="#FFF" />
                  <Text style={s.treasuryBtnBoostText}>Boost!</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ★ 2026-04-27: Davet Kodu — sadece owner/moderator. Kopyala + Paylaş + Yeni üret */}
        {(isOwner || membership?.role === 'moderator') && (
          <View style={s.descCard}>
            <View style={s.sectionHeader}>
              <View style={[s.accent, { backgroundColor: '#A855F7' }]} />
              <Ionicons name="ticket" size={12} color="#A855F7" style={iconShadow} />
              <Text style={s.sectionTitle}>DAVET KODU</Text>
            </View>
            <Text style={s.treasuryDesc}>
              Kodu paylaşırsan açık/gizli fark etmeksizin kullanan herkes Koroya katılır.
              Yeni kod üretirsen eski kod geçersiz olur.
            </Text>
            {club.invite_code ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <View style={s.inviteCodeBox}>
                  <Text style={s.inviteCodeText} selectable>{club.invite_code}</Text>
                </View>
                <Pressable
                  onPress={async () => {
                    if (!club.invite_code) return;
                    await ExpoClipboard.setStringAsync(club.invite_code);
                    showToast({ title: '📋 Kopyalandı', message: 'Davet kodu panoya kopyalandı.', type: 'success' });
                  }}
                  style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="copy-outline" size={16} color="#5EEAD4" />
                </Pressable>
                <Pressable
                  onPress={async () => {
                    if (!club.invite_code) return;
                    try {
                      await Share.share({
                        message: `${club.name} Korosuna katıl!\n\nDavet kodu: ${club.invite_code}\n\nSopranoChat: https://sopranochat.com`,
                        title: `${club.name} Davet`,
                      });
                    } catch {}
                  }}
                  style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="share-social-outline" size={16} color="#5EEAD4" />
                </Pressable>
              </View>
            ) : (
              <Text style={[s.placeholderText, { textAlign: 'left', marginTop: 6 }]}>
                Henüz kod üretilmedi. Aşağıdaki "Yeni Kod" butonuna bas.
              </Text>
            )}
            <View style={{ marginTop: 10 }}>
              <Pressable
                onPress={async () => {
                  if (!userId || rotatingCode) return;
                  setRotatingCode(true);
                  const result = await ClubService.rotateInviteCode(club.id, userId);
                  setRotatingCode(false);
                  if (result.error) {
                    showToast({ title: 'Kod Üretilemedi', message: result.error, type: 'error' });
                  } else if (result.code) {
                    setClub({ ...club, invite_code: result.code });
                    showToast({ title: '✨ Yeni Kod Üretildi', message: 'Eski kod geçersiz oldu.', type: 'success' });
                  }
                }}
                style={({ pressed }) => [s.treasuryBtn, pressed && { opacity: 0.85 }, { alignSelf: 'flex-start', backgroundColor: 'rgba(168,85,247,0.14)', borderColor: 'rgba(168,85,247,0.42)' }]}
                disabled={rotatingCode}
              >
                {rotatingCode ? (
                  <AppLoader size="small" color="#A855F7" />
                ) : (
                  <>
                    <Ionicons name="refresh" size={13} color="#A855F7" />
                    <Text style={[s.treasuryBtnText, { color: '#A855F7' }]}>{club.invite_code ? 'Yeni Kod Üret' : 'Kod Üret'}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ★ 2026-04-26: Koro Odaları — gerçek liste + sahip/mod için "Yeni Oda Aç" CTA */}
        <View style={s.descCard}>
          <View style={s.sectionHeader}>
            <View style={s.accent} />
            <Ionicons name="mic" size={12} color={Colors.teal} style={iconShadow} />
            <Text style={s.sectionTitle}>KORO ODALARI</Text>
            {clubRooms.length > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countText}>{clubRooms.length}</Text>
              </View>
            )}
            {/* ★ 2026-04-28: Sahip/mod için sağ üstte hızlı "+ Yeni Oda" butonu */}
            {(isOwner || membership?.role === 'moderator') && (
              <Pressable
                onPress={() => router.push(`/create-room?clubId=${club.id}` as any)}
                style={({ pressed }) => [s.newRoomMiniBtn, pressed && { opacity: 0.85 }]}
                hitSlop={6}
              >
                <Ionicons name="add" size={14} color="#5EEAD4" style={iconShadow} />
                <Text style={s.newRoomMiniText}>Yeni</Text>
              </Pressable>
            )}
          </View>
          {clubRooms.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20 }}>
              <Ionicons name="radio-outline" size={36} color="rgba(94,234,212,0.35)" />
              <Text style={[s.placeholderText, { marginTop: 8 }]}>Henüz Koro odası yok</Text>
              {(isOwner || membership?.role === 'moderator') ? (
                <Pressable
                  onPress={() => router.push(`/create-room?clubId=${club.id}` as any)}
                  style={({ pressed }) => [s.openRoomCta, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="add-circle" size={14} color="#FFF" />
                  <Text style={s.openRoomCtaText}>İlk Koro Odasını Aç</Text>
                </Pressable>
              ) : (
                <Text style={s.placeholderHint}>Sahip veya moderatör burada oda açabilir.</Text>
              )}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 14, gap: 8 }}>
              {clubRooms.map(cr => {
                const r = cr.room;
                const boosted = r.boost_expires_at && new Date(r.boost_expires_at).getTime() > Date.now();
                const scheduledIso = r.room_settings?.scheduled_at;
                const isScheduledFuture = scheduledIso && new Date(scheduledIso).getTime() > Date.now();
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => router.push(`/room/${r.id}` as any)}
                    style={({ pressed }) => [s.roomRow, pressed && { opacity: 0.85 }]}
                  >
                    {boosted && (
                      <LinearGradient
                        colors={['rgba(251,191,36,0.18)', 'rgba(251,191,36,0.04)']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                    {r.host?.avatar_url ? (
                      <Image source={{ uri: r.host.avatar_url }} style={s.roomAvatar} />
                    ) : (
                      <View style={[s.roomAvatar, s.roomAvatarFallback]}>
                        <Ionicons name="person" size={18} color="#94A3B8" />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {r.is_live ? (
                          <View style={s.liveBadge}>
                            <View style={s.liveDot} />
                            <Text style={s.liveBadgeText}>CANLI</Text>
                          </View>
                        ) : isScheduledFuture ? (
                          <View style={[s.liveBadge, { backgroundColor: 'rgba(168,85,247,0.18)', borderColor: 'rgba(168,85,247,0.45)' }]}>
                            <Ionicons name="calendar" size={8} color="#A855F7" />
                            <Text style={[s.liveBadgeText, { color: '#A855F7' }]}>YAKINDA</Text>
                          </View>
                        ) : null}
                        {boosted && <Ionicons name="rocket" size={11} color="#FBBF24" />}
                        {cr.pinned && <Ionicons name="bookmark" size={11} color="#5EEAD4" />}
                        <Text style={s.roomName} numberOfLines={1}>{r.name}</Text>
                      </View>
                      <Text style={s.roomMeta} numberOfLines={1}>
                        {r.host?.display_name || 'Sahip'}
                        {r.is_live && ` • ${r.listener_count || 0} dinleyici`}
                        {isScheduledFuture && ` • ${new Date(scheduledIso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#64748B" />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Members sheet */}
      <MembersSheet
        visible={showMembers}
        onClose={() => setShowMembers(false)}
        clubId={club.id}
        actorUserId={userId}
        actorRole={membership?.role}
        onMemberCount={(count) => {
          if (club && club.member_count !== count) {
            setClub({ ...club, member_count: count });
          }
        }}
      />

      {/* ★ v107.6: TreasurySheet — Koro hazinesine bağış (kendi sheet'i, 💰 watermark + treasury bilgisi) */}
      {userId && (
        <TreasurySheet
          visible={showDonate}
          onClose={() => setShowDonate(false)}
          senderId={userId}
          clubId={club.id}
          clubName={club.name}
          clubAvatar={club.avatar_url}
          treasuryBalance={club.treasury_balance}
          memberCount={club.member_count}
          isPremium={club.is_premium}
          onTreasuryUpdate={(newBalance) => setClub({ ...club, treasury_balance: newBalance })}
        />
      )}
      {userId && (
        <BoostSheet
          visible={showBoost}
          onClose={() => setShowBoost(false)}
          clubId={club.id}
          treasuryBalance={club.treasury_balance}
          byUserId={userId}
          liveRooms={clubRooms.filter(r => r.room?.is_live)}
          onBoosted={(newBalance) => setClub({ ...club, treasury_balance: newBalance })}
        />
      )}
      {userId && isOwner && (
        <EditClubSheet
          visible={showEdit}
          onClose={() => setShowEdit(false)}
          club={club}
          ownerId={userId}
          onUpdated={(updates) => setClub({ ...club, ...updates } as Club)}
          onDeleted={() => {
            setShowEdit(false);
            safeGoBack(router);
          }}
        />
      )}
    </AppBackground>
  );
}

// ── Members Sheet — Expandable Bottom Sheet ─────────────────────
// Handle'dan yukarı sürükle → tam ekran, aşağı sürükle → kapat.
// Oda sohbet modalı ile aynı pattern.

const SNAP_HALF = SCREEN_H * 0.5;   // başlangıç: ekranın yarısı
const SNAP_FULL = 60;                // tam ekran: üstten 60px boşluk
const SNAP_DISMISS = SCREEN_H + 50;  // ekran dışı

function MembersSheet({ visible, onClose, clubId, onMemberCount, actorUserId, actorRole }: {
  visible: boolean; onClose: () => void; clubId: string;
  onMemberCount?: (count: number) => void;
  actorUserId?: string;
  actorRole?: ClubMember['role'] | null;
}) {
  const { openUserProfile } = useUserProfileSheet();
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Sheet top offset — SNAP_HALF = yarım ekran, SNAP_FULL = tam ekran
  const sheetTop = useRef(new Animated.Value(SNAP_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentSnap = useRef(SNAP_HALF);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ★ 2026-04-28: Clubhouse pattern — pan tüm sheet'e bağlı, ScrollView ile koordineli.
  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);
  const shouldCaptureDrag = useCallback((dy: number, dx: number) => {
    if (Math.abs(dy) < 8) return false;
    if (Math.abs(dy) <= Math.abs(dx)) return false;
    if (currentSnap.current !== SNAP_FULL) return true;
    return dy > 0 && scrollOffsetRef.current <= 0;
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => shouldCaptureDrag(g.dy, g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) => shouldCaptureDrag(g.dy, g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const newTop = currentSnap.current + g.dy;
        // Üst sınır (tam ekrandan yukarı gitmesin)
        sheetTop.setValue(Math.max(SNAP_FULL - 20, newTop));
      },
      onPanResponderRelease: (_, g) => {
        const finalPos = currentSnap.current + g.dy;

        // Aşağı sürükleme → dismiss
        if (finalPos > SCREEN_H * 0.65 || g.vy > 0.8) {
          currentSnap.current = SNAP_DISMISS;
          Animated.parallel([
            Animated.timing(sheetTop, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: false }),
            Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(() => onCloseRef.current());
          return;
        }

        // Yukarı sürükleme → tam ekran
        if (finalPos < SCREEN_H * 0.35 || g.vy < -0.5) {
          currentSnap.current = SNAP_FULL;
          setExpanded(true);
          Animated.spring(sheetTop, { toValue: SNAP_FULL, useNativeDriver: false, damping: 22, stiffness: 200 }).start();
          return;
        }

        // Yarım pozisyona geri dön
        currentSnap.current = SNAP_HALF;
        setExpanded(false);
        Animated.spring(sheetTop, { toValue: SNAP_HALF, useNativeDriver: false, damping: 22, stiffness: 200 }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      sheetTop.setValue(SNAP_DISMISS);
      backdropOpacity.setValue(0);
      currentSnap.current = SNAP_HALF;
      setExpanded(false);
      setLoading(true);
      ClubService.getMembers(clubId, 200).then(m => {
        setMembers(m);
        setLoading(false);
        onMemberCount?.(m.length);
      });
      Animated.parallel([
        Animated.spring(sheetTop, { toValue: SNAP_HALF, useNativeDriver: false, damping: 22, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, clubId]);

  const dismiss = () => {
    currentSnap.current = SNAP_DISMISS;
    Animated.parallel([
      Animated.timing(sheetTop, { toValue: SNAP_DISMISS, duration: 200, useNativeDriver: false }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <View style={ms.overlay}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
        </Animated.View>
        <Animated.View style={[ms.sheet, { top: sheetTop }]} {...panResponder.panHandlers}>
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(20,184,166,0.55)', 'transparent']}
            style={ms.topEdge}
            pointerEvents="none"
          />
          {/* ★ 2026-04-28: Drag handle/header artık görsel — pan tüm sheet'te (Clubhouse). */}
          <View>
            <View style={ms.handleWrap}><View style={ms.handle} /></View>
            <View style={ms.header}>
              <View style={[ms.accent, { backgroundColor: '#EC4899' }]} />
              <Ionicons name="people" size={14} color="#EC4899" style={iconShadow} />
              <Text style={ms.headerTitle}>ÜYELER</Text>
              <View style={ms.countBadge}>
                <Text style={ms.countText}>{members.length}</Text>
              </View>
            </View>
          </View>
          {loading ? (
            <View style={ms.loading}>
              <AppLoader size="large" color="#14B8A6" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {members.map(m => {
                // ★ 2026-04-26: Yetki — owner her şeyi yapabilir, mod sadece member'ı atabilir
                const isSelf = actorUserId === m.user_id;
                const canModerate = !isSelf && actorRole === 'owner'
                  ? m.role !== 'owner'
                  : actorRole === 'moderator' && m.role === 'member' && !isSelf;
                return (
                  <Pressable
                    key={m.user_id}
                    onPress={() => { dismiss(); setTimeout(() => openUserProfile(m.user_id), 200); }}
                    style={({ pressed }) => [ms.row, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
                  >
                    <StatusAvatar
                      uri={m.profile?.avatar_url || ''}
                      size={38}
                      tier={m.profile?.subscription_tier as any}
                      isOnline={(() => { const ls = (m.profile as any)?.last_seen; return ls && new Date(ls).getTime() > Date.now() - 5 * 60 * 1000; })()}
                      frameId={(m.profile as any)?.active_frame || null}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={ms.name} numberOfLines={1}>{m.profile?.display_name || 'Kullanıcı'}</Text>
                      {m.profile?.username && <Text style={ms.username}>@{m.profile.username}</Text>}
                    </View>
                    <RoleBadge role={m.role} />
                    {canModerate && actorUserId && (
                      <Pressable
                        hitSlop={10}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          // Owner: promote/demote/kick. Moderatör: sadece kick.
                          const buttons: any[] = [];
                          if (actorRole === 'owner') {
                            if (m.role === 'member') {
                              buttons.push({
                                text: '⭐ Moderatör Yap',
                                onPress: async () => {
                                  const r = await ClubService.setMemberRole(clubId, m.user_id, 'moderator', actorUserId);
                                  if (r.success) {
                                    showToast({ title: 'Moderatör atandı', type: 'success' });
                                    setMembers(prev => prev.map(x => x.user_id === m.user_id ? { ...x, role: 'moderator' } : x));
                                  } else {
                                    showToast({ title: 'Hata', message: r.error || '', type: 'error' });
                                  }
                                },
                              });
                            } else if (m.role === 'moderator') {
                              buttons.push({
                                text: '👤 Üyeye İndir',
                                onPress: async () => {
                                  const r = await ClubService.setMemberRole(clubId, m.user_id, 'member', actorUserId);
                                  if (r.success) {
                                    showToast({ title: 'Rol değiştirildi', type: 'success' });
                                    setMembers(prev => prev.map(x => x.user_id === m.user_id ? { ...x, role: 'member' } : x));
                                  } else {
                                    showToast({ title: 'Hata', message: r.error || '', type: 'error' });
                                  }
                                },
                              });
                            }
                            // ★ v77 (2026-04-28): Sahiplik Devri — sadece owner görür, başka üyeye verir
                            buttons.push({
                              text: '👑 Sahipliği Devret',
                              onPress: () => {
                                Alert.alert(
                                  'Sahipliği Devret',
                                  `${m.profile?.display_name || 'Bu üye'} Koronun sahibi olacak. Sen otomatik moderatör rolüne düşeceksin. Bu işlem geri alınamaz.`,
                                  [
                                    { text: 'Vazgeç', style: 'cancel' },
                                    {
                                      text: 'Devret',
                                      style: 'destructive',
                                      onPress: async () => {
                                        const r = await ClubService.transferOwnership(clubId, m.user_id, actorUserId);
                                        if (r.success) {
                                          showToast({ title: '👑 Sahiplik Devredildi', message: 'Artık moderatörsün.', type: 'success' });
                                          setMembers(prev => prev.map(x => {
                                            if (x.user_id === m.user_id) return { ...x, role: 'owner' };
                                            if (x.user_id === actorUserId) return { ...x, role: 'moderator' };
                                            return x;
                                          }));
                                        } else {
                                          showToast({ title: 'Devir Başarısız', message: r.error || '', type: 'error' });
                                        }
                                      },
                                    },
                                  ],
                                );
                              },
                            });
                          }
                          buttons.push({
                            text: '🚪 Korodan At',
                            style: 'destructive',
                            onPress: async () => {
                              const r = await ClubService.kickMember(clubId, m.user_id, actorUserId);
                              if (r.success) {
                                showToast({ title: 'Üye atıldı', type: 'info' });
                                setMembers(prev => prev.filter(x => x.user_id !== m.user_id));
                                onMemberCount?.(members.length - 1);
                              } else {
                                showToast({ title: 'Hata', message: r.error || '', type: 'error' });
                              }
                            },
                          });
                          buttons.push({ text: 'Vazgeç', style: 'cancel' });
                          Alert.alert(m.profile?.display_name || 'Üye', 'Bu üye için bir aksiyon seç:', buttons);
                        }}
                        style={ms.menuBtn}
                      >
                        <Ionicons name="ellipsis-vertical" size={14} color="#94A3B8" />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function RoleBadge({ role }: { role: ClubMember['role'] }) {
  const cfg = role === 'owner'
    ? { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: 'Sahip', icon: 'ribbon' as const }
    : role === 'moderator'
      ? { color: '#A855F7', bg: 'rgba(168,85,247,0.15)', label: 'Moderatör', icon: 'shield' as const }
      : null;
  if (!cfg) return null;
  return (
    <View style={[ms.roleBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '55' }]}>
      <Ionicons name={cfg.icon} size={10} color={cfg.color} />
      <Text style={[ms.roleText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// ★ 2026-04-26: BoostSheet — owner/mod hazineden Koro odasını boost eder
// ════════════════════════════════════════════════════════════════
function BoostSheet({ visible, onClose, clubId, treasuryBalance, byUserId, liveRooms, onBoosted }: {
  visible: boolean; onClose: () => void; clubId: string; treasuryBalance: number; byUserId: string;
  liveRooms: any[]; onBoosted: (newBalance: number) => void;
}) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [duration, setDuration] = useState<1 | 6>(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && liveRooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(liveRooms[0].room.id);
    }
  }, [visible, liveRooms]);

  const cost = duration === 6 ? 400 : 100;
  const canSubmit = !!selectedRoomId && treasuryBalance >= cost && !busy;

  const submit = async () => {
    if (!selectedRoomId) return;
    setBusy(true);
    const r = await ClubService.boostRoomWithTreasury(clubId, selectedRoomId, duration, byUserId);
    setBusy(false);
    if (!r.success) {
      showToast({ title: 'Boost Başarısız', message: r.error || '', type: 'error' });
      return;
    }
    showToast({ title: '🚀 Boost Aktif!', message: `${cost} SP hazineden kullanıldı.`, type: 'success' });
    onBoosted(r.newTreasury ?? 0);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={ds.overlay} onPress={onClose}>
        <Pressable style={ds.dialog} onPress={() => {}}>
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[ds.iconCircle, { backgroundColor: 'rgba(251,191,36,0.18)', borderColor: 'rgba(251,191,36,0.5)' }]}>
            <Ionicons name="rocket" size={26} color="#FBBF24" style={iconShadow} />
          </View>
          <Text style={ds.title}>Koro Odası Boost</Text>
          <Text style={ds.subtitle}>Hazine: {treasuryBalance.toLocaleString()} SP</Text>

          <Text style={ds.sectionLabel}>Oda Seç</Text>
          <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
            {liveRooms.map(cr => {
              const r = cr.room;
              const sel = selectedRoomId === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setSelectedRoomId(r.id)}
                  style={[ds.roomOpt, sel && ds.roomOptActive]}
                >
                  <View style={[s.liveBadge, !r.is_live && { opacity: 0 }]}>
                    <View style={s.liveDot} />
                    <Text style={s.liveBadgeText}>CANLI</Text>
                  </View>
                  <Text style={[ds.roomOptText, sel && { color: Colors.teal }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  {sel && <Ionicons name="checkmark-circle" size={16} color={Colors.teal} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={ds.sectionLabel}>Süre</Text>
          <View style={ds.amountRow}>
            <Pressable
              onPress={() => setDuration(1)}
              style={[ds.preset, duration === 1 && ds.presetActive]}
            >
              <Text style={[ds.presetText, duration === 1 && { color: Colors.teal }]}>1 saat — 100 SP</Text>
            </Pressable>
            <Pressable
              onPress={() => setDuration(6)}
              style={[ds.preset, duration === 6 && ds.presetActive]}
            >
              <Text style={[ds.presetText, duration === 6 && { color: Colors.teal }]}>6 saat — 400 SP</Text>
            </Pressable>
          </View>
          {treasuryBalance < cost && (
            <Text style={ds.warning}>⚠️ Hazinede yeterli SP yok</Text>
          )}
          <View style={ds.btnRow}>
            <Pressable onPress={onClose} style={ds.cancelBtn}>
              <Text style={ds.cancelText}>İptal</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={!canSubmit} style={[ds.submitBtn, !canSubmit && { opacity: 0.45 }, { backgroundColor: '#FBBF24' }]}>
              {busy ? <AppLoader size="small" color="#3B1F00" /> : (
                <>
                  <Ionicons name="rocket" size={13} color="#3B1F00" />
                  <Text style={[ds.submitText, { color: '#3B1F00' }]}>Boost Et</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
// ★ 2026-04-26: EditClubSheet — sahip Koroyu düzenler veya siler
// ════════════════════════════════════════════════════════════════
function EditClubSheet({ visible, onClose, club, ownerId, onUpdated, onDeleted }: {
  visible: boolean; onClose: () => void; club: Club; ownerId: string;
  onUpdated: (updated: Partial<Club>) => void; onDeleted: () => void;
}) {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description || '');
  const [isPublic, setIsPublic] = useState(club.is_public);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(club.name);
      setDescription(club.description || '');
      setIsPublic(club.is_public);
      setAvatarUri(null);
      setBannerUri(null);
    }
  }, [visible, club]);

  const pickAndSet = async (type: 'avatar' | 'banner') => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 7],
        quality: 0.85,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      if (type === 'avatar') setAvatarUri(uri);
      else setBannerUri(uri);
    } catch (e: any) {
      showToast({ title: 'Hata', message: e?.message || '', type: 'error' });
    }
  };

  const submit = async () => {
    setBusy(true);
    const updates: any = {};
    if (name.trim() !== club.name) updates.name = name.trim();
    if (description.trim() !== (club.description || '')) updates.description = description.trim() || undefined;
    if (isPublic !== club.is_public) updates.is_public = isPublic;
    if (avatarUri) {
      try {
        const url = await StorageService.uploadFile('avatars', `${ownerId}/clubs/${club.id}/avatar_${Date.now()}.jpg`, avatarUri);
        updates.avatar_url = url;
      } catch (e: any) {
        showToast({ title: 'Avatar yüklenemedi', message: e?.message || '', type: 'warning' });
      }
    }
    if (bannerUri) {
      try {
        const url = await StorageService.uploadFile('avatars', `${ownerId}/clubs/${club.id}/banner_${Date.now()}.jpg`, bannerUri);
        updates.banner_url = url;
      } catch (e: any) {
        showToast({ title: 'Banner yüklenemedi', message: e?.message || '', type: 'warning' });
      }
    }
    if (Object.keys(updates).length === 0) {
      setBusy(false);
      onClose();
      return;
    }
    const r = await ClubService.updateClub(club.id, ownerId, updates);
    setBusy(false);
    if (!r.success) {
      showToast({ title: 'Güncellenemedi', message: r.error || '', type: 'error' });
      return;
    }
    showToast({ title: 'Kaydedildi', type: 'success' });
    onUpdated(updates);
    onClose();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Koroyu sil?',
      `"${club.name}" kalıcı olarak silinecek. Tüm üyeler ve oda bağlantıları kaybolur. Bu geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const r = await ClubService.deleteClub(club.id, ownerId);
            setBusy(false);
            if (!r.success) {
              showToast({ title: 'Silinemedi', message: r.error || '', type: 'error' });
              return;
            }
            showToast({ title: 'Koro silindi', type: 'info' });
            onDeleted();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={es.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={es.sheet}>
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={es.handleWrap}><View style={es.handle} /></View>
          <View style={es.header}>
            <View style={[es.accent, { backgroundColor: '#EC4899' }]} />
            <Ionicons name="settings" size={14} color="#EC4899" style={iconShadow} />
            <Text style={es.headerTitle}>KORONU DÜZENLE</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={es.cancel}>İptal</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
            <View style={es.field}>
              <Text style={es.label}>İsim</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={50}
                style={es.input}
                placeholderTextColor="rgba(148,163,184,0.5)"
              />
            </View>
            <View style={es.field}>
              <Text style={es.label}>Açıklama</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                style={[es.input, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholderTextColor="rgba(148,163,184,0.5)"
              />
            </View>
            <View style={es.field}>
              <Text style={es.label}>Görseller</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable onPress={() => pickAndSet('avatar')} style={es.imgBox}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFillObject} />
                  ) : club.avatar_url ? (
                    <Image source={{ uri: club.avatar_url }} style={StyleSheet.absoluteFillObject} />
                  ) : (
                    <Ionicons name="musical-notes" size={22} color="#EC4899" />
                  )}
                </Pressable>
                <Pressable onPress={() => pickAndSet('banner')} style={[es.imgBox, { flex: 1, aspectRatio: 16/7 }]}>
                  {bannerUri ? (
                    <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : club.banner_url ? (
                    <Image source={{ uri: club.banner_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <Ionicons name="image" size={20} color="#94A3B8" />
                  )}
                </Pressable>
              </View>
            </View>
            <View style={[es.field, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={es.label}>Public</Text>
                <Text style={es.hint}>Herkes keşfedebilir ve katılabilir</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(236,72,153,0.5)' }}
                thumbColor={isPublic ? '#EC4899' : '#94A3B8'}
              />
            </View>
            <Pressable
              onPress={submit}
              disabled={busy}
              style={[es.saveBtn, busy && { opacity: 0.6 }]}
            >
              {busy ? <AppLoader size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                  <Text style={es.saveText}>Kaydet</Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={confirmDelete} style={es.deleteBtn}>
              <Ionicons name="trash" size={13} color="#EF4444" />
              <Text style={es.deleteText}>Koroyu Sil</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorText: { fontSize: 14, color: '#94A3B8', ...Shadows.text },
  backBtnLg: {
    paddingHorizontal: 22, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.4)',
  },
  backBtnText: { fontSize: 13, fontWeight: '800', color: '#14B8A6' },

  bannerWrap: { width: '100%', height: 180, position: 'relative' },
  banner: { width: '100%', height: '100%' },
  iconBtn: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarFloat: {
    position: 'absolute', bottom: -36, left: 16,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 18,
    borderWidth: 3, borderColor: '#37414f',
  },
  avatarFallback: {
    backgroundColor: 'rgba(20,184,166,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 14,
  },
  name: {
    fontSize: 18, fontWeight: '900', color: '#F1F5F9', letterSpacing: 0.3,
    ...Shadows.text,
  },
  slug: { fontSize: 12, color: '#94A3B8', marginTop: 2, ...Shadows.text },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  memberPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
  },
  memberPillText: { fontSize: 11, fontWeight: '700', color: '#5EEAD4', ...Shadows.textLight },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 100, justifyContent: 'center',
  },
  actionText: { fontSize: 12.5, fontWeight: '900', letterSpacing: 0.3, ...Shadows.text },

  descCard: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  accent: { width: 3, height: 14, borderRadius: 2, backgroundColor: Colors.teal },
  sectionTitle: {
    fontSize: 11, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.1, textTransform: 'uppercase', ...Shadows.text,
  },
  descText: {
    fontSize: 13, lineHeight: 19, color: '#CBD5E1',
    paddingHorizontal: 14,
  },
  placeholderText: {
    fontSize: 12, color: '#94A3B8', marginTop: 8, ...Shadows.text,
  },
  placeholderHint: {
    fontSize: 11, color: 'rgba(148,163,184,0.6)', marginTop: 4,
  },
  // ★ 2026-04-28: Yeni Oda CTA — empty state'te sahip/mod için, teal teması (oda markası)
  openRoomCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 12, backgroundColor: '#14B8A6',
  },
  openRoomCtaText: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 0.3, ...Shadows.text },
  // Sağ üst mini "Yeni" butonu — section header içinde
  newRoomMiniBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.14)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.4)',
    marginLeft: 'auto',
  },
  newRoomMiniText: { fontSize: 10, fontWeight: '800', color: '#5EEAD4', letterSpacing: 0.2 },

  // ★ 2026-04-26: Canlı nabız kartı
  pulseCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
    paddingVertical: 14,
  },
  pulseStat: {
    alignItems: 'center', flex: 1, gap: 2,
  },
  pulseDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(148,163,184,0.5)',
    marginBottom: 2,
  },
  pulseDotLive: { backgroundColor: '#EF4444' },
  pulseValue: {
    fontSize: 18, fontWeight: '900', color: '#F1F5F9', letterSpacing: 0.3,
    ...Shadows.text,
  },
  pulseLabel: { fontSize: 9.5, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  pulseDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },

  // ★ 2026-04-26: Hazine kartı
  treasuryBalance: {
    fontSize: 12, fontWeight: '900', color: '#FBBF24',
    backgroundColor: 'rgba(251,191,36,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    ...Shadows.textLight,
  },
  treasuryDesc: {
    fontSize: 11.5, color: '#94A3B8', lineHeight: 17,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  treasuryActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingTop: 4,
  },
  treasuryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(236,72,153,0.14)',
    borderWidth: 1, borderColor: 'rgba(236,72,153,0.42)',
  },
  treasuryBtnText: { fontSize: 12, fontWeight: '900', color: '#EC4899', letterSpacing: 0.3 },
  treasuryBtnBoost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#FBBF24',
  },
  treasuryBtnBoostText: { fontSize: 12, fontWeight: '900', color: '#3B1F00', letterSpacing: 0.3 },

  // ★ 2026-04-27: Davet kodu kartı
  inviteCodeBox: {
    flex: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
    marginHorizontal: 14,
  },
  inviteCodeText: {
    fontSize: 18, fontWeight: '900', color: '#C4B5FD',
    letterSpacing: 4, textAlign: 'center',
    fontFamily: 'monospace',
    ...Shadows.text,
  },

  // ★ 2026-04-26: Oda kartı
  roomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  roomAvatar: {
    width: 36, height: 36, borderRadius: 10,
  },
  roomAvatarFallback: {
    backgroundColor: 'rgba(148,163,184,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  roomName: { flex: 1, fontSize: 13, fontWeight: '800', color: '#F1F5F9', ...Shadows.textLight },
  roomMeta: { fontSize: 10.5, color: '#94A3B8', marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(239,68,68,0.18)',
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)',
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#EF4444' },
  liveBadgeText: { fontSize: 8, fontWeight: '900', color: '#EF4444', letterSpacing: 0.4 },
  countBadge: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 'auto',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  countText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
});

// Donate + Boost dialog stilleri
const ds = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  dialog: {
    width: '88%', maxWidth: 380,
    borderRadius: 20, overflow: 'hidden',
    paddingVertical: 22, paddingHorizontal: 18,
    borderWidth: 1, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  iconCircle: {
    alignSelf: 'center',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.5)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17, fontWeight: '900', color: '#F1F5F9', textAlign: 'center',
    ...Shadows.text,
  },
  subtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  sectionLabel: {
    fontSize: 10, fontWeight: '900', color: '#94A3B8',
    letterSpacing: 1.0, textTransform: 'uppercase',
    marginTop: 12, marginBottom: 6,
  },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  preset: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  presetActive: {
    backgroundColor: 'rgba(20,184,166,0.15)',
    borderColor: 'rgba(20,184,166,0.45)',
  },
  presetText: { fontSize: 12, fontWeight: '800', color: '#94A3B8' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    color: '#F1F5F9', fontSize: 14, fontWeight: '700',
    textAlign: 'center',
  },
  roomOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 9,
    borderRadius: 10, marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  roomOptActive: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: 'rgba(20,184,166,0.45)',
  },
  roomOptText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#F1F5F9' },
  warning: { fontSize: 11, color: '#F87171', textAlign: 'center', marginTop: 6 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  cancelText: { fontSize: 12, fontWeight: '800', color: '#94A3B8' },
  submitBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12,
    backgroundColor: '#14B8A6',
  },
  submitText: { fontSize: 12, fontWeight: '900', color: '#FFF', letterSpacing: 0.4 },
});

// Edit club sheet stilleri
const es = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '85%',
    overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  accent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.teal },
  headerTitle: {
    flex: 1, fontSize: 12, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  cancel: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  field: { paddingHorizontal: 16, paddingTop: 14 },
  label: {
    fontSize: 10, fontWeight: '900', color: '#5CBFB5',
    letterSpacing: 1.0, textTransform: 'uppercase', marginBottom: 6,
  },
  hint: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    color: '#F1F5F9', fontSize: 13, fontWeight: '600',
  },
  imgBox: {
    width: 70, height: 70, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 24,
    backgroundColor: '#EC4899', borderRadius: 14,
    paddingVertical: 12,
  },
  saveText: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 0.4 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    paddingVertical: 11,
  },
  deleteText: { fontSize: 12, fontWeight: '800', color: '#EF4444' },
});

const ms = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 14, paddingBottom: 8 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  accent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.teal },
  headerTitle: {
    flex: 1, fontSize: 12, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.2, textTransform: 'uppercase', ...Shadows.text,
  },
  countBadge: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  countText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  loading: { paddingVertical: 60, alignItems: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  name: { fontSize: 13, fontWeight: '700', color: '#F1F5F9', ...Shadows.textLight },
  username: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1,
  },
  roleText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.3 },
  menuBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginLeft: 4,
  },
});
