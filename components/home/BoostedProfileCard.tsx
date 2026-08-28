// ════════════════════════════════════════════════════════════
// BoostedProfileCard — tier border, name overlay
// Extracted from home.tsx & discover.tsx inline BoostedCard
// ════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import { i18n } from '../../services/i18n';

interface BoostedProfileCardProps {
  profile: any;
  isOnline: boolean;
  onPress: (uid: string) => void;
  /** ★ v1.7.13.146 (24 May 2026): Clubhouse + takip butonu (kart sağ-üst köşesinde) */
  showFollowButton?: boolean;
  isFollowing?: boolean;
  onFollowPress?: () => void;
}

export default function BoostedProfileCard({ profile: bp, isOnline, onPress, showFollowButton, isFollowing, onFollowPress }: BoostedProfileCardProps) {
  const tier = bp.subscription_tier || 'Free';
  const isGM = bp.is_admin;
  const ac = isGM ? '#DC2626' : tier === 'Pro' ? '#D4AF37' : tier === 'Plus' ? '#A78BFA' : '#14B8A6';
  const gr: [string, string, string] = isGM
    ? ['#7F1D1D', '#450A0A', '#1E1B1B'] : tier === 'Pro'
    ? ['#7C5A12', '#3F2B0A', '#1F1808'] : tier === 'Plus'
    ? ['#4C1D7B', '#2A0F47', '#15081F'] : ['#0F4C5C', '#0A2F3C', '#051920'];
  return (
    <Pressable
      style={({ pressed }) => ({
        width: 100, aspectRatio: 1, borderRadius: 16, overflow: 'hidden',
        borderWidth: 1.5, borderColor: ac + '70',
        shadowColor: ac, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
        opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
      onPress={() => onPress(bp.id)}
    >
      <LinearGradient colors={gr} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }} style={{ flex: 1 }}>
        <View style={{ flex: 1, position: 'relative' }}>
          {bp.avatar_url ? (
            <Image source={getAvatarSource(bp.avatar_url)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ac + '44' }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#FFF' }}>
                {(bp.display_name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isOnline && (
            <View style={{
              position: 'absolute', top: 6, left: 6,
              width: 11, height: 11, borderRadius: 5.5,
              backgroundColor: '#22C55E',
              borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
            }} />
          )}
          {/* ★ v1.7.13.146 (24 May 2026): Clubhouse + takip butonu — sağ-üst */}
          {showFollowButton && !isFollowing && (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onFollowPress?.(); }}
              hitSlop={6}
              style={({ pressed }) => ({
                position: 'absolute', top: 5, right: 5,
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: '#14B8A6',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: 'rgba(8,12,22,0.95)',
                shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
                elevation: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </Pressable>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 6, paddingTop: 14 }}
          >
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: '#F1F5F9', textAlign: 'center' }}>
              {bp.display_name || i18n.t('common.anonymous')}
            </Text>
          </LinearGradient>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
