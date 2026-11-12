import { type ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import React, { memo, useMemo } from 'react';
import {
  I18nManager,
  Platform,
  Switch,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppBadge } from '@/components/shared/app-badge';
import { AppIcon, type Family } from '@/components/shared/app-icon';
import AppImage from '@/components/shared/app-image';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useColorToken } from '@/components/shared/app-view/colors';
import { useThemeContext } from '@/contexts/theme.context';
import { type ColorName, type WeightName } from '@/themes';
import { triggerHaptic, type HapticKind } from '@/utils/haptics';

export type ListItemSize = 'sm' | 'md' | 'lg';

export type AppListItemProps = {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  size?: ListItemSize;
  leadingIcon?: {
    name: string;
    family?: Family;
    preserveImageColor?: boolean;
    size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  } | null;
  leading?: ReactNode; // custom leading node overrides leadingIcon
  leadingImage?: {
    source: ImageSource;
    size?: number;
    rounded?: number;
    style?: StyleProp<ImageStyle>;
  } | null;
  rightAccessory?: ReactNode; // custom right node overrides others
  rightChevron?: boolean;
  chevronDirection?: 'auto' | 'left' | 'right';
  rightText?: string | number;
  rightBadgeLabel?: string;
  rightSwitchValue?: boolean;
  onRightSwitchChange?: (v: boolean) => void;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  selectionColorName?: ColorName; // override selected background token
  divider?: boolean; // bottom divider
  dividerInset?: number; // custom left inset for divider line
  /** Internal: indicates if this is the first item in a group (for rounded corners) */
  _isFirst?: boolean;
  /** Internal: indicates if this is the last item in a group (for rounded corners) */
  _isLast?: boolean;
  /** Internal: parent's border radius to apply to first/last items */
  _parentRounded?: number;
  haptics?: HapticKind;
  enableAnimatedPress?: boolean;
  pressedScale?: number;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  allowFontScaling?: boolean;
  /** Optional background color token for the row (non-selected). */
  colorName?: ColorName;
  /** Title color token (default 'white') */
  titleColorName?: ColorName;
  /** Subtitle color token (default 'white') */
  subtitleColorName?: ColorName;
  /** Leading icon color token (default 'white') */
  leadingIconColorName?: ColorName;
  /** Chevron color token (default 'white') */
  chevronColorName?: ColorName;
  /** Vertical alignment of content (default center). */
  align?: 'center' | 'flex-start' | 'flex-end';
  /** Optional container rounding */
  rounded?: number;
  /** Optional container border width */
  borderWidth?: number;
  /** Optional container border theme token name */
  borderName?: ColorName;
  /** Optional container border color (overrides borderName) */
  borderColor?: string;
  /** Title/subtitle configuration and overrides */
  titleVariant?: 'bodySm' | 'h4' | 'h3' | 'body' | 'bodySemibold' | 'subtitle' | 'title';
  subtitleVariant?: 'bodyXs' | 'bodySm' | 'caption' | 'body' | 'subtitle';
  /** Title font weight. Unset = the variant's own weight (semibold at `md`). */
  titleWeight?: WeightName;
  /** Optional hard line cap. Omitted by default so text wraps, never clips. */
  titleLines?: number;
  /** Optional hard line cap. Omitted by default so text wraps, never clips. */
  subtitleLines?: number;
  titleStyle?: any;
  subtitleStyle?: any;
  /** Right text color token override */
  rightTextColorName?: ColorName;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Vertical padding override for a denser list; the inset divider follows it. */
  py?: number;
};

const SIZE_MAP: Record<
  ListItemSize,
  {
    px: number;
    py: number;
    gap: number;
    height: number;
    title: 'bodySm' | 'bodySemibold' | 'h3';
    subtitle: 'bodyXs' | 'bodySm';
    icon: 'sm' | 'md' | 'lg';
  }
> = {
  sm: { px: 12, py: 10, gap: 10, height: 44, title: 'bodySm', subtitle: 'bodyXs', icon: 'sm' },
  md: {
    px: 16,
    py: 16,
    gap: 12,
    height: 52,
    title: 'bodySemibold',
    subtitle: 'bodySm',
    icon: 'md',
  },
  lg: { px: 20, py: 18, gap: 14, height: 60, title: 'h3', subtitle: 'bodySm', icon: 'lg' },
};

const AppListItemComponent: React.FC<AppListItemProps> = ({
  title,
  subtitle,
  size = 'md',
  leadingIcon,
  leading,
  leadingImage,
  rightAccessory,
  rightChevron,
  chevronDirection = 'auto',
  rightText,
  rightBadgeLabel,
  rightSwitchValue,
  onRightSwitchChange,
  onPress,
  onLongPress,
  disabled,
  selected,
  selectionColorName,
  divider,
  dividerInset,
  _isFirst,
  _isLast,
  _parentRounded,
  haptics,
  enableAnimatedPress = true,
  pressedScale = 0.97,
  hitSlop,
  accessibilityLabel,
  accessibilityHint,
  testID,
  allowFontScaling = true,
  colorName,
  titleColorName,
  subtitleColorName,
  leadingIconColorName,
  chevronColorName,
  align = 'center',
  rounded,
  borderWidth,
  borderName,
  borderColor,
  titleVariant,
  subtitleVariant,
  titleWeight,
  // No default clamp: rows grow to fit their text instead of ellipsizing it.
  // Callers can still pass an explicit line cap where a fixed row height
  // genuinely matters.
  titleLines,
  subtitleLines,
  titleStyle,
  subtitleStyle,
  rightTextColorName,
  style,
  contentStyle,
  py,
}) => {
  const { tokens: C, scheme } = useThemeContext();
  const sz = SIZE_MAP[size];
  const padY = py ?? sz.py;
  const selectedTokenName = (selectionColorName ??
    (scheme === 'light' ? 'gray50' : 'gray200')) as ColorName;
  const selectedBg = useColorToken(selectedTokenName);
  const unselectedBg = useColorToken(colorName as any);
  const bg = selected ? selectedBg : unselectedBg;

  const containerStyle = useMemo(() => {
    const baseStyles: any[] = [
      { minHeight: sz.height },
      bg ? { backgroundColor: bg } : null,
      disabled ? { opacity: 0.5 } : null,
    ];

    // Apply rounded prop directly if provided
    if (rounded != null) {
      baseStyles.push({ borderRadius: rounded });
    } else if (_parentRounded) {
      // Apply rounded corners to first/last items to match parent group
      if (_isFirst && _isLast) {
        // Single item - round all corners
        baseStyles.push({ borderRadius: _parentRounded });
      } else if (_isFirst) {
        // First item - round top corners
        baseStyles.push({
          borderTopLeftRadius: _parentRounded,
          borderTopRightRadius: _parentRounded,
        });
      } else if (_isLast) {
        // Last item - round bottom corners
        baseStyles.push({
          borderBottomLeftRadius: _parentRounded,
          borderBottomRightRadius: _parentRounded,
        });
      }
    }

    // Apply border if specified
    if (borderWidth != null) {
      baseStyles.push({ borderWidth });
      const resolvedBorderColor =
        borderColor ?? (borderName ? C[borderName as keyof typeof C] : undefined);
      if (resolvedBorderColor) {
        baseStyles.push({ borderColor: resolvedBorderColor });
      }
    }

    baseStyles.push(style);
    return baseStyles as StyleProp<ViewStyle>;
  }, [
    bg,
    disabled,
    style,
    _isFirst,
    _isLast,
    _parentRounded,
    rounded,
    borderWidth,
    borderColor,
    borderName,
    C,
    sz.height,
  ]);

  // Memoize leftNode computation
  const leftNode: ReactNode | null = useMemo(() => {
    if (leading !== undefined) return leading as ReactNode;
    if (leadingIcon === null) return null;
    if (leadingImage === null) return null;
    if (leadingImage && !leadingIcon) {
      const dim = leadingImage.size ?? (sz.icon === 'sm' ? 20 : sz.icon === 'md' ? 24 : 24);
      return (
        <AppImage
          source={leadingImage.source}
          width={dim}
          height={dim}
          rounded={leadingImage.rounded ?? Math.round(dim / 2)}
          style={leadingImage.style as StyleProp<ViewStyle>}
        />
      );
    }
    if (leadingIcon)
      return (
        <AppIcon
          family={leadingIcon.family ?? 'symbol'}
          name={leadingIcon.name}
          size={leadingIcon.size ?? sz.icon}
          colorName={leadingIconColorName as any}
          preserveImageColor={leadingIcon.preserveImageColor}
        />
      );
    return null;
  }, [leading, leadingIcon, leadingImage, sz.icon, leadingIconColorName]);

  // Memoize rightNode computation
  const rightNode: ReactNode | null = useMemo(() => {
    if (rightAccessory) return rightAccessory;
    if (rightSwitchValue != null && onRightSwitchChange) {
      const trackColor = { false: C.switchTrackOff, true: C.switchTrackOn } as any;
      const thumb = C.switchThumbOn;
      return (
        <Switch
          value={!!rightSwitchValue}
          onValueChange={onRightSwitchChange}
          trackColor={trackColor}
          thumbColor={thumb}
        />
      );
    }

    // Handle badge + chevron combination
    const hasBadge = !!rightBadgeLabel;
    const hasChevron = !!rightChevron;
    const hasRightText = rightText != null;

    if (hasBadge && hasChevron) {
      const dir =
        chevronDirection === 'auto' ? (I18nManager.isRTL ? 'left' : 'right') : chevronDirection;
      return (
        <AppView row align="center" gap={8}>
          <AppBadge label={rightBadgeLabel} variant="solid" kind="primary" />
          <AppIcon
            family={'symbol'}
            name={`chevron.${dir}` as any}
            size={'sm'}
            containerStyle={
              Platform.OS === 'android' ? ({ transform: [{ scale: 1.6 }] } as any) : undefined
            }
            colorName={chevronColorName as any}
          />
        </AppView>
      );
    }

    if (hasRightText && hasChevron) {
      const dir =
        chevronDirection === 'auto' ? (I18nManager.isRTL ? 'left' : 'right') : chevronDirection;
      return (
        <AppView row align="center" gap={8}>
          <AppText
            textVariant="bodyXs"
            weight="semibold"
            allowFontScaling={allowFontScaling}
            colorName={rightTextColorName}
            muted={!rightTextColorName}
          >
            {String(rightText)}
          </AppText>
          <AppIcon
            family={'symbol'}
            name={`chevron.${dir}` as any}
            size={'sm'}
            containerStyle={
              Platform.OS === 'android' ? ({ transform: [{ scale: 1.6 }] } as any) : undefined
            }
            colorName={chevronColorName as any}
          />
        </AppView>
      );
    }

    if (hasRightText)
      return (
        <AppText
          textVariant="bodyXs"
          weight="semibold"
          allowFontScaling={allowFontScaling}
          colorName={rightTextColorName}
          muted={!rightTextColorName}
        >
          {String(rightText)}
        </AppText>
      );
    if (hasBadge) return <AppBadge label={rightBadgeLabel} variant="solid" kind="primary" />;
    if (hasChevron) {
      const dir =
        chevronDirection === 'auto' ? (I18nManager.isRTL ? 'left' : 'right') : chevronDirection;
      return (
        <AppIcon
          family={'custom'}
          name={`icons-arrow-right-2` as any}
          // Visually scale up on Android without affecting layout height
          size={Platform.OS === 'android' ? 18 : 24}
          containerStyle={
            Platform.OS === 'android' ? ({ transform: [{ scale: 1.6 }] } as any) : undefined
          }
          colorName={chevronColorName as any}
        />
      );
    }
    return null;
  }, [
    rightAccessory,
    rightSwitchValue,
    onRightSwitchChange,
    C.gray300,
    C.gray400,
    C.primaryBg,
    C.white,
    C.gray100,
    rightText,
    allowFontScaling,
    rightTextColorName,
    rightBadgeLabel,
    rightChevron,
    chevronDirection,
    chevronColorName,
    scheme,
  ]);

  // Memoize press handler
  const handlePress = useMemo(() => {
    if (!onPress) return undefined;
    return () => {
      if (disabled) return;
      if (haptics) triggerHaptic(haptics);
      onPress?.();
    };
  }, [disabled, haptics, onPress]);

  const handleLongPress = useMemo(() => {
    if (!onLongPress) return undefined;
    return () => {
      if (disabled) return;
      if (haptics) triggerHaptic(haptics);
      onLongPress?.();
    };
  }, [disabled, haptics, onLongPress]);
  const content = (
    <AppView
      row
      align={align}
      justify={rightNode ? 'space-between' : undefined}
      gap={sz.gap}
      style={contentStyle}
    >
      <AppView row align={align} gap={sz.gap} style={{ flexShrink: 1 }}>
        {leftNode}
        <AppView gap={2} style={{ flexShrink: 1 }}>
          {typeof title === 'string' ? (
            <AppText
              textVariant={titleVariant ?? sz.title}
              weight={titleWeight}
              numberOfLines={titleLines}
              allowFontScaling={allowFontScaling}
              colorName={titleColorName}
              style={titleStyle}
            >
              {title}
            </AppText>
          ) : (
            title
          )}
          {subtitle != null ? (
            typeof subtitle === 'string' ? (
              <AppText
                textVariant={subtitleVariant ?? sz.subtitle}
                numberOfLines={subtitleLines}
                colorName={subtitleColorName}
                muted={!subtitleColorName}
                style={subtitleStyle}
                allowFontScaling={allowFontScaling}
              >
                {subtitle}
              </AppText>
            ) : (
              subtitle
            )
          ) : null}
        </AppView>
      </AppView>
      <AppView>{rightNode}</AppView>
    </AppView>
  );

  const wrapperProps = {
    px: sz.px,
    py: padY,
    borderBottomWidth: divider && !dividerInset ? 1 : 0,
    borderName: divider && !dividerInset ? ('divider' as any) : undefined,
  } as const;

  // Pressed background color - subtle overlay for visual feedback
  const pressedBgColor = useMemo(() => C.listPressedOverlay, [C.listPressedOverlay]);

  if (onPress) {
    const fallbackAcc =
      typeof title === 'string'
        ? `${title}${typeof subtitle === 'string' && subtitle ? `, ${subtitle}` : ''}`
        : undefined;
    return (
      <AppPressableView
        {...wrapperProps}
        androidRipple
        pressedBackgroundColor={pressedBgColor}
        pressedScale={enableAnimatedPress ? pressedScale : 1}
        hitSlop={hitSlop as any}
        accessibilityLabel={accessibilityLabel ?? fallbackAcc}
        accessibilityHint={accessibilityHint}
        testID={testID}
        accessibilityState={{ disabled: !!disabled, selected: !!selected }}
        onPress={() => {
          if (!disabled) {
            if (haptics) triggerHaptic(haptics);
            onPress?.();
          }
        }}
        onLongPress={() => {
          if (!disabled) {
            if (haptics) triggerHaptic(haptics);
            onLongPress?.();
          }
        }}
        disabled={disabled}
        style={containerStyle}
      >
        {content}
        {divider && dividerInset ? (
          <AppView
            style={{
              height: 1,
              backgroundColor: C.divider,
              marginLeft: dividerInset,
              marginTop: padY,
              marginBottom: -padY,
            }}
          />
        ) : null}
      </AppPressableView>
    );
  }

  return (
    <AppView
      {...wrapperProps}
      style={containerStyle}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
    >
      {content}
      {divider && dividerInset ? (
        <AppView
          style={{
            height: 1,
            backgroundColor: C.divider,
            marginLeft: dividerInset,
            marginTop: padY,
            marginBottom: -padY,
          }}
        />
      ) : null}
    </AppView>
  );
};

const AppListItem = memo(AppListItemComponent);
AppListItem.displayName = 'AppListItem';

export { AppListItem };
export default AppListItem;
