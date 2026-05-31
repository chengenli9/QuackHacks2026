import { prepareEditableObjectMaterials } from './objectAppearance.js';

const MIN_ENV_MAP_INTENSITY = 1.4;

export function prepareImportedObjectVisuals(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    for (const material of materialsFor(child.material)) {
      if (!material) continue;

      if ('envMapIntensity' in material) {
        const currentIntensity = Number.isFinite(material.envMapIntensity)
          ? material.envMapIntensity
          : 1;
        material.envMapIntensity = Math.max(currentIntensity, MIN_ENV_MAP_INTENSITY);
      }

      if ('toneMapped' in material) {
        material.toneMapped = true;
      }

      material.needsUpdate = true;
    }
  });

  prepareEditableObjectMaterials(root);
}

function materialsFor(material) {
  return Array.isArray(material) ? material : [material];
}
