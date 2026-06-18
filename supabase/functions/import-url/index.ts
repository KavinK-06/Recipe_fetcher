import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { enforceUrlGate, incrementRecipeCount } from '../_shared/gating.ts';
import { insertRecipe } from '../_shared/recipes.ts';
import { finalizeRecipeInBackground } from '../_shared/finalize.ts';
import { StepTimer } from '../_shared/timing.ts';
import { scrapeWebPage } from '../_shared/transcript.ts';
import {
  callOpenRouter,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  type RecipeJSON,
} from '../_shared/openrouter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MAX_PAGE_BYTES = 2 * 1024 * 1024; // 2 MB
// Send a generous slice of the page text to the model — gemini-2.5-flash has a
// huge context window, and a recipe's steps/quantities often sit well past the
// first few thousand chars (after intro blurbs / ads). Still bounded so a
// comment-heavy page can't balloon the prompt. (Was 8000, which clipped steps.)
const MAX_TEXT_CHARS = 50000;
// Below this much readable text, a "successful" direct fetch is treated as
// unusable (a JS-only shell / cookie wall) and we fall back to Supadata scrape.
const MIN_USABLE_TEXT = 200;
// Cap the direct fetch so a hanging/slow site fails fast and routes to the
// Supadata fallback, rather than running the worker into a 546 resource kill.
const DIRECT_FETCH_TIMEOUT_MS = 15_000;

const TAG = 'import-url';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // Parse + validate input
  let url: string;
  try {
    const body = await req.json();
    url = body?.url;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (typeof url !== 'string' || !isValidHttpUrl(url)) {
    return json({ error: 'invalid_url' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const sw = new StepTimer(TAG);

    // Auth (Clerk session token via JWKS) + free saved-recipe cap (15; lifetime
    // is unlimited). URL imports aren't otherwise metered.
    const { userId } = await authenticateRequest(req, supabase);
    const gate = await enforceUrlGate(supabase, userId);
    sw.mark('auth+gate');

    // Get the page text. Try a direct fetch first — it's free and works for most
    // recipe blogs. If the site blocks us (Cloudflare/bot wall → 4xx, non-HTML,
    // oversized) OR returns a near-empty JS shell, fall back to Supadata's
    // /web/scrape, which fetches through residential proxies + a headless browser
    // (1 Supadata credit). That's what gets past hard publishers like AllRecipes.
    let pageTitle = '';
    let pageText = '';
    let ogImage: string | null = null;

    const direct = await fetchPage(url);
    if (direct.ok) {
      const stripped = stripHtml(direct.html);
      if (stripped.text.length >= MIN_USABLE_TEXT) {
        pageText = stripped.text;
        pageTitle = stripped.ogTitle ?? '';
        ogImage = stripped.ogImage;
      }
    }
    sw.mark('fetch:direct');

    // Fall back to the residential-proxy scraper on any block / thin result.
    if (!pageText) {
      console.warn(
        `[${TAG}] direct fetch unusable (${direct.ok ? 'thin_content' : direct.error}); using Supadata scrape`,
      );
      const scraped = await scrapeWebPage(url);
      pageText = scraped.content;
      pageTitle = scraped.title;
      sw.mark('fetch:scrape');
    }

    const userPrompt =
      (pageTitle ? `Page title: ${pageTitle}\n\n` : '') + pageText.slice(0, MAX_TEXT_CHARS);

    // Extract via OpenRouter (gemini-2.5-flash primary). Tags come back here too,
    // so we insert with them directly and refine in the background (below).
    let recipe: RecipeJSON;
    try {
      recipe = await callOpenRouter<RecipeJSON>({
        systemPrompt: RECIPE_EXTRACTION_SYSTEM_PROMPT,
        userPrompt,
        responseFormat: 'json',
      });
    } catch (err) {
      console.error(`[${TAG}] extraction failed:`, err);
      throw new HttpError(422, { error: 'extraction_failed' });
    }
    sw.mark('extract');

    // Fall back to og:image when the model didn't find one
    const imageUrl = recipe.imageUrl ?? ogImage ?? null;

    // Insert + increment the freemium counter
    const inserted = await insertRecipe(supabase, {
      userId,
      recipe,
      sourceType: 'url',
      sourceUrl: url,
      imageUrl,
      tag: TAG,
    });
    await incrementRecipeCount(supabase, userId, gate.recipeCount, TAG);
    sw.mark('persist');

    // Tag refinement + private-bucket image copy run AFTER we respond — the row
    // is already complete (extraction tags + origin image_url), so we don't make
    // the user wait on them.
    finalizeRecipeInBackground({
      supabase,
      userId,
      recipeId: inserted.id as string,
      recipe,
      imageUrl,
      tag: TAG,
    });

    sw.total();
    return json(inserted, 200);
  } catch (err) {
    return errorResponse(err, TAG);
  }
});

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

type FetchResult =
  | { ok: true; html: string }
  | { ok: false; error: string };

async function fetchPage(url: string): Promise<FetchResult> {
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DIRECT_FETCH_TIMEOUT_MS);
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
  } catch {
    // Includes AbortError (timeout) → caller falls back to the Supadata scraper.
    return { ok: false, error: 'fetch_failed' };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    return { ok: false, error: `fetch_status_${res.status}` };
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return { ok: false, error: 'not_html' };
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_PAGE_BYTES) {
    return { ok: false, error: 'page_too_large' };
  }

  return { ok: true, html: new TextDecoder().decode(buf) };
}

interface StrippedPage {
  text: string;
  ogImage: string | null;
  ogTitle: string | null;
}

function stripHtml(html: string): StrippedPage {
  const ogImage = extractMeta(html, 'og:image');
  const ogTitle = extractMeta(html, 'og:title');

  const text = html
    // Drop non-content elements wholesale (including their inner text).
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    // Strip remaining tags, decode a few common entities, collapse whitespace.
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();

  return { text, ogImage, ogTitle };
}

// Matches both <meta property="og:x" content="..."> and the reversed
// content-then-property attribute order.
function extractMeta(html: string, property: string): string | null {
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forward = new RegExp(
    `<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']*)["']`,
    'i',
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${esc}["']`,
    'i',
  );
  return html.match(forward)?.[1] ?? html.match(reversed)?.[1] ?? null;
}
