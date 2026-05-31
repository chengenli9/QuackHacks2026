export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';

export function configuredApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export async function requestSceneCommand({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  message,
  sceneObjects,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/command'), {
    method: 'POST',
    body: {
      message,
      sceneContext: {
        objects: sceneObjects.map((object) => ({ id: object.id, label: object.label })),
      },
    },
  });
}

export async function requestGeneratedAsset({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  prompt,
  style,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/generate-asset'), {
    method: 'POST',
    body: {
      prompt,
      ...(style ? { style } : {}),
      targetFormat: 'glb',
    },
  });
}

export async function requestGeneratedAssetStatus({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  taskId,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, `/api/generated-assets/${encodeURIComponent(taskId)}/status`));
}

export async function requestGeneratedAssetModel({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  taskId,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, `/api/generated-assets/${encodeURIComponent(taskId)}/model`));
}

export async function requestFallbackAsset({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  fallbackAssetKey,
  sourcePrompt,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/generated-assets/fallback'), {
    method: 'POST',
    body: { fallbackAssetKey, sourcePrompt },
  });
}

function endpoint(apiBaseUrl, path) {
  return `${apiBaseUrl.trim().replace(/\/+$/, '')}${path}`;
}

async function requestJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, {
    method: init.method ?? 'GET',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || `Request failed with status ${response.status}`);
  }

  return body;
}
