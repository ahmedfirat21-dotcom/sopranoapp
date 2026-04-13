/**
 * SopranoChat — Premium Profile Card (Oda İçi)
 * Glassmorphism + Slide-up + 3 bölümlü kompakt tasarım
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, Dimensions, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';

const { height: H } = Dimensions.get('window');

const C = {
  glass: 'rgba(45,55,64,0.95)',
  border: 'rgba(255,255,255,0.06)',
  primary: '#5CE1E6',
  gold: '#D4AF37',
  white: '#F1F5F9',
  white60: 'rgba(255,255,255,0.6)',
  white30: 'rgba(255,255,255,0.3)',
  white08: 'rgba(255,255,255,0.08)',
  white04: 'rgba(255,255,255,0.04)',
  green: '#22C55E',
  red: '#EF4444',
  redSoft: 'rgba(239,68,68,0.08)',
  redBorder: 'rgba(239,68,68,0.15)',
  orange: '#F97316',
  purple: '#8B5CF6',
  emerald: '#10B981',
  amber: '#F59E0B',
};

// Rol konfigürasyonu
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  owner: { label: 'Oda Sahibi', color: C.gold, bg: 'rgba(212,175,55,0.12)' },
  host: { label: 'Oda Sahibi', color: C.gold, bg: 'rgba(212,175,55,0.12)' },
  moderator: { label: 'Moderatör', color: C.purple, bg: 'rgba(139,92,246,0.12)' },
  speaker: { label: 'Konuşmacı', color: C.primary, bg: 'rgba(92,225,230,0.1)' },
  listener: { label: 'Dinleyici', color: C.white30, bg: C.white04 },
  spectator: { label: 'Seyirci', color: 'rgba(255,255,255,0.2)', bg: 'rgba(255,255,255,0.02)' },
};

type ProfileCardProps = {
  nick: string;
  role: string;
  avatarUrl?: string;
  isOwnProfile?: boolean;
  isChatMuted?: boolean;
  isMuted?: boolean;
  mutedUntil?: string | null;
  onClose: () => void;
  onMute?: () => void;
  onUnmute?: () => void;
  onKick?: () => void;
  onRemoveFromStage?: () => void;
  onPromoteToStage?: () => void;
  onChatMute?: () => void;
  onMakeModerator?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  onViewProfile?: () => void;
  onFollow?: () => void;
  onDM?: () => void;
  // Owner süper güçleri
  onGhostMode?: () => void;
  isGhost?: boolean;
  onDisguise?: () => void;
  onBanTemp?: () => void;
  onBanPerm?: () => void;
  // Kişisel susturma (lokal)
  onPersonalMute?: () => void;
  isPersonallyMuted?: boolean;
  // Bağış (Tip)
  onTip?: () => void;
  donationsEnabled?: boolean;
  // ★ M5 FIX: Takip durumu
  isFollowing?: boolean;
  isPending?: boolean;
  // ★ M6 FIX: Kendi profil — sahneden in
  onSelfDemote?: () => void;
};

export default function ProfileCard({
  nick, role, avatarUrl, isOwnProfile, isChatMuted, isMuted, mutedUntil,
  onClose, onMute, onUnmute, onKick, onRemoveFromStage, onPromoteToStage,
  onChatMute, onMakeModerator, onReport, onBlock,
  onViewProfile, onFollow, onDM,
  onGhostMode, isGhost, onDisguise, onBanTemp, onBanPerm,
  onPersonalMute, isPersonallyMuted,
  onTip, donationsEnabled,
  isFollowing, isPending, onSelfDemote,
}: ProfileCardProps) {
  // Slide-up animasyonu
  const slideY = useRef(new Animated.Value(H * 0.3)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: H * 0.3, duration: 180, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  // Mute süresi
  const getMuteTimeLeft = () => {
    if (!mutedUntil) return 'Süresiz';
    const diff = new Date(mutedUntil).getTime() - Date.now();
    if (diff <= 0) return null;
    const mins = Math.ceil(diff / 60000);
    return mins > 60 ? `${Math.floor(mins / 60)}sa ${mins % 60}dk` : `${mins}dk`;
  };

  const rc = ROLE_CONFIG[role] || ROLE_CONFIG.listener;
  const hasModActions = onMute || onUnmute || onChatMute || onKick;
  const hasStageActions = onPromoteToStage || onRemoveFromStage;

  return (
    <View style={sty.root}>
      {/* Overlay */}
      <Animated.View style={[sty.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Card */}
      <Animated.View style={[sty.card, { transform: [{ translateY: slideY }] }]}>
        {/* ──── Handle bar ──── */}
        <View style={sty.handle} />

        {/* ════════════════════════════════════════════
            BÖLÜM 1: Profil Başlığı
           ════════════════════════════════════════════ */}
        <View style={sty.headerRow}>
          {/* Avatar */}
          <View style={[sty.avatar, { borderColor: rc.color }]}>
            {avatarUrl ? (
              <Image source={getAvatarSource(avatarUrl)} style={sty.avatarImg} />
            ) : (
              <Text style={sty.initials}>{nick.slice(0, 2).toUpperCase()}</Text>
            )}
            {/* Online dot */}
            <View style={sty.onlineDot} />
          </View>

          {/* İsim + Rol badge + Durum etiketleri */}
          <View style={sty.headerInfo}>
            <Text style={sty.nick} numberOfLines={1}>{nick}</Text>
            <View style={sty.badgeRow}>
              {/* Rol badge */}
              <View style={[sty.roleBadge, { backgroundColor: rc.bg }]}>
                <Text style={[sty.roleText, { color: rc.color }]}>{rc.label}</Text>
              </View>
              {/* Muted badge */}
              {isMuted && (
                <View style={[sty.statusBadge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                  <Ionicons name="volume-mute" size={9} color={C.red} />
                  <Text style={[sty.statusText, { color: C.red }]}>{getMuteTimeLeft() || 'Bitti'}</Text>
                </View>
              )}
              {/* Chat muted badge */}
              {isChatMuted && (
                <View style={[sty.statusBadge, { backgroundColor: 'rgba(249,115,22,0.1)' }]}>
                  <Ionicons name="chatbox-outline" size={9} color={C.orange} />
                  <Text style={[sty.statusText, { color: C.orange }]}>Yazı Kapalı</Text>
                </View>
              )}
            </View>
          </View>

          {/* Kapat */}
          <TouchableOpacity onPress={handleClose} style={sty.closeBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Ionicons name="close" size={16} color={C.white30} />
          </TouchableOpacity>
        </View>

        {/* ════════════════════════════════════════════
            BÖLÜM 2: Sosyal Aksiyonlar — Takip / DM / Profil
           ════════════════════════════════════════════ */}
        {isOwnProfile ? (
          <View style={sty.socialRow}>
            <TouchableOpacity style={sty.primaryPill} onPress={onViewProfile} activeOpacity={0.7}>
              <Ionicons name="person-circle-outline" size={16} color={C.primary} />
              <Text style={[sty.pillText, { color: C.primary }]}>Profili Görüntüle</Text>
            </TouchableOpacity>
            {/* ★ M6 FIX: Kendi profil — sahneden in (sahnedeyse) */}
            {onSelfDemote && (role === 'speaker' || role === 'moderator') && (
              <TouchableOpacity style={[sty.outlinePill, { borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.06)' }]} onPress={() => { handleClose(); setTimeout(() => onSelfDemote(), 200); }} activeOpacity={0.7}>
                <Ionicons name="arrow-down-circle-outline" size={13} color={C.red} />
                <Text style={[sty.pillText, { color: C.red }]}>Sahneden İn</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
          <View style={sty.socialRow}>
            {/* ★ M5 FIX: Takip durumuna göre buton metni değişir */}
            <TouchableOpacity style={[sty.primaryPill, (isFollowing || isPending) && { backgroundColor: 'rgba(20,184,166,0.1)', borderColor: 'rgba(20,184,166,0.25)' }]} onPress={onFollow} activeOpacity={0.7}>
              <Ionicons name={isFollowing ? 'checkmark-circle' : isPending ? 'time-outline' : 'person-add'} size={13} color={isFollowing ? '#14B8A6' : isPending ? '#FBBF24' : C.primary} />
              <Text style={[sty.pillText, { color: isFollowing ? '#14B8A6' : isPending ? '#FBBF24' : C.primary }]}>{isFollowing ? 'Takip Ediliyor' : isPending ? 'Bekliyor' : 'Takip Et'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sty.outlinePill} onPress={onDM} activeOpacity={0.7}>
              <Ionicons name="chatbubble-ellipses" size={13} color={C.white60} />
              <Text style={[sty.pillText, { color: C.white60 }]}>DM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sty.outlinePill} onPress={onViewProfile} activeOpacity={0.7}>
              <Ionicons name="person-circle-outline" size={13} color={C.white60} />
              <Text style={[sty.pillText, { color: C.white60 }]}>Profil</Text>
            </TouchableOpacity>
          </View>
          {/* ★ Bağış (Tip) butonu — donations aktifse ve kendi profili değilse */}
          {donationsEnabled && onTip && (
            <TouchableOpacity style={sty.tipPill} onPress={onTip} activeOpacity={0.7}>
              <Ionicons name="heart" size={14} color="#EF4444" />
              <Text style={[sty.pillText, { color: '#EF4444' }]}>SP Bağış Yap</Text>
            </TouchableOpacity>
          )}
          {/* Kişisel Susturma (Lokal) */}
          {onPersonalMute && (
            <TouchableOpacity
              style={[sty.personalMutePill, isPersonallyMuted && { borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.06)' }]}
              onPress={onPersonalMute}
              activeOpacity={0.7}
            >
              <Ionicons name={isPersonallyMuted ? 'volume-high' : 'volume-mute'} size={13} color={isPersonallyMuted ? C.emerald : '#F97316'} />
              <Text style={[sty.pillText, { color: isPersonallyMuted ? C.emerald : '#F97316' }]}>
                {isPersonallyMuted ? 'Sesi Aç' : 'Benim İçin Sustur'}
              </Text>
            </TouchableOpacity>
          )}
          </>
        )}

        {/* ════════════════════════════════════════════
            BÖLÜM 3: Sahne + Moderasyon (sadece yetkili görür)
           ════════════════════════════════════════════ */}
        {!isOwnProfile && (hasStageActions || hasModActions || onMakeModerator) && (
          <>
            <View style={sty.divider} />

            {/* Sahne kontrolleri */}
            {hasStageActions && (
              <View style={sty.actionRow}>
                {onPromoteToStage && (
                  <TouchableOpacity style={[sty.actionPill, { borderColor: 'rgba(16,185,129,0.2)' }]} onPress={onPromoteToStage} activeOpacity={0.7}>
                    <Ionicons name="arrow-up-circle" size={14} color={C.emerald} />
                    <Text style={[sty.actionText, { color: C.emerald }]}>Sahneye Davet Et</Text>
                  </TouchableOpacity>
                )}
                {onRemoveFromStage && (
                  <TouchableOpacity style={[sty.actionPill, { borderColor: 'rgba(251,191,36,0.2)' }]} onPress={onRemoveFromStage} activeOpacity={0.7}>
                    <Ionicons name="arrow-down-circle" size={14} color={C.amber} />
                    <Text style={[sty.actionText, { color: C.amber }]}>İndir</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Moderasyon kontrolleri */}
            {hasModActions && (
              <View style={sty.actionRow}>
                {isMuted && onUnmute ? (
                  <TouchableOpacity style={[sty.actionPill, { borderColor: 'rgba(16,185,129,0.2)' }]} onPress={onUnmute} activeOpacity={0.7}>
                    <Ionicons name="volume-high" size={14} color={C.emerald} />
                    <Text style={[sty.actionText, { color: C.emerald }]}>Aç</Text>
                  </TouchableOpacity>
                ) : onMute ? (
                  <TouchableOpacity style={[sty.actionPill, { borderColor: 'rgba(245,158,11,0.2)' }]} onPress={onMute} activeOpacity={0.7}>
                    <Ionicons name="volume-mute" size={14} color={C.amber} />
                    <Text style={[sty.actionText, { color: C.amber }]}>Sustur</Text>
                  </TouchableOpacity>
                ) : null}
                {onChatMute && (
                  <TouchableOpacity style={[sty.actionPill, { borderColor: isChatMuted ? 'rgba(16,185,129,0.2)' : 'rgba(249,115,22,0.15)' }]} onPress={onChatMute} activeOpacity={0.7}>
                    <Ionicons name={isChatMuted ? 'chatbox' : 'chatbox-outline'} size={14} color={isChatMuted ? C.emerald : C.orange} />
                    <Text style={[sty.actionText, { color: isChatMuted ? C.emerald : C.orange }]}>{isChatMuted ? 'Yazı Aç' : 'Yazı Kapat'}</Text>
                  </TouchableOpacity>
                )}
                {onKick && (
                  <TouchableOpacity style={[sty.actionPill, { borderColor: C.redBorder }]} onPress={onKick} activeOpacity={0.7}>
                    <Ionicons name="exit" size={14} color={C.red} />
                    <Text style={[sty.actionText, { color: C.red }]}>Çıkar</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Moderatör yap/kaldır */}
            {onMakeModerator && (
              <TouchableOpacity style={[sty.modPill, role === 'moderator' && { borderColor: 'rgba(139,92,246,0.25)' }]} onPress={onMakeModerator} activeOpacity={0.7}>
                <Ionicons name="shield" size={13} color={C.purple} />
                <Text style={[sty.actionText, { color: C.purple }]}>{role === 'moderator' ? 'Moderatörlüğü Kaldır' : 'Moderatör Yap'}</Text>
              </TouchableOpacity>
            )}

            {/* Owner Süper Güçleri */}
            {(onGhostMode || onDisguise || onBanTemp || onBanPerm) && (
              <>
                <View style={sty.divider} />
                <View style={sty.actionRow}>
                  {onGhostMode && (
                    <TouchableOpacity style={[sty.actionPill, { borderColor: 'rgba(168,85,247,0.2)' }]} onPress={onGhostMode} activeOpacity={0.7}>
                      <Ionicons name={isGhost ? 'eye' : 'eye-off'} size={14} color="#A855F7" />
                      <Text style={[sty.actionText, { color: '#A855F7' }]}>{isGhost ? 'Görünür Ol' : 'Görünmez Ol'}</Text>
                    </TouchableOpacity>
                  )}
                  {onDisguise && (
                    <TouchableOpacity style={[sty.actionPill, { borderColor: 'rgba(236,72,153,0.2)' }]} onPress={onDisguise} activeOpacity={0.7}>
                      <Ionicons name="person-circle" size={14} color="#EC4899" />
                      <Text style={[sty.actionText, { color: '#EC4899' }]}>Kılık Değiştir</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {(onBanTemp || onBanPerm) && (
                  <View style={sty.actionRow}>
                    {onBanTemp && (
                      <TouchableOpacity style={[sty.actionPill, { borderColor: C.redBorder }]} onPress={onBanTemp} activeOpacity={0.7}>
                        <Ionicons name="timer" size={14} color={C.red} />
                        <Text style={[sty.actionText, { color: C.red }]}>Geçici Ban</Text>
                      </TouchableOpacity>
                    )}
                    {onBanPerm && (
                      <TouchableOpacity style={[sty.actionPill, { borderColor: C.redBorder, backgroundColor: 'rgba(239,68,68,0.06)' }]} onPress={onBanPerm} activeOpacity={0.7}>
                        <Ionicons name="ban" size={14} color={C.red} />
                        <Text style={[sty.actionText, { color: C.red }]}>Kalıcı Ban</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════
            BÖLÜM 4: Şikayet & Engelle (herkes görür)
           ════════════════════════════════════════════ */}
        {!isOwnProfile && (onReport || onBlock) && (
          <>
            <View style={sty.divider} />
            <View style={sty.bottomRow}>
              {onReport && (
                <TouchableOpacity onPress={onReport} style={sty.textBtn} activeOpacity={0.6}>
                  <Ionicons name="flag-outline" size={12} color="#64748B" />
                  <Text style={sty.textBtnLabel}>Şikayet Et</Text>
                </TouchableOpacity>
              )}
              {onReport && onBlock && <View style={sty.dotSep} />}
              {onBlock && (
                <TouchableOpacity onPress={onBlock} style={sty.textBtn} activeOpacity={0.6}>
                  <Ionicons name="ban-outline" size={12} color="rgba(239,68,68,0.5)" />
                  <Text style={[sty.textBtnLabel, { color: 'rgba(239,68,68,0.5)' }]}>Engelle</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const sty = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    marginHorizontal: 10,
    marginBottom: 12,
    backgroundColor: C.glass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.white08,
    alignSelf: 'center',
    marginBottom: 14,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.white04,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  initials: { color: '#fff', fontSize: 16, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.green,
    borderWidth: 2,
    borderColor: 'rgba(45,55,64,0.95)',
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  nick: { color: C.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  statusText: { fontSize: 9, fontWeight: '700' },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.white04,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Social row
  socialRow: { flexDirection: 'row', gap: 8 },
  primaryPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 99,
    backgroundColor: 'rgba(92,225,230,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(92,225,230,0.18)',
  },
  outlinePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 99,
    backgroundColor: C.white04,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillText: { fontSize: 12, fontWeight: '600' },

  // Divider
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 12,
  },

  // Action rows
  actionRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 34,
    borderRadius: 99,
    backgroundColor: C.white04,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionText: { fontSize: 11, fontWeight: '600' },
  modPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 34,
    borderRadius: 99,
    backgroundColor: C.white04,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.12)',
    marginTop: 2,
  },

  // Bottom text buttons
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  textBtnLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  dotSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Kişisel susturma butonu
  personalMutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 34,
    borderRadius: 99,
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.15)',
    marginTop: 8,
  },
  // Bağış (Tip) butonu
  tipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 99,
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
    marginTop: 8,
  },
});
