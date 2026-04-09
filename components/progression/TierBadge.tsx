/**
 * SopranoChat — Tier Rozet Bileşeni
 * Kullanıcının tier'ını gösteren küçük rozet (profil, oda, mesaj)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TIER_DEFINITIONS } from '../../constants/tiers';
import type { TierName } from '../../types';

interface TierBadgeProps {
  tier: TierName | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: any;
}

const SIZES = {
  sm: { height: 18, fontSize: 9, iconSize: 10, px: 5, gap: 2 },
  md: { height: 24, fontSize: 11, iconSize: 13, px: 8, gap: 3 },
  lg: { height: 32, fontSize: 14, iconSize: 17, px: 12, gap: 5 },
};

export function TierBadge({ tier, size = 'sm', showLabel = true, style }: TierBadgeProps) {
  const def = TIER_DEFINITIONS[tier as TierName];
  if (!def) return null;

  const s = SIZES[size];

  return (
    <LinearGradient
      colors={[def.gradient[0], def.gradient[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, { height: s.height, paddingHorizontal: s.px, borderRadius: s.height / 2 }, style]}
    >
      <Ionicons name={def.icon as any} size={s.iconSize} color="#fff" />
      {showLabel && (
        <Text style={[styles.label, { fontSize: s.fontSize, marginLeft: s.gap }]}>
          {def.label}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
