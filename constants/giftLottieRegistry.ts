/**
 * SopranoChat — Hediye Lottie Animasyon Kayıt Defteri
 * ═══════════════════════════════════════════════════════════════════
 * v108 (4 May 2026) — Her hediye ID'si için canlı Lottie animasyonu.
 * TikTok/Bigo/Clubhouse seviyesinde "wow" hissi: emoji yerine 3D animasyon.
 *
 * RoomGiftAnimationOverlay önce buradan bakar, varsa Lottie render eder.
 * Yoksa fallback olarak büyük emoji + textShadow glow gösterir.
 *
 * Tüm dosyalar: assets/avatar_frames/*.json (94 hazır Lottie var).
 */

const GIFT_LOTTIE_MAP: Record<string, any> = {
  // ── Mevcut 9 hediye ──
  // ★ v110.11 (7 May 2026): gift-bolt'tan "Star Strike Emoji.json" KALDIRILDI —
  //   yıldız 🤩 animasyonuydu, ama gift-bolt YILDIRIM ⚡ (Şimşek) olmalı. PNG
  //   fallback (aurum-strike.png) yıldırım iconu gösterir. Uygun Lottie
  //   eklendiğinde geri konabilir.
  'gift-snow':    require('../assets/avatar_frames/Loading Ring.json'),
  'gift-volcano': require('../assets/avatar_frames/Fire.json'),
  // ★ v108 fix: gift-star eski Star Strike Emoji ile gift-bolt'la aynıydı; Or Ancien (premium altın) için Pro.json'a alındı.
  'gift-star':    require('../assets/avatar_frames/Pro.json'),
  'gift-sparkle': require('../assets/avatar_frames/Fireworks.json'),
  'gift-fire':    require('../assets/avatar_frames/Firery Passion.json'),
  'gift-heart':   require('../assets/avatar_frames/Heart characters crying.json'),
  'gift-rose':    require('../assets/avatar_frames/Rose1.json'),
  'gift-anchor':  require('../assets/avatar_frames/boat.json'),

  // ── Yeni premium hediyeler (DB'de seed edilecek) ──
  'gift-dragon':  require('../assets/avatar_frames/Dragon.json'),
  'gift-trophy':  require('../assets/avatar_frames/Trophy.json'),
  'gift-car':     require('../assets/avatar_frames/Car.json'),
  'gift-cake':    require('../assets/avatar_frames/Cake.json'),
  'gift-diamond': require('../assets/avatar_frames/Red Diamond.json'),
  'gift-rocket':  require('../assets/avatar_frames/Rocket fly out the laptop.json'),
  'gift-perfume': require('../assets/avatar_frames/perfume.json'),

  // ── v108: Clubhouse tarzı yeni hediyeler ──
  'gift-crown':      require('../assets/avatar_frames/Crown.json'),
  'gift-teddy':      require('../assets/avatar_frames/Teddy Bear.json'),
  'gift-butterfly':  require('../assets/avatar_frames/Butterfly.json'),
  'gift-unicorn':    require('../assets/avatar_frames/Unicorn.json'),
  'gift-guitar':     require('../assets/avatar_frames/Guitar.json'),
  'gift-airplane':   require('../assets/avatar_frames/Airplane.json'),
  'gift-castle':     require('../assets/avatar_frames/Castle.json'),
  'gift-money':      require('../assets/avatar_frames/Money Rain.json'),
  'gift-gem':        require('../assets/avatar_frames/Gem.json'),
  'gift-confetti':   require('../assets/avatar_frames/Confetti.json'),
  'gift-balloon':    require('../assets/avatar_frames/Balloon.json'),
  'gift-sunglasses': require('../assets/avatar_frames/Sunglasses.json'),
  'gift-sparkles':   require('../assets/avatar_frames/Sparkles.json'),
  'gift-shooting':   require('../assets/avatar_frames/Shooting Star.json'),
  'gift-love':       require('../assets/avatar_frames/Love Letter.json'),
  'gift-celebrate':  require('../assets/avatar_frames/Celebration.json'),
  'gift-lion':       require('../assets/avatar_frames/Lion Running.json'),
  'gift-kiss':       require('../assets/avatar_frames/Kiss of the heart.json'),
};

export function getGiftLottie(giftId: string): any | null {
  return GIFT_LOTTIE_MAP[giftId] || null;
}

export function hasGiftLottie(giftId: string): boolean {
  return !!GIFT_LOTTIE_MAP[giftId];
}
