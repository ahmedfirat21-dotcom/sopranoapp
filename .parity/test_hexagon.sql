UPDATE cosmetic_items SET editor_config = jsonb_set(
  editor_config,
  '{frame_config,size_overrides,profile,avatar_shape}',
  '"hexagon"'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';

SELECT editor_config->'frame_config'->'size_overrides'->'profile'->'avatar_shape' AS shape
FROM cosmetic_items WHERE id='frames_turkuaz_premium_0xik';
