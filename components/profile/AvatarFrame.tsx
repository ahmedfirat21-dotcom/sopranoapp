/**
 * SopranoChat — Avatar Çerçevesi
 * ═══════════════════════════════════════════════════════════════════
 * v107 (4 May 2026) — Mağazadan satın alınmış atelier ürününü
 * (Phoenix Diadem, Galactique, Aurum Strike, Glacier, Vesuvius) avatar
 * etrafında çerçeve olarak render eder.
 *
 * Kullanım: avatar Image'in çevresine bu component'i sar.
 *   <View style={{ position: 'relative' }}>
 *     <Image style={{ width: 96, height: 96, borderRadius: 48 }} ... />
 *     <AvatarFrame frameId={profile.active_frame} size={96} />
 *   </View>
 *
 * Frame ürün id'sine göre tematik renk + çift halka (dış glow + iç parlak çizgi).
 * Item3DArt yerine native View kullanır (performans için, WebView her avatara çok ağır).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFrameMeta, hasFrameLottie } from '../../constants/frameLottieRegistry';
import { getCosmeticAsset, getCachedCosmeticAsset, type AssetMeta } from '../../services/cosmeticAssetCache';

let LottieView: any = null;
try {
  LottieView = require('lottie-react-native').default;
} catch { /* fallback to gradient ring */ }

interface FramePalette {
  outer: string[];   // dış halka gradient (3 stop)
  inner: string;     // iç çizgi rengi
  glowIos: string;   // iOS için shadow rengi
}

const FRAME_PALETTES: Record<string, FramePalette> = {
  // ★ v107 — Eski 5 frame; v108.2'de category='gift'a alındı, görsel destek
  //   sürdürülüyor (mevcut equipped kullanıcılar için). Yeni equip akışı yok.
  'phoenix-diadem': {
    outer: ['#FFE082', '#F472B6', '#831843'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.7)',
  },
  galactique: {
    outer: ['#A78BFA', '#7C3AED', '#1E1B4B'],
    inner: '#DDD6FE',
    glowIos: 'rgba(167,139,250,0.7)',
  },
  'aurum-strike': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'glacier-aura': {
    outer: ['#A5F3FC', '#22D3EE', '#0E7490'],
    inner: '#F0F9FF',
    glowIos: 'rgba(34,211,238,0.7)',
  },
  vesuvius: {
    outer: ['#FED7AA', '#FB923C', '#7F1D1D'],
    inner: '#FEF3C7',
    glowIos: 'rgba(251,146,60,0.75)',
  },
  // ★ v108.2 — Yeni halka çerçeveler. Eski 5'in tema renklerinin sade halka versiyonları;
  //   uygun fiyatlı, mağazadaki çerçeveler bölümünde görünür.
  'phoenix-ring': {
    outer: ['#FFE082', '#F472B6', '#831843'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.7)',
  },
  'galactique-ring': {
    outer: ['#A78BFA', '#7C3AED', '#1E1B4B'],
    inner: '#DDD6FE',
    glowIos: 'rgba(167,139,250,0.7)',
  },
  'aurum-ring': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'glacier-ring': {
    outer: ['#A5F3FC', '#22D3EE', '#0E7490'],
    inner: '#F0F9FF',
    glowIos: 'rgba(34,211,238,0.7)',
  },
  'vesuvius-ring': {
    outer: ['#FED7AA', '#FB923C', '#7F1D1D'],
    inner: '#FEF3C7',
    glowIos: 'rgba(251,146,60,0.75)',
  },
  // ★ v108.13 — Yeni Lottie frame'lere de palette eklendi (küçük avatarlarda
  //   Lottie yerine sade halka olarak gösterilir, görsel temizliği için).
  'aurelius': {
    outer: ['#FFE082', '#FBBF24', '#854F0B'],
    inner: '#FFF4D6',
    glowIos: 'rgba(255,224,130,0.85)',
  },
  'lunaris': {
    outer: ['#E2E8F0', '#94A3B8', '#475569'],
    inner: '#F1F5F9',
    glowIos: 'rgba(226,232,240,0.7)',
  },
  'rose-eternel': {
    outer: ['#F9A8D4', '#F472B6', '#831843'],
    inner: '#FCE7F3',
    glowIos: 'rgba(244,114,182,0.7)',
  },
  'cadence-soprano': {
    outer: ['#C4B5FD', '#A78BFA', '#5B21B6'],
    inner: '#DDD6FE',
    glowIos: 'rgba(196,181,253,0.7)',
  },
  // ★ v108.31: SopranoChat teal aurora çerçeve — marka renk paleti
  'soprano-aura': {
    outer: ['#A5F3FC', '#4CE0E2', '#1E848E'],
    inner: '#E0FFFE',
    glowIos: 'rgba(76,224,226,0.75)',
  },
};

// ★ v108.13: Avatar bu boyutun altındaysa Lottie göster yerine sade halka palette
//   render edilir — küçük avatarlarda VIP frame Lottie'leri çok kalın görünüyordu.
const LOTTIE_MIN_AVATAR_SIZE = 64;

// ★ v108.16: Lottie frame — sadece kanatlı (useMidLoop) frame'ler için intro+mid-loop
//   pattern; diğer frame'ler default full loop. Kanat açılma sallanma efekti elde edilir.
function LottieFrame({ meta, size }: { meta: any; size: number }) {
  const lottieSize = Math.round(size * meta.scale);
  const offset = (lottieSize - size) / -2;
  const ip = meta.source?.ip ?? 0;
  const op = meta.source?.op ?? 90;
  const totalFrames = op - ip;
  const loopStart = Math.floor(ip + totalFrames * 0.58);
  const useMidLoop = !!meta.useMidLoop;

  const [phase, setPhase] = useState<'intro' | 'loop'>(useMidLoop ? 'intro' : 'loop');
  const loopSource = useMemo(
    () => ({ ...meta.source, ip: loopStart, op: Math.max(loopStart + 2, op - 2) }),
    [meta.source, loopStart, op]
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: offset, left: offset,
        width: lottieSize, height: lottieSize,
        alignItems: 'center', justifyContent: 'center',
        // ★ v110.9 (7 May 2026): zIndex -1→3 + elevation 0→3 — kullanıcı raporu:
        //   "çerçeveler avatarın ARKASINDA kalıyor, üstte POP olmalı". Eski yorumdaki
        //   "Image elevation 12" varsayımı doğru değil (gerçek Image elevation 0); Lottie
        //   frame Image üstüne render olunca kanat/halka tam görünür. Tier badge zIndex 5
        //   ile hâlâ frame üstünde kalır.
        zIndex: 3,
        elevation: 3,
      }}
    >
      <LottieView
        source={useMidLoop && phase === 'intro' ? meta.source : (useMidLoop ? loopSource : meta.source)}
        autoPlay
        loop={!useMidLoop || phase === 'loop'}
        speed={0.85}
        resizeMode={meta.resizeMode}
        onAnimationFinish={() => {
          if (useMidLoop && phase === 'intro') setPhase('loop');
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

interface Props {
  /** profiles.active_frame değeri — null/undefined ise hiçbir şey render etmez */
  frameId?: string | null;
  /** Avatar boyutu (px) — frame buna göre genişler */
  size: number;
  /** ★ v110.14: true ise Lottie dalı atlanır, sadece sade palette halka render edilir.
   *  Sahnedeki host olmayan kullanıcılarda (avatar dengesizliği için) kullanılır;
   *  herkes Plus halka boyutunda görünür, sadece host kanatlı Lottie alır. */
  forceRing?: boolean;
}

// ★ v110.7 (6 May 2026): Web admin panelinden eklenen Lottie/PNG URL'lerinden runtime
//   render. Registry/palette'de bulunmayan ürünler için cosmetic_items.meta'dan asset_url
//   çekilir, Lottie'ye {uri} ile veya Image'e source ile bağlanır.
function RemoteAssetFrame({ frameId, size }: { frameId: string; size: number }) {
  // Senkron cache hit — flicker önler
  const initial = getCachedCosmeticAsset(frameId);
  const [asset, setAsset] = useState<AssetMeta | null>(initial);

  useEffect(() => {
    let cancelled = false;
    if (initial) return; // zaten cache'de var
    getCosmeticAsset(frameId).then(m => {
      if (!cancelled) setAsset(m);
    });
    return () => { cancelled = true; };
  }, [frameId, initial]);

  if (!asset || !asset.url) return null;

  if (asset.type === 'lottie' && LottieView) {
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -(size * 0.4), left: -(size * 0.4),
          width: size * 1.8, height: size * 1.8,
          alignItems: 'center', justifyContent: 'center',
          zIndex: 3,
          elevation: 3,
        }}
      >
        <LottieView
          source={{ uri: asset.url }}
          autoPlay
          loop
          speed={0.85}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  // Image (PNG/SVG/WebP)
  if (asset.type === 'image') {
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -(size * 0.2), left: -(size * 0.2),
          width: size * 1.4, height: size * 1.4,
          zIndex: 3,
          elevation: 3,
        }}
      >
        <Image
          source={{ uri: asset.url }}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  return null;
}

function AvatarFrameImpl({ frameId, size, forceRing }: Props) {
  if (!frameId) return null;

  // ★ v108.13: Boyuta göre render — büyük avatarlarda Lottie, küçüklerde sade halka.
  // ★ v110.14: forceRing=true ise Lottie atlanır (sahnede host hariç herkes için
  //   sade halka — boyut dengesi için kullanıcı talebi).
  const meta = getFrameMeta(frameId);
  if (meta && LottieView && size >= LOTTIE_MIN_AVATAR_SIZE && !forceRing) {
    return <LottieFrame meta={meta} size={size} />;
  }

  const palette = FRAME_PALETTES[frameId];
  if (!palette) {
    // ★ v110.7: Registry/palette'de yok — web'den eklenmiş yeni Lottie/PNG ürünü olabilir.
    //   cosmetic_items.meta'dan asset URL çek, runtime render et.
    if (size >= LOTTIE_MIN_AVATAR_SIZE) {
      return <RemoteAssetFrame frameId={frameId} size={size} />;
    }
    return null;
  }

  // ★ v109.3: Halka SABİT BOYUT ile konumlandı — absoluteFillObject parent
  //   boyutuna bağlıydı, parent avatardan uzun olunca halka aşağı kayıyordu.
  //   Yeni: top:0/left:0 + size (avatar boyutunda) → halka tam avatar üstüne biner.
  // ★ v110.14: %9 fazla kalın geldi (kullanıcı feedback) → %7. Ortalama bir değer:
  //   eskiden %6 ince kalıyordu, %9 fazla kalın oldu, %7 dengeli.
  const thickness = Math.max(2, Math.round(size * 0.07));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: size, height: size,
        // ★ v110.9 (7 May 2026): elevation 0→3 — Android'de palette halka Image
        //   üstünde POP olsun. Tier badge zIndex 5 hâlâ üstte.
        zIndex: 3,
        elevation: 3,
      }}
    >
      {/* Dış halka — avatar boyutunda, border içeride */}
      <View
        style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: palette.outer[1] || palette.outer[0],
          ...Platform.select({
            ios: {
              shadowColor: palette.glowIos,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5, shadowRadius: 4,
            },
            android: {},
          }),
        }}
      />
      {/* İç parlaklık çizgisi — avatarın iç kenarında */}
      <View
        style={{
          position: 'absolute',
          top: thickness, left: thickness,
          width: size - thickness * 2, height: size - thickness * 2,
          borderRadius: (size - thickness * 2) / 2,
          borderWidth: 0.8, borderColor: palette.inner,
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
}

// ★ v108.16: React.memo — frameId/size değişmedikçe re-render etme (ağır Lottie load yok).
const AvatarFrame = React.memo(AvatarFrameImpl, (a, b) => a.frameId === b.frameId && a.size === b.size && a.forceRing === b.forceRing);
export default AvatarFrame;
