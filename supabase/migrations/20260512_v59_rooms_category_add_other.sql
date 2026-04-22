-- ═══════════════════════════════════════════════════════════════════
-- v59 — rooms.category CHECK constraint'e 'other' ekle
-- 2026-04-22
-- Amaç: create-room.tsx'teki 7. kategori "other" DB constraint'e yoktu, oda
-- oluştururken "violates check constraint" hatası atıyordu.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_category_check;
ALTER TABLE rooms ADD CONSTRAINT rooms_category_check
  CHECK (category = ANY (ARRAY['chat', 'music', 'game', 'book', 'film', 'tech', 'other']));
