/**
 * ★ v1.7.13.53 (20 May 2026): MoodEditorSheet — "Şu anki hissim" balonu için
 *   küçük modal. FB ParticleEffect tarzı tek satır status text editörü.
 *   Bio'dan ayrı: daha kısa (60 karakter), tek satır, hızlı paylaşım hissi.
 *   Boşaltıp kaydet → balonu sil (NULL'a çek).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable, Animated, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import { i18n } from '../../services/i18n';

interface Props {
  visible: boolean;
  initialMood: string;
  maxLength?: number;
  onClose: () => void;
  onSave: (mood: string) => Promise<void>;
}

const SUGGESTIONS_KEYS = [
  'mood.suggestion.music',
  'mood.suggestion.reading',
  'mood.suggestion.chat',
  'mood.suggestion.energetic',
  'mood.suggestion.quiet',
];

export default function MoodEditorSheet({ visible, initialMood, maxLength = 60, onClose, onSave }: Props) {
  const [mood, setMood] = useState(initialMood || '');
  const [saving, setSaving] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  const { translateValue, panHandlers } = useSwipeToDismiss({
    direction: 'down', threshold: 80, onDismiss: onClose,
  });

  // ★ v1.7.13.103 (20 May 2026): initialMood dependency KALDIRILDI — save sonrası
  //   refreshProfile profile.mood_status'u update edince initialMood prop değişiyor,
  //   visible hâlâ true iken useEffect re-trigger oluyor → modal "yeniden açıldı"
  //   hissi (animation restart) → sonra onClose ile kayboluyor. Sadece visible
  //   toggle'ında animate et; initial mood mount'ta zaten set ediliyor.
  useEffect(() => {
    if (visible) {
      setMood(initialMood || '');
      setSaving(false);
      fade.setValue(0);
      slide.setValue(30);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = async () => {
    const trimmed = mood.trim().slice(0, maxLength);
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      // caller handles toast
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onSave('');
      onClose();
    } catch {
      // ignored
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[s.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
          <Animated.View style={[s.sheet, { transform: [{ translateY: Animated.add(slide, translateValue) }] }]}>
            <LinearGradient
              colors={['#2A2018', '#1F1810', '#16110A']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={s.sheetInner}
            >
              {/* Üst köşede amber halo — balon temasıyla bağ */}
              <LinearGradient
                colors={['rgba(252,211,77,0.18)', 'transparent']}
                start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.6 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View style={s.header} {...panHandlers}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{i18n.t('mood.title')}</Text>
                  <Text style={s.subtitle}>{i18n.t('mood.subtitle')}</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </Pressable>
              </View>

              <TextInput
                value={mood}
                onChangeText={(t) => setMood(t.slice(0, maxLength))}
                placeholder={i18n.t('mood.placeholder')}
                placeholderTextColor="#475569"
                style={s.input}
                maxLength={maxLength}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              <Text style={s.charCount}>{mood.length}/{maxLength}</Text>

              <View style={s.suggestionsWrap}>
                {SUGGESTIONS_KEYS.map((key) => ({ key, label: i18n.t(key) })).map(({ key, label: sug }) => (
                  <Pressable key={key} style={s.suggestion} onPress={() => setMood(sug)}>
                    <Text style={s.suggestionText}>{sug}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={s.actions}>
                {initialMood && initialMood.trim().length > 0 ? (
                  <Pressable style={s.clearBtn} onPress={handleClear} disabled={saving}>
                    <Ionicons name="trash-outline" size={14} color="#F87171" />
                    <Text style={s.clearText}>{i18n.t('mood.clear')}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={s.cancelBtn} onPress={onClose} disabled={saving}>
                    <Text style={s.cancelText}>{i18n.t('mood.cancel')}</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [s.saveBtn, (pressed || saving) && { opacity: 0.75 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={['#FCD34D', '#F59E0B']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.saveGrad}
                  >
                    <Ionicons name={saving ? 'hourglass-outline' : 'checkmark'} size={16} color="#0F172A" />
                    <Text style={s.saveText}>{saving ? i18n.t('mood.saving') : i18n.t('mood.save')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 16, paddingBottom: 20 },
  sheetInner: {
    borderRadius: 22, padding: 20,
    borderWidth: 1, borderColor: 'rgba(252,211,77,0.20)', // amber accent kenarlık
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: '#FCD34D' }, // amber başlık
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(252,211,77,0.25)',
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#F1F5F9', fontSize: 14,
  },
  charCount: { fontSize: 11, color: 'rgba(252,211,77,0.55)', textAlign: 'right', marginTop: 6 },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggestion: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: 'rgba(252,211,77,0.10)',
    borderWidth: 1, borderColor: 'rgba(252,211,77,0.30)',
  },
  suggestionText: { color: '#FCD34D', fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.1)',
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  clearBtn: {
    flex: 1, flexDirection: 'row', gap: 6,
    paddingVertical: 13, borderRadius: 12,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  clearText: { color: '#F87171', fontSize: 13, fontWeight: '700' },
  saveBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  saveGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13,
  },
  saveText: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
});
