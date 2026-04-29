// ★ 2026-04-29: Plus üyelik ana ikonu — SP hexagon mücevher animasyonunun
//   mavi/sapphire versiyonu, klasik elmas (5 köşeli) shape ile. Aynı parlaklık
//   animasyon paketi: gem-float, shine-march, facet-bright, halo-breathe,
//   ring-expand, orbit, ray-rotate, star-twinkle.
//
//   Kullanım yerleri:
//   - Profil header Plus butonu (büyük, ana gösterge)
//   - Plus sayfası hero (gelecekte)
//
//   Performance notu: Her instance bir WebView başlatır (yaklaşık 5-10MB RAM).
//   Sadece "ana Plus göstergesi" yerlerde kullan; küçük inline ikonlar için
//   Ionicons name="diamond" color="#60A5FA" yeterli.
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

// ★ Mavi sapphire diamond — animasyonlar SP_HEXAGON ile aynı, palet ve shape farklı
export const PLUS_DIAMOND_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center}svg{width:100%;height:100%}@keyframes shine-march{0%{transform:translateX(-200px)}55%{transform:translateX(200px)}100%{transform:translateX(200px)}}.shine-band{animation:shine-march 3.6s ease-in-out infinite}</style></head><body><svg viewBox="0 0 200 220" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="b1" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#DBEAFE"/><stop offset="20%" stop-color="#BFDBFE"/><stop offset="50%" stop-color="#3B82F6"/><stop offset="100%" stop-color="#172554"/></linearGradient><linearGradient id="b2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFF" stop-opacity="0.05"/></linearGradient><linearGradient id="b5" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><filter id="ds" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="3.5"/><feOffset dx="0" dy="5" result="offsetblur"/><feFlood flood-color="#0F172A" flood-opacity="0.65"/><feComposite in2="offsetblur" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><clipPath id="cd1"><polygon points="80,42 120,42 150,72 164,92 100,178 36,92 50,72"/></clipPath></defs><g filter="url(#ds)"><polygon points="80,42 120,42 150,72 164,92 100,178 36,92 50,72" fill="url(#b1)" stroke="#E0F2FE" stroke-width="1.4"/><g clip-path="url(#cd1)"><polygon points="80,42 120,42 110,68 90,68" fill="#FFF" opacity="0.7"/><polygon points="80,42 90,68 50,72" fill="#BFDBFE" opacity="0.7"/><polygon points="120,42 150,72 110,68" fill="#BFDBFE" opacity="0.7"/><polygon points="50,72 90,68 100,86 36,92" fill="#93C5FD" opacity="0.55"/><polygon points="150,72 110,68 100,86 164,92" fill="#93C5FD" opacity="0.55"/><polygon points="36,92 100,86 100,178" fill="#0F172A" opacity="0.5"/><polygon points="164,92 100,86 100,178" fill="#1E3A8A" opacity="0.55"/></g><line x1="36" y1="92" x2="164" y2="92" stroke="#FFF" stroke-width="0.6" opacity="0.45"/><polyline points="50,72 90,68 110,68 150,72" stroke="#FFF" stroke-width="0.4" fill="none" opacity="0.4"/><g clip-path="url(#cd1)"><rect class="shine-band" x="-50" y="20" width="55" height="180" fill="url(#b5)" transform="skewX(-18)"/></g></g></svg></body></html>`;

interface Props {
  size?: number;
  style?: ViewStyle;
}

export default function PlusDiamondIcon({ size = 48, style }: Props) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          backgroundColor: 'transparent',
          // ★ 2026-04-29: RN shadow — kart üzerinde 3D yüzme hissi (mavi tinted)
          shadowColor: '#1E3A8A',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.55,
          shadowRadius: 8,
          elevation: 8,
        },
        style,
      ]}
    >
      <WebView
        source={{ html: PLUS_DIAMOND_HTML }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={false}
        scalesPageToFit
        bounces={false}
        androidLayerType="hardware"
        // @ts-ignore
        opaque={false}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      />
    </View>
  );
}
