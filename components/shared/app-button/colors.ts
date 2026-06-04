import type { ThemeTokens } from '@/themes/types';
import type { ButtonKind } from './app-button';

export function kindTint(tokens: ThemeTokens, kind: ButtonKind) {
  const C = tokens as any;
  switch (kind) {
    case 'primary':
      return C.primary;
    case 'secondary':
      return C.secondary;
    case 'success':
      return C.success;
    case 'error':
      return C.error;
    case 'info':
      return C.info;
    case 'warning':
      return C.warning;
    case 'text':
      return C.text;
    case 'brand':
      return C.brand;
    default:
      return C.primary;
  }
}

export function solidDefaults(tokens: ThemeTokens, kind: ButtonKind) {
  const C = tokens as any;
  if (kind === 'primary') return { bg: C.primaryBg, fg: C.onPrimary, pressed: C.primaryPressed };
  if (kind === 'secondary')
    return { bg: C.secondaryBg, fg: C.onSecondary, pressed: C.secondaryPressed };
  if (kind === 'brand') return { bg: C.brandBg, fg: C.onBrand, pressed: C.brandPressed };
  const pressedToken =
    kind === 'success'
      ? C.successPressed
      : kind === 'error'
        ? C.errorPressed
        : kind === 'info'
          ? C.infoPressed
          : kind === 'warning'
            ? C.warningPressed
            : kind === 'text'
              ? C.textPressed
              : undefined;
  return {
    bg: kindTint(tokens, kind),
    fg: tokens.white,
    pressed: pressedToken as string | undefined,
  };
}
