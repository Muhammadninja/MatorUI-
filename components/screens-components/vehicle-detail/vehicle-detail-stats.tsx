import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { VehicleLiveStatus } from '@/services/garage-service';

export type VehicleDetailStatsProps = {
  mileage: string;
  plate: string;
  color: string;
  /**
   * Live status from the realtime channel. When present, an extra
   * cell mounts inline with a LayoutTransition so the existing three
   * cells smoothly reflow alongside it. Color tint comes from
   * `stage` — the cell is always readable in both light and dark.
   */
  liveStatus?: VehicleLiveStatus | null;
};

export function VehicleDetailStats({ mileage, plate, color, liveStatus }: VehicleDetailStatsProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();

  return (
    <AppView px={20}>
      <AppView rounded={24} colorName="card" borderName="border" borderWidth={1}>
        <Animated.View
          layout={LinearTransition.springify().damping(18).stiffness(180)}
          style={{ padding: 18, gap: 14 }}
        >
          {liveStatus ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition.springify().damping(18).stiffness(180)}
            >
              <LiveStatusCell status={liveStatus} />
              <AppView
                style={{ height: 1, marginTop: 14, backgroundColor: tokens.divider }}
              />
            </Animated.View>
          ) : null}

          <AppView row gap={14}>
            <Cell label={t('vehicleDetail.mileage')} value={mileage} />
            <AppView style={{ width: 1, backgroundColor: tokens.divider }} />
            <Cell label={t('vehicleDetail.plate')} value={plate} />
            <AppView style={{ width: 1, backgroundColor: tokens.divider }} />
            <Cell label={t('vehicleDetail.color')} value={color} />
          </AppView>
        </Animated.View>
      </AppView>
    </AppView>
  );
}

type CellProps = { label: string; value: string };

function Cell({ label, value }: CellProps) {
  return (
    <AppView flex={1} gap="xs">
      <AppText
        textVariant="caption"
        family="accent"
        colorName="gray400"
        transform="uppercase"
      >
        {label}
      </AppText>
      <AppText textVariant="bodySemibold" colorName="text">
        {value}
      </AppText>
    </AppView>
  );
}

type LiveStatusCellProps = { status: VehicleLiveStatus };

function LiveStatusCell({ status }: LiveStatusCellProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const tone = resolveTone(status.stage, tokens, scheme === 'dark');

  return (
    <Animated.View
      // Re-animate the cell on every status payload change so the user
      // sees a clear "the status just refreshed" cue when the mechanic
      // updates it.
      key={`${status.stage}|${status.label}|${status.emittedAt ?? ''}`}
      entering={FadeIn.duration(180)}
    >
      <AppView
        row
        align="center"
        gap="md"
        px={14}
        py="md"
        rounded={16}
        style={{ backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border }}
      >
        <AppView
          rounded={36}
          center
          style={{ width: 36, height: 36, backgroundColor: tone.dot }}
        >
          <AppView
            rounded={36}
            style={{ width: 8, height: 8, backgroundColor: tone.dotInner }}
          />
        </AppView>
        <AppView flex={1} gap={2}>
          <AppText
            textVariant="caption"
            family="accent"
            colorName="gray400"
            transform="uppercase"
          >
            {t('vehicleDetail.liveLabel')} · {stageLabel(status.stage, t)}
            {status.mechanic ? ` · ${status.mechanic}` : ''}
          </AppText>
          <AppText
            textVariant="bodySemibold"
            style={{ color: tone.fg }}
          >
            {status.label}
          </AppText>
          {status.note ? (
            <AppText
              textVariant="bodyXs"
              colorName="gray400"
              style={{ marginTop: 2 }}
            >
              {status.note}
            </AppText>
          ) : null}
        </AppView>
      </AppView>
    </Animated.View>
  );
}

function stageLabel(stage: VehicleLiveStatus['stage'], t: (key: string) => string): string {
  switch (stage) {
    case 'queued':
      return t('vehicleDetail.stageQueued');
    case 'in_progress':
      return t('vehicleDetail.stageInProgress');
    case 'awaiting_parts':
      return t('vehicleDetail.stageAwaitingParts');
    case 'ready':
      return t('vehicleDetail.stageReady');
    case 'flagged':
      return t('vehicleDetail.stageFlagged');
  }
}

type Tone = { bg: string; border: string; fg: string; dot: string; dotInner: string };

function resolveTone(
  stage: VehicleLiveStatus['stage'],
  tokens: ReturnType<typeof useThemeContext>['tokens'],
  isDark: boolean,
): Tone {
  // Map stages to existing semantic tokens so dark mode follows
  // automatically. Tint intensity is dialed back vs raw semantic
  // colors — the cell sits inside an already-tinted card.
  switch (stage) {
    case 'queued':
      return {
        bg: isDark ? tokens.backgroundSecondary : tokens.gray100,
        border: tokens.border,
        fg: tokens.text,
        dot: tokens.gray200,
        dotInner: tokens.gray400,
      };
    case 'in_progress':
      return {
        bg: tokens.info,
        border: tokens.info,
        fg: isDark ? tokens.onBackground : tokens.white,
        dot: isDark ? tokens.onBackground : tokens.white,
        dotInner: tokens.info,
      };
    case 'awaiting_parts':
      return {
        bg: tokens.warning,
        border: tokens.warning,
        fg: isDark ? tokens.onBackground : tokens.black,
        dot: isDark ? tokens.onBackground : tokens.black,
        dotInner: tokens.warning,
      };
    case 'ready':
      return {
        bg: tokens.success,
        border: tokens.success,
        fg: isDark ? tokens.onBackground : tokens.white,
        dot: isDark ? tokens.onBackground : tokens.white,
        dotInner: tokens.success,
      };
    case 'flagged':
      return {
        bg: tokens.error,
        border: tokens.error,
        fg: isDark ? tokens.onBackground : tokens.white,
        dot: isDark ? tokens.onBackground : tokens.white,
        dotInner: tokens.error,
      };
  }
}

export default VehicleDetailStats;
