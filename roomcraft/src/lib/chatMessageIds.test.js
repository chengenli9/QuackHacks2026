import test from 'node:test';
import assert from 'node:assert/strict';
import { nextChatMessageIdBase } from './chatMessageIds.js';

test('nextChatMessageIdBase starts after restored chat message ids', () => {
  assert.equal(nextChatMessageIdBase([
    { id: 1, text: 'old' },
    { id: 11, text: 'restored' },
    { id: '12', text: 'string id' },
  ], 10), 12);
});

test('nextChatMessageIdBase keeps the fallback for empty or invalid history', () => {
  assert.equal(nextChatMessageIdBase([], 10), 10);
  assert.equal(nextChatMessageIdBase([{ id: 'temp' }], 10), 10);
});
