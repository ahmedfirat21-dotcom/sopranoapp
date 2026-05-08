-- v110.16 (8 May 2026) — Egzantrik şekilli çerçeveleri mağazadan kaldır.
--
-- Sebep: Avatar her zaman daire, ama altıgen/kare/glitch tarzı çerçeveler
-- avatarla "konuşmuyor" — köşelerinde boşluk kalıyor, uyumsuz duruyor.
-- Avatar shape'i frame'e adapte eden mask sistemi mimari iş; o yapılana
-- kadar bu çerçeveleri satılamaz hâle alıyoruz.
--
-- Eski sahipler aktarılmaz; UI tarafı asset'leri hâlâ render edebilir
-- (frameLottieRegistry kalıyor) — sadece mağaza listesinde görünmez,
-- yeni satın alma yapılamaz.

UPDATE public.cosmetic_items
SET active = false
WHERE id IN ('hex-prism', 'eclipse-corona', 'glitch-matrix', 'pulse-wave', 'celestial-orbit');
