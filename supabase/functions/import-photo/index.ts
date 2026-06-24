import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { enforceUrlGate, incrementRecipeCount } from '../_shared/gating.ts';
import { insertRecipe } from '../_shared/recipes.ts';
import { storeRecipePhotoFromDataUrl } from '../_shared/storage.ts';
import { refineTags } from '../_shared/tagging.ts';
import { callOpenRouter, type RecipeJSON } from '../_shared/openrouter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Reading a recipe off a photo is a vision/OCR task, so we lead with a
// multimodal model (gemini-2.5-flash), with gpt-4o-mini as the vision fallback.
const MODEL = 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'openai/gpt-4o-mini';

// ~5 MB image as base64. The client resizes/compresses before sending; reject
// anything larger up front so we never ship a giant body to OpenRouter.
const MAX_IMAGE_CHARS = 7_000_000;

const SYSTEM_PROMPT =
  'You are a culinary data extractor with strong OCR ability. You receive a ' +
  'PHOTO of a recipe — a cookbook page, a printed card, a handwritten note, or ' +
  'a screenshot. Read ALL legible text in the image and structure it faithfully. ' +
  'Do not invent ingredients or steps that are not shown. Prefer METRIC units: ' +
  'convert any weight in pounds or ounces to grams (1 lb ~ 454 g, 1 oz ~ 28 g) ' +
  'and any liquid volume in fluid ounces, pints, quarts or gallons to millilitres ' +
  'or litres, rounding to sensible cooking amounts; leave intuitive kitchen ' +
  'measures as they are (teaspoon, tablespoon, cup, pinch, clove, whole-piece counts). ' +
  'Reply with ONLY a JSON ' +
  'object — no markdown, no commentary.';

const TAG = 'import-photo';

// Deploy: supabase functions deploy import-photo --no-verify-jwt
//   (self-verifies the Clerk token via JWKS; client sends it in X-Clerk-Token
//    plus the anon key in apikey, exactly like the other import functions.)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Parse + validate input
  let image: unknown;
  try {
    const body = await req.json();
    image = body?.image;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof image !== 'string' || !isBase64Image(image)) {
    return json({ error: 'invalid_image' }, 400);
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return json({ error: 'image_too_large' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Auth (Clerk session token via JWKS) + the free saved-recipe cap (15;
    // lifetime is unlimited) — same gate as URL imports, since this also saves
    // exactly one recipe.
    const { userId } = await authenticateRequest(req, supabase);
    const gate = await enforceUrlGate(supabase, userId);

    // Vision models are unreliable with response_format: json_object, so we ask
    // for text and parse the JSON defensively below (same as ai-nutrition).
    let raw: string;
    try {
      raw = await callOpenRouter<string>({
        model: MODEL,
        fallbackModel: FALLBACK_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: USER_PROMPT,
        images: [image],
        responseFormat: 'text',
        // Richer 40–60 word steps (up to ~12) need more headroom; too low a cap
        // truncates the reply mid-JSON and the parse fails.
        maxTokens: 3500,
      });
    } catch (err) {
      console.error(`[${TAG}] extraction failed:`, err);
      throw new HttpError(422, { error: 'extraction_failed' });
    }

    const recipe = parseRecipe(raw);
    if (!recipe || (!recipe.title && recipe.ingredients.length === 0 && recipe.steps.length === 0)) {
      console.error(`[${TAG}] no recipe in photo:`, raw.slice(0, 400));
      throw new HttpError(422, { error: 'no_recipe_found' });
    }
    if (!recipe.title) recipe.title = 'Scanned recipe';

    // Refine tags (best-effort; returns existing tags unchanged on any failure).
    recipe.tags = await refineTags(recipe);

    // Insert + bump the freemium counter. No origin URL/image yet — the photo
    // becomes the image in the next step.
    const inserted = await insertRecipe(supabase, {
      userId,
      recipe,
      sourceType: 'manual',
      sourceUrl: '',
      imageUrl: null,
      tag: TAG,
    });
    await incrementRecipeCount(supabase, userId, gate.recipeCount, TAG);

    // Store the user's photo as the recipe image (best-effort; never fails the
    // import). Stamps both storage_path and a long-lived signed image_url.
    try {
      const stored = await storeRecipePhotoFromDataUrl(
        supabase,
        userId,
        inserted.id as string,
        image,
      );
      if (stored) {
        await supabase
          .from('recipes')
          .update({ storage_path: stored.path, image_url: stored.signedUrl })
          .eq('id', inserted.id);
        inserted.storage_path = stored.path;
        inserted.image_url = stored.signedUrl;
      }
    } catch (err) {
      console.error(`[${TAG}] photo storage failed (non-fatal):`, err);
    }

    return json(inserted, 200);
  } catch (err) {
    return errorResponse(err, TAG);
  }
});

const USER_PROMPT =
  'Extract the recipe from this photo. Return ONLY this JSON shape:\n' +
  '{ "title": string, "description": string, ' +
  '"ingredients": [{ "name": string, "quantity": string, "unit": string }], ' +
  '"steps": [{ "order": number, "title": string, "instruction": string }], ' +
  '"cookTime": number|null, "prepTime": number|null, "servings": number|null, ' +
  '"tags": string[], "imageUrl": null }\n' +
  'cookTime/prepTime are integer minutes or null. servings is an integer or ' +
  'null. tags are 3-6 lowercase one-word labels. Transcribe quantities exactly ' +
  'as written. If an ingredient has no written amount, set its quantity to a ' +
  'natural phrase like "to taste" or "as needed" rather than leaving it blank. ' +
  'STEP STRUCTURE: organise the method into clear titled steps — aim ' +
  'for 6 to 10 as a GROUPING guideline for how many cards to show, NOT a content ' +
  'limit. Bundle closely-related actions into one step, and group all prep ' +
  '(chopping, measuring) into one step titled "Prep" at the start. A simple recipe ' +
  'may have fewer (do not pad); a complex dish may need around 12 or a few more. ' +
  'NEVER drop, shorten or summarise away any detail to hit a step count — every ' +
  'ingredient, quantity, temperature, time and technique shown MUST appear in the ' +
  'steps; a step\'s "instruction" may be several sentences, and the step count ' +
  'always yields to keeping all the detail. Give every step a "title" of one to ' +
  'three words naming the stage (e.g. "Temper the spices", "Rest the dough") — ' +
  'NOT the full sentence, which goes in "instruction". INSTRUCTION DETAIL: write ' +
  'each "instruction" as ~40 to 60 words a beginner can follow — the exact action, ' +
  'the heat level/technique, and ALWAYS a concrete observable doneness cue (colour, ' +
  'smell, texture or sound) plus an approximate time. NEVER use vague language like ' +
  '"cook until done" — give an indicator the user can see, smell, hear or feel. You ' +
  'may add standard cooking cues, techniques and typical times to make a step ' +
  'observable, but do not invent ingredients or steps that are not in the photo. ' +
  'If the photo has no readable recipe, return {"title":"", ' +
  '"ingredients":[], "steps":[]}.';

function isBase64Image(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

/** Tolerantly pulls the JSON object out of a model reply, then normalises it. */
function parseRecipe(raw: string): RecipeJSON | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  let obj = tryParse(cleaned);
  if (!obj) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) obj = tryParse(cleaned.slice(start, end + 1));
  }
  if (!obj) return null;

  return {
    title: str(obj.title) ?? '',
    description: str(obj.description) ?? '',
    ingredients: asArray(obj.ingredients)
      .map((it) => {
        const i = (it ?? {}) as Record<string, unknown>;
        return {
          name: (str(i.name) ?? '').trim(),
          quantity: str(i.quantity) ?? '',
          unit: str(i.unit) ?? undefined,
        };
      })
      .filter((i) => i.name.length > 0),
    steps: asArray(obj.steps)
      .map((st, idx) => {
        const s = (st ?? {}) as Record<string, unknown>;
        return {
          order: intOrNull(s.order) ?? idx + 1,
          title: str(s.title) ?? '',
          instruction: (str(s.instruction) ?? '').trim(),
        };
      })
      .filter((s) => s.instruction.length > 0),
    cookTime: intOrNull(obj.cookTime),
    prepTime: intOrNull(obj.prepTime),
    servings: intOrNull(obj.servings),
    tags: asArray(obj.tags)
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim()),
    imageUrl: null,
  };
}

function tryParse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
