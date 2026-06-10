// Client API for the ai-summarise Edge Function: generates a short, two-sentence
// blurb for a recipe and persists it to `recipes.ai_summary` server-side,
// returning the text.
//
// AUTH: same model as lib/api/import.ts — Clerk's *default* session token in an
// `X-Clerk-Token` header (NOT Authorization), with the anon key as `apikey`.
// Call Clerk's `getToken` with NO template.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type GetToken = () => Promise<string | null>;

/** Thrown for any non-2xx response. `code` is the server's `error` field. */
export class SummariseError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Summarise failed (${status}): ${code}`);
    this.name = 'SummariseError';
  }
}

export async function summariseRecipe(
  recipeId: string,
  getToken: GetToken,
): Promise<string> {
  if (!SUPABASE_URL) throw new SummariseError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-summarise`, {
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
    throw new SummariseError(res.status, code ?? 'unknown');
  }

  const data = (await res.json()) as { summary: string };
  return data.summary;
}
