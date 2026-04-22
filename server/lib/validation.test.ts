import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBlueprintRequest, validateSeedRequest } from './validation';

test('validateBlueprintRequest accepts valid payload', () => {
  const result = validateBlueprintRequest({
    vibe: 'Neon city pop',
    lyrics: 'Lights, shadows, and rhythm',
    durationSeconds: 180,
    sceneLimit: 8,
    userId: 'user_123',
  });

  assert.equal(result.vibe, 'Neon city pop');
  assert.equal(result.sceneLimit, 8);
  assert.equal(result.userId, 'user_123');
});

test('validateBlueprintRequest rejects scene limits out of bounds', () => {
  assert.throws(
    () =>
      validateBlueprintRequest({
        vibe: 'test',
        sceneLimit: 99,
      }),
    /sceneLimit must be between/,
  );
});

test('validateSeedRequest enforces prompt length', () => {
  assert.throws(() => validateSeedRequest({ prompt: 'hi' }), /at least/);
  assert.throws(() => validateSeedRequest({ prompt: 'x'.repeat(401) }), /exceeds/);

  const valid = validateSeedRequest({ prompt: 'cinematic synthwave skyline' });
  assert.equal(valid.prompt, 'cinematic synthwave skyline');
});
