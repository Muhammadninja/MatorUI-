import { Moon, Smartphone, Sun } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext, type ThemePreference } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

type Option = {
  value: ThemePreference;
  labelKey: string;
  Icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>;
};

const OPTIONS: Option[] = [
  { value: 'system', labelKey: 'settings.themeSystem', Icon: Smartphone },
  { value: 'light', labelKey: 'settings.themeLight', Icon: Sun },
  { value: 'dark', labelKey: 'settings.themeDark', Icon: Moon },
];

/**
 * Appearance picker (System / Light / Dark).
 *
 * Auth-agnostic on purpose: it reads and writes nothing but the local theme
 * preference, so it renders identically for a signed-in user and a guest.
 * Never place it behind an `isAuthenticated` branch.
 */
export function ThemePreferenceCard({ showLabel = true }: { showLabel?: boolean }) {
  const { t } = useTranslation();
  const { tokens, preference, setPreference } = useThemeContext();

  return (
    <AppView
      rounded={16}
      gap={10}
      p="lg"
      // Fill, no outline — the cards it sits between dropped theirs, and an
      // outlined card among flat ones reads as a different kind of thing.
      style={{ backgroundColor: tokens.card }}
    >
      {showLabel ? (
        <AppText family="accent" weight="semibold" style={{ fontSize: 14.5, color: tokens.text }}>
          {t('settings.appearance')}
        </AppText>
      ) : null}

      <AppView
        row
        gap={4}
        rounded={12}
        p={4}
        style={{ backgroundColor: tokens.backgroundSecondary }}
      >
        {OPTIONS.map(({ value, labelKey, Icon }) => {
          const selected = preference === value;
          return (
            <AppPressableView
              key={value}
              flex={1}
              center
              rounded={9}
              py={9}
              androidRipple={false}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(labelKey)}
              testID={`theme-option-${value}`}
              onPress={() => {
                if (selected) return;
                triggerHaptic('selection');
                setPreference(value);
              }}
              style={{
                backgroundColor: selected ? tokens.card : 'transparent',
                borderWidth: 1,
                borderColor: selected ? tokens.border : 'transparent',
              }}
            >
              <AppView row align="center" gap={6}>
                <Icon
                  size={15}
                  strokeWidth={2.1}
                  color={selected ? tokens.text : tokens.textMuted}
                />
                <AppText
                  family="accent"
                  weight="semibold"
                  style={{ fontSize: 13, color: selected ? tokens.text : tokens.textMuted }}
                >
                  {t(labelKey)}
                </AppText>
              </AppView>
            </AppPressableView>
          );
        })}
      </AppView>
    </AppView>
  );
}

export default ThemePreferenceCard;
