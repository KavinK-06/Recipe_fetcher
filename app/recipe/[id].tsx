import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { RECIPES, getRecipeById } from '../../constants/mockData';
import TagChip from '../../components/TagChip';
import IngredientRow from '../../components/IngredientRow';
import StepCard from '../../components/StepCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 380;
const TOP_BAR_PADDING = 12;

// Fallback if an unknown id is passed
const FALLBACK_RECIPE = RECIPES[0];

type Tab = 'ingredients' | 'steps';

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatQuantity(q: number): string {
  // Use up to 2 decimals, strip trailing zeros, prefer common fractions
  if (Math.abs(q - Math.round(q)) < 0.01) return String(Math.round(q));
  if (Math.abs(q - 0.25) < 0.01) return '¼';
  if (Math.abs(q - 0.5) < 0.01) return '½';
  if (Math.abs(q - 0.75) < 0.01) return '¾';
  if (Math.abs(q - 0.33) < 0.05) return '⅓';
  if (Math.abs(q - 0.67) < 0.05) return '⅔';
  return q.toFixed(2).replace(/\.?0+$/, '');
}

// ── Floating top bar buttons ───────────────────────────────────────────────────
function FloatingButton({
  icon,
  filled,
  onPress,
  side,
  scrollY,
  topInset,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  filled?: boolean;
  onPress: () => void;
  side: 'left' | 'right';
  scrollY: Animated.SharedValue<number>;
  topInset: number;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => {
    // Background fades to surface as we scroll — gives a "pill" effect over the white-ish content
    const bgOpacity = interpolate(
      scrollY.value,
      [HERO_HEIGHT - 100, HERO_HEIGHT - 40],
      [0.55, 0.95],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: `rgba(26,10,14,${bgOpacity})`,
    };
  });

  return (
    <Animated.View
      style={[
        styles.floatingButton,
        side === 'left' ? styles.floatingLeft : styles.floatingRight,
        { top: topInset + TOP_BAR_PADDING },
        animStyle,
      ]}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.9, { damping: 14, stiffness: 320 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 320 }); }}
        style={styles.floatingButtonInner}
        hitSlop={6}
      >
        <Ionicons
          name={icon}
          size={18}
          color={filled ? Colors.saffron : Colors.parchment}
        />
      </Pressable>
    </Animated.View>
  );
}

// ── Servings adjuster ──────────────────────────────────────────────────────────
function ServingsAdjuster({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (n: number) => void;
}) {
  const adjustScale = useSharedValue(1);

  const numberAnim = useAnimatedStyle(() => ({
    transform: [{ scale: adjustScale.value }],
  }));

  const adjust = (delta: number) => {
    const next = Math.max(1, Math.min(20, servings + delta));
    if (next === servings) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    adjustScale.value = withSpring(1.15, { damping: 10, stiffness: 350 }, () => {
      adjustScale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    onChange(next);
  };

  return (
    <View style={styles.servingsCard}>
      <View style={styles.servingsLeft}>
        <Text style={styles.servingsLabel}>Servings</Text>
        <Text style={styles.servingsHint}>Scales ingredients live</Text>
      </View>
      <View style={styles.servingsControl}>
        <Pressable
          style={styles.servingsButton}
          onPress={() => adjust(-1)}
          hitSlop={4}
        >
          <Ionicons name="remove" size={18} color={Colors.parchment} />
        </Pressable>
        <Animated.Text style={[styles.servingsNumber, numberAnim]}>
          {servings}
        </Animated.Text>
        <Pressable
          style={styles.servingsButton}
          onPress={() => adjust(1)}
          hitSlop={4}
        >
          <Ionicons name="add" size={18} color={Colors.parchment} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Tab switcher ───────────────────────────────────────────────────────────────
function TabSwitcher({
  active,
  onChange,
  ingredientCount,
  stepCount,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  ingredientCount: number;
  stepCount: number;
}) {
  const thumbX = useSharedValue(active === 'ingredients' ? 0 : 1);

  React.useEffect(() => {
    thumbX.value = withSpring(active === 'ingredients' ? 0 : 1, {
      damping: 16, stiffness: 260,
    });
  }, [active, thumbX]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value * 50 + '%' as any }],
  }));

  const handleTap = (t: Tab) => {
    Haptics.selectionAsync();
    onChange(t);
  };

  return (
    <View style={styles.tabSwitcher}>
      <Animated.View style={[styles.tabThumb, thumbStyle]} />
      <Pressable style={styles.tabOption} onPress={() => handleTap('ingredients')}>
        <Text style={[styles.tabLabel, active === 'ingredients' && styles.tabLabelActive]}>
          Ingredients
        </Text>
        <Text style={[styles.tabCount, active === 'ingredients' && styles.tabCountActive]}>
          {ingredientCount}
        </Text>
      </Pressable>
      <Pressable style={styles.tabOption} onPress={() => handleTap('steps')}>
        <Text style={[styles.tabLabel, active === 'steps' && styles.tabLabelActive]}>
          Steps
        </Text>
        <Text style={[styles.tabCount, active === 'steps' && styles.tabCountActive]}>
          {stepCount}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Sticky Start Cooking ───────────────────────────────────────────────────────
function StartCookingButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.startButtonWrap, animStyle]}>
      <Pressable
        style={styles.startButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
      >
        <Ionicons name="flame" size={18} color={Colors.saffron} />
        <Text style={styles.startButtonText}>Start Cooking</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.parchment} />
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const RECIPE = getRecipeById(id) ?? FALLBACK_RECIPE;

  const [servings, setServings] = useState(RECIPE.defaultServings);
  const [activeTab, setActiveTab] = useState<Tab>('ingredients');
  const [isSaved, setIsSaved] = useState(true);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState(0);

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // Parallax hero: scales up on overscroll, scrolls slower than content
  const heroAnimStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [-200, 0, HERO_HEIGHT],
      [-100, 0, HERO_HEIGHT * 0.6],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      scrollY.value,
      [-200, 0],
      [1.4, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  // Title in top bar fades in as the hero scrolls away
  const stickyTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_HEIGHT - 140, HERO_HEIGHT - 60],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [{
      translateY: interpolate(
        scrollY.value,
        [HERO_HEIGHT - 140, HERO_HEIGHT - 60],
        [10, 0],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  const stickyBarBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO_HEIGHT - 140, HERO_HEIGHT - 60],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Live-scaled ingredients
  const scaledIngredients = useMemo(() => {
    const factor = servings / RECIPE.defaultServings;
    return RECIPE.ingredients.map((ing) => ({
      ...ing,
      scaledQuantity: ing.quantity * factor,
    }));
  }, [servings]);

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    setIsSaved((v) => !v);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShare = () => {
    Haptics.selectionAsync();
    // Share sheet stub
  };

  const handleStartCooking = () => {
    router.push(`/cook/${RECIPE.id}` as any);
  };

  return (
    <View style={styles.container}>
      {/* ── Floating top bar background (appears on scroll) ── */}
      <Animated.View
        style={[
          styles.stickyBar,
          { paddingTop: insets.top, height: insets.top + 56 },
          stickyBarBgStyle,
        ]}
        pointerEvents="none"
      >
        <View style={styles.stickyBarInner}>
          <Animated.Text
            style={[styles.stickyTitle, stickyTitleStyle]}
            numberOfLines={1}
          >
            {RECIPE.title}
          </Animated.Text>
        </View>
      </Animated.View>

      {/* ── Floating buttons ── */}
      <FloatingButton
        icon="chevron-back"
        onPress={() => router.back()}
        side="left"
        scrollY={scrollY}
        topInset={insets.top}
      />
      <View style={styles.floatingRightGroup}>
        <FloatingButton
          icon={isSaved ? 'bookmark' : 'bookmark-outline'}
          filled={isSaved}
          onPress={handleSave}
          side="right"
          scrollY={scrollY}
          topInset={insets.top}
        />
        <FloatingButton
          icon="share-social-outline"
          onPress={handleShare}
          side="right"
          scrollY={scrollY}
          topInset={insets.top}
        />
      </View>

      {/* ── Scrollable content ── */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        {/* ── Hero image ── */}
        <View style={styles.heroContainer}>
          <Animated.View style={[styles.heroImageWrap, heroAnimStyle]}>
            <Image
              source={{ uri: RECIPE.imageUri }}
              contentFit="cover"
              transition={400}
              style={styles.heroImage}
            />
            {/* Gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(26,10,14,0.4)', Colors.noir]}
              locations={[0, 0.55, 1]}
              style={styles.heroGradient}
            />
            {/* Source badge */}
            <View style={[styles.sourceBadge, { top: insets.top + 70 }]}>
              <Ionicons name="link-outline" size={11} color={Colors.saffron} />
              <Text style={styles.sourceText}>{RECIPE.source}</Text>
            </View>
          </Animated.View>
        </View>

        {/* ── Content body ── */}
        <View style={styles.body}>
          {/* Title + meta */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{RECIPE.title}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={Colors.saffron} />
                <Text style={styles.metaText}>{RECIPE.cookTime}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Ionicons name="hourglass-outline" size={13} color={Colors.saffron} />
                <Text style={styles.metaText}>{RECIPE.prepTime} prep</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Ionicons name="restaurant-outline" size={13} color={Colors.saffron} />
                <Text style={styles.metaText}>{RECIPE.difficulty}</Text>
              </View>
            </View>
          </View>

          {/* Tag chips */}
          <View style={styles.tagRow}>
            <TagChip label={RECIPE.cuisine} variant="cuisine" />
            {RECIPE.tags.map((t) => (
              <TagChip
                key={t}
                label={t}
                variant={t === 'Vegetarian' || t === 'Vegan' ? 'dietary' : 'default'}
              />
            ))}
          </View>

          {/* Servings adjuster */}
          <ServingsAdjuster servings={servings} onChange={setServings} />

          {/* Tabs */}
          <TabSwitcher
            active={activeTab}
            onChange={setActiveTab}
            ingredientCount={RECIPE.ingredients.length}
            stepCount={RECIPE.steps.length}
          />

          {/* Tab content */}
          {activeTab === 'ingredients' ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={styles.tabContent}
            >
              {scaledIngredients.map((ing) => (
                <IngredientRow
                  key={ing.id}
                  quantity={formatQuantity(ing.scaledQuantity)}
                  unit={ing.unit}
                  name={ing.name}
                  isChecked={checkedIngredients.has(ing.id)}
                  onToggle={() => toggleIngredient(ing.id)}
                />
              ))}
            </Animated.View>
          ) : (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={styles.stepsList}
            >
              {RECIPE.steps.map((step, i) => (
                <Pressable
                  key={step.id}
                  onPress={() => {
                    setActiveStep(i);
                    Haptics.selectionAsync();
                  }}
                >
                  <StepCard
                    stepNumber={i + 1}
                    totalSteps={RECIPE.steps.length}
                    instruction={step.text}
                    timerSeconds={step.timerSeconds}
                    isActive={i === activeStep}
                  />
                </Pressable>
              ))}
            </Animated.View>
          )}
        </View>
      </Animated.ScrollView>

      {/* ── Sticky Start Cooking ── */}
      <View
        style={[
          styles.stickyBottom,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <LinearGradient
          colors={['transparent', Colors.noir]}
          locations={[0, 0.4]}
          style={styles.stickyBottomFade}
          pointerEvents="none"
        />
        <StartCookingButton onPress={handleStartCooking} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.noir,
  },

  // Sticky top bar
  stickyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.noir,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.muted,
    zIndex: 5,
  },
  stickyBarInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 60,
  },
  stickyTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    color: Colors.parchment,
  },

  // Floating buttons
  floatingButton: {
    position: 'absolute',
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  floatingLeft: {
    left: 16,
  },
  floatingRight: {
    right: 16,
  },
  floatingRightGroup: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    zIndex: 10,
  },
  floatingButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero
  heroContainer: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroImageWrap: {
    width: '100%',
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sourceBadge: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(26,10,14,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(232,184,122,0.25)',
  },
  sourceText: {
    fontFamily: Fonts.monoRegular,
    fontSize: 10,
    color: Colors.saffron,
    letterSpacing: 0.3,
  },

  // Body
  body: {
    paddingHorizontal: 20,
    marginTop: -32,
    gap: 18,
  },
  titleBlock: {
    gap: 12,
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 30,
    lineHeight: 36,
    color: Colors.parchment,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.parchment,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.muted,
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // Servings
  servingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  servingsLeft: {
    gap: 2,
  },
  servingsLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.parchment,
  },
  servingsHint: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    color: Colors.muted,
  },
  servingsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  servingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingsNumber: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: Colors.parchment,
    minWidth: 28,
    textAlign: 'center',
  },

  // Tab switcher
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  tabThumb: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '50%',
    bottom: 4,
    borderRadius: 11,
    backgroundColor: Colors.burgundy,
  },
  tabOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  tabLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.muted,
  },
  tabLabelActive: {
    color: Colors.parchment,
  },
  tabCount: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    color: Colors.muted,
    backgroundColor: Colors.noir,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 50,
    minWidth: 22,
    textAlign: 'center',
  },
  tabCountActive: {
    color: Colors.noir,
    backgroundColor: Colors.saffron,
  },

  // Tab content
  tabContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 14,
  },
  stepsList: {
    gap: 12,
  },

  // Sticky bottom
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  stickyBottomFade: {
    position: 'absolute',
    top: -32,
    left: 0,
    right: 0,
    height: 56,
  },
  startButtonWrap: {},
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.paprika,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  startButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.parchment,
    letterSpacing: 0.3,
  },
});
