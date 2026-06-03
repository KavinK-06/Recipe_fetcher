# Saveur — Agent Log

## 2026-06-03 — Foundation Setup

Set up the foundation files for the Saveur recipe app. No screens generated yet.

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
  - Version string `Saveur v1.0.0` centred at bottom in JetBrains Mono muted.
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
  - Top bar: flame logo mark + "Saveur" wordmark left; search icon + circular avatar right, both routed to their tabs.
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
  - **Logo**: saffron flame icon in a surface-coloured rounded square + "Saveur" in Cormorant Garamond Bold.
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
