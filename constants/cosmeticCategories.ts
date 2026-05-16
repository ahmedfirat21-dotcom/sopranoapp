/**
 * Kozmetik kategori tanımları — APK + Web Admin ortak şeması
 * ════════════════════════════════════════════════════════════
 * ★ P1-4 (16 May 2026): Önceden kategori listesi iki yerdeydi
 *   (APK: app/store.tsx + Admin: magaza/categories.ts) — kayma riski yüksekti.
 *   Şimdi APK tarafı bu dosyadan okuyor. Admin proje ayrı repo olduğu için
 *   tam package paylaşımı yok; admin'in categories.ts dosyası bu listenin AYNISI
 *   olmalı. Yeni kategori eklenirse İKİ YERDE de güncelle.
 *
 * DB ENUM (cosmetic_items.category) → DB_CATEGORIES
 * APK Mağaza UI tab'ları              → APK_STORE_TABS
 *   APK'da extra olarak 'bundles' ve 'sp' var (cosmetic_bundles + sp_packages
 *   ayrı tablolar; category enum'da yer almazlar).
 */

/** DB'de cosmetic_items.category sütununa yazılabilen değerler. */
export type CosmeticDBCategory =
  | 'frames'
  | 'entry_effect'
  | 'gift'
  | 'glow_message'
  | 'effect'
  | 'background'
  | 'emoji'
  | 'badge';

/** APK mağaza UI tab'ları — DB kategorileri + bundle/sp sanal tab'lar. */
export type StoreTabKey =
  | 'bundles'        // cosmetic_bundles (paketler tablo)
  | 'frames'
  | 'entry_effect'
  | 'glow_message'
  | 'badge'
  | 'background'
  | 'effect'
  | 'emoji'
  | 'sp';            // sp_packages (gerçek para)
// 'gift' burada YOK — gift ürünleri oda içi pay-per-send paneli kullanır,
// mağaza tab olarak listelenmez. Admin uyarı banner'ı gösterir.

export interface CategoryDef {
  /** DB enum veya tab key */
  slug: string;
  /** Kullanıcıya gösterilecek isim (TR) */
  label: string;
  /** Açıklama (tooltip / banner) */
  description: string;
  /** Emoji ikon (web admin sidebar + chip filtre) */
  emoji: string;
  /** Ionicons ikonu (APK mağaza tab) — DB kategorisi olmayanlar için boş */
  ionIcon: string;
}

/** DB enum kategorileri (admin tarafından ürün eklenebilenler). */
export const DB_CATEGORIES: CategoryDef[] = [
  { slug: 'frames',        label: 'Çerçeveler',        description: 'Profil avatarı çerçeveleri',         emoji: '🖼',  ionIcon: 'ellipse-outline' },
  { slug: 'entry_effect',  label: 'Giriş Animasyonları', description: 'Odaya girişte oynayan animasyonlar',emoji: '✨', ionIcon: 'sparkles-outline' },
  { slug: 'gift',          label: 'Hediyeler',         description: 'Sohbete gönderilen hediyeler',        emoji: '🎁', ionIcon: 'gift-outline' },
  { slug: 'glow_message',  label: 'Parlak Mesajlar',   description: 'Sohbet baloncuk parıltısı',           emoji: '💬', ionIcon: 'chatbubble-outline' },
  { slug: 'effect',        label: 'Efektler',          description: 'Genel görsel efektler',               emoji: '🌟', ionIcon: 'flash-outline' },
  { slug: 'background',    label: 'Arkaplanlar',       description: 'Profil arkaplanları',                 emoji: '🌌', ionIcon: 'image-outline' },
  { slug: 'emoji',         label: 'Özel Emojiler',     description: 'Premium emojiler',                    emoji: '😎', ionIcon: 'happy-outline' },
  { slug: 'badge',         label: 'Rozetler',          description: 'Profil rozetleri',                    emoji: '🏅', ionIcon: 'ribbon-outline' },
];

/** APK mağaza tab'larının listesi (sırası APK'da gösterim sırasıdır). */
export const APK_STORE_TABS: { key: StoreTabKey; label: string; ionIcon: string }[] = [
  { key: 'bundles',       label: 'Setler',           ionIcon: 'cube-outline' },
  { key: 'frames',        label: 'Çerçeveler',       ionIcon: 'ellipse-outline' },
  { key: 'entry_effect',  label: 'Giriş Efektleri',  ionIcon: 'sparkles-outline' },
  { key: 'glow_message',  label: 'Parlak Mesajlar',  ionIcon: 'chatbubble-outline' },
  { key: 'badge',         label: 'Rozetler',         ionIcon: 'ribbon-outline' },
  { key: 'background',    label: 'Arkaplanlar',      ionIcon: 'image-outline' },
  { key: 'effect',        label: 'Efektler',         ionIcon: 'flash-outline' },
  { key: 'emoji',         label: 'Emojiler',         ionIcon: 'happy-outline' },
  { key: 'sp',            label: 'SP Paketleri',     ionIcon: 'diamond-outline' },
];

/** Slug'a göre DB kategorisi meta'sını bul (yoksa fallback). */
export function getCategoryDef(slug: string | null | undefined): CategoryDef {
  return DB_CATEGORIES.find(c => c.slug === slug) ?? {
    slug: slug || 'other',
    label: slug || 'Diğer',
    description: '',
    emoji: '📦',
    ionIcon: 'cube-outline',
  };
}

/** Yeni ürün oluşturma default emoji — kategoriye göre. */
export function defaultEmojiForCategory(slug: string | null | undefined): string {
  return getCategoryDef(slug).emoji;
}
