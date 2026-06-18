import React, { createContext, useCallback, useContext, useState } from 'react';
import PaywallSheet from './PaywallSheet';
import type { Product } from '../lib/api/billing';

/**
 * Why the paywall opened — drives which sheet variant renders so we don't show a
 * capped user an irrelevant offer:
 * - `recipe_limit`: free 15-saved-recipe cap hit → Lifetime only + "delete to free
 *   space" hint; credit top-up is HIDDEN (buying credits never raises the cap).
 * - `out_of_credits`: shared import-credit pool spent → credit top-up (+ Lifetime).
 * - `upgrade`: a generic "go Lifetime" tap (profile) → full sheet.
 */
export type PaywallReason = 'recipe_limit' | 'out_of_credits' | 'upgrade';

interface PaywallContextValue {
  visible: boolean;
  product: Product;
  reason: PaywallReason;
  /** Open the paywall, optionally pre-selecting a product + the reason it opened. */
  showPaywall: (product?: Product, reason?: PaywallReason) => void;
  hidePaywall: () => void;
}

// Default is a no-op so `useEntitlements()` (which reads this) never crashes a
// screen that happens to render outside the provider.
const PaywallContext = createContext<PaywallContextValue>({
  visible: false,
  product: 'lifetime',
  reason: 'upgrade',
  showPaywall: () => {},
  hidePaywall: () => {},
});

export function usePaywall(): PaywallContextValue {
  return useContext(PaywallContext);
}

/**
 * Holds the paywall's open/close state and renders the single shared
 * <PaywallSheet> above the app. Mounted once in the root layout.
 */
export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [product, setProduct] = useState<Product>('lifetime');
  const [reason, setReason] = useState<PaywallReason>('upgrade');

  const showPaywall = useCallback((p: Product = 'lifetime', r: PaywallReason = 'upgrade') => {
    setProduct(p);
    setReason(r);
    setVisible(true);
  }, []);
  const hidePaywall = useCallback(() => setVisible(false), []);

  return (
    <PaywallContext.Provider value={{ visible, product, reason, showPaywall, hidePaywall }}>
      {children}
      <PaywallSheet
        visible={visible}
        initialProduct={product}
        reason={reason}
        onClose={hidePaywall}
      />
    </PaywallContext.Provider>
  );
}
