import { corsHeaders } from './cors.ts';

/**
 * Throwable HTTP error. Handlers run their logic in a try/catch and convert
 * these into responses via `errorResponse`, so shared helpers can signal a
 * specific status (401/402/422/…) without needing access to the response path.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`HttpError ${status}`);
    this.name = 'HttpError';
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Maps an HttpError to its status/body; anything else becomes a logged 500. */
export function errorResponse(err: unknown, tag: string): Response {
  if (err instanceof HttpError) {
    return json(err.body, err.status);
  }
  console.error(`[${tag}] unexpected error:`, err);
  return json({ error: 'internal_error' }, 500);
}
