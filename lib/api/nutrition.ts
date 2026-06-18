// Client API for the ai-nutrition Edge Function: photo of a dish → estimated
// macros (calories, protein, carbs, fat, …).
//
// AUTH: same model as lib/api/import.ts — Clerk's *default* session token in an
// `X-Clerk-Token` header (NOT Authorization), with the anon key as `apikey` to
// pass Supabase's edge gateway. Call Clerk's `getToken` with NO template.
//
// IMAGE: pass either a `data:image/...;base64,...` data URL or a public http(s)
// image URL. In the app, produce the data URL with expo-image-picker/camera +
// expo-image-manipulator (resize to ~768px, JPEG quality ~0.6, base64) so the
// upload stays small — the Edge Function rejects images over ~5 MB.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type GetToken = () => Promise<string | null>;

/** A single recognised component of the dish (e.g. "rice", "grilled chicken"). */
export interface NutritionItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Estimated nutrition for the portion shown in the photo. */
export interface NutritionResult {
  dish: string | null;
  servingSize: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  items: NutritionItem[];
}

export interface AnalyzeDishParams {
  /** Data URL (`data:image/...;base64,...`) or a public http(s) image URL. */
  image: string;
  /** Optional hint, e.g. "homemade, about 2 cups". */
  note?: string;
}

/** Thrown for any non-2xx response. `code` is the server's `error` field. */
export class NutritionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Nutrition analysis failed (${status}): ${code}`);
    this.name = 'NutritionError';
  }
}

export async function analyzeDishPhoto(
  { image, note }: AnalyzeDishParams,
  getToken: GetToken,
): Promise<NutritionResult> {
  if (!SUPABASE_URL) throw new NutritionError(0, 'missing_supabase_url');

  const token = await getToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-nutrition`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
      ...(token ? { 'X-Clerk-Token': token } : {}),
    },
    body: JSON.stringify({ image, ...(note ? { note } : {}) }),
  });

  if (!res.ok) {
    // 402 limit responses carry `{ reason }`; other errors carry `{ error }`.
    const code = await res
      .json()
      .then((b) => b?.error ?? b?.reason)
      .catch(() => undefined);
    throw new NutritionError(res.status, code ?? 'unknown');
  }

  return (await res.json()) as NutritionResult;
}
