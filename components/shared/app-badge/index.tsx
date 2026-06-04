import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type AppBadgeProps = {
  label: string;
  variant?: 'solid' | 'outline' | 'ghost';
  kind?: 'primary' | 'secondary' | 'neutral';
};

export function AppBadge({ label, variant = 'solid', kind = 'primary' }: AppBadgeProps) {
  const backgroundColor =
    kind === 'primary' ? '#2563eb' : kind === 'secondary' ? '#475569' : '#94a3b8';
  const borderColor = kind === 'primary' ? '#2563eb' : kind === 'secondary' ? '#475569' : '#94a3b8';

  return (
    <AppView
      px={8}
      py={4}
      rounded={36}
      borderWidth={variant === 'outline' ? 1 : 0}
      borderColor={variant === 'outline' ? borderColor : undefined}
      style={{ backgroundColor: variant === 'solid' ? backgroundColor : 'transparent' }}
    >
      <AppText
        textVariant="bodyXs"
        weight="semibold"
        style={{ color: variant === 'solid' ? '#ffffff' : borderColor }}
      >
        {label}
      </AppText>
    </AppView>
  );
}

export default AppBadge;
