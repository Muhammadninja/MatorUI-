/**
 * "Не нашли автомобиль?" — asking for a make or model the catalog lacks.
 *
 * The backend has no endpoint for this yet (checked 2026-11-12: nothing under
 * /v1/reference or /v1/garage accepts one). Until it does, the app offers the
 * VIN route instead and sends nothing: no request is pretended, no vehicle is
 * saved under a made-up id. When the endpoint lands, implement `send` against it
 * and flip `available`; the sheet already reads both.
 */

export type MissingVehicleRequest = {
  /** The make as the buyer typed it, or the catalog's id when the make exists. */
  make: string;
  makeId?: string | null;
  model: string;
  year?: number | null;
};

export class VehicleRequestsUnavailableError extends Error {
  constructor() {
    super('VEHICLE_REQUESTS_UNAVAILABLE');
    this.name = 'VehicleRequestsUnavailableError';
  }
}

export const vehicleRequests = {
  /** Whether a request can be sent at all. */
  available: false,
  async send(_request: MissingVehicleRequest): Promise<void> {
    throw new VehicleRequestsUnavailableError();
  },
};
