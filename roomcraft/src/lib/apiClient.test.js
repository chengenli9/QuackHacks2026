import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestFallbackAsset,
  requestBackgroundImage,
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
    sceneObjects: [{
      id: 'duck_01',
      label: 'rubber duck',
      physics: { category: 'toy', material: 'rubber', static: false },
      transform: { position: [0, 1, 0] },
      dimensions: [0.4, 0.3, 0.3],
    }],
    selectedObjectId: 'duck_01',
    gravityEnabled: false,
    collisionsEnabled: true,
  });

  assert.equal(requestUrl, 'http://localhost:8787/api/command');
  assert.deepEqual(requestBody, {
    message: 'turn gravity on',
    sceneContext: {
      objects: [{
        id: 'duck_01',
        label: 'rubber duck',
        category: 'toy',
        material: 'rubber',
        position: [0, 1, 0],
        dimensions: [0.4, 0.3, 0.3],
        static: false,
      }],
      selectedObjectId: 'duck_01',
      gravityEnabled: false,
      collisionsEnabled: true,
    },
  });
  assert.deepEqual(response.operation, { action: 'toggle_gravity', enabled: true });
});

test('requests Gemini background image generation', async () => {
  let requestUrl;
  let requestBody;
  const fetchImpl = async (url, init) => {
    requestUrl = url;
    requestBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        provider: 'gemini',
        model: 'gemini-2.5-flash-image',
        prompt: 'deep starry night',
        mimeType: 'image/png',
        imageDataUrl: 'data:image/png;base64,abc123',
      }),
    };
  };

  const response = await requestBackgroundImage({
    apiBaseUrl: 'http://localhost:8787/',
    fetchImpl,
    prompt: 'deep starry night',
  });

  assert.equal(requestUrl, 'http://localhost:8787/api/background-image');
  assert.deepEqual(requestBody, { prompt: 'deep starry night' });
  assert.equal(response.imageDataUrl, 'data:image/png;base64,abc123');
});

test('background image generation uses a longer default timeout', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let timeoutDelay;

  globalThis.setTimeout = (callback, delay) => {
    timeoutDelay = delay;
    return { callback };
  };
  globalThis.clearTimeout = () => {};

  try {
    await requestBackgroundImage({
      apiBaseUrl: 'http://localhost:8787',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          provider: 'gemini',
          model: 'gemini-2.5-flash-image',
          prompt: 'deep starry night',
          mimeType: 'image/png',
          imageDataUrl: 'data:image/png;base64,abc123',
        }),
      }),
      prompt: 'deep starry night',
    });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }

  assert.equal(timeoutDelay, 300000);
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

  await requestGeneratedAsset({
    apiBaseUrl: 'http://localhost:8787',
    fetchImpl,
    prompt: 'duck',
    assetType: 'environment_scene',
  });
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
  assert.deepEqual(requests[0].body, { prompt: 'duck', assetType: 'environment_scene', targetFormat: 'glb' });
  assert.deepEqual(requests[3].body, { fallbackAssetKey: 'duck', sourcePrompt: 'duck' });
});

test('aborts slow backend requests with a clear timeout error', async () => {
  const fetchImpl = async (_url, init = {}) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });

  await assert.rejects(
    requestGeneratedAsset({
      apiBaseUrl: 'http://localhost:8787',
      fetchImpl,
      prompt: 'duck',
      timeoutMs: 5,
    }),
    /timed out/i
  );
});
