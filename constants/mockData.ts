// Central mock data. Import from here instead of defining inline per-screen.

export type Ingredient = {
  id: string;
  quantity: number;
  unit?: string;
  name: string;
};

export type Step = {
  id: string;
  text: string;
  timerSeconds?: number;
  ingredients: string[];
};

export type Recipe = {
  id: string;
  title: string;
  imageUri: string;
  blurhash?: string;
  cuisine: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cookTime: string;
  prepTime: string;
  defaultServings: number;
  tags: string[];
  source: string;
  ingredients: Ingredient[];
  steps: Step[];
};

export type Collection = {
  id: string;
  name: string;
  recipeCount: number;
  imageUris: [string?, string?, string?, string?];
  recipeIds: string[];
};

// ── Recipes ────────────────────────────────────────────────────────────────────
export const RECIPES: Recipe[] = [
  {
    id: '1',
    title: 'Cardamom & Saffron Pistachio Cake',
    imageUri: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900',
    cuisine: 'Middle Eastern',
    difficulty: 'Medium',
    cookTime: '55 min',
    prepTime: '20 min',
    defaultServings: 8,
    tags: ['Dessert', 'Baking', 'Vegetarian'],
    source: 'smittenkitchen.com/recipes',
    ingredients: [
      { id: 'i1', quantity: 200, unit: 'g', name: 'Unsalted butter, softened' },
      { id: 'i2', quantity: 200, unit: 'g', name: 'Caster sugar' },
      { id: 'i3', quantity: 4, name: 'Large free-range eggs' },
      { id: 'i4', quantity: 180, unit: 'g', name: 'Self-raising flour' },
      { id: 'i5', quantity: 80, unit: 'g', name: 'Ground pistachios' },
      { id: 'i6', quantity: 1, unit: 'tsp', name: 'Ground cardamom' },
      { id: 'i7', quantity: 0.5, unit: 'tsp', name: 'Saffron threads, bloomed in warm milk' },
      { id: 'i8', quantity: 60, unit: 'ml', name: 'Whole milk' },
      { id: 'i9', quantity: 1, unit: 'tsp', name: 'Rose water' },
      { id: 'i10', quantity: 50, unit: 'g', name: 'Chopped pistachios, to garnish' },
    ],
    steps: [
      { id: 's1', text: 'Preheat oven to 170°C / 340°F. Grease and line a 20 cm round cake tin with parchment paper.', ingredients: ['Cake tin', 'Parchment paper', 'Butter for greasing'] },
      { id: 's2', text: 'Cream butter and sugar together until pale and fluffy.', timerSeconds: 240, ingredients: ['200g unsalted butter', '200g caster sugar'] },
      { id: 's3', text: 'Add eggs one at a time, beating well after each addition. Fold in the flour, ground pistachios, and cardamom.', ingredients: ['4 large eggs', '180g self-raising flour', '80g ground pistachios', '1 tsp cardamom'] },
      { id: 's4', text: 'Stir the bloomed saffron milk and rose water into the batter until just combined. Do not overmix.', ingredients: ['½ tsp saffron in 60ml warm milk', '1 tsp rose water'] },
      { id: 's5', text: 'Pour into the lined tin and bake until a skewer comes out clean.', timerSeconds: 2100, ingredients: ['Cake batter'] },
      { id: 's6', text: 'Cool in tin for 10 minutes, then transfer to a wire rack. Top with chopped pistachios before serving.', timerSeconds: 600, ingredients: ['50g chopped pistachios'] },
    ],
  },
  {
    id: '2',
    title: 'Spiced Lamb Flatbread',
    imageUri: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=900',
    cuisine: 'Middle Eastern',
    difficulty: 'Medium',
    cookTime: '35 min',
    prepTime: '15 min',
    defaultServings: 4,
    tags: ['Dinner', 'High Protein'],
    source: 'bonappetit.com/recipe',
    ingredients: [
      { id: 'i1', quantity: 400, unit: 'g', name: 'Minced lamb' },
      { id: 'i2', quantity: 1, unit: 'tsp', name: 'Ground cumin' },
      { id: 'i3', quantity: 1, unit: 'tsp', name: 'Ground coriander' },
      { id: 'i4', quantity: 0.5, unit: 'tsp', name: 'Smoked paprika' },
      { id: 'i5', quantity: 2, name: 'Garlic cloves, minced' },
      { id: 'i6', quantity: 4, name: 'Flatbreads' },
      { id: 'i7', quantity: 100, unit: 'g', name: 'Greek yoghurt' },
      { id: 'i8', quantity: 1, name: 'Lemon, juice only' },
      { id: 'i9', quantity: 0.5, unit: 'bunch', name: 'Fresh mint leaves' },
      { id: 'i10', quantity: 2, unit: 'tbsp', name: 'Pomegranate molasses' },
    ],
    steps: [
      { id: 's1', text: 'Mix lamb with cumin, coriander, paprika, garlic, salt and pepper. Form into small patties.', ingredients: ['400g minced lamb', '1 tsp cumin', '1 tsp coriander', '½ tsp paprika', '2 garlic cloves'] },
      { id: 's2', text: 'Heat a griddle pan over high heat. Cook patties for 3–4 minutes per side until nicely charred.', timerSeconds: 240, ingredients: ['Lamb patties'] },
      { id: 's3', text: 'Warm flatbreads directly on the flame or in a dry pan for 30 seconds each side.', timerSeconds: 60, ingredients: ['4 flatbreads'] },
      { id: 's4', text: 'Whisk yoghurt with lemon juice and a pinch of salt.', ingredients: ['100g Greek yoghurt', '1 lemon'] },
      { id: 's5', text: 'Spread yoghurt on flatbreads, top with lamb patties, mint leaves, and a drizzle of pomegranate molasses.', ingredients: ['Yoghurt', 'Lamb patties', '½ bunch mint', '2 tbsp pomegranate molasses'] },
    ],
  },
  {
    id: '3',
    title: 'Saffron Risotto with Crispy Sage',
    imageUri: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=900',
    cuisine: 'Italian',
    difficulty: 'Medium',
    cookTime: '45 min',
    prepTime: '10 min',
    defaultServings: 4,
    tags: ['Dinner', 'Vegetarian', 'Comfort Food'],
    source: 'youtube.com/watch?v=xyz',
    ingredients: [
      { id: 'i1', quantity: 320, unit: 'g', name: 'Arborio rice' },
      { id: 'i2', quantity: 1.5, unit: 'litres', name: 'Warm vegetable stock' },
      { id: 'i3', quantity: 0.5, unit: 'tsp', name: 'Saffron threads' },
      { id: 'i4', quantity: 1, name: 'White onion, finely diced' },
      { id: 'i5', quantity: 2, name: 'Garlic cloves, minced' },
      { id: 'i6', quantity: 120, unit: 'ml', name: 'Dry white wine' },
      { id: 'i7', quantity: 60, unit: 'g', name: 'Cold unsalted butter' },
      { id: 'i8', quantity: 80, unit: 'g', name: 'Parmigiano Reggiano, grated' },
      { id: 'i9', quantity: 12, name: 'Fresh sage leaves' },
      { id: 'i10', quantity: 3, unit: 'tbsp', name: 'Olive oil' },
    ],
    steps: [
      { id: 's1', text: 'Bloom saffron in 2 tbsp warm water. Soften onion and garlic in olive oil over medium heat until translucent.', timerSeconds: 480, ingredients: ['½ tsp saffron', '1 onion', '2 garlic cloves', '2 tbsp olive oil'] },
      { id: 's2', text: 'Add rice and toast for 2 minutes, stirring constantly, until the grains turn translucent at the edges.', timerSeconds: 120, ingredients: ['320g Arborio rice'] },
      { id: 's3', text: 'Pour in white wine and stir until fully absorbed.', timerSeconds: 90, ingredients: ['120ml dry white wine'] },
      { id: 's4', text: 'Add stock one ladle at a time, stirring constantly and waiting until each addition is absorbed before adding the next.', timerSeconds: 1200, ingredients: ['1.5L warm vegetable stock', 'Saffron water'] },
      { id: 's5', text: 'Remove from heat. Vigorously stir in cold butter and Parmesan (mantecatura). Cover and rest 2 minutes.', timerSeconds: 120, ingredients: ['60g cold butter', '80g Parmesan'] },
      { id: 's6', text: 'Fry sage leaves in remaining olive oil until crisp. Serve risotto topped with crispy sage.', timerSeconds: 60, ingredients: ['12 sage leaves', '1 tbsp olive oil'] },
    ],
  },
  {
    id: '4',
    title: 'Miso Glazed Salmon',
    imageUri: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=900',
    cuisine: 'Japanese',
    difficulty: 'Easy',
    cookTime: '25 min',
    prepTime: '10 min',
    defaultServings: 2,
    tags: ['Dinner', 'High Protein', 'Quick'],
    source: 'youtube.com/watch?v=chefjamie',
    ingredients: [
      { id: 'i1', quantity: 2, name: 'Salmon fillets (180g each)' },
      { id: 'i2', quantity: 2, unit: 'tbsp', name: 'White miso paste' },
      { id: 'i3', quantity: 1, unit: 'tbsp', name: 'Mirin' },
      { id: 'i4', quantity: 1, unit: 'tbsp', name: 'Sake' },
      { id: 'i5', quantity: 1, unit: 'tsp', name: 'Sesame oil' },
      { id: 'i6', quantity: 1, unit: 'tbsp', name: 'Soy sauce' },
      { id: 'i7', quantity: 1, unit: 'tsp', name: 'Brown sugar' },
      { id: 'i8', quantity: 2, name: 'Spring onions, sliced' },
      { id: 'i9', quantity: 1, unit: 'tsp', name: 'Toasted sesame seeds' },
    ],
    steps: [
      { id: 's1', text: 'Whisk together miso, mirin, sake, sesame oil, soy sauce, and brown sugar until smooth.', ingredients: ['2 tbsp miso', '1 tbsp mirin', '1 tbsp sake', '1 tsp sesame oil', '1 tbsp soy', '1 tsp sugar'] },
      { id: 's2', text: 'Coat salmon generously in the miso glaze. Marinate for at least 10 minutes.', timerSeconds: 600, ingredients: ['2 salmon fillets', 'Miso glaze'] },
      { id: 's3', text: 'Heat oven to 200°C. Line a baking tray with foil. Place salmon skin-side down and spoon over extra glaze.', ingredients: ['Marinated salmon'] },
      { id: 's4', text: 'Bake for 12–14 minutes until the glaze is caramelised and the salmon flakes easily.', timerSeconds: 840, ingredients: [] },
      { id: 's5', text: 'Serve topped with sliced spring onions and sesame seeds.', ingredients: ['2 spring onions', '1 tsp sesame seeds'] },
    ],
  },
  {
    id: '5',
    title: 'Truffle Pasta al Limone',
    imageUri: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=900',
    cuisine: 'Italian',
    difficulty: 'Easy',
    cookTime: '30 min',
    prepTime: '5 min',
    defaultServings: 2,
    tags: ['Dinner', 'Vegetarian', 'Quick'],
    source: 'youtube.com/watch?v=pasta123',
    ingredients: [
      { id: 'i1', quantity: 200, unit: 'g', name: 'Spaghetti or linguine' },
      { id: 'i2', quantity: 100, unit: 'ml', name: 'Double cream' },
      { id: 'i3', quantity: 1, name: 'Lemon, zest and juice' },
      { id: 'i4', quantity: 50, unit: 'g', name: 'Pecorino Romano, finely grated' },
      { id: 'i5', quantity: 2, unit: 'tbsp', name: 'Good quality truffle oil' },
      { id: 'i6', quantity: 2, name: 'Garlic cloves, sliced' },
      { id: 'i7', quantity: 30, unit: 'g', name: 'Unsalted butter' },
      { id: 'i8', quantity: 1, unit: 'handful', name: 'Fresh flat-leaf parsley' },
    ],
    steps: [
      { id: 's1', text: 'Cook pasta in heavily salted boiling water until 2 minutes before al dente. Reserve 200ml pasta water before draining.', timerSeconds: 600, ingredients: ['200g pasta'] },
      { id: 's2', text: 'Gently fry garlic in butter until golden, then add cream and lemon zest. Simmer for 2 minutes.', timerSeconds: 120, ingredients: ['2 garlic cloves', '30g butter', '100ml cream', 'Lemon zest'] },
      { id: 's3', text: 'Add drained pasta to the sauce with a splash of pasta water. Toss vigorously over medium heat until emulsified and glossy.', timerSeconds: 90, ingredients: ['Pasta', 'Pasta water'] },
      { id: 's4', text: 'Remove from heat. Add lemon juice, Pecorino, and truffle oil. Toss again. Loosen with pasta water if needed.', ingredients: ['Lemon juice', '50g Pecorino', '2 tbsp truffle oil'] },
      { id: 's5', text: 'Plate immediately. Top with more Pecorino, black pepper, and torn parsley.', ingredients: ['Fresh parsley', 'Extra Pecorino'] },
    ],
  },
  {
    id: '6',
    title: 'Harissa Roasted Cauliflower',
    imageUri: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=900',
    cuisine: 'North African',
    difficulty: 'Easy',
    cookTime: '40 min',
    prepTime: '10 min',
    defaultServings: 4,
    tags: ['Vegan', 'Dinner', 'Side Dish'],
    source: 'seriouseats.com/recipes',
    ingredients: [
      { id: 'i1', quantity: 1, name: 'Large cauliflower, cut into florets' },
      { id: 'i2', quantity: 3, unit: 'tbsp', name: 'Harissa paste' },
      { id: 'i3', quantity: 3, unit: 'tbsp', name: 'Olive oil' },
      { id: 'i4', quantity: 1, unit: 'tsp', name: 'Ground cumin' },
      { id: 'i5', quantity: 1, unit: 'tsp', name: 'Smoked paprika' },
      { id: 'i6', quantity: 400, unit: 'g', name: 'Canned chickpeas, drained' },
      { id: 'i7', quantity: 200, unit: 'g', name: 'Greek yoghurt' },
      { id: 'i8', quantity: 2, unit: 'tbsp', name: 'Tahini' },
      { id: 'i9', quantity: 1, name: 'Garlic clove, crushed' },
      { id: 'i10', quantity: 1, unit: 'handful', name: 'Fresh coriander leaves' },
    ],
    steps: [
      { id: 's1', text: 'Preheat oven to 220°C. Toss cauliflower and chickpeas with harissa, olive oil, cumin, paprika, salt.', ingredients: ['1 cauliflower', '3 tbsp harissa', '3 tbsp olive oil', '1 tsp cumin', '1 tsp paprika', '400g chickpeas'] },
      { id: 's2', text: 'Spread in a single layer on a large roasting tray. Roast for 30–35 minutes until charred at the edges.', timerSeconds: 1800, ingredients: ['Seasoned cauliflower & chickpeas'] },
      { id: 's3', text: 'Whisk yoghurt, tahini, garlic, lemon juice, and salt until smooth.', ingredients: ['200g yoghurt', '2 tbsp tahini', '1 garlic clove', 'Lemon juice'] },
      { id: 's4', text: 'Spread tahini yoghurt on a large plate. Pile the roasted cauliflower on top. Finish with fresh coriander.', ingredients: ['Tahini yoghurt', 'Roasted cauliflower', 'Fresh coriander'] },
    ],
  },
  {
    id: '7',
    title: 'Dark Chocolate Mousse',
    imageUri: 'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=900',
    cuisine: 'French',
    difficulty: 'Medium',
    cookTime: '20 min',
    prepTime: '10 min',
    defaultServings: 4,
    tags: ['Dessert', 'Vegetarian', 'Quick'],
    source: 'youtube.com/watch?v=mousse99',
    ingredients: [
      { id: 'i1', quantity: 200, unit: 'g', name: 'Dark chocolate (70%), chopped' },
      { id: 'i2', quantity: 4, name: 'Eggs, separated' },
      { id: 'i3', quantity: 40, unit: 'g', name: 'Caster sugar' },
      { id: 'i4', quantity: 30, unit: 'g', name: 'Unsalted butter' },
      { id: 'i5', quantity: 1, unit: 'pinch', name: 'Sea salt' },
      { id: 'i6', quantity: 1, unit: 'tsp', name: 'Vanilla extract' },
      { id: 'i7', quantity: 200, unit: 'ml', name: 'Double cream, for serving' },
    ],
    steps: [
      { id: 's1', text: 'Melt chocolate and butter together in a bowl over simmering water. Stir until smooth. Cool slightly.', timerSeconds: 300, ingredients: ['200g dark chocolate', '30g butter'] },
      { id: 's2', text: 'Whisk egg yolks with half the sugar until pale and thick. Fold into the cooled chocolate mixture with vanilla and salt.', ingredients: ['4 egg yolks', '20g sugar', '1 tsp vanilla', '1 pinch salt'] },
      { id: 's3', text: 'Whisk egg whites to soft peaks. Add remaining sugar and whisk to stiff, glossy peaks.', timerSeconds: 180, ingredients: ['4 egg whites', '20g sugar'] },
      { id: 's4', text: 'Gently fold egg whites into chocolate in 3 stages, preserving as much volume as possible.', ingredients: ['Chocolate mixture', 'Egg whites'] },
      { id: 's5', text: 'Spoon into glasses or ramekins. Refrigerate for at least 2 hours before serving with lightly whipped cream.', timerSeconds: 7200, ingredients: ['Mousse', '200ml cream'] },
    ],
  },
  {
    id: '8',
    title: 'Cardamom Cold Brew Panna Cotta',
    imageUri: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900',
    cuisine: 'Italian',
    difficulty: 'Easy',
    cookTime: '15 min',
    prepTime: '10 min',
    defaultServings: 6,
    tags: ['Dessert', 'Vegetarian'],
    source: 'seriouseats.com/desserts',
    ingredients: [
      { id: 'i1', quantity: 600, unit: 'ml', name: 'Double cream' },
      { id: 'i2', quantity: 200, unit: 'ml', name: 'Whole milk' },
      { id: 'i3', quantity: 60, unit: 'g', name: 'Caster sugar' },
      { id: 'i4', quantity: 3, unit: 'tsp', name: 'Ground cardamom' },
      { id: 'i5', quantity: 60, unit: 'ml', name: 'Cold brew concentrate' },
      { id: 'i6', quantity: 2.5, unit: 'tsp', name: 'Powdered gelatine' },
      { id: 'i7', quantity: 3, unit: 'tbsp', name: 'Cold water (for gelatine)' },
    ],
    steps: [
      { id: 's1', text: 'Bloom gelatine in cold water for 5 minutes.', timerSeconds: 300, ingredients: ['2.5 tsp gelatine', '3 tbsp cold water'] },
      { id: 's2', text: 'Warm cream, milk, sugar, and cardamom over medium heat until steaming and the sugar dissolves. Do not boil.', timerSeconds: 300, ingredients: ['600ml double cream', '200ml milk', '60g sugar', '3 tsp cardamom'] },
      { id: 's3', text: 'Remove from heat. Stir in bloomed gelatine until completely dissolved. Add cold brew concentrate.', ingredients: ['Bloomed gelatine', '60ml cold brew'] },
      { id: 's4', text: 'Pour into 6 lightly oiled ramekins or glasses. Refrigerate for at least 4 hours until fully set.', timerSeconds: 14400, ingredients: ['Panna cotta mixture'] },
    ],
  },
];

// ── Collections ────────────────────────────────────────────────────────────────
export const COLLECTIONS: Collection[] = [
  {
    id: 'c1',
    name: 'Weeknight Dinners',
    recipeCount: 3,
    recipeIds: ['2', '4', '5'],
    imageUris: [
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=200',
      'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200',
      'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200',
      'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=200',
    ],
  },
  {
    id: 'c2',
    name: 'Desserts',
    recipeCount: 3,
    recipeIds: ['1', '7', '8'],
    imageUris: [
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200',
      'https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=200',
      undefined,
      undefined,
    ],
  },
  {
    id: 'c3',
    name: 'Vegan Favourites',
    recipeCount: 1,
    recipeIds: ['6'],
    imageUris: [
      'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=200',
      undefined,
      undefined,
      undefined,
    ],
  },
  {
    id: 'c4',
    name: 'Italian',
    recipeCount: 3,
    recipeIds: ['3', '5', '8'],
    imageUris: [
      'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=200',
      'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200',
      'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=200',
      undefined,
    ],
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────────────────
export function getRecipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function getCollectionById(id: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.id === id);
}

export function getRecipesForCollection(collection: Collection): Recipe[] {
  return collection.recipeIds.map((id) => getRecipeById(id)).filter(Boolean) as Recipe[];
}

// Convenience subset for "recently imported" / "recent imports"
export const RECENT_RECIPES = RECIPES.slice(0, 3);
export const GRID_RECIPES = RECIPES.slice(2, 6);
