-- ★ v109.1 (5 May 2026) — subscription_expires_at kolonu eklendi.
--
-- Problem: store_purchase + bundle_purchase RPC'leri bu kolonu okuyordu ama
-- profiles tablosunda yoktu → "column does not exist" runtime hatası.
--
-- NULL = sınırsız (ömür boyu üyelik veya devamlı subscription).
-- TIMESTAMPTZ = abonelik bitiş zamanı; geçerse Free tier davranışı.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
