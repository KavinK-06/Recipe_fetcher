import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useSupabaseClient } from './useSupabaseClient';
import { deleteRecipe, type RecipeRow } from '../lib/api/import';

/**
 * The signed-in user's saved recipes, newest first, read directly from
 * `public.recipes` via the RLS-scoped Supabase client (the `supabase` template
 * token). RLS restricts the rows to the current user, so no explicit user filter
 * is needed.
 *
 * Cache key `['recipes', userId]` — invalidated by `useImportRecipe` (after a new
 * import), which invalidates the `['recipes']` prefix.
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

/**
 * Deletes a recipe through the delete-recipe Edge Function (which also decrements
 * the saved-recipe counter server-side). On success, invalidates the recipe lists,
 * the entitlements (so the free-plan meter recovers), and collections (a deleted
 * recipe drops out of any collection it was in).
 */
export function useDeleteRecipe() {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (recipeId: string) => deleteRecipe(recipeId, () => getToken()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['entitlements'] });
      qc.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
