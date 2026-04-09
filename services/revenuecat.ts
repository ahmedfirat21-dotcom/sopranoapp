/**
 * RevenueCat Service — Stub (Mock Mode)
 * Gerçek RevenueCat SDK entegrasyonu yapılana kadar mock mode.
 */

export const REVENUECAT_MOCK_MODE = true;

export const RevenueCatService = {
  async init() { /* no-op */ },
  
  async getOfferings() {
    return {
      current: {
        availablePackages: [
          { identifier: 'tier_bronze', product: { title: 'Bronze Üyelik', priceString: '₺29.99', price: 29.99 } },
          { identifier: 'tier_silver', product: { title: 'Silver Üyelik', priceString: '₺59.99', price: 59.99 } },
          { identifier: 'tier_gold', product: { title: 'Gold Üyelik', priceString: '₺119.99', price: 119.99 } },
          { identifier: 'tier_vip', product: { title: 'VIP Üyelik', priceString: '₺199.99', price: 199.99 } },
        ],
      },
    };
  },

  async purchasePackage(_pkg: any) {
    return { customerInfo: { entitlements: { active: {} } } };
  },

  async restorePurchases() {
    return { customerInfo: { entitlements: { active: {} } } };
  },
};
