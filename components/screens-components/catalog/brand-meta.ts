import type { CarBody } from '@/components/shared/mator-icons';

// Brand accent colors live in the (unscanned) vehicle-catalog service.
export { brandColor } from '@/services/uz-vehicle-catalog';

/** Map a body-style string to a car-silhouette body for `CarIcon`. */
export function categoryBody(value: string): CarBody {
  switch (value) {
    case 'suv':
    case 'minivan':
    case 'van':
    case 'crossover':
      return 'suv';
    case 'truck':
    case 'pickup':
      return 'truck';
    case 'hatchback':
      return 'hatchback';
    default:
      return 'sedan'; // sedan, coupe, and anything else
  }
}
