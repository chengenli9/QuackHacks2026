import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestFallbackAsset,
  requestGeneratedAsset,
  requestGeneratedAssetModel,
  requestGeneratedAssetStatus,
  requestSceneCommand,
} from './apiClient.js';

test('posts chat commands with scene context to backend command endpoint', async () => {
  let requestUrl;
  let requestBody;
  const fetchImpl = async (url, init) => {
    requestUrl = url;
    requestBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        operation: { action: 'toggle_gravity', enabled: true },
      }),
    };
  };

  const response = await requestSceneCommand({
    apiBaseUrl: 'http://localhost:8787/',
    fetchImpl,
    message: 'turn gravity on',
    sceneObjects: [{ id: 'duck_01', label: 'rubber duck' }],
  });

  assert.equal(requestUrl, 'http://localhost:8787/api/command');
  assert.deepEqual(requestBody, {
    message: 'turn gravity on',
    sceneContext: {
      objects: [{ id: 'duck_01', label: 'rubber duck' }],
    },
  });
  assert.deepEqual(response.operation, { action: 'toggle_gravity', enabled: true });
});

test('uses generated asset endpoints for task lifecycle', async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith('/api/generate-asset')) {
      return { ok: true, json: async () => ({ taskId: 'task_1', provider: 'meshy', status: 'queued' }) };
    }
    if (url.endsWith('/api/generated-assets/task_1/status')) {
      return { ok: true, json: async () => ({ taskId: 'task_1', status: 'succeeded', progress: 100 }) };
    }
    if (url.endsWith('/api/generated-assets/task_1/model')) {
      return { ok: true, json: async () => ({ id: 'task_1', provider: 'meshy', sourcePrompt: 'duck', glbUrl: 'https://assets.example/duck.glb' }) };
    }
    if (url.endsWith('/api/generated-assets/fallback')) {
      return { ok: true, json: async () => ({ id: 'local-duck', provider: 'local', sourcePrompt: 'duck', glbUrl: 'https://assets.example/local-duck.glb' }) };
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  await requestGeneratedAsset({ apiBaseUrl: 'http://localhost:8787', fetchImpl, prompt: 'duck' });
  await requestGeneratedAssetStatus({ apiBaseUrl: 'http://localhost:8787', fetchImpl, taskId: 'task_1' });
  await requestGeneratedAssetModel({ apiBaseUrl: 'http://localhost:8787', fetchImpl, taskId: 'task_1' });
  await requestFallbackAsset({
    apiBaseUrl: 'http://localhost:8787',
    fetchImpl,
    fallbackAssetKey: 'duck',
    sourcePrompt: 'duck',
  });

  assert.deepEqual(requests.map((request) => request.url), [
    'http://localhost:8787/api/generate-asset',
    'http://localhost:8787/api/generated-assets/task_1/status',
    'http://localhost:8787/api/generated-assets/task_1/model',
    'http://localhost:8787/api/generated-assets/fallback',
  ]);
  assert.deepEqual(requests[0].body, { prompt: 'duck', targetFormat: 'glb' });
  assert.deepEqual(requests[3].body, { fallbackAssetKey: 'duck', sourcePrompt: 'duck' });
});
