export function rapierBodyTypeFor(physics = {}) {
  return physics.static ? 'fixed' : 'dynamic';
}

export function rapierColliderFor(physics = {}) {
  switch (physics.collider) {
    case 'ball':
      return 'ball';
    case 'cuboid':
      return 'cuboid';
    case 'cylinder':
    case 'convex_hull':
      return 'hull';
    default:
      return 'hull';
  }
}
