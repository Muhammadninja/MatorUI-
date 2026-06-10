import { Check, MapPin, Trash2 } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Address } from '@/utils/shipping-addresses';

export type AddressCardProps = {
  address: Address;
  onSetDefault: () => void;
  onRemove: () => void;
};

/** A single saved shipping address row. Owns its own pressable affordances
 *  for "set as default" and "delete"; never knows the surrounding list. */
export default function AddressCard({ address, onSetDefault, onRemove }: AddressCardProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView
      rounded={16}
      style={{
        borderWidth: 1,
        borderColor: address.isDefault ? tokens.brand : tokens.border,
        backgroundColor: tokens.card,
        padding: 16,
      }}
    >
      <AppView gap="sm">
        <AppView row align="center" justify="space-between">
          <AppView row align="center" gap="sm">
            <AppView
              center
              rounded={8}
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
            <AppView gap="xs">
              <AppText textVariant="bodySemibold" weight="semibold">
                {address.label}
              </AppText>
              {address.isDefault ? (
                <AppView row align="center" gap="xs">
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

          <AppPressableView
            center
            rounded={999}
            androidRipple={false}
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={`Delete address ${address.label}`}
            style={{
              width: 32,
              height: 32,
              backgroundColor: tokens.backgroundSecondary,
            }}
          >
            <Trash2 size={14} strokeWidth={2.1} color={tokens.error} />
          </AppPressableView>
        </AppView>

        <AppView gap="xs" style={{ paddingLeft: 42 }}>
          <AppText textVariant="bodySm">{address.name}</AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {address.line1}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {address.line2}
          </AppText>
        </AppView>

        {!address.isDefault ? (
          <AppPressableView
            androidRipple={false}
            onPress={onSetDefault}
            style={{
              alignSelf: 'flex-start',
              marginLeft: 42,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
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
  );
}
