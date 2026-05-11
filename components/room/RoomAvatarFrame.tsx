/**
 * SopranoChat — RoomAvatarFrame (sahne/dinleyici grid avatarları için)
 * ═══════════════════════════════════════════════════════════════════
 * v108.13 (4 May 2026) — Tek registry'e (frameLottieRegistry + AvatarFrame)
 * yönlendirildi. Önceden ikili sistem vardı (eski frames.ts + yeni STORE_FRAME_IDS),
 * artık AvatarFrame her şeyi yönetiyor.
 *
 * minSize altında render etmez (32-40px gibi ufak grid hücrelerde görsel kirlilik).
 */
import React from 'react';
import AvatarFrame from '../profile/AvatarFrame';
import type { SizeKey } from '../../services/cosmeticConfigCache';

interface Props {
  frameId?: string | null;
  /** Avatar dairesinin px boyutu — frame ona göre ölçeklenir */
  avatarSize: number;
  /** Bu boyutun altında çerçeve render edilmez (default 44) */
  minSize?: number;
  /** ★ v110.14: true ise Lottie dalı atlanır, sade halka render edilir.
   *  Host olmayan sahnedeki kullanıcılarda dengesizliği gidermek için. */
  forceRing?: boolean;
  /** ★ 2026-05-11: Web admin name overlay için kullanıcı adı pas-through. */
  userName?: string;
  /** ★ 2026-05-11: Web admin tier badge için tier label pas-through. */
  userTier?: string;
  /** ★ v1.3.55: size_overrides anahtarı override'ı — host avatar fiziksel boyutu
   *  speaker key'ine düşse bile "stage_host" override'ı uygulansın diye parent
   *  ekran (SpeakerSection) "ben host'um" diye explicit söyleyebilir. */
  contextKey?: SizeKey;
}

export default function RoomAvatarFrame({ frameId, avatarSize, minSize = 30, forceRing, userName, userTier, contextKey }: Props) {
  if (!frameId) return null;
  if (avatarSize < minSize) return null;
  return <AvatarFrame frameId={frameId} size={avatarSize} forceRing={forceRing} userName={userName} userTier={userTier} contextKey={contextKey} />;
}
