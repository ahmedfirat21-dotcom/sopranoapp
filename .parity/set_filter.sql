UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    editor_config,
    '{frame_config,size_overrides,profile,avatar_brightness}',
    '0.5'::jsonb
  ),
  '{frame_config,size_overrides,profile,avatar_grayscale}',
  '0'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
