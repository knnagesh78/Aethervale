import test from 'node:test';
import assert from 'node:assert/strict';
import { constrainTarget, lanternProgress, seededRandom, stillnessGrowth, STILLNESS_INTERVAL, MAX_FLOWERS } from '../src/lib/sanctuary.js';

test('stillness needs two uninterrupted, visible minutes and never removes flowers', () => {
  assert.equal(stillnessGrowth(STILLNESS_INTERVAL - 1, 0, 2), 2);
  assert.equal(stillnessGrowth(STILLNESS_INTERVAL, 0, 2), 3);
  assert.equal(stillnessGrowth(STILLNESS_INTERVAL * 2, STILLNESS_INTERVAL + 1, 2), 2);
  assert.equal(stillnessGrowth(STILLNESS_INTERVAL, 0, 2, false), 2);
  assert.equal(stillnessGrowth(STILLNESS_INTERVAL, 0, MAX_FLOWERS), MAX_FLOWERS);
});

test('camera movement stays inside the island boundary in every direction', () => {
  for (let i = 0; i < 360; i++) {
    const angle = i * Math.PI / 180;
    const [x, z] = constrainTarget(Math.cos(angle) * 100, Math.sin(angle) * 100);
    assert.ok((x / 5) ** 2 + (z / 3.5) ** 2 <= 1.000001);
  }
  assert.deepEqual(constrainTarget(1, 1), [1, 1]);
});

test('lantern path clamps clock skew and expires at the end of the river', () => {
  assert.equal(lanternProgress(1000, 500), 0);
  assert.equal(lanternProgress(1000, 61_000), 0.5);
  assert.equal(lanternProgress(1000, 121_000), 1);
  assert.equal(lanternProgress(1000, 999_999), 1);
});

test('procedural landscape is stable across visitors', () => {
  const a = seededRandom(43), b = seededRandom(43);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});
