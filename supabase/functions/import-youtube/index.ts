import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { HttpError, json, errorResponse } from '../_shared/http.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { enforceCreditGate, consumeCredits } from '../_shared/gating.ts';
import { insertRecipe } from '../_shared/recipes.ts';
import { finalizeRecipeInBackground } from '../_shared/finalize.ts';
import { StepTimer } from '../_shared/timing.ts';
import { fetchYouTubeTranscript } from '../_shared/transcript.ts';
import {
  callOpenRouter,
  RECIPE_EXTRACTION_SYSTEM_PROMPT,
  type RecipeJSON,
} from '../_shared/openrouter.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// gemini-2.5-flash has a ~1M-token context window, so we send the FULL transcript
// — a cooking video's steps and the quantities called out mid-cook ("add 200g
// flour") are spread throughout, not just at the ends. Only a pathological outlier
// (a very long video) gets truncated, and then we keep the chronological START so
// step order + the up-front ingredient list survive. (The old 12k cap that kept
// head+tail dropped the middle, losing most steps and inline quantities.)
const TRANSCRIPT_CAP = 100_000;

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
    const sw = new StepTimer(TAG);

    // Auth (Clerk session token via JWKS) + credit metering. A captioned YouTube
    // import costs 1 credit. The gate rolls over the monthly counter and checks
    // the shared allowance (3 free / 20 lifetime) or a purchased credit; nothing
    // is consumed until the import succeeds (below). Gate first — before we spend
    // any transcriptapi.com credits on the transcript.
    const { userId } = await authenticateRequest(req, supabase);
    const gate = await enforceCreditGate(supabase, userId, 1);
    sw.mark('auth+gate');

    // The transcript (transcriptapi.com) and the video metadata (oEmbed) are
    // independent, so fetch them concurrently. fetchYouTubeTranscript throws a typed HttpError
    // (no_transcript / rate_limited / …) handled by the outer catch; fetchOEmbed
    // is best-effort and never throws.
    const [transcriptRaw, oembed] = await Promise.all([
      fetchYouTubeTranscript(url),
      fetchOEmbed(url),
    ]);
    sw.mark('transcript+oembed');

    // Diagnostic: how much transcript came back, and what does it look like? An
    // empty/thin or non-recipe transcript is the usual reason extraction returns
    // no ingredients/steps (status=200 only means the fetch succeeded, not that
    // the captions describe a recipe).
    console.log(
      `[${TAG}] transcript chars=${transcriptRaw.length} preview="${transcriptRaw
        .slice(0, 200)
        .replace(/\s+/g, ' ')
        .trim()}"`,
    );

    let transcript = transcriptRaw;
    if (transcript.length > TRANSCRIPT_CAP) {
      // Keep the chronological start so steps stay in order (never head+tail —
      // that drops the middle, where most of the cooking happens).
      transcript = transcript.slice(0, TRANSCRIPT_CAP);
    }
    const { title, thumbnail } = oembed;

    const hint = title
      ? `This is a transcript from a YouTube cooking video titled "${title}". Extract the recipe being demonstrated.`
      : 'This is a transcript from a YouTube cooking video. Extract the recipe being demonstrated.';
    const userPrompt = `${hint}\n\n${transcript}`;

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

    // Reject an empty extraction (a title but no ingredients AND no steps) instead
    // of saving a useless recipe / spending the user's credit. Usually means the
    // video's captions aren't an extractable recipe (visual-only, music, a vlog).
    if ((recipe?.ingredients?.length ?? 0) === 0 && (recipe?.steps?.length ?? 0) === 0) {
      console.warn(
        `[${TAG}] no recipe extracted (title:${recipe?.title ? 'y' : 'n'} ingredients:${recipe?.ingredients?.length ?? 0} steps:${recipe?.steps?.length ?? 0}) — rejecting`,
      );
      throw new HttpError(422, { error: 'no_recipe_found' });
    }

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
    await consumeCredits(supabase, userId, gate, TAG);
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
