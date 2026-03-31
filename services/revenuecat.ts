let Purchases: any;
try {
  Purchases = require('react-native-purchases').default;
} catch (e) {
  Purchases = null;
}
import { Platform } from 'react-native';
import { supabase } from '../constants/supabase';

// REVENUECAT_MOCK_MODE: True olduğunda gerçek API yerine sahte verilerle test edilir.
// Gerçek satın alma için:
// 1. https://app.revenuecat.com adresinden proje oluşturun
// 2. Apple/Google API key'lerini aşağıya yapıştırın
// 3. REVENUECAT_MOCK_MODE'u false yapın
export const REVENUECAT_MOCK_MODE = true;

const API_KEYS = {
  apple: "public_apple_api_key_here",   // RevenueCat → Project → API Keys → Apple
  google: "public_google_api_key_here", // RevenueCat → Project → API Keys → Google
};

export const RevenueCatService = {
  async configure(userId: string) {
    if (REVENUECAT_MOCK_MODE) {
      console.log('RevenueCat MOCK MODE başlatıldı. User:', userId);
      return;
    }
    
    try {
      if (!Purchases) return;
      if (Platform.OS === 'ios') {
        Purchases.configure({ apiKey: API_KEYS.apple, appUserID: userId });
      } else if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: API_KEYS.google, appUserID: userId });
      }
    } catch (e) {
      console.warn('RevenueCat Init Hatası:', e);
    }
  },

  async getOfferings() {
    if (REVENUECAT_MOCK_MODE) {
      return {
        current: {
          availablePackages: [
            {
              identifier: '$rc_monthly',
              packageType: 'MONTHLY',
              product: {
                identifier: 'soprano_plus_monthly',
                description: 'Özel temalar, Premium rozet, Reklamsız deneyim.',
                title: 'SopranoChat Plus (1 Ay)',
                price: 99.99,
                priceString: '₺99.99',
                currencyCode: 'TRY'
              }
            },
            {
              identifier: 'coin_pack_100',
              packageType: 'CUSTOM',
              product: {
                identifier: 'soprano_coins_100',
                description: 'Bir kaç hediye gönder',
                title: '100 Jeton',
                price: 9.99,
                priceString: '₺9.99',
                currencyCode: 'TRY'
              }
            },
            {
              identifier: 'coin_pack_500',
              packageType: 'CUSTOM',
              product: {
                identifier: 'soprano_coins_500',
                description: 'Popüler paket — %10 bonus',
                title: '500 Jeton',
                price: 44.99,
                priceString: '₺44.99',
                currencyCode: 'TRY'
              }
            },
            {
              identifier: 'coin_pack_1200',
              packageType: 'CUSTOM',
              product: {
                identifier: 'soprano_coins_1200',
                description: '200 bonus jeton! — %20 bonus',
                title: '1200 Jeton',
                price: 89.99,
                priceString: '₺89.99',
                currencyCode: 'TRY'
              }
            },
            {
              identifier: 'coin_pack_2500',
              packageType: 'CUSTOM',
              product: {
                identifier: 'soprano_coins_2500',
                description: '500 bonus jeton! — %25 bonus',
                title: '2500 Jeton',
                price: 169.99,
                priceString: '₺169.99',
                currencyCode: 'TRY'
              }
            },
            {
              identifier: 'coin_pack_5500',
              packageType: 'CUSTOM',
              product: {
                identifier: 'soprano_coins_5500',
                description: 'En avantajlı! — %30 bonus',
                title: '5500 Jeton',
                price: 349.99,
                priceString: '₺349.99',
                currencyCode: 'TRY'
              }
            }
          ]
        }
      };
    }

    try {
      if (!Purchases) return { current: null };
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch (e) {
      console.warn('RevenueCat Offerings Hatası:', e);
      return { current: null };
    }
  },

  async handleSuccessfulPurchase(pkg: any, userId: string) {
    const id = pkg.product.identifier;
    
    // 1. Abonelik mi Coin mi?
    if (id === 'soprano_plus_monthly') {
      await supabase.from('profiles').update({ is_plus: true }).eq('id', userId);
      return { type: 'plus', amount: 0, title: pkg.product.title };
    } else if (id.startsWith('soprano_coins_')) {
      const amount = parseInt(id.replace('soprano_coins_', ''));
      // Basit MOCK cüzdan artırımı
      const { data } = await supabase.from('profiles').select('coins').eq('id', userId).single();
      const newBalance = (data?.coins || 0) + amount;
      await supabase.from('profiles').update({ coins: newBalance }).eq('id', userId);
      return { type: 'coins', amount, title: pkg.product.title };
    }
    return null;
  },

  async purchasePackage(pkg: any, userId: string) {
    if (REVENUECAT_MOCK_MODE) {
      // Satın Alma animasyonu için biraz bekleterek taklit et
      await new Promise(resolve => setTimeout(resolve, 1500));
      return this.handleSuccessfulPurchase(pkg, userId);
    }

    try {
      if (!Purchases) throw new Error('RevenueCat Expo Go modunda desteklenmez.');
      await Purchases.purchasePackage(pkg) as any;
      // RevenueCat webhook üzerinden veritabanını güncellemek esasında en güvenlisidir, 
      // Ancak anında UI yansıması için manuel olarak burada da supabase'e işliyoruz.
      return this.handleSuccessfulPurchase(pkg, userId);
    } catch (e: any) {
      if (!e.userCancelled) {
        throw new Error(e.message);
      }
      throw new Error('USER_CANCELLED');
    }
  }
};
