import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';
import { AlertCircle, MapPin } from 'lucide-react-native';

import AddressFormSheet, {
  type AddressFormValues,
} from '@/components/screens-components/account/address-form-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useToast } from '@/hooks/use-toast';
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useRemoveAddress,
  useSetDefaultAddress,
} from '@/hooks/use-orders';
import type { Address } from '@/services/orders-service';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ShippingAddressesScreen() {
  const { tokens } = useThemeContext();
  const toast = useToast();

  const { state, items: addresses, error, refresh } = useAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const removeAddress = useRemoveAddress();
  const setDefaultAddress = useSetDefaultAddress();

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setFormVisible(true);
  }, []);
  const openEdit = useCallback((address: Address) => {
    setEditing(address);
    setFormVisible(true);
  }, []);

  const handleSubmit = useCallback(
    async (values: AddressFormValues) => {
      try {
        if (editing) {
          await updateAddress.mutateAsync({ id: editing.id, input: values });
          toast.info('Address updated');
        } else {
          await createAddress.mutateAsync(values);
          toast.info('Address added');
        }
      } catch {
        toast.info('Couldn’t save address. Please try again.');
      }
    },
    [editing, updateAddress, createAddress, toast],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      try {
        await removeAddress.mutateAsync(id);
        toast.info('Address removed');
      } catch {
        toast.info('Couldn’t remove address. Please try again.');
      }
    },
    [removeAddress, toast],
  );

  const handleSetDefault = useCallback(
    async (id: string) => {
      try {
        await setDefaultAddress.mutateAsync(id);
        toast.info('Default address updated');
      } catch {
        toast.info('Couldn’t update default. Please try again.');
      }
    },
    [setDefaultAddress, toast],
  );

  const addButton = (
    <AppPressableView
      androidRipple={false}
      onPress={openAdd}
      accessibilityRole="button"
      accessibilityLabel="Add new address"
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
        title="Shipping addresses"
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
              Couldn&apos;t load your addresses
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
      ) : addresses.length === 0 ? (
        <AppView flex={1} center px={20} gap={10}>
          <MapPin size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText
            family="default"
            style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}
          >
            No shipping addresses yet. Add one to get started.
          </AppText>
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 12, paddingHorizontal: 16 }}
        >
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={openEdit}
              onRemove={handleRemove}
              onSetDefault={handleSetDefault}
            />
          ))}
        </ScrollView>
      )}

      <AddressFormSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </AppView>
  );
}

// ── Address card ──────────────────────────────────────────────────────────────

interface AddressCardProps {
  address: Address;
  onEdit: (address: Address) => void;
  onRemove: (id: string) => void;
  onSetDefault: (id: string) => void;
}

const AddressCard = React.memo(function AddressCard({
  address,
  onEdit,
  onRemove,
  onSetDefault,
}: AddressCardProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView
      style={{
        backgroundColor: tokens.card,
        borderWidth: 1,
        borderColor: address.isDefault ? tokens.brandBg : tokens.border,
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Label row + DEFAULT pill */}
      <AppView row align="center" justify="space-between" style={{ marginBottom: 6 }}>
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 15, color: tokens.text }}
        >
          {address.label}
        </AppText>
        {address.isDefault ? (
          <AppView
            style={{
              backgroundColor: tokens.brandBg,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <AppText
              family="accent"
              weight="bold"
              style={{ fontSize: 10, color: tokens.onBrand }}
            >
              DEFAULT
            </AppText>
          </AppView>
        ) : null}
      </AppView>

      {/* Name */}
      {address.name ? (
        <AppText family="default" style={{ fontSize: 14, color: tokens.text }}>
          {address.name}
        </AppText>
      ) : null}
      {/* Street */}
      <AppText
        family="default"
        style={{ fontSize: 13, color: tokens.textMuted, marginTop: 2 }}
      >
        {address.line1}
      </AppText>
      {/* City / state / zip */}
      <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
        {address.city}
      </AppText>

      {/* Actions */}
      <AppView row style={{ gap: 16, marginTop: 12 }}>
        <AppPressableView
          onPress={() => onEdit(address)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${address.label} address`}
        >
          <AppText
            family="accent"
            weight="bold"
            style={{ fontSize: 13, color: tokens.text }}
          >
            Edit
          </AppText>
        </AppPressableView>

        <AppPressableView
          onPress={() => onRemove(address.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${address.label} address`}
        >
          <AppText
            family="accent"
            weight="bold"
            style={{ fontSize: 13, color: tokens.error }}
          >
            Remove
          </AppText>
        </AppPressableView>

        {!address.isDefault ? (
          <AppPressableView
            onPress={() => onSetDefault(address.id)}
            accessibilityRole="button"
            accessibilityLabel={`Set ${address.label} as default address`}
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
      </AppView>
    </AppView>
  );
});
