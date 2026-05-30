import test from 'node:test';
import assert from 'node:assert/strict';
import { inferPhysicsProfile } from './physicsProfiles.js';

test('marks generic SceneGen geometry labels for VLM visual estimation', () => {
  const profile = inferPhysicsProfile({ label: 'geometry_12', dimensions: [1, 2, 3] });

  assert.equal(profile.category, 'unknown');
  assert.equal(profile.needsVisualEstimate, true);
  assert.equal(profile.static, false);
  assert.equal(profile.collider, 'convex_hull');
  assert.ok(profile.confidence < 0.5);
});

test('assigns fixed cuboid physics to floor and wall surfaces', () => {
  const floor = inferPhysicsProfile({ label: 'Floor' });
  const wall = inferPhysicsProfile({ label: 'north_wall' });

  assert.equal(floor.static, true);
  assert.equal(floor.collider, 'cuboid');
  assert.equal(floor.massKg, 0);
  assert.equal(wall.static, true);
  assert.equal(wall.collider, 'cuboid');
});

test('assigns bouncy ball physics from label evidence', () => {
  const profile = inferPhysicsProfile({ label: 'rubber_ball' });

  assert.equal(profile.category, 'toy');
  assert.equal(profile.material, 'rubber');
  assert.equal(profile.static, false);
  assert.equal(profile.collider, 'ball');
  assert.ok(profile.restitution >= 0.75);
});

test('assigns fragile cylindrical physics to vase-like objects', () => {
  const profile = inferPhysicsProfile({ label: 'glass vase' });

  assert.equal(profile.category, 'decor');
  assert.equal(profile.material, 'glass');
  assert.equal(profile.breakable, true);
  assert.equal(profile.collider, 'cylinder');
  assert.equal(profile.static, false);
});
