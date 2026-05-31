import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROJECT_SAVE_VERSION,
  createMemoryProjectStorage,
  createHybridProjectStorage,
  createLocalStorageProjectStorage,
  createPrimaryProjectStorage,
  hydrateProjectSnapshot,
  readSavedProject,
  createRemoteProjectStorage,
  serializeProjectState,
  writeSavedProject,
} from './projectPersistence.js';

function object(overrides = {}) {
  return {
    id: 'duck_01',
    label: 'rubber duck',
    object3d: { runtime: true },
    transform: { position: [1, 2, 3], rotation: [0, 0.25, 0], scale: [1, 1, 1] },
    transformRevision: 2,
    physicsRevision: 1,
    dimensions: [0.4, 0.3, 0.5],
    physics: {
      category: 'toy',
      material: 'rubber',
      massKg: 0.2,
      friction: 0.7,
      restitution: 0.8,
      static: false,
      collider: 'cuboid',
      confidence: 0.91,
    },
    appearance: {
      baseColor: '#ffcc00',
      roughness: 0.65,
      metalness: 0,
      textureDescription: 'yellow rubber',
      source: 'vlm',
    },
    source: {
      type: 'import',
      fileName: 'duck.glb',
      assetId: 'asset_duck',
    },
    ...overrides,
  };
}

test('serializeProjectState saves editor state without runtime Three.js objects', () => {
  const snapshot = serializeProjectState({
    currentView: 'editor',
    importedGlbFileName: 'duck.glb',
    selectedObjectId: 'duck_01',
    highlightedObjectId: 'duck_01',
    gravityEnabled: true,
    collisionsEnabled: false,
    objectLabelsEnabled: true,
    viewMode: 'wireframe',
    perspective: 'Top',
    sceneObjects: [object()],
    assetSources: [
      {
        id: 'asset_duck',
        type: 'data-url',
        fileName: 'duck.glb',
        dataUrl: 'data:model/gltf-binary;base64,AAAA',
      },
    ],
    sceneObjectTransforms: {
      duck_01: { position: [1, 2, 3], rotation: [0, 0.25, 0], scale: [1, 1, 1] },
    },
    generatedTasks: [{ taskId: 'task_1', status: 'ready', prompt: 'add a duck' }],
    chatMessages: [{ id: 2, sender: 'user', text: 'save this' }],
  });

  assert.equal(snapshot.version, PROJECT_SAVE_VERSION);
  assert.equal(snapshot.project.currentView, 'editor');
  assert.equal(snapshot.project.gravityEnabled, true);
  assert.equal(snapshot.project.collisionsEnabled, false);
  assert.equal(snapshot.project.objectLabelsEnabled, true);
  assert.equal(snapshot.project.viewMode, 'wireframe');
  assert.equal(snapshot.project.perspective, 'Top');
  assert.equal(snapshot.project.highlightedObjectId, undefined);
  assert.deepEqual(snapshot.project.assetSources[0], {
    id: 'asset_duck',
    type: 'data-url',
    fileName: 'duck.glb',
    dataUrl: 'data:model/gltf-binary;base64,AAAA',
  });
  assert.equal(snapshot.project.sceneObjects[0].id, 'duck_01');
  assert.equal(snapshot.project.sceneObjects[0].object3d, undefined);
  assert.equal(snapshot.project.sceneObjects[0].physics.material, 'rubber');
  assert.equal(snapshot.project.chatMessages[0].text, 'save this');
});

test('hydrateProjectSnapshot restores saved object metadata as metadata-only until meshes reload', () => {
  const snapshot = serializeProjectState({
    currentView: 'editor',
    selectedObjectId: 'duck_01',
    sceneObjects: [object()],
    assetSources: [{ id: 'asset_duck', type: 'url', url: '/assets/fallback/duck.glb', fileName: 'duck.glb' }],
    sceneObjectTransforms: {
      duck_01: { position: [1, 2, 3], rotation: [0, 0.25, 0], scale: [1, 1, 1] },
    },
  });

  const state = hydrateProjectSnapshot(snapshot);

  assert.equal(state.currentView, 'editor');
  assert.equal(state.selectedObjectId, 'duck_01');
  assert.equal(state.sceneObjects[0].id, 'duck_01');
  assert.equal(state.sceneObjects[0].object3d, undefined);
  assert.equal(state.sceneObjects[0].restoredMetadataOnly, true);
  assert.equal(state.assetSources[0].url, '/assets/fallback/duck.glb');
  assert.deepEqual(state.sceneObjectTransforms.duck_01.position, [1, 2, 3]);
});

test('hydrateProjectSnapshot defaults newly added viewport fields for older saved projects', () => {
  const snapshot = serializeProjectState({
    currentView: 'editor',
    selectedObjectId: 'duck_01',
    sceneObjects: [
      object({
        transform: { position: [5, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        center: [1, 0, 0],
        localBoundsCenter: undefined,
        localBoundsDimensions: undefined,
      }),
    ],
    assetSources: [],
  });
  delete snapshot.project.floorEnabled;
  delete snapshot.project.objectLabelsEnabled;
  delete snapshot.project.backgroundGallery;

  const state = hydrateProjectSnapshot(snapshot);

  assert.equal(state.floorEnabled, true);
  assert.equal(state.objectLabelsEnabled, false);
  assert.deepEqual(state.backgroundGallery, []);
  assert.deepEqual(state.sceneObjects[0].localBoundsCenter, [0, 0, 0]);
  assert.deepEqual(state.sceneObjects[0].localBoundsDimensions, [0.4, 0.3, 0.5]);
});

test('project storage round trips snapshots', async () => {
  const storage = createMemoryProjectStorage();
  const snapshot = serializeProjectState({
    currentView: 'editor',
    sceneObjects: [object()],
    assetSources: [{ id: 'asset_duck', type: 'url', url: '/assets/fallback/duck.glb', fileName: 'duck.glb' }],
  });

  await writeSavedProject(snapshot, storage);

  assert.deepEqual(await readSavedProject(storage), snapshot);
});

test('hybrid project storage keeps a compact local fallback for reload recovery', async () => {
  const primary = createMemoryProjectStorage();
  const fallbackValues = new Map();
  const fallback = createLocalStorageProjectStorage({
    getItem: (key) => fallbackValues.get(key) ?? null,
    setItem: (key, value) => fallbackValues.set(key, value),
  }, { compact: true });
  const snapshot = serializeProjectState({
    currentView: 'editor',
    sceneObjects: [object()],
    assetSources: [
      {
        id: 'asset_duck',
        type: 'data-url',
        fileName: 'duck.glb',
        dataUrl: 'data:model/gltf-binary;base64,AAAA',
      },
    ],
  });

  await writeSavedProject(snapshot, createHybridProjectStorage(primary, fallback));

  assert.deepEqual(await readSavedProject(primary), snapshot);
  const fallbackSnapshot = JSON.parse(fallbackValues.get('roomcraft:last-project'));
  assert.equal(fallbackSnapshot.project.assetSources[0].dataUrl, undefined);
  assert.equal(fallbackSnapshot.project.assetSources[0].dataUrlUnavailable, true);
  assert.equal(fallbackSnapshot.project.sceneObjects[0].id, 'duck_01');
});

test('remote project storage saves compact snapshots and treats 404 as no project', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, init });
    if (!init) {
      return new Response(JSON.stringify({ error: 'ProjectNotFound' }), { status: 404 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const snapshot = serializeProjectState({
    currentView: 'editor',
    sceneObjects: [object()],
    assetSources: [
      {
        id: 'asset_duck',
        type: 'data-url',
        fileName: 'duck.glb',
        dataUrl: 'data:model/gltf-binary;base64,AAAA',
      },
    ],
  });
  const storage = createRemoteProjectStorage({
    apiBaseUrl: 'http://127.0.0.1:8787/',
    fetchImpl,
    compact: true,
  });

  await writeSavedProject(snapshot, storage);
  assert.equal(await readSavedProject(storage), null);

  const savedBody = JSON.parse(requests[0].init.body);
  assert.equal(requests[0].url, 'http://127.0.0.1:8787/api/projects/last');
  assert.equal(savedBody.project.assetSources[0].dataUrl, undefined);
  assert.equal(savedBody.project.assetSources[0].dataUrlUnavailable, true);
});

test('remote project storage preserves data urls by default so the backend can bundle project files', async () => {
  let savedBody;
  const fetchImpl = async (_url, init) => {
    savedBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const snapshot = serializeProjectState({
    currentView: 'editor',
    sceneObjects: [object()],
    assetSources: [
      {
        id: 'asset_duck',
        type: 'data-url',
        fileName: 'duck.glb',
        dataUrl: 'data:model/gltf-binary;base64,AAAA',
      },
    ],
  });
  const storage = createRemoteProjectStorage({
    apiBaseUrl: 'http://127.0.0.1:8787/',
    fetchImpl,
  });

  await writeSavedProject(snapshot, storage);

  assert.equal(savedBody.project.assetSources[0].dataUrl, 'data:model/gltf-binary;base64,AAAA');
});

test('primary project storage requires the authoritative save and mirrors best-effort', async () => {
  const snapshot = serializeProjectState({ currentView: 'editor', sceneObjects: [] });
  const primary = createMemoryProjectStorage();
  const brokenMirror = {
    async getProject() {
      return null;
    },
    async setProject() {
      throw new Error('mirror unavailable');
    },
  };

  await writeSavedProject(snapshot, createPrimaryProjectStorage(primary, brokenMirror));

  assert.deepEqual(await readSavedProject(primary), snapshot);
});
