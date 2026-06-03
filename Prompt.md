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
Design a complete, production-grade **React Native mobile app UI** called **"Saveur"** (placeholder name) — a premium AI-powered recipe fetcher and manager. The app lets users import recipes from URLs and social media, save and organise them, and cook with step-by-step guidance.

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