/**
 * The search row's typeface: Figtree — the same face the rest of the app is
 * now set in (see `themes/index.ts`). This module predates that: the row was
 * the first surface to move off Inter, because results should read as a feed
 * rather than as interface chrome, and Figtree is the closest face in the
 * bundle to the geometric sans the social apps use (Instagram Sans is
 * geometric, round-bowled, tall x-height, tight tracking — and proprietary).
 * The app has since followed the row.
 *
 * It still exists as its own module because the row names faces explicitly
 * rather than selecting them with `fontWeight`: a custom family on Android
 * resolves ONE file per family name, so a `fontWeight: '700'` on top of
 * `Figtree_400Regular` is silently ignored there and renders bold only on
 * iOS, which is how a layout ends up looking different per platform. Loading
 * happens once in `app/_layout.tsx`.
 */
export const SEARCH_FONT = {
  /** Supporting copy — delivery, status, review counts. */
  regular: 'Figtree_400Regular',
  /** Product titles. */
  medium: 'Figtree_500Medium',
  /** Labels that need a little weight without shouting. */
  semibold: 'Figtree_600SemiBold',
  /** The price, and the signal tag. */
  bold: 'Figtree_700Bold',
} as const;
