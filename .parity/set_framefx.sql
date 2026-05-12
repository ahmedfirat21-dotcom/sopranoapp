UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        editor_config,
        '{frame_config,size_overrides,profile,name_glow}',
        'false'::jsonb
      ),
      '{frame_config,size_overrides,profile,frame_pulse_ring}',
      'true'::jsonb
    ),
    '{frame_config,size_overrides,profile,frame_shimmer}',
    'true'::jsonb
  ),
  '{frame_config,size_overrides,profile,frame_breathe}',
  'true'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
