import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { SceneStore, SceneObject, ObjectTransform, SceneMetadata, GenerationTaskState, TransformTool } from './types'
import type { ObjectPhysicsProfile } from '../schemas'

export const useSceneStore = create<SceneStore>()(
  immer((set) => ({
    objects: {},
    selectedId: null,
    activeTool: 'select',
    gravityEnabled: false,
    generationTask: { status: 'idle' },
    sceneMetadata: {
      name: 'Untitled Scene',
      createdAt: Date.now(),
    },

    addObject: (obj: SceneObject) =>
      set((state) => {
        state.objects[obj.id] = obj
      }),

    updateObject: (id: string, patch: Partial<SceneObject>) =>
      set((state) => {
        if (state.objects[id]) {
          Object.assign(state.objects[id], patch)
        }
      }),

    removeObject: (id: string) =>
      set((state) => {
        delete state.objects[id]
        if (state.selectedId === id) {
          state.selectedId = null
        }
      }),

    selectObject: (id: string | null) =>
      set((state) => {
        state.selectedId = id
      }),

    setVisibility: (id: string, visible: boolean) =>
      set((state) => {
        if (state.objects[id]) {
          state.objects[id].visible = visible
        }
      }),

    setLocked: (id: string, locked: boolean) =>
      set((state) => {
        if (state.objects[id]) {
          state.objects[id].locked = locked
        }
      }),

    setTransform: (id: string, transform: Partial<ObjectTransform>) =>
      set((state) => {
        if (state.objects[id]) {
          Object.assign(state.objects[id].transform, transform)
        }
      }),

    setPhysics: (id: string, physics: ObjectPhysicsProfile) =>
      set((state) => {
        if (state.objects[id]) {
          state.objects[id].physics = physics
        }
      }),

    setGravity: (enabled: boolean) =>
      set((state) => {
        state.gravityEnabled = enabled
      }),

    setActiveTool: (tool: TransformTool) =>
      set((state) => {
        state.activeTool = tool
      }),

    setGenerationTask: (taskState: GenerationTaskState) =>
      set((state) => {
        state.generationTask = taskState
      }),

    setSceneMetadata: (meta: Partial<SceneMetadata>) =>
      set((state) => {
        Object.assign(state.sceneMetadata, meta)
      }),

    clearScene: () =>
      set((state) => {
        state.objects = {}
        state.selectedId = null
        state.generationTask = { status: 'idle' }
        state.gravityEnabled = false
      }),
  }))
)
