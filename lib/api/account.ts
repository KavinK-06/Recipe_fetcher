// Client call for the delete-account Edge Function.
//
// AUTH mirrors the import endpoints: the default Clerk session token rides in the
// custom X-Clerk-Token header (NOT Authorization — Supabase's gateway would
// reject a Clerk-signed JWT there), with the anon publishable key in `apikey`.
// See lib/api/import.ts for the full rationale.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type GetToken = () => Promise<string | null>;

/** Thrown for any non-2xx delete-account response. `code` is the server's `error` field. */
export class AccountError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Account action failed (${status}): ${code}`);
    this.name = 'AccountError';
  }
}

/**
 * Permanently deletes the signed-in user's account: all recipes, collections,
 * stored images, entitlements, and the Clerk identity itself. IRREVERSIBLE.
 *
 * On success the Clerk session is already invalid, so the caller should still
 * call `signOut()` to clear the local token cache and route to the sign-in
 * screen.
 */
export async function deleteAccount(getToken: GetToken): Promise<void> {
  if (!SUPABASE_URL) throw new AccountError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { 'X-Clerk-Token': token } : {}),
    },
  });

  if (!res.ok) {
    const code = await res
      .json()
      .then((b) => b?.error)
      .catch(() => undefined);
    throw new AccountError(res.status, code ?? 'unknown');
  }
}
