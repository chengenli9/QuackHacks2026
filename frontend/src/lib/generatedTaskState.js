export const PLACEHOLDER_STATUSES = new Set([
  'queued',
  'running',
  'generating',
  'importing_glb',
  'placing_object',
  'fallback_available',
  'loading-fallback',
  'fallback-ready',
]);

export function isGeneratedTaskPlaceholderVisible(task) {
  return PLACEHOLDER_STATUSES.has(task?.status);
}

export function generatedTaskDisplayStatus(task) {
  if (!task) return 'idle';
  const normalized = task.status === 'running' ? 'generating' : task.status;
  const label = normalized.replaceAll('_', ' ').replace(/\bglb\b/i, 'GLB');
  return Number.isFinite(task.progress) ? `${label} ${task.progress}%` : label;
}

export function placementPositionForTask(task, sceneObjects) {
  const placement = task?.placement;

  if (placement?.mode === 'at_position') {
    return placement.position;
  }

  if (placement?.mode === 'on_object') {
    const target = sceneObjects.find((object) => object.id === placement.target);
    if (target) {
      const position = target.transform?.position ?? target.center ?? [0, 0, 0];
      const height = target.dimensions?.[1] ?? 0;
      return [position[0], position[1] + height / 2 + 0.3, position[2]];
    }
  }

  return [0, 0.5, 0];
}
