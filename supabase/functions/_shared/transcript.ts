import { HttpError } from './http.ts';

// transcriptapi.com: a dedicated YouTube transcript API. YouTube IP-blocks
// datacenter (edge) IPs, so we can't scrape captions directly from an edge
// function — this runs the fetch server-side and returns the transcript. Used by
// the YouTube import path (`fetchYouTubeTranscript`). Bearer-auth; 1 credit per
// successful (HTTP 200) request, charged only on success.
const TRANSCRIPTAPI_BASE = 'https://transcriptapi.com';
const TRANSCRIPTAPI_TRANSCRIPT_URL = `${TRANSCRIPTAPI_BASE}/api/v2/youtube/transcript`;
// The API documents 408 (bot detection / network), 429 (rate limit) and 503
// (unavailable) as safe to retry. Keep the retry count + backoff small so we stay
// inside the edge function's wall-clock budget.
const TRANSCRIPTAPI_MAX_RETRIES = 2;
const TRANSCRIPTAPI_BACKOFF_MS = 1500;
const TRANSCRIPTAPI_MAX_RETRY_DELAY_MS = 5000;

// Supadata: a managed scraping API that runs residential proxies + a headless
// browser server-side. Used ONLY as the import-url web-scrape fallback — YouTube
// transcripts use transcriptapi.com.
const SUPADATA_BASE = 'https://api.supadata.ai/v1';
const WEB_SCRAPE_URL = `${SUPADATA_BASE}/web/scrape`;
// Hard cap on the scrape so a slow/hostile site can't run the Edge Function into
// a platform resource kill (HTTP 546). Hostile publishers (AllRecipes) can take
// ~2 min through Supadata's headless render, so this is generous; it only exists
// to abort a true hang. NOTE: on a 150s-wall-clock plan this + extraction can
// still exceed the worker budget — slow imports really belong in a background task.
const SCRAPE_TIMEOUT_MS = 120_000;

function noTranscript(): never {
  throw new HttpError(422, {
    error: 'no_transcript',
    message: 'This video has no transcript available to read the recipe from.',
  });
}

function apiKeyOrThrow(): string {
  const apiKey = Deno.env.get('SUPADATA_API_KEY');
  if (!apiKey) {
    console.error('[transcript] SUPADATA_API_KEY not set');
    throw new HttpError(500, { error: 'transcript_provider_unconfigured' });
  }
  return apiKey;
}

function transcriptApiKeyOrThrow(): string {
  const apiKey = Deno.env.get('TRANSCRIPTAPI_API_KEY');
  if (!apiKey) {
    console.error('[transcript] TRANSCRIPTAPI_API_KEY not set');
    throw new HttpError(500, { error: 'transcript_provider_unconfigured' });
  }
  return apiKey;
}

/**
 * YouTube path: fetches the video's existing captions as plain text via
 * transcriptapi.com (a dedicated YouTube transcript API). We request
 * `format=text` + `include_timestamp=false`, so the response `transcript` field
 * is a single concatenated string. 1 credit per request, charged only on HTTP
 * 200. A missing transcript (404) is fatal — `no_transcript`.
 *
 * Transient failures (408 bot-detection/network, 429 rate limit, 503 down) are
 * retried with a short backoff, per the API's documented retry guidance.
 *
 * Throws:
 *   422 no_transcript                    — video has no captions / not found
 *   429 transcript_rate_limited          — provider rate limit hit (retries spent)
 *   500 transcript_provider_unauthorized — API key missing / invalid (401)
 *   500 transcript_provider_no_credits   — provider credits exhausted (402)
 *   502 transcript_provider_unreachable  — provider network error
 */
export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const apiKey = transcriptApiKeyOrThrow();
  const params = new URLSearchParams({
    video_url: url,
    format: 'text',
    include_timestamp: 'false',
  });
  const endpoint = `${TRANSCRIPTAPI_TRANSCRIPT_URL}?${params.toString()}`;
  const headers = { Authorization: `Bearer ${apiKey}` };

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, { headers });
    } catch (err) {
      console.error('[transcript] request failed:', err);
      throw new HttpError(502, { error: 'transcript_provider_unreachable' });
    }

    if (res.status === 200) {
      console.log(`[transcript] status=200 cache=${res.headers.get('X-Cache-Status') ?? 'n/a'}`);
      return extractTranscriptApiText(await res.json().catch(() => null));
    }

    // 408 / 429 / 503 are documented as safe to retry — back off briefly and try
    // again (honoring Retry-After on 429), up to the retry cap.
    if (
      (res.status === 408 || res.status === 429 || res.status === 503) &&
      attempt < TRANSCRIPTAPI_MAX_RETRIES
    ) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      const delayMs =
        res.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, TRANSCRIPTAPI_MAX_RETRY_DELAY_MS)
          : TRANSCRIPTAPI_BACKOFF_MS * (attempt + 1);
      console.warn(
        `[transcript] status=${res.status} — retry ${attempt + 1}/${TRANSCRIPTAPI_MAX_RETRIES} in ${delayMs}ms`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    const body = await res.text().catch(() => '');
    console.error(`[transcript] provider error ${res.status}:`, body);
    if (res.status === 401) {
      throw new HttpError(500, { error: 'transcript_provider_unauthorized' });
    }
    if (res.status === 402) {
      throw new HttpError(500, { error: 'transcript_provider_no_credits' });
    }
    if (res.status === 429) {
      throw new HttpError(429, { error: 'transcript_rate_limited' });
    }
    // 400 / 404 / 422 / 500 / 503 (retries spent) → no usable transcript.
    return noTranscript();
  }
}

// transcriptapi.com with format=text returns `transcript` as a single string. Be
// defensive and also handle the json/segment-array shape, in case the request
// params change later.
function extractTranscriptApiText(data: unknown): string {
  const t = (data as { transcript?: unknown })?.transcript;
  const raw =
    typeof t === 'string'
      ? t
      : Array.isArray(t)
        ? t.map((s: { text?: string }) => s?.text ?? '').join(' ')
        : '';
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return noTranscript();
  return text;
}

export interface ScrapedPage {
  /** Main page content as Markdown (boilerplate nav/ads stripped by Supadata). */
  content: string;
  /** Page title (Supadata's `name` field). */
  title: string;
  /** Meta description, when present. */
  description: string;
}

/**
 * Fetches a web page's readable content as Markdown via Supadata's /web/scrape.
 * Supadata runs the fetch through residential proxies + a headless browser
 * server-side, so it clears Cloudflare / bot walls that block a direct fetch
 * from the Edge runtime (e.g. AllRecipes, Food Network, NYT Cooking) and also
 * renders JS-only pages. Costs 1 Supadata credit per call.
 *
 * Used by import-url as a FALLBACK only — the direct (free) fetch is tried
 * first; this runs when the site blocks us or returns a near-empty JS shell.
 *
 * Throws:
 *   422 fetch_failed                 — page unreadable / empty even via Supadata
 *   429 scrape_rate_limited          — provider rate limit hit
 *   500 scrape_provider_unauthorized — key missing / unauthorized
 *   502 scrape_provider_unreachable  — provider network error
 */
export async function scrapeWebPage(url: string): Promise<ScrapedPage> {
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SCRAPE_TIMEOUT_MS);
  try {
    res = await fetch(`${WEB_SCRAPE_URL}?url=${encodeURIComponent(url)}`, {
      headers: { 'x-api-key': apiKeyOrThrow() },
      signal: ctrl.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      console.error(`[web-scrape] timed out after ${SCRAPE_TIMEOUT_MS}ms`);
      throw new HttpError(504, { error: 'scrape_timeout' });
    }
    console.error('[web-scrape] request failed:', err);
    throw new HttpError(502, { error: 'scrape_provider_unreachable' });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[web-scrape] provider error ${res.status}:`, body);
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(500, { error: 'scrape_provider_unauthorized' });
    }
    if (res.status === 429) {
      throw new HttpError(429, { error: 'scrape_rate_limited' });
    }
    throw new HttpError(422, { error: 'fetch_failed' });
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const content = typeof data?.content === 'string' ? data.content.trim() : '';
  if (!content) throw new HttpError(422, { error: 'fetch_failed' });

  return {
    content,
    title: typeof data?.name === 'string' ? (data.name as string).trim() : '',
    description: typeof data?.description === 'string' ? (data.description as string).trim() : '',
  };
}
