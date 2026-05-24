/**
 * SopranoChat â Oda KayÄ±t Servisi (Faz 6.2)
 * âââââââââââââââââââââââââââââââââââââââââââââââââââ
 * room_recordings tablosunun read/write katmanÄ±.
 *
 * KVKK NOTU:
 *   Kaydet Ã¶zelliÄi aktif edilince odadaki herkes "ğ´ Recording" badge'i gÃ¶rÃ¼r.
 *   KonuÅmacÄ± consent kontrolÃ¼ UI tarafÄ±nda yapÄ±lÄ±r (host kayÄ±t baÅlatÄ±nca
 *   her konuÅmacÄ±ya consent prompt'u gÃ¶sterilir).
 *
 * EGRESS NOTU:
 *   Bu servis kayÄ±t-meta tablosunu okur/yazar. AsÄ±l LiveKit Egress (kaydÄ±
 *   baÅlat/durdur) Supabase Edge Function aracÄ±lÄ±ÄÄ±yla LiveKit Server SDK
 *   Ã¼zerinden tetiklenir â Åu an stub. LIVEKIT_API_SECRET deploy edildiÄinde
 *   `startEgress` / `stopEgress` Edge Function'larÄ± yazÄ±lmalÄ±.
 *
 * Tablo TTL:
 *   expires_at default 7 gÃ¼n (Free), 30 gÃ¼n (Plus+), 90 gÃ¼n (Pro). Cleanup
 *   cron job v68'deki cleanup_expired_recordings() RPC'sini Ã§aÄÄ±rÄ±r.
 */
import { supabase } from '../constants/supabase';
import { i18n } from './i18n';

export interface RoomRecording {
  id: string;
  room_id: string;
  audio_url: string;
  duration_seconds: number;
  expires_at: string;
  is_public: boolean;
  listen_count: number;
  created_at: string;
}

/** Tier'a gÃ¶re kayÄ±t TTL (gÃ¼n cinsinden). Free TTL kÄ±sa, Pro uzun. */
export const RECORDING_TTL_DAYS: Record<string, number> = {
  Free: 7,
  Plus: 30,
  Pro: 90,
  // â v1.7.13.132: GodMaster kaldÄ±rÄ±ldÄ±
};

export const RecordingService = {
  /** Belirli bir odanÄ±n kayÄ±tlarÄ± (en yeni â eski). */
  async listForRoom(roomId: string, limit = 20): Promise<RoomRecording[]> {
    if (!roomId) return [];
    const { data, error } = await supabase
      .from('room_recordings')
      .select('*')
      .eq('room_id', roomId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) {
      if (__DEV__) console.warn('[RecordingService] listForRoom:', error.message);
      return [];
    }
    return (data as RoomRecording[]) || [];
  },

  /** Bir host'un tÃ¼m odalarÄ±na ait public kayÄ±tlar. */
  async listForHost(hostId: string, limit = 20): Promise<(RoomRecording & { room_name?: string })[]> {
    if (!hostId) return [];
    const { data, error } = await supabase
      .from('room_recordings')
      .select(`
        *,
        rooms!inner(name, host_id)
      `)
      .eq('rooms.host_id', hostId)
      .eq('is_public', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));
    if (error) {
      if (__DEV__) console.warn('[RecordingService] listForHost:', error.message);
      return [];
    }
    return ((data as any[]) || []).map(r => ({
      ...r,
      room_name: r.rooms?.name,
    }));
  },

  /** Tek kayÄ±t detayÄ±. */
  async getRecording(id: string): Promise<RoomRecording | null> {
    if (!id) return null;
    const { data } = await supabase
      .from('room_recordings').select('*').eq('id', id).maybeSingle();
    return (data as RoomRecording) || null;
  },

  /** Atomik dinleme sayacÄ± (RPC). */
  async incrementListen(id: string): Promise<number> {
    if (!id) return 0;
    try {
      const { data } = await supabase.rpc('increment_recording_listen', { p_recording_id: id });
      return Number(data) || 0;
    } catch { return 0; }
  },

  /**
   * KayÄ±t meta yarat â Egress callback / Edge Function'dan Ã§aÄrÄ±lÄ±r.
   * Direct write yalnÄ±zca host yapabilir (RLS room_rec_host_write).
   */
  async create(input: {
    roomId: string;
    audioUrl: string;
    durationSeconds: number;
    isPublic?: boolean;
    ttlDays?: number;
  }): Promise<{ recording?: RoomRecording; error?: string }> {
    // â v1.7.13.135: Tier-bound TTL â input.ttlDays geÃ§irilmediyse host tier'Ä±ndan oku
    //   (Free 7gÃ¼n, Plus 30gÃ¼n, Pro 90gÃ¼n). Ãnceden sabit 7 idi â Pro vaadi (90gÃ¼n) verilmiyordu.
    let ttl = input.ttlDays;
    if (!ttl) {
      try {
        const { data: room } = await supabase.from('rooms').select('host_id, owner_tier').eq('id', input.roomId).maybeSingle();
        let tier = (room as any)?.owner_tier as string | undefined;
        if (!tier && room?.host_id) {
          const { data: prof } = await supabase.from('profiles').select('is_admin, subscription_tier, subscription_expires_at').eq('id', room.host_id).maybeSingle();
          const adminPro = prof?.is_admin ? 'Pro' : null;
          const expired = (prof as any)?.subscription_expires_at && new Date((prof as any).subscription_expires_at) <= new Date();
          tier = adminPro || (expired ? 'Free' : (prof?.subscription_tier as string) || 'Free');
        }
        ttl = RECORDING_TTL_DAYS[tier === 'GodMaster' ? 'Pro' : (tier || 'Free')] || 7;
      } catch { ttl = 7; }
    }
    const expiresAt = new Date(Date.now() + ttl * 86400_000).toISOString();
    const { data, error } = await supabase
      .from('room_recordings')
      .insert({
        room_id: input.roomId,
        audio_url: input.audioUrl,
        duration_seconds: input.durationSeconds,
        expires_at: expiresAt,
        is_public: input.isPublic !== false,
      })
      .select('*')
      .single();
    if (error) return { error: error.message };
    return { recording: data as RoomRecording };
  },

  /** GÃ¶rÃ¼nÃ¼rlÃ¼k deÄiÅtir (host-only via RLS). */
  async setPublic(id: string, isPublic: boolean): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('room_recordings')
      .update({ is_public: isPublic })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /** KayÄ±t sil â host-only via RLS.
   *  â v319.12 (18 May 2026): KVKK uyumluluk â manuel silmede de log yaz.
   *  Eskiden sadece otomatik expires_at cron'u recording_deletion_log'a yazÄ±yordu;
   *  kullanÄ±cÄ± UI'dan sildiÄinde log oluÅmuyordu (6698 KVKK madde 7 ihtarÄ±).
   *  Åimdi DELETE Ã¶ncesi log INSERT (storage_cleaned=false, cron sonra true yapacak).
   */
  async deleteRecording(id: string): Promise<{ success: boolean; error?: string }> {
    // 1) Ãnce kaydÄ± oku â log'a host_id + room_id iÃ§in gerekli
    let recordingRoomId: string | null = null;
    let recordingHostId: string | null = null;
    try {
      const { data: rec } = await supabase
        .from('room_recordings')
        .select('room_id, host_id')
        .eq('id', id)
        .maybeSingle();
      if (rec) {
        recordingRoomId = (rec as any).room_id ?? null;
        recordingHostId = (rec as any).host_id ?? null;
      }
    } catch { /* sessiz */ }

    // 2) Silme
    const { error } = await supabase.from('room_recordings').delete().eq('id', id);
    if (error) return { success: false, error: error.message };

    // 3) KVKK log (silme baÅarÄ±lÄ± olduktan sonra)
    try {
      await supabase.from('recording_deletion_log').insert({
        recording_id: id,
        room_id: recordingRoomId,
        host_id: recordingHostId,
        deleted_at: new Date().toISOString(),
        storage_cleaned: false, // cleanup_recording_storage cron sonra true yapar
      });
    } catch { /* log fail-safe â silme zaten oldu */ }

    return { success: true };
  },

  // ââ EGRESS TETÄ°KLEME (deferred) ââââââââââââââââââââââââââââââ
  // AÅaÄÄ±daki iki metod LiveKit Egress'i Supabase Edge Function Ã¼zerinden
  // tetikler. Edge Function `start-room-egress` / `stop-room-egress`
  // deploy edilince stub'lar gerÃ§ek implementasyona geÃ§ecek.

  /**
   * Oda kaydÄ±nÄ± baÅlat â Edge Function `room-egress` Ã¼zerinden.
   * Caller host_id olmalÄ±. Server-side RPC, LIVEKIT_API_SECRET edge'de.
   */
  async startEgress(roomId: string, hostId: string): Promise<{ success: boolean; egressId?: string; error?: string }> {
    if (!roomId || !hostId) return { success: false, error: i18n.t('auto.recordings.002') };
    try {
      const { data, error } = await supabase.functions.invoke('room-egress', {
        body: { action: 'start', room_id: roomId, host_id: hostId },
      });
      if (error) return { success: false, error: error.message };
      const r = data as any;
      if (r?.error) return { success: false, error: r.error };
      return { success: true, egressId: r?.egress_id };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },

  /**
   * Oda kaydÄ±nÄ± durdur. Egress webhook (livekit-webhook) tamamlandÄ±ÄÄ±nda
   * room_recordings tablosuna otomatik INSERT eder.
   */
  async stopEgress(roomId: string, hostId: string, egressId: string): Promise<{ success: boolean; error?: string }> {
    if (!roomId || !hostId || !egressId) return { success: false, error: i18n.t('auto.recordings.001') };
    try {
      const { data, error } = await supabase.functions.invoke('room-egress', {
        body: { action: 'stop', room_id: roomId, host_id: hostId, egress_id: egressId },
      });
      if (error) return { success: false, error: error.message };
      const r = data as any;
      if (r?.error) return { success: false, error: r.error };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message };
    }
  },
};
