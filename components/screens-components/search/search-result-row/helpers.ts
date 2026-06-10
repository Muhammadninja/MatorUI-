/** Pure non-component helpers shared by the result-row sub-components. */

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function isLowStock(status: string): boolean {
  return /low\s*stock|limited/i.test(status);
}

export function statusColor(
  status: string,
  tokens: { error: string; secondary: string; gray400: string },
): string {
  if (isLowStock(status)) return tokens.error;
  if (/pre-?order|coming/i.test(status)) return tokens.secondary;
  return tokens.gray400;
}

export function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
