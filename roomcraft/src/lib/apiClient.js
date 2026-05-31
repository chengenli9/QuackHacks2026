export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';

export function configuredApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export async function requestSceneCommand({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs,
  message,
  sceneObjects,
  selectedObjectId,
  gravityEnabled,
  collisionsEnabled,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/command'), {
    method: 'POST',
    timeoutMs,
    body: {
      message,
      sceneContext: {
        objects: sceneObjects.map(commandContextForObject),
        ...(selectedObjectId ? { selectedObjectId } : {}),
        ...(typeof gravityEnabled === 'boolean' ? { gravityEnabled } : {}),
        ...(typeof collisionsEnabled === 'boolean' ? { collisionsEnabled } : {}),
      },
    },
  });
}

export async function requestBackgroundImage({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs,
  prompt,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/background-image'), {
    method: 'POST',
    timeoutMs,
    body: { prompt },
  });
}

export async function requestGeneratedAsset({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs,
  prompt,
  style,
  assetType,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/generate-asset'), {
    method: 'POST',
    timeoutMs,
    body: {
      prompt,
      ...(style ? { style } : {}),
      ...(assetType ? { assetType } : {}),
      targetFormat: 'glb',
    },
  });
}

export async function requestGeneratedAssetStatus({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs,
  taskId,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, `/api/generated-assets/${encodeURIComponent(taskId)}/status`), {
    timeoutMs,
  });
}

export async function requestGeneratedAssetModel({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs,
  taskId,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, `/api/generated-assets/${encodeURIComponent(taskId)}/model`), {
    timeoutMs,
  });
}

export async function requestFallbackAsset({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs,
  fallbackAssetKey,
  sourcePrompt,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/generated-assets/fallback'), {
    method: 'POST',
    timeoutMs,
    body: { fallbackAssetKey, sourcePrompt },
  });
}

function endpoint(apiBaseUrl, path) {
  return `${apiBaseUrl.trim().replace(/\/+$/, '')}${path}`;
}

async function requestJson(fetchImpl, url, init = {}) {
  const timeoutMs = init.timeoutMs ?? 60000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetchImpl(url, {
      method: init.method ?? 'GET',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || `Request failed with status ${response.status}`);
  }

  return body;
}

function commandContextForObject(object) {
  return {
    id: object.id,
    label: object.label,
    ...(object.physics?.category ? { category: object.physics.category } : {}),
    ...(object.physics?.material ? { material: object.physics.material } : {}),
    ...(object.transform?.position ? { position: object.transform.position } : {}),
    ...(object.dimensions ? { dimensions: object.dimensions } : {}),
    ...(typeof object.physics?.static === 'boolean' ? { static: object.physics.static } : {}),
  };
}
