import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Dimensions, ActivityIndicator, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Gradients, Radius, Spacing, Typography } from '../../constants/theme';
import { RoomService, RealtimeService, type Room } from '../../services/database';
import { SocialService, type Post } from '../../services/social';
import { CreatePostModal } from '../../components/CreatePostModal';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../_layout';
import { getAvatarSource } from '../../constants/avatars';
import { EventService, type EventModel } from '../../services/event';

const { width } = Dimensions.get('window');

// Kategori renk eşleşmesi
const CATEGORY_COLOR: Record<string, string> = {
  chat: Colors.teal,
  music: Colors.sapphire,
  game: Colors.emerald,
  book: Colors.ice,
  film: Colors.gold,
  tech: Colors.steel,
};

const CATEGORY_ICON: Record<string, string> = {
  chat: 'mic',
  music: 'musical-notes',
  game: 'game-controller',
  book: 'book',
  film: 'film',
  tech: 'code-slash',
};

const CATEGORY_LABEL: Record<string, string> = {
  chat: 'Sohbet',
  music: 'Müzik',
  game: 'Oyun',
  book: 'Kitap',
  film: 'Film',
  tech: 'Teknoloji',
};

// ========== COMPONENTS ==========

function Header({ avatarUrl }: { avatarUrl?: string }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Image source={require('../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
      <View style={styles.headerBtns}>
        {/* BUGFIX: Search had wrong navigation target — now goes to Discover */}
        <Pressable style={styles.headerBtn} onPress={() => router.push('/(tabs)/discover')}>
          <Ionicons name="search" size={20} color="#FFF" />
        </Pressable>
        <Pressable style={styles.headerBtn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications-outline" size={20} color="#FFF" />
          <View style={styles.notifDot} />
        </Pressable>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <LinearGradient colors={['#14B8A6', '#06B6D4']} style={styles.vipAvatarBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Image source={getAvatarSource(avatarUrl)} style={styles.vipAvatar} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function SectionHeader({ icon, iconColor, title, onSeeAll }: { icon: string; iconColor: string; title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.secHeader}>
      <View style={styles.secTitleRow}>
        <Ionicons name={icon as any} size={14} color={iconColor} />
        <Text style={styles.secTitle}>{title}</Text>
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={styles.secMore}>Tümü →</Text>
        </Pressable>
      )}
    </View>
  );
}

function SectionDivider() {
  return (
    <LinearGradient
      colors={['transparent', 'rgba(255,255,255,0.04)', 'transparent']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={styles.sectionDivider}
    />
  );
}

const RealPostCard = React.memo(function RealPostCard({ post, currentUserId }: { post: Post, currentUserId?: string }) {
  const router = useRouter();
  return (
    <Pressable style={({ pressed }) => [styles.postCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}>
      {post.image_url && (
        <Image source={{ uri: post.image_url }} style={styles.postImage} />
      )}
      <View style={styles.postBody}>
        <Pressable
          style={styles.postUser}
          onPress={() => {
            if (post.user_id) {
              if (post.user_id === currentUserId) {
                router.push('/edit-profile');
              } else {
                router.push(`/user/${post.user_id}` as any);
              }
            }
          }}
        >
          <Image source={getAvatarSource(post.profiles?.avatar_url)} style={[styles.postAvatar, { borderColor: Colors.teal }]} />
          <Text style={styles.postName}>
            {post.profiles?.display_name || 'Kullanıcı'}
          </Text>
        </Pressable>
        <Text style={styles.postText} numberOfLines={2}>{post.content}</Text>
        <View style={styles.postMeta}>
          <View style={styles.metaItem}>
            <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={13} color={post.liked_by_me ? Colors.red : Colors.text3} />
            <Text style={styles.metaText}>{post.likes_count}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="chatbubble" size={12} color={Colors.text3} />
            <Text style={styles.metaText}>{post.comments_count}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const RoomCard = React.memo(function RoomCard({ room }: { room: Room }) {
  const router = useRouter();
  const color = CATEGORY_COLOR[room.category] || '#00BFFF';
  const catLabel = CATEGORY_LABEL[room.category] || '';
  const isBoosted = (room as any).boost_expires_at && new Date((room as any).boost_expires_at) > new Date();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.roomCard,
        isBoosted && { borderColor: 'rgba(251,191,36,0.4)' },
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() => router.push(`/room/${room.id}`)}
    >
      {/* VIP İç Aydınlatma Gradient */}
      <LinearGradient
        colors={[`${color}30`, 'transparent']}
        style={styles.roomGlow}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)', 'transparent']}
        style={styles.cardShine}
      />

      {/* Üst: İzleyici + Kategori + Badge */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <View style={styles.viewerPill}>
          <Text style={styles.viewerText}>👁️ {room.listener_count || 0}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {catLabel ? (
            <View style={[styles.categoryPill, { backgroundColor: `${color}20` }]}>
              <Text style={[styles.categoryPillText, { color }]}>{catLabel}</Text>
            </View>
          ) : null}
          {room.is_live && (
            <View style={[styles.roomBadge, styles.roomBadgeLive]}>
              <View style={styles.liveDot} />
              <Text style={styles.roomBadgeLiveText}>CANLI</Text>
            </View>
          )}
          {isBoosted && !room.is_live && (
            <View style={[styles.roomBadge, { backgroundColor: 'rgba(251,191,36,0.2)' }]}>
              <Text style={{ fontSize: 10 }}>🔥</Text>
            </View>
          )}
        </View>
      </View>

      {/* Merkez: Host Avatar + Statik Halkalar (animasyon kaldırıldı — performans) */}
      <View style={styles.centerAvatar}>
        <View style={[styles.ripple, { borderColor: color, opacity: 0.25, transform: [{ scale: 1.4 }] }]} />
        <View style={[styles.ripple, { borderColor: color, opacity: 0.12, transform: [{ scale: 1.7 }] }]} />
        <Image source={getAvatarSource(room.host?.avatar_url)} style={styles.roomAvatar} />
      </View>

      {/* Alt: Başlık + Host */}
      <View style={styles.cardBottom}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {room.type === 'closed' && <Ionicons name="lock-closed" size={12} color="#F59E0B" />}
          {room.type === 'invite' && <Ionicons name="mail" size={12} color="#A78BFA" />}
          <Text style={styles.roomTitle} numberOfLines={1}>{room.name}</Text>
        </View>
        <View style={styles.roomHost}>
          <Text style={styles.roomHostName}>{room.host?.display_name || 'Anonim'}</Text>
        </View>
      </View>
  </Pressable>
  );
});

function EmptyRooms() {
  const router = useRouter();
  return (
    <EmptyState
      icon="mic-outline"
      title="Henüz canlı oda yok"
      subtitle="İlk odayı sen aç, sohbeti başlat!"
      actionLabel="Oda Oluştur"
      onAction={() => router.push('/create')}
    />
  );
}

function EventCard({ event }: { event: EventModel }) {
  const router = useRouter();
  const evDate = new Date(event.scheduled_at);
  const now = new Date();
  const isTimeArrived = now.getTime() >= evDate.getTime() - (5 * 60 * 1000);

  return (
    <Pressable style={({ pressed }) => [styles.eventCard, pressed && { opacity: 0.9 }]} onPress={() => router.push(`/event/${event.id}` as any)}>
      <Image source={{ uri: event.cover_image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=100&h=100&fit=crop' }} style={styles.eventImage} />
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

// ========== HOME SCREEN ==========
export default function HomeScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<EventModel[]>([]);

  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsLoadingMore, setRoomsLoadingMore] = useState(false);
  const [roomsHasMore, setRoomsHasMore] = useState(true);

  const [postsLoading, setPostsLoading] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(true);

  const [activeTab, setActiveTab] = useState<'discover' | 'following'>('discover');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const { firebaseUser, profile } = useAuth();

  const loadRooms = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) setRoomsLoadingMore(true);
      else setRoomsLoading(true);

      const currentRooms = isLoadMore ? rooms : [];
      const offset = currentRooms.length;
      const liveRooms = await RoomService.getLive(20, offset);

      setRoomsHasMore(liveRooms.length >= 20);
      setRooms(isLoadMore ? [...currentRooms, ...liveRooms] : liveRooms);
    } catch (err) {
      console.warn('Odalar yüklenemedi:', err);
    } finally {
      setRoomsLoading(false);
      setRoomsLoadingMore(false);
    }
  }, [rooms]);

  const loadPosts = useCallback(async (isLoadMore = false) => {
    if (!firebaseUser) return;
    try {
      if (isLoadMore) setPostsLoadingMore(true);
      else setPostsLoading(true);

      const fetcher = activeTab === 'discover' ? SocialService.getDiscoverFeed : SocialService.getFollowingFeed;
      const currentPosts = isLoadMore ? posts : [];
      const lastTimestamp = isLoadMore && currentPosts.length > 0 ? currentPosts[currentPosts.length - 1].created_at : null;
      const { feed, error } = await fetcher(firebaseUser.uid, 20, lastTimestamp);
      if (error) throw error;

      const newPosts = feed || [];
      setPostsHasMore(newPosts.length >= 20);
      setPosts(isLoadMore ? [...currentPosts, ...newPosts] : newPosts);
    } catch (err) {
      console.warn('Postlar yüklenemedi:', err);
    } finally {
      setPostsLoading(false);
      setPostsLoadingMore(false);
    }
  }, [firebaseUser, activeTab, posts]);

  const loadEvents = useCallback(async () => {
    try {
      const upcoming = await EventService.getUpcoming(10);
      setEvents(upcoming);
    } catch (err) {
      console.warn('Etkinlikler yüklenemedi:', err);
    }
  }, []);

  useEffect(() => {
    // Süresi dolan odaları otomatik temizle
    RoomService.autoCloseExpired().then(count => {
      if (count > 0) console.log(`${count} süresi dolmuş oda kapatıldı`);
    }).catch(e => e);
    loadRooms(false);
    loadEvents();
  }, []);
  useEffect(() => { loadPosts(false); }, [activeTab]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = RealtimeService.onRoomsChange((updatedRooms) => {
      // Debounce — çok sık güncelleme performansı düşürür
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => setRooms(updatedRooms), 2000);
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      RealtimeService.unsubscribe(channel);
    };
  }, []);

  const handleLoadMoreRooms = () => {
    if (!roomsLoadingMore && roomsHasMore && rooms.length > 0) loadRooms(true);
  };

  const handleLoadMorePosts = () => {
    if (!postsLoadingMore && postsHasMore && posts.length > 0) loadPosts(true);
  };

  return (
    <View style={styles.container}>
      {/* Ambient Background Orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.meshOrb, styles.meshNavy]} />
        <View style={[styles.meshOrb, styles.meshGold]} />
      </View>

      <Header avatarUrl={profile?.avatar_url} />

      {roomsLoading && rooms.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.teal} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
              handleLoadMoreRooms();
            }
          }}
          scrollEventThrottle={400}
        >
          {/* Ambient Top Gradient */}
          <LinearGradient
            colors={['rgba(15, 31, 71, 0.35)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200 }}
            pointerEvents="none"
          />

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

          {/* Feed Tabs */}
          <View style={styles.section}>
            <View style={styles.feedTabs}>
              <Pressable
                style={[styles.feedTab, activeTab === 'discover' && styles.feedTabActive]}
                onPress={() => setActiveTab('discover')}
              >
                <Text style={[styles.feedTabText, activeTab === 'discover' && styles.feedTabTextActive]}>🔥 Keşfet</Text>
              </Pressable>
              <Pressable
                style={[styles.feedTab, activeTab === 'following' && styles.feedTabActive]}
                onPress={() => setActiveTab('following')}
              >
                <Text style={[styles.feedTabText, activeTab === 'following' && styles.feedTabTextActive]}>👥 Takip</Text>
              </Pressable>
            </View>
          </View>

          {/* Posts — BUGFIX: Replaced nested FlatList with horizontal ScrollView */}
          {postsLoading && posts.length === 0 ? (
            <ActivityIndicator size="small" color="#14B8A6" style={{ marginVertical: 16 }} />
          ) : posts.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.postsScroll}
            >
              {posts.map((item) => (
                <RealPostCard key={item.id} post={item} currentUserId={firebaseUser?.uid} />
              ))}
              {postsLoadingMore && <ActivityIndicator size="small" color="#14B8A6" style={{ marginLeft: 12 }} />}
            </ScrollView>
          ) : (
            <EmptyState
              icon="newspaper-outline"
              title="Henüz gönderi yok"
              subtitle="İlk gönderiyi paylaşarak akışı başlat!"
              actionLabel="Gönderi Paylaş"
              onAction={() => setShowCreatePost(true)}
            />
          )}

          <SectionDivider />

          {/* Trend Odalar */}
          <View style={[styles.section, { marginTop: 4 }]}>
            <SectionHeader icon="flame" iconColor="#FF4500" title="Trend Odalar" onSeeAll={() => router.push('/(tabs)/discover')} />
          </View>

          {rooms.length === 0 ? (
            <EmptyRooms />
          ) : (
            <View style={styles.masonryWrap}>
              {/* Sol Sütun */}
              <View style={styles.masonryCol}>
                {rooms.filter((_, i) => i % 2 === 0).map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </View>
              {/* Sağ Sütun (asimetrik offset) */}
              <View style={[styles.masonryCol, { marginTop: 24 }]}>
                {rooms.filter((_, i) => i % 2 !== 0).map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </View>
            </View>
          )}

          {/* Footer / Load more indicator */}
          <View style={{ paddingBottom: 20 }}>
            {roomsLoadingMore && (
              <ActivityIndicator size="small" color={Colors.teal} style={{ marginVertical: 20 }} />
            )}
            {!roomsHasMore && rooms.length > 0 && (
              <Text style={{ textAlign: 'center', color: Colors.text3, marginVertical: 20, fontSize: 13 }}>
                Hepsi bu kadar 🌟
              </Text>
            )}

            <SectionDivider />

            {/* Etkinlikler */}
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionHeader icon="calendar" iconColor={Colors.cyan} title="Yaklaşan Etkinlikler" />
                <Pressable style={{ paddingRight: 20 }} onPress={() => router.push('/create-event')}>
                  <Ionicons name="add-circle" size={24} color={Colors.teal} />
                </Pressable>
              </View>
            </View>
            {events.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="Yaklaşan etkinlik yok"
                subtitle="Bir etkinlik planla, topluluğu bir araya getir!"
                actionLabel="Etkinlik Oluştur"
                onAction={() => router.push('/create-event')}
              />
            ) : (
              events.map((ev) => (
                <View key={ev.id} style={{ marginHorizontal: Spacing.xl, marginBottom: Spacing.md }}>
                  <EventCard event={ev} />
                </View>
              ))
            )}
            <View style={{ height: 20 }} />
          </View>
        </ScrollView>
      )}

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
const CARD_WIDTH = 230;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingTop: 54 },

  // Ambient Orbs
  meshOrb: { position: 'absolute', width: width * 1.5, height: width * 1.5, borderRadius: width },
  meshNavy: { backgroundColor: '#0F1F47', bottom: -width * 0.2, left: -width * 0.5, opacity: 0.2 },
  meshGold: { backgroundColor: '#D4AF37', top: -width * 0.4, right: -width * 0.6, opacity: 0.08 },

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
  vipAvatarBorder: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  vipAvatar: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2, borderColor: Colors.bg,
  },

  // Body
  body: { flex: 1 },

  // Create Post Bar
  createPostBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 4, marginBottom: 2, padding: 12,
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

  // Section
  section: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  secTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secTitle: { fontSize: 14, fontWeight: '700', color: '#F8FAFC', letterSpacing: 0.3 },
  secMore: { fontSize: 11, color: '#14B8A6', fontWeight: '600' },
  sectionDivider: { height: 1, marginHorizontal: 20, marginVertical: 12 },

  // Feed Tabs
  feedTabs: { flexDirection: 'row', gap: 10 },
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

  // Posts horizontal scroll
  postsScroll: { paddingLeft: 16, paddingRight: 8, gap: 10 },
  postCard: {
    width: CARD_WIDTH, borderRadius: 20,
    backgroundColor: 'rgba(20,20,30,0.5)', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  postImage: { width: CARD_WIDTH, height: 120 },
  postBody: { padding: 12 },
  postUser: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  postAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5 },
  postName: { fontSize: 12, fontWeight: '700', color: '#E2E8F0' },
  postText: { fontSize: 12, color: '#94A3B8', lineHeight: 16 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: '#64748B' },

  // Rooms masonry
  masonryWrap: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  masonryCol: { flex: 1, gap: 12 },
  roomCard: {
    borderRadius: 22, padding: 14,
    backgroundColor: 'rgba(20,20,30,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  roomGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
  cardShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 40,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  viewerPill: {
    borderRadius: 10, overflow: 'hidden',
    paddingHorizontal: 7, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  viewerText: { color: '#FFF', fontSize: 10, fontWeight: '600' },
  categoryPill: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  categoryPillText: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  roomBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10,
  },
  roomBadgeLive: { backgroundColor: 'rgba(255,20,147,0.2)' },
  roomBadgeLiveText: { fontSize: 8, fontWeight: '700', color: '#FF1493', textTransform: 'uppercase', letterSpacing: 0.5 },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF1493' },
  centerAvatar: {
    alignSelf: 'center', width: 52, height: 52,
    justifyContent: 'center', alignItems: 'center',
  },
  roomAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: '#FFF', zIndex: 2,
  },
  ripple: {
    position: 'absolute',
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2,
  },
  cardBottom: { gap: 3  },
  roomTitle: { fontSize: 13, fontWeight: '600', color: '#FFF', lineHeight: 16 },
  roomHost: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomHostName: { fontSize: 10, color: '#94A3B8' },

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
