import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { applyObjectAppearance, prepareEditableObjectMaterials } from './objectAppearance.js';

test('clones imported materials so appearance edits do not leak between objects', () => {
  const shared = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0.1 });
  const first = new Mesh(new BoxGeometry(1, 1, 1), shared);
  const second = new Mesh(new BoxGeometry(1, 1, 1), shared);

  prepareEditableObjectMaterials(first);
  prepareEditableObjectMaterials(second);
  applyObjectAppearance(first, {
    baseColor: '#ffcc00',
    roughness: 0.2,
    metalness: 0.5,
    overrides: { baseColor: true, roughness: true, metalness: true },
  }, 'material');

  assert.notEqual(first.material, second.material);
  assert.equal(first.material.color.getHexString(), 'ffcc00');
  assert.equal(second.material.color.getHexString(), 'ffffff');
  assert.equal(first.material.roughness, 0.2);
  assert.equal(first.material.metalness, 0.5);
});

test('applies wireframe and solid view modes without overwriting preserved material clones', () => {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#336699' }));
  prepareEditableObjectMaterials(mesh);
  const preserved = mesh.userData.roomcraftMaterial;

  applyObjectAppearance(mesh, { baseColor: '#aa5500', overrides: { baseColor: true } }, 'wireframe');
  assert.equal(mesh.material.wireframe, true);
  assert.notEqual(mesh.material, preserved);

  applyObjectAppearance(mesh, { baseColor: '#aa5500', overrides: { baseColor: true } }, 'solid');
  assert.equal(mesh.material.wireframe, false);
  assert.notEqual(mesh.material, preserved);

  applyObjectAppearance(mesh, { baseColor: '#aa5500', overrides: { baseColor: true } }, 'material');
  assert.equal(mesh.material, preserved);
  assert.equal(mesh.material.color.getHexString(), 'aa5500');
});

test('keeps original GLB material color for import appearance in material mode', () => {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#336699' }));
  prepareEditableObjectMaterials(mesh);

  applyObjectAppearance(mesh, {
    baseColor: '#8a8a8a',
    roughness: 0.8,
    metalness: 0.1,
    source: 'import',
  }, 'material');

  assert.equal(mesh.material.color.getHexString(), '336699');
});

test('material property edits do not tint color unless base color is explicitly set', () => {
  const mesh = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: '#336699', roughness: 0.8 })
  );
  prepareEditableObjectMaterials(mesh);

  applyObjectAppearance(mesh, {
    baseColor: null,
    roughness: 0.25,
    metalness: 0.1,
    source: 'editor',
    overrides: { roughness: true },
  }, 'material');

  assert.equal(mesh.material.color.getHexString(), '336699');
  assert.equal(mesh.material.roughness, 0.25);
});

test('VLM appearance metadata does not override authored GLB materials in material mode', () => {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: '#336699' }));
  prepareEditableObjectMaterials(mesh);

  applyObjectAppearance(mesh, {
    baseColor: '#ffcc00',
    roughness: 0.25,
    metalness: 0,
    source: 'vlm',
  }, 'material');

  assert.equal(mesh.material.color.getHexString(), '336699');
});
