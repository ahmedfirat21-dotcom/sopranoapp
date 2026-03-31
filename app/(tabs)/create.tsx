import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius, Spacing } from '../../constants/theme';
import { RoomService, getRoomLimits, type TierName } from '../../services/database';
import { supabase } from '../../constants/supabase';
import { useAuth } from '../_layout';
import { showToast } from '../../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeService } from '../../services/engagement';

const CATEGORIES = [
  { id: 'chat', icon: 'mic', label: 'Sohbet', color: Colors.teal },
  { id: 'music', icon: 'musical-notes', label: 'Müzik', color: Colors.sapphire },
  { id: 'game', icon: 'game-controller', label: 'Oyun', color: Colors.emerald },
  { id: 'book', icon: 'book', label: 'Kitap', color: Colors.ice },
  { id: 'film', icon: 'film', label: 'Film & Dizi', color: Colors.gold },
  { id: 'tech', icon: 'code-slash', label: 'Teknoloji', color: Colors.steel },
];

const ROOM_TYPES = [
  { id: 'open', label: 'Açık', icon: 'globe-outline', desc: 'Herkes katılabilir' },
  { id: 'closed', label: 'Kapalı', icon: 'lock-closed-outline', desc: 'Onay gerekli' },
  { id: 'invite', label: 'Davetli', icon: 'mail-outline', desc: 'Sadece davetliler' },
];

export default function CreateScreen() {
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('chat');
  const [selectedType, setSelectedType] = useState('open');
  const [creating, setCreating] = useState(false);

  // ★ Tier bazlı limitler
  const userTier: TierName = (profile?.tier as TierName) || 'Silver';
  const limits = useMemo(() => getRoomLimits(userTier), [userTier]);

  const handleCreate = async () => {
    if (!roomName.trim()) {
      showToast({ title: 'Hata', message: 'Lütfen oda adı girin.', type: 'error' });
      return;
    }

    if (!firebaseUser) {
      showToast({ title: 'Hata', message: 'Oda oluşturmak için giriş yapmalısınız.', type: 'error' });
      return;
    }

    // ★ Oda türü kısıtlaması
    if (!(limits.allowedTypes as readonly string[]).includes(selectedType)) {
      const tierUpgrade = userTier === 'Silver' ? 'Plus' : 'VIP';
      showToast({
        title: 'Oda Türü Kısıtlı',
        message: `${selectedType === 'closed' ? 'Kapalı' : 'Davetli'} oda oluşturmak için ${tierUpgrade}'a yükseltin.`,
        type: 'warning'
      });
      return;
    }

    // ★ Günlük oda limiti (tier bazlı)
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', firebaseUser.uid)
        .gte('created_at', todayStart.toISOString());
      
      if ((count ?? 0) >= limits.dailyRooms) {
        const tierLabel = userTier === 'Silver' ? 'Ücretsiz' : userTier;
        showToast({
          title: 'Günlük Limit',
          message: `${tierLabel} kullanıcılar günde en fazla ${limits.dailyRooms} oda oluşturabilir.`,
          type: 'warning'
        });
        return;
      }
    } catch (e) {
      console.warn('Room limit check error:', e);
    }

    setCreating(true);
    try {
      const room = await RoomService.create(firebaseUser.uid, {
        name: roomName.trim(),
        category: selectedCategory,
        type: selectedType,
        description: description.trim(),
      }, userTier);

      setRoomName('');
      setDescription('');
      // Rozet kontrolü
      BadgeService.checkAndUnlock(firebaseUser.uid, 'room_created').catch(() => {});
      router.push(`/room/${room.id}`);
    } catch (error) {
      console.error('Oda oluşturma hatası:', error);
      showToast({ title: 'Hata', message: 'Oda oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Oda Oluştur</Text>
        <Text style={styles.headerSub}>Kendi dijital mekanını kur</Text>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 6) + 58 + 80 }}>
        {/* Room Name */}
        <Text style={styles.label}>Oda Adı</Text>
        <TextInput
          style={styles.input}
          placeholder="Örn: Gece Sohbeti ☕"
          placeholderTextColor={Colors.text3}
          value={roomName}
          onChangeText={setRoomName}
          maxLength={50}
        />

        {/* Description */}
        <Text style={styles.label}>Açıklama (Opsiyonel)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Odanız hakkında kısa bir açıklama..."
          placeholderTextColor={Colors.text3}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        {/* Category */}
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              style={({ pressed }) => [
                styles.catCard,
                selectedCategory === cat.id && { borderColor: cat.color, borderWidth: 1.5, backgroundColor: `${cat.color}10` },
                pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <View style={[styles.catIcon, { backgroundColor: `${cat.color}18` }, selectedCategory === cat.id && { backgroundColor: `${cat.color}25`, shadowColor: cat.color, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 }]}>
                <Ionicons name={cat.icon as any} size={22} color={cat.color} />
              </View>
              <Text style={[styles.catLabel, selectedCategory === cat.id && { color: cat.color, fontWeight: '700' }]}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Room Type */}
        <Text style={styles.label}>Oda Türü</Text>
        {ROOM_TYPES.map((type) => {
          const isLocked = !(limits.allowedTypes as readonly string[]).includes(type.id);
          const requiredTier = type.id === 'invite' ? 'VIP' : type.id === 'closed' ? 'Plus' : null;
          return (
            <Pressable
              key={type.id}
              style={({ pressed }) => [
                styles.typeCard,
                selectedType === type.id && !isLocked && styles.typeCardActive,
                isLocked && { opacity: 0.45 },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => !isLocked && setSelectedType(type.id)}
            >
              <View style={[styles.typeIconWrap, selectedType === type.id && !isLocked && { backgroundColor: `${Colors.teal}18` }]}>
                <Ionicons
                  name={(isLocked ? 'lock-closed' : type.icon) as any}
                  size={20}
                  color={isLocked ? Colors.text3 : selectedType === type.id ? Colors.teal : Colors.text3}
                />
              </View>
              <View style={styles.typeInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.typeLabel, selectedType === type.id && !isLocked && { color: Colors.teal }]}>{type.label}</Text>
                  {isLocked && requiredTier && (
                    <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#F59E0B', fontSize: 9, fontWeight: '700' }}>{requiredTier}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.typeDesc}>{type.desc}</Text>
              </View>
              {selectedType === type.id && !isLocked && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.teal} />
              )}
            </Pressable>
          );
        })}

        {/* ★ Tier bilgi kartı */}
        <View style={{ marginHorizontal: 20, marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: 'rgba(92,225,230,0.05)', borderWidth: 0.5, borderColor: 'rgba(92,225,230,0.15)' }}>
          <Text style={{ color: Colors.teal, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>📋 Oda Limitlerin ({userTier})</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>{limits.maxSpeakers}</Text>
              <Text style={{ color: Colors.text3, fontSize: 10 }}>Sahne</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>{limits.maxListeners}</Text>
              <Text style={{ color: Colors.text3, fontSize: 10 }}>Dinleyici</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>{limits.durationHours > 0 ? `${limits.durationHours} sa` : '∞'}</Text>
              <Text style={{ color: Colors.text3, fontSize: 10 }}>Süre</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800' }}>{limits.dailyRooms >= 999 ? '∞' : limits.dailyRooms}</Text>
              <Text style={{ color: Colors.text3, fontSize: 10 }}>Günlük</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ★ SABİT ALT BUTON — her zaman tab bar üstünde */}
      <View style={[styles.fixedBottom, { bottom: Math.max(insets.bottom, 6) + 58 + 10 }]}>
        <Pressable style={({ pressed }) => [styles.createBtnWrap, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]} onPress={handleCreate} disabled={creating}>
          <LinearGradient
            colors={Gradients.teal as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.createBtn, creating && { opacity: 0.6 }]}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.createBtnText}>Oda Oluştur</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 13, color: Colors.text2, marginTop: 4 },
  body: { flex: 1 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    marginHorizontal: 20,
    height: 48,
    borderRadius: Radius.default,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 16,
    fontSize: 14,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  catCard: {
    width: '30%',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.default,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  catLabel: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: Radius.default,
    backgroundColor: Colors.bg3,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    gap: 12,
  },
  typeCardActive: { borderColor: Colors.teal, backgroundColor: `${Colors.teal}06` },
  typeIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  typeInfo: { flex: 1 },
  typeLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  typeDesc: { fontSize: 11, color: Colors.text3, marginTop: 2 },
  createBtnWrap: { marginHorizontal: 20 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.default,
  },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  fixedBottom: {
    position: 'absolute',
    // bottom değeri dinamik olarak hesaplanıyor (insets.bottom + tab bar height + gap)
    left: 0,
    right: 0,
    paddingVertical: 8,
    backgroundColor: Colors.bg,
  },
});
