import { describe, expect, it, beforeEach } from 'vitest'
import { useSceneStore } from './sceneStore'
import type { SceneObject } from './types'

const sampleObject = (id: string): SceneObject => ({
  id,
  label: `Object ${id}`,
  kind: 'imported',
  visible: true,
  locked: false,
  transform: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  source: { type: 'imported', fileName: 'scene.glb' },
})

describe('scene store reducers', () => {
  beforeEach(() => {
    useSceneStore.getState().clearScene()
  })

  it('adds, updates, selects, hides, locks, and removes objects', () => {
    const store = useSceneStore.getState()

    store.addObject(sampleObject('table'))
    store.selectObject('table')
    store.updateObject('table', { label: 'Coffee Table' })
    store.setVisibility('table', false)
    store.setLocked('table', true)
    store.setTransform('table', { position: [1, 2, 3] })

    const updated = useSceneStore.getState().objects.table
    expect(updated.label).toBe('Coffee Table')
    expect(updated.visible).toBe(false)
    expect(updated.locked).toBe(true)
    expect(updated.transform.position).toEqual([1, 2, 3])
    expect(useSceneStore.getState().selectedId).toBe('table')

    useSceneStore.getState().removeObject('table')

    expect(useSceneStore.getState().objects.table).toBeUndefined()
    expect(useSceneStore.getState().selectedId).toBeNull()
  })
})
