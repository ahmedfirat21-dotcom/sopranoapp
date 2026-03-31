/**
 * SopranoChat — Raporlama Modal Bileşeni
 * Kullanıcı, oda, post veya mesaj raporlamak için
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, TextInput,
  ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius } from '../constants/theme';
import { ModerationService, ReportReason } from '../services/moderation';
import { showToast } from './Toast';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
        case 'user':
          await ModerationService.reportUser(reporterId, target.id, selectedReason, description);
          break;
        case 'room':
          await ModerationService.reportRoom(reporterId, target.id, selectedReason, description);
          break;
        case 'post':
          await ModerationService.reportPost(reporterId, target.id, selectedReason, description);
          break;
        case 'message':
          await ModerationService.reportMessage(reporterId, target.id, selectedReason, description);
          break;
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
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="flag" size={20} color={Colors.red} />
            <Text style={styles.title}>{targetLabel} Rapor Et</Text>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Raporlama sebebi:</Text>

            {REASONS.map((reason) => (
              <Pressable
                key={reason.key}
                style={[styles.reasonRow, selectedReason === reason.key && styles.reasonRowSelected]}
                onPress={() => setSelectedReason(reason.key)}
              >
                <Ionicons
                  name={reason.icon as any}
                  size={18}
                  color={selectedReason === reason.key ? Colors.teal : Colors.text3}
                />
                <Text style={[styles.reasonText, selectedReason === reason.key && styles.reasonTextSelected]}>
                  {reason.label}
                </Text>
                {selectedReason === reason.key && (
                  <Ionicons name="checkmark-circle" size={18} color={Colors.teal} style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            ))}

            {/* Açıklama (Diğer seçildiğinde veya her zaman) */}
            <TextInput
              style={styles.descInput}
              placeholder="Ek açıklama (opsiyonel)..."
              placeholderTextColor={Colors.text3}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={300}
            />

            {/* Submit */}
            <Pressable onPress={handleSubmit} disabled={sending || !selectedReason}>
              <LinearGradient
                colors={selectedReason ? ['#ef4444', '#dc2626'] : ['#333', '#444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.submitBtn, (!selectedReason || sending) && { opacity: 0.5 }]}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.submitText}>Rapor Gönder</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.bg2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingBottom: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.glassBorder,
    alignSelf: 'center', marginTop: 10, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  scrollContent: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.text2, marginTop: 16, marginBottom: 8 },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: Radius.default,
    marginBottom: 4,
    backgroundColor: Colors.bg3,
  },
  reasonRowSelected: { backgroundColor: `${Colors.teal}15`, borderWidth: 1, borderColor: Colors.teal },
  reasonText: { fontSize: 14, color: Colors.text2, fontWeight: '500' },
  reasonTextSelected: { color: Colors.teal, fontWeight: '600' },

  descInput: {
    marginTop: 12, padding: 14,
    backgroundColor: Colors.bg3, borderRadius: Radius.default,
    color: Colors.text, fontSize: 14,
    minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: Colors.glassBorder,
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingVertical: 14, borderRadius: Radius.full,
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
