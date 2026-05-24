/**
 * SopranoChat — Verified Badge
 * Mavi tik (Twitter/X paterni) — doğrulanmış kullanıcı işareti.
 * v1.7.13.98 (20 May 2026): Tüm liste/kart yerlerinde reuse için ortak component.
 */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  size?: number;
  color?: string;
  style?: any;
};

export default function VerifiedBadge({ size = 12, color = '#3B82F6', style }: Props) {
  return (
    <Ionicons
      name="checkmark-circle"
      size={size}
      color={color}
      style={[
        {
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        },
        style,
      ]}
    />
  );
}
