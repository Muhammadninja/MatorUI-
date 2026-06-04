import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, ScrollView } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { INITIAL_PAYMENT_CARDS, type PaymentCard } from '@/utils/payment-methods';
import { router } from 'expo-router';

const CARD_W = 240;
const CARD_H = 148;

export default function ProfilePaymentMethods() {
  const { tokens } = useThemeContext();
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>(INITIAL_PAYMENT_CARDS);

  function handleAddNew() {
    router.push('/payment-methods');
  }

  function confirmRemove(cardId: string) {
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
  }

  function openCardActions(cardId: string) {
    const options = ['Manage Card', 'Delete Card', 'Cancel'];
    const cancelButtonIndex = options.indexOf('Cancel');
    const destructiveButtonIndex = options.indexOf('Delete Card');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
        },
        (index) => {
          if (options[index] === 'Manage Card') {
            router.push('/payment-methods');
          }

          if (options[index] === 'Delete Card') {
            confirmRemove(cardId);
          }
        },
      );
      return;
    }

    Alert.alert('Card options', undefined, [
      { text: 'Manage Card', onPress: () => router.push('/payment-methods') },
      { text: 'Delete Card', style: 'destructive', onPress: () => confirmRemove(cardId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <AppView gap={12} px={2}>
      {/* Header */}
      <AppView row align="center" justify="space-between" px={16}>
        <AppText textVariant="subtitle" family="accent" weight="semibold" colorName="text">
          Payment Methods
        </AppText>
        <AppPressableView androidRipple={false} pressedOpacity={0.6} onPress={handleAddNew}>
          <AppText textVariant="bodySm" weight="semibold" colorName="gray400">
            Add New
          </AppText>
        </AppPressableView>
      </AppView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingVertical: 8 }}
      >
        {paymentCards.map((card) => (
          <AppPressableView
            key={card.id}
            rounded={22}
            androidRipple={false}
            pressedOpacity={0.88}
            pressedScale={0.97}
            onPress={() => router.push('/payment-methods')}
            style={{
              width: CARD_W,
              height: CARD_H,
              backgroundColor: card.color,
              padding: 18,
              overflow: 'hidden',
              ...Platform.select({
                ios: {
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.35,
                  shadowRadius: 18,
                },
                android: { elevation: 16 },
              }),
            }}
          >
            {/* Decorative background circle */}
            <AppView
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 130,
                height: 130,
                borderRadius: 36,
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
                borderRadius: 36,
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
                    borderRadius: 5,
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
                    color: '#ffffff',
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
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 36,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                }}
              >
                <AppText
                  style={{
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 14,
                    letterSpacing: 1.5,
                    marginTop: -4,
                  }}
                >
                  •••
                </AppText>
              </AppPressableView>
            </AppView>

            {/* Card number */}
            <AppText
              textVariant="bodySm"
              style={{
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: 3,
                marginBottom: 14,
                fontFamily: 'SpaceMono',
              }}
            >
              {'•••• •••• •••• ' + card.last4}
            </AppText>

            {/* Bottom row: holder + expiry */}
            <AppView row align="flex-end" justify="space-between">
              <AppView gap={2}>

                <AppText textVariant="caption" weight="semibold" style={{ color: '#ffffff' }}>
                  {card.holder}
                </AppText>
              </AppView>
              <AppView gap={2} style={{ alignItems: 'flex-end' }}>
                <AppText
                  textVariant="caption"
                  style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}
                >
                  EXPIRES
                </AppText>
                <AppText textVariant="caption" weight="semibold" style={{ color: '#ffffff' }}>
                  {card.expiry}
                </AppText>
              </AppView>
            </AppView>
          </AppPressableView>
        ))}

        {/* Add card placeholder */}
        <AppPressableView
          center
          rounded={22}
          androidRipple={false}
          pressedOpacity={0.7}
          onPress={handleAddNew}
          style={{
            width: 72,
            height: CARD_H,
            borderWidth: 1.5,
            borderColor: tokens.border,
            borderStyle: 'dashed',
            backgroundColor: tokens.card,
          }}
        >
          <AppText textVariant="title" colorName="gray400">
            +
          </AppText>
        </AppPressableView>
      </ScrollView>
    </AppView>
  );
}
