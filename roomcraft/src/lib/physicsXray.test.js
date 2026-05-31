import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICS_XRAY_LEGEND,
  physicsXrayProfileForObject,
  shouldShowPhysicsXray,
} from './physicsXray.js';

test('physicsXrayProfileForObject identifies fixed structure objects', () => {
  assert.deepEqual(
    physicsXrayProfileForObject({
      label: 'coffee table',
      physics: { static: true, massKg: 18, restitution: 0.15 },
    }),
    {
      key: 'fixed',
      label: 'Fixed',
      color: '#38bdf8',
      description: 'Anchored scene geometry',
    }
  );
});

test('physicsXrayProfileForObject prioritizes fragile and bouncy dynamic objects', () => {
  assert.equal(
    physicsXrayProfileForObject({
      label: 'glass vase',
      physics: { breakable: true, restitution: 0.2 },
    }).key,
    'fragile'
  );

  assert.equal(
    physicsXrayProfileForObject({
      label: 'rubber ball',
      physics: { restitution: 0.85, massKg: 0.3 },
    }).key,
    'bouncy'
  );
});

test('physicsXrayProfileForObject marks heavy dynamic objects before generic dynamic objects', () => {
  assert.equal(
    physicsXrayProfileForObject({
      label: 'metal barrel',
      physics: { static: false, massKg: 24, restitution: 0.1 },
    }).key,
    'heavy'
  );

  assert.equal(
    physicsXrayProfileForObject({
      label: 'wooden crate',
      physics: { static: false, massKg: 3, restitution: 0.2 },
    }).key,
    'dynamic'
  );
});

test('shouldShowPhysicsXray respects the toggle and generic scene labels', () => {
  assert.equal(shouldShowPhysicsXray({ id: 'duck_01', label: 'rubber duck' }, true), true);
  assert.equal(shouldShowPhysicsXray({ id: 'duck_01', label: 'rubber duck' }, false), false);
  assert.equal(shouldShowPhysicsXray({ id: 'Room_Mesh', label: 'Room_Mesh' }, true), false);
});

test('shouldShowPhysicsXray still displays the default merged imported GLB object', () => {
  assert.equal(shouldShowPhysicsXray({ id: 'imported_glb_01', label: 'Imported GLB' }, true), true);
});

test('PHYSICS_XRAY_LEGEND exposes stable demo categories in priority order', () => {
  assert.deepEqual(
    PHYSICS_XRAY_LEGEND.map((entry) => entry.key),
    ['fixed', 'fragile', 'bouncy', 'heavy', 'dynamic']
  );
});
