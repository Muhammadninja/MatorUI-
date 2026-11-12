const DEFAULT_MODEL = 'gpt-image-2.6-sunburst';
const API_URL = 'https://api.openai.com/v1/images';

export function buildVehicleImagePrompt(vehicle) {
  const facts = [
    `Manufacturer: ${vehicle.manufacturer}`,
    `Model: ${vehicle.model}`,
    `Model year: ${vehicle.year}`,
    vehicle.generation && `Generation: ${vehicle.generation}`,
    vehicle.facelift && `Facelift: ${vehicle.facelift}`,
    vehicle.bodyStyle && `Body style: ${vehicle.bodyStyle}`,
    vehicle.trim && `Trim: ${vehicle.trim}`,
  ].filter(Boolean);
  return [
    'Create a photorealistic catalog cutout of this exact production vehicle. Use only the vehicle identity facts listed below; do not invent or infer generation, facelift, body style, trim, or visual specifications that are absent. If the identity cannot be represented confidently from these facts and supplied reference images, return no image and explain that manual identity review is required.',
    ...facts,
    'Show the entire vehicle in a consistent front three-quarter view, centered with even scale and generous transparent margin. Transparent background only. No scenery, floor, cast shadow, text, labels, watermark, people, or extra objects. Keep wheels, bumpers, mirrors, roof, and all body edges fully inside the frame.',
  ].join('\n');
}

/** Provider contract: generate({ vehicle, referenceImages, signal }) -> { bytes, contentType }. */
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

  async generate({ vehicle, referenceImages = [], signal }) {
    const prompt = buildVehicleImagePrompt(vehicle);
    const hasReferences = referenceImages.length > 0;
    const endpoint = hasReferences ? `${API_URL}/edits` : `${API_URL}/generations`;
    const options = {
      model: this.model,
      prompt,
      size: '1216x608',
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
      for (const [index, reference] of referenceImages.entries()) {
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
    let response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: combinedSignal,
      });
    } catch (error) {
      if (combinedSignal.aborted) throw new Error('image provider request timed out');
      throw new Error('image provider request failed');
    }
    if (!response.ok) throw new Error(`image provider returned HTTP ${response.status}`);
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('image provider returned invalid JSON');
    }
    const encoded = payload?.data?.[0]?.b64_json;
    if (typeof encoded !== 'string' || encoded.length === 0)
      throw new Error('image provider returned no image');
    return {
      bytes: Buffer.from(encoded, 'base64'),
      contentType: 'image/webp',
      provider: 'openai',
      model: this.model,
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
