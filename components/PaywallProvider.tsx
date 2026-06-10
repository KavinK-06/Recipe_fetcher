import React, { createContext, useCallback, useContext, useState } from 'react';
import PaywallSheet from './PaywallSheet';
import type { Product } from '../lib/api/billing';

interface PaywallContextValue {
  visible: boolean;
  product: Product;
  /** Open the paywall, optionally pre-selecting a product (defaults to lifetime). */
  showPaywall: (product?: Product) => void;
  hidePaywall: () => void;
}

// Default is a no-op so `useEntitlements()` (which reads this) never crashes a
// screen that happens to render outside the provider.
const PaywallContext = createContext<PaywallContextValue>({
  visible: false,
  product: 'lifetime',
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

  const showPaywall = useCallback((p: Product = 'lifetime') => {
    setProduct(p);
    setVisible(true);
  }, []);
  const hidePaywall = useCallback(() => setVisible(false), []);

  return (
    <PaywallContext.Provider value={{ visible, product, showPaywall, hidePaywall }}>
      {children}
      <PaywallSheet visible={visible} initialProduct={product} onClose={hidePaywall} />
    </PaywallContext.Provider>
  );
}
