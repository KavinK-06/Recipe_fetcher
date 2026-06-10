import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { callOpenRouter } from '../_shared/openrouter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Summarising is a light task, so lead with Gemini Flash and fall back to the
// heavier 70B model only if it fails — the inverse of the import functions.
const SUMMARY_MODEL = 'google/gemini-2.5-flash';
const SUMMARY_FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct';

const SUMMARY_SYSTEM_PROMPT =
  'You write concise, appetising recipe blurbs. Reply with exactly two short ' +
  'sentences — evocative but factual, focused on flavour and technique. No ' +
  'preamble, no markdown, no quotes.';

const TAG = 'ai-summarise';

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
      .select('id, user_id, title, ingredients, steps')
      .eq('id', recipeId)
      .single();

    if (error || !recipe) throw new HttpError(404, { error: 'recipe_not_found' });
    if (recipe.user_id !== userId) throw new HttpError(403, { error: 'forbidden' });

    // Build the prompt from the stored recipe shape.
    const userPrompt = buildPrompt(recipe);

    // Summarise via OpenRouter (text response).
    let summary: string;
    try {
      summary = (
        await callOpenRouter<string>({
          model: SUMMARY_MODEL,
          fallbackModel: SUMMARY_FALLBACK_MODEL,
          systemPrompt: SUMMARY_SYSTEM_PROMPT,
          userPrompt,
          responseFormat: 'text',
          maxTokens: 160,
        })
      ).trim();
    } catch (err) {
      console.error(`[${TAG}] summarisation failed:`, err);
      throw new HttpError(422, { error: 'summarisation_failed' });
    }

    if (!summary) throw new HttpError(422, { error: 'empty_summary' });

    // Persist the summary; surface a DB failure rather than returning a summary
    // the client thinks was saved.
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ ai_summary: summary })
      .eq('id', recipeId);

    if (updateError) {
      console.error(`[${TAG}] ai_summary update failed:`, updateError);
      throw new HttpError(500, { error: 'update_failed' });
    }

    return json({ summary }, 200);
  } catch (err) {
    return errorResponse(err, TAG);
  }
});

// Ingredients are stored as { name, quantity, unit }[] and steps as
// { order, instruction }[] (see _shared/recipes.ts). Tolerate string entries or
// missing fields so a malformed row never crashes the summary.
function buildPrompt(recipe: Record<string, unknown>): string {
  const title = (recipe.title as string) ?? 'Untitled recipe';

  const ingredients = asArray(recipe.ingredients)
    .map((i) => (typeof i === 'string' ? i : (i as { name?: string })?.name))
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    .join(', ');

  const steps = asArray(recipe.steps)
    .map((s, idx) => {
      const instruction =
        typeof s === 'string' ? s : (s as { instruction?: string })?.instruction;
      return instruction ? `${idx + 1}. ${instruction}` : '';
    })
    .filter((s) => s.length > 0)
    .join(' ');

  return (
    'Summarise this recipe in 2 short sentences, evocative but factual, ' +
    'focused on flavour and technique.\n' +
    `Title: ${title}.\n` +
    `Ingredients: ${ingredients || 'unknown'}.\n` +
    `Steps: ${steps || 'unknown'}.`
  );
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
