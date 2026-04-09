-- SopranoChat — Yeni Lottie Hediye Kataloğu
-- Eski kayıtları sil, 60 yeni hediye ekle

DELETE FROM gifts_catalog;

INSERT INTO gifts_catalog (id, name, price, animation_url, is_premium) VALUES
-- KATMAN 1: Ucuz (1-10 SC)
('fireworks_mini', 'Mini Havai Fişek', 1, 'lottie/gifts/Fireworks.json', false),
('kiss_heart', 'Öpücük', 2, 'lottie/gifts/Kiss_of_the_heart.json', false),
('check_done', 'Onay', 2, 'lottie/gifts/Done.json', false),
('sword_pull', 'Kılıç', 3, 'lottie/gifts/sword_pull.json', false),
('red_diamond', 'Kırmızı Elmas', 5, 'lottie/gifts/Red_Diamond.json', false),
('boat', 'Tekne', 5, 'lottie/gifts/boat.json', false),
('spy_guy', 'Casus', 5, 'lottie/gifts/Spy_Guy.json', false),
('star_strike', 'Yıldız Patlaması', 7, 'lottie/gifts/Star_Strike_Emoji.json', false),
('earth_party', 'Dünya Partisi', 8, 'lottie/gifts/Planet_Earth_-_Celebrating_with_stars_and_hat.json', false),
('mouth', 'Dudak', 8, 'lottie/gifts/Mouth.json', false),
('pro_badge', 'Pro Rozet', 10, 'lottie/gifts/Pro.json', false),
('food_feast', 'Ziyafet', 10, 'lottie/gifts/Food_animation.json', false),

-- KATMAN 2: Orta (15-50 SC)
('trust_shield', 'Güven Kalkanı', 15, 'lottie/gifts/Kodeeus_trust.json', false),
('rose', 'Gül', 15, 'lottie/gifts/Rose.json', false),
('fireworks_grand', 'Havai Fişek', 20, 'lottie/gifts/Fireworks_2.json', false),
('earth_love', 'Dünya Sevgisi', 20, 'lottie/gifts/Earth_Love_-_Earth_day.json', false),
('battle_sword', 'Savaş Kılıcı', 25, 'lottie/gifts/Sword.json', false),
('cool_emoji', 'Havalı Emoji', 25, 'lottie/gifts/Cool_emoji.json', false),
('cake', 'Pasta', 30, 'lottie/gifts/Cake.json', false),
('bored_hand', 'Alkış', 30, 'lottie/gifts/Loading_Animation_Bored_Hand.json', false),
('music_note', 'Nota', 35, 'lottie/gifts/Music_Note_Character.json', false),
('music_player', 'Müzik Çalar', 40, 'lottie/gifts/Music_Player.json', false),
('fish', 'Balık', 45, 'lottie/gifts/fish.json', false),
('alien_space', 'Uzaylı', 50, 'lottie/gifts/Alien_going_to_space_emoji_animation.json', false),

-- KATMAN 3: Premium (75-200 SC)
('party_cake', 'Kutlama Pastası', 75, 'lottie/gifts/Party_Cake.json', true),
('emoji_happy', 'Mutlu Emoji', 75, 'lottie/gifts/emoji.json', true),
('fire_passion', 'Ateşli Tutku', 80, 'lottie/gifts/Firery_Passion.json', true),
('bear_cute', 'Sevimli Ayı', 100, 'lottie/gifts/Bear.json', true),
('coffin_dance', 'Dans', 100, 'lottie/gifts/Dancing_Pallbearers.json', true),
('lion_run', 'Aslan', 125, 'lottie/gifts/Lion_Running.json', true),
('trophy', 'Kupa', 150, 'lottie/gifts/Trophy.json', true),
('bear_sticker', 'Ayıcık', 150, 'lottie/gifts/Bear_Animated_Sticker.json', true),
('money_save', 'Para Kasası', 175, 'lottie/gifts/Saving_the_Money.json', true),
('rocket_fly', 'Roket', 200, 'lottie/gifts/Flying_rocket_in_the_sky.json', true),
('crying_heart', 'Ağlayan Kalp', 200, 'lottie/gifts/Heart_characters_crying.json', true),
('rocket_launch', 'Roket Fırlatma', 200, 'lottie/gifts/Rocket_fly_out_the_laptop.json', true),

-- KATMAN 4: Lüks (300-1000 SC)
('laughing_cat', 'Gülen Kedi', 300, 'lottie/gifts/Cat_laughing_loudly._HahahahLOL_emojisticker_animation.json', true),
('rocket_loader', 'Süper Roket', 350, 'lottie/gifts/Rocket_loader.json', true),
('cute_tiger', 'Kaplan', 400, 'lottie/gifts/Cute_Tiger.json', true),
('love_birds', 'Aşk Kuşları', 450, 'lottie/gifts/Bird_pair_love_and_flying_sky.json', true),
('love_sheep', 'Aşık Kuzu', 500, 'lottie/gifts/Love_sheep.json', true),
('love_kiss', 'Aşk Öpücüğü', 500, 'lottie/gifts/Love_and_Kiss.json', true),
('sports_car', 'Spor Araba', 600, 'lottie/gifts/Car.json', true),
('perfume', 'Parfüm', 650, 'lottie/gifts/perfume.json', true),
('premium_rose', 'Premium Gül', 700, 'lottie/gifts/Rose1.json', true),
('love_dog', 'Aşık Köpek', 750, 'lottie/gifts/Love_dog.json', true),
('gaming', 'Oyuncu', 800, 'lottie/gifts/Hands_holding_a_joystick.json', true),
('dragon', 'Ejderha', 1000, 'lottie/gifts/Dragon.json', true),

-- KATMAN 5: Efsanevi (2000-10000 SC)
('shopping_spree', 'Alışveriş Çılgınlığı', 2000, 'lottie/gifts/shopping_cart.json', true),
('rocket_man', 'Roket Adam', 2500, 'lottie/gifts/Businessman_flies_up_with_rocket.json', true),
('snowman', 'Kardan Adam', 2500, 'lottie/gifts/Happy_snowman_jumping_and_waving_his_hand.json', true),
('inferno', 'Cehennem Ateşi', 3000, 'lottie/gifts/Fire.json', true),
('christmas_tree', 'Yılbaşı Ağacı', 3500, 'lottie/gifts/Christmas_Tree_Animation_-_1699891737968.json', true),
('smooth_cart', 'Lüks Alışveriş', 3500, 'lottie/gifts/Smooth_Shopping_Cart_Add-to-Cart_nteraction.json', true),
('rock_roll', 'Rock & Roll', 5000, 'lottie/gifts/Rock__Roll_man.json', true),
('game_over', 'Game Over', 5000, 'lottie/gifts/Game_Over.json', true),
('music_3d', '3D Müzik Enstrümanları', 7500, 'lottie/gifts/3D_Music_nstruments.json', true),
('kick_bear', 'Dövüşçü Ayı', 7500, 'lottie/gifts/My_kick_us_bear.json', true),
('soprano_king', 'Soprano King', 10000, 'lottie/gifts/3D_Medical.json', true),
('netflix_swoop', 'Sinema Gecesi', 10000, 'lottie/gifts/Netflix_Logo_Swoop.json', true);
