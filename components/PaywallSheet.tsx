import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { PRODUCT_PRICE_LABEL, type Product } from '../lib/api/billing';
import type { PaywallReason } from './PaywallProvider';
import { usePlayBilling } from './PlayBillingProvider';
import BottomSheet from './BottomSheet';

// Keep in sync with gating.ts / useEntitlements.ts (imported as a hook there would
// create a provider import cycle, so the cap is mirrored as a plain constant).
const FREE_RECIPE_LIMIT = 15;

interface Props {
  visible: boolean;
  initialProduct: Product;
  reason: PaywallReason;
  onClose: () => void;
}

const LIFETIME_PERKS = [
  'Unlimited saved recipes',
  'Unlimited URL imports',
  '20 monthly credits (imports + scans)',
  'All non-consumable features',
];

export default function PaywallSheet({ visible, reason, onClose }: Props) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { connected, productsByKey, busyProduct, lastGrant, buy } = usePlayBilling();

  // Read the (already-warm) entitlements cache for plan + saved-recipe count. We
  // read from cache rather than calling useEntitlements() to avoid an import cycle
  // (useEntitlements → usePaywall → PaywallProvider → here).
  const cachedEntitlement = queryClient.getQueryData<{
    plan?: string;
    recipe_count?: number;
  } | null>(['entitlements', userId]);
  const isLifetime = cachedEntitlement?.plan === 'lifetime';
  const recipeCount = cachedEntitlement?.recipe_count ?? FREE_RECIPE_LIMIT;

  // Prefer the Play Store's localized price; fall back to the ₹ label if products
  // haven't loaded yet (or we're not connected).
  const lifetimePrice = productsByKey.lifetime?.displayPrice ?? PRODUCT_PRICE_LABEL.lifetime;
  const creditsPrice = productsByKey.yt_credits?.displayPrice ?? PRODUCT_PRICE_LABEL.yt_credits;

  // Variant flags. recipe_limit only ever fires for free users (lifetime = unlimited
  // saves), so the Lifetime hero always shows there; the credit top-up is hidden
  // because buying credits can't raise the saved-recipe cap.
  const isRecipeLimit = reason === 'recipe_limit';
  const isOutOfCredits = reason === 'out_of_credits';
  const showTopUp = !isRecipeLimit;

  const title = isRecipeLimit
    ? 'Recipe limit reached'
    : isLifetime
      ? 'Top up credits'
      : isOutOfCredits
        ? 'Out of credits'
        : 'Unlock Rasoi';

  const intro = isRecipeLimit
    ? `Your free plan holds ${FREE_RECIPE_LIMIT} saved recipes — you're at ${recipeCount} / ${FREE_RECIPE_LIMIT}.`
    : isOutOfCredits && !isLifetime
      ? "You've used all your monthly import credits — top up to keep importing."
      : null;

  // Close the sheet once a purchase has been verified + granted (PlayBillingProvider
  // bumps `lastGrant`). Ignore the value present at mount.
  const lastGrantSeen = useRef(lastGrant);
  useEffect(() => {
    if (lastGrant !== lastGrantSeen.current) {
      lastGrantSeen.current = lastGrant;
      if (visible) onClose();
    }
  }, [lastGrant, visible, onClose]);

  const handleBuy = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buy(product);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetStyle={styles.sheet}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Pressable hitSlop={10} onPress={onClose}>
          <Ionicons name="close" size={22} color={Colors.muted} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Plain-language reason so the user knows WHY they hit the wall. */}
            {intro && <Text style={styles.intro}>{intro}</Text>}

            {/* Lifetime owners skip the upgrade hero — they already own it and just
                need consumable top-ups (extra YouTube imports / AI scans). */}
            {isLifetime && (
              <View style={styles.lifetimeNote}>
                <Ionicons name="infinite" size={15} color={Colors.saffron} />
                <Text style={styles.lifetimeNoteText}>
                  Lifetime active — top up import credits or AI scans anytime.
                </Text>
              </View>
            )}

            {/* ── Hero: Lifetime (hidden for existing lifetime owners) ── */}
            {!isLifetime && (
            <View style={styles.heroCard}>
              <View style={styles.heroBadge}>
                <Ionicons name="infinite" size={12} color={Colors.noir} />
                <Text style={styles.heroBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={styles.heroName}>Lifetime Unlock</Text>
              <View style={styles.heroPriceRow}>
                <Text style={styles.heroPrice}>{lifetimePrice}</Text>
                <Text style={styles.heroPriceNote}>one-time</Text>
              </View>
              {LIFETIME_PERKS.map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.saffron} />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
              <Pressable
                style={[styles.heroButton, busyProduct === 'lifetime' && styles.buttonBusy]}
                disabled={busyProduct !== null || !connected}
                onPress={() => handleBuy('lifetime')}
              >
                {busyProduct === 'lifetime' ? (
                  <ActivityIndicator color={Colors.parchment} />
                ) : (
                  <Text style={styles.heroButtonText}>Unlock for {lifetimePrice}</Text>
                )}
              </Pressable>
            </View>
            )}

            {/* ── Top-up (hidden on the recipe-limit sheet — credits don't raise
                the saved-recipe cap, only Lifetime or deleting recipes do) ── */}
            {showTopUp && (
              <>
                <Text style={styles.sectionLabel}>Top-up credits</Text>
                <View style={styles.topupRow}>
                  <TopUpCard
                    icon="ticket-outline"
                    title="10 Credits"
                    detail="Imports & calorie scans"
                    price={creditsPrice}
                    busy={busyProduct === 'yt_credits'}
                    disabled={busyProduct !== null || !connected}
                    onPress={() => handleBuy('yt_credits')}
                  />
                </View>

                <Text style={styles.topupHint}>
                  One pool of credits: a YouTube import or calorie scan uses 1.
                </Text>
              </>
            )}

            {/* The free alternative to upgrading: make room by deleting recipes. */}
            {isRecipeLimit && (
              <View style={styles.deleteHint}>
                <Ionicons name="trash-outline" size={15} color={Colors.mutedText} />
                <Text style={styles.deleteHintText}>
                  Or delete recipes you no longer need to free up space.
                </Text>
              </View>
            )}

            <View style={styles.secureRow}>
              <Ionicons
                name={connected ? 'lock-closed' : 'sync'}
                size={12}
                color={Colors.muted}
              />
              <Text style={styles.secureText}>
                {connected ? 'Secure payment · Google Play' : 'Connecting to Google Play…'}
              </Text>
            </View>
      </ScrollView>
    </BottomSheet>
  );
}

function TopUpCard({
  icon,
  title,
  detail,
  price,
  busy,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  price: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.topupCard} disabled={disabled} onPress={onPress}>
      <View style={styles.topupIconWrap}>
        <Ionicons name={icon} size={20} color={Colors.saffron} />
      </View>
      <View style={styles.topupText}>
        <Text style={styles.topupTitle}>{title}</Text>
        <Text style={styles.topupDetail}>{detail}</Text>
      </View>
      <View style={styles.topupPricePill}>
        {busy ? (
          <ActivityIndicator color={Colors.parchment} size="small" />
        ) : (
          <Text style={styles.topupPrice}>{price}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontFamily: Fonts.displayBold, fontSize: 26, color: Colors.parchment },
  scroll: { paddingTop: 8, gap: 16 },

  // Reason line under the title (why the paywall opened)
  intro: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.mutedText,
    marginTop: -8,
  },

  // "delete to free space" hint on the recipe-limit sheet
  deleteHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  deleteHintText: {
    flex: 1,
    fontFamily: Fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.mutedText,
  },

  // Lifetime owner note (replaces the hero for existing lifetime users)
  lifetimeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.burgundy,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  lifetimeNoteText: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.parchment,
  },

  // Hero
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.burgundy,
    padding: 18,
    gap: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.saffron,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
    marginBottom: 2,
  },
  heroBadgeText: {
    fontFamily: Fonts.monoBold,
    fontSize: 9,
    color: Colors.noir,
    letterSpacing: 0.8,
  },
  heroName: { fontFamily: Fonts.displaySemiBold, fontSize: 22, color: Colors.parchment },
  heroPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  heroPrice: { fontFamily: Fonts.displayBold, fontSize: 34, color: Colors.saffron },
  heroPriceNote: { fontFamily: Fonts.monoRegular, fontSize: 12, color: Colors.mutedText },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontFamily: Fonts.bodyRegular, fontSize: 14, color: Colors.parchment },
  heroButton: {
    marginTop: 12,
    backgroundColor: Colors.burgundy,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  heroButtonText: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.parchment },
  buttonBusy: { opacity: 0.7 },

  // Top-ups
  sectionLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  topupRow: { flexDirection: 'row', gap: 12 },
  topupCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 16,
  },
  topupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.noir,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topupText: { flex: 1, gap: 2 },
  topupTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.parchment },
  topupDetail: { fontFamily: Fonts.bodyRegular, fontSize: 12, color: Colors.mutedText },
  topupPricePill: {
    backgroundColor: Colors.burgundy,
    borderRadius: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  topupPrice: { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.parchment },

  topupHint: {
    fontFamily: Fonts.bodyRegular,
    fontSize: 12,
    color: Colors.mutedText,
    marginTop: -4,
  },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secureText: { fontFamily: Fonts.bodyRegular, fontSize: 12, color: Colors.mutedText },
});
