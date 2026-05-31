const GENERIC_LABELS = new Set(['room_mesh', 'scene']);

export const PHYSICS_XRAY_LEGEND = Object.freeze([
  {
    key: 'fixed',
    label: 'Fixed',
    color: '#38bdf8',
    description: 'Anchored scene geometry',
  },
  {
    key: 'fragile',
    label: 'Fragile',
    color: '#fb7185',
    description: 'Breakable or delicate',
  },
  {
    key: 'bouncy',
    label: 'Bouncy',
    color: '#facc15',
    description: 'High restitution',
  },
  {
    key: 'heavy',
    label: 'Heavy',
    color: '#fb923c',
    description: 'High mass dynamic',
  },
  {
    key: 'dynamic',
    label: 'Dynamic',
    color: '#4ade80',
    description: 'Gravity-ready object',
  },
]);

const PROFILE_BY_KEY = Object.fromEntries(PHYSICS_XRAY_LEGEND.map((entry) => [entry.key, entry]));

export function physicsXrayProfileForObject(object = {}) {
  const physics = object.physics ?? {};
  if (physics.static) return PROFILE_BY_KEY.fixed;
  if (physics.breakable || /glass|vase|fragile|ceramic/i.test(object.label ?? '')) return PROFILE_BY_KEY.fragile;
  if (Number(physics.restitution) >= 0.65) return PROFILE_BY_KEY.bouncy;
  if (Number(physics.massKg) >= 12) return PROFILE_BY_KEY.heavy;
  return PROFILE_BY_KEY.dynamic;
}

export function shouldShowPhysicsXray(object, enabled) {
  if (!enabled || !object?.id) return false;
  const key = String(object.label ?? object.id).trim().toLowerCase();
  return !GENERIC_LABELS.has(key);
}
