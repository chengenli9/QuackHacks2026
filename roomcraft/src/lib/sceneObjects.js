import { Box3, Vector3 } from 'three';
import { inferPhysicsProfile, isGenericSceneNodeLabel } from './physicsProfiles.js';

const GENERIC_CONTAINER_NAMES = new Set(['', 'scene', 'root', 'gltfscene', 'gltf_scene']);

export function createSceneObjectRegistry(root, { sourceFileName = null } = {}) {
  if (!root) {
    return {
      sourceFileName,
      objects: [],
      warnings: ['No GLB scene root was provided.'],
    };
  }

  root.updateWorldMatrix?.(true, true);

  const nodes = findRenderableObjectRoots(root);
  const usedIds = new Map();
  const objects = nodes.map((node, index) => {
    const label = cleanLabel(node.name) || `geometry_${index}`;
    const id = uniqueId(slugify(label) || `geometry_${index}`, usedIds);
    const bounds = boundsFor(node);
    const meshStats = meshStatsFor(node);

    node.userData.roomcraftObjectId = id;
    node.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return {
      id,
      label,
      nodeName: node.name || label,
      sourceFileName,
      object3d: node,
      meshCount: meshStats.meshCount,
      vertexCount: meshStats.vertexCount,
      triangleCount: meshStats.triangleCount,
      dimensions: bounds.dimensions,
      center: bounds.center,
      physics: inferPhysicsProfile({ label, dimensions: bounds.dimensions }),
    };
  });

  const warnings = [];
  if (objects.length === 0) {
    warnings.push('Imported GLB does not contain renderable mesh objects.');
  } else if (objects.length === 1) {
    warnings.push(
      'Imported GLB exposes a single renderable object; separate physics values will apply to that merged object.'
    );
  }

  return { sourceFileName, objects, warnings };
}

export function findRenderableObjectRoots(root) {
  if (isRenderableMesh(root)) return [root];

  let current = root;
  for (let depth = 0; depth < 8; depth += 1) {
    const children = directRenderableChildren(current);

    if (children.length === 0) {
      return hasRenderableMesh(current) ? [current] : [];
    }

    if (
      children.length === 1 &&
      !isRenderableMesh(children[0]) &&
      isGenericContainerName(current.name)
    ) {
      const grandChildren = directRenderableChildren(children[0]);
      const shouldDescend =
        isGenericContainerName(children[0].name) ||
        grandChildren.some((child) => isGenericSceneNodeLabel(child.name));

      if (shouldDescend) {
        current = children[0];
        continue;
      }
    }

    return children;
  }

  return directRenderableChildren(current);
}

function directRenderableChildren(node) {
  return node.children.filter((child) => hasRenderableMesh(child));
}

function hasRenderableMesh(node) {
  let found = false;
  node.traverse((child) => {
    if (isRenderableMesh(child)) found = true;
  });
  return found;
}

function isRenderableMesh(node) {
  return Boolean(node?.isMesh && node.geometry);
}

function isGenericContainerName(name = '') {
  return GENERIC_CONTAINER_NAMES.has(name.trim().toLowerCase());
}

function cleanLabel(label = '') {
  return label.trim().replace(/\s+/g, '_');
}

function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function uniqueId(baseId, usedIds) {
  const count = usedIds.get(baseId) ?? 0;
  usedIds.set(baseId, count + 1);
  return count === 0 ? baseId : `${baseId}_${count + 1}`;
}

function boundsFor(node) {
  const box = new Box3().setFromObject(node);
  const size = new Vector3();
  const center = new Vector3();

  if (box.isEmpty()) {
    return { dimensions: [0, 0, 0], center: [0, 0, 0] };
  }

  box.getSize(size);
  box.getCenter(center);

  return {
    dimensions: [size.x, size.y, size.z],
    center: [center.x, center.y, center.z],
  };
}

function meshStatsFor(node) {
  const stats = { meshCount: 0, vertexCount: 0, triangleCount: 0 };

  node.traverse((child) => {
    if (!isRenderableMesh(child)) return;

    stats.meshCount += 1;
    const positionCount = child.geometry.attributes.position?.count ?? 0;
    const indexCount = child.geometry.index?.count ?? 0;
    stats.vertexCount += positionCount;
    stats.triangleCount += indexCount > 0 ? indexCount / 3 : positionCount / 3;
  });

  stats.triangleCount = Math.round(stats.triangleCount);
  return stats;
}
