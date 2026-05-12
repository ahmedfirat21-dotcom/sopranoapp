UPDATE cosmetic_items SET editor_config = jsonb_set(
  editor_config,
  '{frame_config,size_overrides,profile,avatar_shape}',
  '"squircle"'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
