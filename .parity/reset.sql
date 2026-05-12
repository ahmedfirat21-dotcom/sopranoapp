-- Restore size_overrides with profile config.
UPDATE cosmetic_items SET editor_config = jsonb_set(
  editor_config,
  '{frame_config,size_overrides}',
  '{"profile": {"name_offset": 10, "avatar_ratio": 0.8, "avatar_shape": "circle", "glow_enabled": true, "name_enabled": true}}'::jsonb,
  true
) WHERE id='frames_turkuaz_premium_0xik';

SELECT jsonb_pretty(editor_config->'frame_config'->'size_overrides')
FROM cosmetic_items WHERE id='frames_turkuaz_premium_0xik';
