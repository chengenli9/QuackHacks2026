export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8787';

export function configuredApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export async function requestSceneCommand({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  message,
  sceneObjects,
  selectedObjectId,
  gravityEnabled,
  collisionsEnabled,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/command'), {
    method: 'POST',
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
  prompt,
}) {
  return requestJson(fetchImpl, endpoint(apiBaseUrl, '/api/background-image'), {
    method: 'POST',
    body: { prompt },
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
