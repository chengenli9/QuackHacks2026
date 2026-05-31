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
