import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createCustomer, createOrder, RazorpayError } from '../_shared/razorpay.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') ?? '';

const TAG = 'razorpay-create-order';

type Product = 'lifetime' | 'yt_credits' | 'ai_credits';

// Fixed prices in paise. The Order amount is authoritative — the client never
// sends an amount, so it can't be tampered with.
const PRODUCT_PAISE: Record<Product, number> = {
  lifetime: 49900, // ₹499 one-time Lifetime Unlock
  yt_credits: 4900, // ₹49  → 10 YouTube import credits
  ai_credits: 9900, // ₹99  → 50 AI (macro-scan) credits
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Parse + validate input
  let product: unknown;
  try {
    const body = await req.json();
    product = body?.product;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (product !== 'lifetime' && product !== 'yt_credits' && product !== 'ai_credits') {
    return json({ error: 'invalid_product' }, 400);
  }
  if (!RAZORPAY_KEY_ID) {
    console.error(`[${TAG}] RAZORPAY_KEY_ID not configured`);
    return json({ error: 'razorpay_not_configured' }, 500);
  }

  const amountPaise = PRODUCT_PAISE[product];

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Auth (Clerk session token via JWKS) → internal user id
    const { userId } = await authenticateRequest(req, supabase);

    // Ensure a Razorpay customer exists (best-effort record-keeping). Orders
    // don't require a customer_id, so a failure here must NOT block checkout.
    await ensureCustomer(supabase, userId);

    // Create the Order (amount is server-fixed).
    let order: { id: string; amount: number; currency: string; status: string };
    try {
      order = await createOrder({
        amountPaise,
        receipt: `saveur_${product}_${Date.now()}`,
        notes: { user_id: userId, product },
      });
    } catch (err) {
      if (err instanceof RazorpayError) {
        console.error(`[${TAG}] order creation failed (Razorpay ${err.status}):`, err.body);
        throw new HttpError(502, { error: 'razorpay_order_failed' });
      }
      throw err;
    }

    // Record the pending order. The webhook later flips this to 'paid' and
    // grants the entitlement — so this row is the reconciliation key.
    const { error: insertError } = await supabase.from('payments').insert({
      user_id: userId,
      razorpay_order_id: order.id,
      product,
      amount_paise: amountPaise,
      status: 'created',
    });
    if (insertError) {
      console.error(`[${TAG}] payments insert failed:`, insertError);
      throw new HttpError(500, { error: 'payment_record_failed' });
    }

    return json(
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID,
      },
      200,
    );
  } catch (err) {
    return errorResponse(err, TAG);
  }
});

/**
 * Creates + stores a Razorpay customer id if the user doesn't have one yet.
 * Best-effort: any failure is logged and swallowed (Orders don't need it).
 */
async function ensureCustomer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  try {
    const { data: ent } = await supabase
      .from('entitlements')
      .select('razorpay_customer_id')
      .eq('user_id', userId)
      .single();
    if (ent?.razorpay_customer_id) return;

    const { data: user } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('id', userId)
      .single();
    if (!user?.email) return;

    const name =
      (user.display_name as string | null)?.trim() ||
      user.email.split('@')[0] ||
      'Saveur User';
    const customer = await createCustomer({ name, email: user.email });

    await supabase
      .from('entitlements')
      .update({ razorpay_customer_id: customer.id })
      .eq('user_id', userId);
  } catch (err) {
    console.error(`[${TAG}] ensureCustomer (non-fatal):`, err);
  }
}
