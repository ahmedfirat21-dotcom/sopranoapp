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
  /** ★ v213 (9 May 2026): Avatar boyutu / orijinal size oranı.
   *  Lottie'nin iç dairesel boşluğuna avatarın TAM oturması için.
   *  Default 0.92 (premium scale=1.0 frame'ler için).
   *  SopranoAura scale=1.14 → 1.0 (avatar full size).
   *  Overflow scale 1.8+ frame'ler için 0.78. */
  avatarRatio?: number;
};

// ★ v108.16.1: Scale arttırıldı — Lottie kompozisyonlarının "iç dairesel boşluğu"
//   kompozisyonun yaklaşık %50-55'i; avatar boyutu = frame * 0.5-0.55. Yani
//   avatar'ın frame'e sığması için scale ≈ 1.9-2.0. Eski 1.6 avatar frame'i taşıyordu.
const FRAME_LOTTIE_MAP: Record<string, FrameMeta> = {
  // VIP-style frame'ler — kanatlı (mid-loop ile sallanma efekti). avatarRatio 0.78
  // (overflow frame: kanatlar + dış decoration kompozisyonun büyük kısmı, iç cutout küçük).
  'aurelius':        { source: require('../assets/avatar_frames/Avatar frame.json'),         scale: 1.8, resizeMode: 'contain', useMidLoop: true, avatarRatio: 0.78 },
  'lunaris':         { source: require('../assets/avatar_frames/Avatar-Frame1.json'),        scale: 1.8, resizeMode: 'contain', useMidLoop: true, avatarRatio: 0.78 },
  'rose-eternel':    { source: require('../assets/avatar_frames/Avatar_Frame2.json'),        scale: 1.8, resizeMode: 'contain', useMidLoop: true, avatarRatio: 0.78 },
  // Cadence Soprano kanatsız (yıldız çelenk) — default loop, iç boşluk daha küçük
  'cadence-soprano': { source: require('../assets/avatar_frames/Profile Frame.json'),        scale: 1.85, resizeMode: 'contain', avatarRatio: 0.78 },
  // ★ SopranoAura: scale 1.14 → avatar tam boyutta dolgun oturur
  'soprano-aura':    { source: require('../assets/avatar_frames/SopranoAura.json'),                scale: 1.14, resizeMode: 'contain', avatarRatio: 1.0 },
  // ★ v213: 5 premium el yapımı çerçeve — scale 1.0; iç cutout ~%92 → avatarRatio 0.92.
  //   Eski 1.0 (full size) frame iç kenarını avatara biniyordu, 0.92 ile avatar tam oturur.
  'midnight-amethyst': { source: require('../assets/avatar_frames/MidnightAmethyst.json'),        scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'sunrise-gold':      { source: require('../assets/avatar_frames/SunriseGold.json'),              scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'ocean-pearl':       { source: require('../assets/avatar_frames/OceanPearl.json'),               scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'ruby-flame':        { source: require('../assets/avatar_frames/RubyFlame.json'),                scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'neon-pulse':        { source: require('../assets/avatar_frames/NeonPulse.json'),                scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  // ★ v110.15: 5 egzantrik çerçeve — 3D yörünge, altıgen prizma, radar, tutulma, glitch
  'celestial-orbit':   { source: require('../assets/avatar_frames/CelestialOrbit.json'),            scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'hex-prism':         { source: require('../assets/avatar_frames/HexPrism.json'),                  scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'pulse-wave':        { source: require('../assets/avatar_frames/PulseWave.json'),                 scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'eclipse-corona':    { source: require('../assets/avatar_frames/EclipseCorona.json'),             scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  'glitch-matrix':     { source: require('../assets/avatar_frames/GlitchMatrix.json'),              scale: 1.0, resizeMode: 'contain', avatarRatio: 0.92 },
  // ★ v214: TealRibbon — toz parçacıkları + parlama animasyonlu, alt kısımda kurdale banner
  'teal-ribbon':       { source: require('../assets/avatar_frames/TealRibbon.json'),               scale: 1.15, resizeMode: 'contain', avatarRatio: 0.85 },
};

/** ★ v213: Frame avatar oranı (size'ın % kaçı). Default 0.92. */
export function getFrameAvatarRatio(frameId: string | null | undefined): number {
  if (!frameId) return 1.0;
  return FRAME_LOTTIE_MAP[frameId]?.avatarRatio ?? 0.92;
}

export function getFrameLottie(frameId: string): any | null {
  return FRAME_LOTTIE_MAP[frameId]?.source || null;
}

export function getFrameMeta(frameId: string): FrameMeta | null {
  return FRAME_LOTTIE_MAP[frameId] || null;
}

export function hasFrameLottie(frameId: string): boolean {
  return !!FRAME_LOTTIE_MAP[frameId];
}
