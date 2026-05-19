/**
 * SopranoChat — Ortak Bottom Sheet
 * ═══════════════════════════════════════════════════
 * Tüm bottom-sheet/drawer'lar için standart iskelet.
 *
 * Özellikler:
 *  - Aşağıdan yukarı spring animasyon
 *  - Backdrop tap ile kapatma
 *  - Swipe-down ile kapatma (threshold konfigüre edilebilir)
 *  - Diagonal gradient arka plan (profil sayfası DNA)
 *  - Üst teal hairline
 *  - Drag handle + opsiyonel `title` + `icon` + `badge` + `action` (header'da)
 *  - Safe-area uyumlu paddingBottom
 *
 * Prensip (memory: feedback_no_x_on_draggable):
 *  - Header tamamı drag alanı (handle + title)
 *  - X / kapat butonu YOK — sadece swipe ile kapanır
 *  - Backdrop tap de kapatır
 *
 * Kullanım:
 *   <BottomSheet visible={open} onClose={close} title="ARKADAŞLAR" icon="people" badge={count}>
 *     <YourContent />
 *   </BottomSheet>
 */
import React, { useRef, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, Pressable, Modal as RNModal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Shadows } from '../constants/theme';

const iconShadow = {
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
} as const;

// ★ v294 (17 May 2026): Accent color'dan halo gradient'i türetmek için.
//   accentColor `#FBBF24` (gold) gibi hex → halo amber/gold olur.
function hexToRgba(hex: string, alpha: number): string {
  if (!hex?.startsWith('#') || hex.length !== 7) return `rgba(20,184,166,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Maks yükseklik oranı (ekran yüksekliğinin) — 0..1. Default: 0.78 */
  maxHeightRatio?: number;
  /** Sheet'in alabileceği MİN yükseklik (ekranın %X'i). İçerik kısa olsa bile
   *  sheet bu seviyenin altına düşmez. Default 0 (içeriğe göre). */
  minHeightRatio?: number;
  /** ★ v319.7 (18 May 2026): İçerik ScrollView içeriyorsa true ver. Pan responder
   *  yalnızca header (handle + title) bölümünden drag'i yakalar; content ScrollView
   *  ile çakışmaz. Aksi halde aşağı kaydırma sheet'i kapatır. */
  scrollableContent?: boolean;
  /** ★ v319.11 (18 May 2026): scrollableContent=true iken ScrollView'ın anlık
   *  scrollOffset değeri. ScrollView yukarıdaysa (offset=0) pan responder content
   *  alanından da drag yakalar (Clubhouse pattern). Aşağı scroll edilmişse drag
   *  yakalanmaz, ScrollView normal scroll eder. */
  scrollOffsetRef?: React.MutableRefObject<number>;
  /** Swipe-down kapatma eşiği (px). Default: 80 */
  dismissThreshold?: number;
  /** Header'da gösterilecek başlık (UPPERCASE'e zorlanır stil ile) */
  title?: string;
  /** Başlık yanındaki Ionicon adı */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Başlık yanında rozet (opsiyonel sayı) */
  badge?: number | string;
  /** Başlığın sağındaki aksiyon linki — metin + onPress */
  action?: { label: string; onPress: () => void };
  /** Accent bar rengi — default teal */
  accentColor?: string;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  maxHeightRatio = 0.78,
  minHeightRatio = 0,
  scrollableContent = false,
  scrollOffsetRef,
  dismissThreshold = 80,
  title,
  icon,
  badge,
  action,
  accentColor = Colors.teal,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(1000)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 1000, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  // ★ v1.7.13.40 (19 May 2026): İKİ PAN RESPONDER — kullanıcı 'rozetler modali
  //   asagiya dokunarak suruklenemeli, kuralimiz var ama uygulanmamis'.
  //   Eski: Tek pan responder, scrollOffsetRef > 5 ise drag handle bile pan almaz.
  //   Yeni: Header pan ALWAYS (drag handle/title bölgesi); body pan scroll-aware.

  const onPanMove = useCallback((_: any, gs: any) => {
    translateY.setValue(Math.max(0, gs.dy));
  }, [translateY]);
  const onPanRelease = useCallback((_: any, gs: any) => {
    if (gs.dy > dismissThreshold || gs.vy > 0.4) {
      Animated.timing(translateY, { toValue: 1000, duration: 180, useNativeDriver: true })
        .start(() => onClose());
    } else {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    }
  }, [translateY, dismissThreshold, onClose]);

  // Header pan — drag handle + title bölgesi. Scroll offset'i UMURSAMAZ, her zaman çalışır.
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onMoveShouldSetPanResponderCapture: (_, gs) => gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: onPanMove,
      onPanResponderRelease: onPanRelease,
    })
  ).current;

  // Body pan — ScrollView/FlatList ile koordineli, sadece top'ta drag alır.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (gs.dy <= 8 || Math.abs(gs.dy) <= Math.abs(gs.dx)) return false;
        if (scrollableContent && scrollOffsetRef && scrollOffsetRef.current > 5) return false;
        return true;
      },
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        if (gs.dy <= 12 || Math.abs(gs.dy) <= Math.abs(gs.dx) * 1.5) return false;
        if (scrollableContent && scrollOffsetRef && scrollOffsetRef.current > 5) return false;
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: onPanMove,
      onPanResponderRelease: onPanRelease,
    })
  ).current;

  if (!mounted) return null;

  const bottomPad = Math.max(insets.bottom, 14);

  // ★ v319.8 (18 May 2026): RN Modal wrap — kullanıcı feedback: "birden fazla
  //   modal üst üste açtığımda son modali sürüklerken bir önceki modal scroll
  //   oluyor". Eski yapı düz View ile zIndex'ti, modal stack pointer event'leri
  //   alt sheet'in ScrollView'una sızıyordu. RN Modal her instance kendi
  //   window katmanını alır → alttaki modal etkileşim almaz, scroll yapmaz.
  return (
    <RNModal visible={mounted} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            // ★ v319.10 (18 May 2026): scrollableContent=true ise sabit height ver,
            //   yoksa içerik intrinsic'le flex:1 ScrollView height alamıyordu →
            //   ScrollView içeriği render eder ama scroll edemez. Sabit height ile
            //   ScrollView flex:1 doğru hesaplanır.
            ...(scrollableContent
              ? { height: `${maxHeightRatio * 100}%` as any }
              : { maxHeight: `${maxHeightRatio * 100}%` }),
            ...(minHeightRatio > 0 && !scrollableContent
              ? { minHeight: `${minHeightRatio * 100}%` as any }
              : null),
            paddingBottom: bottomPad,
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* ★ v294 (17 May 2026): NotificationDrawer/ProfileHero aile dili — 3-katman gradient.
            (1) slate diagonal base + (2) accent halo (üst-sol) + (3) soft accent glow. */}
        {/* (1) Slate diagonal base */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* (2) Accent halo — üst-sol köşeden inen renkli bulut */}
        <LinearGradient
          colors={[hexToRgba(accentColor, 0.20), hexToRgba(accentColor, 0.05), 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* (3) Soft accent glow — çapraz hafif aydınlık */}
        <LinearGradient
          colors={[hexToRgba(accentColor, 0.08), 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {/* Üst accent hairline — aile dilindeki ince çizgi */}
        <LinearGradient
          colors={['transparent', `${accentColor}99`, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.topEdge}
        />

        {/* ★ v1.7.13.40 (19 May 2026): Drag handle + header bölgesi kendi pan responder'i
            (scroll offset umurusamadan her zaman drag yakalar). Kullanıcı 'rozetler
            modali asagiya dokunarak suruklenemeli, kuralimiz var ama uygulanmamis'. */}
        <View {...headerPanResponder.panHandlers}>
          <View style={s.handleWrap}>
            <View style={s.handle} />
          </View>
          {title && (
            <View style={s.header}>
              <View style={[s.accent, { backgroundColor: accentColor }]} />
              {icon && <Ionicons name={icon} size={14} color={accentColor} style={iconShadow} />}
              <Text style={s.title}>{title}</Text>
              {badge !== undefined && badge !== null && (
                <View style={[s.badge, { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}20` }]}>
                  <Text style={[s.badgeText, { color: accentColor }]}>{badge}</Text>
                </View>
              )}
              {action && (
                <Pressable onPress={action.onPress} hitSlop={8}>
                  <Text style={[s.actionText, { color: accentColor }]}>{action.label}</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* İçerik */}
        <View style={s.content}>
          {children}
        </View>
      </Animated.View>
    </RNModal>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 101,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.cardBorder,
    ...Shadows.card,
  },
  topEdge: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.5,
    zIndex: 1,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  // Premium section header — profil sayfası pattern
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  accent: { width: 3, height: 16, borderRadius: 2 },
  title: {
    flex: 1,
    fontSize: 12, fontWeight: '900',
    color: '#CBD5E1', letterSpacing: 1.2, textTransform: 'uppercase',
    ...Shadows.text,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  actionText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
    ...Shadows.text,
  },
  content: {
    flex: 1,
  },
});
