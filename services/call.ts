/**
 * SopranoChat — DM Arama Servisi
 * Supabase Broadcast ile sinyalizasyon, LiveKit ile gerçek ses/video iletimi
 * Tier bazlı kalite: Silver=ses 24kHz mono, Plus=ses 48kHz+video 720p, VIP=ses 48kHz stereo+video 1080p
 */
import { supabase } from '../constants/supabase';
import { getRoomLimits, type TierName } from './database';

// ─── TYPES ──────────────────────────────────────────────────
export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export type CallSignal = {
  action: 'incoming_call' | 'call_accepted' | 'call_rejected' | 'call_ended' | 'call_busy';
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: CallType;
  tier?: TierName;
};

export type CallQuality = {
  audioSampleRate: number;
  audioChannels: number;
  videoMaxRes: number;
  videoEnabled: boolean;
};

// ─── TIER BAZLI KALİTE ─────────────────────────────────────
export function getCallQuality(tier: TierName, callType: CallType): CallQuality {
  const limits = getRoomLimits(tier);
  return {
    audioSampleRate: limits.audioSampleRate,
    audioChannels: limits.audioChannels,
    videoMaxRes: limits.videoMaxRes,
    videoEnabled: callType === 'video' && tier !== 'Silver', // Silver video yapamaz
  };
}

// ─── ARAMA SERVİSİ ─────────────────────────────────────────
export const CallService = {
  /** Benzersiz call ID oluştur (iki user ID'den) */
  generateCallId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `call_${sorted[0].slice(0, 8)}_${sorted[1].slice(0, 8)}_${Date.now()}`;
  },

  /** Benzersiz LiveKit room ID oluştur */
  generateRoomId(callId: string): string {
    return `dm_${callId}`;
  },

  /** Arama başlat — karşı tarafa sinyal gönder */
  async initiateCall(
    callerId: string,
    callerName: string,
    callerAvatar: string | undefined,
    receiverId: string,
    callType: CallType,
    tier: TierName = 'Silver'
  ): Promise<{ callId: string; channel: ReturnType<typeof supabase.channel> }> {
    // Silver video arama yapamaz
    if (callType === 'video' && tier === 'Silver') {
      throw new Error('Görüntülü arama için Plus veya VIP üyelik gerekiyor.');
    }

    const callId = this.generateCallId(callerId, receiverId);

    // Karşı tarafın dinlediği kanala sinyal gönder
    const channel = supabase.channel(`call_signal_${receiverId}`);
    
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              action: 'incoming_call',
              callId,
              callerId,
              callerName,
              callerAvatar,
              callType,
              tier,
            } as CallSignal,
          });
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    });

    return { callId, channel };
  },

  /** Aramayı kabul et */
  async acceptCall(callerId: string, receiverId: string, callId: string) {
    const channel = supabase.channel(`call_signal_${callerId}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              action: 'call_accepted',
              callId,
              callerId: receiverId,
              callerName: '',
            } as CallSignal,
          });
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    });
  },

  /** Aramayı reddet */
  async rejectCall(callerId: string, receiverId: string, callId: string) {
    const channel = supabase.channel(`call_signal_${callerId}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              action: 'call_rejected',
              callId,
              callerId: receiverId,
              callerName: '',
            } as CallSignal,
          });
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    });
  },

  /** Aramayı bitir */
  async endCall(callerId: string, otherUserId: string, callId: string) {
    const channel = supabase.channel(`call_signal_${otherUserId}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: {
              action: 'call_ended',
              callId,
              callerId,
              callerName: '',
            } as CallSignal,
          });
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    });
  },

  /** Gelen arama sinyallerini dinle */
  onCallSignal(userId: string, callback: (signal: CallSignal) => void) {
    return supabase
      .channel(`call_signal_${userId}`)
      .on('broadcast', { event: 'call_signal' }, (payload) => {
        callback(payload.payload as CallSignal);
      })
      .subscribe();
  },
};
