// ★ 2026-04-29: SP puan ana ikonu — DiscoverWelcomeSheet slide 4'teki altın hexagon
//   mücevher animasyonu, reusable bileşen olarak. WebView ile inline SVG/CSS animasyonu render edilir.
//
//   Kullanım yerleri:
//   - Profil cüzdan kartı (büyük, ana gösterge)
//   - Onboarding slide 4 (zaten kullanılıyor)
//   - SP Store / SP transactions modal'ları (gelecekte)
//
//   Performance notu: Her instance bir WebView başlatır (yaklaşık 5-10MB RAM).
//   Bu yüzden sadece "ana SP göstergesi" yerlerde kullan; küçük header diamond
//   ikonları için Ionicons name="diamond" yeterli.
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

// ★ Responsive — SVG container'ı tamamen doldurur (width/height 100%)
// ★ 2026-04-30 v4: yıldız twinkle'ları kaldırıldı (SP yazısının yanında "+" görüntüsü
//   yaratıyordu). Glow halo güçlendirildi (#FFE082 0.4, r=98), gem-float'a scale(1.04)
//   ve drop-shadow eklendi. Sade hexagon: gem-float + halo + ring-expand + facet-bright
//   + shine-march korundu — yumuşak.
export const SP_HEXAGON_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center}svg{width:100%;height:100%}@keyframes gem-float{0%,100%{transform:translateY(0) rotate(-1.5deg) scale(1)}50%{transform:translateY(-3px) rotate(1.5deg) scale(1.04)}}@keyframes shine-march{0%{transform:translateX(-160px)}100%{transform:translateX(160px)}}@keyframes facet-bright{0%,100%{opacity:0.15}50%{opacity:0.55}}@keyframes facet-bright-2{0%,100%{opacity:0.4}50%{opacity:0.85}}@keyframes halo-breathe{0%,100%{opacity:0.25}50%{opacity:0.7}}@keyframes ring-expand{0%{opacity:0.6;transform:scale(0.9)}100%{opacity:0;transform:scale(1.25)}}@keyframes bg-shimmer{0%,100%{opacity:0.5}50%{opacity:1}}.gem-float{animation:gem-float 3.5s ease-in-out infinite;transform-origin:100px 100px;transform-box:view-box;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))}.shine-band{animation:shine-march 3.2s ease-in-out infinite}.facet-1{animation:facet-bright 2.4s ease-in-out infinite}.facet-2{animation:facet-bright-2 2.8s ease-in-out infinite;animation-delay:0.4s}.facet-3{animation:facet-bright 3.2s ease-in-out infinite;animation-delay:0.8s}.facet-4{animation:facet-bright-2 2.6s ease-in-out infinite;animation-delay:1.2s}.halo{animation:halo-breathe 3s ease-in-out infinite}.ring-A{animation:ring-expand 3.2s ease-out infinite;transform-origin:100px 100px;transform-box:view-box}.ring-B{animation:ring-expand 3.2s ease-out infinite;animation-delay:1.6s;transform-origin:100px 100px;transform-box:view-box}.bg-glow{animation:bg-shimmer 3s ease-in-out infinite}</style></head><body><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g1" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FFE082"/><stop offset="35%" stop-color="#FAC775"/><stop offset="70%" stop-color="#EF9F27"/><stop offset="100%" stop-color="#854F0B"/></linearGradient><linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.3"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient><radialGradient id="g4" cx="50%" cy="50%"><stop offset="0%" stop-color="#FFE082" stop-opacity="0.4"/><stop offset="100%" stop-color="#FFE082" stop-opacity="0"/></radialGradient><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFF" stop-opacity="0.65"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><clipPath id="c1"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72"/></clipPath></defs><g class="bg-glow"><circle cx="100" cy="100" r="98" fill="url(#g4)"/></g><g class="halo"><polygon points="100,28 168,68 168,132 100,172 32,132 32,68" fill="none" stroke="#FAC775" stroke-width="0.7" opacity="0.5"/></g><polygon class="ring-A" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="#FFE082" stroke-width="1" opacity="0.6"/><polygon class="ring-B" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="#EF9F27" stroke-width="1" opacity="0.5"/><g class="gem-float"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72" fill="url(#g1)" stroke="#FFE082" stroke-width="1"/><g clip-path="url(#c1)"><polygon points="100,40 156,72 100,104 44,72" fill="url(#g2)" opacity="0.6"/><polygon points="156,72 156,128 130,100" fill="url(#g3)" opacity="0.7"/></g><polygon class="facet-1" points="100,40 130,57 100,74 70,57" fill="#FFF"/><polygon class="facet-2" points="100,40 70,57 44,72" fill="#FFE082"/><polygon class="facet-3" points="100,40 130,57 156,72" fill="#FFE082"/><polygon class="facet-4" points="44,72 70,90 70,110 44,128" fill="#000" opacity="0.25"/><g clip-path="url(#c1)"><rect class="shine-band" x="-30" y="20" width="50" height="160" fill="url(#g5)" transform="skewX(-15)"/></g><text x="100" y="112" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="500" fill="#4A2800">SP</text></g></svg></body></html>`;

interface Props {
  size?: number;
  style?: ViewStyle;
}

export default function SPHexagonIcon({ size = 48, style }: Props) {
  return (
    <View style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}>
      <WebView
        source={{ html: SP_HEXAGON_HTML }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={false}
        scalesPageToFit
        bounces={false}
        androidLayerType="hardware"
        // ★ 2026-04-29: opaque=false → şeffaf zemin için zorunlu (Android)
        // @ts-ignore — WebViewProps tip eksikliği
        opaque={false}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      />
    </View>
  );
}
