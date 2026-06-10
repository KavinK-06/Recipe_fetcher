import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import {
  analyzeDishPhoto,
  type AnalyzeDishParams,
  type NutritionResult,
} from '../lib/api/nutrition';

/**
 * Sends a dish photo to the ai-nutrition Edge Function and returns estimated
 * macros (calories, protein, carbs, fat, …) for the portion shown. It's a
 * stateless analysis — nothing is persisted — so there's no query to invalidate.
 *
 * Sends Clerk's *default* session token (`getToken()` with no template), same as
 * `useImportRecipe`. Catch `NutritionError` (from `lib/api/nutrition`) on `error`.
 *
 * Usage:
 *   const { mutateAsync, isPending, data, error } = useNutritionAnalysis();
 *   const macros = await mutateAsync({ image: dataUrl, note });
 */
export function useNutritionAnalysis() {
  const { getToken } = useAuth();

  return useMutation<NutritionResult, Error, AnalyzeDishParams>({
    mutationFn: (params: AnalyzeDishParams) =>
      analyzeDishPhoto(params, () => getToken()),
  });
}
