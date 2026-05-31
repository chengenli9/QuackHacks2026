import test from 'node:test';
import assert from 'node:assert/strict';
import {
  operationsFromCommandResponse,
  toolCallLabel,
  visibleThoughtsFromCommandResponse,
} from './agentCommandResponse.js';

test('operationsFromCommandResponse supports legacy single and multi-operation responses', () => {
  const operation = { action: 'toggle_gravity', enabled: false };
  const operations = [
    operation,
    { action: 'move_object', target: 'duck_01', position: [1, 2, 3] },
  ];

  assert.deepEqual(operationsFromCommandResponse({ operation }), [operation]);
  assert.deepEqual(operationsFromCommandResponse({ operations }), operations);
  assert.deepEqual(operationsFromCommandResponse({ message: 'hello' }), []);
});

test('visibleThoughtsFromCommandResponse keeps only visible string plan lines', () => {
  assert.deepEqual(
    visibleThoughtsFromCommandResponse({ thoughts: ['Plan one', '', null, 'Plan two'] }),
    ['Plan one', 'Plan two']
  );
  assert.deepEqual(visibleThoughtsFromCommandResponse({}), []);
});

test('toolCallLabel formats editor tools for chat status bubbles', () => {
  assert.equal(toolCallLabel({ action: 'toggle_gravity', enabled: true }), 'toggle_gravity(on)');
  assert.equal(
    toolCallLabel({ action: 'generate_background_image', prompt: 'neon horizon' }),
    'generate_background_image("neon horizon")'
  );
});
