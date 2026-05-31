export const DEFAULT_TRANSFORM = Object.freeze({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

export const DEFAULT_APPEARANCE = Object.freeze({
  baseColor: null,
  roughness: 0.8,
  metalness: 0.1,
  textureDescription: '',
  source: 'default',
  overrides: {},
});

const PHYSICS_KEYS = new Set([
  'category',
  'material',
  'massKg',
  'restitution',
  'friction',
  'static',
  'breakable',
  'collider',
  'confidence',
  'notes',
]);

function vec3(value, fallback) {
  return Array.isArray(value) && value.length === 3
    ? value.map((entry) => Number(entry) || 0)
    : [...fallback];
}

function vec3Unit(value, fallback) {
  return Array.isArray(value) && value.length === 3
    ? value.map((entry) => Number(entry) || 1)
    : [...fallback];
}

export function normalizeTransform(transform = {}, center = [0, 0, 0]) {
  return {
    position: vec3(transform.position, center),
    rotation: vec3(transform.rotation, DEFAULT_TRANSFORM.rotation),
    scale: Array.isArray(transform.scale) && transform.scale.length === 3
      ? transform.scale.map((entry) => Number(entry) || 1)
      : [...DEFAULT_TRANSFORM.scale],
  };
}

export function normalizeAppearance(appearance = {}) {
  return {
    ...DEFAULT_APPEARANCE,
    ...appearance,
    baseColor: appearance.baseColor ?? DEFAULT_APPEARANCE.baseColor,
    roughness: Number.isFinite(appearance.roughness)
      ? appearance.roughness
      : DEFAULT_APPEARANCE.roughness,
    metalness: Number.isFinite(appearance.metalness)
      ? appearance.metalness
      : DEFAULT_APPEARANCE.metalness,
    overrides: { ...(appearance.overrides ?? {}) },
  };
}

export function normalizeSceneObject(object) {
  const transform = normalizeTransform(object.transform, object.center ?? DEFAULT_TRANSFORM.position);
  return {
    ...object,
    transform,
    visible: object.visible !== false,
    localBoundsCenter: vec3(object.localBoundsCenter, [0, 0, 0]),
    localBoundsDimensions: vec3Unit(
      object.localBoundsDimensions,
      localBoundsDimensionsFallback(object, transform)
    ),
    appearance: normalizeAppearance(object.appearance),
    transformRevision: object.transformRevision ?? 0,
    physicsRevision: object.physicsRevision ?? 0,
  };
}

function localBoundsDimensionsFallback(object, transform) {
  if (!object.dimensions) return [1, 1, 1];
  return object.dimensions.map((value, index) => Number(value || 1) / safeScale(transform.scale[index]));
}

function safeScale(value) {
  const scale = Number(value);
  return Math.abs(scale) > 1e-8 ? scale : 1;
}

export function updateObjectTransform(sceneObjects, objectId, patch, options = {}) {
  return sceneObjects.map((object) => {
    if (object.id !== objectId) return object;
    const normalized = normalizeSceneObject(object);
    return {
      ...normalized,
      transform: normalizeTransform({ ...normalized.transform, ...patch }, normalized.transform.position),
      transformRevision: options.runtime
        ? normalized.transformRevision
        : normalized.transformRevision + 1,
    };
  });
}

export function updateObjectAppearance(sceneObjects, objectId, patch) {
  return sceneObjects.map((object) => {
    if (object.id !== objectId) return object;
    const normalized = normalizeSceneObject(object);
    const overrides = { ...normalized.appearance.overrides };
    for (const key of ['baseColor', 'roughness', 'metalness']) {
      if (Object.hasOwn(patch, key)) overrides[key] = true;
    }
    return {
      ...normalized,
      appearance: normalizeAppearance({
        ...normalized.appearance,
        ...patch,
        source: patch.source ?? 'editor',
        overrides,
      }),
    };
  });
}

export function updateObjectPhysics(sceneObjects, objectId, patch) {
  return sceneObjects.map((object) => {
    if (object.id !== objectId) return object;
    const normalized = normalizeSceneObject(object);
    return {
      ...normalized,
      physics: { ...normalized.physics, ...patch, source: patch.source ?? 'editor' },
      physicsRevision: normalized.physicsRevision + 1,
    };
  });
}

export function mergeObjectEstimate(sceneObjects, objectId, estimate) {
  const physicsPatch = {};
  for (const [key, value] of Object.entries(estimate ?? {})) {
    if (PHYSICS_KEYS.has(key)) physicsPatch[key] = value;
  }

  return sceneObjects.map((object) => {
    if (object.id !== objectId) return object;
    const normalized = normalizeSceneObject(object);
    return {
      ...normalized,
      label: estimate.label || normalized.label,
      physics: {
        ...normalized.physics,
        ...physicsPatch,
        needsVisualEstimate: false,
        source: 'vlm',
      },
      appearance: normalizeAppearance({
        ...normalized.appearance,
        ...(estimate.appearance ?? {}),
        source: estimate.appearance?.source ?? 'vlm',
        overrides: normalized.appearance.overrides,
      }),
      physicsRevision: normalized.physicsRevision + 1,
    };
  });
}

export function applySceneOperationToState(state, operation) {
  switch (operation.action) {
    case 'move_object':
      return {
        sceneObjects: updateObjectTransform(state.sceneObjects, operation.target, {
          position: operation.position,
        }),
        sceneObjectTransforms: updateSceneObjectTransformMap(state.sceneObjectTransforms, operation.target, {
          position: operation.position,
        }),
        selectedObjectId: operation.target,
      };
    case 'rotate_object':
      return {
        sceneObjects: updateObjectTransform(state.sceneObjects, operation.target, {
          rotation: operation.rotation,
        }),
        sceneObjectTransforms: updateSceneObjectTransformMap(state.sceneObjectTransforms, operation.target, {
          rotation: operation.rotation,
        }),
        selectedObjectId: operation.target,
      };
    case 'scale_object':
      return {
        sceneObjects: updateObjectTransform(state.sceneObjects, operation.target, {
          scale: operation.scale,
        }),
        sceneObjectTransforms: updateSceneObjectTransformMap(state.sceneObjectTransforms, operation.target, {
          scale: operation.scale,
        }),
        selectedObjectId: operation.target,
      };
    case 'update_object_physics':
      return {
        sceneObjects: updateObjectPhysics(state.sceneObjects, operation.target, operation.changes),
        selectedObjectId: operation.target,
      };
    case 'update_object_appearance':
      return {
        sceneObjects: updateObjectAppearance(state.sceneObjects, operation.target, operation.changes),
        selectedObjectId: operation.target,
      };
    case 'remove_object': {
      const sceneObjects = state.sceneObjects.filter((object) => object.id !== operation.target);
      const nextTransforms = { ...(state.sceneObjectTransforms ?? {}) };
      delete nextTransforms[operation.target];
      return {
        sceneObjects,
        sceneObjectTransforms: nextTransforms,
        highlightedObjectId:
          state.highlightedObjectId === operation.target ? null : state.highlightedObjectId,
        selectedObjectId:
          state.selectedObjectId === operation.target
            ? sceneObjects[0]?.id ?? 'Room_Mesh'
            : state.selectedObjectId,
      };
    }
    case 'toggle_gravity':
      return { ...state, gravityEnabled: operation.enabled };
    case 'toggle_collisions':
      return { ...state, collisionsEnabled: operation.enabled };
    case 'relabel_object':
      return {
        sceneObjects: state.sceneObjects.map((object) =>
          object.id === operation.target ? { ...object, label: operation.label } : object
        ),
        selectedObjectId: operation.target,
      };
    case 'export_scene':
      return { ...state, exportRequestedAt: (state.exportRequestedAt ?? 0) + 1 };
    default:
      return {};
  }
}

function updateSceneObjectTransformMap(sceneObjectTransforms = {}, objectId, patch) {
  const current = sceneObjectTransforms[objectId] ?? {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
  return {
    ...sceneObjectTransforms,
    [objectId]: {
      position: patch.position ? [...patch.position] : current.position,
      rotation: patch.rotation ? [...patch.rotation] : current.rotation,
      scale: patch.scale ? [...patch.scale] : current.scale,
    },
  };
}
