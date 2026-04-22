/**
 * ★ 2026-04-21: BioEditorSheet — Bio'yu inline düzenlemek için hafif modal.
 * Profilden /edit-profile sayfasına gitmeden bio değiştirilsin.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable, Animated, Easing, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  initialBio: string;
  maxLength?: number;
  onClose: () => void;
  onSave: (newBio: string) => Promise<void>;
}

export default function BioEditorSheet({ visible, initialBio, maxLength = 150, onClose, onSave }: Props) {
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      setBio(initialBio);
      setSaving(false);
      fade.setValue(0);
      slide.setValue(30);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, friction: 8, tension: 90, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, initialBio]);

  const handleSave = async () => {
    const trimmed = bio.trim().slice(0, maxLength);
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      // caller handles error toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[s.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
          <Animated.View style={[s.sheet, { transform: [{ translateY: slide }] }]}>
            <LinearGradient
              colors={['#1C2840', '#122036', '#0B1829']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={s.sheetInner}
            >
              <View style={s.header}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>Bio</Text>
                  <Text style={s.subtitle}>Kendini kısaca tanıt — {maxLength} karakter</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </Pressable>
              </View>

              <TextInput
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, maxLength))}
                placeholder="Örn: Müzik, kahve ve kod ☕"
                placeholderTextColor="#475569"
                style={s.input}
                multiline
                maxLength={maxLength}
                autoFocus
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{bio.length}/{maxLength}</Text>

              <View style={s.actions}>
                <Pressable style={s.cancelBtn} onPress={onClose} disabled={saving}>
                  <Text style={s.cancelText}>Vazgeç</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [s.saveBtn, (pressed || saving) && { opacity: 0.75 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={['#14B8A6', '#0D9488']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={s.saveGrad}
                  >
                    <Ionicons name={saving ? 'hourglass-outline' : 'checkmark'} size={16} color="#FFF" />
                    <Text style={s.saveText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sheetInner: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(115,194,189,0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#F1F5F9' },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F1F5F9',
    fontSize: 14,
    minHeight: 100,
    maxHeight: 150,
  },
  charCount: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.6)',
    textAlign: 'right',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  saveBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  saveGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  saveText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
