UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      editor_config,
      '{frame_config,size_overrides,profile,name_curve_style}',
      '"flat"'::jsonb
    ),
    '{frame_config,size_overrides,profile,name_glow}',
    'true'::jsonb
  ),
  '{frame_config,size_overrides,profile,name_glow_intensity}',
  '1'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
