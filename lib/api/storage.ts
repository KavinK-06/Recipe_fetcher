// Client API for the get-recipe-image Edge Function: resolves the display URL
// for a recipe's image. Returns either a short-lived signed URL into the private
// recipe-images bucket (`source: 'storage'`) or the origin `image_url` the
// recipe was imported with (`source: 'origin'`).
//
// AUTH: same model as lib/api/import.ts — Clerk's *default* session token in an
// `X-Clerk-Token` header (NOT Authorization), with the anon key as `apikey` to
// pass Supabase's edge gateway. Call Clerk's `getToken` with NO template.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type GetToken = () => Promise<string | null>;

export interface RecipeImage {
  url: string;
  source: 'storage' | 'origin';
}

/**
 * Thrown for any non-2xx response. `code` is the server's `error` field — e.g.
 * `no_image` (404, the recipe has neither a stored copy nor an origin URL),
 * `recipe_not_found`, or `forbidden`.
 */
export class RecipeImageError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Recipe image fetch failed (${status}): ${code}`);
    this.name = 'RecipeImageError';
  }
}

export async function getRecipeImageUrl(
  recipeId: string,
  getToken: GetToken,
): Promise<RecipeImage> {
  if (!SUPABASE_URL) throw new RecipeImageError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-recipe-image`, {
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
    throw new RecipeImageError(res.status, code ?? 'unknown');
  }

  return (await res.json()) as RecipeImage;
}
