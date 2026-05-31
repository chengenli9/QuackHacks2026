# Scene-to-3D Physics Sandbox: 24h Hackathon Build Plan

Updated: 2026-05-31

## Final Directive

Build a GLB-import-first R3F/Rapier physics editor where live Meshy asset generation is the primary wow feature.

SceneGen is external preprocessing only. The demo must not depend on live scene reconstruction, but it should depend on live Meshy generation when the API is available. Local GLBs exist as fallback assets, not the main product experience.

## Build Goal

Build a browser-based 3D physics sandbox where users import a pre-generated scene, interact with object-level physics, edit the scene through chat, and live-generate new 3D assets with Meshy.

SceneGen imports completed `scene.glb` and optional `manifest.json` files. The live AI moment comes from Meshy asset insertion rather than live scene reconstruction.

## Core Demo Flow

```text
Load pre-generated SceneGen GLB
-> Register editable scene objects
-> Select/edit objects
-> Infer object metadata and physics
-> Toggle gravity/collisions
-> User says: "add a rubber duck on the table"
-> Backend starts live Meshy generation
-> App shows placeholder/progress state
-> Meshy returns GLB
-> App imports generated asset into the scene
-> App estimates/defaults physics
-> User drops generated asset into physics simulation
-> Export scene.glb and scene.physics.json
```

## Final Architecture

```text
Frontend
  React/Vite app
  R3F/Three viewport
  Rapier physics runtime
  Zustand scene store
  Object inspector
  Chat panel
  Meshy generation status UI
  Import/export controls

Backend
  /api/command
  /api/estimate-object
  /api/generate-asset
  /api/generated-assets/:id/status
  /api/generated-assets/:id/model

External
  SceneGen preprocessing, manual/offline
  Meshy live asset generation
  OpenAI/Gemini VLM for semantic metadata
```

Critical rule:

```text
AI never mutates scene state directly.
AI returns validated structured JSON.
The operation dispatcher applies changes to Zustand.
R3F and Rapier react to state.
```

## Required Stack

Frontend:

- React
- Vite
- JavaScript/JSX
- Three.js
- React Three Fiber
- `@react-three/drei`
- `@react-three/rapier`
- Zustand
- Lucide React
- React Dropzone
- ESLint
- GLTFLoader
- GLTFExporter

Backend:

- Node.js
- Fastify
- TypeScript
- Zod
- Meshy API adapter
- OpenAI or Gemini provider adapter
- Local filesystem storage

Current stack note: the frontend is intentionally JavaScript/JSX for this pass. It does not use frontend TypeScript, immer, or Zod; backend API and model-output validation use TypeScript plus Zod.

## Meshy Priority

Meshy is required for the live demo path. The MVP should implement `/api/generate-asset` so the backend can start a Meshy task from a text prompt.

Meshy text-to-3D uses a preview/refine workflow. The current backend requests GLB output, starts with a preview task, refines the result with PBR/HD texture options, caches the returned model locally, and serves it through the backend so the frontend imports a stable project-owned URL.

Local GLBs are fallback assets only. They keep the demo stable when Meshy is slow, unavailable, rate-limited, or returns a bad model.

Required fallback assets:

- `rubber_ball.glb`
- `wooden_crate.glb`
- `glass_vase.glb`
- `metal_barrel.glb`
- `duck.glb`

Fallback behavior:

```text
If Meshy task fails
-> show "Use fallback asset" button
-> insert closest local asset only after user action
-> continue demo
```

## Live Meshy Asset Flow

Chat command:

```text
add a rubber duck on the table
```

Operation:

```ts
type AddGeneratedObjectOperation = {
  action: "add_generated_object";
  prompt: string;
  placement: AssetPlacement;
  fallbackAssetKey?: string;
};
```

Runtime flow:

```text
User chat command
-> /api/command returns add_generated_object
-> frontend calls /api/generate-asset
-> backend creates Meshy task
-> frontend shows ghost placeholder at placement target
-> frontend polls task status
-> Meshy returns GLB URL
-> backend downloads/caches GLB or proxies signed URL
-> frontend imports GLB
-> object registry assigns app-level ID
-> physics defaults are applied
-> object appears in scene
-> user can drag/drop/simulate it
```

## Frontend Meshy UX

Build these states:

```text
idle
submitting_prompt
generating_mesh
importing_glb
placing_object
ready
failed
fallback_available
```

Scene placeholder:

```text
transparent bounding box
spinner label
"Generating: rubber duck..."
progress percentage if available
```

When GLB is ready:

```text
remove placeholder
import generated mesh
place it on requested target
apply physics
flash/highlight new object
select it automatically
```

## Placement Rules

```ts
type AssetPlacement =
  | { mode: "on_floor" }
  | { mode: "on_object"; target: string }
  | { mode: "at_position"; position: [number, number, number] };
```

Placement logic:

- `on_floor`: place at floor height with slight vertical offset.
- `on_object`: compute target bounds, place generated asset above target bounds center, and offset Y by generated asset half-height.
- `at_position`: use exact position.

Do not ask the model to place objects numerically unless needed. Use scene bounds.

## Physics for Generated Assets

Generated Meshy models should not use exact mesh collisions.

Pipeline:

```text
Meshy GLB imported
-> compute bounds
-> infer label/material/category from original prompt
-> optionally call VLM/object estimator
-> normalize into PhysicsProfile
-> assign simplified collider
```

Default collider rules:

- ball, sphere, marble: ball.
- duck, toy, small object: cuboid or convex hull.
- crate, box: cuboid.
- vase, bottle, cup: cylinder or convex hull.
- furniture: cuboid.
- unknown generated mesh: cuboid.

Avoid dynamic trimesh colliders.

## Updated MVP Feature List

Required:

1. Import pre-generated SceneGen GLB.
2. Import optional `manifest.json`.
3. Register editable objects.
4. Select, move, rotate, and scale objects.
5. Show object inspector.
6. Toggle gravity.
7. Simulate physics with Rapier.
8. Estimate object semantic metadata.
9. Normalize metadata into physics profiles.
10. Parse chat into validated scene operations.
11. Live-generate at least one object with Meshy from chat.
12. Show Meshy task state in UI.
13. Insert generated GLB into scene.
14. Apply physics to generated asset.
15. Provide local fallback asset insertion.
16. Export `scene.glb`.
17. Export `scene.physics.json`.

Optional:

- Meshy refine/texturing step.
- Meshy image-to-3D from generated concept image.
- SSE/webhook progress.
- Tripo fallback.
- GLTF extras metadata.

Out of scope:

- Live SceneGen.
- VGGT.
- Cloud GPU reconstruction jobs.
- Video reconstruction.
- Destruction physics.
- OBJ/STL/USD export.
- Perfect physical accuracy.

## Revised Repo Structure Additions

```text
src/assets/
  assetLibrary.ts
  assetPlacement.ts
  generatedAssetClient.ts

src/components/
  GeneratedAssetStatus.tsx
  GeneratedAssetPlaceholder.tsx

src/scene/
  generatedAssetActions.ts

server/routes/
  generateAsset.ts
  generatedAssetStatus.ts
  generatedAssetModel.ts

server/providers/
  AssetGenerator.ts
  MeshyProvider.ts
  LocalAssetProvider.ts

server/services/
  assetGenerationService.ts
  generatedAssetCache.ts
  meshyTaskStore.ts
```

## Updated Implementation Order

1. GLB editor foundation.
2. Rapier physics.
3. Chat operations.
4. Meshy live generation.
5. Local fallback insertion.
6. VLM semantic estimation.
7. Export.
8. Demo polish.

## Final Demo Script

1. Load curated SceneGen living-room GLB.
2. Show source image next to reconstructed 3D scene.
3. Select table, couch, and vase; show physics metadata.
4. Toggle gravity.
5. Drag an existing object and drop it.
6. Chat: `add a rubber duck on the coffee table`.
7. Show live Meshy generation placeholder/progress.
8. Import returned Meshy GLB into the scene.
9. Auto-place duck on table.
10. Apply physics.
11. Drag duck upward and release.
12. Chat: `make the duck bouncier`.
13. Export `scene.glb` and `scene.physics.json`.

## External References

- Meshy Text to 3D API: https://docs.meshy.ai/en/api/text-to-3d
- Meshy Image to 3D API: https://docs.meshy.ai/en/api/image-to-3d
