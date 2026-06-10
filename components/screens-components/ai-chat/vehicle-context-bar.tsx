import { Car, ChevronRight, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { useThemeContext } from '@/contexts/theme.context';

export type VehicleContextBarProps = {
  /** Selected car name, or null when no vehicle is in context. */
  label: string | null;
  onChange: () => void;
  onClear: () => void;
};

/**
 * Vehicle-context strip rendered above the chat timeline.
 *
 * Behavior split:
 *   - No vehicle picked → the entire bar is one big tap target into the
 *     picker.
 *   - Vehicle picked → the bar is non-pressable; trailing Change / X
 *     buttons drive the actions, so accidental taps don't reopen the
 *     picker the user just dismissed.
 */
export default function VehicleContextBar({
  label,
  onChange,
  onClear,
}: VehicleContextBarProps) {
  const { tokens } = useThemeContext();
  const hasSelection = label != null;

  return (
    <Pressable
      onPress={hasSelection ? undefined : onChange}
      accessibilityRole={hasSelection ? undefined : 'button'}
      accessibilityLabel={hasSelection ? undefined : 'Pick a vehicle'}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: hasSelection ? `${tokens.brand}10` : tokens.backgroundSecondary,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border,
        opacity: !hasSelection && pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hasSelection ? `${tokens.brand}25` : tokens.background,
          borderWidth: 1,
          borderColor: hasSelection ? `${tokens.brand}40` : tokens.border,
        }}
      >
        <Car size={14} strokeWidth={2.2} color={hasSelection ? tokens.brand : tokens.gray400} />
      </View>

      <View style={{ flex: 1, gap: 1 }}>
        <AppText
          textVariant="caption"
          weight="semibold"
          style={{ color: tokens.gray400, lineHeight: 12, includeFontPadding: false }}
        >
          {hasSelection ? 'In context' : 'No vehicle selected'}
        </AppText>
        <AppText
          textVariant="bodyXs"
          weight="semibold"
          numberOfLines={1}
          style={{ color: tokens.text, lineHeight: 16, includeFontPadding: false }}
        >
          {hasSelection ? label : 'Tap to pick a vehicle'}
        </AppText>
      </View>

      {hasSelection ? (
        <>
          <Pressable
            onPress={onChange}
            accessibilityRole="button"
            accessibilityLabel="Change vehicle"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.card,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppText
              textVariant="caption"
              weight="semibold"
              style={{ color: tokens.brand, lineHeight: 14, includeFontPadding: false }}
            >
              Change
            </AppText>
          </Pressable>
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear vehicle context"
            style={({ pressed }) => ({
              width: 24,
              height: 24,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={12} strokeWidth={2.2} color={tokens.gray400} />
          </Pressable>
        </>
      ) : (
        <ChevronRight size={16} strokeWidth={2.2} color={tokens.gray400} />
      )}
    </Pressable>
  );
}
