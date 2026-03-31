/**
 * SopranoChat — GodMaster Admin Paneli
 * Platform sahibi için sınırsız yetki ile yönetim ekranı
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../constants/theme';
import { supabase } from '../constants/supabase';
import { ModerationService } from '../services/moderation';
import { RoomService } from '../services/database';
import { getAvatarSource } from '../constants/avatars';
import { showToast } from '../components/Toast';
import SopranoCoin from '../components/SopranoCoin';
import { useAuth } from './_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ReportItem = {
  id: string;
  reporter_id: string;
  reported_user_id?: string;
  reported_room_id?: string;
  reason: string;
  description?: string;
  status: string;
  created_at: string;
  reporter_name?: string;
  reported_name?: string;
};

type AdminStats = {
  totalUsers: number;
  onlineUsers: number;
  liveRooms: number;
  pendingReports: number;
  totalPosts: number;
};

const REASON_TR: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Taciz',
  hate_speech: 'Nefret Söylemi',
  inappropriate_content: 'Uygunsuz İçerik',
  impersonation: 'Kimliğe Bürünme',
  self_harm: 'Kendine Zarar',
  violence: 'Şiddet',
  underage: 'Reşit Olmayan',
  other: 'Diğer',
};

export default function AdminPanel() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'rooms' | 'users'>('overview');
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, onlineUsers: 0, liveRooms: 0, pendingReports: 0, totalPosts: 0 });
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin kontrolü
  if (!profile?.is_admin) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="shield-outline" size={64} color="#EF4444" />
        <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '700', marginTop: 16 }}>Erişim Reddedildi</Text>
        <Text style={{ color: Colors.text3, fontSize: 13, marginTop: 8 }}>Bu sayfaya erişim yetkiniz yok.</Text>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={{ color: Colors.teal, fontWeight: '600' }}>Geri Dön</Text>
        </Pressable>
      </View>
    );
  }

  const loadAll = useCallback(async () => {
    try {
      // İstatistikler
      const [usersRes, onlineRes, roomsRes, postsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('is_live', true),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
      ]);

      const pendingCount = await ModerationService.getPendingCount();

      setStats({
        totalUsers: usersRes.count ?? 0,
        onlineUsers: onlineRes.count ?? 0,
        liveRooms: roomsRes.count ?? 0,
        pendingReports: pendingCount,
        totalPosts: postsRes.count ?? 0,
      });

      // Bekleyen şikayetler
      const { data: reps } = await supabase
        .from('reports')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      // Reporter ve reported isimlerini çek
      const enrichedReports: ReportItem[] = [];
      for (const r of (reps || [])) {
        let reporterName = 'Bilinmiyor';
        let reportedName = 'Bilinmiyor';

        if (r.reporter_id) {
          const { data: rp } = await supabase.from('profiles').select('display_name').eq('id', r.reporter_id).single();
          if (rp) reporterName = rp.display_name;
        }
        if (r.reported_user_id) {
          const { data: ru } = await supabase.from('profiles').select('display_name').eq('id', r.reported_user_id).single();
          if (ru) reportedName = ru.display_name;
        }

        enrichedReports.push({ ...r, reporter_name: reporterName, reported_name: reportedName });
      }
      setReports(enrichedReports);

      // Canlı odalar
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*, host:profiles!host_id(display_name, avatar_url)')
        .eq('is_live', true)
        .order('created_at', { ascending: false });
      setLiveRooms(rooms || []);

      // Son kullanıcılar
      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      setRecentUsers(users || []);

    } catch (e) {
      console.error('Admin veri yükleme hatası:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, []);

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  // ========== AKSIYON HANDLER'LARI ==========
  const handleDismissReport = (reportId: string) => {
    Alert.alert('Şikayeti Kapat', 'Bu şikayeti "geçersiz" olarak kapatmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Kapat', onPress: async () => {
        await ModerationService.resolveReport(reportId, 'dismissed');
        showToast({ title: 'Şikayet Kapatıldı', type: 'success' });
        loadAll();
      }},
    ]);
  };

  const handleWarnUser = (reportId: string, userId: string) => {
    Alert.alert('Kullanıcıyı Uyar', 'Bu kullanıcıya uyarı vermek istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Uyar', onPress: async () => {
        await ModerationService.resolveReport(reportId, 'warned');
        // Inbox'a uyarı mesajı gönder
        await supabase.from('inbox').insert({
          user_id: userId,
          type: 'system',
          title: 'Uyarı',
          body: 'Davranışlarınız nedeniyle bir uyarı aldınız. Kuralları tekrar ihlal etmeniz durumunda hesabınız askıya alınabilir.',
        });
        showToast({ title: 'Kullanıcı Uyarıldı', type: 'success' });
        loadAll();
      }},
    ]);
  };

  const handleBanUser = (reportId: string, userId: string, displayName: string) => {
    Alert.alert('Kullanıcıyı Banla', `${displayName} adlı kullanıcıyı BANLAMAK istiyor musun?\n\nBu işlem geri alınabilir.`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Banla', style: 'destructive', onPress: async () => {
        await ModerationService.resolveReport(reportId, 'banned');
        // Kullanıcıyı devre dışı bırak
        await supabase.from('profiles').update({ is_banned: true }).eq('id', userId);
        showToast({ title: 'Kullanıcı Banlandı', message: displayName, type: 'success' });
        loadAll();
      }},
    ]);
  };

  const handleCloseRoom = (roomId: string, roomName: string) => {
    Alert.alert('Odayı Kapat', `"${roomName}" odasını kapatmak istiyor musun?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Kapat', style: 'destructive', onPress: async () => {
        await RoomService.close(roomId);
        showToast({ title: 'Oda Kapatıldı', message: roomName, type: 'success' });
        loadAll();
      }},
    ]);
  };

  const handleToggleBan = (userId: string, displayName: string, currentBanned: boolean) => {
    const action = currentBanned ? 'Banı Kaldır' : 'Banla';
    Alert.alert(action, `${displayName} - ${action}?`, [
      { text: 'İptal', style: 'cancel' },
      { text: action, style: currentBanned ? 'default' : 'destructive', onPress: async () => {
        await supabase.from('profiles').update({ is_banned: !currentBanned }).eq('id', userId);
        showToast({ title: currentBanned ? 'Ban Kaldırıldı' : 'Banlandı', message: displayName, type: 'success' });
        loadAll();
      }},
    ]);
  };

  const handleToggleAdmin = (userId: string, displayName: string, currentAdmin: boolean) => {
    const action = currentAdmin ? 'Adminliği Kaldır' : 'Admin Yap';
    Alert.alert(action, `${displayName} - ${action}?`, [
      { text: 'İptal', style: 'cancel' },
      { text: action, onPress: async () => {
        await supabase.from('profiles').update({ is_admin: !currentAdmin }).eq('id', userId);
        showToast({ title: currentAdmin ? 'Adminlik Kaldırıldı' : 'Admin Yapıldı', message: displayName, type: 'success' });
        loadAll();
      }},
    ]);
  };

  const handleGiveCoins = (userId: string, displayName: string) => {
    Alert.alert('Coin Ver', `${displayName} adlı kullanıcıya kaç coin vermek istiyorsun?`, [
      { text: 'İptal', style: 'cancel' },
      { text: '100 Coin', onPress: () => giveCoins(userId, displayName, 100) },
      { text: '500 Coin', onPress: () => giveCoins(userId, displayName, 500) },
      { text: '1000 Coin', onPress: () => giveCoins(userId, displayName, 1000) },
    ]);
  };

  const giveCoins = async (userId: string, displayName: string, amount: number) => {
    const { data: user } = await supabase.from('profiles').select('coins').eq('id', userId).single();
    if (user) {
      await supabase.from('profiles').update({ coins: (user.coins || 0) + amount }).eq('id', userId);
      showToast({ title: `${amount} Coin Verildi`, message: displayName, type: 'success' });
    }
  };

  // ========== UI ==========
  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.teal} />
        <Text style={{ color: Colors.text2, marginTop: 12 }}>GodMaster yükleniyor...</Text>
      </View>
    );
  }

  const TABS = [
    { id: 'overview', icon: 'grid', label: 'Genel' },
    { id: 'reports', icon: 'flag', label: `Şikayetler (${stats.pendingReports})` },
    { id: 'rooms', icon: 'mic', label: 'Odalar' },
    { id: 'users', icon: 'people', label: 'Kullanıcılar' },
  ] as const;

  return (
    <View style={s.container}>
      {/* HEADER */}
      <LinearGradient
        colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.02)', 'transparent']}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.headerBackBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>GodMaster Panel</Text>
            <Text style={s.headerSub}>Platform Yönetimi</Text>
          </View>
          <Pressable onPress={onRefresh} style={s.headerRefresh}>
            <Ionicons name="refresh" size={18} color={Colors.text2} />
          </Pressable>
        </View>

        {/* TAB BAR */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          {TABS.map(tab => (
            <Pressable
              key={tab.id}
              style={[s.tab, activeTab === tab.id && s.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon as any} size={14} color={activeTab === tab.id ? '#fff' : Colors.text3} />
              <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />}
      >
        {/* ===== GENEL TAB ===== */}
        {activeTab === 'overview' && (
          <>
            <View style={s.statsGrid}>
              <StatCard icon="people" color="#3B82F6" label="Toplam Üye" value={stats.totalUsers} />
              <StatCard icon="pulse" color="#10B981" label="Çevrimiçi" value={stats.onlineUsers} />
              <StatCard icon="mic" color="#F59E0B" label="Canlı Oda" value={stats.liveRooms} />
              <StatCard icon="flag" color="#EF4444" label="Şikayet" value={stats.pendingReports} />
              <StatCard icon="newspaper" color="#8B5CF6" label="Gönderi" value={stats.totalPosts} />
              <StatCard icon="shield-checkmark" color={Colors.teal} label="Admin" value={1} />
            </View>

            {/* Hızlı Aksiyonlar */}
            <Text style={s.sectionTitle}>Hızlı Aksiyonlar</Text>
            <View style={{ gap: 8 }}>
              <QuickAction icon="trash" color="#EF4444" label="Süresi Dolan Odaları Temizle" onPress={async () => {
                const count = await RoomService.autoCloseExpired();
                showToast({ title: `${count} oda temizlendi`, type: 'success' });
                loadAll();
              }} />
              <QuickAction icon="megaphone" color="#F59E0B" label="Tüm Kullanıcılara Duyuru Gönder" onPress={() => {
                Alert.alert('Duyuru', 'Bu özellik yakında eklenecek. Şimdilik Supabase inbox tablosundan gönderebilirsin.');
              }} />
            </View>
          </>
        )}

        {/* ===== ŞİKAYETLER TAB ===== */}
        {activeTab === 'reports' && (
          <>
            {reports.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
                <Text style={s.emptyText}>Bekleyen şikayet yok</Text>
              </View>
            ) : (
              reports.map(report => (
                <View key={report.id} style={s.reportCard}>
                  <View style={s.reportHeader}>
                    <View style={[s.reasonBadge, { backgroundColor: report.reason === 'spam' ? '#3B82F620' : '#EF444420' }]}>
                      <Text style={[s.reasonText, { color: report.reason === 'spam' ? '#3B82F6' : '#EF4444' }]}>
                        {REASON_TR[report.reason] || report.reason}
                      </Text>
                    </View>
                    <Text style={s.reportDate}>
                      {new Date(report.created_at).toLocaleDateString('tr-TR')}
                    </Text>
                  </View>

                  <Text style={s.reportInfo}>
                    <Text style={{ color: Colors.teal }}>{report.reporter_name}</Text>
                    {' → '}
                    <Text style={{ color: '#EF4444' }}>{report.reported_name}</Text>
                  </Text>

                  {report.description && <Text style={s.reportDesc}>{report.description}</Text>}

                  <View style={s.reportActions}>
                    <Pressable style={[s.reportBtn, { backgroundColor: '#10B98120' }]} onPress={() => handleDismissReport(report.id)}>
                      <Ionicons name="close-circle" size={14} color="#10B981" />
                      <Text style={[s.reportBtnText, { color: '#10B981' }]}>Kapat</Text>
                    </Pressable>
                    {report.reported_user_id && (
                      <>
                        <Pressable style={[s.reportBtn, { backgroundColor: '#F59E0B20' }]} onPress={() => handleWarnUser(report.id, report.reported_user_id!)}>
                          <Ionicons name="warning" size={14} color="#F59E0B" />
                          <Text style={[s.reportBtnText, { color: '#F59E0B' }]}>Uyar</Text>
                        </Pressable>
                        <Pressable style={[s.reportBtn, { backgroundColor: '#EF444420' }]} onPress={() => handleBanUser(report.id, report.reported_user_id!, report.reported_name || '')}>
                          <Ionicons name="ban" size={14} color="#EF4444" />
                          <Text style={[s.reportBtnText, { color: '#EF4444' }]}>Banla</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ===== ODALAR TAB ===== */}
        {activeTab === 'rooms' && (
          <>
            {liveRooms.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="mic-off" size={48} color={Colors.text3} />
                <Text style={s.emptyText}>Aktif oda yok</Text>
              </View>
            ) : (
              liveRooms.map(room => (
                <View key={room.id} style={s.roomCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.roomName}>{room.name}</Text>
                    <Text style={s.roomMeta}>
                      Host: {room.host?.display_name || '?'} · {room.listener_count || 0} izleyici
                      {room.expires_at && <Text style={{ color: '#F59E0B' }}> · Süreli</Text>}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable style={s.roomActionBtn} onPress={() => router.push(`/room/${room.id}`)}>
                      <Ionicons name="eye" size={16} color={Colors.teal} />
                    </Pressable>
                    <Pressable style={[s.roomActionBtn, { backgroundColor: '#EF444415' }]} onPress={() => handleCloseRoom(room.id, room.name)}>
                      <Ionicons name="power" size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ===== KULLANICILAR TAB ===== */}
        {activeTab === 'users' && (
          <>
            {recentUsers.map(user => (
              <View key={user.id} style={s.userCard}>
                <Image source={getAvatarSource(user.avatar_url)} style={s.userAvatar} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={s.userName}>{user.display_name}</Text>
                    {user.is_admin && <Ionicons name="shield-checkmark" size={12} color="#EF4444" />}
                    {user.is_plus && <Ionicons name="star" size={12} color={Colors.teal} />}
                    {user.is_banned && <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}> BANLANDI</Text>}
                  </View>
                  <Text style={s.userMeta}>
                    {user.tier} · {user.coins || 0} SC · {user.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Pressable style={s.userActionBtn} onPress={() => handleGiveCoins(user.id, user.display_name)}>
                    <SopranoCoin size={14} />
                  </Pressable>
                  <Pressable style={s.userActionBtn} onPress={() => handleToggleAdmin(user.id, user.display_name, user.is_admin || false)}>
                    <Ionicons name="shield" size={14} color={user.is_admin ? '#EF4444' : '#64748B'} />
                  </Pressable>
                  <Pressable style={s.userActionBtn} onPress={() => handleToggleBan(user.id, user.display_name, user.is_banned || false)}>
                    <Ionicons name="ban" size={14} color={user.is_banned ? '#EF4444' : '#64748B'} />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ========== ALT BİLEŞENLER ==========
function StatCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: number }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, color, label, onPress }: { icon: string; color: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={s.quickAction} onPress={onPress}>
      <View style={[s.quickActionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={s.quickActionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.text3} />
    </Pressable>
  );
}

// ========== STILLER ==========
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A' },
  backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.teal + '15', borderWidth: 1, borderColor: Colors.teal + '30' },

  // Header
  header: { paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  headerBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F1F5F9' },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  headerRefresh: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },

  // Tabs
  tabBar: { marginBottom: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.text3 },
  tabTextActive: { color: '#fff' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: '31%', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#F1F5F9' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: '600' },

  // Quick Actions
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', marginBottom: 12 },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  quickActionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  quickActionText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#E2E8F0' },

  // Reports
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.text3, fontSize: 14, marginTop: 12 },
  reportCard: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.1)', marginBottom: 10 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reasonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  reasonText: { fontSize: 11, fontWeight: '700' },
  reportDate: { fontSize: 10, color: '#64748B' },
  reportInfo: { fontSize: 13, color: '#94A3B8', marginBottom: 6 },
  reportDesc: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginBottom: 10 },
  reportActions: { flexDirection: 'row', gap: 6 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  reportBtnText: { fontSize: 11, fontWeight: '700' },

  // Rooms
  roomCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 8 },
  roomName: { fontSize: 14, fontWeight: '700', color: '#E2E8F0' },
  roomMeta: { fontSize: 11, color: '#64748B', marginTop: 3 },
  roomActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },

  // Users
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 6 },
  userAvatar: { width: 40, height: 40, borderRadius: 20 },
  userName: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  userMeta: { fontSize: 10, color: '#64748B', marginTop: 2 },
  userActionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
});
