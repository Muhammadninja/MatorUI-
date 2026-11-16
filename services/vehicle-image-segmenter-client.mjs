import http from 'node:http';
import { stat } from 'node:fs/promises';

const MAX_BYTES = 8 * 1024 * 1024;

function request(socketPath, path, { method = 'GET', bytes, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath, path, method, timeout: timeoutMs,
      headers: bytes ? { 'content-type': 'application/octet-stream', 'content-length': bytes.length } : {} }, (res) => {
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_BYTES * 2) {
          req.destroy(new Error('segmentation response exceeds size limit'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 502,
        contentType: String(res.headers['content-type'] ?? ''), bytes: Buffer.concat(chunks) }));
    });
    req.on('timeout', () => req.destroy(new Error('segmentation service timed out')));
    req.on('error', () => reject(Object.assign(new Error('segmentation service unavailable'), { retryable: true })));
    if (bytes) req.write(bytes);
    req.end();
  });
}

/** Private Unix socket client: the API is never exposed on the public network. */
export function createVehicleImageSegmenter({ socketPath = process.env.VEHICLE_IMAGE_SEGMENTER_SOCKET,
  timeoutMs = 120_000 } = {}) {
  if (typeof socketPath !== 'string' || !socketPath.startsWith('/'))
    throw new Error('vehicle image segmenter socket path is required');
  return {
    async ready() {
      try {
        await stat(socketPath);
        const response = await request(socketPath, '/health/ready', { timeoutMs: 2_000 });
        return response.status === 200 && response.contentType.includes('application/json');
      } catch { return false; }
    },
    async removeBackground(bytes) {
      if (!Buffer.isBuffer(bytes) || bytes.length < 32 || bytes.length > MAX_BYTES)
        throw Object.assign(new Error('source photo is invalid or too large for segmentation'), { retryable: false });
      const response = await request(socketPath, '/segment', { method: 'POST', bytes, timeoutMs });
      if (response.status === 429 || response.status >= 500)
        throw Object.assign(new Error('background segmentation failed transiently'), { retryable: true });
      if (response.status !== 200 || response.contentType !== 'image/png')
        throw Object.assign(new Error('background segmentation rejected the source image'), { retryable: false });
      return response.bytes;
    },
  };
}
