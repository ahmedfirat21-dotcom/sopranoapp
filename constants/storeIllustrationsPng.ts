// ★ v108 (4 May 2026): Mağaza ürün görselleri — PNG asset map.
//
// Eski WebView+HTML+SVG render performans yedi (23 mini-tarayıcı motoru telefonu kastı).
// Bu dosya 14 base illustration + 12 yeni hediye PNG'sini native render eder.
// Hediyeler aynı görseli paylaşır (alias) VEYA kendi PNG'sine sahiptir.

import type { ImageSourcePropType } from 'react-native';

const PNG_MAP: Record<string, ImageSourcePropType> = {
  // Atelier
  'phoenix-diadem': require('../assets/store/items/phoenix-diadem.png'),
  'galactique':     require('../assets/store/items/galactique.png'),
  'aurum-strike':   require('../assets/store/items/aurum-strike.png'),
  'glacier-aura':   require('../assets/store/items/glacier-aura.png'),
  'vesuvius':       require('../assets/store/items/vesuvius.png'),
  // Mesaj sanatı
  'constellation':  require('../assets/store/items/constellation.png'),
  'or-ancien':      require('../assets/store/items/or-ancien.png'),
  'inferno':        require('../assets/store/items/inferno.png'),
  'voltaire':       require('../assets/store/items/voltaire.png'),
  'belle-epoque':   require('../assets/store/items/belle-epoque.png'),
  // Koleksiyonlar
  'la-rose-noir':   require('../assets/store/items/la-rose-noir.png'),
  'marina-royale':  require('../assets/store/items/marina-royale.png'),
  'versailles':     require('../assets/store/items/versailles.png'),
  'emeraude':       require('../assets/store/items/emeraude.png'),

  // ── v108: Clubhouse tarzı yeni hediye PNG'leri ──
  'gift-crown':      require('../assets/store/items/gift-crown.png'),
  'gift-teddy':      require('../assets/store/items/gift-teddy.png'),
  'gift-butterfly':  require('../assets/store/items/gift-butterfly.png'),
  'gift-unicorn':    require('../assets/store/items/gift-unicorn.png'),
  'gift-guitar':     require('../assets/store/items/gift-guitar.png'),
  'gift-airplane':   require('../assets/store/items/gift-airplane.png'),
  'gift-castle':     require('../assets/store/items/gift-castle.png'),
  'gift-money':      require('../assets/store/items/gift-money.png'),
  'gift-gem':        require('../assets/store/items/gift-gem.png'),
  'gift-confetti':   require('../assets/store/items/gift-confetti.png'),
  'gift-balloon':    require('../assets/store/items/gift-balloon.png'),
  'gift-sunglasses': require('../assets/store/items/gift-sunglasses.png'),
};

// Hediyeler aynı görseli paylaşır (eski hediyeler alias, yeniler kendi PNG'si var)
const ALIASES: Record<string, string> = {
  'gift-bolt':    'aurum-strike',
  'gift-snow':    'glacier-aura',
  'gift-volcano': 'vesuvius',
  'gift-star':    'or-ancien',
  'gift-sparkle': 'constellation',
  'gift-fire':    'inferno',
  'gift-heart':   'belle-epoque',
  'gift-rose':    'la-rose-noir',
  'gift-anchor':  'marina-royale',
  // Kendi PNG'si olmayan hediyeler → en yakın görsel eşleme
  'gift-dragon':    'gift-crown',
  'gift-trophy':    'gift-crown',
  'gift-car':       'gift-airplane',
  'gift-cake':      'gift-confetti',
  'gift-diamond':   'gift-gem',
  'gift-rocket':    'gift-airplane',
  'gift-perfume':   'gift-butterfly',
  'gift-sparkles':  'gift-gem',
  'gift-shooting':  'gift-gem',
  'gift-love':      'gift-butterfly',
  'gift-celebrate': 'gift-confetti',
  'gift-lion':      'gift-crown',
  'gift-kiss':      'gift-butterfly',
};

export function getIllustrationPng(itemId: string): ImageSourcePropType | null {
  if (PNG_MAP[itemId]) return PNG_MAP[itemId];
  const aliasOf = ALIASES[itemId];
  if (aliasOf && PNG_MAP[aliasOf]) return PNG_MAP[aliasOf];
  return null;
}

export function hasIllustration(itemId: string): boolean {
  return !!(PNG_MAP[itemId] || (ALIASES[itemId] && PNG_MAP[ALIASES[itemId]]));
}

// ★ v107 hotfix: Microsoft Fluent Emoji 3D PNG'leri ŞEFFAF sembol — kart zemini
//   içermez. Bu yüzden isFullCardItem her zaman false; native LinearGradient bg +
//   halo (DB'deki bg_gradient + bg_radial) + ortada PNG render edilir.
//   (Eski wrapLuxuryFrame pattern HTML'de frame'i içeriyordu — artık yok.)
export function isFullCardItem(_itemId: string): boolean {
  return false;
}
