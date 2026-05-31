import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { configuredApiBaseUrl } from './apiClient.js';
import { createSceneObjectRegistry } from './sceneObjects.js';
import { requestVisualPhysicsEstimate } from './objectEstimatorClient.js';
import { dataUrlToImagePayload, renderObjectPreviewToDataUrl } from './objectPreview.js';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export async function loadGlbIntoScene({
  sourceUrl,
  fileName,
  sceneObjects,
  addImportedScene,
  setGlbImportStatus,
  setVlmEstimateStatus,
  mergeSceneObjectEstimate,
  addGlbImportWarning,
  sourcePrompt,
  placement,
}) {
  const loader = new GLTFLoader();
  setGlbImportStatus('loading');
  setVlmEstimateStatus('idle');

  const gltf = await loader.loadAsync(sourceUrl);
  const existingIds = sceneObjects.map((object) => object.id);
  const registry = createSceneObjectRegistry(gltf.scene, { sourceFileName: fileName, existingIds });
  const placedObjects = applyGeneratedPlacement(registry.objects, sceneObjects, placement);
  const objects = placedObjects.map((object) => ({
    ...object,
    sourcePrompt,
    source: {
      ...(object.source ?? {}),
      prompt: sourcePrompt,
    },
  }));

  addImportedScene({ fileName, objects, warnings: registry.warnings });

  const targets = objects.filter((object) => object.physics.needsVisualEstimate || sourcePrompt);
  if (targets.length === 0) {
    setVlmEstimateStatus('complete');
    return;
  }

  setVlmEstimateStatus('estimating');
  const apiBaseUrl = configuredApiBaseUrl();
  let failed = false;
  for (const object of targets) {
    try {
      const payload = dataUrlToImagePayload(renderObjectPreviewToDataUrl(object.object3d));
      const estimate = await requestVisualPhysicsEstimate({
        apiBaseUrl,
        object,
        sourcePrompt,
        ...payload,
      });
      if (estimate) mergeSceneObjectEstimate(object.id, estimate);
    } catch (error) {
      failed = true;
      addGlbImportWarning(`VLM estimate failed for ${object.label}: ${errorMessage(error)}`);
    }
  }
  setVlmEstimateStatus(failed ? 'error' : 'complete');
}

function applyGeneratedPlacement(objects, sceneObjects, placement) {
  if (!placement || objects.length === 0) return objects;
  const [primary, ...rest] = objects;
  const targetPosition = placementPosition(primary, sceneObjects, placement);
  return [
    {
      ...primary,
      transform: {
        ...primary.transform,
        position: targetPosition,
      },
    },
    ...rest,
  ];
}

function placementPosition(object, sceneObjects, placement) {
  if (placement.mode === 'at_position') return placement.position;

  if (placement.mode === 'on_object') {
    const target = sceneObjects.find((candidate) => candidate.id === placement.target);
    if (target) {
      const targetPosition = target.transform?.position ?? target.center ?? [0, 0, 0];
      const targetHeight = target.dimensions?.[1] ?? 0;
      const objectHeight = object.dimensions?.[1] ?? 0;
      return [
        targetPosition[0],
        targetPosition[1] + targetHeight / 2 + objectHeight / 2 + 0.05,
        targetPosition[2],
      ];
    }
  }

  const objectHeight = object.dimensions?.[1] ?? 0;
  return [0, objectHeight / 2 + 0.05, 0];
}
