# Product Brief

Updated: 2026-05-30

## Build Goal

Build a GLB-import-first 3D physics editor where users can load a pre-generated scene, interact with object-level physics, edit the scene through chat, and live-generate new 3D assets with Meshy.

SceneGen remains outside the critical runtime path. It can be used manually or through a later cloud preprocessing pipeline, but the hackathon demo should not depend on live scene reconstruction.

## Product Promise

The user can turn a reconstructed 3D scene into an editable physics sandbox. The most visible AI moment is not reconstructing the scene live; it is asking for a new object in chat, watching a Meshy asset generation task run, and seeing the returned GLB appear inside the physics simulation.

## Main User Flow

```text
Load pre-generated SceneGen GLB
-> Register editable scene objects
-> Select and inspect objects
-> Infer object metadata and physics
-> Toggle gravity and collisions
-> User asks: "add a rubber duck on the table"
-> Backend starts live Meshy generation
-> App shows placeholder and progress state
-> Meshy returns GLB
-> App imports generated asset into the scene
-> App estimates/defaults physics
-> User drops generated asset into physics simulation
-> Export scene.glb and scene.physics.json
```

## Required MVP Features

1. Import pre-generated SceneGen GLB.
2. Import optional `manifest.json`.
3. Register editable objects.
4. Select, move, rotate, and scale objects.
5. Show an object inspector.
6. Toggle gravity.
7. Simulate physics with Rapier.
8. Estimate object semantic metadata.
9. Normalize metadata into physics profiles.
10. Parse chat into validated scene operations.
11. Live-generate at least one object with Meshy from chat.
12. Show Meshy task state in the UI.
13. Insert generated GLB into the scene.
14. Apply physics to generated asset.
15. Provide local fallback asset insertion.
16. Export `scene.glb`.
17. Export `scene.physics.json`.

## Optional Features

- Meshy refine or texturing step.
- Meshy image-to-3D from a generated concept image.
- SSE or webhook progress updates.
- Tripo fallback.
- GLTF `extras` metadata.

## Out of Scope

- Live SceneGen reconstruction.
- VGGT integration.
- Cloud GPU reconstruction jobs.
- Video reconstruction.
- Destruction physics.
- OBJ, STL, or USD export.
- Perfect physical accuracy.

## Fallback Assets

Local assets keep the demo stable when live Meshy generation cannot complete. They should not silently replace Meshy output unless demo mode explicitly requires it or the user clicks a fallback action.

Required fallback keys:

- `rubber_ball.glb`
- `wooden_crate.glb`
- `glass_vase.glb`
- `metal_barrel.glb`
- `duck.glb`

## Demo Script

1. Load curated SceneGen living-room GLB.
2. Show source image next to reconstructed 3D scene.
3. Select table, couch, and vase; show physics metadata.
4. Toggle gravity.
5. Drag an existing object and drop it.
6. Chat: `add a rubber duck on the coffee table`.
7. Show live Meshy generation placeholder and progress.
8. Import returned Meshy GLB into the scene.
9. Auto-place duck on table.
10. Apply physics.
11. Drag duck upward and release.
12. Chat: `make the duck bouncier`.
13. Export `scene.glb` and `scene.physics.json`.
