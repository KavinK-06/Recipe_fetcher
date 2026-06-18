import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY') ?? '';
const BUCKET = 'recipe-images';

const TAG = 'delete-account';

// Deploy: supabase functions deploy delete-account --no-verify-jwt
//   (self-verifies the Clerk token via JWKS; client sends it in X-Clerk-Token
//    plus the anon key in apikey, like the other authenticated functions.)
//
// Requires CLERK_SECRET_KEY (Clerk Backend API key) in addition to the usual
// CLERK_JWKS_URL — set it once with:
//   supabase secrets set CLERK_SECRET_KEY=sk_live_...
//
// Permanently and irreversibly deletes the caller's account: every stored recipe
// image, all app data (deleting the public.users row cascades recipes,
// collections, collection_recipes, entitlements, payments, play_purchases), and
// the Clerk identity itself. Required for App Store / Play "delete account"
// compliance.
//
// ORDER MATTERS. We look up the (read-only) storage paths, then delete the Clerk
// user FIRST — that's the irreversible identity step, so if it fails we abort
// with the database still fully intact and the user can retry. Only once the
// identity is gone do we wipe storage + the users row. Clerk's `user.deleted`
// webhook fires from that deletion and runs the same users-row delete again
// idempotently, so the DB is cleaned up even if our own delete below were to fail.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { clerkUserId, userId } = await authenticateRequest(req, supabase);

    if (!CLERK_SECRET_KEY) {
      console.error(`[${TAG}] CLERK_SECRET_KEY not configured — cannot delete the Clerk identity`);
      throw new HttpError(500, { error: 'not_configured' });
    }

    // Read-only: gather the bucket objects to remove. storage.objects have no FK
    // to public.users, so the cascade won't touch them — we delete them by hand.
    const { data: recipes } = await supabase
      .from('recipes')
      .select('storage_path')
      .eq('user_id', userId);
    const paths = ((recipes ?? []) as { storage_path: string | null }[])
      .map((r) => r.storage_path)
      .filter((p): p is string => !!p);

    // Irreversible identity deletion FIRST. 404 = already gone (treat as done);
    // any other non-2xx aborts before we mutate anything in our own stores.
    const res = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.text().catch(() => '');
      console.error(`[${TAG}] Clerk user delete failed (${res.status}):`, body.slice(0, 300));
      throw new HttpError(502, { error: 'clerk_delete_failed' });
    }

    // Best-effort storage cleanup (the recipe rows are about to vanish anyway).
    if (paths.length > 0) {
      const { error: rmError } = await supabase.storage.from(BUCKET).remove(paths);
      if (rmError) console.error(`[${TAG}] image cleanup failed (non-fatal):`, rmError);
    }

    // Wipe all app data — deleting the users row cascades every per-user table.
    const { error: delError } = await supabase.from('users').delete().eq('id', userId);
    if (delError) {
      // The Clerk identity is already gone and the user.deleted webhook will run
      // this same delete — log loudly but don't fail the client over it.
      console.error(`[${TAG}] users row delete failed (webhook will retry):`, delError);
    }

    return json({ deleted: true }, 200);
  } catch (err) {
    return errorResponse(err, TAG);
  }
});
