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
import { i18n } from './i18n';

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
    logger.warn(i18n.t('auto.pushNotifications.014'), e);
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

    // Sadece gerçek cihazlarda çalışır (DEV mode'da Google Play'li emülatör için bypass)
    if (!Device.isDevice && !__DEV__) {
      if (__DEV__) console.log('Push bildirimler yalnızca gerçek cihazlarda çalışır.');
      return null;
    }
    if (!Device.isDevice && __DEV__) {
      if (__DEV__) console.log('[DEV] Emülatör algılandı — push token denenecek.');
    }

    // Expo Go'da (SDK 53+) push notification kurulumu uygulamayı çökertir, bu yüzden direkt atla
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      if (__DEV__) console.log('Expo Go (Store Client) kullanılıyor. Push Notifications test için atlandı.');
      return null;
    }

    if (!Notifications) {
      logger.warn(i18n.t('auto.pushNotifications.013'));
      return null;
    }

    // Mevcut izin durumunu kontrol et
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // İzin yoksa ve daha önce reddedilmemişse iste
    // ★ FIX: 'denied' ise tekrar sormak anlamsız — kullanıcı ayarlardan açmalı
    if (existingStatus !== 'granted') {
      if (existingStatus === 'denied') {
        logger.warn(i18n.t('auto.pushNotifications.012'));
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
        name: i18n.t('auto.pushNotifications.011'),
        description: i18n.t('auto.pushNotifications.010'),
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

      // ★ Sesli oda ongoing notification kanalı — düşük öncelik, ses/titreşim yok
      await Notifications.setNotificationChannelAsync('voice_room', {
        name: 'Sesli Oda',
        description: 'Sesli odada olduğunuzu gösteren bildirim',
        importance: Notifications.AndroidImportance.LOW,
        enableVibrate: false,
        sound: null,
        lightColor: '#14B8A6',
      });

      // ★ v1.7.13.146 (24 May 2026): Clubhouse-style canlı oda pill kanalı.
      //   DEFAULT importance — Samsung Now Bar / One UI canlı pill için gerekli.
      //   Ses/titreşim OFF; sadece görsel olarak prominent.
      await Notifications.setNotificationChannelAsync('voice_room_live', {
        name: 'Canlı Sesli Oda',
        description: 'Odadayken arka planda canlı durum pill',
        importance: Notifications.AndroidImportance.DEFAULT,
        enableVibrate: false,
        sound: null,
        lightColor: '#14B8A6',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: false,
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

    // ★ Sesli oda bildirim category — "Odadan Ayrıl" butonu
    await this.registerVoiceRoomCategory();

    // ★ 2026-05-09 FCM v1 MIGRATION: Eski credentials zamanından kalan tokenlar Expo backend'inde
    //   FCM v1 service account ile bağlanmamış → tüm push'lar DeviceNotRegistered ile fail.
    //   Bir kez unregister yapıp yeniden register ederek Expo'nun token'ı yeni credentials'a bağlamasını
    //   sağlıyoruz. AsyncStorage flag ile bir defa çalışır.
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const FCM_MIGRATION_FLAG = 'soprano_fcm_v1_migrated';
      const migrated = await AsyncStorage.getItem(FCM_MIGRATION_FLAG);
      if (migrated !== '1') {
        try {
          await Notifications.unregisterForNotificationsAsync();
          if (__DEV__) console.log('[Push] FCM v1 migration: eski token kaydı silindi.');
        } catch { /* unregister fail — devam */ }
        await AsyncStorage.setItem(FCM_MIGRATION_FLAG, '1');
      }
    } catch { /* migration fail — devam */ }

    // Expo Push Token al — projectId EAS project UUID
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'bbd97aec-9d58-426f-8acc-215b24ff286a',
      });
      return tokenData.data;
    } catch (error) {
      logger.warn(i18n.t('auto.pushNotifications.009'), error);
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
        logger.warn(i18n.t('auto.pushNotifications.008'), error.message);
      }
    } catch (err) {
      logger.error(i18n.t('auto.pushNotifications.007'), err);
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
        logger.warn(i18n.t('auto.pushNotifications.006'), error.message);
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
      i18n.t('auto.pushNotifications.005'),
      i18n.t('auto.pushNotifications.004', { 0: senderName }),
      { type: 'friend_request', senderId, screen: 'profile' }
    );
  },

  /**
   * Beğeni bildirimi
   */
  async notifyLike(senderName: string, postId: string) {
    await this.sendLocalNotification(
      i18n.t('auto.pushNotifications.003'),
      i18n.t('auto.pushNotifications.002', { 0: senderName }),
      { type: 'like', postId, screen: 'home' }
    );
  },

  /**
   * Oda daveti bildirimi
   */
  async notifyRoomInvite(hostName: string, roomName: string, roomId: string) {
    await this.sendLocalNotification(
      '🎙️ Oda Daveti',
      i18n.t('auto.pushNotifications.001', { 0: hostName, 1: roomName }),
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

  /**
   * ★ Sesli oda ongoing notification — arka planda "Şuan sesli odadasınız" gösterir.
   *   Kullanıcı odadayken üst bildirim çubuğunda kalıcı bildirim.
   *   Clubhouse paritesi: oda adı, konuşmacılar, dinleyici sayısı.
   */
  VOICE_ROOM_NOTIF_ID: 'soprano_voice_room_ongoing',

  async showVoiceRoomNotification(
    roomName: string,
    roomId: string,
    speakers?: string[],
    listenerCount?: number,
  ) {
    if (!Notifications) return;
    if (Platform.OS !== 'android') return; // iOS'ta ongoing notification yok
    // ★ v1.7.13.146 (24 May 2026): App foreground'dayken gösterme — kullanıcı zaten oda
    //   içinde, üst notification pill (Samsung Now Bar dahil) gereksiz. AppState listener
    //   (room/[id].tsx) background'a geçtiğinde tekrar çağırır.
    try {
      const { AppState } = require('react-native');
      if (AppState.currentState === 'active') return;
    } catch { /* AppState alınamazsa eski davranış */ }

    // ★ v1.7.13.146 (24 May 2026): Clubhouse-style minimal pill metni.
    //   "🔴 CANLI" prefix + dinleyici sayısı. Konuşmacı isimleri kaldırıldı
    //   (Samsung Now Bar 1 satır kısaltma yapıyor, isimler kesiliyordu).
    let body = '🔴 CANLI';
    if (listenerCount && listenerCount > 0) {
      body += ` · ${listenerCount} dinleyici`;
    }
    if (speakers && speakers.length > 0) {
      body += ` · ${speakers.length} konuşmacı`;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: this.VOICE_ROOM_NOTIF_ID,
        content: {
          title: roomName || 'Sesli Oda',
          body,
          subtitle: 'SopranoChat sesli oda', // iOS subtitle / Android subText
          data: { type: 'voice_room_ongoing', roomId },
          sound: false,
          sticky: true, // ongoing — kullanıcı kaydırarak kapatamaz
          autoDismiss: false,
          categoryIdentifier: 'voice_room_actions',
          color: '#14B8A6', // ★ SopranoChat teal — ikon aksan rengi (Samsung Now Bar pill rengi)
          ...(Platform.OS === 'android' ? { channelId: 'voice_room_live' } : {}),
        },
        trigger: null,
      });
    } catch (e) {
      if (__DEV__) console.warn('[Push] Voice room notification error:', e);
    }
  },

  async dismissVoiceRoomNotification() {
    if (!Notifications) return;
    try {
      await Notifications.dismissNotificationAsync(this.VOICE_ROOM_NOTIF_ID);
    } catch {}
    try {
      await Notifications.cancelScheduledNotificationAsync(this.VOICE_ROOM_NOTIF_ID);
    } catch {}
  },

  /**
   * ★ voice_room_actions category — "Odadan Ayrıl" action butonu
   *   registerForPushNotifications() içinde çağrılmalı.
   */
  async registerVoiceRoomCategory() {
    if (!Notifications) return;
    try {
      await Notifications.setNotificationCategoryAsync('voice_room_actions', [
        {
          identifier: 'leave_room',
          buttonTitle: '✕ Odadan Ayrıl',
          options: { opensAppToForeground: false, isDestructive: true },
        },
      ]);
    } catch (e) {
      if (__DEV__) console.warn('[Push] Voice room category error:', e);
    }
  },
};
