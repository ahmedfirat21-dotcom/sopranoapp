/**
 * SopranoChat — GodMaster Admin Paneli
 * Platform sahibi için sınırsız yetki ile yönetim ekranı
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, RefreshControl, TextInput, Dimensions } from 'react-native';
import PremiumAlert, { type AlertButton } from '../components/PremiumAlert';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../constants/navigation';
import { Colors } from '../constants/theme';
import { supabase } from '../constants/supabase';
import { ModerationService } from '../services/moderation';
import { RoomService, getRoomLimits } from '../services/database';
import { getAvatarSource } from '../constants/avatars';
import { showToast } from '../components/Toast';

import { useAuth } from './_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackground from '../components/AppBackground';

const { width: W } = Dimensions.get('window');

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
  totalRooms: number;
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

const TIER_COLORS: Record<string, string> = {
  Free: '#64748B',
  Bronze: '#CD7F32',
  Silver: '#94A3B8',
  Gold: '#D4AF37',
  VIP: '#8B5CF6',
};

const CATEGORY_TR: Record<string, string> = {
  chat: 'Sohbet',
  music: 'Müzik',
  education: 'Eğitim',
  gaming: 'Oyun',
  debate: 'Tartışma',
  podcast: 'Podcast',
  social: 'Sosyal',
  other: 'Diğer',
};



export default function AdminPanel() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'rooms' | 'users'>('overview');
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, onlineUsers: 0, liveRooms: 0, totalRooms: 0, pendingReports: 0, totalPosts: 0 });
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [liveRooms, setLiveRooms] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adAlert, setAdAlert] = useState<{ visible: boolean; title: string; message: string; type?: any; buttons?: AlertButton[] }>({ visible: false, title: '', message: '' });
  const showAdAlert = (title: string, message: string, buttons: AlertButton[], type: any = 'warning') => setAdAlert({ visible: true, title, message, type, buttons });

  // Oda Yönetimi State
  const [roomFilter, setRoomFilter] = useState<'live' | 'all' | 'sleeping'>('live');
  const [roomSearch, setRoomSearch] = useState('');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  // Admin kontrolü
  if (!profile?.is_admin) {
    return (
      <AppBackground>
        <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="shield-outline" size={64} color="#EF4444" />
          <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '700', marginTop: 16 }}>Erişim Reddedildi</Text>
          <Text style={{ color: Colors.text3, fontSize: 13, marginTop: 8 }}>Bu sayfaya erişim yetkiniz yok.</Text>
          <Pressable style={s.backBtn} onPress={() => safeGoBack(router)}>
            <Text style={{ color: Colors.teal, fontWeight: '600' }}>Geri Dön</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const loadAll = useCallback(async () => {
    try {
      const [usersRes, onlineRes, liveRoomsRes, allRoomsRes, postsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('is_live', true),
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
      ]);

      const pendingCount = await ModerationService.getPendingCount();

      setStats({
        totalUsers: usersRes.count ?? 0,
        onlineUsers: onlineRes.count ?? 0,
        liveRooms: liveRoomsRes.count ?? 0,
        totalRooms: allRoomsRes.count ?? 0,
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

      // Tüm odalar
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*, host:profiles!host_id(display_name, avatar_url, subscription_tier)')
        .order('created_at', { ascending: false });

      const allRoomsData = rooms || [];
      setAllRooms(allRoomsData);
      setLiveRooms(allRoomsData.filter((r: any) => r.is_live));

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

  // ========== AKSIYON HANDLER ==========
  const handleDismissReport = (reportId: string) => {
    showAdAlert('Şikayeti Kapat', 'Bu şikayeti "geçersiz" olarak kapatmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kapat', onPress: async () => {
          await ModerationService.resolveReport(reportId, 'dismissed');
          showToast({ title: 'Şikayet Kapatıldı', type: 'success' });
          loadAll();
        }
      },
    ]);
  };

  const handleWarnUser = (reportId: string, userId: string) => {
    showAdAlert('Kullanıcıyı Uyar', 'Bu kullanıcıya uyarı vermek istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Uyar', onPress: async () => {
          await ModerationService.resolveReport(reportId, 'warned');
          await supabase.from('inbox').insert({
            user_id: userId, type: 'system', title: 'Uyarı',
            body: 'Davranışlarınız nedeniyle bir uyarı aldınız. Kuralları tekrar ihlal etmeniz durumunda hesabınız askıya alınabilir.',
          });
          showToast({ title: 'Kullanıcı Uyarıldı', type: 'success' });
          loadAll();
        }
      },
    ]);
  };

  const handleBanUser = (reportId: string, userId: string, displayName: string) => {
    showAdAlert('Kullanıcıyı Banla', `${displayName} adlı kullanıcıyı BANLAMAK istiyor musun?\n\nBu işlem geri alınabilir.`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Banla', style: 'destructive', onPress: async () => {
          await ModerationService.resolveReport(reportId, 'banned');
          await supabase.from('profiles').update({ is_banned: true }).eq('id', userId);
          showToast({ title: 'Kullanıcı Banlandı', message: displayName, type: 'success' });
          loadAll();
        }
      },
    ], 'error');
  };

  const handleCloseRoom = (roomId: string, roomName: string) => {
    showAdAlert('Odayı Kapat', `"${roomName}" odasını kapatmak istiyor musun?\n\nTüm kullanıcılar çıkarılacak.`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kapat', style: 'destructive', onPress: async () => {
          await RoomService.close(roomId);
          showToast({ title: 'Oda Kapatıldı', message: roomName, type: 'success' });
          loadAll();
        }
      },
    ]);
  };

  const handleDeleteRoom = (roomId: string, roomName: string) => {
    showAdAlert('Odayı Kalıcı Sil', `"${roomName}" odasını KALICI olarak silmek istiyor musun?\n\nBu işlem geri alınamaz!`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Kalıcı Sil', style: 'destructive', onPress: async () => {
          try {
            await supabase.from('room_participants').delete().eq('room_id', roomId);
            await supabase.from('rooms').delete().eq('id', roomId);
            showToast({ title: 'Oda Silindi', message: roomName, type: 'success' });
            loadAll();
          } catch {
            showToast({ title: 'Hata', message: 'Oda silinemedi', type: 'error' });
          }
        }
      },
    ], 'error');
  };

  const handleWakeRoom = (roomId: string, roomName: string, hostId: string, tier: string) => {
    showAdAlert('Odayı Uyandır', `"${roomName}" odasını yeniden canlıya almak istiyor musun?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Uyandır', onPress: async () => {
          try {
            await RoomService.wakeUpRoom(roomId, hostId, tier as any);
            showToast({ title: 'Oda Uyandırıldı', message: roomName, type: 'success' });
            loadAll();
          } catch {
            showToast({ title: 'Hata', message: 'Oda uyandırılamadı', type: 'error' });
          }
        }
      },
    ], 'info');
  };



  const handleChangeTier = (roomId: string, roomName: string, currentTier: string) => {
    const tiers = ['Free', 'Bronze', 'Silver', 'Gold', 'VIP'];
    const buttons: AlertButton[] = tiers
      .filter(t => t !== currentTier)
      .map(t => ({
        text: t,
        onPress: async () => {
          try {
            await supabase.from('rooms').update({ owner_tier: t }).eq('id', roomId);
            const limits = getRoomLimits(t as any);
            await supabase.from('rooms').update({
              max_speakers: limits.maxSpeakers,
              max_listeners: limits.maxListeners,
              max_cameras: limits.maxCameras,
            }).eq('id', roomId);
            showToast({ title: `Tier: ${t}`, message: roomName, type: 'success' });
            loadAll();
          } catch {
            showToast({ title: 'Hata', type: 'error' });
          }
        },
      }));
    buttons.unshift({ text: 'İptal', style: 'cancel' });
    showAdAlert('Oda Tier Değiştir', `"${roomName}" — Mevcut: ${currentTier}\n\nYeni tier seçin:`, buttons, 'info');
  };

  const handleToggleBan = (userId: string, displayName: string, currentBanned: boolean) => {
    const action = currentBanned ? 'Banı Kaldır' : 'Banla';
    showAdAlert(action, `${displayName} - ${action}?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: action, style: currentBanned ? 'default' : 'destructive', onPress: async () => {
          await supabase.from('profiles').update({ is_banned: !currentBanned }).eq('id', userId);
          showToast({ title: currentBanned ? 'Ban Kaldırıldı' : 'Banlandı', message: displayName, type: 'success' });
          loadAll();
        }
      },
    ]);
  };

  const handleToggleAdmin = (userId: string, displayName: string, currentAdmin: boolean) => {
    const action = currentAdmin ? 'Adminliği Kaldır' : 'Admin Yap';
    showAdAlert(action, `${displayName} - ${action}?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: action, onPress: async () => {
          await supabase.from('profiles').update({ is_admin: !currentAdmin }).eq('id', userId);
          showToast({ title: currentAdmin ? 'Adminlik Kaldırıldı' : 'Admin Yapıldı', message: displayName, type: 'success' });
          loadAll();
        }
      },
    ], 'info');
  };

  const handleGiveSP = (userId: string, displayName: string) => {
    showAdAlert('SP Ver', `${displayName} adlı kullanıcıya kaç SP vermek istiyorsun?`, [
      { text: 'İptal', style: 'cancel' },
      { text: '100 SP', onPress: () => giveSP(userId, displayName, 100) },
      { text: '500 SP', onPress: () => giveSP(userId, displayName, 500) },
      { text: '1000 SP', onPress: () => giveSP(userId, displayName, 1000) },
    ], 'success');
  };

  const giveSP = async (userId: string, displayName: string, amount: number) => {
    const { data: user } = await supabase.from('profiles').select('system_points').eq('id', userId).single();
    if (user) {
      await supabase.from('profiles').update({ system_points: (user.system_points || 0) + amount }).eq('id', userId);
      showToast({ title: `${amount} SP Verildi`, message: displayName, type: 'success' });
    }
  };

  // Filtrelenmiş Odalar
  const filteredRooms = (() => {
    let rooms = roomFilter === 'live'
      ? allRooms.filter(r => r.is_live)
      : roomFilter === 'sleeping'
        ? allRooms.filter(r => !r.is_live)
        : allRooms;

    if (roomSearch.trim()) {
      const q = roomSearch.toLowerCase().trim();
      rooms = rooms.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.host?.display_name?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q)
      );
    }
    return rooms;
  })();

  // ========== UI ==========
  if (loading) {
    return (
      <AppBackground>
        <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.teal} />
          <Text style={{ color: Colors.text2, marginTop: 12 }}>GodMaster yükleniyor...</Text>
        </View>
      </AppBackground>
    );
  }

  const TABS = [
    { id: 'overview', icon: 'grid', label: 'Genel' },
    { id: 'reports', icon: 'flag', label: `Şikayetler (${stats.pendingReports})` },
    { id: 'rooms', icon: 'mic', label: `Odalar (${stats.totalRooms})` },
    { id: 'users', icon: 'people', label: 'Kullanıcılar' },
  ] as const;

  return (
    <AppBackground>
      <View style={s.container}>
        {/* HEADER */}
        <LinearGradient
          colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.02)', 'transparent']}
          style={[s.header, { paddingTop: insets.top + 8 }]}
        >
          <View style={s.headerRow}>
            <Pressable onPress={() => safeGoBack(router)} style={s.headerBackBtn}>
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {TABS.map(tab => (
              <Pressable key={tab.id} style={[s.tab, activeTab === tab.id && s.tabActive]} onPress={() => setActiveTab(tab.id)}>
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
                <StatCard icon="albums" color={Colors.teal} label="Toplam Oda" value={stats.totalRooms} />
              </View>

              <Text style={s.sectionTitle}>Hızlı Aksiyonlar</Text>
              <View style={{ gap: 8 }}>
                <QuickAction icon="add-circle" color={Colors.teal} label="Yeni Oda Oluştur" onPress={() => router.push('/create-room')} />
                <QuickAction icon="trash" color="#EF4444" label="Free Boş Odaları Temizle" onPress={async () => {
                  const count = await RoomService.autoCloseExpired();
                  showToast({ title: `${count} Free oda temizlendi`, type: 'success' });
                  loadAll();
                }} />
                <QuickAction icon="megaphone" color="#F59E0B" label="Tüm Kullanıcılara Duyuru Gönder" onPress={() => {
                  showAdAlert('Duyuru', 'Bu özellik yakında eklenecek.', [{ text: 'Tamam' }], 'info');
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
                      <Text style={s.reportDate}>{new Date(report.created_at).toLocaleDateString('tr-TR')}</Text>
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
              {/* İstatistik Bandı */}
              <View style={s.roomStatsRow}>
                <View style={s.roomStatChip}>
                  <View style={[s.roomStatDot, { backgroundColor: '#10B981' }]} />
                  <Text style={s.roomStatText}>{liveRooms.length} Canlı</Text>
                </View>
                <View style={s.roomStatChip}>
                  <View style={[s.roomStatDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={s.roomStatText}>{allRooms.filter(r => !r.is_live).length} Uyuyan</Text>
                </View>
                <View style={s.roomStatChip}>
                  <View style={[s.roomStatDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={s.roomStatText}>{allRooms.length} Toplam</Text>
                </View>
              </View>

              {/* Filtre + Arama */}
              <View style={s.roomToolbar}>
                <View style={s.roomFilterRow}>
                  {(['live', 'sleeping', 'all'] as const).map(f => (
                    <Pressable key={f} style={[s.filterChip, roomFilter === f && s.filterChipActive]} onPress={() => setRoomFilter(f)}>
                      <Ionicons name={f === 'live' ? 'pulse' : f === 'sleeping' ? 'moon' : 'albums'} size={12} color={roomFilter === f ? '#fff' : '#94A3B8'} />
                      <Text style={[s.filterChipText, roomFilter === f && s.filterChipTextActive]}>
                        {f === 'live' ? 'Canlı' : f === 'sleeping' ? 'Uyuyan' : 'Tümü'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.searchRow}>
                  <Ionicons name="search" size={16} color="#64748B" />
                  <TextInput style={s.searchInput} placeholder="Oda ara (isim, host, kategori)..." placeholderTextColor="#475569" value={roomSearch} onChangeText={setRoomSearch} returnKeyType="search" />
                  {roomSearch.length > 0 && (
                    <Pressable onPress={() => setRoomSearch('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color="#64748B" />
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Oda Oluştur — Normal sayfaya yönlendir */}
              <Pressable style={s.createRoomBtn} onPress={() => router.push('/create-room')}>
                <View style={s.createRoomIconWrap}>
                  <Ionicons name="add" size={18} color="#fff" />
                </View>
                <Text style={s.createRoomBtnText}>Yeni Oda Oluştur</Text>
                <Ionicons name="chevron-forward" size={14} color="#64748B" />
              </Pressable>

              {/* ═══ TÜM ODALAR ═══ */}
              {(() => {
                const userRooms = filteredRooms;
                return (
                  <>
                    <View style={[s.systemSectionHeader, { marginTop: 16 }]}>
                      <View style={[s.systemBadge, { backgroundColor: '#3B82F612' }]}>
                        <Ionicons name="mic" size={13} color="#3B82F6" />
                        <Text style={[s.systemBadgeText, { color: '#3B82F6' }]}>Tüm Odalar</Text>
                      </View>
                      <Text style={s.systemCount}>{userRooms.length} oda</Text>
                    </View>
                    {userRooms.length === 0 ? (
                      <View style={s.emptyState}>
                        <Ionicons name="mic-off" size={48} color={Colors.text3} />
                        <Text style={s.emptyText}>{roomSearch ? 'Aramayla eşleşen oda bulunamadı' : 'Bu kategoride kullanıcı odası yok'}</Text>
                      </View>
                    ) : (
                      userRooms.map(room => {
                        const isExpanded = expandedRoomId === room.id;
                        const ownerTier = room.owner_tier || room.host?.subscription_tier || 'Free';
                        const limits = getRoomLimits(ownerTier as any);
                        const roomAge = Math.floor((Date.now() - new Date(room.created_at).getTime()) / 60000);
                        const ageText = roomAge < 60 ? `${roomAge}dk` : roomAge < 1440 ? `${Math.floor(roomAge / 60)}sa` : `${Math.floor(roomAge / 1440)}gün`;

                        return (
                          <Pressable key={room.id} style={[s.roomCardV2, !room.is_live && s.roomCardSleeping]} onPress={() => setExpandedRoomId(isExpanded ? null : room.id)}>
                            <View style={s.roomCardHeader}>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                  <View style={[s.liveIndicator, { backgroundColor: room.is_live ? '#10B98120' : '#F59E0B20' }]}>
                                    <View style={[s.liveDot, { backgroundColor: room.is_live ? '#10B981' : '#F59E0B' }]} />
                                    <Text style={[s.liveLabel, { color: room.is_live ? '#10B981' : '#F59E0B' }]}>{room.is_live ? 'CANLI' : 'UYUYOR'}</Text>
                                  </View>
                                  <View style={[s.tierBadge, { backgroundColor: (TIER_COLORS[ownerTier] || '#64748B') + '20' }]}>
                                    <Text style={[s.tierBadgeText, { color: TIER_COLORS[ownerTier] || '#64748B' }]}>{ownerTier}</Text>
                                  </View>
                                  <Text style={s.roomCat}>{CATEGORY_TR[room.category] || room.category}</Text>
                                </View>
                                <Text style={s.roomNameV2} numberOfLines={1}>{room.name}</Text>
                                <Text style={s.roomMetaV2}>{room.host?.display_name || '?'} · {room.listener_count || 0} kişi · {ageText}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', gap: 5 }}>
                                <Pressable style={s.roomActionBtnV2} onPress={() => router.push(`/room/${room.id}`)}>
                                  <Ionicons name="eye" size={15} color={Colors.teal} />
                                </Pressable>
                                {room.is_live ? (
                                  <Pressable style={[s.roomActionBtnV2, { backgroundColor: '#EF444412' }]} onPress={() => handleCloseRoom(room.id, room.name)}>
                                    <Ionicons name="power" size={15} color="#EF4444" />
                                  </Pressable>
                                ) : (
                                  <Pressable style={[s.roomActionBtnV2, { backgroundColor: '#10B98112' }]} onPress={() => handleWakeRoom(room.id, room.name, room.host_id, ownerTier)}>
                                    <Ionicons name="sunny" size={15} color="#10B981" />
                                  </Pressable>
                                )}
                                <Pressable style={[s.roomActionBtnV2, { backgroundColor: '#EF444412' }]} onPress={() => handleDeleteRoom(room.id, room.name)}>
                                  <Ionicons name="trash" size={14} color="#EF4444" />
                                </Pressable>
                              </View>
                            </View>

                            {isExpanded && (
                              <View style={s.roomExpanded}>
                                <View style={s.roomExpandedDivider} />
                                <View style={s.roomLimitsGrid}>
                                  <RoomLimitItem icon="mic" label="Sahne" value={`${limits.maxSpeakers}`} />
                                  <RoomLimitItem icon="people" label="Dinleyici" value={`${limits.maxListeners}`} />
                                  <RoomLimitItem icon="eye" label="Seyirci" value={limits.maxSpectators >= 999 ? '∞' : `${limits.maxSpectators}`} />
                                  <RoomLimitItem icon="videocam" label="Kamera" value={`${limits.maxCameras}`} />
                                  <RoomLimitItem icon="shield" label="Mod" value={`${limits.maxModerators}`} />
                                  <RoomLimitItem icon="time" label="Süre" value={limits.durationHours === 0 ? '7/24' : `${limits.durationHours}sa`} />
                                </View>
                                <View style={s.roomDetailRow}>
                                  <Text style={s.roomDetailLabel}>Oda ID</Text>
                                  <Text style={s.roomDetailValue} numberOfLines={1}>{room.id}</Text>
                                </View>
                                <View style={s.roomDetailRow}>
                                  <Text style={s.roomDetailLabel}>Tip</Text>
                                  <Text style={s.roomDetailValue}>{room.type || 'open'}</Text>
                                </View>
                                {room.expires_at && (
                                  <View style={s.roomDetailRow}>
                                    <Text style={s.roomDetailLabel}>Bitiş</Text>
                                    <Text style={[s.roomDetailValue, new Date(room.expires_at) < new Date() && { color: '#EF4444' }]}>
                                      {new Date(room.expires_at).toLocaleString('tr-TR')}
                                    </Text>
                                  </View>
                                )}
                                <View style={s.roomExpandedActions}>
                                  <Pressable style={s.roomExpandedBtn} onPress={() => handleChangeTier(room.id, room.name, ownerTier)}>
                                    <Ionicons name="star" size={14} color="#D4AF37" />
                                    <Text style={s.roomExpandedBtnText}>Tier Değiştir</Text>
                                  </Pressable>
                                  <Pressable style={s.roomExpandedBtn} onPress={() => router.push(`/room/${room.id}`)}>
                                    <Ionicons name="enter" size={14} color={Colors.teal} />
                                    <Text style={s.roomExpandedBtnText}>Odaya Gir</Text>
                                  </Pressable>
                                  <Pressable style={[s.roomExpandedBtn, { backgroundColor: '#EF444412', borderColor: '#EF444425' }]} onPress={() => handleDeleteRoom(room.id, room.name)}>
                                    <Ionicons name="trash" size={14} color="#EF4444" />
                                    <Text style={[s.roomExpandedBtnText, { color: '#EF4444' }]}>Kalıcı Sil</Text>
                                  </Pressable>
                                </View>
                              </View>
                            )}
                          </Pressable>
                        );
                      }))
                    }
                  </>
                );
              })()}
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
                      {(user.subscription_tier || user.tier) && (user.subscription_tier || user.tier) !== 'Free' && (
                        <Text style={{ fontSize: 9, fontWeight: '800', color: Colors.teal }}>{user.subscription_tier || user.tier}</Text>
                      )}
                      {user.is_banned && <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}> BANLANDI</Text>}
                    </View>
                    <Text style={s.userMeta}>{user.subscription_tier || user.tier || 'Free'} · {user.system_points || 0} SP · {user.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <Pressable style={s.userActionBtn} onPress={() => handleGiveSP(user.id, user.display_name)}>
                      <Ionicons name="star" size={14} color={Colors.gold} />
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
        <PremiumAlert visible={adAlert.visible} title={adAlert.title} message={adAlert.message} type={adAlert.type || 'warning'} buttons={adAlert.buttons} onDismiss={() => setAdAlert(p => ({ ...p, visible: false }))} />
      </View>
    </AppBackground>
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

function RoomLimitItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.limitItem}>
      <Ionicons name={icon as any} size={13} color="#94A3B8" />
      <Text style={s.limitLabel}>{label}</Text>
      <Text style={s.limitValue}>{value}</Text>
    </View>
  );
}

// ========== STILLER ==========
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.teal + '15', borderWidth: 1, borderColor: Colors.teal + '30' },
  header: { paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  headerBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F1F5F9' },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  headerRefresh: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  tabBar: { marginBottom: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  tabText: { fontSize: 11, fontWeight: '600', color: Colors.text3 },
  tabTextActive: { color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: '31%', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6 },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#F1F5F9' },
  statLabel: { fontSize: 10, color: '#64748B', marginTop: 4, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#F1F5F9', marginBottom: 12 },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  quickActionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  quickActionText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#E2E8F0' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: Colors.text3, fontSize: 14, marginTop: 12 },
  reportCard: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.85)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reasonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  reasonText: { fontSize: 11, fontWeight: '700' },
  reportDate: { fontSize: 10, color: '#64748B' },
  reportInfo: { fontSize: 13, color: '#94A3B8', marginBottom: 6 },
  reportDesc: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginBottom: 10 },
  reportActions: { flexDirection: 'row', gap: 6 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  reportBtnText: { fontSize: 11, fontWeight: '700' },
  // Rooms V2
  roomStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roomStatChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  roomStatDot: { width: 6, height: 6, borderRadius: 3 },
  roomStatText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  roomToolbar: { gap: 8, marginBottom: 12 },
  roomFilterRow: { flexDirection: 'row', gap: 6 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(15,23,42,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterChipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  filterChipTextActive: { color: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  searchInput: { flex: 1, fontSize: 13, color: '#E2E8F0', padding: 0 },
  createRoomBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, backgroundColor: 'rgba(20,184,166,0.06)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)', marginBottom: 8 },
  createRoomIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center' },
  createRoomBtnText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.teal },
  createForm: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(15,25,40,0.95)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)', marginBottom: 12 },
  createFormHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'center', marginBottom: 14 },
  createFormTitle: { fontSize: 16, fontWeight: '800', color: '#F1F5F9', marginBottom: 4 },
  createFormDesc: { fontSize: 11, color: '#64748B', marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 6, marginTop: 8 },
  formInput: { height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, fontSize: 13, color: '#E2E8F0' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  categoryChipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  categoryChipText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  categoryChipTextActive: { color: '#fff' },
  createSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 13, borderRadius: 12, backgroundColor: Colors.teal },
  createSubmitText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  discoverToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  toggleSwitch: { width: 40, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.1)', padding: 2, justifyContent: 'center' },
  toggleSwitchActive: { backgroundColor: Colors.teal },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#475569' },
  toggleKnobActive: { backgroundColor: '#fff', alignSelf: 'flex-end' },
  roomCardV2: { padding: 14, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 8, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6 },
  roomCardSleeping: { borderColor: 'rgba(245,158,11,0.18)', opacity: 0.88 },
  roomCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },
  liveLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  tierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tierBadgeText: { fontSize: 8, fontWeight: '800' },
  roomCat: { fontSize: 9, color: '#64748B', fontWeight: '600' },
  roomNameV2: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginBottom: 2 },
  roomMetaV2: { fontSize: 11, color: '#64748B' },
  roomActionBtnV2: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  roomExpanded: { marginTop: 12 },
  roomExpandedDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 12 },
  roomLimitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
  limitItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  limitLabel: { fontSize: 9, fontWeight: '600', color: '#64748B' },
  limitValue: { fontSize: 10, fontWeight: '800', color: '#E2E8F0' },
  roomDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  roomDetailLabel: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  roomDetailValue: { fontSize: 11, fontWeight: '600', color: '#94A3B8', maxWidth: '60%' },
  roomExpandedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  roomExpandedBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  roomExpandedBtnText: { fontSize: 11, fontWeight: '700', color: '#E2E8F0' },
  // Sistem Odaları
  systemSection: { marginTop: 12, marginBottom: 8, padding: 14, borderRadius: 16, backgroundColor: 'rgba(20,184,166,0.04)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.15)' },
  systemSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  systemBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(20,184,166,0.1)' },
  systemBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.teal },
  systemCount: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  systemRoomCard: { padding: 12, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.9)', borderWidth: 1, borderColor: 'rgba(20,184,166,0.12)', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 6 },
  userAvatar: { width: 40, height: 40, borderRadius: 20 },
  userName: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  userMeta: { fontSize: 10, color: '#64748B', marginTop: 2 },
  userActionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
});
