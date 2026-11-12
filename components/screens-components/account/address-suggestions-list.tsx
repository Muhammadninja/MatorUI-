import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import type { UseAddressSuggestionsValue } from '@/hooks/use-address-suggestions';
import type { AddressSuggestion } from '@/services/orders-service';

/** What the backend found for the typed address, as a plain list to choose from. */
export function AddressSuggestionsList({
  suggestions,
  onPick,
}: {
  suggestions: UseAddressSuggestionsValue;
  onPick: (suggestion: AddressSuggestion) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { state, items, attribution } = suggestions;
  if (state === 'idle') return null;

  const note = { fontSize: 12.5, color: tokens.textMuted };
  return (
    <AppView gap={6} testID="address-suggestions">
      {state === 'loading' ? (
        <AppView row align="center" gap={8}>
          <WheelLoader size={16} color={tokens.text} />
          <AppText family="default" style={note}>
            {t('account.addressSearching')}
          </AppText>
        </AppView>
      ) : state === 'error' ? (
        <AppText family="default" style={{ fontSize: 12.5, color: tokens.error }}>
          {t('account.addressSearchFailed')}
        </AppText>
      ) : state === 'empty' ? (
        <AppText family="default" style={note}>
          {t('account.addressNoMatches')}
        </AppText>
      ) : (
        <>
          {items.map((item, index) => (
            <AppPressableView
              key={item.id}
              testID={`address-suggestion-${index}`}
              onPress={() => onPick(item)}
              accessibilityRole="button"
              accessibilityLabel={[item.title, item.subtitle].filter(Boolean).join(', ')}
              rounded={12}
              p={12}
              colorName="backgroundSecondary"
              borderWidth={1}
              borderName="border"
            >
              <AppView row align="center" gap={10}>
                <MapPin size={16} strokeWidth={2} color={tokens.text} />
                <AppView flex={1}>
                  <AppText family="default" weight="semibold" style={{ fontSize: 14, color: tokens.text }}>
                    {item.title}
                  </AppText>
                  {item.subtitle ? (
                    <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 1 }}>
                      {item.subtitle}
                    </AppText>
                  ) : null}
                </AppView>
              </AppView>
            </AppPressableView>
          ))}
          {attribution ? (
            <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted }}>
              {attribution}
            </AppText>
          ) : null}
        </>
      )}
    </AppView>
  );
}
