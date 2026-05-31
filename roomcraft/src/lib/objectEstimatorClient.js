export async function requestVisualPhysicsEstimate({
  apiBaseUrl,
  fetchImpl = globalThis.fetch,
  workerFactory = defaultWorkerFactory,
  timeoutMs = 60000,
  object,
  sourcePrompt,
  imageBase64,
  imageMimeType,
}) {
  if (!apiBaseUrl?.trim() || !imageBase64 || !imageMimeType) {
    return null;
  }

  const url = estimateEndpoint(apiBaseUrl);
  const body = estimateRequestBody({ object, sourcePrompt, imageBase64, imageMimeType });

  const worker = createEstimateWorker(workerFactory);
  if (worker) {
    return requestVisualPhysicsEstimateInWorker({
      worker,
      url,
      body,
      timeoutMs,
    });
  }

  const response = await fetchWithTimeout(fetchImpl, url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);

  if (!response.ok) {
    throw new Error(`Object estimate failed with status ${response.status}`);
  }

  const profile = await response.json();
  return normalizeProfile(profile);
}

function requestVisualPhysicsEstimateInWorker({ worker, url, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate?.();
      reject(new Error(`Object estimate timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate?.();
      if (!event.data?.ok) {
        reject(new Error(event.data?.error || 'Object estimate failed in worker'));
        return;
      }
      resolve(normalizeProfile(event.data.profile));
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate?.();
      reject(new Error(event.message || 'Object estimate worker failed'));
    };
    worker.postMessage({ url, body, timeoutMs });
  });
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Object estimate timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function estimateRequestBody({ object, sourcePrompt, imageBase64, imageMimeType }) {
  return {
    objectId: object.id,
    label: object.label,
    ...(sourcePrompt ? { sourcePrompt } : {}),
    dimensions: object.dimensions,
    meshMetadata: {
      meshCount: object.meshCount,
      vertexCount: object.vertexCount,
      triangleCount: object.triangleCount,
    },
    imageBase64,
    imageMimeType,
  };
}

function createEstimateWorker(workerFactory) {
  try {
    return workerFactory?.() ?? null;
  } catch {
    return null;
  }
}

function normalizeProfile(profile) {
  return {
    ...profile,
    source: 'vlm',
    needsVisualEstimate: false,
  };
}

function estimateEndpoint(apiBaseUrl) {
  const base = apiBaseUrl.trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? `${base}/estimate-object` : `${base}/api/estimate-object`;
}

function defaultWorkerFactory() {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./objectEstimateWorker.js', import.meta.url), { type: 'module' });
}
