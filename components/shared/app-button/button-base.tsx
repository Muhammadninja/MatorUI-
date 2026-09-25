import { AppIcon, type AppIconProps } from '@/components/shared/app-icon';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { TextVariant, WeightName } from '@/themes';
import React, { memo } from 'react';
import { ActivityIndicator, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

export type ButtonBaseProps = {
  title?: string;
  children?: React.ReactNode;
  startIcon?: Omit<AppIconProps, 'onPress' | 'disabled'>;
  endIcon?: Omit<AppIconProps, 'onPress' | 'disabled'>;
  spinner?: boolean;
  spinnerColor?: string;
  spinnerSize?: 'small' | 'large';
  contentStyle?: StyleProp<ViewStyle>;
  contentJustify?: ViewStyle['justifyContent'];
  labelStyle?: StyleProp<TextStyle>;
  textVariant?: TextVariant;
  weight?: WeightName;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  allowFontScaling?: boolean;
  gap?: number;
};

function ButtonBaseImpl({
  title,
  children,
  startIcon,
  endIcon,
  spinner,
  spinnerColor,
  spinnerSize = 'small',
  contentStyle,
  contentJustify = 'center',
  labelStyle,
  textVariant,
  weight,
  numberOfLines,
  ellipsizeMode,
  allowFontScaling,
  gap,
}: ButtonBaseProps) {
  return (
    <AppView
      row
      align="center"
      justify={contentJustify}
      gap={gap ?? 8}
      style={
        [
          contentJustify === 'space-between' ? ({ width: '100%' } as ViewStyle) : undefined,
          contentStyle,
        ] as any
      }
    >
      {spinner ? (
        <ActivityIndicator color={spinnerColor} size={spinnerSize} />
      ) : (
        <>
          {startIcon ? <AppIcon {...startIcon} /> : null}
          {title ? (
            <AppText
              allowFontScaling={allowFontScaling}
              textVariant={textVariant}
              // A label that wraps (long translations) stays centred in a
              // centred button instead of hugging the left edge.
              align={contentJustify === 'center' ? 'center' : undefined}
              weight={weight}
              numberOfLines={numberOfLines}
              ellipsizeMode={ellipsizeMode}
              style={labelStyle}
            >
              {title}
            </AppText>
          ) : (
            children
          )}
          {endIcon ? <AppIcon {...endIcon} /> : null}
        </>
      )}
    </AppView>
  );
}

export const ButtonBase = memo(ButtonBaseImpl);
