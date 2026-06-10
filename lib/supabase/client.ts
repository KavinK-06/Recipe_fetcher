import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surfaced at module import time so a misconfigured build fails loudly
  // instead of every query returning a cryptic 401.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing — Supabase calls will fail.',
  );
}

export type ClerkGetToken = () => Promise<string | null>;

/**
 * Builds a Supabase client whose every request carries a fresh Clerk-issued
 * JWT in the `Authorization` header. The token is fetched per-request so
 * Supabase always sees a non-expired credential.
 *
 * Clerk owns the session lifecycle, so Supabase auth's own persistence /
 * refresh machinery is disabled — RLS reads the Clerk JWT directly via
 * `auth.jwt() ->> 'user_id'`.
 */
export function createSupabaseClient(getToken: ClerkGetToken): SupabaseClient {
  const authedFetch: typeof fetch = async (input, init) => {
    const token = await getToken().catch(() => null);
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
  };

  return createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: authedFetch,
    },
  });
}
