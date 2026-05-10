/**
 * Avatar Frame Registry
 * 
 * Sadece GERÇEK avatar çerçevesi olan Lottie dosyaları burada.
 * Loading spinner, ikon, tek nokta gibi kalitesiz animasyonlar çıkarıldı.
 * 
 * scale: Lottie overlay'in avatar boyutuna oranı.
 *   - 400x400 frame'ler: ~1.55 (avatar'ın biraz dışına taşsın)
 *   - 500x500 frame'ler: ~1.50
 *   - 1080x1080 frame'ler: ~1.40
 *   - 200x200 frame'ler: ~1.60 (küçük olduğu için daha çok büyüt)
 * 
 * Formül: Lottie çerçevesinin "iç dairesel boşluğu" avatara denk gelmeli.
 * İç boşluk genellikle total boyutun %55-65'i kadar, avatar da size'ın %78'i.
 * Yani scale ≈ size / (innerCircleRatio * lottieSize) * lottieSize / size
 */

type FrameConfig = {
  source: any;
  scale: number;
  /** ★ v212: Avatar boyutu / orijinal size oranı.
   *  Default 0.78 (overflow frame'ler için).
   *  Premium scale=1.0 frame'lerde (SunriseGold vb.) iç daire büyük olduğundan
   *  avatar 0.88'e çıkartılmalı — gap kalmasın. */
  avatarRatio?: number;
};

const FRAME_REGISTRY: Record<string, FrameConfig> = {
  // ── 400x400 Avatar Frame Serisi (profesyonel çerçeveler) ──
  frame_klasik: {
    source: require('../assets/avatar_frames/Avatar frame.json'),
    scale: 1.70,
  },
  frame_neon: {
    source: require('../assets/avatar_frames/Avatar-Frame1.json'),
    scale: 1.70,
  },
  frame_elmas: {
    source: require('../assets/avatar_frames/Avatar_Frame2.json'),
    scale: 1.70,
  },
  frame_premium: {
    source: require('../assets/avatar_frames/Profile Frame.json'),
    scale: 1.70,
  },
  frame_yildiz: {
    source: require('../assets/avatar_frames/Profile.json'),
    scale: 1.70,
  },

  // ── 500x500 Çember Serisi ──
  frame_parlak_halka: {
    source: require('../assets/avatar_frames/circle.json'),
    scale: 1.65,
  },

  // ── 200x200 Sihirli Çember ──
  frame_sihirli: {
    source: require('../assets/avatar_frames/sifcircle.json'),
    scale: 1.75,
  },

  // ── 500x500 Premium El Yapımı Çerçeveler (SopranoAura tarzı) ──
  // ★ v212: avatarRatio 0.88 — inner daire büyük olduğundan avatar dolgun otursun.
  frame_midnight_amethyst: {
    source: require('../assets/avatar_frames/MidnightAmethyst.json'),
    scale: 1.0,
    avatarRatio: 0.88,
  },
  frame_sunrise_gold: {
    source: require('../assets/avatar_frames/SunriseGold.json'),
    scale: 1.0,
    avatarRatio: 0.88,
  },
  frame_ocean_pearl: {
    source: require('../assets/avatar_frames/OceanPearl.json'),
    scale: 1.0,
    avatarRatio: 0.88,
  },
  frame_ruby_flame: {
    source: require('../assets/avatar_frames/RubyFlame.json'),
    scale: 1.0,
    avatarRatio: 0.88,
  },
  frame_neon_pulse: {
    source: require('../assets/avatar_frames/NeonPulse.json'),
    scale: 1.0,
    avatarRatio: 0.88,
  },
};

/**
 * Frame ID → Lottie source. Eşleşme yoksa null.
 */
export function getFrameLottieSource(frameId: string | null | undefined): any | null {
  if (!frameId) return null;
  return FRAME_REGISTRY[frameId]?.source || null;
}

/**
 * Frame ID → scale değeri. Eşleşme yoksa 1.5.
 */
export function getFrameScale(frameId: string | null | undefined): number {
  if (!frameId) return 1.5;
  return FRAME_REGISTRY[frameId]?.scale || 1.5;
}

/**
 * ★ v212: Frame ID → avatar boyut oranı (size'ın % kaçı). Eşleşme yoksa 0.78 (overflow frame default).
 */
export function getFrameAvatarRatio(frameId: string | null | undefined): number {
  if (!frameId) return 0.78;
  return FRAME_REGISTRY[frameId]?.avatarRatio || 0.78;
}

export const ALL_FRAME_IDS = Object.keys(FRAME_REGISTRY);
