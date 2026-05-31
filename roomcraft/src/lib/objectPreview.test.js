import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import {
  createObjectPreviewRendererManager,
  dataUrlToImagePayload,
  renderObjectPreviewToDataUrl,
} from './objectPreview.js';

test('extracts mime type and base64 image data from preview data URLs', () => {
  assert.deepEqual(dataUrlToImagePayload('data:image/png;base64,abc123'), {
    imageMimeType: 'image/png',
    imageBase64: 'abc123',
  });
});

test('rejects non-image preview data URLs', () => {
  assert.throws(() => dataUrlToImagePayload('data:text/plain;base64,abc123'), /image data URL/);
});

test('preview renderer manager reuses one WebGL renderer until explicitly released', () => {
  const renderers = [];
  const manager = createObjectPreviewRendererManager({
    createRenderer: () => {
      const renderer = {
        id: renderers.length + 1,
        disposeCalls: 0,
        contextLossCalls: 0,
        domElement: { removeCalls: 0, remove() { this.removeCalls += 1; } },
        dispose() { this.disposeCalls += 1; },
        forceContextLoss() { this.contextLossCalls += 1; },
      };
      renderers.push(renderer);
      return renderer;
    },
  });

  assert.equal(manager.getRenderer(), manager.getRenderer());
  assert.equal(renderers.length, 1);

  manager.releaseRenderer();

  assert.equal(renderers[0].disposeCalls, 1);
  assert.equal(renderers[0].contextLossCalls, 1);
  assert.equal(renderers[0].domElement.removeCalls, 1);
  assert.notEqual(manager.getRenderer(), renderers[0]);
  assert.equal(renderers.length, 2);
});

test('preview renderer manager recreates the renderer after context loss', () => {
  const renderers = [];
  const manager = createObjectPreviewRendererManager({
    createRenderer: () => {
      const renderer = {
        contextLost: false,
        disposeCalls: 0,
        contextLossCalls: 0,
        domElement: { remove() {} },
        getContext() {
          return { isContextLost: () => this.contextLost };
        },
        dispose() { this.disposeCalls += 1; },
        forceContextLoss() { this.contextLossCalls += 1; },
      };
      renderers.push(renderer);
      return renderer;
    },
  });
  const first = manager.getRenderer();
  first.contextLost = true;

  const second = manager.getRenderer();

  assert.notEqual(second, first);
  assert.equal(renderers.length, 2);
  assert.equal(first.disposeCalls, 1);
  assert.equal(first.contextLossCalls, 1);
});

test('object preview rendering reuses an injected renderer across renders', () => {
  const originalDocument = globalThis.document;
  globalThis.document = {};
  const renderers = [];
  const manager = createObjectPreviewRendererManager({
    createRenderer: () => {
      const renderer = {
        renderCalls: 0,
        domElement: {
          toDataURL: () => 'data:image/png;base64,preview',
          remove() {},
        },
        setSize() {},
        setClearColor() {},
        render() { this.renderCalls += 1; },
      };
      renderers.push(renderer);
      return renderer;
    },
  });
  const object = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());

  try {
    assert.equal(renderObjectPreviewToDataUrl(object, { rendererManager: manager }), 'data:image/png;base64,preview');
    assert.equal(renderObjectPreviewToDataUrl(object, { rendererManager: manager }), 'data:image/png;base64,preview');
    assert.equal(renderers.length, 1);
    assert.equal(renderers[0].renderCalls, 2);
  } finally {
    object.geometry.dispose();
    object.material.dispose();
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
});
