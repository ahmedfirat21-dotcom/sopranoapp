/**
 * SopranoChat — SP Transaction Amount Tier
 * ═══════════════════════════════════════════════════
 * SP gönderim/bağış miktarına göre tier — UI'da animasyon yoğunluğu, palet,
 * partikül sayısı bunlara göre ayarlanır. SPSentSuccessModal/SPDonateSheet/
 * SPReceivedModal/DonationAlert ortak görsel dil için bu helper'ı kullanır.
 *
 * Tier eşikleri (★ v87 1 May 2026 — rebalance, SP üretim hızıyla denk):
 *   basic     :  1 - 24 SP   (gümüş/teal)   — günlük üretimle hemen ulaşılır
 *   premium   : 25 - 99 SP   (altın)        — 1 günlük birikim
 *   elite     : 100 - 499 SP (rose-gold)    — 3-5 günlük birikim
 *   legendary : 500+ SP      (mor)          — 2 haftalık birikim
 *
 * Eski eşikler (50/250/1000) free kullanıcı için legendary'i ~1 ay uzaktaydı
 * — sinematik halo glow vaadi vs. ulaşılabilirlik uçurumu vardı, kapatıldı.
 */

export type SPAmountTier = 'basic' | 'premium' | 'elite' | 'legendary';

export const getSPAmountTier = (amount: number): SPAmountTier =>
  amount >= 500 ? 'legendary' : amount >= 100 ? 'elite' : amount >= 25 ? 'premium' : 'basic';

// ── Tier palette (paylaşılan, üst seviye) ──
export interface SPTierVisual {
  /** Glow / accent rengi — ring, çerçeve, partikül baskın renk */
  glow: string;
  /** Partikül renk havuzu — emojiler ve sparkle'lar bu paletten seçilir */
  particleColors: string[];
  /** Partikül sayısı — basic 8 → legendary 22 (animasyon yoğunluğu) */
  particleCount: number;
  /** Tier etiketi — null ise gizlenir (basic) */
  label: string | null;
  /** Etiket rengi */
  labelColor: string;
  /** Card BG gradient (3 stop, üst → orta → alt) */
  bgGradient: [string, string, string];
  /** Top edge highlight rengi */
  topEdge: string;
}

export const SP_TIER_VISUAL: Record<SPAmountTier, SPTierVisual> = {
  basic: {
    glow: '#14B8A6',
    particleColors: ['#14B8A6', '#5EEAD4', '#FBBF24'],
    particleCount: 8,
    label: null,
    labelColor: '#14B8A6',
    bgGradient: ['#1a3a38', '#0f2420', '#040d0c'],
    topEdge: 'rgba(20,184,166,0.85)',
  },
  premium: {
    glow: '#FBBF24',
    particleColors: ['#FFD700', '#FBBF24', '#FFF4C4'],
    particleCount: 12,
    label: 'PREMIUM',
    labelColor: '#FBBF24',
    bgGradient: ['#5a3a10', '#2a1a08', '#080403'],
    topEdge: 'rgba(251,191,36,0.9)',
  },
  elite: {
    glow: '#F472B6',
    particleColors: ['#F472B6', '#FBBF24', '#FFF4C4', '#FBCFE8'],
    particleCount: 16,
    label: 'ELITE',
    labelColor: '#F472B6',
    bgGradient: ['#6a1e48', '#2a0a1d', '#080205'],
    topEdge: 'rgba(244,114,182,0.9)',
  },
  legendary: {
    glow: '#A78BFA',
    particleColors: ['#A78BFA', '#F472B6', '#FBBF24', '#60A5FA', '#FFF4C4'],
    particleCount: 22,
    label: 'LEGENDARY',
    labelColor: '#A78BFA',
    bgGradient: ['#3e2a7c', '#180d38', '#040108'],
    topEdge: 'rgba(167,139,250,0.95)',
  },
};

/** Tier emojileri — DonationAlert / SPReceived partikül havuzu */
export const SP_TIER_EMOJIS: Record<SPAmountTier, string[]> = {
  basic: ['💎', '✨', '⭐'],
  premium: ['💎', '✨', '⭐', '💛', '🌟'],
  elite: ['💎', '✨', '⭐', '💗', '🌹', '💖', '🎀'],
  legendary: ['💎', '✨', '⭐', '💜', '🌟', '👑', '🔥', '🎆', '💫'],
};
