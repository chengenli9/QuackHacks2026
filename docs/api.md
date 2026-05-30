# Backend API

Updated: 2026-05-30

The backend is a Node.js/Fastify service. All request and response bodies should be validated with Zod.

## Endpoints

### `POST /api/command`

Parses chat text into a validated scene operation. The backend should not mutate scene state.

Request:

```json
{
  "message": "add a rubber duck on the coffee table",
  "sceneContext": {
    "objects": [
      { "id": "coffee_table_01", "label": "coffee table" }
    ]
  }
}
```

Response:

```json
{
  "operation": {
    "action": "add_generated_object",
    "prompt": "rubber duck",
    "placement": {
      "mode": "on_object",
      "target": "coffee_table_01"
    },
    "fallbackAssetKey": "duck"
  }
}
```

### `POST /api/estimate-object`

Estimates semantic and physics metadata for an imported or generated object.

Response shape:

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
};
```

### `POST /api/generate-asset`

Starts a live asset generation task. Meshy is the primary provider; local assets are fallback only.

Request:

```ts
type TextAssetGenerationInput = {
  prompt: string;
  style?: "realistic" | "lowpoly" | "cartoon";
  targetFormat: "glb";
};
```

Response:

```ts
type AssetGenerationTask = {
  taskId: string;
  provider: "meshy";
  status: "queued" | "running" | "succeeded" | "failed";
};
```

Implementation notes:

- Meshy text-to-3D uses `POST /openapi/v2/text-to-3d`.
- The MVP should create a preview task first with `mode: "preview"` and `target_formats: ["glb"]`.
- Refine/texturing is optional for the hackathon path.
- Store enough local task metadata to map Meshy task IDs back to prompts, fallback keys, and cached output paths.

### `GET /api/generated-assets/:id/status`

Returns normalized status for a generated asset task.

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

Returns or redirects to the generated GLB.

```ts
type GeneratedAsset = {
  id: string;
  provider: "meshy" | "local";
  sourcePrompt: string;
  glbUrl: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
};
```

### `POST /api/generated-assets/fallback`

Inserts a deterministic local fallback asset after a Meshy task fails or times out. This action should be explicit in the UI.

Request:

```json
{
  "fallbackAssetKey": "duck",
  "sourcePrompt": "rubber duck"
}
```

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

## Scene Operations

```ts
type AddGeneratedObjectOperation = {
  action: "add_generated_object";
  prompt: string;
  placement: AssetPlacement;
  fallbackAssetKey?: string;
};
```

Supported operation categories:

- `add_generated_object`
- `add_local_object`
- `remove_object`
- `move_object`
- `rotate_object`
- `scale_object`
- `update_object_physics`
- `toggle_gravity`
- `export_scene`
- `relabel_object`

## External References

- Meshy Text to 3D API: https://docs.meshy.ai/en/api/text-to-3d
- Meshy Image to 3D API: https://docs.meshy.ai/en/api/image-to-3d
