import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import IngredientRow from '../components/IngredientRow';
import ProBadge from '../components/ProBadge';
import { useEntitlements } from '../hooks/useEntitlements';

// ── Mock data ──────────────────────────────────────────────────────────────────
type ShoppingItem = {
  id: string;
  quantity: string;
  unit?: string;
  name: string;
  checked: boolean;
};

type ShoppingGroup = {
  category: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  items: ShoppingItem[];
};

const INITIAL_GROUPS: ShoppingGroup[] = [
  {
    category: 'Produce',
    icon: 'leaf-outline',
    items: [
      { id: 'p1', quantity: '3', unit: 'cloves', name: 'Garlic', checked: false },
      { id: 'p2', quantity: '1', unit: 'large', name: 'White onion', checked: true },
      { id: 'p3', quantity: '200', unit: 'g', name: 'Cherry tomatoes', checked: false },
      { id: 'p4', quantity: '1', name: 'Lemon', checked: false },
      { id: 'p5', quantity: '1', unit: 'bunch', name: 'Fresh parsley', checked: true },
    ],
  },
  {
    category: 'Dairy',
    icon: 'water-outline',
    items: [
      { id: 'd1', quantity: '100', unit: 'g', name: 'Parmesan', checked: false },
      { id: 'd2', quantity: '2', unit: 'tbsp', name: 'Unsalted butter', checked: false },
      { id: 'd3', quantity: '200', unit: 'ml', name: 'Heavy cream', checked: true },
    ],
  },
  {
    category: 'Pantry',
    icon: 'grid-outline',
    items: [
      { id: 'pa1', quantity: '320', unit: 'g', name: 'Arborio rice', checked: false },
      { id: 'pa2', quantity: '1', unit: 'litre', name: 'Vegetable stock', checked: false },
      { id: 'pa3', quantity: '3', unit: 'tbsp', name: 'Olive oil', checked: true },
      { id: 'pa4', quantity: '½', unit: 'tsp', name: 'Saffron threads', checked: false },
    ],
  },
  {
    category: 'Spices',
    icon: 'flask-outline',
    items: [
      { id: 's1', quantity: '1', unit: 'tsp', name: 'Smoked paprika', checked: false },
      { id: 's2', quantity: '½', unit: 'tsp', name: 'Ground cumin', checked: false },
      { id: 's3', quantity: '', name: 'Sea salt & black pepper', checked: true },
    ],
  },
];

// ── Category group header ──────────────────────────────────────────────────────
function CategoryHeader({
  icon,
  label,
  total,
  checked,
  expanded,
  onToggle,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  total: number;
  checked: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const chevronRotate = useSharedValue(expanded ? 180 : 0);

  React.useEffect(() => {
    chevronRotate.value = withSpring(expanded ? 180 : 0, { damping: 14, stiffness: 260 });
  }, [expanded, chevronRotate]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotate.value}deg` }],
  }));

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      style={styles.catHeader}
    >
      <View style={styles.catIconWrap}>
        <Ionicons name={icon} size={14} color={Colors.saffron} />
      </View>
      <Text style={styles.catLabel}>{label}</Text>
      <Text style={styles.catCount}>
        {checked}/{total}
      </Text>
      <Animated.View style={chevronStyle}>
        <Ionicons name="chevron-down" size={16} color={Colors.muted} />
      </Animated.View>
    </Pressable>
  );
}

// ── Pro gate overlay ───────────────────────────────────────────────────────────
function ProGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={28}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        // Android fallback — semi-transparent overlay
        <View style={[StyleSheet.absoluteFill, styles.androidBlurFallback]} />
      )}
      <View style={styles.gateContent} pointerEvents="box-none">
        <ProBadge variant="lock" onPress={onUpgrade} style={StyleSheet.absoluteFill} />
        <View style={styles.gateCTA} pointerEvents="box-none">
          <ProBadge variant="banner" onPress={onUpgrade} style={styles.gateBanner} />
        </View>
      </View>
    </View>
  );
}

// ── Add from recipe button ─────────────────────────────────────────────────────
function AddFromRecipeButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.addButtonWrap, animStyle]}>
      <Pressable
        style={styles.addButton}
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
        <Ionicons name="add-circle-outline" size={20} color={Colors.parchment} />
        <Text style={styles.addButtonText}>Add from Recipe</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ShoppingScreen() {
  const router = useRouter();
  // Shopping List is a Lifetime (non-consumable) feature.
  const { isLifetime, showPaywall } = useEntitlements();
  const [groups, setGroups] = useState<ShoppingGroup[]>(INITIAL_GROUPS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    Object.fromEntries(INITIAL_GROUPS.map((g) => [g.category, true])),
  );

  const toggleExpanded = (category: string) => {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleItem = (groupCategory: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.category !== groupCategory
          ? g
          : {
              ...g,
              items: g.items.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item,
              ),
            },
      ),
    );
  };

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
  const checkedItems = groups.reduce(
    (acc, g) => acc + g.items.filter((i) => i.checked).length,
    0,
  );
  const progressPct = totalItems > 0 ? checkedItems / totalItems : 0;

  const progressWidth = useSharedValue(progressPct);
  React.useEffect(() => {
    progressWidth.value = withTiming(progressPct, { duration: 400 });
  }, [progressPct, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          hitSlop={8}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.parchment} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>Shopping List</Text>
            <ProBadge variant="inline" />
          </View>
          <Text style={styles.headerSub}>
            {checkedItems} of {totalItems} items
          </Text>
        </View>
        <Pressable hitSlop={8} style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={Colors.muted} />
        </Pressable>
      </View>

      {/* ── Progress bar ── */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      {/* ── List content (visible beneath gate for free users) ── */}
      <View style={styles.listContainer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => {
            const checkedCount = group.items.filter((i) => i.checked).length;
            const isExpanded = expanded[group.category] ?? true;

            return (
              <Animated.View
                key={group.category}
                entering={FadeIn.duration(250)}
                style={styles.groupWrap}
              >
                <CategoryHeader
                  icon={group.icon}
                  label={group.category}
                  total={group.items.length}
                  checked={checkedCount}
                  expanded={isExpanded}
                  onToggle={() => toggleExpanded(group.category)}
                />
                {isExpanded &&
                  group.items.map((item) => (
                    <IngredientRow
                      key={item.id}
                      quantity={item.quantity}
                      unit={item.unit}
                      name={item.name}
                      isChecked={item.checked}
                      onToggle={() => toggleItem(group.category, item.id)}
                      style={styles.ingredientRow}
                    />
                  ))}
              </Animated.View>
            );
          })}

          {/* Bottom spacer for sticky button */}
          <View style={{ height: 96 }} />
        </ScrollView>

        {/* Sticky Add from Recipe button */}
        <View style={styles.stickyBottom}>
          <AddFromRecipeButton onPress={() => router.push('/(tabs)/collections' as any)} />
        </View>

        {/* Pro gate — layered on top of everything when not unlocked */}
        {!isLifetime && (
          <ProGate onUpgrade={() => showPaywall('lifetime')} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: Colors.parchment,
  },
  headerSub: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.3,
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress bar
  progressTrack: {
    height: 3,
    backgroundColor: Colors.muted,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.saffron,
    borderRadius: 2,
  },

  // List
  listContainer: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Group
  groupWrap: {
    marginBottom: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  catIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.noir,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.parchment,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  catCount: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.muted,
  },
  ingredientRow: {
    marginHorizontal: 14,
  },

  // Sticky bottom
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 12,
    backgroundColor: Colors.noir,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.muted,
  },
  addButtonWrap: {},
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 15,
  },
  addButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
    color: Colors.parchment,
  },

  // Pro gate
  androidBlurFallback: {
    backgroundColor: 'rgba(26,10,14,0.82)',
  },
  gateContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 80,
    paddingHorizontal: 20,
  },
  gateCTA: {
    zIndex: 10,
  },
  gateBanner: {
    // overrides position — banner is block-level here, not absolute
  },
});
