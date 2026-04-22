import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBlueprintInput, validateSeedInput } from './validation';

test('validateBlueprintInput accepts valid payload', () => {
  const value = validateBlueprintInput({
    vibe: 'dark synthwave',
    lyrics: 'city nights',
    durationSeconds: 180,
    sceneLimit: 8,
  });

  assert.equal(value.sceneLimit, 8);
  assert.equal(value.durationSeconds, 180);
});

test('validateBlueprintInput rejects invalid scene limit', () => {
  assert.throws(() => {
    validateBlueprintInput({
      vibe: 'x',
      sceneLimit: 99,
    });
  }, /sceneLimit/);
});

test('validateSeedInput rejects empty prompt', () => {
  assert.throws(() => {
    validateSeedInput({ prompt: '    ' });
  }, /prompt is required/);
});
