const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://kpofiuczyjesjlqjxswh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA';
const supabase = createClient(supabaseUrl, supabaseKey);
const fs = require('fs');

async function upload() {
  const fileContent = fs.readFileSync('privacy_policy.html', 'utf8');
  
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload('privacy_policy.html', fileContent, {
      contentType: 'text/html',
      upsert: true
    });

  if (error) {
    console.error('Hata:', error.message);
    return;
  }
  
  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl('privacy_policy.html');
  console.log('POLICY_URL: ' + publicUrlData.publicUrl);
}

upload();
