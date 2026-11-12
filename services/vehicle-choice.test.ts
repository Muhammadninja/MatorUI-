import { describe, expect, test } from 'vitest';

import { filterChoices, normalizeChoiceQuery } from './vehicle-choice-search';
import { VehicleRequestsUnavailableError, vehicleRequests } from './vehicle-requests';

describe('vehicle choice search', () => {
  const choices = [
    { value: 'lacetti', label: 'Lacetti' },
    { value: 'tracker-2', label: 'Tracker 2' },
    { value: 'citroen', label: 'Citroën' },
  ];
  test('ignores case, accents, spaces and dashes', () => {
    expect(normalizeChoiceQuery(' Trac-ker 2 ')).toBe('tracker2');
    expect(filterChoices(choices, 'LAC').map((c) => c.value)).toEqual(['lacetti']);
    expect(filterChoices(choices, 'tracker2').map((c) => c.value)).toEqual(['tracker-2']);
    expect(filterChoices(choices, 'citroen').map((c) => c.value)).toEqual(['citroen']);
  });
  test('an empty query keeps every choice', () => {
    expect(filterChoices(choices, '  ')).toHaveLength(3);
  });
});

describe('missing-vehicle requests', () => {
  test('are not available yet, and sending one fails rather than pretending', async () => {
    expect(vehicleRequests.available).toBe(false);
    await expect(vehicleRequests.send({ make: 'Haval', model: 'Jolion' })).rejects.toBeInstanceOf(
      VehicleRequestsUnavailableError,
    );
  });
});
