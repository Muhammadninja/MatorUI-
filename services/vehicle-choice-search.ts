/** One answer in the add-vehicle lists: a make, a model or a year. */
export type VehicleChoice = {
  value: string;
  label: string;
  /** A brand's logo, when the catalog has one. */
  logoUrl?: string | null;
};

/** Case, accents, spaces and dashes don't matter: "lacetti", "LACETTI", "Lac etti". */
export function normalizeChoiceQuery(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '');
}

/** The choices whose label contains the query; all of them for an empty query. */
export function filterChoices(choices: VehicleChoice[], query: string): VehicleChoice[] {
  const q = normalizeChoiceQuery(query);
  if (!q) return choices;
  return choices.filter((c) => normalizeChoiceQuery(c.label).includes(q));
}
