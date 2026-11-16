import { createHash } from 'node:crypto';

const API = 'https://commons.wikimedia.org/w/api.php';
const ALLOWED_HOST = 'upload.wikimedia.org';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_METADATA_BYTES = 2 * 1024 * 1024;
const LICENSES = new Map([
  ['https://creativecommons.org/publicdomain/zero/1.0/', 'CC0-1.0'],
  ...['2.0', '2.5', '3.0', '4.0'].flatMap((v) => [
    [`https://creativecommons.org/licenses/by/${v}/`, `CC-BY-${v}`],
    [`https://creativecommons.org/licenses/by-sa/${v}/`, `CC-BY-SA-${v}`],
  ]),
]);

function text(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ').trim();
}

function licenseFor(meta = {}) {
  const url = text(meta.LicenseUrl?.value ?? meta.LicenseUrl);
  let normalized;
  try {
    const parsed = new URL(url);
    if (!['creativecommons.org', 'www.creativecommons.org'].includes(parsed.hostname.toLowerCase())) return null;
    let pathname = parsed.pathname.replace(/\/$/, '');
    pathname = pathname.replace(/\/deed\.en$/, '');
    if (!pathname.endsWith('/')) pathname += '/';
    normalized = `https://creativecommons.org${pathname}`;
  } catch { return null; }
  const key = [...LICENSES.keys()].find((known) => normalized.toLowerCase() === known.toLowerCase());
  return key ? { url: key, id: LICENSES.get(key), name: text(meta.LicenseShortName?.value ?? meta.LicenseShortName) } : null;
}

function relevant(title, meta, identity) {
  const haystack = `${title} ${text(meta.ImageDescription?.value)} ${text(meta.Categories?.value)}`.toLocaleLowerCase();
  const model = String(identity.model ?? '').trim().toLocaleLowerCase();
  const make = String(identity.manufacturer ?? identity.make ?? '').trim().toLocaleLowerCase();
  return Boolean(model && haystack.includes(model) && (!make || haystack.includes(make)));
}

export function createWikimediaCommonsProvider({
  fetchImpl = fetch, userAgent = 'MatorVehicleImagePipeline/1.0 (vehicle image review)',
  now = () => Date.now(), minRequestIntervalMs = 6500, cacheTtlMs = 6 * 60 * 60 * 1000, maxCandidates = 3,
} = {}) {
  if (!userAgent || userAgent.length > 200 || /[\r\n]/.test(userAgent)) throw new Error('Wikimedia User-Agent is invalid');
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 3) throw new Error('Wikimedia candidate limit must be 1-3');
  const cache = new Map();
  let nextRequest = 0;
  let inFlight = Promise.resolve();
  const get = async (url, signal) => {
    const task = inFlight.then(async () => {
      const wait = Math.max(0, nextRequest - now());
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      nextRequest = now() + minRequestIntervalMs;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let response;
        try { response = await fetchImpl(url, { signal, redirect: 'error', headers: { 'User-Agent': userAgent, Accept: 'application/json,image/*' } }); }
        catch (error) {
          if (signal?.aborted || attempt === 2) throw Object.assign(new Error('Wikimedia network request failed'), { retryable: !signal?.aborted });
          const delay = Math.max(minRequestIntervalMs, 300 * (2 ** attempt));
          nextRequest = now() + delay;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        if (response.status === 429 || response.status >= 500) {
          if (attempt === 2) throw Object.assign(new Error('Wikimedia is temporarily unavailable'), { retryable: true });
          const retryAfter = Number(response.headers?.get?.('retry-after')) * 1000;
          const delay = Math.max(minRequestIntervalMs, Number.isFinite(retryAfter) ? retryAfter : 0, 500 * (2 ** attempt));
          nextRequest = now() + delay;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        if (!response.ok) throw Object.assign(new Error('Wikimedia rejected the request'), { retryable: false });
        return response;
      }
    });
    inFlight = task.catch(() => {});
    return task;
  };
  return {
    id: 'wikimedia-commons', kind: 'external-catalog', cost: 'free', autoPublish: false,
    async acquire({ identity, vehicle, subjectKey, signal }) {
      const make = identity.manufacturer ?? identity.make ?? vehicle?.manufacturer ?? vehicle?.make;
      const model = identity.model ?? vehicle?.model;
      if (!make || !model) return [];
      const query = [make, model, identity.generation ?? vehicle?.generation,
        identity.marketRegion ?? vehicle?.marketRegion, identity.modelYear ?? vehicle?.year].filter(Boolean).join(' ');
      const cacheKey = `${subjectKey ?? ''}:${query}`;
      const cached = cache.get(cacheKey);
      if (cached && cached.expires > now()) return cached.value;
      const results = [];
      const queries = [query, `${make} ${model}`];
      for (const searchQuery of [...new Set(queries)]) {
        const search = new URL(API);
        for (const [key, value] of Object.entries({ action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrsearch: `filetype:bitmap ${searchQuery}`, gsrnamespace: '6', gsrlimit: '8', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata' })) search.searchParams.set(key, value);
        const response = await get(search, signal);
        let payload;
        try {
          const raw = await readBounded(response, MAX_METADATA_BYTES);
          payload = JSON.parse(raw.toString('utf8'));
        } catch { throw Object.assign(new Error('Wikimedia returned invalid or oversized metadata'), { retryable: false }); }
        const pages = payload?.query?.pages ?? [];
        for (const page of pages) {
        const info = page.imageinfo?.[0];
        const meta = info?.extmetadata ?? {};
        const license = licenseFor(meta);
        if (!info || !license || !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime) ||
            !Number.isInteger(info.width) || !Number.isInteger(info.height) || info.width < 512 || info.height < 256 ||
            !relevant(page.title, meta, { ...identity, manufacturer: make, model })) continue;
        const sourceUrl = new URL(info.url);
        if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== ALLOWED_HOST) continue;
        const sourcePage = `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_')).replaceAll('%3A', ':')}`;
        const author = text(meta.Artist?.value ?? meta.Artist ?? meta.Attribution?.value ?? meta.Attribution);
        const evidence = text(meta.License?.value ?? meta.License ?? meta.UsageTerms?.value ?? meta.UsageTerms);
        if (!author || !evidence) continue;
        const imageResponse = await get(sourceUrl, signal);
        const declared = Number(imageResponse.headers?.get?.('content-length'));
        if (Number.isFinite(declared) && declared > MAX_BYTES) continue;
        let bytes;
        try { bytes = await readBounded(imageResponse, MAX_BYTES); } catch { continue; }
        if (!bytes.length) continue;
        results.push({
          bytes, contentType: info.mime,
          source: {
            provider: 'wikimedia-commons', kind: 'licensed-photo', license: license.id,
            licenseName: license.name, licenseUrl: license.url, author, attribution: author,
            title: text(page.title), modifications: 'Resized and converted to WebP',
            sourceUrl: info.url, sourcePage, licenseEvidence: evidence,
            width: info.width, height: info.height, sourceFingerprint: createHash('sha256').update(bytes).digest('hex'),
            provenance: { provider: 'wikimedia-commons', sourceUrl: info.url, sourcePage,
              author, attribution: author, title: text(page.title), modifications: 'Resized and converted to WebP',
              license: license.id, licenseUrl: license.url, licenseEvidence: evidence },
            basis: 'commons-model-text-match', confidence: 'manual-identity-review-required',
          },
        });
        if (results.length >= maxCandidates) break;
        }
        if (results.length) break;
      }
      cache.set(cacheKey, { value: results, expires: now() + cacheTtlMs });
      return results;
    },
  };
}

async function readBounded(response, limit) {
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error('response exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  }
  const array = await response.arrayBuffer();
  if (!array.byteLength || array.byteLength > limit) throw new Error('response exceeds size limit');
  return Buffer.from(array);
}

export const WIKIMEDIA_COMMERCIAL_LICENSES = Object.freeze([...LICENSES.values()]);
