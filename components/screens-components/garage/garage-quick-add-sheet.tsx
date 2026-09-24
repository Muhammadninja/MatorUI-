import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { PickedModel } from './garage-model-picker-sheet';
import { triggerHaptic } from '@/utils/haptics';

/** Years offered, newest first. A multiple of COLUMNS so the last row is full
 *  and the grid never ends on a stretched orphan. 24 reaches the early 2000s,
 *  which covers the Nexia and Damas still on the road here. */
const YEARS_BACK = 24;
const COLUMNS = 4;

export type GarageQuickAddSheetProps = {
  /** The make/model already chosen; `null` keeps the sheet closed. */
  model: PickedModel | null;
  onClose: () => void;
  /** Step back to the model picker. */
  onBack: () => void;
  onPickYear: (year: number) => void;
  /** A create is in flight — freeze the grid so a double-tap can't add twice. */
  busy?: boolean;
};

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * Year step of the "model and year" route.
 *
 * The backend needs `make_id` + `model_id` + `year` and nothing else
 * (`create-vehicle.dto.ts`), and the model is already chosen, so year is the
 * last thing between a tap and a saved car.
 *
 * Laid out as a fixed 4-column grid built from chunked rows rather than a
 * wrapping pill row. Wrapping gave 22 same-size chips a ragged right edge and
 * no scannable structure; a real grid lets the eye jump down a column, which
 * is how people look for a year. Figures are set in the mono face so the
 * digits align vertically between rows.
 */
export function GarageQuickAddSheet({
  model,
  onClose,
  onBack,
  onPickYear,
  busy,
}: GarageQuickAddSheetProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const rows = useMemo(() => {
    // Read per render, not at module load, so a session running across New
    // Year still offers the new year.
    const current = new Date().getFullYear();
    return chunk(
      Array.from({ length: YEARS_BACK }, (_, i) => current - i),
      COLUMNS,
    );
  }, []);

  return (
    <AppBottomSheet
      visible={model !== null}
      onClose={onClose}
      heightFraction={0.66}
      dismissOnOverlayPress={!busy}
      swipeToClose={!busy}
    >
      {/* Header: back arrow, the model already chosen, then the question. The
       *  chosen model stays on screen so the two steps read as one flow. */}
      <AppView px={20} pt={2} pb={16} gap={12}>
        <AppView row align="center" gap={10}>
          <AppPressableView
            onPress={() => {
              triggerHaptic('selection');
              onBack();
            }}
            disabled={busy}
            androidRipple={false}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            center
            rounded={999}
            style={{
              width: 30,
              height: 30,
              backgroundColor: isDark ? tokens.card : tokens.backgroundSecondary,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <ArrowLeft size={16} strokeWidth={2.4} color={tokens.text} />
          </AppPressableView>
          <AppText
            family="default"
            weight="semibold"
            style={{ fontSize: 13.5, color: tokens.textMuted }}
          >
            {model ? `${model.makeName} ${model.modelName}`.trim() : ''}
          </AppText>
        </AppView>

        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 24, lineHeight: 28, color: tokens.text }}
        >
          {t('garage.quickAddYearTitle')}
        </AppText>
      </AppView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }}
      >
        <AppView gap={10}>
          {rows.map((row) => (
            <AppView key={row[0]} row gap={10}>
              {row.map((year) => (
                <AppPressableView
                  key={year}
                  onPress={() => {
                    triggerHaptic('selection');
                    onPickYear(year);
                  }}
                  disabled={busy}
                  androidRipple
                  accessibilityRole="button"
                  accessibilityLabel={t('garage.quickAddYearOption', {
                    year,
                    model: model?.modelName ?? '',
                  })}
                  flex={1}
                  center
                  rounded={14}
                  style={{
                    paddingVertical: 15,
                    backgroundColor: isDark ? tokens.card : tokens.backgroundSecondary,
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <AppText
                    family="mono"
                    weight="semibold"
                    style={{ fontSize: 15, color: tokens.text }}
                  >
                    {year}
                  </AppText>
                </AppPressableView>
              ))}
            </AppView>
          ))}
        </AppView>
      </ScrollView>
    </AppBottomSheet>
  );
}

export default GarageQuickAddSheet;
