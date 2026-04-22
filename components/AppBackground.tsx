/**
 * SopranoChat — Global Background Wrapper
 * ★ 2026-04-20: PNG image yerine programmatic LinearGradient (Midnight Sapphire).
 *   Avantaj: tema renkleri ile tutarlı, asset boyutu 0 KB, istediğin gibi iterate.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NeonWaveBackground, { type BgVariant } from './NeonWaveBackground';

export const APP_BG_COLOR = '#0F1929'; // Midnight Sapphire navy — pürüzsüz solid

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
    <View style={styles.root}>
      {/* ★ 2026-04-20: Pürüzsüz Midnight Sapphire — solid navy base,
          köşelerde neredeyse görünmez accent (rahatsız etmez, derinlik verir) */}
      {/* Çok hafif vertical gradient — üst biraz aydınlık, alt biraz koyu */}
      <LinearGradient
        colors={['#122038', '#0F1929', '#0C1424']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Üst sağ köşe — çok hafif teal (marka aksanı, yalnızca hissedilir) */}
      <LinearGradient
        colors={['rgba(20,184,166,0.05)', 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.4, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Alt sol köşe — çok hafif altın (warmth) */}
      <LinearGradient
        colors={['transparent', 'rgba(251,191,36,0.03)']}
        start={{ x: 0.6, y: 0.6 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {!disableWave && <NeonWaveBackground intensity={intensity} variant={variant} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_BG_COLOR,
  },
});
