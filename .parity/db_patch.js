// Usage: node db_patch.js '<json patch object>'
// Patches DB: size_overrides.profile MERGE with patch (sets if missing).
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/SopranoChat/.env.local' });

const SUPA_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) {
  console.error('MISSING ENV: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPA_URL, SERVICE_KEY);

(async () => {
  const arg = process.argv[2];
  const id = 'frames_turkuaz_premium_0xik';
  let patch;
  try { patch = JSON.parse(arg); } catch (e) {
    console.error('Invalid JSON:', arg);
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('cosmetic_items')
    .select('editor_config')
    .eq('id', id)
    .single();
  if (error) { console.error(error); process.exit(1); }

  const cfg = data.editor_config || {};
  const frame = cfg.frame_config || {};
  const overrides = frame.size_overrides || {};
  const profile = overrides.profile || {};

  const newProfile = { ...profile, ...patch };
  const newCfg = {
    ...cfg,
    frame_config: {
      ...frame,
      size_overrides: { ...overrides, profile: newProfile },
    },
  };

  const { error: upErr } = await supabase
    .from('cosmetic_items')
    .update({ editor_config: newCfg })
    .eq('id', id);
  if (upErr) { console.error(upErr); process.exit(1); }

  console.log('OK patched profile override:', JSON.stringify(newProfile));
})();
