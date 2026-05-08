/**
 * SopranoChat — Avatar Çerçeve Lottie Kayıt Defteri
 * ═══════════════════════════════════════════════════════════════════
 * v108 (4 May 2026) — Mağazadan satın alınan Lottie çerçeveler.
 *
 * AvatarFrame component önce buradan bakar, varsa Lottie render eder.
 * Yoksa fallback olarak FRAME_PALETTES (LinearGradient halka) kullanır.
 *
 * ★ v108.1: Meta config — her Lottie kendi tasarımına göre scale + resizeMode
 * gerektirir. Yıldız+kanat+banner içeren "VIP frame"ler büyük scale (2.0+) ve
 * 'contain' resizeMode ile render edilmeli (yoksa kanatlar kırpılır). Sade
 * vector halka küçük scale (1.45)
 * ve 'cover' yeterli.
 */

export type FrameMeta = {
  source: any;
  /** Lottie kompozisyonunu avatar boyutuna göre kaç kat genişlet */
  scale: number;
  /** Lottie içeriğinin nasıl yerleşeceği — 'contain' kompozisyonu hiç kırpmaz */
  resizeMode: 'cover' | 'contain';
  /** ★ v108.16: Sadece kanatlı frame'lerde true — kanat açılma intro'su atlanıp
   *  ortadan döngü başlar. Diğer frame'ler default full loop kullanır. */
  useMidLoop?: boolean;
};

// ★ v108.16.1: Scale arttırıldı — Lottie kompozisyonlarının "iç dairesel boşluğu"
//   kompozisyonun yaklaşık %50-55'i; avatar boyutu = frame * 0.5-0.55. Yani
//   avatar'ın frame'e sığması için scale ≈ 1.9-2.0. Eski 1.6 avatar frame'i taşıyordu.
const FRAME_LOTTIE_MAP: Record<string, FrameMeta> = {
  // VIP-style frame'ler — kanatlı (mid-loop ile sallanma efekti)
  'aurelius':        { source: require('../assets/avatar_frames/Avatar frame.json'),         scale: 1.8, resizeMode: 'contain', useMidLoop: true },
  'lunaris':         { source: require('../assets/avatar_frames/Avatar-Frame1.json'),        scale: 1.8, resizeMode: 'contain', useMidLoop: true },
  'rose-eternel':    { source: require('../assets/avatar_frames/Avatar_Frame2.json'),        scale: 1.8, resizeMode: 'contain', useMidLoop: true },
  // Cadence Soprano kanatsız (yıldız çelenk) — default loop, iç boşluk daha küçük
  'cadence-soprano': { source: require('../assets/avatar_frames/Profile Frame.json'),        scale: 1.85, resizeMode: 'contain' },
  // ★ v108.31: SopranoChat teal aurora — dönen gradient halka + shimmer + sparkle parçacıkları
  // ★ v110.16: scale 1.0 → 1.14. Lottie iç halkasının yarıçapı kompozisyonun %44'ü; scale 1.0'da
  //   halka avatarın iç kenarına biniyor (avatar resmini kapatıyor). 1.14 ile halkanın iç kenarı
  //   avatarın dış sınırına denk gelir, sıkı oturur. (formül: 0.5 / 0.439 ≈ 1.139)
  'soprano-aura':    { source: require('../assets/avatar_frames/SopranoAura.json'),                scale: 1.14, resizeMode: 'contain' },
  // ★ v108.40: 5 yeni premium el yapımı çerçeve — SopranoAura tarzı (halka + shimmer + sparkle)
  'midnight-amethyst': { source: require('../assets/avatar_frames/MidnightAmethyst.json'),        scale: 1.0, resizeMode: 'contain' },
  'sunrise-gold':      { source: require('../assets/avatar_frames/SunriseGold.json'),              scale: 1.0, resizeMode: 'contain' },
  'ocean-pearl':       { source: require('../assets/avatar_frames/OceanPearl.json'),               scale: 1.0, resizeMode: 'contain' },
  'ruby-flame':        { source: require('../assets/avatar_frames/RubyFlame.json'),                scale: 1.0, resizeMode: 'contain' },
  'neon-pulse':        { source: require('../assets/avatar_frames/NeonPulse.json'),                scale: 1.0, resizeMode: 'contain' },
  // ★ v110.15: 5 egzantrik çerçeve — 3D yörünge, altıgen prizma, radar, tutulma, glitch
  'celestial-orbit':   { source: require('../assets/avatar_frames/CelestialOrbit.json'),            scale: 1.0, resizeMode: 'contain' },
  'hex-prism':         { source: require('../assets/avatar_frames/HexPrism.json'),                  scale: 1.0, resizeMode: 'contain' },
  'pulse-wave':        { source: require('../assets/avatar_frames/PulseWave.json'),                 scale: 1.0, resizeMode: 'contain' },
  'eclipse-corona':    { source: require('../assets/avatar_frames/EclipseCorona.json'),             scale: 1.0, resizeMode: 'contain' },
  'glitch-matrix':     { source: require('../assets/avatar_frames/GlitchMatrix.json'),              scale: 1.0, resizeMode: 'contain' },
};

export function getFrameLottie(frameId: string): any | null {
  return FRAME_LOTTIE_MAP[frameId]?.source || null;
}

export function getFrameMeta(frameId: string): FrameMeta | null {
  return FRAME_LOTTIE_MAP[frameId] || null;
}

export function hasFrameLottie(frameId: string): boolean {
  return !!FRAME_LOTTIE_MAP[frameId];
}
