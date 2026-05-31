import test from 'node:test';
import assert from 'node:assert/strict';
import { applyManifestToSceneObjects, parseSceneManifest } from './manifestImport.js';

const sceneObject = (overrides = {}) => ({
  id: 'geometry_0',
  label: 'geometry_0',
  nodeName: 'geometry_0',
  physics: {
    massKg: 1,
    restitution: 0.2,
    friction: 0.5,
    static: false,
    breakable: false,
    collider: 'cuboid',
    source: 'label-rule',
  },
  appearance: {
    baseColor: null,
    roughness: 0.8,
    metalness: 0.1,
    textureDescription: '',
    source: 'import',
  },
  ...overrides,
});

test('parses manifest entries from arrays and keyed objects', () => {
  const manifest = parseSceneManifest({
    objects: {
      geometry_0: { label: 'coffee table', category: 'furniture' },
      vase_1: { material: 'glass' },
    },
  });

  assert.equal(manifest.entries.length, 2);
  assert.deepEqual(manifest.entries.map((entry) => entry.id), ['geometry_0', 'vase_1']);
});

test('merges manifest semantic physics and appearance metadata by id or label', () => {
  const result = applyManifestToSceneObjects(
    [sceneObject(), sceneObject({ id: 'vase_1', label: 'vase', nodeName: 'SceneGen_Vase' })],
    {
      objects: [
        {
          id: 'geometry_0',
          label: 'coffee table',
          category: 'furniture',
          material: 'wood',
          confidence: 0.91,
          notes: 'Manifest-provided table metadata.',
          physics: { static: true, massKg: 25, friction: 0.7 },
          appearance: { baseColor: '#6b4423', roughness: 0.55, textureDescription: 'dark wood' },
        },
        {
          nodeName: 'SceneGen_Vase',
          material: 'glass',
          physics: { breakable: true, collider: 'cylinder' },
        },
      ],
    }
  );

  assert.equal(result.objects[0].label, 'coffee table');
  assert.equal(result.objects[0].physics.category, 'furniture');
  assert.equal(result.objects[0].physics.material, 'wood');
  assert.equal(result.objects[0].physics.static, true);
  assert.equal(result.objects[0].physics.massKg, 25);
  assert.equal(result.objects[0].physics.source, 'manifest');
  assert.equal(result.objects[0].appearance.baseColor, '#6b4423');
  assert.equal(result.objects[0].appearance.textureDescription, 'dark wood');
  assert.equal(result.objects[1].physics.material, 'glass');
  assert.equal(result.objects[1].physics.breakable, true);
  assert.equal(result.objects[1].physics.collider, 'cylinder');
  assert.deepEqual(result.warnings, []);
});

test('reports unmatched manifest entries and objects without manifest metadata', () => {
  const result = applyManifestToSceneObjects(
    [sceneObject(), sceneObject({ id: 'crate_1', label: 'crate' })],
    {
      objects: [
        { id: 'unknown_1', label: 'unknown object' },
        { id: 'geometry_0', category: 'furniture' },
      ],
    }
  );

  assert.equal(result.objects[0].physics.category, 'furniture');
  assert.ok(result.warnings.some((warning) => warning.includes('unknown_1')));
  assert.ok(result.warnings.some((warning) => warning.includes('crate')));
});
