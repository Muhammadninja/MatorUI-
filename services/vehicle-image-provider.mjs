const DEFAULT_MODEL = 'gpt-image-2.6-sunburst';
const API_URL = 'https://api.openai.com/v1/images';

function safeErrorCode(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : undefined;
}

function transportDiagnostics(error) {
  const cause = error?.cause;
  return {
    errorName: safeErrorCode(error?.name),
    errorCode: safeErrorCode(error?.code),
    errorErrno: Number.isInteger(error?.errno) ? error.errno : undefined,
    errorSyscall: safeErrorCode(error?.syscall),
    causeName: safeErrorCode(cause?.name),
    causeCode: safeErrorCode(cause?.code),
    causeErrno: Number.isInteger(cause?.errno) ? cause.errno : undefined,
    causeSyscall: safeErrorCode(cause?.syscall),
  };
}

export function buildVehicleImagePrompt(vehicle, { styleReference = false } = {}) {
  const facts = [
    `Manufacturer: ${vehicle.manufacturer}`,
    `Model: ${vehicle.model}`,
    `Model year: ${vehicle.year}`,
    vehicle.generation && `Generation: ${vehicle.generation}`,
    vehicle.facelift && `Facelift: ${vehicle.facelift}`,
    vehicle.bodyStyle && `Body style: ${vehicle.bodyStyle}`,
    vehicle.trim && `Trim: ${vehicle.trim}`,
    vehicle.marketRegion && `Market/region: ${vehicle.marketRegion}`,
    // One picture serves every owner of the model; the app labels other paints
    // "shown in white", so an unstated colour is white, like the approved set.
    `Exterior color: ${vehicle.exteriorColor || 'solid white, non-metallic'}`,
  ].filter(Boolean);
  return [
    // The style image is another car: it must set the look of the set, never the vehicle.
    styleReference &&
      'Image 1 is a STYLE REFERENCE showing a different car. Copy only its camera angle, framing, scale within the frame, lighting and transparent background. Do NOT copy its make, model, body shape, grille, lights, wheels or any design detail: the vehicle must be the one described by the facts below.',
    'Create a photorealistic catalog cutout as a provisional candidate for human review. Use only the vehicle identity facts listed below; do not invent or infer generation, facelift, body style, trim, market, or visual specifications that are absent. Match the stated market and do not substitute a visually similar vehicle from another market. If the identity is uncertain from these facts and supplied reference images, do not imply certainty; the candidate will require manual identity review.',
    ...facts,
    'Show the entire vehicle in a consistent front-left three-quarter view: the front of the car points toward the RIGHT side of the image and its left (driver\'s) side faces the viewer, never the mirror image. Center it with even scale and generous transparent margin. Transparent background only. No scenery, floor, cast shadow, text, labels, watermark, people, or extra objects. Keep wheels, bumpers, mirrors, roof, and all body edges fully inside the frame.',
    'License plates must be blank: an empty plate with no letters, numbers, model name or country code. No added lettering anywhere on the body, glass or bumpers (no model names, slogans, dealer badges or stickers); only the manufacturer emblem the real vehicle carries.',
  ].filter(Boolean).join('\n');
}

/** Provider contract: generate({ vehicle, referenceImages, styleReference, signal }) -> { bytes, contentType }.
 *  `styleReference` ({ bytes, contentType }) is sent first and only sets angle, framing and light. */
export class OpenAIImageProvider {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.VEHICLE_IMAGE_MODEL ?? DEFAULT_MODEL,
    fetchImpl = fetch,
    timeoutMs = 120_000,
  } = {}) {
    if (!apiKey) throw new Error('OPENAI_API_KEY is required');
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async generate({ vehicle, referenceImages = [], styleReference = null, signal }) {
    const prompt = buildVehicleImagePrompt(vehicle, { styleReference: Boolean(styleReference) });
    // The style image goes first, matching "Image 1" in the prompt.
    const images = styleReference ? [styleReference, ...referenceImages] : referenceImages;
    const hasReferences = images.length > 0;
    const endpoint = hasReferences ? `${API_URL}/edits` : `${API_URL}/generations`;
    const options = {
      model: this.model,
      prompt,
      // 1536x1024 is a documented standard size; the pipeline crops and normalizes locally.
      size: '1536x1024',
      quality: 'high',
      background: 'transparent',
      output_format: 'webp',
      output_compression: 90,
      n: 1,
    };
    let body;
    const headers = { authorization: `Bearer ${this.apiKey}` };
    if (hasReferences) {
      body = new FormData();
      for (const [key, value] of Object.entries(options)) body.append(key, String(value));
      for (const [index, reference] of images.entries()) {
        const ext =
          reference.contentType === 'image/jpeg'
            ? 'jpg'
            : reference.contentType === 'image/webp'
              ? 'webp'
              : 'png';
        const blob = new Blob([reference.bytes], { type: reference.contentType });
        body.append('image[]', blob, `vehicle-reference-${index + 1}.${ext}`);
      }
    } else {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options);
    }
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const startedAt = Date.now();
    let response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: combinedSignal,
      });
    } catch (error) {
      if (combinedSignal.aborted)
        throw Object.assign(new Error('image provider request timed out'), {
          providerLatencyMs: Date.now() - startedAt,
          transportDiagnostics: transportDiagnostics(error),
        });
      throw Object.assign(new Error('image provider request failed'), {
        providerLatencyMs: Date.now() - startedAt,
        transportDiagnostics: transportDiagnostics(error),
      });
    }
    const requestId = response.headers?.get?.('x-request-id') ?? undefined;
    if (!response.ok) {
      let providerErrorCode;
      try {
        const errorPayload = await response.json();
        const rawCode = errorPayload?.error?.code ?? errorPayload?.error?.type;
        if (typeof rawCode === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(rawCode))
          providerErrorCode = rawCode;
      } catch {
        // Do not retain or expose a raw provider error body.
      }
      throw Object.assign(new Error(`image provider returned HTTP ${response.status}`), {
        providerLatencyMs: Date.now() - startedAt,
        providerRequestId: requestId,
        providerHttpStatus: response.status,
        providerErrorCode,
      });
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw Object.assign(new Error('image provider returned invalid JSON'), {
        providerLatencyMs: Date.now() - startedAt,
        providerRequestId: requestId,
      });
    }
    const latencyMs = Date.now() - startedAt;
    const encoded = payload?.data?.[0]?.b64_json;
    if (typeof encoded !== 'string' || encoded.length === 0)
      throw new Error('image provider returned no image');
    const usage = payload?.usage ?? null;
    const inputDetails = usage?.input_tokens_details ?? {};
    const imageInputTokens = Number(inputDetails.image_tokens ?? 0);
    const textInputTokens = Number(inputDetails.text_tokens ?? usage?.input_tokens ?? 0);
    const outputTokens = Number(
      usage?.output_tokens_details?.image_tokens ?? usage?.output_tokens ?? 0,
    );
    const rates = this.model.startsWith('gpt-image-2.6-')
      ? { text: 5, imageInput: 8, imageOutput: 30 }
      : null;
    return {
      bytes: Buffer.from(encoded, 'base64'),
      contentType: 'image/webp',
      provider: 'openai',
      model: this.model,
      providerLatencyMs: latencyMs,
      providerRequestId: requestId,
      providerUsage: usage,
      estimatedCostUsd: rates
        ? (textInputTokens * rates.text +
            imageInputTokens * rates.imageInput +
            outputTokens * rates.imageOutput) /
          1_000_000
        : null,
    };
  }
}

export function createImageProvider({
  provider = process.env.VEHICLE_IMAGE_PROVIDER ?? 'openai',
  ...options
} = {}) {
  if (provider === 'openai') return new OpenAIImageProvider(options);
  throw new Error(`unsupported vehicle image provider: ${provider}`);
}
