# Rasoi — Launch Checklist

Everything still standing between the current build and a store release, grouped by
severity. Derived from a code audit on **2026-06-17**. Check items off as they land.

> **Status key:** `[ ]` to do · `[~]` done in code, needs an ops/deploy step · `[x]` done

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
  - [ ] Swap the placeholder `PRIVACY_URL` / `TERMS_URL` in `app/(tabs)/profile.tsx` for the
    real hosted pages before submitting.

- [x] **Import success buttons** — replaced the misleading "Save Recipe"/"Discard" with
  **Add to Collection** + **View Recipe** (`app/(tabs)/import.tsx`). The import already
  auto-saves, so the old buttons were a no-op. Done.

---

## 🟡 Build & release setup

- [ ] **No `eas.json`.** Can't run a production EAS build without build profiles. Must also
  register the `EXPO_PUBLIC_*` keys (currently only in local `.env.local`) as EAS env/secrets
  so release builds get them.

- [ ] **Finalize app icon / splash.** `assets/images/` still has candidate files
  (`_icon_candidate.png`, `_k.png`, `_kadai.png`, `_locate.png`) next to the real ones. Lock
  the final `icon.png` / `adaptive-icon.png` / `splash.png` and delete the candidates.

- [ ] **Production credentials.** Swap Clerk dev keys → production instance. Confirm Supabase
  prod secrets are set for the Edge Functions: OpenRouter key, Google Play service account
  (for `play-verify-purchase`), Clerk JWKS issuer, and the new `CLERK_SECRET_KEY`.

---

## 🟢 Cleanups (non-blocking)

- [~] **Prefer metric units in extraction.** Prompts updated in
  `supabase/functions/_shared/openrouter.ts` and `supabase/functions/import-photo/index.ts`.
  - [ ] Redeploy to take effect: `supabase functions deploy import-url import-youtube`
    and `supabase functions deploy import-photo --no-verify-jwt`.
  - [ ] (Optional) Backfill existing recipes still stored in pounds.

- [ ] **`backend-roadmap.md` is stale** — still references Razorpay + `llama-3.3-70b` default;
  reality is Google Play billing + `gemini-2.5-flash` default. Update or delete.

- [ ] **Drop the mock-data fallback** in `app/recipe/[id].tsx` and `app/cook/[id].tsx` now
  that every list screen uses real data.

- [ ] **`lib/api/import.ts`** still mentions "summarise" (the `ai-summarise` function was
  deleted) — minor comment leftover.

- [ ] **Delete the removed Instagram function** from the deployed project:
  `supabase functions delete import-instagram`.

---

## 📋 Store / operational (outside the codebase)

- [ ] **Privacy policy URL** — required for the Play Data Safety form and Apple privacy.
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
