# Implementation Roadmap

Updated: 2026-05-30

## 1. GLB Editor Foundation

Build the import-first editor:

- React/Vite/TypeScript app.
- R3F viewport with camera controls, lighting, and grid/floor.
- GLB import through GLTFLoader.
- Optional `manifest.json` import.
- Object registry with stable app-level IDs.
- Selection, transform controls, and object inspector.
- Zustand store with Zod-validated scene data.

## 2. Rapier Physics

Add runtime physics:

- Gravity toggle.
- Rigid body registration.
- Simplified colliders.
- Drag/release behavior.
- Editable physics profiles.
- Local normalization from semantic metadata into collider, mass, friction, and restitution.

## 3. Chat Operations

Implement safe scene editing through structured operations:

- `/api/command`.
- `SceneOperation` schemas.
- Zod validation.
- Operation dispatcher.
- Commands for gravity, movement, physics edits, deletion, export, and generated asset insertion.

## 4. Meshy Live Generation

This is the first wow milestone.

- `/api/generate-asset`.
- `MeshyProvider`.
- Generated asset status route.
- Generated asset model route.
- Frontend placeholder.
- Polling loop.
- GLB import for generated asset output.
- Generated object registration.
- Physics defaults for generated models.

## 5. Local Fallback Insertion

Add fallback only after the Meshy path exists:

- Local asset library.
- Fallback matching by asset key.
- Explicit "Use fallback asset" UI state.
- Same placement and physics pipeline as generated assets.

## 6. VLM Semantic Estimation

Estimate and normalize object metadata:

- Imported object estimation.
- Generated object estimation.
- Provider interface for OpenAI or Gemini.
- Future-proof interface for a local fine-tuned model.
- Confidence display in inspector.

## 7. Export

Export user changes:

- `scene.glb`.
- `scene.physics.json`.
- Object IDs.
- Object transforms.
- Physics profiles.
- Generated asset source metadata.

## 8. Demo Polish

Prepare for judging:

- Curated living-room scene.
- Source image preview.
- Reset button.
- Scripted example prompts.
- Meshy progress UI.
- Fallback button.
- Highlight newly inserted object.

## Repo Structure Additions

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

## Milestone Definition

The MVP is demo-ready when a user can import a curated `scene.glb`, select and drop an existing object, ask chat to add a rubber duck to the coffee table, watch Meshy generation progress, see the returned GLB placed in the scene, edit the duck's physics, and export both visual and physics artifacts.
