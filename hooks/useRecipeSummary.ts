import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { summariseRecipe } from '../lib/api/summarise';

/**
 * Generates (and persists) a recipe's AI summary via the ai-summarise Edge
 * Function, returning the two-sentence blurb. The summary is written to
 * `recipes.ai_summary` server-side, so on success we invalidate `['recipes']`
 * to pull the updated row.
 *
 * Sends Clerk's *default* session token (`getToken()` with no template), same as
 * `useImportRecipe`. Catch `SummariseError` (from `lib/api/summarise`) on `error`.
 *
 * Usage:
 *   const { mutateAsync, isPending, data, error } = useRecipeSummary();
 *   const summary = await mutateAsync(recipe.id);
 */
export function useRecipeSummary() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<string, Error, string>({
    mutationFn: (recipeId: string) => summariseRecipe(recipeId, () => getToken()),
    onSuccess: (_summary, recipeId) => {
      // Refresh both the list and the specific recipe so the new ai_summary shows.
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipe', recipeId] });
    },
  });
}
