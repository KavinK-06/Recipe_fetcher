import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { decrementRecipeCount } from '../_shared/gating.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET = 'recipe-images';

const TAG = 'delete-recipe';

// Deploy: supabase functions deploy delete-recipe --no-verify-jwt
//   (self-verifies the Clerk token via JWKS; client sends it in X-Clerk-Token
//    plus the anon key in apikey, like the import functions.)
//
// Deletes one of the caller's recipes (service role, scoped to their user_id) and
// keeps the saved-recipe counter honest: decrements entitlements.recipe_count so
// the free 15-recipe gate + profile meter recover (the client can't write
// entitlements — it's SELECT-only for the owner — so this must run server-side).
// collection_recipes rows cascade (FK on delete cascade); the stored image is
// removed best-effort.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  let recipeId: string;
  try {
    const body = await req.json();
    recipeId = body?.recipeId ?? body?.id;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof recipeId !== 'string' || !recipeId) {
    return json({ error: 'invalid_recipe_id' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { userId } = await authenticateRequest(req, supabase);

    // Service-role delete, scoped to the owner so a user can only delete their own
    // recipe. `.select()` returns the deleted row(s); empty → not found/owned.
    const { data: deleted, error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', userId)
      .select('id, storage_path');
    if (error) {
      console.error(`[${TAG}] delete failed:`, error);
      throw new HttpError(500, { error: 'delete_failed' });
    }
    if (!deleted || deleted.length === 0) {
      throw new HttpError(404, { error: 'recipe_not_found' });
    }

    // Keep the saved-recipe counter honest (best-effort — the row is already gone).
    await decrementRecipeCount(supabase, userId, TAG);

    // Best-effort: remove the stored image so deletes don't orphan bucket objects.
    const storagePath = (deleted[0] as { storage_path: string | null }).storage_path;
    if (storagePath) {
      const { error: rmError } = await supabase.storage.from(BUCKET).remove([storagePath]);
      if (rmError) console.error(`[${TAG}] image cleanup failed (non-fatal):`, rmError);
    }

    return json({ id: recipeId, deleted: true }, 200);
  } catch (err) {
    return errorResponse(err, TAG);
  }
});
