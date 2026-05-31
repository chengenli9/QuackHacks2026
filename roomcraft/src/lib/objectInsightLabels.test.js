import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildObjectInsightLabel,
  labelPositionForObject,
  shouldShowObjectInsightLabel,
} from './objectInsightLabels.js';

const DUCK = {
  id: 'duck_01',
  label: 'rubber_duck',
  transform: { position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
  localBoundsCenter: [0, 0.2, 0],
  localBoundsDimensions: [0.5, 0.4, 0.3],
  physics: {
    category: 'toy',
    material: 'rubber',
    massKg: 0.2,
    restitution: 0.85,
    confidence: 0.91,
  },
  appearance: {
    textureDescription: 'smooth yellow plastic',
  },
};

test('buildObjectInsightLabel summarizes semantic and physics metadata for the viewport', () => {
  const label = buildObjectInsightLabel(DUCK);

  assert.equal(label.title, 'rubber duck');
  assert.equal(label.subtitle, 'toy / rubber');
  assert.deepEqual(label.metrics, ['0.2 kg', '0.85 bounce', '91% confidence']);
  assert.equal(label.texture, 'smooth yellow plastic');
});

test('buildObjectInsightLabel falls back gracefully for unestimated objects', () => {
  const label = buildObjectInsightLabel({ id: 'geometry_0', label: 'geometry_0', physics: {} });

  assert.equal(label.title, 'geometry 0');
  assert.equal(label.subtitle, 'awaiting estimate');
  assert.deepEqual(label.metrics, []);
  assert.equal(label.texture, null);
});

test('labelPositionForObject anchors the badge above local bounds', () => {
  assert.deepEqual(labelPositionForObject(DUCK), [1, 2.62, 3]);
});

test('labelPositionForObject includes off-center local bounds on every axis', () => {
  assert.deepEqual(
    labelPositionForObject({
      transform: { position: [10, 2, -4], scale: [2, 1, 0.5] },
      localBoundsCenter: [0.5, 0.2, -2],
      localBoundsDimensions: [1, 0.4, 2],
    }),
    [11, 2.62, -5]
  );
});

test('shouldShowObjectInsightLabel respects global toggle and generic scene nodes', () => {
  assert.equal(shouldShowObjectInsightLabel(DUCK, true), true);
  assert.equal(shouldShowObjectInsightLabel(DUCK, false), false);
  assert.equal(shouldShowObjectInsightLabel({ id: 'Room_Mesh', label: 'Room_Mesh' }, true), false);
});
