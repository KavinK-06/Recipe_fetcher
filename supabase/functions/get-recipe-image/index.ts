import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const BUCKET = 'recipe-images';
const SIGNED_URL_TTL = 3600; // seconds — 1 hour (client caches for ~50 min, see useRecipeImage)

const TAG = 'get-recipe-image';

// Resolves the display URL for a recipe's image. Prefers the stored copy (a
// short-lived signed URL into the private bucket) and falls back to the origin
// image_url the recipe was imported with. Auth + ownership are enforced exactly
// like ai-summarise; the signed URL is minted with the service role (bypasses
// RLS), so no client ever reads Storage directly.
//
// Deploy: supabase functions deploy get-recipe-image --no-verify-jwt
//   (self-verifies the Clerk token via JWKS; the gateway must not pre-reject it —
//    the client sends the Clerk token in X-Clerk-Token + anon key in apikey.)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Parse + validate input
  let recipeId: string;
  try {
    const body = await req.json();
    recipeId = body?.recipeId;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof recipeId !== 'string' || recipeId.length === 0) {
    return json({ error: 'invalid_recipe_id' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Auth (Clerk session token via JWKS) → internal user id
    const { userId } = await authenticateRequest(req, supabase);

    // Load the recipe; 404 if missing, 403 if it belongs to another user.
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('id, user_id, storage_path, image_url')
      .eq('id', recipeId)
      .single();

    if (error || !recipe) throw new HttpError(404, { error: 'recipe_not_found' });
    if (recipe.user_id !== userId) throw new HttpError(403, { error: 'forbidden' });

    // Prefer the stored copy: a short-lived signed URL into the private bucket.
    if (recipe.storage_path) {
      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(recipe.storage_path as string, SIGNED_URL_TTL);

      if (signError || !signed?.signedUrl) {
        console.error(`[${TAG}] sign failed for ${recipe.storage_path}:`, signError);
        // Don't hard-fail if we can still serve the origin image.
        if (recipe.image_url) return json({ url: recipe.image_url, source: 'origin' }, 200);
        throw new HttpError(500, { error: 'sign_failed' });
      }
      return json({ url: signed.signedUrl, source: 'storage' }, 200);
    }

    // No stored copy yet → serve the origin image the recipe was imported with.
    if (recipe.image_url) {
      return json({ url: recipe.image_url, source: 'origin' }, 200);
    }

    // Neither → the recipe has no image.
    throw new HttpError(404, { error: 'no_image' });
  } catch (err) {
    return errorResponse(err, TAG);
  }
});
