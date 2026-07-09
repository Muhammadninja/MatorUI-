import { MapPin } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Address } from '@/utils/shipping-addresses';

export type AddressCardProps = {
  address: Address;
  onSetDefault: () => void;
  onRemove: () => void;
};

/** A single saved shipping address card. Brand border + "DEFAULT" pill for
 *  the default address. "Edit" (ghost) and "Remove" (error-colored) actions. */
export default function AddressCard({ address, onSetDefault, onRemove }: AddressCardProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView
      rounded={16}
      style={{
        borderWidth: address.isDefault ? 1.5 : 1,
        borderColor: address.isDefault ? tokens.brand : tokens.border,
        backgroundColor: tokens.card,
        padding: 16,
      }}
    >
      {/* Header row: icon + label + DEFAULT pill */}
      <AppView row align="center" gap="sm" style={{ marginBottom: 10 }}>
        <AppView
          center
          rounded={11}
          style={{
            width: 34,
            height: 34,
            backgroundColor: address.isDefault ? tokens.brand : tokens.backgroundSecondary,
          }}
        >
          <MapPin
            size={16}
            strokeWidth={2.1}
            color={address.isDefault ? tokens.onBrand : tokens.icon}
          />
        </AppView>

        <AppText textVariant="bodySemibold" weight="semibold" style={{ flex: 1 }}>
          {address.label}
        </AppText>

        {address.isDefault ? (
          <AppView
            style={{
              borderRadius: 999,
              backgroundColor: tokens.brand,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <AppText
              textVariant="caption"
              family="accent"
              weight="semibold"
              style={{ color: tokens.onBrand, letterSpacing: 0.4 }}
            >
              DEFAULT
            </AppText>
          </AppView>
        ) : null}
      </AppView>

      {/* Address lines */}
      <AppView gap="xs" style={{ paddingLeft: 42, marginBottom: 14 }}>
        <AppText textVariant="bodySm">{address.name}</AppText>
        <AppText textVariant="bodyXs" colorName="textMuted">
          {address.line1}
        </AppText>
        <AppText textVariant="bodyXs" colorName="textMuted">
          {address.line2}
        </AppText>
      </AppView>

      {/* Actions row */}
      <AppView row align="center" gap="md" style={{ paddingLeft: 42 }}>
        {/* Edit — ghost style (border + muted text). Wired to setDefault as
            a stand-in; full edit flow is a follow-up. */}
        <AppPressableView
          androidRipple={false}
          onPress={onSetDefault}
          accessibilityRole="button"
          accessibilityLabel={`Edit address ${address.label}`}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: tokens.border,
            paddingHorizontal: 14,
            paddingVertical: 5,
          }}
        >
          <AppText
            textVariant="caption"
            family="accent"
            weight="semibold"
            colorName="textMuted"
          >
            Edit
          </AppText>
        </AppPressableView>

        {/* Remove — error-colored text */}
        <AppPressableView
          androidRipple={false}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove address ${address.label}`}
          style={{ paddingHorizontal: 4, paddingVertical: 5 }}
        >
          <AppText
            textVariant="caption"
            family="accent"
            weight="semibold"
            style={{ color: tokens.error }}
          >
            Remove
          </AppText>
        </AppPressableView>
      </AppView>
    </AppView>
  );
}
