import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../constants/firebase';
import { supabase } from '../../constants/supabase';

const FALLBACK = 'https://ui-avatars.com/api/?background=676A89&color=fff&name=S';

type Profile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  tier?: string | null;
  subscription_tier?: string | null;
  coins?: number | null;
  diamonds?: number | null;
  system_points?: number | null;
  level?: number | null;
  xp?: number | null;
  user_xp?: number | null;
  is_plus?: boolean | null;
  is_admin?: boolean | null;
  is_verified?: boolean | null;
  mood_status?: string | null;
  streak_days?: number | null;
  total_referrals?: number | null;
  created_at?: string | null;
};

function MenuRow({ icon, title, subtitle, onPress, danger }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { opacity: .78 }]}>
      <LinearGradient colors={danger ? ['#F7E2E5', '#D8B5BC'] : ['#F9F9FC', '#D8DAE7']} style={styles.menuIcon}>
        <Ionicons name={icon} size={19} color={danger ? '#8C3344' : '#57596E'} />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, danger && { color: '#873344' }]}>{title}</Text>
        {!!subtitle && <Text style={styles.menuSub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={17} color="#8B8D9E" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const uid = auth.currentUser?.uid || '';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const result = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,bio,tier,subscription_tier,coins,diamonds,system_points,level,xp,user_xp,is_plus,is_admin,is_verified,mood_status,streak_days,total_referrals,created_at')
        .eq('id', uid)
        .maybeSingle();
      setProfile((result.data || null) as Profile | null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const doLogout = async () => {
    try { await signOut(auth); } catch {}
  };

  const displayName = profile?.display_name || profile?.username || auth.currentUser?.email?.split('@')[0] || 'Soprano';
  const tier = profile?.subscription_tier || profile?.tier || (profile?.is_plus ? 'Plus' : 'Standart');
  const level = Number(profile?.level || 1);
  const xp = Number(profile?.user_xp ?? profile?.xp ?? 0);
  const xpTarget = Math.max(100, level * 100);
  const xpRatio = Math.max(0, Math.min(1, xp / xpTarget));

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator color="#FFF" size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={['#70717A', '#383940', '#17181C']} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Profil</Text>
          <Text style={styles.headerSub}>SOPRANO KİMLİĞİN · HESABIN</Text>
        </View>
        <Pressable onPress={() => router.push('/edit-profile')} style={styles.headerButton}>
          <Ionicons name="create-outline" size={20} color="#F0F1FA" />
        </Pressable>
        <Pressable onPress={() => router.push('/notifications')} style={styles.headerButton}>
          <Ionicons name="notifications-outline" size={20} color="#F0F1FA" />
        </Pressable>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#FFF" onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <LinearGradient colors={['rgba(248,249,255,.98)', 'rgba(214,216,232,.98)']} style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarFrame}>
              <Image source={{ uri: profile?.avatar_url || FALLBACK }} style={styles.avatar} />
              {profile?.is_verified && (
                <View style={styles.verifyBadge}><Ionicons name="checkmark" size={11} color="#FFF" /></View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>{displayName}</Text>
                {profile?.is_plus && <View style={styles.plusBadge}><Text style={styles.plusText}>PLUS</Text></View>}
              </View>
              <Text style={styles.handle}>@{profile?.username || 'soprano'}</Text>
              <Text numberOfLines={2} style={styles.bio}>{profile?.bio || 'Sesini duyur. Yeni insanlarla tanış. Bir frekansa uğra.'}</Text>
            </View>
          </View>

          <View style={styles.moodRow}>
            <Ionicons name="sparkles-outline" size={14} color="#65677B" />
            <Text style={styles.mood}>{profile?.mood_status || 'Bugün sesim yerinde.'}</Text>
          </View>

          <View style={styles.levelBox}>
            <View style={styles.levelTop}>
              <Text style={styles.levelLabel}>SEVİYE {level}</Text>
              <Text style={styles.levelMeta}>{xp} / {xpTarget} XP</Text>
            </View>
            <View style={styles.track}><View style={[styles.progress, { width: `${xpRatio * 100}%` }]} /></View>
          </View>
        </LinearGradient>

        <View style={styles.walletRow}>
          <View style={styles.walletCard}>
            <Ionicons name="sparkles" size={20} color="#F3D375" />
            <Text style={styles.walletValue}>{profile?.system_points || profile?.coins || 0}</Text>
            <Text style={styles.walletLabel}>SP</Text>
          </View>
          <View style={styles.walletCard}>
            <Ionicons name="diamond" size={20} color="#A9E8FF" />
            <Text style={styles.walletValue}>{profile?.diamonds || 0}</Text>
            <Text style={styles.walletLabel}>Elmas</Text>
          </View>
          <View style={styles.walletCard}>
            <Ionicons name="flame" size={20} color="#FFC07C" />
            <Text style={styles.walletValue}>{profile?.streak_days || 0}</Text>
            <Text style={styles.walletLabel}>Seri</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hızlı erişim</Text>
          <Text style={styles.sectionMeta}>{String(tier).toUpperCase()}</Text>
        </View>

        <View style={styles.quickGrid}>
          <Pressable onPress={() => router.push('/plus')} style={styles.quickCard}>
            <LinearGradient colors={['#F8F5E9', '#D5C9A4']} style={styles.quickIcon}><Ionicons name="star" size={21} color="#7A6840" /></LinearGradient>
            <Text style={styles.quickTitle}>Soprano Plus</Text>
            <Text style={styles.quickSub}>Üyelik ve ayrıcalıklar</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/leaderboard')} style={styles.quickCard}>
            <LinearGradient colors={['#F2F3FA', '#C6C9DE']} style={styles.quickIcon}><Ionicons name="trophy" size={21} color="#60637B" /></LinearGradient>
            <Text style={styles.quickTitle}>Sıralama</Text>
            <Text style={styles.quickSub}>Topluluk tablosu</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/create-room')} style={styles.quickCard}>
            <LinearGradient colors={['#F2F3FA', '#C6C9DE']} style={styles.quickIcon}><Ionicons name="radio" size={21} color="#60637B" /></LinearGradient>
            <Text style={styles.quickTitle}>Oda Aç</Text>
            <Text style={styles.quickSub}>Yeni frekans başlat</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/edit-profile')} style={styles.quickCard}>
            <LinearGradient colors={['#F2F3FA', '#C6C9DE']} style={styles.quickIcon}><Ionicons name="color-palette" size={21} color="#60637B" /></LinearGradient>
            <Text style={styles.quickTitle}>Görünüm</Text>
            <Text style={styles.quickSub}>Profilini düzenle</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          <Text style={styles.sectionMeta}>AYARLAR</Text>
        </View>

        <View style={styles.menuCard}>
          <MenuRow icon="person-circle-outline" title="Profili Düzenle" subtitle="Fotoğraf, bio ve kişisel bilgiler" onPress={() => router.push('/edit-profile')} />
          <View style={styles.separator} />
          <MenuRow icon="notifications-outline" title="Bildirimler" subtitle="Mesaj ve oda bildirimleri" onPress={() => router.push('/notifications')} />
          {profile?.is_admin && (
            <>
              <View style={styles.separator} />
              <MenuRow icon="shield-checkmark-outline" title="Yönetim" subtitle="SopranoChat yönetim paneli" onPress={() => router.push('/admin')} />
            </>
          )}
          <View style={styles.separator} />
          <MenuRow icon="log-out-outline" title="Çıkış Yap" subtitle="Bu cihazdaki oturumu kapat" onPress={doLogout} danger />
        </View>

        <View style={styles.accountMeta}>
          <Text style={styles.accountMetaText}>SopranoChat Mobile · Retro Concept</Text>
          {!!profile?.created_at && <Text style={styles.accountMetaText}>Üyelik: {new Date(profile.created_at).toLocaleDateString('tr-TR')}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#727493' },
  safe: { flex: 1, backgroundColor: '#727493' },
  header: { minHeight: 82, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.45)' },
  headerTitle: { color: '#F7F8FF', fontSize: 22, fontWeight: '900' },
  headerSub: { color: '#C6C8D7', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  headerButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,.22)' },
  content: { padding: 14, paddingBottom: 110 },
  profileCard: { borderRadius: 23, padding: 15, borderWidth: 1, borderColor: '#FFF', shadowColor: '#292A38', shadowOpacity: .25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  profileTop: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  avatarFrame: { width: 79, height: 79, borderRadius: 40, padding: 4, backgroundColor: '#A3A6BC', position: 'relative' },
  avatar: { width: 71, height: 71, borderRadius: 36, backgroundColor: '#D9DBE7' },
  verifyBadge: { position: 'absolute', right: 1, bottom: 7, width: 20, height: 20, borderRadius: 10, backgroundColor: '#4A82BD', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F3F4F9' },
  nameRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  name: { color: '#47495E', fontSize: 19, fontWeight: '900', maxWidth: 175 },
  plusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: '#8B7744' },
  plusText: { color: '#FFF8D9', fontSize: 6.5, fontWeight: '900', letterSpacing: .8 },
  handle: { color: '#858799', fontSize: 9.5, fontWeight: '700', marginTop: 1 },
  bio: { color: '#747688', fontSize: 10.5, lineHeight: 15, marginTop: 6 },
  moodRow: { marginTop: 13, minHeight: 38, borderRadius: 11, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#ECECF3', borderWidth: 1, borderColor: '#D3D5E0' },
  mood: { color: '#646679', fontSize: 9.5, fontWeight: '700' },
  levelBox: { marginTop: 12 },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelLabel: { color: '#5E6075', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  levelMeta: { color: '#8A8C9D', fontSize: 8, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, marginTop: 6, backgroundColor: '#C8CAD6', overflow: 'hidden' },
  progress: { height: '100%', borderRadius: 4, backgroundColor: '#777A98' },
  walletRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  walletCard: { flex: 1, height: 78, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(56,58,74,.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,.23)' },
  walletValue: { color: '#FFF', fontSize: 16, fontWeight: '900', marginTop: 2 },
  walletLabel: { color: '#D6D8E4', fontSize: 8.5, fontWeight: '700' },
  sectionHeader: { marginTop: 18, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#F4F5FC', fontSize: 14, fontWeight: '900' },
  sectionMeta: { color: '#D3D5E1', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCard: { width: '48.8%', minHeight: 126, borderRadius: 17, padding: 11, backgroundColor: 'rgba(244,245,251,.96)', borderWidth: 1, borderColor: '#FFF' },
  quickIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C0C2D0' },
  quickTitle: { color: '#505267', fontSize: 11, fontWeight: '900', marginTop: 9 },
  quickSub: { color: '#9294A5', fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  menuCard: { borderRadius: 17, overflow: 'hidden', backgroundColor: 'rgba(244,245,251,.97)', borderWidth: 1, borderColor: '#FFF' },
  menuRow: { minHeight: 68, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C5C7D4' },
  menuTitle: { color: '#505267', fontSize: 11, fontWeight: '900' },
  menuSub: { color: '#9294A5', fontSize: 8.5, marginTop: 2 },
  separator: { height: 1, backgroundColor: '#DBDCE5', marginLeft: 63 },
  accountMeta: { alignItems: 'center', gap: 3, paddingVertical: 18 },
  accountMetaText: { color: '#D5D7E3', fontSize: 8.5, fontWeight: '700' },
});
