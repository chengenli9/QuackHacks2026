import { z } from 'zod'

export const vector3Schema = z.tuple([z.number(), z.number(), z.number()])

export const assetPlacementSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('on_floor') }),
  z.object({ mode: z.literal('on_object'), target: z.string().min(1) }),
  z.object({ mode: z.literal('at_position'), position: vector3Schema }),
])

export const colliderTypeSchema = z.enum(['ball', 'cuboid', 'cylinder', 'convex_hull'])
export const taskStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed'])
export const objectCategorySchema = z.enum(['toy', 'furniture', 'container', 'tool', 'decor', 'unknown'])
export const materialSchema = z.enum(['rubber', 'wood', 'glass', 'metal', 'plastic', 'fabric', 'unknown'])
export const fallbackAssetKeySchema = z.enum(['rubber_ball', 'wooden_crate', 'glass_vase', 'metal_barrel', 'duck'])

export const objectPhysicsProfileSchema = z.object({
  objectId: z.string().min(1),
  label: z.string().min(1),
  category: objectCategorySchema,
  material: materialSchema,
  massKg: z.number().positive(),
  restitution: z.number().min(0).max(1),
  friction: z.number().min(0).max(1),
  static: z.boolean(),
  breakable: z.boolean(),
  collider: colliderTypeSchema,
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
})

export const physicsChangesSchema = z.object({
  massKg: z.number().positive().optional(),
  restitution: z.number().min(0).max(1).optional(),
  friction: z.number().min(0).max(1).optional(),
  static: z.boolean().optional(),
  breakable: z.boolean().optional(),
  collider: colliderTypeSchema.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' })

export const sceneOperationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add_generated_object'),
    prompt: z.string().min(1),
    placement: assetPlacementSchema,
    fallbackAssetKey: fallbackAssetKeySchema.optional(),
  }),
  z.object({
    action: z.literal('add_local_object'),
    fallbackAssetKey: fallbackAssetKeySchema,
    placement: assetPlacementSchema,
  }),
  z.object({ action: z.literal('remove_object'), target: z.string().min(1) }),
  z.object({ action: z.literal('move_object'), target: z.string().min(1), position: vector3Schema }),
  z.object({ action: z.literal('rotate_object'), target: z.string().min(1), rotation: vector3Schema }),
  z.object({ action: z.literal('scale_object'), target: z.string().min(1), scale: vector3Schema }),
  z.object({
    action: z.literal('update_object_physics'),
    target: z.string().min(1),
    changes: physicsChangesSchema,
  }),
  z.object({ action: z.literal('toggle_gravity'), enabled: z.boolean() }),
  z.object({ action: z.literal('export_scene') }),
  z.object({ action: z.literal('relabel_object'), target: z.string().min(1), label: z.string().min(1) }),
])

export const commandResponseSchema = z.object({
  operation: sceneOperationSchema,
})

export const assetGenerationTaskSchema = z.object({
  taskId: z.string().min(1),
  provider: z.literal('meshy'),
  status: taskStatusSchema,
})

export const assetGenerationTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: taskStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  modelUrl: z.string().url().optional(),
  error: z.string().optional(),
})

export const generatedAssetSchema = z.object({
  id: z.string().min(1),
  provider: z.enum(['meshy', 'local']),
  sourcePrompt: z.string().min(1),
  glbUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const estimateObjectRequestSchema = z.object({
  objectId: z.string().min(1),
  label: z.string().trim().min(1).optional(),
  sourcePrompt: z.string().trim().min(1).optional(),
  dimensions: vector3Schema.optional(),
  meshMetadata: z.record(z.string(), z.unknown()).optional(),
})

export type Vector3 = z.infer<typeof vector3Schema>
export type AssetPlacement = z.infer<typeof assetPlacementSchema>
export type ColliderType = z.infer<typeof colliderTypeSchema>
export type TaskStatus = z.infer<typeof taskStatusSchema>
export type ObjectCategory = z.infer<typeof objectCategorySchema>
export type Material = z.infer<typeof materialSchema>
export type FallbackAssetKey = z.infer<typeof fallbackAssetKeySchema>
export type ObjectPhysicsProfile = z.infer<typeof objectPhysicsProfileSchema>
export type PhysicsChanges = z.infer<typeof physicsChangesSchema>
export type SceneOperation = z.infer<typeof sceneOperationSchema>
export type CommandResponse = z.infer<typeof commandResponseSchema>
export type AssetGenerationTask = z.infer<typeof assetGenerationTaskSchema>
export type AssetGenerationTaskStatus = z.infer<typeof assetGenerationTaskStatusSchema>
export type GeneratedAsset = z.infer<typeof generatedAssetSchema>
