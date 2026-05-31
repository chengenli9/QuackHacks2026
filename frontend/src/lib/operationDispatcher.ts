import type { ObjectPhysicsProfile, SceneOperation } from '../schemas'
import type { ObjectTransform, SceneObject } from '../store/types'

export type ImmediateSceneOperationHandlers = {
  getPhysics: (id: string) => ObjectPhysicsProfile | undefined
  removeObject: (id: string) => void
  setTransform: (id: string, transform: Partial<ObjectTransform>) => void
  updateObject: (id: string, patch: Partial<SceneObject>) => void
  setPhysics: (id: string, physics: ObjectPhysicsProfile) => void
  setGravity: (enabled: boolean) => void
  exportScene: () => void
}

export function applyImmediateSceneOperation(
  operation: SceneOperation,
  handlers: ImmediateSceneOperationHandlers
): boolean {
  switch (operation.action) {
    case 'remove_object':
      handlers.removeObject(operation.target)
      return true

    case 'move_object':
      handlers.setTransform(operation.target, { position: operation.position })
      return true

    case 'rotate_object':
      handlers.setTransform(operation.target, { rotation: operation.rotation })
      return true

    case 'scale_object':
      handlers.setTransform(operation.target, { scale: operation.scale })
      return true

    case 'relabel_object':
      handlers.updateObject(operation.target, { label: operation.label })
      return true

    case 'update_object_physics': {
      const current = handlers.getPhysics(operation.target)
      if (current) {
        handlers.setPhysics(operation.target, { ...current, ...operation.changes })
      }
      return true
    }

    case 'toggle_gravity':
      handlers.setGravity(operation.enabled)
      return true

    case 'export_scene':
      handlers.exportScene()
      return true

    case 'add_generated_object':
    case 'add_local_object':
      return false
  }
}
