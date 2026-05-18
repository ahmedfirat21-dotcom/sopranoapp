/**
 * SopranoChat — Oda Kayıt Servisi (Faz 6.2)
 * ═══════════════════════════════════════════════════
 * room_recordings tablosunun read/write katmanı.
 *
 * KVKK NOTU:
 *   Kaydet özelliği aktif edilince odadaki herkes "🔴 Recording" badge'i görür.
 *   Konuşmacı consent kontrolü UI tarafında yapılır (host kayıt başlatınca
 *   her konuşmacıya consent prompt'u gösterilir).
 *
 * EGRESS NOTU:
 *   Bu servis kayıt-meta tablosunu okur/yazar. Asıl LiveKit Egress (kaydı
 *   başlat/durdur) Supabase Edge Function aracılığıyla LiveKit Server SDK
 *   üzerinden tetiklenir — şu an stub. LIVEKIT_API_SECRET deploy edildiğinde
 *   `startEgress` / `stopEgress` Edge Function'ları yazılmalı.
 *
 * Tablo TTL:
 *   expires_at default 7 gün (Free), 30 gün (Plus+), 90 gün (Pro). Cleanup
 *   cron job v68'deki cleanup_expired_recordings() RPC'sini çağırır.
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

/** Tier'a göre kayıt TTL (gün cinsinden). Free TTL kısa, Pro uzun. */
export const RECORDING_TTL_DAYS: Record<string, number> = {
  Free: 7,
  Plus: 30,
  Pro: 90,
  GodMaster: 365,
};

export const RecordingService = {
  /** Belirli bir odanın kayıtları (en yeni → eski). */
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

  /** Bir host'un tüm odalarına ait public kayıtlar. */
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

  /** Tek kayıt detayı. */
  async getRecording(id: string): Promise<RoomRecording | null> {
    if (!id) return null;
    const { data } = await supabase
      .from('room_recordings').select('*').eq('id', id).maybeSingle();
    return (data as RoomRecording) || null;
  },

  /** Atomik dinleme sayacı (RPC). */
  async incrementListen(id: string): Promise<number> {
    if (!id) return 0;
    try {
      const { data } = await supabase.rpc('increment_recording_listen', { p_recording_id: id });
      return Number(data) || 0;
    } catch { return 0; }
  },

  /**
   * Kayıt meta yarat — Egress callback / Edge Function'dan çağrılır.
   * Direct write yalnızca host yapabilir (RLS room_rec_host_write).
   */
  async create(input: {
    roomId: string;
    audioUrl: string;
    durationSeconds: number;
    isPublic?: boolean;
    ttlDays?: number;
  }): Promise<{ recording?: RoomRecording; error?: string }> {
    const ttl = input.ttlDays || 7;
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

  /** Görünürlük değiştir (host-only via RLS). */
  async setPublic(id: string, isPublic: boolean): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('room_recordings')
      .update({ is_public: isPublic })
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /** Kayıt sil — host-only via RLS.
   *  ★ v319.12 (18 May 2026): KVKK uyumluluk — manuel silmede de log yaz.
   *  Eskiden sadece otomatik expires_at cron'u recording_deletion_log'a yazıyordu;
   *  kullanıcı UI'dan sildiğinde log oluşmuyordu (6698 KVKK madde 7 ihtarı).
   *  Şimdi DELETE öncesi log INSERT (storage_cleaned=false, cron sonra true yapacak).
   */
  async deleteRecording(id: string): Promise<{ success: boolean; error?: string }> {
    // 1) Önce kaydı oku — log'a host_id + room_id için gerekli
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

    // 3) KVKK log (silme başarılı olduktan sonra)
    try {
      await supabase.from('recording_deletion_log').insert({
        recording_id: id,
        room_id: recordingRoomId,
        host_id: recordingHostId,
        deleted_at: new Date().toISOString(),
        storage_cleaned: false, // cleanup_recording_storage cron sonra true yapar
      });
    } catch { /* log fail-safe — silme zaten oldu */ }

    return { success: true };
  },

  // ── EGRESS TETİKLEME (deferred) ──────────────────────────────
  // Aşağıdaki iki metod LiveKit Egress'i Supabase Edge Function üzerinden
  // tetikler. Edge Function `start-room-egress` / `stop-room-egress`
  // deploy edilince stub'lar gerçek implementasyona geçecek.

  /**
   * Oda kaydını başlat — Edge Function `room-egress` üzerinden.
   * Caller host_id olmalı. Server-side RPC, LIVEKIT_API_SECRET edge'de.
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
   * Oda kaydını durdur. Egress webhook (livekit-webhook) tamamlandığında
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
