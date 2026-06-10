import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { createOrder, type CreateOrderResult, type Product } from '../lib/api/billing';
import RazorpayCheckoutWebView from './RazorpayCheckoutWebView';

interface Props {
  visible: boolean;
  initialProduct: Product;
  onClose: () => void;
}

const LIFETIME_PERKS = [
  'Unlimited saved recipes',
  'Unlimited URL imports',
  '20 YouTube imports / month',
  'All non-consumable features',
];

const PRODUCT_DESCRIPTION: Record<Product, string> = {
  lifetime: 'Saveur Lifetime Unlock',
  yt_credits: '10 YouTube import credits',
  ai_credits: '50 AI scan credits',
};

export default function PaywallSheet({ visible, onClose }: Props) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [busyProduct, setBusyProduct] = useState<Product | null>(null);
  const [checkout, setCheckout] = useState<{ order: CreateOrderResult; product: Product } | null>(
    null,
  );

  // Drop any half-finished checkout when the sheet is dismissed.
  useEffect(() => {
    if (!visible) {
      setCheckout(null);
      setBusyProduct(null);
    }
  }, [visible]);

  const handleBuy = async (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyProduct(product);
    try {
      const order = await createOrder(product, () => getToken());
      setCheckout({ order, product });
    } catch {
      Alert.alert('Could not start checkout', 'Please try again in a moment.');
    } finally {
      setBusyProduct(null);
    }
  };

  const handleSuccess = () => {
    setCheckout(null);
    // The webhook grants the entitlement asynchronously; refetch so the new
    // state lands as soon as it's processed (and again shortly after).
    queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['entitlements'] }), 2500);
    onClose();
    Alert.alert('Payment received', 'Your purchase will be active in a moment.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Unlock Saveur</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* ── Hero: Lifetime ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroBadge}>
                <Ionicons name="infinite" size={12} color={Colors.noir} />
                <Text style={styles.heroBadgeText}>BEST VALUE</Text>
              </View>
              <Text style={styles.heroName}>Lifetime Unlock</Text>
              <View style={styles.heroPriceRow}>
                <Text style={styles.heroPrice}>₹499</Text>
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
                disabled={busyProduct !== null}
                onPress={() => handleBuy('lifetime')}
              >
                {busyProduct === 'lifetime' ? (
                  <ActivityIndicator color={Colors.parchment} />
                ) : (
                  <Text style={styles.heroButtonText}>Unlock for ₹499</Text>
                )}
              </Pressable>
            </View>

            {/* ── Top-ups ── */}
            <Text style={styles.sectionLabel}>Top-ups</Text>
            <View style={styles.topupRow}>
              <TopUpCard
                icon="logo-youtube"
                title="YouTube"
                detail="10 imports"
                price="₹49"
                busy={busyProduct === 'yt_credits'}
                disabled={busyProduct !== null}
                onPress={() => handleBuy('yt_credits')}
              />
              <TopUpCard
                icon="sparkles"
                title="AI Scans"
                detail="50 credits"
                price="₹99"
                busy={busyProduct === 'ai_credits'}
                disabled={busyProduct !== null}
                onPress={() => handleBuy('ai_credits')}
              />
            </View>

            <View style={styles.secureRow}>
              <Ionicons name="lock-closed" size={12} color={Colors.muted} />
              <Text style={styles.secureText}>Secure payment via Razorpay</Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {checkout && (
        <RazorpayCheckoutWebView
          order={checkout.order}
          description={PRODUCT_DESCRIPTION[checkout.product]}
          onSuccess={handleSuccess}
          onDismiss={() => setCheckout(null)}
          onError={(message) => {
            setCheckout(null);
            Alert.alert('Payment failed', message);
          }}
        />
      )}
    </Modal>
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
      <Ionicons name={icon} size={20} color={Colors.saffron} />
      <Text style={styles.topupTitle}>{title}</Text>
      <Text style={styles.topupDetail}>{detail}</Text>
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
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  backdropFill: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: Colors.noir,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.muted,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.muted,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontFamily: Fonts.displayBold, fontSize: 26, color: Colors.parchment },
  scroll: { paddingTop: 8, gap: 16 },

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
  heroPriceNote: { fontFamily: Fonts.monoRegular, fontSize: 12, color: Colors.muted },
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
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  topupRow: { flexDirection: 'row', gap: 12 },
  topupCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.muted,
    padding: 16,
    gap: 6,
    alignItems: 'flex-start',
  },
  topupTitle: { fontFamily: Fonts.bodyBold, fontSize: 15, color: Colors.parchment },
  topupDetail: { fontFamily: Fonts.bodyRegular, fontSize: 12, color: Colors.muted },
  topupPricePill: {
    marginTop: 6,
    backgroundColor: Colors.muted,
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 56,
    alignItems: 'center',
  },
  topupPrice: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.parchment },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secureText: { fontFamily: Fonts.bodyRegular, fontSize: 12, color: Colors.muted },
});
