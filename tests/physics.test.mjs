import test from 'node:test';
import assert from 'node:assert/strict';
import { createJumpState, GRAVITY, JUMP_SPEED, stepJump } from '../src/physics.js';
import { canStand, createTiles, movePlayer } from '../src/movement.js';

test('a grounded jump follows gravity and lands exactly once at y=0', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
    const position = { x: 0, y: 0, z: 0 };
    const state = createJumpState();
    stepJump(position, state, true, dt);
    assert.ok(position.y > 0 && !state.grounded);
    let peak = position.y;
    let steps = 1;
    while (!state.grounded && steps < 200) {
      stepJump(position, state, false, dt);
      peak = Math.max(peak, position.y);
      assert.ok(position.y >= 0);
      steps++;
    }
    assert.equal(position.y, 0);
    assert.equal(state.velocity, 0);
    assert.equal(state.grounded, true);
    assert.ok(Math.abs(peak - JUMP_SPEED ** 2 / (2 * GRAVITY)) < 0.025);
    assert.ok(Math.abs(steps * dt - 2 * JUMP_SPEED / GRAVITY) <= dt + 1e-8);
    stepJump(position, state, false, 0.05);
    assert.equal(position.y, 0, 'landing does not bounce');
    stepJump(position, state, true, 0.05);
    assert.ok(position.y > 0, 'a new grounded press can jump again');
  }
});

test('midair requests do not reset upward or downward velocity', () => {
  const a = { y: 0 }, b = { y: 0 };
  const first = createJumpState(), second = createJumpState();
  for (let i = 0; i < 15; i++) {
    stepJump(a, first, i === 0, 0.05);
    stepJump(b, second, true, 0.05);
    assert.equal(a.y, b.y);
    assert.equal(first.velocity, second.velocity);
  }
  assert.equal(first.grounded, true);
});

test('jumping into every shoreline cannot escape while airborne', () => {
  const tiles = createTiles();
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const position = { x: 0, y: 0, z: 0 };
    const state = createJumpState();
    for (let i = 0; i < 600; i++) {
      movePlayer(position, { x, z }, 0.05, tiles, { x: 21, z: 30 });
      stepJump(position, state, i % 20 === 0, 0.05);
      assert.ok(canStand(tiles, position.x, position.z));
      assert.ok(position.y >= 0);
    }
  }
});

test('long and invalid frame durations are clamped without sinking or teleporting', () => {
  const position = { y: 0 }, state = createJumpState();
  stepJump(position, state, true, -1);
  assert.equal(position.y, 0);
  stepJump(position, state, true, 40);
  assert.ok(position.y < 0.4 && position.y > 0);
});
