import React from 'react';
import { View, Image, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../constants/avatars';
import { TIER_DEFINITIONS } from '../constants/tiers';
import type { SubscriptionTier } from '../types';
import { migrateLegacyTier } from '../types';

interface StatusAvatarProps {
  /** Avatar URL string or ImageSource */
  uri?: string | null;
  /** Avatar diameter in pixels */
  size?: number;
  /** Show online green dot */
  isOnline?: boolean;
  /** Subscription tier — border rengi + pill badge belirler */
  tier?: SubscriptionTier | string | null;
  /** Admin mi? (GodMaster kırmızı çerçeve) */
  isAdmin?: boolean;
  /** Optional border color override (tier yoksa kullanılır) */
  borderColor?: string;
  /** Optional border width override */
  borderWidth?: number;
  /** Tier pill badge'i göster (avatarın altında küçük etiket) */
  showTierBadge?: boolean;
}

/**
 * StatusAvatar — Ortak avatar + online durum + tier çerçeve bileşeni.
 * 
 * Profil sayfasındaki avatarRing + tierPill + onlineDot sisteminin
 * uygulamanın her yerinde tutarlı kullanılmasını sağlar.
 * 
 * Kullanım:
 * ```tsx
 * <StatusAvatar uri={url} size={44} isOnline={true} tier="Pro" />
 * <StatusAvatar uri={url} size={60} tier="Plus" showTierBadge />
 * ```
 */
export default function StatusAvatar({
  uri,
  size = 44,
  isOnline,
  tier,
  isAdmin,
  borderColor,
  borderWidth = 2,
  showTierBadge = false,
}: StatusAvatarProps) {
  const radius = size / 2;
  const dotSize = Math.max(10, size * 0.26);
  const dotRadius = dotSize / 2;
  const dotBorder = Math.max(2, dotSize * 0.3);

  // Tier renk çözümleme
  const normalizedTier = tier ? migrateLegacyTier(tier as string) : 'Free';
  const tierDef = TIER_DEFINITIONS[normalizedTier as SubscriptionTier];
  
  // Çerçeve rengi: Admin > tier prop > fallback
  const ringColor = isAdmin
    ? '#DC2626'
    : tierDef
      ? tierDef.color
      : borderColor || 'rgba(255,255,255,0.12)';

  // Gradient ve ikon (tier pill için)
  const tierGradient = isAdmin ? ['#DC2626', '#7F1D1D'] : tierDef ? tierDef.gradient : ['#94A3B8', '#64748B'];
  const tierIcon = isAdmin ? 'shield-checkmark' : tierDef?.icon || 'person-outline';
  const tierLabel = isAdmin ? 'GM' : normalizedTier;

  // Avatar source  
  const source: ImageSourcePropType =
    uri && typeof uri === 'string' && uri.startsWith('http')
      ? { uri }
      : getAvatarSource(uri || '');

  // Pill badge boyut hesabı (avatar boyutuna göre ölçekli)
  const pillScale = Math.max(0.7, Math.min(1, size / 60));

  return (
    <View style={{ width: size, height: size + (showTierBadge ? 8 : 0), position: 'relative' }}>
      {/* Avatar — tier renginde çerçeve */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth,
            borderColor: ringColor,
          },
        ]}
      >
        <Image
          source={source}
          style={{
            width: size - borderWidth * 2 - 2,
            height: size - borderWidth * 2 - 2,
            borderRadius: (size - borderWidth * 2 - 2) / 2,
            backgroundColor: 'rgba(255,255,255,0.05)',
          }}
        />
      </View>

      {/* Online durum dot */}
      {isOnline && (
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotRadius,
              borderWidth: dotBorder,
              top: showTierBadge ? 0 : 2,
            },
          ]}
        />
      )}

      {/* Tier pill badge — opsiyonel, avatarın altında görünür */}
      {showTierBadge && tierDef && (
        <LinearGradient
          colors={tierGradient as [string, string]}
          style={[
            styles.tierPill,
            {
              transform: [{ scale: pillScale }],
            },
          ]}
        >
          <Ionicons name={tierIcon as any} size={7} color="#FFF" />
          <Text style={styles.tierText}>{tierLabel}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1,
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#4ADE80',
    borderColor: '#0F1923',
  },
  tierPill: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    left: '15%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0F1923',
  },
  tierText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
});
