import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError } from './http.ts';

// ── Pricing-model limits ─────────────────────────────────────────────────────
// Free: 15 saved recipes, unlimited URL imports, 3 YouTube imports/month.
// Lifetime: unlimited saved recipes, 20 YouTube imports/month.
// YouTube imports beyond the monthly allowance consume a `youtube_credit`.
// (Per the pricing spec, the 15-recipe cap gates URL imports only — YouTube is
// gated by its own monthly allowance + credits, not the saved-recipe cap.)
const FREE_RECIPE_LIMIT = 15;
const YT_ALLOWANCE_FREE = 3;
const YT_ALLOWANCE_LIFETIME = 20;
const AI_SCAN_COST = 2;

export interface Entitlement {
  plan: 'free' | 'lifetime';
  isLifetime: boolean;
  recipeCount: number;
  youtubeCredits: number;
  aiCredits: number;
  youtubeImportsThisMonth: number;
  youtubeMonthAnchor: string | null; // 'YYYY-MM-DD'
}

/** First day of the current UTC month as a 'YYYY-MM-01' date string. */
function currentMonthAnchor(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

async function loadEntitlement(
  supabase: SupabaseClient,
  userId: string,
): Promise<Entitlement> {
  const { data, error } = await supabase
    .from('entitlements')
    .select(
      'plan, recipe_count, youtube_credits, ai_credits, youtube_imports_this_month, youtube_month_anchor',
    )
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new HttpError(500, { error: 'entitlement_not_found' });

  const plan = (data.plan as string) === 'lifetime' ? 'lifetime' : 'free';
  return {
    plan,
    isLifetime: plan === 'lifetime',
    recipeCount: (data.recipe_count as number) ?? 0,
    youtubeCredits: (data.youtube_credits as number) ?? 0,
    aiCredits: (data.ai_credits as number) ?? 0,
    youtubeImportsThisMonth: (data.youtube_imports_this_month as number) ?? 0,
    youtubeMonthAnchor: (data.youtube_month_anchor as string | null) ?? null,
  };
}

// ── URL imports ──────────────────────────────────────────────────────────────

/**
 * Gates a URL import on the free saved-recipe cap. Lifetime users are unlimited.
 * Returns the entitlement so the caller can pass `recipeCount` to
 * `incrementRecipeCount` after a successful import.
 * Throws 402 `{ reason: 'recipe_limit' }` when a free user is at the cap.
 */
export async function enforceUrlGate(
  supabase: SupabaseClient,
  userId: string,
): Promise<Entitlement> {
  const ent = await loadEntitlement(supabase, userId);
  if (!ent.isLifetime && ent.recipeCount >= FREE_RECIPE_LIMIT) {
    throw new HttpError(402, { reason: 'recipe_limit' });
  }
  return ent;
}

/**
 * Best-effort increment of the saved-recipe counter. Never throws — the recipe
 * is already saved by the time this runs, so a counter failure is logged.
 */
export async function incrementRecipeCount(
  supabase: SupabaseClient,
  userId: string,
  currentCount: number,
  tag: string,
): Promise<void> {
  const { error } = await supabase
    .from('entitlements')
    .update({ recipe_count: currentCount + 1 })
    .eq('user_id', userId);

  if (error) console.error(`[${tag}] recipe_count increment failed:`, error);
}

// ── YouTube imports ──────────────────────────────────────────────────────────

export interface YouTubeGate {
  ent: Entitlement;
  /** How this import will be paid for once it succeeds. */
  mode: 'allowance' | 'credit';
}

/**
 * Gates a YouTube import: first rolls over the monthly counter if we're in a new
 * month, then allows the import if there's monthly allowance left (3 free / 20
 * lifetime) or a YouTube credit to spend. Nothing is consumed here — call
 * `consumeYouTubeImport` only after the import succeeds, so a failed import
 * never burns a paid credit.
 * Throws 402 `{ reason: 'youtube_limit' }` when neither allowance nor credits
 * remain.
 */
export async function enforceYouTubeGate(
  supabase: SupabaseClient,
  userId: string,
): Promise<YouTubeGate> {
  let ent = await loadEntitlement(supabase, userId);

  // Monthly rollover: reset the counter when the anchor is missing or in a prior
  // month. Persist it now — a reset is correct regardless of the import outcome.
  const thisMonth = currentMonthAnchor();
  if (!ent.youtubeMonthAnchor || ent.youtubeMonthAnchor < thisMonth) {
    const { error } = await supabase
      .from('entitlements')
      .update({ youtube_imports_this_month: 0, youtube_month_anchor: thisMonth })
      .eq('user_id', userId);
    if (error) throw new HttpError(500, { error: 'youtube_rollover_failed' });
    ent = { ...ent, youtubeImportsThisMonth: 0, youtubeMonthAnchor: thisMonth };
  }

  const allowance = ent.isLifetime ? YT_ALLOWANCE_LIFETIME : YT_ALLOWANCE_FREE;
  if (ent.youtubeImportsThisMonth < allowance) return { ent, mode: 'allowance' };
  if (ent.youtubeCredits > 0) return { ent, mode: 'credit' };
  throw new HttpError(402, { reason: 'youtube_limit' });
}

/**
 * Records a successful YouTube import: always advances the monthly counter and
 * the saved-recipe counter; spends a YouTube credit only when this import was
 * over the monthly allowance. Best-effort (the recipe is already saved).
 */
export async function consumeYouTubeImport(
  supabase: SupabaseClient,
  userId: string,
  gate: YouTubeGate,
  tag: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    youtube_imports_this_month: gate.ent.youtubeImportsThisMonth + 1,
    recipe_count: gate.ent.recipeCount + 1,
  };
  if (gate.mode === 'credit') {
    patch.youtube_credits = Math.max(0, gate.ent.youtubeCredits - 1);
  }

  const { error } = await supabase
    .from('entitlements')
    .update(patch)
    .eq('user_id', userId);

  if (error) console.error(`[${tag}] youtube usage update failed:`, error);
}

// ── AI macro scan (dish photo → nutrition) ───────────────────────────────────

/**
 * Gates a macro scan on the user's AI credit balance. Lifetime users are NOT
 * exempt — consumables are metered for everyone to protect AI-provider margins.
 * Throws 402 `{ reason: 'no_ai_credits' }` when the balance is below the cost.
 * Returns the current balance (informational).
 */
export async function enforceAiCredits(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('ai_credits')
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new HttpError(500, { error: 'entitlement_not_found' });
  const credits = (data.ai_credits as number) ?? 0;
  if (credits < AI_SCAN_COST) throw new HttpError(402, { reason: 'no_ai_credits' });
  return credits;
}

/**
 * Atomically deducts the macro-scan cost via the `deduct_ai_credits` RPC (a
 * conditional UPDATE, so the check + decrement can't race). Returns the new
 * balance, or null if the deduction didn't apply (credits drained concurrently).
 * Called only after a successful, parsed scan result.
 */
export async function deductAiCredits(
  supabase: SupabaseClient,
  userId: string,
  tag: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('deduct_ai_credits', {
    p_user_id: userId,
    p_amount: AI_SCAN_COST,
  });

  if (error) {
    console.error(`[${tag}] ai credit deduction failed:`, error);
    return null;
  }
  // The SQL function returns the new balance, or no row (null) if insufficient.
  return typeof data === 'number' ? data : null;
}
