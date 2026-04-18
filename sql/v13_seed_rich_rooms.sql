DO $$
DECLARE
  v_host_id uuid;
BEGIN
  -- Sistemdeki mevcut ilk kullanıcıyı bulup odaların sahibi (host) yapalım
  SELECT id INTO v_host_id FROM public.profiles LIMIT 1;
  
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Veritabanında hiç kullanıcı yok! Önce uygulamadan bir kez giriş yapıp hesap oluştur.';
  END IF;

  -- Eski boş/deneme odaları temizle
  DELETE FROM public.rooms;

  -- Gerçekçi, profesyonel arka planlı, yüksek dinleyicili ve Boost (Alevli) odalar ekle
  INSERT INTO public.rooms (id, host_id, title, description, category, language, background_image, listener_count, status, is_live, boost_expires_at, settings)
  VALUES
  (gen_random_uuid(), v_host_id, '🔥 Gece Jazz & Muhabbet 🎷', 'Sadece sakin müzik ve kaliteli gece sohbeti. İstek şarkı alınır. Herkes davetlidir!', 'music', 'tr', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', 142, 'active', true, now() + interval '2 hours', '{"stage_capacity": 5, "is_private": false}'::jsonb),
  
  (gen_random_uuid(), v_host_id, 'Bitcoin Yine Ne Olacak? 📉', 'Kripto piyasalarında son durum, altcoin sepetleri ve sohbet. Yatırım tavsiyesi değildir.', 'tech', 'tr', 'https://images.unsplash.com/photo-1621504450181-5d356f61d307?w=800&q=80', 215, 'active', true, now() + interval '5 hours', '{"stage_capacity": 3, "is_private": false}'::jsonb),

  (gen_random_uuid(), v_host_id, 'Geyik, Sohbet, Goygoy ☕', 'Her telden konuşuyoruz. Sahneye çıkmak serbest.', 'chat', 'tr', 'https://images.unsplash.com/photo-1521913626209-0fbf68f4c4b1?w=800&q=80', 58, 'active', true, null, '{"stage_capacity": 8, "is_private": false}'::jsonb),
  
  (gen_random_uuid(), v_host_id, 'Valorant Rank Kasıyoruz 🎮', 'Dereceli girecek, sesli iletişim yapacak toksik olmayan arkadaşlar sahneye.', 'gaming', 'tr', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80', 12, 'active', true, null, '{"stage_capacity": 4, "is_private": false}'::jsonb);

END $$;
