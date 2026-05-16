/**
 * SopranoChat — Voice Reaction Servisi (Faz 3.2)
 * ═══════════════════════════════════════════════════
 * Oda içi anlık reaksiyon broadcasti. LiveKit data channel kullanır
 * — mevcut audio bağlantısına dokunmaz.
 *
 * Akış:
 *   1. Kullanıcı reaction strip'te bir butona basar
 *   2. VoiceReactionService.send() → LiveKitService.publishData()
 *   3. Tüm odadakilerin LiveKitService.setOnDataReceived callback'i tetiklenir
 *   4. UI floating emoji animation oynatır
 *
 * Audio playback: ses dosyaları henüz yok (royalty-free assets bekleniyor).
 * Yapı hazır — `assets/sounds/reactions/{id}.mp3` yolları doldurulduğunda
 * playSound() fonksiyonu Audio.Sound.createAsync ile çalacak.
 *
 * Rate limit: client-side debounce 500ms (spam engeli). Server-side
 * abuse-prevention için ayrı RPC ileride eklenebilir.
 */
import { liveKitService } from './livekit';
import { i18n } from '../../services/i18n';

export interface VoiceReactionDef {
  id: string;
  emoji: string;
  label: string;
  color: string;
  /** Opsiyonel — assets/sounds/reactions/{file} hazır olduğunda. */
  soundFile?: string;
}

export const VOICE_REACTIONS: VoiceReactionDef[] = [
  { id: 'clap',      emoji: '👏', label: i18n.t('auto.voiceReactions.002'),     color: '#F59E0B', soundFile: 'clap' },
  { id: 'fire',      emoji: '🔥', label: i18n.t('auto.voiceReactions.001'),    color: '#EF4444', soundFile: 'fire' },
  { id: 'heart',     emoji: '❤️', label: 'Kalp',      color: '#EC4899', soundFile: 'heart' },
  { id: 'laugh',     emoji: '😂', label: 'Kahkaha',   color: '#FBBF24', soundFile: 'laugh' },
  { id: 'wow',       emoji: '😮', label: 'Wow',       color: '#A855F7', soundFile: 'wow' },
  { id: 'party',     emoji: '🎉', label: 'Kutlama',   color: '#14B8A6', soundFile: 'party' },
  { id: 'drum',      emoji: '🥁', label: 'Davul',     color: '#8B5CF6', soundFile: 'drum' },
  { id: 'bell',      emoji: '🔔', label: 'Zil',       color: '#3B82F6', soundFile: 'bell' },
];

export interface VoiceReactionPayload {
  type: 'voice_reaction';
  reactionId: string;
  senderId: string;
  senderName?: string;
  ts: number;
}

const SEND_DEBOUNCE_MS = 500;
let _lastSentAt = 0;

// ★ Metro bundler static require mapping — dynamic require çalışmaz
const SOUND_MAP: Record<string, any> = {
  clap:  require('../assets/sounds/reactions/clap.mp3'),
  fire:  require('../assets/sounds/reactions/fire.mp3'),
  heart: require('../assets/sounds/reactions/heart.mp3'),
  laugh: require('../assets/sounds/reactions/laugh.mp3'),
  wow:   require('../assets/sounds/reactions/wow.mp3'),
  party: require('../assets/sounds/reactions/party.mp3'),
  drum:  require('../assets/sounds/reactions/drum.mp3'),
  bell:  require('../assets/sounds/reactions/bell.mp3'),
};

export const VoiceReactionService = {
  /** Reaksiyon broadcast et. Throttle: 500ms/per user. */
  send(reactionId: string, senderId: string, senderName?: string): boolean {
    const now = Date.now();
    if (now - _lastSentAt < SEND_DEBOUNCE_MS) return false;
    _lastSentAt = now;

    const payload: VoiceReactionPayload = {
      type: 'voice_reaction',
      reactionId,
      senderId,
      senderName,
      ts: now,
    };
    liveKitService.publishData(payload).catch(() => { /* silent */ });
    return true;
  },

  /**
   * Gelen payload bir voice reaction mı? Type guard.
   * UI tarafında DataReceived callback'i bunu kullanır.
   */
  isVoiceReaction(payload: any): payload is VoiceReactionPayload {
    return !!payload && payload.type === 'voice_reaction'
      && typeof payload.reactionId === 'string'
      && typeof payload.senderId === 'string';
  },

  /** Reaction id'den katalog tanımı. Bilinmeyen → null. */
  getDef(id: string): VoiceReactionDef | null {
    return VOICE_REACTIONS.find(r => r.id === id) || null;
  },

  /**
   * Audio playback — expo-av ile reaction sesini çal.
   * ★ 2026-04-25: Placeholder MP3'ler eklendi, gerçek royalty-free seslerle değiştirilecek.
   */
  async playSound(reactionId: string): Promise<void> {
    try {
      const source = SOUND_MAP[reactionId];
      if (!source) return;
      const { Audio } = require('expo-av');
      const { sound } = await Audio.Sound.createAsync(source, { shouldPlay: true, volume: 0.6 });
      // Ses bitince otomatik unload — memory leak önle
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      if (__DEV__) console.warn('[VoiceReaction] playSound error:', e);
    }
  },
};

