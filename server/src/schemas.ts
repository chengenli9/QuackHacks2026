import { z } from "zod";

export const providerSchema = z.enum(["meshy", "local"]);
export const generatedProviderSchema = z.literal("meshy");
export const taskStatusSchema = z.enum(["queued", "running", "succeeded", "failed"]);
export const styleSchema = z.enum(["realistic", "lowpoly", "cartoon"]);

export const textAssetGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1).max(600),
  style: styleSchema.optional(),
  targetFormat: z.literal("glb")
});

export const assetGenerationTaskSchema = z.object({
  taskId: z.string().min(1),
  provider: generatedProviderSchema,
  status: taskStatusSchema
});

export const assetGenerationTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: taskStatusSchema,
  progress: z.number().min(0).max(100).optional(),
  modelUrl: z.string().url().optional(),
  error: z.string().optional()
});

export const generatedAssetSchema = z.object({
  id: z.string().min(1),
  provider: providerSchema,
  sourcePrompt: z.string().min(1),
  glbUrl: z.string().url(),
  cachedGlbUrl: z.string().url().optional(),
  originalGlbUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const fallbackAssetKeySchema = z.enum([
  "rubber_ball",
  "wooden_crate",
  "glass_vase",
  "metal_barrel",
  "duck"
]);

export const fallbackAssetRequestSchema = z.object({
  fallbackAssetKey: fallbackAssetKeySchema,
  sourcePrompt: z.string().trim().min(1).max(600)
});

export const generatedAssetParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const assetPlacementSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("on_floor") }),
  z.object({ mode: z.literal("on_object"), target: z.string().min(1) }),
  z.object({ mode: z.literal("at_position"), position: vector3Schema })
]);

export const physicsChangesSchema = z
  .object({
    massKg: z.number().positive().optional(),
    restitution: z.number().min(0).max(1).optional(),
    friction: z.number().min(0).max(1).optional(),
    static: z.boolean().optional(),
    breakable: z.boolean().optional(),
    collider: z.enum(["ball", "cuboid", "cylinder", "convex_hull"]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one physics property must be changed"
  });

export const appearanceChangesSchema = z
  .object({
    baseColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    roughness: z.number().min(0).max(1).optional(),
    metalness: z.number().min(0).max(1).optional(),
    textureDescription: z.string().min(1).max(300).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one appearance property must be changed"
  });

export const sceneOperationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_generated_object"),
    prompt: z.string().min(1),
    placement: assetPlacementSchema,
    fallbackAssetKey: fallbackAssetKeySchema.optional()
  }),
  z.object({
    action: z.literal("add_local_object"),
    fallbackAssetKey: fallbackAssetKeySchema,
    placement: assetPlacementSchema
  }),
  z.object({ action: z.literal("remove_object"), target: z.string().min(1) }),
  z.object({
    action: z.literal("move_object"),
    target: z.string().min(1),
    position: vector3Schema
  }),
  z.object({
    action: z.literal("rotate_object"),
    target: z.string().min(1),
    rotation: vector3Schema
  }),
  z.object({
    action: z.literal("scale_object"),
    target: z.string().min(1),
    scale: vector3Schema
  }),
  z.object({
    action: z.literal("update_object_physics"),
    target: z.string().min(1),
    changes: physicsChangesSchema
  }),
  z.object({
    action: z.literal("update_object_appearance"),
    target: z.string().min(1),
    changes: appearanceChangesSchema
  }),
  z.object({ action: z.literal("toggle_gravity"), enabled: z.boolean() }),
  z.object({ action: z.literal("toggle_collisions"), enabled: z.boolean() }),
  z.object({ action: z.literal("export_scene") }),
  z.object({
    action: z.literal("relabel_object"),
    target: z.string().min(1),
    label: z.string().min(1)
  }),
  z.object({
    action: z.literal("generate_background_image"),
    prompt: z.string().trim().min(1).max(600)
  })
]);

const sceneContextObjectSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.string().optional(),
  material: z.string().optional(),
  position: vector3Schema.optional(),
  dimensions: vector3Schema.optional(),
  static: z.boolean().optional()
});

export const commandRequestSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  sceneContext: z
    .object({
      objects: z.array(sceneContextObjectSchema).default([]),
      selectedObjectId: z.string().optional(),
      gravityEnabled: z.boolean().optional(),
      collisionsEnabled: z.boolean().optional()
    })
    .default({ objects: [] })
});

export const commandResponseSchema = z.object({
  operation: sceneOperationSchema
});

export const objectCategorySchema = z.enum([
  "toy",
  "furniture",
  "container",
  "tool",
  "decor",
  "unknown"
]);

export const materialSchema = z.enum([
  "rubber",
  "wood",
  "glass",
  "metal",
  "plastic",
  "fabric",
  "unknown"
]);

export const colliderSchema = z.enum(["ball", "cuboid", "cylinder", "convex_hull"]);

export const appearanceProfileSchema = z.object({
  baseColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  roughness: z.number().min(0).max(1),
  metalness: z.number().min(0).max(1),
  textureDescription: z.string().optional(),
  source: z.enum(["vlm", "local", "editor", "import", "generated", "default"]).optional()
});

export const estimateObjectRequestSchema = z.object({
  objectId: z.string().min(1),
  label: z.string().trim().min(1).optional(),
  sourcePrompt: z.string().trim().min(1).optional(),
  dimensions: vector3Schema.optional(),
  meshMetadata: z.record(z.string(), z.unknown()).optional(),
  imageBase64: z.string().min(1).optional(),
  imageMimeType: z.string().min(1).optional()
});

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
  collider: colliderSchema,
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
  appearance: appearanceProfileSchema.optional()
});

export const backgroundImageRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(600)
});

export const backgroundImageResponseSchema = z.object({
  provider: z.literal("gemini"),
  model: z.string().min(1),
  prompt: z.string().min(1),
  revisedPrompt: z.string().optional(),
  mimeType: z.string().min(1),
  imageDataUrl: z.string().startsWith("data:image/")
});

export type TextAssetGenerationInput = z.infer<typeof textAssetGenerationInputSchema>;
export type AssetGenerationTask = z.infer<typeof assetGenerationTaskSchema>;
export type AssetGenerationTaskStatus = z.infer<typeof assetGenerationTaskStatusSchema>;
export type GeneratedAsset = z.infer<typeof generatedAssetSchema>;
export type FallbackAssetKey = z.infer<typeof fallbackAssetKeySchema>;
export type FallbackAssetRequest = z.infer<typeof fallbackAssetRequestSchema>;
export type AssetPlacement = z.infer<typeof assetPlacementSchema>;
export type SceneOperation = z.infer<typeof sceneOperationSchema>;
export type CommandRequest = z.infer<typeof commandRequestSchema>;
export type ObjectEstimateInput = z.infer<typeof estimateObjectRequestSchema>;
export type ObjectPhysicsProfile = z.infer<typeof objectPhysicsProfileSchema>;
export type ObjectAppearanceProfile = z.infer<typeof appearanceProfileSchema>;
export type BackgroundImageRequest = z.infer<typeof backgroundImageRequestSchema>;
export type BackgroundImageResponse = z.infer<typeof backgroundImageResponseSchema>;
