import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';
import { AlertCircle, CreditCard } from 'lucide-react-native';

import CardFormSheet, {
  type CardFormValues,
} from '@/components/screens-components/account/card-form-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useToast } from '@/hooks/use-toast';
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
} from '@/hooks/use-orders';
import { useUserContext } from '@/contexts/user.context';
import type { PaymentMethod } from '@/services/orders-service';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PaymentMethodsScreen() {
  const { tokens } = useThemeContext();
  const toast = useToast();

  const { state, items: cards, error, refresh } = usePaymentMethods();
  const createCard = useCreatePaymentMethod();
  const updateCard = useUpdatePaymentMethod();
  const removeCard = useRemovePaymentMethod();
  const setDefaultCard = useSetDefaultPaymentMethod();

  const { profile } = useUserContext();
  const cardholder = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : 'Cardholder';

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormVisible(true);
  }, []);
  const openEdit = useCallback((card: PaymentMethod) => {
    setEditing(card);
    setFormVisible(true);
  }, []);

  const handleSubmit = useCallback(
    async (values: CardFormValues) => {
      try {
        if (editing) {
          await updateCard.mutateAsync({ id: editing.id, input: values });
          toast.info('Card updated');
        } else {
          await createCard.mutateAsync(values);
          toast.info('Card added');
        }
      } catch {
        toast.info('Couldn’t save card. Please try again.');
      }
    },
    [editing, updateCard, createCard, toast],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        await removeCard.mutateAsync(id);
        toast.info('Card removed');
      } catch {
        toast.info('Couldn’t remove card. Please try again.');
      }
    },
    [removeCard, toast],
  );

  const handleSetDefault = useCallback(
    async (id: string) => {
      try {
        await setDefaultCard.mutateAsync(id);
        toast.info('Default card updated');
      } catch {
        toast.info('Couldn’t update default. Please try again.');
      }
    },
    [setDefaultCard, toast],
  );

  const addButton = (
    <AppPressableView
      androidRipple={false}
      onPress={openAdd}
      accessibilityRole="button"
      accessibilityLabel="Add new payment method"
      style={{
        backgroundColor: tokens.brandBg,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 9,
      }}
    >
      <AppText
        family="accent"
        weight="bold"
        style={{ fontSize: 12, color: tokens.onBrand }}
      >
        + Add
      </AppText>
    </AppPressableView>
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title="Payment methods"
        fallbackHref="/profile"
        right={addButton}
      />
      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={30} color={tokens.text} />
        </AppView>
      ) : state === 'error' ? (
        <AppView flex={1} center px={20} gap={14}>
          <AlertCircle size={34} strokeWidth={2} color={tokens.error} />
          <AppView gap={4} align="center">
            <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
              Couldn&apos;t load your cards
            </AppText>
            <AppText
              family="default"
              style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
            >
              {error ?? 'Something went wrong. Please try again.'}
            </AppText>
          </AppView>
          <AppButton title="Retry" kind="secondary" size="sm" onPress={refresh} />
        </AppView>
      ) : cards.length === 0 ? (
        <AppView flex={1} center px={20} gap={10}>
          <CreditCard size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText
            family="default"
            style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}
          >
            No payment methods yet. Add a card to get started.
          </AppText>
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 14, paddingHorizontal: 16 }}
        >
          {cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              cardholder={cardholder}
              onEdit={openEdit}
              onRemove={handleRemove}
              onSetDefault={handleSetDefault}
            />
          ))}
        </ScrollView>
      )}

      <CardFormSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </AppView>
  );
}

// ── Card tile ─────────────────────────────────────────────────────────────────
// Default card: brand-filled (brandBg / onBrand). Non-default: card bg/text.

interface CardTileProps {
  card: PaymentMethod;
  cardholder: string;
  onEdit: (card: PaymentMethod) => void;
  onRemove: (id: string) => void;
  onSetDefault: (id: string) => void;
}

const CardTile = React.memo(function CardTile({
  card,
  cardholder,
  onEdit,
  onRemove,
  onSetDefault,
}: CardTileProps) {
  const { tokens } = useThemeContext();

  const bg = card.isDefault ? tokens.brandBg : tokens.card;
  const fg = card.isDefault ? tokens.onBrand : tokens.text;
  const fgMuted = card.isDefault ? `${tokens.onBrand}CC` : tokens.textMuted;
  const borderColor = card.isDefault ? tokens.brandBg : tokens.border;

  return (
    <AppView
      style={{
        borderRadius: 18,
        padding: 18,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        minHeight: 120,
        justifyContent: 'space-between',
      }}
    >
      {/* Top row: brand + DEFAULT badge */}
      <AppView row align="center" justify="space-between">
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 16, color: fg }}
        >
          {card.brand}
        </AppText>
        {card.isDefault ? (
          <AppText
            family="accent"
            weight="bold"
            style={{ fontSize: 10, color: fg, opacity: 0.8 }}
          >
            DEFAULT
          </AppText>
        ) : null}
      </AppView>

      {/* Masked card number */}
      <AppText
        style={{
          fontFamily: 'SpaceMono',
          fontSize: 18,
          letterSpacing: 2,
          color: fg,
          marginTop: 12,
        }}
      >
        {'···· ···· ···· ' + card.last4}
      </AppText>

      {/* Bottom row: cardholder + expiry */}
      <AppView row align="center" justify="space-between" style={{ marginTop: 12 }}>
        <AppText family="default" style={{ fontSize: 12, color: fgMuted }}>
          {cardholder}
        </AppText>
        <AppText family="default" style={{ fontSize: 12, color: fgMuted }}>
          {card.exp}
        </AppText>
      </AppView>

      {/* Actions row */}
      <AppView row style={{ gap: 16, marginTop: 14 }}>
        <AppPressableView
          onPress={() => onEdit(card)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${card.brand} ending ${card.last4}`}
        >
          <AppText family="accent" weight="bold" style={{ fontSize: 13, color: fg }}>
            Edit
          </AppText>
        </AppPressableView>

        {!card.isDefault ? (
          <AppPressableView
            onPress={() => onSetDefault(card.id)}
            accessibilityRole="button"
            accessibilityLabel={`Set ${card.brand} ending ${card.last4} as default`}
          >
            <AppText
              family="accent"
              weight="bold"
              style={{ fontSize: 13, color: tokens.brandBg }}
            >
              Set default
            </AppText>
          </AppPressableView>
        ) : null}

        <AppPressableView
          onPress={() => onRemove(card.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${card.brand} ending ${card.last4}`}
        >
          <AppText
            family="accent"
            weight="bold"
            style={{ fontSize: 13, color: card.isDefault ? tokens.onBrand : tokens.error }}
          >
            Remove
          </AppText>
        </AppPressableView>
      </AppView>
    </AppView>
  );
});
