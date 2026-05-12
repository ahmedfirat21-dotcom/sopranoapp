UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        editor_config,
        '{frame_config,size_overrides,profile,frame_pulse_ring}',
        'false'::jsonb
      ),
      '{frame_config,size_overrides,profile,frame_shimmer}',
      'false'::jsonb
    ),
    '{frame_config,size_overrides,profile,frame_breathe}',
    'false'::jsonb
  ),
  '{frame_config,size_overrides,profile,avatar_border_enabled}',
  'true'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';

UPDATE cosmetic_items SET editor_config = jsonb_set(
  jsonb_set(
    editor_config,
    '{frame_config,size_overrides,profile,avatar_border_width}',
    '5'::jsonb
  ),
  '{frame_config,size_overrides,profile,avatar_border_color}',
  '"#ff00ff"'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
