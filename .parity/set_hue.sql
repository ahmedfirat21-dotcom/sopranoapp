UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    editor_config,
    '{frame_config,size_overrides,profile,avatar_saturation}',
    '1'::jsonb
  ),
  '{frame_config,size_overrides,profile,avatar_hue_rotate}',
  '180'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
