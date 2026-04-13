/**
 * SopranoChat — Premium Raporlama Modal
 * Glassmorphism + Pill buttons + Slide-up
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, TextInput,
  ScrollView, ActivityIndicator, Dimensions, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModerationService, ReportReason } from '../services/moderation';
import { showToast } from './Toast';

const { height: H } = Dimensions.get('window');

const C = {
  glass: 'rgba(45,55,64,0.95)',
  border: 'rgba(255,255,255,0.06)',
  white: '#F1F5F9',
  white60: 'rgba(255,255,255,0.6)',
  white30: 'rgba(255,255,255,0.3)',
  white08: 'rgba(255,255,255,0.08)',
  white04: 'rgba(255,255,255,0.04)',
  red: '#EF4444',
  teal: '#14B8A6',
};

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
  { key: 'harassment', label: 'Taciz / Zorbalık', icon: 'sad-outline' },
  { key: 'hate_speech', label: 'Nefret Söylemi', icon: 'flame-outline' },
  { key: 'inappropriate_content', label: 'Uygunsuz İçerik', icon: 'eye-off-outline' },
  { key: 'impersonation', label: 'Kimliğe Bürünme', icon: 'person-outline' },
  { key: 'self_harm', label: 'Kendine Zarar Verme', icon: 'heart-dislike-outline' },
  { key: 'violence', label: 'Şiddet', icon: 'warning-outline' },
  { key: 'underage', label: 'Yaş Altı Kullanıcı', icon: 'alert-circle-outline' },
  { key: 'other', label: 'Diğer', icon: 'ellipsis-horizontal-outline' },
];

export function ReportModal({ visible, onClose, reporterId, target }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      showToast({ title: 'Bir sebep seçin', type: 'info' });
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
      showToast({ title: '✅ Raporunuz alındı', message: 'En kısa sürede incelenecektir.', type: 'success' });
      setSelectedReason(null);
      setDescription('');
      onClose();
    } catch (err: any) {
      showToast({ title: 'Hata', message: err.message || 'Rapor gönderilemedi.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const targetLabel =
    target.type === 'user' ? 'Kullanıcıyı' :
    target.type === 'room' ? 'Odayı' :
    target.type === 'post' ? 'Gönderiyi' : 'Mesajı';

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={sty.overlay}>
        <Pressable style={sty.backdrop} onPress={onClose} />
        <View style={sty.sheet}>
          {/* Handle */}
          <View style={sty.handle} />

          {/* Header */}
          <View style={sty.header}>
            <View style={sty.headerIcon}>
              <Ionicons name="flag" size={16} color={C.red} />
            </View>
            <Text style={sty.title}>{targetLabel} Rapor Et</Text>
            <TouchableOpacity onPress={onClose} style={sty.closeBtn}>
              <Ionicons name="close" size={16} color={C.white30} />
            </TouchableOpacity>
          </View>

          <ScrollView style={sty.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={sty.sectionLabel}>RAPORLAMA SEBEBİ</Text>

            {REASONS.map((reason) => {
              const selected = selectedReason === reason.key;
              return (
                <TouchableOpacity
                  key={reason.key}
                  style={[sty.reasonRow, selected && sty.reasonRowSelected]}
                  onPress={() => setSelectedReason(reason.key)}
                  activeOpacity={0.7}
                >
                  <View style={[sty.reasonIcon, selected && { backgroundColor: 'rgba(20,184,166,0.1)' }]}>
                    <Ionicons name={reason.icon as any} size={16} color={selected ? C.teal : C.white30} />
                  </View>
                  <Text style={[sty.reasonText, selected && sty.reasonTextSelected]}>
                    {reason.label}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={16} color={C.teal} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Açıklama */}
            <TextInput
              style={sty.descInput}
              placeholder="Ek açıklama (opsiyonel)..."
              placeholderTextColor={C.white30}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
            />

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={sending || !selectedReason}
              activeOpacity={0.7}
              style={[sty.submitBtn, (!selectedReason || sending) && { opacity: 0.4 }]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={14} color="#fff" />
                  <Text style={sty.submitText}>Rapor Gönder</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const sty = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: C.glass,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: H * 0.75,
    paddingBottom: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.white08,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: C.white, flex: 1, letterSpacing: 0.1 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.white04,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 10, fontWeight: '600', color: C.white30,
    letterSpacing: 1.5, marginTop: 16, marginBottom: 10, marginLeft: 4,
  },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 14, marginBottom: 4,
    backgroundColor: C.white04,
    borderWidth: 1, borderColor: 'transparent',
  },
  reasonRowSelected: {
    backgroundColor: 'rgba(20,184,166,0.06)',
    borderColor: 'rgba(20,184,166,0.2)',
  },
  reasonIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.white04,
    alignItems: 'center', justifyContent: 'center',
  },
  reasonText: { fontSize: 13, color: C.white60, fontWeight: '500' },
  reasonTextSelected: { color: C.teal, fontWeight: '600' },
  descInput: {
    marginTop: 12, padding: 14,
    backgroundColor: C.white04, borderRadius: 14,
    color: C.white, fontSize: 13,
    minHeight: 72, textAlignVertical: 'top',
    borderWidth: 1, borderColor: C.border,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 13, borderRadius: 99,
    backgroundColor: C.red,
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
