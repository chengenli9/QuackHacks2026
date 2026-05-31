import test from 'node:test';
import assert from 'node:assert/strict';
import { dataUrlToImagePayload } from './objectPreview.js';

test('extracts mime type and base64 image data from preview data URLs', () => {
  assert.deepEqual(dataUrlToImagePayload('data:image/png;base64,abc123'), {
    imageMimeType: 'image/png',
    imageBase64: 'abc123',
  });
});

test('rejects non-image preview data URLs', () => {
  assert.throws(() => dataUrlToImagePayload('data:text/plain;base64,abc123'), /image data URL/);
});
