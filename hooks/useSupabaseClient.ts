import { useMemo } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { createSupabaseClient } from '../lib/supabase/client';

// The template-fallback path is a steady state (the default session token works
// when Clerk is a Third-Party Auth provider), so warn ONCE per session instead of
// on every DB request. The genuine failure — no token at all — still logs each time.
let warnedTemplateFallback = false;

/**
 * Returns a Supabase client whose requests carry the current Clerk user's
 * JWT. The client is memoised per-user so the same instance is reused across
 * renders, but it's rebuilt when the user changes (sign in / sign out /
 * switch account).
 *
 * Token resolution (RLS reads `user_id` OR `sub` since migration 0005):
 *   1. The HS256 `supabase` template token — verified by Postgres via the
 *      shared legacy JWT secret (`user_id` claim).
 *   2. Fallback: the default Clerk session token — works when Clerk is
 *      registered as a Third-Party Auth provider in the Supabase dashboard
 *      (JWKS-verified, `sub` claim). See README → "Clerk ↔ Supabase auth".
 * Going out with NO token would make every RLS query silently return zero
 * rows, so that case is logged loudly instead.
 */
export function useSupabaseClient() {
  const { getToken, userId } = useAuth();

  return useMemo(
    () =>
      createSupabaseClient(async () => {
        const template = await getToken({ template: 'supabase' }).catch(() => null);
        if (template) return template;

        const session = await getToken().catch(() => null);
        if (session) {
          if (!warnedTemplateFallback) {
            warnedTemplateFallback = true;
            console.warn(
              '[useSupabaseClient] `supabase` JWT template returned no token — ' +
                'falling back to the default Clerk session token (logged once). ' +
                'Direct DB reads need Clerk registered as a Third-Party Auth ' +
                'provider in Supabase (see README → "Clerk ↔ Supabase auth").',
            );
          }
          return session;
        }

        console.error(
          '[useSupabaseClient] no Clerk token available — DB requests will run ' +
            'as anon and RLS will return no rows.',
        );
        return null;
      }),
    // getToken is read fresh inside the closure on each request, so userId
    // is the only thing that needs to invalidate the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );
}
