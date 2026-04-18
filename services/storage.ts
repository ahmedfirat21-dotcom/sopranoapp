import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// ★ SEC-STORAGE: Upload boyut limitleri
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_VOICE_SIZE = 5 * 1024 * 1024;   // 5MB

async function _validateFileSize(uri: string, maxBytes: number, label: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && (info as any).size && (info as any).size > maxBytes) {
      const sizeMB = ((info as any).size / (1024 * 1024)).toFixed(1);
      const limitMB = (maxBytes / (1024 * 1024)).toFixed(0);
      throw new Error(`${label} çok büyük (${sizeMB}MB). Maksimum: ${limitMB}MB`);
    }
  } catch (e: any) {
    // getInfoAsync hatası durumunda devam et — Supabase kendi limitini de uygular
    if (e.message?.includes('çok büyük')) throw e;
  }
}

export const StorageService = {
  /**
   * Universal upload function — React Native uyumlu (base64 → ArrayBuffer)
   */
  async uploadFile(bucket: string, path: string, imageUri: string): Promise<string> {
    try {
      // ★ SEC-STORAGE: Upload öncesi boyut kontrolü
      await _validateFileSize(imageUri, MAX_IMAGE_SIZE, 'Dosya');

      // 1. Resize image to optimize upload speed & storage space
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. Read the file as base64 string (React Native uyumlu yöntem)
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. Decode base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // 4. Upload to Supabase Storage
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // 5. Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return publicUrlData.publicUrl;
    } catch (error: any) {
      logger.error(`[StorageService] Upload Error to ${bucket}/${path}:`, error.message);
      throw error;
    }
  },

  /**
   * Upload an avatar to the 'avatars' bucket
   */
  async uploadAvatar(userId: string, imageUri: string): Promise<string> {
    const timestamp = new Date().getTime();
    const path = `${userId}/${timestamp}.jpg`;
    return await this.uploadFile('avatars', path, imageUri);
  },

  /**
   * Upload a post image to the 'post-images' bucket
   */
  async uploadPostImage(userId: string, imageUri: string): Promise<string> {
    const timestamp = new Date().getTime();
    const path = `${userId}/${timestamp}.jpg`;
    return await this.uploadFile('post-images', path, imageUri);
  },

  /**
   * Upload a chat image — 'post-images' bucket kullanır
   */
  async uploadChatImage(userId: string, imageUri: string): Promise<string> {
    const timestamp = new Date().getTime();
    const path = `chat/${userId}/${timestamp}.jpg`;
    return await this.uploadFile('post-images', path, imageUri);
  },

  /**
   * Delete a file from a specified bucket
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      logger.error(`[StorageService] Delete Error in ${bucket}/${path}:`, error.message);
      throw error;
    }
  },

  /**
   * Upload a voice note (audio file) — ImageManipulator kullanmaz
   */
  async uploadVoiceNote(userId: string, audioUri: string): Promise<string> {
    try {
      // ★ SEC-STORAGE: Ses dosyası boyut kontrolü (max 5MB)
      await _validateFileSize(audioUri, MAX_VOICE_SIZE, 'Ses dosyası');

      const timestamp = new Date().getTime();
      const path = `${userId}/voice_${timestamp}.m4a`;

      // Ses dosyasını base64 olarak oku (resim işleme yok!)
      const base64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = decode(base64);

      const { error } = await supabase.storage
        .from('voice-notes')
        .upload(path, arrayBuffer, {
          contentType: 'audio/mp4',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('voice-notes')
        .getPublicUrl(path);

      return publicUrlData.publicUrl;
    } catch (error: any) {
      logger.error(`[StorageService] Voice Upload Error:`, error.message);
      throw error;
    }
  }
};
