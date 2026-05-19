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
// ★ 2026-04-24: Radial glow mode — login/kayıt/ana sayfa/odalarım/mesajlar/profil.
//   Merkez-üst aydınlık slate + kenar vignette (true radial taklidi).
export const GLOW_BG_COLOR = '#2A3A55';

interface Props {
  children: React.ReactNode;
  /** Dalga efektini kapat (ör. room ekranında kendi arka planı var) */
  disableWave?: boolean;
  /** Dalga opaklık yoğunluğu (0-1) */
  intensity?: number;
  /** Ekrana özel efekt varyantı */
  variant?: BgVariant;
  /** Radial glow mode — merkez-üst aydınlık, kenar koyu vignette */
  radialGlow?: boolean;
}

export default function AppBackground({ children, disableWave = false, intensity = 1, variant = 'default', radialGlow = false }: Props) {
  if (radialGlow) {
    return (
      <View style={[styles.root, { backgroundColor: '#050A14' }]}>
        {/* ★ 2026-04-24 v3: Gece yarısı gökyüzü — saf dikey blur geçiş, ana katman.
            Üst horizon parlaklığı → orta derin mavi → alt neredeyse siyah.
            Çok sayıda yakın stop ile çizgi/band hissi engellenir. */}
        {/* ★ v1.7.13.31 (19 May 2026): Kullanici 'arkaplan parlaktan koyuya
            dogru' istedi. Top kademe daha vibrant blue-teal (#506E9C → #3A5680),
            alt 'da neredeyse siyah (#050811). Yumusak 6-stop gecis. */}
        <LinearGradient
          colors={['#506E9C', '#3A5680', '#283F62', '#1A2C49', '#0E1A30', '#050811']}
          locations={[0, 0.20, 0.40, 0.60, 0.80, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* ★ Premium depth restore — eski default mode'daki accent'ler.
            radialGlow mode'unda kaybolan glassmorphic hissi geri verir. */}
        {/* Üst sağ köşe — çok hafif teal (marka aksanı, yalnızca hissedilir) */}
        <LinearGradient
          colors={['rgba(20,184,166,0.06)', 'transparent']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.4, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Alt sol köşe — çok hafif altın (warmth) */}
        <LinearGradient
          colors={['transparent', 'rgba(251,191,36,0.04)']}
          start={{ x: 0.6, y: 0.6 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Animasyonlu wave layer — ana derinlik kaynağı */}
        {!disableWave && <NeonWaveBackground intensity={intensity} variant={variant} />}
        {children}
      </View>
    );
  }

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
