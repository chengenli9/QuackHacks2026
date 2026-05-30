const DEFAULT_FLOOR = {
  position: [0, -0.1, 0],
  args: [40, 0.2, 40],
};

const FLOOR_THICKNESS = 0.2;
const FLOOR_PADDING = 3;

export function floorColliderForSceneObjects(sceneObjects) {
  const bounds = sceneObjects
    .map(boundsForObject)
    .filter((bound) => bound !== null);

  if (!bounds.length) {
    return DEFAULT_FLOOR;
  }

  const minX = Math.min(...bounds.map((bound) => bound.min[0]));
  const minY = Math.min(...bounds.map((bound) => bound.min[1]));
  const minZ = Math.min(...bounds.map((bound) => bound.min[2]));
  const maxX = Math.max(...bounds.map((bound) => bound.max[0]));
  const maxZ = Math.max(...bounds.map((bound) => bound.max[2]));

  return {
    position: [
      round((minX + maxX) / 2),
      round(minY - FLOOR_THICKNESS / 2),
      round((minZ + maxZ) / 2),
    ],
    args: [
      round(maxX - minX + FLOOR_PADDING * 2),
      FLOOR_THICKNESS,
      round(maxZ - minZ + FLOOR_PADDING * 2),
    ],
  };
}

function boundsForObject(object) {
  if (!Array.isArray(object?.center) || !Array.isArray(object?.dimensions)) {
    return null;
  }

  const halfExtents = object.dimensions.map((value) => value / 2);
  return {
    min: object.center.map((value, index) => value - halfExtents[index]),
    max: object.center.map((value, index) => value + halfExtents[index]),
  };
}

function round(value) {
  return Number(value.toFixed(4));
}
