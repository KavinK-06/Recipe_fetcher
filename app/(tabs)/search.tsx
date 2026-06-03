import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  Dimensions,
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
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { RECIPES } from '../../constants/mockData';
import TagChip from '../../components/TagChip';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Flatten recipes into the shape the search filter expects
const ALL_RECIPES = RECIPES.map((r) => ({
  id: r.id,
  title: r.title,
  cuisine: r.cuisine,
  diet: r.tags.find((t) => ['Vegetarian', 'Vegan', 'Gluten-Free'].includes(t)) ?? 'None',
  cookTime: r.cookTime,
  imageUri: r.imageUri,
}));

const RECENT_SEARCHES = ['pasta', 'vegan dinner', 'quick', 'chocolate'];

const CUISINE_FILTERS = ['All', 'Italian', 'Japanese', 'Middle Eastern', 'French', 'North African'];
const DIET_FILTERS = ['Any', 'Vegetarian', 'Vegan', 'Gluten-Free'];
const TIME_FILTERS = ['Any time', 'Under 20 min', 'Under 30 min', 'Under 60 min'];

// ── Result row card ────────────────────────────────────────────────────────────
function ResultRow({
  item,
  onPress,
}: {
  item: (typeof ALL_RECIPES)[number];
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

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
          <Image
            source={{ uri: item.imageUri }}
            contentFit="cover"
            transition={300}
            style={styles.resultImage}
          />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.resultMeta}>
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={11} color={Colors.noir} />
                <Text style={styles.metaPillText}>{item.cookTime}</Text>
              </View>
              <Text style={styles.resultCuisine}>{item.cuisine}</Text>
            </View>
            {item.diet !== 'None' && (
              <TagChip label={item.diet} variant="dietary" style={styles.dietChip} />
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
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
      {/* Warm illustration — stacked food icons */}
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
        Nothing matched "{query}".{'\n'}Why not import it from the web?
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
  const [query, setQuery] = useState('');
  const [activeCuisine, setActiveCuisine] = useState('All');
  const [activeDiet, setActiveDiet] = useState('Any');
  const [activeTime, setActiveTime] = useState('Any time');
  const [showFilters, setShowFilters] = useState(false);

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
    filterBarHeight.value = withSpring(next ? 140 : 0, { damping: 16, stiffness: 220 });
    filterOpacity.value = withTiming(next ? 1 : 0, { duration: 200 });
  };

  const filtered = useCallback(() => {
    return ALL_RECIPES.filter((r) => {
      const matchQuery = query.length === 0 ||
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.cuisine.toLowerCase().includes(query.toLowerCase());
      const matchCuisine = activeCuisine === 'All' || r.cuisine === activeCuisine;
      const matchDiet = activeDiet === 'Any' || r.diet === activeDiet;
      const matchTime = (() => {
        if (activeTime === 'Any time') return true;
        const mins = parseInt(r.cookTime);
        if (activeTime === 'Under 20 min') return mins < 20;
        if (activeTime === 'Under 30 min') return mins < 30;
        if (activeTime === 'Under 60 min') return mins < 60;
        return true;
      })();
      return matchQuery && matchCuisine && matchDiet && matchTime;
    });
  }, [query, activeCuisine, activeDiet, activeTime]);

  const results = filtered();
  const showEmpty = query.length > 0 && results.length === 0;
  const showRecents = query.length === 0;

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
            placeholder="Search recipes, cuisines…"
            placeholderTextColor={Colors.muted}
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
          ) : (
            <Pressable hitSlop={8} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
              <Ionicons name="mic-outline" size={18} color={Colors.muted} />
            </Pressable>
          )}
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
          <Text style={styles.filterGroupLabel}>Cuisine</Text>
          <FlatList
            horizontal
            data={CUISINE_FILTERS}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TagChip
                label={item}
                variant={activeCuisine === item ? 'active' : 'default'}
                onPress={() => { setActiveCuisine(item); Haptics.selectionAsync(); }}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipRow}
          />
        </View>
        <View style={styles.filterGroup}>
          <Text style={styles.filterGroupLabel}>Dietary</Text>
          <FlatList
            horizontal
            data={DIET_FILTERS}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TagChip
                label={item}
                variant={activeDiet === item ? 'active' : 'dietary'}
                onPress={() => { setActiveDiet(item); Haptics.selectionAsync(); }}
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

      {/* ── Recent searches (idle state) ── */}
      {showRecents && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          <View style={styles.recentsWrap}>
            <Text style={styles.recentsLabel}>Recent Searches</Text>
            <View style={styles.recentsRow}>
              {RECENT_SEARCHES.map((s) => (
                <TagChip
                  key={s}
                  label={s}
                  variant="default"
                  onPress={() => {
                    setQuery(s);
                    Haptics.selectionAsync();
                  }}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      )}

      {/* ── Results list ── */}
      {!showRecents && !showEmpty && (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <ResultRow item={item} onPress={() => goToRecipe(item.id)} />
          )}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* ── Empty state ── */}
      {showEmpty && (
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
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
  },
  filterChipRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },

  // Recent searches
  recentsWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  recentsLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    color: Colors.muted,
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
    color: Colors.muted,
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
