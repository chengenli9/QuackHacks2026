# QuackHacks2026

QuackHacks2026 is a browser-based Scene-to-3D Physics Sandbox. The app imports a pre-generated `scene.glb`, lets users inspect and edit object-level physics, and uses live Meshy text-to-3D generation as the main demo moment for inserting new objects into the scene.

SceneGen is treated as external preprocessing. The runtime app focuses on importing completed GLB scenes, registering editable objects, applying physics through Rapier, parsing chat into validated operations, and exporting the updated scene plus physics metadata.

## Core Demo

1. Load a curated SceneGen living-room GLB.
2. Register and select editable scene objects.
3. Show semantic and physics metadata for selected objects.
4. Toggle gravity and drop an existing object.
5. Chat: `add a rubber duck on the coffee table`.
6. Start a live Meshy generation task.
7. Show a placeholder and progress while the asset is generated.
8. Import the returned GLB, place it on the table, and apply physics.
9. Chat: `make the duck bouncier`.
10. Export `scene.glb` and `scene.physics.json`.

## Documentation

- [Product Brief](docs/product-brief.md)
- [Architecture](docs/architecture.md)
- [Backend API](docs/api.md)
- [Implementation Roadmap](docs/roadmap.md)
- [Updated Build Plan](docs/plans/scene-to-3d-physics-sandbox.md)

## Required Stack

Frontend:

- React
- Vite
- TypeScript
- Three.js
- React Three Fiber
- `@react-three/drei`
- `@react-three/rapier`
- Zustand
- immer
- Zod
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

## Critical Architecture Rule

AI providers never mutate scene state directly. AI calls return validated structured JSON, the operation dispatcher applies accepted changes to the Zustand scene store, and R3F/Rapier react to store updates.

## Demo Priority

Live Meshy generation is the primary wow path. Local GLB assets are a deterministic fallback only when Meshy is unavailable, slow, rate-limited, or returns an unusable model.
