import test from 'node:test';
import assert from 'node:assert/strict';
import { rapierBodyTypeFor, rapierColliderFor } from './rapierMapping.js';

test('maps fixed physics profiles to Rapier fixed bodies', () => {
  assert.equal(rapierBodyTypeFor({ static: true }), 'fixed');
  assert.equal(rapierBodyTypeFor({ static: false }), 'dynamic');
});

test('maps backend collider names to Rapier automatic collider names', () => {
  assert.equal(rapierColliderFor({ collider: 'ball' }), 'ball');
  assert.equal(rapierColliderFor({ collider: 'cuboid' }), 'cuboid');
  assert.equal(rapierColliderFor({ collider: 'convex_hull' }), 'hull');
  assert.equal(rapierColliderFor({ collider: 'cylinder' }), 'hull');
});
