# Rasoi — Agent Guide

> **Read this first.** This is the navigation & architecture reference for the Rasoi codebase, written so a fresh agent (new chat, no prior context) can understand the project and find any file fast. Keep it up to date when structure changes.

**Rasoi** is a premium, AI-powered recipe app: import recipes from a URL or YouTube video, the backend scrapes + runs the content through an LLM to extract structured recipe data, and users save / organise / cook them with step-by-step guidance and timers. Monetization (repriced in `0003`): **Free** = 15 saved recipes + unlimited URL imports + 3 monthly credits; **Lifetime Unlock** = one-time ₹499 (unlimited saves, 20 monthly credits); plus a consumable **credit pack** (₹49/10). **One shared credit pool** meters every paid action: a captioned YouTube import = 1 credit, a dish-photo calorie scan = 1. Spend draws the monthly allowance first, then purchased credits; metered for everyone, lifetime included. (The old ₹99/50 "AI-scan credits" pack and the standalone AI-summary feature were **removed**; the `ai_credits` column + `deduct_ai_credits` RPC remain in the DB as dead, unused legacy.)

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
| Storage | Supabase Storage | Private `recipe-images` bucket; service-role uploads + signed-URL reads (`get-recipe-image`). Phase 6 Steps 18–20 built — importers store images, `useRecipeImage` resolves the detail hero |
| Serverless API | Supabase Edge Functions (Deno) | All mutations/AI go through these |
| AI | OpenRouter | default `google/gemini-2.5-flash` (fast structured extraction), fallback `meta-llama/llama-3.3-70b-instruct` |
| Payments | **Google Play Billing** (`expo-iap`) | One-time in-app products — ₹499 Lifetime Unlock (non-consumable) + ₹49 credit pack (consumable). Native Play sheet → server verifies `purchaseToken` via the Google Play Developer API. (Razorpay removed.) Needs a dev/EAS build — not Expo Go |
| Import sources | URL scraper (Supadata fallback) · YouTube (transcriptapi.com) · photo OCR | **No social-video imports** — Instagram was removed 2026-06-17; TikTok never had a backend |
| Share intent | `expo-share-intent` (**Android only**) | "Share → Rasoi" from YouTube (or any app sharing a link) → auto-imports. iOS disabled (`disableIOS`); `androidIntentFilters: ["text/*"]`. **Needs a native rebuild** (not Expo Go). See `components/ShareIntentRouter.tsx` |

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
│   ├── _layout.tsx                   # ROOT: fonts, ShareIntentProvider + ClerkProvider + QueryClientProvider + PlayBillingProvider + PaywallProvider, splash gating, useProtectedRoute, Stack of route groups; mounts <ShareIntentRouter/>
│   ├── index.tsx                     # ENTRY GATE at `/`: owns the first redirect — signed-in → (tabs); never-onboarded → (onboarding)/welcome; onboarded + signed-out → (auth)/sign-in. Renders null (splash held) until BOTH Clerk session + the stored onboarding flag resolve
│   ├── (onboarding)/
│   │   └── welcome.tsx               # 3-slide horizontal pager → markOnboardingComplete() (persists the flag) → (auth)/sign-in
│   ├── (auth)/
│   │   ├── _layout.tsx               # Stack, headerShown:false, noir bg, fade
│   │   ├── sign-in.tsx               # useSignIn() email+password (+ email-code 2FA when the user has it) → setActive → (tabs)
│   │   ├── sign-up.tsx               # useSignUp() name+email+password → prepareEmailAddressVerification → verify
│   │   └── verify.tsx                # 6-digit OTP → attemptEmailAddressVerification → setActive → (tabs)
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Bottom tab bar (5 tabs, Import centre raised); gated on useAuth()
│   │   ├── index.tsx                 # Home feed — REAL data via useRecipes; ONE virtualized FlatList (numColumns=2; header = greeting + recently-imported + banner + browse); per-card 3-dot menu (RecipeActionsSheet); skeletons + empty state
│   │   ├── search.tsx                # Search + filter panel (cuisine/dietary/cook-time chips)
│   │   ├── import.tsx                # HERO screen: URL input → useImportRecipe (REAL backend import); idle/loading/success sheet. Free users see a RecipeLimitBanner (X/15; at-cap = tappable lock → recipe_limit paywall) above the input. Scan-a-Photo opens a branded ScanPhotoSheet (camera/library). Also auto-imports a `sharedUrl` route param (from a "Share → Rasoi" intent)
│   │   ├── collections.tsx           # 2-col collection grid, FAB + new-collection sheet (BottomSheet)
│   │   └── profile.tsx               # Avatar (real, useUser), plan/usage, settings sections (Features → nutrition scanner), Sign Out (useAuth().signOut)
│   ├── recipe/[id].tsx               # Recipe detail — REAL via useRecipe (mock fallback); useRecipeImage hero; null-safe meta + string-qty scaling; trash → themed ConfirmDialog → useDeleteRecipe
│   ├── cook/[id].tsx                 # Cook mode — REAL via useRecipe (mock fallback); per-step ingredient callout/timers shown only when present (mock); Gesture.Pan step swipe
│   ├── collections/[id].tsx          # Collection drill-down: recipe grid + ⋯ actions sheet (BottomSheet: add recipes / delete collection → ConfirmDialog)
│   └── nutrition.tsx                 # Calorie scanner (stack route, entry from Profile → Features): camera/library photo → useNutritionAnalysis → macro card; 1 credit from the shared pool
│
├── components/                       # reusable UI components (all use Colors + Fonts tokens)
│   ├── RecipeCard.tsx                # Image + title + cook-time pill; corner action = 3-dot menu (onMenuPress) OR save/remove bookmark (onSavePress, used by collection screen); expo-image memory-disk cache + recyclingKey (recycle-safe in virtualized lists); spring press
│   ├── BottomSheet.tsx               # REUSABLE bottom sheet: owns slide-in/out + fading scrim; grab handle that can be TAPPED or SWIPED DOWN to dismiss (DISMISS_FRACTION/DISMISS_VELOCITY knobs); gesture on handle only so inner ScrollView/FlatList still scroll; `avoidKeyboard` prop; nests its own GestureHandlerRootView (needed for gestures inside a RN Modal on Android). Used by RecipeActionsSheet, PaywallSheet, collections (new-collection + ⋯ menu + add-recipes picker)
│   ├── ConfirmDialog.tsx             # REUSABLE themed confirm dialog (replaces native Alert.alert): centered card, danger/icon badge, busy spinner; props title/message/icon/confirmLabel/destructive/busy/onConfirm/onCancel. Used for delete recipe / delete collection / remove-from-collection
│   ├── RecipeActionsSheet.tsx        # Per-recipe sheet (home cards' 3-dot menu), built on BottomSheet: Add to collection (pick existing or inline-create) + Delete recipe (→ ConfirmDialog → useDeleteRecipe)
│   ├── SkeletonCard.tsx              # Loading placeholder matching RecipeCard dims
│   ├── TagChip.tsx                   # Badge: variants default|active|dietary|cuisine
│   ├── IngredientRow.tsx             # Checkbox + qty + name; animated strikethrough
│   ├── TimerWidget.tsx               # SVG circular countdown ring (stateless; parent owns time)
│   ├── StepCard.tsx                  # Step number + instruction + optional embedded TimerWidget
│   ├── ImportSourceButton.tsx        # Large tappable source card (icon + label)
│   ├── CollectionCard.tsx            # 2×2 image collage + name + recipe count
│   ├── ProBadge.tsx                  # variants inline|lock|banner for Pro gating
│   ├── PaywallProvider.tsx           # Context (showPaywall(product?, reason?)/hidePaywall) + mounts the shared PaywallSheet; mounted in app/_layout.tsx. `PaywallReason` = recipe_limit | out_of_credits | upgrade
│   ├── PaywallSheet.tsx              # Bottom-sheet paywall, REASON-AWARE: recipe_limit → "Recipe limit reached" + Lifetime only + delete-to-free-space hint (credit top-up HIDDEN); out_of_credits → top-up + Lifetime; upgrade → full sheet. Buys via usePlayBilling().buy() (native Play sheet); shows store displayPrice; auto-closes on grant
│   ├── PlayBillingProvider.tsx       # Root-level Google Play Billing (expo-iap useIAP): connection, product fetch, buy(), purchase listener → verifyPlayPurchase → grant → finishTransaction (ack/consume); reconciles unfinished purchases on launch. usePlayBilling() context; wraps PaywallProvider in _layout
│   └── ShareIntentRouter.tsx         # Bridges an Android "Share → Rasoi" (expo-share-intent useShareIntentContext) into the import flow: when signed in, router.push to /(tabs)/import with the shared URL (sharedUrl+sharedAt params) then resetShareIntent(); holds the share through sign-in. Renders null
│
├── constants/
│   ├── colors.ts                     # Colors (Midnight Spice palette) + ColorKey type
│   ├── fonts.ts                      # Fonts (Google Font family ids) + FontKey type
│   └── mockData.ts                   # Recipe/Ingredient/Step/Collection types + RECIPES, COLLECTIONS + helpers
│
├── hooks/
│   ├── useImportRecipe.ts            # TanStack Query mutation: import a recipe (auto-routes url/youtube), invalidates ['recipes']
│   ├── useNutritionAnalysis.ts       # TanStack Query mutation: dish photo → ai-nutrition (macros estimate); stateless
│   ├── useRecipes.ts                 # TanStack query: user's recipes (RLS), newest first → RecipeRow[]; key ['recipes', userId]. Also useDeleteRecipe (→ delete-recipe fn; invalidates recipes/entitlements/collections)
│   ├── useRecipe.ts                  # TanStack query: one recipe by id (RLS); disabled for non-UUID (mock) ids → caller falls back to mock
│   ├── useRecipeImage.ts             # Resolves a recipe image via get-recipe-image (signed URL / origin); key ['recipe-image', id], staleTime 50m
│   ├── useEntitlements.ts            # Reads entitlements row (RLS) → {plan, isLifetime, recipeCount, atRecipeLimit, youtubeRemaining, showPaywall}
│   ├── useCollections.ts             # Collections CRUD via RLS-scoped client: useCollections/useCollection + create/delete/add-recipe/remove-recipe mutations
│   ├── useProtectedRoute.ts          # Clerk session → redirect between (auth) and (tabs); public = (auth)+(onboarding)
│   └── useSupabaseClient.ts          # Memoised Supabase client carrying Clerk JWT (template "supabase"), keyed on userId
│
├── lib/
│   ├── api/import.ts                 # importFromUrl/YouTube/Photo/importRecipe (auto-route) + deleteRecipe → Edge Functions; isYouTubeUrl + unsupportedSource (IG/TikTok → "not supported"); FreemiumLimitError, ImportError, RecipeRow
│   ├── api/nutrition.ts              # analyzeDishPhoto(image, note) → ai-nutrition; NutritionError, NutritionResult/NutritionItem
│   ├── api/billing.ts                # verifyPlayPurchase({productId,purchaseToken}) → play-verify-purchase; Product, PLAY_PRODUCT_IDS, PRODUCT_BY_PLAY_ID, IS_CONSUMABLE, BillingError
│   ├── api/storage.ts                # getRecipeImageUrl(recipeId) → get-recipe-image ({url, source}); RecipeImageError
│   ├── recipes/uiRecipe.ts           # UiRecipe shape + rowToUiRecipe / mockToUiRecipe adapters + parseQuantity + isUuid
│   ├── onboarding.ts                 # hasCompletedOnboarding() / markOnboardingComplete() — device-level "seen the slides" flag in expo-secure-store (survives sign-out, resets on reinstall); read by app/index.tsx, written by (onboarding)/welcome.tsx
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
│   │   │   ├── gating.ts             # entitlement gates: enforceUrlGate/incrementRecipeCount (saved-recipe cap), decrementRecipeCount (on delete), enforceCreditGate/consumeCredits (shared credit pool: YT 1 / IG 2 / scan 1; consumeCredits opt incrementRecipe)
│   │   │   ├── recipes.ts            # insertRecipe (RecipeJSON → recipes row) — shared by all importers; sanitizes ingredients/steps + GUARDS empty extraction (no title, or no ingredients & no steps) → 422 no_recipe_found (never inserts a null title)
│   │   │   ├── tagging.ts            # refineTags (light model proposes category tags; merges with existing, best-effort) — url/youtube now call it via finalize.ts (background)
│   │   │   ├── finalize.ts           # finalizeRecipeInBackground: tag-refine + image copy AFTER response via EdgeRuntime.waitUntil (off the user's critical path)
│   │   │   ├── timing.ts             # StepTimer: ⏱ per-step + TOTAL console logs (cold-start vs fetch/Supadata vs OpenRouter)
│   │   │   ├── transcript.ts         # fetchYouTubeTranscript (transcriptapi.com) + scrapeWebPage (Supadata /web/scrape, residential-proxy fallback for blocked blogs); AbortController timeouts
│   │   │   ├── openrouter.ts         # callOpenRouter<T> (text + vision via images[]), OpenRouterError, RecipeJSON, RECIPE_EXTRACTION_SYSTEM_PROMPT; primary gemini-2.5-flash, fallback llama-3.3-70b
│   │   │   ├── googleplay.ts         # Google Play Developer API: service-account JWT (jose RS256) → cached OAuth token → getProductPurchase(productId, token); PlayApiError
│   │   │   └── storage.ts            # uploadRecipeImageFromUrl (best-effort: remote image → private bucket <userId>/<recipeId>.<ext>; null on any failure)
│   │   ├── clerk-webhook/index.ts    # Svix-verified Clerk webhook → upsert/delete public.users (service role)
│   │   ├── import-url/index.ts       # POST {url}: auth → gate → direct fetch (free) → strip HTML → [fallback: Supadata /web/scrape if blocked/thin] → OpenRouter → insertRecipe → store image (storage_path)
│   │   ├── import-youtube/index.ts   # POST {url}: auth → gate → transcript → oEmbed → OpenRouter → insertRecipe → store image (storage_path)
│   │   ├── import-photo/index.ts      # POST {image}: auth → enforceUrlGate → OpenRouter (vision/OCR) → parse recipe → insertRecipe (source_type='manual') → store photo as image (storage_path + signed image_url)
│   │   ├── ai-nutrition/index.ts     # POST {image, note?}: auth → enforceCreditGate(1) → OpenRouter (vision) → macros JSON → consumeCredits(1, incrementRecipe:false) (no recipe write)
│   │   ├── play-verify-purchase/index.ts         # POST {productId, purchaseToken}: auth → getProductPurchase (Google Play Developer API) → check purchaseState=0 (+ obfuscatedExternalAccountId == userId) → idempotent claim in play_purchases (token PK; 23505 → already) → grant by product (lifetime→plan; yt_credits→add_credits +10)
│   │   ├── get-recipe-image/index.ts # POST {recipeId}: auth → own-check → signed URL if storage_path (TTL 1h) else origin image_url else 404 no_image
│   │   └── delete-recipe/index.ts    # POST {recipeId}: auth → service-role delete scoped to (id,user_id) → decrementRecipeCount → best-effort Storage cleanup; 404 recipe_not_found
│   ├── seed.sql                      # Placeholder (comment-only)
│   └── .temp/                        # Supabase CLI scratch (linked-project ref) — ignore
│
├── app.json                          # Expo config: name Rasoi, scheme rasoi, dark UI, plugins (incl. expo-share-intent — Android text/* share target, disableIOS), extra (env → EAS)
├── babel.config.js                   # babel-preset-expo (jsxImportSource nativewind) + nativewind/babel
├── metro.config.js                   # withNativeWind(config, { input: './global.css' })
├── tailwind.config.js                # Midnight Spice colors, font families, radii (card/chip/pill)
├── global.css                        # @tailwind base/components/utilities
├── tsconfig.json                     # extends expo base, strict
├── package.json                      # name "rasoi"; scripts: start/android/ios
├── .env.local                        # EXPO_PUBLIC_* keys (gitignored) — see Environment below
├── Prompt.md                         # UI design spec (see Companion docs)
├── backend-roadmap.md                # 20-step backend plan (see Companion docs)
└── README.md                         # Setup guide (see Companion docs)
```

**Ignore these duplicate/cruft files** (macOS/iCloud copies, not real source): `.gitignore 2`. Don't edit or import them. (The old `app/(auth)/index 2.tsx` junk file was deleted.)

---

## Routing & navigation map

Route groups `(onboarding)`, `(auth)`, `(tabs)` are declared in `app/_layout.tsx`. `app/index.tsx` (the `/` route) owns the **first** redirect; `useProtectedRoute()` does the ongoing gating thereafter (and deliberately no-ops on `/` so it doesn't race the entry gate). `(auth)` + `(onboarding)` are the only public segments.

```
/ (index gate)       → (tabs) | (onboarding)/welcome | (auth)/sign-in   [first launch routing]
(onboarding)/welcome → (auth)/sign-in                  [Skip / Next → markOnboardingComplete()]
(auth)/sign-in       → (tabs)                           [on success]
(auth)/sign-up       → (auth)/verify → (tabs)
(tabs)/index (home)  → recipe/[id], import, search, collections, profile
(tabs)/search        → recipe/[id], import
(tabs)/import        → recipe/[id]                      [success sheet → Save]
(tabs)/collections   → collections/[id]
collections/[id]     → recipe/[id]
recipe/[id]          → cook/[id]                        [Start Cooking]
(tabs)/profile       → nutrition, (auth)/sign-in        [Features → scanner / Sign Out]
```

Auth flow: cold launch → splash held until **fonts AND Clerk `isLoaded`** → `/` entry gate also waits on the **stored onboarding flag** (`lib/onboarding.ts`), then routes once: signed-in → `/(tabs)`; first-ever launch → `/(onboarding)/welcome`; onboarded-but-signed-out → `/(auth)/sign-in` (no wrong-screen flash). Session persists via `expo-secure-store`; onboarding is shown exactly once per install.

**External entry — share intent (Android):** a "Share → Rasoi" of a link (YouTube, browser, etc.) is captured by `ShareIntentProvider` and handled by `ShareIntentRouter` → `router.push` to `/(tabs)/import` with a `sharedUrl` param, which auto-runs the import. A share that lands while signed-out is held until Clerk resolves, so the link survives the sign-in detour. (Android-only by design; needs a native rebuild.)

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

**Mutation rule:** the client never writes to the DB with the anon key for sensitive paths — imports, AI, payments, and user provisioning all go through Edge Functions using the **service role key** (auto-injected, bypasses RLS). The OpenRouter / Google Play service-account / service-role secrets live **only** in Edge Function env vars.

### Database schema (`0001_initial_schema.sql`, repriced by `0003_pricing_model.sql`; `0004_storage_buckets.sql` adds the private `recipe-images` Storage bucket)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Mirror of Clerk identities | `clerk_user_id` (join key, unique), `email`, `display_name`, `avatar_url` |
| `recipes` | Owned per user | `user_id`, `title`, `ingredients` jsonb, `steps` jsonb, `cook_time_minutes`, `prep_time_minutes`, `servings`, `tags` text[], `image_url`, `storage_path`, `source_type` (`url`/`youtube`/`manual`), `source_url`, `ai_summary` |
| `collections` | Recipe folders | `user_id`, `name`, `cover_image_url` |
| `collection_recipes` | M2M join | PK `(collection_id, recipe_id)` |
| `shopping_list_items` *(legacy — shopping list removed 2026-06-17, table no longer read/written)* | Per-user list | `user_id`, `recipe_id` (nullable, on-delete set null), `ingredient`, `quantity`, `is_checked` |
| `entitlements` *(was `subscriptions`, renamed in `0003`)* | One per user — plan + consumable balances | `user_id` unique, `plan` (`free`/`lifetime`), `recipe_count` (saved-recipe gate), `youtube_credits` (purchased balance of the shared credit pool), `ai_credits` *(legacy, unused)*, `youtube_imports_this_month` + `youtube_month_anchor` (monthly credit meter), `lifetime_purchased_at`, `razorpay_customer_id` *(legacy, unused)* |
| `payments` *(legacy — Razorpay era, `0003`)* | (was) one row per Razorpay Order | left in the DB, **no longer written** after the Google Play switch |
| `play_purchases` *(new in `0006`)* | Idempotency ledger for verified Play purchases | `purchase_token` (PK), `user_id`, `product` (`lifetime`/`yt_credits`), `order_id`, `status`, `created_at`; **service-role-only** (RLS on, no policies) |

Triggers: `set_updated_at()` on users/recipes/collections/entitlements/payments; `create_default_subscription()` (kept name; now seeds an `entitlements` row `plan='free'`, zeroed credits) auto-fires on user insert. RLS: full CRUD gated on `current_user_id()` per table; `users` self-only by `clerk_user_id`; `entitlements` + `payments` are SELECT-only for the owner (all writes via service role). **Credit mutators `deduct_ai_credits()` / `add_credits()` are service-role-ONLY** (execute revoked from `public`/`anon`/`authenticated`) so a client JWT can't mint itself credits.

### Edge Functions (`supabase/functions/`)

| Function | Auth | Does | Deploy |
|---|---|---|---|
| `clerk-webhook` | Svix signature (`--no-verify-jwt`) | `user.created/updated` → upsert `public.users`; `user.deleted` → delete (cascades) | `supabase functions deploy clerk-webhook --no-verify-jwt` |
| `import-url` | Clerk session token via JWKS (`sub`) | auth → `enforceUrlGate` (free 15-recipe cap; lifetime unlimited) → **direct fetch (free, 15s timeout)**, falling back to **`scrapeWebPage`** (Supadata `/web/scrape`, residential proxies + headless browser, 1 Supadata credit, 120s timeout) when the site blocks us (4xx/non-HTML/oversized) or returns <200 chars of text → strip HTML → `callOpenRouter` → `insertRecipe` (`source_type='url'`) → `incrementRecipeCount` → **respond** → `finalizeRecipeInBackground` (tag refine + image copy via `waitUntil`). `StepTimer` logs each step. | `supabase functions deploy import-url --no-verify-jwt` |
| `import-youtube` | Clerk session token via JWKS (`sub`) | auth → `enforceCreditGate(1)` (shared credit pool) → **`Promise.all`(`fetchYouTubeTranscript` (Supadata `mode=native` — captions only, 1 credit; none → `no_transcript`), oEmbed)** → `callOpenRouter` → `insertRecipe` → `consumeCredits` → **respond** → `finalizeRecipeInBackground` (tag refine + image copy via `waitUntil`). `StepTimer` logs each step. | `supabase functions deploy import-youtube --no-verify-jwt` |
| `import-photo` | Clerk session token via JWKS (`sub`) | validate base64 image → auth → `enforceUrlGate` (free 15-recipe cap; lifetime unlimited) → `callOpenRouter` (vision/OCR, text+parse) → `refineTags` → `insertRecipe` (`source_type='manual'`, no URL) → `incrementRecipeCount` → best-effort `storeRecipePhotoFromDataUrl` (upload photo → `storage_path` + long-lived signed `image_url`) | `supabase functions deploy import-photo --no-verify-jwt` |

**Shared credit cost:** `enforceCreditGate(supabase, userId, cost)` takes a `cost` — **1** for a captioned YouTube import or a calorie scan. The monthly allowance (3 free / 20 lifetime) is spent in credits: `consumeCredits` draws from the month's allowance first, then `youtube_credits`; it skips the saved-recipe bump when called with `incrementRecipe:false` (the scan saves no recipe). YouTube fetches captions-only via transcriptapi.com; uncaptioned/foreign YouTube is rejected (`no_transcript`).
| `ai-nutrition` | Clerk session token via JWKS (`sub`) | validate image → auth → **`enforceCreditGate(1)` (shared pool; lifetime NOT exempt)** → `callOpenRouter` (vision) → parse/normalise macros → **`consumeCredits(1, incrementRecipe:false)`** on success → return estimate (no recipe write) | `supabase functions deploy ai-nutrition --no-verify-jwt` |
| `play-verify-purchase` | Clerk session token via JWKS (`sub`) | POST `{productId, purchaseToken}` → auth → `getProductPurchase` (Google Play Developer API, service account) → reject pending (202) / not-purchased (400) / account-mismatch (403) → **idempotent claim** in `play_purchases` (token PK; `23505` → `already`) → grant by product (lifetime→`plan='lifetime'`; yt_credits→`add_credits` +10). Client then calls `finishTransaction` (acknowledge / consume) | `supabase functions deploy play-verify-purchase --no-verify-jwt` |
| `get-recipe-image` | Clerk session token via JWKS (`sub`) | POST `{recipeId}` → auth → load recipe (404 missing / 403 not owner) → if `storage_path`: `createSignedUrl` (TTL 1h, service role) → `{url, source:'storage'}`; else if `image_url`: `{url, source:'origin'}`; else 404 `no_image` | `supabase functions deploy get-recipe-image --no-verify-jwt` |
| `delete-recipe` | Clerk session token via JWKS (`sub`) | POST `{recipeId}` → auth → **service-role delete scoped to `(id, user_id)`** (`.select()` → 404 `recipe_not_found` if not owned/visible) → `decrementRecipeCount` (keeps the saved-recipe gate + profile meter honest; the client can't write `entitlements`) → best-effort Storage cleanup (`storage_path`) → `{id, deleted:true}`. `collection_recipes` rows cascade (FK on delete cascade). | `supabase functions deploy delete-recipe --no-verify-jwt` |

**Shared modules (`_shared/`)** — imported by the functions above, never deployed alone:
`cors.ts` (CORS headers) · `http.ts` (`HttpError`, `json`, `errorResponse`) · `auth.ts` (Clerk JWKS verify + user resolve) · `gating.ts` (entitlement gates: `enforceUrlGate`/`incrementRecipeCount`/`decrementRecipeCount`, `enforceCreditGate`/`consumeCredits`) · `recipes.ts` (`insertRecipe`) · `tagging.ts` (`refineTags`, best-effort) · `finalize.ts` (`finalizeRecipeInBackground` — post-response tag refine + image copy via `EdgeRuntime.waitUntil`) · `timing.ts` (`StepTimer` — per-step latency logs) · `transcript.ts` (`fetchYouTubeTranscript` via transcriptapi.com + `scrapeWebPage` via Supadata) · `openrouter.ts` (`callOpenRouter<T>` + `RecipeJSON` + extraction prompt; gemini-2.5-flash primary) · `googleplay.ts` (`getProductPurchase` via the Google Play Developer API; service-account OAuth, `PlayApiError`) · `storage.ts` (`uploadRecipeImageFromUrl`, best-effort).

**Import-function flow & error model:** the importers share the shape — `authenticateRequest` → gate (`enforceUrlGate` / `enforceCreditGate`) → (source-specific fetch) → `callOpenRouter<RecipeJSON>` → `refineTags` (best-effort) → `insertRecipe` → consume (`incrementRecipeCount` / `consumeCredits`). Shared helpers signal failures by **throwing `HttpError(status, body)`**; the handler's outer `catch` runs `errorResponse(err, TAG)`. Statuses: `400` bad input · `401` unauth/unprovisioned · `402` limit (`{reason:'recipe_limit'|'out_of_credits'}`) · `422` source-not-usable / extraction failure (incl. `no_recipe_found` when the model returns an empty recipe — `insertRecipe` guards this so it never reaches the DB) · `500` DB/unexpected. **`insertRecipe` validates before persisting** because consume/increment run *after* it — so an empty extraction throws 422 and the user is **not** charged a credit / counted toward the cap. NOTE: a non-recipe video that still HAS captions reaches extraction (only caption-less videos short-circuit at `no_transcript`), so `no_recipe_found` is the catch-all for "had content, no recipe in it."

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
- `TRANSCRIPTAPI_API_KEY` (YouTube transcript provider — [transcriptapi.com](https://transcriptapi.com), Bearer auth; used by `import-youtube`)
- `SUPADATA_API_KEY` (import-url web-scrape fallback ONLY — used by `import-url`)
- `GOOGLE_PLAY_PACKAGE_NAME` (e.g. `com.rasoi.app`), `GOOGLE_PLAY_SERVICE_ACCOUNT` (the full service-account JSON, single-line) — used by `play-verify-purchase` to call the Google Play Developer API. (All `RAZORPAY_*` secrets are **gone**.)
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
| 4 AI | 12 | Recipe summarisation fn (`ai-summarise`) | ❌ **removed** (feature cut — fn + `lib/api/summarise.ts` + `useRecipeSummary` + detail card deleted; run `supabase functions delete ai-summarise`) |
| 4 AI | 13 | Smart auto-tagging (`_shared/tagging.ts`, hook into imports) | ✅ done (⚠ redeploy imports pending) |
| 4 AI | 14 | Dish-photo → nutrition fn + hook (`ai-nutrition`; **credit-gated, 1/scan from the shared pool**) | ✅ done (⚠ redeploy pending) |
| 5 Pay | — | **Pricing migration `0003_pricing_model.sql`** (subscriptions→entitlements, `payments` table, credit RPCs, gating rewrite) | ✅ **applied & live** |
| 5 Pay | 15 | **Google Play Billing** server verify (`play-verify-purchase` + `_shared/googleplay.ts`) — replaces Razorpay create-order/webhook | ⚠ code-complete; **deploy + Play Console / service-account setup pending** |
| 5 Pay | 16 | Idempotency ledger `0006_play_billing.sql` (`play_purchases`); grant reuse (`add_credits` / `plan='lifetime'`) | ⚠ migration written; **`supabase db push` pending** |
| 5 Pay | 17 | Client billing (`expo-iap`, `PlayBillingProvider`, `lib/api/billing.ts`, `PaywallSheet`) — Razorpay client + WebView removed | ⚠ code-complete; **needs a dev/EAS build to test (not Expo Go)** |
| 6 Storage | 18 | Storage bucket + signed URLs (`0004_storage_buckets.sql`, `_shared/storage.ts`, `get-recipe-image`) | ✅ done; `0004` applied / bucket live (⚠ confirm `get-recipe-image --no-verify-jwt` deployed) |
| 6 Storage | 19 | Wire image upload into imports (`uploadRecipeImageFromUrl` → `storage_path` in both importers) | ✅ done & verified (`storage_path` populated on a real import) |
| 6 Storage | 20 | Client image resolver + recipe screens on real data (`lib/api/storage.ts`, `lib/recipes/uiRecipe.ts`, `useRecipe`/`useRecipes`/`useRecipeImage`; home/detail/cook converted) | ✅ done (⚠ deploy `get-recipe-image` for signed-URL images to work) |

**Phases 1–6 are code-complete; the full backend roadmap (Steps 1–20) is built.** Phase 5 pricing migration `0003_pricing_model.sql` is **applied** and entitlement functions are deployed; **payments were migrated off Razorpay onto Google Play Billing** (`expo-iap` + `play-verify-purchase`) — code-complete, pending the `0006` migration push, the `play-verify-purchase` deploy, Play Console product + service-account setup, and a dev build to test. Phase 6 Storage: `0004` applied (bucket live) and a real import was **verified to populate `storage_path`**. The **recipe screens now run on real data** — home feed, recipe detail (signed-URL hero), and cook mode read the user's actual recipes via `useRecipes`/`useRecipe`. Also live from earlier: migrations `0001`+`0002`, the Clerk `supabase` JWT template, `clerk-webhook`.

**⚠ Deploy after the credit-model change:** the shared-credit refactor touched `_shared/gating.ts` (bundled per-function), so **redeploy** `import-youtube` and `ai-nutrition` `--no-verify-jwt`, deploy the new **`play-verify-purchase --no-verify-jwt`** + push **`0006_play_billing.sql`** (`supabase db push`) + remove the old functions (`supabase functions delete razorpay-create-order razorpay-webhook`), **delete** the dropped `ai-summarise` (`supabase functions delete ai-summarise`), and **delete the removed `import-instagram`** (`supabase functions delete import-instagram`) — the Instagram feature was cut 2026-06-17. Still pending from before: `get-recipe-image --no-verify-jwt` (so `useRecipeImage` resolves signed URLs; until then the hero falls back to origin `image_url`).

**Not yet exercised (deployed, same proven plumbing):** the Lifetime (`plan='lifetime'`) webhook branch, and gating *enforcement* (15-recipe cap, monthly credit rollover/fallback, 1-credit scan deduction). Worth a smoke test but not blocking.

**Now wired to real data (2026-06-10):**
- **Search** (`(tabs)/search.tsx`) reads `useRecipes()` and filters by title + tags; filter chips are derived from the user's actual recipe tags (the DB has no cuisine/difficulty), plus a cook-time filter. Idle state is "browse by tag".
- **Collections** (`(tabs)/collections.tsx`, `collections/[id].tsx`) are full CRUD via `hooks/useCollections.ts` — direct RLS-scoped reads/writes against `collections`/`collection_recipes` (no Edge Function; the `*_own` policies gate everything). Create (name → insert with internal `user_id` resolved from the RLS-visible `users` row), delete (long-press a card), add/remove recipes (detail-screen picker modal + long-press a card to remove). Cover collage uses the member recipes' `image_url`.
- **Calorie scanner** (`app/nutrition.tsx`, stack route, entry from Profile → Features): expo-image-picker (camera/library) → expo-image-manipulator (resize 768 / JPEG 0.6 / base64 data URL) → `useNutritionAnalysis` → macro result card. Costs **1 credit** from the shared pool; gated on `youtubeRemaining >= 1`; refetches `['entitlements']` after a scan; routes `out_of_credits` to `showPaywall('yt_credits')`. `app.json` carries the `expo-image-picker` permission plugin.
- **Recent Imports** on the Import tab + **Profile identity** are real: import tab maps the 3 newest `useRecipes()` rows; profile hydrates name/email/avatar from Clerk `useUser()`.

**Still mock / partially wired:**
- **Recipe cards render the origin `image_url`** (not per-card signed URLs — that would fire one `get-recipe-image` call per card per feed render), now with `expo-image` `cachePolicy="memory-disk"` + `recyclingKey` so the home grid scrolls/recycles without re-decoding. The resilient signed-URL path is used on the **detail hero** only (`useRecipeImage`).
- **Delete is real** (`delete-recipe` fn → `useDeleteRecipe`): the home cards' 3-dot menu (`RecipeActionsSheet`) and the detail-screen trash button both delete + decrement the saved-recipe counter. The **save/bookmark** toggle on the detail screen is still local state only (no real save/unsave); the Share button is a stub.
- The detail/cook screens still **fall back to mock** for non-UUID ids (harmless — nothing routes non-UUID ids anymore now that search/collections are real).
- Two recipe shapes coexist: API `RecipeRow` (snake_case, DB) → normalised to **`UiRecipe`** via `lib/recipes/uiRecipe.ts` (which also adapts the legacy mock `Recipe`); screens consume `UiRecipe`.

The backend roadmap (Steps 1–20) is complete; the Edge Functions are deployed/ACTIVE (`ai-summarise` was removed — delete it from the project). The earlier product-polish backlog (search + collections on real data, nutrition camera UI, profile identity, real recent imports) was **built on 2026-06-10**. **Delete-recipe is now built** (`delete-recipe` fn + `useDeleteRecipe` + home-card 3-dot menu + detail trash) — ⚠ deploy `delete-recipe --no-verify-jwt` for it to work. Remaining polish: real save/unsave, per-step timers for real recipes, and a smoke test of the not-yet-exercised payment/gating branches.

---

## Conventions & guardrails

- **Design tokens, not literals** — import `Colors`/`Fonts`; use Tailwind tokens. Match the editorial Midnight Spice style of existing screens.
- **Mock data** — effectively all screens now run on **real data**: home feed, recipe detail, cook mode (`useRecipes`/`useRecipe` → RLS), Import tab (`useImportRecipe`), **search** (`useRecipes`, filters client-side), and **collections** (`useCollections` full CRUD). `constants/mockData.ts` survives in exactly two places: the **detail/cook fallback** for non-UUID ids (`recipe/[id].tsx`, `cook/[id].tsx`) and inside the **`lib/recipes/uiRecipe.ts`** adapter (`mockToUiRecipe`). Don't re-point any screen back at mock. Two recipe shapes: API `RecipeRow` (snake_case, DB) and the legacy mock `Recipe` (camelCase) both normalise to **`UiRecipe`** via `lib/recipes/uiRecipe.ts` — screens consume `UiRecipe`, never the raw shapes.
- **Edge Function style** (match `import-url` / `import-youtube`): `Deno.serve`, URL imports (esm.sh for `@supabase/supabase-js@2`, deno.land for `jose`), handle `OPTIONS` preflight + spread `corsHeaders` on every response. Reuse the `_shared/` helpers (`authenticateRequest`, the `gating.ts` gates, `insertRecipe`, `callOpenRouter`, `getProductPurchase`) rather than re-implementing. Signal errors by **throwing `HttpError(status, body)`**; wrap the body in `try { … } catch (err) { return errorResponse(err, TAG); }`. `console.error` with a `[fn-name]` prefix. (`clerk-webhook` predates this pattern and keeps its own local `json` helper — leave it unless you're touching it.)
- **Security (always):** OpenRouter / Google Play service-account / service-role keys server-side only; all data mutations through Edge Functions; **no Instagram or TikTok import** — the client rejects those URLs up front with a "not supported" alert (`unsupportedSource()` in `lib/api/import.ts`, checked in `import.tsx#startFetch`) so they never reach a backend.
- **Webhooks:** read the raw request body as text *before* parsing (signature is over raw bytes); deploy with `--no-verify-jwt`.
- **Animations:** Reanimated shared values + `withSpring`/`withTiming`; haptics on press; bottom sheets slide up. The spring press micro-interactions run on the **UI thread** (transform-only) — they're cheap, keep them; they are *not* a low-end perf concern.
- **Bottom sheets & confirms — reuse, don't re-roll.** New bottom sheets should wrap their content in **`components/BottomSheet.tsx`** (themed chrome + slide animation + tap-handle / swipe-down dismiss; pass `sheetStyle` for bg/maxHeight/padding, `avoidKeyboard` for keyboard-input sheets) rather than hand-rolling a `Modal` + handle. For destructive/confirm prompts use **`components/ConfirmDialog.tsx`**, never the native `Alert.alert` (it renders the off-theme OS dialog). `Alert.alert` is fine for **error toasts** ("Could not delete", etc.). **Modal stacking gotcha (iOS):** never have two RN `Modal`s presented at once — either nest a `ConfirmDialog` inside the open `BottomSheet` (as `RecipeActionsSheet` does), or `setTimeout(...)` the next sheet open until the first finishes sliding out (~260ms, as `collections/[id].tsx`'s ⋯ menu does).
- **List performance (low/mid devices):** render long recipe lists with a **virtualized `FlatList`** (home grid uses `numColumns={2}` + `columnWrapperStyle`, everything above it in `ListHeaderComponent`), never `ScrollView` + `.map` — only on-screen cards should mount. Horizontal lists may be nested in a vertical list's header (different orientation, no warning). On `expo-image` always set `cachePolicy="memory-disk"` + `recyclingKey={id}` so recycled rows swap bitmaps instead of re-decoding. Image decode — not the animations — is the real cost in this app.

## Known stubs / gotchas

- **Shopping list was removed** (2026-06-17). `app/shopping.tsx` is deleted and nothing routes to it; the `shopping_list_items` table is left in the DB unused. Don't re-add a shopping route without product sign-off.
- Profile is **fully real**: identity (name/email/avatar) hydrates from Clerk `useUser()`; the plan/usage section reads `useEntitlements()` (`isLifetime`, `recipe_count`/15) and the upgrade CTAs call `showPaywall()`. No mock strings remain there.
- Supabase Storage: **Steps 18–20 code-complete** — private `recipe-images` bucket (`0004`, applied), `_shared/storage.ts` uploader, `get-recipe-image` (signed-URL/origin fallback), both importers copy the image into the bucket + set `storage_path` (best-effort, verified populated), and the client resolver (`lib/api/storage.ts` + `useRecipeImage`) is wired into the recipe-detail hero. **Deploy `get-recipe-image --no-verify-jwt`** for signed URLs to resolve (else hero uses origin `image_url`). Recipes imported before Step 19 keep `storage_path` null → `source:'origin'`.
- AI summary: **removed** (2026-06-11). The `ai-summarise` fn, `lib/api/summarise.ts`, `useRecipeSummary`, and the detail-screen summary card are all deleted; the `recipes.ai_summary` column is left in the DB unused. Payments now run on **Google Play Billing** (`expo-iap` + `play-verify-purchase` + `0006_play_billing.sql`); **Razorpay was fully removed** (client WebView, `razorpay-create-order`, `razorpay-webhook`, `_shared/razorpay.ts`).
- **`expo-iap` powers the paywall** (native Google Play Billing). `PlayBillingProvider` is mounted at the root (wraps `PaywallProvider`) and **does not work in Expo Go** — IAP needs a **dev/EAS build** uploaded to a Play **internal-testing** track with **license testers**. In Expo Go the provider degrades gracefully (`connected=false`; `buy()` alerts) so the rest of the app still runs.
- **Google Play purchase flow (don't trust the client):** `PlayBillingProvider.onPurchaseSuccess` sends the `purchaseToken` to `play-verify-purchase`, which verifies it against the **Google Play Developer API** and grants the entitlement **idempotently** (PK on the token in `play_purchases`). Only after a successful grant does the client call `finishTransaction` — **acknowledge** for Lifetime (non-consumable) / **consume** for the credit pack (so it can be re-bought). Purchases completed while the app was killed are reconciled via `getAvailablePurchases()` on next launch. Product IDs `rasoi_lifetime` / `rasoi_credits_10` **MUST** match Play Console exactly (mapped in `lib/api/billing.ts` + `play-verify-purchase`).
- **Credit RPCs (`deduct_ai_credits`, `add_credits`) are service-role-only** (execute revoked from `public`/`anon`/`authenticated`). Never call them from the client; never grant credits outside the webhook / gating path, or a user could mint their own.
- **Two different freemium walls — don't conflate them in the paywall.** The **15-saved-recipe cap** (`recipe_limit`, gates URL/photo imports) is lifted **only** by Lifetime or by deleting recipes — buying credits does NOT raise it (credits are the YouTube/IG/scan pool). So the paywall is **reason-aware** (`showPaywall(product, reason)`; `PaywallReason` in `PaywallProvider`): `recipe_limit` shows Lifetime + a "delete to free space" hint and **hides the credit top-up** (else a confused user buys ₹49 credits and stays blocked); `out_of_credits` shows the top-up. `import.tsx#showLimitPaywall` maps the 402 `reason` → the paywall reason. Keep new credit-prompt call sites passing `'out_of_credits'`. The import screen also shows a **proactive `RecipeLimitBanner`** (free users, last 3 before the cap) so the wall is visible *before* importing, not just on the 402.
- Deno isn't installed locally → Edge Functions can't be type-checked on this machine.
- `_shared/auth.ts` builds its Clerk JWKS lazily so a missing `CLERK_JWKS_URL` returns a clean 401 instead of a cold-start crash. **`CLERK_JWKS_URL` must be the FULL url** (`https://<domain>/.well-known/jwks.json`) — Clerk's dashboard only shows the bare domain; the bare value breaks `new URL()` and the issuer check.
- **YouTube transcripts go through transcriptapi.com** (`_shared/transcript.ts#fetchYouTubeTranscript`), not direct scraping — YouTube IP-blocks datacenter (edge) IPs. Needs `TRANSCRIPTAPI_API_KEY` (Bearer auth; 1 credit per `200`, charged only on success; we request `format=text` so `transcript` is a single string). `404` → `no_transcript`; `408`/`429`/`503` are retried with short backoff; `401`→unauthorized, `402`→`transcript_provider_no_credits`. The original `youtube-transcript` esm.sh lib was removed because of the IP block. **Supadata** (`SUPADATA_API_KEY`) now serves only the **import-url web-scrape** fallback; YouTube uses transcriptapi.com. (**Instagram import was removed entirely on 2026-06-17** — the `import-instagram` function, `_shared/apify.ts`, and all the client UI/routing are gone; recipes were unclear and ~99% of users only use YouTube. If re-adding, that's a fresh build, not a revert.)
- **Hard-won auth lessons** (don't regress): import functions deploy `--no-verify-jwt`; the client sends the Clerk token in `X-Clerk-Token` + the anon key in `apikey` (NOT `Authorization` — Supabase's gateway rejects an asymmetric Clerk JWT there with `UNAUTHORIZED_ASYMMETRIC_JWT`). Client→function changes need a **full app reload** (Fast Refresh doesn't always pick up `lib/api/*` module changes).
- **OpenRouter model slugs go stale.** `google/gemini-flash-1.5` was retired and started returning `404 "No endpoints found"`, which broke extraction (it's the shared fallback) — replaced with `google/gemini-2.5-flash` everywhere (2026-06-09). If AI calls 404 with that message, check the slug against `GET https://openrouter.ai/api/v1/models`. `callOpenRouter` now logs `[openrouter] primary model "<x>" failed; retrying with "<y>"` so a fallback error can't mask the primary's cause, and its JSON parse is tolerant of fenced/wrapped replies.
- **Extraction model swapped to `gemini-2.5-flash` primary (2026-06-11)** for speed — for text→JSON recipe extraction it's ~3–5x faster than `llama-3.3-70b` at equal quality; the 70B is now the fallback. Set in `openrouter.ts` `DEFAULT_MODEL`/`DEFAULT_FALLBACK`. All calls send `provider: { sort: 'throughput' }` to route to the fastest endpoint.
- **Recipes are normalized to English (2026-06-11).** `RECIPE_EXTRACTION_SYSTEM_PROMPT` instructs the model to translate every text field into English when the source (transcript/page/photo) is another language — so a Hindi/Tamil/Spanish video yields an English recipe. The multilingual model does the translation inline (no extra call). Foreign-language imports still require the source to *have* captions — YouTube via transcriptapi.com; truly caption-less videos → `no_transcript`, regardless of language.
- **Import latency wins (2026-06-11):** url/youtube no longer block the response on tag-refinement (a 2nd LLM call) or the image copy — both moved to `finalizeRecipeInBackground` (`EdgeRuntime.waitUntil`), so the row returns the moment it's inserted (extraction tags + origin `image_url`; tags/`storage_path` settle a beat later). YouTube fetches transcript + oEmbed via `Promise.all`. `StepTimer` (`timing.ts`) logs `⏱ <step> <ms>` + `TOTAL` to pinpoint the bottleneck. NOTE: `import-photo` still calls `refineTags`/image-copy inline — fold it into `finalize.ts` the same way if its latency matters.
```
