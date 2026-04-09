/**
 * SopranoChat — Oda Duvarı Servisi
 * Sadece oda bağlamında post/yorum/beğeni işlemleri.
 * Genel sosyal feed (discover/following) kaldırıldı — SopranoChat bir oda platformudur.
 */
import { supabase } from '../constants/supabase';
import { filterBadWords } from '../constants/badwords';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  link_url: string | null;
  link_title: string | null;
  link_description: string | null;
  link_image: string | null;
  link_domain: string | null;
  voice_url: string | null;
  voice_duration: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
  };
  liked_by_me?: boolean;
}

export const SocialService = {
  /**
   * Yeni bir gönderi oluşturur (oda duvarı bağlamında)
   */
  async createPost(
    userId: string,
    content: string,
    imageUrl?: string,
    meta?: {
      locationName?: string;
      locationLat?: number;
      locationLng?: number;
      linkUrl?: string;
      linkTitle?: string;
      linkDescription?: string;
      linkImage?: string;
      linkDomain?: string;
      voiceUrl?: string;
      voiceDuration?: number;
      roomId?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('posts').insert([
        {
          user_id: userId,
          content: filterBadWords(content),
          image_url: imageUrl || null,
          location_name: meta?.locationName || null,
          location_lat: meta?.locationLat || null,
          location_lng: meta?.locationLng || null,
          link_url: meta?.linkUrl || null,
          link_title: meta?.linkTitle || null,
          link_description: meta?.linkDescription || null,
          link_image: meta?.linkImage || null,
          link_domain: meta?.linkDomain || null,
          voice_url: meta?.voiceUrl || null,
          voice_duration: meta?.voiceDuration || null,
          room_id: meta?.roomId || null,
        }
      ]);
      if (error) throw error;

      // SP: Oda duvarı postu → gamification servisi ile entegre
      try {
        const { GamificationService } = require('./gamification');
        await GamificationService.grantSP(userId, 5, 'wall_post');
      } catch {}

      return { success: true };
    } catch (e: any) {
      console.error("Error creating post:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Post beğen / beğenmekten vazgeç toggle
   */
  async toggleLike(postId: string, userId: string): Promise<{ success: boolean; liked?: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('toggle_post_like', {
        p_post_id: postId,
        p_user_id: userId
      });
      if (error) throw error;

      // Beğeni bildirimi
      if (data.liked) {
        try {
          const { data: post } = await supabase.from('posts').select('user_id, content').eq('id', postId).single();
          if (post && post.user_id !== userId) {
            const preview = (post.content || '').substring(0, 60);
            const notifPayload: any = {
              user_id: post.user_id,
              sender_id: userId,
              type: 'like',
              reference_id: postId,
            };
            const bodyText = preview ? `gönderini beğendi: "${preview}${post.content.length > 60 ? '...' : ''}"` : 'gönderini beğendi';
            const { error: nErr } = await supabase.from('notifications').insert({ ...notifPayload, body: bodyText });
            if (nErr) {
              await supabase.from('notifications').insert(notifPayload);
            }
          }
        } catch (ne) { if (__DEV__) console.warn('[Like Notif] hata:', ne); }
      }

      return { success: true, liked: data.liked };
    } catch (e: any) {
      console.error("Error toggling like:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Yorum ekle
   */
  async addComment(postId: string, userId: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('post_comments').insert([
        { post_id: postId, user_id: userId, content: filterBadWords(content) }
      ]);
      if (error) throw error;

      const { count } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      
      await supabase
        .from('posts')
        .update({ comments_count: count ?? 0 })
        .eq('id', postId);

      // Yorum bildirimi
      try {
        const { data: post } = await supabase.from('posts').select('user_id, content').eq('id', postId).single();
        if (post && post.user_id !== userId) {
          const commentPreview = content.substring(0, 80);
          const notifPayload: any = {
            user_id: post.user_id,
            sender_id: userId,
            type: 'comment',
            reference_id: postId,
          };
          const { error: nErr } = await supabase.from('notifications').insert({
            ...notifPayload,
            body: `yorum yaptı: "${commentPreview}${content.length > 80 ? '...' : ''}"`,
          });
          if (nErr) {
            await supabase.from('notifications').insert(notifPayload);
          }
        }
      } catch (ne) { if (__DEV__) console.warn('[Comment Notif] hata:', ne); }
      
      return { success: true };
    } catch (e: any) {
      console.error("Error adding comment:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Gönderiyi sil (sadece kendi gönderini)
   */
  async deletePost(postId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Error deleting post:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Oda Duvarı — odaya ait postları çeker
   */
  async getRoomWall(roomId: string, currentUserId: string, limit: number = 20, lastPostTimestamp?: string): Promise<{ feed: Post[]; error?: string }> {
    try {
      let query = supabase
        .from('posts')
        .select(`*, profiles:user_id(username, display_name, avatar_url)`)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (lastPostTimestamp) {
        query = query.lt('created_at', lastPostTimestamp);
      }

      const { data: posts, error } = await query;
      if (error) throw error;

      // Beğeni bilgisi ekle
      if (!posts || posts.length === 0) return { feed: [] };
      const postIds = posts.map((p: any) => p.id);
      let likedPostIds = new Set<string>();

      const { data: likes } = await supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds)
        .eq('user_id', currentUserId);
      
      if (likes) likes.forEach((l: any) => likedPostIds.add(l.post_id));

      const feedWithLikes = posts.map((post: any) => ({
        ...post,
        liked_by_me: likedPostIds.has(post.id)
      }));

      return { feed: feedWithLikes as any };
    } catch (e: any) {
      console.error('Error fetching room wall:', e);
      return { feed: [], error: e.message };
    }
  },
};
