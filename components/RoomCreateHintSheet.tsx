// ★ 2026-04-29: Yeni kullanıcı yönlendirici sheet — DiscoverWelcome'ın
//   tek-slide kuzeni. Onboarding bittikten sonra Keşfet'e düşen kullanıcıya
//   "Odalarım'a git, oda aç" yönlendirmesini gem hexagon dilinde gösterir.
//   AsyncStorage flag ile UID-bazlı bir kez gösterilir.
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Animated, Easing, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { SkiaShadow } from './skia';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');
const STORAGE_KEY_PREFIX = 'soprano_room_hint_v1_';

export async function hasSeenRoomCreateHint(uid?: string | null): Promise<boolean> {
  if (!uid) return true;
  try {
    const { supabase } = await import('../constants/supabase');
    // 1) Daha önce oda açmış mı? (DB gerçeği — hesap silinse bile yeni profilde count=0 olur)
    try {
      const { count } = await supabase
        .from('room_creation_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .limit(1);
      if ((count || 0) > 0) {
        try { await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, '1'); } catch {}
        return true;
      }
    } catch { /* DB fail — devam */ }

    // ★ 2026-05-09 FIX: DB ÖNCE — yeni kurulum (AsyncStorage boş) durumunda DB flag varsa
    //   yine "görüldü" sayılır. Aksi halde uninstall+reinstall sonrası RoomHint
    //   her açılışta tekrar görünüyordu.
    try {
      const { data } = await supabase.from('profiles').select('preferences').eq('id', uid).maybeSingle();
      const dbSeen = (data as any)?.preferences?.room_create_hint_seen === true;
      if (dbSeen) {
        try { await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, '1'); } catch {}
        return true;
      }
    } catch { /* DB fail — AsyncStorage'a düş */ }

    // 2) AsyncStorage check (fallback — eski cihaz kaydı, DB yoksa kabul)
    const v = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${uid}`);
    return v === '1';
  } catch {
    return true;
  }
}

export async function markRoomCreateHintSeen(uid?: string | null) {
  if (!uid) return;
  try { await AsyncStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, '1'); } catch {}
  try {
    const { supabase } = await import('../constants/supabase');
    const { data } = await supabase.from('profiles').select('preferences').eq('id', uid).maybeSingle();
    const prefs = { ...((data as any)?.preferences || {}), room_create_hint_seen: true };
    await supabase.from('profiles').update({ preferences: prefs }).eq('id', uid);
  } catch {}
}

// ★ Gem hexagon HTML — DiscoverWelcome ile aynı şablon, pembe-bordo renk paleti.
const HINT_GEM_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden;display:flex;align-items:center;justify-content:center}svg{width:100%;height:100%}@keyframes gem-float{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-3px) rotate(1.5deg)}}@keyframes shine-march{0%{transform:translateX(-160px)}100%{transform:translateX(160px)}}@keyframes facet-bright{0%,100%{opacity:0.15}50%{opacity:0.55}}@keyframes facet-bright-2{0%,100%{opacity:0.4}50%{opacity:0.85}}@keyframes halo-breathe{0%,100%{opacity:0.25}50%{opacity:0.7}}@keyframes ring-expand{0%{opacity:0.9;transform:scale(0.85)}100%{opacity:0;transform:scale(1.45)}}@keyframes bg-shimmer{0%,100%{opacity:0.05}50%{opacity:0.18}}.gem-float{animation:gem-float 3s ease-in-out infinite;transform-origin:100px 100px;transform-box:view-box}.shine-band{animation:shine-march 3.2s ease-in-out infinite}.facet-1{animation:facet-bright 2.4s ease-in-out infinite}.facet-2{animation:facet-bright-2 2.8s ease-in-out infinite;animation-delay:0.4s}.facet-3{animation:facet-bright 3.2s ease-in-out infinite;animation-delay:0.8s}.halo{animation:halo-breathe 3s ease-in-out infinite}.ring-A{animation:ring-expand 2.6s ease-out infinite;transform-origin:100px 100px;transform-box:view-box}.ring-B{animation:ring-expand 2.6s ease-out infinite;animation-delay:1.3s;transform-origin:100px 100px;transform-box:view-box}.bg-glow{animation:bg-shimmer 4s ease-in-out infinite}</style></head><body><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g1" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#FCE7F3"/><stop offset="35%" stop-color="#F9A8D4"/><stop offset="70%" stop-color="#EC4899"/><stop offset="100%" stop-color="#831843"/></linearGradient><linearGradient id="g2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#FFF" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#000" stop-opacity="0.3"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></linearGradient><radialGradient id="g4" cx="50%" cy="50%"><stop offset="0%" stop-color="#F9A8D4" stop-opacity="0.5"/><stop offset="100%" stop-color="#F9A8D4" stop-opacity="0"/></radialGradient><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FFF" stop-opacity="0"/><stop offset="50%" stop-color="#FFF" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFF" stop-opacity="0"/></linearGradient><clipPath id="c1"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72"/></clipPath></defs><g class="bg-glow"><circle cx="100" cy="100" r="90" fill="url(#g4)"/></g><g class="halo"><polygon points="100,28 168,68 168,132 100,172 32,132 32,68" fill="none" stroke="#F9A8D4" stroke-width="0.7"/></g><polygon class="ring-A" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="#FCE7F3" stroke-width="1.5"/><polygon class="ring-B" points="100,40 156,72 156,128 100,160 44,128 44,72" fill="none" stroke="#EC4899" stroke-width="1.5"/><g class="gem-float"><polygon points="100,40 156,72 156,128 100,160 44,128 44,72" fill="url(#g1)" stroke="#FCE7F3" stroke-width="1"/><g clip-path="url(#c1)"><polygon points="100,40 156,72 100,104 44,72" fill="url(#g2)" opacity="0.6"/><polygon points="156,72 156,128 130,100" fill="url(#g3)" opacity="0.7"/></g><polygon class="facet-1" points="100,40 130,57 100,74 70,57" fill="#FFF"/><polygon class="facet-2" points="100,40 70,57 44,72" fill="#FCE7F3"/><polygon class="facet-3" points="100,40 130,57 156,72" fill="#FCE7F3"/><g clip-path="url(#c1)"><rect class="shine-band" x="-30" y="20" width="50" height="160" fill="url(#g5)" transform="skewX(-15)"/></g></g></svg></body></html>`;

type Props = {
  visible: boolean;
  onGoToMyRooms: () => void;
  onClose: () => void;
};

export default function RoomCreateHintSheet({ visible, onGoToMyRooms, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    fadeIn.setValue(0);
    heroAnim.setValue(0);
    titleAnim.setValue(0);
    bodyAnim.setValue(0);
    ctaAnim.setValue(0);

    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(heroAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(380),
        Animated.timing(titleAnim, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(520),
        Animated.timing(bodyAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(700),
        Animated.spring(ctaAnim, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeIn, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={['rgba(131,24,67,0.45)', 'rgba(15,15,31,0.92)', 'rgba(15,15,31,0.96)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.content}>
          {/* Hero gem */}
          <Animated.View
            style={[
              styles.heroWrap,
              {
                opacity: heroAnim,
                transform: [
                  { translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                  { scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                ],
              },
            ]}
          >
            <WebView
              source={{ html: HINT_GEM_HTML }}
              style={styles.webview}
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              setBuiltInZoomControls={false}
              javaScriptEnabled
              originWhitelist={['*']}
              androidLayerType="hardware"
            />
            <View pointerEvents="none" style={styles.gemIconOverlay}>
              <Ionicons name="add-circle" size={64} color="#FFF" style={{
                textShadowColor: 'rgba(0,0,0,0.7)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 6,
              }} />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
              },
            ]}
          >
            Hemen ilk odanı aç!
          </Animated.Text>

          {/* Body */}
          <Animated.Text
            style={[
              styles.body,
              {
                opacity: bodyAnim,
                transform: [{ translateY: bodyAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            Odalarım sekmesine git, <Text style={styles.bodyHighlight}>Yeni Oda Oluştur</Text> düğmesine dokun. İstediğin konuda sesli oda aç, arkadaşlarını davet et — bağlanmak çok kolay.
          </Animated.Text>

          {/* CTA buttons */}
          <Animated.View
            style={[
              styles.ctaWrap,
              {
                opacity: ctaAnim,
                transform: [{ scale: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
              },
            ]}
          >
            <Pressable style={styles.ctaSecondary} onPress={onClose}>
              <Text style={styles.ctaSecondaryText}>Şimdi değil</Text>
            </Pressable>
            <SkiaShadow shadowColor="#EC4899" shadowOpacity={0.55} shadowBlur={12} shadowOffsetY={4} borderRadius={12}>
              <Pressable style={styles.ctaPrimary} onPress={onGoToMyRooms}>
                <LinearGradient
                  colors={['#EC4899', '#BE185D', '#831843']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name="add-circle" size={18} color="#FFF" />
                <Text style={styles.ctaPrimaryText}>Odalarım'a Git</Text>
              </Pressable>
            </SkiaShadow>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const HERO_SIZE = Math.min(W * 0.62, 280);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,15,31,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: W * 0.86,
    maxWidth: 420,
    alignItems: 'center',
  },
  heroWrap: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 28,
  },
  webview: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    backgroundColor: 'transparent',
  },
  gemIconOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginBottom: 12,
  },
  body: {
    fontSize: 14.5,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
    marginBottom: 32,
  },
  bodyHighlight: {
    color: '#FBCFE8',
    fontWeight: '800',
  },
  ctaWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaSecondary: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  ctaPrimary: {
    flex: 1.5,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // ★ v1.3.69: Skia ile cross-platform pink glow (dış SkiaShadow wrap)
  },
  ctaPrimaryText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
