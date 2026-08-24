// LiveKit bağlantı sabitleri
// NOT: API Key/Secret burada OLMAYACAK — token üretimi Edge Function'da yapılır

// GoDaddy DNS'teki eski video.sopranochat.com kaydına bağlı kalmamak için
// yeni sürümler doğrudan LiveKit Cloud projesine bağlanır.
export const LIVEKIT_URL = 'wss://sopranochat-98mbbgjv.livekit.cloud';

// Supabase Edge Function endpoint (token üretimi)
export const LIVEKIT_TOKEN_ENDPOINT =
  'https://kpofiuczyjesjlqjxswh.supabase.co/functions/v1/livekit-token';
