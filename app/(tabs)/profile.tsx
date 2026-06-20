import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useAuth, useUser } from '@clerk/clerk-expo';
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
import ConfirmDialog from '../../components/ConfirmDialog';
import { useEntitlements } from '../../hooks/useEntitlements';
import { deleteAccount, AccountError } from '../../lib/api/account';

const APP_VERSION = '1.0.0';

// Store-compliance links. Both Play and the App Store require a reachable
// Privacy Policy + Terms (EULA) and a support contact. Hosted on GitHub Pages
// (source in /docs); the same privacy URL goes in the Play Data Safety form +
// App Store Connect privacy field.
const PRIVACY_URL = 'https://kavink-06.github.io/Recipe_fetcher/privacy.html';
const TERMS_URL = 'https://kavink-06.github.io/Recipe_fetcher/terms.html';
const SUPPORT_EMAIL = 'kavinninja2006@gmail.com';

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ initials, imageUrl }: { initials: string; imageUrl?: string | null }) {
  return (
    <View style={styles.avatar}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} contentFit="cover" transition={200} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarInitials}>{initials}</Text>
      )}
      <View style={styles.avatarBadge}>
        <Ionicons name="camera" size={10} color={Colors.parchment} />
      </View>
    </View>
  );
}

/** Best-effort initials from a display name or email local-part. */
function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name ?? '').trim() || (email ?? '').split('@')[0] || '';
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '🍳';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Usage meter ────────────────────────────────────────────────────────────────
function UsageMeter({ used, limit }: { used: number; limit: number }) {
  // Credit imports (YouTube) bump the saved count past the free cap, so `used`
  // can exceed `limit` — clamp the bar and never show a negative remaining.
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const isNearLimit = pct >= 0.7;
  const remaining = Math.max(0, limit - used);
  const atLimit = used >= limit;

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
          {atLimit
            ? 'Limit reached — delete a recipe or upgrade to add more'
            : `${remaining} import${remaining !== 1 ? 's' : ''} remaining on the free plan`}
        </Text>
      )}
    </View>
  );
}

// ── YouTube imports meter ────────────────────────────────────────────────────
function YoutubeMeter({
  used,
  allowance,
  bonus,
  remaining,
  onGetMore,
}: {
  used: number;
  allowance: number;
  bonus: number;
  remaining: number;
  onGetMore: () => void;
}) {
  const pct = allowance > 0 ? Math.min(used / allowance, 1) : 0;
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
        <View style={styles.usageLabelRow}>
          <Ionicons name="film-outline" size={14} color={Colors.paprika} />
          <Text style={styles.usageLabel}>Import credits this month</Text>
        </View>
        <Text style={[styles.usageCount, isNearLimit && styles.usageCountWarning]}>
          {used} / {allowance}
        </Text>
      </View>
      <View style={styles.usageTrack}>
        <Animated.View
          style={[styles.usageFill, barStyle, isNearLimit && styles.usageFillWarning]}
        />
      </View>
      <Text style={styles.usageCostHint}>
        YouTube video 1 credit · calorie scan 1 credit
      </Text>
      <View style={styles.usageFootRow}>
        <Text style={styles.usageHintMuted}>
          {remaining} credit{remaining !== 1 ? 's' : ''} left
          {bonus > 0 ? ` · ${bonus} bonus credit${bonus !== 1 ? 's' : ''} included` : ''}
        </Text>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onGetMore();
          }}
        >
          <Text style={styles.usageGetMore}>Get more</Text>
        </Pressable>
      </View>
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
    // Entering animation (FadeInDown also drives translateY) goes on the OUTER
    // wrapper; the press-scale transform goes on an INNER view — keeping both
    // transforms off the same node so the entry animation can't clobber the scale.
    <Animated.View entering={FadeInDown.delay(delay).duration(260).springify()}>
      <Animated.View style={animStyle}>
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
  const { signOut, getToken } = useAuth();
  const { user } = useUser();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    isLifetime,
    recipeCount,
    recipeLimit,
    youtubeUsedThisMonth,
    youtubeAllowance,
    youtubeCredits,
    youtubeRemaining,
    showPaywall,
  } = useEntitlements();

  const displayName =
    user?.fullName ?? user?.firstName ?? user?.username ?? 'Chef';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initials = initialsFor(user?.fullName ?? user?.firstName, email);

  const openUrl = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Could not open link', 'Please try again later.');
    }
  };

  const handleContactSupport = async () => {
    const subject = encodeURIComponent(`Rasoi support (v${APP_VERSION})`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('no mail client');
      await Linking.openURL(url);
    } catch {
      Alert.alert('No email app found', `You can reach us at ${SUPPORT_EMAIL}.`);
    }
  };

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

  const handleDeleteAccount = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleting(true);
    try {
      // Wipes all data + the Clerk identity server-side. The session is invalid
      // afterwards, but still sign out locally to clear the cached token.
      await deleteAccount(getToken);
      await signOut().catch(() => {});
      setConfirmDelete(false);
      router.replace('/(auth)/sign-in');
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      const code = err instanceof AccountError ? err.code : 'unknown';
      Alert.alert(
        'Could not delete account',
        code === 'not_configured'
          ? 'Account deletion is temporarily unavailable. Please try again later or contact support.'
          : 'Something went wrong while deleting your account. Please try again, or contact support if it keeps happening.',
      );
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
        </View>

        {/* ── Avatar + identity ── */}
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.identityBlock}
        >
          <Avatar initials={initials} imageUrl={user?.imageUrl} />
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>{displayName}</Text>
            {email ? <Text style={styles.identityEmail} numberOfLines={1}>{email}</Text> : null}
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

        {/* ── YouTube imports meter (free + lifetime: both have a monthly cap) ── */}
        <Animated.View entering={FadeInDown.delay(90).duration(280).springify()}>
          <YoutubeMeter
            used={youtubeUsedThisMonth}
            allowance={youtubeAllowance}
            bonus={youtubeCredits}
            remaining={youtubeRemaining}
            onGetMore={() => showPaywall('yt_credits', 'out_of_credits')}
          />
        </Animated.View>

        {/* ── Upgrade CTA (free users only) ── */}
        {!isLifetime && (
          <Animated.View entering={FadeInDown.delay(120).duration(280).springify()}>
            <UpgradeCard onPress={() => showPaywall('lifetime')} />
          </Animated.View>
        )}

        {/* ── Features ── */}
        <SectionLabel label="Features" />
        <SectionCard>
          <SettingsRow
            icon="scan-outline"
            label="Calorie Scanner"
            sublabel="Estimate macros from a dish photo"
            iconBg={Colors.surface}
            onPress={() => router.push('/nutrition' as any)}
            delay={180}
          />
        </SectionCard>

        {/* ── Legal & support (store-required links) ── */}
        <SectionLabel label="Legal & Support" />
        <SectionCard>
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            iconBg={Colors.surface}
            onPress={() => openUrl(PRIVACY_URL)}
            delay={220}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            iconBg={Colors.surface}
            onPress={() => openUrl(TERMS_URL)}
            delay={260}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="mail-outline"
            label="Contact Support"
            sublabel={SUPPORT_EMAIL}
            iconBg={Colors.surface}
            onPress={handleContactSupport}
            delay={300}
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

        {/* ── Danger zone ── */}
        <SectionLabel label="Danger Zone" />
        <SectionCard>
          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            sublabel="Permanently erase your account and data"
            iconBg={`${Colors.paprika}22`}
            destructive
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setConfirmDelete(true);
            }}
            delay={470}
          />
        </SectionCard>

        {/* ── Version ── */}
        <Text style={styles.version}>Rasoi v{APP_VERSION}</Text>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete your account?"
        message="This permanently erases your recipes, collections, and sign-in — for good. This can’t be undone."
        confirmLabel="Delete Account"
        busy={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
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
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
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
    color: Colors.mutedText,
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
    color: Colors.mutedText,
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
  usageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usageHintMuted: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.mutedText,
  },
  usageCostHint: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.mutedText,
    letterSpacing: 0.2,
    marginTop: -2,
  },
  usageFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: -2,
  },
  usageGetMore: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.saffron,
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
    color: Colors.mutedText,
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
    color: Colors.mutedText,
  },

  // Version
  version: {
    fontFamily: Fonts.monoRegular,
    fontSize: 11,
    color: Colors.mutedText,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.4,
  },
});
