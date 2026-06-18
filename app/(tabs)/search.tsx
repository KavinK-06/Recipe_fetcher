import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { useRecipes } from '../../hooks/useRecipes';
import type { RecipeRow } from '../../lib/api/import';
import TagChip from '../../components/TagChip';

// Recipes the search filter operates on, normalised from the DB rows.
type SearchItem = {
  id: string;
  title: string;
  imageUri?: string;
  cookTimeMins: number | null;
  cookTimeLabel: string;
  tags: string[];
};

const DIET_TAGS = ['vegetarian', 'vegan', 'gluten-free', 'gluten free', 'dairy-free', 'keto', 'paleo'];
const TIME_FILTERS = ['Any time', 'Under 20 min', 'Under 30 min', 'Under 60 min'];

function toSearchItem(r: RecipeRow): SearchItem {
  return {
    id: r.id,
    title: r.title,
    imageUri: r.image_url ?? undefined,
    cookTimeMins: r.cook_time_minutes,
    cookTimeLabel: r.cook_time_minutes != null ? `${r.cook_time_minutes} min` : '—',
    tags: r.tags ?? [],
  };
}

// ── Result row card ────────────────────────────────────────────────────────────
function ResultRow({
  item,
  onPress,
}: {
  item: SearchItem;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dietTag = item.tags.find((t) => DIET_TAGS.includes(t.toLowerCase()));
  const otherTag = item.tags.find((t) => t !== dietTag);

  return (
    <Animated.View entering={FadeIn.duration(200)} layout={Layout.springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
      >
        <Animated.View style={[styles.resultRow, animStyle]}>
          {item.imageUri ? (
            <Image
              source={{ uri: item.imageUri }}
              contentFit="cover"
              transition={300}
              style={styles.resultImage}
            />
          ) : (
            <View style={[styles.resultImage, styles.resultImageEmpty]}>
              <Ionicons name="restaurant-outline" size={22} color={Colors.muted} />
            </View>
          )}
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.resultMeta}>
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={11} color={Colors.noir} />
                <Text style={styles.metaPillText}>{item.cookTimeLabel}</Text>
              </View>
              {otherTag ? <Text style={styles.resultCuisine}>{otherTag}</Text> : null}
            </View>
            {dietTag && (
              <TagChip label={dietTag} variant="dietary" style={styles.dietChip} />
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Empty state (query matched nothing) ─────────────────────────────────────────
function EmptyState({
  query,
  onImport,
}: {
  query: string;
  onImport: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.emptyWrap}>
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyPlate}>
          <Ionicons name="restaurant-outline" size={40} color={Colors.muted} />
        </View>
        <View style={styles.emptySparkle1}>
          <Ionicons name="sparkles" size={14} color={Colors.saffron} />
        </View>
        <View style={styles.emptySparkle2}>
          <Ionicons name="sparkles" size={10} color={Colors.paprika} />
        </View>
      </View>

      <Text style={styles.emptyHeadline}>No recipes found</Text>
      <Text style={styles.emptySub}>
        {query ? `Nothing matched "${query}".\n` : ''}Why not import it from the web?
      </Text>

      <Animated.View style={animStyle}>
        <Pressable
          style={styles.emptyButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onImport();
          }}
          onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 300 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
        >
          <Ionicons name="cloud-download-outline" size={16} color={Colors.parchment} />
          <Text style={styles.emptyButtonText}>Try importing it</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const { recipes, isLoading } = useRecipes();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [activeTime, setActiveTime] = useState('Any time');
  const [showFilters, setShowFilters] = useState(false);

  const items = useMemo(() => recipes.map(toSearchItem), [recipes]);

  // Tag filter chips, derived from the user's actual recipe tags (most common first).
  const tagFilters = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((it) => it.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    return ['All', ...sorted];
  }, [items]);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const inputScale = useSharedValue(1);
  const inputAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: inputScale.value }] }));

  const filterBarHeight = useSharedValue(0);
  const filterOpacity = useSharedValue(0);
  const filterAnimStyle = useAnimatedStyle(() => ({
    height: filterBarHeight.value,
    opacity: filterOpacity.value,
    overflow: 'hidden',
  }));

  const toggleFilters = () => {
    Haptics.selectionAsync();
    const next = !showFilters;
    setShowFilters(next);
    // Height uses timing, NOT spring: an underdamped spring on a layout height
    // overshoots and oscillates, which makes the results list below bounce up and
    // down a few times before settling. Timing expands/collapses once, cleanly.
    filterBarHeight.value = withTiming(next ? 132 : 0, { duration: 220 });
    filterOpacity.value = withTiming(next ? 1 : 0, { duration: 200 });
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchQuery =
        q.length === 0 ||
        it.title.toLowerCase().includes(q) ||
        it.tags.some((t) => t.toLowerCase().includes(q));
      const matchTag = activeTag === 'All' || it.tags.includes(activeTag);
      const matchTime = (() => {
        if (activeTime === 'Any time') return true;
        if (it.cookTimeMins == null) return false;
        if (activeTime === 'Under 20 min') return it.cookTimeMins < 20;
        if (activeTime === 'Under 30 min') return it.cookTimeMins < 30;
        if (activeTime === 'Under 60 min') return it.cookTimeMins < 60;
        return true;
      })();
      return matchQuery && matchTag && matchTime;
    });
  }, [items, query, activeTag, activeTime]);

  const isIdle = query.length === 0 && activeTag === 'All' && activeTime === 'Any time';
  const noRecipesAtAll = !isLoading && items.length === 0;
  const showEmpty = !isIdle && results.length === 0;

  const goToImport = () => router.push('/(tabs)/import' as any);
  const goToRecipe = (id: string) => router.push(`/recipe/${id}` as any);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Search bar row ── */}
      <View style={styles.searchBarRow}>
        <Animated.View style={[styles.inputWrap, inputAnimStyle]}>
          <Ionicons name="search-outline" size={18} color={Colors.muted} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search your recipes…"
            placeholderTextColor={Colors.mutedText}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => {
              inputScale.value = withSpring(1.01, { damping: 14, stiffness: 300 });
            }}
            onBlur={() => {
              inputScale.value = withSpring(1, { damping: 14, stiffness: 300 });
            }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setQuery('');
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={Colors.muted} />
            </Pressable>
          ) : null}
        </Animated.View>

        {/* Filter toggle button */}
        <Pressable
          onPress={toggleFilters}
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          hitSlop={4}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={showFilters ? Colors.parchment : Colors.muted}
          />
        </Pressable>
      </View>

      {/* ── Expandable filter rows ── */}
      <Animated.View style={filterAnimStyle}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Tags</Text>
          <FlatList
            horizontal
            data={tagFilters}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TagChip
                label={item}
                variant={activeTag === item ? 'active' : 'default'}
                onPress={() => { setActiveTag(item); Haptics.selectionAsync(); }}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          />
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Cook time</Text>
          <FlatList
            horizontal
            data={TIME_FILTERS}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TagChip
                label={item}
                variant={activeTime === item ? 'active' : 'default'}
                onPress={() => { setActiveTime(item); Haptics.selectionAsync(); }}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          />
        </View>
      </Animated.View>

      {/* ── Loading ── */}
      {isLoading && (
        <View style={styles.centerFill}>
          <ActivityIndicator color={Colors.saffron} />
        </View>
      )}

      {/* ── No recipes imported at all ── */}
      {noRecipesAtAll && <EmptyState query="" onImport={goToImport} />}

      {/* ── Results list — shows every recipe in the idle ("All") state, and the
           filtered subset while searching. The browse-by-tag chips ride along as a
           list header in the idle state so the full list still sits underneath. ── */}
      {!isLoading && !noRecipesAtAll && !showEmpty && (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <ResultRow item={item} onPress={() => goToRecipe(item.id)} />
          )}
          ListHeaderComponent={
            isIdle ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.browseHeader}>
                {tagFilters.length > 1 && (
                  <View style={styles.browseTags}>
                    <Text style={styles.recentsLabel}>Browse by tag</Text>
                    <View style={styles.recentsRow}>
                      {tagFilters.filter((t) => t !== 'All').slice(0, 12).map((t) => (
                        <TagChip
                          key={t}
                          label={t}
                          variant="default"
                          onPress={() => {
                            setActiveTag(t);
                            Haptics.selectionAsync();
                          }}
                        />
                      ))}
                    </View>
                  </View>
                )}
                <Text style={styles.recentsLabel}>All recipes · {results.length}</Text>
              </Animated.View>
            ) : null
          }
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* ── Empty state (a search/filter that matched nothing) ── */}
      {!isLoading && showEmpty && !noRecipesAtAll && (
        <EmptyState query={query} onImport={goToImport} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },

  // Search bar
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    color: Colors.parchment,
    padding: 0,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterToggleActive: {
    backgroundColor: Colors.burgundy,
    borderColor: Colors.burgundy,
  },

  // Filter rows
  filterGroup: {
    gap: 6,
    paddingTop: 8,
  },
  filterGroupLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
  },
  filterChipRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },

  // Browse by tag (idle list header)
  browseHeader: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 16,
  },
  browseTags: {
    gap: 12,
  },
  recentsLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Results
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  resultImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    flexShrink: 0,
  },
  resultImageEmpty: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 5,
  },
  resultTitle: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.parchment,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 50,
  },
  metaPillText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10,
    color: Colors.noir,
  },
  resultCuisine: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.mutedText,
    textTransform: 'capitalize',
  },
  dietChip: {
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.muted,
    marginLeft: 86,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
    paddingBottom: 60,
  },
  emptyIllustration: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyPlate: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySparkle1: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  emptySparkle2: {
    position: 'absolute',
    bottom: 10,
    left: 8,
  },
  emptyHeadline: {
    fontFamily: Fonts.displayBold,
    fontSize: 24,
    color: Colors.parchment,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.mutedText,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 6,
  },
  emptyButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },
});
