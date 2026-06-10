# Saveur — Agent Guide

> **Read this first.** This is the navigation & architecture reference for the Saveur codebase, written so a fresh agent (new chat, no prior context) can understand the project and find any file fast. Keep it up to date when structure changes.

**Saveur** is a premium, AI-powered recipe app: import recipes from a URL or YouTube video, the backend scrapes + runs the content through an LLM to extract structured recipe data, and users save / organise / cook them with step-by-step guidance and timers. Monetization (repriced in `0003`): **Free** = 15 saved recipes + unlimited URL imports + 3 YouTube imports/month; **Lifetime Unlock** = one-time ₹499 (unlimited saves, 20 YouTube/month); plus consumable **credit packs** — YouTube import credits (₹49/10) and AI-scan credits (₹99/50, the dish-photo macro scanner costs 2/scan). Consumables are metered for everyone, lifetime included.

---

## Companion docs (don't duplicate them — point to them)

| File | What it is | When to read it |
|---|---|---|
| `Agent.md` (this file) | Project map, structure, conventions, status | Always, first |
| `Prompt.md` | Original **UI design spec** — Midnight Spice design system, every screen's intended look/behaviour, component list | When changing UI / visual work |
| `backend-roadmap.md` | The **20-step backend build plan** (Phases 1–6), each step with model + prompt + files | When building backend features |
| `README.md` | **Setup guide** — env vars, Clerk JWT template, migrations, webhook, secrets, smoke test | When wiring services / deploying |

> Older chronological build-log entries (per-step narrative) live in git history of this file (commit `front end part v1` and later). This guide reflects the **current state**, which is what matters for navigation.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Expo SDK ~54, React Native 0.81.5, React 19.1.0 | New Architecture enabled (`newArchEnabled: true`) |
| Language | TypeScript (`strict: true`) | Typed routes enabled (`experiments.typedRoutes`) |
| Navigation | Expo Router v6 | File-based, `app/` dir; route groups in `()` |
| Styling | NativeWind v4 + Tailwind 3.4 | `className` props; tokens in `tailwind.config.js`; `global.css` is the Tailwind entry |
| Animation | `react-native-reanimated` v4 (+ `react-native-worklets`), `react-native-gesture-handler` | spring/timing, shared values, `Gesture.Pan` |
| UI libs | `expo-image`, `expo-blur`, `expo-linear-gradient`, `expo-haptics`, `expo-keep-awake`, `react-native-svg`, `@expo/vector-icons` | |
| Server state | TanStack Query (`@tanstack/react-query`) | client cache + mutations for Edge Function calls; `QueryClientProvider` in `app/_layout.tsx` |
| Fonts | `@expo-google-fonts/*` via `useFonts` | Cormorant Garamond (display), DM Sans (body), JetBrains Mono (mono) |
| Auth | Clerk (`@clerk/clerk-expo` v2) | Email/password + email-code verify; session in `expo-secure-store` |
| Database | Supabase Postgres | RLS tied to Clerk JWT |
| Storage | Supabase Storage | Private `recipe-images` bucket; service-role uploads + signed-URL reads (`get-recipe-image`). Phase 6 Steps 18–19 built (importers store images); client resolver hook (20) pending |
| Serverless API | Supabase Edge Functions (Deno) | All mutations/AI go through these |
| AI | OpenRouter | default `meta-llama/llama-3.3-70b-instruct`, fallback `google/gemini-2.5-flash` |
| Payments | Razorpay (INR) | **One-time Orders** — ₹499 Lifetime Unlock + consumable credit packs (Phase 5, Steps 15–17 built); needs `react-native-webview` for checkout |
| Import sources | **URL scraper + YouTube transcript ONLY** | TikTok/Instagram are frontend stubs — backend must never implement them |

---

## Quick start

```bash
npm install
npx expo start --clear        # start Metro (clear cache after env changes)
npm run ios                    # or: npx expo start --ios
npm run android
```

Requires `.env.local` (see below). There is no test suite and no lint script configured. Deno is **not** installed locally, so Edge Functions can't be type-checked here — they run in the Supabase Deno runtime.

---

## Folder & file structure (annotated)

```
Recipe_fetcher/
├── app/                              # Expo Router routes (file = screen)
│   ├── _layout.tsx                   # ROOT: fonts, ClerkProvider + QueryClientProvider, splash gating, useProtectedRoute, Stack of route groups
│   ├── (onboarding)/
│   │   └── index.tsx                 # 3-slide horizontal pager → routes to (auth)
│   ├── (auth)/
│   │   ├── _layout.tsx               # Stack, headerShown:false, noir bg, fade
│   │   ├── index.tsx                 # <Redirect href="/(auth)/sign-in" /> shim
│   │   ├── sign-in.tsx               # useSignIn() email+password → setActive → (tabs)
│   │   ├── sign-up.tsx               # useSignUp() name+email+password → prepareEmailAddressVerification → verify
│   │   └── verify.tsx                # 6-digit OTP → attemptEmailAddressVerification → setActive → (tabs)
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab bar (5 tabs, Import centre raised); gated on useAuth()
│   │   ├── index.tsx                 # Home feed — REAL data via useRecipes (recently imported + grid); skeletons + empty state
│   │   ├── search.tsx                # Search + filter panel (cuisine/dietary/cook-time chips)
│   │   ├── import.tsx                # HERO screen: URL input → useImportRecipe (REAL backend import); idle/loading/success sheet
│   │   ├── collections.tsx           # 2-col collection grid, FAB + new-collection modal
│   │   └── profile.tsx               # Avatar, plan/usage, settings sections, Sign Out (useAuth().signOut)
│   ├── recipe/[id].tsx               # Recipe detail — REAL via useRecipe (mock fallback); useRecipeImage hero + useRecipeSummary/ai_summary card; null-safe meta + string-qty scaling
│   ├── cook/[id].tsx                 # Cook mode — REAL via useRecipe (mock fallback); per-step ingredient callout/timers shown only when present (mock)
│   ├── collections/[id].tsx          # Collection drill-down: recipe grid for one collection
│   └── shopping.tsx                  # Shopping list, Pro-gated (BlurView lock for free users)
│
├── components/                       # reusable UI components (all use Colors + Fonts tokens)
│   ├── RecipeCard.tsx                # Image + title + cook-time pill + save bookmark; spring press
│   ├── SkeletonCard.tsx              # Loading placeholder matching RecipeCard dims
│   ├── TagChip.tsx                   # Badge: variants default|active|dietary|cuisine
│   ├── IngredientRow.tsx             # Checkbox + qty + name; animated strikethrough
│   ├── TimerWidget.tsx               # SVG circular countdown ring (stateless; parent owns time)
│   ├── StepCard.tsx                  # Step number + instruction + optional embedded TimerWidget
│   ├── ImportSourceButton.tsx        # Large tappable source card (icon + label)
│   ├── CollectionCard.tsx            # 2×2 image collage + name + recipe count
│   ├── ProBadge.tsx                  # variants inline|lock|banner for Pro gating
│   ├── PaywallProvider.tsx           # Context (showPaywall/hidePaywall) + mounts the shared PaywallSheet; mounted in app/_layout.tsx
│   ├── PaywallSheet.tsx              # Bottom-sheet paywall: ₹499 Lifetime hero + YT/AI top-up cards → createOrder → checkout
│   └── RazorpayCheckoutWebView.tsx   # WebView inline checkout.js (order_id + keyId) — REQUIRES react-native-webview; webhook grants the entitlement
│
├── constants/
│   ├── colors.ts                     # Colors (Midnight Spice palette) + ColorKey type
│   ├── fonts.ts                      # Fonts (Google Font family ids) + FontKey type
│   └── mockData.ts                   # Recipe/Ingredient/Step/Collection types + RECIPES, COLLECTIONS + helpers
│
├── hooks/
│   ├── useImportRecipe.ts            # TanStack Query mutation: import a recipe (auto-routes url/youtube), invalidates ['recipes']
│   ├── useNutritionAnalysis.ts       # TanStack Query mutation: dish photo → ai-nutrition (macros estimate); stateless
│   ├── useRecipes.ts                 # TanStack query: user's recipes (RLS), newest first → RecipeRow[]; key ['recipes', userId]
│   ├── useRecipe.ts                  # TanStack query: one recipe by id (RLS); disabled for non-UUID (mock) ids → caller falls back to mock
│   ├── useRecipeImage.ts             # Resolves a recipe image via get-recipe-image (signed URL / origin); key ['recipe-image', id], staleTime 50m
│   ├── useRecipeSummary.ts           # TanStack mutation: ai-summarise → ai_summary; invalidates ['recipes'] + ['recipe', id]
│   ├── useEntitlements.ts            # Reads entitlements row (RLS) → {plan, isLifetime, recipeCount, atRecipeLimit, youtubeRemaining, aiCredits, showPaywall}
│   ├── useProtectedRoute.ts          # Clerk session → redirect between (auth) and (tabs); public = (auth)+(onboarding)
│   └── useSupabaseClient.ts          # Memoised Supabase client carrying Clerk JWT (template "supabase"), keyed on userId
│
├── lib/
│   ├── api/import.ts                 # importFromUrl/importFromYouTube/importRecipe → Edge Functions; FreemiumLimitError, ImportError, RecipeRow
│   ├── api/nutrition.ts              # analyzeDishPhoto(image, note) → ai-nutrition; NutritionError, NutritionResult/NutritionItem
│   ├── api/billing.ts                # createOrder(product) → razorpay-create-order; Product, CreateOrderResult, BillingError
│   ├── api/storage.ts                # getRecipeImageUrl(recipeId) → get-recipe-image ({url, source}); RecipeImageError
│   ├── api/summarise.ts              # summariseRecipe(recipeId) → ai-summarise ({summary}); SummariseError
│   ├── recipes/uiRecipe.ts           # UiRecipe shape + rowToUiRecipe / mockToUiRecipe adapters + parseQuantity + isUuid
│   ├── auth/tokenCache.ts            # Clerk TokenCache over expo-secure-store (get/save/clear, try-catch)
│   └── supabase/client.ts            # createSupabaseClient(getToken): authedFetch injects Bearer token; Supabase auth disabled
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql   # 6 tables, indexes, updated_at trigger, default-subscription trigger
│   │   ├── 0002_rls_policies.sql     # RLS on all tables + current_user_id() helper (security definer)
│   │   ├── 0003_pricing_model.sql    # repricing: subscriptions→entitlements, payments table, credit RPCs (service-role only), reworked default trigger
│   │   ├── 0004_storage_buckets.sql  # Phase 6: private recipe-images bucket + owner-scoped read policy (signed-URL reads)
│   │   └── 0005_auth_claim_compat.sql # RLS resolves user from `user_id` OR `sub` claim (template token or default Clerk token via Third-Party Auth)
│   ├── functions/                    # Deno Edge Functions
│   │   ├── _shared/
│   │   │   ├── cors.ts               # corsHeaders shared by all functions
│   │   │   ├── http.ts               # HttpError + json() + errorResponse() (typed status → Response)
│   │   │   ├── auth.ts               # verifyClerkToken (JWKS, sub), resolveUserId, authenticateRequest
│   │   │   ├── gating.ts             # entitlement gates: enforceUrlGate/incrementRecipeCount, enforceYouTubeGate/consumeYouTubeImport, enforceAiCredits/deductAiCredits
│   │   │   ├── recipes.ts            # insertRecipe (RecipeJSON → recipes row) — shared by both importers
│   │   │   ├── tagging.ts            # refineTags (light model proposes category tags; merges with existing, best-effort)
│   │   │   ├── transcript.ts         # fetchYouTubeTranscript via Supadata (managed API; handles 202 async + 206 none)
│   │   │   ├── openrouter.ts         # callOpenRouter<T> (text + vision via images[]), OpenRouterError, RecipeJSON, RECIPE_EXTRACTION_SYSTEM_PROMPT
│   │   │   ├── razorpay.ts           # createCustomer / createOrder / verifyWebhookSignature (Basic auth REST), RazorpayError
│   │   │   └── storage.ts            # uploadRecipeImageFromUrl (best-effort: remote image → private bucket <userId>/<recipeId>.<ext>; null on any failure)
│   │   ├── clerk-webhook/index.ts    # Svix-verified Clerk webhook → upsert/delete public.users (service role)
│   │   ├── import-url/index.ts       # POST {url}: auth → gate → fetch → strip HTML → OpenRouter → insertRecipe → store image (storage_path)
│   │   ├── import-youtube/index.ts   # POST {url}: auth → gate → transcript → oEmbed → OpenRouter → insertRecipe → store image (storage_path)
│   │   ├── ai-summarise/index.ts     # POST {recipeId}: auth → load+own-check → OpenRouter (text) → update recipes.ai_summary
│   │   ├── ai-nutrition/index.ts     # POST {image, note?}: auth → enforceAiCredits(≥2) → OpenRouter (vision) → macros JSON → deductAiCredits(2) (no recipe write)
│   │   ├── razorpay-create-order/index.ts        # POST {product}: auth → ensure customer → createOrder (fixed paise) → insert payments(created) → return {orderId, amount, currency, keyId}
│   │   ├── razorpay-webhook/index.ts # raw body → verify HMAC sig → payment.captured: mark paid + grant entitlement by product (idempotent); payment.failed: mark failed
│   │   └── get-recipe-image/index.ts # POST {recipeId}: auth → own-check → signed URL if storage_path (TTL 1h) else origin image_url else 404 no_image
│   ├── seed.sql                      # Placeholder (comment-only)
│   └── .temp/                        # Supabase CLI scratch (linked-project ref) — ignore
│
├── app.json                          # Expo config: name Saveur, scheme saveur, dark UI, plugins, extra (env → EAS)
├── babel.config.js                   # babel-preset-expo (jsxImportSource nativewind) + nativewind/babel
├── metro.config.js                   # withNativeWind(config, { input: './global.css' })
├── tailwind.config.js                # Midnight Spice colors, font families, radii (card/chip/pill)
├── global.css                        # @tailwind base/components/utilities
├── tsconfig.json                     # extends expo base, strict
├── package.json                      # name "saveur"; scripts: start/android/ios
├── .env.local                        # EXPO_PUBLIC_* keys (gitignored) — see Environment below
├── Prompt.md                         # UI design spec (see Companion docs)
├── backend-roadmap.md                # 20-step backend plan (see Companion docs)
└── README.md                         # Setup guide (see Companion docs)
```

**Ignore these duplicate/cruft files** (macOS/iCloud copies, not real source): `app/(auth)/index 2.tsx`, `.gitignore 2`. Don't edit or import them.

---

## Routing & navigation map

Route groups `(onboarding)`, `(auth)`, `(tabs)` are declared in `app/_layout.tsx`. `useProtectedRoute()` does the gating; `(auth)` + `(onboarding)` are the only public segments.

```
(onboarding)/index   → (auth)                         [Skip / Next / Sign In]
(auth)/sign-in       → (tabs)                          [on success]
(auth)/sign-up       → (auth)/verify → (tabs)
(tabs)/index (home)  → recipe/[id], import, search, collections, profile
(tabs)/search        → recipe/[id], import
(tabs)/import        → recipe/[id]                      [success sheet → Save]
(tabs)/collections   → collections/[id]
collections/[id]     → recipe/[id]
recipe/[id]          → cook/[id]                        [Start Cooking]
(tabs)/profile       → shopping, (auth)/sign-in         [Sign Out]
```

Auth flow: cold launch → splash held until **fonts AND Clerk `isLoaded`** → signed out lands on `/(auth)/sign-in` (no tab flash); signed in lands on `/(tabs)`. Session persists via `expo-secure-store`.

---

## Design system — "Midnight Spice" (from `Prompt.md`)

Source tokens from `constants/colors.ts` / `constants/fonts.ts` (and mirrored in `tailwind.config.js`). **Never hardcode hex/font strings in screens — import the tokens.**

| Token | Hex | Role |
|---|---|---|
| noir | `#1A0A0E` | primary background |
| burgundy | `#6B1A2A` | primary brand / CTAs / active |
| paprika | `#C4452A` | accent / badges / destructive |
| saffron | `#E8B87A` | secondary accent / icons / meta |
| parchment | `#F7F0E6` | light text on dark |
| surface | `#2A1218` | cards / elevated surfaces |
| muted | `#4A2830` | borders / dividers / input bg |

Fonts: **Cormorant Garamond** (display/headings), **DM Sans** (body/UI), **JetBrains Mono** (cook times, counts, meta). Radii: `card` 20px, `chip` 12px, `pill` 50px. Patterns: dark-first, spring micro-interactions + haptics on every interactive element, bottom sheets slide up, empty states always have an illustration + CTA, Pro features show a blurred/locked preview (never a hard block).

---

## Backend architecture

**Auth → DB trust chain:** Clerk issues a JWT from a template named `supabase` (claims include `user_id: {{user.id}}`). The client's *direct* Supabase requests carry that JWT (`hooks/useSupabaseClient.ts` → `lib/supabase/client.ts`). Postgres RLS reads `auth.jwt() ->> 'user_id'`, maps it to `public.users.id` via `current_user_id()`, and gates every row. `public.users` is populated by the **clerk-webhook** Edge Function — until a user signs up (firing `user.created`), their tables return empty.

**Two-token model (important):** there are two distinct token uses — don't mix them up.
- **Direct DB access** (PostgREST + RLS): preferred token is the **HS256 `supabase` template** (`getToken({ template: 'supabase' })`), verified by Postgres via the shared legacy JWT secret; user id is the `user_id` claim. Since migration **`0005_auth_claim_compat.sql`**, RLS resolves the user from `coalesce(user_id, sub)`, and `useSupabaseClient` **falls back to the default Clerk session token** when the template returns null — that fallback authenticates only if Clerk is registered as a **Third-Party Auth provider** in the Supabase dashboard (see README → "Clerk ↔ Supabase auth"). If no token is available at all, the hook logs loudly; an anon request makes RLS silently return zero rows (the classic "imports work but the feed/detail screen is empty / Recipe not found (no rows returned)" symptom — the importers write via service role, bypassing RLS, so writes succeeding proves nothing about the read path).
- **Edge Functions** (`import-url`, future importers): the **default Clerk session token** (`getToken()`), verified against Clerk's **JWKS** (`CLERK_JWKS_URL`); user id is the standard `sub` claim. Edge Functions then act via the service role, so they never need the template token. The template (HS256) deliberately does **not** verify against JWKS.

**Mutation rule:** the client never writes to the DB with the anon key for sensitive paths — imports, AI, payments, and user provisioning all go through Edge Functions using the **service role key** (auto-injected, bypasses RLS). The OpenRouter / Razorpay / webhook secrets live **only** in Edge Function env vars.

### Database schema (`0001_initial_schema.sql`, repriced by `0003_pricing_model.sql`; `0004_storage_buckets.sql` adds the private `recipe-images` Storage bucket)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Mirror of Clerk identities | `clerk_user_id` (join key, unique), `email`, `display_name`, `avatar_url` |
| `recipes` | Owned per user | `user_id`, `title`, `ingredients` jsonb, `steps` jsonb, `cook_time_minutes`, `prep_time_minutes`, `servings`, `tags` text[], `image_url`, `storage_path`, `source_type` (`url`/`youtube`/`manual`), `source_url`, `ai_summary` |
| `collections` | Recipe folders | `user_id`, `name`, `cover_image_url` |
| `collection_recipes` | M2M join | PK `(collection_id, recipe_id)` |
| `shopping_list_items` | Per-user list | `user_id`, `recipe_id` (nullable, on-delete set null), `ingredient`, `quantity`, `is_checked` |
| `entitlements` *(was `subscriptions`, renamed in `0003`)* | One per user — plan + consumable balances | `user_id` unique, `plan` (`free`/`lifetime`), `recipe_count` (saved-recipe gate), `youtube_credits`, `ai_credits`, `youtube_imports_this_month` + `youtube_month_anchor` (monthly YT meter), `lifetime_purchased_at`, `razorpay_customer_id` |
| `payments` *(new in `0003`)* | One row per Razorpay Order | `user_id`, `razorpay_order_id` (unique), `razorpay_payment_id`, `product` (`lifetime`/`yt_credits`/`ai_credits`), `amount_paise`, `status` (`created`/`paid`/`failed`) |

Triggers: `set_updated_at()` on users/recipes/collections/entitlements/payments; `create_default_subscription()` (kept name; now seeds an `entitlements` row `plan='free'`, zeroed credits) auto-fires on user insert. RLS: full CRUD gated on `current_user_id()` per table; `users` self-only by `clerk_user_id`; `entitlements` + `payments` are SELECT-only for the owner (all writes via service role). **Credit mutators `deduct_ai_credits()` / `add_credits()` are service-role-ONLY** (execute revoked from `public`/`anon`/`authenticated`) so a client JWT can't mint itself credits.

### Edge Functions (`supabase/functions/`)

| Function | Auth | Does | Deploy |
|---|---|---|---|
| `clerk-webhook` | Svix signature (`--no-verify-jwt`) | `user.created/updated` → upsert `public.users`; `user.deleted` → delete (cascades) | `supabase functions deploy clerk-webhook --no-verify-jwt` |
| `import-url` | Clerk session token via JWKS (`sub`) | auth → `enforceUrlGate` (free 15-recipe cap; lifetime unlimited) → fetch page → strip HTML → `callOpenRouter` → `refineTags` → `insertRecipe` (`source_type='url'`) → `incrementRecipeCount` → best-effort `uploadRecipeImageFromUrl` → set `storage_path` | `supabase functions deploy import-url --no-verify-jwt` |
| `import-youtube` | Clerk session token via JWKS (`sub`) | auth → `enforceYouTubeGate` (monthly meter 3 free / 20 lifetime, then `youtube_credits`) → `fetchYouTubeTranscript` (Supadata) → oEmbed → `callOpenRouter` → `refineTags` → `insertRecipe` → `consumeYouTubeImport` (advances monthly counter + recipe_count; spends a credit only if over allowance) → best-effort `uploadRecipeImageFromUrl` → set `storage_path` | `supabase functions deploy import-youtube --no-verify-jwt` |
| `ai-summarise` | Clerk session token via JWKS (`sub`) | auth → load recipe (404 missing / 403 not owner) → `callOpenRouter` (text; Gemini Flash primary, 70B fallback) → update `recipes.ai_summary` → return `{summary}` | `supabase functions deploy ai-summarise --no-verify-jwt` |
| `ai-nutrition` | Clerk session token via JWKS (`sub`) | validate image → auth → **`enforceAiCredits` (≥2; lifetime NOT exempt)** → `callOpenRouter` (vision) → parse/normalise macros → **`deductAiCredits` (2, atomic)** on success → return estimate + `creditsRemaining` (no recipe write) | `supabase functions deploy ai-nutrition --no-verify-jwt` |
| `razorpay-create-order` | Clerk session token via JWKS (`sub`) | POST `{product:'lifetime'\|'yt_credits'\|'ai_credits'}` → auth → ensure Razorpay customer (best-effort) → `createOrder` (server-fixed paise 49900/4900/9900) → insert `payments` row `status='created'` → return `{orderId, amount, currency, keyId}` for Checkout | `supabase functions deploy razorpay-create-order --no-verify-jwt` |
| `razorpay-webhook` | Razorpay HMAC signature (`--no-verify-jwt`) | read raw body → `await verifyWebhookSignature` (401 if bad) → on `payment.captured` find `payments` by `razorpay_order_id`, mark `paid`, grant by product (lifetime→`plan='lifetime'`; yt_credits→+10; ai_credits→+50); `payment.failed`→`failed`. Idempotent (already-`paid` → 200 no-op) | `supabase functions deploy razorpay-webhook --no-verify-jwt` |
| `get-recipe-image` | Clerk session token via JWKS (`sub`) | POST `{recipeId}` → auth → load recipe (404 missing / 403 not owner) → if `storage_path`: `createSignedUrl` (TTL 1h, service role) → `{url, source:'storage'}`; else if `image_url`: `{url, source:'origin'}`; else 404 `no_image` | `supabase functions deploy get-recipe-image --no-verify-jwt` |

**Shared modules (`_shared/`)** — imported by the functions above, never deployed alone:
`cors.ts` (CORS headers) · `http.ts` (`HttpError`, `json`, `errorResponse`) · `auth.ts` (Clerk JWKS verify + user resolve) · `gating.ts` (entitlement gates: `enforceUrlGate`/`incrementRecipeCount`, `enforceYouTubeGate`/`consumeYouTubeImport`, `enforceAiCredits`/`deductAiCredits`) · `recipes.ts` (`insertRecipe`) · `tagging.ts` (`refineTags`, best-effort) · `transcript.ts` (`fetchYouTubeTranscript` via Supadata) · `openrouter.ts` (`callOpenRouter<T>` + `RecipeJSON` + extraction prompt) · `razorpay.ts` (`createCustomer`, `createOrder`, `verifyWebhookSignature`, `RazorpayError`) · `storage.ts` (`uploadRecipeImageFromUrl`, best-effort).

**Import-function flow & error model:** both importers share the shape — `authenticateRequest` → gate (`enforceUrlGate` / `enforceYouTubeGate`) → (source-specific fetch) → `callOpenRouter<RecipeJSON>` → `refineTags` (best-effort) → `insertRecipe` → consume (`incrementRecipeCount` / `consumeYouTubeImport`). Shared helpers signal failures by **throwing `HttpError(status, body)`**; the handler's outer `catch` runs `errorResponse(err, TAG)`. Statuses: `400` bad input · `401` unauth/unprovisioned · `402` limit (`{reason:'recipe_limit'|'youtube_limit'|'no_ai_credits'}`) · `422` source-not-usable / extraction failure · `500` DB/unexpected.

**Deploy with `--no-verify-jwt`** (like `clerk-webhook`): the functions self-verify the caller via JWKS, so Supabase's gateway must not pre-reject the non-Supabase Clerk token.

**⚠️ The Clerk token goes in an `X-Clerk-Token` header, NOT `Authorization`.** This project uses Supabase's new asymmetric JWT signing keys: the edge gateway verifies *any* `Authorization`-bearer JWT against its own keys and rejects a Clerk-signed token with `UNAUTHORIZED_ASYMMETRIC_JWT` **before the function runs** — even with "Verify JWT with legacy secret" toggled OFF. So `lib/api/import.ts` sends the anon publishable key as `apikey` (gets through the gateway) and the Clerk **default** `getToken()` (no template) as `X-Clerk-Token`; `_shared/auth.ts#getBearerToken` reads `X-Clerk-Token` first (falling back to `Authorization` for curl testing).

---

## Environment & secrets

**Client (`.env.local`, gitignored, also mirrored to `app.json` → `extra` for EAS):**
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Edge Function secrets (`supabase secrets set ...`, server-only):**
- `CLERK_WEBHOOK_SECRET`, `CLERK_JWKS_URL`
- `OPENROUTER_API_KEY`, `OPENROUTER_REFERER`
- `SUPADATA_API_KEY` (YouTube transcript provider — used by `import-youtube`)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (no per-plan vars — the one-time Orders model carries fixed amounts in `razorpay-create-order`, so `RAZORPAY_PLAN_MONTHLY`/`RAZORPAY_PLAN_YEARLY` are **gone**)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** — never set or commit the service role key.

---

## Backend build status (track against `backend-roadmap.md`)

| Phase | Step | Feature | Status |
|---|---|---|---|
| 1 Auth | 1 | Clerk provider + token cache | ✅ done |
| 1 Auth | 2 | Sign-in / sign-up / verify screens | ✅ done |
| 1 Auth | 3 | Protected routes + splash gating | ✅ done |
| 1 Auth | 4 | Clerk → Supabase JWT bridge | ✅ done |
| 2 DB | 5 | Initial schema migration | ✅ done (⚠ apply pending) |
| 2 DB | 6 | RLS policies | ✅ done (⚠ apply pending) |
| 2 DB | 7 | Clerk webhook → upsert user | ✅ done (⚠ deploy pending) |
| 3 Import | 8 | OpenRouter shared client | ✅ done |
| 3 Import | 9 | URL scraper Edge Function | ✅ done (⚠ redeploy for auth fix) |
| 3 Import | 10 | YouTube transcript fn + shared `auth.ts`/`gating.ts`/`http.ts`/`recipes.ts`; import-url refactored onto them | ✅ done |
| 3 Import | 11 | Client import hook (`lib/api/import.ts`, `hooks/useImportRecipe.ts`, TanStack Query) | ✅ done |
| 4 AI | 12 | Recipe summarisation fn (`ai-summarise`) | ✅ done; **now client-wired** (`lib/api/summarise.ts`, `useRecipeSummary`, detail-screen button) (⚠ deploy `ai-summarise --no-verify-jwt`) |
| 4 AI | 13 | Smart auto-tagging (`_shared/tagging.ts`, hook into imports) | ✅ done (⚠ redeploy imports pending) |
| 4 AI | 14 | Dish-photo → nutrition fn + hook (`ai-nutrition`; **now AI-credit gated, 2/scan**) | ✅ done (⚠ deploy pending) |
| 5 Pay | — | **Pricing migration `0003_pricing_model.sql`** (subscriptions→entitlements, `payments` table, credit RPCs, gating rewrite) | ✅ **applied & live** |
| 5 Pay | 15 | Razorpay **create-order** fn + `_shared/razorpay.ts` (one-time Orders, repurposed from create-subscription) | ✅ deployed & verified |
| 5 Pay | 16 | Razorpay **webhook** (`razorpay-webhook`) + entitlement grants + gating sync | ✅ deployed; yt_credits captured-grant verified end-to-end (lifetime/ai_credits branches deployed, not yet exercised) |
| 5 Pay | 17 | Client checkout + paywall (`lib/api/billing.ts`, `hooks/useEntitlements.ts`, `PaywallProvider`/`PaywallSheet`/`RazorpayCheckoutWebView`; `profile`/`shopping` rewired) | ✅ deployed; `react-native-webview` installed; yt_credits purchase verified on device (Expo Go) |
| 6 Storage | 18 | Storage bucket + signed URLs (`0004_storage_buckets.sql`, `_shared/storage.ts`, `get-recipe-image`) | ✅ done; `0004` applied / bucket live (⚠ confirm `get-recipe-image --no-verify-jwt` deployed) |
| 6 Storage | 19 | Wire image upload into imports (`uploadRecipeImageFromUrl` → `storage_path` in both importers) | ✅ done & verified (`storage_path` populated on a real import) |
| 6 Storage | 20 | Client image resolver + recipe screens on real data (`lib/api/storage.ts`/`summarise.ts`, `lib/recipes/uiRecipe.ts`, `useRecipe`/`useRecipes`/`useRecipeImage`/`useRecipeSummary`; home/detail/cook converted; **+ bundled ai-summarise wiring**) | ✅ done (⚠ deploy `get-recipe-image` + `ai-summarise` for image/summary to work) |

**Phases 1–6 are code-complete; the full backend roadmap (Steps 1–20) is built.** Phase 5 is LIVE: migration `0003_pricing_model.sql` **applied**, all entitlement functions **redeployed** (`--no-verify-jwt`), Razorpay secrets set + webhook registered, `react-native-webview` installed, and a **YouTube-credits purchase verified end-to-end**. Phase 6 Storage: `0004` applied (bucket live) and a real import was **verified to populate `storage_path`**. The **recipe screens now run on real data** — home feed, recipe detail (signed-URL hero + AI-summary card), and cook mode read the user's actual recipes via `useRecipes`/`useRecipe`. Also live from earlier: migrations `0001`+`0002`, the Clerk `supabase` JWT template, `clerk-webhook`.

**⚠ Two functions still need deploying for the new UI to fully work:** `get-recipe-image --no-verify-jwt` (so `useRecipeImage` resolves signed URLs; until then the hero falls back to origin `image_url`) and `ai-summarise --no-verify-jwt` (so the detail-screen "Generate summary" button works).

**Not yet exercised (deployed, same proven plumbing):** the Lifetime (`plan='lifetime'`) and AI-credit (`+50`) webhook branches, and gating *enforcement* (15-recipe cap, monthly YT rollover/credit fallback, 2-credit AI deduction). Worth a smoke test but not blocking.

**Still mock / partially wired:**
- **Search** (`(tabs)/search.tsx`) and **collections** (`(tabs)/collections.tsx`, `collections/[id].tsx`) still read `constants/mockData.ts`. Collections is a genuinely separate feature (its own `collections`/`collection_recipes` tables + CRUD, none wired yet). Search's filters key off `cuisine`/`difficulty`, which the DB doesn't store. Both are deferred follow-ups. Because the detail/cook screens **fall back to mock** for non-UUID ids, navigating into a recipe from these still-mock screens keeps working.
- **Recipe cards render the origin `image_url`** (not per-card signed URLs — that would fire one `get-recipe-image` call per card per feed render). The resilient signed-URL path is used on the **detail hero** only (`useRecipeImage`).
- `ai-nutrition` still has **no screen** (the camera/resize UI is a later task; `useNutritionAnalysis` exists).
- Profile **identity** strings (`"Chef Kavin"`, hardcoded email) are still mock — hydrate from `useUser()`.
- Two recipe shapes coexist: API `RecipeRow` (snake_case, DB) → normalised to **`UiRecipe`** via `lib/recipes/uiRecipe.ts` (which also adapts the legacy mock `Recipe`); screens consume `UiRecipe`.

The backend roadmap (Steps 1–20) is complete — remaining work is product polish (search/collections on real data, nutrition camera UI, profile identity) plus deploying `get-recipe-image` + `ai-summarise`.

---

## Conventions & guardrails

- **Design tokens, not literals** — import `Colors`/`Fonts`; use Tailwind tokens. Match the editorial Midnight Spice style of existing screens.
- **Mock data** — the **home feed, recipe detail, and cook mode now run on real data** (`useRecipes`/`useRecipe` → RLS), as does the Import tab (`useImportRecipe`). Still on `constants/mockData.ts`: **search** and **collections** (`getRecipeById`/`getRecipesForCollection`/`RECIPES`/`COLLECTIONS` are now only consumed there + as the detail/cook **fallback** for non-UUID ids). Don't re-point detail/cook back at mock. Two recipe shapes: API `RecipeRow` (snake_case, DB) and the legacy mock `Recipe` (camelCase) both normalise to **`UiRecipe`** via `lib/recipes/uiRecipe.ts` — screens consume `UiRecipe`, never the raw shapes.
- **Edge Function style** (match `import-url` / `import-youtube`): `Deno.serve`, URL imports (esm.sh for `@supabase/supabase-js@2`, deno.land for `jose`), handle `OPTIONS` preflight + spread `corsHeaders` on every response. Reuse the `_shared/` helpers (`authenticateRequest`, the `gating.ts` gates, `insertRecipe`, `callOpenRouter`, `createOrder`/`verifyWebhookSignature`) rather than re-implementing. Signal errors by **throwing `HttpError(status, body)`**; wrap the body in `try { … } catch (err) { return errorResponse(err, TAG); }`. `console.error` with a `[fn-name]` prefix. (`clerk-webhook` predates this pattern and keeps its own local `json` helper — leave it unless you're touching it.)
- **Security (always):** OpenRouter/Razorpay/service-role keys server-side only; all data mutations through Edge Functions; **no TikTok/Instagram import backend** (frontend stubs only).
- **Webhooks:** read the raw request body as text *before* parsing (signature is over raw bytes); deploy with `--no-verify-jwt`.
- **Animations:** Reanimated shared values + `withSpring`/`withTiming`; haptics on press; bottom sheets slide up.

## Known stubs / gotchas

- Profile identity strings (`"Chef Kavin"`, hardcoded email) are mock — to be hydrated from `useUser()`.
- The old `isPro` stubs on `profile.tsx` / `shopping.tsx` are **now wired** to `useEntitlements().isLifetime`; the usage meter reads real `recipe_count`/15 and the upgrade CTAs call `showPaywall()`. Profile **identity** strings (`"Chef Kavin"`, hardcoded email) are still mock — hydrate from `useUser()` later.
- Supabase Storage: **Steps 18–20 code-complete** — private `recipe-images` bucket (`0004`, applied), `_shared/storage.ts` uploader, `get-recipe-image` (signed-URL/origin fallback), both importers copy the image into the bucket + set `storage_path` (best-effort, verified populated), and the client resolver (`lib/api/storage.ts` + `useRecipeImage`) is wired into the recipe-detail hero. **Deploy `get-recipe-image --no-verify-jwt`** for signed URLs to resolve (else hero uses origin `image_url`). Recipes imported before Step 19 keep `storage_path` null → `source:'origin'`.
- AI summary: `ai-summarise` is now **client-wired** (`lib/api/summarise.ts` + `useRecipeSummary` + the detail-screen "Generate summary" button, shown only for real recipes). **Deploy `ai-summarise --no-verify-jwt`** for the button to work; the result persists to `recipes.ai_summary` and shows on the card. Razorpay payments are **code-complete + live** (Steps 15–17).
- **`react-native-webview` is a hard prerequisite** for the paywall — `RazorpayCheckoutWebView` imports it and `PaywallProvider` is always mounted, so Metro won't bundle until you run `npx expo install react-native-webview`.
- **Razorpay Orders do NOT accept `customer_id`** (the customer is attached by Checkout at pay time) — `razorpay-create-order` keeps a best-effort `createCustomer` (stores `razorpay_customer_id`) but never passes `customer_id` to `createOrder` (Razorpay would 400). The entitlement grant is **server-side only** via `razorpay-webhook` on `payment.captured` (keyed off the `payments` row by `razorpay_order_id`); the client just refetches `['entitlements']`. `verifyWebhookSignature` is **async** (Web Crypto) — the webhook `await`s it.
- **Credit RPCs (`deduct_ai_credits`, `add_credits`) are service-role-only** (execute revoked from `public`/`anon`/`authenticated`). Never call them from the client; never grant credits outside the webhook / gating path, or a user could mint their own.
- Deno isn't installed locally → Edge Functions can't be type-checked on this machine.
- `_shared/auth.ts` builds its Clerk JWKS lazily so a missing `CLERK_JWKS_URL` returns a clean 401 instead of a cold-start crash. **`CLERK_JWKS_URL` must be the FULL url** (`https://<domain>/.well-known/jwks.json`) — Clerk's dashboard only shows the bare domain; the bare value breaks `new URL()` and the issuer check.
- **YouTube transcripts go through Supadata** (`_shared/transcript.ts`), not direct scraping — YouTube IP-blocks datacenter (edge) IPs. Needs `SUPADATA_API_KEY`. The original `youtube-transcript` esm.sh lib was removed for this reason.
- **Hard-won auth lessons** (don't regress): import functions deploy `--no-verify-jwt`; the client sends the Clerk token in `X-Clerk-Token` + the anon key in `apikey` (NOT `Authorization` — Supabase's gateway rejects an asymmetric Clerk JWT there with `UNAUTHORIZED_ASYMMETRIC_JWT`). Client→function changes need a **full app reload** (Fast Refresh doesn't always pick up `lib/api/*` module changes).
- **OpenRouter model slugs go stale.** `google/gemini-flash-1.5` was retired and started returning `404 "No endpoints found"`, which broke extraction (it's the shared fallback) — replaced with `google/gemini-2.5-flash` everywhere (2026-06-09). If AI calls 404 with that message, check the slug against `GET https://openrouter.ai/api/v1/models`. `callOpenRouter` now logs `[openrouter] primary model "<x>" failed; retrying with "<y>"` so a fallback error can't mask the primary's cause, and its JSON parse is tolerant of fenced/wrapped replies.
```
