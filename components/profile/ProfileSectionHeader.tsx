// SopranoChat — Paylaşılan Profil Section Header
// ★ 2026-05-05: 4 farklı yerde duplike olan section header tek dosyada.
// Kullanım: ProfileFriendsList, app/(tabs)/profile.tsx, app/user/[id].tsx,
// components/room/InRoomUserProfile.tsx

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../constants/theme';

const _textGlow = Shadows.text;
const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

interface Props {
  /** Başlık metni (büyük harfle gösterilir) */
  label: string;
  /** Ionicons ismi */
  icon: keyof typeof Ionicons.glyphMap;
  /** Karakter rengi — accent bar + ikon (varsayılan teal) */
  accentColor?: string;
  /** Başlığın sağında gösterilecek sayı badge (opsiyonel) */
  count?: number;
  /** "Tümünü Gör" gibi sağdaki tıklanabilir link metni */
  actionLabel?: string;
  onActionPress?: () => void;
  /** Üst boşluk override (default 14) */
  marginTop?: number;
  /** Alt boşluk override (default 8) */
  marginBottom?: number;
}

export default function ProfileSectionHeader({
  label, icon, accentColor = Colors.teal, count, actionLabel, onActionPress,
  marginTop = 14, marginBottom = 8,
}: Props) {
  return (
    <View style={[s.header, { marginTop, marginBottom }]}>
      <View style={[s.accent, { backgroundColor: accentColor }]} />
      <Ionicons name={icon} size={13} color={accentColor} style={iconShadow} />
      <Text style={s.label}>{label}</Text>
      {typeof count === 'number' && count > 0 && (
        <View style={[s.countPill, { backgroundColor: `${accentColor}1F`, borderColor: `${accentColor}40` }]}>
          <Text style={[s.countText, { color: accentColor }]}>{count}</Text>
        </View>
      )}
      {actionLabel && onActionPress && (
        <Pressable
          onPress={onActionPress}
          hitSlop={6}
          style={({ pressed }) => [
            s.action,
            { backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}38` },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[s.actionText, { color: accentColor }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color={accentColor} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16,
  },
  accent: { width: 3, height: 14, borderRadius: 2 },
  label: {
    fontSize: 11, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1, ..._textGlow,
  },
  countPill: {
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  countText: { fontSize: 10, fontWeight: '800' },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    marginLeft: 'auto',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 10, fontWeight: '800',
    letterSpacing: 0.3, ..._textGlow,
  },
});
