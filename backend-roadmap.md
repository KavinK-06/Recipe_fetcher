# Saveur — Backend Build Roadmap

A step-by-step plan to build the production backend for **Saveur**, a premium AI-powered recipe app (Expo + React Native + TypeScript).

This roadmap is the *server side only* — the frontend already exists. Every step is a copy-pasteable instruction for Claude Code CLI, with the recommended Claude model, rationale, and the files it will touch.

---

## Tech Stack (locked)

| Layer | Choice |
|---|---|
| Auth | Clerk (Expo SDK) |
| Database | Supabase Postgres |
| Storage | Supabase Storage |
| Serverless API | Supabase Edge Functions (Deno) |
| AI | OpenRouter API (default `meta-llama/llama-3.3-70b-instruct`, fallback `google/gemini-2.5-flash`) |
| Payments | Razorpay one-time Orders (INR) — ₹499 Lifetime Unlock + consumable credit packs |
| Import sources | URL scraper + YouTube transcript only |

## Conventions used in this roadmap

- **Model** field uses two values:
  - `claude-opus-4-6` — for architecture, schema design, security-critical code, multi-system integration
  - `claude-sonnet-4-6` — for straightforward implementation against a clear spec
- **Prompt** is what you paste verbatim into Claude Code CLI for that step.
- Every secret (OpenRouter key, Razorpay secret, Supabase service role key, Clerk JWT secret) lives **only** in Supabase Edge Function env vars. Nothing sensitive ships to the client.
- All client → server traffic that mutates data goes through Edge Functions, never directly to the DB with the anon key.

---

## Prerequisites (do these once, by hand)

1. Create a Clerk application → copy the **Publishable Key** + **JWT Issuer URL** + **JWKS Endpoint**.
2. Create a Supabase project → note the **Project URL**, **anon key**, and **service role key**.
3. Create an OpenRouter account → generate an API key.
4. Create a Razorpay account → activate, then generate **Key ID** + **Key Secret** (test mode first).
5. Install Supabase CLI locally: `brew install supabase/tap/supabase`.
6. Install Deno (for local Edge Function dev): `brew install deno`.
7. `supabase login` and `supabase link --project-ref <ref>` inside the repo.

---

# Phase 1 — Auth (Clerk)

---
### Step 1 — Install Clerk Expo SDK and wire the provider
**Model**: claude-sonnet-4-6
**Why**: Standard SDK install + provider wrap — clear spec, no architecture choices.
**Creates/Modifies**: `app/_layout.tsx`, `.env.local`, `app.json`, `lib/auth/tokenCache.ts`
**Install**:
```bash
npx expo install @clerk/clerk-expo expo-secure-store
```
**Prompt**:
```
Wire up Clerk in the existing Expo Router app.

1. Create lib/auth/tokenCache.ts that implements Clerk's TokenCache interface using expo-secure-store (getToken, saveToken, clearToken). Wrap getValueWithKeyAsync/setItemAsync in try/catch and return null on failure.

2. In app/_layout.tsx, wrap the root <Stack> with <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>. Keep all existing fonts/theme/splash logic intact.

3. Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local with a placeholder value and add it to app.json under extra so EAS builds pick it up.

4. Do NOT touch any existing screen files — only the root layout.
```
---

---
### Step 2 — Build sign-in / sign-up screens with Clerk hooks
**Model**: claude-sonnet-4-6
**Why**: Hook usage against documented Clerk APIs — implementation-only.
**Creates/Modifies**: `app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx`, `app/(auth)/verify.tsx`, `app/(auth)/_layout.tsx`
**Install**: none
**Prompt**:
```
Replace the placeholder auth screen at app/(auth)/index.tsx with three real screens that use the Midnight Spice design system (Colors + Fonts tokens already used elsewhere in the app):

- app/(auth)/sign-in.tsx: email + password via useSignIn(). On success setActive({ session }) and router.replace('/(tabs)'). Show inline error messages from Clerk's errors array. Include a link to /sign-up and a "Forgot password?" link.

- app/(auth)/sign-up.tsx: email + password + name via useSignUp(). After signUp.create(), call prepareEmailAddressVerification({ strategy: 'email_code' }) and router.push('/verify').

- app/(auth)/verify.tsx: 6-digit code input via useSignUp().attemptEmailAddressVerification(). On success setActive and replace to tabs.

- app/(auth)/_layout.tsx: Stack with headerShown false and background Colors.noir.

All buttons must have expo-haptics feedback. Match the visual style of existing screens.
```
---

---
### Step 3 — Protected routes and session-aware redirects in Expo Router
**Model**: claude-opus-4-6
**Why**: Layout-level gating logic interacts with router state, splash, and Clerk readiness — easy to introduce flicker or redirect loops if wrong.
**Creates/Modifies**: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`, `hooks/useProtectedRoute.ts`
**Install**: none
**Prompt**:
```
Add route protection using Clerk's useAuth().

Create hooks/useProtectedRoute.ts that:
- reads isLoaded and isSignedIn from useAuth()
- reads the current segments via useSegments()
- if !isLoaded, returns early (do nothing — splash is still showing)
- if isSignedIn && segments[0] === '(auth)', router.replace('/(tabs)')
- if !isSignedIn && segments[0] !== '(auth)', router.replace('/(auth)/sign-in')

Call useProtectedRoute() inside the root layout AFTER fonts have loaded and ClerkProvider has mounted. Only hide the splash screen once both fonts are loaded AND Clerk's isLoaded is true — this prevents the auth-flash.

In app/(tabs)/_layout.tsx, also gate with useAuth(): render null if !isSignedIn (defense in depth in case the redirect hook hasn't fired yet).

Verify: cold-launching the app while signed out shows sign-in directly with no flicker of the tabs.
```
---

---
### Step 4 — Configure Clerk → Supabase JWT bridge
**Model**: claude-opus-4-6
**Why**: Cross-service JWT trust setup is fiddly and security-sensitive; getting the template or audience wrong silently breaks RLS.
**Creates/Modifies**: `lib/supabase/client.ts`, `hooks/useSupabaseClient.ts`, Clerk Dashboard JWT template (manual step documented in README)
**Install**:
```bash
npx expo install @supabase/supabase-js
```
**Prompt**:
```
Set up an authenticated Supabase client that uses Clerk-issued JWTs.

1. In the Clerk Dashboard, document (in README.md under "Setup → Clerk JWT template") that the user must create a JWT template named "supabase" with these claims:
   {
     "aud": "authenticated",
     "role": "authenticated",
     "user_id": "{{user.id}}",
     "email": "{{user.primary_email_address}}"
   }
   Signing algorithm HS256, secret = Supabase JWT Secret (from Supabase dashboard → Settings → API).

2. Create lib/supabase/client.ts that exports createSupabaseClient(getToken: () => Promise<string | null>) which builds a @supabase/supabase-js client with global.fetch overridden to inject Authorization: Bearer <token from getToken('supabase')>.

3. Create hooks/useSupabaseClient.ts: useMemo a client tied to useAuth().getToken. Recompute when the Clerk user changes.

4. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local and app.json extra.

Do not store the service role key on the client — that goes in Edge Functions only.
```
---

# Phase 2 — Database (Supabase Postgres)

---
### Step 5 — Schema design + initial migration
**Model**: claude-opus-4-6
**Why**: This is the foundational data model; getting columns, types, indexes, and constraints right now prevents painful migrations later.
**Creates/Modifies**: `supabase/migrations/0001_initial_schema.sql`, `supabase/seed.sql`
**Install**: none (Supabase CLI already installed)

> **⚠️ Repriced (2026-06-09):** `0001` is **already applied to the live DB — do NOT edit it.** The monetization change ships as a *new* migration `0003_pricing_model.sql` that ALTERs the live schema: renames `subscriptions`→`entitlements`, repurposes `plan_id`→`plan` (`free`/`lifetime`), adds `youtube_credits`/`ai_credits`/`youtube_imports_this_month`/`youtube_month_anchor`/`lifetime_purchased_at`, adds a `payments` table, and adds service-role-only credit RPCs (`deduct_ai_credits`, `add_credits`). The `subscriptions`/`plan_id`/`status` shape below is **historical** — see `Agent.md` → Database schema for the current shape. Apply `0003` and redeploy the entitlement functions together.

**Prompt**:
```
Create supabase/migrations/0001_initial_schema.sql with the exact SQL below. Then run `supabase db push` to apply it.

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- Users (mirror of Clerk users; clerk_user_id is the source of truth)
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text unique not null,
  email text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_users_clerk_id on public.users(clerk_user_id);

-- Recipes
create table public.recipes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  cook_time_minutes integer,
  prep_time_minutes integer,
  servings integer,
  tags text[] not null default '{}',
  image_url text,
  storage_path text,
  source_type text not null check (source_type in ('url','youtube','manual')),
  source_url text,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_recipes_user_id on public.recipes(user_id);
create index idx_recipes_tags on public.recipes using gin(tags);
create index idx_recipes_title_trgm on public.recipes using gin(title gin_trgm_ops);

-- Collections (folders of recipes)
create table public.collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_collections_user_id on public.collections(user_id);

-- Many-to-many: recipes <-> collections
create table public.collection_recipes (
  collection_id uuid not null references public.collections(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id)
);

-- Shopping list items
create table public.shopping_list_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  ingredient text not null,
  quantity text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_shopping_user_id on public.shopping_list_items(user_id);

-- Subscriptions (Razorpay)
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique not null references public.users(id) on delete cascade,
  razorpay_subscription_id text unique,
  razorpay_customer_id text,
  plan_id text not null default 'free' check (plan_id in ('free','premium_monthly','premium_yearly')),
  status text not null default 'active' check (status in ('active','cancelled','paused','past_due','expired')),
  current_period_end timestamptz,
  recipe_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_subscriptions_user_id on public.subscriptions(user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger trg_recipes_updated_at before update on public.recipes for each row execute function public.set_updated_at();
create trigger trg_collections_updated_at before update on public.collections for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();

-- Auto-create a free subscription row when a user is inserted
create or replace function public.create_default_subscription()
returns trigger language plpgsql as $$
begin
  insert into public.subscriptions (user_id, plan_id, status) values (new.id, 'free', 'active');
  return new;
end; $$;
create trigger trg_users_default_sub after insert on public.users for each row execute function public.create_default_subscription();

After writing the migration, run `supabase db push` and confirm tables in the Supabase dashboard.
```
---

---
### Step 6 — Row Level Security policies tied to Clerk JWT
**Model**: claude-opus-4-6
**Why**: RLS is the single biggest security surface; a wrong policy leaks every user's data. Must precisely match the `user_id` claim from the Clerk JWT template defined in Step 4.
**Creates/Modifies**: `supabase/migrations/0002_rls_policies.sql`
**Install**: none

> **⚠️ Repriced:** RLS for the renamed `entitlements` table and the new `payments` table lives in `0003_pricing_model.sql` (both SELECT-only for the owner; all writes via service role). `0002` is applied — don't edit it. The `entitlements_select_own` policy replaces the old `subscriptions_select_own`.

**Prompt**:
```
Create supabase/migrations/0002_rls_policies.sql.

For every table in 0001_initial_schema.sql, enable RLS. Then add SELECT/INSERT/UPDATE/DELETE policies that gate on the Clerk JWT claim "user_id".

The pattern is:
- Read user_id from JWT: auth.jwt() ->> 'user_id'
- Match against public.users.clerk_user_id to derive the internal users.id
- A row is accessible only if its user_id column matches that derived id

Helper function:
create or replace function public.current_user_id()
returns uuid language sql stable security definer as $$
  select id from public.users where clerk_user_id = auth.jwt() ->> 'user_id'
$$;

Example policy for recipes:
create policy "recipes_select_own" on public.recipes for select using (user_id = public.current_user_id());
create policy "recipes_insert_own" on public.recipes for insert with check (user_id = public.current_user_id());
create policy "recipes_update_own" on public.recipes for update using (user_id = public.current_user_id());
create policy "recipes_delete_own" on public.recipes for delete using (user_id = public.current_user_id());

Repeat for: users (self-row only by clerk_user_id), collections, collection_recipes (join via collection ownership), shopping_list_items, subscriptions (SELECT only — writes happen via service role in Edge Functions).

After writing, run `supabase db push` and manually test from the Supabase SQL editor with a sample JWT that RLS denies cross-user access.
```
---

---
### Step 7 — Clerk webhook → upsert user row
**Model**: claude-sonnet-4-6
**Why**: Straight integration: receive webhook, verify signature, upsert. Well-documented Svix flow.
**Creates/Modifies**: `supabase/functions/clerk-webhook/index.ts`, `supabase/functions/_shared/cors.ts`
**Install**: none (Deno imports via URL)
**Prompt**:
```
Create supabase/functions/clerk-webhook/index.ts — a Deno Edge Function that receives Clerk webhook events.

1. Verify the Svix signature using svix's Deno-compatible package (https://esm.sh/svix@1.21.0). Reject with 401 if signature invalid. The signing secret comes from Deno.env.get('CLERK_WEBHOOK_SECRET').

2. Handle event types:
   - user.created → upsert into public.users (clerk_user_id, email, display_name, avatar_url)
   - user.updated → update matching row
   - user.deleted → delete matching row (cascades to recipes, collections, etc.)

3. Use the Supabase service role key (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) to bypass RLS.

4. Create supabase/functions/_shared/cors.ts exporting standard CORS headers for use by all functions.

5. Deploy with `supabase functions deploy clerk-webhook --no-verify-jwt` (no JWT verification — Clerk's signature is the auth).

6. In the README under "Setup → Clerk webhook", document adding the function URL as a webhook endpoint in Clerk Dashboard with events user.created, user.updated, user.deleted.
```
---

# Phase 3 — Recipe Import Pipeline

---
### Step 8 — OpenRouter shared client utility
**Model**: claude-sonnet-4-6
**Why**: A small wrapper with a clear interface — fallback logic is the only non-trivial part.
**Creates/Modifies**: `supabase/functions/_shared/openrouter.ts`
**Install**: none
**Prompt**:
```
Create supabase/functions/_shared/openrouter.ts. Export:

callOpenRouter<T>({
  model?: string;            // defaults to 'meta-llama/llama-3.3-70b-instruct'
  fallbackModel?: string;    // defaults to 'google/gemini-2.5-flash'
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: 'json' | 'text';
  maxTokens?: number;
}): Promise<T>

Behaviour:
- POST to https://openrouter.ai/api/v1/chat/completions
- Authorization: Bearer ${Deno.env.get('OPENROUTER_API_KEY')}
- HTTP-Referer: https://saveur.app  (use Deno.env.get('OPENROUTER_REFERER') with fallback)
- X-Title: Saveur
- If responseFormat==='json', include response_format: { type: 'json_object' } and parse the result as JSON before returning.
- On any non-2xx response or timeout (>30s), retry once with fallbackModel.
- If fallback also fails, throw an OpenRouterError with status + body.

Also export a typed RecipeJSON interface:
{
  title: string;
  description: string;
  ingredients: { name: string; quantity: string; unit?: string }[];
  steps: { order: number; instruction: string }[];
  cookTime: number | null;       // minutes
  prepTime: number | null;       // minutes
  servings: number | null;
  tags: string[];
  imageUrl: string | null;
}

And the canonical extraction prompt as a constant:
RECIPE_EXTRACTION_SYSTEM_PROMPT = `You are a culinary data extractor. Given raw text (a recipe webpage or a transcript), return ONLY a JSON object matching this exact schema: {title, description, ingredients[{name, quantity, unit}], steps[{order, instruction}], cookTime, prepTime, servings, tags[], imageUrl}. cookTime and prepTime are integer minutes or null. servings is an integer or null. tags are 3-6 lowercase one-word category labels (e.g. "vegan", "dessert", "indian", "30-min"). If a field is unknown, use null or empty array. Return ONLY the JSON — no markdown, no commentary.`
```
---

---
### Step 9 — URL scraper Edge Function
**Model**: claude-opus-4-6
**Why**: Fetching arbitrary web pages, sanitising HTML, dealing with paywalls, redirects, encoding, and feeding to AI involves real complexity and edge cases.
**Creates/Modifies**: `supabase/functions/import-url/index.ts`
**Install**: none

> **⚠️ Repriced:** the freemium gate is now `enforceUrlGate` in `_shared/gating.ts` — a **15**-saved-recipe cap (was 10) that lifetime users skip. The `402` body is `{ reason: 'recipe_limit' }`. The "subscriptions"/`plan_id` references below are historical (now `entitlements`/`plan`).

**Prompt**:
```
Create supabase/functions/import-url/index.ts.

Input: POST { url: string }, with Authorization: Bearer <Clerk supabase JWT>.

Steps:
1. Verify the JWT (use jose from https://deno.land/x/jose@v5.9.6/index.ts against Clerk JWKS at Deno.env.get('CLERK_JWKS_URL')). On invalid token, 401.

2. Resolve the user's internal users.id by querying public.users where clerk_user_id = jwt.user_id (use service role client).

3. Enforce freemium gating: query subscriptions for this user; if plan_id='free' and recipe_count >= 10, return 402 with body { error: 'limit_reached' }.

4. Fetch the URL with a realistic User-Agent header. Reject if content-type is not text/html or response > 2 MB.

5. Strip the HTML to readable text:
   - Remove <script>, <style>, <nav>, <header>, <footer>
   - Extract og:image and og:title meta tags separately
   - Collapse whitespace
   - Truncate to ~8000 chars (keep enough for ingredients + steps; recipe pages rarely need more)

6. Call callOpenRouter<RecipeJSON> from _shared/openrouter.ts with the RECIPE_EXTRACTION_SYSTEM_PROMPT and the stripped text as userPrompt. responseFormat: 'json'.

7. If imageUrl in the result is null, fall back to the og:image we extracted.

8. Insert into public.recipes with source_type='url', source_url=<input url>. Return the inserted row.

9. Increment subscriptions.recipe_count for this user by 1.

Handle errors with clear status codes: 400 invalid input, 401 unauth, 402 limit, 422 OpenRouter parse failure, 500 unexpected. Always include CORS headers from _shared/cors.ts.

Deploy: `supabase functions deploy import-url`
```
---

---
### Step 10 — YouTube transcript Edge Function
**Model**: claude-opus-4-6
**Why**: Transcript extraction has multiple failure modes (no captions, age-gated, region-locked), and chunking long transcripts for the AI is non-trivial.
**Creates/Modifies**: `supabase/functions/import-youtube/index.ts`
**Install**: youtube-transcript via Deno import (esm.sh/youtube-transcript)

> **⚠️ Repriced:** YouTube imports are now metered separately by `enforceYouTubeGate` + `consumeYouTubeImport` (`_shared/gating.ts`): a monthly allowance (**3** free / **20** lifetime, rolled over via `youtube_month_anchor`), then `youtube_credits` (₹49/10 pack), else `402 { reason: 'youtube_limit' }`. The credit is consumed only on a successful import. (Also: transcripts go through **Supadata**, not the esm.sh lib named here — see `_shared/transcript.ts`.)

**Prompt**:
```
Create supabase/functions/import-youtube/index.ts.

Input: POST { url: string } — the URL must be a youtube.com/watch?v= or youtu.be/ link.

Steps:
1. Same JWT verification + freemium gating + service-role Supabase client as import-url (factor shared helpers into _shared/auth.ts and _shared/gating.ts so import-url and import-youtube can share them — refactor import-url too if needed).

2. Extract the videoId from the URL (support youtu.be short links, ?v= query, /shorts/, /embed/ paths). Reject 400 if no videoId.

3. Fetch the transcript using import { YoutubeTranscript } from 'https://esm.sh/youtube-transcript@1.2.1'. If no transcript is available, return 422 { error: 'no_transcript' } with a friendly message.

4. Concatenate transcript segments into a single text. If > 12000 chars, keep first 8000 + last 4000 (recipe often starts and ends with the full ingredient/step recap).

5. Also fetch the video's metadata via the public oEmbed endpoint https://www.youtube.com/oembed?url=<url>&format=json to get title and thumbnail_url.

6. Call callOpenRouter<RecipeJSON> with RECIPE_EXTRACTION_SYSTEM_PROMPT. Prepend a short hint to userPrompt: "This is a transcript from a YouTube cooking video titled '<title>'. Extract the recipe being demonstrated."

7. If imageUrl is null, fall back to oEmbed thumbnail_url.

8. Insert into public.recipes with source_type='youtube', source_url=<input url>. Increment recipe_count. Return the row.

Same error model as import-url. Deploy: `supabase functions deploy import-youtube`.
```
---

---
### Step 11 — Client-side import hook
**Model**: claude-sonnet-4-6
**Why**: Pure client wrapper over two well-defined endpoints — straightforward.
**Creates/Modifies**: `hooks/useImportRecipe.ts`, `lib/api/import.ts`
**Install**: none
**Prompt**:
```
Create lib/api/import.ts with two functions:
- importFromUrl(url: string, getToken: () => Promise<string|null>): Promise<Recipe>
- importFromYouTube(url: string, getToken: () => Promise<string|null>): Promise<Recipe>

Each POSTs to the corresponding Edge Function (read base URL from EXPO_PUBLIC_SUPABASE_URL + '/functions/v1/<name>'), passes Authorization: Bearer <getToken('supabase')>, parses the JSON Recipe response. Map a 402 response to a typed FreemiumLimitError that the UI can catch and show the paywall.

Create hooks/useImportRecipe.ts that wraps these in TanStack Query useMutation hooks with onSuccess invalidating the recipes list query key.

Decide source automatically: if the URL host matches youtube.com|youtu.be, route to importFromYouTube; otherwise importFromUrl.

Do not change the existing Import tab UI — only expose the hook for it to call.

Install:
npx expo install @tanstack/react-query
(Also add a QueryClientProvider at the root of app/_layout.tsx if not already present.)
```
---

# Phase 4 — AI Features (OpenRouter)

---
### Step 12 — Recipe summarisation Edge Function
**Model**: claude-sonnet-4-6
**Why**: Single-shot AI call, clear input/output, no new architectural concerns now that the OpenRouter wrapper exists.
**Creates/Modifies**: `supabase/functions/ai-summarise/index.ts`
**Install**: none
**Prompt**:
```
Create supabase/functions/ai-summarise/index.ts.

Input: POST { recipeId: string }

1. JWT verify (use _shared/auth.ts).
2. Load the recipe via service role client; 404 if not found; 403 if recipe.user_id != current user.
3. Build a userPrompt: "Summarise this recipe in 2 short sentences, evocative but factual, focused on flavour and technique. Title: <title>. Ingredients: <comma-joined names>. Steps: <numbered>." Use fallbackModel='google/gemini-2.5-flash' as the *primary* model here (this is a lighter task) and meta-llama/llama-3.3-70b-instruct as the fallback.
4. callOpenRouter with responseFormat 'text'.
5. Update recipes.ai_summary with the result. Return { summary }.

Deploy: supabase functions deploy ai-summarise
```
---

---
### Step 13 — Smart auto-tagging on import (hook into import functions)
**Model**: claude-sonnet-4-6
**Why**: Modifying existing import functions to add a tag-refinement post-pass; clear delta.
**Creates/Modifies**: `supabase/functions/_shared/tagging.ts`, `supabase/functions/import-url/index.ts`, `supabase/functions/import-youtube/index.ts`
**Install**: none
**Prompt**:
```
Create supabase/functions/_shared/tagging.ts exporting:

refineTags(recipe: RecipeJSON): Promise<string[]>

It should:
- Build a compact userPrompt with title + ingredient names + existing tags.
- Use Gemini Flash (light model) as primary.
- Ask: "Return a JSON array of 4-6 lowercase one-word category tags (cuisine, diet, meal-type, time, difficulty). Existing tags: <list>. Title: <title>. Ingredients: <names>. Return ONLY the JSON array."
- Parse the response as string[]; if parsing fails, return the input tags unchanged (don't break imports for a non-critical feature).

Then in import-url/index.ts and import-youtube/index.ts: after callOpenRouter returns the RecipeJSON but BEFORE inserting to DB, call refineTags(recipeJson) and merge into recipeJson.tags (dedupe, lowercase). Wrap in try/catch so tagging never fails the import.
```
---

---
### Step 14 — Dish photo → nutrition (macros) Edge Function
**Model**: claude-opus-4-6
**Why**: A multimodal (vision) call with a careful prompt plus defensive parsing/normalisation of estimated numbers; the shared OpenRouter client must be extended to pass images.
**Creates/Modifies**: `supabase/functions/_shared/openrouter.ts`, `supabase/functions/ai-nutrition/index.ts`, `lib/api/nutrition.ts`, `hooks/useNutritionAnalysis.ts`
**Install**: none (client camera/resize libs land with the UI step later)

> **⚠️ Repriced:** the macro scan is now **credit-gated**. Before the vision call, `enforceAiCredits` requires ≥ 2 `ai_credits` (else `402 { reason: 'no_ai_credits' }`); on a successful parse, `deductAiCredits` deducts **2** atomically (via the `deduct_ai_credits` RPC). **Lifetime users are NOT exempt.** The response now includes `creditsRemaining`. Credit packs: ₹99/50.

**Prompt**:
```
Extend supabase/functions/_shared/openrouter.ts: add an optional images?: string[] to CallOptions. When present, send the user message as multimodal content ([{type:'text', text}, {type:'image_url', image_url:{url}}]); keep text-only calls sending content as a plain string.

Create supabase/functions/ai-nutrition/index.ts.

Input: POST { image: string (a data:image/...;base64,... data URL or an http(s) image URL), note?: string }

1. Validate the image (data URL or http(s) url; reject anything over ~5 MB). JWT verify via _shared/auth.ts. No DB write — this is a stateless analysis.
2. callOpenRouter with a VISION model (primary google/gemini-2.5-flash, fallback openai/gpt-4o-mini), images:[image], responseFormat 'text' (vision models are unreliable with json_object), maxTokens ~700.
3. Ask for ONLY this JSON for the portion shown: { dish, servingSize, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, confidence(low|medium|high), assumptions[], items[{name, calories, protein_g, carbs_g, fat_g}] }. Non-food image → dish null, all numbers 0, confidence low.
4. Parse the JSON defensively (strip code fences / extract the {...}); normalise numbers (non-negative, rounded), clamp confidence, cap items. 422 if unparseable.
5. Return the normalised result.

Create lib/api/nutrition.ts (analyzeDishPhoto({image, note}, getToken) → NutritionResult; NutritionError typed error) and hooks/useNutritionAnalysis.ts (TanStack Query useMutation) following the Step 11 client pattern — anon key as apikey, Clerk default token in X-Clerk-Token.

Deploy: supabase functions deploy ai-nutrition --no-verify-jwt
```
---

# Phase 5 — Payments (Razorpay)

---
### Step 15 — Razorpay create-order Edge Function (one-time)
**Model**: claude-opus-4-6
**Why**: One-time Order creation + a fixed server-side price map + the shared REST wrapper — security-critical handshake with Razorpay's API.
**Creates/Modifies**: `supabase/functions/razorpay-create-order/index.ts`, `supabase/functions/_shared/razorpay.ts`
**Install**: none
**Prompt**:
```
Create supabase/functions/_shared/razorpay.ts wrapping Razorpay's REST API with Basic auth (btoa(`${KEY_ID}:${KEY_SECRET}`) — Deno has no Buffer). Export:

- createOrder({ amountPaise, receipt?, notes? }): Promise<{ id, amount, currency, status }>   // POST /orders, currency 'INR', payment_capture 1
- createCustomer({ name, email }): Promise<{ id }>   // POST /customers, fail_existing: 0
- verifyWebhookSignature(rawBody, signature, secret): Promise<boolean>   // async HMAC-SHA256 hex, constant-time compare
- RazorpayError(status, body)

Read RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET from Deno.env. The Orders API does NOT accept customer_id (Checkout attaches the customer at pay time) — never pass it, Razorpay 400s. Prices are fixed in code, so there are NO RAZORPAY_PLAN_* env vars.

Then create supabase/functions/razorpay-create-order/index.ts:

Input: POST { product: 'lifetime' | 'yt_credits' | 'ai_credits' }

1. Validate product (400 invalid_product). JWT verify (Clerk JWKS), resolve user.
2. Fixed price map in paise: lifetime 49900, yt_credits 4900, ai_credits 9900.
3. ensureCustomer (best-effort): if entitlements.razorpay_customer_id is null, createCustomer({name,email}) and store it — never block checkout on failure.
4. createOrder({ amountPaise, receipt, notes:{ user_id, product } }). Razorpay failure → 502.
5. Insert a payments row { user_id, razorpay_order_id, product, amount_paise, status:'created' }.
6. Return { orderId, amount, currency:'INR', keyId: RAZORPAY_KEY_ID } for the client Checkout SDK.

Deploy: supabase functions deploy razorpay-create-order --no-verify-jwt
```
---

---
### Step 16 — Razorpay webhook + entitlement grants
**Model**: claude-opus-4-6
**Why**: Signature verification + idempotent application of a one-time purchase to the user's entitlement is the most security-critical piece of the payment flow.
**Creates/Modifies**: `supabase/functions/razorpay-webhook/index.ts`
**Install**: none
**Prompt**:
```
Create supabase/functions/razorpay-webhook/index.ts — deploy with --no-verify-jwt; the Razorpay signature is the authentication.

1. Read the raw request body as text BEFORE parsing JSON (the signature is over the raw bytes).
2. await verifyWebhookSignature(raw, X-Razorpay-Signature, RAZORPAY_WEBHOOK_SECRET) (it's async). Reject 401 if invalid.
3. Parse the event. Only act on payment lifecycle events (ack everything else with 200 so Razorpay doesn't retry):
   - payment.captured → find the payments row by razorpay_order_id (the order_id on the payment entity). If already status='paid', return 200 (idempotent). Else mark it 'paid', store razorpay_payment_id, and grant by payments.product:
       lifetime    → entitlements.plan='lifetime', lifetime_purchased_at=now()
       yt_credits  → add_credits(user_id, 10, 0)   (service-role-only RPC)
       ai_credits  → add_credits(user_id, 0, 50)    (service-role-only RPC)
   - payment.failed → mark the payments row 'failed' (unless already 'paid').
4. Service-role client (bypasses RLS). Apply grants via the RPCs — never trust any client input.
5. Return 200 'ok' on success; 401 bad signature; 500 on a DB failure (Razorpay retries).

Note: the "lifetime skips the free caps" logic already lives in the gates (enforceUrlGate / enforceYouTubeGate read plan='lifetime'), so NO importer edit is needed here.

Register the webhook URL in the Razorpay dashboard (events payment.captured, payment.failed) and set RAZORPAY_WEBHOOK_SECRET.

Deploy: supabase functions deploy razorpay-webhook --no-verify-jwt
```
---

---
### Step 17 — Client-side checkout + entitlements
**Model**: claude-sonnet-4-6
**Why**: Wire-up: call create-order, open Razorpay Checkout, read entitlement state, gate the UI.
**Creates/Modifies**: `lib/api/billing.ts`, `hooks/useEntitlements.ts`, `components/PaywallProvider.tsx`, `components/PaywallSheet.tsx`, `components/RazorpayCheckoutWebView.tsx`, `app/_layout.tsx`, `app/(tabs)/profile.tsx`, `app/shopping.tsx`
**Install**:
```bash
npx expo install react-native-webview
```
**Prompt**:
```
Create lib/api/billing.ts: createOrder(product: 'lifetime'|'yt_credits'|'ai_credits', getToken) → { orderId, amount, currency, keyId } (POST razorpay-create-order; anon key in apikey, Clerk default token in X-Clerk-Token); BillingError.

Create hooks/useEntitlements.ts — reads the entitlements row via the authed Supabase client (RLS scopes it to the user), TanStack Query key ['entitlements'], staleTime 60s. Returns { plan, isLifetime, recipeCount, atRecipeLimit (free && >=15), youtubeRemaining (monthly allowance left + credits), aiCredits, showPaywall }.

Create components/PaywallProvider.tsx — a context (showPaywall/hidePaywall) that mounts a single shared <PaywallSheet>. Mount it in app/_layout.tsx (inside SafeAreaProvider + QueryClientProvider).

Create components/PaywallSheet.tsx — Midnight Spice bottom sheet: a hero ₹499 Lifetime card + two top-up cards (YT ₹49/10, AI ₹99/50). Tapping a product calls createOrder, then opens RazorpayCheckoutWebView. On success, invalidate ['entitlements'] and close (the webhook grants the entitlement).

Create components/RazorpayCheckoutWebView.tsx — a react-native-webview modal rendering inline Razorpay checkout.js with order_id + keyId; postMessage bridges success/dismiss/failed back to RN.

Rewire the isPro stubs: profile.tsx + shopping.tsx read useEntitlements().isLifetime (usage meter uses real recipeCount/15; CTAs call showPaywall('lifetime')). Don't restyle unrelated screens.
```
---

# Phase 6 — Storage (Supabase Storage)

---
### Step 18 — Storage bucket setup + signed URL retrieval
**Model**: claude-opus-4-6
**Why**: Bucket policies + signed URL TTL strategy + image upload concurrency in Edge Functions has subtle correctness implications.
**Creates/Modifies**: `supabase/migrations/0004_storage_buckets.sql`, `supabase/functions/_shared/storage.ts`, `supabase/functions/get-recipe-image/index.ts`

> ✅ **Built (2026-06-09), with two corrections to the draft below:**
> 1. Migration is **`0004_storage_buckets.sql`**, NOT `0003_*` — `0003` is taken by `0003_pricing_model.sql`; a second `0003_*` breaks `db push` ordering.
> 2. `get-recipe-image` deploys **`--no-verify-jwt`** (it JWKS-verifies the Clerk token like every other authed fn; the gateway would otherwise reject the asymmetric Clerk JWT). The Step 20 client caller sends the Clerk token in **`X-Clerk-Token`**, not `Authorization`.
> 3. The read policy is **owner-scoped** (`(storage.foldername(name))[1] = current_user_id()`), not the draft's "every authenticated user reads every object". Reads use service-role signed URLs anyway (RLS bypassed), so this is defense-in-depth.
**Install**: none
**Prompt**:
```
1. Create supabase/migrations/0004_storage_buckets.sql:

insert into storage.buckets (id, name, public) values ('recipe-images', 'recipe-images', false) on conflict (id) do nothing;

-- Only authenticated users can read their own recipe images via signed URLs; uploads only via service role (Edge Functions)
create policy "recipe_images_authenticated_read"
on storage.objects for select to authenticated
using (bucket_id = 'recipe-images');

Run `supabase db push`.

2. Create supabase/functions/_shared/storage.ts exporting:
- uploadRecipeImageFromUrl(supabase, userId: string, recipeId: string, imageUrl: string): Promise<string | null>
  Fetches the remote image, validates content-type starts with image/, max 5 MB, uploads to recipe-images/<userId>/<recipeId>.<ext>, returns the storage path. Returns null and logs (does not throw) on any failure — image storage is best-effort.

3. Create supabase/functions/get-recipe-image/index.ts:

Input: POST { recipeId: string }

- JWT verify, resolve user.
- Load recipe; 404/403 as appropriate.
- If recipe.storage_path is set, generate a signed URL with TTL=3600s via supabase.storage.from('recipe-images').createSignedUrl(...). Return { url: signedUrl, source: 'storage' }.
- Else if recipe.image_url is set, return { url: recipe.image_url, source: 'origin' }.
- Else return 404 { error: 'no_image' }.

Deploy: supabase functions deploy get-recipe-image --no-verify-jwt
```
---

---
### Step 19 — Wire image upload into the import pipeline
**Model**: claude-sonnet-4-6
**Why**: Small targeted edit to existing import functions to call the shared uploader after recipe insert.
**Creates/Modifies**: `supabase/functions/import-url/index.ts`, `supabase/functions/import-youtube/index.ts`

> ✅ **Built (2026-06-09).** Both importers call `uploadRecipeImageFromUrl` after `insertRecipe`, `UPDATE recipes set storage_path` on success, and reflect it in the returned row — all inside a try/catch so storage can never fail an import. Uses the computed `imageUrl` (model image → og:image/thumbnail fallback), not just `recipe.imageUrl`. **Redeploy both with `--no-verify-jwt`** (per the project's auth convention; the draft below omits the flag).
**Install**: none
**Prompt**:
```
In both import-url/index.ts and import-youtube/index.ts:

After inserting the recipe row (so we have recipe.id), if recipeJson.imageUrl is non-null:
- Call uploadRecipeImageFromUrl from _shared/storage.ts with (serviceClient, userId, recipeId, recipeJson.imageUrl).
- If it returns a storage_path, UPDATE recipes set storage_path = <path> where id = recipeId.
- If it returns null, leave storage_path null and rely on the image_url column.

Do this BEFORE returning the recipe row to the client so the response includes the correct fields. Wrap the whole upload in try/catch so it never fails the import.

Redeploy both functions **with `--no-verify-jwt`** (matches the project auth convention).
```
---

---
### Step 20 — Client-side image resolver hook
**Model**: claude-sonnet-4-6
**Why**: Tiny client helper that closes the loop on the storage fallback contract.
**Creates/Modifies**: `hooks/useRecipeImage.ts`, `lib/api/storage.ts`

> ✅ **Built (2026-06-09), expanded.** Beyond the draft, this step also **converted the recipe screens to real data** (the draft assumed they already were — they were on `constants/mockData.ts`):
> - Added `lib/recipes/uiRecipe.ts` (`UiRecipe` + `rowToUiRecipe`/`mockToUiRecipe` + `parseQuantity` for string DB quantities + `isUuid`), `hooks/useRecipes.ts`, `hooks/useRecipe.ts`.
> - **Home feed, recipe detail, cook mode** now read real recipes (RLS); detail/cook **fall back to mock** for non-UUID ids so the still-mock search/collections screens keep working.
> - `useRecipeImage` wired into the **detail hero only**; **cards render origin `image_url`** (per-card signed URLs would fire one Edge call per card per render).
> - **Bundled the `ai-summarise` client wiring** (`lib/api/summarise.ts` + `hooks/useRecipeSummary.ts` + a detail-screen "Generate summary" button → `recipes.ai_summary`).
> - Deferred: search + collections on real data (separate features). Deploy `get-recipe-image` + `ai-summarise` (`--no-verify-jwt`) for image/summary to resolve.
**Install**: none
**Prompt**:
```
Create lib/api/storage.ts with getRecipeImageUrl(recipeId, getToken): Promise<{ url: string; source: 'storage' | 'origin' }>.

Create hooks/useRecipeImage.ts:
- TanStack Query useQuery with key ['recipe-image', recipeId]
- staleTime 50 minutes (signed URLs live 60 min)
- enabled only when recipeId is defined
- Returns { url, isLoading }

This hook replaces any direct reads of recipe.image_url in the Recipe detail and card components — those should now call useRecipeImage(recipe.id). Make that replacement in the existing recipe card + detail screens, keeping the visual layout untouched.
```
---

# Master Cheat Sheet

| Step | Model | Feature Area | Files Created / Modified |
|---|---|---|---|
| 1 | sonnet-4-6 | Auth | `app/_layout.tsx`, `lib/auth/tokenCache.ts`, `.env.local`, `app.json` |
| 2 | sonnet-4-6 | Auth | `app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx`, `app/(auth)/verify.tsx`, `app/(auth)/_layout.tsx` |
| 3 | opus-4-6 | Auth | `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`, `hooks/useProtectedRoute.ts` |
| 4 | opus-4-6 | Auth | `lib/supabase/client.ts`, `hooks/useSupabaseClient.ts`, `README.md` |
| 5 | opus-4-6 | Database | `supabase/migrations/0001_initial_schema.sql`, `supabase/seed.sql` |
| 6 | opus-4-6 | Database | `supabase/migrations/0002_rls_policies.sql` |
| 7 | sonnet-4-6 | Database | `supabase/functions/clerk-webhook/index.ts`, `supabase/functions/_shared/cors.ts` |
| 8 | sonnet-4-6 | Import | `supabase/functions/_shared/openrouter.ts` |
| 9 | opus-4-6 | Import | `supabase/functions/import-url/index.ts` |
| 10 | opus-4-6 | Import | `supabase/functions/import-youtube/index.ts`, `_shared/auth.ts`, `_shared/gating.ts` |
| 11 | sonnet-4-6 | Import | `lib/api/import.ts`, `hooks/useImportRecipe.ts` |
| 12 | sonnet-4-6 | AI | `supabase/functions/ai-summarise/index.ts` |
| 13 | sonnet-4-6 | AI | `supabase/functions/_shared/tagging.ts`, `import-url/index.ts`, `import-youtube/index.ts` |
| 14 | opus-4-6 | AI | `supabase/functions/_shared/openrouter.ts`, `supabase/functions/ai-nutrition/index.ts`, `lib/api/nutrition.ts`, `hooks/useNutritionAnalysis.ts` |
| — | opus-4-6 | Payments | **`supabase/migrations/0003_pricing_model.sql`** (reprice: entitlements + payments + credit RPCs + gating rewrite; touches `_shared/gating.ts`, both importers, `ai-nutrition`) |
| 15 | opus-4-6 | Payments | `supabase/functions/_shared/razorpay.ts`, `supabase/functions/razorpay-create-order/index.ts` |
| 16 | opus-4-6 | Payments | `supabase/functions/razorpay-webhook/index.ts` |
| 17 | sonnet-4-6 | Payments | `lib/api/billing.ts`, `hooks/useEntitlements.ts`, `components/PaywallProvider.tsx`, `components/PaywallSheet.tsx`, `components/RazorpayCheckoutWebView.tsx`, `profile.tsx`, `shopping.tsx` |
| 18 | opus-4-6 | Storage | `supabase/migrations/0004_storage_buckets.sql`, `supabase/functions/_shared/storage.ts`, `supabase/functions/get-recipe-image/index.ts` |
| 19 | sonnet-4-6 | Storage | `import-url/index.ts`, `import-youtube/index.ts` |
| 20 | sonnet-4-6 | Storage | `lib/api/storage.ts`, `lib/api/summarise.ts`, `lib/recipes/uiRecipe.ts`, `hooks/useRecipeImage.ts`, `hooks/useRecipeSummary.ts`, `hooks/useRecipe.ts`, `hooks/useRecipes.ts`; `(tabs)/index.tsx`, `recipe/[id].tsx`, `cook/[id].tsx` → real data (+ bundled ai-summarise wiring) |

## Deployment order (run after each phase)

```bash
# After Phase 2
supabase db push

# After Phase 3
supabase functions deploy clerk-webhook --no-verify-jwt
supabase functions deploy import-url
supabase functions deploy import-youtube

# After Phase 4
supabase functions deploy ai-summarise
supabase functions deploy ai-nutrition --no-verify-jwt

# After Phase 5 — apply the reprice migration, then redeploy EVERY function that
# touches entitlements (the rename breaks the old ones until redeployed):
supabase db push   # applies 0003_pricing_model.sql
supabase functions deploy import-url --no-verify-jwt
supabase functions deploy import-youtube --no-verify-jwt
supabase functions deploy ai-nutrition --no-verify-jwt
supabase functions deploy razorpay-create-order --no-verify-jwt
supabase functions deploy razorpay-webhook --no-verify-jwt

# After Phase 6
supabase functions deploy get-recipe-image --no-verify-jwt
# Redeploy import functions to pick up storage hookup (Step 19):
supabase functions deploy import-url --no-verify-jwt
supabase functions deploy import-youtube --no-verify-jwt
```

## Edge Function secrets to set (once, before deploying any function)

```bash
supabase secrets set \
  OPENROUTER_API_KEY=sk-or-... \
  OPENROUTER_REFERER=https://saveur.app \
  CLERK_JWKS_URL=https://<clerk-domain>/.well-known/jwks.json \
  CLERK_WEBHOOK_SECRET=whsec_... \
  SUPADATA_API_KEY=sd_... \
  RAZORPAY_KEY_ID=rzp_... \
  RAZORPAY_KEY_SECRET=... \
  RAZORPAY_WEBHOOK_SECRET=...
```

> One-time Orders carry fixed amounts in `razorpay-create-order`, so there are **no** `RAZORPAY_PLAN_MONTHLY`/`RAZORPAY_PLAN_YEARLY` vars.

`SUPABASE_SERVICE_ROLE_KEY` is automatically available inside Edge Functions — do not set it manually.

---

**End of roadmap.** Execute phases in order — each phase depends on the previous one being deployed and verified.
