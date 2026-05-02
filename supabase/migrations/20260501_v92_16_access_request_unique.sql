-- ★ v92.16 (1 May 2026): room_access_requests tablosuna (room_id, user_id) UNIQUE constraint.
--
-- BUG: Kullanıcı "İstek Gönder" basınca toast: "İstek kaydedilemedi: there is no unique
--      or exclusion constraint matching the ON CONFLICT specification"
--
-- SEBEP: services/roomAccess.ts upsert({...}, { onConflict: 'room_id,user_id' }) kullanıyordu
--        ama (room_id, user_id) için UNIQUE constraint yoktu. PostgreSQL ON CONFLICT için
--        unique veya exclusion constraint zorunlu.
--
-- FİX: Composite unique constraint ekle. Aynı kullanıcı aynı odaya birden fazla pending
--      istek atamaz; tekrar denerse mevcut satır UPDATE'lenir (upsert davranışı).

ALTER TABLE room_access_requests
  ADD CONSTRAINT room_access_requests_room_user_unique UNIQUE (room_id, user_id);
