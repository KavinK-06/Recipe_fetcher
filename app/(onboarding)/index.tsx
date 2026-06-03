import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  useAnimatedScrollHandler,
  Extrapolation,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<SlideData>);

// ── Slide data ─────────────────────────────────────────────────────────────────
interface SlideData {
  key: string;
  headline: string;
  sub: string;
  illustration: React.ReactNode;
}

function Slide1Illustration() {
  return (
    <View style={il.container}>
      {/* Central URL bar */}
      <View style={il.urlBar}>
        <Ionicons name="link-outline" size={16} color={Colors.saffron} />
        <Text style={il.urlText}>instagram.com/reel/abc123</Text>
      </View>
      {/* Social icons row */}
      <View style={il.socialRow}>
        {[
          { icon: 'logo-tiktok', label: 'TikTok', color: '#69C9D0' },
          { icon: 'logo-instagram', label: 'Instagram', color: '#E1306C' },
          { icon: 'logo-youtube', label: 'YouTube', color: '#FF0000' },
        ].map((s) => (
          <View key={s.label} style={il.socialChip}>
            <View style={[il.socialIconWrap, { borderColor: s.color + '55' }]}>
              <Ionicons name={s.icon as any} size={22} color={s.color} />
            </View>
            <Text style={il.socialLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      {/* Arrow hint */}
      <Ionicons name="arrow-down" size={18} color={Colors.muted} style={{ marginTop: 16 }} />
      {/* Mini recipe preview card */}
      <View style={il.miniCard}>
        <View style={[il.miniCardImage, { backgroundColor: Colors.muted }]} />
        <View style={il.miniCardInfo}>
          <View style={il.miniLine} />
          <View style={[il.miniLine, { width: '60%' }]} />
        </View>
      </View>
    </View>
  );
}

function Slide2Illustration() {
  const cards = [
    { color: '#3A1820' },
    { color: '#2E1215' },
    { color: '#3D1A22' },
    { color: '#311520' },
  ];
  return (
    <View style={il.container}>
      <View style={il.cardGrid}>
        {cards.map((c, i) => (
          <View key={i} style={[il.gridCard, { backgroundColor: c.color }]}>
            <View style={il.gridCardImg} />
            <View style={il.gridCardBody}>
              <View style={il.gridLine} />
              <View style={[il.gridLine, { width: '55%' }]} />
              <View style={il.gridBadge}>
                <Ionicons name="time-outline" size={9} color={Colors.noir} />
                <Text style={il.gridBadgeText}>30 min</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Slide3Illustration() {
  return (
    <View style={il.container}>
      <View style={il.stepCard}>
        {/* Step header */}
        <View style={il.stepHeader}>
          <View style={il.stepBadge}>
            <Text style={il.stepBadgeText}>2</Text>
          </View>
          <Text style={il.stepMeta}>Step 2 of 6</Text>
          <View style={il.stepDot} />
        </View>
        {/* Step instruction */}
        <Text style={il.stepInstruction}>
          Heat olive oil in a large pan over medium-high heat until shimmering.
        </Text>
        {/* Timer ring mockup */}
        <View style={il.timerRow}>
          <View style={il.timerRing}>
            <Text style={il.timerText}>05:00</Text>
            <Text style={il.timerSub}>tap to start</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const SLIDES: SlideData[] = [
  {
    key: 'import',
    headline: 'Import from anywhere',
    sub: 'Paste a URL, share from TikTok, Instagram, or YouTube — Saveur does the rest.',
    illustration: <Slide1Illustration />,
  },
  {
    key: 'organised',
    headline: 'Every recipe,\nbeautifully organised',
    sub: 'Auto-tagged collections, smart search, and a library that grows with you.',
    illustration: <Slide2Illustration />,
  },
  {
    key: 'cook',
    headline: 'Cook smarter',
    sub: 'Step-by-step mode with built-in timers, ingredient scaling, and screen-always-on.',
    illustration: <Slide3Illustration />,
  },
];

// ── Dot indicator ──────────────────────────────────────────────────────────────
function Dots({
  count,
  scrollX,
}: {
  count: number;
  scrollX: Animated.SharedValue<number>;
}) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => {
        const dotStyle = useAnimatedStyle(() => {
          const inputRange = [
            (i - 1) * SCREEN_WIDTH,
            i * SCREEN_WIDTH,
            (i + 1) * SCREEN_WIDTH,
          ];
          const width = interpolate(
            scrollX.value,
            inputRange,
            [6, 20, 6],
            Extrapolation.CLAMP,
          );
          const opacity = interpolate(
            scrollX.value,
            inputRange,
            [0.35, 1, 0.35],
            Extrapolation.CLAMP,
          );
          return { width, opacity };
        });

        return (
          <Animated.View
            key={i}
            style={[styles.dot, dotStyle]}
          />
        );
      })}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const isLast = activeIndex === SLIDES.length - 1;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      router.replace('/(auth)');
      return;
    }
    flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    router.replace('/(auth)');
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(auth)');
  };

  // Button spring scale
  const nextScale = useSharedValue(1);
  const nextAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nextScale.value }],
  }));

  const renderSlide = ({ item }: { item: SlideData }) => (
    <View style={styles.slide}>
      <View style={styles.illustrationArea}>{item.illustration}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Skip — top right, hidden on last slide */}
      {!isLast && (
        <Pressable onPress={handleSkip} style={styles.skipButton} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      )}

      {/* Slides */}
      <AnimatedFlatList
        ref={flatRef as any}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        style={styles.flatList}
      />

      {/* Bottom content */}
      <View style={styles.bottom}>
        {/* Headline + subtitle */}
        <Text style={styles.headline}>{SLIDES[activeIndex].headline}</Text>
        <Text style={styles.sub}>{SLIDES[activeIndex].sub}</Text>

        {/* Dot pagination */}
        <Dots count={SLIDES.length} scrollX={scrollX} />

        {/* CTAs */}
        {isLast ? (
          <View style={styles.ctaGroup}>
            {/* Start Free Trial */}
            <Animated.View style={nextAnimStyle}>
              <Pressable
                style={styles.primaryButton}
                onPress={goNext}
                onPressIn={() => {
                  nextScale.value = withSpring(0.96, { damping: 14, stiffness: 300 });
                }}
                onPressOut={() => {
                  nextScale.value = withSpring(1, { damping: 14, stiffness: 300 });
                }}
              >
                <Text style={styles.primaryButtonText}>Start Free Trial</Text>
              </Pressable>
            </Animated.View>
            {/* Sign In ghost */}
            <Pressable style={styles.ghostButton} onPress={handleSignIn}>
              <Text style={styles.ghostButtonText}>Sign In</Text>
            </Pressable>
          </View>
        ) : (
          <Animated.View style={[styles.nextWrap, nextAnimStyle]}>
            <Pressable
              style={styles.primaryButton}
              onPress={goNext}
              onPressIn={() => {
                nextScale.value = withSpring(0.96, { damping: 14, stiffness: 300 });
              }}
              onPressOut={() => {
                nextScale.value = withSpring(1, { damping: 14, stiffness: 300 });
              }}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.parchment} />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Illustration sub-styles ────────────────────────────────────────────────────
const il = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  // Slide 1
  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  urlText: {
    fontFamily: Fonts.monoRegular,
    fontSize: 12,
    color: Colors.parchment,
    opacity: 0.7,
    flex: 1,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    width: '100%',
  },
  socialChip: {
    alignItems: 'center',
    gap: 6,
  },
  socialIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 11,
    color: Colors.parchment,
    opacity: 0.65,
  },
  miniCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    height: 60,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  miniCardImage: {
    width: 60,
    height: '100%',
  },
  miniCardInfo: {
    flex: 1,
    padding: 10,
    gap: 6,
    justifyContent: 'center',
  },
  miniLine: {
    height: 8,
    width: '80%',
    borderRadius: 4,
    backgroundColor: Colors.muted,
  },
  // Slide 2
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  gridCard: {
    width: (SCREEN_WIDTH - 80) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  gridCardImg: {
    height: 80,
    backgroundColor: Colors.muted,
  },
  gridCardBody: {
    padding: 8,
    gap: 5,
  },
  gridLine: {
    height: 7,
    width: '80%',
    borderRadius: 4,
    backgroundColor: Colors.muted,
  },
  gridBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 50,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  gridBadgeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 9,
    color: Colors.noir,
  },
  // Slide 3
  stepCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.burgundy,
    padding: 20,
    width: '100%',
    gap: 14,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.parchment,
  },
  stepMeta: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.paprika,
  },
  stepInstruction: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.parchment,
  },
  timerRow: {
    alignItems: 'center',
  },
  timerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: Colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.noir,
  },
  timerText: {
    fontFamily: Fonts.monoBold,
    fontSize: 16,
    color: Colors.parchment,
    letterSpacing: 1,
  },
  timerSub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 8,
    color: Colors.muted,
    marginTop: 1,
  },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.muted,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  illustrationArea: {
    flex: 1,
    paddingTop: 60,
  },
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    gap: 12,
  },
  headline: {
    fontFamily: Fonts.displayBold,
    fontSize: 34,
    lineHeight: 40,
    color: Colors.parchment,
    textAlign: 'center',
  },
  sub: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.muted,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.burgundy,
  },
  nextWrap: {
    marginTop: 4,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  primaryButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.parchment,
    letterSpacing: 0.3,
  },
  ctaGroup: {
    gap: 10,
    marginTop: 4,
  },
  ghostButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingVertical: 15,
  },
  ghostButtonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    color: Colors.parchment,
    letterSpacing: 0.3,
  },
});
