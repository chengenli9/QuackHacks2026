import test from 'node:test';
import assert from 'node:assert/strict';
import { requestVisualPhysicsEstimate } from './objectEstimatorClient.js';

test('posts object preview images to the backend estimate endpoint', async () => {
  let requestUrl;
  let requestBody;
  const fetchImpl = async (url, init) => {
    requestUrl = url;
    requestBody = JSON.parse(init.body);
    return {
      ok: true,
    json: async () => ({
      objectId: 'geometry_0',
      label: 'wooden chair',
      category: 'furniture',
      material: 'wood',
        massKg: 7,
        restitution: 0.12,
        friction: 0.7,
        static: false,
        breakable: false,
      collider: 'cuboid',
      confidence: 0.87,
      notes: 'Looks like a chair.',
      appearance: {
        baseColor: '#8b5a2b',
        roughness: 0.72,
        metalness: 0,
        textureDescription: 'warm wood grain',
        source: 'vlm',
      },
    }),
  };
  };

  const profile = await requestVisualPhysicsEstimate({
    apiBaseUrl: 'http://localhost:8787/',
    fetchImpl,
    object: {
      id: 'geometry_0',
      label: 'geometry_0',
      dimensions: [1, 2, 3],
      meshCount: 2,
      vertexCount: 128,
      triangleCount: 64,
    },
    imageBase64: 'abc123',
    imageMimeType: 'image/png',
  });

  assert.equal(requestUrl, 'http://localhost:8787/api/estimate-object');
  assert.equal(requestBody.objectId, 'geometry_0');
  assert.equal(requestBody.imageBase64, 'abc123');
  assert.equal(requestBody.imageMimeType, 'image/png');
  assert.deepEqual(requestBody.dimensions, [1, 2, 3]);
  assert.deepEqual(requestBody.meshMetadata, {
    meshCount: 2,
    vertexCount: 128,
    triangleCount: 64,
  });
  assert.equal(profile.label, 'wooden chair');
  assert.equal(profile.appearance.baseColor, '#8b5a2b');
  assert.equal(profile.appearance.textureDescription, 'warm wood grain');
  assert.equal(profile.source, 'vlm');
  assert.equal(profile.needsVisualEstimate, false);
});

test('returns null when the frontend has no estimator API base URL', async () => {
  const result = await requestVisualPhysicsEstimate({
    apiBaseUrl: '',
    fetchImpl: async () => {
      throw new Error('fetch should not run');
    },
    object: { id: 'geometry_0', label: 'geometry_0' },
    imageBase64: 'abc123',
    imageMimeType: 'image/png',
  });

  assert.equal(result, null);
});

test('can dispatch visual estimates through a worker so API waits do not block the editor', async () => {
  let postedMessage;
  const workerFactory = () => {
    const worker = {
      onmessage: null,
      onerror: null,
      postMessage(message) {
        postedMessage = message;
        queueMicrotask(() => {
          worker.onmessage({
            data: {
              ok: true,
              profile: {
                objectId: 'geometry_0',
                label: 'contextual chair',
                category: 'furniture',
                material: 'wood',
                massKg: 5,
                restitution: 0.1,
                friction: 0.7,
                static: false,
                breakable: false,
                collider: 'cuboid',
                confidence: 0.8,
              },
            },
          });
        });
      },
      terminate() {},
    };
    return worker;
  };

  const profile = await requestVisualPhysicsEstimate({
    apiBaseUrl: 'http://localhost:8787/',
    fetchImpl: async () => {
      throw new Error('direct fetch should not run');
    },
    workerFactory,
    object: {
      id: 'geometry_0',
      label: 'geometry_0',
      dimensions: [1, 2, 3],
      meshCount: 2,
      vertexCount: 128,
      triangleCount: 64,
    },
    imageBase64: 'abc123',
    imageMimeType: 'image/png',
  });

  assert.equal(postedMessage.url, 'http://localhost:8787/api/estimate-object');
  assert.equal(postedMessage.body.objectId, 'geometry_0');
  assert.equal(profile.label, 'contextual chair');
  assert.equal(profile.source, 'vlm');
  assert.equal(profile.needsVisualEstimate, false);
});

test('falls back to direct fetch if visual estimate worker startup fails', async () => {
  let requestUrl;
  const fetchImpl = async (url) => {
    requestUrl = url;
    return {
      ok: true,
      json: async () => ({
        objectId: 'geometry_0',
        label: 'fallback chair',
        category: 'furniture',
        material: 'wood',
        massKg: 5,
        restitution: 0.1,
        friction: 0.7,
        static: false,
        breakable: false,
        collider: 'cuboid',
        confidence: 0.8,
      }),
    };
  };

  const profile = await requestVisualPhysicsEstimate({
    apiBaseUrl: 'http://localhost:8787/',
    fetchImpl,
    workerFactory: () => {
      throw new Error('worker blocked');
    },
    object: {
      id: 'geometry_0',
      label: 'geometry_0',
      dimensions: [1, 2, 3],
      meshCount: 2,
      vertexCount: 128,
      triangleCount: 64,
    },
    imageBase64: 'abc123',
    imageMimeType: 'image/png',
  });

  assert.equal(requestUrl, 'http://localhost:8787/api/estimate-object');
  assert.equal(profile.label, 'fallback chair');
});
