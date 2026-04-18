import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { RoomService, getRoomLimits, type TierName } from '../services/database';
import { isTierAtLeast } from '../constants/tiers';
import { GamificationService } from '../services/gamification';
import { Colors } from '../constants/theme';
import { showToast } from '../components/Toast';
import StatusAvatar from '../components/StatusAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './_layout';
import AppBackground from '../components/AppBackground';
import { UpsellService } from '../services/upsell';
import { supabase } from '../constants/supabase';
import InviteFriendsModal from '../components/room/InviteFriendsModal';
import { PushService } from '../services/push';
import { RoomAccessService } from '../services/roomAccess';
import type { FollowUser } from '../services/friendship';
import * as ImagePicker from 'expo-image-picker';



// Tema haritası — RoomSettingsSheet ile aynı
const ROOM_THEMES: { id: string; name: string; colors: [string, string] }[] = [
  { id: 'ocean',   name: 'Okyanus',    colors: ['#0E4D6F', '#083344'] },
  { id: 'sunset',  name: 'Gün Batımı', colors: ['#7F1D1D', '#4C0519'] },
  { id: 'forest',  name: 'Orman',      colors: ['#14532D', '#052E16'] },
  { id: 'galaxy',  name: 'Galaksi',    colors: ['#312E81', '#1E1B4B'] },
  { id: 'aurora',  name: 'Aurora',     colors: ['#134E4A', '#042F2E'] },
  { id: 'cherry',  name: 'Kiraz',      colors: ['#831843', '#500724'] },
  { id: 'cyber',   name: 'Cyber',      colors: ['#1E3A8A', '#172554'] },
  { id: 'volcano', name: 'Volkan',     colors: ['#7C2D12', '#431407'] },
];

// Kategori önizleme theme'leri (keşfet sayfasındaki oda kartı ile aynı)
const CATEGORY_THEME_PREVIEW: Record<string, { colors: [string, string, string] }> = {
  chat:  { colors: ['#1E3A5F', '#0F2744', '#0A1929'] },
  music: { colors: ['#3B1F5E', '#2D1648', '#1A0D2E'] },
  game:  { colors: ['#4A1525', '#3A0F1E', '#260A14'] },
  tech:  { colors: ['#0F2E4A', '#0A2038', '#061525'] },
  book:  { colors: ['#3D2E10', '#2E2108', '#1F1605'] },
  film:  { colors: ['#3B1042', '#2D0C34', '#1F0824'] },
  other: { colors: ['#1E293B', '#151E2E', '#0F172A'] },
};

const CATEGORIES = [
  { id: 'chat', label: 'Sohbet', icon: 'chatbubbles', color: '#14B8A6' },
  { id: 'music', label: 'Müzik', icon: 'musical-notes', color: '#8B5CF6' },
  { id: 'game', label: 'Oyun', icon: 'game-controller', color: '#EF4444' },
  { id: 'tech', label: 'Teknoloji', icon: 'code-slash', color: '#3B82F6' },
  { id: 'book', label: 'Kitap', icon: 'book', color: '#F59E0B' },
  { id: 'film', label: 'Film', icon: 'film', color: '#EC4899' },
  { id: 'other', label: 'Diğer', icon: 'ellipsis-horizontal', color: '#64748B' },
];

const ROOM_TYPES = [
  { id: 'open', label: 'Açık', icon: 'globe-outline', desc: 'Herkes katılabilir', minTier: 'Free' },
  { id: 'closed', label: 'Şifreli', icon: 'lock-closed-outline', desc: 'Şifre ile giriş', minTier: 'Plus' },
  { id: 'invite', label: 'Davetli', icon: 'mail-outline', desc: 'Sadece davetliler', minTier: 'Pro' },
] as const;

const SPEAKING_MODES = [
  { id: 'free_for_all', label: 'Serbest', icon: 'people', desc: 'Herkes konuşur', minTier: 'Free' as const },
  { id: 'permission_only', label: 'İzinli', icon: 'hand-left', desc: 'El kaldır', minTier: 'Free' as const },
  { id: 'selected_only', label: 'Seçilmişler', icon: 'shield-checkmark', desc: 'Sadece davetli', minTier: 'Pro' as const },
];

/**
 * ★ BUG-CR1: Yerel file:// URI'yi Supabase Storage'a yükle
 * Diğer kullanıcılar yerel URI'lere erişemez — public URL gerekli.
 */
async function uploadRoomImage(userId: string, localUri: string, prefix: 'card' | 'bg'): Promise<string> {
  try {
    const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `room-images/${userId}/${prefix}_${Date.now()}.${ext}`;

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('public')
      .upload(fileName, blob, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`, upsert: true });

    if (error) {
      if (__DEV__) console.warn('[UploadRoomImage] Upload error:', error.message);
      return ''; // Yükleme başarısız — görselsiz devam et
    }

    const { data: urlData } = supabase.storage.from('public').getPublicUrl(fileName);
    return urlData?.publicUrl || '';
  } catch (e) {
    if (__DEV__) console.warn('[UploadRoomImage] Error:', e);
    return '';
  }
}

export default function CreateRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, profile } = useAuth();
  const isAdmin = profile?.is_admin === true;
  // GodMaster admin = sınırsız Pro yetki
  const tier = (isAdmin ? 'Pro' : (profile?.subscription_tier || 'Free')) as TierName;
  const limits = useMemo(() => getRoomLimits(tier), [tier]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('chat');
  const [type, setType] = useState('open');
  const [mode, setMode] = useState('audio');
  const [description, setDescription] = useState('');

  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [speakingMode, setSpeakingMode] = useState<'free_for_all' | 'permission_only' | 'selected_only'>('permission_only');
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Gelişmiş Ayarlar (tier-gated)
  const [entryFee, setEntryFee] = useState(0);
  const [donationsEnabled, setDonationsEnabled] = useState(false);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [cardImage, setCardImage] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [createdRoomName, setCreatedRoomName] = useState('');

  const canCreate = name.trim().length >= 2 && (type !== 'closed' || password.trim().length >= 4);

  // ★ Bugünkü oda açma sayısını göster
  const [todayRoomCount, setTodayRoomCount] = useState(0);
  useEffect(() => {
    if (!firebaseUser?.uid || limits.dailyRooms >= 999) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    (async () => {
      try {
        const { count } = await supabase
          .from('rooms')
          .select('id', { count: 'exact', head: true })
          .eq('host_id', firebaseUser.uid)
          .gte('created_at', todayStart.toISOString());
        setTodayRoomCount(count || 0);
      } catch {}
    })();
  }, [firebaseUser?.uid, limits.dailyRooms]);

  const handleCreate = async () => {
    if (!canCreate || !firebaseUser || creating) return;

    if (!limits.allowedTypes.includes(type)) {
      showToast({ title: 'Yetersiz Üyelik', message: 'Bu oda tipini açmak için üyeliğinizi yükseltin.', type: 'warning' });
      return;
    }

    if (limits.dailyRooms < 999) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('rooms')
          .select('id', { count: 'exact', head: true })
          .eq('host_id', firebaseUser.uid)
          .gte('created_at', todayStart.toISOString());
        if ((count || 0) >= limits.dailyRooms) {
          UpsellService.onDailyRoomLimit(tier);
          showToast({ title: 'Günlük Limit', message: `Bugün en fazla ${limits.dailyRooms} oda açabilirsiniz.`, type: 'warning' });
          return;
        }
      } catch { }
    }

    setCreating(true);
    try {
      // ★ BUG-CR1 FIX: Yerel file:// URI'leri Supabase Storage'a yükle
      let uploadedCardUrl = '';
      let uploadedBgUrl = '';
      if (cardImage && cardImage.startsWith('file://')) {
        uploadedCardUrl = await uploadRoomImage(firebaseUser.uid, cardImage, 'card');
      }
      if (backgroundImage && backgroundImage.startsWith('file://')) {
        uploadedBgUrl = await uploadRoomImage(firebaseUser.uid, backgroundImage, 'bg');
      }

      const room = await RoomService.create(
        firebaseUser.uid,
        {
          name: name.trim(), category, type,
          description: description.trim() || undefined,
          mode,
          speaking_mode: speakingMode,
          room_password: type === 'closed' ? password.trim() : undefined,
          entry_fee_sp: entryFee > 0 ? entryFee : undefined,
          donations_enabled: donationsEnabled || undefined,
          followers_only: followersOnly || undefined,
          theme_id: selectedTheme || undefined,
          room_image_url: uploadedBgUrl || undefined,
          card_image_url: uploadedCardUrl || undefined,
        },
        tier
      );
      showToast({ title: 'Oda Oluşturuldu!', message: `"${name.trim()}" odası hazır.`, type: 'success' });
      try { await GamificationService.onRoomCreate(firebaseUser!.uid); } catch { }
      // Rozet sistemi kaldırıldı — eski badge modülü silindi
      setCreatedRoomId(room.id);
      setCreatedRoomName(name.trim());
      setShowInviteModal(true);
    } catch (err: any) {
      showToast({ title: 'Hata', message: err.message || 'Oda oluşturulamadı.', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleInviteFriends = async (selectedUsers: FollowUser[]) => {
    if (!createdRoomId || !firebaseUser || !profile) return;
    const hostName = profile.display_name || 'Birisi';
    let successCount = 0;
    for (const user of selectedUsers) {
      try {
        // ★ INVITE-FIX: DB bildirim + room_invites kaydı yaz (zile düşsün)
        const result = await RoomAccessService.inviteUser(createdRoomId, user.id, firebaseUser.uid);
        if (result.success) successCount++;
        // Push bildirim de gönder (arka plandaki kullanıcılar için)
        PushService.sendRoomInvite(user.id, hostName, createdRoomName, createdRoomId).catch(() => { });
      } catch {}
    }
    showToast({ title: 'Davetler Gönderildi!', message: `${successCount} arkadaşına davet gönderildi.`, type: 'success' });
  };

  return (
    <AppBackground>
      <View style={s.container}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 6 }]}>
          <Pressable onPress={() => safeGoBack(router)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#F1F5F9" />
          </Pressable>
          <Text style={s.headerTitle}>Yeni Oda</Text>
          <View style={[s.tierChip, isAdmin && { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
            <Text style={[s.tierChipText, isAdmin && { color: '#EF4444' }]}>{isAdmin ? '⚡ GodMaster' : tier}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 30 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ═══ ODA ADI + ÖNİZLEME ═══ */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="text" size={16} color={Colors.teal} />
              <Text style={s.cardLabel}>Oda Adı</Text>
              <Text style={s.charCount}>{name.length}/50</Text>
            </View>
            <TextInput
              style={s.input}
              placeholder="Odana bir isim ver..."
              placeholderTextColor="#475569"
              value={name}
              onChangeText={setName}
              maxLength={50}
            />

            {/* ── Oda Kartı Görseli Yükleme ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' }}>
              <Pressable
                style={[s.cardImgPickerBtn, cardImage ? { borderColor: '#14B8A6' } : {}]}
                onPress={async () => {
                  try {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: 'images',
                      allowsEditing: true,
                      aspect: [16, 9],
                      quality: 0.8,
                    });
                    if (!result.canceled && result.assets?.[0]) {
                      const asset = result.assets[0];
                      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
                        showToast({ title: 'Dosya Çok Büyük', message: 'Kart görseli en fazla 5MB olabilir.', type: 'warning' });
                        return;
                      }
                      setCardImage(asset.uri);
                    }
                  } catch {
                    showToast({ title: 'Hata', message: 'Görsel seçilemedi.', type: 'error' });
                  }
                }}
              >
                {cardImage ? (
                  <Image source={{ uri: cardImage }} style={s.cardImgPreview} />
                ) : (
                  <View style={s.cardImgPlaceholder}>
                    <Ionicons name="camera-outline" size={18} color="#64748B" />
                  </View>
                )}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#E2E8F0' }}>Kart Görseli</Text>
                <Text style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>Keşfet sayfasında görünecek kapak resmi</Text>
              </View>
              {cardImage ? (
                <Pressable onPress={() => setCardImage('')} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              ) : null}
            </View>

            {/* ── Oda Kartı Önizleme ── */}
            {name.trim().length >= 2 && (
              <View style={[s.previewWrap, !cardImage && { marginTop: 10 }]}>
                <Text style={{ fontSize: 9, color: '#475569', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Oda kartı önizlemesi</Text>
                <View style={s.previewCard}>
                  {/* Arka plan: kart görseli veya kategori gradient */}
                  {cardImage ? (
                    <>
                      <Image source={{ uri: cardImage }} style={[StyleSheet.absoluteFillObject, { borderRadius: 11 }]} resizeMode="cover" />
                      {/* Koyu overlay — yazılar okunabilir olsun */}
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 11 }]} />
                    </>
                  ) : (
                    <LinearGradient
                      colors={selectedTheme
                        ? [...(ROOM_THEMES.find(t => t.id === selectedTheme)?.colors || ['#0E1420', '#070B14']), '#070B14']
                        : (CATEGORY_THEME_PREVIEW[category] || CATEGORY_THEME_PREVIEW.other).colors
                      }
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  {/* Büyük soluk kategori ikonu */}
                  {!cardImage && (
                    <View style={{ position: 'absolute', top: -6, right: -6 }}>
                      <Ionicons name={(CATEGORIES.find(c => c.id === category)?.icon || 'chatbubbles') as any} size={48} color="rgba(255,255,255,0.06)" />
                    </View>
                  )}
                  {/* Canlı badge */}
                  <View style={s.previewBadge}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' }} />
                    <Text style={{ fontSize: 8, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }}>CANLI</Text>
                  </View>
                  {/* Oda adı + filtre badge'leri */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <Text style={[s.previewTitle, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>{name.trim()}</Text>
                    {type === 'closed' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                        <Ionicons name="lock-closed" size={7} color="#F59E0B" />
                        <Text style={{ fontSize: 7, fontWeight: '700', color: '#F59E0B' }}>Şifreli</Text>
                      </View>
                    )}
                    {type === 'invite' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(139,92,246,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' }}>
                        <Ionicons name="mail" size={7} color="#8B5CF6" />
                        <Text style={{ fontSize: 7, fontWeight: '700', color: '#8B5CF6' }}>Davetli</Text>
                      </View>
                    )}
                    {entryFee > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }}>
                        <Text style={{ fontSize: 7, fontWeight: '700', color: '#D4AF37' }}>{entryFee} SP</Text>
                      </View>
                    )}
                    {followersOnly && (
                      <Ionicons name="people" size={9} color="#A78BFA" />
                    )}
                    {donationsEnabled && (
                      <Ionicons name="heart" size={8} color="#EF4444" />
                    )}
                  </View>
                  {/* Host bilgisi */}
                  <View style={s.previewHostRow}>
                    <StatusAvatar uri={profile?.avatar_url} size={16} tier={profile?.subscription_tier} />
                    <Text style={s.previewHostName} numberOfLines={1}>{profile?.display_name || 'Host'}</Text>
                    <View style={{ width: 1, height: 10, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 }} />
                    <Ionicons name="people" size={10} color="#64748B" />
                    <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '600', marginLeft: 2 }}>0</Text>
                    <Ionicons name={mode === 'video' ? 'videocam' : 'mic'} size={10} color="#64748B" style={{ marginLeft: 6 }} />
                    {/* Konuşma modu badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                      <Ionicons name={speakingMode === 'free_for_all' ? 'people' : speakingMode === 'permission_only' ? 'hand-left' : 'shield-checkmark'} size={7} color="#64748B" />
                      <Text style={{ fontSize: 7, fontWeight: '600', color: '#64748B' }}>{speakingMode === 'free_for_all' ? 'Serbest' : speakingMode === 'permission_only' ? 'İzinli' : 'Seçili'}</Text>
                    </View>
                  </View>
                  {/* Katıl butonu */}
                  <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
                    <LinearGradient colors={['#14B8A6', '#0D9488']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.previewJoinBtn}>
                      <Ionicons name="headset" size={10} color="#FFF" />
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFF' }}>Katıl</Text>
                    </LinearGradient>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ═══ KATEGORİ ═══ */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="grid" size={16} color={Colors.teal} />
              <Text style={s.cardLabel}>Kategori</Text>
            </View>
            <View style={s.chipGrid}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[s.catChip, category === cat.id && { backgroundColor: cat.color, borderColor: cat.color, shadowColor: cat.color, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Ionicons name={cat.icon as any} size={13} color={category === cat.id ? '#FFF' : '#94A3B8'} />
                  <Text style={[s.catChipText, category === cat.id && { color: '#FFF' }]}>{cat.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* ═══ MOD ═══ */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="settings" size={16} color={Colors.teal} />
              <Text style={s.cardLabel}>Oda Modu</Text>
            </View>

            {/* Mod: Sesli / Görüntülü */}
            <View style={s.toggleRow}>
              <Pressable style={[s.toggleBtn, mode === 'audio' && s.toggleBtnActive]} onPress={() => setMode('audio')}>
                <Ionicons name="mic" size={16} color={mode === 'audio' ? '#fff' : '#94A3B8'} />
                <Text style={[s.toggleText, mode === 'audio' && s.toggleTextActive]}>Sesli</Text>
              </Pressable>
              <Pressable style={[s.toggleBtn, mode === 'video' && s.toggleBtnActive]} onPress={() => setMode('video')}>
                <Ionicons name="videocam" size={16} color={mode === 'video' ? '#fff' : '#94A3B8'} />
                <Text style={[s.toggleText, mode === 'video' && s.toggleTextActive]}>Görüntülü</Text>
              </Pressable>
            </View>
          </View>

          {/* ═══ KONUŞMA MODU ═══ */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="hand-left" size={16} color={Colors.teal} />
              <Text style={s.cardLabel}>Konuşma Modu</Text>
            </View>
            <View style={s.toggleRow}>
              {SPEAKING_MODES.map((sm) => {
                const locked = !isTierAtLeast(tier, sm.minTier);
                const active = speakingMode === sm.id;
                return (
                  <Pressable
                    key={sm.id}
                    style={[s.toggleBtn, active && s.toggleBtnActive, locked && { opacity: 0.35 }]}
                    onPress={() => {
                      if (locked) {
                        showToast({ title: `${sm.minTier}+ Gerekli`, type: 'warning' });
                      } else {
                        setSpeakingMode(sm.id as any);
                      }
                    }}
                  >
                    <Ionicons name={sm.icon as any} size={14} color={active ? '#fff' : '#94A3B8'} />
                    <Text style={[s.toggleText, active && s.toggleTextActive]}>{sm.label}</Text>
                    {locked && <Ionicons name="lock-closed" size={9} color="#F59E0B" />}
                  </Pressable>
                );
              })}
            </View>
          </View>


          {/* ═══ AÇIKLAMA (opsiyonel) ═══ */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Ionicons name="document-text" size={16} color={Colors.teal} />
              <Text style={s.cardLabel}>Açıklama</Text>
              <Text style={s.optionalBadge}>opsiyonel</Text>
            </View>
            <TextInput
              style={[s.input, { height: 60, textAlignVertical: 'top' }]}
              placeholder="Odanı kısa tanımla..."
              placeholderTextColor="#475569"
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
            />
          </View>

          {/* ═══ GELİŞMİŞ AYARLAR (Katlanabilir) ═══ */}
          <Pressable style={s.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
            <Ionicons name="options" size={16} color="#94A3B8" />
            <Text style={s.advancedToggleText}>Gelişmiş Ayarlar</Text>
            <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
          </Pressable>

          {showAdvanced && (
            <View style={s.card}>
              {/* ── Giriş Tipi — Free(Açık) / Plus+(Şifreli) / Pro+(Davetli) ── */}
              <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="shield-checkmark" size={16} color="#14B8A6" />
                  <Text style={s.advLabel}>Giriş Tipi</Text>
                </View>
                <View style={s.toggleRow}>
                  {ROOM_TYPES.map((rt) => {
                    const locked = !limits.allowedTypes.includes(rt.id);
                    const active = type === rt.id;
                    return (
                      <Pressable
                        key={rt.id}
                        style={[s.toggleBtn, active && s.toggleBtnActive, locked && { opacity: 0.35 }]}
                        onPress={() => {
                          if (locked) {
                            showToast({ title: `🔒 ${rt.minTier}+ Gerekli`, message: `Bu giriş tipi ${rt.minTier} ve üzeri üyeliklerde kullanılabilir.`, type: 'info' });
                          } else {
                            setType(rt.id);
                          }
                        }}
                      >
                        <Ionicons name={rt.icon as any} size={14} color={active ? '#fff' : locked ? '#475569' : '#94A3B8'} />
                        <Text style={[s.toggleText, active && s.toggleTextActive]}>{rt.label}</Text>
                        {locked && <Ionicons name="lock-closed" size={9} color="#F59E0B" />}
                      </Pressable>
                    );
                  })}
                </View>
                {/* Şifre Input */}
                {type === 'closed' && (
                  <TextInput
                    style={[s.input, { marginTop: 8 }]}
                    placeholder="Oda şifresi (min 4 karakter)..."
                    placeholderTextColor="#475569"
                    value={password}
                    onChangeText={setPassword}
                    maxLength={20}
                    secureTextEntry
                  />
                )}
              </View>

              {/* ── Oda Teması — Plus+ ── */}
              {isTierAtLeast(tier, 'Plus') ? (
                <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Ionicons name="color-palette" size={16} color="#A78BFA" />
                    <Text style={s.advLabel}>Oda Teması</Text>
                    <Text style={s.advDesc}>{selectedTheme ? ROOM_THEMES.find(t => t.id === selectedTheme)?.name || '' : 'Varsayılan'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {/* Varsayılan (temayı kaldır) */}
                    <Pressable style={[s.themeCircle, !selectedTheme && s.themeCircleActive]} onPress={() => setSelectedTheme(null)}>
                      <LinearGradient colors={['#0E1420', '#070B14']} style={s.themeGrad}>
                        <Ionicons name="moon-outline" size={12} color="rgba(255,255,255,0.35)" />
                      </LinearGradient>
                      {!selectedTheme && <View style={s.themeCheck}><Ionicons name="checkmark" size={7} color="#FFF" /></View>}
                    </Pressable>
                    {ROOM_THEMES.map(theme => {
                      const active = selectedTheme === theme.id;
                      return (
                        <Pressable key={theme.id} style={[s.themeCircle, active && s.themeCircleActive]} onPress={() => setSelectedTheme(theme.id)}>
                          <LinearGradient colors={theme.colors} style={s.themeGrad}>
                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#FFF' }}>{theme.name.slice(0, 2)}</Text>
                          </LinearGradient>
                          {active && <View style={s.themeCheck}><Ionicons name="checkmark" size={7} color="#FFF" /></View>}
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Arkaplan Görseli (Image Picker) — Plus+ */}
                  <View style={{ marginTop: 10 }}>
                    <Pressable
                      style={[s.bgPickerBtn, backgroundImage ? { borderColor: '#14B8A6' } : {}]}
                      onPress={async () => {
                        try {
                          const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: 'images',
                            allowsEditing: true,
                            aspect: [16, 9],
                            quality: 0.8,
                          });
                          if (!result.canceled && result.assets?.[0]) {
                            const asset = result.assets[0];
                            // Boyut kontrolü (max 5MB)
                            if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
                              showToast({ title: 'Dosya Çok Büyük', message: 'Arkaplan görseli en fazla 5MB olabilir.', type: 'warning' });
                              return;
                            }
                            // Çözünürlük kontrolü (min 720px genişlik)
                            if (asset.width && asset.width < 720) {
                              showToast({ title: 'Düşük Çözünürlük', message: 'Arkaplan görseli en az 720px genişlikte olmalıdır.', type: 'warning' });
                              return;
                            }
                            setBackgroundImage(asset.uri);
                          }
                        } catch {
                          showToast({ title: 'Hata', message: 'Görsel seçilemedi.', type: 'error' });
                        }
                      }}
                    >
                      {backgroundImage ? (
                        <Image source={{ uri: backgroundImage }} style={s.bgPreview} />
                      ) : (
                        <View style={s.bgPickerPlaceholder}>
                          <Ionicons name="image-outline" size={20} color="#64748B" />
                          <Text style={{ color: '#64748B', fontSize: 10, marginTop: 4 }}>Arkaplan Seç</Text>
                        </View>
                      )}
                    </Pressable>
                    {backgroundImage && (
                      <Pressable onPress={() => setBackgroundImage('')} style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 2 }}>
                        <Ionicons name="close" size={12} color="#FFF" />
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : (
                <Pressable style={[s.advRow, { opacity: 0.4 }]} onPress={() => showToast({ title: '🔒 Plus+ ile açılır', message: 'Oda teması Plus ve üzeri üyeliklerde kullanılabilir.', type: 'info' })}>
                  <Ionicons name="color-palette-outline" size={16} color="#475569" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.advLabel, { color: '#475569' }]}>Oda Teması & Arkaplan</Text>
                    <Text style={s.advDesc}>Özel renk teması ve arkaplan görseli</Text>
                  </View>
                  <View style={s.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={s.lockText}>Plus</Text></View>
                </Pressable>
              )}

              {/* ── Giriş Ücreti — Pro ── */}
              {isTierAtLeast(tier, 'Pro') ? (
                <View style={s.advRow}>
                  <Ionicons name="cash" size={16} color="#D4AF37" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.advLabel}>{entryFee > 0 ? `Giriş Ücreti: ${entryFee} SP` : 'Giriş Ücretsiz'}</Text>
                    <Text style={s.advDesc}>Odaya giriş için SP ücreti</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[0, 25, 50, 100, 250, 500].map(fee => (
                      <Pressable key={fee} style={[s.feePill, entryFee === fee && s.feePillActive]} onPress={() => setEntryFee(fee)}>
                        <Text style={[s.feePillText, entryFee === fee && s.feePillTextActive]}>{fee === 0 ? 'Free' : `${fee}`}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <Pressable style={[s.advRow, { opacity: 0.4 }]} onPress={() => showToast({ title: '🔒 Pro ile açılır', message: 'Giriş ücreti belirlemek için Pro üyelik gerekli.', type: 'info' })}>
                  <Ionicons name="cash-outline" size={16} color="#475569" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.advLabel, { color: '#475569' }]}>Ücretli Giriş</Text>
                    <Text style={s.advDesc}>SP giriş ücreti belirle</Text>
                  </View>
                  <View style={s.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={s.lockText}>Pro</Text></View>
                </Pressable>
              )}

              {/* ── Bağış Kabul — Pro+ ── */}
              {isTierAtLeast(tier, 'Pro') ? (
                <Pressable style={s.advRow} onPress={() => setDonationsEnabled(!donationsEnabled)}>
                  <Ionicons name="heart" size={16} color={donationsEnabled ? '#EF4444' : '#64748B'} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.advLabel}>{donationsEnabled ? 'Bağış Açık' : 'Bağış Kapalı'}</Text>
                    <Text style={s.advDesc}>Dinleyicilerden SP bağışı kabul et</Text>
                  </View>
                  <View style={[s.switchTrack, donationsEnabled && s.switchTrackActive]}>
                    <View style={[s.switchKnob, donationsEnabled && s.switchKnobActive]} />
                  </View>
                </Pressable>
              ) : (
                <Pressable style={[s.advRow, { opacity: 0.4 }]} onPress={() => showToast({ title: '🔒 Pro ile açılır', message: 'Bağış özelliği Pro ve üzeri üyeliklerde kullanılabilir.', type: 'info' })}>
                  <Ionicons name="heart-outline" size={16} color="#475569" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.advLabel, { color: '#475569' }]}>Bağış Kabul</Text>
                    <Text style={s.advDesc}>SP bağışı al</Text>
                  </View>
                  <View style={s.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={s.lockText}>Pro</Text></View>
                </Pressable>
              )}

              {/* ── Arkadaşlara Özel — Pro+ ── */}
              {isTierAtLeast(tier, 'Pro') ? (
                <Pressable style={s.advRow} onPress={() => setFollowersOnly(!followersOnly)}>
                  <Ionicons name="people" size={16} color={followersOnly ? '#D4AF37' : '#64748B'} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.advLabel}>{followersOnly ? 'Arkadaşlara Özel' : 'Herkese Açık'}</Text>
                    <Text style={s.advDesc}>{followersOnly ? 'Sadece arkadaşların katılabilir' : 'Herkes odaya katılabilir'}</Text>
                  </View>
                  <View style={[s.switchTrack, followersOnly && s.switchTrackActive]}>
                    <View style={[s.switchKnob, followersOnly && s.switchKnobActive]} />
                  </View>
                </Pressable>
              ) : (
                <Pressable style={[s.advRow, { opacity: 0.4 }]} onPress={() => showToast({ title: '🔒 Pro ile açılır', message: 'Arkadaşlara özel mod Pro ve üzeri üyeliklerde kullanılabilir.', type: 'info' })}>
                  <Ionicons name="people-outline" size={16} color="#475569" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.advLabel, { color: '#475569' }]}>Arkadaşlara Özel</Text>
                    <Text style={s.advDesc}>Sadece arkadaşlar girebilir</Text>
                  </View>
                  <View style={s.lockBadge}><Ionicons name="lock-closed" size={9} color="#F59E0B" /><Text style={s.lockText}>Pro</Text></View>
                </Pressable>
              )}

              {/* ── Oda içi ayar ipucu ── */}
              <View style={s.advHint}>
                <Ionicons name="information-circle-outline" size={14} color="#475569" />
                <Text style={s.advHintText}>Boost, sahne düzeni, oda kaydı ve diğer ayarları oda içindeki ⚙️ Ayarlar panelinden yapılandırabilirsin.</Text>
              </View>
            </View>
          )}

          {/* ═══ KAPASİTE BİLGİSİ ═══ */}
          <View style={s.capacityBar}>
            <CapItem icon="mic" label="Sahne" value={limits.maxSpeakers} />
            <View style={s.capDivider} />
            <CapItem icon="people" label="Dinleyici" value={limits.maxListeners} />
            <View style={s.capDivider} />
            <CapItem icon="videocam" label="Kamera" value={limits.maxCameras} />
            <View style={s.capDivider} />
            <CapItem icon="time" label="Süre" value={limits.durationHours === 0 ? '∞' : `${limits.durationHours}sa`} />
          </View>
          {/* ★ Günlük oda kullanım göstergesi */}
          {limits.dailyRooms < 999 && (
            <View style={[s.capacityBar, { marginTop: 0, paddingVertical: 8, borderTopWidth: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={13} color={todayRoomCount >= limits.dailyRooms ? '#EF4444' : todayRoomCount >= limits.dailyRooms - 1 ? '#FBBF24' : '#14B8A6'} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: todayRoomCount >= limits.dailyRooms ? '#EF4444' : '#E2E8F0' }}>
                  Bugün: {todayRoomCount}/{limits.dailyRooms} oda
                </Text>
                {todayRoomCount >= limits.dailyRooms && (
                  <Pressable onPress={() => router.push('/plus' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(167,139,250,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)' }}>
                    <Ionicons name="rocket" size={10} color="#A78BFA" />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#A78BFA' }}>Yükselt</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* ═══ OLUŞTUR BUTONU ═══ */}
          <Pressable
            style={[s.createBtn, !canCreate && { opacity: 0.4 }]}
            onPress={handleCreate}
            disabled={!canCreate || creating}
          >
            <LinearGradient
              colors={['#14B8A6', '#0D9488', '#065F56']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.createBtnGrad}
            >
              {creating ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#FFF" />
                  <Text style={s.createBtnText}>Odayı Oluştur</Text>
                  <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.6)" />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>

      {showInviteModal && firebaseUser && (
        <InviteFriendsModal
          visible={showInviteModal}
          userId={firebaseUser.uid}
          onClose={() => {
            setShowInviteModal(false);
            if (createdRoomId) router.replace(`/room/${createdRoomId}`);
          }}
          onInvite={async (selectedUsers: FollowUser[]) => {
            // ★ FIX: Davetleri bekle, sonra navigasyon yap
            await handleInviteFriends(selectedUsers);
            setShowInviteModal(false);
            if (createdRoomId) router.replace(`/room/${createdRoomId}`);
          }}
        />
      )}
    </AppBackground>
  );
}

function CapItem({ icon, label, value }: { icon: string; label: string; value: number | string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Ionicons name={icon as any} size={14} color={Colors.teal} />
      <Text style={{ fontSize: 14, fontWeight: '800', color: '#E2E8F0', marginTop: 2 }}>{value}</Text>
      <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#F1F5F9' },
  tierChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  tierChipText: { fontSize: 10, fontWeight: '800', color: Colors.teal },

  // Card — her bölüm bir kartta (parlak→koyu gradient + alt gölge)
  card: {
    borderRadius: 14, marginBottom: 12, overflow: 'hidden' as any,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    // Alt gölge (aşağı doğru)
    shadowColor: 'rgba(20,184,166,0.15)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    // İç parlaklık efekti
    backgroundColor: 'rgba(18,30,48,0.95)',
    borderTopColor: 'rgba(20,184,166,0.15)',
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  cardLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 },
  charCount: { fontSize: 10, color: '#475569', fontWeight: '600' },
  optionalBadge: { fontSize: 9, color: '#475569', fontWeight: '600', fontStyle: 'italic' },

  // Input
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#F1F5F9', fontWeight: '500',
  },

  // Card image picker
  cardImgPickerBtn: {
    width: 56, height: 36, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed' as any,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardImgPreview: { width: '100%', height: '100%', borderRadius: 7 } as any,
  cardImgPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  } as any,

  // Kategori chip
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  catChipText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },

  // Toggle row
  toggleRow: { flexDirection: 'row', gap: 6 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  toggleBtnActive: {
    backgroundColor: Colors.teal, borderColor: Colors.teal,
    shadowColor: Colors.teal, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6,
  },
  toggleText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  toggleTextActive: { color: '#fff' },

  // Room card preview
  previewWrap: {
    marginTop: 12, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  previewCard: {
    borderRadius: 12, padding: 10, overflow: 'hidden' as any,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  previewBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(239,68,68,0.85)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    alignSelf: 'flex-start', marginBottom: 5,
  },
  previewTitle: { fontSize: 13, fontWeight: '800', color: '#F1F5F9', marginBottom: 5 },
  previewHostRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  previewHostName: { fontSize: 9, fontWeight: '600', color: '#14B8A6', maxWidth: 80 },
  previewJoinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },

  // Advanced toggle
  advancedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 14, marginBottom: 12,
    backgroundColor: 'rgba(18,30,48,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderTopColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  advancedToggleText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#94A3B8' },

  // Advanced row
  advRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  advLabel: { fontSize: 12, fontWeight: '600', color: '#E2E8F0' },
  advDesc: { fontSize: 9, color: '#64748B', marginTop: 1 },
  unlockBadge: {
    width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(20,184,166,0.12)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)',
  },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
  },
  lockText: { fontSize: 8, fontWeight: '700', color: '#F59E0B' },

  // Fee pills
  feePill: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  feePillActive: { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: 'rgba(212,175,55,0.3)', shadowColor: '#D4AF37', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  feePillText: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  feePillTextActive: { color: '#D4AF37' },

  // Switch toggle
  switchTrack: {
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  switchTrackActive: { backgroundColor: 'rgba(20,184,166,0.35)' },
  switchKnob: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#475569',
  },
  switchKnobActive: { backgroundColor: '#14B8A6', alignSelf: 'flex-end' as const },

  // Theme circles
  themeCircle: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  themeCircleActive: { borderColor: '#14B8A6', borderWidth: 2 },
  themeGrad: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' } as any,
  themeCheck: {
    position: 'absolute' as const, bottom: -1, right: -1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#14B8A6', alignItems: 'center' as any, justifyContent: 'center' as any,
  },

  // Background image picker
  bgPickerBtn: {
    width: 80, height: 48, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  bgPreview: { width: '100%', height: '100%', borderRadius: 7 } as any,
  bgPickerPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  } as any,

  // Advanced hint
  advHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
  },
  advHintText: { flex: 1, fontSize: 10, color: '#475569', lineHeight: 14 },

  // Capacity
  capacityBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 12, marginBottom: 14,
    backgroundColor: 'rgba(20,184,166,0.04)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)',
  },
  capDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Create button
  createBtn: {
    borderRadius: 14, overflow: 'hidden', marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  createBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 15,
  },
  createBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});
