/**
 * VIN Decoder Service
 * ───────────────────────────────────────────────────────────────────────────
 * Production-grade, provider-agnostic decoder that turns a raw 17-character
 * Vehicle Identification Number into a clean, catalog-ready `DecodedVehicle`.
 *
 * Design:
 *   - **Decoupled fetch engine.** The network call lives behind a
 *     `VinDecodeTransport` interface. The default is NHTSA's public vPIC
 *     infrastructure (`NhtsaVinDecodeTransport`), but any provider (or a
 *     mock in tests) can be injected without touching the decode logic.
 *   - **Reuses the repo's validation.** Sanitization + the ISO 3779 check
 *     digit already live in `@/utils/vin` (used by the scanner). We compose
 *     them here instead of duplicating the transliteration table.
 *   - **Typed domain errors.** Every failure mode surfaces as a
 *     `VinDecodeError` with a discriminable `code` — the HTTP layer decides
 *     the status; the service never lets a provider outage crash the caller.
 *   - **Stateless + reusable.** `VinDecoderService.decode(vin)` is a static
 *     facade over a shared instance, so any API route / catalog job can call
 *     it without re-instantiation. Construct your own instance only when you
 *     need a different transport, timeout, or checksum policy.
 *
 * Runtime: only `fetch`, `AbortController`, and `setTimeout` are used — all
 * global in Node 18+, Next.js route handlers, and React Native / Expo.
 */

import { isVinChecksumValid, isVinShapeValid, normalizeVin } from '@/utils/vin';

// ── Public return contract ───────────────────────────────────────────────────

/**
 * Unified, provider-independent vehicle record. `make`/`model` are always
 * present strings (empty when the provider couldn't resolve them); the
 * optional spec fields are `null` when unknown. `isVerified` is the single
 * boolean a catalog pipeline can trust to auto-publish a listing.
 */
export interface DecodedVehicle {
  make: string;
  model: string;
  year: number;
  engineDisplacement: string | null;
  fuelType: string | null;
  isVerified: boolean;
  /** The normalized 17-char VIN this record was decoded from (traceability). */
  vin: string;
}

// ── Domain errors ────────────────────────────────────────────────────────────

export type VinDecodeErrorCode =
  | 'INVALID_LENGTH' //     not exactly 17 chars after sanitization
  | 'INVALID_CHARACTERS' // contains I / O / Q or other illegal symbols
  | 'CHECKSUM_FAILED' //    ISO 3779 check digit mismatch (strict mode only)
  | 'NOT_FOUND' //          provider returned zero records for the VIN
  | 'PROVIDER_ERROR' //     provider returned a non-2xx / malformed payload
  | 'NETWORK_ERROR' //      DNS / connect / transport failure
  | 'TIMEOUT'; //           request exceeded the configured budget

/** Single error type for the whole decode surface — always safe to `throw`. */
export class VinDecodeError extends Error {
  constructor(
    public readonly code: VinDecodeErrorCode,
    message: string,
    public readonly vin?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'VinDecodeError';
  }

  /** True when retrying the exact request could plausibly succeed. */
  get isTransient(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.code === 'PROVIDER_ERROR';
  }

  /** True when the input itself is the problem (no point retrying). */
  get isClientError(): boolean {
    return (
      this.code === 'INVALID_LENGTH' ||
      this.code === 'INVALID_CHARACTERS' ||
      this.code === 'CHECKSUM_FAILED'
    );
  }
}

/**
 * Non-throwing result shape for endpoints / batch jobs that prefer a
 * discriminated union over try/catch.
 */
export type VinDecodeResult =
  | { ok: true; data: DecodedVehicle }
  | { ok: false; error: { code: VinDecodeErrorCode; message: string; vin?: string } };

// ── Transport (swappable fetch engine) ───────────────────────────────────────

/**
 * The subset of raw provider fields the mapper consumes. Kept loose
 * (all optional / nullable) so a provider swap only touches the transport,
 * never the `DecodedVehicle` contract.
 */
export interface RawVinRecord {
  Make?: string | null;
  Model?: string | null;
  ModelYear?: string | null;
  DisplacementL?: string | null;
  FuelTypePrimary?: string | null;
  ErrorCode?: string | null;
  ErrorText?: string | null;
}

/** Contract every VIN provider adapter must satisfy. */
export interface VinDecodeTransport {
  /**
   * Fetch the raw record for an already-sanitized 17-char VIN. Implementations
   * MUST honor `signal` (abort → the service maps it to a `TIMEOUT`) and SHOULD
   * throw `VinDecodeError` for provider-shaped failures.
   */
  fetchRaw(vin: string, signal: AbortSignal): Promise<RawVinRecord>;
}

type NhtsaResponse = {
  Count: number;
  Message: string;
  Results: RawVinRecord[];
};

/**
 * Default provider — NHTSA vPIC `DecodeVinValues` (flat, one-row result).
 * Public, keyless, and globally available: https://vpic.nhtsa.dot.gov/api.
 */
export class NhtsaVinDecodeTransport implements VinDecodeTransport {
  constructor(
    private readonly baseUrl: string = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues',
  ) {}

  async fetchRaw(vin: string, signal: AbortSignal): Promise<RawVinRecord> {
    const url = `${this.baseUrl}/${encodeURIComponent(vin)}?format=json`;

    let response: Response;
    try {
      response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    } catch (err) {
      // `fetch` rejects for both aborts (timeout) and true network failures.
      if (isAbortError(err)) {
        throw new VinDecodeError('TIMEOUT', 'VIN provider request was aborted.', vin, err);
      }
      throw new VinDecodeError('NETWORK_ERROR', 'Could not reach the VIN provider.', vin, err);
    }

    if (!response.ok) {
      throw new VinDecodeError(
        'PROVIDER_ERROR',
        `VIN provider responded with HTTP ${response.status}.`,
        vin,
      );
    }

    let body: NhtsaResponse;
    try {
      body = (await response.json()) as NhtsaResponse;
    } catch (err) {
      throw new VinDecodeError('PROVIDER_ERROR', 'VIN provider returned malformed JSON.', vin, err);
    }

    const record = body?.Results?.[0];
    if (!record) {
      throw new VinDecodeError('NOT_FOUND', 'VIN provider returned no matching records.', vin);
    }
    return record;
  }
}

// ── Configuration ────────────────────────────────────────────────────────────

export interface VinDecoderConfig {
  /** Provider adapter. Defaults to `NhtsaVinDecodeTransport`. */
  transport?: VinDecodeTransport;
  /** Per-request budget in ms before the call is aborted. Default 10_000. */
  timeoutMs?: number;
  /**
   * When true, a failed ISO 3779 check digit rejects the VIN with
   * `CHECKSUM_FAILED`. Default false — many UZ-market Chevrolets ship
   * non-North-American check digits, matching the scanner's policy.
   */
  requireChecksum?: boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class VinDecoderService {
  private readonly transport: VinDecodeTransport;
  private readonly timeoutMs: number;
  private readonly requireChecksum: boolean;

  constructor(config: VinDecoderConfig = {}) {
    this.transport = config.transport ?? new NhtsaVinDecodeTransport();
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.requireChecksum = config.requireChecksum ?? false;
  }

  /**
   * Decode a single VIN. Sanitizes → validates → fetches → maps.
   * Throws a typed `VinDecodeError` on any failure. Prefer `decodeSafe`
   * inside API routes that shouldn't branch on try/catch.
   */
  async decode(rawVin: string): Promise<DecodedVehicle> {
    const vin = this.sanitizeAndValidate(rawVin);
    const record = await this.withTimeout((signal) => this.transport.fetchRaw(vin, signal), vin);
    return mapRecord(vin, record);
  }

  /** Never-throw variant — returns a discriminated union. */
  async decodeSafe(rawVin: string): Promise<VinDecodeResult> {
    try {
      return { ok: true, data: await this.decode(rawVin) };
    } catch (err) {
      const e =
        err instanceof VinDecodeError
          ? err
          : new VinDecodeError('PROVIDER_ERROR', 'Unexpected VIN decode failure.', undefined, err);
      return { ok: false, error: { code: e.code, message: e.message, vin: e.vin } };
    }
  }

  /**
   * Batch decode for automated catalog setup. Runs with a bounded worker
   * pool (default 5) so a large seed list doesn't stampede the provider,
   * and uses `decodeSafe` so one bad VIN never fails the whole batch. Result
   * order matches the input order.
   */
  async decodeMany(vins: readonly string[], concurrency = 5): Promise<VinDecodeResult[]> {
    if (vins.length === 0) return [];
    const results: VinDecodeResult[] = new Array(vins.length);
    const workers = Math.max(1, Math.min(concurrency, vins.length));
    let cursor = 0;

    const runWorker = async (): Promise<void> => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= vins.length) return;
        results[index] = await this.decodeSafe(vins[index]);
      }
    };

    await Promise.all(Array.from({ length: workers }, runWorker));
    return results;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** Trim/uppercase, enforce length + alphabet, optionally enforce checksum. */
  private sanitizeAndValidate(rawVin: string): string {
    const vin = normalizeVin(rawVin ?? '');

    if (vin.length !== 17) {
      throw new VinDecodeError(
        'INVALID_LENGTH',
        `A VIN must be exactly 17 characters; received ${vin.length}.`,
        vin,
      );
    }
    // `isVinShapeValid` enforces the ISO 3779 alphabet, which already excludes
    // I, O, and Q (the digit-lookalike letters).
    if (!isVinShapeValid(vin)) {
      throw new VinDecodeError(
        'INVALID_CHARACTERS',
        'VIN contains illegal characters — the letters I, O, and Q are not permitted.',
        vin,
      );
    }
    if (this.requireChecksum && !isVinChecksumValid(vin)) {
      throw new VinDecodeError(
        'CHECKSUM_FAILED',
        'VIN failed ISO 3779 check-digit (position 9) validation.',
        vin,
      );
    }
    return vin;
  }

  /** Run a signal-aware op under an abort-based timeout; normalize failures. */
  private async withTimeout<T>(op: (signal: AbortSignal) => Promise<T>, vin: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await op(controller.signal);
    } catch (err) {
      if (err instanceof VinDecodeError) throw err;
      if (isAbortError(err)) {
        throw new VinDecodeError('TIMEOUT', `VIN decode timed out after ${this.timeoutMs}ms.`, vin, err);
      }
      throw new VinDecodeError('NETWORK_ERROR', 'Unexpected error during VIN decode.', vin, err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Static facade over a lazily-created shared instance ──────────────────────

  private static sharedInstance: VinDecoderService | null = null;

  /** Swap the default engine/config app-wide (e.g. a mock in tests). */
  static configure(config: VinDecoderConfig): void {
    VinDecoderService.sharedInstance = new VinDecoderService(config);
  }

  /** The process-wide reusable instance. */
  static get shared(): VinDecoderService {
    if (!VinDecoderService.sharedInstance) {
      VinDecoderService.sharedInstance = new VinDecoderService();
    }
    return VinDecoderService.sharedInstance;
  }

  /** `VinDecoderService.decode(vin)` — the requested one-call entry point. */
  static decode(vin: string): Promise<DecodedVehicle> {
    return VinDecoderService.shared.decode(vin);
  }

  static decodeSafe(vin: string): Promise<VinDecodeResult> {
    return VinDecoderService.shared.decodeSafe(vin);
  }

  static decodeMany(vins: readonly string[], concurrency = 5): Promise<VinDecodeResult[]> {
    return VinDecoderService.shared.decodeMany(vins, concurrency);
  }
}

/** Ready-to-import singleton for functional call sites. */
export const vinDecoder = VinDecoderService.shared;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Map a raw provider record onto the clean `DecodedVehicle` contract. */
function mapRecord(vin: string, record: RawVinRecord): DecodedVehicle {
  // NHTSA reports a clean decode as ErrorCode "0" (or empty); anything else is
  // partial/failed and must not be trusted for auto-publishing.
  const errorCode = (record.ErrorCode ?? '').trim();
  const decodedCleanly = errorCode === '' || errorCode === '0';

  const make = cleanString(record.Make);
  const model = cleanString(record.Model);
  const year = parseYear(record.ModelYear);

  return {
    vin,
    make: make ?? '',
    model: model ?? '',
    year,
    engineDisplacement: cleanString(record.DisplacementL),
    fuelType: cleanString(record.FuelTypePrimary),
    isVerified: decodedCleanly && make !== null && model !== null && year > 0,
  };
}

function cleanString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseYear(value: string | null | undefined): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}
