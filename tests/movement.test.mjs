import test from 'node:test';
import assert from 'node:assert/strict';
import { canStand, createTiles, movePlayer, WALK_SPEED } from '../src/movement.js';

const tiles = createTiles();
const camera = { x: 21, z: 30 };

test('spawn is walkable; water and cut-away island corners are not', () => {
  assert.equal(canStand(tiles, 0, 0), true);
  assert.equal(canStand(tiles, 18, 0), false);
  assert.equal(canStand(tiles, 16, 12), false);
  assert.equal(canStand(tiles, 16.8, 0), false);
});

test('diagonal movement has the same speed as one direction', () => {
  const straight = movePlayer({ x: 0, z: 0 }, { x: 0, z: 1 }, 0.05, tiles, camera);
  const diagonal = movePlayer({ x: 0, z: 0 }, { x: 1, z: 1 }, 0.05, tiles, camera);
  assert.ok(Math.abs(straight.distance - WALK_SPEED * 0.05) < 1e-10);
  assert.ok(Math.abs(diagonal.distance - straight.distance) < 1e-10);
  assert.ok(straight.x < 0 && straight.z < 0, 'forward follows the camera heading');
});

test('a long frame cannot teleport the character off the island', () => {
  const position = { x: 0, z: 0 };
  const result = movePlayer(position, { x: 1, z: 1 }, 30, tiles, camera);
  assert.ok(result.distance <= WALK_SPEED * 0.05 + 1e-10);
  assert.ok(canStand(tiles, position.x, position.z));
});

test('sustained input at every shoreline leaves the whole footprint on land', () => {
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const position = { x: 0, z: 0 };
    for (let i = 0; i < 1200; i++) {
      movePlayer(position, { x, z }, 0.05, tiles, camera);
      assert.ok(canStand(tiles, position.x, position.z), `walked off land with ${x},${z}`);
    }
  }
});
