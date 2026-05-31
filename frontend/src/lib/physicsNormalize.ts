import type { ObjectPhysicsProfile, ColliderType } from '../schemas'

type PhysicsDefaults = Omit<ObjectPhysicsProfile, 'objectId' | 'label'>

const PHYSICS_PROFILES: Record<string, PhysicsDefaults> = {
  duck: {
    category: 'toy',
    material: 'rubber',
    massKg: 0.2,
    restitution: 0.6,
    friction: 0.5,
    static: false,
    breakable: false,
    collider: 'cuboid',
    confidence: 0.7,
  },
  ball: {
    category: 'toy',
    material: 'rubber',
    massKg: 0.3,
    restitution: 0.8,
    friction: 0.4,
    static: false,
    breakable: false,
    collider: 'ball',
    confidence: 0.9,
  },
  crate: {
    category: 'container',
    material: 'wood',
    massKg: 5.0,
    restitution: 0.2,
    friction: 0.7,
    static: false,
    breakable: true,
    collider: 'cuboid',
    confidence: 0.85,
  },
  vase: {
    category: 'decor',
    material: 'glass',
    massKg: 0.5,
    restitution: 0.1,
    friction: 0.3,
    static: false,
    breakable: true,
    collider: 'cylinder',
    confidence: 0.8,
  },
  barrel: {
    category: 'container',
    material: 'metal',
    massKg: 8.0,
    restitution: 0.15,
    friction: 0.6,
    static: false,
    breakable: false,
    collider: 'cylinder',
    confidence: 0.8,
  },
  furniture: {
    category: 'furniture',
    material: 'wood',
    massKg: 15.0,
    restitution: 0.1,
    friction: 0.8,
    static: true,
    breakable: false,
    collider: 'cuboid',
    confidence: 0.75,
  },
}

const KEYWORD_COLLIDER_MAP: Array<[RegExp, ColliderType]> = [
  [/\b(ball|sphere|marble)\b/i, 'ball'],
  [/\b(duck|toy|rubber|plush)\b/i, 'cuboid'],
  [/\b(crate|box|chest)\b/i, 'cuboid'],
  [/\b(vase|bottle|cup|jar|cylinder)\b/i, 'cylinder'],
  [/\b(table|chair|couch|sofa|cabinet|shelf|desk|furniture)\b/i, 'cuboid'],
]

export function inferColliderFromPrompt(prompt: string): ColliderType {
  for (const [re, collider] of KEYWORD_COLLIDER_MAP) {
    if (re.test(prompt)) return collider
  }
  return 'cuboid'
}

export function normalizePhysicsDefaults(
  objectId: string,
  label: string,
  prompt?: string
): ObjectPhysicsProfile {
  const text = (prompt ?? label).toLowerCase()

  for (const [key, profile] of Object.entries(PHYSICS_PROFILES)) {
    if (text.includes(key)) {
      return { objectId, label, ...profile }
    }
  }

  const collider = inferColliderFromPrompt(text)
  return {
    objectId,
    label,
    category: 'unknown',
    material: 'unknown',
    massKg: 1.0,
    restitution: 0.3,
    friction: 0.5,
    static: false,
    breakable: false,
    collider,
    confidence: 0.3,
  }
}

export function applyPhysicsChanges(
  profile: ObjectPhysicsProfile,
  changes: Partial<ObjectPhysicsProfile>
): ObjectPhysicsProfile {
  return { ...profile, ...changes }
}
