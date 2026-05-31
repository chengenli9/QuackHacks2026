import { generatedTaskDisplayStatus } from './generatedTaskState.js';

const MAX_OBJECT_STEPS = 3;
const GENERIC_LABELS = new Set(['scene', 'room_mesh', 'imported_glb']);

export function buildShowtimeSteps({ sceneObjects = [], generatedTasks = [] } = {}) {
  const objects = sceneObjects.filter(isPresentableObject);
  const tasks = generatedTasks.filter(Boolean);
  const steps = [];

  if (objects.length === 0) {
    steps.push({
      id: 'empty-scene',
      title: 'Load A Scene',
      narrative: 'Showtime is ready once a GLB scene is imported. The demo can still preview AI asset and export flow while the scene is empty.',
      facts: [
        'Use Import or Load Demo Scene to start the walkthrough.',
        'The presenter overlay will focus objects as soon as metadata exists.',
      ],
    });
  } else {
    steps.push(sceneReadStep(objects));
    for (const object of rankedObjects(objects).slice(0, MAX_OBJECT_STEPS)) {
      steps.push(objectStep(object));
    }
  }

  steps.push(physicsStep(objects));
  steps.push(aiAssetsStep(tasks));
  steps.push(exportStep(objects));

  return steps;
}

export function showtimeFocusForStep(step, sceneObjects = []) {
  if (!step?.objectId) return null;
  if (!Array.isArray(sceneObjects) || sceneObjects.length === 0) return step.objectId;
  const hasObject = sceneObjects.some((object) => object?.id === step.objectId || object?.objectId === step.objectId);
  return hasObject ? step.objectId : null;
}

export function nextShowtimeStepIndex(currentIndex, stepsLength, direction = 1) {
  if (!Number.isFinite(stepsLength) || stepsLength <= 0) return 0;
  const normalizedCurrent = Number.isFinite(currentIndex) ? currentIndex : 0;
  return ((normalizedCurrent + direction) % stepsLength + stepsLength) % stepsLength;
}

function isPresentableObject(object) {
  if (!object?.id) return false;
  const label = String(object.label ?? object.id).trim().toLowerCase();
  return !GENERIC_LABELS.has(label);
}

function sceneReadStep(objects) {
  const labels = objects.slice(0, 5).map(displayLabel).join(', ');
  const categories = uniqueValues(objects.map((object) => object.physics?.category)).slice(0, 4);
  const estimatedCount = objects.filter((object) => object.physics?.source === 'vlm' || object.appearance?.source === 'vlm').length;

  return {
    id: 'scene-read',
    title: 'Scene Read',
    narrative: `${objects.length} editable object${objects.length === 1 ? '' : 's'} are registered with stable IDs, semantic labels, and editor-owned transforms.`,
    facts: [
      labels ? `Objects: ${labels}` : null,
      categories.length ? `Detected categories: ${categories.join(', ')}` : null,
      estimatedCount ? `${estimatedCount} object${estimatedCount === 1 ? '' : 's'} enriched by visual estimation.` : 'Ready for VLM estimation and manifest metadata.',
    ].filter(Boolean),
  };
}

function objectStep(object) {
  const physics = object.physics ?? {};
  const appearance = object.appearance ?? {};
  const facts = [
    physics.category ? `Category: ${physics.category}` : null,
    physics.material ? `Material: ${physics.material}` : null,
    physicsFact(physics),
    appearanceFact(appearance),
    confidenceFact(physics.confidence),
    physics.notes ? `Notes: ${truncateText(physics.notes, 110)}` : null,
  ].filter(Boolean);

  return {
    id: `object-${object.id}`,
    objectId: object.id,
    title: displayLabel(object),
    narrative: objectNarrative(object),
    facts,
  };
}

function physicsStep(objects) {
  const dynamicCount = objects.filter((object) => !object.physics?.static).length;
  const fixedCount = objects.filter((object) => object.physics?.static).length;
  const mostBouncy = objects
    .filter((object) => Number.isFinite(object.physics?.restitution))
    .sort((a, b) => b.physics.restitution - a.physics.restitution)[0];

  return {
    id: 'physics-pass',
    title: 'Physics Pass',
    narrative: 'Editor transforms stay authoritative, while gravity and collisions can be toggled independently for the live simulation.',
    facts: [
      `${dynamicCount} dynamic / ${fixedCount} fixed object${objects.length === 1 ? '' : 's'}.`,
      mostBouncy ? `Most bouncy: ${displayLabel(mostBouncy)} (${formatNumber(mostBouncy.physics.restitution)} restitution).` : 'Physics values are ready for VLM or inspector edits.',
      'The floor collider is part of the demo safety net.',
    ],
  };
}

function aiAssetsStep(tasks) {
  if (tasks.length === 0) {
    return {
      id: 'ai-assets',
      title: 'Agent Tools',
      narrative: 'Chat commands can add props, change object physics, edit materials, move objects, toggle scene systems, and request generated backgrounds.',
      facts: [
        'Try: add a rubber duck on the table.',
        'Try: make this object bouncier.',
        'Try: generate a deep starry night background.',
      ],
    };
  }

  return {
    id: 'ai-assets',
    title: 'AI Asset Pipeline',
    narrative: tasks
      .slice(0, 3)
      .map((task) => `${task.label ?? task.prompt ?? task.taskId}: ${generatedTaskDisplayStatus(task)}`)
      .join(' | '),
    facts: tasks.slice(0, 4).map((task) => {
      const provider = task.provider ? `${task.provider} ` : '';
      return `${provider}${task.label ?? task.prompt ?? task.taskId}: ${generatedTaskDisplayStatus(task)}`;
    }),
  };
}

function exportStep(objects) {
  return {
    id: 'export-save',
    title: 'Save And Export',
    narrative: 'The demo closes by saving the editor project and exporting the GLB plus scene.physics.json so the visual scene and object rules travel together.',
    facts: [
      objects.length ? `${objects.length} object profile${objects.length === 1 ? '' : 's'} will be included.` : 'Export is available once the scene has objects.',
      'Saved projects preserve metadata, generated backgrounds, chat context, and asset sources.',
    ],
  };
}

function rankedObjects(objects) {
  return [...objects].sort((a, b) => objectScore(b) - objectScore(a));
}

function objectScore(object) {
  const physics = object.physics ?? {};
  const appearance = object.appearance ?? {};
  let score = 0;
  if (physics.category) score += 3;
  if (physics.material) score += 2;
  if (appearance.textureDescription) score += 1;
  if (Number.isFinite(physics.confidence)) score += physics.confidence;
  return score;
}

function objectNarrative(object) {
  const physics = object.physics ?? {};
  const category = physics.category ? ` as a ${physics.category}` : '';
  const material = physics.material ? ` made of ${physics.material}` : '';
  return `This object is labeled "${displayLabel(object)}"${category}${material}, with physics values ready for live editing.`;
}

function physicsFact(physics) {
  const parts = [];
  if (physics.static) {
    parts.push('fixed');
  } else {
    parts.push('dynamic');
  }
  if (Number.isFinite(physics.massKg)) parts.push(`${formatNumber(physics.massKg)} kg`);
  if (Number.isFinite(physics.restitution)) parts.push(`${formatNumber(physics.restitution)} bounce`);
  if (Number.isFinite(physics.friction)) parts.push(`${formatNumber(physics.friction)} friction`);
  if (physics.collider) parts.push(`${physics.collider} collider`);
  return parts.length ? `Physics: ${parts.join(', ')}` : null;
}

function appearanceFact(appearance) {
  const parts = [];
  if (appearance.baseColor) parts.push(appearance.baseColor);
  if (Number.isFinite(appearance.roughness)) parts.push(`${formatNumber(appearance.roughness)} roughness`);
  if (Number.isFinite(appearance.metalness)) parts.push(`${formatNumber(appearance.metalness)} metalness`);
  if (appearance.textureDescription) parts.push(truncateText(appearance.textureDescription, 60));
  return parts.length ? `Appearance: ${parts.join(', ')}` : null;
}

function confidenceFact(confidence) {
  if (!Number.isFinite(confidence)) return null;
  return `Estimate confidence: ${Math.round(confidence * 100)}%`;
}

function displayLabel(object) {
  return String(object.label ?? object.id).replaceAll('_', ' ');
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean).map(String)));
}

function truncateText(text, maxLength) {
  const value = String(text);
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`;
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}
