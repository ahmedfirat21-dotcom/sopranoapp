import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, Dimensions,
  ActivityIndicator, FlatList, RefreshControl, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Spacing } from '../../constants/theme';
import { RoomService, RealtimeService, type Room } from '../../services/database';
import { SocialService, type Post } from '../../services/social';
import { CreatePostModal } from '../../components/CreatePostModal';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../_layout';
import { getAvatarSource } from '../../constants/avatars';
import { EventService, type EventModel } from '../../services/event';

const { width } = Dimensions.get('window');

// ========== HEADER ==========
function Header({ avatarUrl }: { avatarUrl?: string }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Image source={require('../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
      <View style={styles.headerBtns}>
        <Pressable style={styles.headerBtn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={20} color="#FFF" />
          <View style={styles.notifDot} />
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <LinearGradient colors={['#14B8A6', '#06B6D4']} style={styles.avatarBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Image source={getAvatarSource(avatarUrl)} style={styles.headerAvatar} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

// ========== LIVE ROOM STORY STRIP ==========
const LiveRoomStory = React.memo(function LiveRoomStory({ room, isFollowing }: { room: Room; isFollowing?: boolean }) {
  const router = useRouter();
  const borderColors: [string, string] = isFollowing
    ? ['#FFD700', '#FFA500']  // Altın halka — takip edilen
    : ['#14B8A6', '#06B6D4']; // Teal halka — normal

  return (
    <Pressable
      style={({ pressed }) => [styles.storyItem, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
      onPress={() => router.push(`/room/${room.id}`)}
    >
      <LinearGradient colors={borderColors} style={styles.storyRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Image source={getAvatarSource(room.host?.avatar_url)} style={styles.storyAvatar} />
      </LinearGradient>
      {room.is_live && <View style={styles.storyLiveBadge}><Text style={styles.storyLiveText}>CANLI</Text></View>}
      <Text style={styles.storyName} numberOfLines={1}>{room.host?.display_name || 'Anonim'}</Text>
      <Text style={styles.storyRoomName} numberOfLines={1}>{room.name}</Text>
    </Pressable>
  );
});

function LiveRoomStrip({ rooms }: { rooms: Room[] }) {
  if (rooms.length === 0) return null;
  return (
    <View style={styles.stripContainer}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripScroll}
        renderItem={({ item }) => <LiveRoomStory room={item} />}
      />
    </View>
  );
}

// ========== SECTION COMPONENTS ==========
function SectionDivider() {
  return (
    <LinearGradient
      colors={['transparent', 'rgba(255,255,255,0.04)', 'transparent']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={styles.sectionDivider}
    />
  );
}

// ========== COMPACT POST CARD (Vertical Feed) ==========
const CompactPostCard = React.memo(function CompactPostCard({ post, currentUserId, onLike, onDelete }: { post: Post; currentUserId?: string; onLike?: (postId: string) => void; onDelete?: (postId: string) => void }) {
  const router = useRouter();
  const isOwn = post.user_id === currentUserId;
  return (
    <Pressable
      style={({ pressed }) => [styles.postCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
      onPress={() => router.push(`/post/${post.id}` as any)}
    >
      {/* Kullanıcı Bilgisi */}
      <View style={styles.postHeader}>
        <Pressable
          style={styles.postUser}
          onPress={() => {
            if (post.user_id) {
              if (isOwn) router.push('/(tabs)/profile');
              else router.push(`/user/${post.user_id}` as any);
            }
          }}
        >
          <Image source={getAvatarSource(post.profiles?.avatar_url)} style={styles.postAvatar} />
          <View>
            <Text style={styles.postUserName}>{post.profiles?.display_name || 'Kullanıcı'}</Text>
            <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </Pressable>
        <Pressable hitSlop={8} onPress={() => {
          Alert.alert('Seçenekler', undefined, [
            ...(isOwn ? [{ text: '🗑️ Gönderiyi Sil', style: 'destructive' as const, onPress: () => onDelete?.(post.id) }] : []),
            { text: '🚩 Rapor Et', onPress: () => router.push(`/post/${post.id}` as any) },
            { text: '📤 Paylaş', onPress: () => Share.share({ message: `${post.content?.substring(0, 80)}...\n\n📲 SopranoChat: https://sopranochat.app/post/${post.id}` }) },
            { text: 'Vazgeç', style: 'cancel' as const },
          ]);
        }}>
          <Ionicons name="ellipsis-horizontal" size={16} color={Colors.text3} />
        </Pressable>
      </View>

      {/* İçerik */}
      <Text style={styles.postContent} numberOfLines={3}>{post.content}</Text>

      {/* Görsel (varsa — küçük thumbnail) */}
      {post.image_url && (
        <Image source={{ uri: post.image_url }} style={styles.postThumbnail} />
      )}

      {/* Meta (beğeni + yorum + paylaş) */}
      <View style={styles.postMeta}>
        <Pressable style={styles.metaItem} onPress={() => onLike?.(post.id)}>
          <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={16} color={post.liked_by_me ? '#EF4444' : Colors.text3} />
          <Text style={[styles.metaText, post.liked_by_me && { color: '#EF4444' }]}>{post.likes_count || 0}</Text>
        </Pressable>
        <Pressable style={styles.metaItem} onPress={() => router.push(`/post/${post.id}` as any)}>
          <Ionicons name="chatbubble-outline" size={14} color={Colors.text3} />
          <Text style={styles.metaText}>{post.comments_count || 0}</Text>
        </Pressable>
        <Pressable style={styles.metaItem} onPress={() => Share.share({ message: `${post.content?.substring(0, 80)}...\n\n📲 SopranoChat: https://sopranochat.app/post/${post.id}` })}>
          <Ionicons name="share-social-outline" size={14} color={Colors.text3} />
        </Pressable>
      </View>
    </Pressable>
  );
});

// ========== EVENT CARD ==========
function EventCard({ event }: { event: EventModel }) {
  const router = useRouter();
  const evDate = new Date(event.scheduled_at);
  const now = new Date();
  const isTimeArrived = now.getTime() >= evDate.getTime() - (5 * 60 * 1000);

  return (
    <Pressable
      style={({ pressed }) => [styles.eventCard, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(`/event/${event.id}` as any)}
    >
      <Image
        source={{ uri: event.cover_image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=100&h=100&fit=crop' }}
        style={styles.eventImage}
      />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.eventDesc} numberOfLines={1}>
          {evDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} • {evDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <View style={styles.eventTags}>
          <View style={[styles.eventTag, { backgroundColor: `${Colors.teal}18` }]}>
            <Text style={[styles.eventTagText, { color: Colors.teal }]}>#{event.category}</Text>
          </View>
          {isTimeArrived && (
            <View style={[styles.eventTag, { backgroundColor: `${Colors.red}18` }]}>
              <Text style={[styles.eventTagText, { color: Colors.red }]}>Şimdi Katıl</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ========== HELPER ==========
function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}g`;
  return `${Math.floor(days / 7)}hf`;
}

// ========== HOME SCREEN ==========
export default function HomeScreen() {
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();

  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<EventModel[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(true);

  const [activeTab, setActiveTab] = useState<'discover' | 'following'>('discover');

  // Post like/delete handlers
  const handlePostLike = useCallback(async (postId: string) => {
    if (!firebaseUser) return;
    const result = await SocialService.toggleLike(postId, firebaseUser.uid);
    if (result.success) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked_by_me: result.liked, likes_count: result.liked ? (p.likes_count || 0) + 1 : Math.max(0, (p.likes_count || 0) - 1) } : p));
    }
  }, [firebaseUser]);

  const handlePostDelete = useCallback(async (postId: string) => {
    if (!firebaseUser) return;
    Alert.alert('Gönderiyi Sil', 'Bu gönderi kalıcı olarak silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        const result = await SocialService.deletePost(postId, firebaseUser.uid);
        if (result.success) setPosts(prev => prev.filter(p => p.id !== postId));
      }},
    ]);
  }, [firebaseUser]);
  const [showCreatePost, setShowCreatePost] = useState(false);

  // Refs to avoid stale closures
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [roomData, eventData] = await Promise.all([
        RoomService.getLive(30, 0),
        EventService.getUpcoming(10),
      ]);
      setLiveRooms(roomData);
      setEvents(eventData);

      // Süresi dolan odaları background'da temizle
      RoomService.autoCloseExpired().catch(() => {});
    } catch (err) {
      console.warn('Home yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPosts = useCallback(async (isLoadMore = false) => {
    if (!firebaseUser) return;
    try {
      if (isLoadMore) setPostsLoadingMore(true);

      const currentPosts = isLoadMore ? postsRef.current : [];
      const lastTs = isLoadMore && currentPosts.length > 0
        ? currentPosts[currentPosts.length - 1].created_at
        : null;

      const fetcher = activeTab === 'discover'
        ? SocialService.getDiscoverFeed
        : SocialService.getFollowingFeed;

      const { feed, error } = await fetcher(firebaseUser.uid, 20, lastTs);
      if (error) throw error;

      const newPosts = feed || [];
      setPostsHasMore(newPosts.length >= 20);
      setPosts(isLoadMore ? [...currentPosts, ...newPosts] : newPosts);
    } catch (err) {
      console.warn('Postlar yüklenemedi:', err);
    } finally {
      setPostsLoadingMore(false);
    }
  }, [firebaseUser, activeTab]);

  // İlk yükleme
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadPosts(false); }, [activeTab, firebaseUser]);

  // Realtime oda güncellemesi
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = RealtimeService.onRoomsChange((updatedRooms) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => setLiveRooms(updatedRooms), 2000);
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      RealtimeService.unsubscribe(channel);
    };
  }, []);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadAll(), loadPosts(false)]);
    setRefreshing(false);
  }, [loadAll, loadPosts]);

  // Load more posts
  const handleLoadMorePosts = useCallback(() => {
    if (!postsLoadingMore && postsHasMore && posts.length > 0) {
      loadPosts(true);
    }
  }, [postsLoadingMore, postsHasMore, posts.length, loadPosts]);

  // ========== RENDER HELPERS ==========
  const renderListHeader = () => (
    <View>
      {/* Ambient Background Orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.meshOrb, styles.meshNavy]} />
        <View style={[styles.meshOrb, styles.meshGold]} />
      </View>

      {/* Canlı Oda Şeridi */}
      <LiveRoomStrip rooms={liveRooms} />

      {/* Yaklaşan Etkinlikler (stories altında, erişilebilir) */}
      {events.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="calendar" size={14} color={Colors.cyan} />
              <Text style={styles.sectionTitle}>Yaklaşan Etkinlikler</Text>
            </View>
            <Pressable onPress={() => router.push('/create-event')}>
              <Ionicons name="add-circle" size={22} color={Colors.teal} />
            </Pressable>
          </View>
          {events.map((ev) => (
            <View key={ev.id} style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <EventCard event={ev} />
            </View>
          ))}
        </>
      )}

      <SectionDivider />

      {/* Gönderi Oluştur */}
      <Pressable
        style={({ pressed }) => [styles.createPostBar, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        onPress={() => setShowCreatePost(true)}
      >
        <Image source={getAvatarSource(profile?.avatar_url)} style={styles.createPostAvatar} />
        <Text style={styles.createPostPlaceholder}>Ne düşünüyorsun? 💭</Text>
        <View style={styles.createPostIconWrap}>
          <Ionicons name="create-outline" size={16} color="#14B8A6" />
        </View>
      </Pressable>

      {/* Feed Tabları */}
      <View style={styles.feedTabsWrap}>
        <Pressable
          style={[styles.feedTab, activeTab === 'discover' && styles.feedTabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.feedTabText, activeTab === 'discover' && styles.feedTabTextActive]}>🔥 Son</Text>
        </Pressable>
        <Pressable
          style={[styles.feedTab, activeTab === 'following' && styles.feedTabActive]}
          onPress={() => setActiveTab('following')}
        >
          <Text style={[styles.feedTabText, activeTab === 'following' && styles.feedTabTextActive]}>👥 Takip</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderListFooter = () => (
    <View style={{ paddingBottom: 100 }}>
      {postsLoadingMore && (
        <ActivityIndicator size="small" color={Colors.teal} style={{ marginVertical: 20 }} />
      )}
      {!postsHasMore && posts.length > 0 && (
        <Text style={styles.endText}>Hepsi bu kadar 🌟</Text>
      )}
    </View>
  );

  const renderEmptyPosts = () => (
    <EmptyState
      icon="newspaper-outline"
      title="Henüz gönderi yok"
      subtitle="İlk gönderiyi paylaşarak akışı başlat!"
      actionLabel="Gönderi Paylaş"
      onAction={() => setShowCreatePost(true)}
    />
  );

  if (loading && posts.length === 0) {
    return (
      <View style={styles.container}>
        <Header avatarUrl={profile?.avatar_url} />
        <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 50 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header avatarUrl={profile?.avatar_url} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CompactPostCard post={item} currentUserId={firebaseUser?.uid} onLike={handlePostLike} onDelete={handlePostDelete} />
        )}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderEmptyPosts}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMorePosts}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.teal}
            colors={[Colors.teal]}
            progressBackgroundColor={Colors.bg2}
          />
        }
      />

      {/* Gönderi Oluşturma Modalı */}
      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        userId={firebaseUser?.uid || ''}
        userAvatar={profile?.avatar_url || 'https://i.pravatar.cc/40?img=1'}
        userName={profile?.display_name || 'Kullanıcı'}
        onPostCreated={() => loadPosts(false)}
      />
    </View>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingTop: 54 },

  // Ambient Orbs
  meshOrb: { position: 'absolute', width: width * 1.5, height: width * 1.5, borderRadius: width },
  meshNavy: { backgroundColor: '#0F1F47', bottom: -width * 0.2, left: -width * 0.5, opacity: 0.15 },
  meshGold: { backgroundColor: '#D4AF37', top: -width * 0.4, right: -width * 0.6, opacity: 0.06 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  headerLogo: { height: 36, width: 140 },
  headerBtns: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerBtn: { padding: 2, position: 'relative' },
  notifDot: {
    position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#FF4500', borderWidth: 1.5, borderColor: Colors.bg,
  },
  avatarBorder: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatar: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: Colors.bg,
  },

  // Live Room Strip (Stories)
  stripContainer: { marginTop: 4 },
  stripScroll: { paddingHorizontal: 12, gap: 14 },
  storyItem: { alignItems: 'center', width: 72 },
  storyRing: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
  },
  storyAvatar: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2.5, borderColor: Colors.bg,
  },
  storyLiveBadge: {
    position: 'absolute', top: 50, left: 10, right: 10,
    backgroundColor: '#EF4444', borderRadius: 6,
    paddingVertical: 1, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.bg,
  },
  storyLiveText: { fontSize: 7, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  storyName: { fontSize: 10, fontWeight: '600', color: '#E2E8F0', marginTop: 6, textAlign: 'center' },
  storyRoomName: { fontSize: 8, color: Colors.text3, textAlign: 'center' },

  // Section Divider
  sectionDivider: { height: 1, marginHorizontal: 20, marginVertical: 10 },

  // Create Post Bar
  createPostBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4, padding: 12,
    borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  createPostAvatar: { width: 30, height: 30, borderRadius: 15 },
  createPostPlaceholder: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  createPostIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(20,184,166,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Feed Tabs
  feedTabsWrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  feedTab: {
    paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  feedTabActive: {
    backgroundColor: 'rgba(139,92,246,0.25)', borderColor: 'rgba(139,92,246,0.5)',
  },
  feedTabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  feedTabTextActive: { color: '#FFF', fontWeight: '700' },

  // Compact Post Card
  postCard: {
    marginHorizontal: 16, marginBottom: 10, padding: 14,
    borderRadius: 18, backgroundColor: 'rgba(20,20,30,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  postHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  postUser: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postAvatar: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(20,184,166,0.3)',
  },
  postUserName: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  postTime: { fontSize: 10, color: Colors.text3, marginTop: 1 },
  postContent: { fontSize: 13, color: '#CBD5E1', lineHeight: 19 },
  postThumbnail: {
    width: '100%', height: 160, borderRadius: 12,
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#64748B' },

  // Section Header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#F8FAFC', letterSpacing: 0.3 },

  endText: { textAlign: 'center', color: Colors.text3, marginVertical: 20, fontSize: 13 },

  // Events
  eventCard: {
    flexDirection: 'row', gap: 10, padding: 14,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  eventImage: { width: 44, height: 44, borderRadius: 12 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 13, fontWeight: '700', color: '#E2E8F0', marginBottom: 2 },
  eventDesc: { fontSize: 11, color: '#64748B' },
  eventTags: { flexDirection: 'row', gap: 4, marginTop: 4 },
  eventTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  eventTagText: { fontSize: 9, fontWeight: '700' },
});
