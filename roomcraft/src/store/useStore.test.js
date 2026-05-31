import test from 'node:test';
import assert from 'node:assert/strict';
import useStore from './useStore.js';

test('requestGlbImport switches to the video tab and increments the import request token', () => {
  useStore.setState({ leftPanelTab: 'chat', glbImportRequestId: 3 });

  useStore.getState().requestGlbImport();

  const state = useStore.getState();
  assert.equal(state.leftPanelTab, 'video');
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
