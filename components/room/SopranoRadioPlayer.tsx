/**
 * SopranoChat — Soprano Lobi Radyo Player (header altı pill)
 * ═══════════════════════════════════════════════════
 * Pure UI component. State'i useRadioPlayer hook'u parent'ta (room/[id].tsx) tutar
 * ve buraya `player` prop'u olarak geçer. Kanal seçici sheet de parent'ta top-level
 * render edilir — burada sadece "aç" callback'i tetiklenir.
 *
 * Sebep: Sheet'i bu component içinde render edersek header parent konteksti içinde
 * absoluteFill olur → modal yukarı zıplar. Top-level render zorunlu.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { i18n } from '../../services/i18n';
import type { useRadioPlayer } from '../../hooks/useRadioPlayer';

interface Props {
  player: ReturnType<typeof useRadioPlayer>;
  onOpenChannelSheet: () => void;
}

export default function SopranoRadioPlayer({ player, onOpenChannelSheet }: Props) {
  // Dönen LP animasyonu (yalnız playing iken)
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  // ★ Ses dalga (equalizer) — 3 bar bağımsız animasyon
  const eq1 = useRef(new Animated.Value(0.3)).current;
  const eq2 = useRef(new Animated.Value(0.6)).current;
  const eq3 = useRef(new Animated.Value(0.4)).current;
  const eqLoopRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (player.status === 'playing') {
      // LP dönüş
      spinLoopRef.current?.stop();
      spinAnim.setValue(0);
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoopRef.current = loop;
      loop.start();
      // Eq barlar — her bar farklı süre + farklı tepe yüksekliği
      const makeBar = (val: Animated.Value, dur: number) =>
        Animated.loop(Animated.sequence([
          Animated.timing(val, { toValue: 1.0, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.25, duration: dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]));
      const loops = [makeBar(eq1, 380), makeBar(eq2, 520), makeBar(eq3, 440)];
      loops.forEach(l => l.start());
      eqLoopRef.current = loops;
    } else {
      spinLoopRef.current?.stop();
      spinLoopRef.current = null;
      eqLoopRef.current.forEach(l => l.stop());
      eqLoopRef.current = [];
      eq1.setValue(0.2); eq2.setValue(0.2); eq3.setValue(0.2);
    }
    return () => {
      spinLoopRef.current?.stop();
      spinLoopRef.current = null;
      eqLoopRef.current.forEach(l => l.stop());
      eqLoopRef.current = [];
    };
  }, [player.status, spinAnim, eq1, eq2, eq3]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const isPlaying = player.status === 'playing';
  const isLoading = player.status === 'loading';
  const isError = player.status === 'error';

  // Gizli durumda — küçük inline chip (header altında, sağa hizalı, minimize butonunu ezmez)
  // ★ v1.7.13.47 (24 May 2026): Mini LP + mini eq eklendi. Önceden chip statikti,
  //   "radyo durdu" izlenimi veriyordu. Şimdi büyük player ile aynı Animated values
  //   üzerinden mini boyutta dönen plak + 3-bar eq → canlı feedback.
  if (player.hidden) {
    return (
      <View style={s.hiddenRow}>
        <Pressable style={s.hiddenPill} onPress={player.toggleHidden} hitSlop={6}>
          {/* Mini dönen LP — playing iken döner, idle iken statik durur */}
          <Animated.View style={[s.miniLp, isPlaying && { transform: [{ rotate: spin }] }]}>
            <View style={s.miniLpCenter} />
          </Animated.View>
          {/* Mini equalizer — sadece playing iken görünür */}
          {isPlaying ? (
            <View style={s.miniEqBars}>
              <Animated.View style={[s.miniEqBar, { transform: [{ scaleY: eq1 }] }]} />
              <Animated.View style={[s.miniEqBar, { transform: [{ scaleY: eq2 }] }]} />
              <Animated.View style={[s.miniEqBar, { transform: [{ scaleY: eq3 }] }]} />
            </View>
          ) : null}
          <Text style={s.hiddenLabel}>Radyo</Text>
          <Ionicons name="chevron-down" size={12} color="rgba(251,191,36,0.8)" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.wrapper}>
      <LinearGradient
        colors={['#14B8A6', '#0EA5E9', '#A78BFA']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={s.overlay} />

      {/* Dönen LP plak — groove'lu, kenar işaretli */}
      <View style={s.lpHolder}>
        <Animated.View style={[s.lpDisc, { transform: [{ rotate: spin }] }]}>
          {/* Groove halkaları */}
          <View style={[s.lpGroove, { width: 32, height: 32, borderRadius: 16 }]} />
          <View style={[s.lpGroove, { width: 26, height: 26, borderRadius: 13 }]} />
          <View style={[s.lpGroove, { width: 20, height: 20, borderRadius: 10 }]} />
          {/* Kenar işareti — dönüşü belli eden parlak nokta */}
          <View style={s.lpMark} />
          {/* Merkez label */}
          <View style={s.lpCenter}>
            <View style={s.lpCenterHole} />
          </View>
        </Animated.View>
      </View>

      {/* Kanal adı + canlı indikatör + equalizer */}
      <View style={s.middle}>
        <Text style={s.channelName} numberOfLines={1}>
          {player.currentChannel.name}
        </Text>
        <View style={s.liveRow}>
          {isPlaying ? (
            // ★ Ses dalga (equalizer) — kırmızı dot yerine 3 bar
            <View style={s.eqBars}>
              <Animated.View style={[s.eqBar, { transform: [{ scaleY: eq1 }] }]} />
              <Animated.View style={[s.eqBar, { transform: [{ scaleY: eq2 }] }]} />
              <Animated.View style={[s.eqBar, { transform: [{ scaleY: eq3 }] }]} />
            </View>
          ) : (
            isError ? <View style={[s.liveDot, { backgroundColor: '#F59E0B' }]} /> : null
          )}
          <Text style={s.liveText}>
            {isLoading ? 'YÜKLENİYOR...' : isPlaying ? 'CANLI' : isError ? 'BAĞLANTI HATASI' : 'DURDU'}
          </Text>
        </View>
      </View>

      {/* Sağ kontroller */}
      <View style={s.controls}>
        <Pressable style={[s.ctlBtn, isError && { backgroundColor: 'rgba(245,158,11,0.3)' }]} onPress={player.togglePlay} hitSlop={6}>
          <Ionicons
            name={isPlaying ? 'pause' : isError ? 'refresh' : 'play'}
            size={16}
            color="#FFFFFF"
          />
        </Pressable>
        <Pressable style={s.ctlBtn} onPress={onOpenChannelSheet} hitSlop={6}>
          <Ionicons name="list" size={16} color="#FFFFFF" />
        </Pressable>
        <Pressable style={s.ctlBtn} onPress={player.toggleHidden} hitSlop={6}>
          <Ionicons name="chevron-up" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginTop: 6,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#14B8A6',
    shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    // ★ v1.7.13.146 (24 May 2026): elevation 6 → 0. Android'de bottom-sheet modal'ların
    //   üst kısmı radyo çaların altında kalıyordu (Z-stacking). iOS shadow korundu.
    elevation: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  lpHolder: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  lpDisc: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#0A0A0A',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  // ★ Groove halkaları — plak yiv görünümü
  lpGroove: {
    position: 'absolute',
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  // ★ Kenar parlak işareti — dönüşü gözle görünür kılar
  lpMark: {
    position: 'absolute',
    top: 2, left: '50%', marginLeft: -1.5,
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: '#FBBF24',
    shadowColor: '#FBBF24', shadowOpacity: 0.9, shadowRadius: 2,
  },
  lpCenter: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center',
  },
  lpCenterHole: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: '#0A0A0A',
  },
  // ★ Equalizer (ses dalga) — playing iken canlı dot yerine
  eqBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 16,
    gap: 2,
  },
  eqBar: {
    width: 2.5, height: 16,
    borderRadius: 1.5,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444', shadowOpacity: 0.7, shadowRadius: 2,
  },
  middle: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  channelName: {
    fontSize: 13, fontWeight: '800', color: '#FFFFFF',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  liveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444', shadowOpacity: 0.9, shadowRadius: 3,
  },
  liveText: {
    fontSize: 9, fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
  },
  controls: {
    flexDirection: 'row', gap: 4,
  },
  ctlBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  // ★ v1.7.13.140: Gizli durum chip — inline (absolute değil), header altında sağa hizalı.
  hiddenRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  hiddenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
  },
  hiddenLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
    letterSpacing: 0.3,
  },
  // ★ Mini player elements — chip içinde "radyo canlı" feedback'i
  miniLp: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#0A0A0A',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  miniLpCenter: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#FBBF24',
  },
  miniEqBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 12,
    gap: 1.5,
  },
  miniEqBar: {
    width: 1.8, height: 10,
    borderRadius: 1,
    backgroundColor: '#FBBF24',
    shadowColor: '#FBBF24', shadowOpacity: 0.6, shadowRadius: 1.5,
  },
});
