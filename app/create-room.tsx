import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { RoomService, getRoomLimits, type TierName } from '../services/database';
import { GamificationService } from '../services/gamification';
import { Colors } from '../constants/theme';
import { showToast } from '../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './_layout';
import AppBackground from '../components/AppBackground';
import { UpsellService } from '../services/upsell';
import { supabase } from '../constants/supabase';

const { width: W } = Dimensions.get('window');

const POPULAR_TAGS = [
  { id: 'sohbet', label: '#sohbet', icon: '💬' },
  { id: 'müzik', label: '#müzik', icon: '🎵' },
  { id: 'spor', label: '#spor', icon: '⚽' },
  { id: 'siyaset', label: '#siyaset', icon: '🏛️' },
  { id: 'aşk', label: '#aşk', icon: '❤️' },
  { id: 'eğlence', label: '#eğlence', icon: '🎉' },
  { id: 'oyun', label: '#oyun', icon: '🎮' },
  { id: 'film', label: '#film', icon: '🎬' },
  { id: 'kitap', label: '#kitap', icon: '📖' },
  { id: 'teknoloji', label: '#teknoloji', icon: '💻' },
];

const LANGUAGES = [
  { id: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'ar', label: 'العربية', flag: '🇸🇦' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
];

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
  { id: 'closed', label: 'Şifreli', icon: 'lock-closed-outline', desc: 'Şifre ile giriş', minTier: 'Bronze' },
  { id: 'invite', label: 'Davetli', icon: 'mail-outline', desc: 'Sadece davetliler', minTier: 'Gold' },
] as const;

const MODES = [
  { id: 'audio', label: 'Sesli Sohbet', icon: 'mic', desc: 'Yalnızca ses' },
  { id: 'video', label: 'Görüntülü', icon: 'videocam', desc: 'Ses + Kamera' },
];

export default function CreateRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser, profile } = useAuth();
  const tier = (profile?.subscription_tier || 'Free') as TierName;
  const limits = useMemo(() => getRoomLimits(tier), [tier]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('chat');
  const [type, setType] = useState('open');
  const [mode, setMode] = useState('audio');
  const [description, setDescription] = useState('');
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [rules, setRules] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState('tr');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = name.trim().length >= 2 && (type !== 'closed' || password.trim().length >= 4);

  const handleCreate = async () => {
    if (!canCreate || !firebaseUser || creating) return;

    // Tier kontrolü
    if (!limits.allowedTypes.includes(type)) {
      showToast({ title: 'Yetersiz Üyelik', message: 'Bu oda tipini açmak için üyeliğinizi yükseltin.', type: 'warning' });
      return;
    }

    // Günlük oda limiti kontrolü
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
          showToast({ title: 'Günlük Limit', message: `Bugün en fazla ${limits.dailyRooms} oda açabilirsiniz. Üyelik yükseltmesi ile limiti artırın.`, type: 'warning' });
          return;
        }
      } catch {} // Limit kontrolü başarısız olursa geç
    }

    setCreating(true);
    try {
      const room = await RoomService.create(
        firebaseUser.uid,
        {
          name: name.trim(), category, type,
          description: description.trim() || undefined,
          mode, tags, language,
          welcome_message: welcomeMsg.trim() || undefined,
          rules: rules.trim() || undefined,
          room_password: type === 'closed' ? password.trim() : undefined,
        },
        tier
      );
      showToast({ title: 'Oda Oluşturuldu!', message: `"${name.trim()}" odası hazır.`, type: 'success' });
      // ★ SP kazanımı: Oda oluşturma
      try { await GamificationService.onRoomCreate(firebaseUser!.uid); } catch {}
      router.replace(`/room/${room.id}`);
    } catch (err: any) {
      showToast({ title: 'Hata', message: err.message || 'Oda oluşturulamadı.', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppBackground>
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F1F5F9" />
        </Pressable>
        <Text style={s.headerTitle}>Yeni Oda Oluştur</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Oda Adı */}
        <View style={s.section}>
          <Text style={s.label}>Oda Adı</Text>
          <TextInput
            style={s.input}
            placeholder="Odana bir isim ver..."
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Text style={s.charCount}>{name.length}/50</Text>
        </View>

        {/* Kategori */}
        <View style={s.section}>
          <Text style={s.label}>Kategori</Text>
          <View style={s.chipGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[s.chip, category === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                onPress={() => setCategory(cat.id)}
              >
                <Ionicons name={cat.icon as any} size={16} color={category === cat.id ? '#FFF' : '#94A3B8'} />
                <Text style={[s.chipText, category === cat.id && { color: '#FFF' }]}>{cat.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Mod */}
        <View style={s.section}>
          <Text style={s.label}>Mod</Text>
          <View style={s.modeRow}>
            {MODES.map((m) => (
              <Pressable
                key={m.id}
                style={[s.modeCard, mode === m.id && s.modeCardActive]}
                onPress={() => setMode(m.id)}
              >
                <Ionicons name={m.icon as any} size={28} color={mode === m.id ? Colors.accentTeal : '#64748B'} />
                <Text style={[s.modeLabel, mode === m.id && { color: '#F1F5F9' }]}>{m.label}</Text>
                <Text style={s.modeDesc}>{m.desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Oda Tipi */}
        <View style={s.section}>
          <Text style={s.label}>Oda Tipi</Text>
          {ROOM_TYPES.map((rt) => {
            const locked = !limits.allowedTypes.includes(rt.id);
            return (
              <Pressable
                key={rt.id}
                style={[s.typeCard, type === rt.id && s.typeCardActive, locked && { opacity: 0.4 }]}
                onPress={() => { if (!locked) setType(rt.id); }}
                disabled={locked}
              >
                <View style={s.typeLeft}>
                  <Ionicons name={rt.icon as any} size={22} color={type === rt.id ? Colors.accentTeal : '#94A3B8'} />
                  <View>
                    <Text style={[s.typeLabel, type === rt.id && { color: '#F1F5F9' }]}>{rt.label}</Text>
                    <Text style={s.typeDesc}>{rt.desc}</Text>
                  </View>
                </View>
                {locked && (
                  <View style={s.lockBadge}>
                    <Ionicons name="lock-closed" size={12} color="#F59E0B" />
                    <Text style={s.lockText}>{rt.minTier}+</Text>
                  </View>
                )}
                {type === rt.id && !locked && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.accentTeal} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Şifreli oda — şifre input'u */}
        {type === 'closed' && (
          <View style={s.section}>
            <Text style={s.label}>Oda Şifresi</Text>
            <Text style={s.labelHint}>En az 4 karakter. Katılımcılar bu şifreyi girerek odaya girer.</Text>
            <TextInput
              style={s.input}
              placeholder="Şifre belirleyin..."
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={setPassword}
              maxLength={20}
              secureTextEntry
            />
            {password.length > 0 && password.length < 4 && (
              <Text style={{ color: '#EF4444', fontSize: 10, marginTop: 4 }}>En az 4 karakter gerekli</Text>
            )}
          </View>
        )}

        {/* Açıklama */}
        <View style={s.section}>
          <Text style={s.label}>Açıklama (İsteğe bağlı)</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Odanı tanımla..."
            placeholderTextColor="#64748B"
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            multiline
          />
        </View>

        {/* Giriş Mesajı */}
        <View style={s.section}>
          <Text style={s.label}>Giriş Mesajı (İsteğe bağlı)</Text>
          <Text style={s.labelHint}>Odaya giren herkes bu mesajı görür</Text>
          <TextInput
            style={[s.input, { height: 70, textAlignVertical: 'top' }]}
            placeholder="Hoş geldiniz! Kurallarımıza saygı gösterin 🙏"
            placeholderTextColor="#64748B"
            value={welcomeMsg}
            onChangeText={setWelcomeMsg}
            maxLength={200}
            multiline
          />
        </View>

        {/* Oda Kuralları */}
        <View style={s.section}>
          <Text style={s.label}>Oda Kuralları (İsteğe bağlı)</Text>
          <Text style={s.labelHint}>Menüden görülebilir — saygılı ortam için</Text>
          <TextInput
            style={[s.input, { height: 70, textAlignVertical: 'top' }]}
            placeholder="1. Hakaret yok
2. Herkes konuşabilir
3. Eğlenin!"
            placeholderTextColor="#64748B"
            value={rules}
            onChangeText={setRules}
            maxLength={300}
            multiline
          />
        </View>

        {/* Etiketler */}
        <View style={s.section}>
          <Text style={s.label}>Etiketler (max 5)</Text>
          <View style={s.chipGrid}>
            {POPULAR_TAGS.map((tag) => {
              const isSelected = tags.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  style={[s.tagChip, isSelected && s.tagChipActive]}
                  onPress={() => {
                    if (isSelected) {
                      setTags(tags.filter(t => t !== tag.id));
                    } else if (tags.length < 5) {
                      setTags([...tags, tag.id]);
                    }
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{tag.icon}</Text>
                  <Text style={[s.tagChipText, isSelected && { color: '#FFF' }]}>{tag.label}</Text>
                  {isSelected && <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.7)" />}
                </Pressable>
              );
            })}
          </View>
          {tags.length > 0 && (
            <Text style={s.tagCount}>{tags.length}/5 etiket seçildi</Text>
          )}
        </View>

        {/* Dil Seçimi */}
        <View style={s.section}>
          <Text style={s.label}>Oda Dili</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.id}
                style={[s.langChip, language === lang.id && s.langChipActive]}
                onPress={() => setLanguage(lang.id)}
              >
                <Text style={{ fontSize: 18 }}>{lang.flag}</Text>
                <Text style={[s.langChipText, language === lang.id && { color: '#FFF' }]}>{lang.label}</Text>
                {language === lang.id && <Ionicons name="checkmark-circle" size={16} color={Colors.accentTeal} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Oda Kişiselleştirme — Silver+ */}
        <View style={s.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text style={s.label}>Kişiselleştirme</Text>
            {!limits.canCustomizeTheme && (
              <View style={s.lockBadge}>
                <Ionicons name="lock-closed" size={10} color="#F59E0B" />
                <Text style={s.lockText}>Silver+</Text>
              </View>
            )}
          </View>

          {/* Tema Rengi */}
          <View style={[{ opacity: limits.canCustomizeTheme ? 1 : 0.35 }]}>
            <Text style={[s.labelHint, { marginBottom: 8 }]}>Oda İç Tema Rengi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {[
                { id: 'default', color: '#14B8A6', label: 'Teal' },
                { id: 'purple', color: '#8B5CF6', label: 'Mor' },
                { id: 'pink', color: '#EC4899', label: 'Pembe' },
                { id: 'blue', color: '#3B82F6', label: 'Mavi' },
                { id: 'gold', color: '#F59E0B', label: 'Altın' },
                { id: 'red', color: '#EF4444', label: 'Kırmızı' },
              ].map(theme => (
                <Pressable
                  key={theme.id}
                  disabled={!limits.canCustomizeTheme}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: theme.color,
                    borderWidth: 2.5,
                    borderColor: 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {!limits.canCustomizeTheme && (
                    <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.7)" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Oda Resmi */}
          {limits.canCustomizeImage ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[s.labelHint, { marginBottom: 8 }]}>Oda Kapak Resmi (Gold+)</Text>
              <Pressable style={{
                height: 80, borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
                borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Ionicons name="image-outline" size={24} color="#64748B" />
                <Text style={{ color: '#64748B', fontSize: 11 }}>Resim yükle (yakında)</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="image-outline" size={14} color="#64748B" />
              <Text style={{ color: '#64748B', fontSize: 11 }}>Oda kapak resmi Gold+ ile açılır</Text>
            </View>
          )}
        </View>

        {/* Tier Bilgisi */}
        <View style={s.tierInfo}>
          <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
          <Text style={s.tierText}>
            {tier} üyeliğin ile: {limits.maxSpeakers} sahne, {limits.maxListeners} dinleyici, {limits.durationHours > 0 ? `${limits.durationHours} saat` : 'sınırsız süre'}, {limits.dailyRooms < 999 ? `günlük ${limits.dailyRooms} oda` : 'sınırsız oda'}
          </Text>
        </View>

        {/* Oluştur Butonu — Premium Gradient */}
        <Pressable
          style={[s.createBtn, !canCreate && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={!canCreate || creating}
        >
          <LinearGradient
            colors={['#14B8A6', '#0D9488', '#065F56']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.createBtnGradient}
          >
            {creating ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <View style={s.createBtnIconWrap}>
                  <Ionicons name="add-circle" size={22} color="#FFF" />
                </View>
                <Text style={s.createBtnText}>Odayı Oluştur</Text>
                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
    </AppBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: '#F1F5F9',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  section: { paddingHorizontal: 16, marginBottom: 20 },
  label: {
    fontSize: 13, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5,
    marginBottom: 8, textTransform: 'uppercase',
  },
  labelHint: {
    fontSize: 11, color: '#64748B', marginBottom: 8, marginTop: -4,
  },
  input: {
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#F1F5F9', fontWeight: '500',
  },
  charCount: {
    fontSize: 10, color: '#64748B', textAlign: 'right', marginTop: 4,
  },

  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },

  modeRow: { flexDirection: 'row', gap: 12 },
  modeCard: {
    flex: 1, alignItems: 'center', padding: 16, borderRadius: 16,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, gap: 6,
  },
  modeCardActive: { borderColor: Colors.accentTeal, backgroundColor: 'rgba(115,194,189,0.08)' },
  modeLabel: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  modeDesc: { fontSize: 10, color: '#64748B' },

  typeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 14, marginBottom: 8,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  typeCardActive: { borderColor: Colors.accentTeal, backgroundColor: 'rgba(115,194,189,0.08)' },
  typeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeLabel: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
  typeDesc: { fontSize: 11, color: '#64748B', marginTop: 1 },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  lockText: { fontSize: 10, fontWeight: '700', color: '#F59E0B' },

  tierInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tierText: { fontSize: 11, color: '#94A3B8', flex: 1 },

  createBtn: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  createBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    paddingVertical: 18, paddingHorizontal: 18,
  },
  createBtnIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  createBtnText: {
    flex: 1,
    fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // ═══ Etiket Chip'leri ═══
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tagChipActive: {
    backgroundColor: 'rgba(20,184,166,0.2)', borderColor: Colors.accentTeal,
  },
  tagChipText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  tagCount: { fontSize: 10, color: Colors.accentTeal, marginTop: 6, textAlign: 'right' },

  // ═══ Dil Seçimi ═══
  langChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  langChipActive: {
    backgroundColor: 'rgba(20,184,166,0.12)', borderColor: Colors.accentTeal,
  },
  langChipText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
});
