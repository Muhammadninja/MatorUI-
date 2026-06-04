import { ArrowLeft, FileText, Plus } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
    ActionSheetIOS,
    Alert,
    Animated,
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
} from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import AppKeyboardController from '@/components/shared/keyboard-controller/app-keyboard-controller';
import { useThemeContext } from '@/contexts/theme.context';
import {
    buildPaymentCard,
    EMPTY_CARD_DRAFT,
    formatCardNumberInput,
    formatExpiryInput,
    INITIAL_PAYMENT_CARDS,
    isCardDraftValid,
    type CardDraft
} from '@/utils/payment-methods';
import { router } from 'expo-router';

const CARD_H = 170;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function PaymentMethodsScreen() {
  const { tokens, scheme } = useThemeContext();
  const [paymentCards, setPaymentCards] = useState([...INITIAL_PAYMENT_CARDS]);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardDraft, setCardDraft] = useState<CardDraft>(EMPTY_CARD_DRAFT);
  const addCardAnimation = useRef(new Animated.Value(0)).current;

  const isCardFormValid = isCardDraftValid(cardDraft);
  const listScreenTranslateX = addCardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_WIDTH * 0.2],
  });
  const listScreenOpacity = addCardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const addCardScreenTranslateX = addCardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_WIDTH, 0],
  });
  const addCardScreenOpacity = addCardAnimation.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 0.35, 1],
  });

  function animateAddCardTransition(toValue: 0 | 1, onComplete?: () => void) {
    Animated.spring(addCardAnimation, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      mass: 0.9,
      stiffness: 180,
    }).start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });
  }

  function updateCardDraft(field: keyof CardDraft, value: string) {
    if (field === 'number') {
      setCardDraft((current) => ({ ...current, number: formatCardNumberInput(value) }));
      return;
    }

    if (field === 'expiry') {
      setCardDraft((current) => ({ ...current, expiry: formatExpiryInput(value) }));
      return;
    }

    if (field === 'cvv') {
      setCardDraft((current) => ({ ...current, cvv: value.replace(/\D/g, '').slice(0, 4) }));
      return;
    }

    setCardDraft((current) => ({ ...current, [field]: value }));
  }

  function closeAddCardScreen() {
    animateAddCardTransition(0, () => {
      setCardDraft(EMPTY_CARD_DRAFT);
      setIsAddingCard(false);
    });
  }

  function handleAddCardPress() {
    setCardDraft(EMPTY_CARD_DRAFT);
    setIsAddingCard(true);
    animateAddCardTransition(1);
  }

  function saveCard() {
    if (!isCardFormValid) {
      return;
    }

    setPaymentCards((currentCards) => [
      ...currentCards,
      buildPaymentCard(cardDraft, String(Date.now())),
    ]);

    closeAddCardScreen();
  }

  function openCardActions(cardId: string, isDefault: boolean) {
    const options = isDefault
      ? ['Edit Card', 'Cancel']
      : ['Edit Card', 'Set as Default', 'Remove Card', 'Cancel'];
    const destructiveIndex = isDefault ? undefined : options.indexOf('Remove Card');
    const cancelIndex = options.indexOf('Cancel');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
        },
        (index) => {
          if (options[index] === 'Remove Card') {
            confirmRemove(cardId);
          }
          // TODO: wire "Edit Card" and "Set as Default" to API calls
        },
      );
    } else {
      const buttons: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] =
        options
          .filter((o) => o !== 'Cancel')
          .map((o) => ({
            text: o,
            style: o === 'Remove Card' ? 'destructive' : undefined,
            onPress: o === 'Remove Card' ? () => confirmRemove(cardId) : undefined,
          }));
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Card options', undefined, buttons);
    }
  }

  function confirmRemove(cardId: string) {
    Alert.alert('Remove Card', 'Are you sure you want to remove this card?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPaymentCards((currentCards) => currentCards.filter((card) => card.id !== cardId));
        },
      },
    ]);
  }

  function renderAddCardScreen() {
    return (
      <AppView flex={1} colorName="background">
        <AppView
          row
          align="center"
          gap={12}
          px={16}
          pt={60}
          pb={16}
          style={{ borderBottomWidth: 1, borderBottomColor: tokens.divider }}
        >
          <AppPressableView
            center
            rounded={36}
            androidRipple={false}
            pressedOpacity={0.6}
            style={{ width: 38, height: 38, backgroundColor: tokens.backgroundSecondary }}
            onPress={closeAddCardScreen}
          >
            <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppView gap={1} style={{ flex: 1 }}>
            <AppText textVariant="h3" family="heading" weight="bold" colorName="text">
              Add Card
            </AppText>
            <AppText textVariant="bodyXs" colorName="gray400">
              Enter your card details securely and save only masked card data.
            </AppText>
          </AppView>
          <AppPressableView androidRipple={false} onPress={closeAddCardScreen}>
            <AppText textVariant="bodySm" weight="semibold" style={{ color: tokens.brand }}>
              Close
            </AppText>
          </AppPressableView>
        </AppView>

        <AppKeyboardController
          fillContainer
          showToolbar={false}
          offset={120}
          kStyle={{ paddingBottom: 32 }}
        >
          <AppView gap={14} pt={24}>
            <AppTextField
              label="Card Holder"
              placeholder="Full name on card"
              value={cardDraft.holder}
              onChangeText={(value) => updateCardDraft('holder', value)}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <AppTextField
              label="Card Number"
              placeholder="1234 5678 9012 3456"
              value={cardDraft.number}
              onChangeText={(value) => updateCardDraft('number', value)}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <AppView row gap={12}>
              <AppView flex={1}>
                <AppTextField
                  label="Expiry"
                  placeholder="MM/YY"
                  value={cardDraft.expiry}
                  onChangeText={(value) => updateCardDraft('expiry', value)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </AppView>
              <AppView flex={1}>
                <AppTextField
                  label="CVV"
                  placeholder="123"
                  value={cardDraft.cvv}
                  onChangeText={(value) => updateCardDraft('cvv', value)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </AppView>
            </AppView>

            <AppView
              rounded={16}
              px={14}
              py={12}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.backgroundSecondary,
              }}
            >
              <AppText textVariant="bodyXs" colorName="gray400" style={{ lineHeight: 18 }}>
                Card number and CVV stay only in this form while you are adding the card. The saved card preview stores holder name, expiry, brand, and last 4 digits only.
              </AppText>
            </AppView>

            <AppView row align="center" gap={10} mt={20}>
              <AppPressableView
                center
                androidRipple={false}
                onPress={closeAddCardScreen}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.backgroundSecondary,
                }}
              >
                <AppText textVariant="bodySemibold" weight="semibold" colorName="gray400">
                  Cancel
                </AppText>
              </AppPressableView>

              <AppPressableView
                center
                androidRipple={false}
                onPress={saveCard}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: tokens.brand,
                  opacity: isCardFormValid ? 1 : 0.5,
                }}
              >
                <AppText
                  textVariant="bodySemibold"
                  weight="semibold"
                  style={{ color: tokens.onBrand }}
                >
                  Save card
                </AppText>
              </AppPressableView>
            </AppView>
          </AppView>
        </AppKeyboardController>
      </AppView>
    );
  }

  return (
    <AppView flex={1} colorName="background" style={{ overflow: 'hidden' }}>
      <Animated.View
        style={{
          ...StyleSheet.absoluteFill,
          width: '100%',
          opacity: listScreenOpacity,
          transform: [{ translateX: listScreenTranslateX }],
        }}
        pointerEvents={isAddingCard ? 'none' : 'auto'}
      >
        <AppView flex={1} colorName="background">
          <AppView
            row
            align="center"
            gap={12}
            px={16}
            pt={60}
            pb={16}
            style={{ borderBottomWidth: 1, borderBottomColor: tokens.divider }}
          >
            <AppPressableView
              center
              rounded={36}
              androidRipple={false}
              pressedOpacity={0.6}
              style={{ width: 38, height: 38, backgroundColor: tokens.backgroundSecondary }}
              onPress={() => router.back()}
            >
              <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
            <AppView gap={1}>
              <AppText textVariant="h3" family="heading" weight="bold" colorName="text">
                Payment Methods
              </AppText>
              <AppText textVariant="bodyXs" colorName="gray400">
                Manage your cards and subscription
              </AppText>
            </AppView>
          </AppView>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
              {/* Cards section */}
              <AppView px={16} mt={24} gap={14}>
                <AppView row align="center" justify="space-between">
                  <AppText textVariant="subtitle" family="accent" weight="semibold" colorName="text">
                    Saved Cards
                  </AppText>
                </AppView>

                {paymentCards.map((card, index) => (
                  <AppView key={card.id}>
                    <AppView
                      rounded={22}
                      style={{
                        width: '100%',
                        height: CARD_H,
                        backgroundColor: card.color,
                        overflow: 'hidden',
                        ...Platform.select({
                          ios: {
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.35,
                            shadowRadius: 18,
                          },
                          android: { elevation: 16 },
                        }),
                      }}
                    >
                      <AppView
                        style={{
                          position: 'absolute',
                          top: -30,
                          right: -30,
                          width: 150,
                          height: 150,
                          borderRadius: 36,
                          backgroundColor: card.accentColor,
                        }}
                      />
                      <AppView
                        style={{
                          position: 'absolute',
                          bottom: -40,
                          left: -20,
                          width: 130,
                          height: 130,
                          borderRadius: 36,
                          backgroundColor: card.accentColor,
                        }}
                      />

                      <AppView
                        style={{
                          flex: 1,
                          padding: 20,
                          justifyContent: 'space-between',
                        }}
                      >
                        <AppView
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <AppView
                            style={{
                              width: 30,
                              height: 24,
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
                              color: '#fff',
                              letterSpacing: 1.5,
                              opacity: 0.95,
                              flex: 1,
                              textAlign: 'center',
                            }}
                          >
                            {card.brand}
                          </AppText>
                          <AppPressableView
                            androidRipple={false}
                            pressedOpacity={0.5}
                            onPress={() => openCardActions(card.id, index === 0)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 36,
                              backgroundColor: 'rgba(255,255,255,0.15)',
                              alignItems: 'center',
                              justifyContent: 'center',
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

                        <AppText
                          textVariant="bodySm"
                          style={{
                            color: 'rgba(255,255,255,0.6)',
                            letterSpacing: 3,
                            fontFamily: 'SpaceMono',
                          }}
                        >
                          {'•••• •••• •••• ' + card.last4}
                        </AppText>

                        <AppView
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            justifyContent: 'space-between',
                          }}
                        >
                          <AppView gap={2}>
                            <AppText
                              textVariant="caption"
                              style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}
                            >
                              CARD HOLDER
                            </AppText>
                            <AppText
                              textVariant="bodySm"
                              weight="semibold"
                              style={{ color: '#fff' }}
                            >
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
                            <AppText
                              textVariant="bodySm"
                              weight="semibold"
                              style={{ color: '#fff' }}
                            >
                              {card.expiry}
                            </AppText>
                          </AppView>
                        </AppView>
                      </AppView>
                    </AppView>
                  </AppView>
                ))}

                <AppPressableView
                  androidRipple={false}
                  pressedOpacity={0.7}
                  onPress={handleAddCardPress}
                  fillContainer
                  style={{
                    width: '100%',
                    minHeight: 42,
                    borderWidth: 1,
                    borderColor: tokens.brand,
                    borderRadius: 36,
                    backgroundColor: 'transparent',
                  }}
                >
                  <AppView row align="center" justify="center" gap={8} flex={1}>
                    <Plus size={16} strokeWidth={2.4} color={tokens.brand} />
                    <AppText textVariant="bodySm" weight="semibold" style={{ color: tokens.brand }}>
                      Add Card
                    </AppText>
                  </AppView>
                </AppPressableView>
              </AppView>

              <AppView px={16} mt={32} gap={14}>
                <AppText textVariant="subtitle" family="accent" weight="semibold" colorName="text">
                  Subscription
                </AppText>

                <AppView
                  rounded={20}
                  px={18}
                  py={16}
                  gap={12}
                  style={{
                    borderWidth: 1,
                    borderColor: tokens.border,
                    backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
                  }}
                >
                  <AppView row align="center" justify="space-between">
                    <AppView gap={3}>
                      <AppText textVariant="bodySemibold" weight="semibold" colorName="text">
                        Premium Plan
                      </AppText>
                      <AppText textVariant="bodyXs" colorName="gray400">
                        Billed monthly · Next renewal Jun 28
                      </AppText>
                    </AppView>
                    <AppView px={10} py={5} rounded={36} style={{ backgroundColor: '#F5C51822' }}>
                      <AppText textVariant="bodyXs" weight="semibold" style={{ color: '#C9960A' }}>
                        Active
                      </AppText>
                    </AppView>
                  </AppView>

                  <AppView style={{ height: 1, backgroundColor: tokens.divider }} />

                  <AppView row align="center" justify="space-between">
                    <AppText textVariant="bodySm" colorName="gray400">
                      Monthly price
                    </AppText>
                    <AppText textVariant="bodySemibold" weight="semibold" colorName="text">
                      $14.99 / mo
                    </AppText>
                  </AppView>

                  <AppButton
                    title="Cancel Subscription"
                    kind="secondary"
                    variant="outline"
                    size="sm"
                    fullWidth
                    style={{ borderColor: tokens.error }}
                    textStyle={{ color: tokens.error }}
                  />
                </AppView>
              </AppView>

              <AppView px={16} mt={32} gap={14}>
                <AppText textVariant="subtitle" family="accent" weight="semibold" colorName="text">
                  Terms & Conditions
                </AppText>

                <AppView
                  rounded={20}
                  px={18}
                  py={16}
                  gap={14}
                  style={{
                    borderWidth: 1,
                    borderColor: tokens.border,
                    backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
                  }}
                >
                  {[
                    {
                      title: 'Billing & Charges',
                      body: 'Your payment method will be charged at the start of each billing cycle. Charges are non-refundable unless required by law.',
                    },
                    {
                      title: 'Card Security',
                      body: 'We do not store full card numbers. All payment data is processed through PCI-DSS compliant third-party providers.',
                    },
                    {
                      title: 'Cancellation Policy',
                      body: 'You may cancel your subscription at any time. Access continues until the end of the current billing period.',
                    },
                    {
                      title: 'Disputes & Refunds',
                      body: 'For billing disputes, contact support within 30 days of the charge. Approved refunds are returned to the original payment method.',
                    },
                  ].map((clause, i, arr) => (
                    <AppView
                      key={clause.title}
                      gap={4}
                      pb={i < arr.length - 1 ? 14 : 0}
                      style={
                        i < arr.length - 1
                          ? { borderBottomWidth: 1, borderBottomColor: tokens.divider }
                          : undefined
                      }
                    >
                      <AppView style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <FileText size={13} strokeWidth={2} color={tokens.icon} />
                        <AppText textVariant="bodySemibold" weight="semibold" colorName="text">
                          {clause.title}
                        </AppText>
                      </AppView>
                      <AppText textVariant="bodyXs" colorName="gray400" style={{ lineHeight: 18 }}>
                        {clause.body}
                      </AppText>
                    </AppView>
                  ))}

                  <AppView style={{ height: 1, backgroundColor: tokens.divider }} />

                  <AppText textVariant="bodyXs" colorName="gray400" style={{ lineHeight: 17 }}>
                    By adding a payment method or maintaining an active subscription, you agree to our{' '}
                    <AppText
                      textVariant="bodyXs"
                      weight="semibold"
                      style={{ color: tokens.brand, textDecorationLine: 'underline' }}
                    >
                      full Terms of Service
                    </AppText>{' '}
                    and{' '}
                    <AppText
                      textVariant="bodyXs"
                      weight="semibold"
                      style={{ color: tokens.brand, textDecorationLine: 'underline' }}
                    >
                      Privacy Policy
                    </AppText>
                    .
                  </AppText>
                </AppView>
              </AppView>
          </ScrollView>
        </AppView>
      </Animated.View>

      <Animated.View
        style={{
          ...StyleSheet.absoluteFill,
          width: '100%',
          opacity: addCardScreenOpacity,
          transform: [{ translateX: addCardScreenTranslateX }],
        }}
        pointerEvents={isAddingCard ? 'auto' : 'none'}
      >
        {renderAddCardScreen()}
      </Animated.View>
    </AppView>
  );
}
