import test from 'node:test';
import assert from 'node:assert/strict';
import { floorColliderForSceneObjects } from './floorCollider.js';

test('aligns the solid floor top to the lowest imported object bottom', () => {
  const floor = floorColliderForSceneObjects([
    { center: [0, 1, 0], dimensions: [2, 2, 2] },
    { center: [4, 3, -1], dimensions: [1, 4, 3] },
  ]);

  assert.deepEqual(floor.position, [1.75, -0.1, -0.75]);
  assert.deepEqual(floor.args, [11.5, 0.2, 9.5]);
});

test('uses a broad default floor when no imported bounds are available', () => {
  const floor = floorColliderForSceneObjects([]);

  assert.deepEqual(floor.position, [0, -0.1, 0]);
  assert.deepEqual(floor.args, [40, 0.2, 40]);
});
