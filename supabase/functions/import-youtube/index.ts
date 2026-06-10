import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { enforceYouTubeGate, consumeYouTubeImport } from '../_shared/gating.ts';
import { insertRecipe } from '../_shared/recipes.ts';
import { uploadRecipeImageFromUrl } from '../_shared/storage.ts';
import { refineTags } from '../_shared/tagging.ts';
import { fetchYouTubeTranscript } from '../_shared/transcript.ts';
import {
  callOpenRouter,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  type RecipeJSON,
} from '../_shared/openrouter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Recipe transcripts usually recap ingredients/steps at the start and end, so
// when over the cap we keep the head + tail rather than truncating to the head.
const TRANSCRIPT_CAP = 12000;
const HEAD_CHARS = 8000;
const TAIL_CHARS = 4000;

const TAG = 'import-youtube';

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
  if (typeof url !== 'string') {
    return json({ error: 'invalid_url' }, 400);
  }
  const videoId = extractVideoId(url);
  if (!videoId) {
    return json({ error: 'invalid_youtube_url' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Auth (Clerk session token via JWKS) + YouTube metering. The gate rolls
    // over the monthly counter and checks allowance (3 free / 20 lifetime) or a
    // YouTube credit; nothing is consumed until the import succeeds (below).
    const { userId } = await authenticateRequest(req, supabase);
    const gate = await enforceYouTubeGate(supabase, userId);

    // Fetch the transcript via the managed provider (Supadata). It throws a
    // typed HttpError (no_transcript / rate_limited / etc.) handled by the
    // outer catch.
    let transcript = await fetchYouTubeTranscript(url);
    if (transcript.length > TRANSCRIPT_CAP) {
      transcript = `${transcript.slice(0, HEAD_CHARS)} ... ${transcript.slice(-TAIL_CHARS)}`;
    }

    // Video metadata via the public oEmbed endpoint (best-effort)
    const { title, thumbnail } = await fetchOEmbed(url);

    const hint = title
      ? `This is a transcript from a YouTube cooking video titled "${title}". Extract the recipe being demonstrated.`
      : 'This is a transcript from a YouTube cooking video. Extract the recipe being demonstrated.';
    const userPrompt = `${hint}\n\n${transcript}`;

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

    // Fall back to the video thumbnail when the model didn't find an image
    const imageUrl = recipe.imageUrl ?? thumbnail ?? null;

    // Insert, then record the import: advances the monthly counter + saved-recipe
    // counter, and spends a YouTube credit only if this was over the allowance.
    const inserted = await insertRecipe(supabase, {
      userId,
      recipe,
      sourceType: 'youtube',
      sourceUrl: url,
      imageUrl,
      tag: TAG,
    });
    await consumeYouTubeImport(supabase, userId, gate, TAG);

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

// Supports watch?v=, youtu.be/, /shorts/, /embed/, /v/. Returns the 11-char id or null.
function extractVideoId(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return isValidId(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      const v = u.searchParams.get('v');
      return v && isValidId(v) ? v : null;
    }
    const m = u.pathname.match(/^\/(?:shorts|embed|v)\/([^/?#]+)/);
    if (m && isValidId(m[1])) return m[1];
  }

  return null;
}

function isValidId(id: string | null | undefined): id is string {
  return !!id && /^[A-Za-z0-9_-]{11}$/.test(id);
}

async function fetchOEmbed(
  url: string,
): Promise<{ title: string; thumbnail: string | null }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
    if (!res.ok) return { title: '', thumbnail: null };
    const data = await res.json();
    return { title: data.title ?? '', thumbnail: data.thumbnail_url ?? null };
  } catch {
    return { title: '', thumbnail: null };
  }
}
