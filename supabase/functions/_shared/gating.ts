import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError } from './http.ts';

// ── Pricing-model limits ─────────────────────────────────────────────────────
// Free: 15 saved recipes, unlimited URL imports, 5 monthly credits.
// Lifetime: unlimited saved recipes, 20 monthly credits.
// One shared "credit" pool covers every metered action: a captioned YouTube
// import (1) and a calorie scan (1). Spend draws the monthly allowance first,
// then purchased `youtube_credits`. (The 15-recipe cap gates URL/photo imports
// only — the credit pool is independent of it.)
const FREE_RECIPE_LIMIT = 15;
const YT_ALLOWANCE_FREE = 5;
const YT_ALLOWANCE_LIFETIME = 20;

export interface Entitlement {
  plan: 'free' | 'lifetime';
  isLifetime: boolean;
  recipeCount: number;
  youtubeCredits: number;
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
      'plan, recipe_count, youtube_credits, youtube_imports_this_month, youtube_month_anchor',
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

/**
 * Best-effort decrement of the saved-recipe counter, floored at 0 — the mirror of
 * incrementRecipeCount, run when a recipe is deleted so the free 15-recipe gate
 * and the profile meter recover. Re-reads the current count (so it can't push the
 * counter below zero from a stale value) and never throws.
 */
export async function decrementRecipeCount(
  supabase: SupabaseClient,
  userId: string,
  tag: string,
): Promise<void> {
  const ent = await loadEntitlement(supabase, userId).catch(() => null);
  if (!ent) {
    console.error(`[${tag}] recipe_count decrement skipped: entitlement load failed`);
    return;
  }
  const { error } = await supabase
    .from('entitlements')
    .update({ recipe_count: Math.max(0, ent.recipeCount - 1) })
    .eq('user_id', userId);

  if (error) console.error(`[${tag}] recipe_count decrement failed:`, error);
}

// ── Shared credits (video imports + calorie scans) ───────────────────────────

export interface CreditGate {
  ent: Entitlement;
  /** Credits this action costs: 1 = captioned YouTube import or a calorie scan. */
  cost: number;
}

/** Remaining monthly allowance credits for the entitlement (never negative). */
function allowanceLeft(ent: Entitlement): number {
  const allowance = ent.isLifetime ? YT_ALLOWANCE_LIFETIME : YT_ALLOWANCE_FREE;
  return Math.max(0, allowance - ent.youtubeImportsThisMonth);
}

/**
 * Gates a metered action against the shared monthly credit pool (YouTube imports
 * and calorie scans both draw from it): first rolls over the monthly counter if
 * we're in a new month, then allows the action only if there are enough credits
 * left to cover `cost` — drawn from the monthly allowance (5 free / 20 lifetime)
 * first, then purchased `youtube_credits`. Nothing is consumed here — call
 * `consumeCredits` only after the action succeeds, so a failure never burns a
 * paid credit.
 *
 * `cost`: 1 for a captioned YouTube import or a calorie scan.
 * Throws 402 `{ reason: 'out_of_credits' }` when the remaining budget < cost.
 */
export async function enforceCreditGate(
  supabase: SupabaseClient,
  userId: string,
  cost = 1,
): Promise<CreditGate> {
  let ent = await loadEntitlement(supabase, userId);

  // Monthly rollover: reset the counter when the anchor is missing or in a prior
  // month. Persist it now — a reset is correct regardless of the action outcome.
  const thisMonth = currentMonthAnchor();
  if (!ent.youtubeMonthAnchor || ent.youtubeMonthAnchor < thisMonth) {
    const { error } = await supabase
      .from('entitlements')
      .update({ youtube_imports_this_month: 0, youtube_month_anchor: thisMonth })
      .eq('user_id', userId);
    if (error) throw new HttpError(500, { error: 'credit_rollover_failed' });
    ent = { ...ent, youtubeImportsThisMonth: 0, youtubeMonthAnchor: thisMonth };
  }

  const available = allowanceLeft(ent) + ent.youtubeCredits;
  if (available < cost) throw new HttpError(402, { reason: 'out_of_credits' });
  return { ent, cost };
}

/**
 * Records a successful metered action: pays `cost` credits from the monthly
 * allowance first, spilling over onto purchased `youtube_credits` only when the
 * month's allowance can't cover it. When `incrementRecipe` is true (the default,
 * for reel/video imports that create a recipe) it also advances the saved-recipe
 * counter; a calorie scan passes false since it saves no recipe.
 * Best-effort — the action has already succeeded by the time this runs.
 */
export async function consumeCredits(
  supabase: SupabaseClient,
  userId: string,
  gate: CreditGate,
  tag: string,
  opts: { incrementRecipe?: boolean } = {},
): Promise<void> {
  const { incrementRecipe = true } = opts;
  const { ent, cost } = gate;
  const fromAllowance = Math.min(allowanceLeft(ent), cost);
  const fromCredits = cost - fromAllowance;

  const patch: Record<string, unknown> = {
    youtube_imports_this_month: ent.youtubeImportsThisMonth + fromAllowance,
  };
  if (incrementRecipe) patch.recipe_count = ent.recipeCount + 1;
  if (fromCredits > 0) {
    patch.youtube_credits = Math.max(0, ent.youtubeCredits - fromCredits);
  }

  const { error } = await supabase
    .from('entitlements')
    .update(patch)
    .eq('user_id', userId);

  if (error) console.error(`[${tag}] credit usage update failed:`, error);
}
