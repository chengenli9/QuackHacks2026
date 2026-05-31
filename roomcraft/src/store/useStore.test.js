import test from 'node:test';
import assert from 'node:assert/strict';
import useStore from './useStore.js';

test('requestGlbImport switches to the import tab and increments the import request token', () => {
  useStore.setState({ leftPanelTab: 'chat', glbImportRequestId: 3 });

  useStore.getState().requestGlbImport();

  const state = useStore.getState();
  assert.equal(state.leftPanelTab, 'import');
  assert.equal(state.glbImportRequestId, 4);
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
