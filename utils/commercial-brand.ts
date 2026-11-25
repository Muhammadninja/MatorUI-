/** Verified short commercial names for customer-facing attribution. */
export function commercialBrandName(brand?: string | null): string | undefined {
  const name = brand?.trim();
  if (!name) return undefined;
  return name.toLocaleUpperCase().startsWith('BOSCH') ? 'BOSCH' : name;
}
