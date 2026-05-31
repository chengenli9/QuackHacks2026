import { MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { normalizeAppearance } from './sceneState.js';

const SOLID_COLOR = '#9aa0a6';
const WIREFRAME_COLOR = '#00e5cc';

export function prepareEditableObjectMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.material = cloneMaterial(child.material);
    child.userData.roomcraftMaterial = child.material;
  });
}

export function applyObjectAppearance(root, appearanceInput, viewMode = 'material') {
  const appearance = normalizeAppearance(appearanceInput);

  root.traverse((child) => {
    if (child.isMesh) applyMeshAppearance(child, appearance, viewMode);
  });
}

function applyMeshAppearance(mesh, appearance, viewMode) {
  ensureMaterialCache(mesh);

  if (viewMode === 'wireframe') {
    if (!mesh.userData.roomcraftWireframeMaterial) {
      mesh.userData.roomcraftWireframeMaterial = new MeshBasicMaterial({
        color: WIREFRAME_COLOR,
        wireframe: true,
      });
    }
    mesh.material = mesh.userData.roomcraftWireframeMaterial;
    return;
  }

  if (viewMode === 'solid') {
    if (!mesh.userData.roomcraftSolidMaterial) {
      mesh.userData.roomcraftSolidMaterial = new MeshStandardMaterial({
        color: SOLID_COLOR,
        roughness: 0.85,
        metalness: 0.05,
      });
    }
    mesh.material = mesh.userData.roomcraftSolidMaterial;
    return;
  }

  const material = mesh.userData.roomcraftMaterial;
  mesh.material = material;

  const overrides = appearance.overrides ?? {};
  if (!overrides.baseColor && !overrides.roughness && !overrides.metalness) {
    return;
  }

  for (const item of materialsFor(material)) {
    if (overrides.baseColor && 'color' in item && appearance.baseColor) item.color.set(appearance.baseColor);
    if (overrides.roughness && 'roughness' in item) item.roughness = appearance.roughness;
    if (overrides.metalness && 'metalness' in item) item.metalness = appearance.metalness;
    item.wireframe = false;
    item.needsUpdate = true;
  }
}

function ensureMaterialCache(mesh) {
  if (!mesh.userData.roomcraftMaterial) {
    mesh.userData.roomcraftMaterial = cloneMaterial(mesh.material);
    mesh.material = mesh.userData.roomcraftMaterial;
  }
}

function cloneMaterial(material) {
  if (Array.isArray(material)) return material.map((entry) => entry.clone());
  return material?.clone ? material.clone() : material;
}

function materialsFor(material) {
  return Array.isArray(material) ? material : [material];
}
