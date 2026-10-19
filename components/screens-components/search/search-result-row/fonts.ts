/**
 * The search row's own typeface: Figtree.
 *
 * The rest of the app is set in Inter — a neo-grotesque that reads as
 * "interface". Results are the one surface that should read as a feed, so they
 * use the closest thing in the bundle to the geometric sans the social apps
 * use (Instagram Sans is geometric, round-bowled, with a tall x-height and
 * tight tracking): Figtree matches that skeleton almost exactly, and ships in
 * the weights the row needs.
 *
 * Faces are named explicitly rather than selected with `fontWeight`, because a
 * custom family on Android resolves ONE file per family name — a `fontWeight:
 * '700'` on top of `Figtree_400Regular` is silently ignored there and renders
 * bold only on iOS, which is how a layout ends up looking different per
 * platform. Loading happens once in `app/_layout.tsx`.
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
