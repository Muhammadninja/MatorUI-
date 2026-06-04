import type { ReactNode } from 'react';
import React, { memo, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { type ShadowLevel } from '@/themes';
import { triggerHaptic, type HapticKind } from '@/utils/haptics';

export type CardVariant = 'elevated' | 'outline' | 'ghost';

export type AppCardProps = {
  variant?: CardVariant;
  rounded?: number;
  padding?: number; // uniform content padding
  shadowLevel?: ShadowLevel;
  divider?: boolean; // divider between header/content/footer
  header?: ReactNode;
  media?: ReactNode; // image/banner/video area (top)
  children?: ReactNode; // main content
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
  haptics?: HapticKind;
};

function resolveCardStyles(
  theme: { surface: string; background: string; border: string },
  variant: CardVariant,
) {
  switch (variant) {
    case 'elevated':
      return { bg: theme.surface, borderWidth: 0, borderColor: undefined as string | undefined };
    case 'outline':
      return { bg: theme.background, borderWidth: 1, borderColor: theme.border };
    case 'ghost':
    default:
      return { bg: 'transparent', borderWidth: 0, borderColor: undefined as string | undefined };
  }
}

type CardContentProps = Pick<
  AppCardProps,
  'rounded' | 'padding' | 'divider' | 'header' | 'media' | 'children' | 'footer' | 'contentStyle'
>;
const CardContentImpl: React.FC<CardContentProps> = ({
  rounded = 14,
  padding = 16,
  divider = false,
  header,
  media,
  children,
  footer,
  contentStyle,
}) => {
  const contentPad = padding;
  return (
    <>
      {media ? (
        <AppView
          roundedTop={rounded}
          style={{
            borderTopLeftRadius: rounded,
            borderTopRightRadius: rounded,
            overflow: 'hidden' as any,
          }}
        >
          {media}
        </AppView>
      ) : null}

      {header ? (
        <AppView px={contentPad} py={Math.max(12, contentPad - 4)}>
          {typeof header === 'string' ? <AppText textVariant="h4">{header}</AppText> : header}
        </AppView>
      ) : null}

      {header && divider ? <AppView borderBottomWidth={1} borderName={'divider' as any} /> : null}

      {children ? (
        <AppView px={contentPad} py={contentPad} style={contentStyle}>
          {children}
        </AppView>
      ) : null}

      {footer && divider ? <AppView borderTopWidth={1} borderName={'divider' as any} /> : null}

      {footer ? (
        <AppView px={contentPad} py={Math.max(12, contentPad - 4)}>
          {typeof footer === 'string' ? <AppText textVariant="bodyXs">{footer}</AppText> : footer}
        </AppView>
      ) : null}
    </>
  );
};
const CardContent = memo(CardContentImpl);
CardContent.displayName = 'CardContent';

export const AppCard: React.FC<AppCardProps> = ({
  variant = 'elevated',
  rounded = 14,
  padding = 16,
  shadowLevel = 1,
  divider = false,
  header,
  media,
  children,
  footer,
  style,
  contentStyle,
  onPress,
  disabled,
  haptics,
}) => {
  const theme = {
    surface: useThemeColor({}, 'surface'),
    background: useThemeColor({}, 'background'),
    border: useThemeColor({}, 'border'),
  } as const;
  const { bg, borderWidth, borderColor } = resolveCardStyles(theme, variant);

  const containerStyle = useMemo(
    () => [{ backgroundColor: bg }, style] as StyleProp<ViewStyle>,
    [bg, style],
  );

  const containerCommonProps = {
    rounded,
    shadow: variant === 'elevated',
    shadowLevel: variant === 'elevated' ? shadowLevel : undefined,
    borderWidth,
    borderColor,
    style: containerStyle,
  } as const;

  const Container = onPress ? AppPressableView : AppView;
  const pressProps = onPress
    ? {
        androidRipple: true,
        pressedOpacity: 0.96,
        onPress: () => {
          if (!disabled) {
            if (haptics) triggerHaptic(haptics);
            onPress?.();
          }
        },
        disabled,
      }
    : {};

  return (
    <Container {...(containerCommonProps as any)} {...(pressProps as any)}>
      <CardContent
        rounded={rounded}
        padding={padding}
        divider={divider}
        header={header}
        media={media}
        footer={footer}
        contentStyle={contentStyle}
      >
        {children}
      </CardContent>
    </Container>
  );
};

AppCard.displayName = 'AppCard';

export default AppCard;
