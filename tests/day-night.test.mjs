import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePhase, CYCLE_SECONDS, getDayNightState, TIME_PRESETS } from '../src/day-night.js';

test('day and night presets provide opposite lights and stars with a visibility floor', () => {
  const day = getDayNightState(TIME_PRESETS.day);
  const night = getDayNightState(TIME_PRESETS.night);
  assert.equal(day.daylight, 1);
  assert.equal(day.stars, 0);
  assert.equal(day.moonIntensity, 0);
  assert.equal(night.daylight, 0);
  assert.equal(night.stars, 1);
  assert.equal(night.sunIntensity, 0);
  assert.ok(night.ambientIntensity >= 0.85 && night.moonIntensity > 1);
  assert.ok(getDayNightState(TIME_PRESETS.sunset).twilight > 0.8);
});

test('sun and moon move in opposing arcs as time advances', () => {
  for (let i = 0; i < 100; i++) {
    const state = getDayNightState(i / 100);
    assert.equal(state.sun.x, -state.moon.x);
    assert.equal(state.sun.y, -state.moon.y);
  }
  assert.notDeepEqual(getDayNightState(0.4).sun, getDayNightState(0.6).sun);
});

test('a complete cycle wraps continuously and is independent of frame subdivisions', () => {
  let phase = 0.62;
  for (let i = 0; i < CYCLE_SECONDS * 60; i++) phase = advancePhase(phase, 1 / 60);
  assert.ok(Math.abs(phase - 0.62) < 1e-10);
  assert.ok(Math.abs(advancePhase(0.999, 1) - (0.999 + 1 / CYCLE_SECONDS - 1)) < 1e-10);
  const before = getDayNightState(0.999999), after = getDayNightState(0.000001);
  assert.ok(Math.abs(before.daylight - after.daylight) < 1e-4);
  assert.ok(Math.abs(before.stars - after.stars) < 1e-4);
});

test('lighting stays bounded and smooth across dawn and dusk', () => {
  let previous = getDayNightState(0);
  for (let i = 1; i <= 10000; i++) {
    const current = getDayNightState(i / 10000);
    for (const field of ['daylight', 'twilight', 'stars']) {
      assert.ok(current[field] >= 0 && current[field] <= 1);
      assert.ok(Math.abs(current[field] - previous[field]) < 0.01);
    }
    previous = current;
  }
  assert.equal(getDayNightState(1.5).time, '12:00');
});
