import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatedTaskDisplayStatus,
  isGeneratedTaskPlaceholderVisible,
  placementPositionForTask,
} from './generatedTaskState.js';

const table = {
  id: 'table_01',
  label: 'coffee table',
  transform: { position: [2, 1, 3] },
  dimensions: [2, 0.6, 1],
};

test('shows placeholders for pending generated asset states only', () => {
  assert.equal(isGeneratedTaskPlaceholderVisible({ status: 'queued' }), true);
  assert.equal(isGeneratedTaskPlaceholderVisible({ status: 'generating' }), true);
  assert.equal(isGeneratedTaskPlaceholderVisible({ status: 'importing_glb' }), true);
  assert.equal(isGeneratedTaskPlaceholderVisible({ status: 'placing_object' }), true);
  assert.equal(isGeneratedTaskPlaceholderVisible({ status: 'fallback_available' }), true);
  assert.equal(isGeneratedTaskPlaceholderVisible({ status: 'ready' }), false);
  assert.equal(isGeneratedTaskPlaceholderVisible({ status: 'failed' }), false);
});

test('places generated asset placeholders on target objects or floor', () => {
  assert.deepEqual(
    placementPositionForTask({ placement: { mode: 'on_object', target: 'table_01' } }, [table]),
    [2, 1.6, 3]
  );
  assert.deepEqual(
    placementPositionForTask({ placement: { mode: 'at_position', position: [5, 1, 2] } }, [table]),
    [5, 1, 2]
  );
  assert.deepEqual(placementPositionForTask({ placement: { mode: 'on_floor' } }, [table]), [0, 0.5, 0]);
});

test('maps backend task states to demo-facing labels', () => {
  assert.equal(generatedTaskDisplayStatus({ status: 'running', progress: 42 }), 'generating 42%');
  assert.equal(generatedTaskDisplayStatus({ status: 'fallback_available' }), 'fallback available');
  assert.equal(generatedTaskDisplayStatus({ status: 'importing_glb' }), 'importing GLB');
});
