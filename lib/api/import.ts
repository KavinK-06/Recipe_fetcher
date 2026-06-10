// Client API for the recipe-import Edge Functions.
//
// AUTH: these endpoints authenticate with Clerk's *default* session token,
// which the functions verify server-side against Clerk's JWKS (the `sub` claim).
// Pass Clerk's `getToken` called with NO template — NOT getToken({ template:
// 'supabase' }). The `supabase` HS256 template is only for direct DB access.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type GetToken = () => Promise<string | null>;

/** A row from public.recipes as returned by the import Edge Functions (snake_case). */
export interface RecipeRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ingredients: { name: string; quantity: string; unit?: string }[];
  steps: { order: number; instruction: string }[];
  cook_time_minutes: number | null;
  prep_time_minutes: number | null;
  servings: number | null;
  tags: string[];
  image_url: string | null;
  storage_path: string | null;
  source_type: 'url' | 'youtube' | 'manual';
  source_url: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

/** Thrown on HTTP 402 — the free plan's recipe limit is hit. UI should show the paywall. */
export class FreemiumLimitError extends Error {
  constructor() {
    super('Free recipe limit reached');
    this.name = 'FreemiumLimitError';
  }
}

/** Thrown for any other non-2xx import response. `code` is the server's `error` field. */
export class ImportError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Import failed (${status}): ${code}`);
    this.name = 'ImportError';
  }
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return (
      host === 'youtube.com' ||
      host === 'youtu.be' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com'
    );
  } catch {
    return false;
  }
}

async function postImport(
  fn: 'import-url' | 'import-youtube',
  url: string,
  getToken: GetToken,
): Promise<RecipeRow> {
  if (!SUPABASE_URL) throw new ImportError(0, 'missing_supabase_url');

  const token = await getToken();
  // The Clerk token goes in a CUSTOM header, not Authorization. Supabase's edge
  // gateway tries to verify any Authorization-bearer JWT against its own
  // (asymmetric) signing keys and rejects a Clerk-signed token with
  // UNAUTHORIZED_ASYMMETRIC_JWT before the function runs. `apikey` (the anon
  // publishable key) is what gets the request through the gateway.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { 'X-Clerk-Token': token } : {}),
    },
    body: JSON.stringify({ url }),
  });

  if (res.status === 402) throw new FreemiumLimitError();

  if (!res.ok) {
    const code = await res
      .json()
      .then((b) => b?.error)
      .catch(() => undefined);
    throw new ImportError(res.status, code ?? 'unknown');
  }

  return (await res.json()) as RecipeRow;
}

export function importFromUrl(url: string, getToken: GetToken): Promise<RecipeRow> {
  return postImport('import-url', url, getToken);
}

export function importFromYouTube(url: string, getToken: GetToken): Promise<RecipeRow> {
  return postImport('import-youtube', url, getToken);
}

/** Auto-routes by host: YouTube links → import-youtube, everything else → import-url. */
export function importRecipe(url: string, getToken: GetToken): Promise<RecipeRow> {
  return isYouTubeUrl(url)
    ? importFromYouTube(url, getToken)
    : importFromUrl(url, getToken);
}
