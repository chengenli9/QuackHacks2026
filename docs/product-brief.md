# Product Brief

Updated: 2026-05-31

## Build Goal

PRISM: Physics-aware Room Import, Segmentation, and Manipulation is a GLB-import-first 3D physics editor where users load a pre-generated scene, interact with object-level physics/materials, edit the scene through chat, generate new 3D assets with Meshy, generate backgrounds with Gemini, save projects, and export the updated scene.

SceneGen remains outside the critical runtime path. It can be used manually or through a later preprocessing pipeline, but the live demo does not depend on runtime scene reconstruction.

## Product Promise

The user can turn a reconstructed 3D scene into an editable physics sandbox. The most visible AI moments are asking for new objects or environment/background changes in chat, watching generation state, and seeing validated edits applied directly to the editor.

## Main User Flow

```text
Load pre-generated SceneGen GLB
-> Register editable scene objects
-> Select and inspect objects
-> Estimate or merge object metadata and physics
-> Toggle gravity/collisions/floor/overlays
-> Drag objects with editor-authoritative transforms
-> User asks: "add a rubber duck on the table"
-> Backend starts Meshy preview/refine generation
-> App shows placeholder and progress state
-> Backend caches/proxies the refined textured GLB
-> App imports generated GLB into the scene
-> App estimates/defaults physics and appearance metadata
-> User asks: "make the duck red and bouncy"
-> Chat returns ordered validated tool calls
-> Save project or export scene.glb and scene.physics.json
```

## Current MVP Capabilities

1. Import pre-generated SceneGen/user GLBs.
2. Import optional `manifest.json`.
3. Register editable objects from GLB nodes.
4. Select objects from viewport and outliner.
5. Move, rotate, and scale objects with editor-authoritative transforms.
6. Show and edit object inspector fields.
7. Toggle gravity, collisions, floor, object labels, and physics x-ray.
8. Simulate physics with Rapier.
9. Estimate object semantic, physics, and appearance metadata.
10. Normalize metadata into physics profiles.
11. Parse chat into validated single or multi-operation scene edits.
12. Live-generate Meshy GLBs from chat through preview/refine flow.
13. Show generated-task placeholder/progress states.
14. Insert generated GLBs into the scene and select/highlight new objects.
15. Provide explicit local fallback asset insertion.
16. Generate Gemini background images when configured.
17. Save/open named projects with bundled GLBs/backgrounds.
18. Export `scene.glb`.
19. Export `scene.physics.json`.

## Optional / Future Features

- Live SceneGen reconstruction inside the app.
- VGGT integration.
- Cloud GPU reconstruction jobs.
- Video reconstruction.
- Destruction physics.
- OBJ, STL, or USD export.
- GLTF `extras` metadata.
- SSE or webhook progress updates instead of polling.
- Tripo or other provider fallback.

## Fallback Assets

Local assets keep the demo stable when live Meshy generation cannot complete. They should not silently replace Meshy output unless demo mode explicitly requires it or the user clicks a fallback action.

Required fallback filenames:

- `rubber_ball.glb`
- `wooden_crate.glb`
- `glass_vase.glb`
- `metal_barrel.glb`
- `duck.glb`

## Demo Script

1. Load curated SceneGen living-room GLB or a user GLB.
2. Show object registration, viewport selection, and outliner selection.
3. Select table, couch, and vase; show semantic/physics metadata.
4. Toggle object labels or physics x-ray.
5. Toggle gravity and drag/drop an existing dynamic object.
6. Chat: `add a rubber duck on the coffee table`.
7. Show Meshy placeholder/progress.
8. Import returned textured GLB into the scene.
9. Auto-place duck on table and apply physics.
10. Drag duck upward and release.
11. Chat: `make the duck red and bouncy`.
12. Chat: `generate a deep starry night background`.
13. Save the project.
14. Export `scene.glb` and `scene.physics.json`.
