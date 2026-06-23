import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { useRecipes } from '../../hooks/useRecipes';
import type { RecipeRow } from '../../lib/api/import';
import RecipeCard from '../../components/RecipeCard';
import RecipeActionsSheet from '../../components/RecipeActionsSheet';
import SkeletonCard from '../../components/SkeletonCard';

const cookTimeLabel = (mins: number | null) => (mins != null ? `${mins} min` : '—');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ── Import CTA Banner ──────────────────────────────────────────────────────────
function ImportBanner({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={styles.banner}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 14, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        }}
      >
        {/* Decorative circles */}
        <View style={styles.bannerCircle1} />
        <View style={styles.bannerCircle2} />

        <View style={styles.bannerContent}>
          <View style={styles.bannerLeft}>
            <Text style={styles.bannerLabel}>Import a recipe</Text>
            <Text style={styles.bannerSub}>
              Paste a link or import from YouTube
            </Text>
          </View>
          <View style={styles.bannerIcons}>
            <View style={styles.bannerIconBtn}>
              <Ionicons name="clipboard-outline" size={18} color={Colors.saffron} />
            </View>
            <View style={styles.bannerIconBtn}>
              <Ionicons name="camera-outline" size={18} color={Colors.saffron} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Empty state (no recipes imported yet) ───────────────────────────────────────
function EmptyRecipes({ onImport }: { onImport: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="restaurant-outline" size={28} color={Colors.saffron} />
      </View>
      <Text style={styles.emptyTitle}>No recipes yet</Text>
      <Text style={styles.emptySub}>
        Import your first recipe from a link, a photo, or a YouTube video to start your collection.
      </Text>
      <Pressable style={styles.emptyButton} onPress={onImport}>
        <Ionicons name="add" size={18} color={Colors.parchment} />
        <Text style={styles.emptyButtonText}>Import a recipe</Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { recipes, isLoading } = useRecipes();
  const recent = recipes.slice(0, 5);
  const isEmpty = !isLoading && recipes.length === 0;

  const [menuRecipe, setMenuRecipe] = useState<{ id: string; title: string } | null>(null);

  const goToRecipe = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/recipe/${id}` as any);
  };

  const goToImport = () => {
    router.push('/(tabs)/import' as any);
  };

  const renderRecipe = ({ item }: { item: RecipeRow }) => (
    <RecipeCard
      id={item.id}
      title={item.title}
      imageUri={item.image_url ?? ''}
      cookTime={cookTimeLabel(item.cook_time_minutes)}
      onPress={() => goToRecipe(item.id)}
      onMenuPress={() => setMenuRecipe({ id: item.id, title: item.title })}
      style={styles.gridCard}
    />
  );

  // Everything above the "Your Recipes" grid rides in the FlatList header, so the
  // grid itself stays virtualized (only on-screen cards mount). The horizontal
  // "Recently Imported" list is a different orientation, so nesting it in the
  // header is fine — RN only warns on same-orientation nesting.
  const listHeader = (
    <>
      {/* ── Greeting ── */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {greeting()}, Chef 👋
        </Text>
        <Text style={styles.greetingDate}>{formattedDate()}</Text>
      </View>

      {/* ── Recently Imported ── */}
      <View style={styles.section}>
        <SectionHeader
          title="Recently Imported"
          actionLabel="See all"
          onAction={() => router.push('/(tabs)/search' as any)}
        />
        {isLoading ? (
          <FlatList
            horizontal
            data={[1, 2, 3]}
            keyExtractor={(i) => String(i)}
            renderItem={() => (
              <SkeletonCard style={styles.recentCard} />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
            scrollEnabled={false}
          />
        ) : (
          <FlatList
            horizontal
            data={recent}
            keyExtractor={(r) => r.id}
            renderItem={({ item }: { item: RecipeRow }) => (
              <RecipeCard
                id={item.id}
                title={item.title}
                imageUri={item.image_url ?? ''}
                cookTime={cookTimeLabel(item.cook_time_minutes)}
                onPress={() => goToRecipe(item.id)}
                onMenuPress={() => setMenuRecipe({ id: item.id, title: item.title })}
                style={styles.recentCard}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
            ListEmptyComponent={
              isEmpty ? <Text style={styles.recentEmpty}>Nothing here yet</Text> : null
            }
          />
        )}
      </View>

      {/* ── Import CTA ── */}
      <View style={styles.section}>
        <ImportBanner onPress={goToImport} />
      </View>

      {/* ── Your Recipes header (grid rows follow as FlatList items) ── */}
      <View style={styles.gridHeader}>
        <SectionHeader title="Your Recipes" />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>Rasoi</Text>
        </View>
        <View style={styles.topBarRight}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/(tabs)/search' as any);
            }}
            hitSlop={8}
            style={styles.iconButton}
          >
            <Ionicons name="search-outline" size={22} color={Colors.parchment} />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/(tabs)/profile' as any);
            }}
            hitSlop={8}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={16} color={Colors.muted} />
            </View>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={isLoading ? [] : recipes}
        keyExtractor={(item) => item.id}
        renderItem={renderRecipe}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} style={styles.gridCard} />
              ))}
            </View>
          ) : (
            <EmptyRecipes onImport={goToImport} />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
      />

      <RecipeActionsSheet
        visible={menuRecipe !== null}
        recipe={menuRecipe}
        onClose={() => setMenuRecipe(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: Colors.parchment,
    letterSpacing: 0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FlatList content
  listContent: {
    paddingBottom: 32,
  },

  // Greeting
  greeting: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 3,
  },
  greetingText: {
    fontFamily: Fonts.displayBold,
    fontSize: 28,
    color: Colors.parchment,
  },
  greetingDate: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.mutedText,
  },

  // Section
  section: {
    paddingTop: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    color: Colors.parchment,
  },
  sectionAction: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.saffron,
  },

  // Recently imported horizontal list
  recentList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  recentCard: {
    width: 180,
  },

  // Import banner
  banner: {
    marginHorizontal: 20,
    backgroundColor: Colors.burgundy,
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
  },
  bannerCircle1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(196,69,42,0.3)',
    top: -28,
    right: -12,
  },
  bannerCircle2: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232,184,122,0.1)',
    bottom: -16,
    right: 60,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flex: 1,
    gap: 4,
  },
  bannerLabel: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    color: Colors.parchment,
  },
  bannerSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(247,240,230,0.65)',
  },
  bannerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  bannerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(26,10,14,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // "Your Recipes" header (spacing the grid section used to provide)
  gridHeader: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  // FlatList row of 2 cards: matches the old flex-wrap grid's 16px gutters,
  // 12px column gap, and 12px between rows.
  gridRow: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  // Skeleton / fallback grid (rendered as ListEmptyComponent, not virtualized).
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: CARD_WIDTH,
  },

  // Empty states
  recentEmpty: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.mutedText,
    paddingHorizontal: 20,
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 28,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 18,
    color: Colors.parchment,
  },
  emptySub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 6,
  },
  emptyButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.parchment,
  },
});
