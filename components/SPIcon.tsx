// ★ 2026-04-29: Statik SP puan ikonu — hexagon mücevher (assets/sp_icon.png).
//   Animasyonsuz, hafif (PNG ~10KB), küçük boyutlarda da net görünür.
//   Animasyonlu/canlı versiyon için <SPHexagonIcon> (WebView based, sadece hero
//   yerlerde — performans nedeniyle listede kullanma).
import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface Props {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export default function SPIcon({ size = 16, style }: Props) {
  return (
    <Image
      source={require('../assets/sp_icon.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
