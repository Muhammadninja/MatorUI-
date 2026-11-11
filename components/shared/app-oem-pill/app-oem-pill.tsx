import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type AppOemPillProps = {
  /** The OEM part number, e.g. "90915-YZZE1". Renders an "OEM"-labeled chip. */
  oem?: string;
  /** The GM cross-reference number, when the part carries one. Renders a
   *  separate "GM"-labeled chip. The seller upload flow picks OEM *or* GM per
   *  part, so usually only one is set — the component renders whichever are
   *  present, each with its correct label (an OEM number never reads "GM"). */
  gm?: string;
};

/** One labeled part-number chip in the mono font, per the Mator handoff:
 *  `backgroundSecondary` fill, 1px border, 6-radius, a bold label + muted number. */
function Chip({ label, value }: { label: string; value: string }) {
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
    >
      <AppText family="mono" style={{ fontSize: 11, letterSpacing: 0.3 }} weight="bold" colorName="text">
        {label}
      </AppText>
      <AppText family="mono" style={{ fontSize: 11 }} colorName="textMuted">
        {value}
      </AppText>
    </AppView>
  );
}

/**
 * `AppOemPill` — inline part-number chips shown across Item Detail, product
 * cards, and cart lines. Renders an "OEM" chip and/or a "GM" chip depending on
 * which number the part carries, so an OEM part reads "OEM …" and a GM part
 * reads "GM …" (never mislabeled). Renders nothing when neither is present.
 */
export default function AppOemPill({ oem, gm }: AppOemPillProps) {
  if (!oem && !gm) return null;
  return (
    <AppView row wrap gap={6} style={{ alignSelf: 'flex-start' }}>
      {oem ? <Chip label="OEM" value={oem} /> : null}
      {gm ? <Chip label="GM" value={gm} /> : null}
    </AppView>
  );
}
