import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { RecipeJSON } from './openrouter.ts';
import { refineTags } from './tagging.ts';
import { uploadRecipeImageFromUrl } from './storage.ts';

interface FinalizeParams {
  supabase: SupabaseClient;
  userId: string;
  recipeId: string;
  recipe: RecipeJSON;
  imageUrl: string | null;
  tag: string; // caller name, for logging
}

/**
 * Runs the non-critical post-insert work — tag refinement (a second, light LLM
 * pass) and copying the image into the private bucket — AFTER the response is
 * sent, so neither blocks the user's import. This is the biggest perceived-speed
 * win: the recipe row is already inserted with the extraction's tags + the origin
 * `image_url`, so the client gets a complete, usable recipe immediately and these
 * updates only *upgrade* it (nicer tags, a private `storage_path`).
 *
 * Scheduled on `EdgeRuntime.waitUntil` so the worker stays alive to finish after
 * responding; falls back to fire-and-forget where that global isn't present
 * (e.g. local dev). Each step is best-effort and self-contained — an interrupted
 * or failed pass never corrupts the already-complete row.
 */
export function finalizeRecipeInBackground(params: FinalizeParams): void {
  const work = runFinalize(params);
  const waitUntil = (
    globalThis as unknown as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }
  ).EdgeRuntime?.waitUntil;
  if (typeof waitUntil === 'function') {
    waitUntil(work);
  } else {
    void work; // no waitUntil (local/dev): run without blocking the caller
  }
}

async function runFinalize({
  supabase,
  userId,
  recipeId,
  recipe,
  imageUrl,
  tag,
}: FinalizeParams): Promise<void> {
  const t0 = Date.now();

  // Refine tags (best-effort) and persist only if we got some back.
  try {
    const tags = await refineTags(recipe);
    if (tags.length > 0) {
      await supabase.from('recipes').update({ tags }).eq('id', recipeId);
    }
  } catch (err) {
    console.error(`[${tag}] background tag refine failed (non-fatal):`, err);
  }

  // Copy the image into the private bucket and record its path (best-effort).
  if (imageUrl) {
    try {
      const storagePath = await uploadRecipeImageFromUrl(supabase, userId, recipeId, imageUrl);
      if (storagePath) {
        await supabase.from('recipes').update({ storage_path: storagePath }).eq('id', recipeId);
      }
    } catch (err) {
      console.error(`[${tag}] background image storage failed (non-fatal):`, err);
    }
  }

  console.log(`[${tag}] ⏱ background finalize ${Date.now() - t0}ms`);
}
