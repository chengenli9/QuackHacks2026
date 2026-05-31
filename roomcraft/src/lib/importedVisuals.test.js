import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshStandardMaterial, BoxGeometry } from 'three';
import { prepareImportedObjectVisuals } from './importedVisuals.js';

test('raises imported material environment intensity for brighter GLB rendering', () => {
  const material = new MeshStandardMaterial({ color: '#333333' });
  material.envMapIntensity = 0.2;
  const initialVersion = material.version;
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);

  prepareImportedObjectVisuals(mesh);

  assert.equal(material.envMapIntensity, 1.4);
  assert.equal(material.version, initialVersion + 1);
});

test('does not darken materials that already request stronger environment lighting', () => {
  const material = new MeshStandardMaterial({ color: '#333333' });
  material.envMapIntensity = 2;
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);

  prepareImportedObjectVisuals(mesh);

  assert.equal(material.envMapIntensity, 2);
});
