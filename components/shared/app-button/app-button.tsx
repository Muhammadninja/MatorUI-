import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  View,
  type AccessibilityRole,
  type GestureResponderEvent,
  type Insets,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { type AppIconProps } from '@/components/shared/app-icon';
import { useThemeContext } from '@/contexts/theme.context';
import { type TextVariant, type WeightName } from '@/themes';
import type { HapticKind } from '@/utils/haptics';
import { ButtonContent } from './button-content';
import { useButtonStyles } from './hooks/use-button-styles';
import { useDebouncedPress } from './hooks/use-debounced-press';
import { useLoadingDelay } from './hooks/use-loading-delay';
import { usePressAnimation } from './hooks/use-press-animation';
import { useButtonDefaults } from './use-button-defaults';

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'link';
export type ButtonKind =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'info'
  | 'warning'
  | 'text'
  | 'brand';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type AppButtonProps = {
  title?: string;
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  delayLongPress?: number;
  delayPressIn?: number;
  delayPressOut?: number;
  disabled?: boolean;
  loading?: boolean;
  /** Delay showing spinner by N ms to reduce flicker on quick ops */
  loadingDelayMs?: number;
  /** Loading presentation strategy. replace: only spinner; overlay: spinner over content; inline-start: spinner before label */
  loadingVariant?: 'replace' | 'overlay' | 'inline-start';
  /** Prevent double-taps in this time window (ms). Set 0/undefined to disable. */
  debounceMs?: number;
  variant?: ButtonVariant;
  kind?: ButtonKind;
  size?: ButtonSize;
  textVariant?: TextVariant;
  weight?: WeightName;
  /** Limit text lines and truncation behavior */
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  /** Transform title to uppercase (does not affect children) */
  uppercase?: boolean;
  startIcon?: Omit<AppIconProps, 'onPress' | 'disabled'>;
  endIcon?: Omit<AppIconProps, 'onPress' | 'disabled'>;
  iconColor?: string; // optional override for icon color
  fullWidth?: boolean;
  rounded?: number;
  /** Override spacing between icon and text */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  /** Style for the outer wrapper (Animated.View). Useful for layout props like flex/width. */
  containerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Control alignment of label and icons within the button's content row */
  contentJustify?: ViewStyle['justifyContent'];
  textStyle?: StyleProp<TextStyle>;
  haptics?: false | HapticKind;
  /** Accessibility */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  /** Toggle semantics */
  selected?: boolean;
  checked?: boolean;
  /** Typography accessibility */
  allowFontScaling?: boolean;
  /** Whether to show pressed overlay for non-solid variants (default: true) */
  enablePressedOverlay?: boolean;
  /** Android-only: show ripple on press (default: true) */
  enableRipple?: boolean;
  /** Animate scale on press (default: false) */
  enableAnimatedPress?: boolean;
  /** Target scale when pressed if animation enabled (default: 0.98) */
  pressedScale?: number;
  /** Android-only: add shadow elevation when pressed (solid variant) */
  enablePressedElevation?: boolean;
  /** Elevation value to apply when pressed (Android) */
  pressedElevation?: number;
  /** Customize Android ripple appearance */
  rippleColor?: string;
  rippleRadius?: number;
  rippleBorderless?: boolean;
  /** Increase or customize touch target area */
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  /** Control pressable interaction geometry */
  pressRetentionOffset?: Insets;
  /** Layout and focus management */
  onLayout?: (event: LayoutChangeEvent) => void;
  accessible?: boolean;
  nativeID?: string;
  onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
  onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
  testID?: string;
};

const AppButtonImpl = forwardRef<View, AppButtonProps>(function AppButton(
  {
    title,
    children,
    onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    delayLongPress,
    delayPressIn,
    delayPressOut,
    disabled,
    loading,
    loadingDelayMs,
    loadingVariant = 'replace',
    debounceMs,
    variant = 'solid',
    kind = 'primary',
    size = 'lg',
    startIcon,
    endIcon,
    iconColor,
    fullWidth,
    rounded,
    gap: gapOverride,
    style,
    containerStyle,
    contentStyle,
    contentJustify,
    textStyle,
    haptics = 'selection',
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole = 'button',
    accessibilityLiveRegion,
    importantForAccessibility,
    selected,
    checked,
    allowFontScaling,
    testID,
    enablePressedOverlay,
    enableRipple,
    rippleColor,
    rippleRadius,
    rippleBorderless,
    hitSlop,
    pressRetentionOffset,
    onLayout,
    accessible,
    nativeID,
    onFocus,
    onBlur,
    textVariant,
    weight,
    numberOfLines,
    ellipsizeMode,
    uppercase,
    enableAnimatedPress,
    pressedScale,
    enablePressedElevation,
    pressedElevation,
  },
  ref,
) {
  const { scheme } = useThemeContext();
  const {
    effectiveDebounce,
    effectiveAnimatedPress,
    effectivePressedScale,
    effectivePressedOverlay,
    effectiveRipple,
    effectiveLoadingDelay,
  } = useButtonDefaults({
    debounceMs,
    enableAnimatedPress,
    pressedScale,
    enablePressedOverlay,
    enableRipple,
    loadingDelayMs,
  });
  // Use refs for boolean flags to stabilize callbacks
  const disabledRef = useRef(disabled);
  const loadingRef = useRef(loading);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  // Optional delayed spinner to avoid flicker on fast operations
  const showLoading = useLoadingDelay(loading, effectiveLoadingDelay);

  const {
    animatedContainerStyle,
    onPressIn: animIn,
    onPressOut: animOut,
  } = usePressAnimation({ enabled: effectiveAnimatedPress, pressedScale: effectivePressedScale });
  const displayTitle = useMemo(
    () => (uppercase && title ? title.toUpperCase() : title),
    [uppercase, title],
  );

  const buttonStyles = useButtonStyles({
    scheme,
    variant,
    kind,
    size,
    disabled,
    loading,
    loadingVariant,
    fullWidth,
    rounded,
    gapOverride,
    iconColor,
    enablePressedOverlay: effectivePressedOverlay,
    enableRipple: effectiveRipple,
    rippleColor,
    rippleRadius,
    rippleBorderless,
    enablePressedElevation,
    pressedElevation,
  });

  const {
    baseStyle,
    variantStyle,
    contentStyle: buttonContentStyle,
    labelStyle,
    resolvedIconColor,
    iconSize,
    fontSize,
    spinnerSize,
    rippleConfig,
    getPressedStyle,
    defaultTextVariant,
  } = buttonStyles;

  // Dev-only a11y guard: if no textual content and no accessibilityLabel, warn
  const hasTextChild = useMemo(() => {
    if (!children) return false;
    return React.Children.toArray(children).some((c) => typeof c === 'string');
  }, [children]);

  useEffect(() => {
    if (__DEV__) {
      if (!title && !accessibilityLabel && !hasTextChild) {
        console.warn('AppButton: Provide accessibilityLabel for icon-only or non-text buttons.');
      }
    }
  }, [title, accessibilityLabel, hasTextChild]);

  // Runtime fallback so icon-only buttons still announce SOMETHING via
  // TalkBack / VoiceOver when a caller forgets to pass accessibilityLabel.
  // Without this, Android reads no label at all and the button is unusable
  // for assistive tech.
  const resolvedAccessibilityLabel = useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;
    if (displayTitle) return displayTitle;
    const iconName = startIcon?.name ?? endIcon?.name;
    if (iconName) return humanizeIconName(iconName);
    return undefined;
  }, [accessibilityLabel, displayTitle, startIcon?.name, endIcon?.name]);

  const handlePress = useDebouncedPress({
    debounceMs: effectiveDebounce,
    disabled,
    loading,
    haptics,
    onPress,
  });

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      animIn();
      onPressIn?.(e);
    },
    [animIn, onPressIn],
  );
  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      animOut();
      onPressOut?.(e);
    },
    [animOut, onPressOut],
  );

  const pressableStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => [
      baseStyle,
      variantStyle,
      getPressedStyle(pressed, !!(disabledRef.current || loadingRef.current)),
      style,
    ],
    [baseStyle, variantStyle, getPressedStyle, style],
  );

  return (
    <Animated.View style={[animatedContainerStyle, containerStyle]}>
      <Pressable
        ref={ref as any}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: !!(disabled || loading),
          busy: !!loading,
          selected: !!selected,
          checked: !!checked,
        }}
        accessibilityLiveRegion={accessibilityLiveRegion}
        importantForAccessibility={importantForAccessibility}
        accessible={accessible}
        nativeID={nativeID}
        disabled={disabled || loading}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        onLayout={onLayout}
        onFocus={onFocus}
        onBlur={onBlur}
        hitSlop={hitSlop ?? 8}
        pressRetentionOffset={pressRetentionOffset}
        style={pressableStyle}
        android_ripple={rippleConfig}
        testID={testID}
      >
        <ButtonContent
          title={displayTitle}
          allowFontScaling={allowFontScaling}
          startIcon={startIcon}
          endIcon={endIcon}
          showLoading={showLoading}
          loadingVariant={loadingVariant}
          contentContainerStyle={buttonContentStyle}
          contentStyle={contentStyle}
          contentJustify={contentJustify}
          labelBaseStyle={labelStyle}
          textStyle={textStyle}
          textVariant={textVariant}
          defaultTextVariant={defaultTextVariant}
          weight={weight}
          numberOfLines={numberOfLines}
          ellipsizeMode={ellipsizeMode}
          resolvedIconColor={resolvedIconColor}
          iconSize={iconSize}
          fontSize={fontSize}
          spinnerSize={spinnerSize}
          disabled={disabled}
          gap={gapOverride}
        >
          {children}
        </ButtonContent>
      </Pressable>
    </Animated.View>
  );
});

AppButtonImpl.displayName = 'AppButton';

export const AppButton = memo(AppButtonImpl);

// "chevron.left" → "Chevron left", "icons-arrow-right-2" → "Icons arrow right 2"
function humanizeIconName(name: string): string {
  const cleaned = name.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
