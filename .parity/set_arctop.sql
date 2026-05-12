UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      editor_config,
      '{frame_config,size_overrides,profile,avatar_sepia}',
      '0'::jsonb
    ),
    '{frame_config,size_overrides,profile,name_curve_style}',
    '"arc-top"'::jsonb
  ),
  '{frame_config,size_overrides,profile,name_position}',
  '"top"'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
