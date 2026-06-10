import React from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import ProBadge from '../../components/ProBadge';
import { useEntitlements } from '../../hooks/useEntitlements';

const APP_VERSION = '1.0.0';

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ initials }: { initials: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarInitials}>{initials}</Text>
      <View style={styles.avatarBadge}>
        <Ionicons name="camera" size={10} color={Colors.parchment} />
      </View>
    </View>
  );
}

// ── Usage meter ────────────────────────────────────────────────────────────────
function UsageMeter({ used, limit }: { used: number; limit: number }) {
  const pct = used / limit;
  const isNearLimit = pct >= 0.7;

  const barWidth = useSharedValue(0);
  React.useEffect(() => {
    barWidth.value = withTiming(pct, { duration: 700 });
  }, [pct, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value * 100}%`,
  }));

  return (
    <View style={styles.usageCard}>
      <View style={styles.usageRow}>
        <Text style={styles.usageLabel}>Free recipes used</Text>
        <Text style={[styles.usageCount, isNearLimit && styles.usageCountWarning]}>
          {used} / {limit}
        </Text>
      </View>
      <View style={styles.usageTrack}>
        <Animated.View
          style={[
            styles.usageFill,
            barStyle,
            isNearLimit && styles.usageFillWarning,
          ]}
        />
      </View>
      {isNearLimit && (
        <Text style={styles.usageHint}>
          {limit - used} import{limit - used !== 1 ? 's' : ''} remaining on the free plan
        </Text>
      )}
    </View>
  );
}

// ── Upgrade CTA card ───────────────────────────────────────────────────────────
function UpgradeCard({ onPress }: { onPress: () => void }) {
  return <ProBadge variant="banner" onPress={onPress} style={styles.upgradeCard} />;
}

// ── Settings row ───────────────────────────────────────────────────────────────
function SettingsRow({
  icon,
  label,
  sublabel,
  iconBg,
  destructive,
  onPress,
  delay,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  iconBg: string;
  destructive?: boolean;
  onPress?: () => void;
  delay: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(260).springify()} style={animStyle}>
      <Pressable
        style={styles.settingsRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress?.();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.985, { damping: 14, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        }}
      >
        <View style={[styles.settingsIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons
            name={icon}
            size={17}
            color={destructive ? Colors.paprika : Colors.parchment}
          />
        </View>
        <View style={styles.settingsText}>
          <Text style={[styles.settingsLabel, destructive && styles.settingsLabelDestructive]}>
            {label}
          </Text>
          {sublabel ? <Text style={styles.settingsSublabel}>{sublabel}</Text> : null}
        </View>
        {!destructive && (
          <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
        )}
      </Pressable>
    </Animated.View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { isLifetime, recipeCount, recipeLimit, showPaywall } = useEntitlements();

  const handleSignOut = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await signOut();
      // useProtectedRoute in the root layout will redirect to sign-in
      // automatically once isSignedIn flips, but replace explicitly for snappier UX.
      router.replace('/(auth)/sign-in');
    } catch {
      // No-op: signOut rarely fails, and the redirect hook is the safety net.
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header title ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable hitSlop={8} onPress={() => Haptics.selectionAsync()}>
            <Ionicons name="settings-outline" size={22} color={Colors.muted} />
          </Pressable>
        </View>

        {/* ── Avatar + identity ── */}
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.identityBlock}
        >
          <Avatar initials="CK" />
          <View style={styles.identityText}>
            <Text style={styles.identityName}>Chef Kavin</Text>
            <Text style={styles.identityEmail}>kavinninja2006@gmail.com</Text>
            {!isLifetime && (
              <View style={styles.freePlanRow}>
                <Text style={styles.freePlanLabel}>Free Plan</Text>
              </View>
            )}
            {isLifetime && (
              <View style={styles.proPlanRow}>
                <Ionicons name="star" size={11} color={Colors.noir} />
                <Text style={styles.proPlanLabel}>Lifetime</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Usage meter (free users only) ── */}
        {!isLifetime && (
          <Animated.View entering={FadeInDown.delay(60).duration(280).springify()}>
            <UsageMeter used={recipeCount} limit={recipeLimit} />
          </Animated.View>
        )}

        {/* ── Upgrade CTA (free users only) ── */}
        {!isLifetime && (
          <Animated.View entering={FadeInDown.delay(120).duration(280).springify()}>
            <UpgradeCard onPress={() => showPaywall('lifetime')} />
          </Animated.View>
        )}

        {/* ── Account settings ── */}
        <SectionLabel label="Account" />
        <SectionCard>
          <SettingsRow
            icon="person-outline"
            label="Edit Profile"
            sublabel="Name, photo, preferences"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={180}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            sublabel="Reminders, new features"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={220}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="lock-closed-outline"
            label="Privacy & Security"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={260}
          />
        </SectionCard>

        {/* ── App settings ── */}
        <SectionLabel label="App" />
        <SectionCard>
          <SettingsRow
            icon="moon-outline"
            label="Appearance"
            sublabel="Dark mode (default)"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={300}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="language-outline"
            label="Units & Language"
            sublabel="Metric · English"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={330}
          />
        </SectionCard>

        {/* ── Pro features ── */}
        <SectionLabel label="Features" />
        <SectionCard>
          <SettingsRow
            icon="cart-outline"
            label="Shopping List"
            sublabel="Pro feature"
            iconBg={Colors.surface}
            onPress={() => router.push('/shopping' as any)}
            delay={340}
          />
        </SectionCard>

        {/* ── Support ── */}
        <SectionLabel label="Support" />
        <SectionCard>
          <SettingsRow
            icon="help-circle-outline"
            label="Help & FAQ"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={360}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="chatbubble-outline"
            label="Send Feedback"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={390}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="star-outline"
            label="Rate Saveur"
            iconBg={Colors.surface}
            onPress={() => {}}
            delay={410}
          />
        </SectionCard>

        {/* ── Sign out ── */}
        <SectionCard>
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            iconBg={`${Colors.paprika}22`}
            destructive
            onPress={handleSignOut}
            delay={440}
          />
        </SectionCard>

        {/* ── Version ── */}
        <Text style={styles.version}>Saveur v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.noir,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 30,
    color: Colors.parchment,
  },

  // Avatar + identity
  identityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 16,
    marginBottom: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  avatarInitials: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    color: Colors.parchment,
    letterSpacing: 1,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  identityText: {
    flex: 1,
    gap: 3,
  },
  identityName: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 20,
    color: Colors.parchment,
  },
  identityEmail: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    color: Colors.muted,
  },
  freePlanRow: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  freePlanLabel: {
    fontFamily: Fonts.monoRegular,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.5,
  },
  proPlanRow: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 50,
    backgroundColor: Colors.saffron,
  },
  proPlanLabel: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    color: Colors.noir,
    letterSpacing: 0.6,
  },

  // Usage meter
  usageCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 16,
    gap: 10,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.parchment,
  },
  usageCount: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.saffron,
  },
  usageCountWarning: {
    color: Colors.paprika,
  },
  usageTrack: {
    height: 6,
    backgroundColor: Colors.muted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    backgroundColor: Colors.saffron,
    borderRadius: 3,
  },
  usageFillWarning: {
    backgroundColor: Colors.paprika,
  },
  usageHint: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.paprika,
    marginTop: -2,
  },

  // Upgrade card
  upgradeCard: {},

  // Section
  sectionLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    overflow: 'hidden',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.muted,
    marginLeft: 56,
  },

  // Settings row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  settingsIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsText: {
    flex: 1,
    gap: 2,
  },
  settingsLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.parchment,
  },
  settingsLabelDestructive: {
    color: Colors.paprika,
  },
  settingsSublabel: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.muted,
  },

  // Version
  version: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.4,
  },
});
