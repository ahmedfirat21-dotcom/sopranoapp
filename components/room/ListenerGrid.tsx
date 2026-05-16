import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import AvatarPenaltyFlash, { type FlashType } from './AvatarPenaltyFlash';
import StatusAvatar from '../StatusAvatar';
import { GlowView } from '../skia';
import { migrateLegacyTier } from '../../types';
import type { RoomParticipant } from '../../services/database';
import { useRoomLayout, type ListenersLayoutConfig, type AvatarShape } from '../../services/roomLayoutConfig';
import { useFrameConfig } from '../../services/cosmeticConfigCache';

// ★ v115: Avatar shape → borderRadius çevirici
function shapeBorderRadius(shape: AvatarShape, size: number, configRadius: number): number {
  switch (shape) {
    case 'circle':  return size / 2;
    case 'square':  return 0;
    case 'rounded': return Math.min(configRadius, size / 2);
    case 'hex':     return size / 2; // mobile hex shape için ayrı mask; circle fallback
    default:        return size / 2;
  }
}

// ★ Dinamik boyutlandırma — modern platform grid sistemi (Clubhouse/Spaces pattern)
// 2026-04-20: Sayı arttıkça avatar daha agresif küçülür.
// 2026-04-22: window width runtime'dan alınıyor (useWindowDimensions) — fiziksel
// Android'de gesture-nav/rotation ile değişen ekran boyutuna adapte olsun.
// 2026-05-07: maxSize cap eklendi — az sayıda dinleyici varken (1-4 kişi) avatar
// sahne kartı (~100px) boyutuna şişmesin. Hiyerarşi: dinleyici < sahne (~%50).
// ★ v115: Config-driven metrics. cfg verilirse maxCols/colGap/sizePresets'ten okur.
function getGridMetrics(listenerCount: number, W: number, cfg?: ListenersLayoutConfig) {
  let cols: number, avatarGap: number, maxSize: number;

  if (cfg) {
    const presets = cfg.sizePresets;
    if (listenerCount <= 4)       { cols = Math.min(5, cfg.maxCols + 1); maxSize = presets.large; }
    else if (listenerCount <= 8)  { cols = Math.min(6, cfg.maxCols); maxSize = presets.medium; }
    else if (listenerCount <= 15) { cols = Math.min(7, cfg.maxCols + 1); maxSize = Math.round(presets.medium * 0.95); }
    else                          { cols = Math.min(8, cfg.maxCols + 2); maxSize = presets.small; }
    avatarGap = cfg.colGap;
  } else {
    if (listenerCount <= 4)       { cols = 5; avatarGap = 12; maxSize = 60; }
    else if (listenerCount <= 8)  { cols = 6; avatarGap = 10; maxSize = 54; }
    else if (listenerCount <= 15) { cols = 7; avatarGap = 7; maxSize = 48; }
    else                          { cols = 8; avatarGap = 5; maxSize = 42; }
  }

  const cellW = Math.floor((W - 32 - avatarGap * (cols - 1)) / cols);
  const calculated = Math.max(32, cellW - (listenerCount <= 8 ? 10 : listenerCount <= 15 ? 8 : 5));
  const avatarSize = Math.min(calculated, maxSize);
  return { cols, avatarGap, cellW, avatarSize };
}

interface Props {
  listeners: RoomParticipant[];
  onSelectUser: (user: RoomParticipant) => void;
  selectedUserId?: string | null;
  onShowAllUsers?: () => void;
  /** Tier bazlı max dinleyici grid kapasitesi (Free=10, Plus=25, Pro=sınırsız) */
  maxListeners?: number;
  /** Seyirci sayısı — grid'de gösterilmez, sadece sayı badge'i */
  spectatorCount?: number;
  /** Oda sahibi user_id — dinleyiciye indiğinde taç gösterilir */
  roomOwnerId?: string;
  /** Per-user avatar flash state */
  avatarFlashes?: Record<string, FlashType | null>;
  onFlashDone?: (userId: string) => void;
  /** Mikrofon isteği gönderen kullanıcı ID'leri */
  micRequestUserIds?: string[];
}

// ★ O10 FIX: Cell bileşeni React.memo ile sarıldı — 100+ listener'da stable props'lu
// cell'ler re-render etmeyecek. Dependency'ler: avatar, role, is_muted, is_chat_muted,
// selected, flash, hasHandRaised.
type CellProps = {
  u: RoomParticipant;
  cellW: number;
  avatarSize: number;
  nameSize: number;
  isSelected: boolean;
  isOwner: boolean;
  showMuteIndicator: boolean;
  isChatMuted: boolean;
  flash: FlashType | null;
  hasHandRaised: boolean;
  onSelectUser: (u: RoomParticipant) => void;
  onFlashDone?: (userId: string) => void;
  // ★ v116: Config-driven layout overrides
  cfgShape?: AvatarShape;
  cfgBorderRadius?: number;
  cfgRingWidth?: number;
  cfgRingColor?: string;
  cfgShowName?: boolean;
  cfgOwnerCrownEnabled?: boolean;
  cfgOwnerHighlight?: string;
};
const ListenerCell = React.memo(function ListenerCell({
  u, cellW, avatarSize, nameSize, isSelected, isOwner, showMuteIndicator,
  isChatMuted, flash, hasHandRaised, onSelectUser, onFlashDone,
  // ★ v117: Web admin oda düzen config'inden gelen propslar
  cfgShape, cfgBorderRadius, cfgRingWidth, cfgRingColor, cfgShowName,
  cfgOwnerCrownEnabled, cfgOwnerHighlight,
}: CellProps) {
  // ★ v259 (13 May 2026): ownerScale 1.10 KALDIRILDI — owner avatarı diğer
  //   listener'lardan büyüktü, GlowView wrap'a uyumsuz oluyordu (yarım clip).
  //   Owner için crown rozet (sarı yıldız) tek başına yeterli sinyal. Frame
  //   config'ten size_overrides geldiğinde de tutarsızlık önlenir.
  const ownerAvatarSize = avatarSize;
  // ★ v108.14: Aktif çerçeve varsa — owner crown + avatarOwner border + avatarWrap turkuaz border
  //   gizlenir; çerçeve zaten kullanıcının statü/aksesuarını taşır, çift halka karmaşası kalkar.
  const activeFrameId = !(u as any).disguise ? (u.user as any)?.active_frame : null;
  const hasFrame = !!activeFrameId;
  // ★ v267: Frame name_enabled aktifse AvatarFrame içindeki NameOverlay isim yazıyor.
  //   Bizim default Text de aynı anda render edilirse ÇİFT İSİM çakışması olur.
  //   SpeakerCard'da bu kontrol var, ListenerCell'de eksikti.
  const listenerFrameCfg = useFrameConfig(activeFrameId, 'listener');
  const hideDefaultName = !!listenerFrameCfg?.name_enabled;
  // ★ 2026-05-05: Plus/Pro/GM kompakt tier etiketi — dinleyici/mini avatar üstünde sağ-altta.
  //   Free → hiç gösterme. Disguise (maske) modunda da gizle.
  const userTier = !(u as any).disguise
    ? migrateLegacyTier((u.user as any)?.subscription_tier as string)
    : 'Free';
  const displayName = (u as any).disguise?.display_name || u.user?.display_name || 'Misafir';
  // ★ v1.3.70 PARİTE: StatusAvatar'a geçiş — web admin'deki tüm frame config ayarları
  //   (avatar animasyonları, filtreler, şekil, tier badge konum/ölçek, isim overlay,
  //   glow, halo, parçacıklar) artık dinleyici grid'de de tam çalışır.
  //   Eski: ham Image + ayrı RoomAvatarFrame + hardcoded TierBadge.
  //   Yeni: StatusAvatar hepsini tek component'te yönetir.
  // ★ v117: Web admin config'ten gelen shape ve indicator overrides
  const cfgRadius = cfgShape && cfgBorderRadius !== undefined
    ? (cfgShape === 'circle' ? ownerAvatarSize / 2
      : cfgShape === 'square' ? 0
      : cfgShape === 'rounded' ? Math.min(cfgBorderRadius, ownerAvatarSize / 2)
      : ownerAvatarSize / 2)
    : ownerAvatarSize / 2;
  // ★ v258 fix: Owner için ÇİFT sinyal kaldırıldı — sarı halka + sarı crown badge
  //   aynı avatara biniyordu (çift "owner" işareti, küçük avatarı daha da büyütüyordu).
  //   Crown badge tek başına yeterli sinyal; halka kaldırıldı.
  const ringW = cfgRingWidth ?? (hasFrame ? 0 : 2);
  const ringC = cfgRingColor && cfgRingColor !== 'transparent'
    ? cfgRingColor
    : 'rgba(20,184,166,0.25)';

  return (
    <Pressable style={[s.cell, { width: cellW }]} onPress={() => onSelectUser(u)}>
      {isOwner && !hasFrame && (cfgOwnerCrownEnabled !== false) && <ListenerOwnerBadge />}
      {/* ★ v262 (13 May 2026): GlowView'a sadece borderRadius (cfgRadius) eklendi —
          selected/muted highlight border'ı avatarın MEVCUT şekline (circle/square/rounded/
          hex) uyacak. width/height ve overflow:hidden YOK çünkü onlar frame editör ile
          çakışıyor (size_overrides, frame Lottie taşması). Border yuvarlaması ise zararsız. */}
      <GlowView style={[
        isSelected && s.avatarSelected,
        showMuteIndicator && s.avatarMuted,
        { borderRadius: cfgRadius },
      ]}>
        <StatusAvatar
          uri={(u as any).disguise?.avatar_url || u.user?.avatar_url}
          size={ownerAvatarSize}
          tier={userTier}
          frameId={activeFrameId}
          // ★ v265 (13 May 2026): showTierBadge HARDCODE KALDIRILDI — frame editör
          //   'tier_badge_enabled' ayarı kontrol etsin. Web admin'den listener override'da
          //   açıp kapatmak artık çalışır. Frame YOKSA default davranış (Free gizli, Pro/Plus
          //   görünür) geçerli.
          showTierBadge
          tierBadgeSize="xs"
          displayName={displayName}
          contextKey="listener"
          borderColor={ringC}
          borderWidth={ringW}
          customBadgeId={!(u as any).disguise ? ((u.user as any)?.active_badge_id ?? null) : null}
        />
      </GlowView>
      {showMuteIndicator && (
        <GlowView style={[s.mutedBadge, { right: (cellW - ownerAvatarSize) / 2 - 6 }]}>
          <Ionicons name="volume-mute" size={9} color="#FFF" />
        </GlowView>
      )}
      {isChatMuted && (
        <GlowView style={[s.chatMutedBadge, { left: (cellW - ownerAvatarSize) / 2 - 6 }]}>
          <Ionicons name="chatbox-outline" size={8} color="#FFF" />
        </GlowView>
      )}
      {flash && <View style={[s.flashWrap, { height: ownerAvatarSize }]}><AvatarPenaltyFlash flashType={flash} size={ownerAvatarSize} onFlashDone={() => onFlashDone?.(u.user_id)} /></View>}
      {hasHandRaised && <HandRaiseBadge />}
      {!hideDefaultName && (
        <Text
          style={[s.name, { fontSize: nameSize, maxWidth: cellW }, isOwner && s.nameOwner, showMuteIndicator && { color: 'rgba(239,68,68,0.6)' }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {displayName}
        </Text>
      )}
    </Pressable>
  );
});

export default function ListenerGrid({ listeners, onSelectUser, selectedUserId, onShowAllUsers, maxListeners = 20, spectatorCount = 0, roomOwnerId, avatarFlashes, onFlashDone, micRequestUserIds = [] }: Props) {
  // ★ 2026-04-22: Runtime window width (useWindowDimensions) — fiziksel cihazda
  //   gesture-nav/rotation durumuna adapte olur.
  // ★ HOOK ORDER FIX: TÜM hook'lar erken return'den ÖNCE çağrılmalı (React rules of hooks).
  //   Eskiden W module-level idi, erken return sonrası useMemo sorunsuzdu; şimdi
  //   useWindowDimensions hook olduğu için useMemo'dan ayrılmamalı.
  const { width: W } = useWindowDimensions();
  // ★ v115 (13 May 2026): Oda düzen config — avatar shape, gap, size preset
  const layout = useRoomLayout();
  const listenersCfg = layout.listeners;

  // ★ Hiyerarşik sıralama — modern platform pattern (Clubhouse/Spaces)
  // 1. Oda sahibi (owner) en başta
  // 2. El kaldıranlar (mic request) — aktif katılım göstergesi
  // 3. Moderatörler — yetki sırası
  // 4. Diğer dinleyiciler — katılış sırasına göre
  const sortedListeners = React.useMemo(() => {
    return [...listeners].sort((a, b) => {
      // Owner her zaman ilk
      if (a.user_id === roomOwnerId) return -1;
      if (b.user_id === roomOwnerId) return 1;
      // El kaldıranlar ikinci
      const aHand = micRequestUserIds.includes(a.user_id) ? 1 : 0;
      const bHand = micRequestUserIds.includes(b.user_id) ? 1 : 0;
      if (aHand !== bHand) return bHand - aHand;
      // Moderatörler üçüncü
      const aIsMod = a.role === 'moderator' ? 1 : 0;
      const bIsMod = b.role === 'moderator' ? 1 : 0;
      if (aIsMod !== bIsMod) return bIsMod - aIsMod;
      // Diğerleri — katılış sırasına göre (stabil sort)
      return 0;
    });
  }, [listeners, roomOwnerId, micRequestUserIds]);

  // ★ Tüm hook'lar tamamlandıktan SONRA erken return yapılabilir.
  if (listeners.length === 0 && spectatorCount === 0) return null;

  // ★ 2026-04-20: Grid'de maks 14 dinleyici. Daha fazlası "+N Seyirci" badge
  // olarak overflow'a düşer — tıkla → AudienceDrawer. Küçük ekranlarda daha az.
  const GRID_VISIBLE_CAP = W < 360 ? 10 : 14;
  const gridCap = Math.min(maxListeners, GRID_VISIBLE_CAP);
  const visibleListeners = sortedListeners.slice(0, gridCap);
  const overflowListeners = Math.max(0, listeners.length - gridCap);
  const overflowCount = overflowListeners + spectatorCount;

  // ★ Dinamik boyut hesapla
  const { avatarGap, cellW, avatarSize } = getGridMetrics(visibleListeners.length, W, listenersCfg);
  // ★ v115: Avatar shape config'ten
  const listenerAvatarRadius = shapeBorderRadius(listenersCfg.avatarShape, avatarSize, listenersCfg.borderRadius);
  const nameSize = visibleListeners.length > 12 ? 9 : visibleListeners.length > 8 ? 10 : 11;

  return (
    <View style={s.wrap}>
      {/* ★ 2026-04-20: "Tümü" butonu kaldırıldı — divider pill (oda sayfasında)
          ve overflow "+N Seyirci" badge tek giriş noktası (AudienceDrawer). */}
      <View style={[s.grid, { gap: avatarGap }]}>
        {visibleListeners.map((u) => {
          const isSelected = selectedUserId === u.user_id;
          const isOwner = u.user_id === roomOwnerId;
          const isMuted = (u as any).is_muted || false;
          const isChatMuted = (u as any).is_chat_muted || false;
          const flash = avatarFlashes?.[u.user_id] || null;
          const showMuteIndicator = isMuted && u.role !== 'listener';
          const hasHandRaised = micRequestUserIds.includes(u.user_id);
          return (
            <ListenerCell
              key={u.id}
              u={u}
              cellW={cellW}
              avatarSize={avatarSize}
              nameSize={nameSize}
              isSelected={isSelected}
              isOwner={isOwner}
              showMuteIndicator={showMuteIndicator}
              isChatMuted={isChatMuted}
              flash={flash}
              hasHandRaised={hasHandRaised}
              cfgShape={listenersCfg.avatarShape}
              cfgBorderRadius={listenersCfg.borderRadius}
              cfgRingWidth={listenersCfg.ringWidth}
              cfgRingColor={listenersCfg.ringColor}
              cfgShowName={listenersCfg.showName}
              cfgOwnerCrownEnabled={listenersCfg.ownerCrownEnabled}
              cfgOwnerHighlight={layout.accents.ownerHighlight}
              onSelectUser={onSelectUser}
              onFlashDone={onFlashDone}
            />
          );
        })}
        {overflowCount > 0 && (
          <Pressable style={[s.cell, { width: cellW }]} onPress={onShowAllUsers}>
            <View style={[s.avatarWrap, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, backgroundColor: 'rgba(20,184,166,0.1)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#14B8A6', fontSize: avatarSize > 50 ? 14 : 11, fontWeight: '700' }}>+{overflowCount}</Text>
            </View>
            <Text style={[s.name, { color: '#14B8A6', fontSize: nameSize }]}>Seyirci</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginTop: 4,
    // ★ v281 (16 May 2026): zIndex:10/elevation:10 yetmedi — ghost-seat dashed border
    //   listener avatarın yıldız rozeti üzerinde çıkmaya devam ediyordu. position:'relative'
    //   eklendi (RN'de zIndex sadece pozisyonlu elementlerde çalışır), zIndex 100'e çekildi,
    //   elevation Android için 30'a (ghost seat'in default 0/parent shadow'un üstünde).
    position: 'relative',
    zIndex: 100,
    elevation: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  // ★ 2026-04-19: Minimal header — sadece sayı + "Tümü" butonu
  headerRowMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listenerCountText: {
    fontSize: 11, fontWeight: '600', color: '#64748B',
    letterSpacing: 0.3,
  },
  headerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderWidth: 0.8,
    borderColor: 'rgba(20,184,166,0.12)',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 12, fontWeight: '700', color: '#CBD5E1', letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  headerCount: {
    backgroundColor: 'rgba(20,184,166,0.15)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  headerCountText: { fontSize: 10, fontWeight: '800', color: '#14B8A6' },
  allUsersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(20,184,166,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  allUsersText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#14B8A6',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    alignItems: 'center',
    marginBottom: 6,
    overflow: 'visible',
    paddingTop: 8,
  },
  avatarWrap: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(20,184,166,0.25)',
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  avatarSelected: {
    // ★ v281 (16 May 2026): Border KALDIRILDI — kullanıcı "çerçeve değil sadece gölge"
    //   istedi. Tap feedback artık tamamen radial gold shadow ile, avatar şeklini ezmiyor.
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 14,
    elevation: 14,
  },
  avatarMuted: {
    borderColor: 'rgba(239,68,68,0.4)',
    opacity: 0.7,
  },
  mutedBadge: {
    position: 'absolute', top: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2, borderColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center', justifyContent: 'center', zIndex: 15,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 8,
  },
  chatMutedBadge: {
    // ★ 2026-04-19: Aynı rengi kullanıyoruz (kırmızı). Mute = mute, ikon ayırt ediyor.
    // Önceden turuncu (#F97316) idi — kullanıcılar "kırmızı mı turuncu mu, hangisi
    // daha kötü?" diye düşünüyordu. Semantik farkı ikon (mic vs chat) taşıyor.
    position: 'absolute', top: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2, borderColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center', justifyContent: 'center', zIndex: 15,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 8,
  },
  flashWrap: {
    position: 'absolute', top: 8, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 25,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  name: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    // ★ v275 (14 May 2026): marginTop 4 → 1, isim avatara yapışık. Kullanıcı feedback'i:
    //   "default kullanıcı isimleri avatarlarından biraz uzakta aşağıda kalıyor".
    marginTop: 1,
    textAlign: 'center',
  },
  nameOwner: {
    color: '#FFD700',
    fontWeight: '700',
  },
  avatarOwner: {
    borderColor: 'rgba(255,215,0,0.7)',
    borderWidth: 2,
  },
  listenerBadgeContainer: {
    position: 'absolute',
    top: -4, left: -4,
    zIndex: 20,
    width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  listenerGlowRing: {
    // ★ v281 (16 May 2026): Border KALDIRILDI — avatarın dışına 2px taşıyordu, parent kart
    //   clip'lediği için "kesik altın iz" gibi görünüyordu. Sadece radial shadow bıraktım,
    //   yıldızın etrafı yumuşak altın hale veriyor, sert border yok.
    position: 'absolute', width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'transparent',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 6, elevation: 4,
  },
  listenerBadgeBody: {
    width: 18, height: 18, borderRadius: 9,
    // ★ v261: overflow:hidden eksikti → LinearGradient kare çizip borderRadius'u
    //   görmezden geliyordu. Rozet "kare" görünüyordu, halka "daire". Şimdi clip ile daire.
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6, shadowRadius: 4, elevation: 6,
  },
  handRaiseBadge: {
    position: 'absolute',
    top: 4, left: 2,
    zIndex: 20,
  },
});

function ListenerOwnerBadge() {
  // ★ 2026-04-20: Sade — küçük altın star + yumuşak pulse. Kullanıcı "sadece biraz
  //   daha büyük olsun" dedi, aşırı animasyonlar kaldırıldı.
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    // ★ v92.28 PERF FIX: Cleanup eksikti, 14 listener × 2 loop = 28 orphan animation.
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.5, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={s.listenerBadgeContainer}>
      {/* ★ v260 (13 May 2026): GlowView (Skia BlurMask) kaldırıldı — sade View geri geldi.
          Kullanıcı geri bildirimi: "host yıldızı yapısı değişmiş" — Skia glow halo 60px
          küçük avatar etrafında abartı duruyordu. Pulse animasyonu opacity ile korundu. */}
      <Animated.View style={[s.listenerGlowRing, { position: 'absolute', opacity: glowAnim }]} />
      <View style={s.listenerBadgeBody}>
        <LinearGradient
          colors={['#FFD700', '#F59E0B', '#D97706']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Ionicons name="star" size={10} color="#FFF" />
      </View>
    </View>
  );
}

// ★ El kaldırma animasyonlu badge — mikrofon isteği gönderen dinleyicilerde
function HandRaiseBadge() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ★ v92.28 PERF FIX: Cleanup eksikti, el kaldıran her listener için 2 paralel loop kaldıyordu.
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -3, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    bounceLoop.start();
    return () => { pulseLoop.stop(); bounceLoop.stop(); };
  }, []);

  return (
    <Animated.View style={[s.handRaiseBadge, { transform: [{ scale: pulseAnim }, { translateY: bounceAnim }] }]}>
      <Text style={{ fontSize: 14 }}>✋</Text>
    </Animated.View>
  );
}
