/**
 * SopranoChat — Giriş Efekti Lottie Kayıt Defteri
 * ═══════════════════════════════════════════════════════════════════
 * v108.20 (5 May 2026) — Hem mağaza önizlemesi hem oda giriş animasyonu
 * tek kaynaktan beslensin. Eskiden RoomEntryEffectOverlay içinde local
 * map vardı; mağaza ayrı PNG kullanıyordu → kullanıcının "satın aldığım
 * animasyon farklı çıkıyor" şikayeti.
 */

const ENTRY_EFFECT_LOTTIE_MAP: Record<string, any> = {
  'constellation':  require('../assets/avatar_frames/Fireworks.json'),
  'or-ancien':      require('../assets/avatar_frames/Star Strike Emoji.json'),
  'inferno':        require('../assets/avatar_frames/Fire.json'),
  'voltaire':       require('../assets/avatar_frames/Shooting Star.json'),
  'belle-epoque':   require('../assets/avatar_frames/Heart characters crying.json'),
  // ★ v110.8 (7 May 2026): AI Spark — interaktif AI asistan animasyonu
  'ai-spark':       require('../assets/avatar_frames/AI_Spark.json'),
};

export function getEntryEffectLottie(id: string): any | null {
  return ENTRY_EFFECT_LOTTIE_MAP[id] || null;
}

export function hasEntryEffectLottie(id: string): boolean {
  return !!ENTRY_EFFECT_LOTTIE_MAP[id];
}
