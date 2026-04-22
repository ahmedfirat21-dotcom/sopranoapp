/**
 * ★ 2026-04-21: TabBarFadeOut
 * ═══════════════════════════════════════════════════════════════════
 * Tab bar üstüne konan yumuşak fade gradient — scroll içeriği tab bar
 * arkasında yumuşak kaybolur. Clubhouse/Spaces tarzı premium his.
 *
 * Kullanım:
 *   <TabBarFadeOut />   -> default: always visible (ekran bg'ye göre fade)
 *   <TabBarFadeOut visible={hasScrolled} />  -> sadece scroll olunca
 *
 * Önemli:
 *   - Tab bar'ın altında ve yanlarında kalan boşlukları kapatır
 *   - pointerEvents="none" — scroll ile etkileşimi engellemez
 *   - zIndex 8 — tab bar (zIndex 50+) altında, içerik üstünde
 *
 * AppBackground ile ekran bg'si #0F1929 (royal navy). Gradient bu tona fade eder.
 */
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  /** Her zaman göster (default) veya koşullu (örn. hasScrolled) */
  visible?: boolean;
  /** Gradient boyutu — default: tab bar + alt safe + 70px buffer */
  height?: number;
  /** Ekran arka plan rengi — default: #0F1929 (royal navy) */
  bgColor?: string;
}

export default function TabBarFadeOut({
  visible = true,
  height,
  bgColor = '#0F1929',
}: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  // Tab bar: BAR_H=60 + marginHorizontal 6 + alt paddingBottom=Math.max(insets.bottom, 8)
  // Fade yüksekliği: tab bar + alt safe + 70px üst buffer
  const fadeHeight = height ?? (insets.bottom + 60 + 70);

  // rgba helper — gradient locations'da kullanmak için hex'ten parse et
  const toRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  return (
    <LinearGradient
      colors={[
        toRgba(bgColor, 0),
        toRgba(bgColor, 0.85),
        toRgba(bgColor, 1),
        toRgba(bgColor, 1),
      ]}
      locations={[0, 0.35, 0.7, 1]}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0, right: 0,
        bottom: 0,
        height: fadeHeight,
        zIndex: 8,
      }}
    />
  );
}
