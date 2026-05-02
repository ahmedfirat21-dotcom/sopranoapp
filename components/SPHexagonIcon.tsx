// ★ 2026-04-29 (v92 1 May 2026 update): SP puan ana ikonu — DiscoverWelcomeSheet
//   slide 4'teki altın hexagon mücevher animasyonu, reusable bileşen.
//
//   v92 (1 May 2026): tier prop'u eklendi — SP miktarına göre hexagon paleti
//   değişir (basic teal / premium altın / elite pembe / legendary mor).
//   SPDonateSheet panel içinde miktar arttıkça anlık tier transition için.
//
//   Kullanım yerleri:
//   - Profil cüzdan kartı (ana gösterge, tier='premium' default)
//   - SPDonateSheet panel içi (miktara göre dinamik tier)
//   - Onboarding slide 4
//   - SP Sent / SP Received modallarında tier-aware
//
//   Performance notu: Her instance bir WebView başlatır (yaklaşık 5-10MB RAM).
//   Sadece "ana SP göstergesi" yerlerde kullan; küçük header diamond ikonları
//   için Ionicons name="diamond" yeterli.
import React, { useMemo } from 'react';
import { View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export type SPHexTier = 'basic' | 'premium' | 'elite' | 'legendary';

// ─── Tier paletleri ─────────────────────────────────────
// 4 stop renk grubu: highlight → mid → deep → shadow
// + accent: ring/halo/facet için kullanılan tek vurgu rengi
interface PaletteSpec {
  highlight: string;  // %0
  mid:       string;  // %35
  deep:      string;  // %70
  shadow:    string;  // %100
  accent:    string;  // ring/halo
  accentSoft: string; // facet-2/3
  haloRing:  string;  // outer halo
  textColor: string;  // SP yazı rengi
}

const PALETTES: Record<SPHexTier, PaletteSpec> = {
  basic: {
    highlight: '#CFFAFE',
    mid:       '#5EEAD4',
    deep:      '#14B8A6',
    shadow:    '#134E4A',
    accent:    '#5EEAD4',
    accentSoft:'#CFFAFE',
    haloRing:  '#5EEAD4',
    textColor: '#0F3F3A',
  },
  premium: {
    highlight: '#FFE082',
    mid:       '#FAC775',
    deep:      '#EF9F27',
    shadow:    '#854F0B',
    accent:    '#FFE082',
    accentSoft:'#FAC775',
    haloRing:  '#FAC775',
    textColor: '#4A2800',
  },
  elite: {
    highlight: '#FBCFE8',
    mid:       '#F9A8D4',
    deep:      '#EC4899',
    shadow:    '#831843',
    accent:    '#FBCFE8',
    accentSoft:'#F9A8D4',
    haloRing:  '#F9A8D4',
    textColor: '#581031',
  },
  legendary: {
    highlight: '#EDE9FE',
    mid:       '#C4B5FD',
    deep:      '#7C3AED',
    shadow:    '#3B0764',
    accent:    '#DDD6FE',
    accentSoft:'#C4B5FD',
    haloRing:  '#C4B5FD',
    textColor: '#2E1065',
  },
};

// ─── HTML üretici — palette + animasyon parametreleri ─────────────────────
// ★ v92.5 (1 May 2026): rich=true ise DiscoverWelcomeSheet kalitesinde extra
//   katmanlar (orbiters, rotating rays, twinkle stars). Hero yerlerde (success
//   modal) bu zenginlik kullanılır; küçük chip'lerde rich=false.
function buildHexagonHTML(p: PaletteSpec, rich: boolean = false): string {
  const richExtras = rich ? `<g class="rays" opacity="0.22"><line x1="100" y1="18" x2="100" y2="34" stroke="${p.accent}" stroke-width="1.5" stroke-linecap="round"/><line x1="100" y1="166" x2="100" y2="182" stroke="${p.accent}" stroke-width="1.5" stroke-linecap="round"/><line x1="18" y1="100" x2="34" y2="100" stroke="${p.accent}" stroke-width="1.5" stroke-linecap="round"/><line x1="166" y1="100" x2="182" y2="100" stroke="${p.accent}" stroke-width="1.5" stroke-linecap="round"/><line x1="42" y1="42" x2="54" y2="54" stroke="${p.accent}" stroke-width="1.2" stroke-linecap="round"/><line x1="146" y1="54" x2="158" y2="42" stroke="${p.accent}" stroke-width="1.2" stroke-linecap="round"/><line x1="42" y1="158" x2="54" y2="146" stroke="${p.accent}" stroke-width="1.2" stroke-linecap="round"/><line x1="146" y1="146" x2="158" y2="158" stroke="${p.accent}" stroke-width="1.2" stroke-linecap="round"/></g>` : '';
  const richStars = rich ? `<g class="star-1"><path d="M75 60L76.2 63.8 80 65 76.2 66.2 75 70 73.8 66.2 70 65 73.8 63.8Z" fill="#FFF"/></g><g class="star-2"><path d="M130 80L131 83 134 84 131 85 130 88 129 85 126 84 129 83Z" fill="#FFF"/></g><g class="star-3"><circle cx="60" cy="100" r="1.5" fill="#FFF"/></g><g class="star-4"><circle cx="115" cy="120" r="1.2" fill="#FFF"/></g><g class="star-5"><circle cx="90" cy="55" r="1" fill="#FFF"/></g>` : '';
  const richOrbiters = rich ? `<g class="orbiter-cw"><circle cx="185" cy="100" r="2.5" fill="${p.highlight}"/></g><g class="orbiter-ccw"><circle cx="15" cy="100" r="2" fill="${p.accent}" opacity="0.7"/></g>` : '';
  const richKeyframes = rich ? `@keyframes orbit-cw{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes orbit-ccw{0%{transform:rotate(360deg)}100%{transform:rotate(0deg)}}@keyframes ray-rotate{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes star-twinkle-pop{0%,100%{opacity:0;transform:scale(0)}35%,65%{opacity:1;transform:scale(1)}}.orbiter-cw{animation:orbit-cw 7s linear infinite;transform-origin:100px 100px;transform-box:view-box}.orbiter-ccw{animation:orbit-ccw 9s linear infinite;transform-origin:100px 100px;transform-box:view-box}.rays{animation:ray-rotate 18s linear infinite;transform-origin:100px 100px;transform-box:view-box}.star-1{animation:star-twinkle-pop 2.4s ease-in-out infinite;transform-origin:75px 60px;transform-box:view-box}.star-2{animation:star-twinkle-pop 2.8s ease-in-out infinite;animation-delay:0.6s;transform-origin:130px 80px;transform-box:view-box}.star-3{animation:star-twinkle-pop 2.2s ease-in-out infinite;animation-delay:1.1s;transform-origin:60px 100px;transform-box:view-box}.star-4{animation:star-twinkle-pop 3s ease-in-out infinite;animation-delay:1.6s;transform-origin:115px 120px;transform-box:view-box}.star-5{animation:star-twinkle-pop 2.6s ease-in-out infinite;animation-delay:0.3s;transform-origin:90px 55px;transform-box:view-box}` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center}svg{width:100%;height:100%}@keyframes gem-float{0%,100%{transform:translateY(0) rotate(-1.5deg) scale(1)}50%{transform:translateY(-3px) rotate(1.5deg) scale(1.04)}}@keyframes shine-march{0%{transform:translateX(-160px)}100%{transform:translateX(160px)}}@keyframes facet-bright{0%,100%{opacity:0.15}50%{opacity:0.55}}@keyframes facet-bright-2{0%,100%{opacity:0.4}50%{opacity:0.85}}@keyframes halo-breathe{0%,100%{opacity:0.25}50%{opacity:0.7}}@keyframes ring-expand{0%{opacity:0.6;transform:scale(0.9)}100%{opacity:0;transform:scale(1.25)}}@keyframes bg-shimmer{0%,100%{opacity:0.5}50%{opacity:1}}.gem-float{animation:gem-float 3.5s ease-in-out infinite;transform-origin:100px 100px;transform-box:view-box;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))}.shine-band{animation:shine-march 3.2s ease-in-out infinite}.facet-1{animation:facet-bright 2.4s ease-in-out infinite}.facet-2{animation:facet-bright-2 2.8s ease-in-out infinite;animation-delay:0.4s}.facet-3{animation:facet-bright 3.2s ease-in-out infinite;animation-delay:0.8s}.facet-4{animation:facet-bright-2 2.6s ease-in-out infinite;animation-delay:1.2s}.halo{animation:halo-breathe 3s ease-in-out infinite}.ring-A{animation:ring-expand 3.2s ease-out infinite;transform-origin:100px 100px;transform-box:view-box}.ring-B{animation:ring-expand 3.2s ease-out infinite;animation-delay:1.6s;transform-origin:100px 100px;transform-box:view-box}.bg-glow{animation:bg-shimmer 3s ease-in-out infinite}${richKeyframes}</style></head><body><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g1" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="${p.highlight}"/><stop offset="35%" stop-color="${p.mid}"/><stop offset="70%" stop-color="${p.deep}"/><stop offset="100%" stop-color="${p.shadow}"/></linearGradient><linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.3"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient><radialGradient id="g4" cx="50%" cy="50%"><stop offset="0%" stop-color="${p.accent}" stop-opacity="0.4"/><stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/></radialGradient><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFF" stop-opacity="0.65"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><clipPath id="c1"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72"/></clipPath></defs><g class="bg-glow"><circle cx="100" cy="100" r="98" fill="url(#g4)"/></g>${richExtras}<g class="halo"><polygon points="100,28 168,68 168,132 100,172 32,132 32,68" fill="none" stroke="${p.haloRing}" stroke-width="0.7" opacity="0.5"/></g><polygon class="ring-A" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="${p.accent}" stroke-width="1" opacity="0.6"/><polygon class="ring-B" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="${p.deep}" stroke-width="1" opacity="0.5"/><g class="gem-float"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72" fill="url(#g1)" stroke="${p.accent}" stroke-width="1"/><g clip-path="url(#c1)"><polygon points="100,40 156,72 100,104 44,72" fill="url(#g2)" opacity="0.6"/><polygon points="156,72 156,128 130,100" fill="url(#g3)" opacity="0.7"/></g><polygon class="facet-1" points="100,40 130,57 100,74 70,57" fill="#FFF"/><polygon class="facet-2" points="100,40 70,57 44,72" fill="${p.accent}"/><polygon class="facet-3" points="100,40 130,57 156,72" fill="${p.accent}"/><polygon class="facet-4" points="44,72 70,90 70,110 44,128" fill="#000" opacity="0.25"/>${richStars}<g clip-path="url(#c1)"><rect class="shine-band" x="-30" y="20" width="50" height="160" fill="url(#g5)" transform="skewX(-15)"/></g><text x="100" y="112" text-anchor="middle" font-family="Georgia,serif" font-size="32" font-weight="500" fill="${p.textColor}">SP</text></g>${richOrbiters}</svg></body></html>`;
}

// ★ Backward compat — eski yerler hâlâ premium altın paletini kullanıyor
export const SP_HEXAGON_HTML = buildHexagonHTML(PALETTES.premium);

interface Props {
  size?: number;
  style?: ViewStyle;
  /** ★ v92: SP miktarına göre tier — basic/premium/elite/legendary palet seçer */
  tier?: SPHexTier;
  /** ★ v92.5: Hero yerlerde extra animasyon katmanları (orbiters, rays, twinkle stars).
   *  DiscoverWelcomeSheet kalitesi — sadece success modal gibi büyük instance'larda kullan. */
  rich?: boolean;
}

export default function SPHexagonIcon({ size = 48, style, tier = 'premium', rich = false }: Props) {
  const html = useMemo(() => buildHexagonHTML(PALETTES[tier], rich), [tier, rich]);
  return (
    <View style={[{ width: size, height: size, backgroundColor: 'transparent' }, style]}>
      <WebView
        source={{ html }}
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
