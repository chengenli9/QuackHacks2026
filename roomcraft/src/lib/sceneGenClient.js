import { DEFAULT_API_BASE_URL } from './apiClient.js';

export const DEFAULT_SCENEGEN_BASE_URL = 'https://scenegen-gpu.tail948ef9.ts.net';

// Generous timeouts: the GPU pipeline (segmentation + SceneGen + texturing)
// can run for several minutes per request.
const SUBMIT_TIMEOUT_MS = 600000;
const STATUS_TIMEOUT_MS = 60000;
const DOWNLOAD_TIMEOUT_MS = 1200000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const JPEG_CONVERSION_TIMEOUT_MS = 120000;
const SCENEGEN_NATIVE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SCENEGEN_NATIVE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function configuredSceneGenBaseUrl() {
  return import.meta.env.VITE_SCENEGEN_API_BASE_URL || DEFAULT_SCENEGEN_BASE_URL;
}

function endpoint(baseUrl, path) {
  return `${baseUrl.trim().replace(/\/+$/, '')}${path}`;
}

export function sceneGenGlbUrl({ baseUrl = configuredSceneGenBaseUrl(), jobId }) {
  return endpoint(baseUrl, `/v1/jobs/${encodeURIComponent(jobId)}/scene.glb`);
}

function conversionEndpoint(baseUrl) {
  return `${baseUrl.trim().replace(/\/+$/, '')}/api/convert-image/jpeg`;
}

export function sceneGenUploadNeedsJpegConversion(file) {
  const type = String(file?.type ?? '').toLowerCase();
  const extension = String(file?.name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (SCENEGEN_NATIVE_IMAGE_TYPES.has(type) || SCENEGEN_NATIVE_IMAGE_EXTENSIONS.has(extension)) {
    return false;
  }
  return type.startsWith('image/') || Boolean(extension);
}

export async function convertImageForSceneGenUpload(
  image,
  {
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = JPEG_CONVERSION_TIMEOUT_MS,
  } = {}
) {
  if (!image) throw new Error('An image file is required to start a SceneGen job.');
  if (!sceneGenUploadNeedsJpegConversion(image)) return image;

  const response = await fetchWithTimeout(
    fetchImpl,
    conversionEndpoint(apiBaseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': image.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(image.name ?? 'photo'),
      },
      body: image,
    },
    timeoutMs,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `Image conversion failed (status ${response.status})`);
  }

  const blob = await response.blob();
  return new File([blob], jpegFileName(image.name ?? 'photo.jpg'), {
    type: 'image/jpeg',
    lastModified: image.lastModified,
  });
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`SceneGen request timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Submit a photo to the SceneGen pipeline. Returns the parsed job descriptor
 * (expected to contain `job_id` and `status_url`).
 */
export async function submitSceneGenJob({
  baseUrl = configuredSceneGenBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs = SUBMIT_TIMEOUT_MS,
  conversionApiBaseUrl = DEFAULT_API_BASE_URL,
  conversionTimeoutMs = JPEG_CONVERSION_TIMEOUT_MS,
  image,
  segmentationMode = 'hybrid',
  maxInstances = 12,
  textureSize = 1024,
  positionsType = 'avg',
  includePeople = false,
  seed = 0,
} = {}) {
  if (!image) throw new Error('An image file is required to start a SceneGen job.');
  const uploadImage = await convertImageForSceneGenUpload(image, {
    apiBaseUrl: conversionApiBaseUrl,
    fetchImpl,
    timeoutMs: conversionTimeoutMs,
  });

  const form = new FormData();
  form.append('image', uploadImage, uploadImage.name ?? 'photo.jpg');
  form.append('segmentation_mode', segmentationMode);
  form.append('max_instances', String(maxInstances));
  form.append('texture_size', String(textureSize));
  form.append('positions_type', positionsType);
  form.append('include_people', String(includePeople));
  form.append('seed', String(seed));

  const response = await fetchWithTimeout(
    fetchImpl,
    endpoint(baseUrl, '/v1/jobs'),
    { method: 'POST', body: form },
    timeoutMs,
  );

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.detail || `SceneGen submit failed (status ${response.status})`);
  }
  const jobId = body?.job_id ?? body?.jobId ?? body?.id;
  if (!jobId) throw new Error('SceneGen did not return a job id.');
  return { ...body, jobId };
}

export async function fetchSceneGenJobStatus({
  baseUrl = configuredSceneGenBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs = STATUS_TIMEOUT_MS,
  jobId,
} = {}) {
  const response = await fetchWithTimeout(
    fetchImpl,
    endpoint(baseUrl, `/v1/jobs/${encodeURIComponent(jobId)}`),
    { method: 'GET' },
    timeoutMs,
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || body?.detail || `SceneGen status failed (status ${response.status})`);
  }
  return body ?? {};
}

const TERMINAL_STATUSES = new Set(['complete', 'completed', 'done', 'succeeded', 'success']);
const FAILED_STATUSES = new Set(['failed', 'error', 'errored', 'cancelled', 'canceled']);

export function isSceneGenComplete(status) {
  return TERMINAL_STATUSES.has(String(status ?? '').toLowerCase());
}

export function isSceneGenFailed(status) {
  return FAILED_STATUSES.has(String(status ?? '').toLowerCase());
}

/**
 * Poll a SceneGen job until it reaches a terminal state. Calls `onUpdate` with
 * each status payload. Resolves with the final payload when complete, throws
 * when the job fails or `signal` aborts.
 */
export async function pollSceneGenJob({
  baseUrl = configuredSceneGenBaseUrl(),
  fetchImpl = globalThis.fetch,
  jobId,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  signal,
  onUpdate,
} = {}) {
  for (;;) {
    if (signal?.aborted) throw new Error('SceneGen polling cancelled.');
    const payload = await fetchSceneGenJobStatus({ baseUrl, fetchImpl, jobId });
    onUpdate?.(payload);
    const status = payload?.status;
    if (isSceneGenFailed(status)) {
      throw new Error(payload?.error || payload?.message || `SceneGen job ${jobId} failed.`);
    }
    if (isSceneGenComplete(status)) return payload;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Download the finished GLB as a File so it can flow through the regular GLB
 * import path (and be persisted with the project).
 */
export async function downloadSceneGenGlb({
  baseUrl = configuredSceneGenBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
  jobId,
  fileName = `scenegen-${jobId}.glb`,
} = {}) {
  const response = await fetchWithTimeout(
    fetchImpl,
    sceneGenGlbUrl({ baseUrl, jobId }),
    { method: 'GET' },
    timeoutMs,
  );
  if (!response.ok) {
    throw new Error(`SceneGen GLB download failed (status ${response.status})`);
  }
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || 'model/gltf-binary' });
}

function jpegFileName(fileName) {
  const baseName = String(fileName || 'photo')
    .replace(/\.[^.\\/]+$/, '')
    .trim() || 'photo';
  return `${baseName}.jpg`;
}

// Guidance baked into every Nano Banana generation so the SceneGen pipeline has
// an easier time segmenting the result into individual assets.
const SCENEGEN_IMAGE_PROMPT_GUIDANCE = [
  'Photorealistic, wide-angle, eye-level photograph of an interior room.',
  'Arrange the furniture and objects as clearly separated, non-overlapping items',
  'with visible empty floor space and gaps between them — nothing touching or stacked.',
  'Each object fully visible, distinct, and unoccluded, with realistic proportions.',
  'Even, neutral, diffuse lighting with soft shadows; no people, no text, no watermarks.',
  'Plain, uncluttered walls and floor so individual objects stand out.',
].join(' ');

/**
 * Wrap a short user prompt with the separation/lighting guidance the pipeline
 * prefers. Returns the guidance alone when no subject is supplied.
 */
export function buildSceneGenImagePrompt(userPrompt) {
  const subject = String(userPrompt ?? '').trim();
  if (!subject) return SCENEGEN_IMAGE_PROMPT_GUIDANCE;
  return `${SCENEGEN_IMAGE_PROMPT_GUIDANCE} Scene to depict: ${subject}.`;
}

/**
 * Convert a data URL (e.g. a Nano Banana generation) into a File so it can flow
 * through the same upload/preview path as a dropped photo.
 */
export function dataUrlToImageFile(dataUrl, fileName = 'nano-banana-scene.png') {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl ?? ''));
  if (!match) throw new Error('Generated image is not a valid data URL.');
  const mimeType = match[1] || 'image/png';
  const isBase64 = Boolean(match[2]);
  const data = match[3];
  const binary = isBase64 ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const extension = mimeType.split('/')[1]?.split('+')[0] || 'png';
  const name = /\.[a-z0-9]+$/i.test(fileName) ? fileName : `${fileName}.${extension}`;
  return new File([bytes], name, { type: mimeType });
}
