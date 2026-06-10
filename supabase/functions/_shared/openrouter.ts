const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct";
// NOTE: keep these slugs in sync with OpenRouter's live catalog. `google/
// gemini-flash-1.5` was retired (404 "No endpoints found"); gemini-2.5-flash is
// its current, multimodal, JSON-capable replacement.
const DEFAULT_FALLBACK = "google/gemini-2.5-flash";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 30_000;

export class OpenRouterError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`OpenRouter error ${status}: ${body}`);
    this.name = "OpenRouterError";
  }
}

export interface RecipeJSON {
  title: string;
  description: string;
  ingredients: { name: string; quantity: string; unit?: string }[];
  steps: { order: number; instruction: string }[];
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  tags: string[];
  imageUrl: string | null;
}

export const RECIPE_EXTRACTION_SYSTEM_PROMPT =
  `You are a culinary data extractor. Given raw text (a recipe webpage or a transcript), return ONLY a JSON object matching this exact schema: {title, description, ingredients[{name, quantity, unit}], steps[{order, instruction}], cookTime, prepTime, servings, tags[], imageUrl}. cookTime and prepTime are integer minutes or null. servings is an integer or null. tags are 3-6 lowercase one-word category labels (e.g. "vegan", "dessert", "indian", "30-min"). If a field is unknown, use null or empty array. Return ONLY the JSON — no markdown, no commentary.`;

interface CallOptions {
  model?: string;
  fallbackModel?: string;
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: "json" | "text";
  maxTokens?: number;
  // Image URLs or `data:image/...;base64,...` data URLs for vision models. When
  // present, the user message is sent as multimodal content (text + images).
  images?: string[];
}

async function callModel<T>(
  model: string,
  opts: CallOptions,
): Promise<T> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  const referer =
    Deno.env.get("OPENROUTER_REFERER") ?? "https://saveur.app";

  // Vision models take the user message as an array of content parts (text +
  // image_url); plain text calls keep `content` as a string for compatibility.
  const userContent =
    opts.images && opts.images.length > 0
      ? [
        { type: "text", text: opts.userPrompt },
        ...opts.images.map((url) => ({
          type: "image_url",
          image_url: { url },
        })),
      ]
      : opts.userPrompt;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: userContent },
    ],
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.responseFormat === "json"
      ? { response_format: { type: "json_object" } }
      : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": referer,
        "X-Title": "Saveur",
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new OpenRouterError(res.status, text);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  if (opts.responseFormat === "json") {
    return parseJsonResponse<T>(content);
  }
  return content as unknown as T;
}

// Not every provider honours response_format strictly — some wrap the JSON in
// ```fences``` or add a stray sentence. Parse defensively so a slightly-dressed
// reply doesn't needlessly fail (and force a fallback round-trip).
function parseJsonResponse<T>(content: string): T {
  const direct = tryJson<T>(content);
  if (direct !== null) return direct;

  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  const cleanedParse = tryJson<T>(cleaned);
  if (cleanedParse !== null) return cleanedParse;

  // Slice out the outermost {...} or [...] if there's surrounding prose.
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start !== -1 && end > start) {
      const sliced = tryJson<T>(cleaned.slice(start, end + 1));
      if (sliced !== null) return sliced;
    }
  }

  throw new Error(
    `OpenRouter returned non-JSON content: ${content.slice(0, 300)}`,
  );
}

function tryJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function callOpenRouter<T>(opts: CallOptions): Promise<T> {
  const primary = opts.model ?? DEFAULT_MODEL;
  const fallback = opts.fallbackModel ?? DEFAULT_FALLBACK;

  try {
    return await callModel<T>(primary, opts);
  } catch (primaryErr) {
    // Surface why the primary failed — otherwise a fallback error (e.g. a dead
    // model slug) masks the real cause in the logs.
    console.error(
      `[openrouter] primary model "${primary}" failed; retrying with "${fallback}":`,
      primaryErr instanceof Error ? primaryErr.message : primaryErr,
    );
    return await callModel<T>(fallback, opts);
  }
}
