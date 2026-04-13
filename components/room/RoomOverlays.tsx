import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isTierAtLeast } from '../../constants/tiers';

const { width: W, height: H } = Dimensions.get('window');

// ════════════════════════════════════════════════════════════
// + MENÜSÜ — Akıcı Spring Animasyonlu Rol-Bazlı Panel
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

};

const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  owner:     { label: 'Oda Sahibi',  color: '#D4AF37', icon: 'star' },
  moderator: { label: 'Moderatör',   color: '#A78BFA', icon: 'shield-checkmark' },
  speaker:   { label: 'Konuşmacı',   color: '#14B8A6', icon: 'mic' },
  listener:  { label: 'Dinleyici',    color: '#64748B', icon: 'headset' },
};

export function PlusMenu({
  visible, onClose,
  onInviteFriends, onShareLink, onRoomSettings,
  onModeration, onRoomLock, onReportRoom,
  isRoomLocked, micRequestCount,
  userRole = 'listener',
  ownerTier = 'Free',
  onMuteAll, onRoomStats,
}: PlusMenuProps) {
  // ═══ Animasyon ═══
  const slideAnim = useRef(new Animated.Value(200)).current; // yukarı kayma
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
  // ★ K3 FIX: Free owner da moderasyon paneline erişebilir (el kaldırma kuyruğu için)
  if ((isOwner || isMod) && onModeration) {
    items.push({ id: 'moderation', icon: 'shield-checkmark-outline', label: isFreeOwner ? 'El Kaldırma Kuyruğu' : 'Moderasyon', accent: '#A78BFA', onPress: onModeration, badge: micRequestCount });
  }
  // 3️⃣ Oda Kilitle (Silver+ owner)
  // ★ M4 FIX: onRoomLock artık menüde kullanılıyor
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
  // 🚩 Bildir (dinleyiciler)
  if (!isOnStage && onReportRoom) {
    items.push({ id: 'report', icon: 'flag-outline', label: 'Odayı Bildir', accent: '#EF4444', onPress: onReportRoom, destructive: true });
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
          <View style={[s.rolePill, { backgroundColor: role.color + '18' }]}>
            <Ionicons name={role.icon as any} size={11} color={role.color} />
            <Text style={[s.roleLabel, { color: role.color }]}>{role.label}</Text>
          </View>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={16} color="#475569" />
          </Pressable>
        </View>

        {/* Items */}
        <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
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
              <View style={[s.iconCircle, { backgroundColor: item.accent + '14' }]}>
                <Ionicons name={item.icon as any} size={14} color={item.destructive ? '#EF4444' : item.accent} />
              </View>
              <View style={s.rowText}>
                <Text style={[s.rowLabel, item.destructive && { color: '#EF4444' }]}>{item.label}</Text>
                {item.desc && <Text style={s.rowDesc}>{item.desc}</Text>}
              </View>
              {item.badge && item.badge > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.08)" />
              )}
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  panel: {
    position: 'absolute',
    bottom: 82,
    right: 10,
    width: 232,
    borderRadius: 14,
    backgroundColor: '#2d3d4d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 16,
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
    borderTopColor: '#2d3d4d',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  rowPressed: {
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.025)',
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rowDesc: {
    fontSize: 10,
    color: '#475569',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },

  // Badge
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#14B8A6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
});
