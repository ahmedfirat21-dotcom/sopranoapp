import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isTierAtLeast } from '../../constants/tiers';

const { width: W, height: H } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════
// + MENÜSÜ — Premium Spring Animasyonlu Rol-Bazlı Panel
// ════════════════════════════════════════════════════════════

type MenuItem = {
  id: string;
  icon: string;
  label: string;
  desc?: string;
  accent: string;
  onPress: () => void;
  destructive?: boolean;
  badge?: number;
};

type PlusMenuProps = {
  visible: boolean;
  onClose: () => void;
  onInviteFriends: () => void;
  onShareLink: () => void;
  onRoomSettings?: () => void;
  onModeration?: () => void;
  onRoomLock?: () => void;
  onReportRoom?: () => void;
  isRoomLocked?: boolean;
  micRequestCount?: number;
  userRole?: 'owner' | 'moderator' | 'speaker' | 'listener';
  /** Oda sahibinin tier'ı — UI filtresi için */
  ownerTier?: string;
  // ★ VIP Host Paneli Props
  onMuteAll?: () => void;
  onRoomStats?: () => void;
  onDeleteRoom?: () => void;
  // ★ RM-4: Boost (Öne Çıkar)
  onBoostRoom?: () => void;
  // ★ RM-5: Oda takip (dinleyiciler için)
  onToggleFollow?: () => void;
  isFollowingRoom?: boolean;
};

const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  owner:     { label: 'Oda Sahibi',  color: '#D4AF37', icon: 'star' },
  moderator: { label: 'Moderatör',   color: '#A78BFA', icon: 'shield-checkmark' },
  speaker:   { label: 'Konuşmacı',   color: '#14B8A6', icon: 'mic' },
  listener:  { label: 'Dinleyici',    color: '#94A3B8', icon: 'headset' },
};

export function PlusMenu({
  visible, onClose,
  onInviteFriends, onShareLink, onRoomSettings,
  onModeration, onRoomLock, onReportRoom,
  isRoomLocked, micRequestCount,
  userRole = 'listener',
  ownerTier = 'Free',
  onMuteAll, onRoomStats, onDeleteRoom,
  onBoostRoom, onToggleFollow, isFollowingRoom,
}: PlusMenuProps) {
  // ═══ Animasyon ═══
  const slideAnim = useRef(new Animated.Value(200)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(200);
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220, mass: 0.8 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 200, mass: 0.6 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 200, useNativeDriver: true, damping: 22, stiffness: 280 }),
        Animated.spring(scaleAnim, { toValue: 0.85, useNativeDriver: true, damping: 22, stiffness: 280 }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const isOwner = userRole === 'owner';
  const isMod = userRole === 'moderator';
  const isOnStage = isOwner || isMod || userRole === 'speaker';
  const role = ROLE_META[userRole] || ROLE_META.listener;

  const isFreeOwner = isOwner && ownerTier === 'Free';

  // ★ ROL-BAZLI MENÜ ÖĞELERİ — TÜM TİER FILTRESİ ═══
  const items: MenuItem[] = [];

  // 1️⃣ Oda Ayarları (Owner)
  if (isOwner && onRoomSettings) {
    items.push({ id: 'settings', icon: 'settings-outline', label: 'Oda Ayarları', accent: '#D4AF37', onPress: onRoomSettings });
  }
  // 2️⃣ Moderasyon / El Kaldırma Kuyruğu (Owner veya Mod — Free dahil)
  if ((isOwner || isMod) && onModeration) {
    items.push({ id: 'moderation', icon: 'shield-checkmark-outline', label: isFreeOwner ? 'El Kaldırma Kuyruğu' : 'Moderasyon', accent: '#A78BFA', onPress: onModeration, badge: micRequestCount });
  }
  // 3️⃣ Oda Kilitle (Silver+ owner)
  if (isOwner && onRoomLock && isTierAtLeast(ownerTier as any, 'Silver')) {
    items.push({ id: 'lock', icon: isRoomLocked ? 'lock-open-outline' : 'lock-closed-outline', label: isRoomLocked ? 'Kilidi Aç' : 'Odayı Kilitle', accent: '#F59E0B', onPress: onRoomLock });
  }
  // 4️⃣ Tümünü Sustur (Gold+ owner)
  if (isOwner && onMuteAll && isTierAtLeast(ownerTier as any, 'Gold')) {
    items.push({ id: 'mute_all', icon: 'volume-mute-outline', label: 'Tümünü Sustur', accent: '#EF4444', onPress: onMuteAll });
  }
  // 5️⃣ Davet (sahnedeki herkes)
  if (isOnStage) {
    items.push({ id: 'invite', icon: 'person-add-outline', label: 'Arkadaşlarını Davet Et', accent: '#14B8A6', onPress: onInviteFriends });
  }
  // 7️⃣ Link Paylaş (herkes)
  items.push({ id: 'share', icon: 'share-social-outline', label: 'Oda Linkini Paylaş', accent: '#3B82F6', onPress: onShareLink });
  // 8️⃣ Oda İstatistikleri (VIP owner)
  if (isOwner && onRoomStats && isTierAtLeast(ownerTier as any, 'VIP')) {
    items.push({ id: 'stats', icon: 'stats-chart-outline', label: 'Oda İstatistikleri', accent: '#3B82F6', onPress: onRoomStats });
  }
  // ★ RM-4: Boost — Bronze+ owner
  if (isOwner && onBoostRoom && isTierAtLeast(ownerTier as any, 'Bronze')) {
    items.push({ id: 'boost', icon: 'rocket-outline', label: 'Keşfette Öne Çıkar', desc: 'SP ile boost', accent: '#F59E0B', onPress: onBoostRoom });
  }
  // ★ RM-5: Oda Takip Et/Bırak (dinleyiciler + speaker'lar, owner hariç)
  if (!isOwner && onToggleFollow) {
    items.push({ id: 'follow', icon: isFollowingRoom ? 'heart' : 'heart-outline', label: isFollowingRoom ? 'Takibi Bırak' : 'Odayı Takip Et', accent: isFollowingRoom ? '#EF4444' : '#EC4899', onPress: onToggleFollow });
  }
  // 🚩 Bildir (dinleyiciler)
  if (!isOnStage && onReportRoom) {
    items.push({ id: 'report', icon: 'flag-outline', label: 'Odayı Bildir', accent: '#EF4444', onPress: onReportRoom, destructive: true });
  }
  // 🗑️ Odayı Sil (Owner)
  if (isOwner && onDeleteRoom) {
    items.push({ id: 'delete_room', icon: 'trash-outline', label: 'Odayı Sil', desc: 'Kalıcı olarak siler', accent: '#EF4444', onPress: onDeleteRoom, destructive: true });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — aşağıdan yukarı spring ile kayar */}
      <Animated.View style={[
        s.panel,
        {
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          opacity: fadeAnim,
        },
      ]}>
        {/* Ok işareti — + butonuna doğru */}
        <View style={s.arrowWrap}>
          <View style={s.arrow} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={[s.rolePill, { backgroundColor: role.color + '22', borderColor: role.color + '35' }]}>
            <Ionicons name={role.icon as any} size={12} color={role.color} style={s.iconShadow} />
            <Text style={[s.roleLabel, { color: role.color }]}>{role.label}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={16} color="#94A3B8" />
          </Pressable>
        </View>

        {/* Items */}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
          {items.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => { item.onPress(); onClose(); }}
              style={({ pressed }) => [
                s.row,
                pressed && s.rowPressed,
                i < items.length - 1 && s.rowBorder,
              ]}
            >
              <View style={[s.iconCircle, { backgroundColor: item.accent + '20', borderColor: item.accent + '30' }]}>
                <Ionicons name={item.icon as any} size={16} color={item.destructive ? '#EF4444' : item.accent} style={s.iconShadow} />
              </View>
              <View style={s.rowText}>
                <Text style={[s.rowLabel, item.destructive && { color: '#EF4444' }]}>{item.label}</Text>
                {item.desc && <Text style={s.rowDesc}>{item.desc}</Text>}
              </View>
              {item.badge && item.badge > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// Geriye uyumluluk
export function AdvancedSettingsPanel({ visible }: { visible: boolean; [key: string]: any }) {
  return null;
}

// ════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  panel: {
    position: 'absolute',
    bottom: 82,
    right: 10,
    width: 252,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.12)',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 20,
  },

  // Ok işareti — panelin altından + butonuna doğru
  arrowWrap: {
    position: 'absolute',
    bottom: -8,
    right: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1E293B',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Icon shadow — tüm ikonlara gölge verir
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  rowPressed: {
    backgroundColor: 'rgba(20,184,166,0.08)',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F1F5F9',
    letterSpacing: 0.15,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  rowDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Badge
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
});
