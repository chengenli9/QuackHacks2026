import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryProjectStorage } from '../lib/projectPersistence.js';
import { buildShowtimeSteps } from '../lib/showtimeDirector.js';
import useStore from './useStore.js';

test('requestGlbImport switches to the import tab and increments the import request token', () => {
  useStore.setState({ leftPanelTab: 'chat', glbImportRequestId: 3 });

  useStore.getState().requestGlbImport();

  const state = useStore.getState();
  assert.equal(state.leftPanelTab, 'import');
  assert.equal(state.glbImportRequestId, 4);
});

test('requestOpenSavedProject enters the editor and increments the open project request token', () => {
  useStore.setState(useStore.getInitialState(), true);

  useStore.getState().requestOpenSavedProject();

  const state = useStore.getState();
  assert.equal(state.currentView, 'editor');
  assert.equal(state.openSavedProjectRequestId, 1);
});

test('addImportedScene appends imported objects without removing existing scene assets', () => {
  useStore.setState({
    sceneObjects: [{ id: 'geometry_0', label: 'geometry_0' }],
    glbImportWarnings: ['first warning'],
    selectedObjectId: 'geometry_0',
    expandedNodes: ['Scene'],
  });

  useStore.getState().addImportedScene({
    fileName: 'second.glb',
    objects: [{ id: 'geometry_1', label: 'geometry_1' }],
    warnings: ['second warning'],
  });

  const state = useStore.getState();
  assert.deepEqual(state.sceneObjects.map((object) => object.id), ['geometry_0', 'geometry_1']);
  assert.equal(state.importedGlbFileName, 'second.glb');
  assert.equal(state.selectedObjectId, 'geometry_1');
  assert.deepEqual(state.glbImportWarnings, ['first warning', 'second warning']);
  assert.ok(state.expandedNodes.includes('Imported_GLB'));
});

test('editor opens in material view so imported GLBs keep their authored materials', () => {
  useStore.setState({ viewMode: 'solid' });

  useStore.setState(useStore.getInitialState(), true);

  assert.equal(useStore.getState().viewMode, 'material');
});

test('scene object editor actions update transform, material, physics, and gravity state', () => {
  useStore.setState({
    selectedObjectId: 'duck_01',
    gravityEnabled: false,
    sceneObjects: [
      {
        id: 'duck_01',
        label: 'duck',
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        transformRevision: 0,
        physicsRevision: 0,
        physics: { massKg: 1, restitution: 0.2, friction: 0.5, static: false, collider: 'cuboid' },
        appearance: { baseColor: '#8a8a8a', roughness: 0.8, metalness: 0.1 },
      },
    ],
  });

  useStore.getState().updateSceneObjectTransform('duck_01', { position: [1, 2, 3] });
  useStore.getState().updateSceneObjectAppearance('duck_01', { baseColor: '#ffcc00' });
  useStore.getState().updateSceneObjectPhysics('duck_01', { restitution: 0.85 });
  useStore.getState().applySceneOperation({ action: 'toggle_gravity', enabled: true });

  const state = useStore.getState();
  const object = state.sceneObjects[0];
  assert.deepEqual(object.transform.position, [1, 2, 3]);
  assert.equal(object.transformRevision, 1);
  assert.equal(object.appearance.baseColor, '#ffcc00');
  assert.equal(object.physics.restitution, 0.85);
  assert.equal(object.physicsRevision, 1);
  assert.equal(state.gravityEnabled, true);
});

test('project reset clears imported and generated demo state without leaving editor', () => {
  useStore.setState({
    currentView: 'editor',
    importedGlbFileName: 'scene.glb',
    manifestFileName: 'manifest.json',
    manifestStatus: 'ready',
    manifestWarnings: ['warning'],
    sceneObjects: [{ id: 'duck_01', label: 'duck' }],
    generatedTasks: [{ taskId: 'task_1', status: 'ready' }],
    selectedObjectId: 'duck_01',
    highlightedObjectId: 'duck_01',
    gravityEnabled: true,
    collisionsEnabled: false,
    floorEnabled: false,
    sceneBackground: {
      prompt: 'neon horizon',
      imageDataUrl: 'data:image/png;base64,BBBB',
      status: 'ready',
      error: null,
      model: 'gemini-image',
    },
    backgroundGallery: [
      { id: 'background_1', prompt: 'neon horizon', imageDataUrl: 'data:image/png;base64,BBBB' },
    ],
    chatMessages: [{ id: 99, sender: 'user', text: 'changed' }],
  });

  useStore.getState().resetProject();

  const state = useStore.getState();
  assert.equal(state.currentView, 'editor');
  assert.equal(state.importedGlbFileName, null);
  assert.equal(state.manifestFileName, null);
  assert.equal(state.manifestStatus, 'idle');
  assert.deepEqual(state.manifestWarnings, []);
  assert.deepEqual(state.sceneObjects, []);
  assert.deepEqual(state.generatedTasks, []);
  assert.equal(state.selectedObjectId, 'Room_Mesh');
  assert.equal(state.highlightedObjectId, null);
  assert.equal(state.gravityEnabled, false);
  assert.equal(state.collisionsEnabled, true);
  assert.equal(state.floorEnabled, true);
  assert.deepEqual(state.backgroundGallery, []);
  assert.equal(state.sceneBackground.status, 'idle');
  assert.equal(state.chatMessages[0].sender, 'ai');
});

test('background gallery keeps generated backgrounds selectable without replacing history', () => {
  useStore.setState(useStore.getInitialState(), true);

  useStore.getState().setSceneBackground({
    prompt: 'deep starry night',
    imageDataUrl: 'data:image/png;base64,AAAA',
    model: 'gemini-image',
  });
  useStore.getState().setSceneBackground({
    prompt: 'neon horizon',
    imageDataUrl: 'data:image/png;base64,BBBB',
    model: 'gemini-image',
  });

  let state = useStore.getState();
  assert.equal(state.backgroundGallery.length, 2);
  assert.equal(state.sceneBackground.prompt, 'neon horizon');

  useStore.getState().selectSceneBackground(state.backgroundGallery[0].id);

  state = useStore.getState();
  assert.equal(state.sceneBackground.prompt, 'deep starry night');
  assert.equal(state.sceneBackground.imageDataUrl, 'data:image/png;base64,AAAA');
});

test('background gallery dedupes repeated generated backgrounds and keeps a bounded history', () => {
  useStore.setState(useStore.getInitialState(), true);

  for (let index = 0; index < 14; index += 1) {
    useStore.getState().setSceneBackground({
      id: index === 13 ? 'background_5' : undefined,
      prompt: `background ${index}`,
      imageDataUrl: `data:image/png;base64,${index === 13 ? 5 : index}`,
      model: 'gemini-image',
    });
  }

  const state = useStore.getState();
  assert.equal(state.backgroundGallery.length, 12);
  assert.equal(state.backgroundGallery.filter((background) => background.id === 'background_5').length, 1);
  assert.equal(state.sceneBackground.id, 'background_5');
});

test('showtime mode selects and highlights the focused demo object', () => {
  useStore.setState(useStore.getInitialState(), true);
  useStore.setState({
    currentView: 'editor',
    activeTool: 'move',
    viewMode: 'wireframe',
    perspective: 'Top',
    overlaysEnabled: false,
    objectLabelsEnabled: false,
    physicsXrayEnabled: false,
    collisionsEnabled: false,
    floorEnabled: false,
    sceneObjects: [
      {
        id: 'duck_01',
        label: 'rubber duck',
        physics: { category: 'toy', material: 'rubber', massKg: 0.2, confidence: 0.9 },
      },
    ],
  });

  useStore.getState().startShowtime();

  let state = useStore.getState();
  assert.equal(state.showtimeEnabled, true);
  assert.equal(state.showtimeStepIndex, 0);
  assert.equal(state.activeTool, 'select');
  assert.equal(state.viewMode, 'material');
  assert.equal(state.perspective, 'Perspective');
  assert.equal(state.overlaysEnabled, true);
  assert.equal(state.objectLabelsEnabled, true);
  assert.equal(state.physicsXrayEnabled, true);
  assert.equal(state.collisionsEnabled, true);
  assert.equal(state.floorEnabled, true);

  useStore.getState().advanceShowtime();
  state = useStore.getState();
  assert.equal(state.showtimeStepIndex, 1);
  assert.equal(state.selectedObjectId, 'duck_01');
  assert.equal(state.highlightedObjectId, 'duck_01');

  useStore.getState().stopShowtime();
  state = useStore.getState();
  assert.equal(state.showtimeEnabled, false);
  assert.equal(state.highlightedObjectId, null);
  assert.equal(state.activeTool, 'move');
  assert.equal(state.viewMode, 'wireframe');
  assert.equal(state.perspective, 'Top');
  assert.equal(state.overlaysEnabled, false);
  assert.equal(state.objectLabelsEnabled, false);
  assert.equal(state.physicsXrayEnabled, false);
  assert.equal(state.collisionsEnabled, false);
  assert.equal(state.floorEnabled, false);
});

test('object insight labels can be toggled independently from grid overlays', () => {
  useStore.setState(useStore.getInitialState(), true);
  assert.equal(useStore.getState().objectLabelsEnabled, false);

  useStore.getState().setObjectLabelsEnabled(true);
  let state = useStore.getState();
  assert.equal(state.objectLabelsEnabled, true);
  assert.equal(state.overlaysEnabled, true);

  useStore.getState().toggleOverlays();
  state = useStore.getState();
  assert.equal(state.objectLabelsEnabled, true);
  assert.equal(state.overlaysEnabled, false);
});

test('physics x-ray can be toggled independently from grid overlays', () => {
  useStore.setState(useStore.getInitialState(), true);
  assert.equal(useStore.getState().physicsXrayEnabled, false);

  useStore.getState().setPhysicsXrayEnabled(true);
  let state = useStore.getState();
  assert.equal(state.physicsXrayEnabled, true);
  assert.equal(state.overlaysEnabled, true);

  useStore.getState().toggleOverlays();
  state = useStore.getState();
  assert.equal(state.physicsXrayEnabled, true);
  assert.equal(state.overlaysEnabled, false);
});

test('showtime clamps its step index when the imported scene is replaced', () => {
  useStore.setState(useStore.getInitialState(), true);
  useStore.setState({
    sceneObjects: [
      { id: 'object_1', label: 'chair', physics: { category: 'furniture' } },
      { id: 'object_2', label: 'table', physics: { category: 'furniture' } },
      { id: 'object_3', label: 'lamp', physics: { category: 'lighting' } },
      { id: 'object_4', label: 'vase', physics: { category: 'decor' } },
    ],
  });

  useStore.getState().startShowtime();
  useStore.getState().setShowtimeStep(5);
  assert.equal(useStore.getState().showtimeStepIndex, 5);

  useStore.getState().setImportedScene({
    fileName: 'replacement.glb',
    objects: [{ id: 'replacement_1', label: 'single chair' }],
  });

  const state = useStore.getState();
  const maxIndex = buildShowtimeSteps({
    sceneObjects: state.sceneObjects,
    generatedTasks: state.generatedTasks,
  }).length - 1;

  assert.equal(state.showtimeEnabled, true);
  assert.ok(state.showtimeStepIndex <= maxIndex);
});

test('project save and load round trips editor metadata without runtime object3d values', async () => {
  const storage = createMemoryProjectStorage();
  useStore.setState(useStore.getInitialState(), true);
  useStore.setState({
    currentView: 'editor',
    importedGlbFileName: 'duck.glb',
    selectedObjectId: 'duck_01',
    gravityEnabled: true,
    assetSources: [
      {
        id: 'asset_duck',
        type: 'data-url',
        fileName: 'duck.glb',
        dataUrl: 'data:model/gltf-binary;base64,AAAA',
      },
    ],
    sceneObjects: [
      {
        id: 'duck_01',
        label: 'rubber duck',
        object3d: { runtime: true },
        transform: { position: [1, 2, 3], rotation: [0, 0.25, 0], scale: [1, 1, 1] },
        transformRevision: 2,
        physicsRevision: 1,
        physics: { massKg: 0.2, friction: 0.7, restitution: 0.8, static: false, collider: 'cuboid' },
        appearance: { baseColor: '#ffcc00', roughness: 0.65, metalness: 0 },
        source: { type: 'import', fileName: 'duck.glb', assetId: 'asset_duck' },
      },
    ],
    sceneObjectTransforms: {
      duck_01: { position: [1, 2, 3], rotation: [0, 0.25, 0], scale: [1, 1, 1] },
    },
    chatMessages: [{ id: 2, sender: 'user', text: 'save this project' }],
  });

  await useStore.getState().saveProject(storage);

  assert.equal(useStore.getState().savedProjectStatus, 'saved');

  useStore.setState(useStore.getInitialState(), true);
  const snapshot = await useStore.getState().loadSavedProject(storage);
  const state = useStore.getState();

  assert.ok(snapshot);
  assert.equal(state.currentView, 'editor');
  assert.equal(state.savedProjectStatus, 'loaded');
  assert.equal(state.selectedObjectId, 'duck_01');
  assert.equal(state.gravityEnabled, true);
  assert.equal(state.sceneObjects[0].id, 'duck_01');
  assert.equal(state.sceneObjects[0].object3d, undefined);
  assert.equal(state.sceneObjects[0].restoredMetadataOnly, true);
  assert.equal(state.sceneObjects[0].appearance.baseColor, '#ffcc00');
  assert.equal(state.assetSources[0].dataUrl, 'data:model/gltf-binary;base64,AAAA');
  assert.equal(state.chatMessages[0].text, 'save this project');
});
