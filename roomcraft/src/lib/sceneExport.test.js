import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhysicsExport, exportSceneArtifacts } from './sceneExport.js';

const sceneObjects = [
  {
    id: 'duck_01',
    label: 'rubber duck',
    nodeName: 'geometry_0',
    transform: { position: [1, 2, 3], rotation: [0, 0.1, 0], scale: [1, 1, 1] },
    dimensions: [0.2, 0.15, 0.2],
    center: [1, 2, 3],
    physics: {
      category: 'toy',
      material: 'rubber',
      massKg: 0.2,
      restitution: 0.75,
      friction: 0.55,
      static: false,
      breakable: false,
      collider: 'cuboid',
      confidence: 0.87,
      notes: 'Estimated from VLM.',
      source: 'vlm',
    },
    appearance: {
      baseColor: '#ffdd22',
      roughness: 0.7,
      metalness: 0,
      textureDescription: 'yellow rubber',
      source: 'vlm',
    },
    source: { type: 'generated', prompt: 'rubber duck' },
  },
];

test('builds scene.physics.json without non-serializable object3d data', () => {
  const output = buildPhysicsExport(sceneObjects);

  assert.equal(output.version, 1);
  assert.equal(output.objects.length, 1);
  assert.deepEqual(output.objects[0], {
    id: 'duck_01',
    label: 'rubber duck',
    nodeName: 'geometry_0',
    transform: { position: [1, 2, 3], rotation: [0, 0.1, 0], scale: [1, 1, 1] },
    dimensions: [0.2, 0.15, 0.2],
    center: [1, 2, 3],
    physics: sceneObjects[0].physics,
    appearance: sceneObjects[0].appearance,
    source: { type: 'generated', prompt: 'rubber duck' },
  });
  assert.equal(Object.hasOwn(output.objects[0], 'object3d'), false);
});

test('exports scene GLB and physics JSON through injected writers', async () => {
  const writes = [];
  await exportSceneArtifacts({
    sceneObjects,
    exportName: 'demo-scene',
    writeFile: async (fileName, contents, mimeType) => writes.push({ fileName, contents, mimeType }),
    exportGlb: async () => new ArrayBuffer(4),
  });

  assert.deepEqual(writes.map((write) => write.fileName), ['demo-scene.glb', 'demo-scene.physics.json']);
  assert.equal(writes[0].mimeType, 'model/gltf-binary');
  assert.equal(writes[1].mimeType, 'application/json');
  assert.match(String(writes[1].contents), /"rubber duck"/);
});
