/**
 * SopranoChat — Korolar Keşfet (Faz 6.1)
 * ═══════════════════════════════════════════════════
 * İki tab: Keşfet (public) | Üyeliklerim
 * + butonu yeni Koro oluşturma sheet'i açar.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image, ImageStyle, RefreshControl, TextInput, Modal, Switch, Animated, PanResponder, Easing,
} from 'react-native';
import AppLoader from '../../components/AppLoader';
import { bannerIntroPlayed, markBannerIntroPlayed } from '../../utils/bannerIntro';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackground from '../../components/AppBackground';
import SPIcon from '../../components/SPIcon';
import { Colors, Shadows } from '../../constants/theme';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import { ClubService, normalizeClubSlug, type Club } from '../../services/clubs';
import { StorageService } from '../../services/storage';
import * as ImagePicker from 'expo-image-picker';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

type TabId = 'discover' | 'mine';

export default function ClubsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const userId = firebaseUser?.uid;

  const [tab, setTab] = useState<TabId>('discover');
  const [discover, setDiscover] = useState<Club[]>([]);
  const [mine, setMine] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // ★ 2026-04-27: Kodla katıl modal — gizli korolara/davet kodu sahibi olanlar için
  const [showJoinByCode, setShowJoinByCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  // ★ 2026-04-27: Arama input — keşfet listesinde filtre
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [pub, my] = await Promise.all([
      ClubService.listPublicClubs(30),
      userId ? ClubService.listMyClubs(userId) : Promise.resolve([]),
    ]);
    setDiscover(pub);
    setMine(my);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ★ 2026-04-27: useMemo ile referans stabil + arama filtresi
  const list = React.useMemo(() => {
    const base = tab === 'discover' ? discover : mine;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.slug?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }, [tab, discover, mine, searchQuery]);

  return (
    <AppBackground variant="explore" radialGlow>
      {/* ★ 2026-04-28 v4: Keşfet/Odalarım ile birebir aynı glassmorphic topBar pattern.
           JSX sırası: glass → topBar → separator (natural flow, position:absolute YOK). */}
      <View style={[s.topBarWrap, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.82)', 'rgba(12,22,40,0.6)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={s.topBarGlass}
          pointerEvents="none"
        />
        <View style={s.topBar}>
          <AnimatedKoroLogo />
          <View style={s.headerRight}>
            <Pressable onPress={() => { setJoinCodeInput(''); setShowJoinByCode(true); }} hitSlop={10} style={s.headerIconBtn}>
              <Ionicons name="ticket-outline" size={22} color="#F1F5F9" style={s.headerIcon} />
            </Pressable>
            <Pressable onPress={() => setShowCreate(true)} hitSlop={10} style={s.headerIconBtn}>
              <Ionicons name="add-circle-outline" size={22} color="#F1F5F9" style={s.headerIcon} />
            </Pressable>
          </View>
        </View>
        {/* Alt teal separator — natural flow */}
        <LinearGradient
          colors={['transparent', 'rgba(20,184,166,0.55)', 'rgba(20,184,166,0.55)', 'transparent']}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.topBarSeparator}
          pointerEvents="none"
        />
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        <TabPill active={tab === 'discover'} label="Keşfet" icon="compass" onPress={() => setTab('discover')} />
        <TabPill active={tab === 'mine'} label={`Üyeliklerim ${mine.length > 0 ? `(${mine.length})` : ''}`} icon="people" onPress={() => setTab('mine')} />
      </View>

      {/* ★ 2026-04-27: Arama bar'ı — sadece Keşfet tab'ında */}
      {tab === 'discover' && (
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={14} color="rgba(148,163,184,0.7)" style={{ marginLeft: 10 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Koro ara (isim veya konu)..."
            placeholderTextColor="rgba(148,163,184,0.4)"
            style={s.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            maxLength={50}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={{ paddingHorizontal: 10 }}>
              <Ionicons name="close-circle" size={16} color="rgba(148,163,184,0.6)" />
            </Pressable>
          )}
        </View>
      )}

      {loading ? (
        <View style={s.loading}>
          <AppLoader size="large" color="#FBBF24" />
        </View>
      ) : list.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="mic" size={56} color="rgba(251,191,36,0.65)" style={iconShadow} />
          </View>
          <Text style={s.emptyTitle}>Sesinin ailesini bul</Text>
          {/* ★ 2026-04-28: Koro kavramı tanıtımı — yeni kullanıcı "ne işe yarar" sorusunu cevaplasın */}
          <Text style={s.emptyText}>
            Koro, düzenli bir araya gelen ses topluluğun. Sahip oda açar, üyeler katılır,
            birlikte SP hazinesi biriktirip oda boost edersiniz.
          </Text>
          <Text style={s.emptyHint}>
            {tab === 'discover'
              ? 'Henüz açık Koro yok — ilk olan sen olabilirsin.'
              : 'Henüz hiçbir Koroya katılmadın.'}
          </Text>
          {tab === 'discover' ? (
            <Pressable onPress={() => setShowCreate(true)} style={({ pressed }) => [s.emptyCtaPink, pressed && { opacity: 0.85 }]}>
              <LinearGradient
                colors={['#9F1239', '#581C87']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="add-circle" size={14} color="#FBBF24" style={iconShadow} />
              <Text style={s.emptyCtaPinkText}>İlk Koroyu Kur</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setTab('discover')} style={s.emptyBtn}>
              <Text style={s.emptyBtnText}>Keşfete göz at</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FBBF24" />}
        >
          {/* ★ 2026-04-28: Yatay carousel + section'lu liste — Spotify "Yapılan Çalma Listeleri" pattern.
               Arama yoksa ve 3+ Koro varsa: top 5 horizontal + kalanı vertical.
               Aksi halde sadece vertical (mevcut sade hâl). */}
          {/* ★ 2026-04-28: 5+ Koro varsa: top 5 carousel + altta KALANLAR (duplicate yok).
               Aksi halde sadece vertical liste — 3-4 Koroda carousel anlamsız. */}
          {!searchQuery && list.length >= 5 ? (
            <>
              <View style={s.sectionHeader}>
                <View style={s.sectionAccent} />
                <Ionicons
                  name={tab === 'discover' ? 'sparkles' : 'flame'}
                  size={12}
                  color="#FBBF24"
                  style={iconShadow}
                />
                <Text style={s.sectionTitle}>
                  {tab === 'discover' ? 'BU HAFTA ÖNE ÇIKANLAR' : 'KOROLARIN'}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 4 }}
              >
                {list.slice(0, 5).map(c => (
                  <ClubCardCompact
                    key={c.id}
                    club={c}
                    onPress={() => router.push(`/club/${c.id}` as any)}
                  />
                ))}
              </ScrollView>
              <View style={[s.sectionHeader, { marginTop: 18 }]}>
                <View style={s.sectionAccent} />
                <Ionicons name="list" size={12} color="#FBBF24" style={iconShadow} />
                <Text style={s.sectionTitle}>TÜMÜ</Text>
              </View>
              {list.slice(5).map(c => (
                <ClubCard key={c.id} club={c} onPress={() => router.push(`/club/${c.id}` as any)} />
              ))}
            </>
          ) : (
            list.map(c => (
              <ClubCard key={c.id} club={c} onPress={() => router.push(`/club/${c.id}` as any)} />
            ))
          )}
        </ScrollView>
      )}

      {userId && (
        <CreateClubSheet
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          ownerId={userId}
          onCreated={(club) => {
            setShowCreate(false);
            router.push(`/club/${club.id}` as any);
          }}
        />
      )}

      {/* ★ 2026-04-27: Davet koduyla katılma modal'ı */}
      <Modal visible={showJoinByCode} transparent animationType="fade" onRequestClose={() => setShowJoinByCode(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => !joiningByCode && setShowJoinByCode(false)}>
          <Pressable style={s.codeModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={s.codeIconWrap}>
                <Ionicons name="ticket" size={22} color="#A855F7" style={iconShadow} />
              </View>
              <Text style={s.codeModalTitle}>Davet Kodu ile Katıl</Text>
              <Text style={s.codeModalDesc}>Koro sahibinin sana verdiği 6 karakterli kodu gir.</Text>
            </View>
            <TextInput
              value={joinCodeInput}
              onChangeText={(t) => setJoinCodeInput(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="KOD"
              placeholderTextColor="rgba(148,163,184,0.4)"
              style={s.codeInput}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              maxLength={8}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={() => !joiningByCode && setShowJoinByCode(false)}
                style={({ pressed }) => [s.codeBtnSecondary, pressed && { opacity: 0.7 }]}
                disabled={joiningByCode}
              >
                <Text style={s.codeBtnSecondaryText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!userId || joiningByCode) return;
                  if (joinCodeInput.trim().length < 4) {
                    showToast({ title: 'Geçersiz Kod', message: 'En az 4 karakter olmalı.', type: 'warning' });
                    return;
                  }
                  setJoiningByCode(true);
                  const result = await ClubService.joinByInviteCode(joinCodeInput.trim(), userId);
                  setJoiningByCode(false);
                  if (result.error) {
                    showToast({ title: 'Katılım Başarısız', message: result.error, type: 'error' });
                  } else if (result.clubId) {
                    setShowJoinByCode(false);
                    showToast({ title: '🎉 Katıldın!', message: 'Koroya başarıyla katıldın.', type: 'success' });
                    await load();
                    router.push(`/club/${result.clubId}` as any);
                  }
                }}
                style={({ pressed }) => [s.codeBtnPrimary, pressed && { opacity: 0.85 }, joiningByCode && { opacity: 0.6 }]}
                disabled={joiningByCode || joinCodeInput.length < 4}
              >
                {joiningByCode ? (
                  <AppLoader size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="enter-outline" size={14} color="#FFF" />
                    <Text style={s.codeBtnPrimaryText}>Katıl</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppBackground>
  );
}

// ── Sub components ────────────────────────────────────────────

// ★ 2026-04-28: Korolar header logosu — SopranoKoro (soprano_part.png + koro_part.png)
//   Soprano gümüş gradient (Keşfet ile birebir aynı), Koro teal gradient.
const KORO_SOP_W = 120;
const KORO_KORO_W = 80;
const KORO_H = 34;

function AnimatedKoroLogo() {
  const played = bannerIntroPlayed();
  const sopX = useRef(new Animated.Value(played ? 0 : -160)).current;
  const sopOp = useRef(new Animated.Value(played ? 1 : 0)).current;
  const koroX = useRef(new Animated.Value(played ? 0 : 120)).current;
  const koroOp = useRef(new Animated.Value(played ? 1 : 0)).current;

  useEffect(() => {
    if (played) return;
    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(sopOp, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(sopX, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]).start();
    }, 200);
    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(koroOp, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(koroX, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start(() => markBannerIntroPlayed());
    }, 650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ★ 2026-04-29: Tab focus'ta re-entrance bounce — Soprano sol-mini, Koro sağ-mini
  useFocusEffect(
    useCallback(() => {
      if (!bannerIntroPlayed()) return;
      sopX.setValue(-45);
      koroX.setValue(45);
      Animated.parallel([
        Animated.spring(sopX, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(70),
          Animated.spring(koroX, { toValue: 0, friction: 5, tension: 70, useNativeDriver: true }),
        ]),
      ]).start();
    }, [])
  );

  return (
    <View style={koroLogoS.row}>
      <Animated.Image
        source={require('../../assets/soprano_part.png')}
        style={[koroLogoS.sop, { opacity: sopOp, transform: [{ translateX: sopX }] }]}
        resizeMode="contain"
      />
      <Animated.Image
        source={require('../../assets/koro_part.png')}
        style={[koroLogoS.koro, { opacity: koroOp, transform: [{ translateX: koroX }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const koroLogoS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: -2 } as any,
  sop: { width: KORO_SOP_W, height: KORO_H } as ImageStyle,
  koro: { width: KORO_KORO_W, height: KORO_H, marginLeft: -4 } as ImageStyle,
});

function TabPill({ active, label, icon, onPress }: { active: boolean; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.tab, active && s.tabActive]}>
      <Ionicons name={icon} size={13} color={active ? '#FBBF24' : '#94A3B8'} style={iconShadow} />
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ClubCard({ club, onPress }: { club: Club; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.posterCard, pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] }]}>
      {/* ★ 2026-04-28 v2: Poster pattern — opera afişi gibi banner üstte, info altta.
           Keşfet'in yatay row pattern'inden yapısal fark. */}
      {/* Üst: BANNER (yüksekliği büyük, sanat afişi hissi) */}
      <View style={s.posterBanner}>
        {club.banner_url ? (
          <Image source={{ uri: club.banner_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : (
          <>
            <LinearGradient
              colors={['#1A2744', '#1E2D4A', '#152238', '#0E1A2E']}
              locations={[0, 0.35, 0.7, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Dekoratif teal glow — sol üst köşe */}
            <LinearGradient
              colors={['rgba(20,184,166,0.12)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.8 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* Watermark mikrofon — sağ alt (premium hissi) */}
            <Ionicons
              name="mic"
              size={64}
              color="rgba(20,184,166,0.06)"
              style={{ position: 'absolute', right: 12, bottom: 8 }}
            />
          </>
        )}
        {/* Banner üstüne bordo overlay (opera kırmızısı, ince) */}
        <LinearGradient
          colors={['transparent', 'rgba(12,20,37,0.35)', 'rgba(12,20,37,0.90)']}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Üst sağ köşe rozetler */}
        <View style={s.posterTopBadges}>
          {club.is_premium && (
            <View style={s.posterBadge}>
              <Ionicons name="star" size={10} color="#FBBF24" style={iconShadow} />
            </View>
          )}
          {!club.is_public && (
            <View style={s.posterBadge}>
              <Ionicons name="lock-closed" size={10} color="#FBBF24" style={iconShadow} />
            </View>
          )}
        </View>
        {/* Altın hairline — perde altı ışık */}
        <View style={s.posterGoldLine} />
      </View>

      {/* Alt: INFO (avatar + isim + meta) */}
      <View style={s.posterInfo}>
        {club.avatar_url ? (
          <Image source={{ uri: club.avatar_url }} style={s.posterAvatar} />
        ) : (
          <View style={[s.posterAvatar, s.posterAvatarFallback]}>
            <Ionicons name="musical-notes" size={16} color="#FBBF24" style={iconShadow} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.posterName} numberOfLines={1}>{club.name}</Text>
          {club.description ? (
            <Text style={s.posterDesc} numberOfLines={1}>{club.description}</Text>
          ) : (
            <Text style={s.posterDescItalic} numberOfLines={1}>— sessiz topluluk —</Text>
          )}
          <View style={s.posterMetaRow}>
            <Ionicons name="people" size={10} color="rgba(203,213,225,0.65)" style={iconShadow} />
            <Text style={s.posterMetaText}>{club.member_count} üye</Text>
            {club.treasury_balance > 0 && (
              <>
                <View style={s.cardMetaDot} />
                <SPIcon size={12} />
                <Text style={[s.posterMetaText, { color: '#FBBF24' }]}>{formatTreasury(club.treasury_balance)}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ★ 2026-04-28: Treasury kısaltma (1234 → 1.2K, 1234567 → 1.2M)
function formatTreasury(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

// ★ 2026-04-28: Compact card — yatay carousel için banner-prominent
function ClubCardCompact({ club, onPress }: { club: Club; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.compactCard, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}>
      {/* ★ 2026-04-28: Pink/mor base — banner yumuşak overlay olur, görsel ham gelmesin */}
      <LinearGradient
        colors={['#1E2D4A', '#1A2744', '#0E1A2E']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {club.banner_url && (
        <Image
          source={{ uri: club.banner_url }}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.7 }]}
          resizeMode="cover"
        />
      )}
      {/* ★ 2026-04-28: Bottom dark gradient güçlendi — isim/üye satırı net okunur */}
      <LinearGradient
        colors={['transparent', 'rgba(15,15,31,0.55)', 'rgba(15,15,31,0.98)']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Üst sol — küçük avatar + premium star */}
      <View style={s.compactTopRow}>
        {club.avatar_url ? (
          <Image source={{ uri: club.avatar_url }} style={s.compactAvatar} />
        ) : (
          <View style={[s.compactAvatar, s.compactAvatarFallback]}>
            <Ionicons name="musical-notes" size={12} color="#FBBF24" style={iconShadow} />
          </View>
        )}
        {club.is_premium && (
          <View style={s.compactStar}>
            <Ionicons name="star" size={10} color="#FBBF24" style={iconShadow} />
          </View>
        )}
        {!club.is_public && (
          <View style={s.compactLock}>
            <Ionicons name="lock-closed" size={9} color="#F59E0B" style={iconShadow} />
          </View>
        )}
      </View>
      {/* Alt — isim + üye sayısı */}
      <View style={s.compactBottom}>
        <Text style={s.compactName} numberOfLines={2}>{club.name}</Text>
        <View style={s.compactMeta}>
          <Ionicons name="people" size={10} color="#5EEAD4" style={iconShadow} />
          <Text style={s.compactMetaText}>{club.member_count}</Text>
          {club.treasury_balance > 0 && (
            <>
              <View style={s.cardMetaDot} />
              <SPIcon size={12} />
              <Text style={[s.compactMetaText, { color: '#FBBF24' }]}>{formatTreasury(club.treasury_balance)}</Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

interface CreateProps {
  visible: boolean;
  onClose: () => void;
  ownerId: string;
  onCreated: (club: Club) => void;
}

function CreateClubSheet({ visible, onClose, ownerId, onCreated }: CreateProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickAndUpload = async (type: 'avatar' | 'banner') => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast({ title: 'İzin Gerekli', message: 'Galeri izni vermelisin.', type: 'warning' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 7],
        quality: 0.85,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      // Geçici URI — submit'te yüklenecek
      if (type === 'avatar') setAvatarUri(uri);
      else setBannerUri(uri);
    } catch (e: any) {
      showToast({ title: 'Hata', message: e?.message || 'Görsel seçilemedi', type: 'error' });
    }
  };

  // ★ 2026-04-28: Clubhouse pattern — pan tüm sheet'e bağlı, ScrollView ile koordineli.
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const scrollOffsetRef = useRef(0);
  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
  }, []);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) && scrollOffsetRef.current <= 0,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        g.dy > 25 && Math.abs(g.dy) > Math.abs(g.dx) * 2 && scrollOffsetRef.current <= 0,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true })
            .start(() => { translateY.setValue(0); onCloseRef.current(); });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
        }
      },
    })
  ).current;

  const slugNorm = normalizeClubSlug(slug);
  const canSubmit = name.trim().length >= 2 && !!slugNorm && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // 1. Önce koroyu yarat (avatar/banner olmadan)
      const r = await ClubService.createClub(ownerId, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      });
      if (r.error || !r.club) {
        showToast({ title: 'Oluşturulamadı', message: r.error || '', type: 'error' });
        return;
      }
      const club = r.club;

      // 2. Avatar/banner varsa yükle ve update
      const updates: { avatar_url?: string; banner_url?: string } = {};
      if (avatarUri) {
        try {
          setUploadingAvatar(true);
          const url = await StorageService.uploadFile(
            'avatars',
            `${ownerId}/clubs/${club.id}/avatar_${Date.now()}.jpg`,
            avatarUri,
          );
          updates.avatar_url = url;
        } catch (e: any) {
          showToast({ title: 'Avatar Yüklenemedi', message: e?.message || '', type: 'warning' });
        } finally {
          setUploadingAvatar(false);
        }
      }
      if (bannerUri) {
        try {
          setUploadingBanner(true);
          const url = await StorageService.uploadFile(
            'avatars',
            `${ownerId}/clubs/${club.id}/banner_${Date.now()}.jpg`,
            bannerUri,
          );
          updates.banner_url = url;
        } catch (e: any) {
          showToast({ title: 'Banner Yüklenemedi', message: e?.message || '', type: 'warning' });
        } finally {
          setUploadingBanner(false);
        }
      }
      if (Object.keys(updates).length > 0) {
        await ClubService.updateClub(club.id, ownerId, updates);
        Object.assign(club, updates);
      }

      showToast({ title: '🎉 Koro Hazır!', type: 'success' });
      setName(''); setSlug(''); setDescription(''); setIsPublic(true);
      setAvatarUri(null); setBannerUri(null);
      onCreated(club);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={cm.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View
          style={[cm.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <LinearGradient
            colors={['#4a5668', '#37414f', '#232a35']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(251,191,36,0.55)', 'transparent']}
            style={cm.topEdge}
            pointerEvents="none"
          />
          {/* ★ 2026-04-28: Handle artık görsel — pan tüm sheet'te (Clubhouse). */}
          <View style={cm.handleWrap}>
            <View style={cm.handle} />
          </View>
          <View style={cm.headerRow}>
            <View style={[cm.accent, { backgroundColor: '#FBBF24' }]} />
            <Ionicons name="mic" size={14} color="#FBBF24" style={iconShadow} />
            <Text style={cm.headerTitle}>YENİ KORO</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={cm.cancel}>İptal</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Field label="İsim" hint="2-50 karakter">
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={50}
                placeholder="Koro adı"
                placeholderTextColor="rgba(148,163,184,0.5)"
                style={cm.input}
              />
            </Field>
            <Field label="Slug (URL)" hint="3-30 karakter, küçük harf/rakam/-/_">
              <View style={cm.slugWrap}>
                <Text style={cm.slugAt}>@</Text>
                <TextInput
                  value={slug}
                  onChangeText={setSlug}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="slug"
                  placeholderTextColor="rgba(148,163,184,0.5)"
                  style={[cm.input, { flex: 1 }]}
                />
              </View>
              {slug && !slugNorm && (
                <Text style={cm.slugError}>Geçersiz: en az 3 karakter, sadece harf/rakam/-/_</Text>
              )}
            </Field>
            <Field label="Açıklama" hint="Opsiyonel — 500 karaktere kadar">
              <TextInput
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                placeholder="Koro ne hakkında?"
                placeholderTextColor="rgba(148,163,184,0.5)"
                style={[cm.input, { minHeight: 70, textAlignVertical: 'top' }]}
              />
            </Field>

            {/* ★ 2026-04-26: Avatar + Banner picker — opsiyonel */}
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Text style={cm.fieldLabel}>Görseller (Opsiyonel)</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable onPress={() => pickAndUpload('avatar')} style={cm.imgBox}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFillObject} />
                  ) : (
                    <>
                      <Ionicons name="musical-notes" size={20} color="#FBBF24" style={iconShadow} />
                      <Text style={cm.imgBoxLabel}>Avatar</Text>
                    </>
                  )}
                </Pressable>
                <Pressable onPress={() => pickAndUpload('banner')} style={[cm.imgBox, { flex: 1, aspectRatio: 16/7 }]}>
                  {bannerUri ? (
                    <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <>
                      <Ionicons name="image" size={20} color="#94A3B8" style={iconShadow} />
                      <Text style={cm.imgBoxLabel}>Banner</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={cm.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={cm.toggleLabel}>Public</Text>
                <Text style={cm.toggleDesc}>Herkes keşfedebilir ve katılabilir</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(251,191,36,0.5)' }}
                thumbColor={isPublic ? '#FBBF24' : '#94A3B8'}
              />
            </View>

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={[cm.submitBtn, !canSubmit && { opacity: 0.45 }]}
            >
              {submitting ? (
                <AppLoader size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="rocket" size={14} color="#FFF" style={iconShadow} />
                  <Text style={cm.submitText}>Koroyu Kur</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
      <Text style={cm.fieldLabel}>{label}</Text>
      {hint && <Text style={cm.fieldHint}>{hint}</Text>}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  // ★ 2026-04-28 v4: Keşfet/Odalarım ile birebir aynı glassmorphic topBar — varsayılan pattern
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
  // korolarLogo artık AnimatedKoroLogo component'ında tanımlı
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
  tabRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: { backgroundColor: 'rgba(159,18,57,0.18)', borderWidth: 1, borderColor: 'rgba(159,18,57,0.45)' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  tabTextActive: { color: '#FBBF24' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 110, height: 110, borderRadius: 55,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)',
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '900', color: '#F1F5F9',
    letterSpacing: 0.3, marginTop: 4,
    ...Shadows.text,
  },
  emptyText: {
    fontSize: 12.5, color: '#CBD5E1', textAlign: 'center', lineHeight: 18,
    paddingHorizontal: 8,
    ...Shadows.text,
  },
  emptyHint: {
    fontSize: 11, color: 'rgba(148,163,184,0.7)', textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, backgroundColor: 'rgba(20,184,166,0.18)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.4)',
  },
  emptyBtnText: { fontSize: 12, fontWeight: '800', color: '#14B8A6' },
  emptyCtaPink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, overflow: 'hidden',
    marginTop: 4,
  },
  emptyCtaPinkText: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 0.3, ...Shadows.text },

  // ★ 2026-04-28 v2: POSTER CARD — opera afişi pattern (banner üst + info alt).
  //   Keşfet'in yatay row pattern'inden yapısal farklılaşma. "Sanat-vari" hissi.
  posterCard: {
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#0C1425',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.18)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  posterBanner: {
    width: '100%', height: 140,
    position: 'relative',
  },
  posterTopBadges: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', gap: 4,
  },
  posterBadge: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)',
  },
  posterGoldLine: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 1,
    backgroundColor: 'rgba(20,184,166,0.30)',
  },
  posterInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  posterAvatar: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.35)',
  },
  posterAvatarFallback: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  posterName: {
    fontSize: 15, fontWeight: '900', color: '#FFFBE6',
    letterSpacing: 0.3,
    ...Shadows.text,
  },
  posterDesc: {
    fontSize: 11, color: 'rgba(203,213,225,0.75)',
    marginTop: 1,
  },
  posterDescItalic: {
    fontSize: 11, color: 'rgba(159,18,57,0.6)',
    fontStyle: 'italic', marginTop: 1, letterSpacing: 0.5,
  },
  posterMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 4,
  },
  posterMetaText: {
    fontSize: 10, fontWeight: '700', color: 'rgba(203,213,225,0.7)',
    letterSpacing: 0.2,
    ...Shadows.textLight,
  },

  // (Eski yatay row card stilleri — geriye uyumluluk için kalıyor; bazı ompactCard yerleri kullanmaya devam edebilir)
  card: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ...Shadows.card,
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  cardAvatar: {
    width: 54, height: 54, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.28)',
  },
  cardAvatarFallback: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  // ★ 2026-04-28: Sol kenar pink accent — Koro markası
  cardLeftAccent: {
    position: 'absolute',
    left: 0, top: 12, bottom: 12, width: 3,
    borderRadius: 2,
    backgroundColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  // ★ 2026-04-28: Meta satırında ayraç nokta
  cardMetaDot: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: 'rgba(148,163,184,0.5)',
    marginHorizontal: 3,
  },

  // ★ 2026-04-28: Section header — "BU HAFTA ÖNE ÇIKANLAR" / "TÜMÜ"
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  sectionAccent: {
    width: 3, height: 12, borderRadius: 2,
    backgroundColor: '#FBBF24',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.0, textTransform: 'uppercase',
    ...Shadows.text,
  },

  // ★ 2026-04-28: Compact card — yatay carousel banner-prominent
  compactCard: {
    width: 155, height: 185,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.20)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  compactTopRow: {
    position: 'absolute', top: 8, left: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  compactAvatar: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.35)',
  },
  compactAvatarFallback: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  compactStar: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  compactLock: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  compactBottom: {
    position: 'absolute', left: 10, right: 10, bottom: 10,
  },
  compactName: {
    fontSize: 13, fontWeight: '900', color: '#F1F5F9',
    letterSpacing: 0.2, lineHeight: 16,
    ...Shadows.text,
  },
  compactMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4,
  },
  compactMetaText: {
    fontSize: 10, fontWeight: '700', color: '#CBD5E1',
    ...Shadows.textLight,
  },
  cardName: {
    fontSize: 14, fontWeight: '800', color: '#F1F5F9',
    ...Shadows.text,
  },
  cardSlug: {
    fontSize: 11, color: '#94A3B8', marginTop: 1, ...Shadows.text,
  },
  cardDesc: {
    fontSize: 11.5, color: 'rgba(203,213,225,0.7)',
    marginTop: 4, lineHeight: 15,
  },
  cardMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 6,
  },
  cardMetaText: {
    fontSize: 10.5, fontWeight: '700', color: '#94A3B8', ...Shadows.textLight,
  },
  cardPrivateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 0.6, borderColor: 'rgba(245,158,11,0.3)',
    marginLeft: 6,
  },
  cardPrivateText: { fontSize: 8.5, fontWeight: '800', color: '#F59E0B' },
  // ★ 2026-04-27: Arama bar'ı stilleri (Keşfet tab'ında)
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginTop: 6, marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)',
    borderRadius: 14, height: 40,
  },
  searchInput: {
    flex: 1, fontSize: 13, color: '#F1F5F9', fontWeight: '500',
    paddingHorizontal: 10, height: '100%',
  },
  // ★ 2026-04-27: Davet kodu ile katılma modal stilleri
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
  },
  codeModalCard: {
    width: '100%', maxWidth: 360,
    backgroundColor: '#1E1B3A', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)',
    padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 24,
  },
  codeIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  codeModalTitle: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', textAlign: 'center' },
  codeModalDesc: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4, fontWeight: '500' },
  codeInput: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 22, fontWeight: '900', color: '#F1F5F9',
    letterSpacing: 8, textAlign: 'center',
  },
  codeBtnSecondary: {
    flex: 1, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  codeBtnSecondaryText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  codeBtnPrimary: {
    flex: 1.3, height: 44, borderRadius: 12,
    backgroundColor: '#A855F7',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  codeBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
});

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: '92%', minHeight: '60%',
    overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, zIndex: 1 },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  accent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.teal },
  headerTitle: {
    flex: 1, fontSize: 12, fontWeight: '900', color: '#CBD5E1',
    letterSpacing: 1.2, textTransform: 'uppercase', ...Shadows.text,
  },
  cancel: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  fieldLabel: {
    fontSize: 10, fontWeight: '900', color: '#5CBFB5',
    letterSpacing: 1.0, textTransform: 'uppercase', marginBottom: 4,
  },
  fieldHint: {
    fontSize: 10.5, color: 'rgba(148,163,184,0.7)', marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    color: '#F1F5F9', fontSize: 13, fontWeight: '600',
  },
  slugWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingLeft: 12,
  },
  slugAt: { fontSize: 13, color: 'rgba(148,163,184,0.7)', marginRight: 4 },
  slugError: { fontSize: 10.5, color: '#F87171', marginTop: 4 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4,
  },
  toggleLabel: { fontSize: 13, fontWeight: '800', color: '#F1F5F9' },
  toggleDesc: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 22,
    backgroundColor: '#9F1239', borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.45)',
  },
  submitText: { fontSize: 13, fontWeight: '900', color: '#FBBF24', letterSpacing: 0.4, ...Shadows.text },
  imgBox: {
    width: 70, height: 70, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', gap: 4,
  },
  imgBoxLabel: { fontSize: 9.5, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.4 },
});
