import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { importRecipe, type RecipeRow } from '../lib/api/import';

/**
 * Imports a recipe from a URL or YouTube link via the Edge Functions, then
 * invalidates the recipes list so it refetches. The source (url vs youtube) is
 * chosen automatically by host.
 *
 * Sends Clerk's *default* session token (`getToken()` with no template) — the
 * Edge Functions verify it against Clerk's JWKS. Do NOT use the `supabase`
 * template here (that's only for direct Supabase DB access).
 *
 * Usage: `const { mutateAsync, isPending, error } = useImportRecipe();`
 * Catch `FreemiumLimitError` (from `lib/api/import`) on `error` to show the paywall.
 */
export function useImportRecipe() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<RecipeRow, Error, string>({
    mutationFn: (url: string) => importRecipe(url, () => getToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}
