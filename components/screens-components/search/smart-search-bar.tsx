import { Bell, Mic, SlidersHorizontal, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { StyleSheet } from 'react-native';

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
  /**
   * Fires on every input change (debounce-free echo of the live text).
   * Parent typically funnels this into useSearch.setQuery, which itself
   * debounces and dispatches the actual search request.
   */
  onPress?: (query: string) => void;
  onVoicePress?: () => void;
  onImageSearchPress?: () => void;
  onNotificationPress?: () => void;
  /** When true, the right-side trailing button shows a filter icon and
   *  routes to onFilterPress instead of the notification bell. */
  isSearching?: boolean;
  onFilterPress?: () => void;
  /** Optional dot indicator on the filter icon when any filter is active. */
  hasActiveFilters?: boolean;
  /** Emitted when the inner TextInput focuses / blurs. Lets the parent
   *  decide when to render the suggestions panel. */
  onFocusChange?: (focused: boolean) => void;
};

export function SmartSearchBar({
  placeholder = 'Smart search...',
  onPress,
  onVoicePress,
  onImageSearchPress,
  onNotificationPress,
  isSearching = false,
  onFilterPress,
  hasActiveFilters = false,
  onFocusChange,
}: SmartSearchBarProps) {
  const { tokens } = useThemeContext();

  // CRITICAL: searchField and searchRegistry MUST be memoized. AppForm's
  // renderField does `const Renderer = registry[fieldType]; <Renderer .../>`.
  // If the registry value is a new function reference on every render, React
  // sees a new component type and unmounts + remounts the underlying
  // TextInput on every keystroke — which kills focus after the first
  // character and makes the bar feel "stuck/un-focusable" to users.
  //
  // For the same reason, callbacks that may change identity on every parent
  // render (onFocusChange, onVoicePress) are bridged through refs so the
  // registry's deps stay stable and the registry can be created once.
  const onFocusChangeRef = useRef(onFocusChange);
  const onVoicePressRef = useRef(onVoicePress);
  useEffect(() => {
    onFocusChangeRef.current = onFocusChange;
  }, [onFocusChange]);
  useEffect(() => {
    onVoicePressRef.current = onVoicePress;
  }, [onVoicePress]);

  const searchField = useMemo<TextField<SearchValues>>(
    () => ({
      name: 'query',
      type: 'text',
      placeholder,
      props: {
        autoCapitalize: 'none',
        autoCorrect: false,
      },
    }),
    [placeholder],
  );

  const searchRegistry = useMemo<Partial<FieldRegistry>>(
    () => ({
      text: ({ field, control, disabled }) => (
        <Controller
          control={control}
          name={field.name as any}
          rules={field.rules as any}
          render={({ field: rhf, fieldState }) => (
            <AppTextField
              placeholder={field.placeholder}
              errorText={fieldState.error?.message}
              value={(rhf.value as string) ?? ''}
              onChangeText={rhf.onChange}
              onBlur={() => {
                rhf.onBlur();
                onFocusChangeRef.current?.(false);
              }}
              onFocus={() => onFocusChangeRef.current?.(true)}
              disabled={disabled}
              leftAdornment={
                <AppView rounded={36} center style={styles.adornmentIcon}>
                  <Sparkles size={18} strokeWidth={2.4} color={tokens.text} />
                </AppView>
              }
              rightAdornment={
                <AppView row align="center" gap={4}>
                  {(rhf.value as string)?.length > 0 ? (
                    <AppPressableView
                      center
                      rounded={36}
                      onPress={() => {
                        rhf.onChange('');
                      }}
                      androidRipple
                      accessibilityLabel="Clear search"
                      style={[
                        styles.adornmentIcon,
                        { backgroundColor: tokens.gray200 },
                      ]}
                    >
                      <X size={14} strokeWidth={2.4} color={tokens.text} />
                    </AppPressableView>
                  ) : null}
                  <AppPressableView
                    center
                    rounded={36}
                    onPress={() => onVoicePressRef.current?.()}
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
          )}
        />
      ),
    }),
    // Intentionally NOT depending on onVoicePress / onFocusChange — those
    // are read through refs above. Putting them in deps reintroduces the
    // remount-on-every-keystroke bug. Only `tokens` legitimately needs to
    // invalidate the registry (theme change → icon recolor).
    [tokens],
  );

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

      {isSearching ? (
        <AppPressableView
          row
          center
          rounded={36}
          onPress={onFilterPress}
          androidRipple
          accessibilityLabel="Filters"
          style={styles.notificationButton}
        >
          <SlidersHorizontal size={18} strokeWidth={2.4} color={tokens.gray400} />
          {hasActiveFilters ? (
            <AppView
              rounded={36}
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 8,
                height: 8,
                backgroundColor: tokens.text,
              }}
            />
          ) : null}
        </AppPressableView>
      ) : (
        <AppPressableView
          row
          center
          rounded={36}
          colorName="brand"
          onPress={onNotificationPress}
          androidRipple
          accessibilityLabel="Notifications"
          style={styles.notificationButton}
        >
          <Bell size={18} strokeWidth={2.4} color={tokens.onBrand} />
        </AppPressableView>
      )}
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
