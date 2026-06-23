# Rasoi — Launch Checklist

Everything still standing between the current build and a store release, grouped by
severity. Derived from a code audit on **2026-06-17**. Check items off as they land.

> **Status key:** `[ ]` to do · `[~]` done in code, needs an ops/deploy step · `[x]` done

---

# 🚀 First-time launch runbook (Android / Play Store)

A plain-language, do-this-in-order guide. The detailed audit lives in the sections
below this one; this is the "what do I actually click and type" version.

### How the pieces fit (read this once)
Rasoi has 4 moving parts that all need to be in "production" mode:
- **The app** (this Expo project) → built by **EAS** into an `.aab` file → uploaded to **Google Play**.
- **Supabase** → your backend: database + "edge functions" (small server programs that do imports, AI, billing checks, account deletion).
- **Clerk** → handles sign-in. It has a *Development* mode and a *Production* mode; right now you're on Development.
- **Google Play** → the store + the thing that takes payments for your in-app products.

The golden rule for payments confusion: **you must upload a build to Play *before* you can
create in-app products.** That's why Play kept asking for your app. More on that in Phase 4–5.

---

## Phase 1 — Supabase backend (do this first; the app is useless without it)
You said you only imported the edge functions. Functions also need to be *deployed*, the
database needs the *migrations*, and they need *secrets* (API keys) to work.

- [ ] **Install + log in to the CLI:** `npm i -g supabase` then `supabase login`
- [ ] **Link your project:** `supabase link --project-ref <your-ref>`
  (the ref is in your Supabase dashboard URL: `app.supabase.com/project/<ref>`)
- [x] **Push the database schema** — done (tables exist; app runs end-to-end and the `users`
  table populates from the webhook).
- [x] **Deploy all edge functions** — done (deployed with `--no-verify-jwt`).
- [~] **Set the secrets.** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided
  automatically — do **not** set those. You must set these:
  ```bash
  supabase secrets set \
    CLERK_JWKS_URL="https://<your-prod-clerk-domain>/.well-known/jwks.json" \
    CLERK_SECRET_KEY="sk_live_..." \
    CLERK_WEBHOOK_SECRET="whsec_..." \
    OPENROUTER_API_KEY="sk-or-..." \
    SUPADATA_API_KEY="..." \
    TRANSCRIPTAPI_API_KEY="..." \
    GOOGLE_PLAY_PACKAGE_NAME="com.rasoi.myapp" \
    GOOGLE_PLAY_SERVICE_ACCOUNT="$(cat play-service-account.json)"
  ```
  (`CLERK_*` and `GOOGLE_PLAY_*` values come from Phase 2 and Phase 5 — fill them as you go.
  `OPENROUTER_REFERER` is optional. `GOOGLE_PLAY_SERVICE_ACCOUNT` is the whole JSON file.)
  - ✅ Set so far: `CLERK_JWKS_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `OPENROUTER_API_KEY`,
    `SUPADATA_API_KEY`, `TRANSCRIPTAPI_API_KEY`, `GOOGLE_PLAY_PACKAGE_NAME`.
  - ⏳ Still pending: `GOOGLE_PLAY_SERVICE_ACCOUNT` (comes in Phase 5, after the Play setup).
- [ ] **Remove the test bypass secret if it exists:** `supabase secrets unset ALLOW_DEV_GRANT`

## Phase 2 — Clerk: switch from Development to Production keys
Your dev keys (`pk_test_...`) only work for testing and show a warning. A released app needs
the Production instance.

- [x] Created the **Production instance** (using a GoDaddy domain + Clerk DNS records).
- [x] **Secret key** `sk_live_...` → set in Supabase as `CLERK_SECRET_KEY`.
- [x] **JWKS URL** → set in Supabase as `CLERK_JWKS_URL`.
- [x] **Webhook** created → points at the `clerk-webhook` function URL, events `user.created` /
  `user.updated` / `user.deleted`, signing secret set as `CLERK_WEBHOOK_SECRET`.
  **Verified:** creating a real user populates the `users` table. (Clerk's empty "John Doe"
  *test* event returns 422 by design — that's expected, not a failure.)
- [x] **Publishable key** `pk_live_...` → set as the EAS env var `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (Phase 3).
- [x] **Supabase Third-Party Auth** updated to the production Clerk domain (`clerk.boardedge.in`)
  so direct RLS reads verify. **Verified:** app runs end-to-end in Expo Go against production
  (sign-in, recipe + collection reads, imports all working).

## Phase 3 — App config + EAS environment
- [x] `app.json`: package `com.rasoi.myapp`, no `RECORD_AUDIO`, versionCode managed by EAS.
- [x] `eas.json`: build profiles created.
- [x] **Registered the app's 3 public keys with EAS** (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) as **Plain text** production env vars.
- [x] `eas init` done — `extra.eas.projectId` is in `app.json`.

## Phase 4 — First build + upload to Play (this is what unblocks payments)
- [ ] **Build the store file:** `eas build -p android --profile production`
  - Press **Y** at the keystore prompt the first time (generates your signing key once; reused forever — never regenerate it).
  - The result is an **`.aab`** file you can download.
- [ ] In the **Play Console**, create the app (package **`com.rasoi.myapp`** — permanent!) and
  let it enroll in **Play App Signing** (default; recommended).
- [ ] Create an **Internal testing** track and **upload the `.aab`**. Add your own email as a tester.
  - 👉 **This upload is the step that makes in-app products creatable.** Until a build with the
    billing code is on a track, Play won't let you finish creating products.

## Phase 5 — Payments + products (your BillDesk / "asking for app" question)
What you hit is normal. There are two separate things:
1. **Payments profile (the BillDesk/verification flow):** to *receive money*, Google makes you
   set up a payments/merchant profile — tax info, bank account, identity. In India this
   verification runs through Google's local partners (BillDesk is one). It can take a few days;
   start it early. (Play Console → **Setup → Payments profile**.)
2. **Uploading the app:** the reason it asked for your APK/app is Phase 4 — products only exist
   once a build is on a track.

Once **both** the payments profile is active **and** the AAB is uploaded:
- [ ] **Create the in-app products** (Monetize → Products → In-app products), IDs **exactly**:
  - `rasoi_lifetime` → type **one-time / non-consumable**, price **₹299** → **Activate**
  - `rasoi_credits_10` → type **one-time / consumable**, price **₹49** → **Activate**
  - (The app shows Play's real price; `PRODUCT_PRICE_LABEL` in `lib/api/billing.ts` is only a
    fallback and is already set to ₹299 / ₹49 to match.)
- [ ] **Set up server-side purchase verification** (so fake purchases can't unlock Pro):
  - In **Google Cloud Console**: create a **service account**, enable the **Google Play Android
    Developer API**, and download the service account's **JSON key**.
  - In **Play Console → Users & permissions**: invite that service account and give it access to
    your app's financial data / orders.
  - Put the JSON into Supabase as `GOOGLE_PLAY_SERVICE_ACCOUNT` and set
    `GOOGLE_PLAY_PACKAGE_NAME=com.rasoi.myapp`, then redeploy:
    `supabase functions deploy play-verify-purchase --no-verify-jwt`
- [ ] **Add License testers** (Play Console → Settings → License testing) so your test purchases
  aren't charged real money.

## Phase 6 — Test the whole thing end-to-end (on the internal track)
- [ ] Install Rasoi from the **internal testing link** using a tester Google account.
- [ ] Verify: sign-in works, importing a recipe works, calorie scan works, you get **5 free
  credits/month**, and a **test purchase** of Lifetime / credits actually unlocks/adds them.

## Phase 7 — Store listing + required policy forms
- [~] **Privacy policy URL:** `https://kavink-06.github.io/Recipe_fetcher/privacy.html` (paste into the listing).
- [ ] **Data safety form** — declare: email (account), recipe content, photos (calorie scan),
  purchase history; encrypted in transit; account deletion available.
- [ ] **Content rating** questionnaire, **Target audience** (not for children), **Ads** = none.
- [ ] **Store listing assets:** app title, short + full description, **phone screenshots**,
  **feature graphic (1024×500)**, **512×512 icon**, category, contact email.

## Phase 8 — Release
- [ ] Roll out from **Internal → (optional Closed) → Production**, then **submit for review**.
- [ ] First review can take a few days. After approval, you're live. 🎉

---

## 🔴 Hard blockers — store will reject, or the feature is broken

- [~] **In-app account deletion.** Required by both Play and the App Store.
  - Code: **done** — `supabase/functions/delete-account/index.ts`, `lib/api/account.ts`,
    and the "Danger Zone → Delete Account" flow in `app/(tabs)/profile.tsx`.
  - Ops still required:
    - [ ] `supabase secrets set CLERK_SECRET_KEY=sk_live_...` (Clerk Dashboard → API Keys → Secret key)
    - [ ] `supabase functions deploy delete-account --no-verify-jwt`
    - [ ] Confirm the Clerk webhook has the **`user.deleted`** event enabled (handler already exists)

- [ ] **iOS purchase verification is missing.** Only `play-verify-purchase` exists; the
  expo-iap call sends `apple: { sku }` (`components/PlayBillingProvider.tsx`) but there is
  no StoreKit/receipt verifier. **Payments only work on Android today.** Decide one:
    - [ ] **Launch Android-first** (recommended — clean, nothing more to build), or
    - [ ] Build an Apple receipt-verification Edge Function before shipping iOS.

- [ ] **Play Console products created + active** — `rasoi_lifetime` and the credits SKU
  (`lib/api/billing.ts`). IAP returns nothing until these exist and the build is on an
  internal/closed testing track.

---

## 🟠 Visible stubs a user (or reviewer) will hit

- [x] **Share button does nothing.** Removed the `share-social-outline` floating button and
  `handleShare` stub from `app/recipe/[id].tsx`.

- [x] **Save/bookmark button is local-only.** Removed the bookmark floating button, `handleSave`,
  and the `isSaved` state from `app/recipe/[id].tsx` (every imported recipe is already saved).

- [x] **Dead settings rows in Profile.** Removed the non-functional rows (Edit Profile,
  Notifications, Privacy & Security, Appearance, Units & Language, Help & FAQ, Send Feedback,
  Rate Rasoi) and the dead header gear. Wired the store-required links: **Privacy Policy** +
  **Terms of Service** (open in-app via `expo-web-browser`) and **Contact Support** (`mailto:`).
  - [x] Live URLs wired into `app/(tabs)/profile.tsx` (hosted on GitHub Pages, source in `/docs`):
    `https://kavink-06.github.io/Recipe_fetcher/privacy.html` and `.../terms.html`.

- [x] **Import success buttons** — replaced the misleading "Save Recipe"/"Discard" with
  **Add to Collection** + **View Recipe** (`app/(tabs)/import.tsx`). The import already
  auto-saves, so the old buttons were a no-op. Done.

---

## 🟡 Build & release setup

- [~] **EAS build setup.** `eas.json` created with `development` / `preview` / `production`
  profiles (production builds an Android `app-bundle`, auto-increments versionCode). `app.json`
  now has `android.package = com.rasoi.myapp` + `versionCode: 1`.
  - [ ] Run `eas login` → `eas init` (adds `extra.eas.projectId` to app.json).
  - [ ] Register the `EXPO_PUBLIC_*` keys (currently only in local `.env.local`) as EAS env vars
    so release builds get them.

- [ ] **Finalize app icon / splash.** `assets/images/` still has candidate files
  (`_icon_candidate.png`, `_k.png`, `_kadai.png`, `_locate.png`) next to the real ones. Lock
  the final `icon.png` / `adaptive-icon.png` / `splash.png` and delete the candidates.

- [~] **Production credentials.** Clerk swapped to the **production instance** ✓ and its Supabase
  secrets are set (`CLERK_SECRET_KEY`, `CLERK_JWKS_URL`, `CLERK_WEBHOOK_SECRET`) along with
  OpenRouter / Supadata / TranscriptAPI keys. Remaining: the **Google Play service account**
  (Phase 5) and putting `pk_live_...` into the EAS env (Phase 3).


## 📋 Store / operational (outside the codebase)

- [~] **Privacy policy URL** — hosted at `https://kavink-06.github.io/Recipe_fetcher/privacy.html`.
  Still to do: paste it into the Play Data Safety form + App Store Connect App Privacy field.
- [ ] **Store listings** — title, description, keywords, screenshots, feature graphic.
- [ ] **Data Safety / App Privacy questionnaires** filled (declare auth email, recipe data,
  photos used for OCR/calorie scan, purchase data).
- [ ] **Internal/closed testing track** set up to validate IAP end-to-end before production.
- [ ] **Support contact** (email or form) for the listing + the in-app "Help"/"Feedback" rows.

---

### Recently completed this session
- [x] Account deletion flow (code)
- [x] Import success → Add to Collection / View Recipe
- [x] Metric-unit preference in extraction prompts (code)
- [x] Instagram/TikTok import removal + "not supported" messaging
