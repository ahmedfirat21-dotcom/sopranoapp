/**
 * SopranoChat — Post Detay + Yorum Ekrani
 * Gonderi detayi, like toggle, yorum listesi ve ekleme
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Radius } from '../../constants/theme';
import { SocialService, type Post } from '../../services/social';
import { ReportModal } from '../../components/ReportModal';
import { showToast } from '../../components/Toast';
import { useAuth } from '../_layout';
import { supabase } from '../../constants/supabase';

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    display_name: string;
    avatar_url: string;
  };
};

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az once';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const loadPost = useCallback(async () => {
    if (!id || !firebaseUser) return;
    try {
      // Gonderi detayi
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*, profiles(username, display_name, avatar_url)')
        .eq('id', id)
        .single();
      if (postError) throw postError;

      // Kullanicinin begeni durumu
      const { data: likeData } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', id)
        .eq('user_id', firebaseUser.uid)
        .single();

      const fullPost = {
        ...postData,
        liked_by_me: !!likeData,
      } as Post;

      setPost(fullPost);
      setLiked(!!likeData);
      setLikesCount(postData.likes_count || 0);

      // Yorumlar
      const { data: commentData, error: commentError } = await supabase
        .from('post_comments')
        .select('*, profiles(display_name, avatar_url)')
        .eq('post_id', id)
        .order('created_at', { ascending: true });
      if (commentError) throw commentError;
      setComments((commentData || []) as Comment[]);
    } catch (err) {
      console.warn('Post yuklenemedi:', err);
    } finally {
      setLoading(false);
    }
  }, [id, firebaseUser]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleLike = async () => {
    if (!firebaseUser || !id) return;
    try {
      const result = await SocialService.toggleLike(id, firebaseUser.uid);
      if (result.success) {
        setLiked(result.liked ?? false);
        setLikesCount(prev => result.liked ? prev + 1 : Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn('Like hatasi:', err);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !firebaseUser || !id) return;
    const content = commentText.trim();
    setCommentText('');
    setSending(true);

    try {
      const result = await SocialService.addComment(id, firebaseUser.uid, content);
      if (result.success) {
        // Yorum listesini yenile
        await loadPost();
        showToast({ title: 'Yorum eklendi', type: 'success' });
      }
    } catch (err) {
      setCommentText(content);
      showToast({ title: 'Yorum eklenemedi', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.teal} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="document-outline" size={48} color={Colors.text3} />
        <Text style={{ color: Colors.text2, marginTop: 12 }}>Gonderi bulunamadi</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gonderi</Text>
        <Pressable style={{ width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }} onPress={() => {
          Alert.alert('Seçenekler', undefined, [
            { text: '🚩 Gönderiyi Rapor Et', onPress: () => setShowReportModal(true) },
            { text: 'Vazgeç', style: 'cancel' },
          ]);
        }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.text2} />
        </Pressable>
      </View>

      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.postCard}>
            {/* Post Author */}
            <Pressable
              style={styles.authorRow}
              onPress={() => post.user_id && router.push(`/user/${post.user_id}` as any)}
            >
              <Image
                source={{ uri: post.profiles?.avatar_url || 'https://i.pravatar.cc/48?img=1' }}
                style={styles.authorAvatar}
              />
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{post.profiles?.display_name || 'Kullanici'}</Text>
                <Text style={styles.postTime}>{getRelativeTime(post.created_at)}</Text>
              </View>
            </Pressable>

            {/* Post Content */}
            <Text style={styles.postContent}>{post.content}</Text>

            {/* Post Image */}
            {post.image_url && (
              <Image source={{ uri: post.image_url }} style={styles.postImage} />
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={handleLike}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={liked ? Colors.red : Colors.text3}
                />
                <Text style={[styles.actionText, liked && { color: Colors.red }]}>{likesCount}</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => inputRef.current?.focus()}>
                <Ionicons name="chatbubble-outline" size={20} color={Colors.text3} />
                <Text style={styles.actionText}>{comments.length}</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={() => {
                Share.share({
                  message: `${post.content?.substring(0, 100)}...\n\n📲 SopranoChat'te gör: https://sopranochat.app/post/${post.id}`,
                  title: 'SopranoChat Gönderi',
                });
              }}>
                <Ionicons name="share-social-outline" size={20} color={Colors.text3} />
                <Text style={styles.actionText}>Paylaş</Text>
              </Pressable>
            </View>

            {/* Comments Header */}
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Yorumlar ({comments.length})</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.commentItem}
            onPress={() => item.user_id && router.push(`/user/${item.user_id}` as any)}
          >
            <Image
              source={{ uri: item.profiles?.avatar_url || 'https://i.pravatar.cc/36?img=1' }}
              style={styles.commentAvatar}
            />
            <View style={styles.commentBody}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{item.profiles?.display_name || 'Kullanici'}</Text>
                <Text style={styles.commentTime}>{getRelativeTime(item.created_at)}</Text>
              </View>
              <Text style={styles.commentContent}>{item.content}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Ionicons name="chatbubbles-outline" size={32} color={Colors.text3} />
            <Text style={styles.emptyText}>Henuz yorum yok. Ilk yorumu sen yap!</Text>
          </View>
        }
      />

      {/* Comment Input */}
      <View style={styles.inputBar}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder="Yorum yaz..."
          placeholderTextColor={Colors.text3}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        {commentText.trim() ? (
          <Pressable style={styles.sendBtn} onPress={handleComment} disabled={sending}>
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
          </Pressable>
        ) : null}
      </View>

      {/* Report Modal */}
      {firebaseUser && id && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          reporterId={firebaseUser.uid}
          target={{ type: 'post', id }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  // Post Card
  postCard: { paddingHorizontal: 20, paddingTop: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  authorAvatar: { width: 44, height: 44, borderRadius: 22 },
  authorInfo: { flex: 1 },
  authorName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  postTime: { fontSize: 11, color: Colors.text3, marginTop: 2 },
  postContent: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 12 },
  postImage: { width: '100%', height: 220, borderRadius: Radius.default, marginBottom: 12 },

  // Actions
  actionsRow: {
    flexDirection: 'row', gap: 24,
    paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: Colors.glassBorder, marginBottom: 16,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 13, color: Colors.text3, fontWeight: '500' },

  // Comments
  commentsHeader: { marginBottom: 8 },
  commentsTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  commentItem: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: Colors.text },
  commentTime: { fontSize: 10, color: Colors.text3 },
  commentContent: { fontSize: 13, color: Colors.text2, lineHeight: 18 },
  emptyComments: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: Colors.text3, textAlign: 'center', paddingHorizontal: 40 },

  // Input Bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: Colors.glassBorder,
    backgroundColor: Colors.bg2,
  },
  textInput: {
    flex: 1, minHeight: 36, maxHeight: 80,
    borderRadius: Radius.default, backgroundColor: Colors.bg3,
    borderWidth: 1, borderColor: Colors.glassBorder,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, color: Colors.text,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center',
  },
});
