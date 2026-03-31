// LiveKit bağlantı sabitleri
// NOT: API Key/Secret burada OLMAYACAK — token üretimi Edge Function'da yapılır

export const LIVEKIT_URL = 'wss://video.sopranochat.com';

// Supabase Edge Function endpoint (token üretimi)
export const LIVEKIT_TOKEN_ENDPOINT =
  'https://kpofiuczyjesjlqjxswh.supabase.co/functions/v1/livekit-token';
