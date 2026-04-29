// ★ 2026-04-24: Üst banner slide-down animasyonu — sadece uygulama ilk açıldığında.
// Modül seviyesi state: JS runtime ömrü boyunca bir kez true olur, force-kill sonrası sıfırlanır.
let _played = false;
export function bannerIntroPlayed(): boolean {
  return _played;
}
export function markBannerIntroPlayed(): void {
  _played = true;
}
