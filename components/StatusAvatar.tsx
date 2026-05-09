import React from 'react';
import { View, Image, Text, StyleSheet, Platform, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../constants/avatars';
import { TIER_DEFINITIONS } from '../constants/tiers';
import type { SubscriptionTier } from '../types';
import { migrateLegacyTier } from '../types';
import AvatarFrame from './profile/AvatarFrame';
import TierBadge from './TierBadge';

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
  /** Kullanıcının kendi avatarı mı? Evetse online dot gizlenir (kendi online durumunu görmek anlamsız). */
  isSelf?: boolean;
  /** ★ v107: profiles.active_frame — mağaza atelier item id'si, varsa avatar etrafına çerçeve render */
  frameId?: string | null;
  /** ★ v109.4.3: TierBadge boyutu — xs (mini avatar, sadece ikon) / sm (label dahil "PRO" pill).
   *  Default xs. Profil hero ve sahnede sm/md kullanılır. */
  tierBadgeSize?: 'xs' | 'sm' | 'md' | 'lg';
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
  // ★ 2026-05-05: Default true — kullanıcı talebi: "mini avatarların tamamına
  //   plus ve pro etiketlerinin kompakt versiyonu". Free zaten otomatik gizli
  //   (`normalizedTier !== 'Free'` filtresi). Hiç istenmeyen yerlerde explicit
  //   `showTierBadge={false}` geç.
  showTierBadge = true,
  isSelf = false,
  frameId,
  tierBadgeSize = 'xs',
}: StatusAvatarProps) {
  const radius = size / 2;
  // ★ 2026-04-21: Daha zarif nokta — %26 yerine %22, çerçeve 0.3x → 0.18x
  const dotSize = Math.max(8, size * 0.22);
  const dotRadius = dotSize / 2;
  const dotBorder = Math.max(1, dotSize * 0.18);

  // Tier renk çözümleme
  const normalizedTier = tier ? migrateLegacyTier(tier as string) : 'Free';
  const tierDef = TIER_DEFINITIONS[normalizedTier as SubscriptionTier];
  
  // ★ GodMaster: tier='GodMaster' VEYA isAdmin=true → aynı premium görünüm
  const isGM = isAdmin || normalizedTier === 'GodMaster';

  // Çerçeve rengi: GodMaster > tier > fallback
  const ringColor = isGM
    ? '#DC2626'
    : tierDef
      ? tierDef.color
      : borderColor || 'rgba(255,255,255,0.12)';

  // Gradient ve ikon (tier pill için)
  const tierGradient = isGM ? ['#DC2626', '#7F1D1D'] : tierDef ? tierDef.gradient : ['#94A3B8', '#64748B'];
  const tierIcon = isGM ? 'flash' : tierDef?.icon || 'person-outline';
  const tierLabel = isGM ? '⚡GM' : normalizedTier;

  // Avatar source  
  const source: ImageSourcePropType =
    uri && typeof uri === 'string' && uri.startsWith('http')
      ? { uri }
      : getAvatarSource(uri || '');

  // Pill badge boyut hesabı (avatar boyutuna göre ölçekli)
  const pillScale = Math.max(0.7, Math.min(1, size / 60));

  return (
    <View style={{ width: size, height: size + (showTierBadge ? 8 : 0), position: 'relative' }}>
      {/* ★ v107.69: Mağaza çerçevesi avatar'dan ÖNCE render — yoksa AvatarFrame'in iç
         koyu cutout'u avatar Image'i kapatıyor (kullanıcı: "profil resmi gidiyor"). */}
      <AvatarFrame frameId={frameId} size={size} />
      {/* ★ v108.13: Aktif çerçeve varsa tier border'ı kapat — çift halka görünmesin.
         Çerçeve zaten tema halkası; tier rozeti (showTierBadge) avatar altında ayrıca gösterilir.
         ★ v108.14: Frame varsa avatar'a hafif yumuşak gölge — derinlik hissi. */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: frameId ? 0 : borderWidth,
            borderColor: frameId ? 'transparent' : ringColor,
          },
          frameId && {
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
              },
              android: { elevation: 12 },
            }),
            zIndex: 2, // Avatar Image her zaman frame'in üstünde
          },
        ]}
      >
        <Image
          source={source}
          style={{
            width: size - borderWidth * 2 - 2,
            height: size - borderWidth * 2 - 2,
            borderRadius: (size - borderWidth * 2 - 2) / 2,
            // ★ 2026-04-20: backgroundColor kaldırıldı — Android'de borderRadius
            //   image background'ı her zaman yuvarlak kırpamıyor; dim kartlarda
            //   (opacity 0.55) alpha'lı avatar arkasında kare gri kutu görünüyordu.
          }}
        />
      </View>

      {/* Online durum dot — kendi avatarında gizle (self-view'da online işareti anlamsız) */}
      {isOnline && !isSelf && (
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

      {/* ★ 2026-04-29: Tier badge — Free'yi hiç gösterme (default), Plus/Pro/GM için
          minimalist yuvarlak ikon (yazı kaldırıldı, daha zarif).
          ★ v108.14: Aktif çerçeve varsa rozet gizlenir — kullanıcının istediği
          sade görünüm (avatar + frame + hafif gölge yeterli). */}
      {/* ★ v109.4.2: TierBadge avatar üstünde, mini için xs ikon-only.
           Sahne/profil çağrıları `tierBadgeSize="sm"` ile büyük "PRO" pill alır. */}
      {showTierBadge && normalizedTier !== 'Free' && (
        <View
          style={{
            position: 'absolute',
            bottom: -2, right: -2,
            transform: [{ scale: pillScale }],
            zIndex: 4, elevation: 8,
          }}
          pointerEvents="none"
        >
          <TierBadge tier={normalizedTier} size={tierBadgeSize} />
        </View>
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
    backgroundColor: '#22C55E',
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
    // ★ v109.3: zIndex 3 — AvatarFrame (zIndex:1) üstünde, frame altında kalmasın
    zIndex: 3,
    elevation: 6,
  },
  tierBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F1923',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2.5,
    // ★ v109.3: zIndex 3 — frame üstünde
    zIndex: 3,
    elevation: 6,
  },
});
