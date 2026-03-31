import { supabase } from '../constants/supabase';
import * as ImageManipulator from 'expo-image-manipulator';

export const StorageService = {
  /**
   * Universal upload function
   */
  async uploadFile(bucket: string, path: string, imageUri: string): Promise<string> {
    try {
      // 1. Resize image to optimize upload speed & storage space
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. Fetch the local file into a Blob
      const response = await fetch(manipResult.uri);
      const blob = await response.blob();

      // 3. Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: true, // Overwrite if same name
        });

      if (error) {
        throw error;
      }

      // 4. Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return publicUrlData.publicUrl;
    } catch (error: any) {
      console.error(`[StorageService] Upload Error to ${bucket}/${path}:`, error.message);
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
   * Delete a file from a specified bucket
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      console.error(`[StorageService] Delete Error in ${bucket}/${path}:`, error.message);
      throw error;
    }
  }
};
