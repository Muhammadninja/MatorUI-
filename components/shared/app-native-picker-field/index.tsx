import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, UIManager, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type NativePickerOption = {
  label: string;
  value: string;
};

export type AppNativePickerFieldProps = {
  /** Small label above the control, e.g. "Make". */
  label: string;
  /** Shown in place of a value until one is chosen. */
  placeholder: string;
  value: string | null;
  options: NativePickerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /**
   * Optional: lift the open/closed state so a group of fields can behave as an
   * accordion (one list at a time). Self-managed when omitted. Unused by the
   * Android branch, where the OS owns the dropdown.
   */
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
  testID?: string;
};

/** iOS wheel height — UIPickerView's own intrinsic height. */
const WHEEL_HEIGHT = 200;
/** Fallback list height: tall enough to show ~5 rows, like a wheel. */
const LIST_MAX_HEIGHT = 220;

/** The view managers `@react-native-picker/picker` registers per platform. */
const VIEW_MANAGER = Platform.OS === 'android' ? 'RNCAndroidDropdownPicker' : 'RNCPicker';

/** The dev warning below is worth saying once per session, not per render. */
let warnedAboutFallback = false;

/**
 * Is the picker's native view actually in THIS binary?
 *
 * It is a native module, so a JS bundle can outrun the app it runs in — an
 * older dev client, or an `expo-updates` OTA landing on a build from before
 * the dependency was added. When it does, the picker renders RN's
 * "Unimplemented component: <RNCPicker>" box and the add-vehicle flow is dead.
 *
 * Absence has to be PROVEN: only a UIManager that answers, and answers null,
 * counts. If UIManager cannot be queried at all we assume the component is
 * there, because guessing "missing" would drop every healthy build onto the
 * fallback.
 */
function isNativePickerAvailable(): boolean {
  try {
    const getConfig = UIManager?.getViewManagerConfig;
    if (typeof getConfig !== 'function') return true;
    if (getConfig.call(UIManager, VIEW_MANAGER) != null) return true;
    // Say so once: silently degrading looks like the native picker simply
    // "did not work", and the actual fix is a rebuild of the app binary.
    if (typeof __DEV__ !== 'undefined' && __DEV__ && !warnedAboutFallback) {
      warnedAboutFallback = true;
      console.warn(
        `[AppNativePickerField] ${VIEW_MANAGER} is not in this build — using the in-app list. ` +
          'Rebuild the app (@react-native-picker/picker is a native module) to get the system picker.',
      );
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * A field backed by the PLATFORM's own picker, not a hand-built list.
 *
 * The two platforms disagree about what a picker is, so this renders each
 * one's native control rather than forcing a single look:
 *
 *   - **iOS**: tapping the row expands `UIPickerView` inline underneath it,
 *     which is what the system itself does for inline pickers since iOS 14.
 *     Deliberately NOT a nested `Modal`: this field is used inside a bottom
 *     sheet, which is already a Modal, and modal-over-modal is glitchy on iOS.
 *   - **Android**: the `Picker` sits over the row at zero opacity, so a tap
 *     lands on the real Spinner and Android opens its own dropdown. There is
 *     no API to open that dropdown programmatically, so the invisible overlay
 *     is the only way to keep our row styling AND the system dropdown.
 *   - **Neither, on a binary without the module**: a plain in-app list, so the
 *     field still works instead of rendering an "Unimplemented component" box.
 *
 * iOS commits on every settle (an inline wheel has no "Done"), so callers that
 * trigger work on change should tolerate a few repeats while the user scrolls.
 */
export function AppNativePickerField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
  expanded,
  onExpandedChange,
  testID,
}: AppNativePickerFieldProps) {
  const { tokens } = useThemeContext();
  const [selfOpen, setSelfOpen] = useState(false);

  const hasNative = isNativePickerAvailable();
  const isControlled = expanded !== undefined;
  const open = isControlled ? !!expanded : selfOpen;
  const selected = options.find((o) => o.value === value) ?? null;
  const isDisabled = !!disabled || options.length === 0;
  /** Only the real wheel carries a highlighted row; a list does not. */
  const usesWheel = hasNative && Platform.OS !== 'android';

  const setOpen = (next: boolean) => {
    if (isControlled) onExpandedChange?.(next);
    else setSelfOpen(next);
  };

  // A wheel has no empty state to sit on: it centres a row, and the rows above
  // that row are blank space. So the wheel is not shown until the field is
  // tapped, and opening it commits whatever it centres — which is how the
  // field can start with nothing chosen (the step's question is genuinely
  // unanswered) without ever rendering a half-empty wheel, and without the
  // dead-button trap where someone whose answer IS the top row never moves it.
  const needsWheelCommit = open && usesWheel && !isDisabled && !value && options.length > 0;
  const firstValue = options[0]?.value;
  useEffect(() => {
    if (needsWheelCommit && firstValue) onChange(firstValue);
  }, [needsWheelCommit, firstValue, onChange]);

  const toggle = () => setOpen(!open);

  const Chevron = open ? ChevronUp : ChevronDown;

  /** The always-visible summary line. Inside the card, never its own box. */
  const row = (
    <AppView row align="center" gap={12} px={16} py={14}>
      <AppView flex={1} gap={3}>
        <AppText
          family="accent"
          weight="bold"
          transform="uppercase"
          style={{ fontSize: 10, letterSpacing: 1, color: tokens.textMuted }}
        >
          {label}
        </AppText>
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 17, color: selected ? tokens.text : tokens.textMuted }}
        >
          {selected?.label ?? placeholder}
        </AppText>
      </AppView>
      <AppView
        center
        rounded={999}
        colorName="backgroundSecondary"
        style={{ width: 28, height: 28 }}
      >
        <Chevron size={16} strokeWidth={2.4} color={tokens.text} />
      </AppView>
    </AppView>
  );

  /** One card holds the summary AND, when open, the picker under a hairline —
   *  so the control reads as a single object that unfolds, rather than a field
   *  with a second, competing panel parked beneath it. */
  const card = (children?: React.ReactNode) => (
    <AppView
      rounded={18}
      colorName="card"
      borderWidth={1}
      borderName={open ? 'brand' : 'border'}
      style={{ overflow: 'hidden', opacity: isDisabled ? 0.5 : 1 }}
    >
      {children}
    </AppView>
  );

  // ── Android: the system dropdown, opened by the overlaid Spinner ──────────
  if (hasNative && Platform.OS === 'android') {
    return (
      <View style={{ position: 'relative' }}>
        {card(row)}
        <Picker
          testID={testID}
          enabled={!isDisabled}
          selectedValue={value ?? ''}
          onValueChange={(next) => {
            if (typeof next === 'string' && next !== '') onChange(next);
          }}
          mode="dropdown"
          dropdownIconColor={tokens.textMuted}
          accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
          style={[StyleSheet.absoluteFill, { opacity: 0 }]}
        >
          {/* Placeholder row so an unset field has something selected to show;
           *  `onValueChange` ignores it, so it can never be chosen. */}
          {selected ? null : <Picker.Item label={placeholder} value="" />}
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    );
  }

  // ── iOS / fallback: one card that unfolds ────────────────────────────────
  return card(
    <>
      <AppPressableView
        onPress={toggle}
        disabled={isDisabled}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: isDisabled }}
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        testID={testID}
      >
        {row}
      </AppPressableView>

      {open && !isDisabled ? (
        <>
          <AppView style={{ height: 1, backgroundColor: tokens.divider }} />
          {usesWheel ? (
            <Picker
              selectedValue={value ?? options[0]?.value ?? ''}
              onValueChange={(next) => {
                if (typeof next === 'string' && next !== '') onChange(next);
              }}
              itemStyle={{ color: tokens.text, fontSize: 20 }}
              style={{ height: WHEEL_HEIGHT }}
            >
              {options.map((o) => (
                <Picker.Item key={o.value} label={o.label} value={o.value} color={tokens.text} />
              ))}
            </Picker>
          ) : (
            <ScrollView style={{ maxHeight: LIST_MAX_HEIGHT }} nestedScrollEnabled>
              {options.map((o) => {
                const isSelected = o.value === value;
                return (
                  <AppPressableView
                    key={o.value}
                    testID={testID ? `${testID}-option-${o.value}` : undefined}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    androidRipple
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={o.label}
                    row
                    align="center"
                    gap={10}
                    px={16}
                    py={13}
                  >
                    <AppText
                      family="default"
                      weight={isSelected ? 'semibold' : undefined}
                      style={{ flex: 1, fontSize: 16, color: tokens.text }}
                    >
                      {o.label}
                    </AppText>
                    {isSelected ? (
                      <Check size={16} strokeWidth={2.6} color={tokens.brand} />
                    ) : null}
                  </AppPressableView>
                );
              })}
            </ScrollView>
          )}
        </>
      ) : null}
    </>,
  );
}

export default AppNativePickerField;
