import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackPromptForAssetKey } from './fallbackAssets.js';

test('maps fallback asset keys to user-facing source prompts', () => {
  assert.equal(fallbackPromptForAssetKey('duck'), 'rubber duck');
  assert.equal(fallbackPromptForAssetKey('wooden_crate'), 'wooden crate');
  assert.equal(fallbackPromptForAssetKey('unknown_asset'), 'unknown asset');
});
