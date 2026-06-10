# Saveur — Backend Setup

## Stack


| Layer          | Choice                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| Auth           | Clerk (`@clerk/clerk-expo`)                                                  |
| Database       | Supabase PostgreSQL                                                          |
| Storage        | Supabase Storage                                                             |
| Serverless API | Supabase Edge Functions (Deno)                                               |
| AI             | OpenRouter (`meta-llama/llama-3.3-70b-instruct` / `google/gemini-2.5-flash`) |
| Payments       | Razorpay (INR) — one-time Lifetime Unlock + consumable credit packs           |


See `backend-roadmap.md` for the full step-by-step build plan.

---

## Local Setup

### 1. Environment variables

Create `.env.local` at the project root:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

> `SUPABASE_SERVICE_ROLE_KEY` is **never** in `.env.local`. It is auto-injected into Supabase Edge Functions only.

### 2. Install dependencies

```bash
npm install
npx expo install @clerk/clerk-expo expo-secure-store expo-web-browser expo-auth-session expo-crypto
npx expo install @supabase/supabase-js react-native-url-polyfill
```

### 3. Start Metro

```bash
npx expo start --clear
```

---

## Setup → Clerk ↔ Supabase auth (direct DB reads)

Edge Functions (imports, AI, payments) verify the **default** Clerk session token themselves via JWKS — they need no setup beyond `CLERK_JWKS_URL`. But the app also reads the DB **directly** (home feed, recipe detail, entitlements) through RLS, and that path needs Postgres to be able to verify a Clerk token. Since migration `0005`, RLS resolves the user from **either** the `user_id` claim (HS256 template token) **or** the standard `sub` claim (default session token), so **either** of these setups works — you need at least one:

**Option A — JWT template (legacy-secret path):** the `supabase` HS256 template below. Only works while your project's *legacy JWT secret* is active (Supabase projects on the new `sb_publishable_…` keys may have it disabled).

**Option B — Third-Party Auth (recommended on new projects):**

1. Clerk Dashboard → **Integrations** (or **Configure → Sessions → Customize session token**) → activate the **Supabase** integration. This adds `"role": "authenticated"` to your session tokens — required, or Supabase rejects them.
2. Supabase Dashboard → **Authentication → Sign In / Providers → Third Party Auth** → **Add provider → Clerk**, and enter your Clerk domain (e.g. `good-kangaroo-46.clerk.accounts.dev`).

With Option B the client's fallback path (default `getToken()`) authenticates direct reads; the template becomes optional. If **neither** is configured, queries run as anon and RLS silently returns zero rows — the app logs a `[useSupabaseClient]` warning when it falls back, and the symptom is "Recipe not found … (no rows returned)" / an empty home feed **even though imports succeed** (imports write via service role, which bypasses RLS).

---

## Setup → Clerk JWT Template

Supabase uses this template to verify that incoming JWTs were issued by Clerk. (Optional if you configured Third-Party Auth above — see "Clerk ↔ Supabase auth".)

1. [Clerk Dashboard](https://dashboard.clerk.com) → your app → **JWT Templates** → **New template** → **Blank**.
2. Name it exactly `**supabase`** (the client hook calls `getToken({ template: 'supabase' })`).
3. **Signing algorithm**: `HS256`.
4. **Signing key**: paste your Supabase JWT Secret.
  - Supabase Dashboard → **Project Settings** → **API** → **JWT Settings** → copy the secret.
5. **Claims**:
  ```json
   {
     "aud": "authenticated",
     "role": "authenticated",
     "user_id": "{{user.id}}",
     "email": "{{user.primary_email_address}}"
   }
  ```
6. **Token lifetime**: `60` seconds.
7. Save.

---

## Setup → Supabase Schema

Apply migrations in order:

**Option A — CLI (recommended):**

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <ref>   # the slug in your EXPO_PUBLIC_SUPABASE_URL
supabase db push
```

**Option B — Dashboard:** SQL Editor → run these files in order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_pricing_model.sql` — reprices to the Lifetime + credits model (see its own section below; redeploy entitlement functions after)

---

## Setup → Clerk Webhook

The webhook populates `public.users` on sign-up, profile update, and account deletion. Until it runs, `public.users` is empty and every RLS policy returns no rows.

### Deploy the function

```bash
supabase functions deploy clerk-webhook --no-verify-jwt
```

`--no-verify-jwt` is required because Clerk authenticates via a Svix signature, not a Supabase JWT.

### Register the endpoint in Clerk Dashboard

1. [Clerk Dashboard](https://dashboard.clerk.com) → your app → **Webhooks** → **Add Endpoint**.
2. **URL**: `https://<project-ref>.supabase.co/functions/v1/clerk-webhook`
3. **Events**: `user.created`, `user.updated`, `user.deleted`.
4. Save. Copy the **Signing Secret** (`whsec_...`).

### Set the webhook secret

```bash
supabase secrets set CLERK_WEBHOOK_SECRET=whsec_...
```

---

## Setup → Import (URL) Edge Function (Phase 3, Step 9)

`import-url` takes a recipe URL, scrapes the page, extracts a structured recipe via OpenRouter, saves it to `public.recipes`, and increments the freemium counter. Deploy it once the schema, Clerk webhook, and `supabase` JWT template are in place.

### 1. Set the secrets it needs

```bash
supabase secrets set \
  OPENROUTER_API_KEY=sk-or-... \
  CLERK_JWKS_URL=https://good-kangaroo-46.clerk.accounts.dev/.well-known/jwks.json
```

- `OPENROUTER_API_KEY` — from your OpenRouter account → **Keys**.
- `CLERK_JWKS_URL` — your Clerk instance's JWKS endpoint. The value above is derived from this project's publishable key; the general form is `https://<clerk-domain>/.well-known/jwks.json`.
- `OPENROUTER_REFERER` — **optional**; defaults to `https://saveur.app` if unset.

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into the function — do **not** set them manually.

### 2. Deploy

```bash
supabase functions deploy import-url --no-verify-jwt
```

> `--no-verify-jwt` is **required**. The function verifies the caller's Clerk **session token** itself (against your Clerk JWKS), so Supabase's gateway must not pre-reject it — the gateway only accepts Supabase-signed JWTs, which a Clerk token is not. Same reason `clerk-webhook` uses the flag. (If you already deployed without it, redeploy with the flag.)

### 3. Verify

There's no client UI calling this endpoint yet (that arrives in Step 11), so test it directly with `curl`. Use a **default Clerk session token** — `getToken()` from `@clerk/clerk-expo`, **not** the `supabase` JWT template. The function verifies it against your Clerk JWKS and reads the `sub` claim.

```bash
curl -i -X POST \
  https://nxoarrupmeykjgxvevys.supabase.co/functions/v1/import-url \
  -H "Authorization: Bearer <clerk-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.example.com/a-recipe-page"}'
```

Expected status codes:

| Code | Meaning |
| ---- | ------- |
| `200` | Recipe extracted + inserted; body is the new `recipes` row |
| `400` | Missing/invalid `url` in the body |
| `401` | Invalid/missing token, or the user isn't provisioned in `public.users` yet |
| `402` | `{"error":"limit_reached"}` — free plan already has 10 recipes |
| `422` | Page couldn't be fetched/parsed, or extraction failed |

Check live logs while testing with `supabase functions logs import-url`.

---

## Setup → Import (YouTube) Edge Function (Phase 3, Step 10)

`import-youtube` fetches a YouTube video's transcript, pulls the recipe out of it via OpenRouter, and saves it. It reuses the same auth + freemium gating as `import-url`.

> **Why a transcript provider?** Scraping YouTube captions directly from an edge function gets IP-blocked (YouTube refuses datacenter IPs). So transcript fetching is delegated to **[Supadata](https://supadata.ai)**, a managed API that runs the scraping + residential proxies for us. See `supabase/functions/_shared/transcript.ts`.

### 1. Get a Supadata API key

1. Sign up at [supadata.ai](https://supadata.ai) (free tier = 100 transcripts/month).
2. Verify email → **API Keys** → **Create New API Key**.
3. Set it as an Edge Function secret:
   ```bash
   supabase secrets set SUPADATA_API_KEY=sd_...
   ```

### 2. Deploy

```bash
supabase functions deploy import-youtube --no-verify-jwt
```

> `--no-verify-jwt` is required for the same reason as `import-url` (the function does its own Clerk JWKS verification). Also uses `OPENROUTER_API_KEY` + `CLERK_JWKS_URL` (already set for `import-url`). `OPENROUTER_REFERER` is optional. Videos over 20 min are transcribed asynchronously (the function polls briefly); very long videos may exceed the poll budget and return `transcript_timeout`.

### 2. Verify

Same as `import-url` — POST a YouTube URL with a **default Clerk session token** (`getToken()`):

```bash
curl -i -X POST \
  https://nxoarrupmeykjgxvevys.supabase.co/functions/v1/import-youtube \
  -H "Authorization: Bearer <clerk-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID"}'
```

Accepts `watch?v=`, `youtu.be/`, `/shorts/`, and `/embed/` links. Extra status codes beyond the shared model: `400 invalid_youtube_url` (no video id) · `422 no_transcript` (video has no captions to read).

---

## Setup → Recipe Summary Edge Function (Phase 4, Step 12)

`ai-summarise` takes a `recipeId`, loads that recipe (verifying it belongs to the caller), asks OpenRouter for a 2-sentence blurb, saves it to `recipes.ai_summary`, and returns `{ summary }`. Summarising is a light task, so it leads with Gemini Flash and falls back to the 70B model — the inverse of the import functions.

### 1. Secrets

No new secrets. It reuses `OPENROUTER_API_KEY` + `CLERK_JWKS_URL`, already set for the import functions. `OPENROUTER_REFERER` is optional.

### 2. Deploy

```bash
supabase functions deploy ai-summarise --no-verify-jwt
```

> `--no-verify-jwt` is required for the same reason as the import functions (it does its own Clerk JWKS verification on the caller's session token).

> **As of Step 20 this IS client-wired** (`lib/api/summarise.ts` → `hooks/useRecipeSummary.ts` → the "Generate summary" button on the recipe detail screen, shown only for real recipes). **Deploy it** or that button returns an error. Until deployed, recipes simply show no summary.

### 3. Verify

You can drive it from the detail screen's "Generate summary" button, or test with `curl` using a **default Clerk session token** (`getToken()`, not the `supabase` template) and the `id` of a recipe you already imported:

```bash
curl -i -X POST \
  https://nxoarrupmeykjgxvevys.supabase.co/functions/v1/ai-summarise \
  -H "Authorization: Bearer <clerk-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"<an-existing-recipe-uuid>"}'
```

| Code | Meaning |
| ---- | ------- |
| `200` | `{"summary":"..."}` — also written to `recipes.ai_summary` |
| `400` | Missing/invalid `recipeId` in the body |
| `401` | Invalid/missing token, or user not provisioned |
| `403` | `{"error":"forbidden"}` — the recipe belongs to another user |
| `404` | `{"error":"recipe_not_found"}` — no recipe with that id |
| `422` | OpenRouter failed or returned an empty summary |

---

## Setup → Smart auto-tagging (Phase 4, Step 13)

No new endpoint or secret. `supabase/functions/_shared/tagging.ts` (`refineTags`) asks a light model (Gemini Flash, with the 70B model as fallback) for 4–6 category tags and merges them into the recipe's tags just before it's saved. Both import functions now call it, so **redeploy them** to pick it up:

```bash
supabase functions deploy import-url --no-verify-jwt
supabase functions deploy import-youtube --no-verify-jwt
```

It's fully best-effort — any failure (network, bad JSON, empty) leaves the original tags untouched and never fails an import. Reuses `OPENROUTER_API_KEY`; nothing else to configure.

---

## Setup → Dish Nutrition Edge Function (Phase 4, Step 14)

`ai-nutrition` takes a photo of a cooked dish and estimates the macros (calories, protein, carbs, fat, …) for the portion shown. It's a **vision** call — it sends the image to a multimodal model (Gemini Flash, falling back to gpt-4o-mini) and returns a normalised JSON estimate. Stateless: nothing is written to the database. Client wiring lives in `lib/api/nutrition.ts` + `hooks/useNutritionAnalysis.ts`.

### 1. Secrets

No new secrets — reuses `OPENROUTER_API_KEY` + `CLERK_JWKS_URL`. (The vision models bill against the same OpenRouter key.)

### 2. Deploy

```bash
supabase functions deploy ai-nutrition --no-verify-jwt
```

> `--no-verify-jwt` for the same reason as the other functions (it does its own Clerk JWKS verification).

### 3. Verify

No UI calls it yet. The body takes `image` (a `data:image/...;base64,...` data URL **or** a public http(s) image URL) and an optional `note`. Easiest to test with a hosted image URL:

```bash
curl -i -X POST \
  https://nxoarrupmeykjgxvevys.supabase.co/functions/v1/ai-nutrition \
  -H "Authorization: Bearer <clerk-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"image":"https://example.com/my-dish.jpg","note":"homemade, about 2 cups"}'
```

| Code | Meaning |
| ---- | ------- |
| `200` | `{dish, servingSize, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, confidence, assumptions[], items[]}` for the portion shown |
| `400` | `invalid_image` (not a data URL / http url) or `image_too_large` (> ~5 MB) |
| `401` | Invalid/missing token, or user not provisioned |
| `422` | `analysis_failed` (vision call failed) or `unparseable_result` (model didn't return usable JSON) |

In the app the screen will capture a photo (expo-image-picker / camera), resize it (expo-image-manipulator, ~768px / JPEG q0.6) and send the base64 **data URL** — keep it under ~5 MB. A non-food image returns `dish: null`, zeros, and `confidence: "low"` (a 200, not an error).

---

## Setup → Pricing model migration (`0003_pricing_model.sql`)

Apply **before** deploying the payment functions. It reprices the app from a recurring subscription to a one-time model:

- **Free**: 15 saved recipes, unlimited URL imports, 3 YouTube imports/month.
- **Lifetime Unlock** (one-time **₹499**): unlimited saves, 20 YouTube imports/month.
- **Credit packs** (consumable, metered for everyone incl. lifetime): YouTube imports **₹49/10**, AI scans **₹99/50** (the dish-photo macro scan costs **2 credits**).

It renames `subscriptions`→`entitlements`, adds credit/counter columns + a `payments` table, adds service-role-only credit RPCs, and reworks the default-row trigger. Apply with `supabase db push` (or run the file in the SQL editor).

> ⚠️ **Apply `0003` and redeploy the entitlement-touching functions together** — `import-url`, `import-youtube`, `ai-nutrition`, `razorpay-create-order`, `razorpay-webhook`. The currently-deployed importers reference the old `subscriptions` table and break once it's renamed.

---

## Setup → Razorpay payment functions (Phase 5, Steps 15–16)

`razorpay-create-order` creates a one-time Razorpay **Order** for a product and returns what the client Checkout needs (`orderId`, `amount`, `keyId`). `razorpay-webhook` verifies Razorpay's signature and, on `payment.captured`, grants the entitlement (lifetime → `plan='lifetime'`; `yt_credits` → +10; `ai_credits` → +50). The webhook is the **source of truth** — the client never grants itself anything.

### 1. Razorpay dashboard setup (one-time, by hand)

1. [Razorpay Dashboard](https://dashboard.razorpay.com) → activate (use **Test Mode** first).
2. **Settings → API Keys → Generate Key** → copy the **Key ID** (`rzp_test_...`) and **Key Secret**.
3. No plans needed — prices are fixed server-side in `razorpay-create-order` (lifetime ₹499 / yt ₹49 / ai ₹99).

### 2. Set the secrets

```bash
supabase secrets set \
  RAZORPAY_KEY_ID=rzp_test_... \
  RAZORPAY_KEY_SECRET=... \
  RAZORPAY_WEBHOOK_SECRET=...
```

### 3. Deploy

```bash
supabase functions deploy razorpay-create-order --no-verify-jwt
supabase functions deploy razorpay-webhook --no-verify-jwt
```

> Both use `--no-verify-jwt`: create-order does its own Clerk JWKS check; the webhook authenticates via Razorpay's HMAC signature.

### 4. Register the webhook (Razorpay Dashboard)

1. **Settings → Webhooks → Add New Webhook**.
2. **URL**: `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`
3. **Active events**: `payment.captured`, `payment.failed`.
4. Set a **secret**, then `supabase secrets set RAZORPAY_WEBHOOK_SECRET=<that secret>`.

### 5. Verify create-order

No client UI is required to test it — use a **default Clerk session token** (`getToken()`):

```bash
curl -i -X POST \
  https://nxoarrupmeykjgxvevys.supabase.co/functions/v1/razorpay-create-order \
  -H "Authorization: Bearer <clerk-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"product":"lifetime"}'
```

| Code | Meaning |
| ---- | ------- |
| `200` | `{"orderId":"order_...","amount":49900,"currency":"INR","keyId":"rzp_..."}` + a `payments` row `status='created'` |
| `400` | `invalid_product` (not `lifetime`/`yt_credits`/`ai_credits`) or `invalid_json` |
| `401` | Invalid/missing token, or user not provisioned |
| `500` | `razorpay_not_configured` or `payment_record_failed` |
| `502` | `razorpay_order_failed` — Razorpay rejected the call (check `supabase functions logs razorpay-create-order`) |

The entitlement is granted only when the **webhook** receives `payment.captured` for that order. In the app, the paywall (`components/PaywallSheet.tsx`) opens Razorpay Checkout in a WebView — this needs `npx expo install react-native-webview` (the app won't bundle without it).

---

## Setup → Recipe image storage (Phase 6, Step 18)

Recipe images live in a **private** `recipe-images` bucket. Edge Functions upload them with the service role; the client reads them through short-lived **signed URLs** minted by `get-recipe-image`. No client touches Storage directly.

> ⚠️ The migration is **`0004_storage_buckets.sql`** (not `0003` — that's the pricing migration). It creates the private bucket plus an owner-scoped read policy (defense-in-depth; signed URLs bypass RLS anyway).

### 1. Apply the migration

```bash
supabase db push   # applies 0004_storage_buckets.sql (creates the recipe-images bucket)
```

### 2. Deploy the function

`get-recipe-image` self-verifies the Clerk token via JWKS, so it deploys **`--no-verify-jwt`** like the other authed functions (and its client caller sends the Clerk token in `X-Clerk-Token`, not `Authorization`):

```bash
supabase functions deploy get-recipe-image --no-verify-jwt
```

It needs no new secrets (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are auto-injected).

### 3. Verify

```bash
curl -i -X POST \
  https://<project-ref>.supabase.co/functions/v1/get-recipe-image \
  -H "Authorization: Bearer <clerk-session-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"<a-recipe-id-you-own>"}'
```

| Code | Meaning |
| ---- | ------- |
| `200` | `{"url":"...","source":"storage"}` (signed URL) or `{"url":"...","source":"origin"}` (falls back to `image_url`) |
| `400` | `invalid_recipe_id` / `invalid_json` |
| `401` | Invalid/missing token, or user not provisioned |
| `403` | `forbidden` — the recipe belongs to another user |
| `404` | `recipe_not_found`, or `no_image` (neither `storage_path` nor `image_url` set) |

> **Step 19 is wired:** both importers now copy the image into the bucket and set `storage_path` after insert (best-effort), so newly-imported recipes resolve `source: 'storage'`. Recipes imported *before* Step 19 — or where the copy failed — keep `storage_path` null and correctly fall back to `source: 'origin'`. **Redeploy both importers after Step 19:**
>
> ```bash
> supabase functions deploy import-url --no-verify-jwt
> supabase functions deploy import-youtube --no-verify-jwt
> ```

> **Step 20 (client):** the recipe detail hero resolves its image through this function via `lib/api/storage.ts` → `hooks/useRecipeImage.ts` (cached ~50 min, signed URL with origin fallback). Recipe cards render the origin `image_url` directly (no per-card signed-URL calls). **Deploy `get-recipe-image --no-verify-jwt`** or the hero just keeps using the origin `image_url`.

---

## Edge Function secrets (set once before deploying any function)

```bash
supabase secrets set \
  CLERK_WEBHOOK_SECRET=whsec_... \
  CLERK_JWKS_URL=https://<clerk-domain>/.well-known/jwks.json \
  OPENROUTER_API_KEY=sk-or-... \
  OPENROUTER_REFERER=https://saveur.app \
  SUPADATA_API_KEY=sd_... \
  RAZORPAY_KEY_ID=rzp_... \
  RAZORPAY_KEY_SECRET=... \
  RAZORPAY_WEBHOOK_SECRET=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — do not set them manually.

---

## Smoke Test

After the JWT template, schema, and webhook are all wired up:

1. Sign up in the app with a new account.
2. Check **Clerk Dashboard → Webhooks → your endpoint → Logs** — you should see a `user.created` delivery with status `200`.
3. In the **Supabase SQL Editor**:
  ```sql
   select * from public.users;
   -- Should show one row for your test account
  ```
4. Verify RLS is working:
  ```sql
   set local "request.jwt.claims" = '{"user_id":"<your-clerk-id>","role":"authenticated"}';
   set local role authenticated;
   select public.current_user_id();   -- should return your internal users.id
   select * from public.recipes;      -- should return [] (no recipes yet, not an error)
   reset role;
  ```

