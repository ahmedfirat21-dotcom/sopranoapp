/**
 * SopranoChat — Push Bildirim Servisi
 * Expo Notifications + Supabase entegrasyonu
 * 
 * Bu servis:
 * 1. Kullanıcıdan bildirim izni ister
 * 2. Expo Push Token'ı alır ve Supabase'e kaydeder
 * 3. Yerel (local) bildirimler planlar
 * 4. Gelen bildirimlere tepki verir (navigasyon vb.)
 */
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../constants/supabase';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    // Bildirim geldiğinde uygulamanın nasıl davranacağını belirle
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.warn('expo-notifications yüklenirken hata oluştu:', e);
  }
}

export const PushNotificationService = {
  /**
   * Bildirim izni iste ve Expo Push Token al
   * Gerçek cihazlarda çalışır (emülatörde çalışmaz)
   */
  async registerForPushNotifications(): Promise<string | null> {
    // Web'de push notification desteklenmiyor
    if (Platform.OS === 'web') {
      if (__DEV__) console.log('Push bildirimler web ortamında desteklenmiyor.');
      return null;
    }

    // Sadece gerçek cihazlarda çalışır
    if (!Device.isDevice) {
      if (__DEV__) console.log('Push bildirimler yalnızca gerçek cihazlarda çalışır.');
      return null;
    }

    // Expo Go'da (SDK 53+) push notification kurulumu uygulamayı çökertir, bu yüzden direkt atla
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      if (__DEV__) console.log('Expo Go (Store Client) kullanılıyor. Push Notifications test için atlandı.');
      return null;
    }

    if (!Notifications) {
      console.warn('Notifications modülü henüz yüklenmemiş.');
      return null;
    }

    // Mevcut izin durumunu kontrol et
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // İzin yoksa iste
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Bildirim izni reddedildi.');
      return null;
    }

    // Android için bildirim kanalı oluştur
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SopranoChat',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#14B8A6', // Teal
      });

      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Mesajlar',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#14B8A6',
      });

      await Notifications.setNotificationChannelAsync('social', {
        name: 'Sosyal',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#3B82F6',
      });
    }

    // Expo Push Token al
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'sopranochat-5738e',
      });
      return tokenData.data;
    } catch (error) {
      console.warn('Push token alınamadı (Emulator veya yetkisiz cihaz olabilir):', error);
      return null;
    }
  },

  /**
   * Push token'ı Supabase'deki profil tablosuna kaydet
   */
  async savePushToken(userId: string, token: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);
      
      if (error) {
        console.warn('Push token kayıt hatası:', error.message);
      }
    } catch (err) {
      console.error('Push token kayıt hatası:', err);
    }
  },

  /**
   * Yerel bildirim gönder (uygulama açıkken bile gösterilir)
   */
  async sendLocalNotification(title: string, body: string, data?: Record<string, any>) {
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null, // Hemen göster
    });
  },

  /**
   * Yeni mesaj bildirimi
   */
  async notifyNewMessage(senderName: string, messagePreview: string, senderId: string) {
    await this.sendLocalNotification(
      `💬 ${senderName}`,
      messagePreview.length > 60 ? messagePreview.slice(0, 60) + '...' : messagePreview,
      { type: 'new_message', senderId, screen: 'chat' }
    );
  },

  /**
   * Arkadaşlık isteği bildirimi
   */
  async notifyFriendRequest(senderName: string, senderId: string) {
    await this.sendLocalNotification(
      '🤝 Yeni Arkadaşlık İsteği',
      `${senderName} sana arkadaşlık isteği gönderdi.`,
      { type: 'friend_request', senderId, screen: 'profile' }
    );
  },

  /**
   * Beğeni bildirimi
   */
  async notifyLike(senderName: string, postId: string) {
    await this.sendLocalNotification(
      '❤️ Paylaşımın beğenildi!',
      `${senderName} gönderini beğendi.`,
      { type: 'like', postId, screen: 'home' }
    );
  },

  /**
   * Oda daveti bildirimi
   */
  async notifyRoomInvite(hostName: string, roomName: string, roomId: string) {
    await this.sendLocalNotification(
      '🎙️ Oda Daveti',
      `${hostName} seni "${roomName}" odasına davet etti.`,
      { type: 'room_invite', roomId, screen: 'room' }
    );
  },

  /**
   * Tüm zamanlanmış bildirimleri iptal et
   */
  async cancelAll() {
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  /**
   * Badge sayısını güncelle
   */
  async setBadgeCount(count: number) {
    if (!Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  },

  /**
   * Bildirim Tıklama Dinleyicisi
   */
  addResponseListener(callback: (response: any) => void) {
    if (!Notifications) return null;
    return Notifications.addNotificationResponseReceivedListener(callback);
  },
};
