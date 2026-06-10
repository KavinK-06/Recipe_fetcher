import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { RecipeJSON } from './openrouter.ts';
import { HttpError } from './http.ts';

export type RecipeSourceType = 'url' | 'youtube' | 'manual';

interface InsertRecipeParams {
  userId: string;
  recipe: RecipeJSON;
  sourceType: RecipeSourceType;
  sourceUrl: string;
  imageUrl: string | null;
  tag: string; // caller name, for logging
}

/**
 * Maps an extracted RecipeJSON onto a `public.recipes` row and inserts it with
 * the service-role client. Returns the inserted row. Throws 500 on DB failure.
 * Shared by `import-url` and `import-youtube` so the column mapping lives once.
 */
export async function insertRecipe(
  supabase: SupabaseClient,
  { userId, recipe, sourceType, sourceUrl, imageUrl, tag }: InsertRecipeParams,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title: recipe.title,
      description: recipe.description ?? null,
      ingredients: recipe.ingredients ?? [],
      steps: recipe.steps ?? [],
      cook_time_minutes: recipe.cookTime,
      prep_time_minutes: recipe.prepTime,
      servings: recipe.servings,
      tags: recipe.tags ?? [],
      image_url: imageUrl,
      source_type: sourceType,
      source_url: sourceUrl,
    })
    .select()
    .single();

  if (error || !data) {
    console.error(`[${tag}] insert failed:`, error);
    throw new HttpError(500, { error: 'insert_failed' });
  }

  return data;
}
