// A normalised recipe shape the UI screens consume, plus adapters from both the
// real DB row (RecipeRow, snake_case) and the legacy mock Recipe shape. Keeping
// one UI type lets the detail/cook screens render real and mock recipes with the
// same code while the app finishes migrating off constants/mockData.

import type { RecipeRow } from '../api/import';
import type { Recipe as MockRecipe } from '../../constants/mockData';

export interface UiIngredient {
  id: string;
  name: string;
  unit?: string;
  /** Numeric amount for live servings scaling, or null when unparseable (e.g. "a pinch"). */
  quantityNum: number | null;
  /** Original amount text, shown verbatim when not scalable. */
  quantityRaw: string;
}

export interface UiStep {
  id: string;
  text: string;
  timerSeconds?: number;
  /** Step-scoped ingredient pills (mock only; empty for DB recipes). */
  ingredients: string[];
}

export interface UiRecipe {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  difficulty: string | null;
  cookTimeLabel: string | null;
  prepTimeLabel: string | null;
  servings: number;
  tags: string[];
  sourceLabel: string | null;
  sourceType: 'url' | 'youtube' | 'manual';
  ingredients: UiIngredient[];
  steps: UiStep[];
  /** True when backed by a real DB row (UUID) — gates image Edge calls. */
  isReal: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Older imports were stored before the backend scrubbed them, so an ingredient's
// unit/quantity can be the literal text "null"/"none"/"-". Treat those as empty at
// render time so existing recipes don't show "3 null" (newer imports are already
// clean — see sanitizeIngredients in the import functions).
const NULLISH_TEXT = /^(null|none|n\/?a|nil|undefined|[-–—.])$/i;
function cleanText(value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  return NULLISH_TEXT.test(s) ? '' : s;
}

/** Mock ids are short ('1', 'c1'); only real recipe ids are UUIDs. */
export function isUuid(value: string | undefined | null): boolean {
  return !!value && UUID_RE.test(value);
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

/**
 * Best-effort parse of a recipe quantity into a number for scaling. DB stores
 * quantities as free text ("2", "1.5", "1/2", "½", "2-3 cups", "a pinch"), so we
 * extract the leading numeric token and return null when there isn't one.
 */
export function parseQuantity(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  const s = raw.trim();
  if (!s) return null;

  // Mixed number: "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const d = Number(mixed[3]);
    return d ? whole + Number(mixed[2]) / d : whole;
  }

  // First token (handles ranges like "2-3" / "2 to 3" → take the lower bound)
  const first = s.split(/[\s\-–—]+|(?:\bto\b)/i)[0] ?? s;

  if (UNICODE_FRACTIONS[first] != null) return UNICODE_FRACTIONS[first];

  const frac = first.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d ? Number(frac[1]) / d : null;
  }

  const num = Number(first.replace(',', '.'));
  return Number.isFinite(num) ? num : null;
}

function sourceLabelFor(sourceUrl: string | null, type: RecipeRow['source_type']): string | null {
  if (type === 'youtube') return 'YouTube';
  if (type === 'manual') return 'Manual';
  if (sourceUrl) {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return sourceUrl;
    }
  }
  return null;
}

/** Adapt a real DB recipe row to the UI shape. */
export function rowToUiRecipe(row: RecipeRow): UiRecipe {
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    // The DB doesn't store cuisine/difficulty — the UI hides these when null.
    cuisine: null,
    difficulty: null,
    cookTimeLabel: row.cook_time_minutes != null ? `${row.cook_time_minutes} min` : null,
    prepTimeLabel: row.prep_time_minutes != null ? `${row.prep_time_minutes} min` : null,
    servings: row.servings && row.servings > 0 ? row.servings : 1,
    tags: row.tags ?? [],
    sourceLabel: sourceLabelFor(row.source_url, row.source_type),
    sourceType: row.source_type,
    ingredients: (row.ingredients ?? []).map((ing, idx) => {
      const unit = cleanText(ing.unit);
      return {
        id: `i${idx}`,
        name: ing.name,
        unit: unit || undefined,
        quantityNum: parseQuantity(ing.quantity),
        quantityRaw: cleanText(ing.quantity),
      };
    }),
    steps: (row.steps ?? [])
      .slice()
      .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
      .map((s, idx) => ({
        id: `s${idx}`,
        text: s?.instruction ?? '',
        timerSeconds: undefined, // DB steps carry no timer
        ingredients: [], // DB steps carry no per-step ingredient list
      })),
    isReal: true,
  };
}

/** Adapt a legacy mock recipe to the same UI shape. */
export function mockToUiRecipe(r: MockRecipe): UiRecipe {
  return {
    id: r.id,
    title: r.title,
    imageUrl: r.imageUri,
    cuisine: r.cuisine,
    difficulty: r.difficulty,
    cookTimeLabel: r.cookTime,
    prepTimeLabel: r.prepTime,
    servings: r.defaultServings,
    tags: r.tags,
    sourceLabel: r.source,
    sourceType: 'url',
    ingredients: r.ingredients.map((ing) => ({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      quantityNum: ing.quantity,
      quantityRaw: String(ing.quantity),
    })),
    steps: r.steps.map((s) => ({
      id: s.id,
      text: s.text,
      timerSeconds: s.timerSeconds,
      ingredients: s.ingredients,
    })),
    isReal: false,
  };
}
