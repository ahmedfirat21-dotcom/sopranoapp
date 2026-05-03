// ★ v107 (3 May 2026): Maison Soprano — ürün başına 3D SVG illustration HTML'leri.
//
// Her ürün için bağımsız HTML doc (transparent bg). WebView içinde mount edilir,
// kartın art alanına oturur. Pattern: faceted SVG + multi-stop gradient + shine sweep
// + drop-shadow üçlüsü (renkli glow + altın glow + alt-koyu lift).

const STAGE_CSS = `
  html,body{margin:0;padding:0;background:transparent;overflow:hidden;width:100%;height:100%;}
  body{display:flex;align-items:center;justify-content:center;}
  *{box-sizing:border-box;}
`;

const COMMON_KEYFRAMES = `
@keyframes idle-3d { 0%,100% { transform: translateY(0) rotateZ(-1.5deg) scale(1); } 50% { transform: translateY(-4px) rotateZ(1.5deg) scale(1.02); } }
@keyframes facet-tw-1 { 0%,100% { opacity: 0.3; } 30% { opacity: 1; } }
@keyframes facet-tw-2 { 0%,100% { opacity: 0.5; } 60% { opacity: 1; } }
@keyframes facet-tw-3 { 0%,100% { opacity: 0.4; } 45% { opacity: 0.95; } }
@keyframes shine-march { 0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateX(200%) skewX(-15deg); opacity: 0; } }
@keyframes pulse-soft { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes ring-pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
.fac-tw-1 { animation: facet-tw-1 2.4s ease-in-out infinite; }
.fac-tw-2 { animation: facet-tw-2 2.8s ease-in-out infinite 0.4s; }
.fac-tw-3 { animation: facet-tw-3 3.2s ease-in-out infinite 0.8s; }
.shine-band { animation: shine-march 3.5s ease-in-out infinite; }
/* ★ v107 hotfix: ürün figürünün kendisi sallanmasın — sadece ışık/parıltı kalsın.
   facet-tw / shine-band / tw-* (yıldız) parıltılar hariç tüm hareket animasyonları kapatıldı.
   .snow-3d HARIÇ — buz tanesi yavaş dönüyor (kullanıcı isteği), kar kristali için doğal. */
.crown-3d, .planet-3d, .bolt-3d, .volcano-3d, .lava,
.const-3d, .star-3d, .flame-3d, .volt-3d, .heart-3d, .rose-3d,
.anchor-3d, .flr-3d, .leaf-3d, .bg-rays,
.bolt-pulse-ring, .bolt-pulse-ring-2 { animation: none !important; }
`;

// ─── Phoenix Diadem — gerçek 3D faceted taç (sopranochat_diadem_royale_true_3d.html) ──
const PHOENIX_DIADEM_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
.crown-3d { animation: idle-3d 4s ease-in-out infinite; filter: drop-shadow(0 0 16px rgba(244,114,182,0.55)) drop-shadow(0 0 30px rgba(255,224,130,0.35)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
</style></head><body>
<svg class="crown-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="c3d-body" x1="20%" y1="0%" x2="80%" y2="100%">
<stop offset="0%" stop-color="#FFFFFF"/><stop offset="10%" stop-color="#FFF4D6"/><stop offset="25%" stop-color="#FFE082"/><stop offset="50%" stop-color="#FAC775"/><stop offset="75%" stop-color="#EF9F27"/><stop offset="92%" stop-color="#854F0B"/><stop offset="100%" stop-color="#3D1F00"/>
</linearGradient>
<linearGradient id="c3d-top-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.4"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="c3d-bottom-dark" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.6"/></linearGradient>
<linearGradient id="c3d-left-dark" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000000" stop-opacity="0.4"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></linearGradient>
<linearGradient id="c3d-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<radialGradient id="c3d-ruby-faceted" cx="40%" cy="30%" r="65%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="15%" stop-color="#FCE7F3"/><stop offset="40%" stop-color="#F472B6"/><stop offset="75%" stop-color="#BE185D"/><stop offset="100%" stop-color="#500724"/></radialGradient>
<radialGradient id="c3d-ruby-shine" cx="35%" cy="25%" r="50%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="60%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="c3d-sapph-faceted" cx="40%" cy="30%" r="65%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="15%" stop-color="#DBEAFE"/><stop offset="40%" stop-color="#60A5FA"/><stop offset="75%" stop-color="#1E40AF"/><stop offset="100%" stop-color="#1E1B4B"/></radialGradient>
<clipPath id="c3d-mask"><path d="M 18 70 L 22 38 L 35 50 L 50 22 L 65 50 L 78 38 L 82 70 Z"/></clipPath>
<filter id="c3d-bloom"><feGaussianBlur stdDeviation="0.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<path d="M 19 71 L 23 39 L 36 51 L 51 23 L 66 51 L 79 39 L 83 71 Z" fill="#000" opacity="0.5" filter="url(#c3d-bloom)"/>
<path d="M 18 70 L 22 38 L 35 50 L 50 22 L 65 50 L 78 38 L 82 70 Z" fill="url(#c3d-body)" stroke="#FFF4D6" stroke-width="1"/>
<g clip-path="url(#c3d-mask)">
<polygon points="22,38 50,22 78,38 50,52" fill="url(#c3d-top-shine)" opacity="0.7"/>
<polygon points="18,70 22,38 50,52 50,70" fill="url(#c3d-left-dark)" opacity="0.55"/>
<polygon points="50,52 50,70 82,70 78,38" fill="url(#c3d-bottom-dark)" opacity="0.5"/>
<polygon class="fac-tw-1" points="22,38 35,50 50,22" fill="#FFFFFF" opacity="0.55"/>
<polygon class="fac-tw-2" points="78,38 65,50 50,22" fill="#FFE082" opacity="0.5"/>
<polygon class="fac-tw-3" points="35,50 65,50 50,22" fill="#FFFFFF" opacity="0.45"/>
<polygon points="22,38 35,50 50,22" fill="none" stroke="#FFFFFF" stroke-width="0.4" opacity="0.5"/>
<polygon points="78,38 65,50 50,22" fill="none" stroke="#FFFFFF" stroke-width="0.4" opacity="0.5"/>
<line x1="50" y1="22" x2="50" y2="70" stroke="#FFFFFF" stroke-width="0.3" opacity="0.35"/>
<rect class="shine-band" x="-30" y="0" width="25" height="100" fill="url(#c3d-sweep)"/>
</g>
<path d="M 18 70 L 22 38 L 35 50 L 50 22 L 65 50 L 78 38 L 82 70 Z" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.7"/>
<rect x="16" y="68" width="68" height="7" fill="url(#c3d-body)" stroke="#FFF4D6" stroke-width="0.8" rx="1.5"/>
<rect x="16" y="68" width="68" height="3" fill="url(#c3d-top-shine)" rx="1.5"/>
<rect x="16" y="73" width="68" height="2" fill="#000" opacity="0.3" rx="1.5"/>
<g filter="url(#c3d-bloom)">
<polygon points="50,16 56,22 50,28 44,22" fill="url(#c3d-ruby-faceted)" stroke="#FCE7F3" stroke-width="0.4"/>
<polygon points="50,16 53,22 50,24 47,22" fill="url(#c3d-ruby-shine)"/>
<polygon points="50,16 56,22 50,24 44,22" fill="#FFFFFF" opacity="0.45"/>
</g>
<g><polygon points="22,34 26,38 22,42 18,38" fill="url(#c3d-sapph-faceted)" stroke="#DBEAFE" stroke-width="0.4"/><polygon points="22,34 24,38 22,40 20,38" fill="#FFFFFF" opacity="0.65"/></g>
<g><polygon points="78,34 82,38 78,42 74,38" fill="url(#c3d-sapph-faceted)" stroke="#DBEAFE" stroke-width="0.4"/><polygon points="78,34 80,38 78,40 76,38" fill="#FFFFFF" opacity="0.65"/></g>
<g><polygon points="35,46 38,50 35,54 32,50" fill="url(#c3d-ruby-faceted)" stroke="#FCE7F3" stroke-width="0.3"/></g>
<g><polygon points="65,46 68,50 65,54 62,50" fill="url(#c3d-ruby-faceted)" stroke="#FCE7F3" stroke-width="0.3"/></g>
</svg>
</body></html>`;

// ─── Galactique — premium 3D küre + halka ──
const GALACTIQUE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
@keyframes drift-planet { 0%,100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(2px, -3px) rotate(2deg); } }
.planet-3d { animation: drift-planet 5s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(167,139,250,0.65)) drop-shadow(0 0 36px rgba(255,224,130,0.3)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
</style></head><body>
<svg class="planet-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<radialGradient id="p3d-body" cx="32%" cy="28%" r="85%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="8%" stop-color="#FAF5FF"/><stop offset="20%" stop-color="#DDD6FE"/><stop offset="40%" stop-color="#C4B5FD"/><stop offset="60%" stop-color="#A78BFA"/><stop offset="78%" stop-color="#7C3AED"/><stop offset="92%" stop-color="#4C1D95"/><stop offset="100%" stop-color="#1E0A47"/></radialGradient>
<radialGradient id="p3d-rim-shadow" cx="50%" cy="50%" r="50%"><stop offset="70%" stop-color="#000" stop-opacity="0"/><stop offset="92%" stop-color="#000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0.85"/></radialGradient>
<radialGradient id="p3d-specular" cx="32%" cy="25%" r="35%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.4"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="p3d-rim-light" cx="80%" cy="75%" r="40%"><stop offset="0%" stop-color="#A78BFA" stop-opacity="0.7"/><stop offset="100%" stop-color="#A78BFA" stop-opacity="0"/></radialGradient>
<linearGradient id="p3d-ring-back" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#854F0B" stop-opacity="0.4"/><stop offset="20%" stop-color="#FFE082" stop-opacity="0.95"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="1"/><stop offset="80%" stop-color="#FFE082" stop-opacity="0.95"/><stop offset="100%" stop-color="#854F0B" stop-opacity="0.4"/></linearGradient>
<linearGradient id="p3d-ring-front" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#854F0B" stop-opacity="0.5"/><stop offset="15%" stop-color="#EF9F27" stop-opacity="1"/><stop offset="50%" stop-color="#FFE082" stop-opacity="1"/><stop offset="85%" stop-color="#EF9F27" stop-opacity="1"/><stop offset="100%" stop-color="#854F0B" stop-opacity="0.5"/></linearGradient>
<linearGradient id="p3d-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.8"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<clipPath id="p3d-sphere-clip"><circle cx="50" cy="50" r="22"/></clipPath>
<filter id="p3d-bloom"><feGaussianBlur stdDeviation="0.6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<ellipse cx="50" cy="55" rx="40" ry="10" fill="none" stroke="url(#p3d-ring-back)" stroke-width="3.5" opacity="0.95"/>
<ellipse cx="50" cy="55" rx="40" ry="10" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.5"/>
<circle cx="51" cy="51" r="22.5" fill="#000" opacity="0.5" filter="url(#p3d-bloom)"/>
<circle cx="50" cy="50" r="22" fill="url(#p3d-body)" stroke="#DDD6FE" stroke-width="0.6"/>
<g clip-path="url(#p3d-sphere-clip)">
<rect x="28" y="28" width="44" height="44" fill="url(#p3d-rim-shadow)"/>
<circle cx="50" cy="50" r="22" fill="url(#p3d-rim-light)"/>
<ellipse cx="40" cy="38" rx="14" ry="8" fill="url(#p3d-specular)" filter="url(#p3d-bloom)"/>
<ellipse cx="38" cy="36" rx="6" ry="3" fill="#FFFFFF" opacity="0.95" filter="url(#p3d-bloom)"/>
<ellipse cx="42" cy="46" rx="9" ry="2.5" fill="#7C3AED" opacity="0.6" transform="rotate(-12 42 46)"/>
<ellipse cx="58" cy="58" rx="11" ry="2.5" fill="#4C1D95" opacity="0.55" transform="rotate(8 58 58)"/>
<ellipse cx="38" cy="58" rx="6" ry="1.8" fill="#7C3AED" opacity="0.5" transform="rotate(-15 38 58)"/>
<ellipse cx="60" cy="42" rx="5" ry="1.5" fill="#A78BFA" opacity="0.4" transform="rotate(15 60 42)"/>
<circle cx="65" cy="55" r="3" fill="#000" opacity="0.5"/>
<circle cx="64" cy="55" r="0.8" fill="#FFFFFF" opacity="0.6"/>
</g>
<path d="M 10 55 Q 50 64 90 55" fill="none" stroke="url(#p3d-ring-front)" stroke-width="4"/>
<path d="M 10 55 Q 50 60 90 55" fill="none" stroke="#FFFFFF" stroke-width="0.4" opacity="0.7"/>
<rect class="shine-band" x="-30" y="28" width="22" height="44" fill="url(#p3d-sweep)" clip-path="url(#p3d-sphere-clip)"/>
</svg>
</body></html>`;

// ─── Aurum Strike — premium 3D şimşek + frame zemin + dönen rays + 2 pulse halka ──
//   ★ FULL CARD: tüm kart zemini HTML içinde (frame bg + box-shadow + conic rays)
const AURUM_STRIKE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
@keyframes rays-rotate { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
html,body{width:100%;height:100%;}
body{display:block;}
.frame-bolt {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 50% 30%, rgba(251,191,36,0.45), transparent 55%),
    linear-gradient(135deg, #1A1500 0%, #5C4612 50%, #854F0B 100%);
  box-shadow:
    inset 0 0 40px rgba(251,191,36,0.15),
    inset 0 0 0 1px rgba(251,191,36,0.5);
  overflow: hidden;
}
.bg-rays {
  position: absolute; top: 50%; left: 50%; width: 130%; aspect-ratio: 1; pointer-events: none;
  background:
    conic-gradient(from 0deg,
      transparent 0deg, rgba(255,255,255,0.07) 25deg, transparent 50deg,
      transparent 110deg, rgba(255,255,255,0.07) 135deg, transparent 160deg,
      transparent 220deg, rgba(255,255,255,0.07) 245deg, transparent 270deg);
  animation: rays-rotate 22s linear infinite;
  transform-origin: 50% 50%;
}
.bolt-stack { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.bolt-3d { animation: pulse-soft 2.5s ease-in-out infinite; filter: drop-shadow(0 0 24px rgba(255,224,130,0.85)) drop-shadow(0 0 48px rgba(251,191,36,0.5)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
.bolt-pulse-ring { position: absolute; inset: 28%; pointer-events: none; z-index: 1; animation: ring-pulse 2.4s ease-out infinite; }
.bolt-pulse-ring-2 { position: absolute; inset: 28%; pointer-events: none; z-index: 1; animation: ring-pulse 2.4s ease-out infinite 1.2s; }
.bolt-svg { width: 55%; height: 55%; position: relative; z-index: 5; }
</style></head><body>
<div class="frame-bolt">
  <div class="bg-rays"></div>
  <div class="bolt-stack">
    <svg class="bolt-pulse-ring" viewBox="0 0 100 100"><polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12" fill="none" stroke="#FFE082" stroke-width="2"/></svg>
    <svg class="bolt-pulse-ring-2" viewBox="0 0 100 100"><polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12" fill="none" stroke="#EF9F27" stroke-width="2"/></svg>
    <svg class="bolt-3d bolt-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="b3d-body" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="8%" stop-color="#FFF4D6"/><stop offset="22%" stop-color="#FFE082"/><stop offset="48%" stop-color="#FAC775"/><stop offset="72%" stop-color="#EF9F27"/><stop offset="92%" stop-color="#854F0B"/><stop offset="100%" stop-color="#3D1F00"/></linearGradient>
        <linearGradient id="b3d-top-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.5"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
        <linearGradient id="b3d-bottom-dark" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></linearGradient>
        <linearGradient id="b3d-left-dark" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.4"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient>
        <linearGradient id="b3d-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
        <radialGradient id="b3d-inner-glow" cx="50%" cy="50%" r="40%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#FFE082" stop-opacity="0"/></radialGradient>
        <clipPath id="b3d-mask"><polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12"/></clipPath>
        <filter id="b3d-bloom"><feGaussianBlur stdDeviation="1" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <polygon points="56,14 33,53 49,53 43,89 71,47 54,47 61,14" fill="#000" opacity="0.5" filter="url(#b3d-bloom)"/>
      <polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12" fill="url(#b3d-body)" stroke="#FFF4D6" stroke-width="1.2"/>
      <g clip-path="url(#b3d-mask)">
        <polygon points="55,12 60,12 53,46 70,46 42,88 48,52 32,52" fill="url(#b3d-top-shine)" opacity="0.55"/>
        <polygon points="55,12 32,52 48,52" fill="url(#b3d-left-dark)" opacity="0.5"/>
        <polygon points="48,52 42,88 53,46" fill="url(#b3d-left-dark)" opacity="0.4"/>
        <polygon points="60,12 70,46 53,46" fill="url(#b3d-bottom-dark)" opacity="0.4"/>
        <polygon points="42,88 70,46 53,46" fill="url(#b3d-bottom-dark)" opacity="0.5"/>
        <polygon class="fac-tw-1" points="55,12 60,12 56,28 50,28" fill="#FFFFFF" opacity="0.7"/>
        <polygon class="fac-tw-2" points="42,88 48,52 53,46" fill="#FFE082" opacity="0.6"/>
        <polygon class="fac-tw-3" points="48,52 53,46 70,46" fill="#FFFFFF" opacity="0.4"/>
        <polygon points="46,32 53,32 51,42 48,42" fill="url(#b3d-inner-glow)" filter="url(#b3d-bloom)"/>
        <polygon points="55,12 32,52 48,52" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.6"/>
        <polygon points="60,12 70,46 53,46" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.5"/>
        <line x1="48" y1="52" x2="42" y2="88" stroke="#FFFFFF" stroke-width="0.4" opacity="0.4"/>
        <line x1="53" y1="46" x2="42" y2="88" stroke="#000" stroke-width="0.4" opacity="0.4"/>
        <line x1="55" y1="12" x2="50" y2="32" stroke="#FFFFFF" stroke-width="0.3" opacity="0.65"/>
        <line x1="60" y1="12" x2="55" y2="32" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
        <line x1="32" y1="52" x2="48" y2="52" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
        <rect class="shine-band" x="-30" y="0" width="22" height="100" fill="url(#b3d-sweep)"/>
      </g>
      <polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12" fill="none" stroke="#FFFFFF" stroke-width="0.6" opacity="0.85"/>
      <circle cx="42" cy="88" r="2.5" fill="#FFFFFF" opacity="0.95" filter="url(#b3d-bloom)"/>
      <circle cx="55" cy="12" r="1.8" fill="#FFFFFF" opacity="0.8" filter="url(#b3d-bloom)"/>
      <circle cx="36" cy="92" r="0.8" fill="#FFE082" opacity="0.9" filter="url(#b3d-bloom)"/>
      <circle cx="48" cy="92" r="0.6" fill="#FFE082" opacity="0.8" filter="url(#b3d-bloom)"/>
    </svg>
  </div>
</div>
</body></html>`;

// ─── Glacier Aura — premium 3D buz tanesi (sopranochat_glacier_and_vesuvius_3d.html) ──
//   v107 hotfix: 6 kol kristal kesim + her kolun üst yüzü açık / alt yüzü koyu (3D yüzey),
//   beyaz omurga ışığı, 6 yan dal facet, merkez baklava (4 katman). Eski 3-line cross
//   yapısı çıktı, yeni faceted hexagon yapı.
const GLACIER_AURA_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
@keyframes spin-snow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.snow-3d { animation: spin-snow 18s linear infinite; transform-origin: 50% 50%; filter: drop-shadow(0 0 20px rgba(34,211,238,0.7)) drop-shadow(0 0 40px rgba(207,250,254,0.4)) drop-shadow(0 6px 12px rgba(0,0,0,0.5)); }
</style></head><body>
<svg class="snow-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="g3d-arm-light" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="20%" stop-color="#F0F9FF"/><stop offset="50%" stop-color="#A5F3FC"/><stop offset="100%" stop-color="#67E8F9"/></linearGradient>
<linearGradient id="g3d-arm-dark" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#67E8F9"/><stop offset="50%" stop-color="#22D3EE"/><stop offset="100%" stop-color="#0E7490"/></linearGradient>
<linearGradient id="g3d-arm-side" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="50%" stop-color="#A5F3FC" stop-opacity="0.4"/><stop offset="100%" stop-color="#0E7490" stop-opacity="0.6"/></linearGradient>
<radialGradient id="g3d-core" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="#F0F9FF"/><stop offset="80%" stop-color="#A5F3FC"/><stop offset="100%" stop-color="#22D3EE"/></radialGradient>
<radialGradient id="g3d-core-shine" cx="35%" cy="35%" r="50%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<filter id="g3d-bloom"><feGaussianBlur stdDeviation="0.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g>
<g transform="translate(50 50) rotate(0)">
<polygon points="0,-36 -2.5,-8 0,-4 2.5,-8" fill="url(#g3d-arm-light)" stroke="#F0F9FF" stroke-width="0.5"/>
<polygon points="0,-36 -2.5,-8 0,-8" fill="url(#g3d-arm-side)" opacity="0.7"/>
<line x1="0" y1="-36" x2="0" y2="-8" stroke="#FFFFFF" stroke-width="0.5" opacity="0.95"/>
<polygon points="0,-26 -5,-22 -3,-19 0,-22" fill="url(#g3d-arm-light)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-26 5,-22 3,-19 0,-22" fill="url(#g3d-arm-dark)" stroke="#A5F3FC" stroke-width="0.4"/>
<line x1="0" y1="-26" x2="-5" y2="-22" stroke="#FFFFFF" stroke-width="0.3" opacity="0.6"/>
<polygon points="0,-18 -3,-15 -2,-13 0,-15" fill="url(#g3d-arm-light)" opacity="0.85"/>
<polygon points="0,-18 3,-15 2,-13 0,-15" fill="url(#g3d-arm-dark)" opacity="0.85"/>
</g>
<g transform="translate(50 50) rotate(60)">
<polygon points="0,-36 -2.5,-8 0,-4 2.5,-8" fill="url(#g3d-arm-light)" stroke="#F0F9FF" stroke-width="0.5"/>
<polygon points="0,-36 -2.5,-8 0,-8" fill="url(#g3d-arm-side)" opacity="0.7"/>
<line x1="0" y1="-36" x2="0" y2="-8" stroke="#FFFFFF" stroke-width="0.5" opacity="0.95"/>
<polygon points="0,-26 -5,-22 -3,-19 0,-22" fill="url(#g3d-arm-light)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-26 5,-22 3,-19 0,-22" fill="url(#g3d-arm-dark)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-18 -3,-15 -2,-13 0,-15" fill="url(#g3d-arm-light)" opacity="0.85"/>
<polygon points="0,-18 3,-15 2,-13 0,-15" fill="url(#g3d-arm-dark)" opacity="0.85"/>
</g>
<g transform="translate(50 50) rotate(120)">
<polygon points="0,-36 -2.5,-8 0,-4 2.5,-8" fill="url(#g3d-arm-light)" stroke="#F0F9FF" stroke-width="0.5"/>
<polygon points="0,-36 -2.5,-8 0,-8" fill="url(#g3d-arm-side)" opacity="0.7"/>
<line x1="0" y1="-36" x2="0" y2="-8" stroke="#FFFFFF" stroke-width="0.5" opacity="0.95"/>
<polygon points="0,-26 -5,-22 -3,-19 0,-22" fill="url(#g3d-arm-light)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-26 5,-22 3,-19 0,-22" fill="url(#g3d-arm-dark)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-18 -3,-15 -2,-13 0,-15" fill="url(#g3d-arm-light)" opacity="0.85"/>
<polygon points="0,-18 3,-15 2,-13 0,-15" fill="url(#g3d-arm-dark)" opacity="0.85"/>
</g>
<g transform="translate(50 50) rotate(180)">
<polygon points="0,-36 -2.5,-8 0,-4 2.5,-8" fill="url(#g3d-arm-light)" stroke="#F0F9FF" stroke-width="0.5"/>
<polygon points="0,-36 -2.5,-8 0,-8" fill="url(#g3d-arm-side)" opacity="0.7"/>
<line x1="0" y1="-36" x2="0" y2="-8" stroke="#FFFFFF" stroke-width="0.5" opacity="0.95"/>
<polygon points="0,-26 -5,-22 -3,-19 0,-22" fill="url(#g3d-arm-light)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-26 5,-22 3,-19 0,-22" fill="url(#g3d-arm-dark)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-18 -3,-15 -2,-13 0,-15" fill="url(#g3d-arm-light)" opacity="0.85"/>
<polygon points="0,-18 3,-15 2,-13 0,-15" fill="url(#g3d-arm-dark)" opacity="0.85"/>
</g>
<g transform="translate(50 50) rotate(240)">
<polygon points="0,-36 -2.5,-8 0,-4 2.5,-8" fill="url(#g3d-arm-light)" stroke="#F0F9FF" stroke-width="0.5"/>
<polygon points="0,-36 -2.5,-8 0,-8" fill="url(#g3d-arm-side)" opacity="0.7"/>
<line x1="0" y1="-36" x2="0" y2="-8" stroke="#FFFFFF" stroke-width="0.5" opacity="0.95"/>
<polygon points="0,-26 -5,-22 -3,-19 0,-22" fill="url(#g3d-arm-light)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-26 5,-22 3,-19 0,-22" fill="url(#g3d-arm-dark)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-18 -3,-15 -2,-13 0,-15" fill="url(#g3d-arm-light)" opacity="0.85"/>
<polygon points="0,-18 3,-15 2,-13 0,-15" fill="url(#g3d-arm-dark)" opacity="0.85"/>
</g>
<g transform="translate(50 50) rotate(300)">
<polygon points="0,-36 -2.5,-8 0,-4 2.5,-8" fill="url(#g3d-arm-light)" stroke="#F0F9FF" stroke-width="0.5"/>
<polygon points="0,-36 -2.5,-8 0,-8" fill="url(#g3d-arm-side)" opacity="0.7"/>
<line x1="0" y1="-36" x2="0" y2="-8" stroke="#FFFFFF" stroke-width="0.5" opacity="0.95"/>
<polygon points="0,-26 -5,-22 -3,-19 0,-22" fill="url(#g3d-arm-light)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-26 5,-22 3,-19 0,-22" fill="url(#g3d-arm-dark)" stroke="#A5F3FC" stroke-width="0.4"/>
<polygon points="0,-18 -3,-15 -2,-13 0,-15" fill="url(#g3d-arm-light)" opacity="0.85"/>
<polygon points="0,-18 3,-15 2,-13 0,-15" fill="url(#g3d-arm-dark)" opacity="0.85"/>
</g>
</g>
<polygon points="50,40 60,50 50,60 40,50" fill="url(#g3d-core)" stroke="#F0F9FF" stroke-width="0.6"/>
<polygon points="50,40 55,50 50,52 45,50" fill="url(#g3d-core-shine)"/>
<polygon points="50,40 55,45 50,50 45,45" fill="#FFFFFF" opacity="0.6"/>
<line x1="50" y1="40" x2="50" y2="60" stroke="#FFFFFF" stroke-width="0.4" opacity="0.6"/>
<line x1="40" y1="50" x2="60" y2="50" stroke="#FFFFFF" stroke-width="0.4" opacity="0.5"/>
<circle cx="50" cy="50" r="2" fill="#FFFFFF" filter="url(#g3d-bloom)"/>
</svg>
</body></html>`;

// ─── Vesuvius — premium 3D volkan + lava ──
const VESUVIUS_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
@keyframes lava-flicker { 0%,100% { opacity: 0.85; transform: scaleY(1); } 50% { opacity: 1; transform: scaleY(1.08); } }
.volcano-3d { animation: idle-3d 4s ease-in-out infinite; filter: drop-shadow(0 0 22px rgba(251,146,60,0.75)) drop-shadow(0 0 44px rgba(220,38,38,0.45)) drop-shadow(0 8px 16px rgba(0,0,0,0.65)); }
.lava { animation: lava-flicker 1.6s ease-in-out infinite; transform-origin: 50% 100%; }
</style></head><body>
<svg class="volcano-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="v-mountain" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#7F1D1D"/><stop offset="40%" stop-color="#5C2222"/><stop offset="80%" stop-color="#1A0A0A"/><stop offset="100%" stop-color="#000"/></linearGradient>
<linearGradient id="v-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.4"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="v-lava" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FEF3C7"/><stop offset="20%" stop-color="#FBBF24"/><stop offset="50%" stop-color="#FB923C"/><stop offset="78%" stop-color="#DC2626"/><stop offset="100%" stop-color="#7F1D1D"/></linearGradient>
<radialGradient id="v-glow" cx="50%" cy="35%" r="35%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="40%" stop-color="#FBBF24" stop-opacity="0.6"/><stop offset="100%" stop-color="#DC2626" stop-opacity="0"/></radialGradient>
<linearGradient id="v-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<clipPath id="v-mask"><path d="M 14 86 L 36 38 L 50 30 L 64 38 L 86 86 Z"/></clipPath>
<filter id="v-bloom"><feGaussianBlur stdDeviation="0.9" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<path d="M 14 88 L 36 40 L 50 32 L 64 40 L 86 88 Z" fill="#000" opacity="0.5" filter="url(#v-bloom)"/>
<path d="M 14 86 L 36 38 L 50 30 L 64 38 L 86 86 Z" fill="url(#v-mountain)" stroke="#7F1D1D" stroke-width="0.8"/>
<g clip-path="url(#v-mask)">
<polygon points="36,38 50,30 64,38 50,46" fill="url(#v-shine)" opacity="0.5"/>
<polygon points="14,86 36,38 50,46 50,86" fill="#000" opacity="0.35"/>
<line x1="50" y1="30" x2="50" y2="86" stroke="#FFFFFF" stroke-width="0.3" opacity="0.3"/>
<line x1="36" y1="38" x2="14" y2="86" stroke="#FFFFFF" stroke-width="0.4" opacity="0.45"/>
<line x1="64" y1="38" x2="86" y2="86" stroke="#000" stroke-width="0.4" opacity="0.4"/>
<rect class="shine-band" x="-30" y="0" width="22" height="100" fill="url(#v-sweep)"/>
</g>
<g class="lava">
<ellipse cx="50" cy="34" rx="14" ry="6" fill="url(#v-glow)" filter="url(#v-bloom)"/>
<path d="M 42 34 L 50 30 L 58 34 L 56 40 L 50 38 L 44 40 Z" fill="url(#v-lava)" stroke="#FEF3C7" stroke-width="0.4"/>
<path d="M 42 34 Q 38 48 36 60 Q 38 56 40 50 Q 42 44 44 38 Z" fill="url(#v-lava)" opacity="0.85"/>
<path d="M 58 34 Q 62 50 64 64 Q 62 58 60 52 Q 58 44 56 38 Z" fill="url(#v-lava)" opacity="0.85"/>
<circle cx="46" cy="50" r="1.5" fill="#FBBF24" opacity="0.9"/>
<circle cx="54" cy="58" r="1.2" fill="#FB923C" opacity="0.85"/>
<circle cx="48" cy="64" r="0.8" fill="#FEF3C7" opacity="0.95"/>
</g>
<circle cx="42" cy="22" r="1.2" fill="#FBBF24" opacity="0.85" filter="url(#v-bloom)"/>
<circle cx="58" cy="20" r="1" fill="#FFFFFF" opacity="0.7" filter="url(#v-bloom)"/>
<circle cx="50" cy="14" r="0.8" fill="#FB923C" opacity="0.8" filter="url(#v-bloom)"/>
</svg>
</body></html>`;

// ─── Constellation — featured: yıldız konstelasyonu ──
const CONSTELLATION_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
@keyframes star-tw { 0%,100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.15); } }
.const-3d { animation: idle-3d 5s ease-in-out infinite; filter: drop-shadow(0 0 20px rgba(255,224,130,0.85)) drop-shadow(0 0 40px rgba(251,191,36,0.4)) drop-shadow(0 6px 12px rgba(0,0,0,0.55)); }
.tw-a { animation: star-tw 1.8s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
.tw-b { animation: star-tw 2.2s ease-in-out infinite 0.4s; transform-origin: center; transform-box: fill-box; }
.tw-c { animation: star-tw 2.6s ease-in-out infinite 0.8s; transform-origin: center; transform-box: fill-box; }
.tw-d { animation: star-tw 2.0s ease-in-out infinite 1.1s; transform-origin: center; transform-box: fill-box; }
</style></head><body>
<svg class="const-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<radialGradient id="cn-star-big" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="#FFE082"/><stop offset="100%" stop-color="#FBBF24"/></radialGradient>
<radialGradient id="cn-star-sm" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#FCD34D"/></radialGradient>
<linearGradient id="cn-line" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFE082" stop-opacity="0"/><stop offset="50%" stop-color="#FFE082" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFE082" stop-opacity="0"/></linearGradient>
<filter id="cn-bloom"><feGaussianBlur stdDeviation="0.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g stroke="url(#cn-line)" stroke-width="0.8" opacity="0.7" fill="none">
<line x1="22" y1="32" x2="50" y2="48"/>
<line x1="50" y1="48" x2="78" y2="30"/>
<line x1="50" y1="48" x2="62" y2="76"/>
<line x1="62" y1="76" x2="32" y2="72"/>
<line x1="32" y1="72" x2="22" y2="32"/>
</g>
<g filter="url(#cn-bloom)">
<polygon class="tw-a" points="50,38 54,46 62,48 54,50 50,58 46,50 38,48 46,46" fill="url(#cn-star-big)" stroke="#FFFFFF" stroke-width="0.4"/>
<polygon class="tw-b" points="22,28 24,32 28,32 25,34 26,38 22,36 18,38 19,34 16,32 20,32" fill="url(#cn-star-sm)"/>
<polygon class="tw-c" points="78,26 80,30 84,30 81,32 82,36 78,34 74,36 75,32 72,30 76,30" fill="url(#cn-star-sm)"/>
<polygon class="tw-a" points="62,72 64,76 68,76 65,78 66,82 62,80 58,82 59,78 56,76 60,76" fill="url(#cn-star-sm)"/>
<polygon class="tw-d" points="32,68 34,72 38,72 35,74 36,78 32,76 28,78 29,74 26,72 30,72" fill="url(#cn-star-sm)"/>
<circle class="tw-c" cx="50" cy="20" r="1" fill="#FFFFFF"/>
<circle class="tw-b" cx="14" cy="50" r="0.8" fill="#FFFFFF"/>
<circle class="tw-a" cx="86" cy="58" r="0.8" fill="#FFFFFF"/>
<circle class="tw-d" cx="44" cy="86" r="0.8" fill="#FFFFFF"/>
</g>
</svg>
</body></html>`;

// ─── Or Ancien — antik altın yıldız (klasik 5-köşe faceted) ──
const OR_ANCIEN_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
.star-3d { animation: idle-3d 4s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(255,224,130,0.8)) drop-shadow(0 0 36px rgba(251,191,36,0.4)) drop-shadow(0 6px 12px rgba(0,0,0,0.55)); }
</style></head><body>
<svg class="star-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="oa-body" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="12%" stop-color="#FFF4D6"/><stop offset="35%" stop-color="#FFE082"/><stop offset="65%" stop-color="#EF9F27"/><stop offset="92%" stop-color="#854F0B"/><stop offset="100%" stop-color="#3D1F00"/></linearGradient>
<linearGradient id="oa-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="oa-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<clipPath id="oa-mask"><polygon points="50,14 60,40 86,40 64,56 74,82 50,66 26,82 36,56 14,40 40,40"/></clipPath>
<filter id="oa-bloom"><feGaussianBlur stdDeviation="0.6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<polygon points="51,16 61,42 87,42 65,58 75,84 51,68 27,84 37,58 15,42 41,42" fill="#000" opacity="0.5" filter="url(#oa-bloom)"/>
<polygon points="50,14 60,40 86,40 64,56 74,82 50,66 26,82 36,56 14,40 40,40" fill="url(#oa-body)" stroke="#FFF4D6" stroke-width="1"/>
<g clip-path="url(#oa-mask)">
<polygon points="50,14 60,40 50,46 40,40" fill="url(#oa-shine)" opacity="0.7"/>
<polygon class="fac-tw-1" points="50,14 60,40 50,46" fill="#FFFFFF" opacity="0.5"/>
<polygon class="fac-tw-2" points="50,14 40,40 50,46" fill="#FFE082" opacity="0.5"/>
<polygon class="fac-tw-3" points="50,46 64,56 74,82 50,66" fill="#000" opacity="0.25"/>
<polygon points="50,46 36,56 26,82 50,66" fill="#000" opacity="0.2"/>
<line x1="50" y1="14" x2="50" y2="66" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
<line x1="60" y1="40" x2="14" y2="40" stroke="#FFFFFF" stroke-width="0.3" opacity="0.35"/>
<line x1="50" y1="46" x2="74" y2="82" stroke="#000" stroke-width="0.3" opacity="0.35"/>
<line x1="50" y1="46" x2="26" y2="82" stroke="#FFFFFF" stroke-width="0.3" opacity="0.35"/>
<rect class="shine-band" x="-30" y="0" width="22" height="100" fill="url(#oa-sweep)"/>
</g>
<polygon points="50,14 60,40 86,40 64,56 74,82 50,66 26,82 36,56 14,40 40,40" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.85"/>
<circle cx="50" cy="46" r="2.5" fill="#FFFFFF" opacity="0.9" filter="url(#oa-bloom)"/>
</svg>
</body></html>`;

// ─── Inferno — premium 3D faceted alev (Or Ancien polygon stili) ──
//   v107 hotfix #2: smooth curve yerine 8-köşeli geometric flame polygon — Or Ancien yıldız
//   gibi keskin facet'lar 3D'yi net gösterir. Sol-light/sağ-dark zigzag yüzey + iç magma core.
const INFERNO_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
.flame-3d { filter: drop-shadow(0 0 22px rgba(251,146,60,0.85)) drop-shadow(0 0 44px rgba(220,38,38,0.5)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
</style></head><body>
<svg class="flame-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="if-body" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="8%" stop-color="#FEF3C7"/><stop offset="22%" stop-color="#FDE047"/><stop offset="42%" stop-color="#FBBF24"/><stop offset="62%" stop-color="#FB923C"/><stop offset="82%" stop-color="#DC2626"/><stop offset="100%" stop-color="#7F1D1D"/></linearGradient>
<linearGradient id="if-top-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="if-left-dark" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.5"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient>
<radialGradient id="if-inner-glow" cx="50%" cy="62%" r="35%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="55%" stop-color="#FEF3C7" stop-opacity="0.5"/><stop offset="100%" stop-color="#FBBF24" stop-opacity="0"/></radialGradient>
<linearGradient id="if-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<clipPath id="if-mask"><polygon points="50,10 60,28 70,52 64,80 50,92 36,80 30,52 40,28"/></clipPath>
<filter id="if-bloom"><feGaussianBlur stdDeviation="0.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="if-strong-bloom"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<polygon points="51,12 61,30 71,54 65,82 51,94 37,82 31,54 41,30" fill="#000" opacity="0.5" filter="url(#if-bloom)"/>
<polygon points="50,10 60,28 70,52 64,80 50,92 36,80 30,52 40,28" fill="url(#if-body)" stroke="#FEF3C7" stroke-width="1"/>
<g clip-path="url(#if-mask)">
<polygon points="50,10 60,28 50,42 40,28" fill="url(#if-top-shine)" opacity="0.85"/>
<polygon points="50,10 40,28 30,52 36,80 50,92 50,42" fill="url(#if-left-dark)" opacity="0.55"/>
<polygon class="fac-tw-1" points="50,10 60,28 50,42" fill="#FFFFFF" opacity="0.7"/>
<polygon class="fac-tw-2" points="50,10 40,28 50,42" fill="#FEF3C7" opacity="0.55"/>
<polygon class="fac-tw-3" points="50,42 64,80 50,92" fill="#000" opacity="0.3"/>
<polygon points="50,42 36,80 50,92" fill="#000" opacity="0.22"/>
<ellipse cx="50" cy="68" rx="11" ry="14" fill="url(#if-inner-glow)" filter="url(#if-bloom)"/>
<line x1="50" y1="10" x2="50" y2="92" stroke="#FFFFFF" stroke-width="0.4" opacity="0.55"/>
<line x1="50" y1="10" x2="30" y2="52" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
<line x1="50" y1="10" x2="70" y2="52" stroke="#000" stroke-width="0.3" opacity="0.35"/>
<line x1="50" y1="42" x2="64" y2="80" stroke="#000" stroke-width="0.3" opacity="0.4"/>
<line x1="50" y1="42" x2="36" y2="80" stroke="#FFFFFF" stroke-width="0.3" opacity="0.4"/>
<rect class="shine-band" x="-30" y="0" width="22" height="100" fill="url(#if-sweep)"/>
</g>
<polygon points="50,10 60,28 70,52 64,80 50,92 36,80 30,52 40,28" fill="none" stroke="#FFFFFF" stroke-width="0.6" opacity="0.85"/>
<circle cx="50" cy="10" r="1.6" fill="#FFFFFF" opacity="0.95" filter="url(#if-strong-bloom)"/>
<circle cx="50" cy="68" r="3" fill="#FFFFFF" opacity="0.95" filter="url(#if-bloom)"/>
<circle cx="50" cy="64" r="1.2" fill="#FFFFFF"/>
<circle cx="42" cy="93" r="1.2" fill="#FBBF24" opacity="0.85" filter="url(#if-bloom)"/>
<circle cx="50" cy="95" r="0.9" fill="#FB923C" opacity="0.85" filter="url(#if-bloom)"/>
<circle cx="58" cy="93" r="1" fill="#FBBF24" opacity="0.85" filter="url(#if-bloom)"/>
</svg>
</body></html>`;

// ─── Voltaire — premium 3D neon cyan şimşek (Aurum Strike pattern, cyan renkleri) ──
//   v107 hotfix #2: Aurum Strike şimşeği aynen + cyan/elektrik renk paleti.
//   6 facet bölünmüş yüzey + iç beyaz core + cam çatlağı 7 line + 2 mikro spark.
const VOLTAIRE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
.volt-3d { filter: drop-shadow(0 0 24px rgba(34,211,238,0.9)) drop-shadow(0 0 48px rgba(96,165,250,0.5)) drop-shadow(0 8px 16px rgba(0,0,0,0.55)); }
</style></head><body>
<svg class="volt-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="vo-body" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="8%" stop-color="#F0F9FF"/><stop offset="22%" stop-color="#A5F3FC"/><stop offset="48%" stop-color="#67E8F9"/><stop offset="72%" stop-color="#22D3EE"/><stop offset="92%" stop-color="#0E7490"/><stop offset="100%" stop-color="#082F49"/></linearGradient>
<linearGradient id="vo-top-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.5"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="vo-bottom-dark" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/></linearGradient>
<linearGradient id="vo-left-dark" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.4"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient>
<linearGradient id="vo-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<radialGradient id="vo-inner-glow" cx="50%" cy="50%" r="40%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#A5F3FC" stop-opacity="0"/></radialGradient>
<clipPath id="vo-mask"><polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12"/></clipPath>
<filter id="vo-bloom"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<polygon points="56,14 33,53 49,53 43,89 71,47 54,47 61,14" fill="#000" opacity="0.5" filter="url(#vo-bloom)"/>
<polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12" fill="url(#vo-body)" stroke="#F0F9FF" stroke-width="1.2"/>
<g clip-path="url(#vo-mask)">
<polygon points="55,12 60,12 53,46 70,46 42,88 48,52 32,52" fill="url(#vo-top-shine)" opacity="0.55"/>
<polygon points="55,12 32,52 48,52" fill="url(#vo-left-dark)" opacity="0.5"/>
<polygon points="48,52 42,88 53,46" fill="url(#vo-left-dark)" opacity="0.4"/>
<polygon points="60,12 70,46 53,46" fill="url(#vo-bottom-dark)" opacity="0.4"/>
<polygon points="42,88 70,46 53,46" fill="url(#vo-bottom-dark)" opacity="0.5"/>
<polygon class="fac-tw-1" points="55,12 60,12 56,28 50,28" fill="#FFFFFF" opacity="0.7"/>
<polygon class="fac-tw-2" points="42,88 48,52 53,46" fill="#A5F3FC" opacity="0.6"/>
<polygon class="fac-tw-3" points="48,52 53,46 70,46" fill="#FFFFFF" opacity="0.4"/>
<polygon points="46,32 53,32 51,42 48,42" fill="url(#vo-inner-glow)" filter="url(#vo-bloom)"/>
<polygon points="55,12 32,52 48,52" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.6"/>
<polygon points="60,12 70,46 53,46" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.5"/>
<line x1="48" y1="52" x2="42" y2="88" stroke="#FFFFFF" stroke-width="0.4" opacity="0.4"/>
<line x1="53" y1="46" x2="42" y2="88" stroke="#000" stroke-width="0.4" opacity="0.4"/>
<line x1="55" y1="12" x2="50" y2="32" stroke="#FFFFFF" stroke-width="0.3" opacity="0.65"/>
<line x1="60" y1="12" x2="55" y2="32" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
<line x1="32" y1="52" x2="48" y2="52" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
<rect class="shine-band" x="-30" y="0" width="22" height="100" fill="url(#vo-sweep)"/>
</g>
<polygon points="55,12 32,52 48,52 42,88 70,46 53,46 60,12" fill="none" stroke="#FFFFFF" stroke-width="0.6" opacity="0.85"/>
<circle cx="42" cy="88" r="2.5" fill="#FFFFFF" opacity="0.95" filter="url(#vo-bloom)"/>
<circle cx="55" cy="12" r="1.8" fill="#FFFFFF" opacity="0.85" filter="url(#vo-bloom)"/>
<circle cx="36" cy="92" r="0.8" fill="#A5F3FC" opacity="0.9" filter="url(#vo-bloom)"/>
<circle cx="48" cy="92" r="0.6" fill="#A5F3FC" opacity="0.8" filter="url(#vo-bloom)"/>
</svg>
</body></html>`;

// ─── Belle Époque — premium 3D faceted kalp (Or Ancien polygon stili) ──
//   v107 hotfix #2: smooth curve yerine 10-köşeli geometric heart polygon. Yıldız gibi
//   keskin facet'lar net 3D verir. 2 lobe top-shine + sol-light/sağ-dark zigzag yüzey.
const BELLE_EPOQUE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
.heart-3d { filter: drop-shadow(0 0 22px rgba(244,114,182,0.9)) drop-shadow(0 0 44px rgba(190,24,93,0.5)) drop-shadow(0 8px 16px rgba(0,0,0,0.55)); }
</style></head><body>
<svg class="heart-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="be-body" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="8%" stop-color="#FCE7F3"/><stop offset="22%" stop-color="#FBCFE8"/><stop offset="42%" stop-color="#F9A8D4"/><stop offset="62%" stop-color="#F472B6"/><stop offset="82%" stop-color="#BE185D"/><stop offset="100%" stop-color="#500724"/></linearGradient>
<linearGradient id="be-top-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="be-left-dark" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.5"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient>
<linearGradient id="be-bottom-dark" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.5"/></linearGradient>
<radialGradient id="be-inner-glow" cx="50%" cy="50%" r="40%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="55%" stop-color="#FBCFE8" stop-opacity="0.5"/><stop offset="100%" stop-color="#F472B6" stop-opacity="0"/></radialGradient>
<linearGradient id="be-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<clipPath id="be-mask"><polygon points="30,18 50,28 70,18 84,30 80,52 64,72 50,90 36,72 20,52 16,30"/></clipPath>
<filter id="be-bloom"><feGaussianBlur stdDeviation="0.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="be-strong-bloom"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<polygon points="31,20 51,30 71,20 85,32 81,54 65,74 51,92 37,74 21,54 17,32" fill="#000" opacity="0.5" filter="url(#be-bloom)"/>
<polygon points="30,18 50,28 70,18 84,30 80,52 64,72 50,90 36,72 20,52 16,30" fill="url(#be-body)" stroke="#FCE7F3" stroke-width="1"/>
<g clip-path="url(#be-mask)">
<polygon points="30,18 50,28 16,30" fill="url(#be-top-shine)" opacity="0.85"/>
<polygon points="70,18 84,30 50,28" fill="url(#be-top-shine)" opacity="0.8"/>
<polygon points="16,30 20,52 50,28" fill="url(#be-top-shine)" opacity="0.45"/>
<polygon points="50,28 80,52 84,30" fill="url(#be-top-shine)" opacity="0.4"/>
<polygon points="16,30 20,52 36,72 50,90 50,28" fill="url(#be-left-dark)" opacity="0.55"/>
<polygon points="50,28 50,90 64,72 80,52 84,30" fill="url(#be-bottom-dark)" opacity="0.45"/>
<polygon class="fac-tw-1" points="30,18 50,28 16,30" fill="#FFFFFF" opacity="0.55"/>
<polygon class="fac-tw-2" points="70,18 50,28 84,30" fill="#FBCFE8" opacity="0.55"/>
<polygon class="fac-tw-3" points="50,28 50,90 36,72" fill="#000" opacity="0.25"/>
<polygon points="50,28 50,90 64,72" fill="#000" opacity="0.22"/>
<ellipse cx="50" cy="50" rx="14" ry="16" fill="url(#be-inner-glow)" filter="url(#be-bloom)"/>
<line x1="50" y1="28" x2="50" y2="90" stroke="#FFFFFF" stroke-width="0.5" opacity="0.55"/>
<line x1="30" y1="18" x2="50" y2="28" stroke="#FFFFFF" stroke-width="0.3" opacity="0.5"/>
<line x1="70" y1="18" x2="50" y2="28" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
<line x1="16" y1="30" x2="50" y2="28" stroke="#FFFFFF" stroke-width="0.3" opacity="0.4"/>
<line x1="84" y1="30" x2="50" y2="28" stroke="#000" stroke-width="0.3" opacity="0.35"/>
<line x1="50" y1="28" x2="20" y2="52" stroke="#FFFFFF" stroke-width="0.3" opacity="0.4"/>
<line x1="50" y1="28" x2="80" y2="52" stroke="#000" stroke-width="0.3" opacity="0.35"/>
<rect class="shine-band" x="-30" y="0" width="22" height="100" fill="url(#be-sweep)"/>
</g>
<polygon points="30,18 50,28 70,18 84,30 80,52 64,72 50,90 36,72 20,52 16,30" fill="none" stroke="#FFFFFF" stroke-width="0.6" opacity="0.85"/>
<circle cx="30" cy="18" r="1.6" fill="#FFFFFF" opacity="0.95" filter="url(#be-strong-bloom)"/>
<circle cx="70" cy="18" r="1.6" fill="#FFFFFF" opacity="0.9" filter="url(#be-strong-bloom)"/>
<circle cx="50" cy="90" r="2" fill="#FFFFFF" opacity="0.95" filter="url(#be-strong-bloom)"/>
<circle cx="50" cy="50" r="2" fill="#FFFFFF" opacity="0.85" filter="url(#be-bloom)"/>
<circle cx="48" cy="48" r="1" fill="#FFFFFF"/>
</svg>
</body></html>`;

// ─── La Rose Noir — premium 3D gül (gerçek petal yapısı, Aurum Strike kalitesi) ──
//   v107 hotfix: 8 dış petal (koyu), 6 orta petal (mid pink), 4 iç petal (light) +
//   merkez bud · 4 petal-edge white highlight · 2 yaprak (yeşil) · drop-shadow halo ·
//   bud üstünde shine spec + spark.
const LA_ROSE_NOIR_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
.rose-3d { filter: drop-shadow(0 0 22px rgba(244,114,182,0.75)) drop-shadow(0 0 44px rgba(190,24,93,0.5)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
</style></head><body>
<svg class="rose-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<radialGradient id="ro-petal-light" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="20%" stop-color="#FCE7F3"/><stop offset="50%" stop-color="#F9A8D4"/><stop offset="80%" stop-color="#F472B6"/><stop offset="100%" stop-color="#BE185D"/></radialGradient>
<radialGradient id="ro-petal-mid" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#FBCFE8"/><stop offset="40%" stop-color="#F472B6"/><stop offset="80%" stop-color="#BE185D"/><stop offset="100%" stop-color="#831843"/></radialGradient>
<radialGradient id="ro-petal-dark" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#F472B6"/><stop offset="50%" stop-color="#831843"/><stop offset="100%" stop-color="#1A0508"/></radialGradient>
<radialGradient id="ro-bud" cx="50%" cy="40%" r="50%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="#FBCFE8"/><stop offset="80%" stop-color="#F472B6"/><stop offset="100%" stop-color="#BE185D"/></radialGradient>
<radialGradient id="ro-bud-shine" cx="35%" cy="30%" r="40%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<linearGradient id="ro-leaf" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#86EFAC"/><stop offset="50%" stop-color="#16A34A"/><stop offset="100%" stop-color="#14532D"/></linearGradient>
<filter id="ro-bloom"><feGaussianBlur stdDeviation="0.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<!-- Drop shadow halo -->
<ellipse cx="51" cy="52" rx="36" ry="34" fill="#000" opacity="0.45" filter="url(#ro-bloom)"/>

<!-- Yapraklar (alt sağ ve sol) -->
<g>
<path d="M 16 78 C 8 74 6 66 14 62 C 22 60 28 66 26 74 C 24 80 18 80 16 78 Z" fill="url(#ro-leaf)" stroke="#14532D" stroke-width="0.4" opacity="0.9"/>
<path d="M 84 78 C 92 74 94 66 86 62 C 78 60 72 66 74 74 C 76 80 82 80 84 78 Z" fill="url(#ro-leaf)" stroke="#14532D" stroke-width="0.4" opacity="0.9"/>
<line x1="16" y1="78" x2="22" y2="68" stroke="#FFFFFF" stroke-width="0.3" opacity="0.5"/>
<line x1="84" y1="78" x2="78" y2="68" stroke="#FFFFFF" stroke-width="0.3" opacity="0.5"/>
</g>

<!-- ── 8 OUTER PETALS (en dış halka, koyu) ── -->
<g>
<path d="M 50 50 C 40 28 28 22 22 30 C 18 40 30 48 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
<path d="M 50 50 C 60 28 72 22 78 30 C 82 40 70 48 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
<path d="M 50 50 C 30 42 18 46 16 56 C 18 66 32 64 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
<path d="M 50 50 C 70 42 82 46 84 56 C 82 66 68 64 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
<path d="M 50 50 C 36 60 28 70 36 78 C 46 78 50 66 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
<path d="M 50 50 C 64 60 72 70 64 78 C 54 78 50 66 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
<path d="M 50 50 C 44 70 44 80 50 80 C 56 80 56 70 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
<path d="M 50 50 C 50 30 50 22 54 22 C 58 22 56 32 50 50 Z" fill="url(#ro-petal-dark)" stroke="#1A0508" stroke-width="0.5"/>
</g>

<!-- ── 6 MID PETALS (orta halka, mid pink) ── -->
<g>
<path d="M 50 50 C 42 36 36 32 34 40 C 38 48 46 48 50 50 Z" fill="url(#ro-petal-mid)" stroke="#831843" stroke-width="0.4"/>
<path d="M 50 50 C 58 36 64 32 66 40 C 62 48 54 48 50 50 Z" fill="url(#ro-petal-mid)" stroke="#831843" stroke-width="0.4"/>
<path d="M 50 50 C 34 48 26 54 32 60 C 40 60 46 56 50 50 Z" fill="url(#ro-petal-mid)" stroke="#831843" stroke-width="0.4"/>
<path d="M 50 50 C 66 48 74 54 68 60 C 60 60 54 56 50 50 Z" fill="url(#ro-petal-mid)" stroke="#831843" stroke-width="0.4"/>
<path d="M 50 50 C 40 60 38 68 46 70 C 50 64 50 56 50 50 Z" fill="url(#ro-petal-mid)" stroke="#831843" stroke-width="0.4"/>
<path d="M 50 50 C 60 60 62 68 54 70 C 50 64 50 56 50 50 Z" fill="url(#ro-petal-mid)" stroke="#831843" stroke-width="0.4"/>
</g>

<!-- ── 4 INNER PETALS (iç halka, light) ── -->
<g>
<path d="M 50 50 C 44 42 40 44 42 50 C 46 52 50 52 50 50 Z" fill="url(#ro-petal-light)" stroke="#BE185D" stroke-width="0.3"/>
<path d="M 50 50 C 56 42 60 44 58 50 C 54 52 50 52 50 50 Z" fill="url(#ro-petal-light)" stroke="#BE185D" stroke-width="0.3"/>
<path d="M 50 50 C 44 56 46 60 50 58 C 52 56 52 52 50 50 Z" fill="url(#ro-petal-light)" stroke="#BE185D" stroke-width="0.3"/>
<path d="M 50 50 C 56 56 54 60 50 58 C 48 56 48 52 50 50 Z" fill="url(#ro-petal-light)" stroke="#BE185D" stroke-width="0.3"/>
</g>

<!-- ── BUD (merkez tomurcuk) ── -->
<circle cx="50" cy="50" r="5" fill="url(#ro-bud)" stroke="#831843" stroke-width="0.5"/>
<ellipse cx="48" cy="48" rx="2.8" ry="2.5" fill="url(#ro-bud-shine)"/>
<circle cx="48" cy="47" r="1" fill="#FFFFFF"/>

<!-- ── Petal edge white highlights (üst petal'larda parıltı) ── -->
<path d="M 28 30 C 32 26 38 24 44 26" stroke="#FFFFFF" stroke-width="0.4" opacity="0.55" fill="none"/>
<path d="M 72 30 C 68 26 62 24 56 26" stroke="#FFFFFF" stroke-width="0.4" opacity="0.5" fill="none"/>
<path d="M 18 50 C 20 44 24 42 28 44" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45" fill="none"/>
<path d="M 82 50 C 80 44 76 42 72 44" stroke="#FFFFFF" stroke-width="0.3" opacity="0.4" fill="none"/>

<!-- ── Highlight specs (parıldayan noktalar) ── -->
<circle cx="32" cy="32" r="1" fill="#FFFFFF" opacity="0.7" filter="url(#ro-bloom)"/>
<circle cx="68" cy="32" r="1" fill="#FFFFFF" opacity="0.65" filter="url(#ro-bloom)"/>
<circle cx="48" cy="46" r="0.8" fill="#FFFFFF" opacity="0.95"/>
<circle class="fac-tw-1" cx="40" cy="46" r="0.6" fill="#FFFFFF" opacity="0.7"/>
<circle class="fac-tw-2" cx="60" cy="46" r="0.6" fill="#FFFFFF" opacity="0.65"/>
</svg>
</body></html>`;

// ─── Marina Royale — 3D çapa ──
const MARINA_ROYALE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
@keyframes sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
.anchor-3d { animation: sway 4s ease-in-out infinite; transform-origin: 50% 14%; filter: drop-shadow(0 0 18px rgba(96,165,250,0.7)) drop-shadow(0 0 36px rgba(34,211,238,0.4)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
</style></head><body>
<svg class="anchor-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="an-body" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#F0F9FF"/><stop offset="20%" stop-color="#BAE6FD"/><stop offset="50%" stop-color="#60A5FA"/><stop offset="80%" stop-color="#1E40AF"/><stop offset="100%" stop-color="#0A1525"/></linearGradient>
<linearGradient id="an-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<filter id="an-bloom"><feGaussianBlur stdDeviation="0.6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g>
<circle cx="50" cy="20" r="8" fill="none" stroke="url(#an-body)" stroke-width="4"/>
<circle cx="50" cy="20" r="8" fill="none" stroke="#FFFFFF" stroke-width="0.8" opacity="0.6"/>
<rect x="36" y="32" width="28" height="5" rx="1" fill="url(#an-body)" stroke="#FFFFFF" stroke-width="0.6"/>
<rect x="36" y="32" width="28" height="2" fill="url(#an-shine)" opacity="0.6"/>
<rect x="47" y="30" width="6" height="42" fill="url(#an-body)" stroke="#FFFFFF" stroke-width="0.6"/>
<rect x="47" y="30" width="2.5" height="42" fill="#FFFFFF" opacity="0.55"/>
<path d="M 50 70 C 32 70 22 60 22 48 L 28 48 C 28 60 36 64 50 64 C 64 64 72 60 72 48 L 78 48 C 78 60 68 70 50 70 Z" fill="url(#an-body)" stroke="#FFFFFF" stroke-width="0.6"/>
<path d="M 50 70 C 32 70 22 60 22 48 L 28 48 C 28 56 34 60 50 60 Z" fill="url(#an-shine)" opacity="0.55"/>
<polygon points="22,48 16,46 18,52" fill="url(#an-body)" stroke="#FFFFFF" stroke-width="0.6"/>
<polygon points="78,48 84,46 82,52" fill="url(#an-body)" stroke="#FFFFFF" stroke-width="0.6"/>
<circle cx="50" cy="20" r="3" fill="#FFFFFF" opacity="0.85" filter="url(#an-bloom)"/>
<circle cx="50" cy="42" r="1.8" fill="#FFFFFF" opacity="0.7" filter="url(#an-bloom)"/>
<circle class="fac-tw-1" cx="42" cy="20" r="0.8" fill="#FFFFFF"/>
<circle class="fac-tw-2" cx="58" cy="22" r="0.8" fill="#FFFFFF"/>
</g>
</svg>
</body></html>`;

// ─── Versailles Édition — 3D fleur-de-lis (altın) ──
const VERSAILLES_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
.flr-3d { animation: idle-3d 4.5s ease-in-out infinite; filter: drop-shadow(0 0 20px rgba(255,224,130,0.85)) drop-shadow(0 0 40px rgba(251,191,36,0.45)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
</style></head><body>
<svg class="flr-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="fl-body" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="12%" stop-color="#FFF4D6"/><stop offset="35%" stop-color="#FFE082"/><stop offset="65%" stop-color="#EF9F27"/><stop offset="92%" stop-color="#854F0B"/><stop offset="100%" stop-color="#3D1F00"/></linearGradient>
<linearGradient id="fl-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<filter id="fl-bloom"><feGaussianBlur stdDeviation="0.6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g>
<path d="M 50 16 C 44 24 42 34 46 44 C 48 50 52 50 54 44 C 58 34 56 24 50 16 Z" fill="url(#fl-body)" stroke="#FFF4D6" stroke-width="0.8"/>
<path d="M 50 16 C 46 24 46 34 50 44 C 54 34 54 24 50 16 Z" fill="url(#fl-shine)" opacity="0.6"/>
<path d="M 30 36 C 24 42 22 52 30 60 C 38 58 44 50 46 44 C 42 42 36 40 30 36 Z" fill="url(#fl-body)" stroke="#FFF4D6" stroke-width="0.8"/>
<path d="M 30 36 C 26 42 26 50 32 56" fill="url(#fl-shine)" opacity="0.5"/>
<path d="M 70 36 C 76 42 78 52 70 60 C 62 58 56 50 54 44 C 58 42 64 40 70 36 Z" fill="url(#fl-body)" stroke="#FFF4D6" stroke-width="0.8"/>
<path d="M 70 36 C 74 42 74 50 68 56" fill="url(#fl-shine)" opacity="0.5"/>
<rect x="22" y="60" width="56" height="6" rx="1" fill="url(#fl-body)" stroke="#FFF4D6" stroke-width="0.6"/>
<rect x="22" y="60" width="56" height="2.5" fill="url(#fl-shine)" opacity="0.6"/>
<rect x="47" y="64" width="6" height="22" fill="url(#fl-body)" stroke="#FFF4D6" stroke-width="0.6"/>
<rect x="47" y="64" width="2.5" height="22" fill="#FFFFFF" opacity="0.55"/>
<polygon points="50,86 56,80 50,76 44,80" fill="url(#fl-body)" stroke="#FFF4D6" stroke-width="0.6"/>
<polygon points="50,86 53,80 50,78 47,80" fill="#FFFFFF" opacity="0.6"/>
<line x1="50" y1="16" x2="50" y2="44" stroke="#FFFFFF" stroke-width="0.4" opacity="0.5"/>
<line x1="30" y1="36" x2="46" y2="56" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
<line x1="70" y1="36" x2="54" y2="56" stroke="#000" stroke-width="0.3" opacity="0.4"/>
<circle cx="50" cy="44" r="2.5" fill="#FFFFFF" opacity="0.9" filter="url(#fl-bloom)"/>
<circle class="fac-tw-1" cx="50" cy="22" r="1" fill="#FFFFFF"/>
<circle class="fac-tw-2" cx="32" cy="44" r="1" fill="#FFE082"/>
<circle class="fac-tw-3" cx="68" cy="44" r="1" fill="#FFE082"/>
</g>
</svg>
</body></html>`;

// ─── Émeraude Forêt — 3D zümrüt yaprak (yeşil faceted) ──
const EMERAUDE_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${STAGE_CSS}${COMMON_KEYFRAMES}
@keyframes leaf-sway { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-3px) rotate(3deg); } }
.leaf-3d { animation: leaf-sway 4s ease-in-out infinite; transform-origin: 50% 90%; filter: drop-shadow(0 0 20px rgba(94,234,212,0.8)) drop-shadow(0 0 40px rgba(20,184,166,0.45)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
</style></head><body>
<svg class="leaf-3d" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="em-body" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FFFFFF"/><stop offset="12%" stop-color="#CCFBF1"/><stop offset="35%" stop-color="#5EEAD4"/><stop offset="60%" stop-color="#14B8A6"/><stop offset="85%" stop-color="#0F766E"/><stop offset="100%" stop-color="#022C22"/></linearGradient>
<linearGradient id="em-shine" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<linearGradient id="em-sweep" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<clipPath id="em-mask"><path d="M 50 12 C 30 22 18 42 22 64 C 26 80 36 86 50 88 C 64 86 74 80 78 64 C 82 42 70 22 50 12 Z"/></clipPath>
<filter id="em-bloom"><feGaussianBlur stdDeviation="0.7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<path d="M 50 14 C 30 24 18 44 22 66 C 26 82 36 88 50 90 C 64 88 74 82 78 66 C 82 44 70 24 50 14 Z" fill="#000" opacity="0.5" filter="url(#em-bloom)"/>
<path d="M 50 12 C 30 22 18 42 22 64 C 26 80 36 86 50 88 C 64 86 74 80 78 64 C 82 42 70 22 50 12 Z" fill="url(#em-body)" stroke="#CCFBF1" stroke-width="0.9"/>
<g clip-path="url(#em-mask)">
<path d="M 50 12 C 36 24 30 42 36 60 C 44 56 52 48 56 38 C 56 28 54 18 50 12 Z" fill="url(#em-shine)" opacity="0.7"/>
<polygon class="fac-tw-1" points="50,12 36,30 30,50" fill="#FFFFFF" opacity="0.5"/>
<polygon class="fac-tw-2" points="50,12 64,30 70,50" fill="#5EEAD4" opacity="0.55"/>
<polygon class="fac-tw-3" points="22,64 50,88 78,64" fill="#000" opacity="0.3"/>
<line x1="50" y1="12" x2="50" y2="88" stroke="#FFFFFF" stroke-width="0.5" opacity="0.55"/>
<path d="M 50 28 Q 36 36 30 48" stroke="#FFFFFF" stroke-width="0.3" opacity="0.45"/>
<path d="M 50 36 Q 32 50 26 64" stroke="#FFFFFF" stroke-width="0.3" opacity="0.4"/>
<path d="M 50 28 Q 64 36 70 48" stroke="#000" stroke-width="0.3" opacity="0.35"/>
<path d="M 50 36 Q 68 50 74 64" stroke="#000" stroke-width="0.3" opacity="0.35"/>
<rect class="shine-band" x="-30" y="0" width="22" height="100" fill="url(#em-sweep)"/>
</g>
<path d="M 50 12 C 30 22 18 42 22 64 C 26 80 36 86 50 88 C 64 86 74 80 78 64 C 82 42 70 22 50 12 Z" fill="none" stroke="#FFFFFF" stroke-width="0.5" opacity="0.7"/>
<circle cx="44" cy="34" r="2.5" fill="#FFFFFF" opacity="0.9" filter="url(#em-bloom)"/>
<circle cx="40" cy="30" r="1" fill="#FFFFFF"/>
</svg>
</body></html>`;

// ★ v107 hotfix: Maison Soprano "luxury frame" — Aurum Strike'taki kart-zemini pattern'ı
//   tüm ürünlerde tek tip: radial+linear bg, conic-gradient ışınlar (statik), iç altın glow,
//   1px renk-temalı border, art ortada %60 boyutta. Body display flex override edilir,
//   frame absolute kart kenarına dayanır.
const FRAME_CSS_INJECT = `
body { display: block !important; width: 100%; height: 100%; position: relative; }
.frame { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
.frame::before { content: ''; position: absolute; inset: 0; background: var(--frame-bg, #1a1330); border-radius: inherit; }
.frame::after { content: ''; position: absolute; inset: 0; box-shadow: inset 0 0 40px var(--frame-glow, rgba(255,255,255,0.1)), inset 0 0 0 1px var(--frame-border, rgba(255,255,255,0.3)); border-radius: inherit; pointer-events: none; }
.bg-rays-g { position: absolute; top: 50%; left: 50%; width: 130%; aspect-ratio: 1; transform: translate(-50%, -50%); pointer-events: none;
  background: conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.07) 25deg, transparent 50deg, transparent 110deg, rgba(255,255,255,0.07) 135deg, transparent 160deg, transparent 220deg, rgba(255,255,255,0.07) 245deg, transparent 270deg);
}
.art-stack { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.art-stack > svg { width: 60%; height: 60%; }
`;

function wrapLuxuryFrame(rawHtml: string, opts: { bg: string; glow: string; border: string }): string {
  const styleVars = `--frame-bg:${opts.bg};--frame-glow:${opts.glow};--frame-border:${opts.border}`;
  return rawHtml
    .replace('</style>', FRAME_CSS_INJECT + '</style>')
    .replace('<body>', `<body style="${styleVars}"><div class="frame"><div class="bg-rays-g"></div><div class="art-stack">`)
    .replace('</body>', '</div></div></body>');
}

const FRAME = {
  phoenix: { bg: 'radial-gradient(circle at 50% 30%, rgba(244,114,182,0.4), transparent 55%), linear-gradient(135deg, #1A0518 0%, #500724 50%, #831843 100%)', glow: 'rgba(244,114,182,0.15)', border: 'rgba(244,114,182,0.5)' },
  galactique: { bg: 'radial-gradient(circle at 50% 40%, rgba(167,139,250,0.4), transparent 55%), linear-gradient(135deg, #1A1330 0%, #2D1B4E 50%, #4A2D7A 100%)', glow: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.45)' },
  glacier: { bg: 'radial-gradient(circle at 50% 30%, rgba(34,211,238,0.4), transparent 55%), linear-gradient(135deg, #001A1F 0%, #0E4A52 50%, #155E75 100%)', glow: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.5)' },
  vesuvius: { bg: 'radial-gradient(circle at 50% 70%, rgba(220,38,38,0.5), transparent 55%), linear-gradient(135deg, #1F0500 0%, #5C1A0B 50%, #7C2D12 100%)', glow: 'rgba(251,146,60,0.18)', border: 'rgba(251,146,60,0.5)' },
  constellation: { bg: 'radial-gradient(circle at 50% 30%, rgba(255,224,130,0.35), transparent 55%), linear-gradient(135deg, #0A0518 0%, #1E1B4B 50%, #312E81 100%)', glow: 'rgba(255,224,130,0.15)', border: 'rgba(255,224,130,0.4)' },
  orAncien: { bg: 'radial-gradient(circle at 50% 30%, rgba(255,224,130,0.5), transparent 55%), linear-gradient(135deg, #1A1500 0%, #5C4612 50%, #854F0B 100%)', glow: 'rgba(255,224,130,0.18)', border: 'rgba(255,224,130,0.5)' },
  inferno: { bg: 'radial-gradient(circle at 50% 70%, rgba(251,146,60,0.55), transparent 55%), linear-gradient(135deg, #1F0500 0%, #7F1D1D 50%, #B91C1C 100%)', glow: 'rgba(251,146,60,0.18)', border: 'rgba(251,146,60,0.5)' },
  voltaire: { bg: 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.5), transparent 55%), linear-gradient(135deg, #0A1828 0%, #155E75 50%, #0E7490 100%)', glow: 'rgba(34,211,238,0.2)', border: 'rgba(34,211,238,0.55)' },
  belleEpoque: { bg: 'radial-gradient(circle at 50% 50%, rgba(244,114,182,0.5), transparent 55%), linear-gradient(135deg, #1A0518 0%, #831843 50%, #BE185D 100%)', glow: 'rgba(244,114,182,0.18)', border: 'rgba(244,114,182,0.5)' },
  laRoseNoir: { bg: 'radial-gradient(circle at 50% 30%, rgba(190,24,93,0.45), transparent 55%), linear-gradient(135deg, #0A0218 0%, #500724 50%, #831843 100%)', glow: 'rgba(190,24,93,0.18)', border: 'rgba(190,24,93,0.5)' },
  marinaRoyale: { bg: 'radial-gradient(circle at 50% 30%, rgba(34,211,238,0.4), transparent 55%), linear-gradient(135deg, #001A2E 0%, #0C4A6E 50%, #075985 100%)', glow: 'rgba(96,165,250,0.18)', border: 'rgba(96,165,250,0.5)' },
  versailles: { bg: 'radial-gradient(circle at 50% 30%, rgba(255,224,130,0.45), transparent 55%), linear-gradient(135deg, #1A1500 0%, #5C4612 50%, #854F0B 100%)', glow: 'rgba(255,224,130,0.18)', border: 'rgba(255,224,130,0.5)' },
  emeraude: { bg: 'radial-gradient(circle at 50% 30%, rgba(94,234,212,0.45), transparent 55%), linear-gradient(135deg, #001A14 0%, #064E3B 50%, #047857 100%)', glow: 'rgba(94,234,212,0.18)', border: 'rgba(94,234,212,0.5)' },
};

// ★ Wrapped illustrations — Aurum Strike kendi frame'iyle gelir, diğerleri helper'dan geçer.
const WRAPPED: Record<string, string> = {
  'phoenix-diadem': wrapLuxuryFrame(PHOENIX_DIADEM_HTML, FRAME.phoenix),
  'galactique':     wrapLuxuryFrame(GALACTIQUE_HTML, FRAME.galactique),
  'aurum-strike':   AURUM_STRIKE_HTML,
  'glacier-aura':   wrapLuxuryFrame(GLACIER_AURA_HTML, FRAME.glacier),
  'vesuvius':       wrapLuxuryFrame(VESUVIUS_HTML, FRAME.vesuvius),
  'constellation':  wrapLuxuryFrame(CONSTELLATION_HTML, FRAME.constellation),
  'or-ancien':      wrapLuxuryFrame(OR_ANCIEN_HTML, FRAME.orAncien),
  'inferno':        wrapLuxuryFrame(INFERNO_HTML, FRAME.inferno),
  'voltaire':       wrapLuxuryFrame(VOLTAIRE_HTML, FRAME.voltaire),
  'belle-epoque':   wrapLuxuryFrame(BELLE_EPOQUE_HTML, FRAME.belleEpoque),
  'la-rose-noir':   wrapLuxuryFrame(LA_ROSE_NOIR_HTML, FRAME.laRoseNoir),
  'marina-royale':  wrapLuxuryFrame(MARINA_ROYALE_HTML, FRAME.marinaRoyale),
  'versailles':     wrapLuxuryFrame(VERSAILLES_HTML, FRAME.versailles),
  'emeraude':       wrapLuxuryFrame(EMERAUDE_HTML, FRAME.emeraude),
};

// ★ v107 hotfix: Hediyeler kategorisi — aynı 3D illustration'ları paylaşır.
//   Her hediye id'si bir base item'in görselini referans eder. Aynı kalite, farklı fiyat.
export const ILLUSTRATIONS: Record<string, string> = {
  ...WRAPPED,
  'gift-bolt':    WRAPPED['aurum-strike'],
  'gift-snow':    WRAPPED['glacier-aura'],
  'gift-volcano': WRAPPED['vesuvius'],
  'gift-star':    WRAPPED['or-ancien'],
  'gift-sparkle': WRAPPED['constellation'],
  'gift-fire':    WRAPPED['inferno'],
  'gift-heart':   WRAPPED['belle-epoque'],
  'gift-rose':    WRAPPED['la-rose-noir'],
  'gift-anchor':  WRAPPED['marina-royale'],
};

export function getIllustrationHtml(itemId: string): string | null {
  return ILLUSTRATIONS[itemId] || null;
}

// ★ Full-card mode: HTML kart zeminini de içerir (frame bg + box-shadow + rays).
//   Bu item'lar için native bg gradient + halo bypass edilir, WebView absoluteFillObject olur.
//   v107 hotfix (3 May 2026): Tüm illustration'lı ürünler artık luxury frame ile sarılı,
//   hepsi full-card modda render edilir.
const FULL_CARD_ITEMS = new Set<string>([
  'phoenix-diadem', 'galactique', 'aurum-strike', 'glacier-aura', 'vesuvius',
  'constellation', 'or-ancien', 'inferno', 'voltaire', 'belle-epoque',
  'la-rose-noir', 'marina-royale', 'versailles', 'emeraude',
  // Hediyeler — aynı luxury frame paylaşır
  'gift-bolt', 'gift-snow', 'gift-volcano', 'gift-star', 'gift-sparkle',
  'gift-fire', 'gift-heart', 'gift-rose', 'gift-anchor',
]);
export function isFullCardItem(itemId: string): boolean {
  return FULL_CARD_ITEMS.has(itemId);
}
