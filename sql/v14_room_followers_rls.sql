-- v14: room_followers tablosu için eksik RLS policy'leri
-- v4'te RLS enable edilmişti fakat hiçbir policy tanımlanmamıştı.

-- SELECT: Herkes görebilir (public oda takipçi sayısı için gerekli)
CREATE POLICY "room_followers_select"
  ON room_followers FOR SELECT
  USING (true);

-- INSERT: Sadece kendi takip kaydını ekleyebilirsin
CREATE POLICY "room_followers_insert"
  ON room_followers FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- DELETE: Sadece kendi takip kaydını silebilirsin
CREATE POLICY "room_followers_delete"
  ON room_followers FOR DELETE
  USING (auth.uid()::text = user_id);
