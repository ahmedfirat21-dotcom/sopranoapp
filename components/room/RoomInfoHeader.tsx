import React, { useRef, useEffect, useState } from 'react';
import { i18n } from '../../services/i18n';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvatarSource } from '../../constants/avatars';
import StatusAvatar from '../StatusAvatar';
import ConnectionQualityIndicator from './ConnectionQualityIndicator';
import { showToast } from '../Toast';
import { useRoomLayout } from '../../services/roomLayoutConfig';

interface Props {
  roomName: string;
  roomDescription?: string;
  isPremium?: boolean;
  viewerCount: number;
  connectionState: string;
  /** ★ 2026-04-25: LiveKit local connection quality */
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'unknown';
  roomDuration: string;
  roomExpiry?: string;
  isFollowing?: boolean;
  onBack: () => void;
  onMinimize: () => void;
  onToggleFollow?: () => void;
  // ★ Oda ayar badge'leri
  roomLanguage?: string;
  ageRestricted?: boolean;
  entryFeeSp?: number;
  isLocked?: boolean;
  followersOnly?: boolean;
  donationsEnabled?: boolean;
  speakingMode?: 'free_for_all' | 'permission_only' | 'selected_only';
  roomType?: string;
  // ★ Host avatarı ve oda kuralları
  hostAvatarUrl?: string;
  hostTier?: string;
  /** ★ v107: host'un aktif mağaza çerçevesi — avatar etrafında render edilir */
  hostFrameId?: string | null;
  /** ★ v283 (16 May 2026): host'un aktif rozeti — mini avatar köşesinde */
  hostActiveBadgeId?: string | null;
  roomRules?: string;
  followerCount?: number;
  // ★ 2026-04-20: Bildirim zili — oda içinden NotificationDrawer açma
  onBellPress?: () => void;
  notifBadgeCount?: number;
  /** Zil drawer'ı açık mı — açıkken ikon teal renklenir */
  isBellActive?: boolean;
  /** ★ 2026-04-24: Viewer pill tıklandığında dinleyiciler modalını aç */
  onViewersPress?: () => void;
  /** ★ v1.7.13.140 (21 May 2026): Sistem odası (Soprano Lobi) ise host avatarı
   *  çerçevesiz Soprano logosu olarak render edilir (StatusAvatar yerine plain Image). */
  isSystemRoom?: boolean;
}

// Kalp atışı (Heartbeat) göstergesi
function ConnectionHeartbeat({ state, viewerCount, onPress }: { state: string, viewerCount: number, onPress?: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // ★ 2026-04-20: Mount sırasında 'disconnected' ise bile ilk 2sn yeşil varsay —
  // minimize-restore veya kısa bağlantı geçişlerinde kırmızı flash'ı önle.
  const [displayState, setDisplayState] = React.useState(
    state === 'reconnecting' ? 'reconnecting' : 'connected',
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    if (state === 'connected') {
      // Bağlantı geldi — anında yeşile dön
      if (timerRef.current) clearTimeout(timerRef.current);
      setDisplayState('connected');
    } else {
      // ★ Mount sonrası 2sn grace — kısa geçişler UI'da flash yaratmasın.
      const since = Date.now() - mountedAtRef.current;
      const delay = since < 2000 ? 2000 - since + 3000 : 5000;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDisplayState(state), delay);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  // ★ 2026-04-19: Pulse sadece reconnecting/disconnected durumlarda.
  // Connected iken sabit yeşil — sürekli nabız atması görsel gürültüydü.
  useEffect(() => {
    if (displayState === 'connected') {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [displayState]);

  const isOk = displayState === 'connected';
  // ★ v1.7.13.10 (19 May 2026): KOK BUG FIX — ConnectionHeartbeat artık tamamen
  //   bağlantı durumuna bağlı, admin liveDotColor override KALDIRILDI.
  //
  //   ESKİ HATA (v319.12):
  //     Admin liveDotColor field'i bu noktaya yanlislikla baglanmis. Admin DB'de
  //     '#EF4444' set ettiyse — bağlantı OK iken bile kirmizi gösteriyordu. Bu,
  //     "LiveKit bağli mi" sinyalini admin renk seçimine kurban ediyordu.
  //
  //   DOGRU MANTIK:
  //     ConnectionHeartbeat = LiveKit bağlantı durumu — semantic sabit:
  //       connected → yesil (#22C55E)
  //       reconnecting → sari (#FBBF24)
  //       disconnected → kirmizi (#EF4444)
  //     Admin'in liveDotColor field'i farkli bir indicator (canli yayin badge)
  //     için ayrilmis olmali — ConnectionHeartbeat'te override yetkisi YOK.
  //
  //   Kullanici raporu: "modal acan simgede kirmizi nokta — odanin livekit
  //   baglantisinin isaretiydi diye hatirliyorum". Dogru.
  const dotColor = isOk ? '#22C55E'
    : displayState === 'reconnecting' ? '#FBBF24'
    : '#EF4444';
  const pulseScale = pulseAnim; // baglantı state'i pulse her zaman bağlı (admin opt-out yok)

  const content = (
    <>
      <Animated.View style={[s.liveDot, { backgroundColor: dotColor, transform: [{ scale: pulseScale }] }]} />
      <Ionicons name="people" size={12} color="#14B8A6" style={s.iconShadow} />
      <Text style={s.viewerText}>{viewerCount}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable style={s.viewerPill} onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={i18n.t('auto.room.RoomInfoHeader.005')}>
        {content}
      </Pressable>
    );
  }
  return <View style={s.viewerPill}>{content}</View>;
}

export default function RoomInfoHeader({
  roomName, roomDescription, isPremium, viewerCount,
  connectionState, connectionQuality, roomDuration, roomExpiry,
  isFollowing, onBack, onMinimize, onToggleFollow,
  roomLanguage, ageRestricted, entryFeeSp, isLocked, followersOnly,
  donationsEnabled, speakingMode, roomType,
  hostAvatarUrl, hostTier, hostFrameId, hostActiveBadgeId, roomRules, followerCount,
  onBellPress, notifBadgeCount, isBellActive,
  onViewersPress, isSystemRoom,
}: Props) {
  const langFlags: Record<string, string> = { tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', ar: '🇸🇦' };
  const [showRules, setShowRules] = useState(false);
  // ★ v300 (17 May 2026): Header altındaki badge satırı KALDIRILDI — avatar sağ üst
  //   köşesindeki küçük altın daire (badge sayısı) ile yer açıldı. Tıklayınca popup
  //   açılır, tüm durumlar listelenir. Header artık tek satır, sabit yükseklik.
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const insets = useSafeAreaInsets();
  // ★ v1.7.13.170: Header SABİT konum — StatusBar hidden olduğu için insets.top=0 döner.
  //   Sabit 38px Android'de doğru konumu sağlar.
  const FIXED_TOP = Platform.OS === 'android' ? 38 : insets.top + 8;
  // ★ v284 (16 May 2026): Web admin "Oda Düzeni" → header config (title font/color,
  //   live indicator, listener count, border).
  const headerCfg = useRoomLayout().header;
  // ★ v1.7.13.170: Ana sayfa ile birebir aynı — paddingTop: insets.top
  //   (home.tsx satır 1392 ile eşleşir).

  // ★ 2026-04-26: Header kompakt — yazılar kaldırıldı, sadece ikonlar (header kalabalıklığı çözüldü).
  //   Sadece KRİTİK olanlar (yaş, ücret, dil) yazıyla görünür; oda tipi + konuşma modu sadece ikon olarak.
  //   Default mod (free_for_all) icon dahi göstermez — gereksiz görsel yük.
  // ★ 2026-04-27: Badge'ler bilgilendirici — tıklanınca toast ile detay açıklar.
  const badges: { icon?: string; text?: string; emoji?: string; color: string; bg: string; border: string; info?: { title: string; message: string } }[] = [];
  if (ageRestricted) badges.push({ text: '+18', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', info: { title: i18n.t('room.roominfoheader.001'), message: i18n.t('room.roominfoheader.002') } });
  if (roomType === 'closed') badges.push({ icon: 'lock-closed', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', info: { title: i18n.t('room.roominfoheader.003'), message: i18n.t('room.roominfoheader.004') } });
  if (roomType === 'invite') badges.push({ icon: 'mail', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', info: { title: '📨 Davetli Oda', message: i18n.t('room.roominfoheader.005') } });
  if (isLocked) badges.push({ icon: 'lock-closed', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', info: { title: '🔒 Oda Kilitli', message: i18n.t('room.roominfoheader.006') } });
  if ((entryFeeSp ?? 0) > 0) badges.push({ text: `${entryFeeSp} SP`, color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.25)', info: { title: i18n.t('auto.room.RoomInfoHeader.004', { 0: entryFeeSp ?? 0 }), message: i18n.t('auto.room.RoomInfoHeader.003', { 0: entryFeeSp ?? 0 }) } });
  if (followersOnly) badges.push({ icon: 'people', color: '#A78BFA', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', info: { title: i18n.t('room.roominfoheader.007'), message: i18n.t('room.roominfoheader.008') } });
  if (roomLanguage && roomLanguage !== 'tr') {
    const _langLabels: Record<string, string> = { en: 'English', de: 'Deutsch', ar: 'العربية', fr: i18n.t('auto.room.RoomInfoHeader.002'), es: 'Español', it: 'Italiano', ru: 'Русский', pt: 'Português', ja: '日本語' };
    const _label = _langLabels[roomLanguage] || roomLanguage.toUpperCase();
    badges.push({ emoji: langFlags[roomLanguage] || roomLanguage, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', info: { title: `${langFlags[roomLanguage] || ''} ${_label}`, message: i18n.t('auto.room.RoomInfoHeader.001', { 0: _label }) } });
  }
  // Konuşma modu — sadece varsayılandan farklıysa göster + popup'ta açıklama.
  if (speakingMode === 'permission_only') badges.push({
    icon: 'hand-left',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    info: { title: i18n.t('room.permission_required'), message: i18n.t('room.permission_desc') },
  });
  if (speakingMode === 'selected_only') badges.push({
    icon: 'shield-checkmark',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.3)',
    info: { title: i18n.t('room.selected_speakers'), message: i18n.t('room.selected_speakers_desc') },
  });

  return (
    <View style={[s.wrap, {
      paddingTop: insets.top,
    }]}>
      {/* ★ v283 (16 May 2026): home/odalarım/profil tab page'lerinin orijinal
          bombe gradient'ı — slate dikey lineer (locations 0/0.55/1).
          Mesajlar mor halolu varyantını YANLIŞLIKLA baz almıştım; geri alındı. */}
      <LinearGradient
        colors={['rgba(48,65,94,0.92)', 'rgba(26,40,64,0.82)', 'rgba(12,22,40,0.6)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { opacity: headerCfg.headerBgOpacity > 0 ? headerCfg.headerBgOpacity : 1 }]}
        pointerEvents="none"
      />
      {/* ★ v284: headerBorderBottom toggle — web admin'den kapatılabilir */}
      {headerCfg.headerBorderBottom && (
        <LinearGradient
          colors={['transparent', headerCfg.headerBorderColor, headerCfg.headerBorderColor, 'transparent']}
          locations={[0, 0.25, 0.75, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5 }}
          pointerEvents="none"
        />
      )}
      {/* Satır 1 — Avatar + Süre + Oda İsmi + Aksiyonlar */}
      <View style={s.topNav}>
        <View style={s.topLeft}>
          {/* ★ Host avatar + süre göstergesi grubu */}
          {/* ★ v300: badges.length > 0 ise group Pressable — sağ üstteki altın daireye
              tıklayınca durum popup'ı açılır. StatusAvatar kendi onPress'i yok.
              showHostAvatar=false web admin'den gizlenebilir; size/borderWidth/borderColor
              de oradan ayarlanır. */}
          {headerCfg.showHostAvatar !== false ? (
            badges.length > 0 ? (
              <Pressable
                style={s.hostAvatarGroup}
                onPress={() => setShowStatusPopup((v) => !v)}
                hitSlop={6}
                accessibilityLabel={`Oda durumları (${badges.length})`}
              >
                {isSystemRoom ? (
                  // ★ v1.7.13.140: Sistem odası (Soprano Lobi) — büyük çerçevesiz logo (110px).
                  //   Container 40x40 layout slot (header 56px'i bozmasın), Image absolute
                  //   ortalanarak parent bound'ından taşar (overflow:visible chain).
                  //   Center'a göre offset: x = -(110-40)/2 = -35, y aynı.
                  <View style={{ width: 40, height: 40, overflow: 'visible' }}>
                    <Image
                      source={require('../../assets/app_icon.png')}
                      style={{
                        position: 'absolute',
                        width: 85, height: 85,
                        top: -22,
                        left: -22,
                      }}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <StatusAvatar
                    uri={hostAvatarUrl}
                    size={headerCfg.hostAvatarSize ?? 36}
                    tier={hostTier}
                    borderWidth={headerCfg.hostAvatarBorderWidth ?? 1.5}
                    borderColor={headerCfg.hostAvatarBorderColor}
                    frameId={hostFrameId}
                    customBadgeId={hostActiveBadgeId ?? null}
                  />
                )}
                {/* ★ v300: Sağ üst köşede durum sayısı — altın daire, tıklanabilir */}
                <View style={s.statusCountBadge}>
                  <Text style={s.statusCountText}>{badges.length}</Text>
                </View>
                {roomExpiry ? (
                  <View style={[s.expiryBadge, roomExpiry.includes('doldu') && s.expiryBadgeExpired]}>
                    <Ionicons
                      name={roomExpiry.includes('doldu') ? 'alarm' : 'hourglass-outline'}
                      size={7}
                      color={roomExpiry.includes('doldu') ? '#EF4444' : '#FBBF24'}
                    />
                  </View>
                ) : null}
              </Pressable>
            ) : (
              <View style={s.hostAvatarGroup}>
                {isSystemRoom ? (
                  // ★ v1.7.13.140: Sistem odası (Soprano Lobi) — çerçevesiz büyük logo (110px).
                  //   Bu branch badges.length===0 senaryosu (Lobi default). Layout slot 40x40,
                  //   Image absolute ortalanarak parent bound dışına taşar.
                  <View style={{ width: 40, height: 40, overflow: 'visible' }}>
                    <Image
                      source={require('../../assets/app_icon.png')}
                      style={{
                        position: 'absolute',
                        width: 85, height: 85,
                        top: -22,
                        left: -22,
                      }}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <StatusAvatar
                    uri={hostAvatarUrl}
                    size={headerCfg.hostAvatarSize ?? 36}
                    tier={hostTier}
                    borderWidth={headerCfg.hostAvatarBorderWidth ?? 1.5}
                    borderColor={headerCfg.hostAvatarBorderColor}
                    frameId={hostFrameId}
                    customBadgeId={hostActiveBadgeId ?? null}
                  />
                )}
                {roomExpiry ? (
                  <View style={[s.expiryBadge, roomExpiry.includes('doldu') && s.expiryBadgeExpired]}>
                    <Ionicons
                      name={roomExpiry.includes('doldu') ? 'alarm' : 'hourglass-outline'}
                      size={7}
                      color={roomExpiry.includes('doldu') ? '#EF4444' : '#FBBF24'}
                    />
                  </View>
                ) : null}
              </View>
            )
          ) : null}
          {/* ★ Oda ismi + geçen süre tek satırda */}
          <View style={s.nameTimeCol}>
            <Text
              style={[
                s.roomName,
                // ★ v284: Web admin oda düzeni — title font ayarları
                {
                  fontSize: headerCfg.titleFontSize,
                  fontWeight: headerCfg.titleFontWeight as any,
                  color: headerCfg.titleColor,
                },
              ]}
              numberOfLines={1}
            >
              {roomName}
            </Text>
            {roomDuration ? (
              <View style={s.durationInline}>
                {/* ★ v283: CANLI/LIVE pill kaldırıldı — eski v278 yapısı korunsun
                    (kullanıcı tercihi: minimal header, sadece time + duration). */}
                <Ionicons name="time-outline" size={8} color="rgba(20,184,166,0.6)" />
                {/* ★ v319.12 (18 May 2026): Admin subtitle config (font size + color). */}
                <Text style={[s.durationText, {
                  ...(headerCfg.subtitleFontSize ? { fontSize: headerCfg.subtitleFontSize } : null),
                  ...(headerCfg.subtitleColor ? { color: headerCfg.subtitleColor } : null),
                }]}>{roomDuration}</Text>
                {roomExpiry ? (
                  <>
                    <Text style={s.durationSep}>·</Text>
                    <Ionicons name="hourglass-outline" size={7} color={roomExpiry.includes('doldu') ? '#EF4444' : 'rgba(251,191,36,0.7)'} />
                    <Text style={[s.durationText, { color: roomExpiry.includes('doldu') ? '#EF4444' : 'rgba(251,191,36,0.7)' }]}>{roomExpiry}</Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.topActions}>
          {/* ★ Kullanıcı sayısı + heartbeat header'dan kaldırıldı — sahne altı bilgi çubuğuna taşındı */}
          {/* ★ 2026-04-25: Bağlantı kalitesi (LiveKit) — sadece bağlıyken göster */}
          {connectionState === 'connected' && (
            <ConnectionQualityIndicator quality={connectionQuality || 'unknown'} size={12} />
          )}
          {/* ★ 2026-04-19: Kurallar VEYA açıklama varsa info butonu göster */}
          {(roomRules || roomDescription) ? (
            <Pressable style={s.actionBtn} onPress={() => setShowRules(!showRules)} hitSlop={6}>
              <Ionicons
                name={roomRules ? 'document-text-outline' : 'information-circle-outline'}
                size={16}
                color={showRules ? '#F59E0B' : '#E2E8F0'}
                style={s.iconShadow}
              />
            </Pressable>
          ) : null}
          {onToggleFollow && (
            <Pressable style={s.actionBtn} onPress={onToggleFollow} hitSlop={6}>
              <Ionicons name={isFollowing ? 'bookmark' : 'bookmark-outline'} size={16} color={isFollowing ? '#14B8A6' : '#E2E8F0'} style={s.iconShadow} />
            </Pressable>
          )}
          {/* ★ 2026-04-20: Bildirim zili — oda içindeyken de arkadaşlık / hediye / davet bildirimleri açılabilsin */}
          {onBellPress && (
            <Pressable style={[s.actionBtn, isBellActive && s.bellActive]} onPress={onBellPress} hitSlop={6}>
              <Ionicons
                name={isBellActive || (notifBadgeCount && notifBadgeCount > 0) ? 'notifications' : 'notifications-outline'}
                size={16}
                color={isBellActive ? '#14B8A6' : (notifBadgeCount && notifBadgeCount > 0 ? '#FBBF24' : '#E2E8F0')}
                style={s.iconShadow}
              />
              {!!notifBadgeCount && notifBadgeCount > 0 && !isBellActive && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeText}>{notifBadgeCount > 9 ? '9+' : notifBadgeCount}</Text>
                </View>
              )}
            </Pressable>
          )}
          {/* ★ 2026-04-24: X (kapatma) kaldırıldı, minimize butonu yerine alındı ve büyütüldü */}
          <Pressable style={s.actionBtnLarge} onPress={onMinimize} hitSlop={8}>
            <Ionicons name="chevron-down-outline" size={24} color="#E2E8F0" style={s.iconShadow} />
          </Pressable>
        </View>
      </View>

      {/* ★ v300 (17 May 2026): Satır 2 (badge scroll) KALDIRILDI — avatar köşesindeki
          altın daireye taşındı. Popup açılınca tüm durumlar listelenir.
          NotificationDrawer aile dili: slate diagonal + amber halo + soft glow. */}
      {showStatusPopup && badges.length > 0 ? (
        <Pressable onPress={() => setShowStatusPopup(false)}>
          <View style={s.statusPopup}>
            {/* 3-katman gradient — modal/sheet aile dili */}
            <LinearGradient
              colors={['#3a4658', '#2a3344', '#1a2030']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.statusPopupGlow}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.04)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
              style={s.statusPopupGlow}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(245,158,11,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.6 }}
              style={s.statusPopupGlow}
              pointerEvents="none"
            />
            {/* Sol üstten avatar köşesine işaret eden ok */}
            <View style={s.statusPopupArrow} />
            {/* Section header — premium amber stripe */}
            <View style={s.statusPopupHeader}>
              <Ionicons name="information-circle" size={12} color="#F59E0B" style={s.iconShadow} />
              <Text style={s.statusPopupHeaderText}>ODA DURUMU</Text>
              <View style={s.statusPopupHeaderBadge}>
                <Text style={s.statusPopupHeaderBadgeText}>{badges.length}</Text>
              </View>
            </View>
            {badges.map((b, i) => (
              <View key={i} style={s.statusPopupRow}>
                <View style={[s.statusPopupIcon, { backgroundColor: b.bg, borderColor: b.border }]}>
                  {b.emoji ? <Text style={{ fontSize: 13 }}>{b.emoji}</Text> : null}
                  {b.icon ? <Ionicons name={b.icon as any} size={13} color={b.color} /> : null}
                  {b.text && !b.emoji && !b.icon ? <Text style={{ fontSize: 9, fontWeight: '800', color: b.color }}>{b.text}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.statusPopupTitle} numberOfLines={1}>
                    {/* ★ v300: Sol yuvarlak ikon zaten var — title baş emoji'sini strip et (çift gösterim olmasın) */}
                    {(b.info?.title || b.text || '').replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}☀-➿]\s*/u, '')}
                  </Text>
                  {b.info?.message ? (
                    <Text style={s.statusPopupMessage} numberOfLines={2}>{b.info.message}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </Pressable>
      ) : null}

      {/* ★ Oda bilgi balonu — açıklama + kurallar birlikte, tıklayarak kapanır */}
      {showRules && (roomRules || roomDescription) ? (
        <Pressable onPress={() => setShowRules(false)}>
          <View style={s.rulesTooltip}>
            <View style={s.rulesTooltipArrow} />
            {roomDescription ? (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Ionicons name="information-circle" size={12} color="#60A5FA" style={{ marginTop: 1 }} />
                <Text style={s.rulesTooltipText} numberOfLines={3}>{roomDescription}</Text>
              </View>
            ) : null}
            {roomDescription && roomRules ? <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 6 }} /> : null}
            {roomRules ? (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <Ionicons name="document-text" size={12} color="#F59E0B" style={{ marginTop: 1 }} />
                <Text style={s.rulesTooltipText} numberOfLines={4}>{roomRules}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

// ★ 2026-05-05: Üst header bar yüksekliği — alt RoomControlBar BAR_H=50 ile eşit.
//   Kullanıcı talebi: "oda içindeki üst headar boyutlarını alt kontrol barındaki
//   headar ile eşitle" — top/bottom bar simetrisi sağlanır.
// ★ v1.7.13.16 (19 May 2026): Header height ana sayfa/odalarım/mesajlar tab
//   header'larıyla AYNI default ölçü (56dp). Kullanıcı: "alt ve üst headerları
//   keşfet/odalarım/mesajlar header ailesi ölçülerine getir".
const HEADER_BAR_H = 56;

const s = StyleSheet.create({
  wrap: {
    // ★ v283 (16 May 2026): paddingHorizontal kaldırıldı — gradient absoluteFillObject
    //   full width yayılsın (home.tsx pattern'i). İçerik kendi paddingHorizontal'ını
    //   topNav style'ında taşır.
    // ★ v31+: paddingBottom 6→2 (header ile sahne arasi minimal bosluk)
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: HEADER_BAR_H,
    overflow: 'visible', // ★ v1.7.13.140: Lobi logosu header'dan taşabilsin
    paddingHorizontal: 16, // ★ v283: wrap'tan taşındı, gradient full width olsun diye
  },
  topLeft: {
    flex: 1,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'visible', // ★ v1.7.13.140: Lobi logosu header'dan taşabilsin
  },
  hostAvatarGroup: {
    position: 'relative',
    overflow: 'visible',
  },
  expiryBadge: {
    position: 'absolute', bottom: -3, right: -3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  expiryBadgeExpired: {
    backgroundColor: 'rgba(239,68,68,0.25)',
  },
  // ★ v300 (17 May 2026): Avatar sağ üst — durum sayısı (kilit/+18/dil vs.).
  //   Tıklayınca popup açılır, tüm durumlar listelenir. Header tek satır kalır.
  statusCountBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5, borderColor: 'rgba(15,23,42,0.95)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  statusCountText: {
    fontSize: 9, fontWeight: '900', color: '#0F172A', letterSpacing: -0.2,
  },
  // ★ v300: Durum popup — NotificationDrawer aile dili (slate diagonal + amber halo + soft glow).
  statusPopup: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.32)',
    paddingHorizontal: 10, paddingVertical: 8,
    overflow: 'hidden',
    backgroundColor: '#1a2030',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
    position: 'relative',
  },
  statusPopupGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14,
  },
  // Sol üst köşede avatar altın daireye işaret eden ok.
  // Avatar ekran konumu: topNav padding 16 + avatar size 36/2 = 34. Popup margin 16.
  // Arrow popup içinde left: 34-16 = 18, ortalamak için -6 (arrow width/2) = 12.
  statusPopupArrow: {
    position: 'absolute',
    top: -6,
    left: 12,
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: 'rgba(245,158,11,0.55)',
    zIndex: 2,
  },
  statusPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.18)',
  },
  statusPopupHeaderText: {
    flex: 1,
    fontSize: 10, fontWeight: '800', color: '#F59E0B',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusPopupHeaderBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  statusPopupHeaderBadgeText: {
    fontSize: 10, fontWeight: '900', color: '#FBBF24', letterSpacing: -0.2,
  },
  statusPopupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  statusPopupIcon: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  statusPopupTitle: {
    fontSize: 12, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusPopupMessage: {
    fontSize: 10, color: 'rgba(203,213,225,0.78)', lineHeight: 13, marginTop: 2,
  },
  nameTimeCol: {
    flex: 1,
    justifyContent: 'center',
  },
  durationInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  durationText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(20,184,166,0.6)',
  },
  durationSep: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.15)',
    marginHorizontal: 1,
  },
  hostMiniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(20,184,166,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  roomName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.3,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  premBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(218,165,32,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(218,165,32,0.3)',
  },
  premText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFDF00',
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20,184,166,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.2)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  viewerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#14B8A6',
  },
  actionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLarge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 0, right: 0,
    minWidth: 14, height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#0A0F1E',
  },
  bellBadgeText: {
    fontSize: 8, fontWeight: '900', color: '#FFF', letterSpacing: -0.3,
  },
  bellActive: {},
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  followBtnActive: {},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  infoBlock: {
    marginTop: 2,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  infoText: {
    fontSize: 11,
    color: 'rgba(248, 250, 252, 0.6)',
  },
  // ★ Kurallar tooltip balonu
  rulesTooltip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 0.8,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  rulesTooltipArrow: {
    position: 'absolute',
    top: -5,
    right: 50,
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: 'rgba(245,158,11,0.2)',
  },
  rulesTooltipText: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(248,250,252,0.6)',
    lineHeight: 14,
  },
});
