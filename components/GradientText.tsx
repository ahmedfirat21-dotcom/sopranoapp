/**
 * GradientText — MaskedView + LinearGradient ile gradient metin.
 * PNG asset'lere gerek kalmadan kod tabanlı gradient text üretir.
 *
 * Kullanım:
 *   <GradientText colors={['#fecdd3','#fb7185','#e11d48','#f43f5e']}
 *     style={{ fontSize: 28, fontWeight: '900' }}>
 *     Başlık
 *   </GradientText>
 */
import React from 'react';
import { Text, type TextStyle, type StyleProp, Platform } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientTextProps {
  children: React.ReactNode;
  colors: string[];
  locations?: number[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<TextStyle>;
}

export default function GradientText({
  children,
  colors,
  locations,
  start = { x: 0.5, y: 0 },
  end = { x: 0.5, y: 1 },
  style,
}: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors as any}
        locations={locations as any}
        start={start}
        end={end}
      >
        {/* Görünmez text — MaskedView'ın boyutunu belirlemek için */}
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
