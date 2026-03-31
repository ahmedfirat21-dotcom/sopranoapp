/**
 * SopranoChat — Yeni Gönderi Oluşturma Bileşeni
 * Kullanıcının metin ve görselli gönderi paylaşmasını sağlar
 */
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Modal, ActivityIndicator, Image, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Radius } from '../constants/theme';
import { SocialService } from '../services/social';
import { showToast } from './Toast';
import * as ImagePicker from 'expo-image-picker';
import { StorageService } from '../services/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CreatePostModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userAvatar: string;
  userName: string;
  onPostCreated: () => void;
};

export function CreatePostModal({ visible, onClose, userId, userAvatar, userName, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      showToast({ title: 'Fotoğraf seçilemedi', type: 'error' });
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !imageUri) {
      showToast({ title: 'Bir şeyler yazın veya fotoğraf ekleyin!', type: 'info' });
      return;
    }

    setPosting(true);
    let uploadedUrl: string | undefined = undefined;

    try {
      // 1. Resim varsa önce Storage'a yükle
      if (imageUri) {
        showToast({ title: 'Resim yükleniyor...', type: 'info' });
        uploadedUrl = await StorageService.uploadPostImage(userId, imageUri);
      }

      // 2. Postu oluştur
      const result = await SocialService.createPost(userId, content.trim(), uploadedUrl);
      if (result.success) {
        showToast({ title: '📝 Gönderi paylaşıldı!', type: 'success' });
        setContent('');
        setImageUri(null);
        onPostCreated();
        onClose();
      } else {
        showToast({ title: 'Gönderi paylaşılamadı', message: result.error, type: 'error' });
      }
    } catch (err) {
      showToast({ title: 'Bir hata oluştu', type: 'error' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Yeni Gönderi</Text>
            <Pressable onPress={handlePost} disabled={posting || (!content.trim() && !imageUri)}>
              <LinearGradient
                colors={(content.trim() || imageUri) ? (Gradients.teal as [string, string]) : ['#333', '#444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.postBtn, (!content.trim() && !imageUri || posting) && { opacity: 0.5 }]}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.postBtnText}>Paylaş</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Kullanıcı bilgisi */}
          <View style={styles.userRow}>
            <Image source={{ uri: userAvatar || 'https://i.pravatar.cc/40?img=1' }} style={styles.userAvatar} />
            <Text style={styles.userName}>{userName}</Text>
          </View>

          {/* İçerik */}
          <TextInput
            style={styles.textInput}
            placeholder="Ne düşünüyorsun? 💭"
            placeholderTextColor={Colors.text3}
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            autoFocus
          />

          {/* Resim Önizleme */}
          {imageUri && (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <Pressable style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                <Ionicons name="close-circle" size={24} color={Colors.bg} />
              </Pressable>
            </View>
          )}

          {/* Alt araç çubuğu */}
          <View style={styles.toolbar}>
            <View style={styles.toolRow}>
              <Pressable style={styles.toolBtn} onPress={handlePickImage} disabled={posting}>
                <Ionicons name="image-outline" size={22} color={Colors.teal} />
                <Text style={styles.toolText}>Fotoğraf</Text>
              </Pressable>
              <Pressable style={styles.toolBtn} onPress={() => {
                Alert.alert('🎵 Müzik Ekle', 'Spotify/Apple Music arama altyapısı bir sonraki güncellemede kullanıma sunulacak.', [{ text: 'Anladım' }]);
              }}>
                <Ionicons name="musical-notes-outline" size={22} color={Colors.sapphire} />
                <Text style={styles.toolText}>Müzik</Text>
              </Pressable>
              <Pressable style={styles.toolBtn} onPress={() => {
                Alert.alert('📍 Konum Ekle', 'Konum paylaşımı için cihaz izinleri gerekecek.', [{ text: 'Anladım' }]);
              }}>
                <Ionicons name="location-outline" size={22} color={Colors.emerald} />
                <Text style={styles.toolText}>Konum</Text>
              </Pressable>
              <Pressable style={styles.toolBtn} onPress={() => {
                Alert.alert('🏷️ Etiket', 'Arkadaşlarını etiketleme özelliği hazırlanıyor.', [{ text: 'Anladım' }]);
              }}>
                <Ionicons name="pricetag-outline" size={22} color={Colors.gold} />
                <Text style={styles.toolText}>Etiket</Text>
              </Pressable>
            </View>
            <Text style={styles.charCount}>{content.length}/500</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.glass2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  postBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  postBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    paddingBottom: 34,
  },
  toolRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.default,
    backgroundColor: Colors.bg3,
  },
  toolText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text2,
  },
  charCount: {
    fontSize: 11,
    color: Colors.text3,
    textAlign: 'right',
  },
  imagePreviewWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    position: 'relative',
    height: 150,
    borderRadius: Radius.default,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.default,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});
