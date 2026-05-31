import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertImageForSceneGenUpload,
  sceneGenUploadNeedsJpegConversion,
  submitSceneGenJob,
} from './sceneGenClient.js';

test('sceneGenUploadNeedsJpegConversion keeps native SceneGen web formats unchanged', () => {
  assert.equal(sceneGenUploadNeedsJpegConversion(new File(['jpg'], 'room.jpg', { type: 'image/jpeg' })), false);
  assert.equal(sceneGenUploadNeedsJpegConversion(new File(['png'], 'room.png', { type: 'image/png' })), false);
  assert.equal(sceneGenUploadNeedsJpegConversion(new File(['webp'], 'room.webp', { type: 'image/webp' })), false);
});

test('sceneGenUploadNeedsJpegConversion detects HEIC and other non-native image formats', () => {
  assert.equal(sceneGenUploadNeedsJpegConversion(new File(['heic'], 'room.HEIC', { type: 'image/heic' })), true);
  assert.equal(sceneGenUploadNeedsJpegConversion(new File(['heif'], 'room.heif', { type: 'image/heif' })), true);
  assert.equal(sceneGenUploadNeedsJpegConversion(new File(['tif'], 'room.tiff', { type: 'image/tiff' })), true);
  assert.equal(sceneGenUploadNeedsJpegConversion(new File(['bmp'], 'room.bmp', { type: 'image/bmp' })), true);
});

test('convertImageForSceneGenUpload posts unsupported photos to the jpeg conversion endpoint', async () => {
  let requestUrl;
  let requestInit;
  const input = new File(['fake heic bytes'], 'Living Room.HEIC', {
    type: 'image/heic',
    lastModified: 123,
  });

  const converted = await convertImageForSceneGenUpload(input, {
    apiBaseUrl: 'http://localhost:8787/',
    fetchImpl: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return new Response(new Blob(['jpg bytes'], { type: 'image/jpeg' }), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      });
    },
  });

  assert.equal(requestUrl, 'http://localhost:8787/api/convert-image/jpeg');
  assert.equal(requestInit.method, 'POST');
  assert.equal(requestInit.headers['Content-Type'], 'image/heic');
  assert.equal(requestInit.headers['X-File-Name'], 'Living%20Room.HEIC');
  assert.equal(requestInit.body, input);
  assert.equal(converted.name, 'Living Room.jpg');
  assert.equal(converted.type, 'image/jpeg');
  assert.equal(converted.lastModified, 123);
  assert.equal(await converted.text(), 'jpg bytes');
});

test('convertImageForSceneGenUpload returns native image files without a conversion request', async () => {
  const input = new File(['jpg bytes'], 'room.jpg', { type: 'image/jpeg' });
  const converted = await convertImageForSceneGenUpload(input, {
    fetchImpl: async () => {
      throw new Error('fetch should not be called for native jpg input');
    },
  });

  assert.equal(converted, input);
});

test('submitSceneGenJob uploads the converted jpeg file for HEIC input', async () => {
  const requests = [];
  let uploadedImage;
  const input = new File(['fake heic bytes'], 'room.heic', { type: 'image/heic' });

  const job = await submitSceneGenJob({
    baseUrl: 'https://scenegen.example',
    conversionApiBaseUrl: 'http://localhost:8787',
    image: input,
    fetchImpl: async (url, init) => {
      requests.push(url);
      if (url === 'http://localhost:8787/api/convert-image/jpeg') {
        return new Response(new Blob(['converted jpg'], { type: 'image/jpeg' }), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      uploadedImage = init.body.get('image');
      return new Response(JSON.stringify({ job_id: 'job_123', status: 'queued' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.deepEqual(requests, [
    'http://localhost:8787/api/convert-image/jpeg',
    'https://scenegen.example/v1/jobs',
  ]);
  assert.equal(uploadedImage.name, 'room.jpg');
  assert.equal(uploadedImage.type, 'image/jpeg');
  assert.equal(await uploadedImage.text(), 'converted jpg');
  assert.equal(job.jobId, 'job_123');
});
