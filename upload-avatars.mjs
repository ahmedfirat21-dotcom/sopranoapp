import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://kpofiuczyjesjlqjxswh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function upload() {
  const avatarsDir = path.join(process.cwd(), 'assets', 'avatars');
  const files = fs.readdirSync(avatarsDir).filter(f => f.endsWith('.png'));
  
  const urls = [];
  for (const file of files) {
    const filePath = path.join(avatarsDir, file);
    const buffer = fs.readFileSync(filePath);
    
    const { data, error } = await supabase.storage.from('avatars').upload(`system/${file}`, buffer, {
      contentType: 'image/png',
      upsert: true
    });
    
    if (error) {
      console.error(`Error uploading ${file}:`, error.message);
    } else {
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(`system/${file}`).data.publicUrl;
      urls.push(publicUrl);
      console.log(`Uploaded ${file}`);
    }
  }
  
  fs.writeFileSync('uploaded_avatars.json', JSON.stringify(urls, null, 2));
  console.log('Successfully uploaded and wrote uploaded_avatars.json!');
}

upload();
