import { router } from 'expo-router';
import { ArrowLeft, Check, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';

import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import AppTextField from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import AppKeyboardController from '@/components/shared/keyboard-controller/app-keyboard-controller';
import { useThemeContext } from '@/contexts/theme.context';
import {
    buildAddress,
    EMPTY_ADDRESS_DRAFT,
    INITIAL_ADDRESSES,
    isAddressDraftValid,
    type Address,
    type AddressDraft,
} from '@/utils/shipping-addresses';

export default function ShippingAddressesScreen() {
  const { tokens } = useThemeContext();
  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const isAddressFormValid = isAddressDraftValid(addressDraft);

  function setDefault(id: string) {
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
  }

  function remove(id: string) {
    setAddresses((prev) => {
      const nextAddresses = prev.filter((a) => a.id !== id);

      if (nextAddresses.length === 0) {
        return nextAddresses;
      }

      if (nextAddresses.some((a) => a.isDefault)) {
        return nextAddresses;
      }

      return nextAddresses.map((address, index) => ({
        ...address,
        isDefault: index === 0,
      }));
    });
  }

  function updateDraft(field: keyof AddressDraft, value: string) {
    setAddressDraft((prev) => ({ ...prev, [field]: value }));
  }

  function cancelAddAddress() {
    setAddressDraft(EMPTY_ADDRESS_DRAFT);
    setIsAddingAddress(false);
  }

  function addAddress() {
    if (!isAddressDraftValid(addressDraft)) {
      return;
    }

    setAddresses((prev) => [
      ...prev,
      buildAddress(addressDraft, `addr-${Date.now()}`, prev.length === 0),
    ]);
    setAddressDraft(EMPTY_ADDRESS_DRAFT);
    setIsAddingAddress(false);
  }

  if (isAddingAddress) {
    return (
      <ScreenShell>
        <AppView flex={1} mt={14} gap={20}>
          <AppView px={16} gap={14}>
            <AppView row align="center">
              <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
                <AppPressableView
                  row
                  align="center"
                  androidRipple={false}
                  onPress={cancelAddAddress}
                >
                  <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
                </AppPressableView>
              </AppView>

              <AppText
                textVariant="title"
                family="heading"
                weight="bold"
                style={{ textAlign: 'center' }}
              >
                New Address
              </AppText>

              <AppView style={{ flex: 1, alignItems: 'flex-end' }}>
                <AppPressableView androidRipple={false} onPress={cancelAddAddress}>
                  <AppText textVariant="bodySm" weight="semibold" style={{ color: tokens.brand }}>
                    Close
                  </AppText>
                </AppPressableView>
              </AppView>
            </AppView>

            <AppText textVariant="bodySm" colorName="gray400">
              Add a delivery location for future orders.
            </AppText>
          </AppView>

          <AppKeyboardController
            fillContainer
            showToolbar={false}
            offset={120}
            kStyle={{ paddingBottom: 32 }}
          >
            <AppView gap={14}>
              <AppTextField
                label="Label"
                placeholder="Home, Work, Garage..."
                value={addressDraft.label}
                onChangeText={(value) => updateDraft('label', value)}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <AppTextField
                label="Recipient"
                placeholder="Full name"
                value={addressDraft.name}
                onChangeText={(value) => updateDraft('name', value)}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <AppTextField
                label="Address line 1"
                placeholder="Street address"
                value={addressDraft.line1}
                onChangeText={(value) => updateDraft('line1', value)}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <AppTextField
                label="Address line 2"
                placeholder="City, state, ZIP, country"
                value={addressDraft.line2}
                onChangeText={(value) => updateDraft('line2', value)}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </AppView>

            <AppView row align="center" gap={10} mt={20}>
              <AppPressableView
                center
                androidRipple={false}
                onPress={cancelAddAddress}
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
                onPress={addAddress}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: tokens.brand,
                  opacity: isAddressFormValid ? 1 : 0.5,
                }}
              >
                <AppText
                  textVariant="bodySemibold"
                  weight="semibold"
                  style={{ color: tokens.onBrand }}
                >
                  Save address
                </AppText>
              </AppPressableView>
            </AppView>
          </AppKeyboardController>
        </AppView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <AppView mt={14} gap={20}>
          {/* Header */}
          <AppView px={16} gap={14}>
            <AppView row align="center">
              <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
                <AppPressableView
                  row
                  align="center"
                  androidRipple={false}
                  onPress={() => router.back()}
                >
                  <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
                </AppPressableView>
              </AppView>

              <AppText
                textVariant="title"
                family="heading"
                weight="bold"
                style={{ textAlign: 'center' }}
              >
                Addresses
              </AppText>

              <AppView style={{ flex: 1 }} />
            </AppView>

            <AppText textVariant="bodySm" colorName="gray400">
              Manage your saved delivery locations.
            </AppText>
          </AppView>

          {/* Address cards */}
          <AppView px={16} gap={12}>
            {addresses.map((address) => (
              <AppView
                key={address.id}
                rounded={20}
                style={{
                  borderWidth: 1,
                  borderColor: address.isDefault ? tokens.brand : tokens.border,
                  backgroundColor: tokens.card,
                  padding: 16,
                }}
              >
                <AppView gap={10}>
                  {/* Top row */}
                  <AppView row align="center" justify="space-between">
                    <AppView row align="center" gap={8}>
                      <AppView
                        center
                        rounded={10}
                        style={{
                          width: 34,
                          height: 34,
                          backgroundColor: address.isDefault
                            ? tokens.brand
                            : tokens.backgroundSecondary,
                        }}
                      >
                        <MapPin
                          size={16}
                          strokeWidth={2.1}
                          color={address.isDefault ? tokens.onBrand : tokens.icon}
                        />
                      </AppView>
                      <AppView gap={2}>
                        <AppText textVariant="bodySemibold" weight="semibold">
                          {address.label}
                        </AppText>
                        {address.isDefault ? (
                          <AppView row align="center" gap={4}>
                            <Check size={10} strokeWidth={2.4} color={tokens.success} />
                            <AppText
                              textVariant="caption"
                              family="accent"
                              weight="semibold"
                              style={{ color: tokens.success }}
                            >
                              Default
                            </AppText>
                          </AppView>
                        ) : null}
                      </AppView>
                    </AppView>

                    {/* Delete */}
                    <AppPressableView
                      center
                      rounded={36}
                      androidRipple={false}
                      onPress={() => remove(address.id)}
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: tokens.backgroundSecondary,
                      }}
                    >
                      <Trash2 size={14} strokeWidth={2.1} color={tokens.error} />
                    </AppPressableView>
                  </AppView>

                  {/* Address text */}
                  <AppView gap={2} style={{ paddingLeft: 42 }}>
                    <AppText textVariant="bodySm">{address.name}</AppText>
                    <AppText textVariant="bodyXs" colorName="gray400">
                      {address.line1}
                    </AppText>
                    <AppText textVariant="bodyXs" colorName="gray400">
                      {address.line2}
                    </AppText>
                  </AppView>

                  {/* Set default button */}
                  {!address.isDefault ? (
                    <AppPressableView
                      androidRipple={false}
                      onPress={() => setDefault(address.id)}
                      style={{
                        alignSelf: 'flex-start',
                        marginLeft: 42,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 36,
                        borderWidth: 1,
                        borderColor: tokens.border,
                      }}
                    >
                      <AppText
                        textVariant="caption"
                        family="accent"
                        weight="semibold"
                        colorName="gray400"
                      >
                        Set as default
                      </AppText>
                    </AppPressableView>
                  ) : null}
                </AppView>
              </AppView>
            ))}

            {/* Add new */}
            <AppPressableView
              androidRipple={false}
              onPress={() => setIsAddingAddress(true)}
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: tokens.border,
                padding: 16,
                alignItems: 'center',
                flexDirection: 'row',
                gap: 10,
              }}
            >
              <AppView
                center
                rounded={10}
                style={{
                  width: 34,
                  height: 34,
                  backgroundColor: tokens.backgroundSecondary,
                }}
              >
                <Plus size={16} strokeWidth={2.2} color={tokens.icon} />
              </AppView>
              <AppText textVariant="bodySemibold" weight="semibold" colorName="gray400">
                Add new address
              </AppText>
            </AppPressableView>
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
