import { supabase } from '../constants/supabase';
import { filterBadWords } from '../constants/badwords';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
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
   * Yeni bir gönderi (post) oluşturur
   */
  async createPost(userId: string, content: string, imageUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('posts').insert([
        { user_id: userId, content: filterBadWords(content), image_url: imageUrl || null }
      ]);
      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Error creating post:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Gönderileri (Feed - Discover) çeker ve kullanıcının beğenip beğenmediğini ekler.
   * lastPostTimestamp: Cursor tabanlı pagination için (created_at). Eğer null ise en yenileri çeker.
   */
  async getDiscoverFeed(currentUserId: string, limit: number = 20, lastPostTimestamp?: string | null): Promise<{ feed: Post[]; error?: string }> {
    try {
      let query = supabase
        .from('posts')
        .select(`*, profiles:user_id(username, display_name, avatar_url)`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (lastPostTimestamp) {
        query = query.lt('created_at', lastPostTimestamp);
      }

      const { data: posts, error } = await query;
      if (error) throw error;

      return await SocialService._attachLikesInfo(posts, currentUserId);
    } catch (e: any) {
      console.error("Error fetching discover feed:", e);
      return { feed: [], error: e.message };
    }
  },

  /**
   * Sadece takip edilen kisilerin gonderilerini (Following Feed) ceker
   */
  async getFollowingFeed(currentUserId: string, limit: number = 20, lastPostTimestamp?: string | null): Promise<{ feed: Post[]; error?: string }> {
    try {
      // Supabase RPC metodu kullanarak Following Feed ceker
      const { data: posts, error } = await supabase.rpc('get_following_feed', {
        p_user_id: currentUserId,
        p_limit: limit,
        p_last_created_at: lastPostTimestamp || null
      });

      if (error) throw error;
      
      // RPC'den donen datada `profiles` eksik olacagi icin, profilleri manual join'leyebiliriz
      // Ancak RPC'yi sadece ID'leri getirmesi icin veya frontend tarafinda ek bir sordu acmak icin kullanabiliriz.
      // Su an en basiti supabase inner join'ini RPC icinde profil verisiyle desteklemektir.
      // Ama eger RPC sadece "posts" table type donuyorsa, profiles objesi yoktur.
      // Cozum: IDsini alip tam postlari profiles ile cekmek:
      
      if (!posts || posts.length === 0) return { feed: [] };
      const postIds = posts.map((p: any) => p.id);

      const { data: fullPosts, error: fullError } = await supabase
        .from('posts')
        .select(`*, profiles:user_id(username, display_name, avatar_url)`)
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (fullError) throw fullError;

      return await SocialService._attachLikesInfo(fullPosts, currentUserId);
    } catch (e: any) {
      console.error("Error fetching following feed:", e);
      return { feed: [], error: e.message };
    }
  },

  /**
   * Helper: Postlara "liked_by_me" bilgisini map'ler
   */
  async _attachLikesInfo(posts: any[], currentUserId: string): Promise<{ feed: Post[] }> {
    if (!posts || posts.length === 0) return { feed: [] };

    const postIds = posts.map((p: any) => p.id);
    let likedPostIds = new Set<string>();

    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', currentUserId);
    
    if (likes) {
      likes.forEach((l: any) => likedPostIds.add(l.post_id));
    }

    const feedWithLikes = posts.map((post: any) => ({
      ...post,
      liked_by_me: likedPostIds.has(post.id)
    }));

    return { feed: feedWithLikes as any };
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
      // 1. Yorum ekle
      const { error } = await supabase.from('post_comments').insert([
        { post_id: postId, user_id: userId, content: filterBadWords(content) }
      ]);
      if (error) throw error;

      // 2. Sayacı güncelle (Basit güncelleniyor, trigger ile de yapılabilir)
      await supabase.rpc('increment_comment_count', { p_post_id: postId }); // Gerekirse RPC yazılacak veya normal update
      
      return { success: true };
    } catch (e: any) {
      console.error("Error adding comment:", e);
      return { success: false, error: e.message };
    }
  }
};
