/**
 * SopranoChat — Bildirimler Ekranı
 * Instagram tarzı: Üstte Takip İstekleri (Onayla/Reddet), altta bildirimler
 */
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image, ActivityIndicator, RefreshControl, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../constants/theme';
import { supabase } from '../constants/supabase';
import { FriendshipService, type PendingRequest } from '../services/friendship';
import { getAvatarSource } from '../constants/avatars';
import EmptyState from '../components/EmptyState';
import { showToast } from '../components/Toast';
import { useAuth } from './_layout';

type Notification = {
  id: string;
  user_id: string;
  sender_id: string;
  type: 'like' | 'comment' | 'gift' | 'follow' | 'follow_request' | 'follow_accepted';
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    display_name: string;
    avatar_url: string;
  };
};

const NOTIF_CONFIG: Record<string, { icon: string; color: string; verb: string }> = {
  like: { icon: 'heart', color: '#EF4444', verb: 'gönderini beğendi' },
  comment: { icon: 'chatbubble', color: '#3B82F6', verb: 'gönderine yorum yaptı' },
  gift: { icon: 'gift', color: '#F59E0B', verb: 'sana hediye gönderdi' },
  follow: { icon: 'person-add', color: '#14B8A6', verb: 'seni takip etmeye başladı' },
  follow_request: { icon: 'person-add', color: '#F59E0B', verb: 'seni takip etmek istiyor' },
  follow_accepted: { icon: 'checkmark-circle', color: '#10B981', verb: 'takip isteğini kabul etti' },
};

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      // Paralel olarak hem bildirimleri hem takip isteklerini çek
      const [notifsResult, pendingResult] = await Promise.all([
        supabase
          .from('notifications')
          .select('*, sender:profiles!sender_id(display_name, avatar_url)')
          .eq('user_id', firebaseUser.uid)
          .order('created_at', { ascending: false })
          .limit(50),
        FriendshipService.getPendingRequests(firebaseUser.uid),
      ]);

      if (notifsResult.data) {
        setNotifications(notifsResult.data as Notification[]);
      }
      setPendingRequests(pendingResult);

      // Tümünü okundu olarak işaretle
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', firebaseUser.uid)
        .eq('is_read', false);
    } catch (err) {
      console.warn('Bildirimler yüklenemedi:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleApprove = async (followerId: string) => {
    if (!firebaseUser) return;
    setProcessingIds(prev => new Set(prev).add(followerId));
    try {
      const result = await FriendshipService.approveRequest(firebaseUser.uid, followerId);
      if (result.success) {
        setPendingRequests(prev => prev.filter(r => r.user_id !== followerId));
        showToast({ title: 'Takip isteği onaylandı', type: 'success' });
      } else {
        showToast({ title: 'Hata oluştu', type: 'error' });
      }
    } catch {
      showToast({ title: 'Hata oluştu', type: 'error' });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(followerId);
        return next;
      });
    }
  };

  const handleReject = async (followerId: string) => {
    if (!firebaseUser) return;
    setProcessingIds(prev => new Set(prev).add(followerId));
    try {
      const result = await FriendshipService.rejectRequest(firebaseUser.uid, followerId);
      if (result.success) {
        setPendingRequests(prev => prev.filter(r => r.user_id !== followerId));
        showToast({ title: 'Takip isteği reddedildi', type: 'info' });
      }
    } catch {
      showToast({ title: 'Hata', type: 'error' });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(followerId);
        return next;
      });
    }
  };

  /** Takip İstekleri Bölümü (Instagram tarzı) */
  const renderPendingSection = () => {
    if (pendingRequests.length === 0) return null;

    return (
      <View style={styles.pendingSection}>
        {/* Takip İstekleri Header — tıkla aç/kapa */}
        <Pressable style={styles.pendingHeader} onPress={() => setShowRequests(!showRequests)}>
          <View style={styles.pendingHeaderLeft}>
            <View style={styles.pendingIconWrap}>
              <Ionicons name="person-add" size={18} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.pendingTitle}>Takip İstekleri</Text>
              <Text style={styles.pendingSubtitle}>
                {pendingRequests.length} yeni istek
              </Text>
            </View>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingRequests.length}</Text>
          </View>
        </Pressable>

        {/* İstekler Listesi (açık/kapalı) */}
        {showRequests && (
          <View style={styles.pendingList}>
            {pendingRequests.map((req) => {
              const isProcessing = processingIds.has(req.user_id);
              return (
                <View key={req.user_id} style={styles.pendingItem}>
                  <Pressable
                    style={styles.pendingUser}
                    onPress={() => router.push(`/user/${req.sender?.id || req.user_id}`)}
                  >
                    <Image
                      source={getAvatarSource(req.sender?.avatar_url)}
                      style={styles.pendingAvatar}
                    />
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingName} numberOfLines={1}>
                        {req.sender?.display_name || 'Kullanıcı'}
                      </Text>
                      <Text style={styles.pendingTime}>{getRelativeTime(req.created_at)}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.pendingActions}>
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={Colors.teal} />
                    ) : (
                      <>
                        {/* Onayla */}
                        <Pressable
                          style={styles.approveBtn}
                          onPress={() => handleApprove(req.user_id)}
                        >
                          <Text style={styles.approveBtnText}>Onayla</Text>
                        </Pressable>
                        {/* Reddet */}
                        <Pressable
                          style={styles.rejectBtn}
                          onPress={() => handleReject(req.user_id)}
                        >
                          <Text style={styles.rejectBtnText}>Sil</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = NOTIF_CONFIG[item.type] || NOTIF_CONFIG.like;
    return (
      <Pressable
        style={[styles.notifItem, !item.is_read && styles.notifUnread]}
        onPress={() => {
          if (item.type === 'like' || item.type === 'comment') {
            if (item.reference_id) router.push(`/post/${item.reference_id}` as any);
          } else if (item.type === 'gift') {
            router.push(`/user/${item.sender_id}` as any);
          } else if (item.type === 'follow' || item.type === 'follow_request' || item.type === 'follow_accepted') {
            router.push(`/user/${item.sender_id}` as any);
          }
        }}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${config.color}18` }]}>
          <Ionicons name={config.icon as any} size={18} color={config.color} />
        </View>
        <Image
          source={getAvatarSource(item.sender?.avatar_url)}
          style={styles.notifAvatar}
        />
        <View style={styles.notifContent}>
          <Text style={styles.notifText}>
            <Text style={styles.notifName}>{item.sender?.display_name || 'Kullanıcı'}</Text>
            {' '}{config.verb}
          </Text>
          <Text style={styles.notifTime}>{getRelativeTime(item.created_at)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.teal} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={renderPendingSection}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} />
          }
          ListEmptyComponent={
            pendingRequests.length === 0 ? (
              <EmptyState
                icon="notifications-outline"
                title="Bildirim yok"
                subtitle="Yeni takipçiler, hediyeler ve mesajlar burada görünecek"
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* ═══ Takip İstekleri Bölümü ═══ */
  pendingSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
    overflow: 'hidden',
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pendingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pendingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  pendingSubtitle: {
    fontSize: 12,
    color: Colors.text3,
    marginTop: 1,
  },
  pendingBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
  pendingList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,158,11,0.12)',
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  pendingUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  pendingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  pendingTime: {
    fontSize: 11,
    color: Colors.text3,
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  approveBtn: {
    backgroundColor: '#14B8A6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  rejectBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text2,
  },

  /* ═══ Normal Bildirimler ═══ */
  notifItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  notifUnread: { backgroundColor: 'rgba(20,184,166,0.04)' },
  notifIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  notifAvatar: { width: 40, height: 40, borderRadius: 20 },
  notifContent: { flex: 1 },
  notifText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  notifName: { fontWeight: '700' },
  notifTime: { fontSize: 11, color: Colors.text3, marginTop: 2 },
});
