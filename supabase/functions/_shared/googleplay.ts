// Google Play Developer API client for verifying in-app purchases server-side.
//
// A service-account JWT (RS256) is exchanged for an OAuth access token, which then
// authorizes the androidpublisher `purchases.products.get` call. We reuse the same
// `jose` version as _shared/auth.ts. The access token is cached in module memory
// across warm invocations.
//
// Required env:
//   GOOGLE_PLAY_PACKAGE_NAME      — e.g. "com.rasoi.app"
//   GOOGLE_PLAY_SERVICE_ACCOUNT   — the full service-account JSON (string)

import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.9.6/index.ts';

const PACKAGE_NAME = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') ?? '';
const SA_RAW = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT') ?? '';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export class PlayApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`PlayApiError ${status}: ${body}`);
    this.name = 'PlayApiError';
  }
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function serviceAccount(): ServiceAccount {
  if (!SA_RAW) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT not configured');
  const sa = JSON.parse(SA_RAW) as ServiceAccount;
  // When the JSON is stored as a single-line secret the PEM newlines arrive as
  // the literal two-character sequence "\n" — restore real newlines for importPKCS8.
  sa.private_key = String(sa.private_key).replace(/\\n/g, '\n');
  return sa;
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = serviceAccount();
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new PlayApiError(res.status, `token exchange failed: ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { token: body.access_token, exp: now + (body.expires_in ?? 3600) };
  return cachedToken.token;
}

export interface ProductPurchase {
  /** 0 = purchased, 1 = canceled, 2 = pending. */
  purchaseState?: number;
  /** 0 = yet to be consumed, 1 = consumed. */
  consumptionState?: number;
  /** 0 = yet to be acknowledged, 1 = acknowledged. */
  acknowledgementState?: number;
  orderId?: string;
  purchaseTimeMillis?: string;
  /** Set when the client passed obfuscatedAccountId at purchase time. */
  obfuscatedExternalAccountId?: string;
}

/**
 * Fetches a one-time product purchase from the Google Play Developer API. Throws
 * `PlayApiError` (404 when the token is unknown/invalid) on non-2xx responses.
 */
export async function getProductPurchase(
  productId: string,
  purchaseToken: string,
): Promise<ProductPurchase> {
  if (!PACKAGE_NAME) throw new Error('GOOGLE_PLAY_PACKAGE_NAME not configured');
  const token = await getAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
    `${PACKAGE_NAME}/purchases/products/${encodeURIComponent(productId)}/tokens/` +
    `${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new PlayApiError(res.status, await res.text());
  return (await res.json()) as ProductPurchase;
}
