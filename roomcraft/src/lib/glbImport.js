import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { configuredApiBaseUrl } from './apiClient.js';
import { applyManifestToSceneObjects } from './manifestImport.js';
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
  manifest,
  assetSource,
}) {
  const loader = new GLTFLoader();
  setGlbImportStatus('loading');
  setVlmEstimateStatus('idle');

  const gltf = await loader.loadAsync(sourceUrl);
  const existingIds = sceneObjects.map((object) => object.id);
  const registry = createSceneObjectRegistry(gltf.scene, { sourceFileName: fileName, existingIds });
  const placedObjects = applyGeneratedPlacement(registry.objects, sceneObjects, placement);
  const objectsWithSource = placedObjects.map((object) => ({
    ...object,
    sourcePrompt,
    source: {
      ...(object.source ?? {}),
      assetId: assetSource?.id ?? object.source?.assetId,
      type: assetSource?.type ?? object.source?.type,
      fileName: assetSource?.fileName ?? object.source?.fileName ?? fileName,
      url: assetSource?.type === 'url' ? assetSource.url : object.source?.url,
      prompt: sourcePrompt,
    },
  }));
  const manifestResult = manifest
    ? applyManifestToSceneObjects(objectsWithSource, manifest)
    : { objects: objectsWithSource, warnings: [] };
  const objects = manifestResult.objects;

  addImportedScene({
    fileName,
    objects,
    warnings: [...registry.warnings, ...manifestResult.warnings],
    assetSource,
  });

  const targets = objects.filter((object) => object.physics.needsVisualEstimate || sourcePrompt);
  if (targets.length === 0) {
    setVlmEstimateStatus('complete');
    return objects;
  }

  setVlmEstimateStatus('estimating');
  const apiBaseUrl = configuredApiBaseUrl();
  let failed = false;
  for (const object of targets) {
    try {
      await deferToBrowser();
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
    await deferToBrowser();
  }
  setVlmEstimateStatus(failed ? 'error' : 'complete');
  return objects;
}

function deferToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
