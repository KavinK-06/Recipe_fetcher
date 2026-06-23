import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { RecipeJSON } from './openrouter.ts';
import { HttpError } from './http.ts';

export type RecipeSourceType = 'url' | 'youtube' | 'manual';

// LLMs (especially the fast Gemini model on terse, caption-only sources where an
// ingredient is just "Eggs - 3" with no unit) sometimes emit the literal string
// "null"/"none"/"n/a" for an absent unit or quantity instead of JSON null — which
// then renders as "3 null" in the UI. Treat these as empty.
const NULLISH = new Set(['', 'null', 'none', 'n/a', 'na', 'nil', 'undefined', '-', '–', '—', '.']);

function cleanField(value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  return NULLISH.has(s.toLowerCase()) ? '' : s;
}

/**
 * Normalises extracted ingredients before persisting: scrubs placeholder strings,
 * drops the `unit` key when empty (so it stores as absent, not ""), and discards
 * entries with no name. Shared by every importer via insertRecipe.
 */
function sanitizeIngredients(
  ingredients: RecipeJSON['ingredients'],
): { name: string; quantity: string; unit?: string }[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((ing) => {
      const name = cleanField(ing?.name);
      const quantity = cleanField(ing?.quantity);
      const unit = cleanField(ing?.unit);
      return unit ? { name, quantity, unit } : { name, quantity };
    })
    .filter((ing) => ing.name.length > 0);
}

/**
 * Normalises steps: drops blank instructions, keeps the short glanceable `title`
 * (empty string when the model omits it — the UI just hides the label), and
 * renumbers `order` sequentially (1..n) so a model that skips/duplicates indexes
 * still yields a clean list.
 */
function sanitizeSteps(
  steps: RecipeJSON['steps'],
): { order: number; title: string; instruction: string }[] {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s) => ({
      instruction: typeof s?.instruction === 'string' ? s.instruction.trim() : '',
      title: typeof s?.title === 'string' ? s.title.trim() : '',
    }))
    .filter((s) => s.instruction.length > 0)
    .map((s, i) => ({ order: i + 1, title: s.title, instruction: s.instruction }));
}

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
  const title = typeof recipe.title === 'string' ? recipe.title.trim() : '';
  const ingredients = sanitizeIngredients(recipe.ingredients);
  const steps = sanitizeSteps(recipe.steps);

  // Guard: the model sometimes returns an empty/echo result (null title, no
  // ingredients/steps) when the source isn't a usable recipe — e.g. a YouTube
  // transcript that's music/non-recipe chatter, or a photo with no recipe on it.
  // Reject cleanly (422 → the client's "couldn't find a recipe" message) instead
  // of inserting a null title and crashing on the NOT-NULL constraint (500). This
  // throws before the caller consumes a credit / bumps the saved-recipe count.
  if (!title || (ingredients.length === 0 && steps.length === 0)) {
    console.warn(
      `[${tag}] no recipe extracted (title:${title ? 'y' : 'n'} ingredients:${ingredients.length} steps:${steps.length}) — rejecting`,
    );
    throw new HttpError(422, {
      error: 'no_recipe_found',
      message: 'We couldn’t find a recipe to extract from that source.',
    });
  }

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title,
      description: recipe.description ?? null,
      ingredients,
      steps,
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
