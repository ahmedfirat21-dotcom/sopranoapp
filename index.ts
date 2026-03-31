// LiveKit WebRTC registerGlobals artık livekit.ts servisinde lazy olarak çağrılıyor.
// Çift kayıt WebRTC çakışmalarına neden oluyordu (BUG-4).

import 'expo-router/entry';
