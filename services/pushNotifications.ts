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
    // ★ Bildirim ayarlarına saygı: kullanıcı Ayarlar > Bildirimler'den kapattıysa
    //   ana toggle=false → sessize al; ses/titreşim alt-toggle'ları ayrı kontrol.
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        let enabled = true;
        let sound = true;
        let vibration = true;
        try {
          const { SettingsService } = require('./settings');
          const s = await SettingsService.get();
          enabled = s.notifications_enabled !== false;
          sound = enabled && s.notification_sound !== false;
          vibration = enabled && s.notification_vibration !== false;
        } catch { /* ayarlar okunamazsa varsayılan: açık */ }

        if (!enabled) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }
        return {
          shouldShowAlert: true,
          shouldPlaySound: sound,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          // vibration için iOS-Android farkı: iOS otomatik, Android channel-level.
          // channel'da vibrationPattern zaten set edilmiyor → uygulama seviyesinde
          // flag persist eder, native channel kontrolü ileride ayrı ele alınacak.
          _vibration: vibration,
        } as any;
      },
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

      // ★ 2026-04-21: "calls" kanalı — WhatsApp tarzı telefon kilitliyken bile çalar.
      //   MAX importance + bypass DnD + uzun titreşim + varsayılan zil sesi.
      //   Full-screen intent için channel importance MAX olması gerekir.
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Sesli/Görüntülü Arama',
        description: 'Gelen aramalar — telefon kilitliyken de çalar',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800],
        lightColor: '#14B8A6',
        sound: 'default', // Sistem zil sesini kullan
        bypassDnd: true,  // Rahatsız Etme modunu bypass et
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });
    }

    // ★ 2026-04-21: iOS + Android notification category — Kabul/Ret action butonları push'ta
    try {
      await Notifications.setNotificationCategoryAsync('incoming_call', [
        {
          identifier: 'accept_call',
          buttonTitle: '✓ Kabul Et',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'reject_call',
          buttonTitle: '✕ Reddet',
          options: { opensAppToForeground: false, isDestructive: true },
        },
      ]);
    } catch (catErr) {
      if (__DEV__) logger.warn('[Push] Notification category set hatası:', catErr);
    }

    // Expo Push Token al
    // ★ CRITICAL FIX 2026-04-25: projectId Firebase project değil EAS project UUID olmalı.
    //   Eski 'sopranochat-5738e' (Firebase) Expo'nun expected uuid format'ı geçmediği için
    //   token getirme hep fail edip catch'lenmiş — push notifications hiç çalışmıyor olabilir.
    //   app.json#extra.eas.projectId ile uyumlu.
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'bbd97aec-9d58-426f-8acc-215b24ff286a',
      });
      return tokenData.data;
    } catch (error) {
      logger.warn('Push token alınamadı (Emulator veya yetkisiz cihaz olabilir):', error);
      return null;
    }
  },

  /**
   * Push token'ı Supabase push_tokens tablosuna kaydet (multi-device destekli).
   * ★ v78: profiles.push_token yerine ayrı push_tokens tablosu kullanılıyor.
   *   Aynı (user_id, token) çifti varsa updated_at güncellenir (upsert).
   */
  async savePushToken(userId: string, token: string) {
    try {
      const platform = Platform.OS === 'android' ? 'android'
                     : Platform.OS === 'ios' ? 'ios'
                     : 'unknown';

      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          { user_id: userId, token, platform },
          { onConflict: 'user_id,token' }
        );

      if (error) {
        logger.warn('Push token kayıt hatası:', error.message);
      }
    } catch (err) {
      logger.error('Push token kayıt hatası:', err);
    }
  },

  /**
   * Logout veya cihaz değişikliğinde mevcut token'ı sil.
   * ★ v78: Stale token birikmesini önler.
   */
  async removePushToken(userId: string, token: string) {
    try {
      const { error } = await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', token);

      if (error && __DEV__) {
        logger.warn('Push token silme hatası:', error.message);
      }
    } catch (err) {
      if (__DEV__) logger.error('Push token silme hatası:', err);
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
