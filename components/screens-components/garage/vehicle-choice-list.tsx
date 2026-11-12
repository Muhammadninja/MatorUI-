import { Check, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, TextInput } from 'react-native';

import AppImage from '@/components/shared/app-image';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { filterChoices, type VehicleChoice } from '@/services/vehicle-choice-search';
import { APP_FONTS } from '@/themes';

export type { VehicleChoice } from '@/services/vehicle-choice-search';

/** Fixed, so a list of thousands scrolls without measuring each row. */
export const CHOICE_ROW_HEIGHT = 56;
const LOGO_SIZE = 32;

/**
 * One step's answers as a list: an optional search field over it, a logo or
 * initial per row, and the chosen row marked. Rows are 56pt, so every one is a
 * comfortable target, and the list virtualises, so a catalog of thousands stays
 * smooth. The keyboard closes on drag and never swallows a row's tap.
 */
export function VehicleChoiceList({
  testID,
  choices,
  selected,
  onSelect,
  searchable,
  searchPlaceholder,
  emptyLabel,
  disabled,
  showLogos = false,
}: {
  testID: string;
  choices: VehicleChoice[];
  selected: string | null;
  onSelect: (value: string) => void;
  searchable: boolean;
  searchPlaceholder?: string;
  /** Said when the search matches nothing. */
  emptyLabel: string;
  disabled?: boolean;
  /** Brands carry logos; models and years don't. */
  showLogos?: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterChoices(choices, query), [choices, query]);

  return (
    <AppView flex={1} gap={10} style={{ minHeight: 0 }}>
      {searchable ? (
        <AppView
          row
          align="center"
          gap={8}
          rounded={12}
          colorName="backgroundSecondary"
          style={{ height: 44, paddingHorizontal: 12 }}
        >
          <Search size={18} strokeWidth={2} color={tokens.textMuted} />
          <TextInput
            testID={`${testID}-search`}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={tokens.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            accessibilityLabel={searchPlaceholder}
            editable={!disabled}
            style={{ flex: 1, height: 44, fontSize: 16, fontFamily: APP_FONTS.default, color: tokens.text }}
          />
          {query ? (
            <AppPressableView
              testID={`${testID}-search-clear`}
              onPress={() => setQuery('')}
              androidRipple={false}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
            >
              <X size={16} strokeWidth={2.2} color={tokens.textMuted} />
            </AppPressableView>
          ) : null}
        </AppView>
      ) : null}

      <FlatList
        testID={testID}
        data={shown}
        keyExtractor={(item) => item.value}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={14}
        windowSize={7}
        getItemLayout={(_, index) => ({ length: CHOICE_ROW_HEIGHT, offset: CHOICE_ROW_HEIGHT * index, index })}
        style={{ flex: 1 }}
        ListEmptyComponent={
          <AppText
            testID={`${testID}-empty`}
            family="default"
            style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', paddingVertical: 24 }}
          >
            {emptyLabel}
          </AppText>
        }
        renderItem={({ item }) => {
          const isSelected = item.value === selected;
          return (
            <AppPressableView
              testID={`${testID}-option-${item.value}`}
              onPress={() => onSelect(item.value)}
              disabled={disabled}
              androidRipple={false}
              pressedOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={item.label}
              row
              align="center"
              gap={12}
              style={{
                height: CHOICE_ROW_HEIGHT,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: isSelected ? tokens.brandSoft : 'transparent',
              }}
            >
              {showLogos ? (
                <AppView center rounded={8} style={{ width: LOGO_SIZE, height: LOGO_SIZE, overflow: 'hidden', backgroundColor: tokens.white }}>
                  {item.logoUrl ? (
                    <AppImage
                      source={item.logoUrl}
                      width={LOGO_SIZE - 4}
                      height={LOGO_SIZE - 4}
                      targetWidth={LOGO_SIZE}
                      contentFit="contain"
                      placeholderColor="transparent"
                      alt={item.label}
                    />
                  ) : (
                    <AppText family="heading" weight="bold" style={{ fontSize: 14, color: tokens.textMuted }}>
                      {item.label.slice(0, 1).toUpperCase()}
                    </AppText>
                  )}
                </AppView>
              ) : null}
              <AppText
                family="default"
                weight={isSelected ? 'semibold' : 'medium'}
                style={{ flex: 1, fontSize: 16, color: tokens.text }}
              >
                {item.label}
              </AppText>
              {isSelected ? <Check size={18} strokeWidth={2.6} color={tokens.brandText} /> : null}
            </AppPressableView>
          );
        }}
      />
    </AppView>
  );
}
