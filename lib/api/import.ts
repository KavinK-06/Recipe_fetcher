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
  steps: { order: number; instruction: string; title?: string }[];
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

/**
 * Thrown on HTTP 402 — a usage limit is hit; UI should show the paywall.
 * `reason` distinguishes which limit: 'recipe_limit' (saved-recipe cap, from
 * URL/photo imports) vs 'out_of_credits' (shared credit pool, from YouTube
 * imports) — so the caller can open the right paywall product.
 */
export class FreemiumLimitError extends Error {
  constructor(public readonly reason?: string) {
    super('Free usage limit reached');
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

/**
 * Social-video sources Rasoi does NOT support. Returns the display name so the UI
 * can show a clear "not supported" message instead of letting the link fall
 * through to the generic web scraper (which would just fail confusingly). Instagram
 * import was removed (2026-06-17); TikTok was never built.
 */
export function unsupportedSource(url: string): 'Instagram' | 'TikTok' | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'instagram.com' || host === 'instagr.am') return 'Instagram';
    if (host === 'tiktok.com' || host === 'vm.tiktok.com' || host.endsWith('.tiktok.com')) {
      return 'TikTok';
    }
    return null;
  } catch {
    return null;
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

  if (res.status === 402) {
    const reason = await res
      .json()
      .then((b) => b?.reason)
      .catch(() => undefined);
    throw new FreemiumLimitError(reason);
  }

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

/**
 * Imports a recipe from a photo (a `data:image/...;base64,...` data URL) via the
 * import-photo Edge Function. The function OCRs the image, extracts the recipe,
 * saves it, and stores the photo as the recipe image. Auth/error handling mirror
 * postImport. Throws FreemiumLimitError on 402 (free saved-recipe cap).
 */
export async function importFromPhoto(image: string, getToken: GetToken): Promise<RecipeRow> {
  if (!SUPABASE_URL) throw new ImportError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { 'X-Clerk-Token': token } : {}),
    },
    body: JSON.stringify({ image }),
  });

  if (res.status === 402) {
    const reason = await res
      .json()
      .then((b) => b?.reason)
      .catch(() => undefined);
    throw new FreemiumLimitError(reason);
  }

  if (!res.ok) {
    const code = await res
      .json()
      .then((b) => b?.error)
      .catch(() => undefined);
    throw new ImportError(res.status, code ?? 'unknown');
  }

  return (await res.json()) as RecipeRow;
}

export function importFromYouTube(url: string, getToken: GetToken): Promise<RecipeRow> {
  return postImport('import-youtube', url, getToken);
}

/**
 * Deletes one of the caller's recipes via the delete-recipe Edge Function (service
 * role: removes the row, decrements the saved-recipe counter, cleans up the stored
 * image). Auth mirrors postImport. Throws ImportError on non-2xx (404
 * `recipe_not_found` when the row isn't owned/visible under the caller's auth).
 */
export async function deleteRecipe(recipeId: string, getToken: GetToken): Promise<void> {
  if (!SUPABASE_URL) throw new ImportError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-recipe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { 'X-Clerk-Token': token } : {}),
    },
    body: JSON.stringify({ recipeId }),
  });

  if (!res.ok) {
    const code = await res
      .json()
      .then((b) => b?.error)
      .catch(() => undefined);
    throw new ImportError(res.status, code ?? 'unknown');
  }
}

/**
 * Auto-routes by host: YouTube → import-youtube (transcriptapi.com, metered on the
 * monthly credit allowance); everything else → import-url.
 */
export function importRecipe(url: string, getToken: GetToken): Promise<RecipeRow> {
  if (isYouTubeUrl(url)) return importFromYouTube(url, getToken);
  return importFromUrl(url, getToken);
}
