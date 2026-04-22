/**
 * ModerationOverlay — Ceza Alan Kullanıcının Ekranında Gösterilen Animasyonlu Overlay
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Toast yerine: tam ekran yarı-saydam overlay + ikon + mesaj.
 * Kick/ban durumlarında otomatik çıkış, diğerlerinde 3sn sonra kapanır.
 */
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '../Toast';

const { width: W, height: H } = Dimensions.get('window');

// ═══ Penalty Tipleri ═══
export type PenaltyType =
  | 'mute'
  | 'unmute'
  | 'chat_mute'
  | 'chat_unmute'
  | 'kick'
  | 'ban'
  | 'permban'
  | 'demote'
  | 'promote'
  | 'make_moderator'
  | 'remove_moderator'
  | 'mute_all';

export type PenaltyPayload = {
  type: PenaltyType;
  reason?: string;
  duration?: string; // "5 dakika", "Süresiz" vb.
};

// ═══ Ref API ═══
export type ModerationOverlayRef = {
  show: (payload: PenaltyPayload) => void;
};

// ═══ Penalty Config ═══
type PenaltyConfig = {
  icon: string;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  autoDismissMs: number; // 0 = overlay sayfadan çıkarken kapanır
};

const PENALTY_MAP: Record<PenaltyType, PenaltyConfig> = {
  mute: {
    icon: 'volume-mute',
    title: 'Susturuldun',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.35)',
    autoDismissMs: 3500,
  },
  unmute: {
    icon: 'volume-high',
    title: 'Susturma Kaldırıldı',
    color: '#22C55E',
    bgColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
    autoDismissMs: 2000,
  },
  chat_mute: {
    icon: 'chatbox-outline',
    title: 'Metin Susturuldu',
    color: '#F97316',
    bgColor: 'rgba(249,115,22,0.12)',
    borderColor: 'rgba(249,115,22,0.3)',
    autoDismissMs: 3000,
  },
  chat_unmute: {
    icon: 'chatbox',
    title: 'Metin Açıldı',
    color: '#22C55E',
    bgColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
    autoDismissMs: 2000,
  },
  kick: {
    icon: 'exit',
    title: 'Odadan Çıkarıldın',
    color: '#DC2626',
    bgColor: 'rgba(220,38,38,0.2)',
    borderColor: 'rgba(220,38,38,0.45)',
    autoDismissMs: 0, // sayfa kapanıyor
  },
  ban: {
    icon: 'ban',
    title: 'Yasaklandın',
    color: '#DC2626',
    bgColor: 'rgba(220,38,38,0.2)',
    borderColor: 'rgba(220,38,38,0.45)',
    autoDismissMs: 0,
  },
  permban: {
    icon: 'ban',
    title: 'Kalıcı Yasaklandın',
    color: '#7F1D1D',
    bgColor: 'rgba(127,29,29,0.25)',
    borderColor: 'rgba(127,29,29,0.5)',
    autoDismissMs: 0,
  },
  demote: {
    icon: 'arrow-down-circle',
    title: 'Sahneden İndirildin',
    color: '#3B82F6',
    bgColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.3)',
    autoDismissMs: 3000,
  },
  promote: {
    icon: 'mic',
    title: 'Sahneye Alındın!',
    color: '#14B8A6',
    bgColor: 'rgba(20,184,166,0.12)',
    borderColor: 'rgba(20,184,166,0.3)',
    autoDismissMs: 2500,
  },
  make_moderator: {
    icon: 'shield-checkmark',
    title: 'Moderatör Yapıldın!',
    color: '#8B5CF6',
    bgColor: 'rgba(139,92,246,0.12)',
    borderColor: 'rgba(139,92,246,0.3)',
    autoDismissMs: 2500,
  },
  remove_moderator: {
    icon: 'shield-outline',
    title: 'Moderatörlük Kaldırıldı',
    color: '#94A3B8',
    bgColor: 'rgba(148,163,184,0.1)',
    borderColor: 'rgba(148,163,184,0.25)',
    autoDismissMs: 2500,
  },
  mute_all: {
    icon: 'volume-mute',
    title: 'Tümü Susturuldu',
    color: '#EF4444',
    bgColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.3)',
    autoDismissMs: 2500,
  },
};

// ★ 2026-04-20: Tüm penalty'ler artık kompakt Toast ile gösterilir. Fullscreen
//   overlay kaldırıldı (kullanıcı isteği: "modal değil success olarak görsün, şiddete
//   göre farklı"). Kick/ban/permban Toast'ta şiddet tonu ile ayırt edilir.
const FULLSCREEN_TYPES: PenaltyType[] = []; // boş bırakıldı — artık hiçbiri fullscreen değil
const TOAST_CONFIG: Record<string, { emoji: string; toastType: 'success' | 'warning' | 'info' | 'error' }> = {
  mute: { emoji: '🔇', toastType: 'warning' },
  unmute: { emoji: '🔊', toastType: 'success' },
  chat_mute: { emoji: '💬', toastType: 'warning' },
  chat_unmute: { emoji: '💬', toastType: 'success' },
  demote: { emoji: '⬇️', toastType: 'info' },
  promote: { emoji: '🎤', toastType: 'success' },
  make_moderator: { emoji: '🛡️', toastType: 'success' },
  remove_moderator: { emoji: '🛡️', toastType: 'info' },
  mute_all: { emoji: '🔇', toastType: 'warning' },
  // Ban ailesi — şiddete göre farklılaşan görünüm
  kick: { emoji: '⛔', toastType: 'warning' },       // en hafif — geri gelebilir
  ban: { emoji: '🚫', toastType: 'error' },          // orta — süre sınırlı, error kırmızı
  permban: { emoji: '☠️', toastType: 'error' },     // en ağır — kalıcı, ölüm kafası
};

const ModerationOverlay = forwardRef<ModerationOverlayRef>((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [penalty, setPenalty] = useState<PenaltyPayload | null>(null);

  // Animasyonlar
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.6)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.7, duration: 250, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setPenalty(null);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    show: (payload: PenaltyPayload) => {
      // ★ 2026-04-20: Non-destructive penaltyler artık kompakt Toast olarak çıkar.
      //   Full-screen overlay sadece kick/ban/permban için — yıkıcı, geri dönüşü yok.
      if (!FULLSCREEN_TYPES.includes(payload.type)) {
        const config = PENALTY_MAP[payload.type];
        const toastCfg = TOAST_CONFIG[payload.type];
        if (config && toastCfg) {
          // ★ 2026-04-20: Ban/kick şiddetine göre toast süresi — permban en uzun.
          const severityDuration: Record<string, number> = {
            kick: 3500,
            ban: 4500,
            permban: 6000,
          };
          showToast({
            title: `${toastCfg.emoji} ${config.title}`,
            message: payload.reason || payload.duration || '',
            type: toastCfg.toastType,
            duration: severityDuration[payload.type] || config.autoDismissMs || 2500,
          });
        }
        return;
      }
      // Yıkıcı: full-screen overlay
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setPenalty(payload);
      setVisible(true);

      // Giriş animasyonu
      overlayOpacity.setValue(0);
      cardScale.setValue(0.6);
      cardOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();

      // İkon pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconPulse, { toValue: 1.15, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(iconPulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      // Otomatik kapanma
      const config = PENALTY_MAP[payload.type];
      if (config?.autoDismissMs > 0) {
        dismissTimer.current = setTimeout(dismiss, config.autoDismissMs);
      }
    },
  }));

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (!visible || !penalty) return null;

  const config = PENALTY_MAP[penalty.type] || PENALTY_MAP.mute;
  const isDestructive = penalty.type === 'kick' || penalty.type === 'ban' || penalty.type === 'permban';

  return (
    <View style={sty.root} pointerEvents={isDestructive ? 'auto' : 'box-none'}>
      {/* Backdrop — yıkıcı cezalarda tam kaplama */}
      <Animated.View
        style={[
          sty.backdrop,
          {
            opacity: overlayOpacity,
            backgroundColor: isDestructive ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
          },
        ]}
        pointerEvents="none"
      />

      {/* Kart */}
      <Animated.View
        style={[
          sty.card,
          {
            backgroundColor: config.bgColor,
            borderColor: config.borderColor,
            transform: [{ scale: cardScale }],
            opacity: cardOpacity,
          },
        ]}
      >
        {/* İkon halkası */}
        <Animated.View
          style={[
            sty.iconRing,
            {
              backgroundColor: config.color + '18',
              borderColor: config.color + '40',
              transform: [{ scale: iconPulse }],
            },
          ]}
        >
          <Ionicons name={config.icon as any} size={36} color={config.color} />
        </Animated.View>

        {/* Başlık */}
        <Text style={[sty.title, { color: config.color }]}>{config.title}</Text>

        {/* Detay */}
        {penalty.reason ? (
          <Text style={sty.reason}>{penalty.reason}</Text>
        ) : null}
        {penalty.duration ? (
          <View style={[sty.durationBadge, { borderColor: config.color + '30' }]}>
            <Ionicons name="time-outline" size={12} color={config.color} />
            <Text style={[sty.durationText, { color: config.color }]}>{penalty.duration}</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
});

ModerationOverlay.displayName = 'ModerationOverlay';
export default ModerationOverlay;

const sty = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: W * 0.72,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 30,
    // Glass effect
    backgroundColor: 'rgba(30,41,59,0.92)',
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  reason: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  durationText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
