// Thin wrapper over Razorpay's REST API (Basic auth) for the one-time payment
// flow. Used by `razorpay-create-order` (creates an Order for the Lifetime
// Unlock / credit packs) and `razorpay-webhook` (calls `verifyWebhookSignature`).
// Secrets live ONLY in Edge Function env — never on the client.

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') ?? '';
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') ?? '';
const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/**
 * Thrown on any Razorpay API failure. `status` is Razorpay's HTTP status (or a
 * synthetic 5xx for config/network errors) and `body` is the parsed error
 * payload. The caller maps this to a client-facing `HttpError` — a Razorpay 400
 * is our infrastructure problem, not the client's, so it shouldn't pass through
 * as-is.
 */
export class RazorpayError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`RazorpayError ${status}`);
    this.name = 'RazorpayError';
  }
}

// Basic auth header: base64("key_id:key_secret"). Razorpay keys are ASCII, so
// btoa (Latin-1) is safe here.
function authHeader(): string {
  return 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
}

async function razorpayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new RazorpayError(500, { error: 'razorpay_not_configured' });
  }

  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new RazorpayError(502, {
      error: 'razorpay_unreachable',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!res.ok) throw new RazorpayError(res.status, parsed);
  return parsed as T;
}

export interface RazorpayCustomer {
  id: string;
  entity: string;
  name?: string;
  email?: string;
  contact?: string;
}

/**
 * Creates a Razorpay customer (or returns the existing one with the same
 * email/contact, thanks to `fail_existing: 0`). We store the returned id on the
 * user's subscription row so the Step 16 webhook can reconcile events back to a
 * user even if the subscription-id write later fails.
 */
export async function createCustomer(
  { name, email }: { name: string; email: string },
): Promise<{ id: string }> {
  const customer = await razorpayPost<RazorpayCustomer>('/customers', {
    name,
    email,
    // 0 → if a customer with these details already exists, return it instead of
    // erroring. Makes re-entry (a crash between create + DB write) idempotent.
    fail_existing: 0,
  });
  return { id: customer.id };
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
  receipt: string | null;
}

/**
 * Creates a one-time Order (INR). The client opens Razorpay Checkout with the
 * returned `id` + the public `key_id` to collect payment; the actual entitlement
 * grant happens server-side in `razorpay-webhook` on `payment.captured`.
 *
 * NOTE: the Orders API does NOT take a `customer_id` (the customer is attached
 * by Checkout at pay time), so we don't pass one — `notes` carries our own
 * user/product linkage for traceability. `payment_capture: 1` auto-captures.
 */
export async function createOrder(
  {
    amountPaise,
    receipt,
    notes,
  }: {
    amountPaise: number;
    receipt?: string;
    notes?: Record<string, string>;
  },
): Promise<{ id: string; amount: number; currency: string; status: string }> {
  const order = await razorpayPost<RazorpayOrder>('/orders', {
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes,
    payment_capture: 1,
  });
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
  };
}

/**
 * Verifies a Razorpay webhook signature: HMAC-SHA256 of the RAW request body
 * keyed by the webhook secret, hex-encoded, compared in constant time against
 * the `X-Razorpay-Signature` header.
 *
 * Async because Web Crypto's `subtle.sign` is async (Step 16 awaits it).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = [...new Uint8Array(sigBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqualHex(expected, signature);
}

/** Constant-time hex-string comparison (avoids leaking position of mismatch). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
