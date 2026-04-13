/**
 * SopranoChat — Paylaşılan Stil Sabitleri
 * ═══════════════════════════════════════════════════
 * DUP-1/DUP-4 FIX: Birden fazla dosyada tekrarlanan stil sabitleri
 * burada merkezileştirildi.
 */

/** Standart kart gölgesi — profil, oda kartları vb. */
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 8,
  elevation: 6,
};

/** Neon metin parıltısı — öne çıkan başlıklar */
export const textGlow = (color: string = '#14B8A6') => ({
  textShadowColor: color,
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 12,
});
