import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageEmptyStateProps = {
  /** Route 2: the VIN decoder screen. */
  onAddByVin: () => void;
  /** Route 1, the default: the make/model/year sheet. */
  onAddByDetails: () => void;
  /** A create is in flight — freeze both routes. */
  busy?: boolean;
};

function Route({
  index,
  title,
  body,
  onPress,
  disabled,
  emphasis,
}: {
  index: string;
  title: string;
  /** Optional. A route whose title already says everything gets no second
   *  line, rather than a filler one written to match its neighbour. */
  body?: string;
  onPress: () => void;
  disabled?: boolean;
  /** The default route gets the filled treatment; the other is an outline. */
  emphasis?: boolean;
}) {
  const { tokens } = useThemeContext();
  const ink = emphasis ? tokens.onBrand : tokens.text;
  const sub = emphasis ? tokens.onBrand : tokens.textMuted;

  return (
    <AppPressableView
      onPress={onPress}
      disabled={disabled}
      androidRipple
      accessibilityRole="button"
      accessibilityLabel={title}
      {...(body ? { accessibilityHint: body } : null)}
      row
      align="center"
      gap={14}
      rounded={16}
      px={16}
      py={16}
      colorName={emphasis ? 'brand' : undefined}
      borderWidth={emphasis ? 0 : 1}
      borderName="border"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {/* The two routes are numbered rather than iconed. There is no honest
       *  icon for "a VIN" or "a make and model", and two invented glyphs would
       *  say less than "1" and "2" about them being a choice of two. */}
      <AppText
        family="mono"
        weight="bold"
        style={{ fontSize: 13, color: sub, opacity: emphasis ? 0.7 : 1 }}
      >
        {index}
      </AppText>

      <AppView flex={1} gap={3} style={{ minWidth: 0 }}>
        <AppText family="heading" weight="bold" style={{ fontSize: 16, color: ink }}>
          {title}
        </AppText>
        {body ? (
          <AppText
            family="default"
            style={{ fontSize: 12.5, lineHeight: 17, color: sub, opacity: emphasis ? 0.8 : 1 }}
          >
            {body}
          </AppText>
        ) : null}
      </AppView>

      <ChevronRight size={19} strokeWidth={2.2} color={ink} opacity={emphasis ? 0.85 : 0.5} />
    </AppPressableView>
  );
}

/**
 * Garage empty state: a statement, then the two ways in.
 *
 * Two routes exist because they answer different situations. Make/model/year
 * leads: three taps from the sofa, and enough for most fitment. A VIN is the
 * precise one (it resolves trim and engine, which is what makes fitment exact)
 * but it means finding the plate under the windscreen and typing 17
 * characters. Neither is a fallback for the other, so they are presented as a
 * genuine choice rather than one CTA plus a link.
 *
 * Left-aligned throughout, no centered hero, no benefit list. Grouping is done
 * with space; the only bordered objects are the two routes, where the border
 * marks a tap target rather than decorating a panel.
 */
export function GarageEmptyState({ onAddByVin, onAddByDetails, busy }: GarageEmptyStateProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView gap={24}>
      <AppView gap={9} style={{ paddingTop: 12 }}>
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 30, lineHeight: 34, color: tokens.text, maxWidth: 280 }}
        >
          {t('garage.emptyHeadline')}
        </AppText>
        <AppText
          family="default"
          style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted, maxWidth: 300 }}
        >
          {t('garage.emptyLead')}
        </AppText>
      </AppView>

      {/* Model-and-year leads, and takes the filled treatment: it is three
       *  taps in the platform's own pickers, against walking to the car and
       *  typing 17 characters. VIN keeps its sub-line, which is the honest
       *  reason to choose the slower route. */}
      <AppView gap={10}>
        <Route
          index="1"
          emphasis
          title={t('garage.emptyOptionDetails')}
          onPress={onAddByDetails}
          disabled={busy}
        />
        <Route
          index="2"
          title={t('garage.emptyOptionVin')}
          body={t('garage.emptyOptionVinSub')}
          onPress={onAddByVin}
          disabled={busy}
        />
      </AppView>
    </AppView>
  );
}

export default GarageEmptyState;
