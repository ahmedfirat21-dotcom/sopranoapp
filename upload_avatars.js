const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kpofiuczyjesjlqjxswh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const artifactDir = 'C:\\Users\\yogun\\.gemini\\antigravity\\brain\\1737d619-c6ac-401e-9057-bcfef20cb7f4';

async function main() {
  console.log('Creating avatars bucket if it does not exist...');
  await supabase.storage.createBucket('avatars', { public: true });
  
  const files = fs.readdirSync(artifactDir).filter(f => f.startsWith('avatar_') && f.endsWith('.png'));
  const urls = [];
  
  for (const file of files) {
    const filePath = path.join(artifactDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`Uploading ${file}...`);
    const { data, error } = await supabase.storage.from('avatars').upload(`default/${file}`, fileBuffer, {
      contentType: 'image/png',
      upsert: true
    });
    
    if (error) {
      console.error('Error uploading:', file, error.message);
      continue;
    }
    
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(`default/${file}`);
    urls.push(publicUrl);
  }
  
  fs.writeFileSync(path.join(__dirname, 'avatar_urls.json'), JSON.stringify(urls, null, 2));
  console.log('Done! Saved to avatar_urls.json');
}

main();
