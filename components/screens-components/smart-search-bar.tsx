import { Bell, Camera, Mic, Sparkles } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Controller } from 'react-hook-form';

import { AppForm, type FieldRegistry } from '@/components/shared/app-form';
import type { TextField } from '@/components/shared/app-form/types';
import { AppTextField } from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type SearchValues = {
  query: string;
};

export type SmartSearchBarProps = {
  placeholder?: string;
  onPress?: (query: string) => void;
  onVoicePress?: () => void;
  onImageSearchPress?: () => void;
  onNotificationPress?: () => void;
};

export function SmartSearchBar({
  placeholder = 'Smart search...',
  onPress,
  onVoicePress,
  onImageSearchPress,
  onNotificationPress,
}: SmartSearchBarProps) {
  const { tokens } = useThemeContext();

  const searchField: TextField<SearchValues> = {
    name: 'query',
    type: 'text',
    placeholder,
    props: {
      autoCapitalize: 'none',
      autoCorrect: false,
    },
  };

  const searchRegistry: Partial<FieldRegistry> = {
    text: ({ field, control, disabled }) => {
      const TextRenderer = ({ field: rhf, fieldState }: any) => (
        <AppTextField
          placeholder={field.placeholder}
          errorText={fieldState.error?.message}
          value={(rhf.value as string) ?? ''}
          onChangeText={rhf.onChange}
          onBlur={rhf.onBlur}
          disabled={disabled}
          leftAdornment={
            <AppView rounded={36} center style={styles.adornmentIcon}>
              <Sparkles size={18} strokeWidth={2.4} color={tokens.text} />
            </AppView>
          }
          rightAdornment={
            <AppView row align="center" gap={8}>
              <AppPressableView
                center
                rounded={36}
                onPress={onImageSearchPress}
                androidRipple
                accessibilityLabel="Search with photo"
                style={styles.adornmentIcon}
              >
                <Camera size={18} strokeWidth={2.4} color={tokens.text} />
              </AppPressableView>
              <AppPressableView
                center
                rounded={36}
                onPress={onVoicePress}
                androidRipple
                accessibilityLabel="Voice search"
                style={styles.adornmentIcon}
              >
                <Mic size={18} strokeWidth={2.4} color={tokens.text} />
              </AppPressableView>
            </AppView>
          }
          containerRounded={36}
          containerPx={12}
          containerPy={8}
          containerColorName="card"
          containerBorderName="border"
          style={styles.searchInput}
        />
      );

      return (
        <Controller
          control={control}
          name={field.name as any}
          rules={field.rules as any}
          render={TextRenderer}
        />
      );
    },
  };

  return (
    <AppView row align="center" gap={12} px={12}>
      <AppView flex={1}>
        <AppForm<SearchValues>
          config={{ fields: [searchField] }}
          defaultValues={{ query: '' }}
          onSubmit={({ query }) => onPress?.(query)}
          onChange={({ query }) => onPress?.(query)}
          mode="onChange"
          fieldGap={0}
          footer={<></>}
          registry={searchRegistry}
        />
      </AppView>

      <AppPressableView
        row
        center
        rounded={36}
        colorName="secondary"
        onPress={onNotificationPress}
        androidRipple
        accessibilityLabel="Notifications"
        style={styles.notificationButton}
      >
        <Bell size={18} strokeWidth={2.4} color={tokens.onSecondary} />
      </AppPressableView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  adornmentIcon: {
    width: 32,
    height: 32,
  },
  notificationButton: {
    width: 36,
    height: 36,
  },
  searchInput: {
    fontSize: 14,
  },
});

export default SmartSearchBar;
