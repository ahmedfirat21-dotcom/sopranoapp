// Tüm odaları ve katılımcıları toplu silme scripti
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kpofiuczyjesjlqjxswh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA'
);

async function deleteAllRooms() {
  console.log('Tüm odalar siliniyor...');

  // 1. Önce tüm katılımcıları sil
  const { error: partError } = await supabase
    .from('room_participants')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // tüm satırları sil
  
  if (partError) {
    console.log('Katılımcı silme hatası:', partError.message);
  } else {
    console.log('Tüm katılımcılar silindi.');
  }

  // 2. Sonra tüm odaları sil
  const { error: roomError } = await supabase
    .from('rooms')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // tüm satırları sil
  
  if (roomError) {
    console.log('Oda silme hatası:', roomError.message);
  } else {
    console.log('Tüm odalar silindi!');
  }

  // 3. Doğrulama
  const { count } = await supabase
    .from('rooms')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Kalan oda sayısı: ${count}`);
}

deleteAllRooms();
