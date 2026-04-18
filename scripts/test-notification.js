/**
 * SopranoChat — Bildirim Testi
 * ═══════════════════════════════════════════
 * Supabase notifications tablosuna test bildirimi ekler.
 * 
 * Kullanım: node scripts/test-notification.js <hedef_user_id>
 * Örnek:   node scripts/test-notification.js abc123XYZ
 */
const { createClient } = require('@supabase/supabase-js');

// ★ Supabase bağlantı bilgileri — .env veya constants/supabase'den al
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  ⚠️  Supabase credentials bulunamadı!');
  console.log('');
  console.log('  Alternatif: Supabase SQL Editor\'de şunu çalıştır:');
  console.log('');

  const targetUserId = process.argv[2] || '<SENIN_USER_ID>';
  
  console.log(`  -- Test 1: Oda daveti bildirimi`);
  console.log(`  INSERT INTO notifications (user_id, sender_id, type, reference_id, body, is_read)`);
  console.log(`  VALUES ('${targetUserId}', '${targetUserId}', 'room_invite', 'test-room-123', 'Test Kullanıcı seni "Müzik Odası" na davet etti', false);`);
  console.log('');
  console.log(`  -- Test 2: Hediye bildirimi`);
  console.log(`  INSERT INTO notifications (user_id, sender_id, type, body, is_read)`);
  console.log(`  VALUES ('${targetUserId}', '${targetUserId}', 'gift', 'Test Kullanıcı sana Elmas Yüzük gönderdi', false);`);
  console.log('');
  console.log(`  -- Test 3: Cevapsız arama bildirimi`);
  console.log(`  INSERT INTO notifications (user_id, sender_id, type, body, is_read)`);
  console.log(`  VALUES ('${targetUserId}', '${targetUserId}', 'missed_call', 'Test Kullanıcı seni aradı', false);`);
  console.log('');
  console.log(`  -- Tüm bildirimleri gör:`);
  console.log(`  SELECT id, type, body, is_read, created_at FROM notifications WHERE user_id = '${targetUserId}' ORDER BY created_at DESC LIMIT 10;`);
  console.log('');
  console.log('═══════════════════════════════════════════');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const targetUserId = process.argv[2];
  if (!targetUserId) {
    console.error('❌ Kullanım: node scripts/test-notification.js <user_id>');
    process.exit(1);
  }

  console.log(`📨 Test bildirimleri gönderiliyor → ${targetUserId}`);

  // Test 1: Oda daveti
  const { error: e1 } = await supabase.from('notifications').insert({
    user_id: targetUserId,
    sender_id: targetUserId,
    type: 'room_invite',
    reference_id: 'test-room-123',
    body: 'Test Kullanıcı seni "Müzik Odası" odasına davet etti',
    is_read: false,
  });
  console.log(e1 ? `❌ Oda daveti: ${e1.message}` : '✅ Oda daveti bildirimi eklendi');

  // Test 2: Hediye
  const { error: e2 } = await supabase.from('notifications').insert({
    user_id: targetUserId,
    sender_id: targetUserId,
    type: 'gift',
    body: 'Test Kullanıcı sana 🎁 Elmas Yüzük gönderdi',
    is_read: false,
  });
  console.log(e2 ? `❌ Hediye: ${e2.message}` : '✅ Hediye bildirimi eklendi');

  // Test 3: Cevapsız arama
  const { error: e3 } = await supabase.from('notifications').insert({
    user_id: targetUserId,
    sender_id: targetUserId,
    type: 'missed_call',
    body: 'Test Kullanıcı seni aradı',
    is_read: false,
  });
  console.log(e3 ? `❌ Cevapsız arama: ${e3.message}` : '✅ Cevapsız arama bildirimi eklendi');

  console.log('\n🔔 Zil simgesine tıkla — 3 test bildirimi görünmeli!');
}

main().catch(console.error);
