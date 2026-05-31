import type { ObjectPhysicsProfile, FallbackAssetKey } from '../schemas'

export type ObjectKind = 'imported' | 'generated' | 'fallback' | 'placeholder'

export type TransformTool = 'select' | 'translate' | 'rotate' | 'scale'

export type ObjectSource =
  | { type: 'imported'; fileName: string }
  | { type: 'generated'; prompt: string; provider: 'meshy'; taskId: string }
  | { type: 'fallback'; key: FallbackAssetKey; prompt: string }
  | { type: 'placeholder'; prompt: string }

export type ObjectTransform = {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export type ObjectBounds = {
  min: [number, number, number]
  max: [number, number, number]
  size: [number, number, number]
  center: [number, number, number]
}

export type GenerationTaskState =
  | { status: 'idle' }
  | { status: 'submitting_prompt'; prompt: string }
  | { status: 'generating_mesh'; taskId: string; prompt: string; progress?: number; placeholderId: string }
  | { status: 'importing_glb'; taskId: string; prompt: string; placeholderId: string }
  | { status: 'placing_object'; objectId: string }
  | { status: 'ready'; objectId: string }
  | { status: 'failed'; taskId?: string; prompt: string; error: string; fallbackKey?: FallbackAssetKey; placeholderId?: string }
  | { status: 'fallback_available'; taskId: string; prompt: string; fallbackKey: FallbackAssetKey; placeholderId: string }

export type SceneObject = {
  id: string
  label: string
  kind: ObjectKind
  visible: boolean
  locked: boolean
  transform: ObjectTransform
  bounds?: ObjectBounds
  physics?: ObjectPhysicsProfile
  source: ObjectSource
  glbUrl?: string
  nodeName?: string
  nodePath?: string
}

export type SceneMetadata = {
  name: string
  importedFileName?: string
  createdAt: number
}

export type SceneStore = {
  objects: Record<string, SceneObject>
  selectedId: string | null
  activeTool: TransformTool
  gravityEnabled: boolean
  generationTask: GenerationTaskState
  sceneMetadata: SceneMetadata

  addObject: (obj: SceneObject) => void
  updateObject: (id: string, patch: Partial<SceneObject>) => void
  removeObject: (id: string) => void
  selectObject: (id: string | null) => void
  setVisibility: (id: string, visible: boolean) => void
  setLocked: (id: string, locked: boolean) => void
  setTransform: (id: string, transform: Partial<ObjectTransform>) => void
  setPhysics: (id: string, physics: ObjectPhysicsProfile) => void
  setGravity: (enabled: boolean) => void
  setActiveTool: (tool: TransformTool) => void
  setGenerationTask: (state: GenerationTaskState) => void
  setSceneMetadata: (meta: Partial<SceneMetadata>) => void
  clearScene: () => void
}
