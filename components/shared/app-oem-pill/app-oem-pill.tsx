import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type AppOemPillProps = {
  /** The OEM part number, e.g. "90915-YZZE1". */
  oem: string;
};

/**
 * `OemPill` — inline chip showing an OEM part number in the mono font, per
 * the Mator handoff: `backgroundSecondary` fill, 1px border, 6-radius, a bold
 * "OEM" label followed by the muted number. Shared across Item Detail,
 * product cards, and cart lines.
 */
export default function AppOemPill({ oem }: AppOemPillProps) {
  return (
    <AppView
      row
      align="center"
      gap={5}
      rounded={6}
      px={7}
      py={3}
      colorName="backgroundSecondary"
      borderWidth={1}
      borderName="border"
      style={{ alignSelf: 'flex-start' }}
    >
      <AppText
        family="mono"
        style={{ fontSize: 10.5, letterSpacing: 0.3 }}
        weight="bold"
        colorName="text"
      >
        OEM
      </AppText>
      <AppText family="mono" style={{ fontSize: 10.5 }} colorName="textMuted">
        {oem}
      </AppText>
    </AppView>
  );
}
