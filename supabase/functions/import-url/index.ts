import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { enforceUrlGate, incrementRecipeCount } from '../_shared/gating.ts';
import { insertRecipe } from '../_shared/recipes.ts';
import { uploadRecipeImageFromUrl } from '../_shared/storage.ts';
import { refineTags } from '../_shared/tagging.ts';
import {
  callOpenRouter,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  type RecipeJSON,
} from '../_shared/openrouter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MAX_PAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_TEXT_CHARS = 8000;

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
    // Auth (Clerk session token via JWKS) + free saved-recipe cap (15; lifetime
    // is unlimited). URL imports aren't otherwise metered.
    const { userId } = await authenticateRequest(req, supabase);
    const gate = await enforceUrlGate(supabase, userId);

    // Fetch the page
    const page = await fetchPage(url);
    if (!page.ok) throw new HttpError(422, { error: page.error });

    // Strip to readable text + pull meta tags
    const { text, ogImage, ogTitle } = stripHtml(page.html);
    const userPrompt =
      (ogTitle ? `Page title: ${ogTitle}\n\n` : '') + text.slice(0, MAX_TEXT_CHARS);

    // Extract via OpenRouter
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

    // Refine tags with a light model before saving (best-effort; refineTags
    // returns the existing tags unchanged on any failure, never throwing).
    recipe.tags = await refineTags(recipe);

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

    // Best-effort: copy the image into our private bucket and record its path so
    // the client can resolve a signed URL later (get-recipe-image). This must
    // never fail the import — the uploader already swallows its own errors, and
    // the try/catch here is belt-and-braces. On any miss we keep image_url.
    if (imageUrl) {
      try {
        const storagePath = await uploadRecipeImageFromUrl(
          supabase,
          userId,
          inserted.id as string,
          imageUrl,
        );
        if (storagePath) {
          await supabase.from('recipes').update({ storage_path: storagePath }).eq('id', inserted.id);
          inserted.storage_path = storagePath; // reflect it in the row we return
        }
      } catch (err) {
        console.error(`[${TAG}] image storage failed (non-fatal):`, err);
      }
    }

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
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
  } catch {
    return { ok: false, error: 'fetch_failed' };
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
