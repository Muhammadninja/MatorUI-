import { AppText } from '@/components/shared/app-text';
import { useThemeContext } from '@/contexts/theme.context';

import { SEARCH_FONT } from './fonts';
import { isLowStock, statusColor } from './helpers';

/**
 * "Ready to ship" is the default-good state for every catalog item — it
 * shows up on most cards and adds visual noise without saying anything
 * actionable. We hide it and only surface statuses worth flagging:
 * low stock (red urgency), pre-order (secondary tint), etc.
 */
const HIDDEN_STATUSES = /^ready to ship$/i;

export default function StatusLine({ status }: { status: string }) {
  const { tokens } = useThemeContext();
  if (HIDDEN_STATUSES.test(status.trim())) return null;
  const low = isLowStock(status);
  return (
    <AppText
      textVariant="bodyXs"
      style={{
        color: statusColor(status, tokens),
        // Weight is a FACE here, not a `fontWeight`: a custom family resolves
        // one file per name on Android, where fontWeight would be ignored.
        fontFamily: low ? SEARCH_FONT.semibold : SEARCH_FONT.regular,
        fontSize: 13,
      }}
    >
      {status}
    </AppText>
  );
}
