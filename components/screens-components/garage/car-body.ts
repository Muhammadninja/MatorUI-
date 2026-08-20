import type { CarBody } from '@/components/shared/mator-icons';
import { UZ_MODELS } from '@/services/uz-vehicle-catalog';
import type { Vehicle } from '@/services/garage-service';

/**
 * Resolve a car-body silhouette key for a garage vehicle.
 *
 * Prefers the catalog `bodyStyle` (via `modelId`) when the vehicle was
 * created through the UZ picker; otherwise falls back to a keyword match
 * on the free-text model name, then to `sedan`. The four silhouettes the
 * `CarIcon` supports are a superset target — richer catalog styles
 * (wagon/coupe/van…) collapse onto the nearest available shape.
 */
export function carBodyForVehicle(vehicle: Pick<Vehicle, 'modelId' | 'model'>): CarBody {
  if (vehicle.modelId) {
    const model = UZ_MODELS.find((m) => m.id === vehicle.modelId);
    if (model) return collapseBodyStyle(model.bodyStyle);
  }
  return guessFromName(vehicle.model);
}

function collapseBodyStyle(style: string): CarBody {
  switch (style) {
    case 'suv':
    case 'van':
    case 'minivan':
      return 'suv';
    case 'truck':
      return 'truck';
    case 'hatchback':
    case 'wagon':
      return 'hatchback';
    default:
      return 'sedan'; // sedan, coupe, anything unmapped
  }
}

const SUV_HINTS = ['tracker', 'captiva', 'tahoe', 'equinox', 'santa', 'tucson', 'sportage', 'sorento', 'kodiaq', 'tiguan', 'suv', 'x5', 'rav'];
const HATCH_HINTS = ['spark', 'matiz', 'i10', 'i20', 'picanto', 'rio hatch', 'polo', 'hatch'];
const TRUCK_HINTS = ['labo', 'damas truck', 'pickup', 'truck', 'hilux', 'l200'];

function guessFromName(name: string | undefined): CarBody {
  const n = (name ?? '').toLowerCase();
  if (TRUCK_HINTS.some((h) => n.includes(h))) return 'truck';
  if (SUV_HINTS.some((h) => n.includes(h))) return 'suv';
  if (HATCH_HINTS.some((h) => n.includes(h))) return 'hatchback';
  return 'sedan';
}
