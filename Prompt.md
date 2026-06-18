# Recipe App — Full UI Design Prompt

## Tech Stack (apply to ALL screens)
- **Framework**: Expo SDK 52+ with TypeScript
- **Navigation**: Expo Router (file-based routing inside `app/` directory)
- **Animations**: `react-native-reanimated` — use `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`
- **Blur effects**: `expo-blur` for frosted glass surfaces
- **Fonts**: `expo-font` with `useFonts` hook — load `Cormorant Garamond`, `DM Sans`, `JetBrains Mono` from Google Fonts via `@expo-google-fonts`
- **Styling**: NativeWind v4 (Tailwind for React Native) — use `className` prop; define custom tokens in `tailwind.config.js`
- **Icons**: `@expo/vector-icons` (Ionicons or MaterialCommunityIcons)
- **Safe area**: `react-native-safe-area-context` — wrap all screens in `<SafeAreaView>`
- **Image**: `expo-image` for optimised image loading with blurhash placeholders
- **Haptics**: `expo-haptics` for press feedback on buttons and interactions
- **Components**: Functional components only — no class components. Hooks only.

### Expo Router Folder Structure
```
app/
  _layout.tsx              ← root layout, font loading, SafeAreaProvider
  (onboarding)/
    index.tsx              ← onboarding slides
  (auth)/
    index.tsx              ← sign in / sign up
  (tabs)/
    _layout.tsx            ← bottom tab bar layout
    index.tsx              ← home feed
    search.tsx             ← search
    import.tsx             ← import / fetch (centre tab)
    collections.tsx        ← collections grid
    profile.tsx            ← profile & settings
  recipe/
    [id].tsx               ← recipe detail
  cook/
    [id].tsx               ← cook mode
  shopping.tsx             ← shopping list (pro)

components/
  RecipeCard.tsx
  CollectionCard.tsx
  TagChip.tsx
  TimerWidget.tsx
  IngredientRow.tsx
  StepCard.tsx
  ImportSourceButton.tsx
  ProBadge.tsx
  SkeletonCard.tsx

constants/
  colors.ts                ← Midnight Spice palette as constants
  fonts.ts                 ← font family constants
```

### NativeWind Custom Tokens (add to tailwind.config.js)
```js
colors: {
  noir:      '#1A0A0E',
  burgundy:  '#6B1A2A',
  paprika:   '#C4452A',
  saffron:   '#E8B87A',
  parchment: '#F7F0E6',
  surface:   '#2A1218',
  muted:     '#4A2830',
}
```

---

## Overview
Design a complete, production-grade **React Native mobile app UI** called **"Rasoi"** (placeholder name) — a premium AI-powered recipe fetcher and manager. The app lets users import recipes from URLs and social media, save and organise them, and cook with step-by-step guidance.

Design **every screen and route** listed below as individual React Native components with full visual fidelity. Use the design system specified below consistently across all screens.

---

## Design System

### Colour Palette — "Midnight Spice"
```
--color-noir:       #1A0A0E   (primary background, dark surfaces)
--color-burgundy:   #6B1A2A   (primary brand, CTAs, active states)
--color-paprika:    #C4452A   (accent, badges, highlights)
--color-saffron:    #E8B87A   (secondary accent, icons, warm highlights)
--color-parchment:  #F7F0E6   (light text, card text on dark)
--color-surface:    #2A1218   (card backgrounds, elevated surfaces)
--color-muted:      #4A2830   (borders, dividers, input backgrounds)
```

### Typography
- **Display / Headings**: `Cormorant Garamond` or `Playfair Display` — editorial, luxury feel
- **Body / UI**: `DM Sans` or `Nunito` — clean, readable on mobile
- **Monospace / Meta**: `JetBrains Mono` — for cook times, nutrition numbers

### Design Personality
- Dark-first (deep noir backgrounds, warm accent pops)
- Editorial luxury — think a premium food magazine adapted for mobile
- Rich textures through layering translucent surfaces, not noise
- Generous whitespace mixed with controlled dense moments (e.g. ingredient lists)
- Micro-interactions on every interactive element: spring animations, haptic-feel presses
- Rounded cards (border-radius: 20px for cards, 12px for chips/badges, 50px for pills)

---

## Screens to Design

### 1. Onboarding (3 slides + CTA)
**Route**: `/onboarding`

- Full-bleed dark screens with a single bold food illustration or abstract food-texture SVG per slide
- Slide 1: "Import from anywhere" — show URL + social icons (TikTok, Instagram, YouTube)
- Slide 2: "Every recipe, beautifully organised" — show a recipe card grid
- Slide 3: "Cook smarter" — step-by-step view with timer
- Bottom: dot pagination, "Next" pill button in burgundy, "Skip" ghost link
- Final screen: two CTAs — "Start Free Trial" (burgundy filled) and "Sign In" (ghost)

---

### 2. Auth Screen
**Route**: `/auth`

- Dark full-screen with the app logo centred top
- Email + password inputs styled with muted border, parchment text
- "Continue with Apple" and "Continue with Google" social auth buttons (dark surface style)
- "Forgot password?" small link
- Toggle between Sign In / Sign Up at the bottom

---

### 3. Home — Recipe Feed
**Route**: `/home`

- Top bar: App logo left, search icon + profile avatar right
- "Good morning, Chef 👋" greeting with date
- **Horizontal scroll section**: "Recently Imported" recipe cards (image, title, cook time)
- **Import CTA Banner**: Prominent pill/card — "Paste a link or share from Instagram" with a paste icon and a camera icon — this is the core action
- **Collections row**: Horizontal scroll of collection chips (Breakfast, Dinner, Quick Meals, etc.)
- **Recipe grid**: 2-column card grid, each card has: food image, title, cook time badge, save icon
- Bottom tab bar: Home, Search, Import, Collections, Profile

---

### 4. Import / Fetch Screen
**Route**: `/import`

- This is the **hero screen** — the app's core feature
- Large text input at top: "Paste a recipe URL..." with a burgundy paste button
- OR section divider
- Social import buttons as large tappable cards:
  - TikTok (with icon)
  - Instagram Reels (with icon)
  - YouTube (with icon)
  - Scan Photo / OCR (camera icon)
- Below: "Recent Imports" — last 3 fetched recipes as small horizontal cards
- Loading state: animated skeleton + "Fetching recipe..." status with a subtle progress bar
- Success state: recipe card preview slides up from bottom with "Save Recipe" CTA

---

### 5. Recipe Detail
**Route**: `/recipe/:id`

- Full-bleed food image hero (with dark gradient overlay at bottom)
- Floating back button top-left, bookmark + share icons top-right
- Scrollable content below the image:
  - Recipe title (large, display font)
  - Meta row: cook time | prep time | servings | difficulty badge
  - Tag chips: cuisine type, dietary tags (Vegan, Spicy, etc.)
  - Serving adjuster: "−  2  +" with live ingredient scaling
  - **Ingredients tab / Steps tab** toggle
  - Ingredients: checklist-style with quantity, auto-scaled
  - Steps: numbered with inline timers
- Sticky bottom bar: "Start Cooking" button (full-width burgundy)

---

### 6. Cook Mode
**Route**: `/cook/:id`

- Immersive full-screen, screen-always-on
- One step visible at a time, large readable text
- Step number / total in top-right (e.g. "Step 2 of 7")
- Ingredient callout card mid-screen (highlighted ingredients for this step)
- Timer widget (if step has a timer): circular progress, tap to start/pause
- Swipe left/right or prev/next buttons to navigate steps
- Bottom: "Mark Done" button, progress bar across all steps

---

### 7. Search
**Route**: `/search`

- Full-screen search input, auto-focused, with voice input icon
- Filter chips below: cuisine, dietary, cook time, ingredients
- Results as a card list (image left, title + meta right)
- "No results" empty state with a warm illustration and "Try importing it" CTA
- Recent searches as chips

---

### 8. Collections
**Route**: `/collections`

- Grid of collection cards, each with: collage of 4 recipe thumbnails, collection name, recipe count
- "+" FAB to create a new collection
- Collection detail screen (drill-down): full recipe grid inside that collection

---

### 9. Shopping List
**Route**: `/shopping`

- **(Pro feature — shown with a lock/blur for free users)**
- Grouped ingredient list by category (Produce, Dairy, Pantry, etc.)
- Checkboxes to tick off items while shopping
- "Add from Recipe" CTA at the bottom
- Strikethrough + muted style for checked items

---

### 10. Profile & Settings
**Route**: `/profile`

- Avatar circle + name + email
- Usage meter: "7 of 10 free recipes used" with a progress bar
- **Upgrade CTA card**: Midnight Spice gradient, "Go Pro — Unlimited Recipes" with price
- Settings rows: Notifications, Account, Help, Sign Out
- Version number at bottom

---

## Component Library to Build

Build these as reusable components used across all screens:

- `RecipeCard` — image, title, cook time, save button
- `CollectionCard` — 4-image collage, name, count
- `TagChip` — dietary/cuisine badge
- `TimerWidget` — circular countdown
- `IngredientRow` — checkbox, quantity, ingredient name
- `StepCard` — step number, instruction, optional timer
- `ImportSourceButton` — icon + label, large tappable card
- `BottomTabBar` — Home, Search, Import, Collections, Profile
- `ProBadge` — lock icon + "Pro" label for gated features
- `SkeletonCard` — loading placeholder

---

## Behaviour Notes

- All screens use the dark "Midnight Spice" theme by default
- All modals and sheets slide up from the bottom (bottom sheets)
- Toast notifications appear at the top (success: saffron, error: paprika)
- Empty states always include a warm illustration and an actionable CTA — never just "Nothing here"
- Pro-gated features show a blurred/locked version, not a hard block — the user can see what they're missing
- Animations: use `react-native-reanimated` for spring-based transitions

---

## Output Format

For each screen, output:
1. The full React Native component code
2. Any screen-specific StyleSheet
3. Notes on any third-party library used (react-native-reanimated, expo-blur, etc.)

Start with the component library first, then build each screen in the order listed above.






# Rasoi — Agent Log

## Current Status (as of 2026-06-03)

**Completed through:** Phase 3, Step 11 (client import hook) + import-pipeline hardening (X-Clerk-Token auth, Supadata transcripts)
**Next step:** Phase 4, Step 12 — Recipe summarisation Edge Function (`supabase/functions/ai-summarise/index.ts`)
**Note:** `Agent.md` is the live navigation guide and is kept current; this build log is the chronological history.
**Full roadmap:** see `backend-roadmap.md`

### Tech stack (locked — do not change)
- **Auth**: `@clerk/clerk-expo` — ClerkProvider, useSignIn, useSignUp, useAuth, useUser
- **Database + Storage**: Supabase (PostgreSQL + Supabase Storage)
- **AI**: OpenRouter API — default `meta-llama/llama-3.3-70b-instruct`, fallback `google/gemini-2.5-flash`
- **Payments**: Razorpay (INR, freemium gating)
- **Backend API**: Supabase Edge Functions (Deno)
- **Import sources**: URL scraper + YouTube transcript ONLY (no TikTok, no Instagram)

### Security constraints (always enforce)
- OpenRouter API key: server-side Edge Function env vars ONLY — never in the client bundle
- `SUPABASE_SERVICE_ROLE_KEY`: auto-available in Edge Functions — do NOT set it manually, never put it in `.env.local`
- All AI calls via OpenRouter — never direct Anthropic API
- No TikTok or Instagram import. (Instagram was built then **removed entirely on 2026-06-17** — recipes were unclear and ~99% of users only use YouTube; TikTok was never built. The slide/button descriptions below are the frozen original design and still mention them — they are NOT current.)

### Manual prerequisites still pending before full smoke test
1. Apply `supabase/migrations/0001_initial_schema.sql` then `0002_rls_policies.sql` via `supabase db push` or Supabase Dashboard SQL Editor
2. Create `supabase` JWT template in Clerk Dashboard (see `README.md` for exact steps)
3. `.env.local` must have all three vars: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Until Step 7 lands, `public.users` is empty → `current_user_id()` returns NULL → all per-user queries return empty

---

## 2026-06-03 — Foundation Setup

Set up the foundation files for the Rasoi recipe app. No screens generated yet.

### Files created

- **`constants/colors.ts`** — Midnight Spice palette exported as a typed `Colors` const (noir, burgundy, paprika, saffron, parchment, surface, muted) plus a `ColorKey` type.

- **`constants/fonts.ts`** — `Fonts` const mapping semantic names to the `@expo-google-fonts` family identifiers for Cormorant Garamond (display), DM Sans (body), and JetBrains Mono (mono). Includes weight variants (regular / medium / semibold / bold where available).

- **`tailwind.config.js`** — NativeWind v4 config with:
  - `content` globs for `app/**` and `components/**`
  - `nativewind/preset`
  - Midnight Spice colours under `theme.extend.colors`
  - Font families mapped to the same Google Font identifiers used in `constants/fonts.ts`
  - Custom `borderRadius` tokens: `card` (20px), `chip` (12px), `pill` (50px)

---

## 2026-06-03 — Onboarding Screen

- **`app/(onboarding)/index.tsx`** — 3-slide horizontal pager.
  - `AnimatedFlatList` (`pagingEnabled`) with `useAnimatedScrollHandler` feeding `scrollX` shared value for real-time dot interpolation.
  - **Slide 1 — "Import from anywhere"**: muted URL bar + TikTok/Instagram/YouTube social icon chips + arrow hint + mini recipe card preview.
  - **Slide 2 — "Every recipe, beautifully organised"**: 2×2 grid of skeleton recipe cards with saffron cook-time badges.
  - **Slide 3 — "Cook smarter"**: StepCard mockup with burgundy active border, step badge, instruction text, and a saffron timer ring.
  - **Dot pagination**: animated using `interpolate` on `scrollX` — active dot expands from 6 → 20 px width, inactive fades to 0.35 opacity.
  - **Slide 1–2 footer**: single burgundy pill "Next" button with arrow icon + "Skip" ghost text top-right.
  - **Slide 3 footer**: two CTAs — "Start Free Trial" (burgundy filled pill) + "Sign In" (muted ghost pill).
  - Both primary buttons have spring scale press animation; "Skip" / "Sign In" route to `/(auth)`.
  - Headline in Cormorant Garamond Bold 34 px, subtitle in DM Sans Regular 15 px muted.

## 2026-06-03 — Navigation Wiring & Mock Data

### New file
- **`constants/mockData.ts`** — single source of truth for all mock content.
  - 8 full `Recipe` objects with realistic titles, Unsplash image URIs, cuisine, difficulty, cook/prep time, servings, tags, source, full `Ingredient[]` (quantity + unit + name), and `Step[]` (instruction + optional `timerSeconds` + per-step `ingredients` string array).
  - 4 `Collection` objects with `recipeIds[]` referencing recipe IDs.
  - Typed exports: `Recipe`, `Ingredient`, `Step`, `Collection`.
  - Helper functions: `getRecipeById(id)`, `getCollectionById(id)`, `getRecipesForCollection(collection)`.
  - Convenience re-exports: `RECENT_RECIPES` (first 3), `GRID_RECIPES` (recipes 3–6).

### New screen
- **`app/collections/[id].tsx`** — collection detail drill-down: 2-col `RecipeCard` grid (staggered `FadeInDown`), back/more header, save state per recipe, empty state with "Import a Recipe" CTA. Registered in `_layout.tsx` with `slide_from_right`.

### Files updated
- **`app/_layout.tsx`** — auth stubs flipped to `true` (dev mode: app starts at `/(tabs)`). Added `collections/[id]` Stack.Screen.
- **`app/(tabs)/index.tsx`** — removed inline `RECENT_RECIPES`/`GRID_RECIPES`; imported from `mockData`.
- **`app/(tabs)/search.tsx`** — removed inline `ALL_RECIPES`; maps `RECIPES` from mockData (derives `diet` from `tags`).
- **`app/(tabs)/collections.tsx`** — removed inline collection array; uses `COLLECTIONS` from mockData. Wired `CollectionCard.onPress` → `router.push('/collections/${item.id}')`.
- **`app/(tabs)/import.tsx`** — removed inline `RECENT_IMPORTS`/`PREVIEW_RECIPE`; derives from mockData recipes (source domains cycle over 3 platforms).
- **`app/(tabs)/profile.tsx`** — added "Features" section with a "Shopping List → Pro" row that navigates to `/shopping`.
- **`app/recipe/[id].tsx`** — removed hardcoded `RECIPE` const; now calls `getRecipeById(id) ?? FALLBACK_RECIPE` inside the component body so every recipe navigated to renders its own data.
- **`app/cook/[id].tsx`** — removed hardcoded `COOK_STEPS`; resolves `recipe = getRecipeById(id) ?? RECIPES[0]`, uses `recipe.steps` and `recipe.title`. Top bar recipe title is now dynamic.
- **`app/shopping.tsx`** — "Add from Recipe" button now routes to `/(tabs)/collections` instead of `router.back()`.

### Full navigation map (post-wiring)
```
/(onboarding)   → /(auth)  [skip / next / sign-in]
/(auth)         → /(tabs)  [sign in / create account]
/(tabs)/index   → /recipe/:id, /(tabs)/import, /(tabs)/search, /(tabs)/collections, /(tabs)/profile
/(tabs)/search  → /recipe/:id, /(tabs)/import
/(tabs)/import  → /recipe/:id (success sheet save/view)
/(tabs)/collections → /collections/:id
/collections/:id    → /recipe/:id
/recipe/:id     → /cook/:id  [Start Cooking]
/(tabs)/profile → /shopping, /(auth)  [Sign Out]
```

## 2026-06-03 — Cook Mode Screen

- **`app/cook/[id].tsx`** — immersive single-step cooking view.
  - **`useKeepAwake()`** prevents the screen from sleeping while the user is cooking.
  - **Top bar**: close button (left), centred eyebrow "COOK MODE" + recipe title, "1 / 6" step counter pill (right).
  - **Progress bar** (3 px saffron, animated `withTiming(400ms)` from `progressPct`).
  - **Step pips row**: tappable dots — current step shows as a paprika 18 px stadium, completed steps in saffron, others muted. Tap pip = jump to that step.
  - **Swipe gesture**: `Gesture.Pan()` from `react-native-gesture-handler` with `activeOffsetX([-12, 12])` so vertical scrolls inside cards don't get intercepted. Live drags translate the step card; subtle 4° rotate via `interpolate(translateX, [-SCREEN, 0, SCREEN], [-4, 0, 4])` plus opacity fade. Resistance factor of 0.3 when at the boundary. On release: if past `SWIPE_THRESHOLD` (25% screen width), card animates fully off-screen then resets — `runOnJS(triggerSwipe)` flips the step index mid-animation. Otherwise springs back to 0.
  - **Step content**: burgundy 40 px badge with mono step number, 20 px Cormorant Garamond body instruction with 30 px line-height for readability across the room.
  - **Ingredient callout**: surface card with saffron "FOR THIS STEP" eyebrow; ingredient pills wrapped in a `flexWrap` row.
  - **`CookTimer`** (only when step has `timerSeconds`):
    - 200 px SVG ring (saffron → paprika when done), 44 px mono `MM:SS` display, contextual label ("Cooking…" / "Paused" / "Time's up!").
    - Three-button control row: reset, big burgundy play/pause (64 px with paprika shadow), spacer.
    - Spring scale callback chain on the primary button — taps feel weighted.
    - Reaches zero → `Haptics.notificationAsync(Success)` + auto-stops.
  - **Bottom bar**: prev/next chevron circles flanking a burgundy "Mark Done" pill (paprika "Finish Cooking" on the last step). Nav buttons disable + dim at boundaries.
  - **Swipe hint**: small pill ("Swipe to navigate") fades in after 800 ms on the first step and out when the user moves on.
  - Tick interval cleans up on unmount and on step change; timer state resets per step so navigating away mid-bake doesn't poison the next step.

## 2026-06-03 — Recipe Detail Screen

- **`app/recipe/[id].tsx`** — full-bleed scroll-driven detail screen.
  - **`useAnimatedScrollHandler`** feeds a single `scrollY` shared value that drives every chrome animation.
  - **Hero image (380 px)** with parallax — `translateY` scales `[-100, 0, HERO_HEIGHT * 0.6]` against `scrollY`, and pulling down (`scrollY < 0`) scales the image up to 1.4× (rubber-band overscroll effect). Bottom gradient overlay (`expo-linear-gradient`) blends transparent → 40% noir → solid noir so the title sits cleanly on the body.
  - **Source badge** anchored on top of the hero — saffron link icon + URL in mono.
  - **Floating top buttons** (back left, bookmark + share right): circular pills with `rgba(26,10,14,...)` background opacity that interpolates 0.55 → 0.95 as the hero scrolls away, giving them a "stick to the bar" feel. Spring scale on press.
  - **Sticky top bar**: noir-backed bar with hairline bottom border whose opacity interpolates 0 → 1 over the same range; recipe title fades + translates in from below 10 px so it slots into place as the hero scrolls past.
  - **Title block**: 30 px Cormorant Garamond Bold title; meta row with saffron icons (cook time / prep time / difficulty), separated by 3 px muted dots.
  - **Tag chips**: cuisine uses `variant="cuisine"`, dietary tags use `variant="dietary"`, rest are default.
  - **Servings adjuster**: surface card with "−  N  +" — burgundy circular buttons, number scales 1 → 1.15 → 1 via `withSpring` callback chain on each adjust. Clamps to [1, 20].
  - **Live ingredient scaling**: `useMemo` recomputes `scaledQuantity = quantity * (servings / defaultServings)`; `formatQuantity` helper renders common fractions (¼, ½, ¾, ⅓, ⅔) and strips trailing decimals.
  - **Tab switcher**: surface pill with a burgundy spring-translating thumb (50% width); each option shows label + a count chip (active count chip flips to saffron bg / noir text).
  - **Ingredients view**: wraps `IngredientRow`s in a surface-bordered card; check state lives in a local `Set<string>` so it persists while toggling tabs.
  - **Steps view**: list of `StepCard`s; tapping a card sets it as `isActive` (passes to `StepCard` so the burgundy border + opacity transitions kick in).
  - **Sticky bottom**: "Start Cooking" burgundy pill with flame + arrow icons, paprika shadow on iOS / elevation 6 on Android; gradient fade from transparent → noir sits above it to soften the seam between scroll content and the sticky bar. Routes to `/cook/:id`.
  - Body uses `marginTop: -32` to pull the title block up over the gradient seam for a more editorial feel.

## 2026-06-03 — Import Screen

- **`app/(tabs)/import.tsx`** — the hero screen.
  - **State machine** (`idle` | `loading` | `success`): drives which sections render. A `setTimeout` simulates a 2.8 s fetch then transitions to `success`; cancel returns to `idle`.
  - **Header**: saffron mono eyebrow "IMPORT", display title "Add a recipe", muted subtitle.
  - **URL input row**: `<UrlInputRow>` — `link-outline` leading icon, focus animates the border from muted → burgundy via shared value; trailing slot swaps between "Paste" pill button (idle/empty) and a burgundy arrow fetch button (when URL is present). Paste uses `Clipboard.getString()`.
  - **OR divider**: hairline + "OR IMPORT FROM" in mono caps — hidden during loading.
  - **Social import buttons**: 4× `<ImportSourceButton>` (TikTok #69C9D0, Instagram #E1306C, YouTube #FF0000, Scan Photo saffron). Tapping any one simulates a fetch with a mock URL.
  - **Recent Imports**: horizontal row of `<RecentImportCard>` (200 px wide; thumbnail left, source icon + domain + title + saffron cook-time pill right). Cards stagger in with `FadeInDown.delay(i * 80)`.
  - **Loading state** (`<LoadingOverlay>`):
    - Replaces the idle sections; surface card with burgundy border.
    - Pulsing paprika dot (`withRepeat` 1 → 1.3 scale, infinite).
    - URL preview in saffron mono.
    - Saffron progress bar animates 0 → 0.9 over 2.5 s with `Easing.out(cubic)`.
    - Stage label cycles every 800 ms through `FETCH_STAGES` (Reading → Extracting → Parsing → Almost done), each transition uses `FadeIn` via key change.
    - Animated skeleton card (image + 2 text lines + 2 pill placeholders) using a `SkeletonShimmer` helper that pulses opacity 1 ↔ 0.35 infinitely.
    - "Cancel" link clears state.
  - **Success sheet** (`<SuccessSheet>`):
    - Slides up via `withSpring` on `translateY` from `SCREEN_HEIGHT` → 0; scrim fades in with `withTiming`.
    - Drag handle, burgundy check circle, "Recipe imported" + source URL.
    - Recipe preview card: hero image (160 px) with saffron cook-time pill overlay, display-font title, meta dots row, 3 tag chips.
    - Action bar: "Discard" ghost (1× flex) + "Save Recipe" burgundy pill with bookmark icon (2× flex).
    - Tapping the scrim or Discard returns to idle; Save routes to `/recipe/:id`.

## 2026-06-03 — Profile Screen

- **`app/(tabs)/profile.tsx`**
  - **Avatar**: 64 px burgundy circle with initials in Cormorant Garamond Bold; small muted camera badge bottom-right (with surface border to "punch" it off the card).
  - **Identity card**: surface rounded card — name, email, plan badge. Free plan = muted outline pill "Free Plan"; Pro = saffron filled pill with star icon + "Pro".
  - **Usage meter** (free only): surface card, `used / limit` count in JetBrains Mono (saffron → paprika when ≥70%), 6 px progress bar animated with `withTiming(700ms)`, warning hint text when near limit.
  - **Upgrade CTA** (free only): delegates to `<ProBadge variant="banner">` — reuses the existing component.
  - **Settings sections** (Account, App, Support, Sign Out): each section is a surface rounded card with hairline dividers inset to align under text (not the icon). Rows use `FadeInDown` with staggered delays (60 ms increments). Each row has a spring scale on press.
  - Destructive row ("Sign Out") — paprika label, `paprika22` (8% opacity) icon background, no chevron. Routes to `/(auth)` on press.
  - All rows have `sublabel` optional prop for secondary detail text in muted 12 px.
  - Version string `Rasoi v1.0.0` centred at bottom in JetBrains Mono muted.
  - `isPro` stub flag — flip to `true` to hide usage meter and upgrade card, show Pro plan badge.

## 2026-06-03 — Shopping List Screen

- **`app/shopping.tsx`**
  - **Pro gate**: `isPro` flag (stub, wire to real auth later). When `false`, a `<ProGate>` layer renders above the list — `BlurView` (intensity 28, tint dark) on iOS; semi-transparent noir fallback on Android. `<ProBadge variant="lock">` fills the overlay (shake + warning haptic on tap); `<ProBadge variant="banner">` sits pinned above the bottom edge for the upgrade CTA.
  - **Header**: back chevron (surface rounded square), "Shopping List" title + inline PRO pill, item counter in JetBrains Mono, `⋯` more button.
  - **Progress bar**: 3 px track (muted), saffron fill animated with `withTiming(400ms)` reacting to `checkedItems / totalItems` ratio.
  - **Groups** (`Produce`, `Dairy`, `Pantry`, `Spices`): each renders as a surface-coloured rounded card. `CategoryHeader` shows a category icon in a noir square, label, `x/y` count, and a chevron that spring-rotates 0↔180° on collapse/expand. Uses `IngredientRow` component (checkbox, strikethrough, saffron quantity) for each item.
  - Toggle item checked state updates the group in local `useState`; progress bar and counter react immediately.
  - **Sticky bottom bar**: "Add from Recipe" full-width burgundy pill, absolute-positioned above the list with a hairline top border + noir bg.
  - `pointerEvents` managed carefully so the pro gate intercepts all touches when locked, but the underlying list remains visible through the blur for the "you can see what you're missing" UX from `Prompt.md`.

## 2026-06-03 — Collections Screen

- **`app/(tabs)/collections.tsx`**
  - 2-column `FlatList` (`numColumns={2}`) of `CollectionCard`; each card staggered in with `FadeInDown.delay(index * 60).springify()`.
  - Header row: "Collections" display title left, collection count in JetBrains Mono right.
  - **FAB**: burgundy circle (58 px), paprika drop shadow. Icon springs to 45° on press-in (`rotate` shared value via `withSpring`) and snaps back on press-out — giving a clear "opening" affordance. Hidden when list is empty (empty state has its own CTA instead).
  - **New Collection modal**: `Modal transparent` with a noir semi-transparent overlay (`0.72` opacity). Bottom sheet slides in via `withSpring` scale + `withTiming` opacity on `visible` change. Contains: drag handle, title, subtitle, text input (auto-focused, `returnKeyType="done"`), Cancel ghost + Create burgundy pill buttons. Create button is 0.45 opacity disabled until name is non-empty.
  - Creating a collection prepends it to state with 0 recipes and empty image slots.
  - **Empty state**: circular surface icon, display headline, body copy, "Create your first collection" burgundy pill — same `openModal` path as the FAB.
  - List has `paddingBottom: 100` to clear the FAB.

## 2026-06-03 — Search Screen

- **`app/(tabs)/search.tsx`**
  - TextInput auto-focuses on mount (100 ms `setTimeout` to avoid mount-race on iOS).
  - Search bar: leading search icon, trailing mic icon (idle) / clear ✕ (when query non-empty), spring scale on focus.
  - **Filter toggle button**: right of the search bar; toggles a 3-row expandable panel via `withSpring` height + `withTiming` opacity. Button bg switches to burgundy when open.
  - **Filter panel** (3 rows — Cuisine, Dietary, Cook time): each row is a horizontal `FlatList` of `TagChip`s. Active chip uses `variant="active"`; dietary row defaults to `variant="dietary"`. Filters are combinable — all applied simultaneously via `filtered()` memoised with `useCallback`.
  - **Idle state** (empty query): recent search chips in a `flexWrap` row; tapping a chip sets the query.
  - **Results list**: `ResultRow` — 72 px rounded image left, title (Cormorant Garamond) + saffron cook-time pill + cuisine string + optional `<TagChip variant="dietary">` right; `FadeIn` + `Layout.springify()` on each row; hairline separator inset to align with text.
  - **Empty state** (query typed, 0 results): circular surface plate illustration with saffron + paprika sparkle icons at corners; "No recipes found" headline; "Try importing it" burgundy pill button with `withSpring` scale + routes to `/(tabs)/import`.

## 2026-06-03 — Home Feed Screen

- **`app/(tabs)/index.tsx`**
  - Top bar: flame logo mark + "Rasoi" wordmark left; search icon + circular avatar right, both routed to their tabs.
  - Time-aware greeting ("Good morning/afternoon/evening, Chef 👋") + formatted date in muted body text.
  - **Recently Imported**: horizontal `FlatList` of `RecipeCard` (180 px wide each); renders 3 `SkeletonCard`s when `isLoading`.
  - **Import CTA Banner**: `ImportBanner` component — burgundy card with decorative off-screen circles (paprika + saffron tints), clipboard + camera icon buttons, spring scale on press, routes to `/(tabs)/import`.
  - **Collections filter row**: horizontal `ScrollView` of `TagChip`s (`COLLECTION_TAGS`); active chip uses `variant="active"` (burgundy fill); tap updates `activeTag` state + `Haptics.selectionAsync`.
  - **Recipe grid**: 2-column `flexWrap` layout of `RecipeCard`; card width calculated as `(SCREEN_WIDTH − 48 − 12) / 2` for precise gutters; renders `SkeletonCard` grid when loading.
  - Save state managed locally via `Set<string>` — toggled by `RecipeCard.onSavePress`.
  - All navigation calls use `router.push`; recipe cards route to `/recipe/:id`.

## 2026-06-03 — Auth Screen

- **`app/(auth)/index.tsx`** — Sign in / sign up screen.
  - `KeyboardAvoidingView` + `ScrollView` so the form clears the keyboard on both platforms.
  - **Logo**: saffron flame icon in a surface-coloured rounded square + "Rasoi" in Cormorant Garamond Bold.
  - **Mode toggle pill**: sliding burgundy thumb animates between "Sign In" and "Sign Up" via `withSpring` on `translateX`; active label turns parchment.
  - **Form fields**: surface bg, muted border that highlights to burgundy on focus; leading Ionicons icon per field; show/hide toggle on the password field.
  - Sign-up mode reveals a "Full name" field above email.
  - "Forgot password?" right-aligned saffron link (sign-in mode only).
  - **Primary button**: full-width burgundy pill; spring scale on press; invalid submission (empty fields) triggers a horizontal shake via `withSequence` + `Haptics.notificationAsync(Error)`.
  - **Divider**: hairline with "or" centred.
  - **Social buttons**: "Continue with Apple" and "Continue with Google" — surface bg, muted border, spring scale per button.
  - **Switch link** at bottom: muted prompt + saffron bold link to toggle mode.
  - On successful submit navigates to `/(tabs)` — real auth logic is a stub.

- **`app/_layout.tsx`** — Root layout for Expo Router:
  - Loads all Google Fonts via `useFonts`
  - Holds the splash screen until fonts are ready (`SplashScreen.preventAutoHideAsync` / `hideAsync`)
  - Wraps the tree in `SafeAreaProvider` and a noir-backgrounded `View`
  - Renders an Expo Router `<Stack>` with `headerShown: false` and noir content background
  - Declares routes: `(onboarding)`, `(auth)`, `(tabs)`, `recipe/[id]`, `cook/[id]`, `shopping`
  - **Auth flow gating** via an `<AuthGate />` component that reads `useSegments()` and redirects:
    - No onboarding complete → `/(onboarding)`
    - Onboarded but not authenticated, trying to access protected routes → `/(auth)`
    - Onboarded and authenticated, sitting on onboarding/auth → `/(tabs)`
  - `useIsAuthenticated` and `useHasCompletedOnboarding` are stubbed (`false`) — to be wired to real auth/storage state later.

### Not yet done

- No screens or route files beyond `_layout.tsx`
- `package.json`, `app.json`, `babel.config.js`, `metro.config.js`, `global.css` not created
- Dependencies (`expo-router`, `nativewind`, `react-native-reanimated`, `expo-blur`, `expo-image`, `expo-haptics`, `react-native-safe-area-context`, `@expo-google-fonts/*`, `@expo/vector-icons`) not installed
- Auth/onboarding state hooks are placeholders

---

## 2026-06-03 — Component Library (batch 1)

Built the first three reusable UI components. All source Midnight Spice colours from `constants/colors.ts` and fonts from `constants/fonts.ts`.

### Files created

- **`components/RecipeCard.tsx`**
  - Props: `id`, `title`, `imageUri`, `blurhash`, `cookTime`, `isSaved`, `onPress`, `onSavePress`, `style`
  - `expo-image` with blurhash placeholder, `contentFit="cover"`
  - Saffron cook-time pill badge (bottom-left, JetBrains Mono font)
  - Bookmark icon (top-right) toggles saffron when saved; triggers `Haptics.impactAsync`
  - Spring scale animation on press-in/out via `react-native-reanimated`

- **`components/SkeletonCard.tsx`**
  - Matches the dimensions of `RecipeCard` (140 px image area + text block)
  - Uses a `SkeletonPulse` sub-component: opacity pulses 1 → 0.35 with `withRepeat` + `withTiming`
  - Two title-line placeholders of varying widths beneath the image block

- **`components/TagChip.tsx`**
  - Props: `label`, `variant` (`default` | `active` | `dietary` | `cuisine`), `onPress`, `style`
  - Variant colour map: default (surface bg / parchment text), active (burgundy fill), dietary (saffron outline), cuisine (paprika outline)
  - Spring scale on press; `Haptics.selectionAsync` on tap
  - 12 px border-radius (matches `chip` token in `tailwind.config.js`)

### Remaining components (not yet built)
_(none — component library complete)_

---

## 2026-06-03 — Component Library (batch 2)

- **`components/IngredientRow.tsx`**
  - Props: `quantity`, `unit`, `name`, `isChecked`, `onToggle`, `style`
  - Animated checkbox: spring scale pop on tap, burgundy fill when checked, custom SVG-style checkmark built from two rotated `View`s
  - Strikethrough: animated `width` overlay grows from 0 → 100% via `withTiming` on check
  - Text opacity fades to 0.4 when checked
  - Quantity displayed right-aligned in JetBrains Mono / saffron

- **`components/TimerWidget.tsx`**
  - Props: `totalSeconds`, `remainingSeconds`, `isRunning`, `onToggle`, `onComplete`, `style`
  - SVG circular progress ring via `react-native-svg` `AnimatedCircle`; progress arc uses `strokeDashoffset` animated with `withTiming`
  - Track ring in muted, progress arc in saffron (switches to paprika at 0)
  - Centre shows `MM:SS` in JetBrains Mono Bold + contextual micro-label (tap to start / tap to pause / done)
  - Spring scale pulse on every tap; `runOnJS(onComplete)` fires when remaining hits 0
  - Stateless: parent owns `remainingSeconds` and `isRunning`

---

## 2026-06-03 — Component Library (batch 3)

- **`components/ImportSourceButton.tsx`**
  - Props: `label`, `sublabel`, `iconName`, `iconLib` (`ionicons` | `material`), `iconColor`, `onPress`, `style`
  - Full-width tappable card (surface bg, muted border); icon sits in a noir rounded square on the left, chevron on the right
  - On press-in: spring scale to 0.96 + border animates from muted → burgundy via `borderOpacity` shared value
  - `Haptics.impactAsync(Medium)` on tap; supports both `Ionicons` and `MaterialCommunityIcons`

- **`components/CollectionCard.tsx`**
  - Props: `name`, `recipeCount`, `imageUris` (tuple of up to 4), `blurhashes`, `onPress`, `style`
  - 2×2 collage of `expo-image` slots with a 1.5 px gap; empty slots render a muted placeholder
  - Recipe count displayed in JetBrains Mono saffron beneath the collection name
  - Spring scale on press-in/out; `Haptics.impactAsync(Light)` on tap
  - Note: gradient scrim stub left for screens to overlay with `expo-linear-gradient` if needed

- **`components/ProBadge.tsx`**
  - Three variants via a single `variant` prop:
    - `inline` — small saffron pill with lock icon + "PRO" mono text; use inline beside feature labels
    - `lock` — absolute-fill semi-transparent noir overlay with a burgundy lock circle; tapping triggers a horizontal shake animation (`withSequence`) + `Haptics.notificationAsync(Warning)`
    - `banner` — full-width burgundy CTA card with decorative off-screen circles, saffron PRO badge, display-font title, and a ghost arrow button; spring scale on press
  - All variants share the saffron/noir colour language from the Midnight Spice palette

### Component library status: COMPLETE
All 10 components from `Prompt.md` are built.

---

## 2026-06-03 — Tab Bar Layout

- **`app/(tabs)/_layout.tsx`** — Expo Router `<Tabs>` shell.
  - Five tabs in order: `index` (Home), `search`, `import`, `collections`, `profile` — order matches `Prompt.md` so Import sits dead-centre.
  - Noir tab bar (`Colors.noir`) with a hairline muted top border, iOS shadow lift, safe-area-aware bottom padding via `useSafeAreaInsets`.
  - `tabBarActiveTintColor` = burgundy, inactive = muted. Labels in DM Sans Medium 10 px with letter-spacing.
  - **Standard tabs** use a `<TabIcon>` wrapper that:
    - Toggles between outline / filled Ionicons (`home` / `search` / `bookmark` / `person`)
    - Spring-scales the icon to 1.08 when focused
    - Reveals a small paprika dot under the icon when active (opacity + scale animated together)
  - **Centre Import tab** uses `tabBarButton` to render an `<ImportTabButton>`:
    - 62 px burgundy circle, raised 22 px above the bar with a 4 px noir border (creates the "punched-out" look)
    - Paprika-tinted iOS shadow for the floating effect; Android `elevation: 8`
    - Inner translucent parchment ring for editorial polish
    - Icon flips from `add` → `sparkles` when active; subtly shrinks while focused
    - Spring scale + `Haptics.impactAsync(Medium)` on press
  - Tab screen files (`index.tsx`, `search.tsx`, `import.tsx`, `collections.tsx`, `profile.tsx`) are NOT yet created — Expo Router will warn until they exist.

- **`components/StepCard.tsx`**
  - Props: `stepNumber`, `totalSteps`, `instruction`, `timerSeconds`, `isActive`, `style`
  - Owns timer state locally (`remaining`, `isRunning`) via `setInterval`; resets when `timerSeconds` prop changes (new step)
  - Active card: burgundy border + full opacity; inactive: muted border + 0.55 opacity, scaled to 0.97 — transitions via `withSpring` / `withTiming`
  - Embeds `<TimerWidget />` when `timerSeconds` is set; tap resets + restarts if timer has completed
  - Step badge: burgundy circle with mono step number; paprika active dot when `isActive`

---

## 2026-06-03 — Backend Phase 1: Auth (Clerk) — Steps 1–3

Backend roadmap kicked off. Clerk wired in as the auth provider, with persistent sessions, real sign-in/sign-up/verify flows, and route protection driven by Clerk's session state.

### Step 1 — ClerkProvider + token cache

- **`lib/auth/tokenCache.ts`** (new) — implements Clerk's `TokenCache` interface against `expo-secure-store`. `getToken` / `saveToken` / `clearToken` all wrap `SecureStore` calls in try/catch and swallow failures so a corrupt keychain never crashes auth.
- **`app/_layout.tsx`** — root tree wrapped with `<ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>`. All existing font/splash logic preserved.
- **`.env.local`** (new) — placeholder `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Real key replaces placeholder before first run.
- **`app.json`** — `expo-secure-store` plugin auto-added by `npx expo install`; `extra.clerkPublishableKey` exposed for EAS builds.
- **Install**: `npx expo install @clerk/clerk-expo expo-secure-store`.

### Step 2 — Sign-in / sign-up / verify screens

All four files match the Midnight Spice palette (`Colors.noir` bg, `Colors.burgundy` primary, `Colors.saffron` links, `Colors.paprika` errors). Buttons use `expo-haptics`; errors trigger a horizontal shake via `withSequence` + `Haptics.notificationAsync(Error)`. Inputs use the same focus-border-burgundy pattern as the original placeholder auth screen.

- **`app/(auth)/_layout.tsx`** (new) — `<Stack>` with `headerShown: false`, `Colors.noir` background, fade animation.
- **`app/(auth)/sign-in.tsx`** (new) — email + password via `useSignIn()`. On `result.status === 'complete'` calls `setActive({ session: createdSessionId })` then `router.replace('/(tabs)')`. Clerk API errors are surfaced via `isClerkAPIResponseError(err)` and rendered inline. Loading state shows an `ActivityIndicator` inside the primary button. Footer has `<Link href="/(auth)/sign-up">` to switch screens.
- **`app/(auth)/sign-up.tsx`** (new) — name + email + password via `useSignUp()`. Splits the name field into `firstName` / `lastName` before calling `signUp.create()`. On success calls `prepareEmailAddressVerification({ strategy: 'email_code' })` and pushes to `/(auth)/verify`.
- **`app/(auth)/verify.tsx`** (new) — 6 individual OTP boxes in a `flexDirection: 'row'`. `inputRefs` array auto-advances focus on input, retreats on backspace, and supports paste (single field receives the full code, splits across boxes). Submits via `signUp.attemptEmailAddressVerification({ code })`. "Resend code" link re-calls `prepareEmailAddressVerification`.
- **`app/(auth)/index.tsx`** — converted from the old combined auth screen to a `<Redirect href="/(auth)/sign-in" />` shim. Old code preserved by being moved to the new sign-in/sign-up files.

### Step 3 — Protected routes + splash gating

- **`hooks/useProtectedRoute.ts`** (new) —
  - Reads `isLoaded` and `isSignedIn` from `useAuth()`.
  - If `!isLoaded`, returns early (splash is still covering UI).
  - If `isSignedIn` and on the `(auth)` segment, `router.replace('/(tabs)')`.
  - If not signed in and not on a public segment, `router.replace('/(auth)/sign-in')`.
  - Public segments are `(auth)` AND `(onboarding)` — keeps the existing onboarding flow reachable pre-auth (extends the literal spec to avoid regressing onboarding).

- **`app/_layout.tsx`** — Refactored:
  - Removed old stub `useIsAuthenticated` / `useHasCompletedOnboarding` and the `<AuthGate>` component.
  - Split into `RootLayout` (top-level, owns fonts + `ClerkProvider`) and `RootNavigator` (inside `ClerkProvider`, calls `useProtectedRoute()` + reads `useAuth().isLoaded`).
  - Splash now hidden only when **both** fonts loaded **and** Clerk `isLoaded` is `true`. While either is pending, `RootNavigator` returns `null` so the splash image stays on screen — no flash of the wrong-state UI before redirect.
  - `fontsReady` derived as `fontsLoaded || !!fontError` so a font fetch failure doesn't permanently freeze the splash.

- **`app/(tabs)/_layout.tsx`** — Imported `useAuth` from `@clerk/clerk-expo`; gated the layout with `if (!isLoaded || !isSignedIn) return null` before rendering `<Tabs>`. Defense in depth in case the root redirect hook hasn't fired yet on a deep link or back-navigation.

- **`app/(auth)/_layout.tsx`** — already created in Step 2 with `headerShown: false` + `Colors.noir` background; no changes needed for Step 3.

### Notes for testing Phase 1

- Cold-launch while signed out → lands on `/(auth)/sign-in` with no tab flash.
- Sign up → email code lands in inbox → enter 6-digit code → `setActive` → tabs.
- Kill app & reopen → session persisted via `expo-secure-store` → straight to tabs.
- Sign-out is wired (see below): Profile → Sign Out calls `useAuth().signOut()` and the protected-route hook bounces back to `/(auth)/sign-in`.
- `.env.local` must contain a real `pk_test_...` key from Clerk Dashboard → API Keys before any of this works.

### Step 3 follow-up — Sign-out wiring

- **`app/(tabs)/profile.tsx`** — imported `useAuth` from `@clerk/clerk-expo`. Added `handleSignOut`: warning haptic → `await signOut()` → `router.replace('/(auth)/sign-in')`. The explicit replace is a snappier UX; `useProtectedRoute` is the safety net if it ever no-ops. The Sign Out row's `onPress` now points at `handleSignOut`.
- Identity strings on the Profile screen (`"Chef Kavin"`, hardcoded email) are still mock data — they'll be hydrated from `useUser()` in a future pass.

### Missing peer deps (Clerk Expo SDK)

`@clerk/clerk-expo` lazy-imports a few optional Expo modules; Metro fails to bundle if they're missing. Resolved by installing both:

- `npx expo install expo-web-browser` — needed by `ClerkProvider` (used for hosted OAuth flows even when only email/password is enabled in the dashboard).
- `npx expo install expo-auth-session expo-crypto` — needed by `useSSO` (re-exported from the package index, so the import chain pulls them in even though we don't call the hook).

`app.json` now has the `expo-secure-store` and `expo-web-browser` config plugins.

---

## 2026-06-03 — Backend Phase 1: Auth (Clerk) — Step 4

Wired Clerk JWTs through to a fresh Supabase client so future RLS policies can read `auth.jwt() ->> 'user_id'`.

### Step 4 — Clerk → Supabase JWT bridge

- **Install**: `npx expo install @supabase/supabase-js react-native-url-polyfill`. The polyfill is imported once at the top of `lib/supabase/client.ts` (`import 'react-native-url-polyfill/auto'`) so `URL.parse` works in Hermes.

- **`lib/supabase/client.ts`** (new) —
  - Exports `createSupabaseClient(getToken: () => Promise<string | null>)`.
  - Builds a `@supabase/supabase-js` client with `global.fetch` overridden by `authedFetch`: each request awaits `getToken()`, sets `Authorization: Bearer <token>`, and forwards to the platform `fetch`. Failures from `getToken` are swallowed so anon requests still work pre-sign-in.
  - Supabase's own auth machinery is disabled (`persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`) — Clerk owns the session, Supabase just verifies the JWT signature.
  - Module emits a `console.warn` (not a throw) on import if env vars are missing — surfaces misconfiguration loudly without blowing up Hermes startup.

- **`hooks/useSupabaseClient.ts`** (new) —
  - Returns a memoised Supabase client whose `getToken` fetches the Clerk template named `supabase` (`getToken({ template: 'supabase' })`).
  - `useMemo` is keyed on `userId` so the client is rebuilt on sign-in / sign-out / account switch; between user changes the same instance is reused.
  - `getToken` is captured fresh inside the closure on every request (Clerk's `getToken` reads the live session), so a stale closure can't leak an old token.

- **`.env.local`** — appended `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` placeholders. Service role key is **not** in `.env.local` — it goes in Supabase Edge Function env vars only.

- **`app.json`** — `extra` now exposes `supabaseUrl` and `supabaseAnonKey` via `$(EXPO_PUBLIC_SUPABASE_*)` substitution so EAS builds pick them up from the build-time env.

- **`README.md`** (new) — documents:
  - Stack overview + pointer to `backend-roadmap.md`.
  - Local setup with the three required env vars (Clerk + Supabase URL + Supabase anon key).
  - **Setup → Clerk JWT template** section with exact dashboard steps: create a template named `supabase`, HS256 signing, secret = Supabase JWT Secret (legacy), claims `{ aud, role: "authenticated", user_id: "{{user.id}}", email: "{{user.primary_email_address}}" }`, 60s lifetime.
  - "Verifying the bridge" — a 4-line `supabase.from('users').select(...)` smoke test plus what the expected errors mean (`relation does not exist` = auth works, table missing; `JWT expired` or `permission denied` = template claims wrong).

### What's still needed before Step 5

1. Create Supabase project → copy URL + anon key into `.env.local`.
2. In Clerk dashboard, create the `supabase` JWT template (instructions in `README.md`).
3. From Supabase **Project Settings → API → JWT Settings**, paste the JWT Secret into the Clerk template's signing key field.
4. Restart Metro with `npx expo start --clear` so the new env vars are picked up.

Once those four manual steps are done, the client side is fully wired — the next step (Phase 2, Step 5) lands the SQL schema and RLS policies. **No tests possible until then**; the JWT bridge has no observable side-effect on its own.

---

## 2026-06-03 — Backend Phase 2: Database — Step 5

Initial Postgres schema for Supabase. Six tables, indexes, and triggers for `updated_at` + default-subscription bootstrap.

### Step 5 — Initial schema migration

- **`supabase/migrations/0001_initial_schema.sql`** (new) — verbatim SQL from the roadmap:
  - Extensions: `uuid-ossp` (UUID v4), `pg_trgm` (trigram search on `recipes.title`).
  - **`public.users`** — mirror of Clerk identities. `clerk_user_id` is the join key for RLS; unique-indexed (`idx_users_clerk_id`). `email` also unique.
  - **`public.recipes`** — owned by users (`on delete cascade`). Ingredients + steps stored as `jsonb` for schemaless edits; `tags text[]` for fast multi-value filter. Indexes: user lookup (`idx_recipes_user_id`), GIN on `tags`, GIN-trigram on `title` (powers fuzzy search). `source_type` constrained to `url | youtube | manual`. `storage_path` reserved for the Phase 6 image upload step.
  - **`public.collections`** — recipe folders per user.
  - **`public.collection_recipes`** — many-to-many join table (composite PK on `(collection_id, recipe_id)`).
  - **`public.shopping_list_items`** — per-user; `recipe_id` is nullable + `on delete set null` so deleting a recipe doesn't wipe the user's shopping list.
  - **`public.subscriptions`** — one-row-per-user (UNIQUE on `user_id`). `plan_id` constrained to `free | premium_monthly | premium_yearly`, `status` to `active | cancelled | paused | past_due | expired`. `recipe_count` is the freemium gate counter (Step 9 increments it on each import; Step 17's paywall reads it).
  - **`set_updated_at()`** trigger fn attached to users, recipes, collections, subscriptions — single source of truth for write timestamps.
  - **`create_default_subscription()`** AFTER INSERT trigger on `public.users` — every new user row auto-gets a free, active subscription row. This means `import-url` / `import-youtube` Edge Functions can safely `select recipe_count from subscriptions where user_id = ?` without first having to upsert.

- **`supabase/seed.sql`** (new) — placeholder. The roadmap calls for it in the "Creates" list but the default-subscription trigger handles per-user setup and Clerk webhooks (Step 7) will populate `public.users`. Body is comment-only; reserved for local fixture data later.

### Applying the migration

Supabase CLI is **not yet installed locally** (`which supabase` returns nothing). Two paths to apply the schema:

**Option A — install the CLI (recommended, matches the roadmap):**
```bash
brew install supabase/tap/supabase
supabase login                                  # browser auth
supabase link --project-ref <project-ref>       # the slug from EXPO_PUBLIC_SUPABASE_URL
supabase db push                                # applies 0001_initial_schema.sql
```

**Option B — paste into the dashboard:**
1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste the entire contents of `supabase/migrations/0001_initial_schema.sql`.
3. Run. Verify under **Table Editor**: `users`, `recipes`, `collections`, `collection_recipes`, `shopping_list_items`, `subscriptions` should all appear.

### Verification

After applying, the smoke test from `README.md` should now return `{ data: [], error: null }` (empty array, no error) instead of `relation "public.users" does not exist`. **Note**: this only works *after* Step 6 lands RLS policies — until then the anon Supabase JS client will hit a default-deny when RLS is enabled by default. If you skip ahead and try to query before Step 6, the RLS-default behaviour will return empty arrays on selects and silent failures on inserts.

### Why no RLS in this migration

RLS policies are deliberately split into Step 6 (`0002_rls_policies.sql`) so:
- The schema migration stays focused and reviewable.
- A botched RLS policy can be reverted independently of the table definitions.
- The Clerk webhook (Step 7) can be tested against the raw tables briefly before RLS locks them down.

---

## 2026-06-03 — Backend Phase 2: Database — Step 6

Row Level Security policies locked down to the Clerk JWT.

### Step 6 — RLS policies tied to Clerk JWT

- **`supabase/migrations/0002_rls_policies.sql`** (new) —

  **Helper function** — `public.current_user_id() returns uuid`:
  - Reads `auth.jwt() ->> 'user_id'` (the Clerk template's `user_id` claim) and resolves it to the internal `public.users.id` UUID.
  - `language sql stable` — Postgres can inline + memoise within a single statement.
  - `security definer` — runs as the function owner so it can read `public.users` even when the caller's RLS would normally restrict it. This is the standard Supabase pattern for JWT-claim → row-id helpers.
  - `set search_path = ''` — forces every identifier in the body to be schema-qualified (`public.users`, not `users`). Defends against the search-path injection class where an attacker can shadow `public` with a malicious schema. Recommended by the Supabase security team.

  **RLS enabled on all six tables**: `users`, `recipes`, `collections`, `collection_recipes`, `shopping_list_items`, `subscriptions`.

  **Per-table policy shape**:
  - **`users`** — `SELECT` + `UPDATE` self only (`clerk_user_id = auth.jwt() ->> 'user_id'`, no helper call to avoid a chicken-and-egg loop on the users table itself). INSERT/DELETE deliberately omitted — those happen via Clerk webhook with the service role key.
  - **`recipes`** — full CRUD gated on `user_id = public.current_user_id()`.
  - **`collections`** — full CRUD gated on `user_id = public.current_user_id()`.
  - **`collection_recipes`** — join-table; full CRUD gated on parent collection ownership via subquery: `collection_id in (select id from public.collections where user_id = public.current_user_id())`. This is the only table whose policy isn't a flat column compare — it derives access from the parent row.
  - **`shopping_list_items`** — full CRUD gated on `user_id = public.current_user_id()`.
  - **`subscriptions`** — `SELECT` only. Plan changes, status updates, and `recipe_count` increments all come from Edge Functions using `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely.

  All UPDATE policies pair `using (...)` (gates which rows are visible to update) with `with check (...)` (gates the post-update row state) so a user can't move a recipe to another user's account by changing `user_id` mid-update.

### Verification once applied

In the Supabase SQL editor (which uses the service role, so RLS is off) you can simulate a Clerk-signed request:

```sql
-- Pretend to be a Clerk JWT for user with clerk_user_id = 'user_abc'
set local "request.jwt.claims" = '{"user_id":"user_abc","role":"authenticated"}';
set local role authenticated;
select * from public.recipes;          -- should only see rows for that user
select public.current_user_id();       -- should return that user's internal id
reset role;
```

A cross-user leak would show up as rows belonging to a different `user_id` appearing in the select — that's the failure case to watch for.

### Apply order

`0002_rls_policies.sql` must run **after** `0001_initial_schema.sql` (table dependency). With the Supabase CLI, `supabase db push` runs them in filename order automatically. If pasting into the dashboard, paste 0001 first, then 0002.

### Open follow-ups (resolved in Step 7)

- `public.users` is now populated by the Clerk webhook. The JWT smoke test from `README.md` will return a real row after the first sign-up.

---

## 2026-06-03 — Backend Phase 2: Database — Step 7

Clerk webhook Edge Function: the critical missing piece that populates `public.users` and makes the entire auth → database pipeline functional.

### Step 7 — Clerk webhook → upsert user row

- **`supabase/functions/_shared/cors.ts`** (new) — shared CORS headers for all Edge Functions. Exports a single `corsHeaders` object (`Access-Control-Allow-Origin: *` + standard header allowlist + POST/GET/OPTIONS methods). Every function imports this for preflight responses.

- **`supabase/functions/clerk-webhook/index.ts`** (new) — Deno Edge Function. Key design decisions:

  **Signature verification**: reads the raw body as text *before* any parsing (Svix verifies the exact bytes; `req.json()` first would corrupt the signature check). Extracts `svix-id`, `svix-timestamp`, `svix-signature` headers. Missing any of them → 401. `new Webhook(WEBHOOK_SECRET).verify(rawBody, headers)` → throws on invalid → 401.

  **No Supabase JWT verification**: deployed with `--no-verify-jwt`. Authentication is entirely the Svix HMAC signature; the Supabase JWT middleware is disabled at the edge. This is the correct pattern for any server-to-server webhook.

  **Event handlers**:
  - `user.created` / `user.updated` → `supabase.from('users').upsert({ clerk_user_id, email, display_name, avatar_url }, { onConflict: 'clerk_user_id' })`. Primary email resolved by matching `data.primary_email_address_id` against `data.email_addresses[]`. Falls back to `email_addresses[0]` if the ID match fails. Returns 422 if no email can be extracted at all (defensive against unexpected Clerk payload shapes).
  - `user.deleted` → `delete().eq('clerk_user_id', data.id)`. The `ON DELETE CASCADE` constraints in the schema propagate the delete to recipes, collections, subscriptions, and all child rows — no manual cleanup needed.
  - Unknown event types → silently return 200 (forward-compatible with future Clerk events we haven't subscribed to yet).

  **Service role client**: `createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })`. Service role bypasses RLS — this is what allows the webhook to INSERT into `public.users` even though the RLS policy only allows the service role to do so. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the Supabase runtime; never set them manually.

  **`display_name`**: joins `first_name + last_name`, filters nulls, falls back to `null` if both are absent. This drives the profile screen's name display once `useUser()` is wired to real data.

  **`avatar_url`**: Clerk's `image_url` stored directly. No re-upload to Supabase Storage at this stage (that's Phase 6).

- **`README.md`** (new — was missing from Step 4) — full setup guide with all manual steps:
  - Stack table + `backend-roadmap.md` pointer
  - Local setup (env vars, install, Metro)
  - Clerk JWT template (exact dashboard steps from Step 4)
  - Supabase schema (CLI + dashboard options)
  - Clerk webhook (deploy, register endpoint, set secret)
  - Edge Function secrets cheat sheet (all secrets across all phases)
  - End-to-end smoke test sequence

### Deploy

```bash
supabase functions deploy clerk-webhook --no-verify-jwt
supabase secrets set CLERK_WEBHOOK_SECRET=whsec_...
```

### Why this step unblocks everything

Before Step 7: `public.users` was always empty → `public.current_user_id()` returned NULL → every RLS policy rejected every request → the app was completely non-functional against the real database.

After Step 7: sign up in the app → Clerk fires `user.created` → webhook upserts the row → `current_user_id()` resolves → all RLS policies activate → the full JWT bridge (Steps 4–6) is live.

### Smoke test sequence (full Phase 2 verification)

1. Sign up in the app.
2. Check Clerk Dashboard → Webhooks → Logs: `user.created` should show HTTP 200.
3. Supabase SQL Editor:
   ```sql
   select * from public.users;           -- one row
   select * from public.subscriptions;   -- one row (free plan, from the trigger in Step 5)
   ```
4. RLS test:
   ```sql
   set local "request.jwt.claims" = '{"user_id":"<clerk-id>","role":"authenticated"}';
   set local role authenticated;
   select public.current_user_id();      -- your internal users.id
   select * from public.recipes;         -- [] with no error
   reset role;
   ```

---

## 2026-06-06 — Backend Phase 3: Import Pipeline — Step 8

Shared OpenRouter client utility — the single AI call wrapper every import / AI Edge Function builds on.

### Step 8 — OpenRouter shared client

- **`supabase/functions/_shared/openrouter.ts`** (new) —
  - **`callOpenRouter<T>({ model?, fallbackModel?, systemPrompt, userPrompt, responseFormat?, maxTokens? })`** — POSTs to `https://openrouter.ai/api/v1/chat/completions`.
    - Headers: `Authorization: Bearer ${OPENROUTER_API_KEY}`, `HTTP-Referer` (`OPENROUTER_REFERER` env, falls back to `https://rasoi.app`), `X-Title: Rasoi`.
    - `model` defaults to `meta-llama/llama-3.3-70b-instruct`; `fallbackModel` to `google/gemini-2.5-flash`.
    - When `responseFormat === 'json'`, sends `response_format: { type: 'json_object' }` and `JSON.parse`s the assistant message before returning. Otherwise returns the raw text.
    - 30 s timeout via `AbortController`. On **any** non-2xx or timeout, retries **once** with `fallbackModel`. If the fallback also fails, the error propagates.
  - **`OpenRouterError`** — typed error carrying `status` + `body`, thrown by `callModel` on non-2xx responses.
  - **`RecipeJSON`** — the canonical extraction shape: `title`, `description`, `ingredients[{name, quantity, unit?}]`, `steps[{order, instruction}]`, `cookTime|null`, `prepTime|null`, `servings|null`, `tags[]`, `imageUrl|null`.
  - **`RECIPE_EXTRACTION_SYSTEM_PROMPT`** — the verbatim culinary-data-extractor prompt constant from the roadmap (JSON-only output, integer-minute or null times, 3–6 lowercase one-word tags).

### Notes

- No deploy on its own — it's a shared module pulled in by `import-url` (Step 9), `import-youtube` (Step 10), `ai-summarise` (Step 12), `tagging` (Step 13), `ai-nutrition` (Step 14). Extended in Step 14 with optional `images[]` for vision calls.
- Requires the `OPENROUTER_API_KEY` Edge Function secret before any consumer works (see roadmap "Edge Function secrets" cheat sheet).

---

## 2026-06-06 — Backend Phase 3: Import Pipeline — Step 9

URL scraper Edge Function: fetch an arbitrary recipe page, strip it to text, run it through OpenRouter, persist the structured recipe.

### Step 9 — URL scraper Edge Function

- **`supabase/functions/import-url/index.ts`** (new) — `POST { url: string }` with `Authorization: Bearer <Clerk supabase JWT>`.

  **Request flow:**
  1. **Input validation** — parses JSON body; rejects `400 invalid_json` / `400 invalid_url` (must be a well-formed `http`/`https` URL).
  2. **JWT verification** — `jose` (`https://deno.land/x/jose@v5.9.6`) `jwtVerify` against `createRemoteJWKSet(CLERK_JWKS_URL)`. The JWKS set is created once at module scope so warm invocations reuse the cached keys. Pulls the `user_id` claim (the Clerk `supabase` template claim). `401 missing_token` / `401 invalid_token` on failure.
  3. **User resolution** — service-role client (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, both runtime-injected) looks up `public.users.id` by `clerk_user_id`. `401 user_not_found` if the webhook hasn't provisioned the row yet.
  4. **Freemium gating** — reads `subscriptions.plan_id` + `recipe_count`; if `plan_id === 'free'` and `recipe_count >= 10` → `402 { error: 'limit_reached' }`. (`FREE_RECIPE_LIMIT = 10`.)
  5. **Page fetch** (`fetchPage`) — realistic Chrome `User-Agent`, `redirect: 'follow'`. Rejects `422` for `fetch_failed`, `fetch_status_<n>`, `not_html` (content-type must include `text/html`), or `page_too_large` (>2 MB, checked on the decoded `arrayBuffer` byte length).
  6. **HTML stripping** (`stripHtml`) — removes `<script>/<style>/<nav>/<header>/<footer>` (with inner text), strips remaining tags, decodes common entities (`&nbsp; &amp; &quot; &#39; &lt; &gt;`), collapses whitespace. `extractMeta` pulls `og:image` + `og:title` (handles both `property|name`-first and `content`-first attribute orders). Text truncated to 8000 chars; `og:title` prepended to the user prompt as a hint.
  7. **Extraction** — `callOpenRouter<RecipeJSON>` with `RECIPE_EXTRACTION_SYSTEM_PROMPT`, `responseFormat: 'json'`. Any throw (OpenRouter HTTP error, timeout, or JSON parse failure) → `422 extraction_failed`.
  8. **Image fallback** — `recipe.imageUrl ?? ogImage ?? null`.
  9. **Insert** — into `public.recipes` with `source_type: 'url'`, `source_url: <input>`, mapping `cookTime→cook_time_minutes`, `prepTime→prep_time_minutes`, `imageUrl→image_url`, etc. `.select().single()` returns the inserted row. DB failure → `500 insert_failed`.
  10. **Counter increment** — `subscriptions.recipe_count = sub.recipe_count + 1` (reuses the value already loaded in the gating query). Failure here is **non-fatal** (logged only) — the recipe is already saved.

  **Error model:** `400` bad input · `401` unauth/unprovisioned · `402` freemium limit · `422` page-not-usable / extraction failure · `500` DB / unexpected. CORS headers from `_shared/cors.ts` on every response incl. the `OPTIONS` preflight; non-POST → `405`.

### Deploy

```bash
supabase functions deploy import-url
```

Requires secrets `OPENROUTER_API_KEY`, `OPENROUTER_REFERER` (optional), and `CLERK_JWKS_URL` (`https://<clerk-domain>/.well-known/jwks.json`). `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

### Note for Step 10

Step 10 (YouTube) will factor JWT verification (`_shared/auth.ts`) and freemium gating (`_shared/gating.ts`) out of this function so both importers share them — `import-url` should be refactored to consume those helpers at that point. Step 13 (auto-tagging) and Step 19 (image upload) will also touch this file.

---

## 2026-06-06 — Backend Phase 3: Import Pipeline — Step 10

YouTube transcript Edge Function + shared-helper refactor.

- **`_shared/http.ts`** (new) — `HttpError(status, body)`, `json()`, `errorResponse()`. Shared helpers throw `HttpError`; the handler's outer catch converts it to a response.
- **`_shared/auth.ts`** (new) — `verifyClerkToken` (Clerk JWKS, reads `sub`), `resolveUserId`, `authenticateRequest`. Centralises JWKS verification (lazy JWKS singleton + issuer check).
- **`_shared/gating.ts`** (new) — `enforceFreemiumGate` (402 at the cap; premium plans skip the limit) + best-effort `incrementRecipeCount`.
- **`_shared/recipes.ts`** (new) — `insertRecipe` (RecipeJSON → `recipes` row), shared by both importers.
- **`import-youtube/index.ts`** (new) — `POST {url}`: validate video id (`watch?v=`/`youtu.be`/`/shorts/`/`/embed/`) → auth → gate → transcript (head+tail cap 12k) → oEmbed title/thumb → `callOpenRouter` → `insertRecipe` (`source_type='youtube'`) → increment.
- **`import-url/index.ts`** — refactored onto the shared helpers (dropped its inline jose/JWKS, gating, insert, and local `json`).

## 2026-06-06 — Backend Phase 3: Import Pipeline — Step 11

Client import hook (TanStack Query).

- **`lib/api/import.ts`** (new) — `importFromUrl` / `importFromYouTube` / `importRecipe` (auto-routes by host) → Edge Functions; typed `FreemiumLimitError` (402 → paywall), `ImportError`, `RecipeRow`.
- **`hooks/useImportRecipe.ts`** (new) — `useMutation` wrapping `importRecipe`, invalidates the `['recipes']` query on success.
- **`app/_layout.tsx`** — added `QueryClientProvider` (one module-level client) inside `ClerkProvider`.
- **`app/(tabs)/import.tsx`** — wired the real hook into the Import screen, replacing the simulated `setTimeout`; the success sheet now renders the AI-extracted recipe. (Beyond the literal Step-11 spec, so the pipeline is testable end-to-end.)
- Install: `@tanstack/react-query`.

## 2026-06-07 — Phase 3 hardening: auth + YouTube transcript

The first real end-to-end imports surfaced two production issues, both now fixed:

1. **Clerk → Edge Function auth.** Supabase's edge gateway rejects an asymmetric Clerk JWT in the `Authorization` header (`UNAUTHORIZED_ASYMMETRIC_JWT`) even with the legacy "Verify JWT" toggle OFF. Resolution:
   - Import functions deploy with **`--no-verify-jwt`**; they self-verify via Clerk JWKS.
   - The client sends Clerk's **default** session token (`getToken()`, no template) in an **`X-Clerk-Token`** header + the anon key in `apikey` — **never** `Authorization`. `_shared/auth.ts#getBearerToken` reads `X-Clerk-Token` first (falls back to `Authorization` for curl).
   - **`CLERK_JWKS_URL` must be the FULL url** (`https://<domain>/.well-known/jwks.json`) — Clerk's dashboard shows only the bare domain, which breaks `new URL()` + the issuer check.
   - Client → function changes need a **full app reload** (Fast Refresh doesn't reliably pick up `lib/api/*` module changes).

2. **YouTube transcript fetching.** The `youtube-transcript` esm.sh lib fails from the cloud (YouTube IP-blocks datacenter/edge IPs). Fetched via **[transcriptapi.com](https://transcriptapi.com)** (dedicated YouTube transcript API) in **`_shared/transcript.ts`** (`fetchYouTubeTranscript`): `format=text` request → `200` returns the transcript string (1 credit, charged only on success); `404` → no-transcript; `408`/`429`/`503` retried with backoff. Needs `TRANSCRIPTAPI_API_KEY`. _(The import-url web-scrape fallback uses **Supadata** / `SUPADATA_API_KEY` — transcriptapi.com is YouTube-only. Instagram import was removed 2026-06-17.)_

**Status:** Phase 3 (Steps 8–11) code complete and deployed. URL import verified end-to-end; YouTube import pending the transcriptapi.com key + a verification run. Next: Step 12 (`ai-summarise`).

---

## 2026-06-08 — Backend Phase 4: AI Features — Step 12

### Step 12 — Recipe summarisation Edge Function

Created `supabase/functions/ai-summarise/index.ts`. `POST { recipeId }` →

1. `authenticateRequest` (shared Clerk-JWKS auth, `sub` → internal user id).
2. Load the recipe via the service-role client, selecting only `id, user_id, title, ingredients, steps`. `404 recipe_not_found` if missing; `403 forbidden` if `recipe.user_id !== userId`.
3. Build the prompt from the stored shape — ingredient `name`s comma-joined, steps numbered from the `instruction` field (`buildPrompt` tolerates string entries / missing fields so a malformed row never crashes).
4. `callOpenRouter<string>` with **`model: 'google/gemini-2.5-flash'`** primary and **`fallbackModel: 'meta-llama/llama-3.3-70b-instruct'`** — the inverse of the import functions, since summarising is the lighter task. `responseFormat: 'text'`, `maxTokens: 160`.
5. `UPDATE recipes SET ai_summary = <summary> WHERE id = recipeId`; a DB failure returns `500 update_failed` rather than a summary the client thinks was saved. Returns `{ summary }`.

Follows the established Edge Function shape: `OPTIONS` preflight + `corsHeaders`, throw `HttpError`, outer `catch → errorResponse(err, 'ai-summarise')`. Errors: `400` bad/empty `recipeId` · `401` unauth · `403` not owner · `404` missing · `422` summarisation failed / empty.

### Deploy

```bash
supabase functions deploy ai-summarise --no-verify-jwt
```

No new secret — reuses `OPENROUTER_API_KEY` + `CLERK_JWKS_URL`. Verify via the `curl` recipe in `README.md` (Phase 4, Step 12).

### Notes

- No client hook calls this yet — invoking it from the recipe detail screen comes later (alongside the recipes-query hook that replaces `constants/mockData.ts`).
- Deno isn't installed locally, so this wasn't type-checked here; it mirrors the deployed `import-url`/`import-youtube` patterns exactly.

**Status:** Step 12 code complete, **deploy pending**. Next: Step 13 (smart auto-tagging — `_shared/tagging.ts` + a post-extraction pass in both import functions).

---

## 2026-06-08 — Backend Phase 4: AI Features — Step 13

### Step 13 — Smart auto-tagging

Created `supabase/functions/_shared/tagging.ts` exporting `refineTags(recipe: RecipeJSON): Promise<string[]>`:

1. Builds a compact prompt — title + first 25 ingredient names + existing tags — and asks for "4-6 lowercase one-word category tags (cuisine, diet, meal-type, time, difficulty)".
2. Leads with **Gemini Flash** (`google/gemini-2.5-flash`), 70B fallback — same light-task model order as `ai-summarise`. `responseFormat: 'text'`, `maxTokens: 80`.
3. `parseTagArray` robustly extracts the list: bare JSON array, ```json-fenced array, `{ "tags": [...] }` object, or a `[...]` slice out of surrounding prose.
4. `sanitizeTags` lowercases, trims, collapses spaces → hyphen ("30 min" → "30-min"), strips quotes, drops empties / over-long (>24 char) / dupes.
5. Returns existing tags **merged** with the refined ones (`mergeTags`, order-preserving, deduped, capped at 8).
6. **Best-effort:** every failure path (network, bad JSON, empty) returns the recipe's existing tags unchanged — so callers use the result directly with no fallback of their own.

### Wired into both importers

`import-url/index.ts` and `import-youtube/index.ts`: after `callOpenRouter` returns the `RecipeJSON` and before `insertRecipe`, set `recipe.tags = await refineTags(recipe)`. Since `refineTags` is internally non-throwing, this can't break an import.

### Deploy

No new endpoint or secret — redeploy the two importers so they pick up the new pass:

```bash
supabase functions deploy import-url --no-verify-jwt
supabase functions deploy import-youtube --no-verify-jwt
```

**Status:** Step 13 code complete, **redeploy of both import functions pending**. Next: Step 14 (dish photo → nutrition — `ai-nutrition` fn + `lib/api/nutrition.ts` + `hooks/useNutritionAnalysis.ts`).

---

## 2026-06-09 — Backend Phase 4: AI Features — Step 14

> **Scope change:** the original Step 14 (an "what can I cook with these ingredients?" pantry-suggestions function) was built and then **removed at the user's request** before any deploy — `ai-pantry-suggest`, `lib/api/pantry.ts`, `hooks/usePantrySuggestions.ts` were all deleted. Step 14 is now the dish-photo → nutrition feature below. `backend-roadmap.md` Step 14 was rewritten to match.

### Step 14 — Dish photo → nutrition (macros)

**OpenRouter vision support.** Extended `_shared/openrouter.ts`: `CallOptions` gains optional `images?: string[]`. When present, the user message is sent as multimodal content (`[{type:'text', text}, {type:'image_url', image_url:{url}}]`); text-only calls keep `content` as a plain string (backward compatible).

Created `supabase/functions/ai-nutrition/index.ts`. `POST { image, note? }` →

1. Validate `image` — must be a `data:image/...;base64,...` data URL or an http(s) URL (`400 invalid_image`), and ≤ ~5 MB of chars (`400 image_too_large`). Optional `note` trimmed to 300 chars.
2. `authenticateRequest` (shared Clerk-JWKS auth). **No DB write** — stateless analysis (but still requires a provisioned user).
3. `callOpenRouter` with a **vision model** — primary `google/gemini-2.5-flash`, fallback `openai/gpt-4o-mini` — `images: [image]`, `responseFormat: 'text'` (vision models are unreliable with `json_object`), `maxTokens: 700`. `422 analysis_failed` on call failure.
4. `parseResult` tolerantly extracts the JSON object (strips ```` ```json ```` fences / slices the first `{…}`), then `normalize` coerces it: non-negative rounded numbers, `confidence` clamped to low|medium|high, `items` capped at 20, blank strings → null. `422 unparseable_result` if no object found.
5. Returns `{ dish, servingSize, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, confidence, assumptions[], items[] }` for the portion shown. A non-food photo comes back as `dish:null` + zeros + `confidence:'low'` (still a 200).

Same Edge Function shape as the others (OPTIONS + corsHeaders, throw `HttpError`, outer `errorResponse(err, 'ai-nutrition')`).

### Client wiring (Step 11 pattern)

- `lib/api/nutrition.ts` — `analyzeDishPhoto({ image, note }, getToken)` → `NutritionResult`; `NutritionError`, `NutritionResult`/`NutritionItem` types. Same auth as `import.ts`: anon key in `apikey`, Clerk default token in `X-Clerk-Token`. Accepts a data URL or http url string.
- `hooks/useNutritionAnalysis.ts` — TanStack Query `useMutation` (no `onSuccess` invalidation — stateless analysis).
- The capture/resize UI is **not** built yet; the screen will use expo-image-picker/camera + expo-image-manipulator (~768px, JPEG q0.6) to produce the base64 data URL and keep it under the ~5 MB cap.

### Deploy

No new secret — reuses `OPENROUTER_API_KEY` + `CLERK_JWKS_URL` (vision bills against the same key):

```bash
supabase functions deploy ai-nutrition --no-verify-jwt
```

**Status:** Phase 4 (Steps 12–14) **code complete**. The user rotated the OpenRouter key (2026-06-09) and is batching deploys — redeploy `import-url`/`import-youtube` (Step 13) + first-deploy `ai-summarise` (Step 12) + `ai-nutrition` (Step 14), then test. Next: Step 15 (Razorpay create-subscription — Phase 5 begins; needs the Razorpay secrets + two pre-created plans).








---

## 2026-06-09 — Fix: OpenRouter model slug retired (`google/gemini-flash-1.5`)

**Symptom.** YouTube (and any) import failed; logs showed `OpenRouterError: OpenRouter error 404: {"message":"No endpoints found for google/gemini-flash-1.5."}`. In the app the Import screen sat on the "Fetching recipe…" animation for ~a minute before the error alert — the slow failure was the primary model's 30s timeout + the dead fallback stacking up.

**Root cause.** `google/gemini-flash-1.5` was retired from OpenRouter's catalog (confirmed via `GET https://openrouter.ai/api/v1/models` — slug returns nothing). It was our shared **fallback** in `_shared/openrouter.ts` and the **primary** in `ai-summarise`, `_shared/tagging.ts`, and `ai-nutrition`. When extraction's primary (`meta-llama/llama-3.3-70b-instruct`) hiccupped, the retry hit the dead fallback and the whole call threw.

**Fix.**
- Replaced `google/gemini-flash-1.5` → **`google/gemini-2.5-flash`** everywhere (still multimodal for `ai-nutrition`, still JSON-capable). `meta-llama/llama-3.3-70b-instruct` and `openai/gpt-4o-mini` are still valid — unchanged.
- `_shared/openrouter.ts` hardened: (1) the bare `catch` on the primary call now **logs** `[openrouter] primary model "<x>" failed; retrying with "<y>"` so a fallback error never masks the real cause again; (2) JSON parsing is now **tolerant** (`parseJsonResponse`) — strips ```` ```json ```` fences and slices the outer `{…}`/`[…]`, so a slightly-wrapped reply doesn't needlessly force a fallback round-trip.
- The Import screen's error handling was already correct (it shows an "Import failed" alert on throw) — the perceived "stuck" was just the slow failure path, now gone.

**Redeploy:** all four AI-touching functions — `import-url`, `import-youtube`, `ai-summarise`, `ai-nutrition` (all `--no-verify-jwt`). Watch for the new `[openrouter] primary model … failed` line: if it shows on *every* import, the primary (`llama-3.3-70b`) itself needs swapping; if it's silent, primary is fine.

---

## 2026-06-09 — Backend Phase 5: Payments — Step 15

> **⚠️ Superseded the same day by the pricing-model change below** (one-time Orders, not subscriptions). This entry is kept for history — `createSubscription`/`RAZORPAY_PLAN_*`/`razorpay-create-subscription` described here were replaced by `createOrder`/`razorpay-create-order`. See the *Phase 5 reprice* entry at the end.

### Step 15 — Razorpay create-subscription Edge Function

**Shared wrapper.** Created `supabase/functions/_shared/razorpay.ts` — a thin Basic-auth (`btoa("key_id:key_secret")`) REST client over `https://api.razorpay.com/v1`. Exports:

- `createCustomer({ name, email }) → { id }` — `POST /customers` with `fail_existing: 0` (returns the existing customer instead of erroring if one already exists with that email — makes re-entry idempotent).
- `createSubscription({ planId, customerId?, totalCount, notifyEmail? }) → { id, short_url, status }` — `POST /subscriptions`.
- `verifyWebhookSignature(rawBody, signature, secret) → Promise<boolean>` — HMAC-SHA256 (Web Crypto) over the raw body, hex, constant-time compare. **Async** (Step 16 awaits it).
- `RazorpayError(status, body)` — thrown on any API/config/network failure.

> **API gotcha that shaped the design:** Razorpay's create-subscription **does not accept `customer_id`** (confirmed against the live docs) — the customer is auto-attached when they authorize via `short_url`. So we *don't* pass `customer_id` to the subscription call (it would 400). Instead we (a) call `createCustomer` separately and store `razorpay_customer_id` so the Step 16 webhook can reconcile, (b) echo the customer id into `notes` for traceability, and (c) pre-fill the email on the hosted auth page via `customer_notify: 1` + `notify_info.notify_email`.

### The function — `razorpay-create-subscription/index.ts`

`POST { plan: 'monthly' | 'yearly' }` →

1. Validate `plan` (`400 invalid_plan`). `authenticateRequest` (shared Clerk-JWKS auth).
2. Map `plan` → `RAZORPAY_PLAN_MONTHLY` / `RAZORPAY_PLAN_YEARLY` env (`500 plan_not_configured` if unset).
3. Load `users.email` + `display_name` (email is NOT NULL → the Razorpay customer's email; name falls back to the email local-part → `'Rasoi User'`).
4. Load the `subscriptions` row (created by the signup trigger; `500 subscription_not_found` if missing).
5. If `razorpay_customer_id` is null → `createCustomer` and **persist it first** (before creating the subscription, so the webhook has a reconciliation key even if the next write fails; a failed persist here is safe to `500` since no external subscription exists yet).
6. `createSubscription` with `total_count` = **12** (monthly) / **1** (yearly).
7. Persist `razorpay_subscription_id`. **Crucially does NOT touch `plan_id`/`status`** — the user hasn't paid; that upgrade happens on the webhook (Step 16). This write is best-effort (the external subscription already exists, so a failure is logged, not thrown — the webhook can fall back to matching on `razorpay_customer_id`).
8. Return `{ subscriptionId, short_url }` — the client (Step 17) opens `short_url` in a Razorpay checkout WebView.

Razorpay-side failures map to a client-facing `502` (`razorpay_customer_failed` / `razorpay_subscription_failed`) via `mapRazorpayError`, which logs the real Razorpay status + body. Same Edge Function shape as the rest (OPTIONS + corsHeaders, throw `HttpError`, outer `errorResponse(err, 'razorpay-create-subscription')`).

### Deploy

Needs the Razorpay secrets (new this step) + **two pre-created plans** in the Razorpay dashboard:

```bash
supabase secrets set \
  RAZORPAY_KEY_ID=rzp_... \
  RAZORPAY_KEY_SECRET=... \
  RAZORPAY_PLAN_MONTHLY=plan_... \
  RAZORPAY_PLAN_YEARLY=plan_...

supabase functions deploy razorpay-create-subscription --no-verify-jwt
```

(`RAZORPAY_WEBHOOK_SECRET` is also in the secrets list but isn't used until Step 16.) See `README.md` → "Setup → Razorpay subscription" for the dashboard steps + a `curl` verification.

**Status:** Step 15 code complete, **deploy pending** (and needs the Razorpay account set up — plans + keys). No client UI calls it yet (that's Step 17's `PaywallSheet`). Next: Step 16 (Razorpay webhook → verify signature, drive the `subscriptions` state machine, and make the import gating skip the limit for premium plans).

---

## 2026-06-09 — Phase 5 reprice: subscriptions → one-time Lifetime + credits (Steps 14–17 reworked)

The recurring-subscription model (above) was replaced — **before any of it deployed** — with a one-time **Lifetime Unlock** + **consumable credit packs**. This was a multi-system migration on the (already-applied) live schema, so all schema change ships as a **new** migration; `0001`/`0002` were not touched.

### New pricing
- **Free**: 15 saved recipes · unlimited URL imports · **3** YouTube imports/month · no macro scanning.
- **Lifetime Unlock — ₹499 one-time** (Razorpay **Order**): unlimited saves · **20** YouTube imports/month · all non-consumables.
- **YouTube credits — ₹49/10** (consumable): used only after the monthly YouTube allowance.
- **AI credits — ₹99/50** (consumable): the dish-photo macro scanner costs **2/scan**. Recipe summarisation stays free. **Lifetime users are NOT exempt** from consumables.

### Schema — `0003_pricing_model.sql` (NEW; `0001`/`0002` untouched)
- `subscriptions` **renamed** → `entitlements` (semantics fully changed). `plan_id`→`plan` (`free`/`lifetime`), legacy `premium_*` rows migrated to `lifetime`. Added `lifetime_purchased_at`, `youtube_credits`, `ai_credits`, `youtube_imports_this_month`, `youtube_month_anchor`. Dropped `razorpay_subscription_id`/`current_period_end`/`status`. Kept `recipe_count` + `razorpay_customer_id`.
- New `payments` table (one row per Order; SELECT-only RLS). Reworked default-row trigger (seeds `plan='free'`, zeroed credits; same wiring).
- **Service-role-only** credit RPCs `deduct_ai_credits` / `add_credits` (execute revoked from `public`/`anon`/`authenticated`) so a client JWT can't mint credits.
- Idempotent (DO-guard renames; drop-before-create policies/triggers/constraints). **Apply + redeploy all entitlement functions together** (the rename breaks the deployed importers until redeployed).

### Gating — `_shared/gating.ts` rewrite
- `enforceUrlGate` (15-recipe cap; lifetime unlimited) + `incrementRecipeCount`.
- `enforceYouTubeGate` (monthly rollover via anchor → allowance 3/20 → else a `youtube_credit` → else `402 {reason:'youtube_limit'}`) + `consumeYouTubeImport` (consume on success only — a failed import never burns a paid credit).
- `enforceAiCredits` (≥2) + `deductAiCredits` (atomic via RPC, on successful parse). `ai-nutrition` now returns `creditsRemaining`.

### Payments — repurposed Razorpay code
- `_shared/razorpay.ts`: `createSubscription` → **`createOrder`** (`POST /orders`, fixed paise). Kept `createCustomer` + async `verifyWebhookSignature`. Orders don't take `customer_id`.
- `razorpay-create-subscription/` → **`razorpay-create-order/`**: `POST {product}` → fixed price (49900/4900/9900) → Order → `payments` row `created` → `{orderId, amount, currency, keyId}`.
- New **`razorpay-webhook/`**: raw-body HMAC verify → `payment.captured` finds the `payments` row, marks `paid`, grants by product (lifetime→`plan`; yt→+10; ai→+50); `payment.failed`→`failed`. Idempotent (already-`paid` → no-op).

### Client — Step 17
- `lib/api/billing.ts` (`createOrder`), `hooks/useEntitlements.ts` (reads the entitlements row via RLS → flags + `showPaywall`), `components/PaywallProvider.tsx` (mounted in `app/_layout.tsx`), `components/PaywallSheet.tsx` (₹499 Lifetime hero + YT/AI top-ups), `components/RazorpayCheckoutWebView.tsx` (inline checkout.js — **requires `npx expo install react-native-webview`**). `profile.tsx` + `shopping.tsx` `isPro` stubs rewired to `isLifetime`.

**Status:** code-complete, **untested** (Deno not local; RN UI not run). Pending: apply `0003` + redeploy `import-url`/`import-youtube`/`ai-nutrition`/`razorpay-create-order`/`razorpay-webhook`; set `RAZORPAY_KEY_ID`/`KEY_SECRET`/`WEBHOOK_SECRET`; register the webhook; `npx expo install react-native-webview`. Next: Phase 6 (Storage, Step 18).
