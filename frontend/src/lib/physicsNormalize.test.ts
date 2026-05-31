import { describe, expect, it } from 'vitest'
import { normalizePhysicsDefaults } from './physicsNormalize'

describe('normalizePhysicsDefaults', () => {
  it.each([
    ['duck', 'rubber duck', 'cuboid', 'toy'],
    ['ball', 'rubber ball', 'ball', 'toy'],
    ['crate', 'wooden crate', 'cuboid', 'container'],
    ['vase', 'glass vase', 'cylinder', 'decor'],
    ['barrel', 'metal barrel', 'cylinder', 'container'],
    ['furniture', 'coffee table furniture', 'cuboid', 'furniture'],
    ['unknown', 'mystery prop', 'cuboid', 'unknown'],
  ] as const)('normalizes %s prompts', (_name, prompt, collider, category) => {
    const profile = normalizePhysicsDefaults('obj_1', prompt, prompt)

    expect(profile.collider).toBe(collider)
    expect(profile.category).toBe(category)
    expect(profile.objectId).toBe('obj_1')
    expect(profile.label).toBe(prompt)
  })
})
