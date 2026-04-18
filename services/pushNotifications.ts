/**
 * SopranoChat — Push INBOUND (device-side)
 * ═══════════════════════════════════════════════════
 * Bu servis: KENDİ cihazın için push setup yapar.
 *   1. İzin iste
 *   2. Expo Push Token al → profiles.push_token'a yaz
 *   3. Local notification scheduling
 *   4. Gelen push tap handler (route navigation)
 *
 * ★ push.ts ile KARIŞTIRMA:
 *   - services/push.ts                → OUTBOUND: başkalarına push gönder
 *   - services/pushNotifications.ts (bu) → INBOUND: kendi device setup'ı
 */
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../constants/supabase';
import { logger } from '../utils/logger';

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
    logger.warn('expo-notifications yüklenirken hata oluştu:', e);
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
      logger.warn('Notifications modülü henüz yüklenmemiş.');
      return null;
    }

    // Mevcut izin durumunu kontrol et
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // İzin yoksa ve daha önce reddedilmemişse iste
    // ★ FIX: 'denied' ise tekrar sormak anlamsız — kullanıcı ayarlardan açmalı
    if (existingStatus !== 'granted') {
      if (existingStatus === 'denied') {
        logger.warn('Bildirim izni daha önce reddedildi. Ayarlardan açılmalı.');
        return null;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('Bildirim izni reddedildi.');
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
      logger.warn('Push token alınamadı (Emulator veya yetkisiz cihaz olabilir):', error);
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
        logger.warn('Push token kayıt hatası:', error.message);
      }
    } catch (err) {
      logger.error('Push token kayıt hatası:', err);
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

  /**
   * Bildirim Alınma Dinleyicisi — uygulama ön plandayken gelen push bildirimleri
   */
  addReceivedListener(callback: (notification: any) => void) {
    if (!Notifications) return null;
    return Notifications.addNotificationReceivedListener(callback);
  },
};
