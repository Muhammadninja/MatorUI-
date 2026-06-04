import React, { useMemo } from 'react';
import { ActivityIndicator, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import type { AppIconProps } from '@/components/shared/app-icon';
import { AppView } from '@/components/shared/app-view';
import type { TextVariant, WeightName } from '@/themes';
import { ButtonBase } from './button-base';

export type ButtonContentProps = {
  title?: string;
  children?: React.ReactNode;
  allowFontScaling?: boolean;
  startIcon?: Omit<AppIconProps, 'onPress' | 'disabled'>;
  endIcon?: Omit<AppIconProps, 'onPress' | 'disabled'>;
  showLoading: boolean;
  loadingVariant: 'replace' | 'overlay' | 'inline-start';
  contentContainerStyle: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  contentJustify?: ViewStyle['justifyContent'];
  labelBaseStyle: StyleProp<TextStyle>;
  textStyle?: StyleProp<TextStyle>;
  textVariant?: TextVariant;
  weight?: WeightName;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  resolvedIconColor: string;
  iconSize: number;
  fontSize: number;
  spinnerSize: 'small' | 'large';
  disabled?: boolean;
  gap?: number;
};

export function ButtonContent({
  title,
  children,
  allowFontScaling,
  startIcon,
  endIcon,
  showLoading,
  loadingVariant,
  contentContainerStyle,
  contentStyle,
  contentJustify,
  labelBaseStyle,
  textStyle,
  textVariant,
  weight,
  numberOfLines,
  ellipsizeMode,
  resolvedIconColor,
  iconSize,
  fontSize,
  spinnerSize,
  disabled,
  gap,
}: ButtonContentProps) {
  // Memoize resolved icons to prevent recreation
  const resolvedStartIcon = useMemo(
    () =>
      startIcon
        ? {
            ...startIcon,
            size: startIcon.size ?? iconSize,
            color: startIcon.color ?? resolvedIconColor,
          }
        : undefined,
    [startIcon, iconSize, resolvedIconColor],
  );

  const resolvedEndIcon = useMemo(
    () =>
      endIcon
        ? {
            ...endIcon,
            size: endIcon.size ?? iconSize,
            color: endIcon.color ?? resolvedIconColor,
          }
        : undefined,
    [endIcon, iconSize, resolvedIconColor],
  );

  const labelStyle: StyleProp<TextStyle> = [
    !textVariant ? ({ fontSize } as TextStyle) : undefined,
    labelBaseStyle,
    textStyle,
    disabled ? ({ opacity: 0.85 } as TextStyle) : undefined,
  ];
  const needsFullWidth = contentJustify === 'space-between';
  if (loadingVariant === 'overlay' && showLoading) {
    return (
      <AppView
        style={[
          needsFullWidth ? { width: '100%' } : undefined,
          contentContainerStyle,
          contentStyle,
        ]}
      >
        <ButtonBase
          title={title}
          allowFontScaling={allowFontScaling}
          startIcon={resolvedStartIcon}
          endIcon={resolvedEndIcon}
          labelStyle={labelStyle}
          textVariant={textVariant}
          weight={weight}
          numberOfLines={numberOfLines}
          ellipsizeMode={ellipsizeMode}
          contentJustify={contentJustify}
          gap={gap}
        >
          {children}
        </ButtonBase>
        <AppView
          style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={resolvedIconColor} size={spinnerSize} />
        </AppView>
      </AppView>
    );
  }

  // Preserve layout in 'replace' mode to avoid width/height jumps when loading
  if (loadingVariant === 'replace' && showLoading) {
    return (
      <AppView
        style={[
          needsFullWidth ? { width: '100%' } : undefined,
          contentContainerStyle,
          contentStyle,
        ]}
      >
        {/* Render content invisibly to keep intrinsic size, then overlay spinner */}
        <ButtonBase
          title={title}
          allowFontScaling={allowFontScaling}
          startIcon={resolvedStartIcon}
          endIcon={resolvedEndIcon}
          labelStyle={[labelStyle, { opacity: 0 } as TextStyle]}
          textVariant={textVariant}
          weight={weight}
          numberOfLines={numberOfLines}
          ellipsizeMode={ellipsizeMode}
          contentJustify={contentJustify}
          contentStyle={{ opacity: 0 }}
          gap={gap}
        >
          {children}
        </ButtonBase>
        <AppView
          style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={resolvedIconColor} size="small" />
        </AppView>
      </AppView>
    );
  }
  return (
    <AppView
      style={[needsFullWidth ? { width: '100%' } : undefined, contentContainerStyle, contentStyle]}
    >
      <ButtonBase
        title={title}
        allowFontScaling={allowFontScaling}
        startIcon={showLoading && loadingVariant === 'inline-start' ? undefined : resolvedStartIcon}
        endIcon={resolvedEndIcon}
        spinner={showLoading && loadingVariant === 'replace'}
        spinnerColor={resolvedIconColor}
        spinnerSize={spinnerSize}
        labelStyle={labelStyle}
        textVariant={textVariant}
        weight={weight}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
        contentJustify={contentJustify}
        gap={gap}
      >
        {children}
      </ButtonBase>
    </AppView>
  );
}

ButtonContent.displayName = 'ButtonContent';

export default ButtonContent;
