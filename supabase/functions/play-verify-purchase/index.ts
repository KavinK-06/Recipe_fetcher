import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { getProductPurchase, PlayApiError } from '../_shared/googleplay.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TAG = 'play-verify-purchase';

// Credits granted per consumable pack (mirrors the old razorpay-webhook).
const CREDITS_PER_PACK = 10;

type Product = 'lifetime' | 'yt_credits';

// Play product id → internal product. MUST match lib/api/billing.ts.
const PRODUCT_BY_PLAY_ID: Record<string, Product> = {
  rasoi_lifetime: 'lifetime',
  rasoi_credits_10: 'yt_credits',
};

// Google Play purchaseState values.
const PURCHASE_STATE_PURCHASED = 0;
const PURCHASE_STATE_PENDING = 2;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Parse + validate input
  let productId: unknown;
  let purchaseToken: unknown;
  try {
    const body = await req.json();
    productId = body?.productId;
    purchaseToken = body?.purchaseToken;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof productId !== 'string') {
    return json({ error: 'invalid_input' }, 400);
  }
  // Every grant must be backed by a real Google Play purchase token.
  if (typeof purchaseToken !== 'string' || !purchaseToken) {
    return json({ error: 'invalid_input' }, 400);
  }
  const product = PRODUCT_BY_PLAY_ID[productId];
  if (!product) {
    return json({ error: 'invalid_product' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Auth (Clerk session token via JWKS) → internal user id
    const { userId } = await authenticateRequest(req, supabase);

    // purchaseToken is a validated non-empty string at this point.
    const token = purchaseToken as string;

    // Verify the purchase with Google before trusting anything from the client.
    let purchase;
    try {
      purchase = await getProductPurchase(productId, token);
    } catch (err) {
      if (err instanceof PlayApiError) {
        // 404 = unknown/invalid token; anything else = upstream/config problem.
        if (err.status === 404) {
          console.error(`[${TAG}] purchase not found for token`);
          return json({ ok: false, error: 'purchase_not_found' }, 400);
        }
        console.error(`[${TAG}] Play API error (${err.status}):`, err.body);
        throw new HttpError(502, { error: 'play_api_error' });
      }
      throw err;
    }

    // Anti cross-account replay: if the client tagged the purchase with an account
    // id, it must be THIS user's id.
    if (
      purchase.obfuscatedExternalAccountId &&
      purchase.obfuscatedExternalAccountId !== userId
    ) {
      console.error(`[${TAG}] account mismatch on purchase`);
      return json({ ok: false, error: 'account_mismatch' }, 403);
    }

    if (purchase.purchaseState === PURCHASE_STATE_PENDING) {
      return json({ ok: false, pending: true }, 202);
    }
    if (purchase.purchaseState !== PURCHASE_STATE_PURCHASED) {
      return json({ ok: false, error: 'not_purchased' }, 400);
    }

    // Idempotency: claim the token first. The PK on purchase_token means a
    // concurrent/duplicate verify hits a unique violation and grants nothing.
    const { error: claimError } = await supabase.from('play_purchases').insert({
      purchase_token: token,
      user_id: userId,
      product,
      order_id: purchase.orderId ?? null,
      status: 'granted',
    });
    if (claimError) {
      // 23505 = unique_violation → already processed, return success idempotently.
      if ((claimError as { code?: string }).code === '23505') {
        return json({ ok: true, product, already: true });
      }
      console.error(`[${TAG}] play_purchases insert failed:`, claimError);
      throw new HttpError(500, { error: 'record_failed' });
    }

    // We own this grant — apply it.
    await grantEntitlement(supabase, userId, product);
    return json({ ok: true, product });
  } catch (err) {
    return errorResponse(err, TAG);
  }
});

/** Applies the purchased product to the user's entitlement row (service role). */
async function grantEntitlement(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  product: Product,
): Promise<void> {
  if (product === 'lifetime') {
    const { error } = await supabase
      .from('entitlements')
      .update({ plan: 'lifetime', lifetime_purchased_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) console.error(`[${TAG}] lifetime grant failed:`, error);
    return;
  }

  // yt_credits: tops up the shared credit pool (imports + calorie scans). The RPC
  // still takes an ai_delta param (legacy ai_credits column); we pass 0.
  const { error } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_yt_delta: CREDITS_PER_PACK,
    p_ai_delta: 0,
  });
  if (error) console.error(`[${TAG}] credits grant failed:`, error);
}
