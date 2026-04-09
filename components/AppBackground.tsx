/**
 * SopranoChat — Global Background Wrapper
 * Tüm sayfalarda kullanılır — koyu zemin + ekrana özel animasyon efekti
 */
import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import NeonWaveBackground, { type BgVariant } from './NeonWaveBackground';

// Görseldeki koyu mavi-gri zemin rengi fallback olarak duruyor
export const APP_BG_COLOR = '#0F1926';

interface Props {
  children: React.ReactNode;
  /** Dalga efektini kapat (ör. room ekranında kendi arka planı var) */
  disableWave?: boolean;
  /** Dalga opaklık yoğunluğu (0-1) */
  intensity?: number;
  /** Ekrana özel efekt varyantı */
  variant?: BgVariant;
}

export default function AppBackground({ children, disableWave = false, intensity = 1, variant = 'default' }: Props) {
  return (
    <ImageBackground
      source={require('../assets/images/app_bg.jpg')}
      style={styles.root}
      resizeMode="cover"
    >
      {!disableWave && <NeonWaveBackground intensity={intensity} variant={variant} />}
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_BG_COLOR,
  },
});
