import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import {
  getRecipeImageUrl,
  RecipeImageError,
  type RecipeImage,
} from '../lib/api/storage';

// Signed URLs from get-recipe-image live 60 min; cache a little under that so a
// fresh URL is fetched before the old one expires.
const FIFTY_MINUTES = 50 * 60 * 1000;

/**
 * Resolves a recipe's display image URL via the get-recipe-image Edge Function:
 * a signed URL into the private bucket (`source: 'storage'`) or the origin
 * `image_url` (`source: 'origin'`).
 *
 * Pass a real `public.recipes` row id (UUID). The query is disabled while
 * `recipeId` is undefined, and a recipe with no image (404 `no_image`) resolves
 * to `url: undefined` (caller shows a placeholder) without retrying.
 *
 * Usage:
 *   const { url, isLoading } = useRecipeImage(recipe.id);
 *   <Image source={url ? { uri: url } : PLACEHOLDER} />
 */
export function useRecipeImage(recipeId: string | undefined) {
  const { getToken } = useAuth();

  const query = useQuery<RecipeImage, Error>({
    queryKey: ['recipe-image', recipeId],
    queryFn: () => getRecipeImageUrl(recipeId as string, () => getToken()),
    enabled: !!recipeId,
    staleTime: FIFTY_MINUTES,
    // Don't retry a 4xx (e.g. no_image / forbidden) — it won't change. Allow a
    // single retry for transient 5xx / network failures.
    retry: (failureCount, err) =>
      !(err instanceof RecipeImageError && err.status < 500) && failureCount < 1,
  });

  return {
    url: query.data?.url,
    source: query.data?.source,
    isLoading: query.isLoading,
  };
}
