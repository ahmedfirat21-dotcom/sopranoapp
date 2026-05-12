-- Replaced each test run. Sets profile override fully.
UPDATE cosmetic_items SET editor_config = jsonb_set(
  editor_config,
  '{frame_config,size_overrides,profile}',
  '{"name_offset": 10, "avatar_ratio": 0.8, "avatar_shape": "hexagon", "glow_enabled": true, "name_enabled": true}'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
