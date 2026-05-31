import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSceneObjectRegistry } from './sceneObjects.js';
import { normalizeSceneObject } from './sceneState.js';

export async function restoreSceneObjectsFromAssets({ sceneObjects = [], assetSources = [] }) {
  const loader = new GLTFLoader();
  const restored = [];
  const warnings = [];
  const assigned = new Set();

  for (const asset of assetSources) {
    const savedObjects = sceneObjects.filter((object) => object.source?.assetId === asset.id);
    if (savedObjects.length === 0) continue;

    const sourceUrl = sourceUrlForAsset(asset);
    if (!sourceUrl) {
      warnings.push(`Saved asset ${asset.fileName ?? asset.id} has no reloadable GLB source.`);
      restored.push(...metadataOnly(savedObjects));
      savedObjects.forEach((object) => assigned.add(object.id));
      continue;
    }

    try {
      const gltf = await loader.loadAsync(sourceUrl);
      const registry = createSceneObjectRegistry(gltf.scene, {
        sourceFileName: asset.fileName,
        existingIds: restored.map((object) => object.id),
      });
      const merged = mergeRuntimeObjectsWithSavedMetadata(registry.objects, savedObjects, asset);
      restored.push(...merged.objects);
      warnings.push(...merged.warnings);
      savedObjects.forEach((object) => assigned.add(object.id));
    } catch (error) {
      warnings.push(`Could not reload ${asset.fileName ?? asset.id}: ${errorMessage(error)}`);
      restored.push(...metadataOnly(savedObjects));
      savedObjects.forEach((object) => assigned.add(object.id));
    }
  }

  const unassigned = sceneObjects.filter((object) => !assigned.has(object.id));
  if (unassigned.length > 0) {
    restored.push(...metadataOnly(unassigned));
    warnings.push(`${unassigned.length} saved object(s) restored as metadata only because no GLB source was saved.`);
  }

  return { objects: restored, warnings };
}

function mergeRuntimeObjectsWithSavedMetadata(runtimeObjects, savedObjects, asset) {
  const remaining = [...savedObjects];
  const warnings = [];
  const objects = runtimeObjects.map((runtimeObject, index) => {
    const saved = takeSavedMatch(remaining, runtimeObject, index);
    if (!saved) {
      warnings.push(`Reloaded ${runtimeObject.label} from ${asset.fileName ?? asset.id}, but no saved metadata matched it.`);
      return normalizeSceneObject({
        ...runtimeObject,
        source: { ...(runtimeObject.source ?? {}), assetId: asset.id },
      });
    }

    const savedData = { ...saved };
    delete savedData.object3d;
    delete savedData.restoredMetadataOnly;
    const id = savedData.id ?? runtimeObject.id;
    runtimeObject.object3d.userData.roomcraftObjectId = id;

    return normalizeSceneObject({
      ...runtimeObject,
      ...savedData,
      object3d: runtimeObject.object3d,
      restoredMetadataOnly: false,
      source: {
        ...(runtimeObject.source ?? {}),
        ...(savedData.source ?? {}),
        assetId: asset.id,
        fileName: asset.fileName ?? savedData.source?.fileName ?? runtimeObject.source?.fileName,
      },
    });
  });

  if (remaining.length > 0) {
    objects.push(...metadataOnly(remaining));
    warnings.push(`${remaining.length} saved object(s) from ${asset.fileName ?? asset.id} were restored as metadata only.`);
  }

  return { objects, warnings };
}

function takeSavedMatch(remaining, runtimeObject, index) {
  const byNode = remaining.findIndex((saved) => saved.nodeName && saved.nodeName === runtimeObject.nodeName);
  if (byNode >= 0) return remaining.splice(byNode, 1)[0];

  const byLabel = remaining.findIndex((saved) => saved.label && saved.label === runtimeObject.label);
  if (byLabel >= 0) return remaining.splice(byLabel, 1)[0];

  if (index < remaining.length) return remaining.splice(index, 1)[0];
  return null;
}

function metadataOnly(objects) {
  return objects.map((object) => {
    const saved = { ...object };
    delete saved.object3d;
    return normalizeSceneObject({
      ...saved,
      restoredMetadataOnly: true,
    });
  });
}

function sourceUrlForAsset(asset) {
  return asset.dataUrl || asset.url || asset.glbUrl || null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
