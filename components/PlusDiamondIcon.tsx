// ★ 2026-05-04: VIP üyelik ikonu — 3D VIP rozeti PNG + hafif parlama efekti.
//   WebView kaldırıldı → sade Image, <1MB RAM.
//
//   Kullanım yerleri:
//   - Profil header VIP/Plus butonu (ana gösterge)
//   - Plus sayfası hero (gelecekte)
import React, { useEffect, useRef } from 'react';
import { View, Image, ViewStyle, Animated, Easing } from 'react-native';

interface Props {
  size?: number;
  style?: ViewStyle;
}

export default function PlusDiamondIcon({ size = 48, style }: Props) {
  // ★ Hafif parlama (opacity pulse) — scale değişmez, sadece parıltı
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ★ v284 (16 May 2026): Loop ref + cleanup. Eskiden start()'ı doğrudan çağırıyordu,
    //   unmount sonrası loop orphan kalıyordu → FPS drop.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowOpacity]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {/* ★ Ana VIP ikonu */}
      <Image
        source={require('../assets/vip_crown_3d.png')}
        style={{
          width: size * 0.92,
          height: size * 0.92,
        }}
        resizeMode="contain"
      />
    </View>
  );
}
