/**
 * SopranoChat — Müzik DJ Modu Servisi
 * Oda içinde şarkı kuyruğu yönetimi
 */
import { supabase } from '../constants/supabase';

export type QueuedTrack = {
  id: string;
  room_id: string;
  added_by: string;
  track_url: string;
  track_title: string;
  track_artist: string;
  duration_seconds: number;
  position: number;
  is_playing: boolean;
  created_at: string;
};

export const MusicService = {
  /** Müzik kuyruğunu getir */
  async getQueue(roomId: string): Promise<QueuedTrack[]> {
    const { data, error } = await supabase
      .from('room_music_queue')
      .select('*')
      .eq('room_id', roomId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data || []) as QueuedTrack[];
  },

  /** Kuyruğa şarkı ekle */
  async addToQueue(roomId: string, userId: string, track: {
    track_url: string;
    track_title: string;
    track_artist?: string;
    duration_seconds?: number;
  }): Promise<QueuedTrack> {
    // Son pozisyonu bul
    const { data: lastTrack } = await supabase
      .from('room_music_queue')
      .select('position')
      .eq('room_id', roomId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (lastTrack?.position ?? -1) + 1;

    const { data, error } = await supabase
      .from('room_music_queue')
      .insert({
        room_id: roomId,
        added_by: userId,
        track_url: track.track_url,
        track_title: track.track_title,
        track_artist: track.track_artist || '',
        duration_seconds: track.duration_seconds || 0,
        position: nextPosition,
      })
      .select()
      .single();
    if (error) throw error;
    return data as QueuedTrack;
  },

  /** Çalmakta olan parçayı ayarla */
  async setNowPlaying(roomId: string, trackId: string): Promise<void> {
    // Önce hepsini is_playing=false yap
    await supabase
      .from('room_music_queue')
      .update({ is_playing: false })
      .eq('room_id', roomId);

    // Seçileni is_playing=true yap
    await supabase
      .from('room_music_queue')
      .update({ is_playing: true })
      .eq('id', trackId);
  },

  /** Kuyruktan şarkı sil */
  async removeFromQueue(trackId: string): Promise<void> {
    const { error } = await supabase
      .from('room_music_queue')
      .delete()
      .eq('id', trackId);
    if (error) throw error;
  },

  /** Tüm kuyruğu temizle */
  async clearQueue(roomId: string): Promise<void> {
    const { error } = await supabase
      .from('room_music_queue')
      .delete()
      .eq('room_id', roomId);
    if (error) throw error;
  },

  /** Realtime kuyruk dinleyicisi */
  onQueueChange(roomId: string, callback: (queue: QueuedTrack[]) => void) {
    return supabase
      .channel(`music_queue:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_music_queue',
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const queue = await MusicService.getQueue(roomId);
          callback(queue);
        }
      )
      .subscribe();
  },
};
