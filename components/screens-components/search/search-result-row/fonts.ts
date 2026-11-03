/**
 * The search row's typeface: Inter, the same face the rest of the app is set in
 * (see `themes/index.ts`).
 *
 * It exists as its own module because the row names faces explicitly rather than
 * selecting them with `fontWeight`: a custom family on Android resolves ONE file
 * per family name, so a `fontWeight: '700'` on top of `Inter_400Regular` is
 * silently ignored there and renders bold only on iOS, which is how a layout
 * ends up looking different per platform. Loading happens once in
 * `app/_layout.tsx`.
 */
export const SEARCH_FONT = {
  /** Supporting copy — delivery, status, review counts. */
  regular: 'Inter_400Regular',
  /** Product titles. */
  medium: 'Inter_500Medium',
  /** Labels that need a little weight without shouting. */
  semibold: 'Inter_600SemiBold',
  /** The price, and the signal tag. */
  bold: 'Inter_700Bold',
} as const;
