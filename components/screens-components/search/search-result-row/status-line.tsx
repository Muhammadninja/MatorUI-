import { AppText } from '@/components/shared/app-text';
import { useThemeContext } from '@/contexts/theme.context';

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
      numberOfLines={1}
      style={{
        color: statusColor(status, tokens),
        fontSize: 12,
        fontWeight: low ? '600' : '400',
      }}
    >
      {status}
    </AppText>
  );
}
