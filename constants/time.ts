/**
 * SopranoChat — Zaman Yardımcıları
 * "5dk önce", "2sa önce" gibi göreceli zaman gösterimi.
 * Tüm sayfalar bu tek dosyayı kullanır.
 */

export function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}
