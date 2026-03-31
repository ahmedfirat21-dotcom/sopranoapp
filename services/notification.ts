import { supabase } from '../constants/supabase';

export interface Notification {
  id: string;
  user_id: string;
  sender_id: string;
  type: 'like' | 'comment' | 'gift' | 'follow';
  reference_id: string;
  is_read: boolean;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
  } | null;
}

export const NotificationService = {
  /**
   * Bildirimleri çek
   */
  async getMyNotifications(userId: string, limit: number = 20): Promise<{ data: Notification[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles!notifications_sender_id_fkey ( username, display_name, avatar_url )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data: data as any };
    } catch (e: any) {
      console.error("Error fetching notifications:", e);
      return { data: [], error: e.message };
    }
  },

  /**
   * Okunmamış bildirim sayısını al (Badge için)
   */
  async getUnreadCount(userId: string): Promise<{ count: number; error?: string }> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return { count: count || 0 };
    } catch (e: any) {
      console.error("Error getting unread count:", e);
      return { count: 0, error: e.message };
    }
  },

  /**
   * Bildirimi okundu yap
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Error marking notification as read:", e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Tüm bildirimleri okundu yap
   */
  async markAllAsRead(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error("Error marking all as read:", e);
      return { success: false, error: e.message };
    }
  }
};
