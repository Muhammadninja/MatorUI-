# AppText

Theme-aware text primitive with semantic variants and configurable defaults.

## Why

- Consistent typography via theme variants
- Theme-driven color with light/dark overrides
- Lightweight provider to set app/screen defaults

## Usage

Basic:

```tsx
<AppText>Body text</AppText>
```

With variant and weight:

```tsx
<AppText textVariant="title" weight="semibold">
  Title
</AppText>
```

Override color or use token:

```tsx
<AppText colorName="muted">Muted token</AppText>
<AppText lightColor="#000" darkColor="#fff">Explicit per-scheme</AppText>
```

Provider defaults:

```tsx
import { AppTextProvider } from '@/components/shared/app-text';

<AppTextProvider value={{ textVariant: 'body', colorName: 'text', mutedOpacity: 0.65 }}>
  <AppText>Inside provider</AppText>
</AppTextProvider>;
```

## Defaults and precedence

- Precedence: props > provider defaults > tokens
- Tokens (`components/shared/app-text/tokens.ts`):
  - `colorName`: `text`
  - `textVariant`: `body`
  - `mutedOpacity`: `0.7`

## Files

- `app-text.tsx`: Component implementation, resolves theme tokens and weights.
- `text-defaults.context.tsx`: Provider to set default text props for a subtree.
- `tokens.ts`: Token defaults for variant and muted opacity.
- `index.ts`: Barrel exports for ergonomic imports.

## Notes

- `getTextStyle(variant, family?)` and `getWeightStyle(weight)` come from theme.
- `useThemeColor({ light, dark }, token)` resolves per-scheme color with token fallback.
