import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { createSceneObjectRegistry } from './sceneObjects.js';

const material = new MeshBasicMaterial();

function mesh(name, size = [1, 1, 1]) {
  const object = new Mesh(new BoxGeometry(...size), material);
  object.name = name;
  return object;
}

test('uses SceneGen geometry nodes as separate scene objects', () => {
  const root = new Object3D();
  root.name = 'Scene';
  root.add(mesh('geometry_0', [1, 2, 3]), mesh('geometry_1', [2, 1, 1]));

  const registry = createSceneObjectRegistry(root, { sourceFileName: 'room.glb' });

  assert.deepEqual(registry.objects.map((object) => object.nodeName), ['geometry_0', 'geometry_1']);
  assert.deepEqual(registry.objects.map((object) => object.id), ['geometry_0', 'geometry_1']);
  assert.equal(registry.objects[0].meshCount, 1);
  assert.equal(registry.objects[0].physics.needsVisualEstimate, true);
});

test('descends through a single generic scene wrapper before separating objects', () => {
  const root = new Object3D();
  const wrapper = new Object3D();
  wrapper.name = 'Scene';
  wrapper.add(mesh('geometry_0'), mesh('geometry_1'));
  root.add(wrapper);

  const registry = createSceneObjectRegistry(root);

  assert.deepEqual(registry.objects.map((object) => object.nodeName), ['geometry_0', 'geometry_1']);
});

test('creates stable unique ids when GLB nodes reuse the same label', () => {
  const root = new Object3D();
  root.add(mesh('chair'), mesh('chair'), mesh('chair'));

  const registry = createSceneObjectRegistry(root);

  assert.deepEqual(registry.objects.map((object) => object.id), ['chair', 'chair_2', 'chair_3']);
});

test('warns when a GLB only exposes one merged renderable object', () => {
  const root = new Object3D();
  root.add(mesh('merged_room'));

  const registry = createSceneObjectRegistry(root);

  assert.equal(registry.objects.length, 1);
  assert.match(registry.warnings[0], /single renderable object/i);
});
