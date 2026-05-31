import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editorGravityScale,
  selectViewportObject,
  shouldApplyRuntimePhysicsTransform,
  shouldShowTransformControls,
  transformModeForTool,
} from './editorInteraction.js';

test('selected GLB objects show translate controls even in select mode', () => {
  assert.equal(shouldShowTransformControls({ isSelected: true }), true);
  assert.equal(transformModeForTool('select'), 'translate');
});

test('move rotate and scale tools map to transform control modes', () => {
  assert.equal(transformModeForTool('move'), 'translate');
  assert.equal(transformModeForTool('rotate'), 'rotate');
  assert.equal(transformModeForTool('scale'), 'scale');
});

test('editor drag pauses runtime physics writes while keeping gravity active after release', () => {
  assert.equal(shouldApplyRuntimePhysicsTransform({
    gravityEnabled: true,
    isEditorDragging: true,
    isStatic: false,
  }), false);
  assert.equal(editorGravityScale({ isEditorDragging: true }), 0);

  assert.equal(shouldApplyRuntimePhysicsTransform({
    gravityEnabled: true,
    isEditorDragging: false,
    isStatic: false,
  }), true);
  assert.equal(editorGravityScale({ isEditorDragging: false }), 1);
});

test('viewport object clicks select the object and stop canvas miss propagation', () => {
  let selectedObjectId = null;
  let stopped = false;
  const event = {
    stopPropagation: () => {
      stopped = true;
    },
  };

  selectViewportObject(event, 'geometry_0', (id) => {
    selectedObjectId = id;
  });

  assert.equal(stopped, true);
  assert.equal(selectedObjectId, 'geometry_0');
});
