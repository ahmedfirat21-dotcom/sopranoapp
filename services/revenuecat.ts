/**
 * RevenueCat Service — Production-Ready
 * ═══════════════════════════════════════════════════
 * Google Play / App Store abonelik yönetimi.
 * 
 * Mock mode aktifken gerçek SDK çağrılmaz — test/development ortamında çalışır.
 * Production'a geçerken:
 * 1. `npm install react-native-purchases` 
 * 2. RevenueCat Dashboard'dan API key al
 * 3. REVENUECAT_API_KEY'i gerçek key ile değiştir
 * 4. REVENUECAT_MOCK_MODE = false yap
 */
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import type { SubscriptionTier } from '../types';

// ═══ KONFİGÜRASYON ═══
// ★ RevenueCat henüz yapılandırılmadıysa production'da da mock mode kullanılır.
//   Gerçek API key alındığında REVENUECAT_MOCK_MODE = false yapılmalıdır.
const REVENUECAT_API_KEY_ANDROID = 'goog_VotOQmvKFoUfgzcHnZGoEjKImso'; // Google Play — RevenueCat Dashboard'dan alındı
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_REVENUECAT_API_KEY';     // App Store — iOS desteği eklendiğinde güncellenecek

const _hasRealKey = !REVENUECAT_API_KEY_ANDROID.includes('YOUR_') || !REVENUECAT_API_KEY_IOS.includes('YOUR_');
export const REVENUECAT_MOCK_MODE = !_hasRealKey; // Gerçek key yoksa otomatik mock mode

// Production'da placeholder key varsa sadece uyarı ver (crash yapma)
if (!__DEV__ && !_hasRealKey) {
  console.warn('[RevenueCat] Placeholder API key — mock mode aktif. Gerçek ödeme sistemi devre dışı.');
}

// ═══ ENTITLEMENT → TIER MAPPING ═══
// RevenueCat Dashboard'daki entitlement ID'leri → SopranoChat tier'ları
const ENTITLEMENT_TO_TIER: Record<string, SubscriptionTier> = {
  // ★ Aktif ürünler (3-tier: Free / Plus / Pro)
  'tier_plus': 'Plus',
  'tier_pro': 'Pro',
  'plus': 'Plus',
  'pro': 'Pro',
  // ★ Legacy migration (eski 5-tier → 3-tier) — eski entitlement'lar expire olunca kaldırılacak
  'tier_bronze': 'Plus',
  'tier_silver': 'Plus',
  'tier_gold': 'Pro',
  'tier_vip': 'Pro',
  'bronze': 'Plus',
  'silver': 'Plus',
  'gold': 'Pro',
  'vip': 'Pro',
};

// ═══ PRODUCT ID'LER ═══
// Google Play Console'da tanımlanan ürün ID'leri
export const PRODUCT_IDS = {
  plus_monthly: 'soprano_plus_monthly',
  plus_yearly: 'soprano_plus_yearly',
  pro_monthly: 'soprano_pro_monthly',
  pro_yearly: 'soprano_pro_yearly',
} as const;

// ═══ MOCK DATA ═══
const MOCK_OFFERINGS = {
  current: {
    identifier: 'default',
    availablePackages: [
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: PRODUCT_IDS.plus_monthly,
          title: 'Plus Üyelik',
          description: 'Aylık Plus abonelik',
          priceString: '₺39.99',
          price: 39.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_plus',
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          identifier: PRODUCT_IDS.plus_yearly,
          title: 'Plus Üyelik (Yıllık)',
          description: 'Yıllık Plus abonelik',
          priceString: '₺349.99',
          price: 349.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_plus',
      },
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: PRODUCT_IDS.pro_monthly,
          title: 'Pro Üyelik',
          description: 'Aylık Pro abonelik',
          priceString: '₺99.99',
          price: 99.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_pro',
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          identifier: PRODUCT_IDS.pro_yearly,
          title: 'Pro Üyelik (Yıllık)',
          description: 'Yıllık Pro abonelik',
          priceString: '₺899.99',
          price: 899.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_pro',
      },
    ],
  },
};

// ═══ REVENUECAT SERVİSİ ═══
export const RevenueCatService = {
  _initialized: false,
  _Purchases: null as any,
  _initPromise: null as Promise<void> | null,
  _dashboardEmpty: false, // ★ Dashboard'da ürün yoksa true — mock offerings kullanılır

  /**
   * SDK'yı başlat — app mount'ta bir kez çağrılır.
   * Mock mode'da no-op. Promise kaydedilir, purchasePackage await eder.
   */
  async init(userId?: string): Promise<void> {
    if (REVENUECAT_MOCK_MODE) {
      if (__DEV__) logger.log('[RevenueCat] Mock mode — SDK başlatılmadı');
      return;
    }
    if (this._initialized) return;
    // Çift çağrı koruması — aynı promise döner
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        const Purchases = require('react-native-purchases').default;
        this._Purchases = Purchases;

        const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
        await Purchases.configure({ apiKey });

        if (userId) {
          await Purchases.logIn(userId);
        }

        this._initialized = true;
        if (__DEV__) logger.log('[RevenueCat] SDK başlatıldı');

        // ★ Offerings pre-fetch — Dashboard'da ürün yoksa sessizce mock'a düş
        try {
          const offerings = await Purchases.getOfferings();
          if (!offerings?.current?.availablePackages?.length) {
            logger.warn('[RevenueCat] Dashboard\'da offering/ürün bulunamadı — mock offerings kullanılacak');
            this._dashboardEmpty = true;
          }
        } catch {
          // ConfigurationError (no products registered) — sessiz yakalama
          this._dashboardEmpty = true;
        }
      } catch (e) {
        this._initPromise = null; // Hata durumunda tekrar denenebilsin
        logger.warn('[RevenueCat] SDK başlatma hatası:', e);
      }
    })();
    return this._initPromise;
  },

  /**
   * Kullanıcı kimliğini RevenueCat ile senkronize et.
   * Firebase UID → RevenueCat appUserId.
   */
  async identify(userId: string): Promise<void> {
    if (REVENUECAT_MOCK_MODE || !this._Purchases) return;
    try {
      await this._Purchases.logIn(userId);
    } catch (e) {
      logger.warn('[RevenueCat] identify hatası:', e);
    }
  },

  /**
   * Mevcut abonelik tekliflerini getir.
   * Mock mode'da sabit fiyat listesi döner.
   */
  async getOfferings(): Promise<typeof MOCK_OFFERINGS> {
    if (REVENUECAT_MOCK_MODE || this._dashboardEmpty) return MOCK_OFFERINGS;
    try {
      const offerings = await this._Purchases.getOfferings();
      return offerings;
    } catch (e) {
      logger.warn('[RevenueCat] getOfferings hatası:', e);
      return MOCK_OFFERINGS; // Fallback
    }
  },

  /**
   * Paket satın al — Google Play / App Store ödeme akışını tetikler.
   * Mock mode'da direkt Supabase update yapar.
   * 
   * @returns Yeni tier veya null (iptal/hata)
   */
  async purchasePackage(
    pkg: any,
    userId: string,
    targetTier: SubscriptionTier,
  ): Promise<{ newTier: SubscriptionTier | null; error?: string }> {
    if (REVENUECAT_MOCK_MODE || this._dashboardEmpty) {
      // Mock: direkt DB güncelle
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ subscription_tier: targetTier })
          .eq('id', userId);
        if (error) throw error;
        return { newTier: targetTier };
      } catch (e: any) {
        return { newTier: null, error: e.message };
      }
    }

    // SDK init tamamlanana kadar bekle
    if (this._initPromise) await this._initPromise;
    if (!this._Purchases) return { newTier: null, error: 'RevenueCat SDK hazır değil' };

    try {
      const { customerInfo } = await this._Purchases.purchasePackage(pkg);
      const newTier = this._extractTierFromCustomerInfo(customerInfo);
      
      // DB'yi güncelle (webhook'a yedek olarak)
      if (newTier) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: newTier })
          .eq('id', userId);
      }

      return { newTier };
    } catch (e: any) {
      // Kullanıcı iptal etti
      if (e.userCancelled) {
        return { newTier: null };
      }
      return { newTier: null, error: e.message || 'Satın alma başarısız' };
    }
  },

  /**
   * Önceki satın almaları geri yükle.
   * Cihaz değişikliğinde veya yeniden kurulumda kullanılır.
   */
  async restorePurchases(userId: string): Promise<{ restoredTier: SubscriptionTier }> {
    if (REVENUECAT_MOCK_MODE) {
      return { restoredTier: 'Free' };
    }

    try {
      const { customerInfo } = await this._Purchases.restorePurchases();
      const tier = this._extractTierFromCustomerInfo(customerInfo);
      
      if (tier) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: tier })
          .eq('id', userId);
      }

      return { restoredTier: tier || 'Free' };
    } catch (e) {
      logger.warn('[RevenueCat] restore hatası:', e);
      return { restoredTier: 'Free' };
    }
  },

  /**
   * Mevcut abonelik durumunu kontrol et.
   * Backend webhook ile sync edilmiş olmalı — bu client-side doğrulama.
   */
  async checkSubscriptionStatus(userId: string): Promise<SubscriptionTier> {
    if (REVENUECAT_MOCK_MODE) {
      // DB'den mevcut tier'ı oku
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      return (data?.subscription_tier as SubscriptionTier) || 'Free';
    }

    try {
      const customerInfo = await this._Purchases.getCustomerInfo();
      return this._extractTierFromCustomerInfo(customerInfo) || 'Free';
    } catch {
      return 'Free';
    }
  },

  /**
   * Aboneliği iptal et.
   * Not: RevenueCat üzerinden abonelik iptali platform yönetim panelinden yapılır.
   * Bu fonksiyon sadece mock mode'da direkt DB günceller.
   */
  async cancelSubscription(userId: string): Promise<boolean> {
    if (REVENUECAT_MOCK_MODE) {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: 'Free' })
        .eq('id', userId);
      return !error;
    }

    // Gerçek modda: Kullanıcıyı platform abonelik yönetimine yönlendir
    try {
      const Linking = require('react-native').Linking;
      if (Platform.OS === 'android') {
        await Linking.openURL('https://play.google.com/store/account/subscriptions');
      } else {
        await Linking.openURL('https://apps.apple.com/account/subscriptions');
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Çıkış yap — RevenueCat oturumunu sıfırla.
   */
  async logout(): Promise<void> {
    if (REVENUECAT_MOCK_MODE || !this._Purchases) return;
    try {
      await this._Purchases.logOut();
    } catch (e) {
      logger.warn('[RevenueCat] logout hatası:', e);
    }
  },

  // ═══ YARDIMCI ═══

  /**
   * CustomerInfo'dan en yüksek aktif tier'ı çıkar.
   * Birden fazla entitlement aktifse en yüksek olanı alır.
   */
  _extractTierFromCustomerInfo(customerInfo: any): SubscriptionTier | null {
    if (!customerInfo?.entitlements?.active) return null;

    const TIER_PRIORITY: SubscriptionTier[] = ['Free', 'Plus', 'Pro'];
    let highestTier: SubscriptionTier | null = null;

    for (const [entitlementId] of Object.entries(customerInfo.entitlements.active)) {
      const mapped = ENTITLEMENT_TO_TIER[entitlementId];
      if (mapped) {
        const currentPriority = TIER_PRIORITY.indexOf(mapped);
        const highestPriority = highestTier ? TIER_PRIORITY.indexOf(highestTier) : -1;
        if (currentPriority > highestPriority) {
          highestTier = mapped;
        }
      }
    }

    return highestTier;
  },
};
