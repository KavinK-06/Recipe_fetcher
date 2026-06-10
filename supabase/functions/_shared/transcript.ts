import { HttpError } from './http.ts';

// Supadata: a managed transcript API that runs the YouTube scraping + residential
// proxies server-side, so it works from the cloud — unlike scraping YouTube
// directly from an edge function, which gets IP-blocked.
const SUPADATA_BASE = 'https://api.supadata.ai/v1/transcript';
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 6; // ~15s budget for async (>20 min) videos

function noTranscript(): never {
  throw new HttpError(422, {
    error: 'no_transcript',
    message: 'This video has no transcript available to read the recipe from.',
  });
}

/**
 * Fetches a YouTube video's transcript as plain text via Supadata.
 * Short videos return immediately (HTTP 200); videos over 20 min return an
 * async job (HTTP 202) which we poll briefly. Throws:
 *   422 no_transcript            — video has no captions / job failed
 *   422 transcript_timeout       — async job didn't finish in our poll budget
 *   429 transcript_rate_limited  — provider rate limit hit
 *   500 transcript_provider_*    — key missing / unauthorized / unreachable
 */
export async function fetchYouTubeTranscript(url: string): Promise<string> {
  const apiKey = Deno.env.get('SUPADATA_API_KEY');
  if (!apiKey) {
    console.error('[transcript] SUPADATA_API_KEY not set');
    throw new HttpError(500, { error: 'transcript_provider_unconfigured' });
  }
  const headers = { 'x-api-key': apiKey };

  let res: Response;
  try {
    res = await fetch(`${SUPADATA_BASE}?url=${encodeURIComponent(url)}&text=true`, {
      headers,
    });
  } catch (err) {
    console.error('[transcript] request failed:', err);
    throw new HttpError(502, { error: 'transcript_provider_unreachable' });
  }

  // 206 → no transcript available for this video
  if (res.status === 206) noTranscript();

  // 202 → async job (videos > 20 min); poll until it finishes
  if (res.status === 202) {
    const { jobId } = await res.json().catch(() => ({ jobId: null }));
    if (!jobId) noTranscript();
    return await pollJob(jobId, headers);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[transcript] provider error ${res.status}:`, body);
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(500, { error: 'transcript_provider_unauthorized' });
    }
    if (res.status === 429) {
      throw new HttpError(429, { error: 'transcript_rate_limited' });
    }
    noTranscript();
  }

  return extractText(await res.json());
}

async function pollJob(jobId: string, headers: Record<string, string>): Promise<string> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let res: Response;
    try {
      res = await fetch(`${SUPADATA_BASE}/${jobId}`, { headers });
    } catch {
      continue;
    }
    if (!res.ok) continue;
    const data = await res.json().catch(() => null);
    if (data?.status === 'completed') return extractText(data);
    if (data?.status === 'failed') noTranscript();
    // queued | active → keep polling
  }
  throw new HttpError(422, {
    error: 'transcript_timeout',
    message: 'This video is taking too long to transcribe — try a shorter one.',
  });
}

// text=true returns content as a string; async/completed may return the
// segment array shape — handle both.
function extractText(data: unknown): string {
  const content = (data as { content?: unknown })?.content;
  const raw =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((s: { text?: string }) => s?.text ?? '').join(' ')
        : '';
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) noTranscript();
  return text;
}
