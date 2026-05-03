/**
 * SopranoChat — Tier Renk Paleti (paylaşılan)
 * ═══════════════════════════════════════════════════════
 * GiftSheet, StageSupportSheet, TreasurySheet, EntryFeeCard ortak paleti.
 *
 * Tasarım kuralları:
 *   - 4-stop YUMUŞAK gradient (krem → ana → koyu) — keskin renk geçişi yok.
 *   - locations [0, 0.4, 0.75, 1] — geçişler alt-orta'da yoğunlaşır,
 *     üst tarafta açık ton, gözü yormaz.
 *   - Android: shadowColor KULLANILMAZ. Bunun yerine border highlight + iç
 *     gradient katmanı ile parlatma (cross-platform tutarlı görünüm).
 *
 * Tier eşikleri (constants/spAmountTier.ts ile aynı):
 *   basic     :  1 - 24 SP   (gümüş/teal)
 *   premium   : 25 - 99 SP   (krem→altın)
 *   elite     : 100 - 499 SP (toz pembe→fuşya)
 *   legendary : 500+ SP      (lavanta→mor)
 */

import { Platform, ViewStyle } from 'react-native';
import type { SPAmountTier } from './spAmountTier';

export interface TierPalette {
  /** Ana accent (border, chip, ikon, buton border) */
  accent: string;
  /** Ana accent + 33% opaklık (chip background, hafif vurgu) */
  accentSoft: string;
  /** Ana accent + 1A (10%) opaklık (panel iç tint, en hafif) */
  accentTint: string;
  /** Sayı/amount text rengi (krem → açık ton) */
  amountText: string;
  /**
   * Slider/buton/glow için 4-stop YUMUŞAK gradient.
   * locations: [0, 0.4, 0.75, 1] — açık üst → ana orta → koyu alt.
   */
  fillGrad: [string, string, string, string];
  /** Gradient locations — keskin geçiş engellemek için */
  fillLocations: [number, number, number, number];
  /** Buton gradienti — fillGrad'in son 3 stop'u (üst hafifçe açık, alt koyu) */
  buttonGrad: [string, string, string];
  /** Top-edge highlight (panel üstünde 1.5px parlak çizgi) */
  topEdge: string;
  /** Tier rozeti (basic'te null — etiket gizlenir) */
  label: string | null;
}

export const TIER_PALETTES: Record<SPAmountTier, TierPalette> = {
  basic: {
    accent: '#94A3B8',
    accentSoft: 'rgba(148,163,184,0.20)',
    accentTint: 'rgba(148,163,184,0.10)',
    amountText: '#E2E8F0',
    // Krem-gri → orta gri → koyu gri (4 stop, soft pastel)
    fillGrad: ['#F1F5F9', '#E2E8F0', '#CBD5E1', '#94A3B8'],
    fillLocations: [0, 0.4, 0.75, 1],
    buttonGrad: ['#E2E8F0', '#94A3B8', '#64748B'],
    topEdge: 'rgba(148,163,184,0.55)',
    label: null,
  },
  premium: {
    accent: '#FBBF24',
    accentSoft: 'rgba(251,191,36,0.20)',
    accentTint: 'rgba(251,191,36,0.10)',
    amountText: '#FFE8A0',
    // Krem → altın → koyu altın (yumuşak, parlak değil)
    fillGrad: ['#FFF7ED', '#FDE68A', '#FBBF24', '#D97706'],
    fillLocations: [0, 0.4, 0.75, 1],
    buttonGrad: ['#FDE68A', '#FBBF24', '#D97706'],
    topEdge: 'rgba(251,191,36,0.75)',
    label: 'PREMIUM',
  },
  elite: {
    accent: '#F472B6',
    accentSoft: 'rgba(244,114,182,0.20)',
    accentTint: 'rgba(244,114,182,0.10)',
    amountText: '#FFE4E6',
    // Toz pembe → açık fuşya → fuşya → koyu fuşya
    fillGrad: ['#FCE7F3', '#F9A8D4', '#F472B6', '#BE185D'],
    fillLocations: [0, 0.4, 0.75, 1],
    buttonGrad: ['#F9A8D4', '#F472B6', '#BE185D'],
    topEdge: 'rgba(244,114,182,0.80)',
    label: 'ELITE',
  },
  legendary: {
    accent: '#A78BFA',
    accentSoft: 'rgba(167,139,250,0.22)',
    accentTint: 'rgba(167,139,250,0.10)',
    amountText: '#F5F3FF',
    // Lavanta → açık mor → mor → derin mor
    fillGrad: ['#EDE9FE', '#C4B5FD', '#A78BFA', '#7C3AED'],
    fillLocations: [0, 0.4, 0.75, 1],
    buttonGrad: ['#C4B5FD', '#A78BFA', '#7C3AED'],
    topEdge: 'rgba(167,139,250,0.85)',
    label: 'LEGENDARY',
  },
};

/**
 * Panel zemin gradient — 4 tier için ortak (koyu, doygun).
 * Açık tier renkleri panel zemini değil, sadece glow/halo için.
 */
export const PANEL_BG_GRADIENT: [string, string, string] = ['#1c2330', '#11151e', '#06080d'];

/**
 * Cross-platform shadow helper.
 * iOS: shadowColor + shadowOffset/Opacity/Radius
 * Android: elevation YOK (gri görünür) — border + iç gradient telafi eder.
 *
 * Kullanım:
 *   const palette = TIER_PALETTES[tier];
 *   <View style={[styles.panel, tierShadow(palette.accent)]}>
 */
export const tierShadow = (accent: string): ViewStyle =>
  Platform.OS === 'ios'
    ? {
        shadowColor: accent,
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      }
    : {};

/**
 * Buton için cross-platform shadow — iOS renkli glow, Android'de boş.
 * Android'de parlatma için border 1.5px + buttonGrad zaten yeterli.
 */
export const tierButtonShadow = (accent: string): ViewStyle =>
  Platform.OS === 'ios'
    ? {
        shadowColor: accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.40,
        shadowRadius: 10,
      }
    : {};
