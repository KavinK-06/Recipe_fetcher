// Client API for the one-time Razorpay payment flow (Lifetime Unlock + credit
// packs). Same auth model as lib/api/import.ts: the anon publishable key rides
// in `apikey`, and Clerk's *default* session token (no template) rides in
// `X-Clerk-Token` (the Edge Function verifies it against Clerk's JWKS).

import type { GetToken } from './import';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type Product = 'lifetime' | 'yt_credits' | 'ai_credits';

/** What `razorpay-create-order` returns — everything Razorpay Checkout needs. */
export interface CreateOrderResult {
  orderId: string;
  amount: number; // paise (server-fixed)
  currency: string; // 'INR'
  keyId: string; // public Razorpay key id
}

export class BillingError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Billing failed (${status}): ${code}`);
    this.name = 'BillingError';
  }
}

/** Creates a pending Razorpay Order for `product`. The amount is set server-side. */
export async function createOrder(
  product: Product,
  getToken: GetToken,
): Promise<CreateOrderResult> {
  if (!SUPABASE_URL) throw new BillingError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/razorpay-create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { 'X-Clerk-Token': token } : {}),
    },
    body: JSON.stringify({ product }),
  });

  if (!res.ok) {
    const code = await res
      .json()
      .then((b) => b?.error)
      .catch(() => undefined);
    throw new BillingError(res.status, code ?? 'unknown');
  }

  return (await res.json()) as CreateOrderResult;
}

/** Human price label per product (display only — the server owns the real amount). */
export const PRODUCT_PRICE_LABEL: Record<Product, string> = {
  lifetime: '₹499',
  yt_credits: '₹49',
  ai_credits: '₹99',
};
