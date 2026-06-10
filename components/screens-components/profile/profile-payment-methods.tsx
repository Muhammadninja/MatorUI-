import { router } from 'expo-router';
import { MoreHorizontal, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, ScrollView } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { INITIAL_PAYMENT_CARDS, type PaymentCard } from '@/utils/payment-methods';

const CARD_W = 240;
const CARD_H = 148;

// Unified elevation tier — see profile-hero-card.tsx. Keeping these in sync
// is what makes the screen feel like one design language, not three.
const CARD_ELEVATION = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 6 },
});

export default function ProfilePaymentMethods() {
  const { tokens } = useThemeContext();
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>(INITIAL_PAYMENT_CARDS);

  const handleAddNew = () => {
    router.push('/payment-methods');
  };

  const confirmRemove = (cardId: string) => {
    Alert.alert('Delete Card', 'Remove this card from your profile list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPaymentCards((currentCards) => currentCards.filter((card) => card.id !== cardId));
        },
      },
    ]);
  };

  const openCardActions = (cardId: string) => {
    const options = ['Manage Card', 'Delete Card', 'Cancel'];
    const cancelButtonIndex = options.indexOf('Cancel');
    const destructiveButtonIndex = options.indexOf('Delete Card');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex, destructiveButtonIndex },
        (index) => {
          if (options[index] === 'Manage Card') router.push('/payment-methods');
          if (options[index] === 'Delete Card') confirmRemove(cardId);
        },
      );
      return;
    }

    Alert.alert('Card options', undefined, [
      { text: 'Manage Card', onPress: () => router.push('/payment-methods') },
      { text: 'Delete Card', style: 'destructive', onPress: () => confirmRemove(cardId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 4 }}
    >
      {paymentCards.map((card) => (
        <AppPressableView
          key={card.id}
          rounded={16}
          androidRipple={false}
          pressedOpacity={0.88}
          pressedScale={0.97}
          onPress={() => router.push('/payment-methods')}
          accessibilityRole="button"
          accessibilityLabel={`${card.brand} ending in ${card.last4}`}
          style={{
            width: CARD_W,
            height: CARD_H,
            backgroundColor: card.color,
            padding: 18,
            overflow: 'hidden',
            ...CARD_ELEVATION,
          }}
        >
          {/* Decorative accents — full-radius so they actually read as circles */}
          <AppView
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 130,
              height: 130,
              borderRadius: 999,
              backgroundColor: card.accentColor,
            }}
          />
          <AppView
            style={{
              position: 'absolute',
              bottom: -40,
              left: -20,
              width: 120,
              height: 120,
              borderRadius: 999,
              backgroundColor: card.accentColor,
            }}
          />

          {/* Top row: chip + brand + actions */}
          <AppView row align="center" justify="space-between" style={{ marginBottom: 14 }}>
            <AppView row align="center" style={{ flex: 1 }}>
              <AppView
                style={{
                  width: 28,
                  height: 22,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.28)',
                }}
              />
              <AppText
                textVariant="subtitle"
                family="heading"
                weight="bold"
                style={{
                  color: tokens.white,
                  letterSpacing: 1.5,
                  opacity: 0.95,
                  marginLeft: 12,
                  flex: 1,
                }}
              >
                {card.brand}
              </AppText>
            </AppView>
            <AppPressableView
              center
              androidRipple={false}
              pressedOpacity={0.6}
              onPress={() => openCardActions(card.id)}
              accessibilityRole="button"
              accessibilityLabel="Card actions"
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <MoreHorizontal size={14} strokeWidth={2.2} color="rgba(255,255,255,0.85)" />
            </AppPressableView>
          </AppView>

          {/* Card number — uses accent family rather than introducing SpaceMono */}
          <AppText
            textVariant="bodySm"
            family="accent"
            style={{
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: 3,
              marginBottom: 14,
            }}
          >
            {`•••• •••• •••• ${card.last4}`}
          </AppText>

          {/* Bottom row: holder + expiry */}
          <AppView row align="flex-end" justify="space-between">
            <AppText textVariant="caption" weight="semibold" style={{ color: tokens.white }}>
              {card.holder}
            </AppText>
            <AppView gap={2} style={{ alignItems: 'flex-end' }}>
              <AppText
                textVariant="caption"
                style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}
              >
                EXPIRES
              </AppText>
              <AppText textVariant="caption" weight="semibold" style={{ color: tokens.white }}>
                {card.expiry}
              </AppText>
            </AppView>
          </AppView>
        </AppPressableView>
      ))}

      {/* Add-card affordance — the single inline-add CTA on this screen.
       *  The full payment-methods management surface is reached via the
       *  Preferences section row, not from a duplicate "Add New" header. */}
      <AppPressableView
        center
        rounded={16}
        androidRipple={false}
        pressedOpacity={0.7}
        onPress={handleAddNew}
        accessibilityRole="button"
        accessibilityLabel="Add a payment method"
        style={{
          width: 72,
          height: CARD_H,
          borderWidth: 1.5,
          borderColor: tokens.border,
          borderStyle: 'dashed',
          backgroundColor: tokens.card,
        }}
      >
        <Plus size={20} strokeWidth={2.2} color={tokens.gray400} />
      </AppPressableView>
    </ScrollView>
  );
}
