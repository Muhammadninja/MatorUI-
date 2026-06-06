import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppChip } from '@/components/shared/app-chip';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppView } from '@/components/shared/app-view';
import AppKeyboardController from '@/components/shared/keyboard-controller/app-keyboard-controller';
import { useThemeContext } from '@/contexts/theme.context';
import {
    modalService,
    type GlobalModalState,
    type ModalPayload,
} from '@/services/global-modal-service/global-modal.service';

type ConfirmModalPayload = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export type CheckoutSheetValues = {
  fullName: string;
  phoneNumber: string;
  addressNote: string;
  wantsInstallment: boolean;
  paymentMethod: string;
};

type CheckoutSheetPayload = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  paymentMethods?: string[];
  defaultValues?: Partial<CheckoutSheetValues>;
  onSubmit?: (values: CheckoutSheetValues) => void;
  onCancel?: () => void;
};

type AuthRequiredPayload = {
  title?: string;
  message?: string;
  /** Called after the user completes login. Defaults to no-op. */
  onAuthenticated?: () => void;
  onCancel?: () => void;
  /** Optional URL the auth screen replaces to after a successful sign-in. */
  redirectTo?: string;
};

function isAuthRequiredPayload(payload?: ModalPayload): payload is AuthRequiredPayload {
  return Boolean(payload && typeof payload === 'object');
}

const INSTALLMENT_OPTIONS = [
  { label: 'No installment', value: false },
  { label: 'Setup installment', value: true },
] as const;

function isConfirmModalPayload(payload?: ModalPayload): payload is ConfirmModalPayload {
  return Boolean(payload && typeof payload === 'object');
}

function isCheckoutSheetPayload(payload?: ModalPayload): payload is CheckoutSheetPayload {
  return Boolean(payload && typeof payload === 'object');
}

export default function GlobalModalHost() {
  const { scheme, tokens } = useThemeContext();
  const [activeModal, setActiveModal] = useState<GlobalModalState>(null);
  const [checkoutValues, setCheckoutValues] = useState<CheckoutSheetValues>({
    fullName: '',
    phoneNumber: '',
    addressNote: '',
    wantsInstallment: false,
    paymentMethod: 'Card',
  });

  useEffect(() => {
    return modalService.register(setActiveModal);
  }, []);

  useEffect(() => {
    if (activeModal?.name !== 'checkoutSheet' || !isCheckoutSheetPayload(activeModal.payload)) {
      return;
    }

    const defaults = activeModal.payload.defaultValues;
    setCheckoutValues({
      fullName: defaults?.fullName ?? '',
      phoneNumber: defaults?.phoneNumber ?? '',
      addressNote: defaults?.addressNote ?? '',
      wantsInstallment: defaults?.wantsInstallment ?? false,
      paymentMethod: defaults?.paymentMethod ?? 'Card',
    });
  }, [activeModal]);

  if (!activeModal) return null;

  if (activeModal.name === 'confirmAction' && isConfirmModalPayload(activeModal.payload)) {
    const {
      title = 'Confirm action',
      message = 'Are you sure you want to continue?',
      confirmLabel = 'Continue',
      cancelLabel = 'Cancel',
      onConfirm,
      onCancel,
    } = activeModal.payload;

    const handleClose = () => {
      onCancel?.();
      modalService.closeModal();
    };

    const handleConfirm = () => {
      onConfirm?.();
      modalService.closeModal();
    };

    return (
      <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
        <AppView flex={1} center px={20} style={{ backgroundColor: 'rgba(0, 0, 0, 0.42)' }}>
          <AppView
            rounded={28}
            px={18}
            py={18}
            gap={14}
            style={{
              width: '100%',
              maxWidth: 380,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <AppView gap={6}>
              <AppText textVariant="title" family="heading" weight="bold">
                {title}
              </AppText>
              <AppText textVariant="bodySm" colorName="gray400">
                {message}
              </AppText>
            </AppView>

            <AppView row gap={10}>
              <AppButton
                title={cancelLabel}
                kind="secondary"
                variant="outline"
                size="sm"
                fullWidth
                containerStyle={{ flex: 1 }}
                onPress={handleClose}
              />
              <AppButton
                title={confirmLabel}
                kind="secondary"
                size="sm"
                fullWidth
                containerStyle={{ flex: 1 }}
                onPress={handleConfirm}
              />
            </AppView>
          </AppView>
        </AppView>
      </Modal>
    );
  }

  // ── Privacy & Security bottom sheet ───────────────────────────────────────
  if (activeModal.name === 'privacySheet') {
    const handleClose = () => modalService.closeModal();

    return (
      <Modal transparent animationType="slide" visible onRequestClose={handleClose}>
        <AppView flex={1} justify="flex-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.42)' }}>
          <AppView
            roundedTop={28}
            px={18}
            pt={18}
            pb={12}
            safeArea="bottom"
            gap={16}
            style={{
              width: '100%',
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <AppView center>
              <AppView
                rounded={36}
                style={{ width: 36, height: 4, backgroundColor: tokens.divider }}
              />
            </AppView>
            <AppView gap={4}>
              <AppText textVariant="title" family="heading" weight="bold">
                Privacy & Security
              </AppText>
              <AppText textVariant="bodySm" colorName="gray400">
                Manage your data, consent, and account security preferences.
              </AppText>
            </AppView>
            <AppView
              rounded={20}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: scheme === 'dark' ? tokens.backgroundSecondary : tokens.gray50,
              }}
            >
              {[
                { label: 'Data & Personalization', subtitle: 'Control how your data is used' },
                { label: 'Connected Apps', subtitle: 'Manage third-party access' },
                { label: 'Delete Account', subtitle: 'Permanently remove your data', danger: true },
              ].map((item, i, arr) => (
                <AppView
                  key={item.label}
                  px={16}
                  py={14}
                  style={{
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: tokens.divider,
                  }}
                >
                  <AppText
                    textVariant="bodySemibold"
                    weight="semibold"
                    style={{ color: item.danger ? tokens.error : tokens.text }}
                  >
                    {item.label}
                  </AppText>
                  <AppText textVariant="bodyXs" colorName="gray400">
                    {item.subtitle}
                  </AppText>
                </AppView>
              ))}
            </AppView>
            <AppButton
              title="Close"
              kind="secondary"
              variant="outline"
              size="sm"
              fullWidth
              onPress={handleClose}
            />
          </AppView>
        </AppView>
      </Modal>
    );
  }

  // ── Auth-required gate (guest tries to check out) ───────────────────────
  if (activeModal.name === 'authRequired' && isAuthRequiredPayload(activeModal.payload)) {
    return <AuthRequiredModal payload={activeModal.payload} />;
  }

  if (activeModal.name !== 'checkoutSheet' || !isCheckoutSheetPayload(activeModal.payload)) {
    return null;
  }

  const {
    title = 'Checkout details',
    description = 'Add contact details, choose location delivery, decide on installment, and select a payment method.',
    confirmLabel = 'Continue to payment',
    cancelLabel = 'Cancel',
    paymentMethods = ['Card', 'Cash on delivery', 'Bank transfer'],
    onSubmit,
    onCancel,
  } = activeModal.payload;

  const handleSheetClose = () => {
    onCancel?.();
    modalService.closeModal();
  };

  const handleSubmit = () => {
    onSubmit?.(checkoutValues);
    modalService.closeModal();
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={handleSheetClose}>
      <AppView flex={1} justify="flex-end" style={{ backgroundColor: 'rgba(0, 0, 0, 0.42)' }}>
        <AppView
          roundedTop={28}
          px={18}
          pt={18}
          pb={12}
          safeArea="bottom"
          gap={14}
          style={{
            width: '100%',
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
          }}
        >
          <AppView row align="center" justify="space-between" gap={12}>
            <AppView gap={6} style={{ flex: 1 }}>
              <AppText textVariant="title" family="heading" weight="bold">
                {title}
              </AppText>
              <AppText textVariant="bodySm" colorName="gray400">
                {description}
              </AppText>
            </AppView>
            <AppButton
              title={cancelLabel}
              kind="secondary"
              variant="ghost"
              size="xs"
              onPress={handleSheetClose}
            />
          </AppView>

          <AppKeyboardController showToolbar={false} offset={120} horizontalPadding={0}>
            <AppTextField
              label="Full name"
              placeholder="Enter recipient name"
              value={checkoutValues.fullName}
              onChangeText={(value) =>
                setCheckoutValues((current) => ({ ...current, fullName: value }))
              }
              containerColorName="card"
              containerBorderName="border"
            />
            <AppTextField
              label="Phone number"
              placeholder="Enter contact number"
              value={checkoutValues.phoneNumber}
              onChangeText={(value) =>
                setCheckoutValues((current) => ({ ...current, phoneNumber: value }))
              }
              containerColorName="card"
              containerBorderName="border"
            />
            <AppView
              rounded={20}
              px={14}
              py={14}
              gap={6}
              style={{
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: scheme === 'dark' ? tokens.gray50 : tokens.gray50,
              }}
            >
              <AppText textVariant="bodySm" weight="semibold">
                Delivery location
              </AppText>
              <AppText textVariant="bodySm" colorName="gray400">
                Delivery address will be requested from the user location picker in the next step.
              </AppText>
            </AppView>
            <AppTextField
              label="Address note"
              placeholder="Landmark or delivery note"
              value={checkoutValues.addressNote}
              onChangeText={(value) =>
                setCheckoutValues((current) => ({ ...current, addressNote: value }))
              }
              containerColorName="card"
              containerBorderName="border"
            />

            <AppView gap={8}>
              <AppText textVariant="bodySm" weight="semibold">
                Installment
              </AppText>
              <AppView row gap={8} style={{ flexWrap: 'wrap' }}>
                {INSTALLMENT_OPTIONS.map((option) => {
                  const isSelected = checkoutValues.wantsInstallment === option.value;

                  return (
                    <AppChip
                      key={option.label}
                      label={option.label}
                      size="sm"
                      kind={isSelected ? 'secondary' : 'neutral'}
                      variant={isSelected ? 'solid' : 'outline'}
                      selected={isSelected}
                      labelColorName={isSelected ? (scheme === 'dark' ? 'white' : 'black') : 'text'}
                      borderColorName="border"
                      haptics="selection"
                      onPress={() =>
                        setCheckoutValues((current) => ({
                          ...current,
                          wantsInstallment: option.value,
                        }))
                      }
                    />
                  );
                })}
              </AppView>
            </AppView>

            <AppView gap={8}>
              <AppText textVariant="bodySm" weight="semibold">
                Payment method
              </AppText>
              <AppView row gap={8} style={{ flexWrap: 'wrap' }}>
                {paymentMethods.map((method) => {
                  const isSelected = checkoutValues.paymentMethod === method;

                  return (
                    <AppChip
                      key={method}
                      label={method}
                      size="sm"
                      kind={isSelected ? 'secondary' : 'neutral'}
                      variant={isSelected ? 'solid' : 'outline'}
                      selected={isSelected}
                      labelColorName={isSelected ? (scheme === 'dark' ? 'white' : 'black') : 'text'}
                      borderColorName="border"
                      haptics="selection"
                      onPress={() =>
                        setCheckoutValues((current) => ({ ...current, paymentMethod: method }))
                      }
                    />
                  );
                })}
              </AppView>
            </AppView>

          <AppView row gap={10}>
            <AppButton
              title="Close"
              kind="secondary"
              variant="outline"
              size="sm"
              fullWidth
              containerStyle={{ flex: 1 }}
              onPress={handleSheetClose}
            />
            <AppButton
              title={confirmLabel}
              kind="brand"
              size="sm"
              fullWidth
              containerStyle={{ flex: 1 }}
              onPress={handleSubmit}
            />
          </AppView>
          </AppKeyboardController>
        </AppView>
      </AppView>
    </Modal>
  );
}

// ── Auth-required modal ────────────────────────────────────────────────────

function AuthRequiredModal({ payload }: { payload: AuthRequiredPayload }) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const {
    title = 'Sign in to continue',
    message = 'You must sign up or log in before you can place an order. Your cart will stay saved.',
    onCancel,
    redirectTo,
  } = payload;

  const handleClose = () => {
    onCancel?.();
    modalService.closeModal();
  };

  const goToAuth = (target: '/sign-in' | '/sign-up') => {
    modalService.closeModal();
    const query = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : '';
    router.push(`${target}${query}` as never);
  };

  const handleLogin = () => goToAuth('/sign-in');
  const handleSignUp = () => goToAuth('/sign-up');

  return (
    <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
      <AppView flex={1} center px={20} style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}>
        <View
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: isDark ? `${tokens.border}80` : tokens.border,
            backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            overflow: 'hidden',
            ...Platform.select({
              ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 22 },
                shadowOpacity: isDark ? 0.55 : 0.22,
                shadowRadius: 32,
              },
              android: { elevation: 22 },
            }),
          }}
        >
          {/* Top highlight rim for the 3D feel */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
            }}
          />

          <AppView px={22} pt={26} pb={20} gap={18} align="center">
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${tokens.brand}18`,
                borderWidth: 1,
                borderColor: `${tokens.brand}30`,
              }}
            >
              <Lock size={26} strokeWidth={2.1} color={tokens.brand} />
            </View>

            <AppView gap={6} align="center">
              <AppText
                textVariant="title"
                family="heading"
                weight="bold"
                style={{ textAlign: 'center' }}
              >
                {title}
              </AppText>
              <AppText
                textVariant="bodySm"
                colorName="gray400"
                style={{ textAlign: 'center', maxWidth: 300 }}
              >
                {message}
              </AppText>
            </AppView>

            <AppView gap={10} style={{ width: '100%' }}>
              <AppButton
                title="Log in"
                kind="brand"
                size="md"
                fullWidth
                onPress={handleLogin}
              />
              <AppButton
                title="Sign up"
                kind="secondary"
                variant="outline"
                size="md"
                fullWidth
                onPress={handleSignUp}
              />
              <AppButton
                title="Not now"
                kind="text"
                variant="ghost"
                size="sm"
                fullWidth
                onPress={handleClose}
              />
            </AppView>
          </AppView>
        </View>
      </AppView>
    </Modal>
  );
}
