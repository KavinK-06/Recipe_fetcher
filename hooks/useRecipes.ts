import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useSupabaseClient } from './useSupabaseClient';
import type { RecipeRow } from '../lib/api/import';

/**
 * The signed-in user's saved recipes, newest first, read directly from
 * `public.recipes` via the RLS-scoped Supabase client (the `supabase` template
 * token). RLS restricts the rows to the current user, so no explicit user filter
 * is needed.
 *
 * Cache key `['recipes', userId]` — invalidated by `useImportRecipe` (after a new
 * import) and `useRecipeSummary` (after a summary write), both of which
 * invalidate the `['recipes']` prefix.
 */
export function useRecipes() {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();

  const query = useQuery<RecipeRow[], Error>({
    queryKey: ['recipes', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[useRecipes] read failed', {
          code: (error as any).code,
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
        });
        throw new Error(error.message);
      }
      console.log(`[useRecipes] loaded ${data?.length ?? 0} recipe(s) via RLS`);
      return (data ?? []) as RecipeRow[];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  return {
    recipes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
