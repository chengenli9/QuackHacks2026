import { describe, expect, it, vi } from 'vitest'
import { applyImmediateSceneOperation } from './operationDispatcher'
import type { ObjectPhysicsProfile, SceneOperation } from '../schemas'

const physics: ObjectPhysicsProfile = {
  objectId: 'duck_01',
  label: 'Duck',
  category: 'toy',
  material: 'rubber',
  massKg: 0.2,
  restitution: 0.4,
  friction: 0.5,
  static: false,
  breakable: false,
  collider: 'cuboid',
  confidence: 0.7,
}

function makeHandlers() {
  return {
    getPhysics: vi.fn(() => physics),
    removeObject: vi.fn(),
    setTransform: vi.fn(),
    updateObject: vi.fn(),
    setPhysics: vi.fn(),
    setGravity: vi.fn(),
    exportScene: vi.fn(),
  }
}

describe('applyImmediateSceneOperation', () => {
  it.each([
    [{ action: 'remove_object', target: 'duck_01' }, 'removeObject', ['duck_01']],
    [{ action: 'move_object', target: 'duck_01', position: [1, 2, 3] }, 'setTransform', ['duck_01', { position: [1, 2, 3] }]],
    [{ action: 'rotate_object', target: 'duck_01', rotation: [0, 1, 0] }, 'setTransform', ['duck_01', { rotation: [0, 1, 0] }]],
    [{ action: 'scale_object', target: 'duck_01', scale: [2, 2, 2] }, 'setTransform', ['duck_01', { scale: [2, 2, 2] }]],
    [{ action: 'relabel_object', target: 'duck_01', label: 'Bouncy Duck' }, 'updateObject', ['duck_01', { label: 'Bouncy Duck' }]],
    [{ action: 'toggle_gravity', enabled: true }, 'setGravity', [true]],
  ] as const)('dispatches %s', (operation, handlerName, expectedArgs) => {
    const handlers = makeHandlers()

    const handled = applyImmediateSceneOperation(operation as SceneOperation, handlers)

    expect(handled).toBe(true)
    expect(handlers[handlerName]).toHaveBeenCalledWith(...expectedArgs)
  })

  it('merges physics changes with the existing profile', () => {
    const handlers = makeHandlers()

    applyImmediateSceneOperation(
      { action: 'update_object_physics', target: 'duck_01', changes: { restitution: 0.9 } },
      handlers
    )

    expect(handlers.setPhysics).toHaveBeenCalledWith('duck_01', { ...physics, restitution: 0.9 })
  })

  it('dispatches export_scene', () => {
    const handlers = makeHandlers()

    const handled = applyImmediateSceneOperation({ action: 'export_scene' }, handlers)

    expect(handled).toBe(true)
    expect(handlers.exportScene).toHaveBeenCalled()
  })

  it('leaves generated and local object operations for async dispatch', () => {
    const handlers = makeHandlers()

    expect(
      applyImmediateSceneOperation(
        {
          action: 'add_generated_object',
          prompt: 'rubber duck',
          placement: { mode: 'on_floor' },
          fallbackAssetKey: 'duck',
        },
        handlers
      )
    ).toBe(false)
  })
})
