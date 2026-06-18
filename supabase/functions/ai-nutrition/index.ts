import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { enforceCreditGate, consumeCredits } from '../_shared/gating.ts';
import { callOpenRouter } from '../_shared/openrouter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Multimodal models — estimating macros from a photo is a vision task, so the
// text-only llama default doesn't apply here. Gemini Flash is cheap and already
// in our stack; gpt-4o-mini is the vision fallback.
const MODEL = 'google/gemini-2.5-flash';
const FALLBACK_MODEL = 'openai/gpt-4o-mini';

// ~5 MB image as base64. Edge Function bodies are bounded, and clients should
// resize/compress before sending, so reject anything larger up front.
const MAX_IMAGE_CHARS = 7_000_000;
const MAX_ITEMS = 20;
const MAX_NOTE_CHARS = 300;

const SYSTEM_PROMPT =
  'You are a nutrition estimation assistant. You receive a photo of a prepared ' +
  'dish and estimate the nutrition of the single portion shown, using typical ' +
  'recipes and portion sizes. Be realistic. Reply with ONLY a JSON object — no ' +
  'markdown, no commentary.';

const TAG = 'ai-nutrition';

interface NutritionItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
interface NutritionResult {
  dish: string | null;
  servingSize: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  items: NutritionItem[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Parse + validate input
  let image: unknown;
  let note: unknown;
  try {
    const body = await req.json();
    image = body?.image;
    note = body?.note;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof image !== 'string' || !isAcceptableImage(image)) {
    return json({ error: 'invalid_image' }, 400);
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return json({ error: 'image_too_large' }, 400);
  }
  const noteText =
    typeof note === 'string' ? note.trim().slice(0, MAX_NOTE_CHARS) : '';

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Auth (Clerk session token via JWKS). A calorie scan costs 1 credit from the
    // shared pool (same pool as YouTube imports). It writes no recipe
    // row, so the consume below passes incrementRecipe:false. Lifetime users are
    // NOT exempt — credits are metered for everyone. Nothing is spent until the
    // scan succeeds.
    const { userId } = await authenticateRequest(req, supabase);
    const gate = await enforceCreditGate(supabase, userId, 1);

    const userPrompt = buildPrompt(noteText);

    // Vision models are unreliable with response_format: json_object, so we ask
    // for text and parse the JSON defensively below.
    let raw: string;
    try {
      raw = await callOpenRouter<string>({
        model: MODEL,
        fallbackModel: FALLBACK_MODEL,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        images: [image],
        responseFormat: 'text',
        maxTokens: 700,
      });
    } catch (err) {
      console.error(`[${TAG}] analysis failed:`, err);
      throw new HttpError(422, { error: 'analysis_failed' });
    }

    const parsed = parseResult(raw);
    if (!parsed) {
      console.error(`[${TAG}] could not parse model output:`, raw.slice(0, 500));
      throw new HttpError(422, { error: 'unparseable_result' });
    }

    // Charge the credit only now that the scan produced a usable result.
    await consumeCredits(supabase, userId, gate, TAG, { incrementRecipe: false });

    return json(parsed, 200);
  } catch (err) {
    return errorResponse(err, TAG);
  }
});

function isAcceptableImage(value: string): boolean {
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildPrompt(note: string): string {
  return (
    'Identify the dish in this photo and estimate its nutrition for the single ' +
    'portion shown. Return ONLY this JSON shape:\n' +
    '{ "dish": string|null, "servingSize": string|null, "calories": number, ' +
    '"protein_g": number, "carbs_g": number, "fat_g": number, ' +
    '"fiber_g": number|null, "sugar_g": number|null, ' +
    '"confidence": "low"|"medium"|"high", "assumptions": string[], ' +
    '"items": [{ "name": string, "calories": number, "protein_g": number, ' +
    '"carbs_g": number, "fat_g": number }] }\n' +
    'All numbers are for the portion shown. If the image is not food, set dish ' +
    'to null, all numbers to 0, confidence to "low", and explain in assumptions.' +
    (note ? `\nUser note about the dish: ${note}.` : '')
  );
}

/** Tolerantly pulls the JSON object out of a model reply, then normalises it. */
function parseResult(raw: string): NutritionResult | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  const tryParse = (s: string): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  let obj = tryParse(cleaned);
  if (!obj) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) obj = tryParse(cleaned.slice(start, end + 1));
  }
  if (!obj) return null;

  return normalize(obj);
}

function normalize(o: Record<string, unknown>): NutritionResult {
  const confidence = o.confidence;
  return {
    dish: nonEmptyString(o.dish),
    servingSize: nonEmptyString(o.servingSize),
    calories: num(o.calories),
    protein_g: num(o.protein_g),
    carbs_g: num(o.carbs_g),
    fat_g: num(o.fat_g),
    fiber_g: numOrNull(o.fiber_g),
    sugar_g: numOrNull(o.sugar_g),
    confidence:
      confidence === 'high' || confidence === 'medium' || confidence === 'low'
        ? confidence
        : 'low',
    assumptions: asArray(o.assumptions)
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim()),
    items: asArray(o.items)
      .map((it) => {
        const i = (it ?? {}) as Record<string, unknown>;
        return {
          name: (nonEmptyString(i.name) ?? '').trim(),
          calories: num(i.calories),
          protein_g: num(i.protein_g),
          carbs_g: num(i.carbs_g),
          fat_g: num(i.fat_g),
        };
      })
      .filter((i) => i.name.length > 0)
      .slice(0, MAX_ITEMS),
  };
}

/** Non-negative number rounded to 0.1; non-numeric → 0. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : 0;
}

/** Like `num`, but blank/absent → null (for optional fields). */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 10) / 10) : null;
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
