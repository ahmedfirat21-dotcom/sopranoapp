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
import { supabase } from '../constants/supabase';
import type { SubscriptionTier } from '../types';

// ═══ KONFİGÜRASYON ═══
export const REVENUECAT_MOCK_MODE = true;
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_REVENUECAT_API_KEY'; // Google Play
const REVENUECAT_API_KEY_IOS = 'appl_YOUR_REVENUECAT_API_KEY';     // App Store

// ═══ ENTITLEMENT → TIER MAPPING ═══
// RevenueCat Dashboard'daki entitlement ID'leri → SopranoChat tier'ları
const ENTITLEMENT_TO_TIER: Record<string, SubscriptionTier> = {
  'tier_bronze': 'Bronze',
  'tier_silver': 'Silver',
  'tier_gold': 'Gold',
  'tier_vip': 'VIP',
  'bronze': 'Bronze',
  'silver': 'Silver',
  'gold': 'Gold',
  'vip': 'VIP',
};

// ═══ PRODUCT ID'LER ═══
// Google Play Console'da tanımlanan ürün ID'leri
export const PRODUCT_IDS = {
  bronze_monthly: 'soprano_bronze_monthly',
  bronze_yearly: 'soprano_bronze_yearly',
  silver_monthly: 'soprano_silver_monthly',
  silver_yearly: 'soprano_silver_yearly',
  gold_monthly: 'soprano_gold_monthly',
  gold_yearly: 'soprano_gold_yearly',
  vip_monthly: 'soprano_vip_monthly',
  vip_yearly: 'soprano_vip_yearly',
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
          identifier: PRODUCT_IDS.bronze_monthly,
          title: 'Bronze Üyelik',
          description: 'Aylık Bronze abonelik',
          priceString: '₺49.99',
          price: 49.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_bronze',
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          identifier: PRODUCT_IDS.bronze_yearly,
          title: 'Bronze Üyelik (Yıllık)',
          description: 'Yıllık Bronze abonelik',
          priceString: '₺399.99',
          price: 399.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_bronze',
      },
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: PRODUCT_IDS.silver_monthly,
          title: 'Silver Üyelik',
          description: 'Aylık Silver abonelik',
          priceString: '₺99.99',
          price: 99.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_silver',
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          identifier: PRODUCT_IDS.silver_yearly,
          title: 'Silver Üyelik (Yıllık)',
          description: 'Yıllık Silver abonelik',
          priceString: '₺799.99',
          price: 799.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_silver',
      },
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: PRODUCT_IDS.gold_monthly,
          title: 'Gold Üyelik',
          description: 'Aylık Gold abonelik',
          priceString: '₺149.99',
          price: 149.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_gold',
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          identifier: PRODUCT_IDS.gold_yearly,
          title: 'Gold Üyelik (Yıllık)',
          description: 'Yıllık Gold abonelik',
          priceString: '₺1199.99',
          price: 1199.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_gold',
      },
      {
        identifier: '$rc_monthly',
        packageType: 'MONTHLY',
        product: {
          identifier: PRODUCT_IDS.vip_monthly,
          title: 'VIP Üyelik',
          description: 'Aylık VIP abonelik',
          priceString: '₺299.99',
          price: 299.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_vip',
      },
      {
        identifier: '$rc_annual',
        packageType: 'ANNUAL',
        product: {
          identifier: PRODUCT_IDS.vip_yearly,
          title: 'VIP Üyelik (Yıllık)',
          description: 'Yıllık VIP abonelik',
          priceString: '₺2399.99',
          price: 2399.99,
          currencyCode: 'TRY',
        },
        offeringIdentifier: 'tier_vip',
      },
    ],
  },
};

// ═══ REVENUECAT SERVİSİ ═══
export const RevenueCatService = {
  _initialized: false,
  _Purchases: null as any,

  /**
   * SDK'yı başlat — app mount'ta bir kez çağrılır.
   * Mock mode'da no-op.
   */
  async init(userId?: string): Promise<void> {
    if (REVENUECAT_MOCK_MODE) {
      if (__DEV__) {
        console.log('[RevenueCat] Mock mode — SDK başlatılmadı');
      } else {
        // ★ PRODUCTION GÜVENLİK UYARISI: Mock mode production build'de aktif!
        // Bu durum ödeme almadan tier yükseltmesi yapılmasına sebep olur.
        console.error(
          '\n' +
          '╔══════════════════════════════════════════════════════╗\n' +
          '║  ⚠️  REVENUECAT_MOCK_MODE = true (PRODUCTION!)     ║\n' +
          '║  Ödeme bypass riski! revenuecat.ts dosyasında       ║\n' +
          '║  REVENUECAT_MOCK_MODE = false yapın.                ║\n' +
          '╚══════════════════════════════════════════════════════╝\n'
        );
      }
      return;
    }
    if (this._initialized) return;

    try {
      const Purchases = require('react-native-purchases').default;
      this._Purchases = Purchases;

      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
      await Purchases.configure({ apiKey });

      if (userId) {
        await Purchases.logIn(userId);
      }

      this._initialized = true;
      if (__DEV__) console.log('[RevenueCat] SDK başlatıldı');
    } catch (e) {
      console.warn('[RevenueCat] SDK başlatma hatası:', e);
    }
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
      console.warn('[RevenueCat] identify hatası:', e);
    }
  },

  /**
   * Mevcut abonelik tekliflerini getir.
   * Mock mode'da sabit fiyat listesi döner.
   */
  async getOfferings(): Promise<typeof MOCK_OFFERINGS> {
    if (REVENUECAT_MOCK_MODE) return MOCK_OFFERINGS;
    try {
      const offerings = await this._Purchases.getOfferings();
      return offerings;
    } catch (e) {
      console.warn('[RevenueCat] getOfferings hatası:', e);
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
    if (REVENUECAT_MOCK_MODE) {
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
      console.warn('[RevenueCat] restore hatası:', e);
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
      console.warn('[RevenueCat] logout hatası:', e);
    }
  },

  // ═══ YARDIMCI ═══

  /**
   * CustomerInfo'dan en yüksek aktif tier'ı çıkar.
   * Birden fazla entitlement aktifse en yüksek olanı alır.
   */
  _extractTierFromCustomerInfo(customerInfo: any): SubscriptionTier | null {
    if (!customerInfo?.entitlements?.active) return null;

    const TIER_PRIORITY: SubscriptionTier[] = ['Free', 'Bronze', 'Silver', 'Gold', 'VIP'];
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
