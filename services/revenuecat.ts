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
import Purchases from 'react-native-purchases';
import { logger } from '../utils/logger';
import { supabase } from '../constants/supabase';
import type { SubscriptionTier } from '../types';
import { i18n } from './i18n';

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
          title: i18n.t('auto.revenuecat.020'),
          description: i18n.t('auto.revenuecat.019'),
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
          title: i18n.t('auto.revenuecat.018'),
          description: i18n.t('auto.revenuecat.017'),
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
          title: i18n.t('auto.revenuecat.016'),
          description: i18n.t('auto.revenuecat.015'),
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
          title: i18n.t('auto.revenuecat.014'),
          description: i18n.t('auto.revenuecat.013'),
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
  // ★ v309 (18 May 2026): Init hatasını UI'a yansıtmak için public state.
  //   Sessiz fail RC ping göndermiyordu, "configuration error" UI'da görülüyor ama
  //   gerçek init error gizliydi. Şimdi Plus.tsx satın al başında bu state kontrol
  //   edilirse açıklayıcı mesaj kullanıcıya gider.
  _lastInitError: null as string | null,
  _lastOfferingsError: null as string | null,

  /**
   * ★ 2026-04-20: Abonelik satın alma şu an mümkün mü?
   * Dev'de her zaman true (mock ile test edilir).
   * Prod'da: gerçek key + Dashboard'da offering varsa true.
   * UI bu flag ile satın al butonunu enable/disable etmeli ve
   * "sistem hazır değil" uyarısı göstermeli.
   */
  isSubscriptionAvailable(): boolean {
    if (__DEV__) return true;
    // ★ v302 (18 May 2026): _dashboardEmpty kontrolü kaldırıldı — UI butonunu
    //   "current offering boş" diye kilitlemek yanlıştı. Asıl gereken: gerçek key
    //   var mı. Offering eksikse satın al butonuna basınca purchasePackage anında
    //   net error mesajı döner ('Plus için offering bulunamadı'), kullanıcı yine
    //   bilgilendirilir ama buton kullanılabilir kalır (Dashboard fix sonrası
    //   uygulama restart gerektirmesin diye).
    return _hasRealKey;
  },

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
        // ★ v309 (18 May 2026): require → top-level import. Hermes optimizer dinamik
        //   require'da react-native-purchases'ı silent fail ediyordu — last_seen_at
        //   RC customer records'da v1.3.97'de takılı kalmış, hiç ping atmamış. Top-level
        //   import static analysis ile native bindings doğru bağlanır.
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
            logger.warn(i18n.t('auto.revenuecat.012'));
            this._dashboardEmpty = true;
            this._lastOfferingsError = 'Offerings boş — Dashboard offering tanımlı değil veya app yapılandırma uyumsuz.';
          }
        } catch (e: any) {
          // ConfigurationError (no products registered) — sessiz yakalama
          this._dashboardEmpty = true;
          // ★ v309: Offerings hatasını state'e kaydet — Plus.tsx mesajına ekle.
          this._lastOfferingsError = String(e?.message || e || 'Unknown').slice(0, 200);
        }
      } catch (e: any) {
        this._initPromise = null; // Hata durumunda tekrar denenebilsin
        // ★ v309: Init hatasını state'e kaydet — Plus.tsx mesajına ekle.
        this._lastInitError = String(e?.message || e || 'Unknown').slice(0, 200);
        logger.warn(i18n.t('auto.revenuecat.011'), e);
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
      logger.warn(i18n.t('auto.revenuecat.010'), e);
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
      logger.warn(i18n.t('auto.revenuecat.009'), e);
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
    _pkgOrOpts: any,
    userId: string,
    targetTier: SubscriptionTier,
    billingCycle: 'monthly' | 'yearly' | 'annual' = 'monthly',
  ): Promise<{ newTier: SubscriptionTier | null; error?: string }> {
    // ★ Dev-only mock: geliştirme sırasında DB direct update ile test
    if (REVENUECAT_MOCK_MODE && __DEV__) {
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

    // ★ 2026-04-20 KRİTİK GUARD: Production'da RevenueCat yapılandırılmamışsa SATIN ALMA ENGELLE.
    //   Aksi halde kullanıcı ödeme yapmadan Plus/Pro tier alırdı.
    // ★ v302 (18 May 2026): `_dashboardEmpty` guard'ı KALDIRILDI — bu flag sadece
    //   "current" offering boş demek, ama Plus/Pro `all.default` / `all.pro` üzerinden
    //   de çözülebiliyor (lookup aşağıda). Eğer her ikisi de yoksa zaten offering!=null
    //   kontrolü doğal error mesajını döner. Mock guard yeterli.
    if (!__DEV__ && REVENUECAT_MOCK_MODE) {
      return {
        newTier: null,
        error: i18n.t('auto.revenuecat.008'),
      };
    }

    // SDK init tamamlanana kadar bekle
    if (this._initPromise) await this._initPromise;
    if (!this._Purchases) return { newTier: null, error: i18n.t('auto.revenuecat.007') };

    try {
      // ★ 2026-04-20: Doğru paketi RevenueCat offerings'ten çek.
      // default offering = Plus, 'pro' offering = Pro. Kullanıcı tier + billingCycle
      // kombinasyonuna göre monthly/annual paket seçilir.
      const offerings = await this._Purchases.getOfferings();
      const offeringId = targetTier === 'Pro' ? 'pro' : 'default';
      const offering = offerings?.all?.[offeringId] || (offeringId === 'default' ? offerings?.current : null);
      if (!offering) {
        return { newTier: null, error: i18n.t('auto.revenuecat.006', { 0: targetTier }) };
      }
      const isYearly = billingCycle === 'yearly' || billingCycle === 'annual';
      const packageToUse = isYearly ? offering.annual : offering.monthly;
      if (!packageToUse) {
        return { newTier: null, error: `${isYearly ? i18n.t('auto.revenuecat.005') : i18n.t('auto.revenuecat.004')} paket mevcut değil.` };
      }
      const { customerInfo } = await this._Purchases.purchasePackage(packageToUse);
      const newTier = this._extractTierFromCustomerInfo(customerInfo);

      // DB'yi güncelle (webhook'a yedek olarak)
      if (newTier) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: newTier })
          .eq('id', userId);
        // ★ Y3: Tier cache'i invalidate et — 5dk stale kalmasın, yeni tier hemen geçerli olsun
        try {
          const { invalidateTierCache } = require('./gamification');
          invalidateTierCache(userId);
        } catch { /* gamification import fail safe */ }
        // ★ 2026-04-26: Tier yükseltildiğinde mevcut odaların expires_at'ı yeni durationHours'a göre yenilensin.
        //   Pro/GodMaster → expires_at = NULL (sınırsız). Plus → 12 saatlik yeni süre.
        try {
          const { RoomService } = require('./database');
          await RoomService.refreshExpiresForTierChange(userId, newTier);
        } catch { /* sessiz — tier upgrade başarılı, refresh ek bonus */ }
      }

      return { newTier };
    } catch (e: any) {
      // Kullanıcı iptal etti
      if (e.userCancelled) {
        return { newTier: null };
      }
      return { newTier: null, error: e.message || i18n.t('auto.revenuecat.003') };
    }
  },

  /**
   * ★ v298 (17 May 2026): SP paket satın alma — Google Play consumable IAP.
   * Plus/Pro abonelikten farklı: tek seferlik tüketilebilir, balance'a SP ekler.
   *
   * Akış:
   *   1. RevenueCat purchaseProduct(productId) — Google Play receipt al
   *   2. Başarılı ise → Supabase RPC `purchase_sp_grant(user, package, txId)` çağır
   *   3. RPC DB'ye SP credit + sp_transactions log
   *   4. Cache invalidate + return
   *
   * Güvenlik notu: Post-launch RevenueCat webhook ile server-side validation
   * yapılmalı (şu an client'tan trust). Webhook fail-safe değil, ek koruma.
   */
  async purchaseSPPackage(
    userId: string,
    productId: string, // 'soprano_sp_100' vb.
  ): Promise<{ success: boolean; spAdded?: number; newBalance?: number; error?: string }> {
    if (REVENUECAT_MOCK_MODE && __DEV__) {
      // Dev mode'da fake purchase (test için)
      try {
        const { data, error } = await supabase.rpc('purchase_sp_grant', {
          p_user_id: userId,
          p_package_id: productId,
          p_transaction_id: 'mock_' + Date.now(),
        });
        if (error) return { success: false, error: error.message };
        const result = data as any;
        if (!result?.success) return { success: false, error: result?.error || 'unknown' };
        return { success: true, spAdded: result.sp_added, newBalance: result.new_balance };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }

    // ★ v302 (18 May 2026): _dashboardEmpty guard'ı SP'den KALDIRILDI.
    //   Bu flag init'te `offerings.current.availablePackages.length` kontrolüyle
    //   set ediliyor — yani "abonelik current offering boş mu" demek. SP paketleri
    //   purchaseProduct(productId) ile DİREKT product'a gidiyor, offering kullanmıyor.
    //   Dolayısıyla abonelik offering eksik diye SP satın alma engellenmemeli;
    //   Google Billing ürün yoksa kendi hatasını ('ITEM_UNAVAILABLE') döner ve
    //   error message kullanıcıya net gösterilir.
    if (!__DEV__ && REVENUECAT_MOCK_MODE) {
      return { success: false, error: 'RevenueCat yapılandırılmamış. SP satın alma kullanılamıyor.' };
    }

    if (this._initPromise) await this._initPromise;
    if (!this._Purchases) return { success: false, error: 'Satın alma sistemi hazır değil.' };

    try {
      // RevenueCat purchaseProduct ile consumable product al
      // Not: subscription product'lardan farklı, purchaseProduct kullanılır
      const { customerInfo, productIdentifier, transactionIdentifier } =
        await this._Purchases.purchaseProduct(productId, null, 'INAPP' as any);

      if (!transactionIdentifier) {
        return { success: false, error: 'Transaction ID alınamadı.' };
      }

      // DB'ye SP credit + log
      const { data, error } = await supabase.rpc('purchase_sp_grant', {
        p_user_id: userId,
        p_package_id: productId,
        p_transaction_id: transactionIdentifier,
      });

      if (error) return { success: false, error: error.message };
      const result = data as any;
      if (!result?.success) return { success: false, error: result?.error || 'unknown' };

      return { success: true, spAdded: result.sp_added, newBalance: result.new_balance };
    } catch (e: any) {
      // Kullanıcı iptal etti
      if (e.userCancelled) return { success: false, error: 'iptal_edildi' };
      return { success: false, error: e.message || 'Satın alma hatası.' };
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
    // ★ v302 (18 May 2026): _dashboardEmpty kontrolü kaldırıldı — restorePurchases
    //   `customerInfo`'yu döner (kullanıcının önceki satın almaları). Bu offering
    //   listesinden bağımsızdır. Dashboard'da offering olmasa bile geçmiş satın
    //   alma varsa restore edilebilir.

    try {
      const { customerInfo } = await this._Purchases.restorePurchases();
      const tier = this._extractTierFromCustomerInfo(customerInfo);

      if (tier) {
        await supabase
          .from('profiles')
          .update({ subscription_tier: tier })
          .eq('id', userId);
      }
      // ★ Y3: Restore sonrası cache invalidate — tier değişmiş olabilir
      try {
        const { invalidateTierCache } = require('./gamification');
        invalidateTierCache(userId);
      } catch {}

      return { restoredTier: tier || 'Free' };
    } catch (e) {
      logger.warn(i18n.t('auto.revenuecat.002'), e);
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
      // ★ Y3: Downgrade sonrası tier cache temizle — premium feature'lar hemen kilitlensin
      try {
        const { invalidateTierCache } = require('./gamification');
        invalidateTierCache(userId);
      } catch {}
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
      logger.warn(i18n.t('auto.revenuecat.001'), e);
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
