// Client API for the Google Play Billing flow (Lifetime Unlock + credit packs).
// The actual purchase UI is native (expo-iap → Play Billing); this module only
// owns the product-id mapping and the server-side verification call.
//
// Verification auth matches lib/api/import.ts: the anon publishable key rides in
// `apikey` and Clerk's *default* session token (no template) rides in
// `X-Clerk-Token` (the Edge Function verifies it against Clerk's JWKS).

import type { GetToken } from './import';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Internal product keys used across the app/UI (unchanged from the old flow). */
export type Product = 'lifetime' | 'yt_credits';

/**
 * Play Console product IDs. These MUST match the in-app products you create in
 * the Play Console exactly. `lifetime` is a non-consumable one-time product;
 * `yt_credits` is a consumable so it can be bought repeatedly.
 */
export const PLAY_PRODUCT_IDS: Record<Product, string> = {
  lifetime: 'rasoi_lifetime',
  yt_credits: 'rasoi_credits_10',
};

/** Reverse map (Play product id → internal key), for the purchase listener. */
export const PRODUCT_BY_PLAY_ID: Record<string, Product> = Object.fromEntries(
  Object.entries(PLAY_PRODUCT_IDS).map(([key, id]) => [id, key as Product]),
) as Record<string, Product>;

/** Consumable products must be consumed after grant so they can be re-bought. */
export const IS_CONSUMABLE: Record<Product, boolean> = {
  lifetime: false,
  yt_credits: true,
};

/** Fallback price labels (display only). The real, localized price comes from the
 *  Play Store via the fetched product's `displayPrice`; these are the backstop. */
export const PRODUCT_PRICE_LABEL: Record<Product, string> = {
  lifetime: '₹499',
  yt_credits: '₹49',
};

export class BillingError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Billing failed (${status}): ${code}`);
    this.name = 'BillingError';
  }
}

/** What `play-verify-purchase` returns. */
export interface VerifyResult {
  ok: boolean;
  /** Internal product that was granted (present when ok). */
  product?: Product;
  /** True when Google reports the purchase is still pending (don't finish it). */
  pending?: boolean;
  /** True when this token was already processed (idempotent replay). */
  already?: boolean;
}

/**
 * Sends a Play `purchaseToken` to the backend, which verifies it against the
 * Google Play Developer API and grants the entitlement/credits. Idempotent: the
 * server dedupes on the token, so re-sending the same purchase is safe.
 */
export async function verifyPlayPurchase(
  args: { productId: string; purchaseToken: string },
  getToken: GetToken,
): Promise<VerifyResult> {
  if (!SUPABASE_URL) throw new BillingError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/play-verify-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { 'X-Clerk-Token': token } : {}),
    },
    body: JSON.stringify({ productId: args.productId, purchaseToken: args.purchaseToken }),
  });

  if (!res.ok) {
    const code = await res
      .json()
      .then((b) => b?.error)
      .catch(() => undefined);
    throw new BillingError(res.status, code ?? 'unknown');
  }

  return (await res.json()) as VerifyResult;
}
