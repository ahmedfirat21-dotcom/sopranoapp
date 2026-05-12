UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    editor_config,
    '{frame_config,size_overrides,profile,avatar_shape}',
    '"circle"'::jsonb
  ),
  '{frame_config,size_overrides,profile,avatar_grayscale}',
  '100'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
