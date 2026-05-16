/**
 * SopranoChat — Raporlama Modal
 * v110.5.2 (6 May 2026) — Modal aile dili uyumu
 *
 * Profil sayfası ailesi: slate gradient (#3a4658 → #2a3344 → #1a2030)
 *  + amber halo overlay + chevron-down header + drag handle.
 * Eski "glassmorphic" dağınık dil kaldırıldı.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { i18n } from '../services/i18n';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Dimensions, Animated, PanResponder,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppLoader from './AppLoader';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModerationService, ReportReason } from '../services/moderation';
import { showToast } from './Toast';
import { Shadows } from '../constants/theme';

const { height: H } = Dimensions.get('window');
// ★ v110.5.6: Yarı ekran bottom-sheet — eskiden full-screen idi, çok büyüktü.
//   Sheet alttan H*0.65 (klavyeyle birlikte sığar) yükselir, üstte backdrop kalır.
const SHEET_HEIGHT = Math.round(H * 0.65);
const SHEET_DISMISS = SHEET_HEIGHT + 30; // sheet'i tamamen ekran dışına it

type ReportTarget =
  | { type: 'user'; id: string }
  | { type: 'room'; id: string }
  | { type: 'post'; id: string }
  | { type: 'message'; id: string };

type ReportModalProps = {
  visible: boolean;
  onClose: () => void;
  reporterId: string;
  target: ReportTarget;
};

const REASONS: { key: ReportReason; label: string; icon: string }[] = [
  { key: 'spam', label: 'Spam', icon: 'megaphone-outline' },
  { key: 'harassment', label: i18n.t('reportmodal.001'), icon: 'sad-outline' },
  { key: 'hate_speech', label: i18n.t('reportmodal.002'), icon: 'flame-outline' },
  { key: 'inappropriate_content', label: i18n.t('reportmodal.003'), icon: 'eye-off-outline' },
  { key: 'impersonation', label: i18n.t('reportmodal.004'), icon: 'person-outline' },
  { key: 'self_harm', label: 'Kendine Zarar Verme', icon: 'heart-dislike-outline' },
  { key: 'violence', label: i18n.t('reportmodal.005'), icon: 'warning-outline' },
  { key: 'underage', label: i18n.t('reportmodal.006'), icon: 'alert-circle-outline' },
  { key: 'other', label: i18n.t('reportmodal.007'), icon: 'ellipsis-horizontal-outline' },
];

export function ReportModal({ visible, onClose, reporterId, target }: ReportModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  // ★ v110.5.3: visible=false'da return null YERİNE mount kalır + animation ile gizlenir.
  //   Eski yaklaşım ilk açılışta animasyon kaçırıyordu (mount/animate timing race).
  //   Şimdi internal mounted state ile kontrollü mount/unmount.
  const [internalMounted, setInternalMounted] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_DISMISS)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  // ★ v110.5.7: Klavye açıkken sheet'i yukarı kaydırma offset'i.
  //   KAV bottom-anchored absolute sheet'te yetmiyordu (TextInput hala klavye altında kalıyordu).
  //   Manuel: keyboardDidShow → translateY -keyboardHeight (sheet yukarı çık)
  //          keyboardDidHide → translateY 0 (orijinal yerine dön)
  const keyboardOffset = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ★ v110.5.7: Klavye event listener — TextInput odaklanınca sheet otomatik yukarı kayar
  useEffect(() => {
    if (!internalMounted) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates?.height || 0;
      keyboardOffset.current = kbHeight;
      Animated.timing(translateY, {
        toValue: -kbHeight,
        duration: Platform.OS === 'ios' ? (e as any).duration || 250 : 250,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardOffset.current = 0;
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [internalMounted]);

  useEffect(() => {
    if (visible) {
      // Mount immediately, sonra animation
      setInternalMounted(true);
      setSelectedReason(null);
      setDescription('');
      // requestAnimationFrame: mount → next frame'de animation başlat (timing güvenli)
      requestAnimationFrame(() => {
        Animated.parallel([
          // ★ v110.5.6: Bottom-anchored — translateY 0 = yerinde (alttan)
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
          Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
      });
    } else if (internalMounted) {
      // Animate out, sonra unmount
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_DISMISS, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setInternalMounted(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, { toValue: SHEET_DISMISS, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setInternalMounted(false);
      onCloseRef.current();
    });
  };

  // Drag-to-dismiss header'dan — translateY 0 baseline
  const headerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.6) {
          handleClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
        }
      },
    }),
  ).current;

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast({ title: i18n.t('reportmodal.008'), type: 'info' });
      return;
    }
    setSending(true);
    try {
      switch (target.type) {
        case 'user': await ModerationService.reportUser(reporterId, target.id, selectedReason, description); break;
        case 'room': await ModerationService.reportRoom(reporterId, target.id, selectedReason, description); break;
        case 'post': await ModerationService.reportPost(reporterId, target.id, selectedReason, description); break;
        case 'message': await ModerationService.reportMessage(reporterId, target.id, selectedReason, description); break;
      }
      showToast({ title: i18n.t('reportmodal.009'), message: i18n.t('reportmodal.010'), type: 'success' });
      setSelectedReason(null);
      setDescription('');
      handleClose();
    } catch (err: any) {
      showToast({ title: i18n.t('reportmodal.011'), message: err.message || i18n.t('auto.ReportModal.005'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (!internalMounted) return null;

  const targetLabel =
    target.type === 'user' ? i18n.t('auto.ReportModal.004') :
    target.type === 'room' ? i18n.t('auto.ReportModal.003') :
    target.type === 'post' ? i18n.t('auto.ReportModal.002') : i18n.t('auto.ReportModal.001');

  return (
    <View style={s.root} pointerEvents="box-none">
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(8,12,22,0.55)', opacity: backdropOpacity }]}
        pointerEvents="auto"
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        {/* ★ Aile dili — slate diagonal + amber halo */}
        <LinearGradient
          colors={['#3a4658', '#2a3344', '#1a2030']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(245,158,11,0.20)', 'rgba(245,158,11,0.05)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.4 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Header — drag handle + chevron-down + başlık */}
        <View {...headerPan.panHandlers}>
          <View style={s.handleWrap}>
            <View style={s.dragHandle} />
          </View>
          <View style={s.header}>
            <Pressable onPress={handleClose} style={s.iconBtn} hitSlop={8}>
              <Ionicons name="chevron-down" size={22} color="#F1F5F9" />
            </Pressable>
            <Text style={s.title}>{targetLabel.toUpperCase()} RAPOR ET</Text>
            <View style={{ width: 34 }} />
          </View>
        </View>

        {/* ★ v110.5.7: KAV kaldırıldı — manuel translateY ile sheet yukarı kayar.
             Çift kayma önlendi (KAV+manuel olmasın). */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={s.sectionLabel}>{i18n.t('reportmodal.001')}</Text>

          {/* ★ v110.5.4: 2 sütunlu kompakt grid — eskiden 9 satır dikey alan kaplıyordu */}
          <View style={s.reasonGrid}>
            {REASONS.map((reason) => {
              const selected = selectedReason === reason.key;
              return (
                <Pressable
                  key={reason.key}
                  style={({ pressed }) => [
                    s.reasonCell,
                    selected && s.reasonCellSelected,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setSelectedReason(reason.key)}
                >
                  <Ionicons
                    name={reason.icon as any}
                    size={14}
                    color={selected ? '#FBBF24' : '#94A3B8'}
                  />
                  <Text
                    style={[s.reasonText, selected && s.reasonTextSelected]}
                    numberOfLines={1}
                  >
                    {reason.label}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={14} color="#FBBF24" />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Açıklama */}
          <Text style={[s.sectionLabel, { marginTop: 14 }]}>{i18n.t('reportmodal.002')}</Text>
          <TextInput
            style={s.descInput}
            placeholder={i18n.t('reportmodal.004')}
            placeholderTextColor="rgba(148,163,184,0.5)"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={300}
          />
          <Text style={s.charCount}>{description.length}/300</Text>

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={sending || !selectedReason}
            style={({ pressed }) => [
              s.submitBtn,
              (!selectedReason || sending) && { opacity: 0.4 },
              pressed && !sending && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={['#EF4444', '#B91C1C']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {sending ? (
              <AppLoader color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="flag" size={15} color="#FFF" />
                <Text style={s.submitText}>{i18n.t('reportmodal.003')}</Text>
              </>
            )}
          </Pressable>

          <Text style={s.disclaimer}>
            Yanlış raporlar hesabının kısıtlanmasına yol açabilir. Lütfen sadece
            kuralları gerçekten ihlal eden içerikleri raporla.
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
  },
  // ★ v110.5.6: Yarı ekran bottom-sheet (eski full-screen değil)
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: SHEET_HEIGHT,
    overflow: 'hidden',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handleWrap: { alignItems: 'center', paddingTop: 8 },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 13, fontWeight: '900' as const, color: '#F1F5F9',
    letterSpacing: 1.2, textAlign: 'center' as const,
    ...Shadows.text,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '900' as const, color: '#FBBF24',
    letterSpacing: 1.2, marginTop: 8, marginBottom: 10, marginLeft: 4,
    ...Shadows.text,
  },
  // ★ v110.5.4: Kompakt 2 sütunlu grid — 9 reason ekran boyu kaplamasın
  reasonGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  reasonCell: {
    width: '48.5%',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  reasonCellSelected: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  reasonText: {
    flex: 1,
    fontSize: 12, color: '#CBD5E1', fontWeight: '600' as const,
    ...Shadows.text,
  },
  reasonTextSelected: {
    color: '#FDE68A', fontWeight: '700' as const,
  },
  descInput: {
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    color: '#F1F5F9', fontSize: 13,
    minHeight: 80, textAlignVertical: 'top' as const,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  charCount: {
    fontSize: 10, color: '#94A3B8', fontWeight: '600' as const,
    textAlign: 'right' as const, marginTop: 4,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 18, paddingVertical: 13,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)',
  },
  submitText: {
    color: '#FFF', fontSize: 14, fontWeight: '900' as const,
    letterSpacing: 0.4, ...Shadows.text,
  },
  disclaimer: {
    fontSize: 10, color: 'rgba(148,163,184,0.7)', lineHeight: 15,
    textAlign: 'center' as const, marginTop: 14, paddingHorizontal: 8,
  },
});
