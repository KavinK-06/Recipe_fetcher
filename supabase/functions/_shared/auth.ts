import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.9.6/index.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError } from './http.ts';

const CLERK_JWKS_URL = Deno.env.get('CLERK_JWKS_URL') ?? '';
// The session-token issuer is the JWKS origin without the well-known suffix.
const CLERK_ISSUER = CLERK_JWKS_URL.replace(/\/\.well-known\/jwks\.json$/, '');

// Built lazily once and cached across warm invocations so we don't refetch the
// JWKS each request — and so a missing CLERK_JWKS_URL surfaces as a clean 401
// rather than a cold-start crash from `new URL('')`.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(CLERK_JWKS_URL));
  return jwks;
}

export function getBearerToken(req: Request): string | null {
  // The Clerk token rides in a custom header, NOT Authorization: Supabase's edge
  // gateway verifies any Authorization-bearer JWT against its own asymmetric
  // signing keys and rejects a Clerk-signed token (UNAUTHORIZED_ASYMMETRIC_JWT)
  // before this code runs. Fall back to Authorization for direct curl testing.
  const custom = req.headers.get('X-Clerk-Token');
  if (custom) return custom;
  return req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
}

/**
 * Verifies the **default Clerk session token** (`getToken()`) against Clerk's
 * JWKS and returns the Clerk user id (the standard `sub` claim).
 *
 * Edge Functions authenticate the *caller* this way — NOT with the HS256
 * `supabase` JWT template (that one is only for direct DB access where Postgres
 * RLS verifies it; it deliberately does not verify against JWKS).
 */
export async function verifyClerkToken(req: Request): Promise<string> {
  const token = getBearerToken(req);
  if (!token) {
    console.error('[auth] no Bearer token on request');
    throw new HttpError(401, { error: 'missing_token' });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      getJwks(),
      CLERK_ISSUER ? { issuer: CLERK_ISSUER } : undefined,
    );
    const clerkUserId = (payload.sub ?? payload.user_id) as string | undefined;
    if (!clerkUserId) throw new Error('no subject (sub) claim on token');
    return clerkUserId;
  } catch (err) {
    console.error('[auth] token verification failed:', {
      reason: err instanceof Error ? err.message : String(err),
      hasJwksUrl: !!CLERK_JWKS_URL,
      expectedIssuer: CLERK_ISSUER || '(none configured)',
    });
    throw new HttpError(401, { error: 'invalid_token' });
  }
}

/** Resolves the internal `public.users.id` for a Clerk user id (service-role client). */
export async function resolveUserId(
  supabase: SupabaseClient,
  clerkUserId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (error || !data) throw new HttpError(401, { error: 'user_not_found' });
  return data.id as string;
}

/** Convenience: verify the token and resolve the internal user id in one call. */
export async function authenticateRequest(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ clerkUserId: string; userId: string }> {
  const clerkUserId = await verifyClerkToken(req);
  const userId = await resolveUserId(supabase, clerkUserId);
  return { clerkUserId, userId };
}
