import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShowtimeSteps,
  nextShowtimeStepIndex,
  showtimeFocusForStep,
} from './showtimeDirector.js';

const DUCK_OBJECT = {
  id: 'duck_01',
  label: 'rubber duck',
  dimensions: [0.6, 0.4, 0.35],
  physics: {
    category: 'toy',
    material: 'rubber',
    massKg: 0.2,
    restitution: 0.85,
    friction: 0.7,
    confidence: 0.91,
    notes: 'VLM identified a soft yellow bath toy.',
  },
  appearance: {
    baseColor: '#ffcc00',
    textureDescription: 'smooth yellow plastic',
    source: 'vlm',
  },
};

test('buildShowtimeSteps creates a presenter-ready sequence from scene metadata', () => {
  const steps = buildShowtimeSteps({
    sceneObjects: [
      DUCK_OBJECT,
      {
        id: 'crate_01',
        label: 'wooden crate',
        physics: { category: 'container', material: 'wood', massKg: 5.5, confidence: 0.82 },
        appearance: { textureDescription: 'rough boards' },
      },
    ],
  });

  assert.equal(steps[0].id, 'scene-read');
  assert.match(steps[0].narrative, /2 editable objects/);
  assert.ok(steps.some((step) => step.id === 'object-duck_01'));
  assert.ok(steps.some((step) => step.id === 'physics-pass'));
  assert.equal(showtimeFocusForStep(steps.find((step) => step.id === 'object-duck_01'), steps), 'duck_01');
  assert.ok(
    steps.find((step) => step.id === 'object-duck_01').facts.some((fact) => /rubber/i.test(fact))
  );
});

test('buildShowtimeSteps includes generated asset status when tasks exist', () => {
  const steps = buildShowtimeSteps({
    sceneObjects: [DUCK_OBJECT],
    generatedTasks: [
      {
        taskId: 'task_1',
        label: 'neon lamp',
        provider: 'meshy',
        status: 'generating',
        progress: 42,
      },
    ],
  });

  const generatedStep = steps.find((step) => step.id === 'ai-assets');
  assert.ok(generatedStep);
  assert.match(generatedStep.narrative, /neon lamp/);
  assert.ok(generatedStep.facts.some((fact) => /42%/.test(fact)));
});

test('buildShowtimeSteps guides the presenter when no scene has been imported', () => {
  const steps = buildShowtimeSteps({ sceneObjects: [] });

  assert.equal(steps[0].id, 'empty-scene');
  assert.equal(showtimeFocusForStep(steps[0], []), null);
  assert.ok(steps.some((step) => step.id === 'ai-assets'));
});

test('nextShowtimeStepIndex clamps and wraps safely', () => {
  assert.equal(nextShowtimeStepIndex(0, 4, 1), 1);
  assert.equal(nextShowtimeStepIndex(3, 4, 1), 0);
  assert.equal(nextShowtimeStepIndex(0, 4, -1), 3);
  assert.equal(nextShowtimeStepIndex(2, 0, 1), 0);
});
