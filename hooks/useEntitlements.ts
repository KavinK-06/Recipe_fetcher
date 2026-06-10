import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useSupabaseClient } from './useSupabaseClient';
import { usePaywall } from '../components/PaywallProvider';

// Keep these in sync with supabase/functions/_shared/gating.ts.
const FREE_RECIPE_LIMIT = 15;
const YT_ALLOWANCE_FREE = 3;
const YT_ALLOWANCE_LIFETIME = 20;

interface EntitlementRow {
  plan: 'free' | 'lifetime';
  recipe_count: number;
  youtube_credits: number;
  ai_credits: number;
  youtube_imports_this_month: number;
  youtube_month_anchor: string | null;
}

/** First day of the current UTC month, matching the server's anchor format. */
function currentMonthAnchor(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Reads the signed-in user's entitlement row directly (RLS scopes the query to
 * their row) and derives the flags the UI needs. Also exposes `showPaywall` from
 * the PaywallProvider so a single hook drives both gating display and the CTA.
 */
export function useEntitlements() {
  const { userId, isSignedIn } = useAuth();
  const supabase = useSupabaseClient();
  const { showPaywall } = usePaywall();

  const query = useQuery({
    queryKey: ['entitlements', userId],
    enabled: !!isSignedIn,
    staleTime: 60_000,
    queryFn: async (): Promise<EntitlementRow | null> => {
      const { data, error } = await supabase
        .from('entitlements')
        .select(
          'plan, recipe_count, youtube_credits, ai_credits, youtube_imports_this_month, youtube_month_anchor',
        )
        .maybeSingle();
      if (error) throw error;
      return (data as EntitlementRow | null) ?? null;
    },
  });

  const ent = query.data ?? null;
  const plan = ent?.plan ?? 'free';
  const isLifetime = plan === 'lifetime';
  const recipeCount = ent?.recipe_count ?? 0;
  const aiCredits = ent?.ai_credits ?? 0;
  const youtubeCredits = ent?.youtube_credits ?? 0;

  // Monthly allowance still remaining (treat a stale anchor as a fresh month),
  // plus any purchased YouTube credits.
  const allowance = isLifetime ? YT_ALLOWANCE_LIFETIME : YT_ALLOWANCE_FREE;
  const usedThisMonth =
    ent && ent.youtube_month_anchor && ent.youtube_month_anchor >= currentMonthAnchor()
      ? ent.youtube_imports_this_month
      : 0;
  const youtubeRemaining = Math.max(0, allowance - usedThisMonth) + youtubeCredits;

  return {
    plan,
    isLifetime,
    recipeCount,
    recipeLimit: FREE_RECIPE_LIMIT,
    atRecipeLimit: !isLifetime && recipeCount >= FREE_RECIPE_LIMIT,
    youtubeRemaining,
    aiCredits,
    isLoading: query.isLoading,
    refetch: query.refetch,
    showPaywall,
  };
}
