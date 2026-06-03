import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { RECENT_RECIPES, GRID_RECIPES } from '../../constants/mockData';
import RecipeCard from '../../components/RecipeCard';
import SkeletonCard from '../../components/SkeletonCard';
import TagChip from '../../components/TagChip';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2;

const COLLECTION_TAGS = ['All', 'Breakfast', 'Dinner', 'Quick Meals', 'Vegan', 'Baking', 'Soups'];

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
              Paste a link or share from Instagram
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

// ── Main screen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [savedIds, setSavedIds] = useState<Set<string>>(
    new Set(
      [...RECENT_RECIPES, ...GRID_RECIPES]
        .filter((r) => r.isSaved)
        .map((r) => r.id),
    ),
  );
  const [activeTag, setActiveTag] = useState('All');
  const [isLoading] = useState(false);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const goToRecipe = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/recipe/${id}` as any);
  };

  const goToImport = () => {
    router.push('/(tabs)/import' as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Ionicons name="flame" size={16} color={Colors.saffron} />
          </View>
          <Text style={styles.logoText}>Saveur</Text>
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
            onAction={() => router.push('/(tabs)/collections' as any)}
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
              data={RECENT_RECIPES}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <RecipeCard
                  id={item.id}
                  title={item.title}
                  imageUri={item.imageUri}
                  cookTime={item.cookTime}
                  isSaved={savedIds.has(item.id)}
                  onPress={() => goToRecipe(item.id)}
                  onSavePress={toggleSave}
                  style={styles.recentCard}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentList}
            />
          )}
        </View>

        {/* ── Import CTA ── */}
        <View style={styles.section}>
          <ImportBanner onPress={goToImport} />
        </View>

        {/* ── Collections filter row ── */}
        <View style={styles.section}>
          <SectionHeader title="Browse" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagRow}
          >
            {COLLECTION_TAGS.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                variant={activeTag === tag ? 'active' : 'default'}
                onPress={() => {
                  setActiveTag(tag);
                  Haptics.selectionAsync();
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── Recipe grid ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Your Recipes"
            actionLabel="Filter"
          />
          {isLoading ? (
            <View style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} style={styles.gridCard} />
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {GRID_RECIPES.map((item) => (
                <RecipeCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  imageUri={item.imageUri}
                  cookTime={item.cookTime}
                  isSaved={savedIds.has(item.id)}
                  onPress={() => goToRecipe(item.id)}
                  onSavePress={toggleSave}
                  style={styles.gridCard}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 4,
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
    color: Colors.muted,
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

  // Collections tag row
  tagRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },

  // 2-col grid
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: CARD_WIDTH,
  },
});
