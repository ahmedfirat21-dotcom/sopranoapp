-- ═══════════════════════════════════════════════════════════════════
-- v52 — room_invites: RLS policy'ler permissive yapıldı
-- Tarih: 2026-04-22
-- Amaç: Firebase auth kullanan SopranoChat'te auth.uid() NULL döner.
--       v16'da eklenen `auth.uid()::text = invited_by` WITH CHECK
--       Firebase auth koşullarında her zaman FALSE → INSERT reject.
--       Sonuç: "davet edilen kişiye davet bildirimi kesinlikle gitmiyor"
--       — davet hiç yazılmıyor.
--
-- Strateji: notifications tablosundaki pattern'i (permissive RLS + app-layer
-- validation) room_invites'a da uygula. Kullanıcı UI'da sadece kendi açtığı
-- odaya davet gönderebildiği için invited_by client-side kontrol ediliyor.
-- SECURITY DEFINER RPC ile sertleştirme gelecek sprint işi.
-- ═══════════════════════════════════════════════════════════════════

-- Eski restrictive policy'leri kaldır
DROP POLICY IF EXISTS "Users can read own invites" ON room_invites;
DROP POLICY IF EXISTS "Users can send invites" ON room_invites;
DROP POLICY IF EXISTS "Users can respond to invites" ON room_invites;
DROP POLICY IF EXISTS "Users can insert invites" ON room_invites;
DROP POLICY IF EXISTS "Users can update own invites" ON room_invites;
DROP POLICY IF EXISTS "invites_all" ON room_invites;

-- Permissive policy'ler — notifications pattern'i ile aynı
CREATE POLICY "invites_select_open" ON room_invites
  FOR SELECT USING (true);

CREATE POLICY "invites_insert_open" ON room_invites
  FOR INSERT WITH CHECK (true);

CREATE POLICY "invites_update_open" ON room_invites
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "invites_delete_open" ON room_invites
  FOR DELETE USING (true);

-- Doğrulama:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'room_invites';
