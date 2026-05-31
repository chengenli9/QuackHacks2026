import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySceneOperationToState,
  mergeObjectEstimate,
  normalizeSceneObject,
  updateObjectAppearance,
  updateObjectPhysics,
  updateObjectTransform,
} from './sceneState.js';

const object = (overrides = {}) =>
  normalizeSceneObject({
    id: 'duck_01',
    label: 'rubber duck',
    physics: {
      massKg: 0.2,
      restitution: 0.4,
      friction: 0.5,
      static: false,
      breakable: false,
      collider: 'cuboid',
    },
    ...overrides,
  });

test('normalizes imported objects with editable transform and appearance defaults', () => {
  const normalized = normalizeSceneObject({ id: 'geometry_0', label: 'geometry_0', center: [1, 2, 3] });

  assert.deepEqual(normalized.transform.position, [1, 2, 3]);
  assert.deepEqual(normalized.transform.rotation, [0, 0, 0]);
  assert.deepEqual(normalized.transform.scale, [1, 1, 1]);
  assert.equal(normalized.appearance.baseColor, null);
  assert.equal(normalized.transformRevision, 0);
  assert.equal(normalized.physicsRevision, 0);
});

test('updates editor-authored transforms and increments transform revisions', () => {
  const [updated] = updateObjectTransform([object()], 'duck_01', {
    position: [2, 3, 4],
    rotation: [0.1, 0.2, 0.3],
  });

  assert.deepEqual(updated.transform.position, [2, 3, 4]);
  assert.deepEqual(updated.transform.rotation, [0.1, 0.2, 0.3]);
  assert.deepEqual(updated.transform.scale, [1, 1, 1]);
  assert.equal(updated.transformRevision, 1);
});

test('runtime physics transform updates do not increment editor revision', () => {
  const [updated] = updateObjectTransform([object()], 'duck_01', {
    position: [0, 5, 0],
  }, { runtime: true });

  assert.deepEqual(updated.transform.position, [0, 5, 0]);
  assert.equal(updated.transformRevision, 0);
});

test('updates selected object appearance and physics without mutating other objects', () => {
  const sceneObjects = [object(), object({ id: 'crate_01', label: 'crate' })];
  const appearanceObjects = updateObjectAppearance(sceneObjects, 'duck_01', {
    baseColor: '#ffcc00',
    roughness: 0.25,
  });
  const physicsObjects = updateObjectPhysics(appearanceObjects, 'duck_01', {
    restitution: 0.9,
    static: true,
  });

  assert.equal(physicsObjects[0].appearance.baseColor, '#ffcc00');
  assert.equal(physicsObjects[0].appearance.overrides.baseColor, true);
  assert.equal(physicsObjects[0].appearance.overrides.roughness, true);
  assert.equal(physicsObjects[0].appearance.roughness, 0.25);
  assert.equal(physicsObjects[0].physics.restitution, 0.9);
  assert.equal(physicsObjects[0].physics.static, true);
  assert.equal(physicsObjects[0].physicsRevision, 1);
  assert.notEqual(physicsObjects[1].appearance.baseColor, '#ffcc00');
  assert.equal(physicsObjects[1].physics.restitution, 0.4);
});

test('merges VLM estimate into physics and appearance metadata', () => {
  const [updated] = mergeObjectEstimate([object()], 'duck_01', {
    label: 'rubber duck',
    material: 'rubber',
    massKg: 0.3,
    restitution: 0.75,
    appearance: {
      baseColor: '#ffee22',
      roughness: 0.7,
      metalness: 0,
      textureDescription: 'yellow rubber',
      source: 'vlm',
    },
  });

  assert.equal(updated.label, 'rubber duck');
  assert.equal(updated.physics.massKg, 0.3);
  assert.equal(updated.physics.restitution, 0.75);
  assert.equal(updated.physics.needsVisualEstimate, false);
  assert.equal(updated.physics.source, 'vlm');
  assert.equal(updated.appearance.baseColor, '#ffee22');
  assert.equal(updated.appearance.textureDescription, 'yellow rubber');
  assert.deepEqual(updated.appearance.overrides, {});
});

test('applies common scene operations to project state', () => {
  const initial = {
    sceneObjects: [object()],
    selectedObjectId: 'duck_01',
    gravityEnabled: false,
  };

  const moved = applySceneOperationToState(initial, {
    action: 'move_object',
    target: 'duck_01',
    position: [3, 4, 5],
  });
  const bouncy = applySceneOperationToState({ ...initial, ...moved }, {
    action: 'update_object_physics',
    target: 'duck_01',
    changes: { restitution: 0.85 },
  });
  const gravity = applySceneOperationToState({ ...initial, ...moved, ...bouncy }, {
    action: 'toggle_gravity',
    enabled: true,
  });

  assert.deepEqual(gravity.sceneObjects[0].transform.position, [3, 4, 5]);
  assert.equal(gravity.sceneObjects[0].physics.restitution, 0.85);
  assert.equal(gravity.gravityEnabled, true);
});

test('scene operation export requests use the shared export trigger', () => {
  const state = applySceneOperationToState(
    {
      sceneObjects: [object()],
      selectedObjectId: 'duck_01',
      exportRequestedAt: null,
    },
    { action: 'export_scene' }
  );

  assert.equal(state.exportRequestedAt, 1);
});
