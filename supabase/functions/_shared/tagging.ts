import { callOpenRouter, type RecipeJSON } from './openrouter.ts';

// A light model leads — tagging is a cheap, non-critical refinement pass, so we
// don't spend the 70B model on it (it's the fallback only).
const TAG_MODEL = 'google/gemini-2.5-flash';
const TAG_FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct';

const TAG_SYSTEM_PROMPT =
  'You are a recipe categoriser. Reply with ONLY a JSON array of short ' +
  'lowercase category tags — no prose, no markdown, no object wrapper.';

const MAX_TAGS = 8; // ceiling after merging existing + refined
const MAX_TAG_LEN = 24; // drop anything longer (likely a phrase, not a tag)
const MAX_INGREDIENTS_IN_PROMPT = 25;

/**
 * Asks a light model to propose category tags for a recipe, then returns the
 * recipe's existing tags merged with the proposed ones (deduped, lowercased).
 *
 * Best-effort: any failure — network, bad JSON, empty result — returns the
 * existing tags unchanged. Tagging must never break an import, so callers can
 * use the result directly without their own fallback.
 */
export async function refineTags(recipe: RecipeJSON): Promise<string[]> {
  const existing = sanitizeTags(recipe.tags ?? []);

  try {
    const ingredientNames = (recipe.ingredients ?? [])
      .map((i) => i?.name)
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      .slice(0, MAX_INGREDIENTS_IN_PROMPT)
      .join(', ');

    const userPrompt =
      'Return a JSON array of 4-6 lowercase one-word category tags ' +
      '(cuisine, diet, meal-type, time, difficulty). ' +
      `Existing tags: ${existing.join(', ') || 'none'}. ` +
      `Title: ${recipe.title ?? 'unknown'}. ` +
      `Ingredients: ${ingredientNames || 'unknown'}. ` +
      'Return ONLY the JSON array.';

    const raw = await callOpenRouter<string>({
      model: TAG_MODEL,
      fallbackModel: TAG_FALLBACK_MODEL,
      systemPrompt: TAG_SYSTEM_PROMPT,
      userPrompt,
      responseFormat: 'text',
      maxTokens: 80,
    });

    const parsed = parseTagArray(raw);
    if (!parsed) return existing;

    return mergeTags(existing, sanitizeTags(parsed));
  } catch (err) {
    console.error('[tagging] refineTags failed:', err);
    return existing;
  }
}

/** Union of two tag lists, order-preserving, deduped, capped at MAX_TAGS. */
function mergeTags(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...a, ...b]) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Lowercase, trim, collapse to one word, drop empties/over-long/dupes. */
function sanitizeTags(tags: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = raw
      .toLowerCase()
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '') // strip stray quotes
      .replace(/\s+/g, '-'); // one-word: spaces → hyphen (e.g. "30 min" → "30-min")
    if (!tag || tag.length > MAX_TAG_LEN || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Pulls a string[] out of a raw model reply. Handles a bare JSON array, a
 * ```json-fenced array, or an object like { "tags": [...] }. Returns null when
 * nothing parseable is found (caller then keeps the existing tags).
 */
function parseTagArray(raw: string): string[] | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  const tryParse = (s: string): string[] | null => {
    try {
      const v = JSON.parse(s);
      if (Array.isArray(v)) return v.map(String);
      const wrapped = (v as { tags?: unknown })?.tags;
      if (Array.isArray(wrapped)) return wrapped.map(String);
    } catch {
      // not valid JSON — fall through
    }
    return null;
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Fall back to the first [...] slice in case the model wrapped it in prose.
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end > start) {
    return tryParse(cleaned.slice(start, end + 1));
  }
  return null;
}
