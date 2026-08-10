import { ArrowLeft, Bell, Mic, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
  /** When true, the right-side notification bell is hidden — the user
   *  is in a search/results context and notifications would compete
   *  with the search affordances. */
  isSearching?: boolean;
  /** Emitted when the inner TextInput focuses / blurs. Lets the parent
   *  decide when to render the suggestions panel. */
  onFocusChange?: (focused: boolean) => void;
  /** True when the user has typed something OR results are showing.
   *  Drives the left-side back button visibility and swaps the mic for
   *  an X-clear in the right adornment. */
  isSearchActive?: boolean;
  /** Called when the back button is pressed. Parent should clear the
   *  query, dismiss the keyboard, and bump `formResetKey` to force the
   *  internal form to remount with an empty value. */
  onBackPress?: () => void;
  /** When this value changes, the internal AppForm is remounted with
   *  its default empty value — the only clean way to clear the form
   *  from outside without making it fully controlled. */
  formResetKey?: number | string;
};

export function SmartSearchBar({
  placeholder,
  onPress,
  onVoicePress,
  onImageSearchPress,
  onNotificationPress,
  isSearching = false,
  onFocusChange,
  isSearchActive = false,
  onBackPress,
  formResetKey,
}: SmartSearchBarProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const resolvedPlaceholder = placeholder ?? t('search.smartSearchPlaceholder');

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
  // Presence of a voice handler decides whether the mic affordance is
  // shown at all. It's a boolean (not a callback), so it's safe to use as
  // a registry dependency — it only changes when the parent wires/unwires
  // voice search, never on a keystroke, so it won't trigger the
  // remount-on-type bug the callbacks-via-refs pattern guards against.
  const hasVoiceHandler = typeof onVoicePress === 'function';
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
      placeholder: resolvedPlaceholder,
      props: {
        autoCapitalize: 'none',
        autoCorrect: false,
      },
    }),
    [resolvedPlaceholder],
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
                  <Sparkles size={18} strokeWidth={2} color={tokens.text} />
                </AppView>
              }
              rightAdornment={
                // While the user has typed something, the right slot is
                // the clear-X. When empty, the slot shows the mic ONLY if
                // a voice handler was actually wired by the parent — an
                // unwired mic is a dead affordance, so we hide it rather
                // than render a button that does nothing.
                (rhf.value as string)?.length > 0 ? (
                  <AppPressableView
                    center
                    rounded={36}
                    onPress={() => {
                      rhf.onChange('');
                    }}
                    androidRipple
                    accessibilityLabel={t('search.clearSearch')}
                    style={[
                      styles.adornmentIcon,
                      { backgroundColor: tokens.gray200 },
                    ]}
                  >
                    <X size={14} strokeWidth={2} color={tokens.text} />
                  </AppPressableView>
                ) : hasVoiceHandler ? (
                  <AppPressableView
                    center
                    rounded={36}
                    onPress={() => onVoicePressRef.current?.()}
                    androidRipple
                    accessibilityLabel={t('search.voiceSearch')}
                    style={styles.adornmentIcon}
                  >
                    <Mic size={18} strokeWidth={2} color={tokens.text} />
                  </AppPressableView>
                ) : undefined
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
    // remount-on-every-keystroke bug. `tokens` invalidates on theme change
    // (icon recolor); `hasVoiceHandler` is a stable boolean that only
    // flips when the parent wires/unwires voice search.
    [tokens, hasVoiceHandler],
  );

  return (
    <AppView row align="center" gap="md" px="md">
      {isSearchActive ? (
        <AppPressableView
          center
          rounded={36}
          onPress={onBackPress}
          androidRipple
          accessibilityLabel={t('search.backToHome')}
          style={styles.notificationButton}
        >
          <ArrowLeft size={20} strokeWidth={2} color={tokens.text} />
        </AppPressableView>
      ) : null}
      <AppView flex={1}>
        {/* key={formResetKey} forces the form to remount with empty
         *  defaultValues when the parent bumps the key — the only way
         *  to clear the field from outside without making AppForm fully
         *  controlled. */}
        <AppForm<SearchValues>
          key={formResetKey}
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

      {/* Right-side affordance: bell on the landing surface, nothing
       *  during search/results. Filters moved to the results header so
       *  the search field stays roomy on small screens. */}
      {!isSearching ? (
        <AppPressableView
          row
          center
          rounded={36}
          colorName="brand"
          onPress={onNotificationPress}
          androidRipple
          accessibilityLabel={t('search.notifications')}
          style={styles.notificationButton}
        >
          <Bell size={18} strokeWidth={2} color={tokens.onBrand} />
        </AppPressableView>
      ) : null}
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
