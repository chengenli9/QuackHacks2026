# Backend API

Updated: 2026-05-31

The backend is a Node.js/Fastify TypeScript service. Request bodies, provider responses, and AI/model outputs are validated with Zod.

## Command API

### `POST /api/command`

Parses chat text into a conversational answer, a single validated scene operation, or multiple ordered scene operations. The backend does not mutate scene state.

Request:

```json
{
  "message": "make the duck red and bouncy, make the table metallic and fixed",
  "sceneContext": {
    "objects": [
      { "id": "duck_01", "label": "rubber duck" },
      { "id": "table_01", "label": "coffee table" }
    ],
    "selectedObjectId": "duck_01",
    "gravityEnabled": true,
    "collisionsEnabled": true
  }
}
```

Response:

```json
{
  "operations": [
    { "action": "update_object_appearance", "target": "duck_01", "changes": { "baseColor": "#ff0000" } },
    { "action": "update_object_physics", "target": "duck_01", "changes": { "restitution": 0.85 } }
  ],
  "thoughts": ["1. Update appearance on duck_01.", "2. Update physics on duck_01."],
  "message": "I will run 2 editor tools in order."
}
```

Supported response fields:

- `operation`: one scene operation.
- `operations`: ordered scene operations for multi-step prompts.
- `message`: general conversational answer.
- `thoughts`: optional visible plan/status lines.

Supported operation categories:

- `add_generated_object`
- `add_local_object`
- `remove_object`
- `move_object`
- `rotate_object`
- `scale_object`
- `update_object_physics`
- `update_object_appearance`
- `toggle_gravity`
- `toggle_collisions`
- `export_scene`
- `relabel_object`
- `generate_background_image`
- `generate_environment_scene`

## Object Estimation

### `POST /api/estimate-object`

Estimates semantic, physics, and optional appearance metadata for an imported or generated object.

```ts
type ObjectPhysicsProfile = {
  objectId: string;
  label: string;
  category: "toy" | "furniture" | "container" | "tool" | "decor" | "unknown";
  material: "rubber" | "wood" | "glass" | "metal" | "plastic" | "fabric" | "unknown";
  massKg: number;
  restitution: number;
  friction: number;
  static: boolean;
  breakable: boolean;
  collider: "ball" | "cuboid" | "cylinder" | "convex_hull";
  confidence: number;
  notes?: string;
  appearance?: {
    baseColor: string;
    roughness: number;
    metalness: number;
    textureDescription?: string;
    source?: "vlm" | "local" | "editor" | "import" | "generated" | "default";
  };
};
```

Gemini is used when `GEMINI_API_KEY` is configured. Local rules are used without Gemini, or as fallback when Gemini fails. OpenAI remains available as a secondary object estimator when Gemini is not configured.

## Background Images

### `POST /api/background-image`

Generates a grid-scene-suited background image with Gemini when `GEMINI_API_KEY` is configured.

```ts
type BackgroundImageResponse = {
  provider: "gemini";
  model: string;
  prompt: string;
  revisedPrompt?: string;
  mimeType: string;
  imageDataUrl: string;
};
```

## Generated Assets

### `POST /api/generate-asset`

Starts a Meshy text-to-3D task. The current Meshy flow creates a preview task, then a refine task with PBR/HD texture settings before the generated GLB is exposed.

```ts
type TextAssetGenerationInput = {
  prompt: string;
  style?: "realistic" | "lowpoly" | "cartoon";
  assetType?: "object" | "environment_scene";
  targetFormat: "glb";
};
```

### `GET /api/generated-assets/:id/status`

Returns normalized Meshy preview/refine task status.

```ts
type AssetGenerationTaskStatus = {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress?: number;
  modelUrl?: string;
  error?: string;
};
```

### `GET /api/generated-assets/:id/model`

Returns generated asset metadata and a backend-served GLB URL after the refined Meshy GLB has been cached.

```ts
type GeneratedAsset = {
  id: string;
  provider: "meshy" | "local";
  sourcePrompt: string;
  glbUrl: string;
  cachedGlbUrl?: string;
  originalGlbUrl?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
};
```

### `GET /api/generated-assets/:id/model.glb`

Streams the cached generated GLB.

### `POST /api/generated-assets/fallback`

Returns a deterministic local fallback asset when the requested GLB exists in the fallback asset directory.

```json
{
  "fallbackAssetKey": "duck",
  "sourcePrompt": "rubber duck"
}
```

### `GET /assets/fallback/:file`

Serves fallback GLBs by filename. Missing required files return `FallbackAssetFileMissing`.

## Project Persistence

### `GET /api/projects`

Lists saved project folders.

### `GET /api/projects/last`

Loads the legacy/last project.

### `GET /api/projects/:projectId`

Loads a named saved project.

### `PUT /api/projects/last`

Saves the legacy/last project.

### `PUT /api/projects/:projectId`

Saves a named project folder. Data URL GLBs and generated background data URLs are bundled into project asset/background folders.

### `GET /api/projects/:projectId/assets/:file`

Serves saved project GLB assets.

### `GET /api/projects/:projectId/backgrounds/:file`

Serves saved generated background images.

## Provider Interfaces

```ts
interface AssetGenerator {
  generateFromText(input: TextAssetGenerationInput): Promise<AssetGenerationTask>;
  getTask(taskId: string): Promise<AssetGenerationTaskStatus>;
  getModel(taskId: string): Promise<GeneratedAsset>;
}
```

```ts
interface ObjectPropertyEstimator {
  estimate(input: ObjectEstimateInput): Promise<ObjectPhysicsProfile>;
}
```

## External References

- Meshy Text to 3D API: https://docs.meshy.ai/en/api/text-to-3d
- Meshy Image to 3D API: https://docs.meshy.ai/en/api/image-to-3d
