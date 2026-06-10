import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { json } from '../_shared/http.ts';
import { verifyWebhookSignature } from '../_shared/razorpay.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';

const TAG = 'razorpay-webhook';

// Credit grants per product (applied once, on payment.captured).
const YT_CREDITS_PER_PACK = 10;
const AI_CREDITS_PER_PACK = 50;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // The signature is computed over the RAW body — read text before JSON.parse.
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  if (!WEBHOOK_SECRET) {
    console.error(`[${TAG}] RAZORPAY_WEBHOOK_SECRET not configured`);
    return json({ error: 'not_configured' }, 500);
  }
  const valid = await verifyWebhookSignature(raw, signature, WEBHOOK_SECRET);
  if (!valid) {
    console.error(`[${TAG}] invalid signature`);
    return json({ error: 'invalid_signature' }, 401);
  }

  let event: string;
  let payment: Record<string, unknown> | undefined;
  try {
    const body = JSON.parse(raw);
    event = body?.event;
    payment = body?.payload?.payment?.entity;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  // We only act on payment lifecycle events; ack everything else so Razorpay
  // doesn't retry.
  if (event !== 'payment.captured' && event !== 'payment.failed') {
    return ok();
  }

  const orderId = payment?.order_id as string | undefined;
  const paymentId = payment?.id as string | undefined;
  if (!orderId) return ok();

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data: row, error } = await supabase
      .from('payments')
      .select('id, user_id, product, status')
      .eq('razorpay_order_id', orderId)
      .single();

    if (error || !row) {
      // Unknown order — nothing to reconcile. Ack to stop retries.
      console.error(`[${TAG}] no payment row for order ${orderId}`);
      return ok();
    }

    // Idempotent: a captured payment is terminal. If we've already granted it,
    // do nothing (Razorpay re-delivers webhooks).
    if (row.status === 'paid') return ok();

    if (event === 'payment.failed') {
      await supabase
        .from('payments')
        .update({ status: 'failed', razorpay_payment_id: paymentId ?? null })
        .eq('id', row.id);
      return ok();
    }

    // event === 'payment.captured'
    const { error: payErr } = await supabase
      .from('payments')
      .update({ status: 'paid', razorpay_payment_id: paymentId ?? null })
      .eq('id', row.id);
    if (payErr) {
      // Let Razorpay retry — we haven't granted the entitlement yet.
      console.error(`[${TAG}] failed to mark payment paid:`, payErr);
      return json({ error: 'update_failed' }, 500);
    }

    await grantEntitlement(supabase, row.user_id as string, row.product as string);
    return ok();
  } catch (err) {
    console.error(`[${TAG}] unexpected error:`, err);
    return json({ error: 'internal_error' }, 500);
  }
});

/** Applies the purchased product to the user's entitlement row (service role). */
async function grantEntitlement(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  product: string,
): Promise<void> {
  if (product === 'lifetime') {
    const { error } = await supabase
      .from('entitlements')
      .update({ plan: 'lifetime', lifetime_purchased_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) console.error(`[${TAG}] lifetime grant failed:`, error);
    return;
  }

  if (product === 'yt_credits') {
    const { error } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_yt_delta: YT_CREDITS_PER_PACK,
      p_ai_delta: 0,
    });
    if (error) console.error(`[${TAG}] yt_credits grant failed:`, error);
    return;
  }

  if (product === 'ai_credits') {
    const { error } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_yt_delta: 0,
      p_ai_delta: AI_CREDITS_PER_PACK,
    });
    if (error) console.error(`[${TAG}] ai_credits grant failed:`, error);
    return;
  }

  console.error(`[${TAG}] unknown product "${product}" — no entitlement applied`);
}

function ok(): Response {
  return new Response('ok', { status: 200, headers: corsHeaders });
}
