/**
 * SopranoChat — Mock Oda Oluşturucu
 * ═══════════════════════════════════════════════════
 * 3 oda oluşturur (Free / Plus / Pro sahipleri ile)
 * Her odaya tier limitine göre MAX katılımcı ekler.
 *
 * Tier Limitleri:
 *   Free:  5 speaker, 15 listener, 2 kamera, 0 mod,  4 saat
 *   Plus:  8 speaker, 25 listener, 6 kamera, 2 mod, 12 saat
 *   Pro:  13 speaker, ∞ listener, 10 kamera, 5 mod,  7/24
 */
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://kpofiuczyjesjlqjxswh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb2ZpdWN6eWplc2pscWp4c3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MzkxNjMsImV4cCI6MjA4ODAxNTE2M30.w3QMkePoTddmI6jdj_jJsdwV4LoxkOg6Nh4sIXrsAQA'
);

// ─── YARDIMCI: Rastgele Türk isim üretici ────────────────────
const firstNames = [
  'Ahmet', 'Mehmet', 'Ali', 'Mustafa', 'Emre', 'Burak', 'Can', 'Deniz',
  'Ege', 'Furkan', 'Gökhan', 'Hakan', 'İlker', 'Kaan', 'Mert', 'Onur',
  'Serkan', 'Tolga', 'Uğur', 'Volkan', 'Yasin', 'Zehra', 'Ayşe', 'Fatma',
  'Elif', 'Esra', 'Selin', 'Büşra', 'Derya', 'Gizem', 'Nazlı', 'Pınar',
  'Seda', 'Tuğba', 'Yasemin', 'Merve', 'Damla', 'İrem', 'Cansu', 'Nisa',
];

function randomName() {
  return firstNames[Math.floor(Math.random() * firstNames.length)];
}

function randomAvatar() {
  const id = Math.floor(Math.random() * 70) + 1;
  return `https://i.pravatar.cc/150?img=${id}`;
}

// ─── ANA FONKSİYON ──────────────────────────────────────────
async function main() {
  console.log('🎯 Mock oda oluşturucu başlatılıyor...\n');

  // 1) Mevcut profilleri çek (en az 50 kişi lazım)
  console.log('📋 Mevcut profiller çekiliyor...');
  const { data: existingProfiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, display_name, subscription_tier, is_admin, avatar_url')
    .order('created_at', { ascending: false })
    .limit(60);

  if (profErr || !existingProfiles || existingProfiles.length < 5) {
    console.error('❌ Profiller çekilemedi veya yetersiz:', profErr?.message);
    console.log(`   Bulunan profil: ${existingProfiles?.length || 0} (min 5 gerekli)`);
    return;
  }
  console.log(`✅ ${existingProfiles.length} profil bulundu.\n`);

  // Profilleri tier'a göre ayır
  const freeUsers = existingProfiles.filter(p => (p.subscription_tier || 'Free') === 'Free' && !p.is_admin);
  const plusUsers = existingProfiles.filter(p => p.subscription_tier === 'Plus');
  const proUsers = existingProfiles.filter(p => p.subscription_tier === 'Pro' || p.is_admin);
  const allUsers = existingProfiles;

  console.log(`   Free: ${freeUsers.length} | Plus: ${plusUsers.length} | Pro/Admin: ${proUsers.length}`);

  // Host seçimi — en az birer kişi lazım
  // Free host: ilk free user (yoksa ilk herhangi biri)
  const freeHost = freeUsers[0] || allUsers[0];
  // Plus host: ilk plus user (yoksa ikinci kullanıcı)
  const plusHost = plusUsers[0] || allUsers[1] || allUsers[0];
  // Pro host: ilk pro/admin user (yoksa üçüncü kullanıcı)
  const proHost = proUsers[0] || allUsers[2] || allUsers[0];

  // Katılımcı havuzu (host'lar hariç)
  const hostIds = new Set([freeHost.id, plusHost.id, proHost.id]);
  const participantPool = allUsers.filter(p => !hostIds.has(p.id));

  if (participantPool.length < 5) {
    console.error('❌ Yeterli katılımcı yok. En az 8 profil gerekli.');
    return;
  }

  console.log(`\n   Host Free: ${freeHost.display_name} (${freeHost.id.slice(0, 8)}...)`);
  console.log(`   Host Plus: ${plusHost.display_name} (${plusHost.id.slice(0, 8)}...)`);
  console.log(`   Host Pro:  ${proHost.display_name} (${proHost.id.slice(0, 8)}...)`);
  console.log(`   Katılımcı havuzu: ${participantPool.length} kişi`);

  // 2) 3 Oda konfigürasyonu
  const roomConfigs = [
    {
      tierName: 'Free',
      host: freeHost,
      name: '🆓 Free Oda — Maksimum Kapasite',
      category: 'sohbet',
      maxSpeakers: 5,
      maxListeners: 15,
      maxCameras: 2,
      speakerCount: Math.min(5, participantPool.length + 1),
      listenerCount: Math.min(15, Math.max(participantPool.length - 5, 3)),
      cameraOnCount: 2,
      modCount: 0,
      type: 'open',
    },
    {
      tierName: 'Plus',
      host: plusHost,
      name: '🚀 Plus Oda — Tam Dolu',
      category: 'müzik',
      maxSpeakers: 8,
      maxListeners: 25,
      maxCameras: 6,
      speakerCount: Math.min(8, participantPool.length + 1),
      listenerCount: Math.min(25, Math.max(participantPool.length - 8, 5)),
      cameraOnCount: Math.min(6, participantPool.length + 1),
      modCount: 2,
      type: 'open',
    },
    {
      tierName: 'Pro',
      host: proHost,
      name: '👑 Pro Oda — Sınırsız Güç',
      category: 'eğlence',
      maxSpeakers: 13,
      maxListeners: 999,
      maxCameras: 10,
      speakerCount: Math.min(13, participantPool.length + 1),
      listenerCount: Math.min(20, Math.max(participantPool.length - 13, 5)),
      cameraOnCount: Math.min(10, participantPool.length + 1),
      modCount: Math.min(5, participantPool.length),
      type: 'open',
    },
  ];

  let pIdx = 0; // global participant index

  for (const cfg of roomConfigs) {
    console.log(`\n🏠 ${cfg.tierName} odası oluşturuluyor: "${cfg.name}"`);
    console.log(`   Sahne: ${cfg.speakerCount} speaker | Dinleyici: ${cfg.listenerCount} | Kamera: ${cfg.cameraOnCount} | Mod: ${cfg.modCount}`);

    // Oda oluştur
    const totalPeople = cfg.speakerCount + cfg.listenerCount;
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({
        name: cfg.name,
        host_id: cfg.host.id,
        category: cfg.category,
        type: cfg.type,
        is_live: true,
        listener_count: totalPeople,
        max_speakers: cfg.maxSpeakers,
        room_settings: {
          max_cameras: cfg.maxCameras,
          max_moderators: cfg.modCount,
          tier: cfg.tierName,
        },
      })
      .select('id')
      .single();

    if (roomErr) {
      console.error(`   ❌ Oda hatası: ${roomErr.message}`);
      continue;
    }
    const roomId = room.id;
    console.log(`   ✅ Oda oluşturuldu: ${roomId}`);

    // Katılımcıları ekle
    const roomParticipants = [];

    // Host → speaker + kamera açık
    roomParticipants.push({
      room_id: roomId,
      user_id: cfg.host.id,
      role: 'speaker',
      is_muted: false,
      is_camera_on: true,
      is_hand_raised: false,
      is_moderator: false,
    });

    // Diğer speaker'lar
    for (let s = 0; s < cfg.speakerCount - 1; s++) {
      const p = participantPool[pIdx % participantPool.length];
      pIdx++;
      const cameraOn = s < (cfg.cameraOnCount - 1);
      const isMod = s < cfg.modCount;

      roomParticipants.push({
        room_id: roomId,
        user_id: p.id,
        role: 'speaker',
        is_muted: Math.random() > 0.6,
        is_camera_on: cameraOn,
        is_hand_raised: false,
        is_moderator: isMod,
      });
    }

    // Listener'lar
    for (let l = 0; l < cfg.listenerCount; l++) {
      const p = participantPool[pIdx % participantPool.length];
      pIdx++;

      roomParticipants.push({
        room_id: roomId,
        user_id: p.id,
        role: 'listener',
        is_muted: true,
        is_camera_on: false,
        is_hand_raised: Math.random() > 0.85,
        is_moderator: false,
      });
    }

    // Katılımcıları ekle
    const { error: partErr } = await supabase
      .from('room_participants')
      .insert(roomParticipants);

    if (partErr) {
      console.error(`   ❌ Katılımcı ekleme hatası: ${partErr.message}`);
    } else {
      console.log(`   ✅ ${roomParticipants.length} katılımcı eklendi (${cfg.speakerCount} speaker + ${cfg.listenerCount} listener)`);
    }

    // Listener count güncelle
    await supabase.from('rooms').update({ listener_count: roomParticipants.length }).eq('id', roomId);
  }

  console.log('\n\n════════════════════════════════════════');
  console.log('🎉 TAMAMLANDI! 3 mock oda oluşturuldu:');
  console.log('════════════════════════════════════════');
  console.log('');
  console.log('🆓 FREE ODA:');
  console.log('   • 5/5 sahne (MAX) — 2 kamera açık');
  console.log('   • 15/15 dinleyici (MAX)');
  console.log('   • 0 moderatör (Free: mod atanamaz)');
  console.log('   • 4 saat süre limiti');
  console.log('   • Grid layout only');
  console.log('');
  console.log('🚀 PLUS ODA:');
  console.log('   • 8/8 sahne (MAX) — 6 kamera açık');
  console.log('   • 25/25 dinleyici (MAX)');
  console.log('   • 2 moderatör (MAX)');
  console.log('   • 12 saat süre limiti');
  console.log('   • Grid + Spotlight layouts');
  console.log('   • Kalıcı oda (persistent)');
  console.log('');
  console.log('👑 PRO ODA:');
  console.log('   • 13/13 sahne (MAX) — 10 kamera açık');
  console.log('   • 20 dinleyici (sınırsız kapasiteli)');
  console.log('   • 5 moderatör (MAX)');
  console.log('   • 7/24 sınırsız süre');
  console.log('   • Grid + Spotlight + Theater layouts');
  console.log('   • Stereo ses, 48kHz, 1080p video');
  console.log('   • Oda müziği desteği');
  console.log('');
}

main().catch(console.error);
