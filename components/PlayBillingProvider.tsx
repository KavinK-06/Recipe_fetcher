import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useIAP, ErrorCode } from 'expo-iap';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';

import {
  BillingError,
  IS_CONSUMABLE,
  PLAY_PRODUCT_IDS,
  PRODUCT_BY_PLAY_ID,
  verifyPlayPurchase,
  type Product,
} from '../lib/api/billing';

/** Minimal shape we read off an expo-iap product (Play returns much more). */
interface StoreProduct {
  id: string;
  title?: string;
  displayPrice?: string;
}

interface PlayBillingValue {
  /** Play Billing connected + usable (false in Expo Go / before connect). */
  connected: boolean;
  /** Fetched store products keyed by our internal product key. */
  productsByKey: Partial<Record<Product, StoreProduct>>;
  /** Which product is mid-purchase (drives the per-button spinner). */
  busyProduct: Product | null;
  /** Bumped to Date.now() after each successful grant — consumers watch it. */
  lastGrant: number;
  /** Launch the native Play purchase sheet for a product. */
  buy: (key: Product) => void;
}

const PlayBillingContext = createContext<PlayBillingValue>({
  connected: false,
  productsByKey: {},
  busyProduct: null,
  lastGrant: 0,
  buy: () => {},
});

export function usePlayBilling(): PlayBillingValue {
  return useContext(PlayBillingContext);
}

// expo-iap is a NATIVE module — it is not bundled into Expo Go. Calling useIAP()
// there reaches for the missing 'ExpoIap' native module and throws from an async
// effect ("Cannot find native module 'ExpoIap'"), which crashes the app. So in
// Expo Go we never mount the native provider: we serve a stub context instead, so
// the whole app stays usable and only purchases are unavailable (they need a
// dev/EAS build against Google Play Billing anyway). `executionEnvironment` is
// `storeClient` only inside Expo Go; a dev/EAS/standalone build reports otherwise.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Root billing provider. Picks the native Play Billing implementation on real
 * builds, or a no-op stub in Expo Go (where the native module is absent). The
 * branch is decided once from a module constant, so the same component type
 * renders for the app's lifetime (no rules-of-hooks issue).
 */
export function PlayBillingProvider({ children }: { children: React.ReactNode }) {
  if (isExpoGo) return <ExpoGoBillingProvider>{children}</ExpoGoBillingProvider>;
  return <NativePlayBillingProvider>{children}</NativePlayBillingProvider>;
}

/**
 * Expo Go stub. expo-iap is a native module and can't run in Expo Go, so in-app
 * purchases are unavailable here — `buy()` just explains that. There is NO
 * free-grant path: an entitlement can only ever come from a real, server-verified
 * Google Play purchase, which requires a dev/EAS/production build using
 * NativePlayBillingProvider.
 */
function ExpoGoBillingProvider({ children }: { children: React.ReactNode }) {
  const buy = useCallback((_key: Product) => {
    Alert.alert(
      'Not available in Expo Go',
      'In-app purchases need the installed app (a development or production build), ' +
        'not Expo Go. Run a dev build to test or complete a purchase.',
    );
  }, []);

  const value = useMemo<PlayBillingValue>(
    () => ({ connected: true, productsByKey: {}, busyProduct: null, lastGrant: 0, buy }),
    [buy],
  );
  return <PlayBillingContext.Provider value={value}>{children}</PlayBillingContext.Provider>;
}

/**
 * Owns the Google Play Billing connection for the whole app. Mounted at the root
 * (outside PaywallProvider) so the purchase listener stays alive regardless of
 * whether the paywall sheet is open — that's what lets a purchase completed while
 * the app was backgrounded/killed get reconciled on the next launch.
 *
 * Purchase lifecycle: native Play sheet → onPurchaseSuccess → verify the token
 * with our backend (which grants the entitlement idempotently) → finishTransaction
 * (acknowledge for non-consumables, consume for the credit pack). Verification is
 * the source of truth; we never trust the client-side purchase alone.
 */
function NativePlayBillingProvider({ children }: { children: React.ReactNode }) {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();

  const [busyProduct, setBusyProduct] = useState<Product | null>(null);
  const [lastGrant, setLastGrant] = useState(0);

  // getToken / finishTransaction are read through refs so the purchase handler
  // has a stable identity (no re-subscribing the IAP listener every render).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const finishRef = useRef<
    ((args: { purchase: unknown; isConsumable: boolean }) => Promise<unknown>) | null
  >(null);

  const safeFinish = useCallback(async (purchase: unknown, isConsumable: boolean) => {
    try {
      await finishRef.current?.({ purchase, isConsumable } as never);
    } catch (e) {
      console.warn('[billing] finishTransaction failed:', e);
    }
  }, []);

  // Verify + grant + finish a single purchase. Used both by the live success
  // callback and by the launch-time reconciliation of unfinished purchases.
  const processPurchase = useCallback(
    async (purchase: { productId?: string; purchaseToken?: string }) => {
      const playId = purchase?.productId ?? '';
      const purchaseToken = purchase?.purchaseToken ?? '';
      const product = PRODUCT_BY_PLAY_ID[playId];

      // Unknown product or missing token — finish to clear the queue, don't grant.
      if (!product || !purchaseToken) {
        await safeFinish(purchase, false);
        setBusyProduct(null);
        return;
      }

      try {
        const result = await verifyPlayPurchase(
          { productId: playId, purchaseToken },
          () => getTokenRef.current(),
        );

        // Google still settling the charge — leave it unfinished; it re-emits.
        if (result.pending) {
          setBusyProduct(null);
          return;
        }

        if (result.ok) {
          queryClient.invalidateQueries({ queryKey: ['entitlements'] });
          setTimeout(
            () => queryClient.invalidateQueries({ queryKey: ['entitlements'] }),
            2500,
          );
          await safeFinish(purchase, IS_CONSUMABLE[product]);
          setLastGrant(Date.now());
          if (!result.already) {
            Alert.alert(
              'Purchase complete',
              product === 'lifetime'
                ? 'Lifetime unlocked — enjoy Rasoi in full.'
                : '10 credits added to your account.',
            );
          }
        } else {
          // Verified-invalid — finish so it doesn't loop, but grant nothing.
          await safeFinish(purchase, IS_CONSUMABLE[product]);
        }
      } catch (err) {
        if (err instanceof BillingError && err.status >= 400 && err.status < 500) {
          // Definitive rejection (e.g. not_purchased) — finish without granting.
          await safeFinish(purchase, IS_CONSUMABLE[product]);
          Alert.alert(
            'Purchase issue',
            "We couldn't verify that purchase. If you were charged, contact support and we'll sort it out.",
          );
        } else {
          // Transient (network / 5xx) — keep it unfinished; recovered next launch.
          Alert.alert('Almost there', 'Your purchase will be applied in a moment.');
        }
      } finally {
        setBusyProduct(null);
      }
    },
    [queryClient, safeFinish],
  );

  const { connected, products, requestPurchase, finishTransaction, fetchProducts, getAvailablePurchases } =
    useIAP({
      onPurchaseSuccess: (purchase) => {
        void processPurchase(purchase as { productId?: string; purchaseToken?: string });
      },
      onPurchaseError: (error) => {
        setBusyProduct(null);
        if (error?.code !== ErrorCode.UserCancelled) {
          Alert.alert('Purchase failed', error?.message ?? 'Please try again.');
        }
      },
      onError: (error) => {
        // Connection/init failures (e.g. running in Expo Go) land here — log and
        // keep the app usable; buy() guards on `connected`.
        console.warn('[billing] IAP error:', error?.message ?? error);
      },
    });
  finishRef.current = finishTransaction as never;

  // On connect: load store products and reconcile any purchase that completed
  // while the app was closed (acknowledge window protection).
  useEffect(() => {
    if (!connected) return;
    Promise.resolve(
      fetchProducts({ skus: Object.values(PLAY_PRODUCT_IDS), type: 'in-app' }),
    ).catch(() => {});
    (async () => {
      try {
        const pending = await getAvailablePurchases();
        for (const p of pending ?? []) {
          await processPurchase(p as { productId?: string; purchaseToken?: string });
        }
      } catch {
        // best-effort — nothing to reconcile or store unavailable
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const productsByKey = useMemo(() => {
    const map: Partial<Record<Product, StoreProduct>> = {};
    for (const p of (products ?? []) as StoreProduct[]) {
      const key = PRODUCT_BY_PLAY_ID[p.id];
      if (key) map[key] = p;
    }
    return map;
  }, [products]);

  const buy = useCallback(
    (key: Product) => {
      if (!connected) {
        Alert.alert(
          'Just a moment',
          'Connecting to Google Play — please try again in a second.',
        );
        return;
      }
      const id = PLAY_PRODUCT_IDS[key];
      setBusyProduct(key);
      Promise.resolve(
        requestPurchase({
          request: {
            apple: { sku: id },
            google: { skus: [id], ...(userId ? { obfuscatedAccountId: userId } : {}) },
          },
          type: 'in-app',
        }),
      ).catch(() => setBusyProduct(null));
    },
    [connected, requestPurchase, userId],
  );

  const value = useMemo<PlayBillingValue>(
    () => ({ connected, productsByKey, busyProduct, lastGrant, buy }),
    [connected, productsByKey, busyProduct, lastGrant, buy],
  );

  return <PlayBillingContext.Provider value={value}>{children}</PlayBillingContext.Provider>;
}
