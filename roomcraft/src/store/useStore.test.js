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
