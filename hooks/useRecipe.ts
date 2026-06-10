import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useSupabaseClient } from './useSupabaseClient';
import { isUuid } from '../lib/recipes/uiRecipe';
import type { RecipeRow } from '../lib/api/import';

/**
 * A single recipe by id, read via the RLS-scoped Supabase client. Returns null
 * when the row doesn't exist (or isn't the caller's, per RLS).
 *
 * The query only runs for real UUID ids — mock ids (e.g. '1', 'c1') arriving from
 * the still-mock search/collections screens skip the DB entirely (enabled:false),
 * so the consuming screen falls back to mock data without a wasted round-trip.
 */
export function useRecipe(id: string | undefined) {
  const { userId } = useAuth();
  const supabase = useSupabaseClient();

  const query = useQuery<RecipeRow | null, Error>({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id as string)
        .maybeSingle();
      if (error) {
        // Surface the real PostgREST/RLS failure (e.g. 401 = token rejected,
        // or an empty result = current_user_id() didn't resolve the JWT claim).
        console.error('[useRecipe] read failed', {
          id,
          code: (error as any).code,
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
        });
        throw new Error(error.message);
      }
      if (!data) {
        console.warn('[useRecipe] no row returned — RLS hid it or it is missing', { id });
      }
      return (data as RecipeRow) ?? null;
    },
    enabled: !!userId && isUuid(id),
    staleTime: 30_000,
  });

  return {
    recipe: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
