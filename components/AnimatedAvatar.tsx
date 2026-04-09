/**
 * AnimatedAvatar — Reusable avatar component with Lottie frame overlay
 * Profile, Room, Home header ve her yerde kullanılır.
 * 
 * Çerçeve aktifken:
 * - Varsayılan gradient ring KALKAR
 * - Lottie animasyon avatarın üzerine frame-specific scale ile oturur
 */
import React from 'react';
import { View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAvatarSource, getLevelFromSP, getLevelColors } from '../constants/avatars';
import { getFrameLottieSource, getFrameScale } from '../constants/frames';
import LottieView from 'lottie-react-native';

type AnimatedAvatarProps = {
  avatarUrl: string | null | undefined;
  activeFrame?: string | null;
  size?: number;           // dış çap (default: 114)
  ringColors?: string[];   // gradient ring renkleri
  systemPoints?: number;   // level ring hesabı için (SP)
  tier?: string;           // tier ring hesabı için
  showFrame?: boolean;     // frame göster/gizle (default: true)
  borderColor?: string;    // iç border rengi (default: #2f404f)
};

export default function AnimatedAvatar({
  avatarUrl,
  activeFrame,
  size = 114,
  ringColors,
  systemPoints = 0,
  tier = 'Free',
  showFrame = true,
  borderColor = '#2f404f',
}: AnimatedAvatarProps) {
  const level = getLevelFromSP(systemPoints, tier);
  const lvColors = getLevelColors(level);
  const gradColors = (ringColors || lvColors.ring) as [string, string, ...string[]];
  const frameSrc = showFrame ? getFrameLottieSource(activeFrame) : null;
  const hasFrame = !!frameSrc;

  const innerSize = size - 10;       // avatar image size
  const innerRadius = innerSize / 2;
  const outerRadius = size / 2;

  // Her frame için ayrı scale — frames.ts'den alınır
  const frameScale = getFrameScale(activeFrame);
  const frameSize = size * frameScale;
  const frameOffset = (frameSize - size) / 2;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {hasFrame ? (
        // Çerçeve VAR — gradient ring kalkıyor, düz arka plan
        <View
          style={{
            width: size,
            height: size,
            borderRadius: outerRadius,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: borderColor,
          }}
        >
          <Image
            source={getAvatarSource(avatarUrl)}
            style={{
              width: innerSize,
              height: innerSize,
              borderRadius: innerRadius,
            }}
          />
        </View>
      ) : (
        // Çerçeve YOK — klasik gradient ring
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: outerRadius,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Image
            source={getAvatarSource(avatarUrl)}
            style={{
              width: innerSize,
              height: innerSize,
              borderRadius: innerRadius,
              borderWidth: 3,
              borderColor,
            }}
          />
        </LinearGradient>
      )}

      {/* Lottie frame overlay — tam ortada, frame-specific scale ile */}
      {hasFrame && (
        <View
          style={{
            position: 'absolute',
            top: -frameOffset,
            left: -frameOffset,
            width: frameSize,
            height: frameSize,
            zIndex: 5,
          }}
          pointerEvents="none"
        >
          <LottieView
            source={frameSrc}
            autoPlay
            loop
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      )}
    </View>
  );
}
