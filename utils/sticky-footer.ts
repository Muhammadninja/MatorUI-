/**
 * Space under a sticky bottom action bar: the checkout's "place order" and
 * Item Detail's like / share / add to cart. On Android edge-to-edge the
 * bottom inset is exactly the system navigation bar (gesture pill or the three
 * buttons), so padding by the inset alone left the button flush against it.
 * Android gets a gap on top of the inset; iOS keeps the home-indicator inset.
 */
export function checkoutFooterBottom(insetBottom: number, os: string): number {
  return os === 'android' ? Math.max(insetBottom, 0) + 16 : Math.max(insetBottom, 20);
}
